# 📱 Настройка Telegram Mini App URL

## 🎯 Что указать в BotFather

В BotFather нужно отправить **URL конкретной страницы Mini App**, например:

```
https://ваш-домен.com/TGminiapp.html
```

### Примеры:

**Для локальной разработки (с ngrok):**
```
https://abc123.ngrok.io/TGminiapp.html
```

**Для продакшена:**
```
https://yourdomain.com/TGminiapp.html
```

## ✅ Работа одновременно: сайт + Mini App

**Да, это абсолютно возможно!** Один сервер может обслуживать:

1. ✅ **Обычный веб-сайт** - `index.html`, `shop-all.html`, категории и т.д.
2. ✅ **Telegram Mini App** - `TGminiapp.html`

Все файлы находятся в **одной папке** и работают одновременно!

## 📁 Структура файлов

```
проект/
├── index.html              ← Обычный сайт (главная)
├── shop-all.html           ← Обычный сайт (каталог)
├── category-*.html         ← Обычный сайт (категории)
├── TGminiapp.html   ← Telegram Mini App (для бота)
├── telegram-webapp.js      ← Скрипт для Telegram API
├── telegram-miniapp.css    ← Стили для Mini App
├── telegram-miniapp-loader.js ← Загрузка товаров
├── server.js               ← Общий сервер для всего
└── ... (остальные файлы)
```

## 🔧 Как это работает

### 1. Сервер обслуживает все файлы

```javascript
// server.js обслуживает все статические файлы
app.use(express.static(__dirname));

// Обычный сайт открывается по:
// https://ваш-домен.com/index.html
// https://ваш-домен.com/shop-all.html

// Mini App открывается по:
// https://ваш-домен.com/TGminiapp.html
```

### 2. Разные маршруты для разных целей

- **Пользователи заходят на сайт** → видят `index.html` (обычный сайт)
- **Telegram бот открывает Mini App** → BotFather направляет на `TGminiapp.html`

### 3. Общие ресурсы

Оба используют:
- ✅ Один и тот же API (`/api/products`, `/api/product/:id`)
- ✅ Одну базу данных товаров (`products.json`)
- ✅ Одни и те же изображения (`/uploads/`)
- ✅ Общие стили и скрипты (где нужно)

## 🚀 Быстрая настройка

### Шаг 1: Запустите сервер

```bash
npm start
# Сервер работает на http://localhost:3002
```

### Шаг 2: Настройте ngrok (для локальной разработки)

```bash
ngrok http 3002
```

Вы получите URL вида:
```
https://abc123def456.ngrok.io
```

### Шаг 3: Укажите URL в BotFather

Отправьте BotFather:
```
https://abc123def456.ngrok.io/TGminiapp.html
```

**Важно:** Указывайте полный путь к файлу `TGminiapp.html`, а не просто домен!

## 📝 Пример настройки в BotFather

1. Откройте [@BotFather](https://t.me/BotFather)
2. Выполните `/myapps`
3. Выберите вашего бота
4. Выполните `/newapp` или выберите существующий Mini App
5. Когда BotFather спросит:
   ```
   Send me the Mini App URL
   ```
   Отправьте:
   ```
   https://ваш-домен.com/TGminiapp.html
   ```

## ✅ Проверка работы

### Проверка обычного сайта:
1. Откройте `https://ваш-домен.com/index.html`
2. Должен открыться обычный сайт

### Проверка Mini App:
1. Откройте вашего бота в Telegram
2. Нажмите на кнопку меню или кнопку Mini App
3. Должно открыться приложение `TGminiapp.html`

## 🔍 Важные моменты

### 1. HTTPS обязателен
Telegram Mini App работает **только с HTTPS**. Для локальной разработки используйте ngrok или аналог.

### 2. Полный путь к файлу
Указывайте полный путь:
- ✅ **Правильно:** `https://domain.com/TGminiapp.html`
- ❌ **Неправильно:** `https://domain.com/`

### 3. Один сервер = все работает
Не нужно настраивать отдельные серверы! Один `server.js` обслуживает всё:
- Обычный сайт
- Telegram Mini App
- API endpoints

## 🎯 Резюме

**Что указать в BotFather:**
```
https://ваш-домен.com/TGminiapp.html
```

**Можно ли в одной папке:**
✅ **ДА!** Один сервер, одна папка, всё работает одновременно!

**Структура:**
- `index.html` - для обычного сайта
- `TGminiapp.html` - для Telegram Mini App
- `server.js` - общий сервер для всего
