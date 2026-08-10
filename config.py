# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BOT_TOKEN = "8168641376:AAFa7W6-jJLIJ5LyOcRyOAHfwCVlATdpjJI"  # Принудительно используем рабочий токен
    BOT_USERNAME = "streetsoftkatalogbot"  # Username бота для генерации ссылок
    STARS_EXCHANGE_RATE = 100  # 1 рубль = 100 stars (пример)
    TELEGRAM_FEE = 0.05  # 5% комиссия Telegram
    CRYPTOBOT_NAME = "BotPay"  # Имя вашего бота в CryptoBot
    CRYPTOBOT_CURRENCIES = {
        "USDT": "USDT",
        "TON": "TON",
        "BTC": "BTC"
    }
    CRYPTOBOT_NAME = "Fickle Jay App"  # Имя вашего бота в CryptoBot
    
    # CryptoBot settings for redirect
    CRYPTOBOT_API_KEY = "439473:AAYkGZLfyXaybY38FTwYnqVPypFAzvgpR7g"  # API ключ CryptoBot
    CRYPTOBOT_SHOP_NAME = "SHOP"  # Название магазина для отображения
    CRYPTOBOT_PAYMENT_TIMEOUT = 1200  # Время на оплату в секундах (20 минут)

    STARS_EXCHANGE_RATE = 1  # 1 рубль = 100 Stars
    STARS_PROVIDER_TOKEN = "436153:AAgkq3EFS8QUHs9S8L8J40Nn1pGxCyVHHzz"  # Получить у @BotFather

    # BitPAPA API Configuration
    BITPAPA_API_TOKEN = "1wGD6uPJ-xwNPCBUmHDx"  # BitPAPA API токен
    BITPAPA_API_URL = "https://bitpapa.com/api/v1/"  # Base URL для BitPAPA API

    IMAGE_PATH = "image/katalog.png"

    ADMIN_USERNAME = "pravitelstvo_russian"  # Или используйте cfg.SUPPORT_ID если оно уже есть

    ADMIN_TICKETS_STICKER = "CAACAgEAAxkBAAEPBCtog09mYuT5VLmCBpwd0z5dZW2l1QACagMAAmp3MUTdCT7FTzmnwDYE"
    ADMIN_TICKETS_TEXT = "🛎 Список обращений для ответа"

    # В config.py добавим срок оплаты:
    PAYMENT_EXPIRED_TEXT = """⚠️ У заказа {code} истек срок оплаты

    Если у вас возникла одна из проблем:
    🔹 Не зачислилась оплата
    🔹 Не выдались реквизиты
    🔹 Не вышло сделать перевод

    Обратитесь к поддержке платежной системы
    💬 Прямой контакт: @payment_systems
    🤖 Если у вас СПАМ: @SuppPayBot

    ❤️ Приносим свои извинения, если вы столкнулись с проблемами при оплате. С радостью поможем решить их вам!"""

    PAYMENT_EXPIRED_TEXT = """⚠️ У заказа <code>{code}</code> истек срок оплаты

    Если у вас возникла одна из проблем:
    🔹 Не зачислилась оплата
    🔹 Не выдались реквизиты
    🔹 Не вышло сделать перевод

    Обратитесь к поддержке платежной системы
    💬 Прямой контакт: @payment_systems
    🤖 Если у вас СПАМ: @SuppPayBot

    ❤️ Приносим свои извинения, если вы столкнулись с проблемами при оплате. С радостью поможем решить их вам!"""

    # В config.py добавим оплату:
    PAYMENT_STICKER = "CAACAgEAAxkBAAEO7SxodMdmuDswmlhmRigQFvYeCcXZggACRwIAAvR1IESZ69gYUsdrkzYE"
    PAYMENT_TEXT = """💳 Пополнение баланса

Напишите в ответ сумму на которую хотите пополнить баланс или выберете из предложенных (минимум 50₽)"""

    PAYMENT_INFO_TEXT = """💳 <b>Пополнение баланса</b>: <code>{code}</code>

    <b>Сумма к оплате</b>: {amount}₽
    <blockquote>ℹ️ Сумма пополнения указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены и качественный сервис.</blockquote>

    ⏳ <b>Время на оплату</b>: 20 минут
    🕒 <b>Оплатить до</b>: {expire_time} (МСК)"""  # Теперь здесь будет подставляться конкретное время

    PAYMENT_CONFIRM_TEXT = """💳 <b>Пополнение баланса</b>: <code>{code}</code>

    <b>Сумма к оплате</b>: {amount}₽
    <blockquote>ℹ️ Сумма пополнения указана без учёта комиссии платёжной системы, которая добавляется при оплате. Мы делим эту комиссию с вами, чтобы сохранять для вас низкие цены и качественный сервис.</blockquote>

    ⏳ <b>Время на оплату</b>: 20 минут
    🕒 <b>Оплатить до</b>: {expire_time} (МСК)"""

    CANCEL_CONFIRM_TEXT = "⚠️ Вы уверены что хотите отменить заказ <code>{code}</code>?"
    PAYMENT_CANCELED_TEXT = "✅ Заказ <code>{code}</code> отменен"


    PASSPORT_STICKER = "CAACAgEAAxkBAAEPBClog08zYy7A336UKDZEAlsi7CzUhgACugIAAiz4MEQksGc-EyV1qTYE"
    WITHDRAW_STICKER = "CAACAgEAAxkBAAEO3IVoaSZ5jUG-N9jPrfNDLCLNWX35CAACzgIAAgZEGETPmJF48lyuaDYE"
    CONTACT_STICKER = "CAACAgEAAxkBAAEPBDJog1WLJh_w7erv2cSQFYGoRGg99wACvQIAAhAkWURYtO2ITIqP2jYE"
    MY_TICKETS_STICKER = "CAACAgEAAxkBAAEPBGxog4wAAbPqIVBAvRnV4G5E65jvENQAAnoDAAJaUzBELgABev0TvgKcNgQ"

    ADMIN_ID = 7573226427  # ID администратора для получения обращений
    SUPPORT_ID = "pravitelstvo_russian"  # ID администратора для получения обращений

    # Тексты сообщений остаются без изменений
    TICKET_SENT_TEXT = (
        "✅ Обращение отправлено\n\n"
        "Вам придет уведомление как только служба поддержки ответит на Ваше обращение."
    )
    REPLY_RECEIVED_TEXT = (
        "✅ Есть ответ на обращение\n\n"
        "Тема: {topic}\n"
        "Имя оператора: {operator_name}\n"
        "Ответ: {reply_text}"
    )
    ASK_OPERATOR_NAME = "Пожалуйста, представьтесь перед отправкой ответа:"

    # Texts
    CONTACT_TEXT = "📞 Связаться с поддержкой\n\nВыберите действие:"
    WELCOME_TEXT = "👋 Добро пожаловать в StreetSoft Katalog!"
    PROFILE_TEXT = """🪪 Мой профиль

ID: {user_id}
Регистрация: {registration_date}

Основной баланс: {balance}₽
Партнерский баланс: {partner_balance}₽

Статистика
Всего покупок: {purchases}"""

cfg = Config()