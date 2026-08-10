# bitpapa_handlers.py
"""
Обработчики для интеграции с BitPAPA
"""

from aiogram import types
from aiogram.dispatcher import FSMContext
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from database import db
from config import cfg
from bitpapa_api import bitpapa_api
import asyncio
from datetime import datetime, timedelta

class BitPapaPaymentStates:
    """Состояния для обработки платежей BitPAPA"""
    waiting_for_payment = "bitpapa_waiting_payment"

async def create_bitpapa_payment(user_id: int, amount: float, order_code: str):
    """
    Создает платеж через BitPAPA API
    
    Args:
        user_id: ID пользователя
        amount: Сумма платежа
        order_code: Код заказа
        
    Returns:
        dict: Данные платежа или None при ошибке
    """
    try:
        # Получаем токен из базы данных
        saved_token = await db.get_api_token('bitpapa')
        if saved_token:
            bitpapa_api.api_token = saved_token
        
        # Создаем платеж
        payment_data = await bitpapa_api.create_payment(
            amount=amount,
            currency='RUB',
            order_id=order_code
        )
        
        if payment_data:
            # Сохраняем информацию о платеже в базу данных
            await db.save_bitpapa_payment(
                user_id=user_id,
                order_code=order_code,
                payment_id=payment_data.get('payment_id'),
                amount=amount,
                payment_url=payment_data.get('payment_url')
            )
            
        return payment_data
        
    except Exception as e:
        print(f"Ошибка создания BitPAPA платежа: {e}")
        return None

async def send_bitpapa_payment_message(chat_id: int, payment_data: dict, order_code: str, amount: float):
    """
    Отправляет сообщение с кнопкой оплаты через BitPAPA
    
    Args:
        chat_id: ID чата
        payment_data: Данные платежа от BitPAPA
        order_code: Код заказа
        amount: Сумма платежа
    """
    try:
        from models import bot
        
        # Получаем информацию о товаре из базы данных
        order = await db.get_order(order_code)
        product_name = "Неизвестный товар"
        category_info = "Неизвестная категория"
        
        if order:
            # Получаем информацию о товаре
            product = await db.get_catalog_item(order[2])  # product_id
            if product:
                product_name = product[3] if len(product) > 3 else "Неизвестный товар"
            
            # Получаем информацию о категории
            category_info = await db.get_product_category_with_type(order[2]) if len(order) > 2 else "Неизвестная категория"
        
        # Создаем клавиатуру с кнопкой оплаты
        keyboard = InlineKeyboardMarkup(row_width=1)
        
        if payment_data and payment_data.get('payment_url'):
            keyboard.add(
                InlineKeyboardButton(
                    "💳 Оплатить через BitPAPA",
                    url=payment_data['payment_url']
                )
            )
        
        keyboard.add(
            InlineKeyboardButton(
                "🔄 Проверить оплату",
                callback_data=f"check_bitpapa_payment_{order_code}"
            ),
            InlineKeyboardButton(
                "❌ Отменить заказ",
                callback_data=f"cancel_payment_{order_code}"
            )
        )
        
        # Время истечения (20 минут)
        expire_time = (datetime.now() + timedelta(minutes=20)).strftime("%H:%M")
        
        # Формируем текст сообщения в формате, аналогичном CryptoBot
        text = f"""💳 <b>Оплата заказа CryptoBot(BitPAPA)</b>: <code>{order_code}</code>

📦 <b>Товар</b>: {product_name}
📖| Получаем дорвейный трафик из поиска tg

💰 <b>Сумма к оплате</b>: {amount}₽

🤖 Для оплаты нажмите кнопку ниже и перейдите в @CryptoBot.
(Bitpapa)

В боте вы сможете выбрать любую криптовалюту для оплаты.

После оплаты вернитесь сюда и нажмите "Проверить оплату"."""
        
        message = await bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_markup=keyboard,
            parse_mode="HTML"
        )
        
        return message
        
    except Exception as e:
        print(f"Ошибка отправки сообщения BitPAPA: {e}")
        return None

async def check_bitpapa_payment_status(payment_id: str, order_code: str):
    """
    Проверяет статус платежа BitPAPA
    
    Args:
        payment_id: ID платежа в BitPAPA
        order_code: Код заказа
        
    Returns:
        dict: Статус платежа или None при ошибке
    """
    try:
        # Получаем токен из базы данных
        saved_token = await db.get_api_token('bitpapa')
        if saved_token:
            bitpapa_api.api_token = saved_token
        
        # Проверяем статус
        status_data = await bitpapa_api.check_payment_status(payment_id)
        
        if status_data:
            # Обновляем статус в базе данных
            await db.update_bitpapa_payment_status(
                order_code=order_code,
                status=status_data.get('status'),
                updated_at=datetime.now()
            )
            
        return status_data
        
    except Exception as e:
        print(f"Ошибка проверки статуса BitPAPA: {e}")
        return None

