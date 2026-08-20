# 📱 Telegram Mini App - Инструкция по настройке

## 🎯 Описание

Telegram Mini App - это мобильное приложение для Telegram, созданное на основе существующего сайта C.P. Company. Приложение адаптировано для работы внутри Telegram с использованием Telegram Web App API.

## 📁 Файлы

- **TGminiapp.html** - Главная страница приложения
- **telegram-webapp.js** - Интеграция с Telegram Web App API
- **telegram-miniapp.css** - Стили для Telegram Mini App
- **telegram-miniapp-loader.js** - Загрузка и отображение товаров

## 🚀 Быстрый старт

### 1. Настройка токена бота

1. Скопируйте файл `telegram-bot-config.example.json` в `telegram-bot-config.json`:
   ```bash
   cp telegram-bot-config.example.json telegram-bot-config.json
   ```

2. Откройте `telegram-bot-config.json` и вставьте ваш токен бота:
   ```json
   {
     "botToken": "8020232690:AAGuWewUrxjbKfI2rERdImewYMN4FSZ9x9Q",
     "telegramUsername": "your_telegram_username",
     "messageTemplate": "Здравствуйте! Заинтересовал данный товар: {productLink}"
   }
   ```

3. Убедитесь, что файл `telegram-bot-config.json` добавлен в `.gitignore` (уже добавлен)

### 2. Настройка Bot в Telegram

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Используйте существующего бота или создайте нового командой `/newbot`
3. Если создаете нового - получите токен бота и вставьте его в `telegram-bot-config.json`
4. Выполните команду `/newapp` и выберите вашего бота
5. Заполните информацию о Mini App:
   - **Title**: Kontora Store
   - **Description**: Интернет-магазин одежды и аксессуаров
   - **Photo**: Загрузите логотип (512x512px)
   - **Web App URL**: `https://ваш-домен.com/TGminiapp.html`
   - **Short Name**: `kontorastore`

### 2. Настройка домена

Ваш сайт должен быть доступен по HTTPS. Telegram Mini App работает только с HTTPS.

**Для локальной разработки:**
```bash
# Используйте ngrok или аналог
ngrok http 3000
# Используйте полученный HTTPS URL в BotFather
```

**Для продакшена:**
- Настройте SSL сертификат на вашем домене
- Убедитесь, что сайт доступен по HTTPS

### 3. Настройка сервера

Убедитесь, что сервер запущен и доступен:
```bash
npm start
# Сервер должен быть на https://ваш-домен.com
```

### 4. Проверка работы

1. Откройте вашего бота в Telegram
2. Нажмите на кнопку меню (три линии) или на кнопку Mini App
3. Приложение должно открыться в Telegram

## 🔧 Конфигурация

### Telegram Web App API

Приложение автоматически определяет, запущено ли оно в Telegram, и использует соответствующий API:

```javascript
// В Telegram
if (window.Telegram && window.Telegram.WebApp) {
    // Используется Telegram Web App API
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.ready();
}

// В обычном браузере
// Используется обычный веб-интерфейс
```

### Тема приложения

Приложение автоматически адаптируется под тему Telegram (светлая/темная):

```javascript
// Применение темы
const themeParams = tg.themeParams;
document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
```

## 📱 Функции Telegram Mini App

### Доступные функции:

1. **Haptic Feedback** - Тактильная обратная связь
   ```javascript
   telegramWebApp.hapticFeedback('impact');
   ```

2. **Main Button** - Главная кнопка действия
   ```javascript
   telegramWebApp.showMainButton('Добавить в корзину', () => {
       // Действие
   });
   ```

3. **Back Button** - Кнопка назад
   ```javascript
   telegramWebApp.showBackButton();
   ```

4. **Share** - Поделиться товаром
   ```javascript
   telegramWebApp.shareProduct(product);
   ```

5. **Open Link** - Открытие ссылок
   ```javascript
   telegramWebApp.openLink('https://example.com');
   ```

