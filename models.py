# models.py
    #бота создал @pravitelstvo_russian
import asyncio
from aiogram import Bot
from config import cfg
# Глобальные объекты
db_lock = asyncio.Lock()
bot = None  # Будет инициализирован позже

def init_bot(bot_instance):
    global bot
    bot = bot_instance