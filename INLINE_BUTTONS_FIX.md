# 🔘 Почему не работали ВСЕ инлайн-кнопки — и что исправлено

## Симптом

- `/start` работает, текст и меню-кнопка работают, сообщения от бота приходят;
- **любое** нажатие инлайн-кнопки (`callback`) не даёт никакой реакции;
- в логах `logs\bot.log` **нет ни одной строки** вида
  `🔍 CALLBACK RECEIVED: ...`, то есть апдейты типа `callback_query`
  до бота вообще не доходят.

Именно из-за последнего пункта код «не выглядел сломанным»: 205 обработчиков
на месте, фильтры правильные, синтаксис в порядке.

## Корневая причина

Telegram **хранит на своей стороне** список типов апдейтов, которые готов
присылать боту (`allowed_updates`). Значение запоминается и **используется,
если polling-запрос не передаёт `allowed_updates` явно** (документация
`getUpdates`: «If not specified, the previous setting will be used»).

У бота в этом списке остались только:

```
["message", "edited_message", "channel_post", "edited_channel_post"]
```

`callback_query` там не было — поэтому Telegram физически не присылал нажатия
инлайн-кнопок. Сообщения при этом продолжали приходить, из-за чего проблема
выглядела «точечной», хотя была полностью блокирующей.

Кто выставил такое значение — в коде проекта его нет вообще (поиск по
`allowed_updates` пустой). Скорее всего, следы ручной отладки
(`setWebhook`/`getUpdates` из консоли или другого скрипта). Важно, что
`delete_webhook()` **не** сбрасывает `allowed_updates`, а aiogram 2.x по
умолчанию передаёт `allowed_updates=None`, то есть настройка «залипала»
навсегда — перезапуск бота не помогал.

Проверка одной командой:

```powershell
python check_bot.py
```

```
📥 allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post']
❌ ПРОБЛЕМА: в allowed_updates НЕТ 'callback_query'!
```

## Что исправлено

### 1. `streetshop.py` — явный список типов апдейтов

Добавлена константа `ALLOWED_UPDATES` со всеми нужными типами, включая
`callback_query`, и она передаётся в polling:

```python
ALLOWED_UPDATES = ["message", ..., "callback_query", ..., "chat_join_request"]
```

* `executor.start_polling(..., allowed_updates=ALLOWED_UPDATES)` — в `main()`
  и в `__main__`-блоке;
* `await dp.start_polling(allowed_updates=ALLOWED_UPDATES)` в
  `safe_start_polling()`.

Теперь каждая отправка `getUpdates` перезаписывает настройку и она не может
«протухнуть» молча.

### 2. `streetshop.py` — автолечение на старте

Добавлена функция `reset_allowed_updates()`, которая вызывает `getUpdates` с
полным списком и подтверждает полученные апдейты (ничего не теряется,
`skip_updates=True` и так пропускает старое). Вызывается в `on_startup` сразу
после удаления webhook: в `logs\bot.log` появится строка

```
✅ allowed_updates сброшены (callback_query разрешён)
```

### 3. Убран debug-алерт для клиентов

В обработчике-заглушке `debug_all_callbacks` (самый последний в файле)
вместо `callback.answer("Debug: Unknown button: ...", show_alert=True)`
теперь тихий `callback.answer()` — реальные пользователи больше не видят
технических всплывашек.

### 4. Найдена и починена «мёртвая» кнопка

`back_to_task_creation` («🔙 Назад» при создании задания в бонусной системе,
`streetshop.py:12535/12560/12587`) не имел обработчика. Добавлен
`back_to_task_creation_handler`, который возвращает админа к выбору типа
задания, используя `section_id` из FSM-состояния.

## Инструменты проверки

| Файл | Назначение |
|---|---|
| `check_bot.py` | кто бот, есть ли webhook, какие `allowed_updates` разрешены |
| `_reset_allowed_updates.py` | принудительно сбросить `allowed_updates` из консоли |
| `check_inline_buttons.py` | аудит: для каждого `callback_data` ищет обработчик |

Аудит кнопок на текущий момент: 205 декораторов `callback_query_handler`,
все пользовательские `callback_data` покрыты (кроме декоративных `noop`).

## Важно при запуске

1. **Только один экземпляр бота.** Два процесса с одним токеном дают ошибку
   `TerminatedByOtherGetUpdates` (видно в старом `logs\bot.log`), при этом
   часть апдейтов забирает «лишний» процесс и бот ведёт себя непредсказуемо.
   Запускать: `python bot_manager.py start` (он убивает дубли) либо
   `run_all.ps1`.
2. **Не запускать рядом самодельные поллеры** (`poll_test.py` и подобные) —
   каждый `getUpdates` «угоняет» апдейты у бота.
3. Логи смотреть в `logs\bot.log` / `logs\bot.err.log`.