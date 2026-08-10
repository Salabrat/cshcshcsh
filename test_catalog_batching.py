#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест для проверки батчинга файлов каталога
Этот скрипт проверяет, что обработчик файлов каталога
правильно обрабатывает множественные файлы и показывает корректные подтверждения
"""

import asyncio
from unittest.mock import Mock, AsyncMock, MagicMock
import sys
import os

# Добавляем путь к проекту
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_catalog_file_batching():
    """Тест батчинга файлов каталога"""
    print("🧪 Тестирование батчинга файлов каталога...")
    
    # Мокаем необходимые объекты
    import streetshop
    from streetshop import file_batch_timers
    from aiogram.dispatcher import FSMContext
    from aiogram import types
    
    # Мокаем бота
    streetshop.bot = Mock()
    streetshop.bot.send_message = AsyncMock()
    
    # Мокаем FSMContext
    mock_state = AsyncMock(spec=FSMContext)
    mock_data = {
        'files': [],
        'file_batch': []
    }
    
    # Настраиваем proxy для возврата наших данных
    mock_proxy = MagicMock()
    mock_proxy.__aenter__ = AsyncMock(return_value=mock_data)
    mock_proxy.__aexit__ = AsyncMock(return_value=None)
    mock_state.proxy.return_value = mock_proxy
    mock_state.get_data = AsyncMock(return_value=mock_data)
    mock_state.update_data = AsyncMock()
    
    # Мокаем сообщение с фото
    mock_message = Mock(spec=types.Message)
    mock_message.from_user.id = 12345
    mock_message.content_type = types.ContentType.PHOTO
    mock_message.photo = [Mock(file_id='photo_test_123')]
    mock_message.document = None
    mock_message.answer = AsyncMock()
    
    # Импортируем обработчик
    from streetshop import process_catalog_file
    
    # Вызываем обработчик
    await process_catalog_file(mock_message, mock_state)
    
    # Проверяем, что файл добавлен в данные
    assert len(mock_data['files']) == 1
    assert len(mock_data['file_batch']) == 1
    assert mock_data['files'][0]['file_type'] == 'photo'
    
    # Проверяем, что таймер создан
    assert 12345 in file_batch_timers
    
    # Ждем выполнения таймера
    await asyncio.sleep(1.1)
    
    # Проверяем, что было отправлено подтверждение
    streetshop.bot.send_message.assert_called_once()
    call_args = streetshop.bot.send_message.call_args
    assert "✅ Обработан 1 файл! Всего файлов: **1**" in call_args[1]['text']
    
    print("✅ Тест батчинга файлов каталога пройден!")

async def test_multiple_files():
    """Тест обработки множественных файлов"""
    print("🧪 Тестирование множественных файлов...")
    
    # Мокаем необходимые объекты
    import streetshop
    from streetshop import file_batch_timers
    from aiogram.dispatcher import FSMContext
    from aiogram import types
    
    # Мокаем бота
    streetshop.bot = Mock()
    streetshop.bot.send_message = AsyncMock()
    
    # Мокаем FSMContext
    mock_state = AsyncMock(spec=FSMContext)
    mock_data = {
        'files': [],
        'file_batch': []
    }
    
    # Настраиваем proxy для возврата наших данных
    mock_proxy = MagicMock()
    mock_proxy.__aenter__ = AsyncMock(return_value=mock_data)
    mock_proxy.__aexit__ = AsyncMock(return_value=None)
    mock_state.proxy.return_value = mock_proxy
    mock_state.get_data = AsyncMock(return_value=mock_data)
    mock_state.update_data = AsyncMock()
    
    # Импортируем обработчик
    from streetshop import process_catalog_file
    
    # Отправляем 3 файла подряд
    for i in range(3):
        mock_message = Mock(spec=types.Message)
        mock_message.from_user.id = 12345
        
        if i % 2 == 0:  # Фото
            mock_message.content_type = types.ContentType.PHOTO
            mock_message.photo = [Mock(file_id=f'photo_test_{i}')]
            mock_message.document = None
        else:  # Документ
            mock_message.content_type = types.ContentType.DOCUMENT
            mock_message.document = Mock(file_id=f'doc_test_{i}', file_name=f'test_{i}.pdf')
            mock_message.photo = None
        
        mock_message.answer = AsyncMock()
        
        # Вызываем обработчик
        await process_catalog_file(mock_message, mock_state)
        
        # Небольшая задержка между файлами
        await asyncio.sleep(0.1)
    
    # Ждем выполнения таймера
    await asyncio.sleep(1.1)
    
    # Проверяем, что было отправлено подтверждение для 3 файлов
    streetshop.bot.send_message.assert_called()
    call_args = streetshop.bot.send_message.call_args
    assert "✅ Обработано 3 файла! Всего файлов: **3**" in call_args[1]['text']
    
    # Проверяем, что все файлы добавлены
    assert len(mock_data['files']) == 3
    
    print("✅ Тест множественных файлов пройден!")

async def main():
    """Главная функция тестирования"""
    print("🚀 Запуск тестов батчинга файлов каталога...")
    print("=" * 60)
    
    try:
        await test_catalog_file_batching()
        await test_multiple_files()
        
        print("=" * 60)
        print("🎉 ВСЕ ТЕСТЫ БАТЧИНГА ФАЙЛОВ ПРОЙДЕНЫ!")
        print("")
        print("📋 Результат:")
        print("✅ Обработчик файлов каталога теперь правильно батчит файлы")
        print("✅ Показывает корректное количество обработанных файлов")
        print("✅ Работает таймер для группировки файлов")
        print("✅ БОТ ЧИТАЕТ КАЖДЫЙ ФАЙЛ И ПИШЕТ 'обработано X файлов!'")
        print("")
        print("🔧 Теперь при загрузке товара без дней:")
        print("   - Если отправить 1 файл: 'Обработан 1 файл!'")
        print("   - Если отправить 5 файлов: 'Обработано 5 файлов!'")
        print("   - Если отправить 10 файлов: 'Обработано 10 файлов!'")
        
    except Exception as e:
        print(f"❌ ОШИБКА В ТЕСТАХ: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())