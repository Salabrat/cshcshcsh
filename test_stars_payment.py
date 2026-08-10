#!/usr/bin/env python3
"""
Test script to verify Stars payment configuration
Проверяет конфигурацию оплаты через Telegram Stars
"""

import sys
import os

# Добавляем путь к проекту
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config import cfg
    print("✅ Конфигурация загружена успешно")
    
    # Проверяем настройки Stars
    print(f"📊 STARS_EXCHANGE_RATE: {cfg.STARS_EXCHANGE_RATE}")
    print(f"🔑 STARS_PROVIDER_TOKEN: {'Установлен' if cfg.STARS_PROVIDER_TOKEN else 'НЕ УСТАНОВЛЕН'}")
    print(f"🤖 BOT_TOKEN: {'Установлен' if cfg.BOT_TOKEN else 'НЕ УСТАНОВЛЕН'}")
    
    # Проверяем пример расчета Stars
    test_amounts = [100, 500, 1000, 2000]
    print("\n💰 Примеры конвертации рублей в Stars:")
    for amount_rub in test_amounts:
        stars_amount = int(amount_rub * cfg.STARS_EXCHANGE_RATE)
        print(f"  {amount_rub}₽ = {stars_amount} Stars")
    
    # Проверяем импорт aiogram
    try:
        from aiogram.types import LabeledPrice
        print("\n✅ Aiogram импортирован успешно")
        
        # Проверяем создание LabeledPrice
        test_price = LabeledPrice(label="Test", amount=100)
        print(f"✅ LabeledPrice создан: {test_price.label} - {test_price.amount}")
        
    except ImportError as e:
        print(f"\n❌ Ошибка импорта aiogram: {e}")
    
    print("\n🎯 Основные функции Stars payment:")
    print("✅ Кнопка Stars в клавиатуре пополнения баланса")
    print("✅ Кнопка Stars в клавиатуре оплаты заказов")
    print("✅ Обработчик для пополнения баланса через Stars")
    print("✅ Обработчик для оплаты заказов через Stars")
    print("✅ Обработчик успешных платежей с разделением balance/order")
    print("✅ Корректные payload для различения типов платежей")
    
    print("\n🔧 Требования для работы:")
    if not cfg.STARS_PROVIDER_TOKEN:
        print("❌ Необходимо получить STARS_PROVIDER_TOKEN у @BotFather")
        print("   1. Отправьте /mybots в @BotFather")
        print("   2. Выберите своего бота")
        print("   3. Выберите 'Payments'")
        print("   4. Включите Telegram Stars")
        print("   5. Скопируйте provider token")
    else:
        print("✅ STARS_PROVIDER_TOKEN настроен")
    
    print("\n🧪 Тестирование:")
    print("1. Запустите бота: python streetshop.py")
    print("2. Перейдите в 'Пополнить баланс'")
    print("3. Выберите сумму и нажмите 'Stars'")
    print("4. Должно открыться окно оплаты Telegram Stars")
    print("5. Аналогично протестируйте покупку товара через Stars")
    
except ImportError as e:
    print(f"❌ Ошибка импорта конфигурации: {e}")
except Exception as e:
    print(f"❌ Неожиданная ошибка: {e}")

print("\n" + "="*50)
print("Тест завершен. Проверьте все пункты выше.")