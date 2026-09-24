"""Тест: ввод текста в формах админки больше не перехватывается
глобальным обработчиком кнопок меню (handle_menu_buttons).

Проверяется на РЕАЛЬНОМ диспетчере streetshop.dp с реальной цепочкой
хендлеров — то есть ровно так, как это происходит в бою. База и Telegram
подменяются заглушками.

Запуск: python test_edit_forms.py
Результат также пишется в test_edit_forms_result.txt (и код возврата 1 при падении).
"""
import asyncio
import io
import sys
from datetime import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import streetshop as s
from aiogram import types

CHAT_ID = 777000111
USER_ID = 777000111

RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append((name, ok, extra))
    print(("PASS  " if ok else "FAIL  ") + name + ("  | " + extra if extra else ""))


class FakeDb:
    """Заглушка БД: пишет вызовы в calls, ничего никуда не сохраняет."""

    def __init__(self):
        self.calls = []
        self.button_names = {}
        self.admins = []
        self.settings = {}

    async def get_button_name(self, key):
        return self.button_names.get(key)

    async def is_admin(self, user_id):
        return user_id in self.admins

    async def get_all_admins(self):
        return self.admins

    async def get_bot_setting(self, name):
        return self.settings.get(name)

    async def get_welcome_settings(self):
        return {}

    async def update_catalog_item_name(self, item_id, name):
        self.calls.append(("update_catalog_item_name", item_id, name))

    async def update_catalog_item_description(self, item_id, desc):
        self.calls.append(("update_catalog_item_description", item_id, desc))

    async def set_bot_setting(self, name, value):
        self.calls.append(("set_bot_setting", name, value))
        self.settings[name] = value

    async def update_product_name(self, item_id, name):
        self.calls.append(("update_product_name", item_id, name))

    async def update_product_description(self, item_id, desc):
        self.calls.append(("update_product_description", item_id, desc))

    def __getattr__(self, item):
        async def _noop(*args, **kwargs):
            self.calls.append((item,) + args)
            return None

        return _noop


SENT = []
EDITED = []
TRACE = []


def trace_handlers():
    """Оборачивает хендлеры, чтобы видеть, какой именно сработал."""
    for rec in s.dp.message_handlers.handlers:
        if getattr(rec, "_traced", False):
            continue
        original = rec.handler
        name = getattr(original, "__name__", str(original))

        async def wrapper(*args, _orig=original, _name=name, **kwargs):
            TRACE.append(_name)
            return await _orig(*args, **kwargs)

        rec.handler = wrapper
        rec._traced = True


class _Recorder:
    """«Ручка» для проверок: те же списки, куда пишет патченный бот."""

    sent = SENT
    edited = EDITED


FAKE_BOT = _Recorder()


def patch_bot():
    """Подменяет методы РЕАЛЬНОГО bot-объекта: запоминает вызовы, не ходит в сеть.

    Так приходится делать потому, что aiogram-типы берут бота из контекста
    (TelegramObject.bot -> Bot.get_current()), и подставить туда можно только
    настоящий экземпляр Bot.
    """
    async def _send_message(*args, **kwargs):
        SENT.append((args, kwargs))
        return None

    async def _edit_message(*args, **kwargs):
        EDITED.append((args, kwargs))
        return None

    async def _noop(*args, **kwargs):
        return None

    async def _no_network(*args, **kwargs):
        raise RuntimeError(
            "NETWORK CALL in test: %r" % (args[:1],)
        )

    for name in (
        "send_message", "send_photo", "send_document", "send_video",
        "send_animation", "send_sticker", "send_audio", "send_voice",
        "send_location", "send_contact", "send_dice", "send_media_group",
        "send_chat_action", "copy_message", "forward_message",
    ):
        setattr(s.bot, name, _send_message)

    for name in (
        "edit_message_text", "edit_message_caption", "edit_message_media",
        "edit_message_reply_markup",
    ):
        setattr(s.bot, name, _edit_message)

    for name in (
        "delete_message", "answer_callback_query", "get_me", "get_file",
        "get_chat", "set_my_commands", "delete_my_commands",
        "set_chat_menu_button", "send_invoice", "create_invoice_link",
        "answer_pre_checkout_query", "answer_shipping_query",
    ):
        setattr(s.bot, name, _noop)

    # любой незапланированный сетевой вызов должен падать сразу, а не висеть
    setattr(s.bot, "get_session", _no_network)


def make_message(text):
    chat = types.Chat(id=CHAT_ID, type="private")
    user = types.User(id=USER_ID, is_bot=False, first_name="Test")
    msg = types.Message(
        message_id=1,
        date=int(datetime.now().timestamp()),
        chat=chat,
        text=text,
        **{"from": user},  # поле объявлено как alias="from" (см. aiogram/types/message.py)
    )
    # aiogram-хелперы (Message.answer) требуют этих полей
    msg.message_thread_id = None
    msg.is_topic_message = False
    return msg


