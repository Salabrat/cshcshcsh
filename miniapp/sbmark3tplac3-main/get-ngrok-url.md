# 🔗 Как получить URL для Mini App

## 📡 ngrok запущен

Вы видите:
```
📡 Starting ngrok tunnel...
```

Это означает, что ngrok запускается. Нужно немного подождать, пока появится URL.

## 🎯 Способ 1: Подождите в терминале

Через несколько секунд в терминале появится что-то вроде:

```
Session Status                online
Account                       Your Name (Plan: Free)
Forwarding                    https://abc123.ngrok.io -> http://localhost:3002
```

**Скопируйте URL:** `https://abc123.ngrok.io`

**Добавьте путь к Mini App:**
```
https://abc123.ngrok.io/TGminiapp.html
```

## 🌐 Способ 2: Веб-интерфейс ngrok

Если URL не появился в терминале, откройте в браузере:

```
http://127.0.0.1:4040
```

Там будет веб-интерфейс ngrok, где вы увидите:

```
Forwarding
https://abc123.ngrok.io -> http://localhost:3002
```

**Скопируйте URL и добавьте путь:**
```
https://abc123.ngrok.io/TGminiapp.html
```

## 📋 Что делать дальше

1. **Скопируйте URL** из ngrok (например: `https://abc123.ngrok.io`)
2. **Добавьте путь:** `https://abc123.ngrok.io/TGminiapp.html`
3. **Отправьте в BotFather** этот полный URL когда он попросит:
   ```
   Send me the Mini App URL
   ```

## ✅ Пример полного URL

Если ngrok показал:
```
https://abc123-def456-ghi789.ngrok.io
```

То для BotFather отправьте:
```
https://abc123-def456-ghi789.ngrok.io/TGminiapp.html
```

## 💡 Быстрая проверка

Откройте в браузере:
```
http://127.0.0.1:4040
```

Там точно будет ваш ngrok URL! 🎯
