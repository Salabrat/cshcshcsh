# 🚀 Быстрая настройка ngrok для Telegram Mini App

## 📥 Шаг 1: Установка ngrok

### Windows:
1. Скачайте ngrok с https://ngrok.com/download
2. Распакуйте `ngrok.exe` в папку проекта или добавьте в PATH

### Альтернатива (через npm):
```bash
npm install -g ngrok
```

## ⚙️ Шаг 2: Авторизация (опционально, но рекомендуется)

1. Зарегистрируйтесь на https://dashboard.ngrok.com/signup
2. Получите authtoken в личном кабинете
3. Выполните:
```bash
ngrok config add-authtoken ВАШ_ТОКЕН
```

**Без авторизации:** ngrok будет работать, но URL будет меняться при каждом перезапуске.

## 🎯 Шаг 3: Запуск

### Вариант 1: Автоматический (рекомендуется)

Просто запустите:
```bash
npm run ngrok
```

Скрипт автоматически:
- ✅ Запустит сервер
- ✅ Запустит ngrok
- ✅ Покажет URL для BotFather
- ✅ Сохранит URL в файл `ngrok-url.txt`

### Вариант 2: Вручную

**Терминал 1 - Сервер:**
```bash
npm start
```

**Терминал 2 - ngrok:**
```bash
ngrok http 3002
```

## 📋 Шаг 4: Получение URL

После запуска вы увидите что-то вроде:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3002
```

**URL для BotFather:**
```
https://abc123.ngrok.io/TGminiapp.html
```

## ✅ Шаг 5: Отправка в BotFather

1. Откройте [@BotFather](https://t.me/BotFather)
2. Выполните `/myapps`
3. Выберите вашего бота
4. Когда спросит URL, отправьте:
   ```
   https://abc123.ngrok.io/TGminiapp.html
   ```
   (замените `abc123.ngrok.io` на ваш URL)

## 🔧 Если ngrok не найден

Если получили ошибку "ngrok not found":

### Windows:
1. Положите `ngrok.exe` в папку проекта
2. Или добавьте путь в переменную PATH
3. Или укажите полный путь:
   ```bash
   NGROK_PATH=C:\path\to\ngrok.exe node start-ngrok.js
   ```

### Проверка установки:
```bash
ngrok version
```

Если команда работает - всё готово!

## 💡 Полезные команды

**Просмотр активных туннелей:**
```bash
ngrok http 3002
# Откроется веб-интерфейс на http://127.0.0.1:4040
```

**Остановка:**
Нажмите `Ctrl+C` в терминале

## ⚠️ Важно

- **Бесплатный ngrok:** URL меняется при каждом перезапуске
- **Платный ngrok:** Можно зафиксировать URL
- **Для продакшена:** Используйте реальный домен с HTTPS

## 🎉 Готово!

После настройки:
1. ✅ Сервер работает на `http://localhost:3002`
2. ✅ ngrok создал туннель `https://ваш-url.ngrok.io`
3. ✅ Mini App доступен по `https://ваш-url.ngrok.io/TGminiapp.html`
4. ✅ URL отправлен в BotFather

Теперь можно тестировать Mini App в Telegram! 🚀
