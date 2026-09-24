# Запуск всего стека одним скриптом

Скрипт `run_all.ps1` поднимает все три сервиса проекта и проверяет, что они реально отвечают.

## Что запускается

| Сервис | Файл | Порт | Назначение |
|---|---|---|---|
| API-сервер | `api_server.py` | 5000 | Отдаёт JSON из `database.db` (темы, категории, товары) |
| Сервер Mini App | `server_fixed.js` | 3000 | Статика Mini App + прокси `/api/*` → порт 5000 |
| Telegram-бот | `streetshop.py` | — | Aiogram polling |

## Команды

```powershell
# Обычный запуск (API + Mini App + бот)
powershell -ExecutionPolicy Bypass -File .\run_all.ps1

# Только серверы, без бота
powershell -ExecutionPolicy Bypass -File .\run_all.ps1 -NoBot

# Проверить состояние (порты + процессы)
powershell -ExecutionPolicy Bypass -File .\run_all.ps1 -Status

# Остановить всё
powershell -ExecutionPolicy Bypass -File .\run_all.ps1 -Stop

# Запуск + публичный туннель для Telegram Mini App
powershell -ExecutionPolicy Bypass -File .\run_all.ps1 -Tunnel

# Туннель + автоматическая запись URL в config.py (MINIAPP_URL)
powershell -ExecutionPolicy Bypass -File .\run_all.ps1 -Tunnel -UpdateConfig
```

## Что скрипт делает сам

1. **Освобождает порты 3000/5000** — если их держат `api_server.py` / `server_fixed.js`, они останавливаются. Посторонний процесс на порту не трогается, скрипт вежливо сообщит об этом.
2. **Убивает лишние экземпляры бота** — Telegram разрешает только один `getUpdates`, иначе бот ловит ошибку `Terminated by other getupdates request`.
3. **Подбирает правильный Python** — проверяет по очереди `.venv`, Python 3.10–3.12 через `py`, стандартные каталоги установки и PATH, выбирая первый, где импортируются `aiogram`, `aiosqlite`, `dotenv`, `requests`. Запускает с `-X utf8 -u`, чтобы логи писались без ошибок кодировки и сразу попадали в файл.
4. **Проверяет результат**: HTTP 200 с `TGMiniapp.html`, HTTP 200 с `/api/themes` и число тем из БД.
5. **Пишет логи** в `logs\` (`api_server.log`, `miniapp_server.log`, `bot.log` + `.err.log`).

## Публичный доступ к Mini App

Telegram открывает Mini App только по HTTPS. Порядок:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_all.ps1 -Tunnel -UpdateConfig
```

Скрипт напечатает URL вида `https://<name>.loca.lt/TGMiniapp.html` и (с `-UpdateConfig`) пропишет его в `config.py` → `MINIAPP_URL`. Этот же URL нужно указать у **@BotFather** → *Bot Settings → Menu Button*, если Mini App открывается из меню бота.

> URL localtunnel меняется при каждом запуске — при смене URL повторите `-Tunnel -UpdateConfig`.

## Если что-то не работает

| Симптом | Что делать |
|---|---|
| `Не найден Python с зависимостями` | `python -m pip install -r requirements.txt` |
| `Terminated by other getupdates request` | `run_all.ps1 -Stop`, затем обычный запуск (скрипт также убивает дубли сам) |
| `Сервер Mini App не ответил` | смотрите `logs\miniapp_server.err.log` |
| `API-сервер не ответил` | смотрите `logs\api_server.err.log`; проверьте, что `database.db` на месте |
| Порт занят посторонним процессом | остановите его вручную либо измените порт в `server_fixed.js` |

## Отличие от start_all.ps1

`start_all.ps1` открывает интерактивные окна `cmd`, ждёт фиксированные паузы, не проверяет результат и требует вручную править `config.py`.
`run_all.ps1` работает без ввода, сам чистит порты и дубли бота, проверяет HTTP-ответы, пишет логи и умеет поднять туннель одной командой.