"""Принудительный сброс allowed_updates на стороне Telegram.

Telegram запоминает список разрешённых типов апдейтов. Если в нём нет
"callback_query", нажатия инлайн-кнопок вообще не доходят до бота.
Обычно сбрасывается автоматически в on_startup (см. reset_allowed_updates
в streetshop.py), этот скрипт нужен для ручной проверки/починки.

Запуск: python _reset_allowed_updates.py"""
import json
import sys

if sys.platform == "win32":
    # Чтобы эмодзи не ломали вывод при перенаправлении в файл
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import requests

TOKEN = "8168641376:AAFa7W6-jJLIJ5LyOcRyOAHfwCVlATdpjJI"
base = f"https://api.telegram.org/bot{TOKEN}"

ALLOWED = [
    "message", "edited_message", "channel_post", "edited_channel_post",
    "inline_query", "chosen_inline_result", "callback_query",
    "shipping_query", "pre_checkout_query",
    "poll", "poll_answer",
    "my_chat_member", "chat_member", "chat_join_request",
]

print("=== ДО фикса ===")
print(requests.get(base + "/getWebhookInfo", timeout=15).json()["result"].get("allowed_updates"))

# 1) getUpdates с полным списком allowed_updates -> Telegram перезаписывает sticky-настройку
r = requests.get(
    base + "/getUpdates",
    params={"timeout": 0, "limit": 1, "allowed_updates": json.dumps(ALLOWED)},
    timeout=20,
).json()
print("getUpdates ok:", r.get("ok"), "| description:", r.get("description"))

# 2) delete_webhook с полным списком (страховка, чтобы polling точно получал callback_query)
r2 = requests.post(base + "/deleteWebhook", json={"drop_pending_updates": False}, timeout=15).json()
print("deleteWebhook ok:", r2.get("ok"), "|", r2.get("description"))

print("=== ПОСЛЕ фикса ===")
print(requests.get(base + "/getWebhookInfo", timeout=15).json()["result"].get("allowed_updates"))