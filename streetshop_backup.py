import os
import asyncio
import logging
import time
import sys
import aiohttp
from datetime import datetime

from aiogram import Bot, Dispatcher, types
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from aiogram.utils import executor
from aiogram.utils.exceptions import NetworkError
from database import db  
from config import cfg
from keyboards import *
from keyboards import order_payment_methods_kb, order_payment_confirm_kb, order_cancel_confirm_kb, back_to_product_kb, generate_order_code, admin_payment_management_kb, edit_start_menu_kb, edit_welcome_components_kb, admin_management_kb, bonus_system_settings_kb, bonus_sections_list_kb, bonus_section_admin_kb, task_status_kb, back_to_bonus_settings_kb
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup
from datetime import datetime, timedelta
from models import db_lock 
from models import init_bot
import requests
from aiogram.types import LabeledPrice, BotCommand
import signal
import sys
from bitpapa_api import bitpapa_api  # Импортируем BitPAPA API

# Глобальные переменные для хранения ID сообщений
status_message_id = None
log_message_id = None
log_messages = []
purchase_notification_id = None  # ID сообщения с уведомлениями о покупках

# Глобальный словарь для хранения состояния навигации пользователей
# Структура: {user_id: {category_id: current_page}}
user_navigation_state = {}

# Глобальные таймеры для батчинга файлов
admin_file_batch_timers = {}  # Для админ файлов
file_batch_timers = {}  # Для обычного добавления файлов

# Глобальные переменные для обработки медиа-групп
media_group_files = {}  # Для хранения файлов из медиа-групп
media_group_timers = {}  # Таймеры для обработки медиа-групп

# Глобальный логгер
logger = None

# Функция для извлечения форматированного текста из сообщения
def get_formatted_text(message: types.Message) -> str:
    """
    Извлекает форматированный текст из сообщения Telegram.
    Приоритет: html_text (с форматированием) -> text (обычный текст)
    """
    if hasattr(message, 'html_text') and message.html_text:
        return message.html_text
    elif hasattr(message, 'text') and message.text:
        return message.text
    else:
        return ""

# Функция для обработки медиа-групп (множественных файлов)
async def process_media_group_files(media_group_id: str, user_id: int):
    """
    Обрабатывает все файлы из медиа-группы и отправляет подтверждение
    """
    if media_group_id not in media_group_files:
        return
    
    files = media_group_files[media_group_id]
    files_count = len(files)
    
    # Отправляем подтверждение о количестве обработанных файлов
    if files_count == 1:
        confirmation_text = "✅ Прикреплен 1 файл!"
    elif files_count in [2, 3, 4]:
        confirmation_text = f"✅ Прикреплено {files_count} файла!"
    else:
        confirmation_text = f"✅ Прикреплено {files_count} файлов!"
    
    try:
        # Отправляем подтверждение пользователю
        await bot.send_message(
            chat_id=user_id,
            text=confirmation_text
        )
    except Exception as e:
        print(f"Ошибка отправки подтверждения медиа-группы: {e}")
    
    # Очищаем данные медиа-группы
    if media_group_id in media_group_files:
        del media_group_files[media_group_id]
    if media_group_id in media_group_timers:
        del media_group_timers[media_group_id]



# Функции для управления состоянием навигации пользователей
def get_user_page_state(user_id: int, category_id: int) -> int:
    """Получает текущую страницу пользователя для категории"""
    global user_navigation_state
    if user_id in user_navigation_state and category_id in user_navigation_state[user_id]:
        return user_navigation_state[user_id][category_id]
    return 0

def set_user_page_state(user_id: int, category_id: int, page: int):
    """Сохраняет текущую страницу пользователя для категории"""
    global user_navigation_state
    if user_id not in user_navigation_state:
        user_navigation_state[user_id] = {}
    user_navigation_state[user_id][category_id] = page

def clear_user_navigation_state(user_id: int):
    """Очищает состояние навигации пользователя"""
    global user_navigation_state
    if user_id in user_navigation_state:
        del user_navigation_state[user_id]

# Функция для проверки админских прав
async def is_user_admin(user_id: int) -> bool:
    """Проверяет, является ли пользователь администратором"""
    try:
        return await db.is_admin(user_id)
    except Exception:
        # Если база недоступна, проверяем только главного админа
        return user_id == cfg.ADMIN_ID

# Функция для обновления команд для нового админа
async def set_admin_commands_for_user(user_id: int):
    """Устанавливает админ команды для конкретного пользователя"""
    try:
        from aiogram.types import BotCommandScopeChat, BotCommand
        
        admin_commands = [
            BotCommand(command="start", description="Главное меню"),
            BotCommand(command="cards", description="💳 Управление реквизитами"),
            BotCommand(command="edit", description="✏️ Изменить /start"),
            BotCommand(command="admins", description="👥 Административный состав"),
            BotCommand(command="send", description="📢 Рассылка")
        ]
        
        await bot.set_my_commands(
            commands=admin_commands,
            scope=BotCommandScopeChat(chat_id=user_id)
        )
        return True
    except Exception as e:
        print(f"⚠️ Ошибка установки команд для пользователя {user_id}: {e}")
        return False

class TelegramLogHandler(logging.Handler):
    """Кастомный обработчик логов, который отправляет сообщения админам в Telegram"""
    
    def __init__(self, bot_instance=None):
        super().__init__()
        self.bot_instance = bot_instance
        self.setLevel(logging.INFO)
        
    def emit(self, record):
        """Добавляет лог-сообщение в общий лог"""
        if not self.bot_instance:
            return
            
        try:
            log_entry = self.format(record)
            
            # Определяем эмодзи по уровню логирования
            if record.levelno >= logging.ERROR:
                emoji = "❌"
            elif record.levelno >= logging.WARNING:
                emoji = "⚠️"
            else:
                emoji = "ℹ️"
            
            # Форматируем сообщение для Telegram
            message = f"{emoji} **Лог бота**\n`{log_entry}`"
            
            # Добавляем в список логов
            current_time = datetime.now().strftime("%H:%M:%S")
            log_entry = f"{emoji} {message}"
            log_messages.append(log_entry)
            
            # Ограничиваем количество сообщений
            if len(log_messages) > 20:
                log_messages = log_messages[-20:]
            
            # Обновляем сообщение
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_update_log_message())
        except Exception:
            pass  # Игнорируем ошибки в самом логере
    
async def _update_log_message():
    """Обновляет сообщение с логами у всех админов"""
    global log_message_id, log_messages
    
    if not log_messages:
        return
    
    # Получаем список админов
    try:
        # Проверяем подключение к БД
        if db.conn is None:
            await db.connect()
        admins = await db.get_all_admins()
        admin_ids = [admin[0] for admin in admins]
    except Exception:
        admin_ids = [cfg.ADMIN_ID] if cfg.ADMIN_ID else []
    
    if not admin_ids:
        return
    
    # Форматируем сообщение
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_text = "\n".join(log_messages[-10:])  # Показываем последние 10 записей
    full_message = f"📋 **Логи бота**\n🕰 {current_time}\n\n{log_text}"
    
    try:
        if log_message_id is None:
            # Создаем новое сообщение у всех админов
            message_ids = {}
            for admin_id in admin_ids:
                try:
                    message = await bot.send_message(
                        chat_id=admin_id,
                        text=full_message,
                        parse_mode="Markdown"
                    )
                    message_ids[admin_id] = message.message_id
                except Exception:
                    pass
            log_message_id = message_ids
        else:
            # Обновляем существующие сообщения
            if isinstance(log_message_id, dict):
                for admin_id, msg_id in log_message_id.items():
                    try:
                        await bot.edit_message_text(
                            chat_id=admin_id,
                            message_id=msg_id,
                            text=full_message,
                            parse_mode="Markdown"
                        )
                    except Exception:
                        pass
    except Exception:
        pass

# Функция для отправки лога админам
async def send_log_to_admins(message: str, level: str = "info"):
    """Добавляет лог-сообщение в общий лог"""
    global log_messages
    
    # Определяем эмодзи по уровню
    emoji_map = {
        "error": "❌",
        "warning": "⚠️", 
        "info": "ℹ️",
        "success": "✅",
        "debug": "🔍"
    }
    emoji = emoji_map.get(level.lower(), "ℹ️")
    
    # Добавляем в список логов
    current_time = datetime.now().strftime("%H:%M:%S")
    log_entry = f"{emoji} {message}"
    log_messages.append(log_entry)
    
    # Ограничиваем количество сообщений
    if len(log_messages) > 20:
        log_messages = log_messages[-20:]
    
    # Обновляем сообщение
    await _update_log_message()

# Функция для отправки уведомлений админам о покупках
async def send_purchase_notification(user_id: int, username: str, product_name: str, payment_method: str = "Выбирает метод оплаты"):
    """Отправляет или обновляет уведомление админам о покупке"""
    global purchase_notification_id
    
    # Получаем список всех администраторов
    try:
        if db.conn is None:
            await db.connect()
        admins = await db.get_all_admins()
        admin_ids = [admin[0] for admin in admins]
    except Exception as e:
        print(f"⚠️ Ошибка получения списка админов: {e}")
        admin_ids = [cfg.ADMIN_ID] if cfg.ADMIN_ID else []
    
    if not admin_ids:
        return
    
    # Форматируем username с @
    user_mention = f"@{username}" if username else f"ID: {user_id}"
    
    try:
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Экранируем специальные символы для Markdown
        safe_product_name = product_name.replace('*', '\\*').replace('_', '\\_').replace('[', '\\[').replace(']', '\\]').replace('(', '\\(').replace(')', '\\)').replace('`', '\\`')
        safe_payment_method = payment_method.replace('*', '\\*').replace('_', '\\_').replace('[', '\\[').replace(']', '\\]').replace('(', '\\(').replace(')', '\\)').replace('`', '\\`')
        
        notification_text = f"🛒 **Уведомление о покупке**\n🕰 {current_time}\n\n" \
                           f"👤 Пользователь: {user_mention}\n" \
                           f"🆔 ID: `{user_id}`\n" \
                           f"📦 Товар: {safe_product_name}\n" \
                           f"💳 Метод оплаты: {safe_payment_method}"
        
        if purchase_notification_id is None:
            # Создаем новое сообщение у всех админов
            message_ids = {}
            for admin_id in admin_ids:
                try:
                    message = await bot.send_message(
                        chat_id=admin_id,
                        text=notification_text,
                        parse_mode="Markdown"
                    )
                    message_ids[admin_id] = message.message_id
                except Exception as e:
                    print(f"⚠️ Ошибка отправки уведомления админу {admin_id}: {e}")
            purchase_notification_id = message_ids
        else:
            # Обновляем существующие сообщения
            if isinstance(purchase_notification_id, dict):
                for admin_id, msg_id in purchase_notification_id.items():
                    try:
                        await bot.edit_message_text(
                            chat_id=admin_id,
                            message_id=msg_id,
                            text=notification_text,
                            parse_mode="Markdown"
                        )
                    except Exception as e:
                        print(f"⚠️ Ошибка обновления уведомления у админа {admin_id}: {e}")
    except Exception as e:
        print(f"⚠️ Ошибка отправки уведомления о покупке: {e}")

async def send_status_update(text: str, is_new: bool = False):
    """Отправляет или обновляет статусное сообщение в Telegram всем администраторам"""
    global status_message_id
    
    # Получаем список всех администраторов
    try:
        # Проверяем подключение к БД
        if db.conn is None:
            await db.connect()
        admins = await db.get_all_admins()
        admin_ids = [admin[0] for admin in admins]  # Извлекаем ID администраторов
    except Exception as e:
        print(f"⚠️ Ошибка получения списка админов: {e}")
        # Fallback на главного админа если что-то пошло не так
        admin_ids = [cfg.ADMIN_ID] if cfg.ADMIN_ID else []
    
    if not admin_ids:
        return
    
    try:
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        full_message = f"🤖 **Статус бота**\n🕰 {current_time}\n\n{text}"
        
        if is_new or status_message_id is None:
            # Отправляем новое сообщение всем администраторам
            message_ids = {}
            for admin_id in admin_ids:
                try:
                    message = await bot.send_message(
                        chat_id=admin_id,
                        text=full_message,
                        parse_mode="Markdown"
                    )
                    message_ids[admin_id] = message.message_id
                except Exception as e:
                    print(f"⚠️ Ошибка отправки сообщения админу {admin_id}: {e}")
                    await send_log_to_admins(f"Ошибка отправки сообщения админу {admin_id}: {e}", "warning")
            
            # Сохраняем ID сообщений для дальнейшего обновления
            status_message_id = message_ids
        else:
            # Обновляем существующие сообщения у всех администраторов
            if isinstance(status_message_id, dict):
                for admin_id, msg_id in status_message_id.items():
                    try:
                        await bot.edit_message_text(
                            chat_id=admin_id,
                            message_id=msg_id,
                            text=full_message,
                            parse_mode="Markdown"
                        )
                    except Exception as e:
                        print(f"⚠️ Ошибка обновления сообщения у админа {admin_id}: {e}")
                        await send_log_to_admins(f"Ошибка обновления сообщения у админа {admin_id}: {e}", "warning")
    except Exception as e:
        print(f"⚠️ Ошибка отправки статуса в Telegram: {e}")
        await send_log_to_admins(f"Ошибка отправки статуса в Telegram: {e}", "error")

async def get_system_info():
    """Получает информацию о системе"""
    import sys
    import os
    
    return {
        "python_version": sys.version,
        "working_directory": os.getcwd(),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

# Дефолтные реквизиты для оплаты
DEFAULT_PAYMENT_DETAILS = {
    "sbp_phone": "+79266490693 Т-Банк",
    "card": "2200 7020 0936 0848",
    "crypto": "bc1q69mv44ckgrlxe6x0g83awj6qdekdd3laktytyr",
    "stars_url": "https://duckduckgo.com/?q=%D0%B7%D0%BD%D0%B0%D0%BA++%D1%80%D1%83%D0%B1%D0%BB%D1%8C&ia=web",
    "cryptobot_url": "https://duckduckgo.com/?q=%D0%B7%D0%BD%D0%B0%D0%BA++%D1%80%D1%83%D0%B1%D0%BB%D1%8C&ia=web",
    "stars_provider_token": cfg.STARS_PROVIDER_TOKEN  # Добавляем Stars provider token
}

def is_valid_telegram_file_id(file_id: str) -> bool:
    """Проверяет, является ли строка валидным Telegram file ID"""
    if not file_id or not isinstance(file_id, str):
        return False
    
    # Минимальная длина Telegram file ID
    if len(file_id) < 20:
        return False
    
    # Telegram file ID содержит только специальные символы
    allowed_chars = set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')
    if not all(c in allowed_chars for c in file_id):
        return False
    
    # Обычно Telegram file ID начинается с определенных префиксов для фото
    photo_prefixes = ['AgAC', 'BAADAgAD', 'BQADAgAD', 'CAADAgAD', 'BAAD', 'BQAD', 'CAAD']
    if not any(file_id.startswith(prefix) for prefix in photo_prefixes):
        return False
    
    return True

# Вспомогательные функции для работы с медиа-файлами
async def send_media_by_type(chat_id, file_id, caption=None, reply_markup=None, parse_mode="HTML"):
    """Отправляет медиа-файл, автоматически определяя его тип (фото, анимация или видео)"""
    if not file_id:
        return None
        
    try:
        # Пытаемся отправить как фото
        try:
            return await bot.send_photo(
                chat_id=chat_id,
                photo=file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode=parse_mode
            )
        except:
            # Если фото не работает, пробуем как анимацию
            try:
                return await bot.send_animation(
                    chat_id=chat_id,
                    animation=file_id,
                    caption=caption,
                    reply_markup=reply_markup,
                    parse_mode=parse_mode
                )
            except:
                # Если анимация не работает, пробуем как видео
                return await bot.send_video(
                    chat_id=chat_id,
                    video=file_id,
                    caption=caption,
                    reply_markup=reply_markup,
                    parse_mode=parse_mode
                )
    except Exception as e:
        print(f"Error sending media {file_id}: {e}")
        return None

async def answer_media_by_type(message, file_id, caption=None, reply_markup=None, parse_mode="HTML"):
    """Отвечает медиа-файлом, автоматически определяя его тип (фото, анимация или видео)"""
    if not file_id:
        return None
        
    try:
        # Пытаемся отправить как фото
        try:
            return await message.answer_photo(
                photo=file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode=parse_mode
            )
        except:
            # Если фото не работает, пробуем как анимацию
            try:
                return await message.answer_animation(
                    animation=file_id,
                    caption=caption,
                    reply_markup=reply_markup,
                    parse_mode=parse_mode
                )
            except:
                # Если анимация не работает, пробуем как видео
                return await message.answer_video(
                    video=file_id,
                    caption=caption,
                    reply_markup=reply_markup,
                    parse_mode=parse_mode
                )
    except Exception as e:
        print(f"Error answering media {file_id}: {e}")
        return None


# Глобальная функция для получения реквизитов из БД
async def get_current_payment_details():
    """Получает текущие реквизиты из базы данных"""
    details = await db.get_all_payment_details()
    # Возвращаем словарь с дефолтными значениями если что-то отсутствует
    return {
        "sbp_phone": details.get("sbp_phone", DEFAULT_PAYMENT_DETAILS["sbp_phone"]),
        "card": details.get("card", DEFAULT_PAYMENT_DETAILS["card"]),
        "crypto": details.get("crypto", DEFAULT_PAYMENT_DETAILS["crypto"]),
        "stars_url": details.get("stars_url", DEFAULT_PAYMENT_DETAILS["stars_url"]),
        "cryptobot_url": details.get("cryptobot_url", DEFAULT_PAYMENT_DETAILS["cryptobot_url"]),
        # Новый параметр: API токен криптобота (может отсутствовать в дефолтах)
        "cryptobot_api_key": details.get("cryptobot_api_key", getattr(cfg, 'CRYPTOBOT_API_KEY', '')),
        # Новый параметр: Stars provider token из базы данных
        "stars_provider_token": details.get("stars_provider_token", cfg.STARS_PROVIDER_TOKEN),
        # Новый параметр: Отдельный провайдер токен для карточных платежей
        "card_provider_token": details.get("card_provider_token", None)  # None означает отсутствие провайдера
    }

# Инициализация бота и диспетчера
bot = Bot(token=cfg.BOT_TOKEN)
init_bot(bot)  # Инициализируем глобальную переменную bot в models.py
storage = MemoryStorage()
dp = Dispatcher(bot, storage=storage)

# Устанавливаем Menu Button для отображения кнопки "Меню" рядом со скрепкой
async def set_menu_button():
    """Устанавливает кнопку Меню в интерфейсе ввода сообщений"""
    try:
        await bot.set_chat_menu_button(
            menu_button={
                "type": "commands",
                "text": "Меню"
            }
        )
        print("✅ Menu Button установлена успешно")
    except Exception as e:
        print(f"❌ Ошибка установки Menu Button: {e}")

async def set_bot_commands():
    """Устанавливает команды бота для отображения в Menu Button"""
    try:
        # Обычные команды для всех пользователей
        user_commands = [
            BotCommand(command="start", description="Главное меню")
        ]
        
        # Команды для администратора
        admin_commands = [
            BotCommand(command="start", description="Главное меню"),
            BotCommand(command="cards", description="💳 Управление реквизитами"),
            BotCommand(command="edit", description="✏️ Изменить /start"),
            BotCommand(command="admins", description="👥 Административный состав"),
            BotCommand(command="send", description="📢 Рассылка"),
            BotCommand(command="promo", description="🎁 Управление промокодами")
        ]
        
        # Устанавливаем обычные команды
        await bot.set_my_commands(user_commands)
        
        # Устанавливаем команды для всех админов
        try:
            from aiogram.types import BotCommandScopeChat
            
            # Устанавливаем для главного админа
            await bot.set_my_commands(
                commands=admin_commands,
                scope=BotCommandScopeChat(chat_id=cfg.ADMIN_ID)
            )
            
            # Получаем всех админов из базы данных
            try:
                admins = await db.get_all_admins()
                for admin in admins:
                    admin_id = admin[0]
                    # Пропускаем главного админа, так как уже установили
                    if admin_id != cfg.ADMIN_ID:
                        try:
                            await bot.set_my_commands(
                                commands=admin_commands,
                                scope=BotCommandScopeChat(chat_id=admin_id)
                            )
                        except Exception as e:
                            print(f"⚠️ Не удалось установить команды для админа {admin_id}: {e}")
            except Exception as e:
                print(f"⚠️ Ошибка получения списка админов: {e}")
                
        except Exception as e:
            print(f"⚠️ Ошибка установки админ команд: {e}")
            
        print("✅ Команды бота установлены успешно")
    except Exception as e:
        print(f"❌ Ошибка установки команд: {e}")

def format_description_with_preview(description: str, preview_link: str = None) -> str:
    """Форматирует описание с скрытой preview ссылкой сверху"""
    # Проверяем на None и строку 'None'
    if not preview_link or preview_link == 'None' or preview_link.lower() == 'none':
        return description or ""
    
    # Создаем скрытую ссылку с невидимым символом
    hidden_link = f'<a href="{preview_link}">\u200b</a>'  # Zero Width Space
    
    # Если описание пустое, возвращаем только скрытую ссылку
    if not description:
        return hidden_link
    
    # Добавляем скрытую ссылку в начало описания
    return f"{hidden_link}{description}"

async def send_product_files(user_id: int, product_id: int, quantity: int = 1, day_period: int = None):
    """Отправляет файлы товара покупателю в соответствии с количеством и периодом дней"""
    try:
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            return False
        
        # Получаем файлы товара с учетом периода дней
        if day_period is not None:
            product_files = await db.get_product_files(product_id, day_period)
        else:
            product_files = await db.get_product_files(product_id)
        
        if not product_files:
            # Нет файлов - отправляем только сообщение
            day_info = f" на {day_period} дней" if day_period else ""
            await bot.send_message(
                chat_id=user_id,
                text=f"✅ Спасибо за покупку!\n\n💰 Товар: {product[3]}{day_info}\n📦 Количество: {quantity} шт"
            )
            return True
        
        # Проверяем, что файлов достаточно
        if quantity > len(product_files):
            quantity = len(product_files)
        
        # Отправляем файлы в соответствии с количеством
        for i in range(quantity):
            file_data = product_files[i]
            file_id = file_data[1]  # file_id
            file_type = file_data[2]  # file_type
            file_name = file_data[3]  # file_name
            
            day_info = f" ({day_period} дней)" if day_period else ""
            
            caption = f"✅ Спасибо за покупку! ({i+1}/{quantity})\n\n💰 Товар: {product[3]}{day_info}"
            if file_name:
                caption += f"\n📁 Файл: {file_name}"
            
            # Отправляем файл в зависимости от типа
            if file_type == 'document':
                await bot.send_document(
                    chat_id=user_id,
                    document=file_id,
                    caption=caption
                )
            elif file_type == 'photo':
                await bot.send_photo(
                    chat_id=user_id,
                    photo=file_id,
                    caption=caption
                )
            else:
                # Неизвестный тип файла - пробуем как документ
                await bot.send_document(
                    chat_id=user_id,
                    document=file_id,
                    caption=caption
                )
        
        return True
        
    except Exception as e:
        print(f"Error sending product files: {e}")
        # Отправляем сообщение об ошибке
        try:
            await bot.send_message(
                chat_id=user_id,
                text=f"❌ Ошибка при отправке файлов товара.\n\n💰 Товар: {product[3] if product else 'Неизвестный товар'}\n📦 Количество: {quantity} шт\n\n💬 Обратитесь в поддержку: @{cfg.SUPPORT_ID}"
            )
        except:
            pass
        return False

# Оставляем старую функцию для совместимости
async def send_product_file(user_id: int, product_id: int):
    """Отправляет один файл товара покупателю (для совместимости)"""
    return await send_product_files(user_id, product_id, 1)

class AdminReply(StatesGroup):
    waiting_for_operator_name = State()
    waiting_for_reply_text = State()

# ...
class SupportTicket(StatesGroup):
    waiting_for_message = State()

class PaymentStates(StatesGroup):
    waiting_for_amount = State()
    waiting_for_payment = State()

class CatalogAddStates(StatesGroup):
    waiting_for_sticker = State()
    waiting_for_photo = State()
    waiting_for_name = State()
    waiting_for_description = State()
    waiting_for_preview_link = State()
    waiting_for_row_width = State()
    waiting_for_price = State()
    waiting_for_expiration_days = State()  # Новое состояние для дней действия
    waiting_for_file = State()  # Новое состояние для загрузки файла
    waiting_for_files_by_days = State()  # Состояние для загрузки файлов по дням
    # Новые состояния для 3x6 сетки
    waiting_for_grid_choice = State()
    waiting_for_manual_grid_config = State()  # Ручная настройка сетки
    waiting_for_search_button_name = State()
    waiting_for_back_button_text = State()
    # Состояния для массовой загрузки файлов
    waiting_for_bulk_files = State()
    waiting_for_bulk_confirmation = State()
    # Состояния подтверждения отмены
    cancel_confirmation = State()

class CatalogSearchStates(StatesGroup):
    waiting_for_search_query = State()

class PaymentDetailsStates(StatesGroup):
    waiting_for_sbp_phone = State()
    waiting_for_card = State()
    waiting_for_crypto = State()
    waiting_for_stars_url = State()
    waiting_for_cryptobot_url = State()
    waiting_for_cryptobot_api = State()
    waiting_for_stars_provider_token = State()  # Новое состояние для Stars provider token
    # Новые состояния для BitPAPA
    waiting_for_bitpapa_token = State()

class TokenManagementStates(StatesGroup):
    """Состояния для управления API токенами"""
    waiting_for_token_selection = State()  # Выбор токена для редактирования
    waiting_for_new_token_value = State()  # Ожидание нового значения токена

class WelcomeEditStates(StatesGroup):
    waiting_for_sticker = State()
    waiting_for_photo = State()
    waiting_for_text = State()
    waiting_for_photo = State()
    waiting_for_text = State()
    waiting_for_catalog_photo = State()  # Новое состояние для редактирования фото каталога

class BonusSystemStates(StatesGroup):
    # Основные настройки системы бонусов
    waiting_for_bonus_sticker = State()
    waiting_for_bonus_photo = State()
    waiting_for_bonus_description = State()
    
    # Создание категорий теперь использует CatalogAddStates
    # waiting_for_section_name = State()      # УДАЛЕНО - теперь используем CatalogAddStates
    # waiting_for_section_description = State() # УДАЛЕНО
    # waiting_for_section_photo = State()     # УДАЛЕНО
    
    # Создание списка заданий
    waiting_for_task_photo = State()
    waiting_for_task_name = State()
    waiting_for_task_description = State()
    
    # Создание условий покупок
    waiting_for_purchase_condition_name = State()
    waiting_for_purchase_condition_amount = State()
    waiting_for_purchase_condition_reward = State()
    
    # Настройка раздела "Сделать покупки"
    waiting_for_purchases_name = State()
    waiting_for_purchases_description = State()
    waiting_for_purchases_photo = State()
    waiting_for_purchase_task_name = State()
    waiting_for_purchase_task_amount = State()
    waiting_for_purchase_task_reward = State()
    
    # Настройка раздела "Пригласить друзей"
    waiting_for_referral_name = State()
    waiting_for_referral_description = State()
    waiting_for_referral_photo = State()
    waiting_for_referral_task_name = State()
    waiting_for_referral_task_friends_count = State()
    waiting_for_referral_task_reward = State()
    
    # Настройка раздела "Купить товар"
    waiting_for_product_section_name = State()
    waiting_for_product_section_description = State()
    waiting_for_product_section_photo = State()
    waiting_for_product_task_name = State()
    waiting_for_product_task_reward = State()
    waiting_for_product_task_link = State()
    
    # Новые состояния для создания заданий
    waiting_for_task_type_selection = State()
    
    # Общие поля для всех типов заданий
    waiting_for_new_task_name = State()
    waiting_for_new_task_reward = State()
    
    # Специфичные поля для разных типов заданий
    waiting_for_purchase_amount = State()      # Минимальная сумма покупки
    waiting_for_friends_count = State()        # Количество друзей
    waiting_for_product_link = State()         # Ссылка на товар

    # Настройка розыгрыша за тег
    waiting_for_tag_lottery_name = State()
    waiting_for_tag_lottery_description = State()
    waiting_for_tag_lottery_photo = State()
    waiting_for_tag_lottery_tag = State()

class CryptoBotStates(StatesGroup):
    waiting_for_payment_confirmation = State()

class AdminManagementStates(StatesGroup):
    waiting_for_admin_id = State()  # Ожидание ID админа для добавления
    waiting_for_remove_admin_id = State()  # Ожидание ID админа для удаления
    waiting_for_remove_admin_id = State()  # Ожидание ID админа для удаления

class BroadcastStates(StatesGroup):
    # Рассылка всем пользователям
    broadcast_all_photo = State()           # Ожидание фото для рассылки всем
    broadcast_all_description = State()     # Ожидание описания для рассылки всем
    broadcast_all_buttons = State()         # Ожидание кнопок для рассылки всем
    
    # Рассылка отдельным пользователям
    broadcast_individual_users = State()    # Ожидание ID пользователей
    broadcast_individual_photo = State()    # Ожидание фото для индивидуальной рассылки
    broadcast_individual_description = State()  # Ожидание описания для индивидуальной рассылки
    broadcast_individual_buttons = State()  # Ожидание кнопок для индивидуальной рассылки
    
    # Рассылка товаров
    broadcast_product_selection = State()   # Выбор товара для рассылки
    broadcast_product_edit_description = State()  # Редактирование описания товара
    broadcast_product_edit_photo = State()  # Редактирование фото товара
    broadcast_product_edit_preview = State()  # Редактирование preview ссылки
    broadcast_product_target_selection = State()  # Выбор цели рассылки (всем/отдельным)

class PromoCodeStates(StatesGroup):
    waiting_for_promo_code = State()
    waiting_for_product_promo = State()  # Новое состояние для промокода товара

# Состояния редактирования товара админом (отдельно от CatalogAddStates)
class AdminProductEditStates(StatesGroup):
    waiting_for_name = State()
    waiting_for_description = State()
    waiting_for_preview_link = State()
    waiting_for_price = State()
    waiting_for_photo = State()
    waiting_for_file = State()

# Состояния редактирования элементов каталога (категорий, тем, подкатегорий)
class AdminCatalogEditStates(StatesGroup):
    waiting_for_name = State()
    waiting_for_description = State()
    waiting_for_sticker = State()
    waiting_for_photo = State()
    waiting_for_preview_link = State()
# streetshop.py (исправленная часть)

# --- PROMO CODE AND SHARE ---

# You will need to add these functions to your database.py
# and create the promo_codes table.
#
# CREATE TABLE IF NOT EXISTS promo_codes (
#     id INTEGER PRIMARY KEY AUTOINCREMENT,
#     code TEXT NOT NULL UNIQUE,
#     discount INTEGER NOT NULL
# );
#
# async def add_promo_code(code: str, discount: int):
#     await db.conn.execute("INSERT OR REPLACE INTO promo_codes (code, discount) VALUES (?, ?)", (code, discount))
#     await db.conn.commit()
#
# async def get_promo_code(code: str):
#     cursor = await db.conn.execute("SELECT code, discount FROM promo_codes WHERE code = ?", (code,))
#     return await cursor.fetchone()
#
# Also, you need to modify the keyboard generation for your product view.
# Find where you create the InlineKeyboardMarkup for the product and add these buttons:
#
# keyboard.add(
#     InlineKeyboardButton("🎁 Есть промокод", callback_data=f"promo_code_{product_id}"),
#     InlineKeyboardButton("🔗 Поделиться", callback_data=f"share_product_{product_id}")
# )
#
# Also, your buy product handler should be modified to accept an optional promo code,
# for example: callback_data=f"buy_product_{product_id}_{promo_code}"


@dp.message_handler(commands=['promo'], state='*')
async def promo_command_handler(message: types.Message):
    """
    Handles the /promo command for admins to add new promo codes.
    Format: /promo <code> <discount_percent>
    """
    if not await is_user_admin(message.from_user.id):
        await message.answer("�� Эта команда доступна только администраторам.")
        return

    args = message.get_args().split()
    if len(args) != 2:
        await message.answer("ℹ️ Неверный формат. Используйте: `/promo <название_промокода> <процент_скидки>`\nПример: `/promo bestAIskill 50`", parse_mode="Markdown")
        return

    code, discount_str = args
    try:
        discount = int(discount_str)
        if not (0 < discount <= 100):
            raise ValueError("Discount out of range")
    except ValueError:
        await message.answer("❌ Процент скидки должен быть целым числом от 1 до 100.")
        return

    try:
        await db.add_promo_code(code, discount)
        await message.answer(f"✅ Промокод `{code}` на скидку {discount}% успешно добавлен.", parse_mode="Markdown")
    except Exception as e:
        # This will fail if db.add_promo_code is not implemented.
        # For now, we will log the error.
        print(f"DB Error (expected if not implemented): could not add promo code. {e}")
        await message.answer(f"❌ Ошибка при добавлении промокода. Убедитесь, что функция `add_promo_code` реализована в `database.py`.")

@dp.callback_query_handler(lambda c: c.data.startswith("promo_code_"))
async def promo_code_button_handler(callback: types.CallbackQuery, state: FSMContext):
    """
    Handles the 'Have a promo code' button click.
    Asks the user to enter a promo code.
    """
    product_id = int(callback.data.split("_")[2])
    product = await db.get_catalog_item(product_id)
    if not product:
        await callback.answer("Товар не найден.", show_alert=True)
        return

    product_name = product[3]
    
    await PromoCodeStates.waiting_for_promo_code.set()
    await state.update_data(product_id=product_id, original_message_id=callback.message.message_id)

    # We edit the original message to ask for the code
    await callback.message.edit_text(
        f"🎁 **Промокод**: {product_name}\n\n"
        "Пришлите в ответ промокод:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_product_{product_id}"))
    )
    await callback.answer()


@dp.message_handler(state=PromoCodeStates.waiting_for_promo_code)
async def process_promo_code_input(message: types.Message, state: FSMContext):
    """
    Processes the promo code sent by the user.
    """
    promo_code = message.text.strip()
    user_data = await state.get_data()
    product_id = user_data.get('product_id')
    original_message_id = user_data.get('original_message_id')

    await state.finish()
    
    # Delete user's promo code message
    await message.delete()

    promo = await db.get_promo_code(promo_code)

    if promo:
        # Promo found, apply discount - save it in user state
        code, discount = promo
        user_state = dp.current_state(user=message.from_user.id)
        await user_state.update_data({
            'promo_code': promo_code,
            'discount_percent': discount,
            'product_id': product_id
        })
        
    # Return to product view regardless of promo validity
    await recreate_product_view(message.chat.id, original_message_id, product_id, message.from_user.id)


@dp.callback_query_handler(lambda c: c.data.startswith("share_product_"))
async def share_product_button_handler(callback: types.CallbackQuery):
    """
    Handles the 'Share' button click.
    Sends a message with a link to the product.
    """
    product_id = int(callback.data.split("_")[2])
    product = await db.get_catalog_item(product_id)
    if not product:
        await callback.answer("Товар не найден.", show_alert=True)
        return

    product_name = product[3]
    # Получаем актуальное имя бота для ссылки
    try:
        bot_user = await bot.get_me()
        bot_username = bot_user.username or cfg.BOT_USERNAME
    except Exception:
        bot_username = cfg.BOT_USERNAME
    
    share_link = f"https://t.me/{bot_username}?start=product_{product_id}"

    keyboard = InlineKeyboardMarkup().add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"show_product_{product_id}")
    )
    
    # Edit the message to show the share link
    await callback.message.edit_text(
        f"🔗 Поделиться: {product_name}\n\n"
        f"🎯 Прямая ссылка на товар:\n\n"
        f"`{share_link}`\n\n",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )
    await callback.answer()

# This handler is crucial for the "Back" buttons to work.
# It must replicate how products are normally shown.
# If you have a function that shows a product, call it here.
@dp.callback_query_handler(lambda c: c.data.startswith("show_product_"))
async def show_product_from_callback(callback: types.CallbackQuery):
    product_id = int(callback.data.split("_")[2])
    product = await db.get_catalog_item(product_id)
    if not product:
        await callback.answer("Товар не найден", show_alert=True)
        return

    name = product[3]
    description = product[4]
    price_info = await db.get_product_price(product_id)
    price = price_info[0] / 100 if price_info else 0
    photo_id = product[6]
    preview_link = product[7]

    keyboard = product_purchase_kb(product_id, price)
    # Assuming back button goes to a category view
    category_id = product[1]
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{category_id}"))

    caption = f"<b>{name}</b>\n\n{description}"
    if preview_link and preview_link != 'None':
        caption = f"<a href='{preview_link}'>&#8203;</a>{caption}"

    # Используем новую функцию с правильным порядком стикеров
    await replace_message_with_sticker_first(
        callback=callback,
        new_text=caption if not photo_id else None,
        new_photo=photo_id if photo_id else None,
        new_caption=caption if photo_id else None,
        new_keyboard=keyboard,
        sticker_id=product[5] if product[5] else None
    )
    await callback.answer()


async def show_product_by_id(message: types.Message, product_id: int):
    """
    Sends a product view in a new message. Used for deep links.
    """
    product = await db.get_catalog_item(product_id)

    if not product:
        await message.answer("Товар не найден.")
        return

    # Отправляем стикер если есть (ВАЖНО: до отправки фото/текста)
    if product[5]:  # sticker_id
        try:
            await message.answer_sticker(product[5])
        except Exception as e:
            print(f"Error sending sticker: {e}")
    
    # Получаем цену и дни действия товара
    price_info = await db.get_product_price_with_days(product_id)
    
    # Получаем количество файлов товара
    files_count = await db.get_product_files_count(product_id)
    
    # Формируем описание с скрытой preview ссылкой сверху
    formatted_description = format_description_with_preview(product[4], product[7])
    
    # Добавляем информацию о цене за штуку и доступном количестве
    if price_info:
        price_rub = price_info[0] / 100  # Конвертируем из копеек в рубли
        
        # Показываем цену за штуку только если товаров больше 1
        if files_count > 1:
            formatted_description += f"\n\n<b>Цена за шт</b>: {price_rub:.0f}₽"
    
    # Показываем доступное количество только если товаров больше 1
    if files_count > 1:
        formatted_description += f"\n<b>Доступно</b>: {files_count} шт"
    
    # Создаем клавиатуру с учетом количества файлов
    keyboard = InlineKeyboardMarkup()
    
    # Добавляем кнопки покупки если есть цена
    if price_info:
        price_rub = price_info[0] / 100
        expiration_days = price_info[2] if len(price_info) > 2 else None
        
        # Если товар имеет дни действия, показываем клавиатуру выбора дней
        if expiration_days and expiration_days.strip():
            from keyboards import expiration_days_selection_kb
            min_days = int(expiration_days.split(',')[0])
            available_days = [int(day.strip()) for day in expiration_days.split(',')]
            files_count_by_days = {}
            for day in available_days:
                files_count_by_days[day] = await db.get_product_files_count_by_days(product_id, day)
            
            keyboard = expiration_days_selection_kb(
                product_id, expiration_days, min_days, price_rub, files_count, 1, files_count_by_days,
                user_id=message.from_user.id, product_parent_id=product[1]
            )
        else:
            # Обычные товары без дней действия
            from keyboards import product_purchase_kb
            keyboard = product_purchase_kb(product_id, price_rub, 1, max(files_count, 1))
    else:
        # Если нет цены, создаем базовую клавиатуру с кнопками промокода и поделиться
        keyboard.add(
            InlineKeyboardButton("🎁 Есть промокод", callback_data=f"promo_code_{product_id}")
        )
        keyboard.add(
            InlineKeyboardButton("🔗 Поделиться", callback_data=f"share_product_{product_id}")
        )
    
    # Добавляем кнопку "Назад в меню" для deep link
    keyboard.add(InlineKeyboardButton("🔙 Назад в меню", callback_data="back_to_main"))

    # Отправляем фото или текст с одинаковым форматированием
    if product[6] and is_valid_telegram_file_id(product[6]):  # photo_id
        await message.answer_photo(
            photo=product[6],
            caption=formatted_description,
            parse_mode="HTML",
            reply_markup=keyboard
        )
    else:
        await message.answer(
            formatted_description,
            parse_mode="HTML",
            reply_markup=keyboard
        )

# --- END PROMO CODE AND SHARE ---

# streetshop.py (дополнение)
async def get_cryptobot_api_key() -> str:
    """Получить актуальный CryptoBot API токен: сперва из БД, затем из cfg."""
    try:
        details = await db.get_all_payment_details()
        token = details.get("cryptobot_api_key")
        if token:
            return token.strip()
    except Exception:
        pass
    return getattr(cfg, 'CRYPTOBOT_API_KEY', '') or ''

async def check_cryptobot_payments():
    """Проверяет статус платежей CryptoBot"""
    while True:
        try:
            # Проверяем, есть ли API ключ (из БД или из cfg)
            api_key = await get_cryptobot_api_key()
            if not api_key:
                await asyncio.sleep(300)  # Проверяем реже если ключ не настроен
                continue

            import aiohttp
            headers = {"Crypto-Pay-API-Token": api_key}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://pay.crypt.bot/api/getInvoices",
                    params={"count": 10, "status": "paid"},
                    headers=headers
                ) as response:
                    if response.status != 200:
                        print(f"Ошибка запроса к CryptoBot API: {response.status}")
                        await asyncio.sleep(60)
                        continue

                    data = await response.json()
                    if not data.get("ok"):
                        print(f"Ошибка в ответе CryptoBot: {data.get('error')}")
                        await asyncio.sleep(60)
                        continue

                    invoices = data.get("result", {}).get("items", [])

                    for invoice in invoices:
                        if not invoice.get("payload"):
                            continue

                        try:
                            # Парсим payload для определения типа платежа
                            payload_parts = invoice["payload"].split(":")
                            
                            if len(payload_parts) == 3 and payload_parts[0] == "order":
                                # Это платеж за заказ
                                user_id = int(payload_parts[1])
                                code = payload_parts[2]
                                amount = float(invoice["amount"])
                                asset = invoice.get("asset", "")

                                # Проверяем, не обработан ли уже этот заказ
                                order = await db.get_order(code)
                                if not order or order[6] != "pending":  # status
                                    continue

                                # Обновляем статус заказа на оплаченный
                                await db.update_order_status(code, 'paid')
                                await db.update_order_payment_method(code, 'CryptoBot')
                                await db.conn.commit()
                                
                                # Отправляем файлы товара в соответствии с количеством и периодом дней
                                # order[10] is selected_days
                                selected_days = order[10] if len(order) > 10 else None
                                await send_product_files(user_id, order[2], order[4], selected_days)  # order[4] = quantity

                                # Уведомляем пользователя
                                try:
                                    price_rub = order[5] / 100
                                    product = await db.get_catalog_item(order[2])
                                    product_name = product[3] if product else "Неизвестный товар"
                                    
                                    await bot.send_message(
                                        chat_id=user_id,
                                        text=f"✅ Ваш заказ оплачен через CryptoBot ({asset})!\n\n📦 Товар: {product_name}\n💰 Сумма: {price_rub:.0f}₽\nКод заказа: <code>{code}</code>",
                                        parse_mode="HTML",
                                        reply_markup=main_menu_kb()
                                    )
                                except Exception as e:
                                    print(f"Ошибка уведомления пользователя о заказе: {e}")
                                    
                            elif len(payload_parts) == 2:
                                # Это обычное пополнение баланса
                                user_id = int(payload_parts[0])
                                code = payload_parts[1]
                                amount = float(invoice["amount"])
                                asset = invoice.get("asset", "")

                                # Проверяем, не обработан ли уже этот платеж
                                payment = await db.get_payment(code)
                                if not payment or payment[4] != "pending":  # status
                                    continue

                                # Обновляем баланс пользователя с суммой в RUB
                                rub_amount = payment[2]  # Оригинальная сумма в рублях
                                await db.update_user_balance(user_id, rub_amount)
                                
                                # Обновляем статус платежа
                                await db.conn.execute('''
                                    UPDATE payments 
                                    SET status = 'completed', 
                                        method = 'CryptoBot',
                                        completed_at = datetime('now')
                                    WHERE code = ?
                                ''', (code,))
                                await db.conn.commit()

                                # Уведомляем пользователя
                                try:
                                    await bot.send_message(
                                        chat_id=user_id,
                                        text=f"✅ Ваш баланс пополнен на {rub_amount}₽ через CryptoBot ({asset})\nКод платежа: <code>{code}</code>",
                                        parse_mode="HTML",
                                        reply_markup=main_menu_kb()
                                    )
                                except Exception as e:
                                    print(f"Ошибка уведомления пользователя: {e}")

                        except Exception as e:
                            print(f"Ошибка обработки инвойса: {e}")

        except Exception as e:
            print(f"Ошибка проверки платежей CryptoBot: {e}")

        await asyncio.sleep(60)

# Новая реализация CryptoBot платежной системы

async def process_cryptobot_order_redirect(callback: types.CallbackQuery, code: str):
    """Перенаправляет пользователя в @CryptoBot для оплаты заказа"""
    print(f"=== НАЧАЛО ОБРАБОТКИ CRYPTOBOT ORDER REDIRECT ===")
    await send_log_to_admins(f"CRYPTOBOT ORDER REDIRECT - Код заказа: {code}, Пользователь: {callback.from_user.id}", "debug")
    print(f"Код заказа: {code}")
    print(f"Пользователь: {callback.from_user.id}")
    
    order = await db.get_order(code)
    if not order:
        print(f"Заказ с кодом {code} не найден")
        await callback.answer("Заказ не найден")
        return

    print(f"Найден заказ: {order}")
    amount_rub = order[5] / 100  # Конвертируем из копеек в рубли
    user_id = callback.from_user.id
    
    # Сохраняем метод оплаты в заказе
    await db.update_order_payment_method(code, "CryptoBot")
    print(f"Метод оплаты заказа обновлен на CryptoBot")
    
    try:
        await callback.message.delete()
        print("Сообщение удалено")
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    # Создаём счёт в CryptoBot для заказа
    print(f"Создаем инвойс для заказа: сумма {amount_rub}, код {code}, пользователь {user_id}")
    invoice_data = await create_cryptobot_invoice_for_order(
        amount=amount_rub,
        code=code,
        user_id=user_id
    )
    
    if not invoice_data:
        print("!!! Не удалось создать счёт в CryptoBot для заказа !!!")
        error_message = "❌ Не удалось создать счёт в CryptoBot. Попробуйте другой способ оплаты."
        await callback.message.answer(error_message, reply_markup=main_menu_kb())
        await callback.answer("Ошибка создания счёта")
        return
    
    print(f"Инвойс для заказа успешно создан: {invoice_data}")
    
    # Сохраняем invoice_id в заказе
    await db.set_order_invoice_id(code, invoice_data['invoice_id'])
    print(f"ID инвойса сохранен в БД для заказа: {invoice_data['invoice_id']}")
    
    # Создаём клавиатуру с переходом в @CryptoBot
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton(
            "🤖 Перейти в @CryptoBot",
            url=invoice_data['bot_invoice_url']
        ),
        InlineKeyboardButton(
            "🔄 Проверить оплату",
            callback_data=f"cryptobot_check_order_{code}"
        ),
        InlineKeyboardButton(
            "❌ Отменить",
            callback_data=f"cancel_order_{code}"
        )
    )
    
    # Получаем информацию о товаре для отображения
    product = await db.get_catalog_item(order[2])
    product_name = product[3] if product else "Неизвестный товар"
    
    payment_text = f"""💳 <b>Оплата заказа CryptoBot</b>: <code>{code}</code>

📦 <b>Товар</b>: {product_name}
<b>Сумма к оплате</b>: {amount_rub:.0f}₽

🤖 Для оплаты нажмите кнопку ниже и перейдите в @CryptoBot.

В боте вы сможете выбрать любую криптовалюту для оплаты.

После оплаты вернитесь сюда и нажмите "Проверить оплату"."""
    
    # Сначала отправляем новый контент
    await callback.message.answer(
        payment_text,
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    
    # Очищаем старые сообщения оплаты
    await smart_cleanup_after_send(callback)
    
    print("Сообщение с инвойсом для заказа отправлено пользователю")
    await callback.answer()

async def process_cryptobot_redirect(callback: types.CallbackQuery, code: str):
    """Перенаправляет пользователя в @CryptoBot для оплаты"""
    print(f"=== НАЧАЛО ОБРАБОТКИ CRYPTOBOT REDIRECT ===")
    print(f"Код платежа: {code}")
    print(f"Пользователь: {callback.from_user.id}")
    
    payment = await db.get_payment(code)
    if not payment:
        print(f"Платеж с кодом {code} не найден")
        await callback.answer("Платеж не найден")
        return

    print(f"Найден платеж: {payment}")
    amount_rub = payment[2]
    user_id = callback.from_user.id
    
    # Сохраняем метод оплаты
    await db.update_payment_method(code, "CryptoBot")
    print(f"Метод оплаты обновлен на CryptoBot")
    
    try:
        await callback.message.delete()
        print("Сообщение удалено")
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    # Создаём счёт в CryptoBot
    print(f"Создаем инвойс для суммы {amount_rub}, код {code}, пользователь {user_id}")
    invoice_data = await create_cryptobot_invoice_for_redirect(
        amount=amount_rub,
        code=code,
        user_id=user_id
    )
    
    if not invoice_data:
        print("!!! Не удалось создать счёт в CryptoBot !!!")
        # Проверяем возможные причины
        error_details = []
        
        # Проверяем API ключ
        if not cfg.CRYPTOBOT_API_KEY:
            error_details.append("❌ Не установлен CRYPTOBOT_API_KEY")
        elif len(cfg.CRYPTOBOT_API_KEY.strip()) < 10:
            error_details.append("❌ Неверный формат CRYPTOBOT_API_KEY")
            
        # Проверяем настройки бота
        try:
            bot_info = await bot.get_me()
            if not bot_info.username:
                error_details.append("❌ У бота не установлен username в @BotFather")
        except Exception as e:
            error_details.append(f"❌ Ошибка получения информации о боте: {e}")
            
        error_message = "❌ Не удалось создать счёт в CryptoBot. Попробуйте другой способ оплаты."
        if error_details:
            error_message += "\n\nДетали ошибки:\n" + "\n".join(error_details)
        else:
            error_message += "\n\nВозможные причины:\n"
            error_message += "• Неверные параметры запроса к CryptoBot API\n"
            error_message += "• Проблемы с подключением к CryptoBot\n"
            error_message += "• Недостаточные права API ключа"
            
        await callback.message.answer(error_message, reply_markup=main_menu_kb())
        await callback.answer("Ошибка создания счёта")
        return
    
    print(f"Инвойс успешно создан: {invoice_data}")
    
    # Сохраняем invoice_id
    await db.set_payment_invoice_id(code, invoice_data['invoice_id'])
    print(f"ID инвойса сохранен в БД: {invoice_data['invoice_id']}")
    
    # Создаём клавиатуру с переходом в @CryptoBot
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton(
            "🤖 Перейти в @CryptoBot",
            url=invoice_data['bot_invoice_url']
        ),
        InlineKeyboardButton(
            "🔄 Проверить оплату",
            callback_data=f"cryptobot_check_{code}"
        ),
        InlineKeyboardButton(
            "❌ Отменить",
            callback_data=f"cancel_payment_{code}"
        )
    )
    
    payment_text = f"""💳 <b>Оплата CryptoBot</b>: <code>{code}</code>

<b>Сумма к оплате</b>: {amount_rub}₽

🤖 Для оплаты нажмите кнопку ниже и перейдите в @CryptoBot.

В боте вы сможете выбрать любую криптовалюту для оплаты.

После оплаты вернитесь сюда и нажмите "Проверить оплату"."""
    
    # Сначала отправляем новый контент
    await callback.message.answer(
        payment_text,
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    
    # Очищаем старые сообщения оплаты
    await smart_cleanup_after_send(callback)
    
    print("Сообщение с инвойсом отправлено пользователю")
    await callback.answer()

async def create_cryptobot_invoice_for_redirect(amount: float, code: str, user_id: int):
    """Создаёт счёт в CryptoBot для перенаправления"""
    print(f"Начинаем создание инвойса CryptoBot: сумма={amount}, код={code}, пользователь={user_id}")
    
    api_key = await get_cryptobot_api_key()
    if not api_key:
        print("Ошибка: CRYPTOBOT_API_KEY не установлен")
        return None
        
    try:
        # Получаем информацию о боте
        print("Получаем информацию о боте...")
        bot_info = await bot.get_me()
        print(f"Полная информация о боте: {bot_info}")
        bot_username = bot_info.username
        print(f"Username бота: {bot_username}")
        
        if not bot_username:
            print("Ошибка: У бота нет username. Установите username для бота в @BotFather")
            return None
            
        print(f"Информация о боте получена: username={bot_username}")
        
        import aiohttp
        headers = {"Crypto-Pay-API-Token": api_key, "Content-Type": "application/json"}
        print(f"Заголовки запроса: {headers}")
        
        # Правильные параметры для работы с фиатной валютой
        data = {
            'amount': str(amount),  # Сумма как строка
            'currency_type': 'fiat',
            'fiat': 'RUB',  # Правильный параметр для фиатной валюты
            'description': f"Оплата счёта #{code} на сумму {amount} RUB от {cfg.CRYPTOBOT_SHOP_NAME}",
            'paid_btn_name': 'callback',
            'paid_btn_url': f'https://t.me/{bot_username}?start=cryptobot_{code}',
            'payload': f'{user_id}:{code}',
            'expires_in': cfg.CRYPTOBOT_PAYMENT_TIMEOUT
        }
        print(f"Данные запроса: {data}")
        
        async with aiohttp.ClientSession() as session:
            print("Отправляем запрос к CryptoBot API...")
            async with session.post(
                'https://pay.crypt.bot/api/createInvoice',
                headers=headers,
                json=data
            ) as response:
                print(f"Получен ответ от CryptoBot API: статус={response.status}")
                response_text = await response.text()
                print(f"Текст ответа: {response_text}")
                
                if response.status == 200:
                    result = await response.json()
                    print(f"JSON ответ: {result}")
                    if result.get('ok'):
                        print(f"Инвойс успешно создан: {result['result']}")
                        return result['result']
                    else:
                        error_info = result.get('error', {})
                        error_code = error_info.get('code', 'Unknown')
                        error_name = error_info.get('name', 'Unknown')
                        error_message = error_info.get('message', 'No message')
                        print(f"CryptoBot API вернул ошибку: code={error_code}, name={error_name}, message={error_message}")
                        
                        # Специальная обработка для известных ошибок
                        if error_name == "FIAT_REQUIRED":
                            print("Ошибка FIAT_REQUIRED: Убедитесь, что параметр 'fiat' указан правильно")
                        elif error_name == "AMOUNT_INVALID":
                            print("Ошибка AMOUNT_INVALID: Проверьте корректность суммы")
                            
                        return None
                else:
                    print(f"Ошибка HTTP при создании инвойса: {response.status}")
                    print(f"Текст ошибки: {response_text}")
                    return None
    except Exception as e:
        print(f"Ошибка создания счёта CryptoBot: {e}")
        import traceback
        traceback.print_exc()
        return None


async def create_cryptobot_invoice_for_order(amount: float, code: str, user_id: int):
    """Создаёт счёт в CryptoBot для оплаты заказа"""
    print(f"Начинаем создание инвойса CryptoBot для заказа: сумма={amount}, код={code}, пользователь={user_id}")
    
    api_key = await get_cryptobot_api_key()
    if not api_key:
        print("Ошибка: CRYPTOBOT_API_KEY не установлен")
        return None
        
    try:
        # Получаем информацию о боте
        print("Получаем информацию о боте...")
        bot_info = await bot.get_me()
        bot_username = bot_info.username
        
        if not bot_username:
            print("Ошибка: У бота нет username. Установите username для бота в @BotFather")
            return None
            
        print(f"Информация о боте получена: username={bot_username}")
        
        import aiohttp
        headers = {"Crypto-Pay-API-Token": api_key, "Content-Type": "application/json"}
        
        # Параметры для создания инвойса для заказа
        data = {
            'amount': str(amount),
            'currency_type': 'fiat',
            'fiat': 'RUB',
            'description': f"Оплата заказа #{code} на сумму {amount} RUB от {cfg.CRYPTOBOT_SHOP_NAME}",
            'paid_btn_name': 'callback',
            'paid_btn_url': f'https://t.me/{bot_username}?start=cryptobot_order_{code}',
            'payload': f'order:{user_id}:{code}',  # Отличаем от обычных платежей
            'expires_in': cfg.CRYPTOBOT_PAYMENT_TIMEOUT
        }
        print(f"Данные запроса: {data}")
        
        async with aiohttp.ClientSession() as session:
            print("Отправляем запрос к CryptoBot API...")
            async with session.post(
                'https://pay.crypt.bot/api/createInvoice',
                headers=headers,
                json=data
            ) as response:
                print(f"Получен ответ от CryptoBot API: статус={response.status}")
                response_text = await response.text()
                print(f"Текст ответа: {response_text}")
                
                if response.status == 200:
                    result = await response.json()
                    print(f"JSON ответ: {result}")
                    if result.get('ok'):
                        print(f"Инвойс для заказа успешно создан: {result['result']}")
                        return result['result']
                    else:
                        error_info = result.get('error', {})
                        error_code = error_info.get('code', 'Unknown')
                        error_name = error_info.get('name', 'Unknown')
                        error_message = error_info.get('message', 'No message')
                        print(f"CryptoBot API вернул ошибку: code={error_code}, name={error_name}, message={error_message}")
                        return None
                else:
                    print(f"Ошибка HTTP при создании инвойса: {response.status}")
                    print(f"Текст ошибки: {response_text}")
                    return None
    except Exception as e:
        print(f"Ошибка создания счёта CryptoBot для заказа: {e}")
        import traceback
        traceback.print_exc()
        return None


@dp.callback_query_handler(lambda c: c.data.startswith("cryptobot_check_"))
async def cryptobot_check_payment(callback: types.CallbackQuery):
    """Проверка статуса оплаты CryptoBot"""
    print(f"Проверка статуса оплаты CryptoBot: {callback.data}")
    
    # Определяем тип платежа по callback_data
    if "_order_" in callback.data:
        # Это заказ
        code = callback.data.split("_")[-1]
        await cryptobot_check_order_payment(callback, code)
    else:
        # Это обычное пополнение баланса
        code = callback.data.split("_")[-1]
        await cryptobot_check_balance_payment(callback, code)

async def cryptobot_check_balance_payment(callback: types.CallbackQuery, code: str):
    """Проверка статуса оплаты CryptoBot для баланса"""
    payment = await db.get_payment(code)
    if not payment:
        print(f"Платеж с кодом {code} не найден")
        await callback.answer("Платеж не найден")
        return
    
    print(f"Платеж найден: {payment}")
    if payment[4] == 'completed':  # status
        print("Платеж уже оплачен")
        await callback.answer("Платеж уже оплачен!")
        await callback.message.answer(
            f"✅ Ваш баланс успешно пополнен!",
            reply_markup=main_menu_kb()
        )
        return
    
    print("Платеж еще не оплачен")
    await callback.answer("Проверяем статус оплаты...")

async def cryptobot_check_order_payment(callback: types.CallbackQuery, code: str):
    """Проверка статуса оплаты CryptoBot для заказа"""
    order = await db.get_order(code)
    if not order:
        print(f"Заказ с кодом {code} не найден")
        await callback.answer("Заказ не найден")
        return
    
    print(f"Заказ найден: {order}")
    if order[6] == 'paid':  # status
        print("Заказ уже оплачен")
        await callback.answer("Заказ уже оплачен!")
        await callback.message.answer(
            f"✅ Ваш заказ успешно оплачен! Товар будет выдан в ближайшее время.",
            reply_markup=main_menu_kb()
        )
        return
    
    print("Заказ еще не оплачен")
    await callback.answer("Проверяем статус оплаты заказа...")


@dp.callback_query_handler(lambda c: c.data.startswith("pay_method_stars_"))
async def process_stars_payment(callback: types.CallbackQuery):
    code = callback.data.split("_")[-1]
    payment = await db.get_payment(code)

    if not payment:
        await callback.answer("Платеж не найден")
        return

    amount = payment[2]  # Сумма в рублях
    stars_amount = int(amount * cfg.STARS_EXCHANGE_RATE)
    
    # Получаем токен из базы данных
    payment_details = await get_current_payment_details()
    provider_token = payment_details.get('stars_provider_token', cfg.STARS_PROVIDER_TOKEN)

    try:
        await bot.send_invoice(
            chat_id=callback.from_user.id,
            title=f"Пополнение баланса на {amount}₽",
            description=f"Оплата через Telegram Stars (код: {code})",
            payload=f"balance_{code}",
            provider_token=provider_token,
            currency="XTR",
            prices=[LabeledPrice(label="Stars", amount=stars_amount)],
            start_parameter=code
        )
        await callback.answer("Открываем окно оплаты Stars...")
    except Exception as e:
        print(f"Ошибка создания инвойса Stars: {e}")
        await callback.answer("Ошибка при создании платежа")


@dp.callback_query_handler(lambda c: c.data.startswith("order_pay_stars_"))
async def process_order_stars_payment(callback: types.CallbackQuery):
    code = callback.data.split("_")[-1]
    order = await db.get_order(code)

    if not order:
        await callback.answer("Заказ не найден")
        return

    amount_rub = order[5] / 100  # Конвертируем из копеек в рубли
    stars_amount = int(amount_rub * cfg.STARS_EXCHANGE_RATE)
    
    # Получаем информацию о товаре
    product = await db.get_catalog_item(order[2])
    product_name = product[3] if product else "Неизвестный товар"
    
    # Получаем токен из базы данных
    payment_details = await get_current_payment_details()
    provider_token = payment_details.get('stars_provider_token', cfg.STARS_PROVIDER_TOKEN)

    try:
        await bot.send_invoice(
            chat_id=callback.from_user.id,
            title=f"Оплата заказа {code}",
            description=f"Товар: {product_name}\nСумма: {amount_rub:.0f}₽",
            payload=f"order_{code}",
            provider_token=provider_token,
            currency="XTR",
            prices=[LabeledPrice(label="Stars", amount=stars_amount)],
            start_parameter=code
        )
        await callback.answer("Открываем окно оплаты Stars...")
    except Exception as e:
        print(f"Ошибка создания инвойса Stars для заказа: {e}")
        await callback.answer("Ошибка при создании платежа")

async def show_order_card_details(callback: types.CallbackQuery, code: str):
    """Показывает реквизиты карты для оплаты заказа"""
    order = await db.get_order(code)
    if not order:
        await callback.answer("Заказ не найден")
        return
    
    price_rub = order[5] / 100
    
    # Получаем информацию о товаре
    product = await db.get_catalog_item(order[2])
    product_name = product[3] if product else "Неизвестный товар"
    
    # Получаем реквизиты карты
    current_payment_details = await get_current_payment_details()
    card_details = current_payment_details['card']
    
    expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S") if order[7] else None
    
    # Отправляем уведомление администратору (для автоматической выдачи)
    user_info = f"@{callback.from_user.username}" if callback.from_user.username else f"ID: {callback.from_user.id}"
    admin_message = (
        f"📲 Пользователь {user_info} оплачивает заказ\n\n"
        f"📦 Код заказа: <code>{code}</code>\n"
        f"💰 Товар: {product_name}\n"
        f"💰 Сумма: {price_rub:.0f}₽\n"
        f"💳 Метод: 💳 Банковская карта\n"
        f"⏳ Истекает: {expire_time.strftime('%d.%m.%Y %H:%M') if expire_time else 'Не указано'}\n\n"
        "Подтвердите оплату и выдачу товара:"
    )
    
    # Клавиатура для админа
    admin_keyboard = InlineKeyboardMarkup(row_width=1)
    admin_keyboard.add(
        InlineKeyboardButton(
            "✅ Подтвердить и выдать товар",
            callback_data=f"admin_confirm_order_{code}_{callback.from_user.id}"
        ),
        InlineKeyboardButton(
            "❌ Отклонить",
            callback_data=f"admin_reject_order_{code}"
        )
    )
    
    await bot.send_message(
        chat_id=cfg.ADMIN_ID,
        text=admin_message,
        reply_markup=admin_keyboard,
        parse_mode="HTML"
    )
    
    # Отправляем модернизированное сообщение пользователю
    payment_message = (
        f"📲 <b>Оплата 💳 Банковская карта</b>\n\n"
        "1. Переведите указанную сумму по реквизитам\n"
        "2. Сохраните чек/скриншот оплаты\n\n"
        f"<code>{card_details}</code>\n\n"
        f"⏳ <b>Время на оплату до</b>: {expire_time.strftime('%d.%m.%Y %H:%M') if expire_time else 'Не указано'}\n\n"
        "После оплаты выдача товара произойдет автоматически в течении 5 - 10 минут."
    )
    
    await bot.send_message(
        chat_id=callback.from_user.id,
        text=payment_message,
        reply_markup=back_to_product_kb(order[2]),  # Возврат к товару
        parse_mode="HTML"
    )

async def process_order_card_payment(callback: types.CallbackQuery, code: str):
    """Обработка оплаты заказа картой через Telegram Invoice"""
    order = await db.get_order(code)
    
    if not order:
        await callback.answer("Заказ не найден")
        return

    amount_rub = order[5] / 100  # Конвертируем из копеек в рубли
    
    # Получаем информацию о товаре
    product = await db.get_catalog_item(order[2])
    product_name = product[3] if product else "Неизвестный товар"
    
    # Получаем токен провайдера для карточных платежей
    payment_details = await get_current_payment_details()
    
    # Для карточных платежей нужен отдельный провайдер (не Stars)
    # Проверяем, есть ли настроенный провайдер для карт
    card_provider_token = payment_details.get('card_provider_token')
    
    if not card_provider_token or card_provider_token == cfg.STARS_PROVIDER_TOKEN:
        # Если нет отдельного провайдера для карт, показываем реквизиты для ручной оплаты
        await show_order_card_details(callback, code)
        return

    try:
        await bot.send_invoice(
            chat_id=callback.from_user.id,
            title=f"💳 Оплата картой - Заказ {code}",
            description=f"Товар: {product_name}\nСумма: {amount_rub:.0f}₽\n\n🔒 Безопасная оплата картой через Telegram",
            payload=f"card_order_{code}",
            provider_token=card_provider_token,
            currency="RUB",
            prices=[LabeledPrice(label="Оплата картой", amount=int(amount_rub * 100))],  # В копейках
            start_parameter=code,
            need_name=True,
            need_email=True,
            send_email_to_provider=True
        )
        await callback.answer("💳 Открываем форму оплаты картой...")
    except Exception as e:
        print(f"Ошибка создания инвойса карты для заказа: {e}")
        
        # Если не удалось создать форму, показываем обычные реквизиты
        await callback.answer("⚠️ Оплата картой через форму недоступна. Показываем реквизиты для перевода.", show_alert=True)
        
        # Показываем обычные реквизиты карты
        await show_order_card_details(callback, code)


@dp.pre_checkout_query_handler()
async def process_pre_checkout(query: types.PreCheckoutQuery):
    await bot.answer_pre_checkout_query(query.id, ok=True)

@dp.message_handler(content_types=types.ContentType.SUCCESSFUL_PAYMENT)
async def process_successful_payment(message: types.Message):
    payment = message.successful_payment
    payload = payment.invoice_payload
    
    print(f"Получен успешный платеж Stars с payload: {payload}")

    if payload.startswith("balance_"):
        # Это пополнение баланса
        code = payload.replace("balance_", "")
        
        # Обновляем статус платежа
        await db.conn.execute('''
            UPDATE payments 
            SET status = 'completed', 
                method = 'Telegram Stars',
                completed_at = datetime('now')
            WHERE code = ?
        ''', (code,))
        await db.conn.commit()

        # Зачисляем средства
        amount_rub = payment.total_amount / cfg.STARS_EXCHANGE_RATE
        await db.update_user_balance(message.from_user.id, amount_rub)

        await message.answer(
            f"✅ Баланс успешно пополнен на {amount_rub}₽ через Telegram Stars!",
            reply_markup=main_menu_kb()
        )
        
    elif payload.startswith("order_"):
        # Это оплата заказа
        code = payload.replace("order_", "")
        
        # Обновляем статус заказа
        await db.update_order_status(code, 'paid')
        await db.update_order_payment_method(code, 'Telegram Stars')
        await db.conn.commit()
        
        # Отправляем файлы товара
        order = await db.get_order(code)
        if order:
            # order[10] is selected_days from the orders table
            selected_days = order[10] if len(order) > 10 else None
            await send_product_files(message.from_user.id, order[2], order[4], selected_days)  # order[4] = quantity
            
            # Получаем информацию о товаре
            product = await db.get_catalog_item(order[2])
            product_name = product[3] if product else "Неизвестный товар"
            price_rub = order[5] / 100
            
            await message.answer(
                f"✅ Заказ успешно оплачен через Telegram Stars!\n\n📦 Товар: {product_name}\n💰 Сумма: {price_rub:.0f}₽\nКод заказа: <code>{code}</code>",
                parse_mode="HTML",
                reply_markup=main_menu_kb()
            )
    else:
        # Старый формат (только код) - считаем пополнением баланса для обратной совместимости
        code = payload
        
        # Обновляем статус платежа
        await db.conn.execute('''
            UPDATE payments 
            SET status = 'completed', 
                method = 'Telegram Stars',
                completed_at = datetime('now')
            WHERE code = ?
        ''', (code,))
        await db.conn.commit()

        # Зачисляем средства
        amount_rub = payment.total_amount / cfg.STARS_EXCHANGE_RATE
        await db.update_user_balance(message.from_user.id, amount_rub)

        await message.answer(
            f"✅ Баланс успешно пополнен на {amount_rub}₽ через Telegram Stars!",
            reply_markup=main_menu_kb()
        )

# This handler was moved to the end of the file to avoid intercepting other callbacks
# @dp.callback_query_handler()
# async def handle_all_callbacks(callback: types.CallbackQuery):
#     """Обработчик всех callback для логирования"""
#     print(f"Получен callback: {callback.data} от пользователя {callback.from_user.id}")
#     # Не обрабатываем, просто логируем
#     await callback.answer()

async def safe_delete_messages(callback: types.CallbackQuery, delete_previous: bool = True, only_category_messages: bool = False):
    """Удаляет только сообщения с которых был совершен переход, сохраняя пользовательские и приветственные"""
    try:
        # Проверяем, что это сообщение от бота
        if callback.message.from_user.id != bot.id:
            return  # Не удаляем сообщения пользователей
        
        message_text = callback.message.text or callback.message.caption or ""
        
        # Не удаляем сообщения с товарами (содержат информацию о покупке)
        if any(keyword in message_text.lower() for keyword in ["товар:", "спасибо за покупку", "ваш заказ", "файл:", "фото:"]):
            return  # Не удаляем сообщения с товарами
        
        # Не удаляем приветственные сообщения
        welcome_keywords = ["добро пожаловать", "welcome", "привет", "здравствуйте", "главное меню", "главное меню"]
        if any(keyword in message_text.lower() for keyword in welcome_keywords):
            return  # Не удаляем приветственные сообщения
        
        # Удаляем только сообщения с которых был совершен переход (содержат кнопки)
        if callback.message.reply_markup and callback.message.reply_markup.inline_keyboard:
            # Удаляем текущее сообщение с кнопками
            await bot.delete_message(
                chat_id=callback.message.chat.id,
                message_id=callback.message.message_id
            )
            
            # Удаляем связанный стикер (если есть)
            if delete_previous:
                current_message_id = callback.message.message_id
                try:
                    # Проверяем только предыдущее сообщение на предмет стикера от бота
                    prev_message_id = current_message_id - 1
                    await bot.delete_message(
                        chat_id=callback.message.chat.id,
                        message_id=prev_message_id
                    )
                except Exception:
                    pass  # Игнорируем ошибки - возможно, предыдущее сообщение от пользователя
        
    except Exception:
        pass  # Игнорируем ошибки удаления

# Новая функция с гарантированным правильным порядком стикеров
async def replace_message_with_sticker_first(callback: types.CallbackQuery, new_text: str = None, new_photo: str = None, new_caption: str = None, new_keyboard = None, sticker_id: str = None):
    """Заменяет текущее сообщение новым контентом с ГАРАНТИРОВАННЫМ правильным порядком стикеров
    Стикер ВСЕГДА отправляется ПЕРЕД контентом, затем удаляются старые сообщения
    """
    try:
        # 1. СНАЧАЛА отправляем стикер (если есть) - СТИКЕР ВСЕГДА ПЕРВЫЙ!
        if sticker_id:
            await bot.send_sticker(
                chat_id=callback.message.chat.id,
                sticker=sticker_id
            )
        
        # 2. ЗАТЕМ отправляем новый контент
        if new_photo:
            await bot.send_photo(
                chat_id=callback.message.chat.id,
                photo=new_photo,
                caption=new_caption,
                parse_mode="HTML",
                reply_markup=new_keyboard
            )
        else:
            await bot.send_message(
                chat_id=callback.message.chat.id,
                text=new_text,
                parse_mode="HTML",
                reply_markup=new_keyboard
            )
        
        # 3. И только потом удаляем старые сообщения
        await safe_delete_messages(callback, delete_previous=True, only_category_messages=True)
        
    except Exception as e:
        print(f"Ошибка при замене сообщения: {e}")
        # В случае ошибки все равно пытаемся отправить контент
        try:
            if sticker_id:
                await bot.send_sticker(
                    chat_id=callback.message.chat.id,
                    sticker=sticker_id
                )
            
            if new_photo:
                await bot.send_photo(
                    chat_id=callback.message.chat.id,
                    photo=new_photo,
                    caption=new_caption,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
            else:
                await bot.send_message(
                    chat_id=callback.message.chat.id,
                    text=new_text,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
        except Exception as e2:
            print(f"Критическая ошибка при отправке контента: {e2}")

# Оставляем старую функцию для обратной совместимости
async def replace_message_with_new_content(callback: types.CallbackQuery, new_text: str = None, new_photo: str = None, new_caption: str = None, new_keyboard = None, sticker_id: str = None):
    """Заменяет текущее сообщение новым контентом для быстрой навигации
    Если есть стикер, то сначала отправляет стикер, затем редактирует сообщение
    """
    try:
        message_to_edit = callback.message
        
        # ВАЖНО: Сначала отправляем стикер (если есть) - СТИКЕР ВСЕГДА ПЕРВЫЙ!
        if sticker_id:
            # Проверяем, был ли предыдущий стикер
            try:
                prev_message_id = message_to_edit.message_id - 1
                if prev_message_id > 0:
                    # Удаляем предыдущий стикер если он есть
                    await bot.delete_message(
                        chat_id=message_to_edit.chat.id,
                        message_id=prev_message_id
                    )
            except Exception:
                pass  # Игнорируем ошибки
            
            # Отправляем новый стикер
            await bot.send_sticker(
                chat_id=message_to_edit.chat.id,
                sticker=sticker_id
            )
        
        # Затем редактируем текущее сообщение
        if new_photo:
            # Если нужно изменить на фото
            if message_to_edit.photo:
                # Редактируем существующее фото
                await bot.edit_message_media(
                    chat_id=message_to_edit.chat.id,
                    message_id=message_to_edit.message_id,
                    media=types.InputMediaPhoto(media=new_photo, caption=new_caption, parse_mode="HTML"),
                    reply_markup=new_keyboard
                )
            else:
                # Удаляем текстовое сообщение и отправляем фото
                await message_to_edit.delete()
                await bot.send_photo(
                    chat_id=message_to_edit.chat.id,
                    photo=new_photo,
                    caption=new_caption,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
        else:
            # Если нужно изменить на текст
            if message_to_edit.photo:
                # Удаляем фото и отправляем текст
                await message_to_edit.delete()
                await bot.send_message(
                    chat_id=message_to_edit.chat.id,
                    text=new_text,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
            elif message_to_edit.text or message_to_edit.caption:
                # Редактируем существующий текст (только если есть текст)
                await bot.edit_message_text(
                    chat_id=message_to_edit.chat.id,
                    message_id=message_to_edit.message_id,
                    text=new_text,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
            else:
                # Нет текста для редактирования - отправляем новое сообщение
                await bot.send_message(
                    chat_id=message_to_edit.chat.id,
                    text=new_text,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
                # Удаляем старое сообщение (например, стикер)
                try:
                    await message_to_edit.delete()
                except Exception:
                    pass
        
    except Exception as e:
        # Если редактирование не удалось, используем старый способ с удалением
        print(f"Ошибка редактирования сообщения: {e}")
        
        try:
            # ВАЖНО: Сначала отправляем стикер (если есть) - СТИКЕР ВСЕГДА ПЕРВЫЙ!
            if sticker_id:
                await bot.send_sticker(
                    chat_id=callback.message.chat.id,
                    sticker=sticker_id
                )
            
            # Затем отправляем новый контент
            if new_photo:
                await bot.send_photo(
                    chat_id=callback.message.chat.id,
                    photo=new_photo,
                    caption=new_caption,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
            else:
                await bot.send_message(
                    chat_id=callback.message.chat.id,
                    text=new_text,
                    parse_mode="HTML",
                    reply_markup=new_keyboard
                )
            
            # И только потом удаляем старые сообщения
            await safe_delete_messages(callback, delete_previous=True, only_category_messages=True)
            
        except Exception as e2:
            print(f"Критическая ошибка при отправке альтернативного контента: {e2}")

async def delete_message_and_sticker(callback: types.CallbackQuery):
    """Обертка для старого кода - используем новую безопасную функцию"""
    await safe_delete_messages(callback, delete_previous=True, only_category_messages=True)

async def send_support_sticker(chat_id: int):
    """Отправляет стикер поддержки"""
    try:
        await bot.send_sticker(
            chat_id=chat_id,
            sticker=cfg.MY_TICKETS_STICKER
        )
    except Exception:
        # Не выводим ошибку - это не критично
        pass

async def smart_cleanup_after_send(callback: types.CallbackQuery, message_ids_to_delete: list = None, preserve_bonus_sticker: bool = False):
    """Умная очистка сообщений ПОСЛЕ отправки нового контента
    Удаляет только сообщения от бота, НЕ удаляет сообщения пользователей
    """
    try:
        # Небольшая задержка чтобы гарантировать, что новые сообщения доставлены первыми
        await asyncio.sleep(0.1)
        
        # Сначала удаляем текущее сообщение с кнопками (это сообщение от бота)
        if callback.message.reply_markup and callback.message.reply_markup.inline_keyboard:
            try:
                await bot.delete_message(
                    chat_id=callback.message.chat.id,
                    message_id=callback.message.message_id
                )
            except Exception:
                pass
        
        # Если не нужно сохранять стикер бонусов, проверяем несколько предыдущих сообщений
        if not preserve_bonus_sticker:
            # Проверяем несколько предыдущих сообщений для удаления стикеров/сообщений бота
            # Проверяем до 5 предыдущих сообщений, чтобы найти стикеры/сообщения от бота
            current_msg_id = callback.message.message_id
            for i in range(1, 6):  # Проверяем 5 предыдущих сообщений
                try:
                    prev_message_id = current_msg_id - i
                    if prev_message_id > 0:
                        # Пытаемся получить информацию о сообщении
                        try:
                            # Попытка удалить сообщение - если это сообщение пользователя,
                            # то удаление не сработает из-за ограничений API
                            await bot.delete_message(
                                chat_id=callback.message.chat.id,
                                message_id=prev_message_id
                            )
                            # Если удаление прошло успешно, скорее всего это было сообщение от бота
                            break  # Удалили одно сообщение бота, этого достаточно
                        except Exception:
                            # Если не удалось удалить, возможно это сообщение пользователя или старое сообщение
                            continue
                except Exception:
                    break
        else:
            # Если нужно сохранить стикер бонусов, пропускаем удаление предыдущих сообщений
            # Это используется при навигации внутри системы бонусов
            pass
        
        # Удаляем дополнительные сообщения если указаны (только сообщения бота)
        if message_ids_to_delete:
            for msg_id in message_ids_to_delete:
                try:
                    await bot.delete_message(
                        chat_id=callback.message.chat.id,
                        message_id=msg_id
                    )
                except Exception:
                    pass  # Игнорируем ошибки - возможно это сообщение пользователя
                    
    except Exception:
        pass  # Игнорируем ошибки удаления

async def check_expired_payments():
    while True:
        try:
            # Получаем все активные платежи
            cursor = await db.conn.execute('''
                SELECT code, user_id, strftime('%Y-%m-%d %H:%M:%S', expires_at) as expires_at 
                FROM payments 
                WHERE status = 'pending'
            ''')
            payments = await cursor.fetchall()

            now = datetime.now()
            for payment in payments:
                if not payment[2]:  # Пропускаем если expires_at NULL
                    continue
                try:
                    expires_at = datetime.strptime(payment[2], "%Y-%m-%d %H:%M:%S")
                except (ValueError, TypeError):
                    continue  # Пропускаем если неверный формат даты
                if now > expires_at:
                    # Обновляем статус платежа
                    await db.conn.execute('''
                        UPDATE payments SET status = 'expired' WHERE code = ?
                    ''', (payment[0],))
                    await db.conn.commit()

                    # Отправляем уведомление пользователю
                    try:
                        keyboard = InlineKeyboardMarkup(row_width=1)
                        keyboard.add(
                            InlineKeyboardButton(
                                "↩️ Вернуться к пополнению",
                                callback_data="back_to_payment"
                            ),
                            InlineKeyboardButton(
                                "💬 Написать в поддержку",
                                url=f"https://t.me/{cfg.SUPPORT_ID}"
                            ),
                            InlineKeyboardButton(
                                "🤖 Поддержка по СПАМу",
                                url="https://t.me/SuppPayBot"
                            )
                        )

                        await bot.send_message(
                            chat_id=payment[1],
                            text=cfg.PAYMENT_EXPIRED_TEXT.format(code=payment[0]),
                            reply_markup=keyboard,
                            parse_mode="HTML"
                        )
                    except Exception as e:
                        print(f"Ошибка при отправке уведомления об истечении платежа: {e}")

        except Exception as e:
            print(f"Ошибка при проверке истекших платежей: {e}")

        # Проверяем каждую минуту
        await asyncio.sleep(60)


async def check_order_expiration():
    """Проверяет заказы, которые скоро истекут, и отправляет уведомления"""
    while True:
        try:
            # Получаем все активные заказы, которым ещё не отправляли уведомление
            cursor = await db.conn.execute('''
                SELECT o.code, o.user_id, o.product_id, 
                       strftime('%Y-%m-%d %H:%M:%S', o.expires_at) as expires_at,
                       c.name as product_name, o.price
                FROM orders o
                JOIN catalog_items c ON o.product_id = c.id  
                WHERE o.status = 'pending' 
                  AND o.expires_at IS NOT NULL 
                  AND o.expiration_notified = FALSE
            ''')
            orders = await cursor.fetchall()

            now = datetime.now()
            for order in orders:
                code, user_id, product_id, expires_at_str, product_name, price = order
                
                if not expires_at_str:
                    continue
                    
                try:
                    expires_at = datetime.strptime(expires_at_str, "%Y-%m-%d %H:%M:%S")
                except (ValueError, TypeError):
                    continue
                
                # Проверяем, осталось ли 5 минут или меньше до истечения
                time_left = expires_at - now
                minutes_left = time_left.total_seconds() / 60
                
                # Отправляем уведомление за 5 минут до истечения
                if 0 < minutes_left <= 5:
                    try:
                        price_rub = price / 100 if price else 0
                        minutes_left_int = int(minutes_left)
                        
                        # Создаём клавиатуру для оплаты
                        from keyboards import order_payment_methods_kb
                        
                        notification_text = (
                            f"⏰ <b>Ваш заказ скоро истечёт!</b>\n\n"
                            f"📦 <b>Товар</b>: {product_name}\n"
                            f"💰 <b>Сумма</b>: {price_rub:.0f}₽\n"
                            f"🏷️ <b>Код</b>: <code>{code}</code>\n\n"
                            f"⏳ <b>Осталось</b>: {minutes_left_int} мин.\n\n"
                            f"⚡️ Оплатите заказ прямо сейчас, чтобы не потерять его!"
                        )
                        
                        await bot.send_message(
                            chat_id=user_id,
                            text=notification_text,
                            parse_mode="HTML",
                            reply_markup=await order_payment_methods_kb(code)
                        )

                        # Отмечаем, что уведомление отправлено
                        await db.conn.execute('''
                            UPDATE orders 
                            SET expiration_notified = TRUE 
                            WHERE code = ?
                        ''', (code,))
                        await db.conn.commit()
                        
                        print(f"ℹ️ Отправлено уведомление об истечении заказа {code} пользователю {user_id}")
                        
                    except Exception as e:
                        print(f"⚠️ Ошибка отправки уведомления об истечении заказа {code}: {e}")
                
                # Проверяем, не истёк ли заказ полностью
                elif minutes_left <= 0:
                    try:
                        # Обновляем статус заказа на истёкший
                        await db.conn.execute('''
                            UPDATE orders 
                            SET status = 'expired', expiration_notified = TRUE 
                            WHERE code = ? AND status = 'pending'
                        ''', (code,))
                        await db.conn.commit()
                        
                        # Отправляем уведомление пользователю об истечении заказа
                        try:
                            # Получаем информацию о товаре
                            product = await db.get_catalog_item(product_id)
                            product_name = product[3] if product else "Неизвестный товар"
                            
                            # Создаем клавиатуру с кнопкой "Вернуться к товару"
                            from keyboards import back_to_product_kb
                            keyboard = back_to_product_kb(product_id) if product_id else None
                            
                            # Текст уведомления об истечении заказа
                            expired_text = (
                                f"⚠️ У заказа <code>{code}</code> истек срок оплаты\n\n"
                                f"Если у вас возникла одна из проблем:\n"
                                f"🔹 Не зачислилась оплата\n"
                                f"🔹 Не выдались реквизиты\n"
                                f"🔹 Не вышло сделать перевод\n\n"
                                f"Обратитесь к поддержке платежной системы\n"
                                f"💬 Прямой контакт: @{cfg.SUPPORT_ID}\n"
                                f"🤖 Если у вас СПАМ: @SuppPayBot\n\n"
                                f"❤️ Приносим свои извинения, если вы столкнулись с проблемами при оплате. С радостью поможем решить их вам!"
                            )
                            
                            await bot.send_message(
                                chat_id=user_id,
                                text=expired_text,
                                parse_mode="HTML",
                                reply_markup=keyboard
                            )
                        except Exception as e:
                            print(f"⚠️ Ошибка отправки уведомления об истечении заказа {code}: {e}")
                        
                        print(f"⏰ Заказ {code} пользователя {user_id} истёк")
                        
                    except Exception as e:
                        print(f"⚠️ Ошибка обновления статуса заказа {code}: {e}")
                        
        except Exception as e:
            print(f"⚠️ Ошибка при проверке истечения заказов: {e}")

        # Проверяем каждую минуту
        await asyncio.sleep(60)


@dp.message_handler(commands=['start'])
async def send_welcome(message: types.Message):
    print(f"Получена команда /start с параметрами: {message.text}")

    # Handle deep linking for products
    if message.text and len(message.text.split()) > 1:
        param = message.text.split()[1]
        if param.startswith("good_") or param.startswith("product_"):
            try:
                if param.startswith("good_"):
                    product_id = int(param.split("_")[1])
                else:  # product_
                    product_id = int(param.split("_")[1])
                await show_product_by_id(message, product_id)
                return
            except (ValueError, IndexError):
                pass  # Not a valid product link, continue.

    # Обработка команды /start с параметром stars_ для оплаты Stars
    if message.text and len(message.text.split()) > 1:
        param = message.text.split()[1]
        print(f"Параметр команды: {param}")
        
        # Обработка возврата из @CryptoBot
        if param.startswith("cryptobot_"):
            print("Обрабатываем возврат из CryptoBot")
            
            if param.startswith("cryptobot_order_"):
                # Возврат из CryptoBot после оплаты заказа
                code = param.replace("cryptobot_order_", "")
                order = await db.get_order(code)
                
                if order:
                    print(f"Найден заказ: {order}")
                    # Проверяем статус заказа
                    if order[6] == 'paid':  # status
                        await message.answer(
                            f"✅ Заказ #{code} уже оплачен!",
                            reply_markup=main_menu_kb()
                        )
                    else:
                        # Показываем кнопку проверки
                        keyboard = InlineKeyboardMarkup(row_width=1)
                        keyboard.add(
                            InlineKeyboardButton(
                                "🔄 Проверить оплату",
                                callback_data=f"cryptobot_check_order_{code}"
                            ),
                            InlineKeyboardButton(
                                "Главное меню",
                                callback_data="back_to_main"
                            )
                        )
                        
                        await message.answer(
                            f"💳 Вы вернулись из @CryptoBot\n\n"
                            f"Заказ: <code>{code}</code>\n"
                            f"Сумма: {order[5] / 100:.0f}₽\n\n"
                            f"Нажмите 'Проверить оплату' чтобы подтвердить оплату.",
                            reply_markup=keyboard,
                            parse_mode="HTML"
                        )
                    return
            else:
                # Обычное пополнение баланса
                code = param.replace("cryptobot_", "")
                payment = await db.get_payment(code)

                if payment:
                    print(f"Найден платеж: {payment}")
                    # Проверяем статус платежа
                    if payment[4] == 'completed':  # status
                        await message.answer(
                            f"✅ Платеж #{code} уже оплачен!",
                            reply_markup=main_menu_kb()
                        )
                    else:
                        # Показываем кнопку проверки
                        keyboard = InlineKeyboardMarkup(row_width=1)
                        keyboard.add(
                            InlineKeyboardButton(
                                "🔄 Проверить оплату",
                                callback_data=f"cryptobot_check_{code}"
                            ),
                            InlineKeyboardButton(
                                "Главное меню",
                                callback_data="back_to_main"
                            )
                        )
                        
                        await message.answer(
                            f"💳 Вы вернулись из @CryptoBot\n\n"
                            f"Платеж: <code>{code}</code>\n"
                            f"Сумма: {payment[2]}₽\n\n"
                            f"Нажмите 'Проверить оплату' чтобы подтвердить оплату.",
                            reply_markup=keyboard,
                            parse_mode="HTML"
                        )
                    return
        
        # Обработка stars_
        elif param.startswith("stars_"):
            code = param.replace("stars_", "")
            payment = await db.get_payment(code)

            if payment:
                amount = payment[2]
                stars_amount = amount * cfg.STARS_EXCHANGE_RATE

                await message.answer(
                    f"Для пополнения баланса на {amount}₽ отправьте {stars_amount} Stars.\n\n"
                    "1. Откройте @wallet\n"
                    "2. Выберите 'Перевести Stars'\n"
                    "3. Укажите сумму {stars_amount} Stars\n"
                    "4. Отправьте на @{cfg.ADMIN_USERNAME}\n\n"
                    f"В комментарии укажите код: {code}",
                    reply_markup=back_to_payment_kb(code)
                )
                return

    # Получаем настройки приветственного сообщения из БД
    welcome_settings = await db.get_welcome_settings()
    welcome_text = welcome_settings.get('text') or cfg.WELCOME_TEXT
    welcome_sticker_id = welcome_settings.get('sticker_id')
    welcome_photo_id = welcome_settings.get('photo_id')

    # Отправляем стикер если он установлен
    if welcome_sticker_id:
        try:
            await bot.send_sticker(
                chat_id=message.chat.id,
                sticker=welcome_sticker_id
            )
        except Exception as e:
            print(f"Ошибка отправки стикера: {e}")

    # Отправляем фото или используем стандартное
    try:
        if welcome_photo_id and is_valid_telegram_file_id(welcome_photo_id):
            # Проверяем, что ID фото валидный
            try:
                # Используем фото из БД
                await bot.send_photo(
                    chat_id=message.chat.id,
                    photo=welcome_photo_id,
                    caption=welcome_text,
                    parse_mode="HTML",
                    reply_markup=main_menu_kb()
                )
            except Exception as photo_error:
                print(f"Ошибка отправки фото из БД: {photo_error}")
                # Если фото из БД не работает, сбрасываем его и используем стандартное
                await db.set_bot_setting("welcome_photo_id", None)
                # Используем стандартное фото из файла
                with open(cfg.IMAGE_PATH, 'rb') as photo:
                    await bot.send_photo(
                        chat_id=message.chat.id,
                        photo=photo,
                        caption=welcome_text,
                        parse_mode="HTML",
                        reply_markup=main_menu_kb()
                    )
        else:
            # Если фото ID невалидно, сбрасываем его
            if welcome_photo_id and not is_valid_telegram_file_id(welcome_photo_id):
                print(f"Невалидный photo_id: {welcome_photo_id}. Сбрасываем на стандартное.")
                await db.set_bot_setting("welcome_photo_id", None)
            
            # Используем стандартное фото из файла
            with open(cfg.IMAGE_PATH, 'rb') as photo:
                await bot.send_photo(
                    chat_id=message.chat.id,
                    photo=photo,
                    caption=welcome_text,
                    parse_mode="HTML",
                    reply_markup=main_menu_kb()
                )
    except FileNotFoundError:
        # Если фото нет, отправляем только текст
        await message.answer(
            welcome_text,
            parse_mode="HTML",
            reply_markup=main_menu_kb()
        )
    except Exception as general_error:
        print(f"Общая ошибка при отправке приветственного сообщения: {general_error}")
        # В крайнем случае отправляем только текст
        await message.answer(
            welcome_text,
            parse_mode="HTML",
            reply_markup=main_menu_kb()
        )


@dp.message_handler(lambda message: message.text and message.text == "🏪 Каталог товаров")
async def handle_catalog_button(message: types.Message):
    """Обработчик кнопки каталога товаров"""
    try:
        # Получаем все темы (корневые элементы каталога)
        themes = await db.get_catalog_themes()
        
        # Получаем фото каталога из настроек
        catalog_photo_id = await db.get_bot_setting("catalog_photo_id")
        
        # Даже если тем нет, продолжаем формировать клавиатуру и выводить фото каталога
        
        # Создаем клавиатуру с темами
        from keyboards import create_catalog_keyboard
        keyboard = await create_catalog_keyboard(
            themes, 
            is_admin=await is_user_admin(message.from_user.id), 
            parent_id=None, 
            item_type=None
        )
        
        # Формируем текст
        catalog_text = ""
        
        # Отправляем каталог с фото или без
        if catalog_photo_id:
            try:
                await message.answer_photo(
                    photo=catalog_photo_id,
                    caption=catalog_text,
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
            except Exception as e:
                # Если фото не работает, отправляем только текст
                print(f"Ошибка отправки фото каталога: {e}")
                await message.answer(
                    text=catalog_text,
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
        else:
            # Отправляем только текст
            await message.answer(
                text=catalog_text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
    except Exception as e:
        print(f"Error in handle_catalog_button: {e}")
        await message.answer(
            "❌ Произошла ошибка при загрузке каталога",
            reply_markup=main_menu_kb()
        )

@dp.message_handler(lambda message: message.text and message.text == "💳 Пополнить баланс")
async def payment_handler(message: types.Message):
    try:
        # Сначала отправляем стикер
        await bot.send_sticker(
            chat_id=message.chat.id,
            sticker="CAACAgEAAxkBAAEO7SxodMdmuDswmlhmRigQFvYeCcXZggACRwIAAvR1IESZ69gYUsdrkzYE"
        )

        # Затем отправляем текст без лишних тегов <b>
        await message.answer(
            "💳 Пополнение баланса\n\nНапишите в ответ сумму на которую хотите пополнить баланс или выберете из предложенных (минимум 50₽)",
            reply_markup=payment_amounts_kb()
        )
    except Exception as e:
        print(f"Ошибка при обработке платежа: {e}")
        await message.answer(
            "Произошла ошибка, попробуйте позже",
            reply_markup=main_menu_kb()
        )

@dp.message_handler(lambda message: message.text and message.text == "👤 Мой профиль")
async def show_profile(message: types.Message):
    try:
        await bot.send_sticker(
            chat_id=message.chat.id,
            sticker=cfg.PASSPORT_STICKER
        )
    except Exception as e:
        print(f"Ошибка отправки стикера: {e}")

    # Убедимся, что пользователь существует
    await db.ensure_user_exists(message.from_user.id)

    # Получаем актуальные данные
    balance = await db.get_user_balance(message.from_user.id)
    reg_date = await db.get_user_registration_date(message.from_user.id) or datetime.now()

    profile_info = cfg.PROFILE_TEXT.format(
        user_id=message.from_user.id,
        registration_date=reg_date.strftime("%d.%m.%Y"),
        balance=balance,
        partner_balance=0,
        purchases=0
    )

    await message.answer(
        profile_info,
        reply_markup=profile_actions_kb()
    )

@dp.callback_query_handler(lambda c: c.data.startswith("confirm_payment_"))
async def confirm_payment_handler(callback: types.CallbackQuery):
    code = callback.data.split("_")[-1]
    payment = await db.get_payment(code)

    if not payment:
        await callback.answer("Платеж не найден")
        return

    # Удаляем предыдущее сообщение с подтверждением
    try:
        await callback.message.delete()
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    # Получаем метод оплаты
    payment_method = payment[5]  # method столбец в базе
    
    # Получаем текущие реквизиты из БД
    current_payment_details = await get_current_payment_details()
    
    # Определяем реквизиты и полное название метода с эмодзи
    payment_details = ""
    payment_method_display = ""
    if payment_method == "СБП по номеру":
        payment_details = current_payment_details['sbp_phone']
        payment_method_display = "📱 СБП по номеру"
    elif payment_method == "Банковская карта":
        payment_details = current_payment_details['card']
        payment_method_display = "💳 Банковская карта"
    elif payment_method == "Криптовалюта":
        payment_details = current_payment_details['crypto']
        payment_method_display = "₿ Криптовалюта"
    else:
        payment_details = "Реквизиты будут предоставлены после подтверждения администратором"
        payment_method_display = payment_method or "выбранный метод"

    # Устанавливаем время истечения (20 минут с текущего момента)
    expire_time = datetime.now() + timedelta(minutes=20)
    expires_at_str = expire_time.strftime("%Y-%m-%d %H:%M:%S")
    await db.update_payment_expire_time(code, expires_at_str)

    # Отправляем уведомление администратору
    user_info = f"@{callback.from_user.username}" if callback.from_user.username else f"ID: {callback.from_user.id}"
    admin_message = (
        f"⚠️ Пользователь {user_info} начал оплату\n\n"
        f"💳 Код платежа: <code>{code}</code>\n"
        f"💰 Сумма: {payment[2]}₽\n"
        f"💳 Метод: {payment_method or 'Не указан'}\n"
        f"⏳ Истекает: {expire_time.strftime('%d.%m.%Y %H:%M')}\n\n"
        "Подтвердите зачисление средств после оплаты:"
    )

    await bot.send_message(
        chat_id=cfg.ADMIN_ID,
        text=admin_message,
        reply_markup=admin_confirm_payment_kb(code, callback.from_user.id, payment[2]),
        parse_mode="HTML"
    )

    # Отправляем модернизированные реквизиты для оплаты пользователю
    payment_message = (
        f"📲 <b>Оплата {payment_method_display}</b>\n\n"
        "1. Переведите указанную сумму по реквизитам\n"
        "2. Сохраните чек/скриншот оплаты\n\n"
        f"<code>{payment_details}</code>\n\n"
        f"⏳ <b>Время на оплату до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')}\n\n"
        "После оплаты баланс будет пополнен в течении 5 минут."
    )

    await callback.message.answer(
        payment_message,
        reply_markup=back_to_payment_kb(code),
        parse_mode="HTML"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("confirm_order_payment_"))
async def confirm_order_payment_handler(callback: types.CallbackQuery):
    """Обработчик подтверждения оплаты заказа"""
    try:
        code = callback.data.split("_")[-1]
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        # Проверяем, не истекло ли время
        if order[7]:  # expires_at
            expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S")
            if expire_time < datetime.now():
                await callback.answer("Время оплаты истекло")
                return
        
        # Удаляем предыдущее сообщение
        try:
            await callback.message.delete()
        except Exception as e:
            print(f"Ошибка при удалении сообщения: {e}")
            
        price_rub = order[5] / 100
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(order[2])
        product_name = product[3] if product else "Неизвестный товар"
        
        # Получаем выбранный метод оплаты из заказа
        order_with_payment_method = await db.get_order(code)  # Получаем обновлённые данные
        payment_method = order_with_payment_method[11] if len(order_with_payment_method) > 11 and order_with_payment_method[11] else "СБП по номеру"
        
        # Получаем реквизиты из БД в зависимости от метода
        current_payment_details = await get_current_payment_details()
        
        if payment_method == "Банковская карта":
            payment_details = current_payment_details['card']
            payment_method_display = "💳 Банковская карта"
        elif payment_method == "Криптовалюта":
            payment_details = current_payment_details['crypto']
            payment_method_display = "₿ Криптовалюта"
        elif payment_method == "СБП по номеру":
            payment_details = current_payment_details['sbp_phone']
            payment_method_display = "📱 СБП по номеру"
        elif payment_method in ["СБП-QR"]:
            payment_details = current_payment_details['sbp_phone']  # Пока тоже используем номер телефона
            payment_method_display = "📲 СБП-QR"
        else:  # По умолчанию СБП по номеру
            payment_details = current_payment_details['sbp_phone']
            payment_method_display = "📱 СБП по номеру"
        
        expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S") if order[7] else None
        
        # Отправляем уведомление администратору (для автоматической выдачи)
        user_info = f"@{callback.from_user.username}" if callback.from_user.username else f"ID: {callback.from_user.id}"
        admin_message = (
            f"📲 Пользователь {user_info} оплачивает заказ\n\n"
            f"📦 Код заказа: <code>{code}</code>\n"
            f"💰 Товар: {product_name}\n"
            f"💰 Сумма: {price_rub:.0f}₽\n"
            f"⏳ Истекает: {expire_time.strftime('%d.%m.%Y %H:%M') if expire_time else 'Не указано'}\n\n"
            "Подтвердите оплату и выдачу товара:"
        )
        
        # Клавиатура для админа (нужно создать в keyboards.py)
        admin_keyboard = InlineKeyboardMarkup(row_width=1)
        admin_keyboard.add(
            InlineKeyboardButton(
                "✅ Подтвердить и выдать товар",
                callback_data=f"admin_confirm_order_{code}_{callback.from_user.id}"
            ),
            InlineKeyboardButton(
                "❌ Отклонить",
                callback_data=f"admin_reject_order_{code}"
            )
        )
        
        await bot.send_message(
            chat_id=cfg.ADMIN_ID,
            text=admin_message,
            reply_markup=admin_keyboard,
            parse_mode="HTML"
        )
        
        # Отправляем модернизированное сообщение пользователю
        payment_message = (
            f"📲 <b>Оплата {payment_method_display}</b>\n\n"
            "1. Переведите указанную сумму по реквизитам\n"
            "2. Сохраните чек/скриншот оплаты\n\n"
            f"<code>{payment_details}</code>\n\n"
            f"⏳ <b>Время на оплату до</b>: {expire_time.strftime('%d.%m.%Y %H:%M') if expire_time else 'Не указано'}\n\n"
            "После оплаты выдача товара произойдет автоматически в течении 5 - 10 минут."
        )
        
        # Сначала отправляем новый контент
        await callback.message.answer(
            payment_message,
            reply_markup=back_to_product_kb(order[2]),  # Возврат к товару
            parse_mode="HTML"
        )
        
        # Очищаем старые сообщения оплаты через нашу умную функцию
        await smart_cleanup_after_send(callback)
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in confirm_order_payment_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

# Обработчики для админа - подтверждение и отклонение заказов
@dp.callback_query_handler(lambda c: c.data.startswith("admin_confirm_order_"))
async def admin_confirm_order_handler(callback: types.CallbackQuery):
    """Обработчик подтверждения заказа админом"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    try:
        parts = callback.data.split("_")
        code = parts[3]
        user_id = int(parts[4])
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        # Обновляем статус заказа
        await db.update_order_status(code, 'completed')
        
        # Отправляем товар пользователю
        # order[10] is selected_days from orders table
        selected_days = order[10] if len(order) > 10 else None
        success = await send_product_files(user_id, order[2], order[4], selected_days)  # order[4] = quantity
        
        # Удаляем сообщение админа
        try:
            await callback.message.delete()
        except Exception as e:
            print(f"Ошибка при удалении сообщения: {e}")
            
        if success:
            await callback.answer("✅ Заказ подтвержден и товар отправлен")
        else:
            await callback.answer("⚠️ Заказ подтвержден, но ошибка отправки файла")
            
    except Exception as e:
        print(f"Error in admin_confirm_order_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("admin_reject_order_"))
async def admin_reject_order_handler(callback: types.CallbackQuery):
    """Обработчик отклонения заказа админом"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    try:
        code = callback.data.split("_")[-1]
        
        # Обновляем статус заказа
        await db.update_order_status(code, 'cancelled')
        
        # Удаляем сообщение админа
        try:
            await callback.message.delete()
        except Exception as e:
            print(f"Ошибка при удалении сообщения: {e}")
            
        await callback.answer("❌ Заказ отклонен")
        
    except Exception as e:
        print(f"Error in admin_reject_order_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

# Заглушки для недоступных методов оплаты
@dp.callback_query_handler(lambda c: c.data.startswith("pay_method_sbp_") or c.data.startswith("order_pay_sbp_"))
async def sbp_qr_stub_handler(callback: types.CallbackQuery):
    """Заглушка для СБП-QR (но не для phone!)"""
    # Проверяем что это не pay_method_phone или order_pay_phone
    if "_phone_" in callback.data:
        return  # Пропускаем - пусть обработает основной обработчик
    
    await callback.answer(
        "⚠️ СБП-QR пока что недоступна, выберите другой метод оплаты.",
        show_alert=True
    )

@dp.callback_query_handler(lambda c: c.data.startswith("pay_method_skins_") or c.data.startswith("order_pay_skins_"))
async def skins_stub_handler(callback: types.CallbackQuery):
    """Заглушка для скинов"""
    await callback.answer(
        "⚠️ Оплата скинами пока что недоступна, выберите другой метод оплаты.",
        show_alert=True
    )

@dp.callback_query_handler(lambda c: c.data.startswith("pay_method_bitpapa_") or c.data.startswith("order_pay_bitpapa_"))
async def bitpapa_payment_handler(callback: types.CallbackQuery):
    """Обработчик платежей через BitPAPA (создает реальные инвойсы)"""
    try:
        # Извлекаем код платежа
        code = callback.data.split("_")[-1]
        print(f"📤 BitPAPA: Начало обработки платежа {code}")
        print(f"📊 BitPAPA: Полный callback_data: {callback.data}")
        print(f"👤 BitPAPA: User ID: {callback.from_user.id}")
        
        # Получаем данные платежа с дополнительной отладкой
        payment = await db.get_payment(code)
        if not payment:
            print(f"❌ BitPAPA: Платеж {code} не найден")
            print(f"🔍 BitPAPA: Проверим существование платежей в БД...")
            
            # Дополнительная проверка: найдем похожие платежи
            try:
                cursor = await db.conn.execute('''
                    SELECT code, user_id, amount, status, method, created_at 
                    FROM payments 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT 5
                ''',(callback.from_user.id,))
                recent_payments = await cursor.fetchall()
                
                if recent_payments:
                    print(f"🔍 BitPAPA: Найдены платежи пользователя {callback.from_user.id}:")
                    for p in recent_payments:
                        print(f"   - {p[0]} | {p[2]}₽ | {p[3]} | {p[4]} | {p[5]}")
                else:
                    print(f"❌ BitPAPA: У пользователя {callback.from_user.id} нет платежей в БД")
                    
            except Exception as debug_e:
                print(f"❌ BitPAPA: Ошибка отладки БД: {debug_e}")
            
            await callback.answer("Платеж не найден или истек", show_alert=True)
            return
        
        user_id = payment[1]  # user_id
        amount = payment[2]   # amount
        payment_status = payment[4]  # status
        print(f"📋 BitPAPA: Платеж {code} - пользователь {user_id}, сумма {amount}₽, статус: {payment_status}")
        
        # Проверяем, что платеж в корректном статусе
        if payment_status != 'pending':
            print(f"⚠️ BitPAPA: Платеж {code} имеет статус '{payment_status}' вместо 'pending'")
            await callback.answer(f"Платеж уже обработан (статус: {payment_status})", show_alert=True)
            return
        
        # Обновляем метод оплаты в базе данных
        await db.update_payment_method(code, "BitPAPA")
        print(f"✅ BitPAPA: Метод оплаты обновлен для {code}")
        
        # Удаляем предыдущее сообщение
        try:
            await callback.message.delete()
        except Exception as e:
            print(f"⚠️ BitPAPA: Ошибка при удалении сообщения: {e}")
        
        # Создаем реальный инвойс через BitPAPA API
        print(f"📨 BitPAPA: Создаем инвойс для {code}")
        from bitpapa_handlers import create_bitpapa_payment
        payment_data = await create_bitpapa_payment(user_id, amount, code)
        
        if payment_data and payment_data.get('payment_url'):
            print(f"✅ BitPAPA: Инвойс создан - {payment_data.get('payment_id', 'unknown')}")
            
            # Создаем клавиатуру с кнопкой оплаты (как в CryptoBot)
            keyboard = InlineKeyboardMarkup(row_width=1)
            keyboard.add(
                InlineKeyboardButton(
                    "💳 Оплатить через BitPAPA",
                    url=payment_data['payment_url']
                ),
                InlineKeyboardButton(
                    "🔄 Проверить оплату",
                    callback_data=f"check_bitpapa_payment_{code}"
                ),
                InlineKeyboardButton(
                    "❌ Отменить",
                    callback_data=f"cancel_payment_{code}"
                )
            )
            
            # Время истечения (20 минут)
            from datetime import datetime, timedelta
            expire_time = (datetime.now() + timedelta(minutes=20)).strftime("%H:%M")
            
            payment_text = f"""💳 <b>Пополнение через BitPAPA</b>: <code>{code}</code>

<b>Сумма к оплате</b>: {amount}₽
<blockquote>ℹ️ Используется безопасная платежная система BitPAPA для обработки платежей.</blockquote>

⏳ <b>Время на оплату</b>: 20 минут
🕒 <b>Оплатить до</b>: {expire_time} (МСК)
🔍 <b>ID платежа</b>: <code>{payment_data.get('payment_id', 'unknown')}</code>

🔒 <b>Безопасность</b>: Все платежи защищены и обрабатываются через проверенную систему BitPAPA."""
            
            # Отправляем новое сообщение
            await callback.message.answer(
                payment_text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
            print(f"✅ BitPAPA: Сообщение об оплате отправлено пользователю {user_id}")
            await callback.answer("✅ Инвойс BitPAPA создан")
        else:
            # Если API недоступен, показываем ошибку
            print(f"❌ BitPAPA: Не удалось создать инвойс для {code}")
            
            error_text = f"""❌ <b>Ошибка создания платежа BitPAPA</b>

Платежная система BitPAPA временно недоступна.

Пожалуйста, выберите другой способ оплаты:
• 🤖 CryptoBot
• 💳 Картой
• 📱 СБП"""
            
            keyboard = InlineKeyboardMarkup(row_width=1)
            keyboard.add(
                InlineKeyboardButton(
                    "🔄 Попробовать снова",
                    callback_data=f"pay_method_bitpapa_{code}"
                ),
                InlineKeyboardButton(
                    "🔙 Выбрать другой способ",
                    callback_data=f"back_to_payment_{code}"
                )
            )
            
            await callback.message.answer(
                error_text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
            await callback.answer("❌ Ошибка создания платежа BitPAPA", show_alert=True)
            
    except Exception as e:
        print(f"❌ BitPAPA: Ошибка в bitpapa_payment_handler: {e}")
        import traceback
        traceback.print_exc()
        await callback.answer("❌ Произошла ошибка при создании платежа", show_alert=True)

@dp.callback_query_handler(lambda c: c.data.startswith("check_bitpapa_payment_"))
async def check_bitpapa_payment_handler(callback: types.CallbackQuery):
    """Обработчик проверки статуса платежа BitPAPA"""
    try:
        code = callback.data.split("_")[-1]
        
        # Получаем информацию о платеже
        payment = await db.get_payment(code)
        if not payment:
            await callback.answer("Платеж не найден", show_alert=True)
            return
        
        from bitpapa_handlers import check_bitpapa_payment_status
        
        # Проверяем статус (здесь нужно получить payment_id из БД)
        # Пока просто показываем сообщение
        await callback.answer(
            "🔄 Проверяем статус платежа BitPAPA...",
            show_alert=True
        )
        
    except Exception as e:
        print(f"Ошибка в check_bitpapa_payment_handler: {e}")
        await callback.answer("❌ Ошибка проверки статуса", show_alert=True)

@dp.callback_query_handler(lambda c: c.data.startswith("cancel_payment_"))
async def cancel_payment_handler(callback: types.CallbackQuery):
    code = callback.data.split("_")[-1]

    # Удаляем предыдущее сообщение о платеже
    try:
        await callback.message.delete()
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    # Отправляем подтверждение отмены с новой клавиатурой
    await callback.message.answer(
        f"⚠️ Вы уверены что хотите отменить пополнение <code>{code}</code>?",
        reply_markup=cancel_confirm_kb(code),
        parse_mode="HTML"
    )
    await callback.answer()


@dp.message_handler(lambda message: message.text and message.text.isdigit() and int(message.text) >= 50)
async def handle_amount_input(message: types.Message):
    try:
        amount = int(message.text)
        if amount < 50:
            await message.answer("Минимальная сумма пополнения - 50₽")
            return
        if amount > 20000:
            await message.answer("Максимальная сумма пополнения - 20,000₽")
            return

        code = generate_payment_code()
        print(f"💰 Создается новый платеж: код={code}, пользователь={message.from_user.id}, сумма={amount}₽")

        # Сохраняем платеж в БД без времени истечения (или с NULL)
        payment_id = await db.create_payment(
            user_id=message.from_user.id,
            amount=amount,
            code=code,
            expires_at=None  # Устанавливаем NULL или очень далекое будущее
        )
        print(f"💾 Платеж сохранен в БД с ID: {payment_id}")

        await message.answer(
            cfg.PAYMENT_INFO_TEXT.format(
                code=code,
                amount=amount,
                expire_time="После выбора метода оплаты"  # Изменяем текст
            ),
            reply_markup=await payment_methods_compact_kb(code),
            parse_mode="HTML"
        )
    except ValueError:
        await message.answer("Пожалуйста, введите корректную сумму (только цифры)")



async def process_payment(message: types.Message, amount: int):
    try:
        code = generate_payment_code()
        expire_time = datetime.now() + timedelta(minutes=1)

        # Сохраняем платеж в БД
        payment_id = await db.create_payment(
            user_id=message.from_user.id,
            amount=amount,
            code=code,
            expires_at=expire_time.strftime("%Y-%m-%d %H:%M:%S")
        )

        await message.answer(
            cfg.PAYMENT_INFO_TEXT.format(
                code=code,
                amount=amount,
                expire_time=expire_time.strftime("%d.%m.%Y %H:%M")
            ),
            reply_markup=await payment_methods_compact_kb(code)
        )
    except Exception as e:
        print(f"Ошибка при обработке платежа: {e}")
        await message.answer(
            "Произошла ошибка, попробуйте позже",
            reply_markup=main_menu_kb()
        )

@dp.callback_query_handler(lambda c: c.data == "custom_amount")
async def custom_amount_handler(callback: types.CallbackQuery):
    await safe_delete_messages(callback)
    await callback.message.answer(
        "💵 Теперь укажите в сообщении сумму, на которую хотите пополнить баланс и отправьте сумму боту",
        reply_markup=back_to_payment_kb()
    )
    await callback.answer()



@dp.callback_query_handler(lambda c: c.data.startswith("pay_method_"))
async def process_payment_method(callback: types.CallbackQuery):
    print(f"Получен callback: {callback.data}")
    parts = callback.data.split("_")
    print(f"Части callback_data: {parts}")
    
    if len(parts) < 4:
        await callback.answer("Неверные данные")
        return
        
    method = parts[2]
    code = parts[3]
    
    print(f"Метод: {method}, Код: {code}")

    payment = await db.get_payment(code)
    if not payment:
        await callback.answer("Платеж не найден")
        return

    # Обработка CryptoBot отдельно - создаем инвойс и переходим в бота
    if method == "cryptobot":
        print("Обрабатываем CryptoBot")
        await process_cryptobot_redirect(callback, code)
        return

    # Определяем название метода для базы данных
    method_names = {
        "sbp": "СБП-QR",
        "qr": "СБП-QR",
        "phone": "СБП по номеру",
        "card": "Банковская карта",
        "crypto": "Криптовалюта",
        "cryptobot": "CryptoBot",
        "stars": "Stars",
        "skins": "Скинами",
        "bitpapa": "BitPapa"
    }
    
    method_name = method_names.get(method, method)
    
    # Сохраняем метод оплаты в базе
    await db.update_payment_method(code, method_name)

    # Удаляем предыдущее сообщение с методами оплаты через умную очистку
    # Уже не нужно вручную удалять, будем использовать smart_cleanup_after_send

    # Устанавливаем время истечения (20 минут с текущего момента)
    expire_time = datetime.now() + timedelta(minutes=20)
    expires_at_str = expire_time.strftime("%Y-%m-%d %H:%M:%S")
    await db.update_payment_expire_time(code, expires_at_str)

    # Сначала отправляем сообщение с подтверждением платежа
    await callback.message.answer(
        f"💳 <b>Пополнение баланса</b>: <code>{code}</code>\n\n"
        f"<b>Сумма к оплате</b>: {payment[2]}₽\n"
        f"<blockquote>ℹ️ Сумма пополнения указана без учёта комиссии платёжной системы, "
        f"которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять "
        f"для вас низкие цены и качественный сервис.</blockquote>\n\n"
        f"⏳ <b>Время на оплату</b>: 20 минут\n"
        f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)",
        reply_markup=payment_confirm_kb(code),
        parse_mode="HTML"
    )
    
    # Очищаем старые сообщения
    await smart_cleanup_after_send(callback)
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("pay_amount_"))
async def process_payment_amount(callback: types.CallbackQuery):
    print(f"=== НАЧАЛО ОБРАБОТКИ CALLBACK ===")
    print(f"Полный callback_data: {callback.data}")
    print(f"User ID: {callback.from_user.id}")
    print(f"Message ID: {callback.message.message_id}")
    try:
        amount = int(callback.data.split("_")[-1])
        print(f"Извлечена сумма: {amount}")
        code = generate_payment_code()
        print(f"📊 Полный callback_data: {callback.data}")
        print(f"👤 User ID: {callback.from_user.id}")
        print(f"💫 Извлечена сумма: {amount}")
        print(f"📋 Сгенерирован код: {code}")

        # Удаляем предыдущее сообщение с суммами
        try:
            await callback.message.delete()
            print("Сообщение с суммами удалено")
        except Exception as e:
            print(f"Ошибка при удалении сообщения: {e}")

        # Создаем платеж без времени истечения
        payment_id = await db.create_payment(
            user_id=callback.from_user.id,
            amount=amount,
            code=code,
            expires_at=None
        )
        print(f"Создан платеж с ID: {payment_id}")

        # Отправляем сообщение с методами оплаты
        keyboard = await payment_methods_compact_kb(code)
        print(f"Сгенерирована клавиатура: {keyboard}")
        await callback.message.answer(
            f"💳 <b>Пополнение баланса</b>: <code>{code}</code>\n\n"
            f"<b>Сумма к оплате</b>: {amount}₽\n"
            f"<blockquote>ℹ️ Сумма пополнения указана без учёта комиссии платёжной системы, "
            f"которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять "
            f"для вас низкие цены и качественный сервис.</blockquote>",
            reply_markup=keyboard,
            parse_mode="HTML"
        )
        print("Отправлено сообщение с методами оплаты")
    except Exception as e:
        print(f"Ошибка при обработке платежа: {e}")
        import traceback
        traceback.print_exc()
        await callback.message.answer(
            "Произошла ошибка, попробуйте позже",
            reply_markup=main_menu_kb()
        )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_payment", state="*")
async def back_to_payment_from_custom(callback: types.CallbackQuery, state: FSMContext):
    # Finish any active state
    if state:
        await state.finish()
    
    try:
        # Сначала отправляем новый контент
        # Отправляем основное меню платежа БЕЗ стикера (только текст)
        await callback.message.answer(
            cfg.PAYMENT_TEXT,
            reply_markup=payment_amounts_kb()
        )
        
        # Только после этого удаляем старые сообщения
        await smart_cleanup_after_send(callback)
        
    except Exception as e:
        print(f"Ошибка при возврате к платежам: {e}")
        await callback.message.answer(
            "Произошла ошибка, попробуйте позже",
            reply_markup=main_menu_kb()
        )
    await callback.answer()




@dp.callback_query_handler(lambda c: c.data.startswith("back_to_payment_"), state="*")
async def back_to_payment_handler(callback: types.CallbackQuery, state: FSMContext):
    # Finish any active state
    if state:
        await state.finish()
    
    code = callback.data.split("_")[-1]

    # Удаляем сообщение с подтверждением отмены
    try:
        await callback.message.delete()
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    payment = await db.get_payment(code)
    if not payment:
        await callback.answer("Платеж не найден")
        return

    # Проверяем не истекло ли время оплаты (только если expires_at установлен)
    if payment[7]:  # expires_at
        try:
            expire_time = datetime.strptime(payment[7], "%Y-%m-%d %H:%M:%S")
            if expire_time < datetime.now():
                keyboard = InlineKeyboardMarkup(row_width=1)
                keyboard.add(
                    InlineKeyboardButton(
                        "↩️ Вернуться к пополнению",
                        callback_data="back_to_payment"
                    ),
                    InlineKeyboardButton(
                        "💬 Написать в поддержку",
                        url=f"https://t.me/{cfg.SUPPORT_ID}"
                    ),
                    InlineKeyboardButton(
                        "🤖 Поддержка по СПАМу",
                        url="https://t.me/SuppPayBot"
                    )
                )

                await callback.message.answer(
                    cfg.PAYMENT_EXPIRED_TEXT.format(code=code),
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
                await callback.answer()
                return
        except Exception as e:
            print(f"Ошибка при обработке времени истечения: {e}")

    # Если expires_at не установлен, используем дефолтное сообщение
    expire_time_str = payment[7] if payment[7] else "не установлено"

    # Возвращаем пользователя к платежу
    await callback.message.answer(
        cfg.PAYMENT_INFO_TEXT.format(
            code=code,
            amount=payment[2],
            expire_time=expire_time_str
        ),
        reply_markup=await payment_methods_compact_kb(code),
        parse_mode="HTML"
    )
    await callback.answer()



@dp.callback_query_handler(lambda c: c.data == "deposit_balance")
async def deposit_from_profile(callback: types.CallbackQuery):
    try:
        await safe_delete_messages(callback)
        # Сначала отправляем стикер
        await bot.send_sticker(
            chat_id=callback.message.chat.id,
            sticker="CAACAgEAAxkBAAEO7SxodMdmuDswmlhmRigQFvYeCcXZggACRwIAAvR1IESZ69gYUsdrkzYE"
        )

        # Затем отправляем текст с клавиатурой сумм
        await callback.message.answer(
            "💳 Пополнение баланса\n\nНапишите в ответ сумму на которую хотите пополнить баланс или выберете из предложенных (минимум 50₽)",
            reply_markup=payment_amounts_kb()
        )
    except Exception as e:
        print(f"Ошибка при обработке платежа: {e}")
        await callback.message.answer(
            "Произошла ошибка, попробуйте позже",
            reply_markup=main_menu_kb()
        )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("admin_approve_"))
async def admin_approve_payment(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    code = parts[2]
    user_id = int(parts[3])
    amount = int(parts[4])

    async with db_lock:
        try:
            await db.conn.execute("BEGIN")

            # Полная проверка платежа
            cursor = await db.conn.execute('''
                SELECT status, user_id, amount FROM payments 
                WHERE code = ? AND status = 'pending'
            ''', (code,))
            payment = await cursor.fetchone()

            if not payment:
                await callback.answer("Платеж не найден или уже обработан")
                await db.conn.rollback()
                return

            # Проверка соответствия данных
            if payment[1] != user_id or payment[2] != amount:
                await callback.answer("Несоответствие данных платежа")
                await db.conn.rollback()
                return

            # Обновляем статус платежа
            await db.conn.execute('''
                UPDATE payments 
                SET status = 'completed', 
                    completed_at = datetime('now') 
                WHERE code = ? AND status = 'pending'
            ''', (code,))

            # Обновляем баланс пользователя
            await db.conn.execute('''
                UPDATE users 
                SET balance = balance + ? 
                WHERE user_id = ?
            ''', (amount, user_id))

            # Добавляем запись в историю транзакций
            await db.conn.execute('''
                INSERT INTO transactions 
                (user_id, amount, operation_type, description) 
                VALUES (?, ?, 'deposit', ?)
            ''', (user_id, amount, f"Пополнение баланса {code}"))

            await db.conn.commit()

            # Уведомляем пользователя
            try:
                await bot.send_message(
                    chat_id=user_id,
                    text=f"✅ Ваш баланс пополнен на {amount}₽\nКод платежа: <code>{code}</code>",
                    parse_mode="HTML"
                )
            except Exception as e:
                print(f"Ошибка уведомления: {e}")

            # Удаляем сообщение у админа
            try:
                await callback.message.delete()
            except:
                pass

            await callback.answer("✅ Баланс пополнен")

        except Exception as e:
            await db.conn.rollback()
            print(f"Ошибка подтверждения платежа: {e}")
            await callback.answer("❌ Ошибка при пополнении")

@dp.callback_query_handler(lambda c: c.data.startswith("admin_reject_"))
async def admin_reject_payment(callback: types.CallbackQuery):
    code = callback.data.split("_")[-1]

    # Обновляем статус платежа
    await db.conn.execute('''
        UPDATE payments SET status = 'rejected' WHERE code = ?
    ''', (code,))
    await db.conn.commit()

    # Удаляем сообщение с кнопками у админа
    try:
        await callback.message.delete()
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    await callback.answer("Платеж отклонен")

@dp.callback_query_handler(lambda c: c.data == "my_orders")
async def show_orders(callback: types.CallbackQuery):
    """Показывает заказы пользователя с пагинацией"""
    await show_user_orders(callback, page=0)

@dp.callback_query_handler(lambda c: c.data.startswith("orders_page_"))
async def orders_pagination_handler(callback: types.CallbackQuery):
    """Обработчик пагинации заказов пользователя"""
    try:
        page = int(callback.data.split("_")[2])
        await show_user_orders(callback, page=page, edit_message=True)
    except (ValueError, IndexError) as e:
        print(f"Error in orders_pagination_handler: {e}")
        await callback.answer("Ошибка пагинации")
    except Exception as e:
        print(f"Unexpected error in orders_pagination_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("view_order_"))
async def view_order_details(callback: types.CallbackQuery):
    """Обработчик просмотра деталей заказа"""
    try:
        code = callback.data.split("_")[2]
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        # Проверяем, что это заказ пользователя
        if order[1] != callback.from_user.id:
            await callback.answer("Нет доступа к этому заказу")
            return
            
        order_id, user_id, product_id, code, quantity, price, status = order[:7]
        expires_at, created_at, product_name = order[7:10]
        selected_days = order[10] if len(order) > 10 else None
        payment_method = order[11] if len(order) > 11 else None
        completed_at = order[12] if len(order) > 12 else None
        
        # Определяем статус заказа
        status_emoji = {
            'pending': '⏳',
            'paid': '✅', 
            'completed': '✅',
            'cancelled': '❌',
            'expired': '⏰'
        }
        
        status_text = {
            'pending': 'Ожидает оплаты',
            'paid': 'Оплачен',
            'completed': 'Выполнен', 
            'cancelled': 'Отменён',
            'expired': 'Истёк'
        }
        
        emoji = status_emoji.get(status, '❓')
        status_name = status_text.get(status, 'Неизвестно')
        
        # Форматируем цену
        price_rub = price / 100 if price else 0
        
        # Добавляем информацию о днях действия
        days_info = f" ({selected_days} дн.)" if selected_days else ""
        
        # Форматируем время создания
        try:
            if created_at:
                created_dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
                created_str = created_dt.strftime("%d.%m.%Y %H:%M")
            else:
                created_str = "Неизвестно"
        except:
            created_str = "Неизвестно"
        
        # Информация об истечении для pending заказов
        expire_info = ""
        if status == 'pending' and expires_at:
            try:
                expire_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S")
                now = datetime.now()
                if expire_dt > now:
                    time_left = expire_dt - now
                    minutes_left = int(time_left.total_seconds() / 60)
                    if minutes_left > 60:
                        hours_left = minutes_left // 60
                        expire_info = f"\n⏰ **Истекает через**: {hours_left}ч {minutes_left % 60}м"
                    else:
                        expire_info = f"\n⏰ **Истекает через**: {minutes_left}м"
                else:
                    expire_info = "\n⏰ **Время истекло**"
            except:
                pass
        
        # Формируем детальное сообщение о заказе
        message_text = (
            f"{emoji} **Детали заказа**\n\n"
            f"📦 **Товар**: {product_name}{days_info}\n"
            f"🔢 **Количество**: {quantity} шт\n"
            f"💰 **Стоимость**: {price_rub:.0f}₽\n"
            f"📅 **Дата создания**: {created_str}\n"
            f"🏷️ **Статус**: {status_name}\n"
            f"🏷️ **Код заказа**: `{code}`"
        )
        
        if payment_method:
            message_text += f"\n💳 **Метод оплаты**: {payment_method}"
        
        if completed_at:
            try:
                completed_dt = datetime.strptime(completed_at, "%Y-%m-%d %H:%M:%S")
                completed_str = completed_dt.strftime("%d.%m.%Y %H:%M")
                message_text += f"\n✅ **Дата выполнения**: {completed_str}"
            except:
                pass
        
        message_text += expire_info
        
        # Создаем клавиатуру в зависимости от статуса
        from keyboards import order_details_kb
        
        if status == 'pending':
            # Показываем кнопки оплаты и отмены
            keyboard = order_details_kb(code)
        else:
            # Для остальных статусов только кнопка назад
            keyboard = InlineKeyboardMarkup()
            keyboard.add(
                InlineKeyboardButton("🔙 К заказам", callback_data="my_orders")
            )
        
        await callback.message.edit_text(
            message_text,
            parse_mode="Markdown",
            reply_markup=keyboard
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in view_order_details: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("pay_order_"))
async def pay_order_handler(callback: types.CallbackQuery):
    """Обработчик оплаты заказа"""
    try:
        code = callback.data.split("_")[2]
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        # Проверяем, не истекло ли время
        if order[7]:  # expires_at
            expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S")
            if expire_time < datetime.now():
                await callback.answer("Время оплаты истекло")
                return
        
        # Перенаправляем на страницу оплаты
        price_rub = order[5] / 100
        category_with_type = await db.get_product_category_with_type(order[2])
        expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S") if order[7] else None
        
        order_text = f"💳 <b>Оплата заказа</b>: <code>{code}</code>\n\n" \
                    f"📦 <b>Товар</b>: {order[9]}\n" \
                    f"<b>{category_with_type}</b>\n\n" \
                    f"📦 <b>Кол-во</b>: {order[4]} шт\n" \
                    f"💰 <b>Сумма к оплате</b>: {price_rub:.0f}₽\n" \
                    f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>\n\n" \
                    f"⏳ <b>Время на оплату</b>: 20 минут\n" \
                    f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)" if expire_time else ""
        
        await callback.message.edit_text(
            order_text,
            parse_mode="HTML",
            reply_markup=await order_payment_methods_kb(code)
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in pay_order_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("cancel_order_from_orders_"))
async def cancel_order_from_orders_handler(callback: types.CallbackQuery):
    """Обработчик отмены заказа из списка заказов с подтверждением"""
    try:
        code = callback.data.split("_")[-1]
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        # Проверяем, что это заказ пользователя
        if order[1] != callback.from_user.id:
            await callback.answer("Нет доступа к этому заказу")
            return
            
        # Можно отменить только pending заказы
        if order[6] != 'pending':
            await callback.answer("Можно отменить только неоплаченные заказы")
            return
        
        # Отправляем подтверждение отмены
        await callback.message.answer(
            f"⚠️ Вы уверены что хотите отменить заказ <code>{code}</code>?",
            parse_mode="HTML",
            reply_markup=order_cancel_confirm_kb(code)
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in cancel_order_from_orders_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

async def show_user_orders(callback: types.CallbackQuery, page: int = 0, edit_message: bool = False):
    """Отображает заказы пользователя с пагинацией"""
    user_id = callback.from_user.id
    orders_per_page = 5
    
    # Получаем общее количество заказов
    total_orders = await db.get_user_orders_count(user_id)
    
    if total_orders == 0:
        message_text = "📭 У вас нет ни одного заказа"
        keyboard = back_to_profile_kb()
        
        if edit_message:
            await callback.message.edit_text(message_text, reply_markup=keyboard)
        else:
            await callback.message.answer(message_text, reply_markup=keyboard)
            await smart_cleanup_after_send(callback)
        await callback.answer()
        return
    
    # Получаем заказы для текущей страницы
    orders = await db.get_user_orders(user_id, page, orders_per_page)
    total_pages = (total_orders + orders_per_page - 1) // orders_per_page
    
    # Формируем текст сообщения
    message_text = f"📦 **Мои заказы** (стр. {page + 1}/{total_pages})\n\nНажмите на товар чтобы посмотреть детали:"
    
    # Создаем клавиатуру с кнопками заказов
    from keyboards import user_orders_list_kb, user_orders_pagination_kb
    orders_keyboard = user_orders_list_kb(orders, page, total_pages)
    pagination_keyboard = user_orders_pagination_kb(page, total_pages, True)
    
    # Объединяем клавиатуры
    final_keyboard = InlineKeyboardMarkup()
    
    # Добавляем кнопки заказов
    for row in orders_keyboard.inline_keyboard:
        final_keyboard.row(*row)
    
    # Добавляем кнопки пагинации
    for row in pagination_keyboard.inline_keyboard:
        final_keyboard.row(*row)
    
    if edit_message:
        await callback.message.edit_text(
            message_text, 
            parse_mode="Markdown",
            reply_markup=final_keyboard
        )
    else:
        await callback.message.answer(
            message_text, 
            parse_mode="Markdown",
            reply_markup=final_keyboard
        )
        await smart_cleanup_after_send(callback)
    
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data == "referral_program")
async def show_referral_program(callback: types.CallbackQuery):
    user_id = callback.from_user.id
    referral_link = f"https://t.me/streetsoftkatalogbot?start={user_id}"

    referral_info = f"""🤝 Реферальная программа

Реферальная программа
Процент заработка: 5%

Статистика
Лично приглашенных: 0

Реферальная ссылка
{referral_link}"""

    # Сначала отправляем новый контент
    await callback.message.answer(
        referral_info,
        reply_markup=back_to_referral_kb()
    )
    
    # Только после этого удаляем старые сообщения (только от бота)
    await smart_cleanup_after_send(callback)
    await callback.answer()


# Обработчик всех callback должен быть в самом конце, чтобы не перехватывать другие обработчики
# Перенесён в конец файла
# @dp.callback_query_handler()
# async def handle_all_callbacks(callback: types.CallbackQuery):
#     """Обработчик всех callback для логирования"""
#     print(f"Получен callback: {callback.data} от пользователя {callback.from_user.id}")
#     # Не обрабатываем, просто логируем
#     await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "withdraw_funds")
async def withdraw_funds(callback: types.CallbackQuery):
    # Сначала отправляем новый контент
    try:
        await bot.send_sticker(
            chat_id=callback.message.chat.id,
            sticker=cfg.WITHDRAW_STICKER
        )
    except Exception as e:
        print(f"Ошибка стикера: {e}")

    await callback.message.answer(
        "💰 Вывод средств\n\nВыберите куда вывести средства",
        reply_markup=withdraw_methods_kb()
    )
    
    # Только после этого удаляем старые сообщения
    await smart_cleanup_after_send(callback)
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data == "withdraw_to_balance")
async def withdraw_to_balance(callback: types.CallbackQuery):
    user_balance = 0  # Здесь должна быть реальная проверка баланса из БД

    if user_balance < 100:
        await callback.answer(
            text=f"❌ Недостаточно средств для вывода\nВаш баланс: {user_balance}₽\nМинимальная сумма: 100₽",
            show_alert=True
        )
    else:
        await callback.message.answer(
            "Введите сумму для вывода:",
            reply_markup=back_to_profile_kb()
        )


@dp.callback_query_handler(lambda c: c.data == "back_to_referral", state="*")
async def back_to_referral(callback: types.CallbackQuery, state: FSMContext):
    # Finish any active state
    if state:
        await state.finish()
    
    user_id = callback.from_user.id
    referral_link = f"https://t.me/streetsoftkatalogbot?start={user_id}"

    referral_info = f"""🤝 Реферальная программа

Реферальная программа
Процент заработка: 5%

Статистика
Лично приглашенных: 0

Реферальная ссылка
{referral_link}"""

    # Сначала отправляем новый контент
    await callback.message.answer(
        referral_info,
        reply_markup=back_to_referral_kb()
    )
    
    # Только после этого удаляем старые сообщения
    await smart_cleanup_after_send(callback)
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data == "back_to_profile", state="*")
async def back_to_profile(callback: types.CallbackQuery, state: FSMContext):
    # Finish any active state
    if state:
        await state.finish()
    
    # Получаем актуальные данные пользователя
    balance = await db.get_user_balance(callback.from_user.id)
    reg_date = await db.get_user_registration_date(callback.from_user.id) or datetime.now()

    profile_info = cfg.PROFILE_TEXT.format(
        user_id=callback.from_user.id,
        registration_date=reg_date.strftime("%d.%m.%Y"),
        balance=balance,
        partner_balance=0,
        purchases=0
    )

    # Сначала отправляем новый контент
    try:
        await bot.send_sticker(
            chat_id=callback.message.chat.id,
            sticker=cfg.PASSPORT_STICKER
        )
    except Exception as e:
        print(f"Ошибка отправки стикера: {e}")
    
    await bot.send_message(
        chat_id=callback.message.chat.id,
        text=profile_info,
        reply_markup=profile_actions_kb()
    )
    
    # Только после этого удаляем старые сообщения
    await smart_cleanup_after_send(callback)
    await callback.answer()

@dp.message_handler(lambda message: message.text and message.text == "📞 Связаться")
async def contact_support(message: types.Message):
    try:
        await send_support_sticker(message.chat.id)  # Используем глобальную функцию
        await message.answer(
            cfg.CONTACT_TEXT,
            reply_markup=contact_menu_kb()
        )
    except Exception as e:
        print(f"Ошибка при входе в поддержку: {e}")
        await message.answer(
            "Произошла ошибка, попробуйте позже",
            reply_markup=main_menu_kb()
        )

@dp.callback_query_handler(lambda c: c.data == "back_to_contact", state="*")
async def back_to_contact(callback: types.CallbackQuery, state: FSMContext):
    # Finish any active state
    if state:
        await state.finish()
    
    # Сначала отправляем новый контент
    await send_support_sticker(callback.message.chat.id)
    await bot.send_message(
        chat_id=callback.message.chat.id,
        text=cfg.CONTACT_TEXT,
        reply_markup=contact_menu_kb()
    )
    
    # Только после этого удаляем старые сообщения
    await smart_cleanup_after_send(callback)
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "create_ticket")
async def create_ticket(callback: types.CallbackQuery):
    # Сначала отправляем новый контент
    await send_support_sticker(callback.message.chat.id)
    await callback.message.answer(
        "🆘 Служба поддержки › Выбор темы\n\nВыберите тему обращения:",
        reply_markup=support_topics_kb()
    )
    
    # Только после этого удаляем старые сообщения
    await smart_cleanup_after_send(callback)
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data == "my_tickets")
async def show_my_tickets(callback: types.CallbackQuery):
    try:
        tickets = await db.get_user_tickets(callback.from_user.id)

        if not tickets:
            # Сначала отправляем новый контент
            await callback.message.answer(
                "📭 У вас пока нет обращений",
                reply_markup=back_to_contact_kb()
            )
        else:
            # Сначала отправляем новый контент
            await bot.send_sticker(
                chat_id=callback.message.chat.id,
                sticker=cfg.MY_TICKETS_STICKER
            )

            await callback.message.answer(
                "🆘 Служба поддержки › Все обращения\n\n"
                "Выберите обращение для просмотра:",
                reply_markup=tickets_list_kb(tickets)
            )
        
        # Только после этого удаляем старые сообщения (только от бота)
        await smart_cleanup_after_send(callback)
        
    except Exception as e:
        print(f"Ошибка при показе обращений: {e}")
        await callback.answer("Произошла ошибка, попробуйте позже")
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data.startswith("view_ticket_"))
async def view_ticket_details(callback: types.CallbackQuery):
    try:
        ticket_id = int(callback.data.split("_")[-1])
        ticket = await db.get_ticket(ticket_id, callback.from_user.id)

        if not ticket:
            await callback.answer("Обращение не найдено")
            return
        # Corrected indices: [0:id, 1:user_id, 2:topic, 3:message, 4:status, 5:reply, ...]

        is_answered = ticket[5] is not None  # reply is at index 5
        status = "Отвечен" if is_answered else "В обработке"

        response_text = (
            f"🆘 Служба поддержки › Обращение\n\n"
            f"Тема: {ticket[2]}\n"
            f"Статус: {status}\n\n"
            f"📝 Ваше сообщение:\n"
            f"<code>{ticket[3]}</code>\n\n"  # Оригинальное сообщение пользователя
        )

        if is_answered:
            # Разбиваем ответ на части для форматирования
            reply_parts = ticket[5].split('\n')
            # Создаем строку с переносами отдельно
            reply_content = '\n'.join(reply_parts[2:])
            formatted_reply = (
                f"👤 {reply_parts[0]}\n"  # Оператор
                f"💬 Ответ:\n"
                f"<code>{reply_content}</code>"  # Текст ответа
            )
            response_text += formatted_reply

        await callback.message.edit_text(
            response_text,
            reply_markup=ticket_details_kb(ticket[0], is_answered),
            parse_mode="HTML"  # Меняем на HTML для тега <code>
        )
    except Exception as e:
        print(f"Ошибка при просмотре обращения: {e}")
        await callback.answer("Произошла ошибка, попробуйте позже")
    await callback.answer()

# Add this new handler for the back button
@dp.callback_query_handler(lambda c: c.data == "back_to_tickets", state="*")
async def back_to_tickets(callback: types.CallbackQuery, state: FSMContext):
    # Finish any active state
    if state:
        await state.finish()
    
    try:
        tickets = await db.get_user_tickets(callback.from_user.id)

        if not tickets:
            # Сначала отправляем новый контент
            await callback.message.answer(
                "📭 У вас пока нет обращений",
                reply_markup=my_tickets_kb()
            )
        else:
            # Сначала отправляем новый контент
            await bot.send_sticker(
                chat_id=callback.message.chat.id,
                sticker=cfg.MY_TICKETS_STICKER
            )
            await callback.message.answer(
                "🆘 Служба поддержки › Все обращения\n\n"
                "Выберите обращение для просмотра:",
                reply_markup=tickets_list_kb(tickets)
            )
        
        # Только после этого удаляем старые сообщения
        await smart_cleanup_after_send(callback)
        
    except Exception as e:
        print(f"Ошибка при возврате к списку обращений: {e}")
        await callback.answer("Произошла ошибка, попробуйте позже")
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_topics", state="*")
async def back_to_topics(callback: types.CallbackQuery, state: FSMContext):
    try:
        await state.finish()
        
        # Сначала отправляем новый контент
        await send_support_sticker(callback.message.chat.id)
        await callback.message.answer(
            "🆘 Служба поддержки › Выбор темы\n\nВыберите тему обращения:",
            reply_markup=support_topics_kb()
        )
        
        # Только после этого удаляем старые сообщения
        await smart_cleanup_after_send(callback)
    except Exception as e:
        print(f"Ошибка при возврате к темам: {e}")
        await callback.answer("Произошла ошибка, попробуйте ещё раз")
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("support_"))
async def handle_support_topic(callback: types.CallbackQuery, state: FSMContext):
    topic = callback.data.split("_")[1]
    topic_names = {
        "order": "Проблема с заказом",
        "payment": "Проблема с оплатой",
        "product": "Вопросы по товару"
    }

    if topic not in topic_names:
        await callback.answer()
        return

    async with state.proxy() as data:
        data['topic'] = topic_names[topic]

    await SupportTicket.waiting_for_message.set()

    try:
        '''await bot.send_sticker(
            chat_id=callback.message.chat.id,
            sticker="CAACAgEAAxkBAAEPBDtog2TLE4QNZg-UgrnXtNtmPya6TgACrwIAAphXIUS8lNoZG4P3rDYE"
        )'''

        # Редактируем текущее сообщение вместо отправки нового
        await callback.message.edit_text(
            f"🆘 Служба поддержки › Создание обращения\n\n"
            f"Тема: {topic_names[topic]}\n\n"
            f"Пришлите в ответ текст вашего обращения (или нажмите 'Назад к темам' для отмены):",
            reply_markup=back_to_topics_kb()
        )
    except Exception as e:
        print(f"Ошибка при отправке стикера: {e}")
        await callback.message.answer(
            "Произошла ошибка, попробуйте ещё раз",
            reply_markup=support_topics_kb()
        )

    await callback.answer()


    # Модифицируем обработчик создания обращения
@dp.message_handler(state=SupportTicket.waiting_for_message)
async def handle_support_message(message: types.Message, state: FSMContext):
    if (message.text and message.text.startswith('/')) or (message.text or "") in ["🔙 Назад к темам"]:
        return

    # Используем html_text для поддержки форматирования Telegram
    message_text = message.html_text if message.html_text else message.text
    
    if not (message_text and message_text.strip()):
        await message.answer("❌ Сообщение не может быть пустым.")
        return

    async with state.proxy() as data:
        topic = data['topic']

    # Сохраняем обращение в БД с форматированием
    try:
        ticket_id = await db.create_ticket(
            user_id=message.from_user.id,
            topic=topic,
            message=message_text  # Сохраняем с форматированием
        )


        user_info = f"@{message.from_user.username}" if message.from_user.username else f"ID: {message.from_user.id}"
        admin_message = (
            f"✉️ Новое обращение (#{ticket_id})\n"
            f"От: {user_info}\n"
            f"Тема: {topic}\n\n"
            f"{message_text}"  # Отправляем с форматированием
        )

        await bot.send_message(
            chat_id=cfg.ADMIN_ID,
            text=admin_message,
            parse_mode="HTML",  # Используем HTML для отображения форматирования
            reply_markup=admin_reply_kb(message.from_user.id, ticket_id)
        )

        await message.answer(
            cfg.TICKET_SENT_TEXT,
            reply_markup=back_to_contact_kb()
        )
    except Exception as e:
        print(f"Ошибка при отправке обращения: {e}")
        await message.answer(
            "❌ Произошла ошибка при отправке обращения.",
            reply_markup=back_to_contact_kb()
        )

    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("view_theme_"))
async def view_theme_handler(callback: types.CallbackQuery):
    """Обработчик просмотра темы"""
    try:
        theme_id = int(callback.data.split("_")[2])
        theme = await db.get_catalog_item(theme_id)
        
        if not theme:
            await callback.answer("Тема не найдена")
            return
        
        # Получаем дочерние элементы (категории)
        children = await db.get_catalog_children(theme_id)
        
        # Формируем описание с preview_link
        description = format_description_with_preview(theme[4], theme[7])
        
        # Создаём клавиатуру
        keyboard = await create_catalog_keyboard(children, is_admin=await is_user_admin(callback.from_user.id), parent_id=theme_id, item_type='theme')
        
        # Проверяем, является ли это основным каталогом
        message_text = callback.message.text or ""
        is_main_catalog = (
            "Catalog" in message_text or
            "Каталог товаров" in message_text or
            "🏪 Каталог товаров" in message_text
        )
        
        if is_main_catalog:
            # Если это основной каталог, только удаляем сообщение
            try:
                await callback.message.delete()
            except Exception as e:
                print(f"Ошибка при удалении сообщения: {e}")
            
            # Отправляем стикер и контент обычным способом
            if theme[5]:  # sticker_id
                await callback.message.answer_sticker(theme[5])
            
            if theme[6]:  # photo_id
                await callback.message.answer_photo(
                    photo=theme[6],
                    caption=description,
                    parse_mode="HTML",
                    reply_markup=keyboard
                )
            else:
                await callback.message.answer(
                    text=description,
                    parse_mode="HTML",
                    reply_markup=keyboard
                )
        else:
            # Используем быструю замену сообщения с правильным порядком стикеров
            await replace_message_with_sticker_first(
                callback=callback,
                new_text=description if not theme[6] else None,
                new_photo=theme[6] if theme[6] else None,
                new_caption=description if theme[6] else None,
                new_keyboard=keyboard,
                sticker_id=theme[5] if theme[5] else None
            )
        
    except Exception as e:
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("view_category_"))
async def view_category_handler(callback: types.CallbackQuery):
    """Обработчик просмотра категории"""
    try:
        category_id = int(callback.data.split("_")[2])
        category = await db.get_catalog_item(category_id)
        
        if not category:
            await callback.answer("Категория не найдена")
            return
        
        # Получаем дочерние элементы (подкатегории или товары)
        children = await db.get_catalog_children(category_id)
        
        # Получаем текущую страницу из callback_data если есть
        current_page = 0
        if len(callback.data.split("_")) > 3:
            try:
                current_page = int(callback.data.split("_")[3])
            except (ValueError, IndexError):
                current_page = 0
        
        # Сохраняем текущую страницу в состоянии пользователя
        set_user_page_state(callback.from_user.id, category_id, current_page)
        
        # Формируем описание с preview_link
        description = format_description_with_preview(category[4], category[7])
        
        # Проверяем, использует ли категория 3x6 сетку
        is_grid_3x6 = category[13] if len(category) > 13 else False
        
        if is_grid_3x6:
            # Используем 3x6 сетку с сохранением текущей страницы
            search_button_name = category[14] if len(category) > 14 else None
            back_button_text = category[15] if len(category) > 15 else None
            
            keyboard = await create_3x6_grid_keyboard(
                children, 
                page=current_page, 
                search_button_name=search_button_name,
                back_button_text=back_button_text,
                parent_id=category_id,
                is_admin=await db.is_admin(callback.from_user.id)
            )
        else:
            # Обычная клавиатура
            keyboard = await create_catalog_keyboard(children, is_admin=await is_user_admin(callback.from_user.id), parent_id=category_id, item_type='category')
        
        # Используем быструю замену сообщения с правильным порядком стикеров
        await replace_message_with_sticker_first(
            callback=callback,
            new_text=description if not category[6] else None,
            new_photo=category[6] if category[6] else None,
            new_caption=description if category[6] else None,
            new_keyboard=keyboard,
            sticker_id=category[5] if category[5] else None
        )
        
    except Exception as e:
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("view_subcategory_"))
async def view_subcategory_handler(callback: types.CallbackQuery):
    """Обработчик просмотра подкатегории"""
    try:
        subcategory_id = int(callback.data.split("_")[2])
        subcategory = await db.get_catalog_item(subcategory_id)
        
        if not subcategory:
            await callback.answer("Подкатегория не найдена")
            return
        
        # Получаем дочерние элементы (товары)
        children = await db.get_catalog_children(subcategory_id)
        
        # Получаем текущую страницу из callback_data если есть
        current_page = 0
        if len(callback.data.split("_")) > 3:
            try:
                current_page = int(callback.data.split("_")[3])
            except (ValueError, IndexError):
                current_page = 0
        
        # Сохраняем текущую страницу в состоянии пользователя
        set_user_page_state(callback.from_user.id, subcategory_id, current_page)
        
        # Формируем описание с preview_link
        description = format_description_with_preview(subcategory[4], subcategory[7])
        
        # Проверяем, использует ли родительская категория 3x6 сетку
        parent_category = await db.get_catalog_item(subcategory[1])  # parent_id
        is_parent_grid_3x6 = parent_category[13] if parent_category and len(parent_category) > 13 else False
        
        if is_parent_grid_3x6:
            # Если родительская категория использует 3x6, товары тоже используют 3x6
            # Используем название кнопки поиска из подкатегории (если есть) или дефолтное
            search_button_name = subcategory[14] if len(subcategory) > 14 and subcategory[14] else "Любой другой регион"
            
            keyboard = await create_3x6_grid_keyboard(
                children, 
                page=current_page, 
                search_button_name=search_button_name,
                back_button_text=None,
                parent_id=subcategory_id,
                is_admin=await db.is_admin(callback.from_user.id),
                search_at_bottom=True
            )
        else:
            # Обычная клавиатура
            keyboard = await create_catalog_keyboard(children, is_admin=await is_user_admin(callback.from_user.id), parent_id=subcategory_id, item_type='subcategory')
        
        # Используем быструю замену сообщения с правильным порядком стикеров
        await replace_message_with_sticker_first(
            callback=callback,
            new_text=description if not subcategory[6] else None,
            new_photo=subcategory[6] if subcategory[6] else None,
            new_caption=description if subcategory[6] else None,
            new_keyboard=keyboard,
            sticker_id=subcategory[5] if subcategory[5] else None
        )
        
    except Exception as e:
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("view_product_"), state="*")
async def view_product_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик просмотра товара"""
    try:
        # Завершаем любое активное состояние (например, ввод промокода)
        if state is not None:
            await state.finish()
        
        product_id = int(callback.data.split("_")[2])
        product = await db.get_catalog_item(product_id)
        
        if not product:
            await callback.answer("Товар не найден")
            return
        
        # Удаляем предыдущее сообщение и стикер с быстрой заменой
        # Для товаров используем замену для ускорения навигации
        
        # Получаем цену и дни действия товара
        price_info = await db.get_product_price_with_days(product_id)
        
        # Проверяем, есть ли активный промокод для этого товара у пользователя
        user_state = dp.current_state(user=callback.from_user.id)
        user_data = await user_state.get_data()
        
        # Получаем информацию о промокоде, если он есть
        promo_code = user_data.get('promo_code')
        discount_percent = user_data.get('discount_percent', 0)
        
        # Получаем количество файлов товара
        files_count = await db.get_product_files_count(product_id)
        
        # Формируем описание с скрытой preview ссылкой сверху
        formatted_description = format_description_with_preview(product[4], product[7])
        
        # Добавляем информацию о цене за штуку и доступном количестве
        if price_info:
            price_rub = price_info[0] / 100  # Конвертируем из копеек в рубли
            
            # Применяем скидку, если есть активный промокод
            if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
                discounted_price = price_rub * (100 - discount_percent) / 100
                # Показываем цену за штуку только если товаров больше 1
                if files_count > 1:
                    formatted_description += f"\n\n<b>Цена за шт</b>: <s>{price_rub:.0f}₽</s> {discounted_price:.0f}₽ (-{discount_percent}%)"
                else:
                    # Для товаров с количеством 1 шт. не показываем цену в описании
                    pass
            else:
                # Показываем цену за штуку только если товаров больше 1
                if files_count > 1:
                    formatted_description += f"\n\n<b>Цена за шт</b>: {price_rub:.0f}₽"
                else:
                    # Для товаров с количеством 1 шт. не показываем цену в описании
                    pass
        
        # Показываем доступное количество только если товаров больше 1
        if files_count > 1:
            formatted_description += f"\n<b>Доступно</b>: {files_count} шт"
        
        # Создаем клавиатуру с учетом количества файлов
        keyboard = InlineKeyboardMarkup()
        has_back_button = False  # Флаг для отслеживания наличия кнопки "Назад"
        
        # Добавляем кнопки покупки если есть цена
        if price_info:
            price_rub = price_info[0] / 100  # Конвертируем из копеек в рубли
            expiration_days = price_info[2] if len(price_info) > 2 else None  # Дни действия
            
            # Если товар имеет дни действия, показываем клавиатуру выбора дней
            if expiration_days and expiration_days.strip():
                from keyboards import expiration_days_selection_kb
                # Парсим первое значение как минимальное количество дней
                min_days = int(expiration_days.split(',')[0])
                
                # Получаем количество файлов для каждого периода дней
                available_days = [int(day.strip()) for day in expiration_days.split(',')]
                files_count_by_days = {}
                for day in available_days:
                    files_count_by_days[day] = await db.get_product_files_count_by_days(product_id, day)
                
                # Применяем скидку к цене, если есть активный промокод
                display_price = price_rub
                if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
                    display_price = price_rub * (100 - discount_percent) / 100
                
                keyboard = expiration_days_selection_kb(
                    product_id, expiration_days, min_days, display_price, files_count, 1, files_count_by_days,
                    user_id=callback.from_user.id, product_parent_id=product[1]
                )
                has_back_button = True  # Эта клавиатура уже содержит кнопку "Назад"
            else:
                # Обычные товары без дней действия
                # Применяем скидку к цене, если есть активный промокод
                display_price = price_rub
                if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
                    display_price = price_rub * (100 - discount_percent) / 100
                
                if files_count > 1:
                    from keyboards import product_purchase_kb
                    purchase_keyboard = product_purchase_kb(product_id, display_price, 1, files_count)
                    # Добавляем все кнопки из клавиатуры покупки
                    for row in purchase_keyboard.inline_keyboard:
                        keyboard.row(*row)
                else:
                    # Если файл только один или нет файлов, используем product_purchase_kb для добавления всех кнопок
                    from keyboards import product_purchase_kb
                    purchase_keyboard = product_purchase_kb(product_id, display_price, 1, 1)
                    # Добавляем все кнопки из клавиатуры покупки
                    for row in purchase_keyboard.inline_keyboard:
                        keyboard.row(*row)
        
        # Для админа добавляем действия редактирования/удаления
        try:
            if await is_user_admin(callback.from_user.id):
                from keyboards import admin_product_actions_kb
                admin_kb = admin_product_actions_kb(product_id)
                for row in admin_kb.inline_keyboard:
                    keyboard.row(*row)
        except Exception as e:
            print(f"Error adding admin buttons: {e}")
            # Still add admin buttons even if there's an error, but with fallback
            try:
                if await is_user_admin(callback.from_user.id):
                    keyboard.add(
                        InlineKeyboardButton("✏️ Изменить товар", callback_data=f"admin_edit_product_{product_id}"),
                        InlineKeyboardButton("🗑 Удалить товар", callback_data=f"admin_delete_product_{product_id}")
                    )
            except Exception as e2:
                print(f"Error adding fallback admin buttons: {e2}")

        # Добавляем кнопку "Назад" только если её ещё нет
        if not has_back_button:
            # Получаем информацию о родительской категории для правильного callback
            parent_category = await db.get_catalog_item(product[1])
            if parent_category:
                # Проверяем, использует ли родительская категория 3x6 сетку
                parent_is_grid_3x6 = parent_category[13] if len(parent_category) > 13 else False
                if parent_is_grid_3x6:
                    # Для 3x6 сетки определяем правильный callback в зависимости от типа родителя
                    parent_type = parent_category[2]  # type column
                    saved_page = get_user_page_state(callback.from_user.id, product[1])
                    if parent_type == 'category':
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}_{saved_page}")
                        )
                    elif parent_type == 'subcategory':
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{product[1]}_{saved_page}")
                        )
                    else:
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}_{saved_page}")
                        )
                else:
                    # Для обычных категорий определяем тип родительской категории
                    parent_type = parent_category[2]  # type column
                    if parent_type == 'theme':
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{product[1]}")
                        )
                    elif parent_type == 'category':
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}")
                        )
                    elif parent_type == 'subcategory':
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{product[1]}")
                        )
                    else:
                        keyboard.add(
                            InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product[1]}_0")
                        )
            else:
                # Если не удалось получить информацию о родительской категории, используем view_parent_
                keyboard.add(
                    InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product[1]}_0")
                )
        
        # Используем быструю замену сообщения для товаров с правильным порядком стикеров
        await replace_message_with_sticker_first(
            callback=callback,
            new_text=formatted_description if not product[6] else None,
            new_photo=product[6] if product[6] else None,
            new_caption=formatted_description if product[6] else None,
            new_keyboard=keyboard,
            sticker_id=product[5] if product[5] else None
        )
        
    except Exception as e:
        print(f"Error in view_product_handler: {e}")
        await callback.answer(f"Ошибка: {e}")
        
@dp.callback_query_handler(lambda c: c.data.startswith("promo_code_"))
async def promo_code_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик для ввода промокода"""
    try:
        parts = callback.data.split("_")
        product_id = int(parts[2])
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            await callback.answer("Товар не найден")
            return
        
        # Сохраняем информацию о текущем сообщении для возврата к товару
        await state.update_data(
            product_id=product_id, 
            original_message_id=callback.message.message_id,
            original_chat_id=callback.message.chat.id
        )
        
        # Редактируем текущее сообщение, чтобы показать запрос промокода
        await callback.message.edit_text(
            f"🎁 Промокод: {product[3]}\n\nПришлите в ответ промокод:",
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("🔙 Назад", callback_data=f"view_product_{product_id}")
            )
        )
        
        # Устанавливаем состояние ожидания промокода
        await PromoCodeStates.waiting_for_product_promo.set()
        
        # Отвечаем на callback, чтобы убрать часы загрузки
        await callback.answer()
        
    except Exception as e:
        print(f"Error in promo_code_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

# === Admin product edit/delete handlers ===
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_") and not any(x in c.data for x in ["name_", "desc_", "photo_", "price_", "preview_", "files_", "row_width_"]), state="*")
async def admin_edit_product_menu(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")

        product_id = int(callback.data.split("_")[-1])
        from keyboards import admin_edit_product_menu_kb
        kb = admin_edit_product_menu_kb(product_id)
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_menu error: {e}")
        await callback.answer("Ошибка")


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_name_"), state="*")
async def admin_edit_product_name_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее название товара
        product = await db.get_catalog_item(product_id)
        current_name = product[3] if product else "Неизвестно"
        
        await state.update_data(edit_product_id=product_id)
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📝 <b>Текущее название:</b> {current_name}\n\n📝 Введите новое название товара:",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
        )
        await AdminProductEditStates.waiting_for_name.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_name_start error: {e}")
        await callback.answer("Ошибка")


@dp.message_handler(state=AdminProductEditStates.waiting_for_name, content_types=types.ContentTypes.TEXT)
async def admin_edit_product_name_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        product_id = data.get('edit_product_id')
        if not product_id:
            await state.finish()
            return
        new_name = message.text.strip()
        if not new_name:
            await message.answer("❌ Название не может быть пустым")
            return
        await db.update_product_name(product_id, new_name)
        await message.answer("✅ Название обновлено")
        await state.finish()
        
        # Обновляем просмотр товара
        try:
            await recreate_product_view(message.chat.id, message.message_id, product_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating product view: {e}")
    except Exception as e:
        print(f"admin_edit_product_name_save error: {e}")
        await message.answer("❌ Ошибка при обновлении названия")
        await state.finish()


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_desc_"), state="*")
async def admin_edit_product_desc_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее описание товара
        product = await db.get_catalog_item(product_id)
        current_desc = product[4] if product and product[4] else "Описание отсутствует"
        
        await state.update_data(edit_product_id=product_id)
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📄 <b>Текущее описание:</b>\n{current_desc}\n\n📄 Пришлите новое описание товара:\n\n💡 <i>Поддерживается форматирование Telegram:</i>\n• <b>Жирный текст</b> - <code>&lt;b&gt;текст&lt;/b&gt;</code>\n• <i>Курсив</i> - <code>&lt;i&gt;текст&lt;/i&gt;</code>\n• <code>Моноширинный</code> - <code>&lt;code&gt;текст&lt;/code&gt;</code>\n• <u>Подчеркнутый</u> - <code>&lt;u&gt;текст&lt;/u&gt;</code>\n• <s>Зачеркнутый</s> - <code>&lt;s&gt;текст&lt;/s&gt;</code>\n• <a href='https://example.com'>Ссылка</a> - <code>&lt;a href='url'&gt;текст&lt;/a&gt;</code>",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
        )
        await AdminProductEditStates.waiting_for_description.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_desc_start error: {e}")
        await callback.answer("Ошибка")


@dp.message_handler(state=AdminProductEditStates.waiting_for_description, content_types=types.ContentTypes.TEXT)
async def admin_edit_product_desc_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        product_id = data.get('edit_product_id')
        if not product_id:
            await state.finish()
            return
        
        # Получаем новое описание с сохранением HTML форматирования
        new_desc = message.html_text  # Используем html_text вместо text для сохранения форматирования
        
        await db.update_product_description(product_id, new_desc)
        
        # Отправляем подтверждение с превью форматирования
        await message.answer(
            f"✅ Описание обновлено!\n\n🔍 <b>Превью:</b>\n{new_desc}",
            parse_mode='HTML'
        )
        await state.finish()
        
        # Обновляем просмотр товара
        try:
            await recreate_product_view(message.chat.id, message.message_id, product_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating product view: {e}")
    except Exception as e:
        print(f"admin_edit_product_desc_save error: {e}")
        await message.answer("❌ Ошибка при обновлении описания")
        await state.finish()


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_preview_"), state="*")
async def admin_edit_product_preview_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        
        # Получаем текущую превью-ссылку товара
        product = await db.get_catalog_item(product_id)
        current_preview = product[7] if product and product[7] and product[7] != 'None' else "Не установлена"
        
        await state.update_data(edit_product_id=product_id)
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"🔗 <b>Текущая превью-ссылка:</b>\n{current_preview}\n\n🔗 Пришлите новую превью-ссылку (URL):",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
        )
        await AdminProductEditStates.waiting_for_preview_link.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_preview_start error: {e}")
        await callback.answer("Ошибка")


@dp.message_handler(state=AdminProductEditStates.waiting_for_preview_link, content_types=types.ContentTypes.TEXT)
async def admin_edit_product_preview_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        product_id = data.get('edit_product_id')
        if not product_id:
            await state.finish()
            return
        new_link = message.text.strip()
        await db.update_product_preview_link(product_id, new_link)
        await message.answer("✅ Превью‑ссылка обновлена")
        await state.finish()
        
        # Обновляем просмотр товара
        try:
            await recreate_product_view(message.chat.id, message.message_id, product_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating product view: {e}")
    except Exception as e:
        print(f"admin_edit_product_preview_save error: {e}")
        await message.answer("❌ Ошибка при обновлении превью‑ссылки")
        await state.finish()


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_price_"), state="*")
async def admin_edit_product_price_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        
        # Получаем текущую цену товара
        price_info = await db.get_product_price(product_id)
        current_price = "Не установлена"
        if price_info and price_info[0]:
            current_price = f"{price_info[0] // 100}₽"
        
        await state.update_data(edit_product_id=product_id)
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"💰 <b>Текущая цена:</b> {current_price}\n\n💰 Пришлите новую цену в рублях (целое число):",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
        )
        await AdminProductEditStates.waiting_for_price.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_price_start error: {e}")
        await callback.answer("Ошибка")


@dp.message_handler(state=AdminProductEditStates.waiting_for_price, content_types=types.ContentTypes.TEXT)
async def admin_edit_product_price_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        product_id = data.get('edit_product_id')
        if not product_id:
            await state.finish()
            return
        try:
            rub = int(message.text.strip())
            if rub <= 0:
                await message.answer("❌ Цена должна быть больше 0")
                return
            price_cents = rub * 100
            await db.set_product_price(product_id, price_cents, 'RUB')
            await message.answer("✅ Цена обновлена")
        except ValueError:
            await message.answer("❌ Некорректная цена. Пришлите целое число, например 299")
            return
        await state.finish()
        
        # Обновляем просмотр товара
        try:
            await recreate_product_view(message.chat.id, message.message_id, product_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating product view: {e}")
    except Exception as e:
        print(f"admin_edit_product_price_save error: {e}")
        await message.answer("❌ Ошибка при обновлении цены")
        await state.finish()


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_photo_"), state="*")
async def admin_edit_product_photo_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        
        # Получаем информацию о текущем фото товара
        product = await db.get_catalog_item(product_id)
        current_photo_status = "Нет фото"
        if product and product[6]:  # photo_id
            current_photo_status = "Есть фото"
        
        await state.update_data(edit_product_id=product_id)
        message_text = f"🖼 <b>Текущее состояние:</b> {current_photo_status}\n\n🖼 Пришлите новое фото товара (как фото):"
        
        # Отправляем текущее фото если оно есть
        if product and product[6]:
            try:
                await bot.send_photo(
                    chat_id=callback.message.chat.id,
                    photo=product[6],
                    caption=message_text,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
                )
            except Exception as e:
                print(f"Error sending current photo: {e}")
                await bot.send_message(
                    chat_id=callback.message.chat.id,
                    text=message_text,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
                )
        else:
            await bot.send_message(
                chat_id=callback.message.chat.id,
                text=message_text,
                parse_mode='HTML',
                reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
            )
        
        await AdminProductEditStates.waiting_for_photo.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_photo_start error: {e}")
        await callback.answer("Ошибка")


@dp.message_handler(state=AdminProductEditStates.waiting_for_photo, content_types=types.ContentTypes.PHOTO)
async def admin_edit_product_photo_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        product_id = data.get('edit_product_id')
        if not product_id:
            await state.finish()
            return
        try:
            file_id = message.photo[-1].file_id
            await db.update_product_photo_id(product_id, file_id)
            await message.answer("✅ Фото обновлено")
        except Exception as e:
            print(f"Error updating photo: {e}")
            await message.answer("❌ Ошибка при обновлении фото")
            return
        await state.finish()
        
        # Обновляем просмотр товара
        try:
            await recreate_product_view(message.chat.id, message.message_id, product_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating product view: {e}")
    except Exception as e:
        print(f"admin_edit_product_photo_save error: {e}")
        await message.answer("❌ Ошибка при обновлении фото")
        await state.finish()


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_files_"), state="*")
async def admin_edit_product_files(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        files = await db.get_product_files(product_id)
        from keyboards import admin_product_files_kb
        kb = admin_product_files_kb(product_id, files)
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Список файлов уже открыт")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_product_files error: {e}")
        await callback.answer("Ошибка")


@dp.callback_query_handler(lambda c: c.data.startswith("admin_add_product_file_"), state="*")
async def admin_add_product_file_start(callback: types.CallbackQuery, state: FSMContext):
    if not await is_user_admin(callback.from_user.id):
        return await callback.answer("Недостаточно прав")
    product_id = int(callback.data.split("_")[-1])
    await state.update_data(edit_product_id=product_id)
    await bot.send_message(
        chat_id=callback.message.chat.id,
        text="📁 Пришлите файлы (документы или фото).\n\n"
             "🚀 **Можно отправлять много файлов подряд!**\n"
             "📄 Каждый файл будет обработан отдельно\n\n"
             "🏷️ Можно указать подпись вида: 'Название файла | 30', где 30 — дни.",
        reply_markup=InlineKeyboardMarkup().add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_files_{product_id}"))
    )
    await AdminProductEditStates.waiting_for_file.set()
    await callback.answer()


@dp.message_handler(state=AdminProductEditStates.waiting_for_file, content_types=[types.ContentType.DOCUMENT, types.ContentType.PHOTO])
async def admin_add_product_file_save(message: types.Message, state: FSMContext):
    """Обработка файлов для админа с поддержкой батчинга"""
    data = await state.get_data()
    product_id = data.get('edit_product_id')
    user_id = message.from_user.id
    
    if not product_id:
        return await state.finish()
    
    # Инициализируем батч файлов для этого пользователя
    if 'admin_file_batch' not in data:
        await state.update_data(admin_file_batch=[])
        data = await state.get_data()
    
    files_added = 0
    
    # Обрабатываем документы
    if message.document:
        file_id = message.document.file_id
        file_type = 'document'
        file_name = message.document.file_name
        day_period = None
        
        # Разбор подписи для имени и дней
        if message.caption:
            parts = message.caption.split('|')
            if len(parts) == 2:
                file_name = parts[0].strip() or file_name
                try:
                    day_period = int(parts[1].strip())
                except Exception:
                    day_period = None
            else:
                file_name = message.caption.strip() or file_name
        
        data['admin_file_batch'].append({
            'file_id': file_id,
            'file_type': file_type,
            'file_name': file_name,
            'day_period': day_period
        })
        files_added += 1
    
    # Обрабатываем фото
    elif message.photo:
        file_id = message.photo[-1].file_id
        file_type = 'photo'
        file_name = None
        day_period = None
        
        # Разбор подписи для имени и дней
        if message.caption:
            parts = message.caption.split('|')
            if len(parts) == 2:
                file_name = parts[0].strip() or None
                try:
                    day_period = int(parts[1].strip())
                except Exception:
                    day_period = None
            else:
                file_name = message.caption.strip()
        
        if not file_name:
            file_name = f"photo_{len(data['admin_file_batch']) + 1}.jpg"
        
        data['admin_file_batch'].append({
            'file_id': file_id,
            'file_type': file_type,
            'file_name': file_name,
            'day_period': day_period
        })
        files_added += 1
    
    # Сохраняем обновленный батч
    await state.update_data(admin_file_batch=data['admin_file_batch'])
    
    # Если ни фото, ни документов не найдено
    if files_added == 0:
        await message.answer("❌ Не удалось получить файл. Пришлите документ или фото.")
        return
    
    # Отменяем предыдущий таймер, если он есть
    if user_id in admin_file_batch_timers:
        admin_file_batch_timers[user_id].cancel()
    
    # Создаем новый таймер для отправки батча через 2 секунды
    async def send_admin_batch_response():
        try:
            # Ждем таймер
            await asyncio.sleep(2)
            
            # Получаем текущие данные
            current_data = await state.get_data()
            batch_files = current_data.get('admin_file_batch', [])
            
            if not batch_files:
                return
            
            # Сохраняем все файлы в базу данных
            files_saved = 0
            for file_info in batch_files:
                try:
                    await db.add_product_file(
                        product_id, 
                        file_info['file_id'], 
                        file_info['file_type'], 
                        file_name=file_info['file_name'], 
                        day_period=file_info['day_period']
                    )
                    files_saved += 1
                except Exception as e:
                    print(f"Error saving file: {e}")
            
            # Отправляем ответ пользователю о каждом обработанном файле
            if files_saved > 0:
                if files_saved == 1:
                    await message.answer(f"✅ Обработан и добавлен {files_saved} файл")
                elif files_saved < 5:
                    await message.answer(f"✅ Обработано и добавлено {files_saved} файла")
                else:
                    await message.answer(f"✅ Обработано и добавлено {files_saved} файлов")
            
            # Очищаем батч и завершаем состояние
            await state.update_data(admin_file_batch=[])
            await state.finish()
            
            # Удаляем таймер
            if user_id in admin_file_batch_timers:
                del admin_file_batch_timers[user_id]
            
            # Обновляем просмотр товара
            try:
                await recreate_product_view(message.chat.id, message.message_id, product_id, user_id=message.from_user.id)
            except Exception as e:
                print(f"Error recreating product view: {e}")
                # Если не удалось обновить товар, показываем список файлов
                try:
                    files = await db.get_product_files(product_id)
                    from keyboards import admin_product_files_kb
                    kb = admin_product_files_kb(product_id, files)
                    await bot.send_message(message.chat.id, "📁 Файлы товара:", reply_markup=kb)
                except Exception:
                    pass
        
        except Exception as e:
            print(f"Error in admin batch processing: {e}")
    
    # Запускаем таймер
    admin_file_batch_timers[user_id] = asyncio.create_task(send_admin_batch_response())


@dp.callback_query_handler(lambda c: c.data.startswith("admin_delete_product_file_"), state="*")
async def admin_delete_product_file(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        parts = callback.data.split("_")
        # admin_delete_product_file_{file_db_id}_{product_id}
        try:
            file_db_id = int(parts[-2])
            product_id = int(parts[-1])
        except Exception:
            return await callback.answer("Некорректные данные")
        await db.delete_product_file(file_db_id)
        await callback.answer("🗑 Файл удален")
        
        # Обновляем просмотр товара
        try:
            await recreate_product_view(callback.message.chat.id, callback.message.message_id, product_id, user_id=callback.from_user.id)
        except Exception as e:
            print(f"Error recreating product view: {e}")
            # Если не удалось обновить товар, показываем список файлов
            files = await db.get_product_files(product_id)
            from keyboards import admin_product_files_kb
            kb = admin_product_files_kb(product_id, files)
            await callback.message.edit_reply_markup(reply_markup=kb)
    except Exception as e:
        print(f"admin_delete_product_file error: {e}")
        await callback.answer("Ошибка")


@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_product_row_width_"), state="*")
async def admin_edit_product_row_width_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        product = await db.get_catalog_item(product_id)
        current_width = product[7] if product and len(product) > 7 else 1  # row_width column
        
        from keyboards import admin_edit_row_width_kb
        kb = admin_edit_row_width_kb(product_id, current_width)
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню выравнивания уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer(f"Текущее выравнивание: {current_width} кнопка в ряду")
    except Exception as e:
        print(f"admin_edit_product_row_width_start error: {e}")
        await callback.answer("Ошибка")


@dp.callback_query_handler(lambda c: c.data.startswith("admin_set_row_width_"), state="*")
async def admin_set_product_row_width(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        parts = callback.data.split("_")
        product_id = int(parts[-2])
        row_width = int(parts[-1])
        await db.update_product_row_width(product_id, row_width)
        await callback.answer(f"✅ Выравнивание изменено на {row_width} кнопки в ряду")
        try:
            await recreate_product_view(callback.message.chat.id, callback.message.message_id, product_id, user_id=callback.from_user.id)
        except Exception:
            pass
    except Exception as e:
        print(f"admin_set_product_row_width error: {e}")
        await callback.answer("Ошибка")
@dp.callback_query_handler(lambda c: c.data.startswith("admin_delete_product_"), state="*")
async def admin_delete_product(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        product_id = int(callback.data.split("_")[-1])
        product = await db.get_catalog_item(product_id)
        parent_id = product[1] if product else None
        ok = await db.delete_product(product_id)
        if ok:
            kb = InlineKeyboardMarkup()
            if parent_id:
                parent = await db.get_catalog_item(parent_id)
                if parent:
                    parent_type = parent[2]
                    if parent_type == 'theme':
                        kb.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{parent_id}"))
                    elif parent_type == 'category':
                        kb.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{parent_id}"))
                    else:
                        kb.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{parent_id}"))
            await callback.message.edit_text("🗑 Товар удален", reply_markup=kb)
            await callback.answer()
        else:
            await callback.answer("❌ Не удалось удалить товар")
    except Exception as e:
        print(f"admin_delete_product error: {e}")
        await callback.answer("Ошибка")

# === Обработчики удаления элементов каталога ===

@dp.callback_query_handler(lambda c: c.data.startswith("admin_delete_theme_"), state="*")
async def admin_delete_theme(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        theme_id = int(callback.data.split("_")[-1])
        theme = await db.get_catalog_item(theme_id)
        
        # Проверяем, есть ли дочерние элементы
        children = await db.get_catalog_children(theme_id)
        if children:
            await callback.answer("❌ Нельзя удалить тему с дочерними элементами")
            return
            
        ok = await db.delete_catalog_item(theme_id)
        if ok:
            kb = InlineKeyboardMarkup()
            kb.add(InlineKeyboardButton("🔙 К каталогу", callback_data="back_to_catalog"))
            await callback.message.edit_text("🗑 Тема удалена", reply_markup=kb)
            await callback.answer()
        else:
            await callback.answer("❌ Не удалось удалить тему")
    except Exception as e:
        print(f"admin_delete_theme error: {e}")
        await callback.answer("Ошибка")

@dp.callback_query_handler(lambda c: c.data.startswith("admin_delete_category_"), state="*")
async def admin_delete_category(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        category_id = int(callback.data.split("_")[-1])
        category = await db.get_catalog_item(category_id)
        parent_id = category[1] if category else None
        
        # Проверяем, есть ли дочерние элементы
        children = await db.get_catalog_children(category_id)
        if children:
            await callback.answer("❌ Нельзя удалить категорию с дочерними элементами")
            return
            
        ok = await db.delete_catalog_item(category_id)
        if ok:
            kb = InlineKeyboardMarkup()
            if parent_id:
                kb.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{parent_id}"))
            else:
                kb.add(InlineKeyboardButton("🔙 К каталогу", callback_data="back_to_catalog"))
            await callback.message.edit_text("🗑 Категория удалена", reply_markup=kb)
            await callback.answer()
        else:
            await callback.answer("❌ Не удалось удалить категорию")
    except Exception as e:
        print(f"admin_delete_category error: {e}")
        await callback.answer("Ошибка")

@dp.callback_query_handler(lambda c: c.data.startswith("admin_delete_subcategory_"), state="*")
async def admin_delete_subcategory(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        subcategory_id = int(callback.data.split("_")[-1])
        subcategory = await db.get_catalog_item(subcategory_id)
        parent_id = subcategory[1] if subcategory else None
        
        # Проверяем, есть ли дочерние элементы
        children = await db.get_catalog_children(subcategory_id)
        if children:
            await callback.answer("❌ Нельзя удалить подкатегорию с дочерними элементами")
            return
            
        ok = await db.delete_catalog_item(subcategory_id)
        if ok:
            kb = InlineKeyboardMarkup()
            if parent_id:
                parent = await db.get_catalog_item(parent_id)
                if parent:
                    parent_type = parent[2]
                    if parent_type == 'theme':
                        kb.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{parent_id}"))
                    else:
                        kb.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{parent_id}"))
            else:
                kb.add(InlineKeyboardButton("🔙 К каталогу", callback_data="back_to_catalog"))
            await callback.message.edit_text("🗑 Подкатегория удалена", reply_markup=kb)
            await callback.answer()
        else:
            await callback.answer("❌ Не удалось удалить подкатегорию")
    except Exception as e:
        print(f"admin_delete_subcategory error: {e}")
        await callback.answer("Ошибка")

# === Обработчики пропуска редактирования ===

@dp.callback_query_handler(lambda c: c.data.startswith("skip_edit_category_name_"), state="*")
async def skip_edit_category_name(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск редактирования названия категории"""
    await callback.answer("✅ Редактирование названия пропущено")
    category_id = int(callback.data.split("_")[-1])
    from keyboards import admin_edit_category_menu_kb
    kb = admin_edit_category_menu_kb(category_id)
    await callback.message.edit_text("📝 Меню редактирования категории:", reply_markup=kb)
    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("skip_edit_theme_name_"), state="*")
async def skip_edit_theme_name(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск редактирования названия темы"""
    await callback.answer("✅ Редактирование названия пропущено")
    theme_id = int(callback.data.split("_")[-1])
    from keyboards import admin_edit_theme_menu_kb
    kb = admin_edit_theme_menu_kb(theme_id)
    await callback.message.edit_text("📝 Меню редактирования темы:", reply_markup=kb)
    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("skip_edit_subcategory_name_"), state="*")
async def skip_edit_subcategory_name(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск редактирования названия подкатегории"""
    await callback.answer("✅ Редактирование названия пропущено")
    subcategory_id = int(callback.data.split("_")[-1])
    from keyboards import admin_edit_subcategory_menu_kb
    kb = admin_edit_subcategory_menu_kb(subcategory_id)
    await callback.message.edit_text("📝 Меню редактирования подкатегории:", reply_markup=kb)
    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("skip_edit_category_desc_"), state="*")
async def skip_edit_category_desc(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск редактирования описания категории"""
    await callback.answer("✅ Редактирование описания пропущено")
    category_id = int(callback.data.split("_")[-1])
    from keyboards import admin_edit_category_menu_kb
    kb = admin_edit_category_menu_kb(category_id)
    await callback.message.edit_text("📝 Меню редактирования категории:", reply_markup=kb)
    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("skip_edit_theme_desc_"), state="*")
async def skip_edit_theme_desc(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск редактирования описания темы"""
    await callback.answer("✅ Редактирование описания пропущено")
    theme_id = int(callback.data.split("_")[-1])
    from keyboards import admin_edit_theme_menu_kb
    kb = admin_edit_theme_menu_kb(theme_id)
    await callback.message.edit_text("📝 Меню редактирования темы:", reply_markup=kb)
    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("skip_edit_subcategory_desc_"), state="*")
async def skip_edit_subcategory_desc(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск редактирования описания подкатегории"""
    await callback.answer("✅ Редактирование описания пропущено")
    subcategory_id = int(callback.data.split("_")[-1])
    from keyboards import admin_edit_subcategory_menu_kb
    kb = admin_edit_subcategory_menu_kb(subcategory_id)
    await callback.message.edit_text("📝 Меню редактирования подкатегории:", reply_markup=kb)
    await state.finish()

# === Обработчики редактирования категорий и тем ===

# Меню редактирования категорий
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_category_") and not any(x in c.data for x in ["name_", "desc_", "photo_", "sticker_", "preview_", "row_width_"]), state="*")
async def admin_edit_category_menu(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")

        category_id = int(callback.data.split("_")[-1])
        from keyboards import admin_edit_category_menu_kb
        kb = admin_edit_category_menu_kb(category_id)
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_category_menu error: {e}")
        await callback.answer("Ошибка")

# Меню редактирования тем
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_theme_") and not any(x in c.data for x in ["name_", "desc_", "photo_", "sticker_", "preview_", "row_width_"]), state="*")
async def admin_edit_theme_menu(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")

        theme_id = int(callback.data.split("_")[-1])
        from keyboards import admin_edit_theme_menu_kb
        kb = admin_edit_theme_menu_kb(theme_id)
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_theme_menu error: {e}")
        await callback.answer("Ошибка")

# Меню редактирования подкатегорий
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_subcategory_") and not any(x in c.data for x in ["name_", "desc_", "photo_", "sticker_", "preview_", "row_width_"]), state="*")
async def admin_edit_subcategory_menu(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")

        subcategory_id = int(callback.data.split("_")[-1])
        from keyboards import admin_edit_subcategory_menu_kb
        kb = admin_edit_subcategory_menu_kb(subcategory_id)
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_subcategory_menu error: {e}")
        await callback.answer("Ошибка")

# === Обработчики редактирования названий ===

# Название категории
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_category_name_"), state="*")
async def admin_edit_category_name_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        category_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее название категории
        category = await db.get_catalog_item(category_id)
        current_name = category[3] if category else "Неизвестно"
        
        await state.update_data(edit_item_id=category_id, edit_item_type='category')
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📝 <b>Текущее название:</b> {current_name}\n\n📝 Введите новое название категории:",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("⏭ Пропустить", callback_data=f"skip_edit_category_name_{category_id}"),
                InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_category_{category_id}")
            )
        )
        await AdminCatalogEditStates.waiting_for_name.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_category_name_start error: {e}")
        await callback.answer("Ошибка")

# Название темы
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_theme_name_"), state="*")
async def admin_edit_theme_name_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        theme_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее название темы
        theme = await db.get_catalog_item(theme_id)
        current_name = theme[3] if theme else "Неизвестно"
        
        await state.update_data(edit_item_id=theme_id, edit_item_type='theme')
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📝 <b>Текущее название:</b> {current_name}\n\n📝 Введите новое название темы:",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("⏭ Пропустить", callback_data=f"skip_edit_theme_name_{theme_id}"),
                InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_theme_{theme_id}")
            )
        )
        await AdminCatalogEditStates.waiting_for_name.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_theme_name_start error: {e}")
        await callback.answer("Ошибка")

# Название подкатегории
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_subcategory_name_"), state="*")
async def admin_edit_subcategory_name_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        subcategory_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее название подкатегории
        subcategory = await db.get_catalog_item(subcategory_id)
        current_name = subcategory[3] if subcategory else "Неизвестно"
        
        await state.update_data(edit_item_id=subcategory_id, edit_item_type='subcategory')
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📝 <b>Текущее название:</b> {current_name}\n\n📝 Введите новое название подкатегории:",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("⏭ Пропустить", callback_data=f"skip_edit_subcategory_name_{subcategory_id}"),
                InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_subcategory_{subcategory_id}")
            )
        )
        await AdminCatalogEditStates.waiting_for_name.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_subcategory_name_start error: {e}")
        await callback.answer("Ошибка")

# Обработчик сохранения названия
@dp.message_handler(state=AdminCatalogEditStates.waiting_for_name, content_types=types.ContentTypes.TEXT)
async def admin_edit_catalog_name_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        item_id = data.get('edit_item_id')
        item_type = data.get('edit_item_type')
        if not item_id or not item_type:
            await state.finish()
            return
        
        new_name = message.text.strip()
        if not new_name:
            await message.answer("❌ Название не может быть пустым")
            return
        
        await db.update_catalog_item_name(item_id, new_name)
        await message.answer("✅ Название обновлено")
        await state.finish()
        
        # Обновляем просмотр элемента
        try:
            if item_type == 'category':
                await recreate_category_view(message.chat.id, message.message_id, item_id, user_id=message.from_user.id)
            elif item_type == 'theme':
                await recreate_theme_view(message.chat.id, message.message_id, item_id, user_id=message.from_user.id)
            elif item_type == 'subcategory':
                await recreate_subcategory_view(message.chat.id, message.message_id, item_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating view: {e}")
    except Exception as e:
        print(f"admin_edit_catalog_name_save error: {e}")
        await message.answer("❌ Ошибка при обновлении названия")
        await state.finish()

# === Обработчики редактирования описаний ===

# Описание категории
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_category_desc_"), state="*")
async def admin_edit_category_desc_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        category_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее описание категории
        category = await db.get_catalog_item(category_id)
        current_desc = category[4] if category and category[4] else "Описание отсутствует"
        
        await state.update_data(edit_item_id=category_id, edit_item_type='category')
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📄 <b>Текущее описание:</b>\n{current_desc}\n\n📄 Пришлите новое описание категории:\n\n💡 <i>Поддерживается форматирование Telegram:</i>\n• <b>Жирный текст</b> - <code>&lt;b&gt;текст&lt;/b&gt;</code>\n• <i>Курсив</i> - <code>&lt;i&gt;текст&lt;/i&gt;</code>\n• <code>Моноширинный</code> - <code>&lt;code&gt;текст&lt;/code&gt;</code>\n• <u>Подчеркнутый</u> - <code>&lt;u&gt;текст&lt;/u&gt;</code>\n• <s>Зачеркнутый</s> - <code>&lt;s&gt;текст&lt;/s&gt;</code>\n• <a href='https://example.com'>Ссылка</a> - <code>&lt;a href='url'&gt;текст&lt;/a&gt;</code>",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("⏭ Пропустить", callback_data=f"skip_edit_category_desc_{category_id}"),
                InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_category_{category_id}")
            )
        )
        await AdminCatalogEditStates.waiting_for_description.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_category_desc_start error: {e}")
        await callback.answer("Ошибка")

# Описание темы
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_theme_desc_"), state="*")
async def admin_edit_theme_desc_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        theme_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее описание темы
        theme = await db.get_catalog_item(theme_id)
        current_desc = theme[4] if theme and theme[4] else "Описание отсутствует"
        
        await state.update_data(edit_item_id=theme_id, edit_item_type='theme')
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📄 <b>Текущее описание:</b>\n{current_desc}\n\n📄 Пришлите новое описание темы:\n\n💡 <i>Поддерживается форматирование Telegram:</i>\n• <b>Жирный текст</b> - <code>&lt;b&gt;текст&lt;/b&gt;</code>\n• <i>Курсив</i> - <code>&lt;i&gt;текст&lt;/i&gt;</code>\n• <code>Моноширинный</code> - <code>&lt;code&gt;текст&lt;/code&gt;</code>\n• <u>Подчеркнутый</u> - <code>&lt;u&gt;текст&lt;/u&gt;</code>\n• <s>Зачеркнутый</s> - <code>&lt;s&gt;текст&lt;/s&gt;</code>\n• <a href='https://example.com'>Ссылка</a> - <code>&lt;a href='url'&gt;текст&lt;/a&gt;</code>",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("⏭ Пропустить", callback_data=f"skip_edit_theme_desc_{theme_id}"),
                InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_theme_{theme_id}")
            )
        )
        await AdminCatalogEditStates.waiting_for_description.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_theme_desc_start error: {e}")
        await callback.answer("Ошибка")

# Описание подкатегории
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_subcategory_desc_"), state="*")
async def admin_edit_subcategory_desc_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        subcategory_id = int(callback.data.split("_")[-1])
        
        # Получаем текущее описание подкатегории
        subcategory = await db.get_catalog_item(subcategory_id)
        current_desc = subcategory[4] if subcategory and subcategory[4] else "Описание отсутствует"
        
        await state.update_data(edit_item_id=subcategory_id, edit_item_type='subcategory')
        await bot.send_message(
            chat_id=callback.message.chat.id,
            text=f"📄 <b>Текущее описание:</b>\n{current_desc}\n\n📄 Пришлите новое описание подкатегории:\n\n💡 <i>Поддерживается форматирование Telegram:</i>\n• <b>Жирный текст</b> - <code>&lt;b&gt;текст&lt;/b&gt;</code>\n• <i>Курсив</i> - <code>&lt;i&gt;текст&lt;/i&gt;</code>\n• <code>Моноширинный</code> - <code>&lt;code&gt;текст&lt;/code&gt;</code>\n• <u>Подчеркнутый</u> - <code>&lt;u&gt;текст&lt;/u&gt;</code>\n• <s>Зачеркнутый</s> - <code>&lt;s&gt;текст&lt;/s&gt;</code>\n• <a href='https://example.com'>Ссылка</a> - <code>&lt;a href='url'&gt;текст&lt;/a&gt;</code>",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("⏭ Пропустить", callback_data=f"skip_edit_subcategory_desc_{subcategory_id}"),
                InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_subcategory_{subcategory_id}")
            )
        )
        await AdminCatalogEditStates.waiting_for_description.set()
        await callback.answer()
    except Exception as e:
        print(f"admin_edit_subcategory_desc_start error: {e}")
        await callback.answer("Ошибка")

# Обработчик сохранения описания
@dp.message_handler(state=AdminCatalogEditStates.waiting_for_description, content_types=types.ContentTypes.TEXT)
async def admin_edit_catalog_desc_save(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        item_id = data.get('edit_item_id')
        item_type = data.get('edit_item_type')
        if not item_id or not item_type:
            await state.finish()
            return
        
        # Получаем новое описание с сохранением HTML форматирования
        new_desc = message.html_text  # Используем html_text вместо text для сохранения форматирования
        
        await db.update_catalog_item_description(item_id, new_desc)
        
        # Отправляем подтверждение с превью форматирования
        await message.answer(
            f"✅ Описание обновлено!\n\n🔍 <b>Превью:</b>\n{new_desc}",
            parse_mode='HTML'
        )
        await state.finish()
        
        # Обновляем просмотр элемента
        try:
            if item_type == 'category':
                await recreate_category_view(message.chat.id, message.message_id, item_id, user_id=message.from_user.id)
            elif item_type == 'theme':
                await recreate_theme_view(message.chat.id, message.message_id, item_id, user_id=message.from_user.id)
            elif item_type == 'subcategory':
                await recreate_subcategory_view(message.chat.id, message.message_id, item_id, user_id=message.from_user.id)
        except Exception as e:
            print(f"Error recreating view: {e}")
    except Exception as e:
        print(f"admin_edit_catalog_desc_save error: {e}")
        await message.answer("❌ Ошибка при обновлении описания")
        await state.finish()

# === Обработчики редактирования выравнивания ===

# Выравнивание категории
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_category_row_width_"), state="*")
async def admin_edit_category_row_width_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        category_id = int(callback.data.split("_")[-1])
        category = await db.get_catalog_item(category_id)
        current_width = category[8] if category and len(category) > 8 else 1  # row_width column
        
        from keyboards import admin_edit_catalog_item_row_width_kb
        kb = admin_edit_catalog_item_row_width_kb(category_id, current_width, 'category')
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню выравнивания уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer(f"Текущее выравнивание: {current_width} кнопка в ряду")
    except Exception as e:
        print(f"admin_edit_category_row_width_start error: {e}")
        await callback.answer("Ошибка")

# Выравнивание темы
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_theme_row_width_"), state="*")
async def admin_edit_theme_row_width_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        theme_id = int(callback.data.split("_")[-1])
        theme = await db.get_catalog_item(theme_id)
        current_width = theme[8] if theme and len(theme) > 8 else 1  # row_width column
        
        from keyboards import admin_edit_catalog_item_row_width_kb
        kb = admin_edit_catalog_item_row_width_kb(theme_id, current_width, 'theme')
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню выравнивания уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer(f"Текущее выравнивание: {current_width} кнопка в ряду")
    except Exception as e:
        print(f"admin_edit_theme_row_width_start error: {e}")
        await callback.answer("Ошибка")

# Выравнивание подкатегории
@dp.callback_query_handler(lambda c: c.data.startswith("admin_edit_subcategory_row_width_"), state="*")
async def admin_edit_subcategory_row_width_start(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        subcategory_id = int(callback.data.split("_")[-1])
        subcategory = await db.get_catalog_item(subcategory_id)
        current_width = subcategory[8] if subcategory and len(subcategory) > 8 else 1  # row_width column
        
        from keyboards import admin_edit_catalog_item_row_width_kb
        kb = admin_edit_catalog_item_row_width_kb(subcategory_id, current_width, 'subcategory')
        
        # Проверяем, изменилась ли клавиатура
        current_keyboard = callback.message.reply_markup
        if current_keyboard and str(current_keyboard) == str(kb):
            await callback.answer("Меню выравнивания уже открыто")
            return
            
        await callback.message.edit_reply_markup(reply_markup=kb)
        await callback.answer(f"Текущее выравнивание: {current_width} кнопка в ряду")
    except Exception as e:
        print(f"admin_edit_subcategory_row_width_start error: {e}")
        await callback.answer("Ошибка")

# Обработчик сохранения выравнивания для элементов каталога
@dp.callback_query_handler(lambda c: c.data.startswith("admin_set_catalog_row_width_"), state="*")
async def admin_set_catalog_row_width(callback: types.CallbackQuery, state: FSMContext):
    try:
        if not await is_user_admin(callback.from_user.id):
            return await callback.answer("Недостаточно прав")
        parts = callback.data.split("_")
        # admin_set_catalog_row_width_{item_id}_{item_type}_{row_width}
        item_id = int(parts[4])
        item_type = parts[5]
        row_width = int(parts[6])
        
        await db.update_catalog_item_row_width(item_id, row_width)
        await callback.answer(f"✅ Выравнивание изменено на {row_width} кнопки в ряду")
        
        try:
            # Обновляем просмотр элемента
            if item_type == 'category':
                await recreate_category_view(callback.message.chat.id, callback.message.message_id, item_id, user_id=callback.from_user.id)
            elif item_type == 'theme':
                await recreate_theme_view(callback.message.chat.id, callback.message.message_id, item_id, user_id=callback.from_user.id)
            elif item_type == 'subcategory':
                await recreate_subcategory_view(callback.message.chat.id, callback.message.message_id, item_id, user_id=callback.from_user.id)
        except Exception:
            pass  # Игнорируем ошибки обновления просмотра
    except Exception as e:
        print(f"admin_set_catalog_row_width error: {e}")
        await callback.answer("Ошибка")

async def recreate_category_view(chat_id, message_id, category_id, user_id=None):
    """Обновляет просмотр категории"""
    try:
        # Получаем обновленные данные категории
        category = await db.get_catalog_item(category_id)
        if not category:
            return
        
        # Получаем дочерние элементы
        children = await db.get_catalog_children(category_id)
        
        # Формируем описание с preview_link
        description = format_description_with_preview(category[4], category[7])
        
        # Создаём клавиатуру
        from keyboards import create_catalog_keyboard
        keyboard = await create_catalog_keyboard(children, is_admin=await is_user_admin(user_id) if user_id else False, parent_id=category_id, item_type='category')
        
        # Отправляем обновленное сообщение
        if category[6]:  # photo_id
            await bot.send_photo(
                chat_id=chat_id,
                photo=category[6],
                caption=description,
                parse_mode="HTML",
                reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=chat_id,
                text=description,
                parse_mode="HTML",
                reply_markup=keyboard
            )
    except Exception as e:
        print(f"Error recreating category view: {e}")

async def recreate_theme_view(chat_id, message_id, theme_id, user_id=None):
    """Обновляет просмотр темы"""
    try:
        # Получаем обновленные данные темы
        theme = await db.get_catalog_item(theme_id)
        if not theme:
            return
        
        # Получаем дочерние элементы (категории)
        children = await db.get_catalog_children(theme_id)
        
        # Формируем описание с preview_link
        description = format_description_with_preview(theme[4], theme[7])
        
        # Создаём клавиатуру
        from keyboards import create_catalog_keyboard
        keyboard = await create_catalog_keyboard(children, is_admin=await is_user_admin(user_id) if user_id else False, parent_id=theme_id, item_type='theme')
        
        # Отправляем стикер если есть
        if theme[5]:  # sticker_id
            await bot.send_sticker(chat_id, theme[5])
        
        # Отправляем обновленное сообщение
        if theme[6]:  # photo_id
            await bot.send_photo(
                chat_id=chat_id,
                photo=theme[6],
                caption=description,
                parse_mode="HTML",
                reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=chat_id,
                text=description,
                parse_mode="HTML",
                reply_markup=keyboard
            )
    except Exception as e:
        print(f"Error recreating theme view: {e}")

async def recreate_subcategory_view(chat_id, message_id, subcategory_id, user_id=None):
    """Обновляет просмотр подкатегории"""
    try:
        # Получаем обновленные данные подкатегории
        subcategory = await db.get_catalog_item(subcategory_id)
        if not subcategory:
            return
        
        # Получаем дочерние элементы (товары)
        children = await db.get_catalog_children(subcategory_id)
        
        # Формируем описание с preview_link
        description = format_description_with_preview(subcategory[4], subcategory[7])
        
        # Создаём клавиатуру
        from keyboards import create_catalog_keyboard
        keyboard = await create_catalog_keyboard(children, is_admin=await is_user_admin(user_id) if user_id else False, parent_id=subcategory_id, item_type='subcategory')
        
        # Отправляем обновленное сообщение
        if subcategory[6]:  # photo_id
            await bot.send_photo(
                chat_id=chat_id,
                photo=subcategory[6],
                caption=description,
                parse_mode="HTML",
                reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=chat_id,
                text=description,
                parse_mode="HTML",
                reply_markup=keyboard
            )
    except Exception as e:
        print(f"Error recreating subcategory view: {e}")

async def recreate_product_view(chat_id: int, message_id: int, product_id: int, user_id: int = None):
    """
    Пересоздает просмотр товара с таким же содержимым и кнопками,
    как в view_product_handler, но с примененным промокодом если он есть
    """
    try:
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            return
        
        # Получаем цену и дни действия товара
        price_info = await db.get_product_price_with_days(product_id)
        
        # Проверяем, есть ли активный промокод для этого товара у пользователя
        user_state = dp.current_state(user=user_id) if user_id else None
        user_data = await user_state.get_data() if user_state else {}
        
        # Получаем информацию о промокоде, если он есть
        promo_code = user_data.get('promo_code')
        discount_percent = user_data.get('discount_percent', 0)
        
        # Получаем количество файлов товара
        files_count = await db.get_product_files_count(product_id)
        
        # ПРАВИЛЬНЫЙ ПОРЯДОК: Сначала отправляем СТИКЕР и СООБЩЕНИЕ, затем удаляем старые
        # Следуем спецификации: новый контент должен прийти ПЕРЕД очисткой старого
        
        # 1. СНАЧАЛА отправляем стикер (если есть) - СТИКЕР ВСЕГДА ПЕРВЫЙ!
        if product[5]:  # sticker_id
            try:
                await bot.send_sticker(chat_id=chat_id, sticker=product[5])
            except Exception as e:
                print(f"Error sending sticker: {e}")
        
        # Формируем описание с скрытой preview ссылкой сверху
        formatted_description = format_description_with_preview(product[4], product[7])
        
        # Добавляем информацию о цене за штуку и доступном количестве
        if price_info:
            price_rub = price_info[0] / 100  # Конвертируем из копеек в рубли
            
            # Применяем скидку, если есть активный промокод
            if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
                discounted_price = price_rub * (100 - discount_percent) / 100
                if files_count > 1:
                    formatted_description += f"\n\n<b>Цена за шт</b>: <s>{price_rub:.0f}₽</s> {discounted_price:.0f}₽ (-{discount_percent}%)"
            else:
                if files_count > 1:
                    formatted_description += f"\n\n<b>Цена за шт</b>: {price_rub:.0f}₽"
        
        # Показываем доступное количество только если товаров больше 1
        if files_count > 1:
            formatted_description += f"\n<b>Доступно</b>: {files_count} шт"
        
        # Создаем клавиатуру с учетом количества файлов
        keyboard = InlineKeyboardMarkup()
        has_back_button = False
        
        # Добавляем кнопки покупки если есть цена
        if price_info:
            price_rub = price_info[0] / 100
            expiration_days = price_info[2] if len(price_info) > 2 else None
            
            # Применяем скидку к цене, если есть активный промокод
            display_price = price_rub
            if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
                display_price = price_rub * (100 - discount_percent) / 100
            
            # Если товар имеет дни действия, показываем клавиатуру выбора дней
            if expiration_days and expiration_days.strip():
                from keyboards import expiration_days_selection_kb
                min_days = int(expiration_days.split(',')[0])
                available_days = [int(day.strip()) for day in expiration_days.split(',')]
                files_count_by_days = {}
                for day in available_days:
                    files_count_by_days[day] = await db.get_product_files_count_by_days(product_id, day)
                
                keyboard = expiration_days_selection_kb(
                    product_id, expiration_days, min_days, display_price, files_count, 1, files_count_by_days,
                    user_id=user_id, product_parent_id=product[1]
                )
                has_back_button = True
            else:
                # Обычные товары без дней действия
                from keyboards import product_purchase_kb
                purchase_keyboard = product_purchase_kb(product_id, display_price, 1, max(files_count, 1))
                for row in purchase_keyboard.inline_keyboard:
                    keyboard.row(*row)
        
        # Для админа добавляем действия редактирования/удаления
        try:
            if user_id and await is_user_admin(user_id):
                from keyboards import admin_product_actions_kb
                admin_kb = admin_product_actions_kb(product_id)
                for row in admin_kb.inline_keyboard:
                    keyboard.row(*row)
        except Exception as e:
            print(f"Error adding admin buttons in recreate_product_view: {e}")
            # Still add admin buttons even if there's an error, but with fallback
            try:
                if user_id and await is_user_admin(user_id):
                    keyboard.add(
                        InlineKeyboardButton("✏️ Изменить товар", callback_data=f"admin_edit_product_{product_id}"),
                        InlineKeyboardButton("🗑 Удалить товар", callback_data=f"admin_delete_product_{product_id}")
                    )
            except Exception as e2:
                print(f"Error adding fallback admin buttons in recreate_product_view: {e2}")
        
        # Добавляем кнопку "Назад" только если её ещё нет
        if not has_back_button:
            parent_category = await db.get_catalog_item(product[1])
            if parent_category:
                parent_is_grid_3x6 = parent_category[13] if len(parent_category) > 13 else False
                if parent_is_grid_3x6:
                    parent_type = parent_category[2]
                    saved_page = get_user_page_state(user_id, product[1]) if user_id else 0
                    if parent_type == 'category':
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}_{saved_page}"))
                    elif parent_type == 'subcategory':
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{product[1]}_{saved_page}"))
                    else:
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}_{saved_page}"))
                else:
                    parent_type = parent_category[2]
                    if parent_type == 'theme':
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{product[1]}"))
                    elif parent_type == 'category':
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}"))
                    elif parent_type == 'subcategory':
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{product[1]}"))
                    else:
                        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product[1]}_0"))
            else:
                keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product[1]}_0"))
        
        # 2. ЗАТЕМ отправляем сообщение с товаром (СРАЗУ после стикера)
        if product[6]:  # photo_id
            await bot.send_photo(
                chat_id=chat_id, photo=product[6],
                caption=formatted_description, parse_mode="HTML", reply_markup=keyboard
            )
        else:
            await bot.send_message(
                chat_id=chat_id, text=formatted_description,
                parse_mode="HTML", reply_markup=keyboard
            )
            
        # 3. ТОЛЬКО ПОСЛЕ отправки нового контента удаляем старое сообщение
        # Это обеспечивает плавную навигацию без пробелов
        try:
            await asyncio.sleep(0.1)  # Гарантируем доставку нового контента
            await bot.delete_message(chat_id=chat_id, message_id=message_id)
        except Exception:
            pass  # Игнорируем ошибки
        
    except Exception as e:
        print(f"Error in recreate_product_view: {e}")

@dp.message_handler(state=PromoCodeStates.waiting_for_product_promo)
async def process_product_promo_code(message: types.Message, state: FSMContext):
    """Обработчик для проверки промокода товара"""
    try:
        # Получаем данные из состояния
        user_data = await state.get_data()
        product_id = user_data.get('product_id')
        original_message_id = user_data.get('original_message_id')
        original_chat_id = user_data.get('original_chat_id')
        
        # Удаляем сообщение с промокодом
        await message.delete()
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            await message.answer("Товар не найден")
            await state.finish()
            return
        
        # Проверяем промокод
        promo_code = message.text.strip()
        if not promo_code:
            # Неверный формат - возвращаемся к товару
            await state.finish()
            await recreate_product_view(original_chat_id, original_message_id, product_id, message.from_user.id)
            return
        
        # Проверяем промокод в базе данных (старая система)
        promo_info = await db.get_promo_code(promo_code)
        
        if promo_info:
            # Промокод действителен - сохраняем в состоянии
            discount_percent = promo_info[1]  # Процент скидки
            
            # Сохраняем информацию о скидке в состоянии пользователя
            await state.update_data({
                'promo_code': promo_code,
                'discount_percent': discount_percent,
                'product_id': product_id  # Сохраняем product_id для корректного применения скидки
            })
        
        # Завершаем состояние и возвращаемся к товару
        await state.finish()
        await recreate_product_view(original_chat_id, original_message_id, product_id, message.from_user.id)
        
    except Exception as e:
        print(f"Error in process_product_promo_code: {e}")
        await message.answer(f"Ошибка: {e}")
        await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("share_product_"))
async def share_product_handler(callback: types.CallbackQuery):
    """Обработчик для создания ссылки на товар"""
    try:
        parts = callback.data.split("_")
        product_id = int(parts[2])
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            await callback.answer("Товар не найден")
            return
        
        # Создаем ссылку на товар с глубокой ссылкой - актуальное имя бота
        try:
            # Получаем актуальное имя пользователя бота
            bot_info = await bot.get_me()
            bot_username = bot_info.username or cfg.BOT_USERNAME
        except Exception:
            # Если не удалось получить, используем сохраненный
            bot_username = cfg.BOT_USERNAME
        
        share_link = f"https://t.me/{bot_username}?start=product_{product_id}"
        
        # Отправляем сообщение с ссылкой
        await callback.message.answer(
            f"🔗 Поделиться: {product[3]}\n\n🎯 Прямая ссылка на товар:\n{share_link}\n\n✨ При переходе по этой ссылке пользователь <b>сразу увидит этот товар</b> с возможностью покупки!",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("🔙 Назад", callback_data=f"view_product_{product_id}")
            )
        )
        
        # Отвечаем на callback, чтобы убрать часы загрузки
        await callback.answer()
        
    except Exception as e:
        print(f"Error in share_product_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("buy_product_"))
async def buy_product_handler(callback: types.CallbackQuery):
    """Обработчик покупки товара"""
    try:
        parts = callback.data.split("_")
        product_id = int(parts[2])
        # Парсим количество или дни действия
        param = int(parts[3]) if len(parts) > 3 else 1
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            await callback.answer("Товар не найден")
            return
            
        # Получаем цену и дни действия товара
        price_info = await db.get_product_price_with_days(product_id)
        if not price_info:
            await callback.answer("Цена товара не установлена")
            return
            
        # Проверяем, есть ли активный промокод для этого товара у пользователя
        user_state = dp.current_state(user=callback.from_user.id)
        user_data = await user_state.get_data()
        
        # Получаем информацию о промокоде, если он есть
        promo_code = user_data.get('promo_code')
        discount_percent = user_data.get('discount_percent', 0)
        
        # Определяем, есть ли у товара дни действия
        expiration_days = price_info[2] if len(price_info) > 2 else None
        
        if expiration_days and expiration_days.strip():
            # Товар с днями действия - парсим дни и количество
            selected_days = param
            quantity = int(parts[4]) if len(parts) > 4 else 1  # Количество из callback_data
            
            # Проверяем, что выбранные дни есть в списке доступных
            available_days = [int(day.strip()) for day in expiration_days.split(',')]
            if selected_days not in available_days:
                await callback.answer("Ошибка: Неверное количество дней")
                return
            
            # Рассчитываем цену с учетом дней действия
            min_days = min(available_days)
            additional_days = selected_days - min_days
            price_multiplier = 1 + (additional_days * 0.9 / min_days)  # 90% надбавка
            base_price = price_info[0]
            final_price = int(base_price * price_multiplier)
        else:
            # Обычный товар - param это количество
            quantity = param
            selected_days = None
            final_price = price_info[0]
            
        # Проверяем доступное количество товара для конкретного периода дней
        if selected_days:
            available_quantity = await db.get_product_files_count_by_days(product_id, selected_days)
        else:
            available_quantity = await db.get_product_files_count(product_id)
            
        if quantity > available_quantity:
            await callback.answer(f"Недостаточно товара в наличии. Доступно: {available_quantity} шт", show_alert=True)
            return
            
        # Получаем категорию товара с типом
        category_with_type = await db.get_product_category_with_type(product_id)
        
        # Генерируем код заказа
        order_code = generate_order_code()
        
        # Устанавливаем время истечения (20 минут)
        expire_time = datetime.now() + timedelta(minutes=20)
        expires_at_str = expire_time.strftime("%Y-%m-%d %H:%M:%S")
        
        # Применяем скидку по промокоду, если он есть
        if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
            # Применяем скидку к цене
            final_price = int(final_price * (100 - discount_percent) / 100)
            
        # Рассчитываем общую стоимость
        total_price = final_price * quantity
        
        # Создаем заказ в базе данных
        order_id = await db.create_order(
            user_id=callback.from_user.id,
            product_id=product_id,
            code=order_code,
            price=total_price,
            quantity=quantity,
            expires_at=expires_at_str,
            selected_days=selected_days
        )
        
        # Если был использован промокод, отмечаем его как использованный
        if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
            await db.mark_product_promo_used(promo_code)
            # Очищаем информацию о промокоде в состоянии пользователя
            await user_state.update_data({'promo_code': None, 'discount_percent': 0})
        
        # Удаляем предыдущее сообщение и стикер
        await delete_message_and_sticker(callback)
        
        # Формируем текст заказа
        price_rub = price_info[0] / 100
        total_price_rub = total_price / 100
        
        # Добавляем информацию о днях действия если они выбраны
        days_info = f"\n📅 <b>Срок действия</b>: {selected_days} дней" if selected_days else ""
        
        # Добавляем информацию о скидке, если был применен промокод
        discount_info = ""
        if promo_code and discount_percent > 0 and user_data.get('product_id') == product_id:
            original_price_rub = price_rub
            discounted_price_rub = price_rub * (100 - discount_percent) / 100
            discount_info = f"\n<b>Скидка по промокоду</b>: {discount_percent}%\n<b>Цена со скидкой</b>: {discounted_price_rub:.0f}₽"
        
        order_text = f"💳 <b>Оплата заказа</b>: <code>{order_code}</code>\n\n" \
                    f"<b>Товар</b>: {product[3]}\n" \
                    f"<b>{category_with_type}</b>\n" \
                    f"{days_info}\n" \
                    f"<b>Кол-во</b>: {quantity} шт\n"
                    
        # Отображаем цену с учетом скидки или без
        if discount_info:
            order_text += f"<b>Цена за шт</b>: <s>{price_rub:.0f}₽</s>{discount_info}\n"
        else:
            order_text += f"<b>Цена за шт</b>: {price_rub:.0f}₽\n"
            
        order_text += f"💰 <b>Сумма к оплате</b>: {total_price_rub:.0f}₽\n" \
                    f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>\n\n" \
                    f"⏳ <b>Время на оплату</b>: 20 минут\n" \
                    f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)"
        
        # Отправляем форму заказа
        print(f"Генерируем клавиатуру для заказа {order_code}")
        keyboard = await order_payment_methods_kb(order_code)
        print(f"Сгенерированная клавиатура: {keyboard}")
        print(f"Тип клавиатуры: {type(keyboard)}")
        
        if keyboard is None:
            print("Ошибка: клавиатура None!")
            # Создаем фолбэк клавиатуру
            from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
            keyboard = InlineKeyboardMarkup()
            keyboard.add(InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{order_code}"))
        
        await callback.message.answer(
            order_text,
            parse_mode="HTML",
            reply_markup=keyboard
        )
        
        # Отправляем уведомление админам о начале покупки
        username = callback.from_user.username or "Нет username"
        await send_purchase_notification(
            user_id=callback.from_user.id,
            username=username,
            product_name=f"{product[3]} ({quantity} шт)",
            payment_method="Выбирает метод оплаты"
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in buy_product_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

# Обработчики для кнопок выбора количества
@dp.callback_query_handler(lambda c: c.data.startswith("qty_") and not c.data.startswith("qty_inc_days_") and not c.data.startswith("qty_dec_days_"))
async def quantity_handler(callback: types.CallbackQuery):
    """Обработчик кнопок выбора количества"""
    try:
        parts = callback.data.split("_")
        action = parts[1]  # dec1, inc1, dec10, inc10, set1, setmax
        
        if action in ["min", "max", "display"]:
            if action == "min":
                await callback.answer("Минимальное количество: 1 шт", show_alert=True)
            elif action == "max":
                await callback.answer("Вы выбрали максимальное количество товара", show_alert=True)
            else:
                await callback.answer()
            return
        
        product_id = int(parts[2])
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            await callback.answer("Товар не найден")
            return
        
        # Получаем цену и максимальное количество
        price_info = await db.get_product_price(product_id)
        max_quantity = await db.get_product_files_count(product_id)
        
        if not price_info or max_quantity == 0:
            await callback.answer("Ошибка получения данных о товаре")
            return
        
        price_rub = price_info[0] / 100
        
        # Определяем новое количество
        if action == "dec1":
            current_quantity = int(parts[3])
            new_quantity = max(1, current_quantity - 1)
        elif action == "inc1":
            current_quantity = int(parts[3])
            new_quantity = min(max_quantity, current_quantity + 1)
        elif action == "dec10":
            current_quantity = int(parts[3])
            new_quantity = max(1, current_quantity - 10)
        elif action == "inc10":
            current_quantity = int(parts[3])
            new_quantity = min(max_quantity, current_quantity + 10)
        elif action == "set1":
            new_quantity = 1
        elif action == "setmax":
            new_quantity = int(parts[3])  # Это уже максимальное значение
        else:
            await callback.answer("Неизвестное действие")
            return
        
        # Создаем обновленную клавиатуру
        from keyboards import product_purchase_kb
        new_keyboard = product_purchase_kb(product_id, price_rub, new_quantity, max_quantity)
        
        # Добавляем кнопку "Назад"
        # Получаем информацию о родительской категории для правильного callback
        parent_category = await db.get_catalog_item(product[1])
        if parent_category:
            # Проверяем, использует ли родительская категория 3x6 сетку
            parent_is_grid_3x6 = parent_category[13] if len(parent_category) > 13 else False
            if parent_is_grid_3x6:
                # Для 3x6 сетки определяем правильный callback в зависимости от типа родителя
                parent_type = parent_category[2]  # type column
                saved_page = get_user_page_state(callback.from_user.id, product[1])
                if parent_type == 'category':
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}_{saved_page}")
                    )
                elif parent_type == 'subcategory':
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{product[1]}_{saved_page}")
                    )
                else:
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}_{saved_page}")
                    )
            else:
                # Для обычных категорий определяем тип родительской категории
                parent_type = parent_category[2]  # type column
                if parent_type == 'theme':
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{product[1]}")
                    )
                elif parent_type == 'category':
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{product[1]}")
                    )
                elif parent_type == 'subcategory':
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{product[1]}")
                    )
                else:
                    new_keyboard.add(
                        InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product[1]}_0")
                    )
        else:
            new_keyboard.add(
                InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product[1]}_0")
            )
        
        # Обновляем клавиатуру
        try:
            await callback.message.edit_reply_markup(reply_markup=new_keyboard)
            await callback.answer()
        except Exception as e:
            print(f"Error updating keyboard: {e}")
            await callback.answer("Ошибка обновления")
        
    except Exception as e:
        print(f"Error in quantity_handler: {e}")
        await callback.answer(f"Ошибка: {e}")
        
@dp.callback_query_handler(lambda c: c.data.startswith("order_pay_"))
async def order_payment_method_handler(callback: types.CallbackQuery):
    """Обработчик методов оплаты заказа"""
    try:
        parts = callback.data.split("_")
        method = parts[2]
        code = parts[3]
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        # Проверяем, не истекло ли время
        if order[7]:  # expires_at
            expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S")
            if expire_time < datetime.now():
                await callback.answer("Время оплаты истекло")
                return
        
        price_rub = order[5] / 100
        user_id = order[1]
        
        # Получаем информацию о пользователе для уведомления
        username = callback.from_user.username or "Нет username"
        product = await db.get_catalog_item(order[2])
        product_name = product[3] if product else "Неизвестный товар"
        
        # Определяем название метода оплаты для уведомления
        payment_method_names = {
            "balance": "💰 Баланс",
            "cryptobot": "🤖 CryptoBot", 
            "sbp": "📲 СБП-QR",
            "qr": "📲 СБП-QR",
            "phone": "📱 СБП по номеру",
            "card": "💳 Банковская карта",
            "crypto": "₿ Криптовалюта",
            "stars": "⭐ Telegram Stars"
        }
        payment_method_display = payment_method_names.get(method, method.upper())
        
        # Отправляем уведомление админам о выборе метода оплаты
        await send_purchase_notification(
            user_id=callback.from_user.id,
            username=username,
            product_name=product_name,
            payment_method=payment_method_display
        )
        
        # Обработка оплаты с баланса
        if method == "balance":
            user_balance = await db.get_user_balance(user_id)
            if user_balance < price_rub:
                # Не хватает средств на балансе
                shortage = price_rub - user_balance
                await callback.answer(
                    f"Для оплаты заказа на вашем балансе не хватает {shortage:.0f}₽",
                    show_alert=True
                )
                return
            
            # Списываем средства с баланса
            await db.conn.execute('''
                UPDATE users SET balance = balance - ? WHERE user_id = ?
            ''', (price_rub, user_id))
            
            # Обновляем статус заказа на оплаченный
            await db.update_order_status(code, 'paid')
            await db.conn.commit()
            
            # Отправляем файлы товара в соответствии с количеством и периодом дней
            # order[10] is selected_days from orders table
            selected_days = order[10] if len(order) > 10 else None
            await send_product_files(user_id, order[2], order[4], selected_days)  # order[4] = quantity
            
            await callback.message.edit_text(
                f"✅ <b>Заказ оплачен!</b>\n\n"
                f"📦 <b>Товар</b>: {order[9]}\n"
                f"💰 <b>Сумма</b>: {price_rub:.0f}₽\n"
                f"🏦 <b>Оплачено с баланса</b>\n\n"
                f"Ваш заказ будет обработан в ближайшее время.",
                parse_mode="HTML"
            )
            await callback.answer("✅ Заказ успешно оплачен!")
            return
        
        # Обработка оплаты через CryptoBot
        if method == "cryptobot":
            await process_cryptobot_order_redirect(callback, code)
            return
            
        # Обработка оплаты картой через Telegram Invoice
        if method == "card":
            await process_order_card_payment(callback, code)
            return
            
        # Обработка оплаты через BitPAPA
        if method == "bitpapa":
            # Для BitPAPA создаем прямую ссылку на оплату
            from bitpapa_handlers import create_bitpapa_payment, send_bitpapa_payment_message
            
            # Создаем платеж через BitPAPA
            payment_data = await create_bitpapa_payment(
                user_id=callback.from_user.id,
                amount=price_rub,
                order_code=code
            )
            
            if payment_data and payment_data.get('payment_url'):
                # Отправляем сообщение с кнопкой оплаты через BitPAPA
                await send_bitpapa_payment_message(
                    chat_id=callback.from_user.id,
                    payment_data=payment_data,
                    order_code=code,
                    amount=price_rub
                )
                
                # Удаляем текущее сообщение
                try:
                    await callback.message.delete()
                except Exception as e:
                    print(f"Ошибка при удалении сообщения: {e}")
                
                await callback.answer("✅ Ссылка на оплату BitPAPA создана")
                return
            else:
                # Если не удалось создать платеж, показываем ошибку
                await callback.answer("❌ Ошибка создания платежа BitPAPA", show_alert=True)
                return
        
        # Сохраняем выбранный метод оплаты в заказе
        payment_method_names = {
            "sbp": "СБП-QR",
            "qr": "СБП-QR", 
            "phone": "СБП по номеру",
            "card": "Банковская карта",
            "crypto": "Криптовалюта",
            "stars": "Telegram Stars",
            "skins": "Скинами",
            "bitpapa": "BitPapa"
        }
        payment_method_name = payment_method_names.get(method, method)
        await db.update_order_payment_method(code, payment_method_name)
        
        # Обработка других методов оплаты
        category_with_type = await db.get_product_category_with_type(order[2])
        
        # Формируем текст подтверждения
        expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S") if order[7] else None
        
        if method in ["sbp", "qr", "phone"]:
            payment_method_display = {
                "sbp": "📲 СБП-QR",
                "qr": "📲 СБП-QR", 
                "phone": "📱 СБП по номеру"
            }.get(method, "СБП")
            
            confirm_text = f"💳 <b>Оплата заказа</b>: <code>{code}</code>\n\n" \
                          f"📦 <b>Товар</b>: {order[9]}\n" \
                          f"<b>{category_with_type}</b>\n\n" \
                          f"📦 <b>Кол-во</b>: 1 шт\n" \
                          f"💰 <b>Сумма к оплате</b>: {price_rub:.0f}₽\n" \
                          f"💳 <b>Метод</b>: {payment_method_display}\n" \
                          f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>\n\n" \
                          f"⏳ <b>Время на оплату</b>: 20 минут\n" \
                          f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)" if expire_time else ""
        elif method == "card":
            payment_method_display = "💳 Банковская карта"
            
            confirm_text = f"💳 <b>Оплата заказа</b>: <code>{code}</code>\n\n" \
                          f"📦 <b>Товар</b>: {order[9]}\n" \
                          f"<b>{category_with_type}</b>\n\n" \
                          f"📦 <b>Кол-во</b>: 1 шт\n" \
                          f"💰 <b>Сумма к оплате</b>: {price_rub:.0f}₽\n" \
                          f"💳 <b>Метод</b>: {payment_method_display}\n" \
                          f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>\n\n" \
                          f"⏳ <b>Время на оплату</b>: 20 минут\n" \
                          f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)" if expire_time else ""
        else:
            # Для остальных методов
            payment_method_display = payment_method_names.get(method, method.upper())
            
            confirm_text = f"💳 <b>Оплата заказа</b>: <code>{code}</code>\n\n" \
                          f"📦 <b>Товар</b>: {order[9]}\n" \
                          f"<b>{category_with_type}</b>\n\n" \
                          f"📦 <b>Кол-во</b>: 1 шт\n" \
                          f"💰 <b>Сумма к оплате</b>: {price_rub:.0f}₽\n" \
                          f"💳 <b>Метод</b>: {payment_method_display}\n" \
                          f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>\n\n" \
                          f"⏳ <b>Время на оплату</b>: 20 минут\n" \
                          f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)" if expire_time else ""
        
        await callback.message.edit_text(
            confirm_text,
            parse_mode="HTML",
            reply_markup=order_payment_confirm_kb(code)
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in order_payment_method_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("cancel_order_"))
async def cancel_order_handler(callback: types.CallbackQuery):
    """Обработчик отмены заказа"""
    try:
        code = callback.data.split("_")[-1]
        
        # Получаем информацию о заказе
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        price_rub = order[5] / 100
        category_with_type = await db.get_product_category_with_type(order[2])
        
        order_text = f"💳 <b>Оплата заказа</b>: <code>{code}</code>\n\n" \
                    f"📦 <b>Товар</b>: {order[9]}\n" \
                    f"<b>{category_with_type}</b>\n\n" \
                    f"📦 <b>Кол-во</b>: 1 шт\n" \
                    f"💰 <b>Сумма к оплате</b>: {price_rub:.0f}₽\n" \
                    f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>"
        
        # Сначала отправляем новый контент
        await callback.message.answer(
            order_text,
            parse_mode="HTML",
            reply_markup=await order_payment_methods_kb(code)
        )

        # Отправляем подтверждение отмены
        await callback.message.answer(
            f"⚠️ Вы уверены что хотите отменить заказ <code>{code}</code>?",
            parse_mode="HTML",
            reply_markup=order_cancel_confirm_kb(code)
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in cancel_order_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("back_to_order_"), state="*")
async def back_to_order_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик возврата к заказу"""
    # Finish any active state
    if state:
        await state.finish()
    
    try:
        code = callback.data.split("_")[-1]
        
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
        
        # Если заказ был отменен, восстанавливаем его
        if order[6] == 'cancelled':  # status
            await db.restore_order(code)
            
        price_rub = order[5] / 100
        category_with_type = await db.get_product_category_with_type(order[2])
        expire_time = datetime.strptime(order[7], "%Y-%m-%d %H:%M:%S") if order[7] else None
        
        order_text = f"💳 <b>Оплата заказа</b>: <code>{code}</code>\n\n" \
                    f"📦 <b>Товар</b>: {order[9]}\n" \
                    f"<b>{category_with_type}</b>\n\n" \
                    f"📦 <b>Кол-во</b>: 1 шт\n" \
                    f"💰 <b>Сумма к оплате</b>: {price_rub:.0f}₽\n" \
                    f"<blockquote>ℹ️ Цена товара указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены.</blockquote>\n\n" \
                    f"⏳ <b>Время на оплату</b>: 20 минут\n" \
                    f"🕒 <b>Оплатить до</b>: {expire_time.strftime('%d.%m.%Y %H:%M')} (МСК)" if expire_time else ""
        
        # Сначала отправляем новый контент
        await callback.message.edit_text(
            order_text,
            parse_mode="HTML",
            reply_markup=await order_payment_methods_kb(code)
        )

        # Только после этого удаляем старые сообщения
        await smart_cleanup_after_send(callback)
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in back_to_order_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("confirm_cancel_order_"))
async def confirm_cancel_order_handler(callback: types.CallbackQuery):
    """Обработчик подтверждения отмены заказа"""
    try:
        code = callback.data.split("_")[-1]
        
        # Получаем информацию о заказе до отмены
        order = await db.get_order(code)
        if not order:
            await callback.answer("Заказ не найден")
            return
            
        product_id = order[2]
        
        # Отменяем заказ в базе данных
        await db.cancel_order(code)
        
        # Отправляем сообщение об отмене
        try:
            await callback.message.delete()
        except:
            pass
            
        await callback.message.answer(
            f"✅ Заказ <code>{code}</code> отменен",
            parse_mode="HTML",
            reply_markup=back_to_product_kb(product_id)
        )
        
        await callback.answer()
        
    except Exception as e:
        print(f"Error in confirm_cancel_order_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data.startswith("confirm_cancel_payment_"))
async def confirm_cancel_payment_handler(callback: types.CallbackQuery):
    """Обработчик подтверждения отмены платежа"""
    code = callback.data.split("_")[-1]

    # Отменяем платеж в БД
    await db.cancel_payment(code)

    # Удаляем сообщение с подтверждением отмены
    try:
        await callback.message.delete()
    except Exception as e:
        print(f"Ошибка при удалении сообщения: {e}")

    # Отправляем финальное сообщение об отмене
    await callback.message.answer(
        cfg.PAYMENT_CANCELED_TEXT.format(code=code),
        reply_markup=back_to_payment_kb(),
        parse_mode="HTML"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("view_parent_"))
async def view_parent_handler(callback: types.CallbackQuery):
    """Обработчик кнопки 'Назад'"""
    try:
        parent_id = int(callback.data.split("_")[2])
        
        # Получаем текущий элемент для определения его родителя
        current_item = await db.get_catalog_item(parent_id)
        if not current_item:
            await callback.answer("Элемент не найден")
            return
            
        # current_item[1] - это parent_id текущего элемента
        parent_of_current = current_item[1]  # parent_id
        
        if parent_of_current is None:
            # Если это тема (нет родителя), возвращаемся в главный каталог с удалением
            await delete_message_and_sticker(callback)
            await handle_catalog_button(callback.message)
        else:
            # Получаем родительский элемент
            parent = await db.get_catalog_item(parent_of_current)
            if not parent:
                await callback.answer("Родительский элемент не найден")
                return
            
            # Получаем дочерние элементы родителя
            children = await db.get_catalog_children(parent_of_current)
            
            # Формируем описание с preview_link
            description = format_description_with_preview(parent[4], parent[7])
            
            # Определяем тип родительского элемента для правильной клавиатуры
            parent_type = parent[2]  # type column
            
            # Проверяем, использует ли родительский элемент 3x6 сетку
            is_grid_3x6 = parent[13] if len(parent) > 13 else False
            
            # При возврате из товара используем сохраненную страницу
            # чтобы сохранить правильное расположение кнопок
            current_page = get_user_page_state(callback.from_user.id, parent_of_current)
            
            if is_grid_3x6:
                # Используем 3x6 сетку
                search_button_name = parent[14] if len(parent) > 14 else None
                back_button_text = parent[15] if len(parent) > 15 else None
                
                keyboard = await create_3x6_grid_keyboard(
                    children, 
                    page=current_page, 
                    search_button_name=search_button_name,
                    back_button_text=back_button_text,
                    parent_id=parent_of_current,
                    is_admin=False  # Не показываем админ кнопки при возврате
                )
            else:
                # Проверяем, находится ли родительский элемент в 3x6 категории
                grandparent = await db.get_catalog_item(parent[1]) if parent[1] else None
                grandparent_is_grid_3x6 = grandparent[13] if grandparent and len(grandparent) > 13 else False
                
                if grandparent_is_grid_3x6 and parent_type in ['category', 'subcategory']:
                    # Если родитель находится в 3x6 категории, используем 3x6 сетку
                    search_button_name = parent[14] if len(parent) > 14 else None
                    back_button_text = parent[15] if len(parent) > 15 else None
                    
                    keyboard = await create_3x6_grid_keyboard(
                        children, 
                        page=current_page, 
                        search_button_name=search_button_name,
                        back_button_text=back_button_text,
                        parent_id=parent_of_current,
                        is_admin=False
                    )
                else:
                    # Обычная клавиатура - не показываем админ кнопки при возврате
                    keyboard = await create_catalog_keyboard(children, is_admin=False, parent_id=parent_of_current, item_type=parent_type)
            
            # Используем быструю замену сообщения для кнопки "Назад" с правильным порядком стикеров
            await replace_message_with_sticker_first(
                callback=callback,
                new_text=description if not parent[6] else None,
                new_photo=parent[6] if parent[6] else None,
                new_caption=description if parent[6] else None,
                new_keyboard=keyboard,
                sticker_id=parent[5] if parent[5] else None
            )
        
    except Exception as e:
        print(f"Error in view_parent_handler: {e}")
        await callback.answer(f"Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data == "add_theme")
async def add_theme_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик добавления темы"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    
    await CatalogAddStates.waiting_for_sticker.set()
    async with state.proxy() as data:
        data['item_type'] = 'theme'
        data['parent_id'] = None
    
    # Создаем клавиатуру с кнопками пропустить и отменить
    from keyboards import create_skip_cancel_kb
    keyboard = create_skip_cancel_kb("skip_sticker", "cancel_theme_creation")
    
    await callback.message.answer(
        "Отправьте ID стикера для новой темы:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("add_category_"))
async def add_category_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик добавления категории"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    
    parent_id = int(callback.data.split("_")[2])
    
    await CatalogAddStates.waiting_for_sticker.set()
    async with state.proxy() as data:
        data['item_type'] = 'category'
        data['parent_id'] = parent_id
    
    # Создаем клавиатуру с кнопками пропустить и отменить
    from keyboards import create_skip_cancel_kb
    keyboard = create_skip_cancel_kb("skip_sticker", "cancel_category_creation")
    
    await callback.message.answer(
        "Отправьте ID стикера для новой категории:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("add_subcategory_"))
async def add_subcategory_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик добавления подкатегории"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    
    parent_id = int(callback.data.split("_")[2])
    
    await CatalogAddStates.waiting_for_sticker.set()
    async with state.proxy() as data:
        data['item_type'] = 'subcategory'
        data['parent_id'] = parent_id
    
    await callback.message.answer("Отправьте ID стикера для новой подкатегории:")
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("add_product_"))
async def add_product_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик добавления товара"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    
    parent_id = int(callback.data.split("_")[2])
    
    await CatalogAddStates.waiting_for_sticker.set()
    async with state.proxy() as data:
        data['item_type'] = 'product'
        data['parent_id'] = parent_id
    
    # Создаем клавиатуру с кнопками пропустить и отменить
    from keyboards import create_skip_cancel_kb
    keyboard = create_skip_cancel_kb("skip_sticker", "cancel_product_creation")
    
    await callback.message.answer(
        "Отправьте ID стикера для нового товара:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_catalog", state="*")
async def back_to_catalog_handler(callback: types.CallbackQuery):
    """Обработчик возврата в каталог"""
    await handle_catalog_button(callback.message)
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_main", state="*")
async def back_to_main_handler(callback: types.CallbackQuery):
    """Обработчик возврата в главное меню"""
    # Получаем настройки приветственного сообщения из БД
    welcome_settings = await db.get_welcome_settings()
    welcome_text = welcome_settings.get('text') or cfg.WELCOME_TEXT
    welcome_sticker_id = welcome_settings.get('sticker_id')
    welcome_photo_id = welcome_settings.get('photo_id')

    # Отправляем стикер если он установлен
    if welcome_sticker_id:
        try:
            await bot.send_sticker(
                chat_id=callback.message.chat.id,
                sticker=welcome_sticker_id
            )
        except Exception as e:
            print(f"Ошибка отправки стикера: {e}")

    # Отправляем фото или используем стандартное
    try:
        if welcome_photo_id and is_valid_telegram_file_id(welcome_photo_id):
            # Проверяем, что ID фото валидный
            try:
                # Используем фото из БД
                await bot.send_photo(
                    chat_id=callback.message.chat.id,
                    photo=welcome_photo_id,
                    caption=welcome_text,
                    reply_markup=main_menu_kb(),
                    parse_mode="HTML"
                )
            except Exception as photo_error:
                print(f"Ошибка отправки фото из БД: {photo_error}")
                # Если фото из БД не работает, сбрасываем его и используем стандартное
                await db.set_bot_setting("welcome_photo_id", None)
                # Используем стандартное фото из файла
                with open(cfg.IMAGE_PATH, 'rb') as photo:
                    await bot.send_photo(
                        chat_id=callback.message.chat.id,
                        photo=photo,
                        caption=welcome_text,
                        reply_markup=main_menu_kb(),
                        parse_mode="HTML"
                    )
        else:
            # Если фото ID невалидно, сбрасываем его
            if welcome_photo_id and not is_valid_telegram_file_id(welcome_photo_id):
                print(f"Невалидный photo_id: {welcome_photo_id}. Сбрасываем на стандартное.")
                await db.set_bot_setting("welcome_photo_id", None)
            
            # Используем стандартное фото из файла
            with open(cfg.IMAGE_PATH, 'rb') as photo:
                await bot.send_photo(
                    chat_id=callback.message.chat.id,
                    photo=photo,
                    caption=welcome_text,
                    reply_markup=main_menu_kb(),
                    parse_mode="HTML"
                )
    except FileNotFoundError:
        # Если фото нет, отправляем только текст
        await callback.message.answer(
            welcome_text,
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )
    except Exception as general_error:
        print(f"Общая ошибка при отправке приветственного сообщения: {general_error}")
        # В крайнем случае отправляем только текст
        await callback.message.answer(
            welcome_text,
            reply_markup=main_menu_kb(),
            parse_mode="HTML"
        )
    
    await callback.answer()

# Обновим обработчик ответа админа в streetshop.py
@dp.callback_query_handler(lambda c: c.data.startswith("admin_reply_"))
async def admin_reply_handler(callback: types.CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    user_id = int(parts[2])
    ticket_id = int(parts[3]) if len(parts) > 3 else None

    await AdminReply.waiting_for_operator_name.set()
    async with state.proxy() as data:
        data['user_id'] = user_id
        data['ticket_id'] = ticket_id
        if "Тема:" in (callback.message.text or ""):
            data['topic'] = (callback.message.text or "").split("Тема: ")[1].split("\n")[0]
        else:
            data['topic'] = "Общее обращение"

    await callback.message.answer(
        cfg.ASK_OPERATOR_NAME,
        reply_markup=back_to_contact_kb()
    )
    await callback.answer()

@dp.message_handler(state=AdminReply.waiting_for_operator_name)
async def process_operator_name(message: types.Message, state: FSMContext):
    async with state.proxy() as data:
        data['operator_name'] = message.text

    await AdminReply.next()
    await message.answer(
        "Введите текст ответа для пользователя:",
        reply_markup=back_to_contact_kb()
    )

# Обновим обработчик ответа админа
@dp.message_handler(state=AdminReply.waiting_for_reply_text)
async def process_reply_text(message: types.Message, state: FSMContext):
    # Используем html_text для поддержки форматирования Telegram
    reply_text = message.html_text if message.html_text else message.text
    
    async with state.proxy() as data:
        user_id = data['user_id']
        ticket_id = data.get('ticket_id')
        operator_name = data['operator_name']

        try:
            if ticket_id:
                await db.update_ticket(ticket_id, reply_text, operator_name)

            # Форматируем ответ с сохранением форматирования
            formatted_reply = (
                "🆘 Ответ на ваше обращение\n\n"
                f"Тема: {data.get('topic', 'Общее обращение')}\n"
                f"Статус: Отвечен\n\n"
                f"👤 Оператор: {operator_name}\n"
                "💬 Ответ:\n"
                f"{reply_text}"  # Ответ с форматированием
            )

            await bot.send_message(
                chat_id=user_id,
                text=formatted_reply,
                parse_mode="HTML"  # Используем HTML для отображения форматирования
            )
            await message.answer("✅ Ответ отправлен пользователю")
        except Exception as e:
            await message.answer(f"❌ Ошибка отправки: {e}")

    await state.finish()

# Обработчики рассылки
@dp.message_handler(state=BroadcastStates.broadcast_all_photo, content_types=['photo'])
async def process_broadcast_all_photo(message: types.Message, state: FSMContext):
    async with state.proxy() as data:
        data['photo_id'] = message.photo[-1].file_id
        data.pop('document_id', None)
    await BroadcastStates.broadcast_all_description.set()
    await message.answer(
        "📝 Отправьте описание сообщения (подпись к фото/файлу):\n\n"
        "✨ <b>Поддерживается форматирование Telegram!</b>\n"
        "Используйте кнопки форматирования в Telegram.",
        parse_mode="HTML",
        reply_markup=broadcast_skip_kb("skip_all_description")
    )

@dp.message_handler(state=BroadcastStates.broadcast_all_photo, content_types=['document'])
async def process_broadcast_all_document(message: types.Message, state: FSMContext):
    async with state.proxy() as data:
        data['document_id'] = message.document.file_id
        data['document_name'] = message.document.file_name or 'attachment'
        data.pop('photo_id', None)
    await BroadcastStates.broadcast_all_description.set()
    await message.answer(
        "📝 Отправьте описание сообщения (подпись к файлу):\n\n"
        "✨ <b>Поддерживается форматирование Telegram!</b>\n"
        "Используйте кнопки форматирования в Telegram.",
        parse_mode="HTML",
        reply_markup=broadcast_skip_kb("skip_all_description")
    )

@dp.message_handler(state=BroadcastStates.broadcast_all_description)
async def process_broadcast_all_description(message: types.Message, state: FSMContext):
    # Явно используем HTML как есть, не теряя теги
    description_text = message.text if message.text else ''
    
    async with state.proxy() as data:
        data['description'] = description_text
    await BroadcastStates.broadcast_all_buttons.set()
    await message.answer(
        "🔗 Теперь добавьте кнопки-ссылки для рассылки.\n\n"
        "📝 Отправьте кнопки в формате:\n"
        "Название кнопки - ссылка\n\n"
        "🔸 Пример:\n"
        "Наш сайт - https://example.com\n"
        "Телеграм канал - https://t.me/channel\n\n"
        "📌 Каждую кнопку отправляйте с новой строки\n"
        "⚠️ Или отправьте 'пропустить' если кнопки не нужны",
        reply_markup=broadcast_skip_kb("skip_all_buttons")
    )

@dp.message_handler(state=BroadcastStates.broadcast_all_buttons)
async def process_broadcast_all_buttons(message: types.Message, state: FSMContext):
    async with state.proxy() as data:
        # Парсим кнопки
        buttons = []
        if (message.text or '').lower() not in ['пропустить', 'skip', '-']:
            lines = message.text.strip().split('\n')
            for line in lines:
                if ' - ' in line:
                    parts = line.split(' - ', 1)
                    if len(parts) == 2:
                        button_text = parts[0].strip()
                        button_url = parts[1].strip()
                        if button_text and button_url:
                            buttons.append({'text': button_text, 'url': button_url})
        
        data['buttons'] = buttons
        
        # Отправляем всем пользователям
        users = await db.get_all_users()
        sent_count = 0
        for user_id, username in users:
            try:
                # Создаем клавиатуру если есть кнопки
                reply_markup = None
                if buttons:
                    keyboard = InlineKeyboardMarkup(row_width=1)
                    for button in buttons:
                        keyboard.add(InlineKeyboardButton(button['text'], url=button['url']))
                    reply_markup = keyboard
                
                if data.get('photo_id'):
                    await bot.send_photo(
                        user_id, 
                        data['photo_id'], 
                        caption=data.get('description', ''),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                elif data.get('document_id'):
                    await bot.send_document(
                        user_id,
                        data['document_id'],
                        caption=data.get('description', ''),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                else:
                    await bot.send_message(
                        user_id, 
                        data.get('description', 'Сообщение от администрации'),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                sent_count += 1
            except:
                pass
        await message.answer(f"✅ Рассылка завершена! Отправлено: {sent_count} сообщений")
    await state.finish()

# Кнопки "Пропустить" для рассылки всем
@dp.callback_query_handler(lambda c: c.data == "skip_all_photo", state=BroadcastStates.broadcast_all_photo)
async def skip_all_photo(callback: types.CallbackQuery, state: FSMContext):
    async with state.proxy() as data:
        data.pop('photo_id', None)
        data.pop('document_id', None)
    await BroadcastStates.broadcast_all_description.set()
    await callback.message.answer(
        "📝 Отправьте описание сообщения:\n\n"
        "✨ <b>Поддерживается форматирование Telegram!</b>",
        parse_mode="HTML",
        reply_markup=broadcast_skip_kb("skip_all_description")
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_all_description", state=BroadcastStates.broadcast_all_description)
async def skip_all_description(callback: types.CallbackQuery, state: FSMContext):
    async with state.proxy() as data:
        data['description'] = ''
    await BroadcastStates.broadcast_all_buttons.set()
    await callback.message.answer(
        "🔗 Теперь добавьте кнопки-ссылки для рассылки.\n\n"
        "📝 Отправьте кнопки в формате: Название - ссылка\n\n"
        "Или нажмите Пропустить",
        reply_markup=broadcast_skip_kb("skip_all_buttons")
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_all_buttons", state=BroadcastStates.broadcast_all_buttons)
async def skip_all_buttons(callback: types.CallbackQuery, state: FSMContext):
    async with state.proxy() as data:
        data['buttons'] = []
        users = await db.get_all_users()
        sent_count = 0
        # Создаем разметку (пустую)
        reply_markup = None
        for user_id, username in users:
            try:
                if data.get('photo_id'):
                    await bot.send_photo(
                        user_id,
                        data['photo_id'],
                        caption=data.get('description', ''),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                elif data.get('document_id'):
                    await bot.send_document(
                        user_id,
                        data['document_id'],
                        caption=data.get('description', ''),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                else:
                    await bot.send_message(
                        user_id,
                        data.get('description', 'Сообщение от администрации'),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                sent_count += 1
            except Exception:
                pass
    await callback.message.answer(f"✅ Рассылка завершена! Отправлено: {sent_count} сообщений")
    await state.finish()
    await callback.answer()

# Кнопка Отменить рассылку (общая для всех стадий)
@dp.callback_query_handler(lambda c: c.data == "cancel_broadcast", state='*')
async def cancel_broadcast(callback: types.CallbackQuery, state: FSMContext):
    cur = await state.get_state()
    if cur and cur.startswith('BroadcastStates:'):
        await state.finish()
        await callback.message.answer("🚫 Рассылка отменена")
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_broadcast", state='*')
async def back_to_broadcast_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик возврата к главному меню рассылки"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Очищаем состояние
    if state:
        await state.finish()
    
    await callback.message.answer(
        "📢 Рассылка сообщений\n\nВыберите тип рассылки:",
        reply_markup=broadcast_main_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "broadcast_individual_user")
async def broadcast_individual_user_handler(callback: types.CallbackQuery):
    """Обработчик рассылки отдельному пользователю"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await BroadcastStates.broadcast_individual_users.set()
    await callback.message.answer(
        "📢 Рассылка отдельному пользователю\n\n"
        "👤 Введите ID пользователя (или несколько через запятую):\n\n"
        "📝 Пример: 123456789 или 123456789,987654321",
        reply_markup=back_to_broadcast_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "broadcast_product")
async def broadcast_product_handler(callback: types.CallbackQuery):
    """Обработчик рассылки товара"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    try:
        from keyboards import create_products_selection_keyboard
        keyboard, total_products, current_page, total_pages = await create_products_selection_keyboard(page=0)
        
        if total_products == 0:
            await callback.message.answer(
                "😢 В каталоге нет товаров для рассылки.",
                reply_markup=back_to_broadcast_kb()
            )
        else:
            await callback.message.answer(
                f"📎 Выберите товар для рассылки\n\n"
                f"📊 Найдено товаров: {total_products}\n"
                f"📄 Страница: {current_page}/{total_pages}",
                reply_markup=keyboard
            )
        await BroadcastStates.broadcast_product_selection.set()
        await callback.answer()
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

# Обработчики для пагинации товаров
@dp.callback_query_handler(lambda c: c.data.startswith("products_page_"), state=BroadcastStates.broadcast_product_selection)
async def broadcast_products_pagination(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик пагинации товаров"""
    try:
        page = int(callback.data.split("_")[-1])
        from keyboards import create_products_selection_keyboard
        keyboard, total_products, current_page, total_pages = await create_products_selection_keyboard(page=page)
        
        await callback.message.edit_text(
            f"📎 Выберите товар для рассылки\n\n"
            f"📊 Найдено товаров: {total_products}\n"
            f"📄 Страница: {current_page}/{total_pages}",
            reply_markup=keyboard
        )
        await callback.answer()
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

@dp.callback_query_handler(lambda c: c.data.startswith("select_product_"), state=BroadcastStates.broadcast_product_selection)
async def broadcast_select_product(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик выбора товара для рассылки"""
    try:
        product_id = int(callback.data.split("_")[-1])
        
        # Получаем информацию о товаре
        product = await db.get_catalog_item(product_id)
        if not product:
            await callback.answer("❌ Товар не найден", show_alert=True)
            return
        
        # Сохраняем товар в состоянии
        async with state.proxy() as data:
            data['product_id'] = product_id
            data['original_name'] = product[3]
            data['original_description'] = product[4]
            data['original_photo_id'] = product[6]
            data['original_preview_link'] = product[7]
            # Копируем оригинальные данные для редактирования
            data['broadcast_name'] = product[3]
            data['broadcast_description'] = product[4]
            data['broadcast_photo_id'] = product[6]
            data['broadcast_preview_link'] = product[7]
        
        # Показываем превью товара с кнопками редактирования
        from keyboards import broadcast_product_edit_kb
        preview_text = f"📎 Превью товара для рассылки:\n\n"
        preview_text += f"🏷 <b>{product[3]}</b>\n\n"
        if product[4]:
            preview_text += f"{product[4]}\n\n"
        preview_text += "⚙️ Вы можете отредактировать любые поля перед рассылкой."
        
        # Отправляем медиа если есть
        if product[6]:
            result = await send_media_by_type(
                chat_id=callback.message.chat.id,
                file_id=product[6],
                caption=preview_text,
                reply_markup=broadcast_product_edit_kb(product_id),
                parse_mode="HTML"
            )
            if result:
                await callback.message.delete()
            else:
                await callback.message.edit_text(
                    preview_text,
                    reply_markup=broadcast_product_edit_kb(product_id),
                    parse_mode="HTML"
                )
        else:
            await callback.message.edit_text(
                preview_text,
                reply_markup=broadcast_product_edit_kb(product_id),
                parse_mode="HTML"
            )
        
        await callback.answer()
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

# Обработчики редактирования товара для рассылки
@dp.callback_query_handler(lambda c: c.data.startswith("broadcast_edit_desc_"))
async def broadcast_edit_description(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик редактирования описания товара для рассылки"""
    try:
        product_id = int(callback.data.split("_")[-1])
        
        async with state.proxy() as data:
            data['editing_product_id'] = product_id
        
        await BroadcastStates.broadcast_product_edit_description.set()
        await callback.message.answer(
            "📝 Отправьте новое описание товара для рассылки:\n\n"
            "✨ <b>Поддерживается форматирование Telegram!</b>\n"
            "Используйте кнопки форматирования в Telegram.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("🚫 Отмена", callback_data="cancel_broadcast")
            )
        )
        await callback.answer()
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

@dp.callback_query_handler(lambda c: c.data.startswith("broadcast_edit_photo_"))
async def broadcast_edit_photo(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик редактирования фото товара для рассылки"""
    try:
        product_id = int(callback.data.split("_")[-1])
        
        async with state.proxy() as data:
            data['editing_product_id'] = product_id
        
        await BroadcastStates.broadcast_product_edit_photo.set()
        await callback.message.answer(
            "🖼 Отправьте новое фото, GIF или видео для товара:\n\n"
            "📝 Или напишите 'удалить' чтобы убрать медиа",
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("🚫 Отмена", callback_data="cancel_broadcast")
            )
        )
        await callback.answer()
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

@dp.callback_query_handler(lambda c: c.data.startswith("broadcast_edit_preview_"))
async def broadcast_edit_preview(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик редактирования preview ссылки товара для рассылки"""
    try:
        product_id = int(callback.data.split("_")[-1])
        
        async with state.proxy() as data:
            data['editing_product_id'] = product_id
        
        await BroadcastStates.broadcast_product_edit_preview.set()
        await callback.message.answer(
            "🔗 Отправьте новую preview ссылку для товара:\n\n"
            "📝 Или напишите 'удалить' чтобы убрать ссылку",
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("🚫 Отмена", callback_data="cancel_broadcast")
            )
        )
        await callback.answer()
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

# Обработчики для индивидуальной рассылки

# Вспомогательная функция для отправки товара отдельным пользователям
async def send_product_to_users(callback_or_message, state: FSMContext, user_ids: list, product_id: int, data: dict):
    """Отправляет товар выбранным пользователям"""
    try:
        # Получаем данные товара для рассылки
        name = data.get('broadcast_name', 'Товар')
        description = data.get('broadcast_description', '')
        photo_id = data.get('broadcast_photo_id')
        preview_link = data.get('broadcast_preview_link')
        
        print(f"📤 Начинаем рассылку товара {product_id} для {len(user_ids)} пользователей")
        print(f"📋 Данные товара: name={name}, photo_id={photo_id}, preview_link={preview_link}")
        
        # Формируем текст сообщения
        broadcast_text = f"🏷 <b>{name}</b>\n\n"
        if description:
            broadcast_text += f"{description}\n\n"
        
        # Создаем клавиатуру с кнопкой "Купить"
        try:
            from keyboards import product_buy_button_kb
            buy_keyboard = product_buy_button_kb(product_id)
            print(f"✅ Клавиатура создана для товара {product_id}")
        except Exception as e:
            print(f"❌ Ошибка создания клавиатуры: {e}")
            # Создаем клавиатуру вручную как fallback
            buy_keyboard = InlineKeyboardMarkup(row_width=1)
            buy_keyboard.add(
                InlineKeyboardButton("💳 Купить", callback_data=f"buy_product_{product_id}")
            )
        
        # Добавляем preview link если есть
        if preview_link:
            broadcast_text = f"<a href='{preview_link}'>&#8203;</a>{broadcast_text}"
        
        # Отправляем выбранным пользователям
        sent_count = 0
        
        for user_id in user_ids:
            try:
                if photo_id:
                    result = await send_media_by_type(
                        chat_id=user_id,
                        file_id=photo_id,
                        caption=broadcast_text,
                        reply_markup=buy_keyboard,
                        parse_mode="HTML"
                    )
                    if result:
                        print(f"✅ Отправлено с фото пользователю {user_id}")
                    else:
                        print(f"⚠️ Ошибка отправки фото пользователю {user_id}, отправляем текст")
                        await bot.send_message(
                            user_id,
                            broadcast_text,
                            parse_mode="HTML",
                            reply_markup=buy_keyboard
                        )
                else:
                    await bot.send_message(
                        user_id,
                        broadcast_text,
                        parse_mode="HTML",
                        reply_markup=buy_keyboard
                    )
                    print(f"✅ Отправлено текстом пользователю {user_id}")
                sent_count += 1
            except Exception as e:
                print(f"❌ Ошибка отправки товара пользователю {user_id}: {e}")
                continue
        
        # Отправляем результат
        result_message = f"✅ Товар разослан! Отправлено: {sent_count} из {len(user_ids)} сообщений"
        print(f"📊 {result_message}")
        
        # Проверяем, является ли callback_or_message сообщением или callback
        if hasattr(callback_or_message, 'answer'):  # Это message
            await callback_or_message.answer(result_message)
        elif hasattr(callback_or_message, 'message'):  # Это callback
            await callback_or_message.message.answer(result_message)
        else:
            # Fallback - используем state для получения chat_id
            # Это не самый лучший способ, но лучше чем ничего
            pass
        
        await state.finish()
        
    except Exception as e:
        error_msg = f"❌ Ошибка при рассылке товара: {e}"
        print(f"🚨 {error_msg}")
        # Проверяем, является ли callback_or_message сообщением или callback
        if hasattr(callback_or_message, 'answer'):  # Это message
            await callback_or_message.answer(error_msg)
        elif hasattr(callback_or_message, 'message'):  # Это callback
            await callback_or_message.message.answer(error_msg)
        else:
            # Fallback - используем state для получения chat_id
            # Это не самый лучший способ, но лучше чем ничего
            pass
        await state.finish()

@dp.message_handler(state=BroadcastStates.broadcast_individual_users)
async def process_broadcast_individual_users(message: types.Message, state: FSMContext):
    """Обработка ID пользователей для индивидуальной рассылки"""
    try:
        # Парсим ID пользователей
        user_ids_text = message.text.strip()
        user_ids = []
        
        # Разделяем по запятым и пробелам
        for user_id_str in user_ids_text.replace(',', ' ').split():
            try:
                user_id = int(user_id_str.strip())
                user_ids.append(user_id)
            except ValueError:
                continue
        
        if not user_ids:
            await message.answer(
                "❌ Не удалось распознать ID пользователей. Попробуйте еще раз:\n\n"
                "📝 Пример: 123456789 или 123456789,987654321",
                reply_markup=back_to_broadcast_kb()
            )
            return
        
        # Сохраняем ID пользователей
        async with state.proxy() as data:
            data['user_ids'] = user_ids
            # Проверяем, является ли это рассылкой товара
            is_product_broadcast = data.get('is_product_broadcast', False)
            target_product_id = data.get('target_product_id')
            
            if is_product_broadcast and target_product_id:
                # Это рассылка товара - отправляем сразу
                await send_product_to_users(message, state, user_ids, target_product_id, data)
                return
        
        # Обычная рассылка - продолжаем как раньше
        await BroadcastStates.broadcast_individual_photo.set()
        await message.answer(
            f"✅ Выбрано пользователей: {len(user_ids)}\n\n"
            "📎 Отправьте фото или документ (zip, txt, doc), который будет прикреплён к сообщению.",
            reply_markup=broadcast_skip_kb("skip_individual_photo")
        )
        
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}", reply_markup=back_to_broadcast_kb())

@dp.message_handler(state=BroadcastStates.broadcast_individual_photo, content_types=['photo'])
async def process_broadcast_individual_photo(message: types.Message, state: FSMContext):
    """Обработка фото для индивидуальной рассылки"""
    async with state.proxy() as data:
        data['photo_id'] = message.photo[-1].file_id
        data.pop('document_id', None)
    await BroadcastStates.broadcast_individual_description.set()
    await message.answer(
        "📝 Отправьте описание сообщения:",
        reply_markup=broadcast_skip_kb("skip_individual_description")
    )

@dp.message_handler(state=BroadcastStates.broadcast_individual_photo, content_types=['document'])
async def process_broadcast_individual_document(message: types.Message, state: FSMContext):
    """Обработка документа для индивидуальной рассылки"""
    async with state.proxy() as data:
        data['document_id'] = message.document.file_id
        data['document_name'] = message.document.file_name or 'attachment'
        data.pop('photo_id', None)
    await BroadcastStates.broadcast_individual_description.set()
    await message.answer(
        "📝 Отправьте описание сообщения:",
        reply_markup=broadcast_skip_kb("skip_individual_description")
    )

@dp.message_handler(state=BroadcastStates.broadcast_individual_description)
async def process_broadcast_individual_description(message: types.Message, state: FSMContext):
    """Обработка описания для индивидуальной рассылки"""
    # Явно используем HTML как есть, не теряя теги
    description_text = message.text if message.text else ''
    
    async with state.proxy() as data:
        data['description'] = description_text
    await BroadcastStates.broadcast_individual_buttons.set()
    await message.answer(
        "🔗 Теперь добавьте кнопки-ссылки для рассылки.\n\n"
        "📝 Отправьте кнопки в формате:\n"
        "Название кнопки - ссылка\n\n"
        "🔸 Пример:\n"
        "Наш сайт - https://example.com\n"
        "Телеграм канал - https://t.me/channel\n\n"
        "📌 Каждую кнопку отправляйте с новой строки\n"
        "⚠️ Или отправьте 'пропустить' если кнопки не нужны",
        reply_markup=broadcast_skip_kb("skip_individual_buttons")
    )

@dp.message_handler(state=BroadcastStates.broadcast_individual_buttons)
async def process_broadcast_individual_buttons(message: types.Message, state: FSMContext):
    """Обработка кнопок для индивидуальной рассылки"""
    async with state.proxy() as data:
        # Парсим кнопки
        buttons = []
        if (message.text or '').lower() not in ['пропустить', 'skip', '-']:
            lines = message.text.strip().split('\n')
            for line in lines:
                if ' - ' in line:
                    parts = line.split(' - ', 1)
                    if len(parts) == 2:
                        button_text = parts[0].strip()
                        button_url = parts[1].strip()
                        if button_text and button_url:
                            buttons.append((button_text, button_url))
        
        data['buttons'] = buttons
        user_ids = data['user_ids']
        
        # Создаем клавиатуру
        reply_markup = None
        if buttons:
            keyboard = InlineKeyboardMarkup(row_width=1)
            for button_text, button_url in buttons:
                keyboard.add(InlineKeyboardButton(button_text, url=button_url))
            reply_markup = keyboard
        
        # Отправляем сообщения выбранным пользователям
        sent_count = 0
        for user_id in user_ids:
            try:
                if data.get('photo_id'):
                    await bot.send_photo(
                        user_id,
                        data['photo_id'],
                        caption=data.get('description', 'Сообщение от администрации'),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                elif data.get('document_id'):
                    await bot.send_document(
                        user_id,
                        data['document_id'],
                        caption=data.get('description', 'Сообщение от администрации'),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                else:
                    await bot.send_message(
                        user_id, 
                        data.get('description', 'Сообщение от администрации'),
                        parse_mode="HTML",
                        reply_markup=reply_markup
                    )
                sent_count += 1
            except Exception as e:
                print(f"Ошибка отправки пользователю {user_id}: {e}")
                continue
        
        await message.answer(f"✅ Рассылка завершена! Отправлено: {sent_count} из {len(user_ids)} сообщений")
    await state.finish()

# Обработчики кнопок "Пропустить" для индивидуальной рассылки
@dp.callback_query_handler(lambda c: c.data == "skip_individual_photo", state=BroadcastStates.broadcast_individual_photo)
async def skip_individual_photo(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск фото для индивидуальной рассылки"""
    await BroadcastStates.broadcast_individual_description.set()
    await callback.message.answer(
        "📝 Отправьте описание сообщения:",
        reply_markup=broadcast_skip_kb("skip_individual_description")
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_individual_description", state=BroadcastStates.broadcast_individual_description)
async def skip_individual_description(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск описания для индивидуальной рассылки"""
    async with state.proxy() as data:
        data['description'] = 'Сообщение от администрации'
    await BroadcastStates.broadcast_individual_buttons.set()
    await callback.message.answer(
        "🔗 Теперь добавьте кнопки-ссылки для рассылки.\n\n"
        "📝 Отправьте кнопки в формате:\n"
        "Название кнопки - ссылка\n\n"
        "🔸 Пример:\n"
        "Наш сайт - https://example.com\n"
        "Телеграм канал - https://t.me/channel\n\n"
        "📌 Каждую кнопку отправляйте с новой строки\n"
        "⚠️ Или отправьте 'пропустить' если кнопки не нужны",
        reply_markup=broadcast_skip_kb("skip_individual_buttons")
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_individual_buttons", state=BroadcastStates.broadcast_individual_buttons)
async def skip_individual_buttons(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск кнопок для индивидуальной рассылки"""
    async with state.proxy() as data:
        data['buttons'] = []
        user_ids = data['user_ids']
        
        # Отправляем сообщения выбранным пользователям
        sent_count = 0
        for user_id in user_ids:
            try:
                if data.get('photo_id'):
                    await bot.send_photo(
                        user_id,
                        data['photo_id'],
                        caption=data.get('description', 'Сообщение от администрации')
                    )
                else:
                    await bot.send_message(
                        user_id, 
                        data.get('description', 'Сообщение от администрации')
                    )
                sent_count += 1
            except Exception as e:
                print(f"Ошибка отправки пользователю {user_id}: {e}")
                continue
        
        await callback.message.answer(f"✅ Рассылка завершена! Отправлено: {sent_count} из {len(user_ids)} сообщений")
    await state.finish()
    await callback.answer()

# Обработчики ввода новых данных для товара (рассылка)
@dp.message_handler(state=BroadcastStates.broadcast_product_edit_description)
async def process_broadcast_description_edit(message: types.Message, state: FSMContext):
    """Обработка нового описания товара"""
    try:
        new_description = get_formatted_text(message) if message.text else ''
        
        async with state.proxy() as data:
            product_id = data.get('editing_product_id') or data.get('product_id')
            data['broadcast_description'] = new_description
        
        # Возвращаемся к превью товара
        await show_broadcast_product_preview(message, state, product_id)
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
        await state.finish()

@dp.message_handler(state=BroadcastStates.broadcast_product_edit_photo, content_types=['photo', 'animation', 'video'])
async def process_broadcast_photo_edit(message: types.Message, state: FSMContext):
    """Обработка нового фото/анимации/видео товара"""
    try:
        # Определяем тип медиа и получаем file_id
        if message.photo:
            new_photo_id = message.photo[-1].file_id
        elif message.animation:
            new_photo_id = message.animation.file_id
        elif message.video:
            new_photo_id = message.video.file_id
        else:
            new_photo_id = None
        
        async with state.proxy() as data:
            product_id = data.get('editing_product_id') or data.get('product_id')
            data['broadcast_photo_id'] = new_photo_id
        
        # Возвращаемся к превью товара
        await show_broadcast_product_preview(message, state, product_id)
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
        await state.finish()

@dp.message_handler(state=BroadcastStates.broadcast_product_edit_photo)
async def process_broadcast_photo_text(message: types.Message, state: FSMContext):
    """Обработка текстовых команд для фото товара"""
    try:
        if message.text and message.text.lower() in ['удалить', 'delete', 'remove']:
            async with state.proxy() as data:
                product_id = data.get('editing_product_id') or data.get('product_id')
                data['broadcast_photo_id'] = None
            
            # Возвращаемся к превью товара
            await show_broadcast_product_preview(message, state, product_id)
        else:
            await message.answer("📝 Отправьте фото, GIF, видео или напишите 'удалить'")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
        await state.finish()

@dp.message_handler(state=BroadcastStates.broadcast_product_edit_preview)
async def process_broadcast_preview_edit(message: types.Message, state: FSMContext):
    """Обработка новой preview ссылки товара"""
    try:
        if message.text:
            if message.text.lower() in ['удалить', 'delete', 'remove']:
                new_preview_link = None
            else:
                new_preview_link = message.text.strip()
        else:
            new_preview_link = None
        
        async with state.proxy() as data:
            product_id = data.get('editing_product_id') or data.get('product_id')
            data['broadcast_preview_link'] = new_preview_link
        
        # Возвращаемся к превью товара
        await show_broadcast_product_preview(message, state, product_id)
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
        await state.finish()

# Функция показа превью товара для рассылки
async def show_broadcast_product_preview(message_or_callback, state: FSMContext, product_id: int):
    """Показывает превью товара для рассылки с обновленными данными"""
    try:
        async with state.proxy() as data:
            name = data.get('broadcast_name', 'Товар')
            description = data.get('broadcast_description', '')
            photo_id = data.get('broadcast_photo_id')
            preview_link = data.get('broadcast_preview_link')
        
        from keyboards import broadcast_product_edit_kb
        preview_text = f"📎 Превью товара для рассылки:\n\n"
        preview_text += f"🏷 <b>{name}</b>\n\n"
        if description:
            preview_text += f"{description}\n\n"
        if preview_link:
            preview_text += f"🔗 Preview: {preview_link}\n\n"
        preview_text += "⚙️ Вы можете отредактировать любые поля перед рассылкой."
        
        # Устанавливаем состояние обратно к выбору товара
        await BroadcastStates.broadcast_product_selection.set()
        
        # Отправляем медиа если есть
        if photo_id:
            result = await send_media_by_type(
                chat_id=message_or_callback.chat.id if hasattr(message_or_callback, 'chat') else message_or_callback.message.chat.id,
                file_id=photo_id,
                caption=preview_text,
                reply_markup=broadcast_product_edit_kb(product_id),
                parse_mode="HTML"
            )
            if not result:
                await (message_or_callback.answer if hasattr(message_or_callback, 'answer') else message_or_callback.message.answer)(
                    preview_text,
                    reply_markup=broadcast_product_edit_kb(product_id),
                    parse_mode="HTML"
                )
        else:
            await (message_or_callback.answer if hasattr(message_or_callback, 'answer') else message_or_callback.message.answer)(
                preview_text,
                reply_markup=broadcast_product_edit_kb(product_id),
                parse_mode="HTML"
            )
    except Exception as e:
        await (message_or_callback.answer if hasattr(message_or_callback, 'answer') else message_or_callback.message.answer)(
            f"❌ Ошибка: {e}"
        )
        await state.finish()

# Добавляем тестовый обработчик для отладки broadcast функциональности
@dp.callback_query_handler(lambda c: c.data.startswith("test_broadcast_debug_"))
async def test_broadcast_debug(callback: types.CallbackQuery):
    """Тестовый обработчик для отладки broadcast функциональности"""
    product_id = callback.data.split("_")[-1]
    print(f"TEST DEBUG: Received callback for product {product_id}")
    await callback.answer(f"Test debug: product {product_id}", show_alert=True)

# Добавляем обработчик для отладки всех callback'ов
@dp.callback_query_handler(lambda c: c.data.startswith("broadcast_product_confirm_"))
async def broadcast_product_confirm_debug(callback: types.CallbackQuery):
    """Отладочный обработчик для broadcast_product_confirm"""
    print(f"DEBUG: broadcast_product_confirm handler called with data: {callback.data}")
    # Просто передаем управление основному обработчику
    return await broadcast_product_confirm(callback, FSMContext)

# Обработчик подтверждения рассылки товара
@dp.callback_query_handler(lambda c: c.data.startswith("broadcast_product_confirm_"))
async def broadcast_product_confirm(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик подтверждения рассылки товара - немедленная рассылка всем пользователям"""
    print(f"=== BROADCAST PRODUCT CONFIRM HANDLER CALLED ===")
    print(f"Full callback data: {callback.data}")
    print(f"User ID: {callback.from_user.id}")
    print(f"Message ID: {callback.message.message_id if callback.message else 'No message'}")
    
    # Добавляем дополнительную проверку, что callback.data действительно начинается с нужного префикса
    if not callback.data.startswith("broadcast_product_confirm_"):
        print(f"❌ Callback data doesn't match expected pattern: {callback.data}")
        return
    
    try:
        print(f"=== BROADCAST PRODUCT CONFIRM HANDLER STARTED ===")
        print(f"Callback data: {callback.data}")
        print(f"User ID: {callback.from_user.id}")
        print(f"Message ID: {callback.message.message_id}")
        
        product_id = int(callback.data.split("_")[-1])
        print(f"DEBUG: broadcast_product_confirm called with product_id={product_id}")
        print(f"DEBUG: callback.data={callback.data}")
        print(f"DEBUG: current state={await state.get_state()}")
        
        # Получаем данные товара для рассылки из состояния
        async with state.proxy() as data:
            print(f"DEBUG: State data = {dict(data)}")
            name = data.get('broadcast_name', 'Товар')
            description = data.get('broadcast_description', '')
            photo_id = data.get('broadcast_photo_id')
            preview_link = data.get('broadcast_preview_link')
        
        print(f"📋 Данные для рассылки: name={name}, photo_id={photo_id}, preview_link={preview_link}")
        
        # Формируем текст сообщения
        broadcast_text = f"🏷 <b>{name}</b>\n\n"
        if description:
            broadcast_text += f"{description}\n\n"
        
        # Создаем клавиатуру с кнопкой "Купить"
        try:
            from keyboards import product_buy_button_kb
            buy_keyboard = product_buy_button_kb(product_id)
            print(f"✅ Клавиатура создана для товара {product_id}")
        except Exception as e:
            print(f"❌ Ошибка создания клавиатуры: {e}")
            # Создаем клавиатуру вручную как fallback
            buy_keyboard = InlineKeyboardMarkup(row_width=1)
            buy_keyboard.add(
                InlineKeyboardButton("💳 Купить", callback_data=f"buy_product_{product_id}")
            )
        
        # Добавляем preview link если есть
        if preview_link:
            broadcast_text = f"<a href='{preview_link}'>&#8203;</a>{broadcast_text}"
        
        # Отправляем всем пользователям
        print("📥 Получаем список пользователей из базы данных...")
        try:
            users = await db.get_all_users()
            print(f"👥 Найдено пользователей: {len(users)}")
        except Exception as db_error:
            error_message = f"❌ Ошибка получения списка пользователей: {db_error}"
            print(f"🚨 {error_message}")
            await callback.answer(error_message, show_alert=True)
            await state.finish()
            return
        
        sent_count = 0
        
        if not users:
            print("❌ Нет пользователей для рассылки")
            await callback.answer("❌ Нет пользователей для рассылки", show_alert=True)
            await state.finish()
            return
        
        print(f"📤 Начинаем рассылку товара {product_id} всем {len(users)} пользователям")
        for user_id, username in users:
            try:
                if photo_id:
                    print(f"📤 Отправка фото пользователю {user_id}")
                    result = await send_media_by_type(
                        chat_id=user_id,
                        file_id=photo_id,
                        caption=broadcast_text,
                        reply_markup=buy_keyboard,
                        parse_mode="HTML"
                    )
                    if not result:
                        print(f"⚠️ Ошибка отправки фото пользователю {user_id}, отправляем текст")
                        await bot.send_message(
                            user_id,
                            broadcast_text,
                            parse_mode="HTML",
                            reply_markup=buy_keyboard
                        )
                else:
                    print(f"📤 Отправка текста пользователю {user_id}")
                    await bot.send_message(
                        user_id,
                        broadcast_text,
                        parse_mode="HTML",
                        reply_markup=buy_keyboard
                    )
                sent_count += 1
                if sent_count % 10 == 0:  # Логируем каждые 10 отправленных сообщений
                    print(f"📊 Отправлено: {sent_count}/{len(users)}")
            except Exception as e:
                print(f"❌ Ошибка отправки товара пользователю {user_id}: {e}")
                continue
        
        result_message = f"✅ Товар разослан! Отправлено: {sent_count} сообщений"
        print(f"🎉 {result_message}")
        await callback.message.answer(result_message)
        await state.finish()
        await callback.answer("✅ Товар успешно разослан всем пользователям!", show_alert=True)
        print(f"=== BROADCAST PRODUCT CONFIRM HANDLER FINISHED ===")
    except Exception as e:
        error_message = f"❌ Ошибка: {e}"
        print(f"🚨 {error_message}")
        import traceback
        traceback.print_exc()
        await callback.answer(error_message, show_alert=True)
        await state.finish()

# Обработчики рассылки товара (устарели, так как рассылка происходит сразу при подтверждении)
# @dp.callback_query_handler(lambda c: c.data.startswith("broadcast_product_all_"), state=BroadcastStates.broadcast_product_target_selection)
# async def broadcast_product_to_all(callback: types.CallbackQuery, state: FSMContext):
#     """Рассылка товара всем пользователям"""
#     # Этот обработчик больше не используется, так как рассылка происходит сразу при подтверждении
#     pass

# @dp.callback_query_handler(lambda c: c.data.startswith("broadcast_product_individual_"), state=BroadcastStates.broadcast_product_target_selection)
# async def broadcast_product_to_individual(callback: types.CallbackQuery, state: FSMContext):
#     """Начало рассылки товара отдельным пользователям"""
#     # Этот обработчик больше не используется, так как рассылка происходит сразу при подтверждении
#     pass

# Обработчики для редактирования реквизитов
@dp.callback_query_handler(lambda c: c.data == "edit_sbp_phone")
async def edit_sbp_phone_handler(callback: types.CallbackQuery):
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    current_payment_details = await get_current_payment_details()
    await PaymentDetailsStates.waiting_for_sbp_phone.set()
    await callback.message.answer(
        f"📱 Текущий СБП номер: {current_payment_details['sbp_phone']}\n\n"
        "Введите новый номер телефона для СБП:"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_card")
async def edit_card_handler(callback: types.CallbackQuery):
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    current_payment_details = await get_current_payment_details()
    await PaymentDetailsStates.waiting_for_card.set()
    await callback.message.answer(
        f"💳 Текущая карта: {current_payment_details['card']}\n\n"
        "Введите новые реквизиты карты:"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_crypto")
async def edit_crypto_handler(callback: types.CallbackQuery):
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    current_payment_details = await get_current_payment_details()
    await PaymentDetailsStates.waiting_for_crypto.set()
    await callback.message.answer(
        f"₿ Текущий крипто-адрес: {current_payment_details['crypto']}\n\n"
        "Введите новый адрес криптовалюты:"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_stars_url")
async def edit_stars_url_handler(callback: types.CallbackQuery):
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    current_payment_details = await get_current_payment_details()
    await PaymentDetailsStates.waiting_for_stars_url.set()
    await callback.message.answer(
        f"⭐️ Текущая Stars ссылка: {current_payment_details['stars_url']}\n\n"
        "Введите новую ссылку для Stars:"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_stars_provider_token")
async def edit_stars_provider_token_handler(callback: types.CallbackQuery):
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    current_payment_details = await get_current_payment_details()
    current_token = current_payment_details.get('stars_provider_token', '')
    masked_token = current_token[:10] + '...' + current_token[-10:] if len(current_token) > 20 else current_token
    await PaymentDetailsStates.waiting_for_stars_provider_token.set()
    await callback.message.answer(
        f"⭐️ Текущий Stars Provider Token: `{masked_token}`\n\n"
        "Введите новый Stars Provider Token (получить у @BotFather):",
        parse_mode="Markdown"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_cryptobot_url")
async def edit_cryptobot_handler(callback: types.CallbackQuery):
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    current_payment_details = await get_current_payment_details()
    # Сначала просим ввести API токен
    await PaymentDetailsStates.waiting_for_cryptobot_api.set()
    await callback.message.answer(
        "🤖 Введите API токен CryptoBot (Crypto-Pay API Token):\n\n"
        "- Найдите его в приложении Crypto Pay (`@CryptoBot` → Settings → API)\n"
        "- Отправьте сюда строку токена",
        parse_mode="Markdown"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_bitpapa_token")
async def edit_bitpapa_token_handler(callback: types.CallbackQuery):
    """Обработчик редактирования BitPAPA API токена"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Получаем текущий токен
    current_token = await db.get_api_token('bitpapa') or cfg.BITPAPA_API_TOKEN
    masked_token = current_token[:10] + '...' + current_token[-10:] if len(current_token) > 20 else current_token
    
    await PaymentDetailsStates.waiting_for_bitpapa_token.set()
    await callback.message.answer(
        f"🔐 Текущий BitPAPA API Token: `{masked_token}`\n\n"
        "Введите новый BitPAPA API Token:\n\n"
        "📝 Пример: `1wGD6uPJ-xwNPCBUmHDx`\n"
        "ℹ️ Получите токен в личном кабинете BitPAPA",
        parse_mode="Markdown"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "manage_payment_methods")
async def manage_payment_methods_handler(callback: types.CallbackQuery):
    """Обработчик управления методами оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Получаем список методов оплаты из базы данных
    payment_methods = await db.get_all_payment_methods()
    
    # Создаем клавиатуру для управления методами оплаты
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    for method_id, method_name, is_enabled in payment_methods:
        status = "✅" if is_enabled else "❌"
        action = "disable" if is_enabled else "enable"
        keyboard.add(
            InlineKeyboardButton(
                f"{status} {method_name}",
                callback_data=f"toggle_payment_method_{action}_{method_id}"
            )
        )
    
    # Добавляем кнопку для настройки расположения
    keyboard.add(InlineKeyboardButton("⚙️ Настроить расположение", callback_data="configure_payment_layout"))
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="back_to_payment_management"))
    
    await callback.message.edit_text(
        "⚙️ <b>Управление методами оплаты</b>\n\n"
        "Выберите метод оплаты для включения/отключения:\n\n"
        "✅ - Включено\n"
        "❌ - Отключено",
        parse_mode="HTML",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "configure_payment_layout")
async def configure_payment_layout_handler(callback: types.CallbackQuery):
    """Обработчик настройки расположения методов оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Получаем список методов оплаты с их расположением из базы данных
    payment_methods = await db.get_payment_methods_with_layout()
    
    # Создаем клавиатуру для настройки расположения
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    # Группируем методы по рядам для отображения
    layout_dict = {}
    for method_id, method_name, is_enabled, row_number, position_in_row in payment_methods:
        if row_number not in layout_dict:
            layout_dict[row_number] = []
        layout_dict[row_number].append((method_id, method_name, is_enabled, position_in_row))
    
    # Сортируем методы в каждом ряду по позиции
    for row_number in layout_dict:
        layout_dict[row_number].sort(key=lambda x: x[3])
    
    # Добавляем кнопки для каждого метода с информацией о расположении
    for row_number in sorted(layout_dict.keys()):
        for method_id, method_name, is_enabled, position_in_row in layout_dict[row_number]:
            if is_enabled:  # Показываем только включенные методы
                keyboard.add(
                    InlineKeyboardButton(
                        f"📝 {method_name} (Ряд {row_number}, Позиция {position_in_row})",
                        callback_data=f"edit_payment_layout_{method_id}"
                    )
                )
# Добавляем обработчик для кнопки "Настроить расположение методов" в админке
@dp.callback_query_handler(lambda c: c.data == "manage_payment_layout")
async def manage_payment_layout_handler(callback: types.CallbackQuery):
    """Обработчик для настройки расположения методов оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Перенаправляем к существующему обработчику настройки расположения
    await configure_payment_layout_handler(callback)


async def configure_payment_layout_handler(callback: types.CallbackQuery):
    """Обработчик настройки расположения методов оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    keyboard = InlineKeyboardMarkup()
    payment_methods = await get_payment_methods()
    for method in payment_methods:
        keyboard.add(InlineKeyboardButton(
            method.name,
            callback_data=f"edit_payment_layout_{method.id}"
        ))
    
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="manage_payment_methods"))
    
    await callback.message.edit_text(
        "⚙️ <b>Настройка расположения методов оплаты</b>\n\n"
        "Выберите метод оплаты для изменения его расположения:",
        parse_mode="HTML",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("edit_payment_layout_"))
async def edit_payment_layout_handler(callback: types.CallbackQuery):
    """Обработчик редактирования расположения конкретного метода оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Разбираем callback_data
    method_id = callback.data.split("_")[3]
    
    # Получаем информацию о методе оплаты
    payment_methods = await db.get_payment_methods_with_layout()
    method_info = None
    for mid, mname, menabled, mrow, mpos in payment_methods:
        if mid == method_id:
            method_info = (mid, mname, menabled, mrow, mpos)
            break
    
    if not method_info:
        await callback.answer("❌ Метод оплаты не найден", show_alert=True)
        return
    
    method_id, method_name, is_enabled, current_row, current_pos = method_info
    
    # Создаем клавиатуру для выбора ряда и позиции
    keyboard = InlineKeyboardMarkup(row_width=3)
    
    # Кнопки для выбора ряда (1-5)
    keyboard.row(
        InlineKeyboardButton("1️⃣ Ряд 1", callback_data=f"set_payment_row_{method_id}_1"),
        InlineKeyboardButton("2️⃣ Ряд 2", callback_data=f"set_payment_row_{method_id}_2"),
        InlineKeyboardButton("3️⃣ Ряд 3", callback_data=f"set_payment_row_{method_id}_3")
    )
    keyboard.row(
        InlineKeyboardButton("4️⃣ Ряд 4", callback_data=f"set_payment_row_{method_id}_4"),
        InlineKeyboardButton("5️⃣ Ряд 5", callback_data=f"set_payment_row_{method_id}_5")
    )
    
    # Кнопки для выбора позиции (1-3)
    keyboard.row(
        InlineKeyboardButton("1️⃣ Позиция 1", callback_data=f"set_payment_pos_{method_id}_1"),
        InlineKeyboardButton("2️⃣ Позиция 2", callback_data=f"set_payment_pos_{method_id}_2"),
        InlineKeyboardButton("3️⃣ Позиция 3", callback_data=f"set_payment_pos_{method_id}_3")
    )
    
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="configure_payment_layout"))
    
    await callback.message.edit_text(
        f"⚙️ <b>Настройка расположения метода оплаты</b>\n\n"
        f"<b>Метод:</b> {method_name}\n"
        f"<b>Текущее расположение:</b> Ряд {current_row}, Позиция {current_pos}\n\n"
        f"Выберите новый ряд и позицию для метода:",
        parse_mode="HTML",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("set_payment_row_"))
async def set_payment_row_handler(callback: types.CallbackQuery):
    """Обработчик установки ряда для метода оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Разбираем callback_data
    parts = callback.data.split("_")
    if len(parts) < 5:
        await callback.answer("❌ Неверные данные", show_alert=True)
        return
    
    method_id = parts[3]
    row_number = int(parts[4])
    
    # Получаем текущую позицию метода
    layout = await db.get_payment_layout()
    current_pos = layout.get(method_id, (1, 1))[1] if method_id in layout else 1
    
    # Обновляем расположение метода оплаты в базе данных
    await db.update_payment_method_layout(method_id, row_number, current_pos)
    
    await callback.answer(f"✅ Ряд для метода оплаты установлен: {row_number}", show_alert=True)
    
    # Возвращаем к настройке расположения
    await edit_payment_layout_handler(callback)

@dp.callback_query_handler(lambda c: c.data.startswith("set_payment_pos_"))
async def set_payment_pos_handler(callback: types.CallbackQuery):
    """Обработчик установки позиции для метода оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Разбираем callback_data
    parts = callback.data.split("_")
    if len(parts) < 5:
        await callback.answer("❌ Неверные данные", show_alert=True)
        return
    
    method_id = parts[3]
    position_in_row = int(parts[4])
    
    # Получаем текущий ряд метода
    layout = await db.get_payment_layout()
    current_row = layout.get(method_id, (1, 1))[0] if method_id in layout else 1
    
    # Обновляем расположение метода оплаты в базе данных
    await db.update_payment_method_layout(method_id, current_row, position_in_row)
    
    await callback.answer(f"✅ Позиция для метода оплаты установлена: {position_in_row}", show_alert=True)
    
    # Возвращаем к настройке расположения
    await edit_payment_layout_handler(callback)

@dp.callback_query_handler(lambda c: c.data.startswith("toggle_payment_method_"))
async def toggle_payment_method_handler(callback: types.CallbackQuery):
    """Обработчик включения/отключения метода оплаты"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Разбираем callback_data
    parts = callback.data.split("_")
    if len(parts) < 5:
        await callback.answer("❌ Неверные данные", show_alert=True)
        return
    
    action = parts[3]  # enable или disable
    method_id = "_".join(parts[4:])  # ID метода
    
    # Определяем новое состояние
    is_enabled = (action == "enable")
    
    # Получаем имя метода из базы данных
    payment_methods = await db.get_all_payment_methods()
    method_name = method_id  # fallback
    for mid, mname, menabled in payment_methods:
        if mid == method_id:
            method_name = mname
            break
    
    # Обновляем статус метода оплаты в базе данных
    await db.toggle_payment_method(method_id, is_enabled)
    
    # Показываем сообщение о результате
    if is_enabled:
        await callback.answer(f"✅ Метод оплаты {method_name} включен", show_alert=True)
    else:
        await callback.answer(f"❌ Метод оплаты {method_name} отключен", show_alert=True)
    
    # Возвращаем к управлению методами оплаты
    await manage_payment_methods_handler(callback)

@dp.callback_query_handler(lambda c: c.data == "back_to_payment_management")
async def back_to_payment_management_handler(callback: types.CallbackQuery):
    """Обработчик возврата к управлению реквизитами"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Получаем текущие реквизиты
    current_details = await get_current_payment_details()
    
    # Маскируем Stars Provider Token для безопасности
    stars_token = current_details.get('stars_provider_token', '')
    masked_stars_token = stars_token[:10] + '...' + stars_token[-10:] if len(stars_token) > 20 else stars_token
    
    # Получаем и маскируем BitPAPA API Token
    bitpapa_token = await db.get_api_token('bitpapa') or cfg.BITPAPA_API_TOKEN
    masked_bitpapa_token = bitpapa_token[:10] + '...' + bitpapa_token[-10:] if len(bitpapa_token) > 20 else bitpapa_token
    
    details_text = (
        "💳 **Управление реквизитами**\n\n"
        f"📱 **СБП по номеру:** `{current_details['sbp_phone']}`\n"
        f"💳 **Карта:** `{current_details['card']}`\n"
        f"₿ **Криптовалюта:** `{current_details['crypto']}`\n"
        f"⭐️ **Stars URL:** `{current_details['stars_url']}`\n"
        f"🔑 **Stars Provider Token:** `{masked_stars_token}`\n"
        f"🤖 **CryptoBot URL:** `{current_details['cryptobot_url']}`\n"
        f"🔐 **BitPAPA API Token:** `{masked_bitpapa_token}`\n\n"
        "Выберите реквизит для редактирования:"
    )
    
    from keyboards import admin_payment_management_kb
    await callback.message.edit_text(
        details_text,
        reply_markup=admin_payment_management_kb(),
        parse_mode="Markdown"
    )
    await callback.answer()

# Обработчики ввода новых реквизитов
@dp.message_handler(state=PaymentDetailsStates.waiting_for_sbp_phone)
async def process_sbp_phone(message: types.Message, state: FSMContext):
    await db.set_payment_details("sbp_phone", message.text)
    await message.answer(f"✅ СБП номер обновлен: {message.text}")
    await state.finish()

@dp.message_handler(state=PaymentDetailsStates.waiting_for_card)
async def process_card(message: types.Message, state: FSMContext):
    await db.set_payment_details("card", message.text)
    await message.answer(f"✅ Реквизиты карты обновлены: {message.text}")
    await state.finish()

@dp.message_handler(state=PaymentDetailsStates.waiting_for_crypto)
async def process_crypto(message: types.Message, state: FSMContext):
    await db.set_payment_details("crypto", message.text)
    await message.answer(f"✅ Крипто-адрес обновлен: {message.text}")
    await state.finish()

@dp.message_handler(state=PaymentDetailsStates.waiting_for_stars_url)
async def process_stars_url(message: types.Message, state: FSMContext):
    await db.set_payment_details("stars_url", message.text)
    await message.answer(f"✅ Stars ссылка обновлена: {message.text}")
    await state.finish()

@dp.message_handler(state=PaymentDetailsStates.waiting_for_stars_provider_token)
async def process_stars_provider_token(message: types.Message, state: FSMContext):
    token = (message.text or '').strip()
    if len(token) < 20:
        await message.answer("❌ Похоже, это не похоже на валидный Stars Provider Token. Отправьте полный токен.")
        return
    # Сохраняем токен в БД
    await db.set_payment_details("stars_provider_token", token)
    masked_token = token[:10] + '...' + token[-10:] if len(token) > 20 else token
    await message.answer(f"✅ Stars Provider Token обновлён: `{masked_token}`", parse_mode="Markdown")
    await state.finish()

@dp.message_handler(state=PaymentDetailsStates.waiting_for_cryptobot_url)
async def process_cryptobot_url(message: types.Message, state: FSMContext):
    await db.set_payment_details("cryptobot_url", message.text)
    await message.answer(f"✅ CryptoBot ссылка обновлена: {message.text}")
    await state.finish()

@dp.message_handler(state=PaymentDetailsStates.waiting_for_cryptobot_api)
async def process_cryptobot_api(message: types.Message, state: FSMContext):
    token = (message.text or '').strip()
    if len(token) < 20:
        await message.answer("❌ Похоже, это не похоже на валидный токен. Отправьте полный токен.")
        return
    # Сохраняем токен в БД
    await db.set_payment_details("cryptobot_api_key", token)
    # Пытаемся проверить подключение и получить имя приложения
    app_name = None
    try:
        import aiohttp
        headers = {"Crypto-Pay-API-Token": token}
        async with aiohttp.ClientSession() as session:
            async with session.get("https://pay.crypt.bot/api/getMe", headers=headers) as resp:
                data = await resp.json()
                if data.get("ok"):
                    app_name = data.get("result", {}).get("name")
    except Exception:
        pass
    # Сообщаем результат
    if app_name:
        await message.answer(f"✅ CryptoBot подключен успешно: {app_name}")
    else:
        await message.answer("⚠️ Токен сохранён. Не удалось подтвердить имя приложения сейчас, проверьте позже.")
    # Далее просим ссылку (как и раньше)
    await PaymentDetailsStates.waiting_for_cryptobot_url.set()
    current_payment_details = await get_current_payment_details()
    await message.answer(
        f"🔗 Текущая CryptoBot ссылка: {current_payment_details['cryptobot_url']}\n\n"
        "Введите новую ссылку для CryptoBot (например, на ваш бот или сайт):"
    )

@dp.message_handler(state=PaymentDetailsStates.waiting_for_bitpapa_token)
async def process_bitpapa_token(message: types.Message, state: FSMContext):
    """Обработчик нового BitPAPA API токена"""
    token = (message.text or '').strip()
    if len(token) < 10:
        await message.answer("❌ Похоже, это не похоже на валидный BitPAPA API Token. Отправьте полный токен.")
        return
    
    # Сохраняем токен в БД
    await db.set_api_token('bitpapa', token)
    
    # Обновляем токен в bitpapa_api
    from bitpapa_api import bitpapa_api
    bitpapa_api.api_token = token
    
    # Пытаемся проверить подключение
    try:
        from bitpapa_handlers import test_bitpapa_connection
        connection_result = await test_bitpapa_connection()
        
        # Маскируем токен для отображения
        masked_token = token[:10] + '...' + token[-10:] if len(token) > 20 else token
        
        if "✅" in connection_result:
            await message.answer(
                f"✅ BitPAPA API Token обновлён: `{masked_token}`\n\n"
                f"{connection_result}",
                parse_mode="Markdown"
            )
        else:
            await message.answer(
                f"⚠️ BitPAPA API Token сохранён: `{masked_token}`\n\n"
                f"{connection_result}\n\n"
                "Проверьте правильность токена в личном кабинете BitPAPA.",
                parse_mode="Markdown"
            )
            
    except Exception as e:
        masked_token = token[:10] + '...' + token[-10:] if len(token) > 20 else token
        await message.answer(
            f"⚠️ BitPAPA API Token сохранён: `{masked_token}`\n\n"
            f"❌ Ошибка проверки подключения: {e}\n\n"
            "Проверьте правильность токена.",
            parse_mode="Markdown"
        )
    
    await state.finish()

@dp.message_handler(lambda message: message.text and message.text.startswith("/test_preview"))
async def test_preview_command(message: types.Message):
    """Команда для тестирования preview link"""
    # Проверяем права админа
    if not await is_user_admin(message.from_user.id):
        return
        
    try:
        # Пример: /test_preview https://example.com Описание товара
        if not message.text:
            await message.answer("Использование: /test_preview <url> <текст>")
            return
            
        parts = message.text.split(" ", 2)
        if len(parts) < 3:
            await message.answer("Использование: /test_preview <url> <текст>")
            return
            
        url = parts[1]
        text = parts[2]
        
        # Тестируем форматирование
        formatted_text = format_description_with_preview(text, url)
        
        await message.answer(
            f"🖼️ Тест preview link:\n\n{formatted_text}",
            parse_mode="HTML"
        )
        
    except Exception as e:
        await message.answer(f"Ошибка: {e}")

@dp.message_handler(lambda message: message.reply_to_message and message.reply_to_message.text and "Введите ответ для пользователя" in message.reply_to_message.text)
async def send_admin_reply(message: types.Message):
    # Проверяем права админа
    if not await is_user_admin(message.from_user.id):
        return
        
    try:
        user_id = int(message.reply_to_message.text.split("ID: ")[1].split(")")[0])
        await bot.send_message(
            chat_id=user_id,
            text=f"📩 Ответ от администратора:\n\n{message.text}"
        )
        await message.answer("✅ Ответ отправлен пользователю")
    except Exception as e:
        await message.answer(f"❌ Ошибка отправки: {e}")


@dp.message_handler(lambda message: message.text and message.text.startswith("/send"))
async def send_command_handler(message: types.Message):
    """Обработчик команды /send для админа"""
    # Проверяем права админа
    if not await is_user_admin(message.from_user.id):
        return
        
    await message.answer(
        "📢 Рассылка сообщений\n\nВыберите тип рассылки:",
        reply_markup=broadcast_main_kb()
    )

@dp.message_handler(lambda message: message.text and message.text.startswith("/cards"))
async def cards_command_handler(message: types.Message):
    """Обработчик команды /cards для управления реквизитами"""
    # Проверяем права админа
    if not await is_user_admin(message.from_user.id):
        await message.answer("❌ У вас нет прав администратора")
        return
    
    # Получаем текущие реквизиты
    current_details = await get_current_payment_details()
    
    # Маскируем Stars Provider Token для безопасности
    stars_token = current_details.get('stars_provider_token', '')
    masked_stars_token = stars_token[:10] + '...' + stars_token[-10:] if len(stars_token) > 20 else stars_token
    
    # Получаем и маскируем BitPAPA API Token
    bitpapa_token = await db.get_api_token('bitpapa') or cfg.BITPAPA_API_TOKEN
    masked_bitpapa_token = bitpapa_token[:10] + '...' + bitpapa_token[-10:] if len(bitpapa_token) > 20 else bitpapa_token
    
    details_text = (
        "💳 **Управление реквизитами**\n\n"
        f"📱 **СБП по номеру:** `{current_details['sbp_phone']}`\n"
        f"💳 **Карта:** `{current_details['card']}`\n"
        f"₿ **Криптовалюта:** `{current_details['crypto']}`\n"
        f"⭐️ **Stars URL:** `{current_details['stars_url']}`\n"
        f"🔑 **Stars Provider Token:** `{masked_stars_token}`\n"
        f"🤖 **CryptoBot URL:** `{current_details['cryptobot_url']}`\n"
        f"🔐 **BitPAPA API Token:** `{masked_bitpapa_token}`\n\n"
        "Выберите реквизит для редактирования:"
    )
    
    await message.answer(
        details_text,
        reply_markup=admin_payment_management_kb(),
        parse_mode="Markdown"
    )

@dp.callback_query_handler(lambda c: c.data == "broadcast_all_users")
async def broadcast_all_users_handler(callback: types.CallbackQuery):
    """Обработчик рассылки всем пользователям"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await BroadcastStates.broadcast_all_photo.set()
    await callback.message.answer(
        "📢 Рассылка всем пользователям\n\n"
        "📎 Отправьте фото или документ (zip, txt, doc), который будет прикреплён к сообщению.",
        reply_markup=broadcast_skip_kb("skip_all_photo")
    )
    await callback.answer()

@dp.message_handler(lambda message: message.text and message.text.startswith("/admins"))
async def admins_command_handler(message: types.Message):
    """Обработчик команды /admins для админа"""
    # Проверяем права админа
    if not await is_user_admin(message.from_user.id):
        return
        
    try:
        # Получаем список всех администраторов
        admins = await db.get_all_admins()
        
        admin_count = len(admins)
        admin_text = f"👥 Административный состав\n\n📊 Всего админов: {admin_count}\n\n"
        
        if admin_count > 0:
            admin_text += "👥 Список администраторов:\n"
            for i, admin in enumerate(admins[:5], 1):  # Показываем первые 5
                user_id, username, added_by, added_at = admin
                display_name = username if username else f"ID: {user_id}"
                admin_text += f"{i}. {display_name} ({added_at})\n"
            
            if admin_count > 5:
                admin_text += f"\n… и ещё {admin_count - 5} админов"
        else:
            admin_text += "ℹ️ Настроен только главный администратор"
        
        admin_text += "\n\nВыберите действие:"
        
        await message.answer(
            admin_text,
            reply_markup=admin_management_kb()
        )
        
    except Exception as e:
        await message.answer(f"❌ Ошибка получения списка админов: {e}")

@dp.message_handler(lambda message: message.text and message.text == "/edit")
async def edit_command_handler(message: types.Message):
    """Обработчик команды /edit для админа"""
    # Проверяем права админа
    if not await is_user_admin(message.from_user.id):
        return
        
    try:
        await message.answer(
            "⚙️ Панель редактирования\n\nВыберите, что хотите изменить:",
            reply_markup=edit_start_menu_kb()
        )
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")

@dp.message_handler(lambda message: message.text and message.text == "/send")
async def send_command_handler(message: types.Message):
    """Обработчик команды /send для админа"""
    if not await is_user_admin(message.from_user.id):
        return
    try:
        keyboard = InlineKeyboardMarkup(row_width=1)
        keyboard.add(
            InlineKeyboardButton("📢 Всем пользователям", callback_data="broadcast_all_users"),
            InlineKeyboardButton("👤 Отдельному пользователю", callback_data="broadcast_individual_user"),
            InlineKeyboardButton("📎 Разослать товар", callback_data="broadcast_product")
        )
        
        await message.answer(
            "📢 Рассылка сообщений\n\nВыберите тип рассылки:",
            reply_markup=keyboard
        )
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")

@dp.callback_query_handler(lambda c: c.data == "edit_welcome_message")
async def edit_welcome_message_handler(callback: types.CallbackQuery):
    """Обработчик кнопки 'Изменить /start'"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    # Получаем текущие настройки
    welcome_settings = await db.get_welcome_settings()
    
    sticker_status = "✅ Установлен" if welcome_settings.get('sticker_id') else "❌ Не установлен"
    photo_status = "✅ Установлено" if welcome_settings.get('photo_id') else "🖼️ Стандартное"
    text_preview = (welcome_settings.get('text') or cfg.WELCOME_TEXT)[:50] + "..." if len(welcome_settings.get('text') or cfg.WELCOME_TEXT) > 50 else (welcome_settings.get('text') or cfg.WELCOME_TEXT)
    
    await callback.message.edit_text(
        f"✏️ Редактирование приветственного сообщения\n\n"
        f"🎁 Стикер: {sticker_status}\n"
        f"🖼️ Фото: {photo_status}\n"
        f"📝 Текст: {text_preview}\n\n"
        "Выберите компонент для редактирования:",
        reply_markup=edit_welcome_components_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_welcome_sticker")
async def edit_welcome_sticker_handler(callback: types.CallbackQuery):
    """Обработчик изменения стикера"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await WelcomeEditStates.waiting_for_sticker.set()
    await callback.message.answer(
        "🎁 Отправьте стикер, который будет отображаться перед приветственным сообщением.\n\n"
        "Для удаления стикера напишите: <code>удалить</code>",
        parse_mode="HTML"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_welcome_photo")
async def edit_welcome_photo_handler(callback: types.CallbackQuery):
    """Обработчик изменения фото"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await WelcomeEditStates.waiting_for_photo.set()
    await callback.message.answer(
        "🖼️ Отправьте фото, которое будет отображаться в приветственном сообщении.\n\n"
        "Для возврата к стандартному фото напишите: <code>стандарт</code>",
        parse_mode="HTML"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_catalog_photo")
async def edit_catalog_photo_handler(callback: types.CallbackQuery):
    """Обработчик изменения фото каталога"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await WelcomeEditStates.waiting_for_catalog_photo.set()
    
    # Получаем текущее фото каталога
    current_photo_id = await db.get_bot_setting("catalog_photo_id")
    if current_photo_id:
        photo_status = f"✅ Установлено (ID: {current_photo_id[:20]}...)"
    else:
        photo_status = "🖼️ Стандартное (image/katalog.png)"
    
    await callback.message.answer(
        f"🖼️ Отправьте новое фото для каталога.\n\n"
        f"📷 Текущее состояние: {photo_status}\n\n"
        "📝 Для возврата к стандартному фото напишите: <code>стандарт</code>",
        parse_mode="HTML"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_bonus_system")
async def edit_bonus_system_handler(callback: types.CallbackQuery):
    """Обработчик редактирования системы бонусов"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Получаем текущие настройки
    bonus_sticker_id = await db.get_bot_setting("bonus_sticker_id")
    bonus_photo_id = await db.get_bot_setting("bonus_photo_id")
    bonus_description = await db.get_bot_setting("bonus_description")
    
    sticker_status = "✅ Установлен" if bonus_sticker_id else "❌ Не установлен"
    photo_status = "✅ Установлено" if bonus_photo_id else "❌ Не установлено"
    description_preview = (bonus_description[:50] + "...") if bonus_description and len(bonus_description) > 50 else (bonus_description or "❌ Не установлено")
    
    await callback.message.edit_text(
        f"🎁 Настройка системы бонусов\n\n"
        f"🎁 Стикер: {sticker_status}\n"
        f"🖼️ Фото: {photo_status}\n"
        f"📝 Описание: {description_preview}\n\n"
        "Выберите компонент для редактирования:",
        reply_markup=bonus_system_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_bonus_sticker")
async def edit_bonus_sticker_handler(callback: types.CallbackQuery):
    """Обработчик изменения стикера бонусов"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await BonusSystemStates.waiting_for_bonus_sticker.set()
    from keyboards import create_skip_cancel_kb
    keyboard = create_skip_cancel_kb("skip_bonus_sticker", "cancel_bonus_edit")
    keyboard.add(InlineKeyboardButton("🚫 Удалить стикер", callback_data="delete_bonus_sticker"))
    
    await callback.message.answer(
        "🎁 Отправьте стикер для системы бонусов:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_bonus_photo")
async def edit_bonus_photo_handler(callback: types.CallbackQuery):
    """Обработчик изменения фото бонусов"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await BonusSystemStates.waiting_for_bonus_photo.set()
    from keyboards import create_skip_cancel_kb
    keyboard = create_skip_cancel_kb("skip_bonus_photo", "cancel_bonus_edit")
    keyboard.add(InlineKeyboardButton("🚫 Удалить фото", callback_data="delete_bonus_photo"))
    
    await callback.message.answer(
        "🖼️ Отправьте фото для системы бонусов:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_bonus_description")
async def edit_bonus_description_handler(callback: types.CallbackQuery):
    """Обработчик изменения описания бонусов"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await BonusSystemStates.waiting_for_bonus_description.set()
    
    current_description = await db.get_bot_setting("bonus_description") or "Не установлено"
    
    await callback.message.answer(
        f"📝 Отправьте описание для системы бонусов.\n\n"
        f"✨ <b>Поддерживается форматирование Telegram!</b>\n\n"
        f"📋 Текущее описание:\n{current_description}",
        parse_mode="HTML",
        reply_markup=back_to_bonus_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "edit_welcome_text")
async def edit_welcome_text_handler(callback: types.CallbackQuery):
    """Обработчик изменения текста"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await WelcomeEditStates.waiting_for_text.set()
    
    current_text = await db.get_bot_setting("welcome_text") or cfg.WELCOME_TEXT
    
    await callback.message.answer(
        f"📝 Отправьте новый текст приветственного сообщения.\n\n"
        f"✨ <b>Поддерживается форматирование Telegram!</b>\n"
        f"Используйте кнопки форматирования в Telegram для оформления текста.\n\n"
        f"Текущий текст:\n{current_text}",
        parse_mode="HTML"
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_edit_menu", state="*")
async def back_to_edit_menu_handler(callback: types.CallbackQuery):
    """Возврат к главному меню редактирования"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await callback.message.edit_text(
        "⚙️ Панель редактирования\n\nВыберите, что хотите изменить:",
        reply_markup=edit_start_menu_kb()
    )

# Обработчики состояний для редактирования приветственного сообщения

# Обработчики для управления администраторами
@dp.callback_query_handler(lambda c: c.data == "add_admin")
async def add_admin_handler(callback: types.CallbackQuery):
    """Обработчик кнопки 'Добавить админа'"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await AdminManagementStates.waiting_for_admin_id.set()
    await callback.message.answer(
        "➕ Добавление нового администратора\n\n"
        "Введите ID пользователя, которого хотите назначить администратором:\n\n"
        "📝 <b>Пример:</b> 123456789\n\n"
        "ℹ️ Для отмены напишите: <code>отмена</code>",
        parse_mode="HTML",
        reply_markup=back_to_admin_management_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "remove_admin")
async def remove_admin_handler(callback: types.CallbackQuery):
    """Обработчик кнопки 'Удалить админа'"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await AdminManagementStates.waiting_for_remove_admin_id.set()
    await callback.message.answer(
        "❌ Удаление администратора\n\n"
        "Введите ID пользователя, которого хотите удалить из администраторов:\n\n"
        "📝 <b>Пример:</b> 123456789\n\n"
        "⚠️ <b>Внимание:</b> Нельзя удалить главного администратора\n\n"
        "ℹ️ Для отмены напишите: <code>отмена</code>",
        parse_mode="HTML",
        reply_markup=back_to_admin_management_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "list_admins")
async def list_admins_handler(callback: types.CallbackQuery):
    """Обработчик кнопки 'Список админов'"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    try:
        admins = await db.get_all_admins()
        
        if not admins:
            await callback.message.edit_text(
                "👥 Список администраторов\n\n"
                "ℹ️ Настроен только главный администратор",
                reply_markup=back_to_admin_management_kb()
            )
        else:
            admin_text = f"👥 Список администраторов ({len(admins)})\n\n"
            
            for i, admin in enumerate(admins, 1):
                user_id, username, added_by, added_at = admin
                display_name = username if username else f"ID: {user_id}"
                
                if user_id == cfg.ADMIN_ID:
                    admin_text += f"{i}. 🔒 {display_name} (Главный)\n"
                else:
                    admin_text += f"{i}. {display_name} (Добавлен: {added_at})\n"
            
            # Используем клавиатуру с возможностью удаления
            from keyboards import admin_list_kb
            await callback.message.edit_text(
                admin_text,
                reply_markup=admin_list_kb(admins)
            )
            
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "back_to_admin_management", state="*")
async def back_to_admin_management_handler(callback: types.CallbackQuery, state: FSMContext):
    """Возврат к главному меню управления админами"""
    # Проверяем права админа
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    await state.finish()  # Очищаем любое состояние
    
    try:
        admins = await db.get_all_admins()
        admin_count = len(admins)
        
        admin_text = f"👥 Административный состав\n\n📊 Всего админов: {admin_count}\n\n"
        
        if admin_count > 0:
            admin_text += "👥 Список администраторов:\n"
            for i, admin in enumerate(admins[:5], 1):
                user_id, username, added_by, added_at = admin
                display_name = username if username else f"ID: {user_id}"
                admin_text += f"{i}. {display_name} ({added_at})\n"
            
            if admin_count > 5:
                admin_text += f"\n… и ещё {admin_count - 5} админов"
        
        admin_text += "\n\nВыберите действие:"
        
        await callback.message.edit_text(
            admin_text,
            reply_markup=admin_management_kb()
        )
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()
# Обработчики для стикеров в каталоге
@dp.message_handler(state=CatalogAddStates.waiting_for_sticker, content_types=types.ContentType.STICKER)
async def process_catalog_sticker(message: types.Message, state: FSMContext):
    """Обработка стикера для элемента каталога"""
    async with state.proxy() as data:
        data['sticker_id'] = message.sticker.file_id
    
    from keyboards import create_skip_cancel_kb
    await message.answer(
        f"✅ Стикер принят!\n\nID стикера: <code>{message.sticker.file_id}</code>\n\nТеперь отправьте фото, GIF или видео для элемента:",
        parse_mode="HTML",
        reply_markup=create_skip_cancel_kb("skip_photo", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_photo.set()

@dp.message_handler(state=CatalogAddStates.waiting_for_sticker)
async def process_catalog_sticker_text(message: types.Message, state: FSMContext):
    """Обработка текстового ввода для стикера"""
    if message.text and message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
        async with state.proxy() as data:
            data['sticker_id'] = None
        
        from keyboards import create_skip_cancel_kb
        await message.answer(
            "✅ Стикер пропущен.\n\nТеперь отправьте фото, GIF или видео для элемента:",
            reply_markup=create_skip_cancel_kb("skip_photo", "cancel_catalog_creation")
        )
        await CatalogAddStates.waiting_for_photo.set()
    elif message.text:
        # Проверяем, что это валидный file_id
        if len(message.text) > 20:  # Минимальная длина file_id
            async with state.proxy() as data:
                data['sticker_id'] = message.text.strip()
            
            from keyboards import create_skip_cancel_kb
            await message.answer(
                f"✅ ID стикера принят!\n\nID: <code>{message.text.strip()}</code>\n\nТеперь отправьте фото, GIF или видео для элемента:",
                parse_mode="HTML",
                reply_markup=create_skip_cancel_kb("skip_photo", "cancel_catalog_creation")
            )
            await CatalogAddStates.waiting_for_photo.set()
        else:
            await message.answer(
                "❌ Ошибка: Отправьте стикер, валидный ID стикера или используйте кнопку 'Пропустить'."
            )
    else:
        await message.answer(
            "❌ Ошибка: Отправьте стикер, ID стикера или используйте кнопку 'Пропустить'."
        )

@dp.message_handler(state=WelcomeEditStates.waiting_for_sticker, content_types=types.ContentType.STICKER)
async def process_welcome_sticker(message: types.Message, state: FSMContext):
    """Обработка нового стикера"""
    await db.set_bot_setting("welcome_sticker_id", message.sticker.file_id)
    await message.answer(
        f"✅ Стикер успешно обновлён!\n\nID стикера: <code>{message.sticker.file_id}</code>",
        parse_mode="HTML"
    )
    await state.finish()

@dp.message_handler(state=WelcomeEditStates.waiting_for_sticker)
async def process_welcome_sticker_text(message: types.Message, state: FSMContext):
    """Обработка текстовой команды для стикера"""
    if message.text and message.text.lower() in ['удалить', 'delete', 'remove']:
        await db.set_bot_setting("welcome_sticker_id", None)
        await message.answer("✅ Стикер удалён. При запуске /start стикер отображаться не будет.")
    else:
        await message.answer("❌ Ошибка: Отправьте стикер или напишите 'удалить' для удаления стикера.")
        return
    await state.finish()

# Обработчики для фото в каталоге
@dp.message_handler(state=CatalogAddStates.waiting_for_photo, content_types=types.ContentType.PHOTO)
async def process_catalog_photo(message: types.Message, state: FSMContext):
    """Обработка фото для элемента каталога"""
    # Берём самое высокое разрешение фото
    photo_id = message.photo[-1].file_id
    
    async with state.proxy() as data:
        data['photo_id'] = photo_id
    
    await message.answer(
        f"✅ Фото принято!\n\nID фото: <code>{photo_id}</code>\n\nТеперь введите название элемента:",
        parse_mode="HTML",
        reply_markup=create_skip_cancel_kb("skip_name", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_name.set()

# Обработчик для GIF/анимации в каталоге
@dp.message_handler(state=CatalogAddStates.waiting_for_photo, content_types=types.ContentType.ANIMATION)
async def process_catalog_animation(message: types.Message, state: FSMContext):
    """Обработка GIF/анимации для элемента каталога"""
    animation_id = message.animation.file_id
    
    async with state.proxy() as data:
        data['photo_id'] = animation_id  # Используем то же поле для хранения
    
    await message.answer(
        f"✅ GIF принято!\n\nID анимации: <code>{animation_id}</code>\n\nТеперь введите название элемента:",
        parse_mode="HTML",
        reply_markup=create_skip_cancel_kb("skip_name", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_name.set()

# Обработчик для видео в каталоге
@dp.message_handler(state=CatalogAddStates.waiting_for_photo, content_types=types.ContentType.VIDEO)
async def process_catalog_video(message: types.Message, state: FSMContext):
    """Обработка видео для элемента каталога"""
    video_id = message.video.file_id
    
    async with state.proxy() as data:
        data['photo_id'] = video_id  # Используем то же поле для хранения
    
    await message.answer(
        f"✅ Видео принято!\n\nID видео: <code>{video_id}</code>\n\nТеперь введите название элемента:",
        parse_mode="HTML",
        reply_markup=create_skip_cancel_kb("skip_name", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_name.set()

@dp.callback_query_handler(lambda c: c.data == "skip_photo", state=CatalogAddStates.waiting_for_photo)
async def skip_catalog_photo(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить фото/GIF/видео"""
    async with state.proxy() as data:
        data['photo_id'] = None
    
    from keyboards import create_skip_cancel_kb
    await callback.message.edit_text(
        "✅ Медиа пропущено.\n\nТеперь введите название элемента:",
        reply_markup=create_skip_cancel_kb("skip_name", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_name.set()
    await callback.answer()

@dp.message_handler(state=CatalogAddStates.waiting_for_photo)
async def process_catalog_photo_text(message: types.Message, state: FSMContext):
    """Обработка текстового ввода для фото/GIF/видео"""
    if message.text and message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
        async with state.proxy() as data:
            data['photo_id'] = None
        
        from keyboards import create_skip_cancel_kb
        await message.answer(
            "✅ Медиа пропущено.\n\nТеперь введите название элемента:",
            reply_markup=create_skip_cancel_kb("skip_name", "cancel_catalog_creation")
        )
        await CatalogAddStates.waiting_for_name.set()
    elif message.text:
        # Проверяем, что это валидный photo_id/animation_id/video_id
        if len(message.text) > 20:  # Минимальная длина file_id
            async with state.proxy() as data:
                data['photo_id'] = message.text.strip()
            
            from keyboards import create_skip_cancel_kb
            await message.answer(
                f"✅ ID медиа-файла принят!\n\nID: <code>{message.text.strip()}</code>\n\nТеперь введите название элемента:",
                parse_mode="HTML",
                reply_markup=create_skip_cancel_kb("skip_name", "cancel_catalog_creation")
            )
            await CatalogAddStates.waiting_for_name.set()
        else:
            await message.answer(
                "❌ Ошибка: Отправьте фото, GIF, видео, валидный ID медиа-файла или используйте кнопку 'Пропустить'."
            )
    else:
        await message.answer(
            "❌ Ошибка: Отправьте фото, GIF, видео, ID медиа-файла или используйте кнопку 'Пропустить'."
        )

# Обработчики отмены для всех этапов создания каталога (с подтверждением)
@dp.callback_query_handler(lambda c: c.data in ["cancel_product_creation", "cancel_theme_creation", "cancel_category_creation", "cancel_catalog_creation"], state="*")
async def request_cancel_catalog_creation(callback: types.CallbackQuery, state: FSMContext):
    """Запрос подтверждения отмены создания элемента каталога"""
    try:
        # Получаем тип элемента из состояния
        data = await state.get_data()
        item_type = data.get('item_type', 'элемент')
        
        # Определяем название для отображения
        type_names = {
            'product': 'товара',
            'theme': 'темы',
            'category': 'категории',
            'subcategory': 'подкатегории'
        }
        type_name = type_names.get(item_type, 'элемента')
        
        # Сохраняем оригинальные данные в состоянии
        await state.update_data(cancel_action=callback.data, cancel_type_name=type_name)
        
        # Показываем клавиатуру подтверждения
        from keyboards import create_confirmation_kb
        keyboard = create_confirmation_kb("confirm_cancel_creation", "continue_creation", type_name)
        
        await callback.message.edit_text(
            f"⚠️ <b>Подтверждение отмены</b>\n\n"
            f"📋 Вы уверены что хотите отменить создание {type_name}?\n\n"
            "🗑️ Все введенные данные будут потеряны.",
            parse_mode='HTML',
            reply_markup=keyboard
        )
        await CatalogAddStates.cancel_confirmation.set()
        await callback.answer()
        
    except Exception as e:
        print(f"Error in request_cancel_catalog_creation: {e}")
        await callback.answer("Ошибка")

@dp.callback_query_handler(lambda c: c.data == "confirm_cancel_creation", state=CatalogAddStates.cancel_confirmation)
async def confirm_cancel_catalog_creation(callback: types.CallbackQuery, state: FSMContext):
    """Подтверждение отмены создания элемента каталога"""
    try:
        data = await state.get_data()
        type_name = data.get('cancel_type_name', 'элемента')
        
        await state.finish()
        
        await callback.message.edit_text(
            f"❌ <b>Создание {type_name} отменено</b>\n\n"
            "🔙 Возвращайтесь к каталогу через меню.",
            parse_mode='HTML'
        )
        await callback.answer("Отменено")
        
    except Exception as e:
        print(f"Error in confirm_cancel_catalog_creation: {e}")
        await state.finish()
        await callback.message.edit_text("❌ Операция отменена.")
        await callback.answer("Отменено")

@dp.callback_query_handler(lambda c: c.data == "continue_creation", state=CatalogAddStates.cancel_confirmation)
async def continue_catalog_creation(callback: types.CallbackQuery, state: FSMContext):
    """Продолжение создания элемента каталога"""
    try:
        # Возвращаемся к предыдущему состоянию
        # Здесь можно реализовать логику возврата к предыдущему шагу
        # Но для простоты просто показываем сообщение о продолжении
        await callback.message.edit_text(
            "✅ <b>Продолжаем создание</b>\n\n"
            "🔄 Возобновите процесс создания через меню.",
            parse_mode='HTML'
        )
        # Очищаем состояние
        await state.finish()
        await callback.answer("Продолжаем")
        
    except Exception as e:
        print(f"Error in continue_catalog_creation: {e}")
        await state.finish()
        await callback.answer("Ошибка")

# Обработчики пропуска для различных этапов
@dp.callback_query_handler(lambda c: c.data == "skip_sticker", state=CatalogAddStates.waiting_for_sticker)
async def skip_catalog_sticker(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить стикер"""
    async with state.proxy() as data:
        data['sticker_id'] = None
    
    from keyboards import create_skip_cancel_kb
    await callback.message.edit_text(
        "✅ Стикер пропущен.\n\nТеперь отправьте фото, GIF или видео для элемента:",
        reply_markup=create_skip_cancel_kb("skip_photo", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_photo.set()
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_name", state=CatalogAddStates.waiting_for_name)
async def skip_catalog_name(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить название (невозможно, но обработчик для совместимости)"""
    await callback.answer("Название обязательно!", show_alert=True)

@dp.callback_query_handler(lambda c: c.data == "skip_price", state=CatalogAddStates.waiting_for_price)
async def skip_catalog_price(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить цену (по умолчанию 100₽)"""
    async with state.proxy() as data:
        data['price'] = 10000  # 100₽ в копейках
    
    from keyboards import create_skip_cancel_kb
    await callback.message.edit_text(
        "✅ Цена установлена по умолчанию: 100₽\n\nТеперь введите дни действия (числа через запятую, например: 30,60,90):",
        reply_markup=create_skip_cancel_kb("skip_expiration_days", "cancel_product_creation")
    )
    await CatalogAddStates.waiting_for_expiration_days.set()
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_expiration_days", state=CatalogAddStates.waiting_for_expiration_days)
async def skip_catalog_expiration_days(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить дни действия"""
    async with state.proxy() as data:
        data['expiration_days'] = None
    
    from keyboards import create_skip_cancel_kb
    await callback.message.edit_text(
        "✅ Дни действия пропущены.\n\nТеперь отправьте файлы для товара:",
        reply_markup=create_skip_cancel_kb("skip_files", "cancel_product_creation")
    )
    await CatalogAddStates.waiting_for_file.set()
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_files", state=CatalogAddStates.waiting_for_file)
async def skip_catalog_files(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить файлы"""
    async with state.proxy() as data:
        data['files'] = []
    
    await callback.message.edit_text(
        "✅ Файлы пропущены. Создаем товар..."
    )
    await create_catalog_item(callback.message, state)
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_files_current_day", state=CatalogAddStates.waiting_for_files_by_days)
async def skip_files_current_day(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить файлы для текущего периода дней"""
    async with state.proxy() as data:
        days_list = data.get('days_list', [])
        current_day_index = data.get('current_day_index', 0)
        current_day = days_list[current_day_index]
        
        # Пропускаем файлы для текущего периода
        if 'files_by_days' not in data:
            data['files_by_days'] = {}
        data['files_by_days'][str(current_day)] = []
        
        # Переходим к следующему периоду дней
        next_day_index = current_day_index + 1
        if next_day_index < len(days_list):
            data['current_day_index'] = next_day_index
            next_day = days_list[next_day_index]
            
            from keyboards import create_skip_cancel_kb
            await callback.message.edit_text(
                f"✅ Файлы для {current_day} дней пропущены.\n\n📁 Отправьте файлы для {next_day} дней:",
                reply_markup=create_skip_cancel_kb("skip_files_current_day", "cancel_product_creation")
            )
            await callback.answer()
        else:
            # Все периоды обработаны
            await callback.message.edit_text(
                f"✅ Файлы для {current_day} дней пропущены.\n\n✅ Создание товара завершено!"
            )
            await create_catalog_item_with_days(callback.message, state)
            await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "choose_normal_layout", state=CatalogAddStates.waiting_for_grid_choice)
async def choose_normal_layout(callback: types.CallbackQuery, state: FSMContext):
    """Выбор обычного отображения"""
    async with state.proxy() as data:
        data['is_grid_3x6'] = False
        
    await callback.message.edit_text("✅ Выбрано обычное отображение.")
    await create_catalog_item(callback.message, state)
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "choose_3x6_grid", state=CatalogAddStates.waiting_for_grid_choice)
async def choose_3x6_grid(callback: types.CallbackQuery, state: FSMContext):
    """Выбор сетки 3x6"""
    async with state.proxy() as data:
        data['is_grid_3x6'] = True
        data['grid_config'] = '3x6'  # По умолчанию
        
    await callback.message.edit_text("✅ Выбрана сетка 3x6.\n\nТеперь введите название кнопки поиска (например: '🔎найти страну'):")
    await CatalogAddStates.waiting_for_search_button_name.set()
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "choose_manual_grid", state=CatalogAddStates.waiting_for_grid_choice)
async def choose_manual_grid(callback: types.CallbackQuery, state: FSMContext):
    """Выбор ручной настройки сетки"""
    from keyboards import create_skip_cancel_kb
    keyboard = create_skip_cancel_kb("skip_manual_grid", "cancel_category_creation")
    
    await callback.message.edit_text(
        "⚙️ Ручная настройка сетки\n\n"
        "📝 Введите размер в формате: <b>количество_колонок x количество_строк</b>\n\n"
        "📊 <b>Примеры:</b>\n"
        "• 3x7 - 3 кнопки в ряд, 7 рядов\n"
        "• 2x5 - 2 кнопки в ряд, 5 рядов\n"
        "• 4x3 - 4 кнопки в ряд, 3 ряда",
        parse_mode='HTML',
        reply_markup=keyboard
    )
    await CatalogAddStates.waiting_for_manual_grid_config.set()
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_manual_grid", state=CatalogAddStates.waiting_for_manual_grid_config)
async def skip_manual_grid(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск ручной настройки (использовать 3x6 по умолчанию)"""
    async with state.proxy() as data:
        data['is_grid_3x6'] = True
        data['grid_config'] = '3x6'  # По умолчанию
    
    await callback.message.edit_text("✅ Используется сетка 3x6 по умолчанию.\n\nТеперь введите название кнопки поиска (например: '🔎найти страну'):")
    await CatalogAddStates.waiting_for_search_button_name.set()
    await callback.answer()

@dp.message_handler(state=CatalogAddStates.waiting_for_manual_grid_config)
async def process_manual_grid_config(message: types.Message, state: FSMContext):
    """Обработка ручной настройки сетки"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите размер сетки.")
        return
    
    grid_input = message.text.strip().lower()
    
    # Проверяем формат ввода
    import re
    match = re.match(r'(\d+)\s*[x×х]\s*(\d+)', grid_input)
    
    if not match:
        await message.answer(
            "❌ Неправильный формат!\n\n"
            "📝 Введите в формате: <b>кол_колонок x кол_строк</b>\n"
            "📊 Пример: 3x7, 2x5, 4x3",
            parse_mode='HTML'
        )
        return
    
    cols = int(match.group(1))
    rows = int(match.group(2))
    
    # Проверяем разумные лимиты
    if cols < 1 or cols > 6 or rows < 1 or rows > 20:
        await message.answer(
            "❌ Недопустимые значения!\n\n"
            "⚠️ <b>Ограничения:</b>\n"
            "• Колонок: 1-6\n"
            "• Строк: 1-20",
            parse_mode='HTML'
        )
        return
    
    async with state.proxy() as data:
        data['is_grid_3x6'] = True
        data['grid_config'] = f'{cols}x{rows}'
    
    await message.answer(
        f"✅ Конфигурация сетки: <b>{cols}x{rows}</b>\n\n"
        "Теперь введите название кнопки поиска (например: '🔎найти страну'):",
        parse_mode='HTML'
    )
    await CatalogAddStates.waiting_for_search_button_name.set()

@dp.callback_query_handler(lambda c: c.data == "skip_grid_choice", state=CatalogAddStates.waiting_for_grid_choice)
async def skip_catalog_grid_choice(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить выбор 3x6 сетки (по умолчанию обычное)"""
    async with state.proxy() as data:
        data['is_grid_3x6'] = False
        
        # Проверяем тип элемента
        if data['item_type'] == 'product':
            # Для товаров переходим к цене
            from keyboards import create_skip_cancel_kb
            await callback.message.edit_text(
                "✅ Выбрано обычное отображение.\n\nТеперь введите цену товара в рублях:",
                reply_markup=create_skip_cancel_kb("skip_price", "cancel_product_creation")
            )
            await CatalogAddStates.waiting_for_price.set()
        else:
            # Для категорий и подкатегорий сразу создаем
            await callback.message.edit_text("✅ Выбрано обычное отображение.")
            await create_catalog_item(callback.message, state)
        
    await callback.answer()

# Обработчик для названия элемента каталога
@dp.message_handler(state=CatalogAddStates.waiting_for_name)
async def process_catalog_name(message: types.Message, state: FSMContext):
    """Обработка названия элемента каталога"""
    # Используем html_text для поддержки форматирования Telegram
    name_text = message.html_text if message.html_text else message.text
    
    if not name_text:
        await message.answer("❌ Ошибка: Введите название элемента.")
        return
    
    async with state.proxy() as data:
        data['name'] = name_text.strip()
    
    from keyboards import create_skip_cancel_kb
    await message.answer(
        f"✅ Название принято: {name_text.strip()}\n\n📝 Теперь введите описание элемента:\n\n✨ <b>Поддерживается форматирование Telegram!</b>\nИспользуйте кнопки форматирования в Telegram:\n• <b>Жирный</b> текст\n• <i>Курсив</i>\n• <u>Подчёркнутый</u> текст\n• <s>Зачёркнутый</s> текст\n• <code>Моноширинный</code> текст\n• Ссылки",
        parse_mode="HTML",
        reply_markup=create_skip_cancel_kb("skip_description", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_description.set()

# Обработчик для описания элемента каталога
@dp.message_handler(state=CatalogAddStates.waiting_for_description)
async def process_catalog_description(message: types.Message, state: FSMContext):
    """Обработка описания элемента каталога"""
    # Используем html_text для поддержки форматирования Telegram
    description_text = message.html_text if message.html_text else message.text
    
    if not description_text:
        await message.answer("❌ Ошибка: Введите описание элемента или используйте кнопку 'Пропустить'.")
        return
    
    async with state.proxy() as data:
        # Сохраняем описание с форматированием
        data['description'] = description_text.strip()
        
        from keyboards import create_skip_cancel_kb
        await message.answer(
            f"✅ Описание принято с форматированием.\n\nТеперь введите preview ссылку:",
            reply_markup=create_skip_cancel_kb("skip_preview_link", "cancel_catalog_creation")
        )
    
    await CatalogAddStates.waiting_for_preview_link.set()

@dp.callback_query_handler(lambda c: c.data == "skip_description", state=CatalogAddStates.waiting_for_description)
async def skip_catalog_description(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить описание"""
    async with state.proxy() as data:
        data['description'] = None
    
    from keyboards import create_skip_cancel_kb
    await callback.message.edit_text(
        "✅ Описание пропущено.\n\nТеперь введите preview ссылку:",
        reply_markup=create_skip_cancel_kb("skip_preview_link", "cancel_catalog_creation")
    )
    await CatalogAddStates.waiting_for_preview_link.set()
    await callback.answer()

# Обработчик для preview ссылки
@dp.message_handler(state=CatalogAddStates.waiting_for_preview_link)
async def process_catalog_preview_link(message: types.Message, state: FSMContext):
    """Обработка preview ссылки элемента каталога"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите preview ссылку или используйте кнопку 'Пропустить'.")
        return
    
    async with state.proxy() as data:
        data['preview_link'] = message.text.strip()
        
        from keyboards import create_skip_cancel_alignment_kb
        await message.answer(
            f"✅ Preview ссылка принята.\n\nТеперь выберите ширину ряда кнопки:",
            reply_markup=create_skip_cancel_alignment_kb("skip_row_width", "cancel_catalog_creation", "set_row_width")
        )
    
    await CatalogAddStates.waiting_for_row_width.set()

@dp.callback_query_handler(lambda c: c.data == "skip_preview_link", state=CatalogAddStates.waiting_for_preview_link)
async def skip_catalog_preview_link(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить preview ссылку"""
    async with state.proxy() as data:
        data['preview_link'] = None
    
    from keyboards import create_skip_cancel_alignment_kb
    await callback.message.edit_text(
        "✅ Preview ссылка пропущена.\n\nТеперь выберите ширину ряда кнопки:",
        reply_markup=create_skip_cancel_alignment_kb("skip_row_width", "cancel_catalog_creation", "set_row_width")
    )
    await CatalogAddStates.waiting_for_row_width.set()
    await callback.answer()

# Обработчик для ширины ряда - теперь только кнопочные обработчики
@dp.callback_query_handler(lambda c: c.data.startswith("set_row_width_"), state=CatalogAddStates.waiting_for_row_width)
async def process_catalog_row_width_button(callback: types.CallbackQuery, state: FSMContext):
    """Обработка выбора ширины ряда кнопкой"""
    row_width = int(callback.data.split("_")[-1])
    
    async with state.proxy() as data:
        data['row_width'] = row_width
    
    await callback.message.edit_text(
        f"✅ Ширина ряда установлена: {row_width}\n\n"
    )
    
    # Проверяем тип элемента для следующего шага
    if data['item_type'] == 'product':
        # Проверяем, если родитель использует 3x6 сетку, то пропускаем вопрос о row_width
        parent_id = data.get('parent_id')
        if parent_id:
            parent_item = await db.get_catalog_item(parent_id)
            if parent_item and len(parent_item) > 13 and parent_item[13]:  # is_grid_3x6
                # Пропускаем вопрос о 3x6 сетке для товара
                data['is_grid_3x6'] = False
                # Переходим к установке цены
                from keyboards import create_skip_cancel_kb
                keyboard = create_skip_cancel_kb("skip_price", "cancel_product_creation")
                await callback.message.answer(
                    "💰 Введите цену товара в рублях:",
                    reply_markup=keyboard
                )
                await CatalogAddStates.waiting_for_price.set()
                await callback.answer()
                return
        
        # Обычный путь для товаров - сразу к цене (без сетки!)
        data['is_grid_3x6'] = False
        from keyboards import create_skip_cancel_kb
        keyboard = create_skip_cancel_kb("skip_price", "cancel_product_creation")
        await callback.message.answer(
            "💰 Введите цену товара в рублях:",
            reply_markup=keyboard
        )
        await CatalogAddStates.waiting_for_price.set()
    else:
        # Для тем и категорий сразу завершаем создание
        await create_catalog_item(callback.message, state)
    
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_row_width", state=CatalogAddStates.waiting_for_row_width)
async def skip_catalog_row_width(callback: types.CallbackQuery, state: FSMContext):
    """Пропуск выбора ширины ряда (по умолчанию 1)"""
    async with state.proxy() as data:
        data['row_width'] = 1
    
    await callback.message.edit_text(
        "✅ Ширина ряда установлена по умолчанию: 1\n\n"
    )
    
    # Продолжаем как в обычном обработчике
    if data['item_type'] == 'product':
        parent_id = data.get('parent_id')
        if parent_id:
            parent_item = await db.get_catalog_item(parent_id)
            if parent_item and len(parent_item) > 13 and parent_item[13]:  # is_grid_3x6
                data['is_grid_3x6'] = False
                data['row_width'] = 1  # Устанавливаем по умолчанию
                from keyboards import create_skip_cancel_kb
                keyboard = create_skip_cancel_kb("skip_price", "cancel_product_creation")
                await callback.message.answer(
                    "💰 Введите цену товара в рублях:",
                    reply_markup=keyboard
                )
                await CatalogAddStates.waiting_for_price.set()
                await callback.answer()
                return
        
        # Для товаров переходим сразу к цене (никакой сетки для товаров!)
        data['is_grid_3x6'] = False
        from keyboards import create_skip_cancel_kb
        keyboard = create_skip_cancel_kb("skip_price", "cancel_product_creation")
        await callback.message.answer(
            "💰 Введите цену товара в рублях:",
            reply_markup=keyboard
        )
        await CatalogAddStates.waiting_for_price.set()
    else:
        await create_catalog_item(callback.message, state)
    
    await callback.answer()
    # Продолжаем как в обычном обработчике
    if data['item_type'] == 'product':
        parent_id = data.get('parent_id')
        if parent_id:
            parent_item = await db.get_catalog_item(parent_id)
            if parent_item and len(parent_item) > 13 and parent_item[13]:  # is_grid_3x6
                data['is_grid_3x6'] = False
                data['row_width'] = 1  # Устанавливаем по умолчанию
                from keyboards import create_skip_cancel_kb
                keyboard = create_skip_cancel_kb("skip_price", "cancel_product_creation")
                await callback.message.answer(
                    "💰 Введите цену товара в рублях:",
                    reply_markup=keyboard
                )
                await CatalogAddStates.waiting_for_price.set()
                await callback.answer()
                return
        
        # Для товаров переходим сразу к цене (без сетки!)
        data['is_grid_3x6'] = False
        from keyboards import create_skip_cancel_kb
        keyboard = create_skip_cancel_kb("skip_price", "cancel_product_creation")
        await callback.message.answer(
            "💰 Введите цену товара в рублях:",
            reply_markup=keyboard
        )
        await CatalogAddStates.waiting_for_price.set()
    elif data['item_type'] == 'category' or data['item_type'] == 'subcategory':
        # Для категорий и подкатегорий спрашиваем о 3x6 сетке
        from keyboards import create_grid_choice_kb
        keyboard = create_grid_choice_kb("skip_grid_choice", "cancel_category_creation")
        await callback.message.answer(
            "🔢 Выберите тип отображения:",
            reply_markup=keyboard
        )
        await CatalogAddStates.waiting_for_grid_choice.set()
    else:
        # Для тем и подкатегорий сразу создаем элемент
        await create_catalog_item(callback.message, state)
    
    await callback.answer()

# Обработчик для выбора 3x6 сетки (оставляем для совместимости)
@dp.message_handler(state=CatalogAddStates.waiting_for_grid_choice)
async def process_grid_choice(message: types.Message, state: FSMContext):
    """Обработка выбора 3x6 сетки для категории (текстовый ввод)"""
    if not message.text:
        await message.answer("❌ Ошибка: Пожалуйста, используйте кнопки для выбора.")
        return
    
    text = message.text.lower().strip()
    
    async with state.proxy() as data:
        if text in ['да', 'yes', 'y', '1', 'да!', 'конечно']:
            data['is_grid_3x6'] = True
            await message.answer(
                "✅ Отлично! Создаем сетку 3x6.\n\n"
                "Теперь введите название кнопки поиска (например: '🔎найти страну'):"
            )
            await CatalogAddStates.waiting_for_search_button_name.set()
        elif text in ['нет', 'no', 'n', '0', 'нет!', 'не надо']:
            data['is_grid_3x6'] = False
            await create_catalog_item(message, state)
        else:
            await message.answer(
                "❌ Пожалуйста, используйте кнопки для выбора или напишите 'да' или 'нет'."
            )

# Обработчик для названия кнопки поиска
@dp.message_handler(state=CatalogAddStates.waiting_for_search_button_name)
async def process_search_button_name(message: types.Message, state: FSMContext):
    """Обработка названия кнопки поиска"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите название кнопки поиска.")
        return
    
    async with state.proxy() as data:
        data['search_button_name'] = message.text.strip()
    
    await message.answer(
        f"✅ Название кнопки поиска: {message.text.strip()}\n\n"
        f"Теперь введите текст для кнопки 'Назад' (например: 'к выбору VPN'):"
    )
    await CatalogAddStates.waiting_for_back_button_text.set()

# Обработчик для текста кнопки "Назад"
@dp.message_handler(state=CatalogAddStates.waiting_for_back_button_text)
async def process_back_button_text(message: types.Message, state: FSMContext):
    """Обработка текста кнопки 'Назад'"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите текст для кнопки 'Назад'.")
        return
    
    async with state.proxy() as data:
        data['back_button_text'] = message.text.strip()
    
    await message.answer(
        f"✅ Текст кнопки 'Назад': ❮ Назад {message.text.strip()}\n\n"
        f"Настройки сетки 3x6 завершены! Создаем категорию..."
    )
    
    # Создаем категорию с настройками 3x6
    await create_catalog_item(message, state)

# Обработчик для цены товара
@dp.message_handler(state=CatalogAddStates.waiting_for_price)
async def process_catalog_price(message: types.Message, state: FSMContext):
    """Обработка цены товара"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите цену товара в рублях.")
        return
    
    try:
        price_rub = float(message.text.strip())
        if price_rub <= 0:
            await message.answer("❌ Ошибка: Цена должна быть больше 0.")
            return
        
        price_kopecks = int(price_rub * 100)  # Конвертируем в копейки
        
        async with state.proxy() as data:
            data['price'] = price_kopecks
        
        from keyboards import create_skip_cancel_kb
        await message.answer(
            f"✅ Цена установлена: {price_rub:.2f}₽\n\nТеперь укажите количество дней действия товара через запятую (например: 30,60,90), где первое число - минимальное количество дней.",
            reply_markup=create_skip_cancel_kb("skip_expiration_days", "cancel_product_creation")
        )
        await CatalogAddStates.waiting_for_expiration_days.set()
        
    except ValueError:
        await message.answer("❌ Ошибка: Введите корректную цену (например: 100 или 99.50).")

# Обработчик для дней действия товара
@dp.message_handler(state=CatalogAddStates.waiting_for_expiration_days)
async def process_catalog_expiration_days(message: types.Message, state: FSMContext):
    """Обработка дней действия товара"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите дни действия или используйте кнопку 'Пропустить'.")
        return
    
    # Проверяем формат дней (числа через запятую)
    try:
        days_list = [int(day.strip()) for day in message.text.split(',')]
        
        # Проверяем, что все числа положительные
        if any(day <= 0 for day in days_list):
            await message.answer("❌ Ошибка: Все значения должны быть больше 0.")
            return
        
        # Сортируем по возрастанию
        days_list.sort()
        expiration_days_str = ','.join(map(str, days_list))
        
        async with state.proxy() as data:
            data['expiration_days'] = expiration_days_str
            data['days_list'] = days_list
            data['current_day_index'] = 0
            data['files_by_days'] = {}  # Словарь для хранения файлов по дням
        
        # Начинаем загрузку файлов для первого периода
        first_day = days_list[0]
        from keyboards import create_skip_cancel_kb
        await message.answer(
            f"✅ Дни действия установлены: {expiration_days_str}\nМинимальное количество дней: {first_day}\n\n📁 Теперь отправьте файлы для {first_day} дней (фото, документы):\n\n💡 Можно загружать до 2000 файлов за раз! Отправляйте группами или по одному.",
            reply_markup=create_skip_cancel_kb("skip_files", "cancel_product_creation")
        )
        await CatalogAddStates.waiting_for_files_by_days.set()
        
    except ValueError:
        await message.answer("❌ Ошибка: Введите числа через запятую (например: 30,60,90) или используйте кнопку 'Пропустить'.")

# Обработчики для выбора дней действия
@dp.callback_query_handler(lambda c: c.data.startswith("days_inc_") or c.data.startswith("days_dec_"))
async def handle_days_change(callback: types.CallbackQuery):
    """Обработка изменения количества дней"""
    try:
        parts = callback.data.split("_")
        action = parts[1]  # "inc" или "dec"
        product_id = int(parts[2])
        new_days = int(parts[3])
        current_quantity = int(parts[4]) if len(parts) > 4 else 1
        
        # Получаем информацию о товаре
        price_info = await db.get_product_price_with_days(product_id)
        if not price_info or not price_info[2]:  # Нет дней действия
            await callback.answer("Ошибка: Товар не имеет дней действия")
            return
        
        price_rub = price_info[0] / 100
        expiration_days = price_info[2]
        files_count = await db.get_product_files_count(product_id)
        
        # Получаем количество файлов для каждого периода дней
        available_days = [int(day.strip()) for day in expiration_days.split(',')]
        files_count_by_days = {}
        for day in available_days:
            files_count_by_days[day] = await db.get_product_files_count_by_days(product_id, day)
        
        # Обновляем клавиатуру с новым количеством дней
        from keyboards import expiration_days_selection_kb
        new_keyboard = expiration_days_selection_kb(product_id, expiration_days, new_days, price_rub, files_count, current_quantity, files_count_by_days)
        
        # Обновляем клавиатуру
        await callback.message.edit_reply_markup(reply_markup=new_keyboard)
        await callback.answer()
        
    except Exception as e:
        print(f"Error in handle_days_change: {e}")
        await callback.answer("Ошибка при изменении количества дней")

@dp.callback_query_handler(lambda c: c.data in ["days_min_reached", "days_max_reached"])
async def handle_days_limit_reached(callback: types.CallbackQuery):
    """Обработка достижения мин/макс количества дней"""
    if callback.data == "days_min_reached":
        await callback.answer("Минимальное количество дней достигнуто")
    else:
        await callback.answer("Максимальное количество дней достигнуто")

# Обработчики для количества товаров с днями действия
@dp.callback_query_handler(lambda c: c.data.startswith("qty_inc_days_") or c.data.startswith("qty_dec_days_"))
async def handle_quantity_change_with_days(callback: types.CallbackQuery):
    """Обработка изменения количества для товаров с днями действия"""
    try:
        parts = callback.data.split("_")
        action = parts[1]  # "inc" или "dec"
        days_part = parts[2]  # "days"
        product_id = int(parts[3])
        current_days = int(parts[4])
        new_quantity = int(parts[5])
        
        # Получаем информацию о товаре
        price_info = await db.get_product_price_with_days(product_id)
        if not price_info:
            await callback.answer("Ошибка: Не удалось получить информацию о товаре")
            return
        
        price_rub = price_info[0] / 100
        expiration_days = price_info[2] if len(price_info) > 2 else None
        files_count = await db.get_product_files_count(product_id)
        
        # Обновляем клавиатуру с новым количеством
        if expiration_days and expiration_days.strip():
            # Получаем количество файлов для каждого периода дней
            available_days = [int(day.strip()) for day in expiration_days.split(',')]
            files_count_by_days = {}
            for day in available_days:
                files_count_by_days[day] = await db.get_product_files_count_by_days(product_id, day)
            
            from keyboards import expiration_days_selection_kb
            new_keyboard = expiration_days_selection_kb(product_id, expiration_days, current_days, price_rub, files_count, new_quantity, files_count_by_days)
        else:
            from keyboards import product_purchase_kb
            new_keyboard = product_purchase_kb(product_id, price_rub, new_quantity, files_count)
        
        # Обновляем клавиатуру
        await callback.message.edit_reply_markup(reply_markup=new_keyboard)
        await callback.answer()
        
    except Exception as e:
        print(f"Error in handle_quantity_change_with_days: {e}")
        await callback.answer("Ошибка при изменении количества")

@dp.callback_query_handler(lambda c: c.data in ["qty_min_reached", "qty_max_reached"])
async def handle_quantity_limit_reached(callback: types.CallbackQuery):
    """Обработка достижения мин/макс количества"""
    if callback.data == "qty_min_reached":
        await callback.answer("Минимальное количество достигнуто")
    else:
        await callback.answer("Максимальное количество достигнуто")

# Словарь для батчинга файлов по пользователям
file_batch_timers = {}

# Обработчик файлов для товаров с днями действия
@dp.message_handler(content_types=['photo', 'document'], state=CatalogAddStates.waiting_for_files_by_days)
async def process_catalog_file_by_days(message: types.Message, state: FSMContext):
    """Обработка файлов для товара по дням действия"""
    user_id = message.from_user.id
    
    async with state.proxy() as data:
        days_list = data.get('days_list', [])
        current_day_index = data.get('current_day_index', 0)
        current_day = days_list[current_day_index]
        
        if 'files_by_days' not in data:
            data['files_by_days'] = {}
        
        if str(current_day) not in data['files_by_days']:
            data['files_by_days'][str(current_day)] = []
        
        # Инициализируем батч для текущего пользователя
        if 'file_batch' not in data:
            data['file_batch'] = []
        
        files_added = 0
        
        # Обрабатываем фото
        if message.photo:
            photo = message.photo[-1]  # Берем самое высокое разрешение
            file_name = f"photo_{current_day}d_{len(data['files_by_days'][str(current_day)]) + 1}.jpg"
            file_info = {
                'file_id': photo.file_id,
                'file_type': 'photo',
                'file_name': file_name
            }
            data['files_by_days'][str(current_day)].append(file_info)
            data['file_batch'].append(file_info)
            files_added += 1
        
        # Обрабатываем документы
        if message.document:
            doc = message.document
            file_name = doc.file_name or f"document_{current_day}d_{len(data['files_by_days'][str(current_day)]) + 1}"
            file_info = {
                'file_id': doc.file_id,
                'file_type': 'document',
                'file_name': file_name
            }
            data['files_by_days'][str(current_day)].append(file_info)
            data['file_batch'].append(file_info)
            files_added += 1
        
        # Если ни фото, ни документов не найдено
        if files_added == 0:
            await message.answer("❌ Ошибка: Поддерживаются только фото и документы.")
            return
    
    # Отменяем предыдущий таймер, если он есть
    if user_id in file_batch_timers:
        file_batch_timers[user_id].cancel()
    
    # Создаем новый таймер для отправки батча через 1 секунду
    async def send_batch_response():
        try:
            async with state.proxy() as data:
                current_day = days_list[current_day_index]
                batch_files = data.get('file_batch', [])
                total_files = len(data['files_by_days'][str(current_day)])
                batch_count = len(batch_files)
                
                # Очищаем батч
                data['file_batch'] = []
                
                await message.answer(
                    f"✅ Добавлено файлов: **{batch_count}** для {current_day} дней\n"
                    f"📊 Всего файлов для {current_day} дней: **{total_files}**\n\n"
                    f"💡 Можно загружать до 2000 файлов! Продолжайте отправлять файлы или напишите **'готово'** для завершения.",
                    parse_mode="Markdown"
                )
        except Exception as e:
            logging.error(f"Ошибка при отправке батч-ответа: {e}")
        finally:
            # Удаляем таймер из словаря
            if user_id in file_batch_timers:
                del file_batch_timers[user_id]
    
    # Запускаем таймер
    import asyncio
    file_batch_timers[user_id] = asyncio.create_task(asyncio.sleep(1))
    
    try:
        await file_batch_timers[user_id]
        await send_batch_response()
    except asyncio.CancelledError:
        # Таймер был отменен, ничего не делаем
        pass

@dp.message_handler(state=CatalogAddStates.waiting_for_files_by_days)
async def process_catalog_file_by_days_text(message: types.Message, state: FSMContext):
    """Обработка текстовых команд для файлов по дням"""
    if not message.text:
        from keyboards import create_skip_cancel_kb
        keyboard = create_skip_cancel_kb("files_done", "cancel_product_creation")
        keyboard.add(InlineKeyboardButton("⚙️ Готово", callback_data="files_done"))
        await message.answer("❌ Ошибка: Отправьте файл или используйте кнопки:", reply_markup=keyboard)
        return
    
    async with state.proxy() as data:
        days_list = data.get('days_list', [])
        current_day_index = data.get('current_day_index', 0)
        current_day = days_list[current_day_index]
        
        if message.text.lower() in ['готово', 'done', 'завершить', 'finish']:
            # Переходим к следующему дню или завершаем
            next_day_index = current_day_index + 1
            
            if next_day_index < len(days_list):
                # Есть еще дни для загрузки файлов
                data['current_day_index'] = next_day_index
                next_day = days_list[next_day_index]
                
                # Показываем статистику текущего дня
                current_files_count = len(data['files_by_days'].get(str(current_day), []))
                
                from keyboards import create_skip_cancel_kb
                keyboard = create_skip_cancel_kb(f"skip_files_day_{next_day}", "cancel_product_creation")
                keyboard.add(InlineKeyboardButton("⚙️ Готово", callback_data=f"files_done_day_{current_day}"))
                
                await message.answer(
                    f"✅ Файлы для {current_day} дней завершены! Добавлено файлов: {current_files_count}\n\n"
                    f"📁 Желаете добавить еще файлы товара к {next_day} дням?"
                    f"Отправьте файлы для {next_day} дней:",
                    reply_markup=keyboard
                )
            else:
                # Все дни обработаны, создаем товар
                await create_catalog_item_with_days(message, state)
        
        elif message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
            # Пропускаем текущий день и переходим к следующему
            next_day_index = current_day_index + 1
            
            if next_day_index < len(days_list):
                data['current_day_index'] = next_day_index
                next_day = days_list[next_day_index]
                
                from keyboards import create_skip_cancel_kb
                keyboard = create_skip_cancel_kb(f"skip_files_day_{next_day}", "cancel_product_creation")
                
                await message.answer(
                    f"⏭️ Файлы для {current_day} дней пропущены.\n\n"
                    f"📁 Желаете добавить еще файлы товара к {next_day} дням?"
                    f"Отправьте файлы для {next_day} дней:",
                    reply_markup=keyboard
                )
            else:
                # Все дни обработаны, создаем товар
                await create_catalog_item_with_days(message, state)
        
        else:
            from keyboards import create_skip_cancel_kb
            keyboard = create_skip_cancel_kb("skip_files", "cancel_product_creation")
            keyboard.add(InlineKeyboardButton("⚙️ Готово", callback_data="files_done"))
            await message.answer(
                "❌ Неизвестная команда. Отправьте файл или используйте кнопки:",
                reply_markup=keyboard
            )

# Функция создания элемента каталога с файлами по дням
async def create_catalog_item_with_days(message: types.Message, state: FSMContext):
    """Создает элемент каталога в базе данных с файлами по дням"""
    try:
        async with state.proxy() as data:
            # Проверяем, что item_type установлен
            if not data.get('item_type'):
                await message.answer("❌ Ошибка: Тип элемента не определен. Попробуйте начать сначала.")
                await state.finish()
                return
            
            # Создаем элемент каталога
            item_id = await db.add_catalog_item(
                parent_id=data.get('parent_id'),
                item_type=data['item_type'],
                name=data['name'],
                description=data.get('description'),
                sticker_id=data.get('sticker_id'),
                photo_id=data.get('photo_id'),
                preview_link=data.get('preview_link'),
                row_width=data.get('row_width', 1),
                is_grid_3x6=data.get('is_grid_3x6', False),
                position=data.get('position', 0)
            )
            
            if data['item_type'] == 'product':
                # Добавляем цену с днями действия
                if 'price' in data:
                    expiration_days = data.get('expiration_days', None)
                    await db.add_product_price(item_id, data['price'], 'RUB', expiration_days)
                
                # Добавляем файлы по дням
                files_by_days = data.get('files_by_days', {})
                total_files = 0
                
                for day_period, files in files_by_days.items():
                    for file_info in files:
                        await db.add_product_file(
                            item_id,
                            file_info['file_id'],
                            file_info['file_type'],
                            file_info['file_name'],
                            int(day_period)  # Добавляем период действия файла
                        )
                        total_files += 1
                
                # Формируем отчет о добавленных файлах
                files_report = []
                for day_period in sorted(files_by_days.keys(), key=int):
                    files_count = len(files_by_days[day_period])
                    if files_count > 0:
                        files_report.append(f"📁 {day_period} дней: {files_count} файлов")
                
                files_summary = "\n".join(files_report) if files_report else "📁 Файлы не добавлены"
                
                await message.answer(
                    f"✅ Товар '{data['name']}' успешно создан!\n"
                    f"🆔 ID: {item_id}\n"
                    f"💰 Цена: {data.get('price', 0)/100:.2f}₽\n"
                    f"📅 Дни действия: {data.get('expiration_days', 'не указаны')}\n"
                    f"📊 Всего файлов: {total_files}\n\n"
                    f"{files_summary}"
                )
            else:
                await message.answer(f"✅ {data['item_type'].title()} '{data['name']}' успешно создан!\n🆔 ID: {item_id}")
        
        await state.finish()
        
    except Exception as e:
        print(f"Error creating catalog item with days: {e}")
        await message.answer(f"❌ Ошибка при создании товара: {e}")
        await state.finish()

@dp.message_handler(state=CatalogAddStates.waiting_for_file, content_types=[types.ContentType.DOCUMENT, types.ContentType.PHOTO])
async def process_catalog_file(message: types.Message, state: FSMContext):
    """Обработка файлов товара (поддерживает множественные файлы в одном сообщении)"""
    user_id = message.from_user.id
    
    async with state.proxy() as data:
        if 'files' not in data:
            data['files'] = []
        
        # Инициализируем батч для текущего пользователя
        if 'file_batch' not in data:
            data['file_batch'] = []
        
        files_added = 0
        
        # Обрабатываем фото
        if message.photo:
            photo = message.photo[-1]  # Берем самое высокое разрешение
            file_name = f"photo_{len(data['files']) + files_added + 1}.jpg"
            file_info = {
                'file_id': photo.file_id,
                'file_type': 'photo',
                'file_name': file_name
            }
            data['files'].append(file_info)
            data['file_batch'].append(file_info)
            files_added += 1
        
        # Обрабатываем документы
        elif message.document:
            doc = message.document
            file_name = doc.file_name or f"document_{len(data['files']) + files_added + 1}"
            file_info = {
                'file_id': doc.file_id,
                'file_type': 'document',
                'file_name': file_name
            }
            data['files'].append(file_info)
            data['file_batch'].append(file_info)
            files_added += 1
        
        # Если ни фото, ни документов не найдено
        if files_added == 0:
            await message.answer("❌ Ошибка: Поддерживаются только фото и документы.")
            return
    
    # Отменяем предыдущий таймер, если он есть
    if user_id in file_batch_timers:
        file_batch_timers[user_id].cancel()
    
    # Создаем новый таймер для отправки батча через 1 секунду
    async def send_batch_response():
        await asyncio.sleep(1)  # Ждем 1 секунду после последнего файла
        
        # Получаем актуальные данные
        data = await state.get_data()
        batch_files = data.get('file_batch', [])
        total_files = len(data.get('files', []))
        
        if not batch_files:
            return
        
        # Формируем подтверждение с правильным счетчиком
        batch_count = len(batch_files)
        if batch_count == 1:
            confirmation_text = f"✅ Обработан 1 файл! Всего файлов: **{total_files}**"
        elif batch_count in [2, 3, 4]:
            confirmation_text = f"✅ Обработано {batch_count} файла! Всего файлов: **{total_files}**"
        else:
            confirmation_text = f"✅ Обработано {batch_count} файлов! Всего файлов: **{total_files}**"
        
        confirmation_text += "\n\n💡 Можно загружать до 2000 файлов! Отправьте еще файлы или напишите **'готово'** для завершения:"
        
        # Отправляем подтверждение
        await bot.send_message(
            chat_id=user_id,
            text=confirmation_text,
            parse_mode="Markdown"
        )
        
        # Очищаем батч файлов
        await state.update_data(file_batch=[])
        
        # Удаляем таймер
        if user_id in file_batch_timers:
            del file_batch_timers[user_id]
    
    # Запускаем таймер
    file_batch_timers[user_id] = asyncio.create_task(send_batch_response())

@dp.message_handler(state=CatalogAddStates.waiting_for_file)
async def process_catalog_file_text(message: types.Message, state: FSMContext):
    """Обработка текстовых команд для файлов"""
    if not message.text:
        await message.answer("❌ Ошибка: Отправьте файл или используйте кнопки выше.")
        return
    
    if message.text.lower() in ['готово', 'done', 'завершить', 'finish']:
        await create_catalog_item(message, state)
    elif message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
        async with state.proxy() as data:
            data['files'] = []
        await create_catalog_item(message, state)
    else:
        await message.answer(
            "❌ Неизвестная команда. Отправьте файл, напишите 'готово' для завершения или используйте кнопку 'Пропустить'."
        )

# Функция создания элемента каталога
async def create_catalog_item(message: types.Message, state: FSMContext):
    """Создает элемент каталога в базе данных"""
    try:
        async with state.proxy() as data:
            # Проверяем, является ли это категорией бонусов
            if data.get('is_bonus_category'):
                # Создаем раздел бонусов вместо обычного элемента каталога
                section_id = await db.add_bonus_section(
                    name=data['name'],
                    description=data.get('description'),
                    photo_id=data.get('photo_id'),
                    parent_id=data.get('parent_id')  # Передаем parent_id для вложенности
                )
                
                if not section_id:
                    await message.answer("❌ Ошибка при создании категории бонусов.")
                    await state.finish()
                    return
                
                # Определяем контекст для сообщения
                context_info = ""
                if data.get('parent_id'):
                    try:
                        parent_section = await db.get_bonus_section(data['parent_id'])
                        if parent_section:
                            context_info = f"\n📁 Родительская категория: {parent_section[1]}"
                    except Exception:
                        pass
                
                await message.answer(
                    f"✅ Категория бонусов '{data['name']}' успешно создана!\n\n"
                    f"🆔 ID категории: {section_id}\n"
                    f"🖼️ Фото: {'установлено' if data.get('photo_id') else 'не установлено'}{context_info}"
                )
                await state.finish()
                return
            
            # Обычное создание элемента каталога
            # Проверяем, что item_type установлен
            if not data.get('item_type'):
                await message.answer("❌ Ошибка: Тип элемента не определен. Попробуйте начать сначала.")
                await state.finish()
                return
            
            item_id = await db.add_catalog_item(
                parent_id=data.get('parent_id'),
                item_type=data['item_type'],
                name=data['name'],
                description=data.get('description'),
                sticker_id=data.get('sticker_id'),
                photo_id=data.get('photo_id'),
                preview_link=data.get('preview_link'),
                row_width=data.get('row_width', 1),
                is_grid_3x6=data.get('is_grid_3x6', False),
                search_button_name=data.get('search_button_name'),
                back_button_text=data.get('back_button_text')
            )
            
            if not item_id:
                await message.answer("❌ Ошибка при создании элемента каталога.")
                await state.finish()
                return
            
            # Если это товар, добавляем цену и файлы
            if data['item_type'] == 'product':
                # Добавляем цену с днями действия
                if 'price' in data:
                    expiration_days = data.get('expiration_days', None)
                    await db.add_product_price(item_id, data['price'], 'RUB', expiration_days)
                
                # Добавляем файлы
                if 'files' in data and data['files']:
                    for file_data in data['files']:
                        await db.add_product_file(
                            item_id,
                            file_data['file_id'],
                            file_data['file_type'],
                            file_data['file_name']
                        )
            
            # Формируем сообщение об успехе
            item_type_names = {
                'theme': 'Тема',
                'category': 'Категория',
                'subcategory': 'Подкатегория',
                'product': 'Товар'
            }
            
            success_msg = f"✅ {item_type_names[data['item_type']]} '{data['name']}' успешно создан!\n\n"
            
            if data['item_type'] == 'product':
                files_count = len(data.get('files', []))
                price_rub = data.get('price', 0) / 100
                success_msg += f"💰 Цена: {price_rub:.2f}₽\n"
                success_msg += f"📁 Файлов: {files_count} шт\n"
            
            await message.answer(success_msg)
            
    except Exception as e:
        print(f"Error creating catalog item: {e}")
        await message.answer(f"❌ Ошибка при создании элемента: {e}")
    
    await state.finish()

# Обработчики для массовой загрузки файлов
@dp.callback_query_handler(lambda c: c.data.startswith("bulk_upload_"))
async def bulk_upload_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик массовой загрузки файлов для товаров"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("Доступно только администратору")
        return
    
    parent_id = int(callback.data.split("_")[2])
    
    await CatalogAddStates.waiting_for_bulk_files.set()
    async with state.proxy() as data:
        data['parent_id'] = parent_id
        data['bulk_files'] = []
        data['products_created'] = 0
    
    await callback.message.answer(
        "📁 **МАССОВАЯ ЗАГРУЗКА ТОВАРОВ**\n\n"
        "Отправьте файлы (фото или документы) для создания товаров.\n"
        "🔹 **1 файл = 1 товар**\n"
        "🔹 Название товара будет взято из имени файла\n"
        "🔹 Цена будет установлена по умолчанию (можно изменить позже)\n\n"
        "Отправляйте файлы по одному или группами.\n"
        "Когда закончите, напишите **'готово'**",
        parse_mode="Markdown"
    )
    await callback.answer()

@dp.message_handler(state=CatalogAddStates.waiting_for_bulk_files, content_types=[types.ContentType.DOCUMENT, types.ContentType.PHOTO])
async def process_bulk_files(message: types.Message, state: FSMContext):
    """Обработка файлов для массовой загрузки"""
    async with state.proxy() as data:
        if 'bulk_files' not in data:
            data['bulk_files'] = []
        
        # Обрабатываем все файлы в сообщении
        files_added = 0
        current_total = len(data['bulk_files'])
        
        # Проверяем фото
        if message.photo:
            photo = message.photo[-1]  # Берем самое высокое разрешение
            file_name = f"photo_{current_total + files_added + 1}.jpg"
            data['bulk_files'].append({
                'file_id': photo.file_id,
                'file_type': 'photo',
                'file_name': file_name
            })
            files_added += 1
        
        # Проверяем документы
        if message.document:
            doc = message.document
            file_name = doc.file_name or f"document_{current_total + files_added + 1}"
            data['bulk_files'].append({
                'file_id': doc.file_id,
                'file_type': 'document',
                'file_name': file_name
            })
            files_added += 1
        
        total_files = len(data['bulk_files'])
        
        await message.answer(
            f"✅ Добавлено файлов: **{files_added}**\n"
            f"📊 Всего файлов: **{total_files}**\n\n"
            f"Будет создано товаров: **{total_files}**\n\n"
            "Продолжайте отправлять файлы или напишите **'готово'** для создания товаров.",
            parse_mode="Markdown"
        )

@dp.message_handler(state=CatalogAddStates.waiting_for_bulk_files)
async def process_bulk_files_text(message: types.Message, state: FSMContext):
    """Обработка текстовых команд для массовой загрузки"""
    if not message.text:
        await message.answer("❌ Отправьте файлы или напишите 'готово' для завершения.")
        return
    
    text = message.text.lower().strip()
    
    if text in ['готово', 'done', 'finish', 'завершить']:
        async with state.proxy() as data:
            bulk_files = data.get('bulk_files', [])
            
            if not bulk_files:
                await message.answer("❌ Не загружено ни одного файла. Отправьте файлы или отмените операцию.")
                return
            
            # Показываем предварительный просмотр
            preview_text = f"📋 **ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР**\n\n"
            preview_text += f"🗂 Будет создано товаров: **{len(bulk_files)}**\n"
            preview_text += f"📁 Родительская категория ID: **{data['parent_id']}**\n\n"
            
            preview_text += "**Список товаров:**\n"
            for i, file_info in enumerate(bulk_files[:10], 1):  # Показываем первые 10
                file_name = file_info['file_name']
                # Убираем расширение для названия товара
                product_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
                preview_text += f"{i}. {product_name}\n"
            
            if len(bulk_files) > 10:
                preview_text += f"... и еще {len(bulk_files) - 10} товаров\n"
            
            preview_text += f"\n💰 Цена по умолчанию: **100₽** (можно изменить позже)\n"
            preview_text += f"⏱ Срок действия: **30 дней** (можно изменить позже)\n\n"
            preview_text += "Подтвердите создание товаров:"
            
            # Создаем клавиатуру подтверждения
            from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
            keyboard = InlineKeyboardMarkup(row_width=2)
            keyboard.add(
                InlineKeyboardButton("✅ Создать товары", callback_data="confirm_bulk_create"),
                InlineKeyboardButton("❌ Отменить", callback_data="cancel_bulk_create")
            )
            
            await message.answer(preview_text, parse_mode="Markdown", reply_markup=keyboard)
            await CatalogAddStates.waiting_for_bulk_confirmation.set()
    
    elif text in ['отмена', 'cancel', 'отменить']:
        await message.answer("❌ Массовая загрузка отменена.")
        await state.finish()
    
    else:
        await message.answer(
            "❌ Неизвестная команда.\n\n"
            "Доступные команды:\n"
            "• **'готово'** - завершить загрузку и создать товары\n"
            "• **'отмена'** - отменить операцию\n\n"
            "Или продолжайте отправлять файлы.",
            parse_mode="Markdown"
        )

@dp.callback_query_handler(lambda c: c.data == "confirm_bulk_create", state=CatalogAddStates.waiting_for_bulk_confirmation)
async def confirm_bulk_create(callback: types.CallbackQuery, state: FSMContext):
    """Подтверждение массового создания товаров"""
    await callback.answer()
    
    async with state.proxy() as data:
        bulk_files = data.get('bulk_files', [])
        parent_id = data['parent_id']
        
        if not bulk_files:
            await callback.message.answer("❌ Нет файлов для создания товаров.")
            await state.finish()
            return
        
        # Показываем прогресс
        progress_msg = await callback.message.answer(
            f"⏳ Создание товаров... 0/{len(bulk_files)}"
        )
        
        created_count = 0
        errors = []
        
        try:
            for i, file_info in enumerate(bulk_files, 1):
                try:
                    # Создаем название товара из имени файла
                    file_name = file_info['file_name']
                    product_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
                    
                    # Создаем товар
                    item_id = await db.add_catalog_item(
                        item_type='product',
                        name=product_name,
                        description=f"Товар создан из файла: {file_name}",
                        sticker_id=None,
                        photo_id=None,
                        preview_link=None,
                        row_width=1,
                        parent_id=parent_id
                    )
                    
                    # Добавляем цену по умолчанию (100₽ = 10000 копеек)
                    await db.add_product_price(item_id, 10000, 'RUB', 30)  # 30 дней действия
                    
                    # Добавляем файл к товару
                    await db.add_product_file(
                        item_id,
                        file_info['file_id'],
                        file_info['file_type'],
                        file_info['file_name']
                    )
                    
                    created_count += 1
                    
                    # Обновляем прогресс каждые 10 товаров или в конце
                    if i % 10 == 0 or i == len(bulk_files):
                        await progress_msg.edit_text(
                            f"⏳ Создание товаров... {i}/{len(bulk_files)}"
                        )
                
                except Exception as e:
                    errors.append(f"Файл {file_name}: {str(e)}")
                    print(f"Error creating product from file {file_name}: {e}")
            
            # Финальное сообщение
            result_text = f"✅ **МАССОВОЕ СОЗДАНИЕ ЗАВЕРШЕНО**\n\n"
            result_text += f"📊 Создано товаров: **{created_count}** из **{len(bulk_files)}**\n"
            result_text += f"💰 Цена по умолчанию: **100₽**\n"
            result_text += f"⏱ Срок действия: **30 дней**\n\n"
            
            if errors:
                result_text += f"⚠️ Ошибки ({len(errors)}):\n"
                for error in errors[:5]:  # Показываем первые 5 ошибок
                    result_text += f"• {error}\n"
                if len(errors) > 5:
                    result_text += f"... и еще {len(errors) - 5} ошибок\n"
            
            result_text += "\n💡 Вы можете отредактировать цены и описания товаров в каталоге."
            
            await progress_msg.edit_text(result_text, parse_mode="Markdown")
            
        except Exception as e:
            await progress_msg.edit_text(f"❌ Критическая ошибка при создании товаров: {e}")
    
    await state.finish()

@dp.callback_query_handler(lambda c: c.data == "cancel_bulk_create", state=CatalogAddStates.waiting_for_bulk_confirmation)
async def cancel_bulk_create(callback: types.CallbackQuery, state: FSMContext):
    """Отмена массового создания товаров"""
    await callback.answer()
    await callback.message.answer("❌ Массовое создание товаров отменено.")
    await state.finish()

# Обработчики для поиска в 3x6 сетке
@dp.callback_query_handler(lambda c: c.data.startswith('search_in_category_'))
async def handle_search_in_category(callback_query: types.CallbackQuery):
    """Обработчик начала поиска в категории"""
    await callback_query.answer()
    
    category_id = int(callback_query.data.split('_')[-1])
    
    # Получаем информацию о категории
    category_item = await db.get_catalog_item(category_id)
    if not category_item:
        await callback_query.message.answer("❌ Категория не найдена.")
        return
    
    # Получаем название кнопки поиска и текст кнопки "Назад"
    search_button_name = category_item[14] if len(category_item) > 14 else "🔍 Поиск"
    back_button_text = category_item[15] if len(category_item) > 15 else None
    
    await callback_query.message.edit_text(
        f"{search_button_name}\n\nНапишите название для поиска:",
        reply_markup=search_results_kb(category_id, back_button_text)
    )
    
    # Устанавливаем состояние поиска
    await CatalogSearchStates.waiting_for_search_query.set()
    
    # Сохраняем ID категории в состоянии
    state = dp.current_state(user=callback_query.from_user.id)
    await state.update_data(category_id=category_id)

@dp.message_handler(state=CatalogSearchStates.waiting_for_search_query)
async def process_search_query(message: types.Message, state: FSMContext):
    """Обработка поискового запроса"""
    if not message.text:
        await message.answer("❌ Ошибка: Введите текст для поиска.")
        return
    
    search_query = message.text.strip()
    
    async with state.proxy() as data:
        category_id = data.get('category_id')
    
    if not category_id:
        await message.answer("❌ Ошибка: Категория не найдена.")
        await state.finish()
        return
    
    # Получаем информацию о категории для определения типа поиска
    category_item = await db.get_catalog_item(category_id)
    if not category_item:
        await message.answer("❌ Ошибка: Категория не найдена.")
        await state.finish()
        return
    
    is_grid_3x6 = bool(category_item[13]) if len(category_item) > 13 and category_item[13] is not None else False
    
    # Выполняем поиск: глобальный для 3x6 сетки, локальный для обычных категорий
    if is_grid_3x6:
        print(f"DEBUG: Используем глобальный поиск для запроса '{search_query}'")
        search_results = await db.search_catalog_items_global(search_query)
    else:
        print(f"DEBUG: Используем локальный поиск для запроса '{search_query}' в категории {category_id}")
        search_results = await db.search_catalog_items(category_id, search_query)
    
    print(f"DEBUG: Найдено результатов: {len(search_results) if search_results else 0}")
    back_button_text = category_item[15] if len(category_item) > 15 else None
    
    if search_results:
        # Показываем результаты поиска
        keyboard = await create_3x6_grid_keyboard(
            search_results, 
            page=0, 
            search_button_name=None,  # Не показываем кнопку поиска в результатах
            back_button_text=None,
            parent_id=category_id,
            is_search_results=True,
            is_admin=False
        )
        
        await message.answer(
            f"🔍 Поиск по запросу: '{search_query}'\n\n"
            f"Найдено результатов: {len(search_results)}",
            reply_markup=keyboard
        )
    else:
        # Результатов не найдено
        keyboard = search_results_kb(category_id, back_button_text)
        keyboard.row(
            InlineKeyboardButton("🔄 Повторить поиск", callback_data=f"search_in_category_{category_id}")
        )
        
        await message.answer(
            f"🔍 Поиск по запросу: '{search_query}'\n\n"
            f"❌ Ничего не найдено. Попробуйте другой запрос.",
            reply_markup=keyboard
        )
    
    await state.finish()

# Обработчик для пагинации 3x6 сетки
@dp.callback_query_handler(lambda c: c.data.startswith('grid_page_'))
async def handle_grid_pagination(callback_query: types.CallbackQuery):
    """Обработчик пагинации для 3x6 сетки"""
    await callback_query.answer()
    
    try:
        parts = callback_query.data.split('_')
        parent_id = int(parts[2])
        page = int(parts[3])
        
        # Сохраняем текущую страницу в состоянии пользователя
        set_user_page_state(callback_query.from_user.id, parent_id, page)
        
        # Получаем элементы категории
        items = await db.get_catalog_children(parent_id)
        
        # Получаем информацию о родительском элементе
        parent_item = await db.get_catalog_item(parent_id)
        if not parent_item:
            await callback_query.message.answer("❌ Категория не найдена.")
            return
        
        # Проверяем, использует ли элемент 3x6 сетку
        is_grid_3x6 = parent_item[13] if len(parent_item) > 13 else False
        
        if is_grid_3x6:
            search_button_name = parent_item[14] if len(parent_item) > 14 else None
            back_button_text = parent_item[15] if len(parent_item) > 15 else None
            
            # Проверяем права администратора
            is_admin = await db.is_admin(callback_query.from_user.id)
            
            keyboard = await create_3x6_grid_keyboard(
                items, 
                page=page, 
                search_button_name=search_button_name,
                back_button_text=back_button_text,
                parent_id=parent_id,
                is_admin=is_admin
            )
            
            try:
                await callback_query.message.edit_reply_markup(reply_markup=keyboard)
            except Exception as e:
                print(f"Ошибка при обновлении клавиатуры: {e}")
        else:
            await callback_query.message.answer("❌ Эта категория не использует сетку 3x6.")
            
    except (ValueError, IndexError) as e:
        print(f"Error in handle_grid_pagination: {e}")
        await callback_query.answer("Ошибка пагинации")
    except Exception as e:
        print(f"Unexpected error in handle_grid_pagination: {e}")
        await callback_query.answer(f"Ошибка: {e}")

@dp.message_handler(state=WelcomeEditStates.waiting_for_photo, content_types=types.ContentType.PHOTO)
async def process_welcome_photo(message: types.Message, state: FSMContext):
    """Обработка нового фото"""
    # Берём самое высокое разрешение фото
    photo_id = message.photo[-1].file_id
    
    # Проверяем валидность photo_id
    if not is_valid_telegram_file_id(photo_id):
        await message.answer(
            "❌ Ошибка: Получен невалидный ID фото. Попробуйте отправить другое фото."
        )
        return
    
    await db.set_bot_setting("welcome_photo_id", photo_id)
    await message.answer(
        f"✅ Фото успешно обновлено!\n\nID фото: <code>{photo_id}</code>",
        parse_mode="HTML"
    )
    await state.finish()

@dp.message_handler(state=WelcomeEditStates.waiting_for_photo)
async def process_welcome_photo_text(message: types.Message, state: FSMContext):
    """Обработка текстовой команды для фото"""
    if message.text and message.text.lower() in ['стандарт', 'default', 'standard']:
        await db.set_bot_setting("welcome_photo_id", None)
        await message.answer("✅ Возврат к стандартному фото. Будет использоваться файл image/katalog.png")
    else:
        await message.answer("❌ Ошибка: Отправьте фото или напишите 'стандарт' для возврата к стандартному фото.")
        return
    await state.finish()

@dp.message_handler(state=WelcomeEditStates.waiting_for_catalog_photo, content_types=types.ContentType.PHOTO)
async def process_catalog_photo_edit(message: types.Message, state: FSMContext):
    """Обработка нового фото каталога"""
    # Берём самое высокое разрешение фото
    photo_id = message.photo[-1].file_id
    
    # Проверяем валидность photo_id
    if not is_valid_telegram_file_id(photo_id):
        await message.answer(
            "❌ Ошибка: Получен невалидный ID фото. Попробуйте отправить другое фото."
        )
        return
    
    await db.set_bot_setting("catalog_photo_id", photo_id)
    await message.answer(
        f"✅ Фото каталога успешно обновлено!\n\nID фото: <code>{photo_id}</code>\n\n📝 Теперь это фото будет отображаться в каталоге с кнопками тем.",
        parse_mode="HTML"
    )
    await state.finish()

@dp.message_handler(state=WelcomeEditStates.waiting_for_catalog_photo)
async def process_catalog_photo_text(message: types.Message, state: FSMContext):
    """Обработка текстовой команды для фото каталога"""
    if message.text and message.text.lower() in ['стандарт', 'default', 'standard']:
        await db.set_bot_setting("catalog_photo_id", None)
        await message.answer("✅ Возврат к стандартному фото. Будет использоваться файл image/katalog.png")
    else:
        await message.answer("❌ Ошибка: Отправьте фото или напишите 'стандарт' для возврата к стандартному фото.")
        return
    await state.finish()

# Обработчики для системы бонусов

@dp.message_handler(state=BonusSystemStates.waiting_for_bonus_sticker, content_types=types.ContentType.STICKER)
async def process_bonus_sticker(message: types.Message, state: FSMContext):
    """Обработка стикера для системы бонусов"""
    await db.set_bot_setting("bonus_sticker_id", message.sticker.file_id)
    await message.answer(
        f"✅ Стикер бонусов успешно обновлён!\n\nID стикера: <code>{message.sticker.file_id}</code>",
        parse_mode="HTML"
    )
    await state.finish()

@dp.message_handler(state=BonusSystemStates.waiting_for_bonus_sticker)
async def process_bonus_sticker_text(message: types.Message, state: FSMContext):
    """Обработка текстовой команды для стикера бонусов"""
    if message.text and message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
        await message.answer("✅ Стикер пропущен.")
    elif message.text and message.text.lower() in ['удалить', 'delete', 'remove']:
        await db.set_bot_setting("bonus_sticker_id", None)
        await message.answer("✅ Стикер бонусов удалён.")
    else:
        await message.answer("❌ Ошибка: Отправьте стикер, 'пропустить' или 'удалить'.")
        return
    await state.finish()

@dp.message_handler(state=BonusSystemStates.waiting_for_bonus_photo, content_types=types.ContentType.PHOTO)
async def process_bonus_photo(message: types.Message, state: FSMContext):
    """Обработка фото для системы бонусов"""
    photo_id = message.photo[-1].file_id
    
    if not is_valid_telegram_file_id(photo_id):
        await message.answer(
            "❌ Ошибка: Получен невалидный ID фото. Попробуйте отправить другое фото."
        )
        return
    
    await db.set_bot_setting("bonus_photo_id", photo_id)
    await message.answer(
        f"✅ Фото бонусов успешно обновлено!\n\nID фото: <code>{photo_id}</code>",
        parse_mode="HTML"
    )
    await state.finish()

@dp.message_handler(state=BonusSystemStates.waiting_for_bonus_photo)
async def process_bonus_photo_text(message: types.Message, state: FSMContext):
    """Обработка текстовой команды для фото бонусов"""
    if message.text and message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
        await message.answer("✅ Фото пропущено.")
    elif message.text and message.text.lower() in ['удалить', 'delete', 'remove']:
        await db.set_bot_setting("bonus_photo_id", None)
        await message.answer("✅ Фото бонусов удалено.")
    else:
        await message.answer("❌ Ошибка: Отправьте фото, 'пропустить' или 'удалить'.")
        return
    await state.finish()

@dp.message_handler(state=BonusSystemStates.waiting_for_bonus_description)
async def process_bonus_description(message: types.Message, state: FSMContext):
    """Обработка описания для системы бонусов"""
    description_text = message.html_text if message.html_text else message.text
    
    if not description_text:
        await message.answer("❌ Ошибка: Описание не может быть пустым.")
        return
    
    await db.set_bot_setting("bonus_description", description_text.strip())
    await message.answer(
        f"✅ Описание бонусов обновлено с форматированием!\n\nНовое описание:\n{description_text}",
        parse_mode="HTML"
    )
    await state.finish()

# Обработчики для создания списка заданий

@dp.message_handler(state=BonusSystemStates.waiting_for_task_photo, content_types=types.ContentType.PHOTO)
async def process_task_photo(message: types.Message, state: FSMContext):
    """Обработка фото для задания"""
    photo_id = message.photo[-1].file_id
    
    if not is_valid_telegram_file_id(photo_id):
        await message.answer(
            "❌ Ошибка: Получен невалидный ID фото. Попробуйте отправить другое фото."
        )
        return
    
    async with state.proxy() as data:
        data['task_photo_id'] = photo_id
    
    await message.answer(
        f"✅ Фото принято!\n\n📋 Теперь введите название кнопки (например: 'Подписаться на канал'):"
    )
    await BonusSystemStates.waiting_for_task_name.set()

@dp.message_handler(state=BonusSystemStates.waiting_for_task_photo)
async def process_task_photo_text(message: types.Message, state: FSMContext):
    """Обработка текстовой команды для фото задания"""
    if message.text and message.text.lower() in ['пропустить', 'skip', 'нет', 'no']:
        async with state.proxy() as data:
            data['task_photo_id'] = None
        
        await message.answer(
            "✅ Фото пропущено.\n\n📋 Теперь введите название кнопки (например: 'Подписаться на канал'):"
        )
        await BonusSystemStates.waiting_for_task_name.set()
    else:
        from keyboards import create_skip_cancel_kb
        keyboard = create_skip_cancel_kb("skip_task_photo", "cancel_bonus_task")
        await message.answer("❌ Ошибка: Отправьте фото или используйте кнопку 'Пропустить':", reply_markup=keyboard)

@dp.message_handler(state=BonusSystemStates.waiting_for_task_name)
async def process_task_name(message: types.Message, state: FSMContext):
    """Обработка названия кнопки задания"""
    task_name = message.text.strip() if message.text else None
    
    if not task_name:
        await message.answer("❌ Ошибка: Название не может быть пустым.")
        return
    
    async with state.proxy() as data:
        data['task_name'] = task_name
    
    await message.answer(
        f"✅ Название принято: {task_name}\n\n"
        f"📝 Теперь введите описание задания:\n\n"
        f"✨ <b>Поддерживается форматирование Telegram!</b>",
        parse_mode="HTML"
    )
    await BonusSystemStates.waiting_for_task_description.set()

@dp.message_handler(state=BonusSystemStates.waiting_for_task_description)
async def process_task_description(message: types.Message, state: FSMContext):
    """Обработка описания задания"""
    description_text = message.html_text if message.html_text else message.text
    
    if not description_text:
        await message.answer("❌ Ошибка: Описание не может быть пустым.")
        return
    
    async with state.proxy() as data:
        section_id = data['section_id']
        task_name = data['task_name']
        task_photo_id = data.get('task_photo_id')
        
        # Создаем задание в базе данных
        try:
            # Используем тип 'custom' для пользовательских заданий, 0 билетов по умолчанию
            import json
            task_data = json.dumps({
                'photo_id': task_photo_id,
                'created_by': message.from_user.id
            })
            
            task_id = await db.add_bonus_task(
                section_id=section_id,
                task_type='custom',
                name=task_name,
                description=description_text.strip(),
                reward_tickets=0,  # По умолчанию 0 билетов
                task_data=task_data
            )
            
            # Получаем информацию о разделе
            section = await db.get_bonus_section(section_id)
            section_name = section[1] if section else f"ID {section_id}"
            
            success_message = (
                f"✅ Задание успешно создано!\n\n"
                f"🎯 <b>Название</b>: {task_name}\n"
                f"📁 <b>Раздел</b>: {section_name}\n"
                f"🆔 <b>ID задания</b>: {task_id}\n"
                f"📝 <b>Описание</b>:\n{description_text}\n\n"
                f"🎁 Новая кнопка теперь доступна в разделе '🎁⚡️Розыгрыши (4)💰🎁'!"
            )
            
            if task_photo_id:
                success_message += f"\n🖼️ <b>Фото</b>: прикреплено"
            
            await message.answer(success_message, parse_mode="HTML")
            
        except Exception as e:
            await message.answer(f"❌ Ошибка создания задания: {e}")
    
    await state.finish()


# Обработчики для создания условий покупок

@dp.message_handler(state=BonusSystemStates.waiting_for_purchase_condition_name)
async def process_purchase_condition_name(message: types.Message, state: FSMContext):
    """Обработка названия условия покупок"""
    condition_name = message.text
    
    if not condition_name:
        await message.answer("❌ Ошибка: Название не может быть пустым.")
        return
    
    async with state.proxy() as data:
        data['condition_name'] = condition_name.strip()
    
    await message.answer(
        f"✅ Название принято: '{condition_name.strip()}'\n\n"
        f"💰 Теперь введите сумму покупок (только цифры):\n\n"
        "📝 Пример: 15000"
    )
    await BonusSystemStates.waiting_for_purchase_condition_amount.set()

@dp.message_handler(state=BonusSystemStates.waiting_for_purchase_condition_amount)
async def process_purchase_condition_amount(message: types.Message, state: FSMContext):
    """Обработка суммы покупок"""
    try:
        amount = int(message.text.strip())
        if amount <= 0:
            raise ValueError("Сумма должна быть положительной")
    except ValueError:
        await message.answer("❌ Ошибка: Введите корректную сумму (цифры).")
        return
    
    async with state.proxy() as data:
        data['condition_amount'] = amount
    
    await message.answer(
        f"✅ Сумма принята: {amount}₽\n\n"
        f"🎫 Теперь введите количество билетов за выполнение условия:\n\n"
        "📝 Пример: 35"
    )
    await BonusSystemStates.waiting_for_purchase_condition_reward.set()

@dp.message_handler(state=BonusSystemStates.waiting_for_purchase_condition_reward)
async def process_purchase_condition_reward(message: types.Message, state: FSMContext):
    """Обработка награды за условие покупок"""
    try:
        reward_tickets = int(message.text.strip())
        if reward_tickets <= 0:
            raise ValueError("Количество билетов должно быть положительным")
    except ValueError:
        await message.answer("❌ Ошибка: Введите корректное количество билетов (цифры).")
        return
    
    async with state.proxy() as data:
        section_id = data['section_id']
        condition_name = data['condition_name']
        condition_amount = data['condition_amount']
        
        # Создаем условие покупок в базе данных
        try:
            import json
            task_data = json.dumps({
                'type': 'purchase_condition',
                'amount_required': condition_amount,
                'created_by': message.from_user.id
            })
            
            # Формируем полное название
            full_name = f"{condition_name}: {condition_amount}₽"
            description = f"Для выполнения этого условия необходимо сделать покупки на сумму {condition_amount}₽"
            
            task_id = await db.add_bonus_task(
                section_id=section_id,
                task_type='purchase_condition',
                name=full_name,
                description=description,
                reward_tickets=reward_tickets,
                task_data=task_data
            )
            
            if task_id:
                await message.answer(
                    f"✅ Условие покупок создано успешно!\n\n"
                    f"🔘 Название: {full_name}\n"
                    f"💰 Сумма: {condition_amount}₽\n"
                    f"🎫 Награда: {reward_tickets} билетов",
                    parse_mode="HTML"
                )
            else:
                await message.answer("❌ Ошибка создания условия покупок")
                
        except Exception as e:
            await message.answer(f"❌ Ошибка при создании условия: {e}")
    
    await state.finish()

@dp.callback_query_handler(lambda c: c.data.startswith("add_bonus_category"))
async def add_bonus_category_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик добавления новой категории бонусов"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    # Получаем section_id из callback_data, если он указан
    if "_" in callback.data and len(callback.data.split("_")) > 3:
        section_id = int(callback.data.split("_")[3])  # add_bonus_category_{section_id}
    else:
        section_id = None  # Корневая категория
    
    # Используем тот же рабочий процесс создания категорий
    await CatalogAddStates.waiting_for_sticker.set()
    async with state.proxy() as data:
        data['item_type'] = 'category'
        data['parent_id'] = section_id  # Используем section_id как parent_id
        data['is_bonus_category'] = True  # Отмечаем, что это категория бонусов
    
    context_text = ""
    if section_id:
        try:
            section = await db.get_bonus_section(section_id)
            if section:
                context_text = f"\n\n📁 Контекст: {section[1]}"
        except Exception:
            pass
    
    await callback.message.answer(
        f"➕ Добавление новой категории бонусов{context_text}\n\n"
        "🎁 Отправьте ID стикера для новой категории:",
        reply_markup=back_to_bonus_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "show_bonus_sections")
async def show_bonus_sections_handler(callback: types.CallbackQuery):
    """Обработчик показа списка разделов бонусов"""
    try:
        # Получаем корневые секции (без parent_id или parent_id = NULL)
        sections = await db.get_bonus_sections_by_parent(None)
        is_admin = await is_user_admin(callback.from_user.id)
        
        # Получаем настройки бонусов для сохранения оригинального текста
        bonus_description = await db.get_bot_setting("bonus_description") or "🎁 Бонусы, розыгрыши и задания"
        
        if not sections:
            text = f"{bonus_description}\n\n📋 Категории бонусов пусты"
            if is_admin:
                text += "\n\nНажмите '➕ Добавить категорию' чтобы создать первую категорию"
        else:
            text = f"{bonus_description}\n\nВыберите категорию:"
        
        keyboard = bonus_sections_list_kb(sections, is_admin=is_admin)
        
        # Проверяем, есть ли текст в сообщении для редактирования
        if callback.message.text or callback.message.caption:
            try:
                await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
            except Exception as e:
                # Ошибка редактирования - отправляем новое сообщение
                print(f"Ошибка редактирования сообщения: {e}")
                new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        else:
            # Нет текста для редактирования - отправляем новое
            new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
            # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
            await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()

# Обработчики для создания заданий в бонусной системе

@dp.callback_query_handler(lambda c: c.data.startswith("create_bonus_task_"))
async def create_bonus_task_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик создания нового задания"""
    if not await is_user_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав администратора", show_alert=True)
        return
    
    section_id = int(callback.data.split("_")[3])
    
    # Сохраняем section_id в состоянии
    await BonusSystemStates.waiting_for_task_type_selection.set()
    async with state.proxy() as data:
        data['section_id'] = section_id
    
    # Получаем информацию о секции
    section = await db.get_bonus_section(section_id)
    section_name = section[1] if section else f"ID {section_id}"
    
    # Клавиатура с типами заданий
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("💰 Покупки на сумму", callback_data="task_type_purchase"),
        InlineKeyboardButton("👥 Пригласи друзей", callback_data="task_type_referral"),
        InlineKeyboardButton("🛋️ Купить товар", callback_data="task_type_product"),
        InlineKeyboardButton("⚙️ Произвольное задание", callback_data="task_type_custom"),
        InlineKeyboardButton("🔙 Назад", callback_data=f"view_bonus_section_{section_id}")
    )
    
    await callback.message.answer(
        f"📋 Создание задания\n"
        f"📁 Категория: {section_name}\n\n"
        f"Выберите тип задания:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("task_type_"), state=BonusSystemStates.waiting_for_task_type_selection)
async def select_task_type_handler(callback: types.CallbackQuery, state: FSMContext):
    """Обработчик выбора типа задания"""
    task_type = callback.data.split("_")[2]  # purchase, referral, product
    
    async with state.proxy() as data:
        data['task_type'] = task_type
    
    # Определяем название типа задания
    task_type_names = {
        'purchase': '💰 Покупки на сумму',
        'referral': '👥 Пригласи друзей',
        'product': '🛋️ Купить товар',
        'custom': '⚙️ Произвольное задание'
    }
    
    await BonusSystemStates.waiting_for_new_task_name.set()
    
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="back_to_task_creation"))
    
    await callback.message.answer(
        f"➕ Создание задания: {task_type_names[task_type]}\n\n"
        f"📝 Введите название задания:",
        reply_markup=keyboard
    )
    await callback.answer()

@dp.message_handler(state=BonusSystemStates.waiting_for_new_task_name)
async def process_new_task_name(message: types.Message, state: FSMContext):
    """Обработка названия нового задания"""
    task_name = message.text.strip() if message.text else None
    
    if not task_name:
        await message.answer("❌ Ошибка: Название не может быть пустым.")
        return
    
    async with state.proxy() as data:
        data['task_name'] = task_name
    
    await BonusSystemStates.waiting_for_new_task_reward.set()
    
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="back_to_task_creation"))
    
    await message.answer(
        f"✅ Название принято: '{task_name}'\n\n"
        f"🎟️ Теперь введите награду в билетах (только цифры):\n\n"
        f"📝 Пример: 50",
        reply_markup=keyboard
    )

@dp.message_handler(state=BonusSystemStates.waiting_for_new_task_reward)
async def process_new_task_reward(message: types.Message, state: FSMContext):
    """Обработка награды за задание"""
    try:
        reward = int(message.text.strip())
        if reward <= 0:
            raise ValueError("Награда должна быть положительной")
    except ValueError:
        await message.answer("❌ Ошибка: Введите корректное количество билетов (цифры).")
        return
    
    async with state.proxy() as data:
        data['reward'] = reward
        task_type = data['task_type']
    
    # Переходим к специфичным параметрам в зависимости от типа задания
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="back_to_task_creation"))
    
    if task_type == 'purchase':
        await BonusSystemStates.waiting_for_purchase_amount.set()
        await message.answer(
            f"✅ Награда принята: {reward} билетов\n\n"
            f"💰 Укажите минимальную сумму покупки для получения вознаграждения (в рублях):\n\n"
            f"📝 Пример: 1500",
            reply_markup=keyboard
        )
    elif task_type == 'referral':
        await BonusSystemStates.waiting_for_friends_count.set()
        await message.answer(
            f"✅ Награда принята: {reward} билетов\n\n"
            f"👥 Укажите количество приглашаемых пользователей для получения вознаграждения:\n\n"
            f"📝 Пример: 5",
            reply_markup=keyboard
        )
    elif task_type == 'product':
        await BonusSystemStates.waiting_for_product_link.set()
        await message.answer(
            f"✅ Награда принята: {reward} билетов\n\n"
            f"🛋️ Укажите ссылку на товар:\n\n"
            f"📝 Пример: https://t.me/bot_username?start=product_123",
            reply_markup=keyboard
        )
    elif task_type == 'custom':
        # Произвольное задание - сразу создаем без дополнительных параметров
        async with state.proxy() as data:
            # Создаем задание с собранными данными
            await create_task_with_params(message, data)
        await state.finish()

# Обработчики специфичных параметров заданий

@dp.message_handler(state=BonusSystemStates.waiting_for_purchase_amount)
async def process_purchase_amount(message: types.Message, state: FSMContext):
    """Обработка минимальной суммы покупки"""
    try:
        amount = int(message.text.strip())
        if amount <= 0:
            raise ValueError("Сумма должна быть положительной")
    except ValueError:
        await message.answer("❌ Ошибка: Введите корректную сумму (цифры).")
        return
    
    async with state.proxy() as data:
        data['purchase_amount'] = amount
        
        # Создаем задание с собранными данными
        await create_task_with_params(message, data)
    
    await state.finish()

@dp.message_handler(state=BonusSystemStates.waiting_for_friends_count)
async def process_friends_count(message: types.Message, state: FSMContext):
    """Обработка количества друзей для приглашения"""
    try:
        friends_count = int(message.text.strip())
        if friends_count <= 0:
            raise ValueError("Количество должно быть положительным")
    except ValueError:
        await message.answer("❌ Ошибка: Введите корректное количество (цифры).")
        return
    
    async with state.proxy() as data:
        data['friends_count'] = friends_count
        
        # Создаем задание с собранными данными
        await create_task_with_params(message, data)
    
    await state.finish()

@dp.message_handler(state=BonusSystemStates.waiting_for_product_link)
async def process_product_link(message: types.Message, state: FSMContext):
    """Обработка ссылки на товар"""
    product_link = message.text.strip()
    
    if not product_link:
        await message.answer("❌ Ошибка: Ссылка не может быть пустой.")
        return
    
    # Извлекаем название товара из ссылки для автозаполнения
    product_name = None
    if "start=product_" in product_link:
        try:
            # Извлекаем ID продукта из ссылки
            product_id = int(product_link.split("start=product_")[1].split("&")[0])
            product = await db.get_catalog_item(product_id)
            if product:
                product_name = product[3]  # Название товара
        except (ValueError, IndexError):
            pass
    
    async with state.proxy() as data:
        data['product_link'] = product_link
        
        # Если удалось извлечь название товара, используем его
        if product_name:
            data['task_name'] = product_name
        
        # Создаем задание с собранными данными
        await create_task_with_params(message, data)
    
    await state.finish()

async def create_task_with_params(message: types.Message, data: dict):
    """Создает задание с собранными параметрами"""
    try:
        import json
        
        section_id = data['section_id']
        task_type = data['task_type']
        task_name = data['task_name']
        reward = data['reward']
        
        # Формируем task_data в зависимости от типа задания
        task_data = {
            'created_by': message.from_user.id,
            'type': task_type
        }
        
        if task_type == 'purchase':
            purchase_amount = data['purchase_amount']
            task_data['amount_required'] = purchase_amount
            description = f"Совершите покупки на сумму {purchase_amount}₽ или больше для получения награды."
        elif task_type == 'referral':
            friends_count = data['friends_count']
            task_data['friends_required'] = friends_count
            description = f"Пригласите {friends_count} друзей для получения награды."
        elif task_type == 'product':
            product_link = data['product_link']
            task_data['product_link'] = product_link
            description = f"Купите товар по ссылке: {product_link}"
        elif task_type == 'custom':
            # Произвольное задание - используем только название
            description = f"Выполните указанное задание для получения награды."
        else:
            description = "Выполните указанное задание для получения награды."
        
        # Создаем задание в базе данных
        task_id = await db.add_bonus_task(
            section_id=section_id,
            task_type=task_type,
            name=task_name,
            description=description,
            reward_tickets=reward,
            task_data=json.dumps(task_data)
        )
        
        if task_id:
            # Получаем информацию о разделе
            section = await db.get_bonus_section(section_id)
            section_name = section[1] if section else f"ID {section_id}"
            
            # Формируем сообщение об успехе с деталями задания
            task_type_names = {
                'purchase': '💰 Покупки на сумму',
                'referral': '👥 Пригласи друзей',
                'product': '🛋️ Купить товар',
                'custom': '⚙️ Произвольное задание'
            }
            
            success_message = (
                f"✅ Задание успешно создано!\n\n"
                f"🎯 <b>Тип</b>: {task_type_names[task_type]}\n"
                f"📝 <b>Название</b>: {task_name}\n"
                f"📁 <b>Категория</b>: {section_name}\n"
                f"🎫 <b>Награда</b>: {reward} билетов\n"
                f"🆔 <b>ID задания</b>: {task_id}\n\n"
                f"📋 <b>Описание</b>:\n{description}\n\n"
                f"🎁 Новое задание теперь доступно в категории бонусов!"
            )
            
            await message.answer(success_message, parse_mode="HTML")
        else:
            await message.answer("❌ Ошибка создания задания")
            
    except Exception as e:
        await message.answer(f"❌ Ошибка при создании задания: {e}")

# УДАЛЕНЫ СТАРЫЕ ОБРАБОТЧИКИ: process_bonus_section_name, process_bonus_section_description, process_bonus_section_photo_text
# Теперь создание категорий бонусов использует стандартный workflow создания категорий каталога

@dp.callback_query_handler(lambda c: c.data.startswith("view_bonus_section_"))
async def view_bonus_section_handler(callback: types.CallbackQuery):
    """Обработчик просмотра раздела бонусов"""
    try:
        section_id = int(callback.data.split("_")[3])
        section = await db.get_bonus_section(section_id)
        
        if not section:
            await callback.answer("Раздел не найден", show_alert=True)
            return
        
        # Получаем данные раздела
        section_name = section[1]
        section_description = section[2]
        section_photo_id = section[3]
        section_parent_id = section[4]
        
        # Проверяем права админа
        is_admin = await is_user_admin(callback.from_user.id)
        
        # Получаем подкатегории (дочерние секции)
        subcategories = await db.get_bonus_sections_by_parent(section_id)
        
        # Получаем задания в этом разделе
        tasks = await db.get_bonus_tasks(section_id=section_id)
        
        # Создаем клавиатуру
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        keyboard = InlineKeyboardMarkup(row_width=1)
        
        # Добавляем кнопку "🎫 Мои билеты" только в категориях, которые содержат задания
        if tasks:
            keyboard.add(
                InlineKeyboardButton("🎫 Мои билеты", callback_data=f"view_my_tickets_{section_id}")
            )
        
        # Добавляем подкатегории
        for subcategory in subcategories:
            subcategory_id, subcategory_name = subcategory[0], subcategory[1]
            # Поддержка базового форматирования в названиях кнопок
            # Удаляем только _ и ~, оставляем * для жирного форматирования
            formatted_name = subcategory_name.replace('_', '').replace('~', '')
            keyboard.add(
                InlineKeyboardButton(
                    formatted_name, 
                    callback_data=f"view_bonus_section_{subcategory_id}"
                )
            )
        
        # Затем добавляем задания
        for task in tasks[:10]:  # Показываем первые 10 заданий
            task_id = task[0]
            task_name = task[3]
            
            # Проверяем статус выполнения
            progress = await db.get_user_task_progress(callback.from_user.id, task_id)
            is_completed = progress and progress[2] if progress else False
            
            # Добавляем иконку статуса к названию кнопки
            status_icon = "✅" if is_completed else "☑️"
            # Поддержка базового форматирования в названиях кнопок
            # Удаляем только _ и ~, оставляем * для жирного форматирования
            formatted_task_name = task_name.replace('_', '').replace('~', '')
            button_text = f"{status_icon} {formatted_task_name}"
            
            keyboard.add(
                InlineKeyboardButton(
                    button_text, 
                    callback_data=f"view_task_{task_id}"
                )
            )
        
        # Для админа добавляем кнопки "Добавить категорию" и "Создать задание"
        if is_admin:
            keyboard.add(
                InlineKeyboardButton("➕ Добавить категорию", callback_data=f"add_bonus_category_{section_id}")
            )
            keyboard.add(
                InlineKeyboardButton("🎯 Создать задание", callback_data=f"create_bonus_task_{section_id}")
            )
        
        # Кнопка назад - в зависимости от того, есть ли родитель
        if section_parent_id:
            # Есть родитель - возвращаемся к нему
            keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_bonus_section_{section_parent_id}"))
        else:
            # Нет родителя - возвращаемся к списку категорий
            keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="show_bonus_sections"))
        
        # Формируем текст
        if not subcategories and not tasks:
            content_text = "📋 В этой категории пока нет категорий и заданий.\n\nОжидайте обновлений от администратора!"
        else:
            content_text = ""
        
        text = f"{section_description or ''}\n\n{content_text}"
        
        # Отправляем сообщение с фото или без него
        if section_photo_id:
            try:
                # Проверяем, является ли photo_id действительным идентификатором файла
                if isinstance(section_photo_id, str) and len(section_photo_id) > 0:
                    # Сначала пытаемся отредактировать сообщение, если оно существует
                    try:
                        if callback.message.text or callback.message.caption:
                            await callback.message.edit_caption(caption=text, reply_markup=keyboard, parse_mode="HTML")
                        else:
                            # Если это не фото сообщение, удаляем и отправляем новое
                            await callback.message.delete()
                            new_message = await callback.message.answer_photo(
                                photo=section_photo_id,
                                caption=text,
                                reply_markup=keyboard,
                                parse_mode="HTML"
                            )
                            # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                            await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
                    except Exception as edit_error:
                        # Если редактирование не удалось, отправляем новое сообщение
                        print(f"Ошибка редактирования сообщения: {edit_error}")
                        try:
                            new_message = await callback.message.answer_photo(
                                photo=section_photo_id,
                                caption=text,
                                reply_markup=keyboard,
                                parse_mode="HTML"
                            )
                            # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                            await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
                        except Exception as send_error:
                            # Если отправка фото не удалась, отправляем только текст
                            print(f"Ошибка отправки фото раздела: {send_error}")
                            new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                            # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                            await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
                else:
                    # Недействительный photo_id, отправляем только текст
                    raise ValueError("Invalid photo ID")
            except Exception as e:
                # Если фото не работает, отправляем только текст
                print(f"Ошибка отправки фото раздела: {e}")
                try:
                    # Проверяем, есть ли текст в сообщении для редактирования
                    if callback.message.text or callback.message.caption:
                        await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                    else:
                        # Нет текста для редактирования - отправляем новое сообщение
                        new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                        # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                        await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
                except Exception as edit_error:
                    # Ошибка редактирования - отправляем новое сообщение
                    print(f"Ошибка редактирования сообщения: {edit_error}")
                    new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                    # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                    await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        else:
            try:
                # Проверяем, есть ли текст в сообщении для редактирования
                if callback.message.text or callback.message.caption:
                    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                else:
                    # Нет текста для редактирования - отправляем новое сообщение
                    new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                    # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                    await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
            except Exception as e:
                # Ошибка редактирования - отправляем новое сообщение
                print(f"Ошибка редактирования сообщения: {e}")
                new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data == "show_bonus_sections")
async def show_bonus_sections_handler(callback: types.CallbackQuery):
    """Обработчик показа списка разделов бонусов"""
    try:
        # Получаем корневые секции (без parent_id или parent_id = NULL)
        sections = await db.get_bonus_sections_by_parent(None)
        is_admin = await is_user_admin(callback.from_user.id)
        
        # Получаем настройки бонусов для сохранения оригинального текста
        bonus_description = await db.get_bot_setting("bonus_description") or "🎁 Бонусы, розыгрыши и задания"
        
        if not sections:
            text = f"{bonus_description}\n\n📋 Категории бонусов пусты"
            if is_admin:
                text += "\n\nНажмите '➕ Добавить категорию' чтобы создать первую категорию"
        else:
            text = f"{bonus_description}\n\nВыберите категорию:"
        
        keyboard = bonus_sections_list_kb(sections, is_admin=is_admin)
        
        # Проверяем, есть ли текст в сообщении для редактирования
        if callback.message.text or callback.message.caption:
            try:
                await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
            except Exception as e:
                # Ошибка редактирования - отправляем новое сообщение
                print(f"Ошибка редактирования сообщения: {e}")
                new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        else:
            # Нет текста для редактирования - отправляем новое
            new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
            # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
            await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()


@dp.callback_query_handler(lambda c: c.data.startswith("view_my_tickets"))
async def view_my_tickets_handler(callback: types.CallbackQuery):
    """Обработчик показа информации о билетах пользователя"""
    try:
        # Получаем количество билетов пользователя
        user_tickets = await db.get_user_tickets(callback.from_user.id)
        
        # Формируем текст сообщения
        text = f"🎫 Мои билеты\n\nВсего билетов: {user_tickets}"
        
        # Определяем callback_data для кнопки "Назад" в зависимости от того, 
        # был ли передан section_id
        if "_" in callback.data and len(callback.data.split("_")) > 3:
            # Получаем section_id из callback_data
            section_id = int(callback.data.split("_")[3])
            back_callback_data = f"view_bonus_section_{section_id}"
        else:
            # Если section_id не передан, возвращаемся к основному списку
            back_callback_data = "show_bonus_sections"
        
        # Создаем клавиатуру с кнопкой "Назад"
        keyboard = InlineKeyboardMarkup(row_width=1)
        keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=back_callback_data))
        
        # Отправляем сообщение
        if callback.message.text or callback.message.caption:
            try:
                await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
            except Exception as e:
                # Ошибка редактирования - отправляем новое сообщение
                print(f"Ошибка редактирования сообщения: {e}")
                new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        else:
            # Нет текста для редактирования - отправляем новое
            new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
            # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
            await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()

# УДАЛЕН view_as_user_handler - теперь админ видит все как пользователь но с кнопкой "Добавить категорию"

# УДАЛЕН create_task_list_handler - кнопка "Создать список заданий" удалена


# УДАЛЕН create_purchase_conditions_handler - кнопка "Создать условия покупок" удалена


@dp.callback_query_handler(lambda c: c.data.startswith("complete_task_"))
async def complete_task_handler(callback: types.CallbackQuery):
    """Обработчик выполнения задания"""
    try:
        task_id = int(callback.data.split("_")[2])
        user_id = callback.from_user.id
        
        # Получаем информацию о задании
        tasks = await db.get_bonus_tasks()
        task = None
        for t in tasks:
            if t[0] == task_id:
                task = t
                break
        
        if not task:
            await callback.answer("Задание не найдено", show_alert=True)
            return
        
        # Проверяем, не выполнено ли уже задание
        progress = await db.get_user_task_progress(user_id, task_id)
        if progress and progress[2]:  # is_completed
            await callback.answer("Задание уже выполнено!", show_alert=True)
            return
        
        # Отмечаем задание как выполненное
        await db.update_user_task_progress(user_id, task_id, is_completed=True)
        
        # Начисляем билеты если они предусмотрены
        reward_tickets = task[5]  # task[5] = reward_tickets
        if reward_tickets > 0:
            await db.add_user_tickets(user_id, reward_tickets)
            reward_text = f"\n\n🎫 Вы получили {reward_tickets} билетов!"
        else:
            reward_text = ""
        
        await callback.answer(
            f"✅ Задание '{task[3]}' выполнено!{reward_text}", 
            show_alert=True
        )
        
        # Обновляем отображение задания (перенаправляем на просмотр задания)
        await view_task_handler(callback)
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)


@dp.callback_query_handler(lambda c: c.data.startswith("execute_task_"))
async def execute_task_handler(callback: types.CallbackQuery):
    """Обработчик выполнения задания - переходит к товару"""
    try:
        task_id = int(callback.data.split("_")[2])
        
        # Получаем информацию о задании
        tasks = await db.get_bonus_tasks()
        task = None
        for t in tasks:
            if t[0] == task_id:
                task = t
                break
        
        if not task:
            await callback.answer("Задание не найдено", show_alert=True)
            return
        
        task_type = task[2]  # task_type
        
        # Проверяем, что это задание типа "product"
        if task_type != "product":
            await callback.answer("Это действие доступно только для заданий с товарами", show_alert=True)
            return
        
        # Получаем данные задания
        try:
            import json
            task_data = json.loads(task[6]) if task[6] else {}
            product_link = task_data.get("product_link", "")
            
            if not product_link:
                await callback.answer("Ссылка на товар не найдена", show_alert=True)
                return
            
            # Извлекаем ID товара из ссылки
            if "start=product_" in product_link:
                try:
                    product_id = int(product_link.split("start=product_")[1].split("&")[0].split("?")[0])
                    
                    # Проверяем, что товар существует
                    product = await db.get_catalog_item(product_id)
                    if not product:
                        await callback.answer("Товар не найден", show_alert=True)
                        return
                    
                    # Создаем новый callback для просмотра товара
                    new_callback_data = f"view_product_{product_id}"
                    
                    # Создаем новый callback объект с измененными данными
                    new_callback = callback
                    new_callback.data = new_callback_data
                    
                    # Вызываем обработчик просмотра товара
                    # Создаем фиктивное состояние или None для избежания ошибки
                    fake_state = None
                    await view_product_handler(new_callback, state=fake_state)
                    
                except (ValueError, IndexError) as e:
                    await callback.answer("Некорректная ссылка на товар", show_alert=True)
                    return
            else:
                await callback.answer("Некорректная ссылка на товар", show_alert=True)
                return
                
        except Exception as e:
            print(f"Ошибка обработки данных задания: {e}")
            await callback.answer("Ошибка обработки задания", show_alert=True)
            return
        
    except Exception as e:
        print(f"Ошибка в execute_task_handler: {e}")
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)

@dp.callback_query_handler(lambda c: c.data.startswith("complete_bonus_task_"))
async def complete_bonus_task_handler(callback: types.CallbackQuery):
    """Обработчик выполнения новых типов заданий"""
    try:
        task_id = int(callback.data.split("_")[3])
        user_id = callback.from_user.id
        
        # Получаем информацию о задании
        tasks = await db.get_bonus_tasks()
        task = None
        for t in tasks:
            if t[0] == task_id:
                task = t
                break
        
        if not task:
            await callback.answer("Задание не найдено", show_alert=True)
            return
        
        # Проверяем, не выполнено ли уже задание
        progress = await db.get_user_task_progress(user_id, task_id)
        if progress and progress[2]:  # is_completed
            await callback.answer("Задание уже выполнено!", show_alert=True)
            return
        
        # Отмечаем задание как выполненное
        await db.update_user_task_progress(user_id, task_id, is_completed=True)
        
        # Начисляем билеты если они предусмотрены
        reward_tickets = task[5]  # task[5] = reward_tickets
        if reward_tickets > 0:
            await db.add_user_tickets(user_id, reward_tickets)
            reward_text = f"\n\n🎫 Вы получили {reward_tickets} билетов!"
        else:
            reward_text = ""
        
        await callback.answer(
            f"✅ Задание '{task[3]}' выполнено!{reward_text}", 
            show_alert=True
        )
        
        # Обновляем отображение задания (перенаправляем на просмотр задания)
        await view_task_handler(callback)
        
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
from aiogram import types
from aiogram.dispatcher import FSMContext
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from datetime import datetime
import json

# Import required functions from keyboards module
from keyboards import bonus_sections_list_kb, admin_management_kb, back_to_admin_management_kb
# is_user_admin and set_admin_commands_for_user are defined in this file
# smart_cleanup_after_send is defined in this file


@dp.callback_query_handler(lambda c: c.data.startswith("view_task_"))
async def view_task_handler(callback: types.CallbackQuery):
    """Обработчик просмотра задания"""
    try:
        task_id = int(callback.data.split("_")[2])
        
        # Получаем информацию о задании
        tasks = await db.get_bonus_tasks()
        task = None
        for t in tasks:
            if t[0] == task_id:
                task = t
                break
        
        if not task:
            await callback.answer("Задание не найдено", show_alert=True)
            return
        
        task_name = task[3]
        task_description = task[4]
        reward_tickets = task[5]
        section_id = task[1]
        
        # Проверяем статус выполнения
        progress = await db.get_user_task_progress(callback.from_user.id, task_id)
        is_completed = progress and progress[2] if progress else False
        task_type = task[2]  # task_type
        
        # Обработка разных типов заданий
        if task_type in ['purchase', 'referral', 'product', 'custom']:
            # Новые типы заданий с проверкой
            try:
                import json
                task_data = json.loads(task[6]) if task[6] else {}
                
                # Определяем статус и иконку
                if is_completed:
                    status_text = "✅ Задание выполнено"
                else:
                    status_text = "☑️ Задание не выполнено"
                
                # Формируем текст в соответствии с требованиями пользователя
                text = (
                    f"{task_name}\n\n"
                    f"🎫 Награда: {reward_tickets} билетов\n\n"
                    f"{status_text}"
                )
                
                # Клавиатура
                keyboard = InlineKeyboardMarkup(row_width=1)
                
                # Для заданий типа "product" добавляем кнопку "🔗 Выполнить задание"
                if task_type == "product" and not is_completed:
                    product_link = task_data.get("product_link", "")
                    if product_link:
                        keyboard.add(
                            InlineKeyboardButton(
                                "🔗 Выполнить задание", 
                                callback_data=f"execute_task_{task_id}"
                            )
                        )
                
                # Кнопка "Я выполнил(а)" только если задание не выполнено
                if not is_completed:
                    keyboard.add(
                        InlineKeyboardButton(
                            "✅Я выполнил(а)", 
                            callback_data=f"complete_bonus_task_{task_id}"
                        )
                    )
                
                keyboard.add(
                    InlineKeyboardButton(
                        "🔙 Назад", 
                        callback_data=f"view_bonus_section_{section_id}"
                    )
                )
                
            except Exception as e:
                print(f"Ошибка обработки нового типа задания: {e}")
                # Фолбэк на обычное отображение
                text = (
                    f"🎯 <b>{task_name}</b>\n\n"
                    f"📝 <b>Описание:</b>\n{task_description}\n\n"
                    f"🎫 <b>Награда:</b> {reward_tickets} билетов"
                )
                keyboard = InlineKeyboardMarkup(row_width=1)
                keyboard.add(
                    InlineKeyboardButton(
                        "🔙 Назад", 
                        callback_data=f"view_bonus_section_{section_id}"
                    )
                )
        
        elif task_type == 'purchase_condition':
            # Обработка условий покупок
            try:
                import json
                task_data = json.loads(task[6]) if task[6] else {}
                required_amount = task_data.get('amount_required', 0)
                
                # TODO: Получить реальную сумму покупок пользователя
                user_total_purchases = 0  # Пока по умолчанию 0
                
                is_condition_completed = user_total_purchases >= required_amount
                status_text = "✅ Задание выполнено" if is_condition_completed else "☑️ Задание не выполнено"
                
                text = (
                    f"{task_name}\n\n"
                    f"🎫 Награда: {reward_tickets} билетов\n\n"
                    f"{status_text}"
                )
                
                # Клавиатура для условий покупок
                keyboard = InlineKeyboardMarkup(row_width=1)
                
                if not is_condition_completed:
                    keyboard.add(
                        InlineKeyboardButton(
                            "✅Я выполнил(а)", 
                            callback_data=f"check_purchase_condition_{task_id}"
                        )
                    )
                
                keyboard.add(
                    InlineKeyboardButton(
                        "🔙 Назад", 
                        callback_data=f"view_bonus_section_{section_id}"
                    )
                )
                
            except Exception as e:
                print(f"Ошибка обработки условия покупок: {e}")
                # Фолбэк на обычное отображение
                text = (
                    f"🎯 <b>{task_name}</b>\n\n"
                    f"📝 <b>Описание:</b>\n{task_description}\n\n"
                    f"🎫 <b>Награда:</b> {reward_tickets} билетов"
                )
                keyboard = InlineKeyboardMarkup(row_width=1)
                keyboard.add(
                    InlineKeyboardButton(
                        "🔙 Назад к заданиям", 
                        callback_data=f"view_bonus_section_{section_id}"
                    )
                )
        else:
            # Обычное задание
            text = (
                f"🎯 <b>{task_name}</b>\n\n"
                f"📝 <b>Описание:</b>\n{task_description}\n\n"
                f"🎫 <b>Награда:</b> {reward_tickets} билетов"
            )
            
            # Клавиатура без кнопок выполнения задания
            keyboard = InlineKeyboardMarkup(row_width=1)
            
            # Кнопка назад к списку заданий
            keyboard.add(
                InlineKeyboardButton(
                    "🔙 Назад к заданиям", 
                    callback_data=f"view_bonus_section_{section_id}"
                )
            )
            #бота создал @pravitelstvo_russian

        # Получаем фото из task_data если оно есть
        task_photo_id = None
        if len(task) > 6 and task[6]:  # task_data
            try:
                import json
                task_data = json.loads(task[6])
                task_photo_id = task_data.get('photo_id')
            except:
                pass
        
        # Отправляем сообщение с фото или без него
        if task_photo_id:
            try:
                await callback.message.delete()
                new_message = await callback.message.answer_photo(
                    photo=task_photo_id,
                    caption=text,
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
                # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
            except Exception as e:
                # Если фото не работает, отправляем только текст
                print(f"Ошибка отправки фото задания: {e}")
                try:
                    # Проверяем, есть ли текст в сообщении для редактирования
                    if callback.message.text or callback.message.caption:
                        await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                    else:
                        # Нет текста для редактирования - отправляем новое сообщение
                        new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                        # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                        await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
                except Exception as edit_error:
                    # Если не можем отредактировать, отправляем новое сообщение
                    print(f"Ошибка редактирования сообщения: {edit_error}")
                    new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                    # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                    await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
        else:
            try:
                # Проверяем, есть ли текст в сообщении для редактирования
                if callback.message.text or callback.message.caption:
                    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
                else:
                    # Нет текста для редактирования - отправляем новое сообщение
                    new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                    # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                    await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
            except Exception as e:
                # Если не можем отредактировать (например, нет текста в сообщении), отправляем новое
                print(f"Ошибка редактирования сообщения: {e}")
                new_message = await callback.message.answer(text, reply_markup=keyboard, parse_mode="HTML")
                # Очищаем предыдущие сообщения, но сохраняем стикер бонусов
                await smart_cleanup_after_send(callback, preserve_bonus_sticker=True)
            
    except Exception as e:
        await callback.answer(f"❌ Ошибка: {e}", show_alert=True)
    
    await callback.answer()

@dp.message_handler(lambda message: message.text and message.text == "🎁ПОЛУЧИ БОНУСЫ🎁")
async def handle_bonus_button(message: types.Message):
    """Обработчик кнопки 'ПОЛУЧИ БОНУСЫ'"""
    try:
        # Получаем настройки системы бонусов
        bonus_sticker_id = await db.get_bot_setting("bonus_sticker_id")
        bonus_photo_id = await db.get_bot_setting("bonus_photo_id")
        bonus_description = await db.get_bot_setting("bonus_description") or "🎁 Система бонусов!\n\nВыполняйте задания и получайте билеты!"
        
        # Отправляем стикер если он установлен
        if bonus_sticker_id:
            try:
                await message.answer_sticker(sticker=bonus_sticker_id)
            except Exception as e:
                print(f"Ошибка отправки стикера бонусов: {e}")
        
        # Получаем только корневые разделы бонусов (без родителя)
        sections = await db.get_bonus_sections_by_parent(None)
        
        # Проверяем, является ли пользователь админом
        is_admin = await is_user_admin(message.from_user.id)
        keyboard = bonus_sections_list_kb(sections, is_admin=is_admin)
        
        # Отправляем фото с описанием и кнопками
        if bonus_photo_id:
            try:
                await message.answer_photo(
                    photo=bonus_photo_id,
                    caption=bonus_description,
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
            except Exception as e:
                # Если фото не работает, отправляем только текст
                print(f"Ошибка отправки фото бонусов: {e}")
                await message.answer(
                    text=bonus_description,
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
        else:
            # Отправляем только текст
            await message.answer(
                text=bonus_description,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
            
        # Очищаем предыдущие сообщения после отправки нового контента
        # Создаем фиктивный callback для использования с smart_cleanup_after_send
        class FakeCallback:
            def __init__(self, message):
                self.message = message
                self.from_user = message.from_user
        
        fake_callback = FakeCallback(message)
        await smart_cleanup_after_send(fake_callback)
        
    except Exception as e:
        await message.answer(f"❌ Ошибка загрузки системы бонусов: {e}")

# Обработчики состояний для управления администраторами
@dp.message_handler(state=AdminManagementStates.waiting_for_admin_id)
async def process_add_admin_id(message: types.Message, state: FSMContext):
    """Обработка ID админа для добавления"""
    if message.text and message.text.lower() in ['отмена', 'cancel']:
        await state.finish()
        await message.answer(
            "❌ Добавление админа отменено",
            reply_markup=admin_management_kb()
        )
        return
    
    try:
        admin_id = int(message.text.strip())
        
        # Проверяем, не является ли пользователь уже админом
        if await db.is_admin(admin_id):
            await message.answer(
                "⚠️ Этот пользователь уже является администратором!",
                reply_markup=back_to_admin_management_kb()
            )
            return
        
        # Получаем информацию о пользователе (если есть)
        try:
            user_info = await bot.get_chat(admin_id)
            username = user_info.username or f"ID_{admin_id}"
        except:
            username = f"ID_{admin_id}"
        
        # Добавляем администратора
        success = await db.add_admin(admin_id, username, message.from_user.id)
        
        if success:
            # Устанавливаем админ команды для нового админа
            commands_set = await set_admin_commands_for_user(admin_id)
            
            success_emoji = "✅ Установлены"
            error_emoji = "⚠️ Ошибка установки"
            
            await message.answer(
                f"✅ Администратор успешно добавлен!\n\n"
                f"👤 ID: {admin_id}\n"
                f"📝 Имя: {username}\n"
                f"🗓️ Добавлен: {datetime.now().strftime('%d.%m.%Y %H:%M')}\n"
                f"💼 Команды: {success_emoji if commands_set else error_emoji}",
                reply_markup=admin_management_kb()
            )
            
            # Уведомляем нового админа
            try:
                await bot.send_message(
                    chat_id=admin_id,
                    text="🎉 Поздравляем! Вы назначены администратором бота!\n\n"
                    "💼 Теперь вам доступны административные команды:\n"
                    "• /cards - Управление реквизитами\n"
                    "• /edit - Изменить /start\n"
                    "• /admins - Административный состав\n"
                    "• /send - Рассылка"
                )
            except:
                pass  # Если не удалось отправить - не критично
        else:
            await message.answer(
                "❌ Ошибка при добавлении администратора",
                reply_markup=back_to_admin_management_kb()
            )
            
    except ValueError:
        await message.answer(
            "❌ Неверный формат ID. Введите числовой ID пользователя:\n\n"
            "📝 Пример: 123456789",
            reply_markup=back_to_admin_management_kb()
        )
        return
    except Exception as e:
        await message.answer(
            f"❌ Ошибка: {e}",
            reply_markup=back_to_admin_management_kb()
        )
    
    await state.finish()

@dp.message_handler(state=AdminManagementStates.waiting_for_remove_admin_id)
async def process_remove_admin_id(message: types.Message, state: FSMContext):
    """Обработка ID админа для удаления"""
    if message.text and message.text.lower() in ['отмена', 'cancel']:
        await state.finish()
        await message.answer(
            "❌ Удаление админа отменено",
            reply_markup=admin_management_kb()
        )
        return
    
    try:
        admin_id = int(message.text.strip())
        
        # Проверяем, что это не главный админ
        if admin_id == cfg.ADMIN_ID:
            await message.answer(
                "⚠️ Нельзя удалить главного администратора!",
                reply_markup=back_to_admin_management_kb()
            )
            return
        
        # Проверяем, является ли пользователь админом
        if not await db.is_admin(admin_id):
            await message.answer(
                "⚠️ Этот пользователь не является администратором!",
                reply_markup=back_to_admin_management_kb()
            )
            return
        
        # Удаляем администратора
        success = await db.remove_admin(admin_id)
        
        if success:
            await message.answer(
                f"✅ Администратор успешно удалён!\n\n"
                f"👤 ID: {admin_id}\n"
                f"🗓️ Удалён: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
                reply_markup=admin_management_kb()
            )
            
            # Уведомляем бывшего админа
            try:
                await bot.send_message(
                    chat_id=admin_id,
                    text="⚠️ Ваши права администратора были отозваны."
                )
            except:
                pass  # Если не удалось отправить - не критично
        else:
            await message.answer(
                "❌ Ошибка при удалении администратора",
                reply_markup=back_to_admin_management_kb()
            )
            
    except ValueError:
        await message.answer(
            "❌ Неверный формат ID. Введите числовой ID пользователя:\n\n"
            "📝 Пример: 123456789",
            reply_markup=back_to_admin_management_kb()
        )
        return
    except Exception as e:
        await message.answer(
            f"❌ Ошибка: {e}",
            reply_markup=back_to_admin_management_kb()
        )
    
    await state.finish()


async def test_cryptobot_connection():
    """Тестирует подключение к CryptoBot API"""
    api_key = await get_cryptobot_api_key()
    if not api_key:
        warning_msg = "⚠️ CRYPTOBOT API токен не установлен - CryptoBot недоступен"
        print(warning_msg)
        return warning_msg
    
    try:
        import aiohttp
        headers = {"Crypto-Pay-API-Token": api_key}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://pay.crypt.bot/api/getMe",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("ok"):
                        app_name = data.get("result", {}).get("name", "Unknown")
                        success_msg = f"✅ CryptoBot подключен успешно: {app_name}"
                        print(success_msg)
                        return success_msg
                    else:
                        error_msg = f"❌ CryptoBot API ошибка: {data.get('error', {}).get('name', 'Unknown')}"
                        print(error_msg)
                        return error_msg
                else:
                    error_msg = f"❌ CryptoBot HTTP ошибка: {response.status}"
                    print(error_msg)
                    return error_msg
    except Exception as e:
        error_msg = f"❌ Ошибка тестирования CryptoBot: {e}"
        print(error_msg)
        return error_msg

# Изменяем запуск бота:
# streetshop.py (изменение)
async def on_startup(dp):
    """Действия при запуске бота"""
    status_lines = []
    
    # Получаем системную информацию
    system_info = await get_system_info()
    
    # Отправляем начальный статус
    initial_status = f"🚀 **Telegram Bot Starting...**\n📊 Python Version: `{system_info['python_version']}`\n📂 Working Directory: `{system_info['working_directory']}`\n\n📋 **Статус запуска:**"
    await send_status_update(initial_status, is_new=True)
    
    print("Бот запускается...")
    status_lines.append("🔄 Бот запускается...")
    await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Проверяем подключение к боту
    try:
        me = await bot.get_me()
        success_msg = f"✅ Подключение к боту успешно: @{me.username}"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"❌ Ошибка подключения к боту: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
        return
    
    # Подключаемся к базе данных
    try:
        await db.connect()
        success_msg = "✅ База данных подключена"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"❌ Ошибка подключения к БД: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
        return
    
    # Устанавливаем команды бота
    try:
        await set_bot_commands()
        success_msg = "✅ Команды бота установлены"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка установки команд: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Устанавливаем Menu Button
    try:
        await set_menu_button()
        success_msg = "✅ Menu Button установлена"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка установки Menu Button: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Запускаем проверку истекших платежей в отдельной задаче
    try:
        asyncio.create_task(db.check_expired_payments())
        success_msg = "✅ Задача проверки платежей запущена"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка запуска проверки платежей: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Запускаем проверку истечения заказов в отдельной задаче
    try:
        asyncio.create_task(check_order_expiration())
        success_msg = "✅ Задача проверки истечения заказов запущена"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка запуска проверки заказов: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Запускаем проверку платежей CryptoBot в отдельной задаче
    try:
        asyncio.create_task(check_cryptobot_payments())
        success_msg = "✅ Задача CryptoBot запущена"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка запуска CryptoBot: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Тестируем подключение к CryptoBot
    try:
        cryptobot_status = await test_cryptobot_connection()
        status_lines.append(cryptobot_status)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка тестирования CryptoBot: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    # Тестируем подключение к BitPAPA
    try:
        from bitpapa_handlers import test_bitpapa_connection
        bitpapa_status = await test_bitpapa_connection()
        status_lines.append(bitpapa_status)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка тестирования BitPAPA: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(initial_status + "\n" + "\n".join(status_lines))
    
    final_msg = "🚀 Бот успешно запущен!"
    print(final_msg)
    status_lines.append(final_msg)
    
    # Финальное обновление статуса
    await send_status_update(initial_status + "\n" + "\n".join(status_lines))

# Обработчик всех callback закомментирован, чтобы не перехватывать другие обработчики
# @dp.callback_query_handler()
# async def handle_all_callbacks(callback: types.CallbackQuery):
#     """Обработчик всех callback для логирования"""
#     print(f"Получен callback: {callback.data} от пользователя {callback.from_user.id}")
#     # Не обрабатываем, просто логируем
#     await callback.answer()

# Обработчик для всех медиа-сообщений (фото и документы) - ОБРАБАТЫВАЕТ КАЖДЫЙ ФАЙЛ!
@dp.message_handler(content_types=[types.ContentType.PHOTO, types.ContentType.DOCUMENT])
async def handle_media_files_fallback(message: types.Message):
    """
    Универсальный обработчик для всех медиа-файлов (ОБРАБАТЫВАЕТ КАЖДЫЙ ФАЙЛ!).
    Обрабатывает как одиночные файлы, так и медиа-группы.
    Срабатывает только если файл не был обработан специальными обработчиками.
    """
    user_id = message.from_user.id
    media_group_id = message.media_group_id
    
    # Определяем тип и данные файла
    if message.content_type == types.ContentType.PHOTO:
        file_id = message.photo[-1].file_id
        file_type = 'photo'
        file_name = 'photo.jpg'
    elif message.content_type == types.ContentType.DOCUMENT:
        file_id = message.document.file_id
        file_type = 'document'
        file_name = message.document.file_name or 'document'
    else:
        return
    
    file_info = {
        'file_id': file_id,
        'file_type': file_type,
        'file_name': file_name,
        'message_id': message.message_id
    }
    
    if media_group_id:
        # Это часть медиа-группы (множественные файлы в одном сообщении)
        if media_group_id not in media_group_files:
            media_group_files[media_group_id] = []
        
        media_group_files[media_group_id].append(file_info)
        
        # Отменяем предыдущий таймер если есть
        if media_group_id in media_group_timers:
            media_group_timers[media_group_id].cancel()
        
        # Создаем новый таймер для обработки медиа-группы через 1 секунду
        # (ожидаем, пока придут все файлы из группы)
        async def process_group():
            await asyncio.sleep(1)  # Ждем 1 секунду после последнего файла
            await process_media_group_files(media_group_id, user_id)
        
        media_group_timers[media_group_id] = asyncio.create_task(process_group())
        
    else:
        # Одиночный файл
        await bot.send_message(
            chat_id=user_id,
            text="✅ Прикреплен 1 файл!"
        )

async def on_shutdown(dp):
    """Действия при остановке бота"""
    shutdown_status = "🛑 **Остановка бота...**"
    await send_status_update(shutdown_status, is_new=True)
    
    status_lines = []
    
    print("🛑 Остановка бота...")
    
    try:
        # Отправляем уведомление об остановке всем админам
        try:
            admins = await db.get_all_admins()
            admin_ids = [admin[0] for admin in admins]
        except Exception:
            admin_ids = [cfg.ADMIN_ID] if cfg.ADMIN_ID else []
        
        for admin_id in admin_ids:
            try:
                await bot.send_message(admin_id, "!$T0P!")
            except Exception as e:
                print(f"⚠️ Ошибка отправки уведомления админу {admin_id}: {e}")
        
        success_msg = "✅ Уведомления об остановке отправлены всем админам"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка при отправке уведомлений: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))
    
    try:
        await db.close()
        success_msg = "✅ База данных закрыта"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка закрытия БД: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))
    
    try:
        await dp.storage.close()
        await dp.storage.wait_closed()
        success_msg = "✅ Storage закрыт"
        print(success_msg)
        status_lines.append(success_msg)
        await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))
    except Exception as e:
        error_msg = f"⚠️ Ошибка закрытия storage: {e}"
        print(error_msg)
        status_lines.append(error_msg)
        await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))
    
    final_msg = "👋 Бот остановлен"
    print(final_msg)
    status_lines.append(final_msg)
    
    # Финальное обновление статуса
    await send_status_update(shutdown_status + "\n" + "\n".join(status_lines))

def signal_handler(signum, frame):
    """Обработчик сигналов для корректной остановки"""
    signal_msg = f"\n⚠️ Получен сигнал {signum}. Останавливаю бот..."
    print(signal_msg)
    
    # Пытаемся отправить уведомление о сигнале в Telegram
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(send_status_update(f"⚠️ **Получен сигнал {signum}**\nОстанавливаю бот...", is_new=True))
    except Exception:
        pass  # Игнорируем ошибки при отправке статуса
    
    # Принудительное завершение через короткое время
    import threading
    def force_exit():
        import time
        time.sleep(2)  # Даем 2 секунды на корректное завершение
        import os
        os._exit(1)
    
    threading.Thread(target=force_exit, daemon=True).start()
    sys.exit(0)

async def safe_start_polling():
    """Безопасный запуск polling с обработкой ошибок"""
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        try:
            print(f"🔄 Попытка запуска #{retry_count + 1}")
            
            # Запускаем polling
            await dp.start_polling()
            
        except TerminatedByOtherGetUpdates:
            print("❌ Обнаружен конфликт с другим экземпляром бота")
            print("⏳ Ожидание 10 секунд перед повторной попыткой...")
            await asyncio.sleep(10)
            retry_count += 1
            
        except ConflictError as e:
            print(f"❌ Конфликт API: {e}")
            print("⏳ Ожидание 15 секунд перед повторной попыткой...")
            await asyncio.sleep(15)
            retry_count += 1
            
        except Exception as e:
            print(f"❌ Неожиданная ошибка: {e}")
            print("⏳ Ожидание 5 секунд перед повторной попыткой...")
            await asyncio.sleep(5)
            retry_count += 1
    
    print(f"❌ Превышено максимальное количество попыток ({max_retries})")
    print("🛑 Бот останавливается")

def main():
    """Главная функция запуска"""
    global logger
    
    # Устанавливаем обработчики сигналов
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Настраиваем базовое логирование в консоль
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Создаем логгер
    logger = logging.getLogger("BotLogger")
    
    # Добавляем Telegram handler после инициализации бота
    telegram_handler = TelegramLogHandler(bot)
    telegram_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(telegram_handler)
    
    # Системная информация в консоль (она также будет отправлена в on_startup)
    logger.info("🤖 Telegram Bot Starting...")
    logger.info(f"📊 Python Version: {sys.version}")
    logger.info(f"📂 Working Directory: {os.getcwd()}")
    
    max_retries = 5
    retry_delay = 10
    attempt = 0
    
    try:
        while attempt < max_retries:
            try:
                # Запускаем бота с улучшенной обработкой ошибок
                executor.start_polling(
                    dp,
                    skip_updates=True,
                    on_startup=on_startup,
                    on_shutdown=on_shutdown,
                    timeout=20,
                    relax=0.1,
                    fast=True
                )
                break  # Если успешно запустился, выходим из цикла
            except KeyboardInterrupt:
                logger.warning("👋 Получен сигнал остановки от пользователя")
                break
            except aiohttp.client_exceptions.ClientConnectorDNSError as e:
                attempt += 1
                logger.error(f"❌ Ошибка DNS-соединения (попытка {attempt}/{max_retries}): {e}")
                if attempt < max_retries:
                    logger.info(f"⏱️ Повторная попытка через {retry_delay} секунд...")
                    time.sleep(retry_delay)
                    # Увеличиваем время задержки для следующей попытки
                    retry_delay *= 1.5
                else:
                    logger.error("❌ Превышено максимальное количество попыток подключения")
            except NetworkError as e:
                attempt += 1
                logger.error(f"❌ Ошибка сети (попытка {attempt}/{max_retries}): {e}")
                if attempt < max_retries:
                    logger.info(f"⏱️ Повторная попытка через {retry_delay} секунд...")
                    time.sleep(retry_delay)
                    # Увеличиваем время задержки для следующей попытки
                    retry_delay *= 1.5
                else:
                    logger.error("❌ Превышено максимальное количество попыток подключения")
            except Exception as e:
                logger.error(f"❌ Критическая ошибка: {e}")
                import traceback
                traceback.print_exc()
                break
    finally:
        logger.info("🏁 Программа завершена")
        # Принудительное завершение процесса
        os._exit(0)

# Обработчики для новых кнопок

# Обработчики для бонусов
@dp.callback_query_handler(lambda c: c.data == "skip_bonus_sticker")
async def skip_bonus_sticker_handler(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить стикер для бонусов"""
    async with state.proxy() as data:
        data['bonus_sticker_id'] = None
    
    from keyboards import back_to_bonus_settings_kb
    await callback.message.edit_text(
        "✅ Стикер пропущен.\n\n"
        "🖼️ Отправьте фото для системы бонусов:",
        reply_markup=back_to_bonus_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "delete_bonus_sticker")
async def delete_bonus_sticker_handler(callback: types.CallbackQuery, state: FSMContext):
    """Удалить стикер для бонусов"""
    async with state.proxy() as data:
        data['bonus_sticker_id'] = None
    
    from keyboards import back_to_bonus_settings_kb
    await callback.message.edit_text(
        "🗑️ Стикер удален.\n\n"
        "🖼️ Отправьте фото для системы бонусов:",
        reply_markup=back_to_bonus_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_bonus_photo")
async def skip_bonus_photo_handler(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить фото для бонусов"""
    async with state.proxy() as data:
        data['bonus_photo_id'] = None
    
    from keyboards import back_to_bonus_settings_kb
    await callback.message.edit_text(
        "✅ Фото пропущено.\n\n"
        "📋 Теперь введите описание для системы бонусов:",
        reply_markup=back_to_bonus_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "delete_bonus_photo")
async def delete_bonus_photo_handler(callback: types.CallbackQuery, state: FSMContext):
    """Удалить фото для бонусов"""
    async with state.proxy() as data:
        data['bonus_photo_id'] = None
    
    from keyboards import back_to_bonus_settings_kb
    await callback.message.edit_text(
        "🗑️ Фото удалено.\n\n"
        "📋 Теперь введите описание для системы бонусов:",
        reply_markup=back_to_bonus_settings_kb()
    )
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "cancel_bonus_edit")
async def cancel_bonus_edit_handler(callback: types.CallbackQuery, state: FSMContext):
    """Отменить редактирование бонусов"""
    await state.finish()
    await callback.message.edit_text("❌ Редактирование бонусов отменено.")
    await callback.answer()

# Обработчики для файлов по дням
@dp.callback_query_handler(lambda c: c.data.startswith("files_done_day_"))
async def files_done_day_handler(callback: types.CallbackQuery, state: FSMContext):
    """Завершить загрузку файлов для текущего дня"""
    # Извлекаем номер дня из callback_data
    day_number = callback.data.split("_")[-1]
    
    async with state.proxy() as data:
        days_list = data.get('days_list', [])
        current_day_index = data.get('current_day_index', 0)
        
        # Переходим к следующему дню
        next_day_index = current_day_index + 1
        
        if next_day_index < len(days_list):
            # Есть еще дни для загрузки файлов
            data['current_day_index'] = next_day_index
            next_day = days_list[next_day_index]
            
            # Показываем статистику текущего дня
            current_files_count = len(data['files_by_days'].get(str(day_number), []))
            
            from keyboards import create_skip_cancel_kb
            keyboard = create_skip_cancel_kb(f"skip_files_day_{next_day}", "cancel_product_creation")
            
            await callback.message.edit_text(
                f"✅ Файлы для {day_number} дней завершены! Добавлено файлов: {current_files_count}\n\n"
                f"📁 Желаете добавить еще файлы товара к {next_day} дням?"
                f"Отправьте файлы для {next_day} дней:",
                reply_markup=keyboard
            )
        else:
            # Все дни обработаны, создаем товар
            await create_catalog_item_with_days(callback.message, state)
    
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data.startswith("skip_files_day_"))
async def skip_files_day_handler(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить загрузку файлов для текущего дня"""
    # Извлекаем номер дня из callback_data
    day_number = callback.data.split("_")[-1]
    
    async with state.proxy() as data:
        days_list = data.get('days_list', [])
        current_day_index = data.get('current_day_index', 0)
        
        # Переходим к следующему дню
        next_day_index = current_day_index + 1
        
        if next_day_index < len(days_list):
            data['current_day_index'] = next_day_index
            next_day = days_list[next_day_index]
            
            from keyboards import create_skip_cancel_kb
            keyboard = create_skip_cancel_kb(f"skip_files_day_{next_day}", "cancel_product_creation")
            
            await callback.message.edit_text(
                f"⏭️ Файлы для {day_number} дней пропущены.\n\n"
                f"📁 Желаете добавить еще файлы товара к {next_day} дням?"
                f"Отправьте файлы для {next_day} дней:",
                reply_markup=keyboard
            )
        else:
            # Все дни обработаны, создаем товар
            await create_catalog_item_with_days(callback.message, state)
    
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "files_done")
async def files_done_handler(callback: types.CallbackQuery, state: FSMContext):
    """Завершить загрузку файлов"""
    await create_catalog_item(callback.message, state)
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "skip_task_photo")
async def skip_task_photo_handler(callback: types.CallbackQuery, state: FSMContext):
    """Пропустить фото для задания"""
    async with state.proxy() as data:
        data['task_photo_id'] = None
    
    await callback.message.edit_text(
        "✅ Фото пропущено.\n\n📋 Теперь введите название кнопки (например: 'Подписаться на канал'):"
    )
    await BonusSystemStates.waiting_for_task_name.set()
    await callback.answer()

@dp.callback_query_handler(lambda c: c.data == "cancel_bonus_task")
async def cancel_bonus_task_handler(callback: types.CallbackQuery, state: FSMContext):
    """Отменить создание задания бонусов"""
    await state.finish()
    await callback.message.edit_text("❌ Создание задания бонусов отменено.")
    await callback.answer()

# === ОБРАБОТЧИКИ ДЛЯ УПРАВЛЕНИЯ ТОКЕНАМИ ===

@dp.message_handler(commands=['tokens'], state='*')
async def tokens_command_handler(message: types.Message):
    """Команда для управления API токенами"""
    if not await is_user_admin(message.from_user.id):
        await message.answer("🚫 Эта команда доступна только администраторам.")
        return

    try:
        # Получаем все токены из базы
        tokens = await db.get_all_api_tokens()
        
        text = "🔑 **Управление API токенами**\n\n"
        
        if not tokens:
            # Показываем токены из конфига
            text += "📝 **Текущие токены (из конфига):**\n"
            text += f"• **BitPAPA**: `{cfg.BITPAPA_API_TOKEN[:20]}...`\n"
            text += f"• **Stars**: `{cfg.STARS_PROVIDER_TOKEN[:20]}...`\n"
        else:
            # Показываем сохраненные токены
            text += "📝 **Сохраненные токены:**\n"
            for token in tokens:
                token_name, token_value, created_at, updated_at = token
                display_value = f"{token_value[:20]}..." if len(token_value) > 20 else token_value
                text += f"• **{token_name}**: `{display_value}`\n"
        
        text += "\n⚙️ **Для изменения:**\n`/set_token <тип> <новый_токен>`\n\n"
        text += "📌 **Примеры:**\n"
        text += "`/set_token bitpapa erPUy2qPkmc19ty_aSh_`\n"
        text += "`/set_token stars 436153:AAgkq3EFS8QUHs9S8L8J40Nn1pGxCyVHHzz`"
        
        await message.answer(text, parse_mode="Markdown")
        
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")

@dp.message_handler(commands=['set_token'], state='*')
async def set_token_command_handler(message: types.Message):
    """Команда для установки API токена"""
    if not await is_user_admin(message.from_user.id):
        await message.answer("🚫 Эта команда доступна только администраторам.")
        return

    args = message.get_args().split()
    if len(args) != 2:
        await message.answer(
            "ℹ️ **Неверный формат.**\n"
            "`/set_token <тип> <новый_токен>`\n\n"
            "📌 **Примеры:**\n"
            "`/set_token bitpapa erPUy2qPkmc19ty_aSh_`\n"
            "`/set_token stars 436153:AAgkq3EFS8QUHs9S8L8J40Nn1pGxCyVHHzz`",
            parse_mode="Markdown"
        )
        return

    token_type, new_token = args
    token_type = token_type.lower()
    
    supported_tokens = ['bitpapa', 'stars', 'cryptobot']
    
    if token_type not in supported_tokens:
        await message.answer(
            f"❌ **Неподдерживаемый тип:** `{token_type}`\n\n"
            f"✅ **Поддерживаемые:** {', '.join(supported_tokens)}",
            parse_mode="Markdown"
        )
        return
    
    try:
        await db.set_api_token(token_type, new_token)
        
        # Обновляем токен в BitPAPA API
        if token_type == 'bitpapa':
            bitpapa_api.api_token = new_token
        
        display_token = f"{new_token[:10]}...{new_token[-10:]}" if len(new_token) > 20 else new_token
        
        await message.answer(
            f"✅ **Токен {token_type} обновлен!**\n\n"
            f"📝 **Новое значение:** `{display_token}`",
            parse_mode="Markdown"
        )
        
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")

if __name__ == '__main__':
    main()
