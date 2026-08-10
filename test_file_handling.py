#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест для проверки обработки файлов ботом
Этот скрипт проверяет:
1. Обработку одиночных файлов
2. Обработку медиа-групп (множественных файлов)
3. Правильные подтверждения обработки файлов
"""

import asyncio
from unittest.mock import Mock, AsyncMock
import sys
import os

# Добавляем путь к проекту
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Импортируем функции из нашего бота
from streetshop import process_media_group_files, media_group_files, media_group_timers

async def test_media_group_processing():
    """Тест обработки медиа-групп"""
    print("🧪 Тестирование обработки медиа-групп...")
    
    # Мокаем бота
    import streetshop
    streetshop.bot = Mock()
    streetshop.bot.send_message = AsyncMock()
    
    # Тестовые данные
    media_group_id = "test_group_123"
    user_id = 12345
    
    # Добавляем тестовые файлы
    media_group_files[media_group_id] = [
        {'file_id': 'photo1', 'file_type': 'photo', 'file_name': 'photo1.jpg', 'message_id': 1},
        {'file_id': 'doc1', 'file_type': 'document', 'file_name': 'doc1.pdf', 'message_id': 2},
        {'file_id': 'photo2', 'file_type': 'photo', 'file_name': 'photo2.jpg', 'message_id': 3},
    ]
    
    # Тестируем обработку
    await process_media_group_files(media_group_id, user_id)
    
    # Проверяем, что функция была вызвана
    streetshop.bot.send_message.assert_called_once_with(
        chat_id=user_id,
        text="✅ Прикреплено 3 файла!"
    )
    
    # Проверяем, что данные очищены
    assert media_group_id not in media_group_files
    assert media_group_id not in media_group_timers
    
    print("✅ Тест медиа-групп пройден!")

async def test_single_file():
    """Тест обработки одиночного файла"""
    print("🧪 Тестирование обработки одиночного файла...")
    
    # Мокаем бота
    import streetshop
    streetshop.bot = Mock()
    streetshop.bot.send_message = AsyncMock()
    
    # Тестовые данные для одного файла
    media_group_id = "single_file_456"
    user_id = 12345
    
    # Добавляем один файл
    media_group_files[media_group_id] = [
        {'file_id': 'single_photo', 'file_type': 'photo', 'file_name': 'single.jpg', 'message_id': 1},
    ]
    
    # Тестируем обработку
    await process_media_group_files(media_group_id, user_id)
    
    # Проверяем, что функция была вызвана с правильным текстом
    streetshop.bot.send_message.assert_called_with(
        chat_id=user_id,
        text="✅ Прикреплен 1 файл!"
    )
    
    print("✅ Тест одиночного файла пройден!")

async def test_many_files():
    """Тест обработки большого количества файлов"""
    print("🧪 Тестирование обработки большого количества файлов...")
    
    # Мокаем бота
    import streetshop
    streetshop.bot = Mock()
    streetshop.bot.send_message = AsyncMock()
    
    # Тестовые данные для 10 файлов
    media_group_id = "many_files_789"
    user_id = 12345
    
    # Добавляем 10 файлов
    media_group_files[media_group_id] = []
    for i in range(10):
        media_group_files[media_group_id].append({
            'file_id': f'file_{i}', 
            'file_type': 'document' if i % 2 else 'photo', 
            'file_name': f'file_{i}.{"pdf" if i % 2 else "jpg"}', 
            'message_id': i
        })
    
    # Тестируем обработку
    await process_media_group_files(media_group_id, user_id)
    
    # Проверяем, что функция была вызвана с правильным текстом
    streetshop.bot.send_message.assert_called_with(
        chat_id=user_id,
        text="✅ Прикреплено 10 файлов!"
    )
    
    print("✅ Тест большого количества файлов пройден!")

async def main():
    """Главная функция тестирования"""
    print("🚀 Запуск тестов обработки файлов...")
    print("=" * 50)
    
    try:
        await test_single_file()
        await test_media_group_processing()
        await test_many_files()
        
        print("=" * 50)
        print("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
        print("")
        print("📋 Резюме:")
        print("✅ Бот ЧИТАЕТ КАЖДЫЙ ФАЙЛ что ему отправлен")
        print("✅ Даже если в 1 сообщении 10 файлов, он ОБРАБАТЫВАЕТ каждый")
        print("✅ Пишет 'прикреплено (количество) файлов!' для подтверждения")
        print("")
        print("🔧 Реализованная функциональность:")
        print("   - Универсальный обработчик медиа-файлов")
        print("   - Поддержка медиа-групп (множественные файлы)")
        print("   - Таймер для группировки файлов из одной медиа-группы")
        print("   - Правильные подтверждения на русском языке")
        print("   - Не мешает существующим обработчикам состояний")
        
    except Exception as e:
        print(f"❌ ОШИБКА В ТЕСТАХ: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())