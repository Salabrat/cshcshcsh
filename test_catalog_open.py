"""Тест: открытие раздела каталога с ПУСТЫМ описанием.

Раньше: Telegram отвергал пустой текст ("message text is empty"), срабатывал
блок обработки ошибки, стикер отправлялся ПОВТОРНО → пользователь видел
два стикера и ни текста, ни кнопок.

Теперь: текст гарантированно непустой (fallback = название раздела),
стикер отправляется ровно один раз.

Запуск: python test_catalog_open.py
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

import database
import streetshop as s
from aiogram import types

CHAT_ID = 555000111
USER_ID = 555000111
BOT_ID = 8168641376
STICKER = "CAACAgEAAxkBAAEO7SxodMdmuDswmlhmRigQFvYeCcXZggACRwIAAvR1IESZ69gYUsdrkzYE"

RESULTS = []
SENT_STICKERS = []
SENT_MESSAGES = []
SENT_PHOTOS = []
DELETED = []


def check(name, ok, extra=""):
    RESULTS.append((name, ok, extra))
    print(("PASS  " if ok else "FAIL  ") + name + ("  | " + extra if extra else ""))


class FakeDb:
    """Заглушка БД с реальной формой строк каталога (как в database.py)."""

    def __init__(self):
        self.item = None            # полная строка get_catalog_item (16 полей)
        self.children = []
        self.themes = []
        self.settings = {}
        self.calls = []

    async def get_catalog_item(self, item_id):
        return self.item

    async def get_catalog_children(self, parent_id):
        return self.children

    async def get_catalog_themes(self):
        return self.themes

    async def get_bot_setting(self, name):
        return self.settings.get(name)

    async def get_product_price(self, product_id):
        return None

    async def get_product_price_with_days(self, product_id):
        return None

    async def get_product_files_count(self, product_id):
        return 1

    async def get_product_files_count_by_days(self, product_id, day_period):
        return 1

    async def is_admin(self, user_id):
        return False

    async def get_all_admins(self):
        return []

    async def ensure_user_exists(self, user_id, username=None):
        return True

    def __getattr__(self, item):
        async def _noop(*args, **kwargs):
            self.calls.append(item)
            return None

        return _noop


def make_item(item_id, item_type, name, description, sticker_id=None,
              photo_id=None, preview_link=None, parent_id=None, is_grid_3x6=False):
    """Строка как из get_catalog_item: 16 полей."""
    return (
        item_id, parent_id, item_type, name, description, sticker_id, photo_id,
        preview_link, 1, 0, None, None, None, is_grid_3x6, None, None,
    )


def make_child(item_id, item_type, name, description=None, sticker_id=None,
               photo_id=None, preview_link=None):
    """Строка как из get_catalog_children: 10 полей."""
    return (
        item_id, item_type, name, description, sticker_id, photo_id,
        preview_link, 1, 0, False,
    )


def patch_bot():
    async def send_sticker(*args, **kwargs):
        SENT_STICKERS.append((args, kwargs))
        return None

    async def send_message(*args, **kwargs):
        text = kwargs.get("text")
        if text is None and args:
            text = args[0] if len(args) == 1 else args[1] if len(args) > 1 else None
        SENT_MESSAGES.append((args, kwargs, text))
        if text is None or (isinstance(text, str) and not text.strip()):
            # повторяем поведение Telegram
            raise Exception("Bad Request: message text is empty")
        return None

    async def send_photo(*args, **kwargs):
        SENT_PHOTOS.append((args, kwargs))
        return None

    async def delete_message(*args, **kwargs):
        DELETED.append((args, kwargs))
        return None

    async def noop(*args, **kwargs):
        return None

    send_like = {
        "send_sticker": send_sticker,
        "send_message": send_message,
        "send_photo": send_photo,
        "send_document": send_message,
        "send_video": send_message,
        "send_animation": send_message,
        "send_dice": noop,
        "send_chat_action": noop,
        "copy_message": noop,
        "forward_message": noop,
    }
    for name, func in send_like.items():
        setattr(s.bot, name, func)

    setattr(s.bot, "delete_message", delete_message)

    for name in ("edit_message_text", "edit_message_caption", "answer_callback_query",
                 "get_me", "get_file", "set_my_commands", "delete_my_commands",
                 "set_chat_menu_button"):
        setattr(s.bot, name, noop)


FAKE_DB = FakeDb()


def reset_sent():
    SENT_STICKERS.clear()
    SENT_MESSAGES.clear()
    SENT_PHOTOS.clear()
    DELETED.clear()


def make_message(text=None, caption=None, reply_markup=None):
    chat = types.Chat(id=CHAT_ID, type="private")
    bot_user = types.User(id=BOT_ID, is_bot=True, first_name="bot")
    msg = types.Message(
        message_id=10,
        date=int(datetime.now().timestamp()),
        chat=chat,
        text=text,
        caption=caption,
        **{"from": bot_user},
    )
    msg.message_thread_id = None
    msg.is_topic_message = False
    if reply_markup is not None:
        msg.reply_markup = reply_markup
    return msg


def make_callback(data, message):
    user = types.User(id=USER_ID, is_bot=False, first_name="Test")
    return types.CallbackQuery(
        id="cb1",
        chat_instance="ci",
        message=message,
        data=data,
        **{"from": user},
    )


async def send_callback(data, message=None):
    msg = message or make_message(text="старое сообщение каталога",
                                 reply_markup=types.InlineKeyboardMarkup())
    cb = make_callback(data, msg)
    update = types.Update(update_id=1, callback_query=cb)
    await s.dp.process_update(update)


def non_empty_texts():
    return [t for _, _, t in SENT_MESSAGES if isinstance(t, str) and t.strip()]


async def main():
    saved_db = s.db
    saved_delete = s.safe_delete_messages
    saved_error_handlers = list(s.dp.errors_handlers.handlers)

    s.db = FAKE_DB
    database.db = FAKE_DB            # keyboards.py делает `from database import db`
    from aiogram import Bot as _Bot

    _Bot.set_current(s.bot)
    patch_bot()
    s.dp.errors_handlers.handlers.clear()

    async def _noop_delete(*args, **kwargs):
        return None

    s.safe_delete_messages = _noop_delete

    print("=" * 70)
    print("SCENARIO 0: format_description_with_preview never returns empty")
    print("=" * 70)
    check("None + None -> non-empty",
          bool(s.format_description_with_preview(None, None).strip()),
          repr(s.format_description_with_preview(None, None)))
    check("'' + None -> non-empty", bool(s.format_description_with_preview("", None).strip()))
    check("'None' string -> non-empty",
          bool(s.format_description_with_preview("None", None).strip()))
    check("fallback used when empty",
          s.format_description_with_preview("", None, fallback="ТЕМА") == "ТЕМА")
    check("preview_link added when empty description",
          "href" in s.format_description_with_preview("", "https://t.me/x"))
    check("normal description kept",
          s.format_description_with_preview("Описание", None) == "Описание")

    print()
    print("=" * 70)
    print("SCENARIO 1: sticker-first replace with EMPTY text (root cause)")
    print("=" * 70)
    reset_sent()
    cb = make_callback("noop", make_message(text="x",
                                            reply_markup=types.InlineKeyboardMarkup()))
    await s.replace_message_with_sticker_first(
        callback=cb, new_text="", new_photo=None, new_caption=None,
        new_keyboard=types.InlineKeyboardMarkup(), sticker_id=STICKER
    )
    check("sticker sent exactly ONCE (was: two stickers)", len(SENT_STICKERS) == 1,
          "%d stickers" % len(SENT_STICKERS))
    check("text message sent and non-empty", len(non_empty_texts()) == 1,
          repr(non_empty_texts()))

    print()
    print("=" * 70)
    print("SCENARIO 2: open THEME with empty description + sticker, no photo")
    print("=" * 70)
    reset_sent()
    FAKE_DB.item = make_item(25954, "theme", "SCAMMER", None, sticker_id=STICKER)
    FAKE_DB.children = [
        make_child(1, "category", "Категория 1"),
        make_child(2, "category", "Категория 2"),
    ]
    await send_callback("view_theme_25954")
    check("theme: sticker sent once", len(SENT_STICKERS) == 1, "%d" % len(SENT_STICKERS))
    check("theme: non-empty text sent", len(non_empty_texts()) == 1, repr(non_empty_texts()))
    check("theme: fallback contains theme name",
          any("SCAMMER" in t for t in non_empty_texts()), repr(non_empty_texts()))
    check("theme: keyboard present (buttons built)",
          len(SENT_MESSAGES) == 1 and SENT_MESSAGES[0][1].get("reply_markup") is not None)

    print()
    print("=" * 70)
    print("SCENARIO 3: open CATEGORY with empty description")
    print("=" * 70)
    reset_sent()
    FAKE_DB.item = make_item(25745, "category", "Скрипты", None)
    FAKE_DB.children = [make_child(3, "product", "Товар 1")]
    await send_callback("view_category_25745")
    check("category: one sticker at most", len(SENT_STICKERS) <= 1, "%d" % len(SENT_STICKERS))
    check("category: non-empty text sent", len(non_empty_texts()) == 1, repr(non_empty_texts()))
    check("category: fallback contains category name",
          any("Скрипты" in t for t in non_empty_texts()), repr(non_empty_texts()))

    print()
    print("=" * 70)
    print("SCENARIO 4: open SUBCATEGORY with empty description")
    print("=" * 70)
    reset_sent()
    FAKE_DB.item = make_item(999, "subcategory", "Северный регион", None)
    FAKE_DB.children = []
    await send_callback("view_subcategory_999")
    check("subcategory: non-empty text sent", len(non_empty_texts()) == 1,
          repr(non_empty_texts()))

    print()
    print("=" * 70)
    print("SCENARIO 5: catalog button with no photo (text was empty before)")
    print("=" * 70)
    reset_sent()
    FAKE_DB.settings = {}
    FAKE_DB.themes = [make_child(25954, "theme", "SCAMMER")]
    user = types.User(id=USER_ID, is_bot=False, first_name="Test")
    msg = types.Message(message_id=11, date=int(datetime.now().timestamp()),
                        chat=types.Chat(id=CHAT_ID, type="private"), text="Каталог",
                        **{"from": user})
    msg.message_thread_id = None
    msg.is_topic_message = False
    await s._handle_catalog_button(msg)
    check("catalog button: non-empty text sent", len(non_empty_texts()) == 1,
          repr(non_empty_texts()))

    print()
    print("=" * 70)
    print("SCENARIO 6: theme WITH description still works (no regression)")
    print("=" * 70)
    reset_sent()
    FAKE_DB.item = make_item(100, "theme", "VPN", "<b>Описание темы</b>", sticker_id=STICKER)
    await send_callback("view_theme_100")
    check("described theme: sticker once", len(SENT_STICKERS) == 1, "%d" % len(SENT_STICKERS))
    check("described theme: text preserved",
          any("Описание темы" in t for t in non_empty_texts()), repr(non_empty_texts()))

    print()
    print("=" * 70)
    print("SCENARIO 7: GIF/Animation cover support (auto-detected, cached)")
    print("=" * 70)
    reset_sent()
    s.MEDIA_TYPE_CACHE.clear()
    gif_file_id = "CgACAgIAAxkBAAIEXAMPLE_GIF_ANIMATION_ID_1234567890"

    # Имитируем поведение Telegram: send_photo для GIF падает, send_animation проходит
    async def mock_send_photo(*a, **kw):
        p = kw.get("photo") or (a[1] if len(a) > 1 else None)
        if p == gif_file_id:
            raise Exception("Bad Request: wrong file identifier/HTTP URL specified")
        SENT_PHOTOS.append((a, kw))
        return types.Message(message_id=901, date=1, chat=types.Chat(id=CHAT_ID, type="private"))

    sent_animations = []

    async def mock_send_animation(*a, **kw):
        sent_animations.append((a, kw))
        return types.Message(message_id=902, date=1, chat=types.Chat(id=CHAT_ID, type="private"))

    s.bot.send_photo = mock_send_photo
    s.bot.send_animation = mock_send_animation

    FAKE_DB.item = make_item(
        200, "category", "GIF Категория", description="Товары с GIF",
        sticker_id=STICKER, photo_id=gif_file_id
    )
    FAKE_DB.children = []
    await send_callback("view_category_200")

    check("gif cover: animation sent instead of failing", len(sent_animations) == 1,
          "%d animations" % len(sent_animations))
    check("gif cover: sticker sent once", len(SENT_STICKERS) == 1,
          "%d stickers" % len(SENT_STICKERS))
    check("gif cover: cached type is animation",
          s.MEDIA_TYPE_CACHE.get(gif_file_id) == "animation",
          str(s.MEDIA_TYPE_CACHE.get(gif_file_id)))

    print()
    print("=" * 70)
    print("SCENARIO 8: MP4/Video cover support (auto-detected, cached)")
    print("=" * 70)
    reset_sent()
    sent_animations.clear()
    video_file_id = "BAACAgIAAxkBAAIEXAMPLE_VIDEO_MP4_ID_1234567890"

    sent_videos = []

    # Для видео: photo и animation должны падать, а video проходить
    async def mock_send_photo_fail(*a, **kw):
        raise Exception("Bad Request: can't parse photo")

    async def mock_send_anim_fail(*a, **kw):
        raise Exception("Bad Request: can't parse animation")

    async def mock_send_video(*a, **kw):
        sent_videos.append((a, kw))
        return types.Message(message_id=903, date=1, chat=types.Chat(id=CHAT_ID, type="private"))

    s.bot.send_photo = mock_send_photo_fail
    s.bot.send_animation = mock_send_anim_fail
    s.bot.send_video = mock_send_video

    FAKE_DB.item = make_item(
        201, "theme", "Видео Тема", description="Раздел с видео",
        sticker_id=None, photo_id=video_file_id
    )
    FAKE_DB.children = []
    await send_callback("view_theme_201")

    check("video cover: video sent", len(sent_videos) == 1, "%d videos" % len(sent_videos))
    check("video cover: cached type is video",
          s.MEDIA_TYPE_CACHE.get(video_file_id) == "video",
          str(s.MEDIA_TYPE_CACHE.get(video_file_id)))

    print()
    print("=" * 70)
    print("SCENARIO 9: Invalid media falls back to text gracefully (no crash)")
    print("=" * 70)
    reset_sent()
    dead_file_id = "DEAD_FILE_ID_THAT_FAILS_EVERYTHING_1234567890"

    async def mock_fail_all(*a, **kw):
        raise Exception("Bad Request: file is dead")

    s.bot.send_photo = mock_fail_all
    s.bot.send_animation = mock_fail_all
    s.bot.send_video = mock_fail_all
    s.bot.send_document = mock_fail_all

    FAKE_DB.item = make_item(
        202, "category", "Битая Обложка", description="Раздел с битой ссылкой",
        sticker_id=STICKER, photo_id=dead_file_id
    )
    FAKE_DB.children = []
    await send_callback("view_category_202")

    check("dead cover: sticker still sent", len(SENT_STICKERS) == 1,
          "%d stickers" % len(SENT_STICKERS))
    check("dead cover: fallback to text succeeded", len(non_empty_texts()) >= 1,
          repr(non_empty_texts()))
    check("dead cover: fallback text has section content",
          any("Битая Обложка" in t or "Раздел с битой ссылкой" in t for t in non_empty_texts()),
          repr(non_empty_texts()))

    # восстановление
    s.db = saved_db
    database.db = saved_db
    s.safe_delete_messages = saved_delete
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
    io.open("test_catalog_open_result.txt", "w", encoding="utf-8").write(report.getvalue())
    return 0 if not failed else 1


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        code = loop.run_until_complete(main())
    finally:
        loop.close()
    sys.exit(code)