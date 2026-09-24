import requests
from config import Config
import time

token = Config.BOT_TOKEN
url = f"https://api.telegram.org/bot{token}/getUpdates"

print(f"Polling {url} ...")
offset = 0

try:
    while True:
        resp = requests.get(url, params={"offset": offset, "timeout": 10})
        data = resp.json()
        if not data.get("ok"):
            print("Error:", data)
            time.sleep(2)
            continue
        
        updates = data.get("result", [])
        if updates:
            for update in updates:
                print("UPDATE:", update)
                offset = update["update_id"] + 1
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopped.")