6. **User Data** - Данные пользователя Telegram
   ```javascript
   const user = telegramWebApp.getUserData();
   console.log(user.first_name, user.username);
   ```

## 🎨 Адаптация стилей

Стили автоматически адаптируются под тему Telegram:

```css
:root {
    --tg-bg: var(--tg-theme-bg-color, #ffffff);
    --tg-text: var(--tg-theme-text-color, #000000);
    --tg-primary: var(--tg-theme-button-color, #0088cc);
}
```

## 📦 Структура приложения

```
TGminiapp.html
├── Header (логотип и меню)
├── Main Content
│   ├── Секция "Обновление"
│   ├── Секция "Верхняя одежда"
│   ├── Секция "Кроссовки"
│   ├── Секция "Штаны"
│   └── Секция "Аксессуары"
└── Bottom Navigation
    ├── Главная
    ├── Каталог
    ├── Корзина
    ├── Избранное
    └── Профиль
```

## 🔌 API Интеграция

Приложение использует существующие API endpoints:

- `GET /api/products` - Получить все товары
- `GET /api/product/:id` - Получить товар по ID

## 🛠️ Отладка

### В Telegram:

1. Откройте бота в Telegram
2. Откройте приложение
3. Используйте встроенную консоль разработчика Telegram (если доступна)
4. Проверьте логи в консоли браузера через десктопную версию Telegram

### В браузере:

1. Откройте `TGminiapp.html` напрямую в браузере
2. Приложение работает в режиме обычного веб-сайта
3. Используйте DevTools для отладки

## 📝 Дополнительные настройки

### Настройка Bot Commands

В BotFather выполните:
```
/setcommands
```
И добавьте команды:
```
start - Начать работу с ботом
catalog - Открыть каталог
cart - Открыть корзину
help - Помощь
```

### Настройка меню бота

```
/setmenubutton
```
Выберите вашего бота и добавьте:
- **Button text**: Открыть магазин
- **URL**: `https://ваш-домен.com/TGminiapp.html`

## ✅ Чеклист перед публикацией

- [ ] HTTPS настроен и работает
- [ ] Telegram Bot создан в BotFather
- [ ] Mini App подключен к боту
- [ ] Все ссылки работают
- [ ] API endpoints доступны
- [ ] Тестирование в Telegram (iOS и Android)
- [ ] Тестирование в десктопной версии Telegram
- [ ] Проверка адаптивности под разные размеры экранов

## 🐛 Решение проблем

### Приложение не открывается в Telegram

1. Проверьте, что URL указан правильно в BotFather
2. Убедитесь, что сайт доступен по HTTPS
3. Проверьте, что сервер запущен

### Товары не загружаются

1. Проверьте API endpoints
2. Проверьте CORS настройки на сервере
3. Проверьте консоль браузера на наличие ошибок

### Стили не применяются

1. Убедитесь, что `telegram-miniapp.css` подключен
2. Проверьте, что Telegram Web App SDK загружается правильно
3. Проверьте переменные CSS для темы

## 📚 Полезные ссылки

- [Telegram Web App API Documentation](https://core.telegram.org/bots/webapps)
- [BotFather](https://t.me/BotFather)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 💡 Примеры использования

### Добавление товара в корзину

```javascript
// При открытии страницы товара
telegramWebApp.showMainButton('Добавить в корзину', () => {
    addToCart(productId);
    telegramWebApp.hapticFeedback('success');
    telegramWebApp.hideMainButton();
});
```

### Навигация с кнопкой назад

```javascript
// При переходе на страницу товара
telegramWebApp.showBackButton();
telegramWebApp.BackButton.onClick(() => {
    window.history.back();
});
```

### Получение данных пользователя

```javascript
const user = telegramWebApp.getUserData();
if (user) {
    console.log(`Привет, ${user.first_name}!`);
}
```
