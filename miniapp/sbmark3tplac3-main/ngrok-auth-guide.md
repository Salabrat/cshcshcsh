# 🔐 Настройка авторизации ngrok

## Проблема
```
ERROR: authentication failed: Usage of ngrok requires a verified account and authtoken.
```

## ✅ Решение: Получите authtoken

### Шаг 1: Регистрация на ngrok.com

1. Откройте https://dashboard.ngrok.com/signup
2. Зарегистрируйтесь (можно через GitHub/Google)
3. После регистрации вы автоматически получите authtoken

### Шаг 2: Получение authtoken

1. Зайдите на https://dashboard.ngrok.com/get-started/your-authtoken
2. Скопируйте ваш authtoken (выглядит как: `2abc123xyz...`)

### Шаг 3: Авторизация

Откройте терминал и выполните:

```bash
ngrok config add-authtoken ВАШ_AUTHTOKEN
```

**Пример:**
```bash
ngrok config add-authtoken 2abc123xyz456def789ghi012jkl345mno678pqr
```

### Шаг 4: Проверка

После авторизации вы увидите:
```
Authtoken saved to configuration file: C:\Users\YourName\AppData\Local\ngrok\ngrok.yml
```

## 🚀 Теперь можно запускать

После авторизации снова запустите:

```bash
npm run ngrok
```

Или вручную:

```bash
ngrok http 3002
```

## 💡 Альтернатива: Локальная разработка без ngrok

Если не хотите регистрироваться в ngrok, можно использовать:

### Вариант 1: localtunnel (без регистрации)
```bash
npm install -g localtunnel
lt --port 3002
```

### Вариант 2: serveo (SSH туннель)
```bash
ssh -R 80:localhost:3002 serveo.net
```

### Вариант 3: Cloudflare Tunnel
```bash
# Требует Cloudflare аккаунт, но бесплатный
cloudflared tunnel --url http://localhost:3002
```

## ⚡ Быстрый способ (если срочно нужно протестировать)

Можно временно использовать любой из альтернатив выше, или просто зарегистрироваться в ngrok (это бесплатно и занимает 2 минуты).
