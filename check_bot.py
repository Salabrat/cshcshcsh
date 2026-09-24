"""Быстрая диагностика Telegram-бота.

Показывает:
  * кто мы (getMe)
  * стоит ли webhook (webhook мешает polling)
  * какие типы апдейтов разрешены (allowed_updates) — если там нет
    "callback_query", инлайн-кнопки НЕ РАБОТАЮТ вообще

Запуск: python check_bot.py
"""
import sys

if sys.platform == "win32":
    # Чтобы эмодзи не ломали вывод при перенаправлении в файл/конвейер
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import requests

from config import cfg

TOKEN = cfg.BOT_TOKEN
BASE = f"https://api.telegram.org/bot{TOKEN}"


def main():
    me = requests.get(f"{BASE}/getMe", timeout=15).json()
    if not me.get("ok"):
        print("❌ Токен не работает:", me)
        return
    print(f"✅ Бот: @{me['result']['username']} ({me['result']['first_name']})")

    info = requests.get(f"{BASE}/getWebhookInfo", timeout=15).json()["result"]
    url = info.get("url") or ""
    if url:
        print(f"⚠️ Установлен webhook: {url}")
        print("   Пока webhook активен, polling не получает апдейты.")
    else:
        print("✅ Webhook не установлен (polling работает)")

    allowed = info.get("allowed_updates") or []
    print(f"📥 allowed_updates: {allowed}")

    if not allowed:
        print("✅ Ограничений нет — принимаются все типы апдейтов")
    elif "callback_query" not in allowed:
        print("❌ ПРОБЛЕМА: в allowed_updates НЕТ 'callback_query'!")
        print("   Именно поэтому не работают инлайн-кнопки.")
        print("   Исправление: перезапустить бота (streetshop.py сам сбрасывает")
        print("   настройку в on_startup) либо запустить _reset_allowed_updates.py")
    else:
        print("✅ callback_query разрешён — инлайн-кнопки будут доходить до бота")

    print(f"⏳ Апдейтов в очереди: {info.get('pending_update_count')}")


if __name__ == "__main__":
    main()