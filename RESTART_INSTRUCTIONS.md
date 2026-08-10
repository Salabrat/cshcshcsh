# Инструкция по перезапуску бота после обновления кода

## Проблема
После обновления кода через `git pull` бот продолжает работать на **старой версии**, потому что Python загружает модули в память при запуске.

## Решение

### Вариант 1: Через bot_manager (рекомендуется)
```bash
# Остановить бота
python bot_manager.py stop

# Подождать 3-5 секунд
timeout /t 5

# Запустить заново
python bot_manager.py start
```

### Вариант 2: Перезапуск одной командой
```bash
python bot_manager.py restart
```

### Вариант 3: Вручную (если bot_manager не работает)
```bash
# 1. Найти процесс
wmic process where "name='python.exe'" get ProcessId,CommandLine | findstr streetshop

# 2. Убить процесс (замените XXXX на PID)
taskkill /f /pid XXXX

# 3. Запустить заново
python streetshop.py
```

## Проверка что бот использует новый код

После перезапуска проверь логи:
- Должно быть: `Метод: sbp_phone, Код: G79P4IW`
- НЕ должно быть: `Метод: sbp, Код: phone`

## Если всё равно не работает

1. Проверь, что файл обновился:
```bash
git log --oneline -3
```
Должен быть коммит: `Fix: handle payment/order callbacks with underscore method ids`

2. Проверь method_id в базе:
```bash
python check_method_ids.py
```

3. Убедись что все процессы остановлены:
```bash
python bot_manager.py status
```