async def test_bitpapa_connection():
    """Тестирует подключение к BitPAPA API"""
    try:
        # Получаем токен из базы данных
        saved_token = await db.get_api_token('bitpapa')
        if saved_token:
            bitpapa_api.api_token = saved_token
        
        if not bitpapa_api.api_token:
            warning_msg = "⚠️ BITPAPA API токен не установлен - BitPAPA недоступен"
            print(warning_msg)
            return warning_msg
        
        # Тестируем подключение через получение баланса или создание тестового платежа
        balance_data = await bitpapa_api.get_balance()
        
        if balance_data:
            # Если удалось получить баланс, значит API работает
            app_name = balance_data.get('merchant_name', 'BitPAPA Merchant')
            success_msg = f"✅ BitPAPA подключен успешно: {app_name}"
            print(success_msg)
            return success_msg
        else:
            # Если не удалось получить баланс, пробуем создать тестовый платеж
            test_payment = await bitpapa_api.create_payment(
                amount=1,
                currency='RUB',
                order_id='test_connection'
            )
            
            if test_payment:
                success_msg = "✅ BitPAPA подключен успешно: API доступен"
                print(success_msg)
                return success_msg
            else:
                error_msg = "❌ BitPAPA API недоступен или неверный токен"
                print(error_msg)
                return error_msg
                
    except Exception as e:
        error_msg = f"❌ Ошибка тестирования BitPAPA: {e}"
        print(error_msg)
        return error_msg

async def handle_bitpapa_callback(callback_data: dict):
    """
    Обрабатывает webhook от BitPAPA о статусе платежа
    
    Args:
        callback_data: Данные от BitPAPA webhook
    """
    try:
        payment_id = callback_data.get('payment_id')
        status = callback_data.get('status')
        order_id = callback_data.get('order_id')
        
        if not all([payment_id, status, order_id]):
            print("BitPAPA webhook: Недостаточно данных")
            return False
        
        # Получаем информацию о платеже из базы данных
        payment_info = await db.get_bitpapa_payment_by_order(order_id)
        
        if not payment_info:
            print(f"BitPAPA webhook: Платеж не найден - {order_id}")
            return False
        
        user_id = payment_info['user_id']
        amount = payment_info['amount']
        
        # Обновляем статус в базе данных
        await db.update_bitpapa_payment_status(order_id, status, datetime.now())
        
        if status == 'completed' or status == 'paid':
            # Платеж успешно завершен
            await db.update_user_balance(user_id, int(amount))
            await db.update_payment_status(order_id, 'completed')
            
            # Отправляем уведомление пользователю
            from models import bot
            try:
                await bot.send_message(
                    chat_id=user_id,
                    text=f"✅ <b>Пополнение успешно завершено!</b>\n\n"
                         f"💰 Сумма: {amount}₽\n"
                         f"🧾 Код: <code>{order_id}</code>\n\n"
                         f"Баланс пополнен через BitPAPA.",
                    parse_mode="HTML"
                )
            except Exception as e:
                print(f"Ошибка отправки уведомления пользователю {user_id}: {e}")
                
        elif status == 'failed' or status == 'cancelled':
            # Платеж отменен или провалился
            await db.update_payment_status(order_id, 'cancelled')
            
            # Отправляем уведомление пользователю
            from models import bot
            try:
                await bot.send_message(
                    chat_id=user_id,
                    text=f"❌ <b>Платеж отменен</b>\n\n"
                         f"💰 Сумма: {amount}₽\n"
                         f"🧾 Код: <code>{order_id}</code>\n\n"
                         f"Попробуйте создать новый платеж.",
                    parse_mode="HTML"
                )
            except Exception as e:
                print(f"Ошибка отправки уведомления пользователю {user_id}: {e}")
        
        return True
        
    except Exception as e:
        print(f"Ошибка обработки BitPAPA webhook: {e}")
        return False

# Функция для добавления в keyboards.py
def create_bitpapa_payment_keyboard(payment_url: str, order_code: str):
    """
    Создает клавиатуру для оплаты через BitPAPA
    
    Args:
        payment_url: URL для оплаты
        order_code: Код заказа
        
    Returns:
        InlineKeyboardMarkup: Клавиатура с кнопками
    """
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    if payment_url:
        keyboard.add(
            InlineKeyboardButton(
                "💳 Оплатить через BitPAPA",
                url=payment_url
            )
        )
    
    keyboard.add(
        InlineKeyboardButton(
            "🔄 Проверить оплату",
            callback_data=f"check_bitpapa_payment_{order_code}"
        ),
        InlineKeyboardButton(
            "❌ Отменить заказ", 
            callback_data=f"cancel_payment_{order_code}"
        )
    )
    
    return keyboard