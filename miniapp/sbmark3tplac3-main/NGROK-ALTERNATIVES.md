# 🔄 Альтернативы ngrok (решение проблемы ERR_NGROK_727)

## ❌ Проблема
Ошибка `ERR_NGROK_727` означает, что превышен лимит HTTP-запросов на бесплатном плане ngrok.

## ✅ Решения

### 1. Cloudflare Tunnel (Рекомендуется - БЕСПЛАТНО, без лимитов)

#### Установка:
```bash
# Windows: скачайте с https://github.com/cloudflare/cloudflared/releases
# Или через Chocolatey:
choco install cloudflared

# Или через npm:
npm install -g cloudflared
```

#### Использование:
```bash
# Запустите сервер на порту 3002
npm start

# В другом терминале запустите Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3002
```

#### Результат:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-name.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

✅ **Преимущества:**
- Полностью бесплатно
- Без лимитов на запросы
- HTTPS автоматически
- Работает стабильно

---

### 2. localtunnel (Бесплатно, простой)

#### Установка:
```bash
npm install -g localtunnel
```

#### Использование:
```bash
# Запустите сервер
npm start

# В другом терминале
lt --port 3002
```

#### Результат:
```
your url is: https://random-name.loca.lt
```

---

### 3. localhost.run (Бесплатно, через SSH)

#### Использование:
```bash
# Если у вас установлен SSH (обычно есть на Linux/Mac)
ssh -R 80:localhost:3002 ssh.localhost.run

# Windows: используйте WSL или Git Bash
```

---

### 4. serveo.net (Бесплатно, через SSH)

```bash
ssh -R 80:localhost:3002 serveo.net
```

---

### 5. Обновить план ngrok (Платно)

Если хотите остаться на ngrok:
1. Перейдите на https://dashboard.ngrok.com/billing
2. Обновите план до **Starter** ($8/месяц) или выше
3. Получите больше лимитов

---

### 6. Подождать сброса лимита ngrok

Бесплатный план ngrok сбрасывает лимиты:
- **Раз в месяц** (обычно 1-го числа)
- Или через **24 часа** после превышения (зависит от типа лимита)

---

## 🚀 Рекомендуемое решение: Cloudflare Tunnel

Создайте файл `start-cloudflare.bat` для Windows:

```batch
@echo off
echo Starting server...
start cmd /k "npm start"
timeout /t 3
echo Starting Cloudflare Tunnel...
start cmd /k "cloudflared tunnel --url http://localhost:3002"
echo.
echo Server and tunnel starting...
echo Check the Cloudflare window for your HTTPS URL
pause
```

Или добавьте в `package.json`:

```json
{
  "scripts": {
    "tunnel": "cloudflared tunnel --url http://localhost:3002"
  }
}
```

Затем запустите:
```bash
npm start
# В другом терминале:
npm run tunnel
```

---

## 📝 Обновление Telegram Mini App URL

После получения нового URL (например, от Cloudflare Tunnel):

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/mybots`
3. Выберите вашего бота
4. Выберите "Bot Settings" → "Menu Button"
5. Введите новый URL: `https://ваш-url.trycloudflare.com/TGminiapp.html`
6. Сохраните

---

## ⚠️ Важно

- **Cloudflare Tunnel** - лучший выбор (бесплатно, без лимитов)
- **localtunnel** - простой, но может быть медленнее
- **ngrok** - удобный, но есть лимиты на бесплатном плане

---

## 🔧 Быстрый старт с Cloudflare

1. Установите Cloudflare Tunnel:
   ```bash
   # Windows: скачайте cloudflared.exe с GitHub
   # Или через npm:
   npm install -g cloudflared
   ```

2. Запустите сервер:
   ```bash
   npm start
   ```

3. Запустите туннель:
   ```bash
   cloudflared tunnel --url http://localhost:3002
   ```

4. Скопируйте URL и обновите в BotFather

✅ Готово! Теперь у вас есть бесплатный HTTPS туннель без лимитов!
