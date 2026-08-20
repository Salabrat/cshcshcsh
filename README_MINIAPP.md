# Mini App Запуск

## Способ 1: Автоматический (рекомендуется)

### Вариант A: Через PowerShell
1. Правый клик на `start_server.ps1` -> "Запустить с помощью PowerShell"
2. Следуйте инструкциям

### Вариант B: Через BAT файл
1. Дважды кликните на `start_all.bat`
2. Если не сработало, попробуйте `run_server.bat`

## Способ 2: Ручной (если автоматический не работает)

### Шаг 1: Запуск сервера
Откройте командную строку (cmd) в папке проекта и выполните:

```cmd
cd D:\ЧЕТКОНАСТРОЕНЫЙБОТ\SHOP_SALIKA
python miniapp_server.py
```

Если python не найден, попробуйте:
```cmd
py miniapp_server.py
```

### Шаг 2: Запуск ngrok
В **другом** окне командной строки:
```cmd
ngrok http 8000
```

### Шаг 3: Обновление config.py
Скопируйте URL из ngrok (например: `https://abc123.ngrok-free.app`) и обновите в config.py:

```python
MINIAPP_URL = "https://abc123.ngrok-free.app/TGMiniapp.html"
```

### Шаг 4: Запуск бота
Запустите вашего бота как обычно

## Проверка
Откройте в браузере: `http://localhost:8000/TGMiniapp.html`

## Решение проблем
- Если "python не найден" - установите Python с python.org
- Если порт 8000 занят - измените PORT в miniapp_server.py
- Если ngrok не работает - установите с ngrok.com