import contextvars

from aiogram.dispatcher.filters.builtin import StateFilter


def reset_state_filter_cache():
    """Сбрасывает контекстный кэш StateFilter.

    В реальном polling каждый апдейт обрабатывается в отдельной задаче с чистым
    контекстом, поэтому фильтр читает состояние из storage. При прямом вызове
    process_update в одном и том же контексте кэш «протекает» между вызовами,
    и это искажает результат теста.
    """
    StateFilter.ctx_state = contextvars.ContextVar("user_state_test")


async def send_text(text):
    """Пропускает текстовое сообщение через реальный диспетчер бота."""
    TRACE.clear()
    reset_state_filter_cache()
    msg = make_message(text)
    update = types.Update(update_id=1, message=msg)
    await s.dp.process_update(update)
    print("   [trace] executed:", TRACE)
    return msg


async def set_form_state(state: str, data: dict):
    await s.dp.storage.set_state(chat=CHAT_ID, user=USER_ID, state=state)
    await s.dp.storage.set_data(chat=CHAT_ID, user=USER_ID, data=data)


async def get_current_state():
    return await s.dp.storage.get_state(chat=CHAT_ID, user=USER_ID)


def calls_of(fake_db, name):
    return [c for c in fake_db.calls if c[0] == name]


async def main():
    saved_db = s.db
    saved_bot = s.bot
    saved_recreate = {
        "recreate_category_view": s.recreate_category_view,
        "recreate_theme_view": s.recreate_theme_view,
        "recreate_subcategory_view": s.recreate_subcategory_view,
    }
    saved_menu_handlers = {
        "_handle_catalog_button": s._handle_catalog_button,
        "_handle_profile_button": s._handle_profile_button,
        "_handle_deposit_button": s._handle_deposit_button,
        "_handle_contact_button": s._handle_contact_button,
        "_handle_bonus_button": s._handle_bonus_button,
    }
    # убираем перехват ошибок, чтобы падения были видны, а не «проглатывались»
    saved_error_handlers = list(s.dp.errors_handlers.handlers)
    s.dp.errors_handlers.handlers.clear()

    fake_db = FakeDb()
    s.db = fake_db
    # Message.answer берёт бота из контекста, а туда пускают только настоящий Bot
    from aiogram import Bot as _Bot

    _Bot.set_current(s.bot)
    patch_bot()
    trace_handlers()

    async def _noop(*args, **kwargs):
        return None

    for name in saved_recreate:
        setattr(s, name, _noop)

    print("=" * 70)
    print("SCENARIO 0: registry of FSM states with message handlers")
    print("=" * 70)
    registry = s.FSM_STATES_WITH_MESSAGE_HANDLERS
    check("registry is not empty", len(registry) > 0, "count=%d" % len(registry))
    for expected in [
        "AdminCatalogEditStates:waiting_for_name",
        "AdminCatalogEditStates:waiting_for_description",
        "admin_edit_button_waiting_name",
        "PaymentDetailsStates:waiting_for_card",
        "PaymentDetailsStates:waiting_for_sbp_phone",
        "WelcomeEditStates:waiting_for_text",
    ]:
        check("registry contains " + expected, expected in registry)

    print()
    print("SCENARIO 1: change category/theme NAME (was broken)")
    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    await set_form_state(
        "AdminCatalogEditStates:waiting_for_name",
        {"edit_item_id": 555, "edit_item_type": "category"},
    )
    await send_text("Новое имя категории")

    saved = calls_of(fake_db, "update_catalog_item_name")
    check(
        "db.update_catalog_item_name called with typed text",
        len(saved) == 1 and saved[0][1] == 555 and saved[0][2] == "Новое имя категории",
        repr(saved),
    )
    check("state finished after saving", await get_current_state() is None)
    check(
        "confirmation message sent to admin",
        any("Название обновлено" in str(kw.get("text", "")) for _, kw in FAKE_BOT.sent),
        "%d messages" % len(FAKE_BOT.sent),
    )

    print()
    print("SCENARIO 2: change category/theme DESCRIPTION (was broken)")
    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    await set_form_state(
        "AdminCatalogEditStates:waiting_for_description",
        {"edit_item_id": 556, "edit_item_type": "theme"},
    )
    await send_text("Новое описание темы")
    saved = calls_of(fake_db, "update_catalog_item_description")
    check(
        "db.update_catalog_item_description called with typed text",
        len(saved) == 1 and saved[0][1] == 556 and saved[0][2] == "Новое описание темы",
        repr(saved),
    )
    check("state finished after saving description", await get_current_state() is None)

    print()
    print("SCENARIO 3: change MENU BUTTON name (/editbutton, was broken)")
    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    await set_form_state(
        "admin_edit_button_waiting_name",
        {"editing_button_key": "catalog"},
    )
    await send_text("Мой каталог")
    saved = [c for c in fake_db.calls if "button" in c[0].lower()]
    check(
        "db.set_button_name called with new menu button name",
        any(c[0] == "set_button_name" and c[1] == "catalog" and c[2] == "Мой каталог"
            for c in saved),
        repr(saved[:3]),
    )
    check("state finished after renaming button", await get_current_state() is None)

    print()
    print("SCENARIO 4: change PAYMENT DETAILS (was broken)")
    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    await set_form_state("PaymentDetailsStates:waiting_for_card", {})
    await send_text("1234 5678 9012 3456")
    saved = calls_of(fake_db, "set_payment_details")
    check(
        "db.set_payment_details called with the new card details",
        any(c[1] == "card" and c[2] == "1234 5678 9012 3456" for c in saved),
        repr(saved[:3]),
    )
    check("state finished after saving details", await get_current_state() is None)

    print()
    print("SCENARIO 5: change WELCOME TEXT (handler was missing entirely)")
    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    await set_form_state("WelcomeEditStates:waiting_for_text", {})
    await send_text("Новый текст приветствия")
    saved = calls_of(fake_db, "set_bot_setting")
    check(
        "welcome_text was saved",
        any(c[1] == "welcome_text" and c[2] == "Новый текст приветствия" for c in saved),
        repr(saved[:3]),
    )
    check("state finished after saving welcome text", await get_current_state() is None)

    print()
    print("SCENARIO 6: menu buttons still work (no regression)")
    fake_db.calls.clear()
    fake_db.button_names["catalog"] = "Каталог товаров"
    called = {"catalog": False}

    async def fake_catalog_button(message):
        called["catalog"] = True

    s._handle_catalog_button = fake_catalog_button
    await s.dp.storage.set_state(chat=CHAT_ID, user=USER_ID, state=None)
    await send_text("Каталог товаров")
    check("menu button handler executed", called["catalog"])

    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    fake_db.admins = [(999888777, "@admin")]
    await s.dp.storage.set_state(chat=CHAT_ID, user=USER_ID, state=None)
    await send_text("просто сообщение в поддержку")
    forwarded = [
        (args, kwargs) for args, kwargs in FAKE_BOT.sent
        if "Сообщение от пользователя" in str(kwargs.get("text", ""))
        or any("Сообщение от пользователя" in str(a) for a in args)
    ]
    check("plain text is still forwarded to admins (old behaviour kept)",
          len(forwarded) == 1, "%d forwarded" % len(forwarded))

    print()
    print("SCENARIO 7: prove the mechanism (without the fix text is swallowed)")
    fake_db.calls.clear()
    FAKE_BOT.sent.clear()
    backup = set(s.FSM_STATES_WITH_MESSAGE_HANDLERS)
    s.FSM_STATES_WITH_MESSAGE_HANDLERS.clear()  # имитируем состояние ДО фикса
    try:
        await set_form_state(
            "AdminCatalogEditStates:waiting_for_name",
            {"edit_item_id": 557, "edit_item_type": "category"},
        )
        await send_text("Имя которое должно потеряться")
        lost = calls_of(fake_db, "update_catalog_item_name")
        check("without fix: name is NOT saved (bug reproduced)", len(lost) == 0, repr(lost))
    finally:
        s.FSM_STATES_WITH_MESSAGE_HANDLERS.update(backup)
        await s.dp.storage.finish(chat=CHAT_ID, user=USER_ID)

    # --- возвращаем всё как было ---
    s.db = saved_db
    s.bot = saved_bot
    for name, func in saved_recreate.items():
        setattr(s, name, func)
    for name, func in saved_menu_handlers.items():
        setattr(s, name, func)
    s.dp.errors_handlers.handlers.extend(saved_error_handlers)

    print()
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = [(n, e) for n, ok, e in RESULTS if not ok]
    print("RESULT: %d passed, %d failed, %d total" % (passed, len(failed), len(RESULTS)))
    for n, e in failed:
        print("   FAILED: %s  %s" % (n, e))

    report = io.StringIO()
    for name, ok, extra in RESULTS:
        report.write(("PASS  " if ok else "FAIL  ") + name
                     + ("  | " + extra if extra else "") + "\n")
    report.write("\nRESULT: %d passed, %d failed, %d total\n"
                 % (passed, len(failed), len(RESULTS)))
    io.open("test_edit_forms_result.txt", "w", encoding="utf-8").write(report.getvalue())

    return 0 if not failed else 1


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        code = loop.run_until_complete(main())
    finally:
        loop.close()
    sys.exit(code)