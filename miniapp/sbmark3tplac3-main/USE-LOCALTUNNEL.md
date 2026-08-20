# 🔄 Альтернатива: Использовать localtunnel вместо Cloudflare

Если антивирус постоянно блокирует cloudflared, используйте **localtunnel** - это проще и реже блокируется.

## 📥 Установка localtunnel

```bash
npm install -g localtunnel
```

## 🚀 Использование

### Шаг 1: Запустите сервер

```bash
npm start
```

### Шаг 2: В другом терминале запустите туннель

```bash
lt --port 3002
```

### Шаг 3: Скопируйте URL

Вы увидите что-то вроде:
```
your url is: https://random-name.loca.lt
```

### Шаг 4: Создайте полный URL для Telegram

Добавьте `/TGminiapp.html`:
```
https://random-name.loca.lt/TGminiapp.html
```

### Шаг 5: Обновите в BotFather

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/mybots` → ваш бот → "Bot Settings" → "Menu Button"
3. Вставьте URL

---

## ✅ Преимущества localtunnel

- ✅ Редко блокируется антивирусом
- ✅ Простая установка
- ✅ Работает стабильно
- ✅ Бесплатно

---

## ⚠️ Недостатки

- URL меняется при каждом перезапуске (как и у Cloudflare)
- Может быть немного медленнее

---

## 🔧 Автоматический скрипт

Создайте файл `start-localtunnel.bat`:

```batch
@echo off
echo Starting server...
start cmd /k "npm start"
timeout /t 3
echo Starting localtunnel...
start cmd /k "lt --port 3002"
echo.
echo Check the localtunnel window for your URL
pause
```

Запустите: `start-localtunnel.bat`

---

**Рекомендация:** Если cloudflared блокируется, используйте localtunnel - это проще и надежнее!
