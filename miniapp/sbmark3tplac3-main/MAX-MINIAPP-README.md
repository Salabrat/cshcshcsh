# 📱 MAX Mini App - Инструкция по настройке

## 🎯 Описание

MAX Mini App - это мобильное приложение для мессенджера MAX (ру), созданное на основе существующего сайта C.P. Company. Приложение адаптировано для работы внутри MAX с использованием MAX Web App API (совместимого с Telegram Web App API).

## 📁 Файлы

- **MAXminiapp.html** - Главная страница приложения
- **max-webapp.js** - Интеграция с MAX Web App API
- **TGminiapp.css** - Стили для MAX Mini App (переиспользуются стили Telegram)
- **max-bot-config.json** - Конфигурация бота с токеном

## 🚀 Быстрый старт

### 1. Настройка токена бота

Токен уже настроен в файле `max-bot-config.json`:
```json
{
  "botToken": "f9LHodD0cOJoFZB4Aoe4oyAgMW6g4P4ToSKa3FAqRPgoWWLipVoVCVJwhJ4u3yAzbpxwRilAnwRIvv4NsX7H",
  "maxUsername": "your_max_username",
  "messageTemplate": "Здравствуйте! Заинтересовал данный товар: {productLink}"
}
```

**Важно:** Замените `your_max_username` на ваш username в MAX.

### 2. Настройка Bot в MAX

1. Откройте панель разработчика MAX (аналог BotFather)
2. Используйте существующего бота или создайте нового
3. Если создаете нового - получите токен бота и обновите `max-bot-config.json`
4. Создайте Mini App и выберите вашего бота
5. Заполните информацию о Mini App:
   - **Title**: Kontora Store
   - **Description**: Интернет-магазин одежды и аксессуаров
   - **Photo**: Загрузите логотип (512x512px)
   - **Web App URL**: `https://ваш-домен.com/MAXminiapp.html`
   - **Short Name**: `kontorastore`

### 3. Настройка домена

Ваш сайт должен быть доступен по HTTPS. MAX Mini App работает только с HTTPS.

**Для локальной разработки:**
```bash
# Используйте ngrok или аналог
ngrok http 3000
# Используйте полученный HTTPS URL в настройках MAX
```

**Для продакшена:**
- Настройте SSL сертификат на вашем домене
- Убедитесь, что сайт доступен по HTTPS

### 4. Настройка сервера

Убедитесь, что сервер запущен и доступен:
```bash
npm start
# Сервер должен быть на https://ваш-домен.com
```

### 5. Проверка работы

1. Откройте вашего бота в MAX
2. Нажмите на кнопку меню или на кнопку Mini App
3. Приложение должно открыться в MAX

## 🔧 Конфигурация

### MAX Web App API

Приложение автоматически определяет, запущено ли оно в MAX, и использует соответствующий API:

```javascript
// В MAX
if (window.Max && window.Max.WebApp) {
    // Используется MAX Web App API
    const max = window.Max.WebApp;
    max.expand();
    max.ready();
}

// В обычном браузере
// Используется обычный веб-интерфейс
```

### Тема приложения

Приложение автоматически адаптируется под тему MAX (светлая/темная):

```javascript
// Применение темы
const themeParams = max.themeParams;
document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
```

## 📱 Функции MAX Mini App

### Доступные функции:

1. **Haptic Feedback** - Тактильная обратная связь
   ```javascript
   maxWebApp.hapticFeedback('impact');
   ```

2. **Main Button** - Главная кнопка действия
   ```javascript
   maxWebApp.showMainButton('Добавить в корзину', () => {
       // Действие
   });
   ```

3. **Back Button** - Кнопка назад
   ```javascript
   maxWebApp.showBackButton();
   ```

4. **Share** - Поделиться товаром
   ```javascript
   maxWebApp.shareProduct(product);
   ```

5. **Open Link** - Открытие ссылок
   ```javascript
   maxWebApp.openLink('https://example.com');
   ```

6. **User Data** - Данные пользователя MAX
   ```javascript
   const user = maxWebApp.getUserData();
   console.log(user.first_name, user.username);
   ```

## 🎨 Адаптация стилей

Стили автоматически адаптируются под тему MAX:

```css
:root {
    --tg-bg: var(--tg-theme-bg-color, #ffffff);
    --tg-text: var(--tg-theme-text-color, #000000);
    --tg-primary: var(--tg-theme-button-color, #0088cc);
}
```

## 📦 Структура приложения

```
MAXminiapp.html
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

### В MAX:

1. Откройте бота в MAX
2. Откройте приложение
3. Используйте встроенную консоль разработчика MAX (если доступна)
4. Проверьте логи в консоли браузера через десктопную версию MAX

### В браузере:

1. Откройте `MAXminiapp.html` напрямую в браузере
2. Приложение работает в режиме обычного веб-сайта
3. Используйте DevTools для отладки

## 📝 Дополнительные настройки

### Настройка Bot Commands

В панели разработчика MAX добавьте команды:
```
start - Начать работу с ботом
catalog - Открыть каталог
cart - Открыть корзину
help - Помощь
```

### Настройка меню бота

Добавьте кнопку меню:
- **Button text**: Открыть магазин
- **URL**: `https://ваш-домен.com/MAXminiapp.html`

## ✅ Чеклист перед публикацией

- [ ] HTTPS настроен и работает
- [ ] MAX Bot создан в панели разработчика
- [ ] Mini App подключен к боту
- [ ] Все ссылки работают
- [ ] API endpoints доступны
- [ ] Тестирование в MAX (iOS и Android)
- [ ] Тестирование в десктопной версии MAX
- [ ] Проверка адаптивности под разные размеры экранов

## 🐛 Решение проблем

### Приложение не открывается в MAX

1. Проверьте, что URL указан правильно в настройках MAX
2. Убедитесь, что сайт доступен по HTTPS
3. Проверьте, что сервер запущен

### Товары не загружаются

1. Проверьте API endpoints
2. Проверьте CORS настройки на сервере
3. Проверьте консоль браузера на наличие ошибок

### Стили не применяются

1. Убедитесь, что `TGminiapp.css` подключен
2. Проверьте, что MAX Web App SDK загружается правильно
3. Проверьте переменные CSS для темы

## 📚 Полезные ссылки

- [MAX Web App API Documentation](https://max.ru/docs/webapps)
- [Панель разработчика MAX](https://max.ru/developers)

## 💡 Примеры использования

### Добавление товара в корзину

```javascript
// При открытии страницы товара
maxWebApp.showMainButton('Добавить в корзину', () => {
    addToCart(productId);
    maxWebApp.hapticFeedback('success');
    maxWebApp.hideMainButton();
});
```

### Навигация с кнопкой назад

```javascript
// При переходе на страницу товара
maxWebApp.showBackButton();
maxWebApp.BackButton.onClick(() => {
    window.history.back();
});
```

### Получение данных пользователя

```javascript
const user = maxWebApp.getUserData();
if (user) {
    console.log(`Привет, ${user.first_name}!`);
}
```

## 🔗 Совместимость с Telegram

MAX Mini App использует тот же API, что и Telegram Web App, поэтому:
- Все существующие скрипты Telegram работают без изменений
- Стили полностью совместимы
- Функционал идентичен
- Можно использовать одни и те же компоненты

## 🚀 Одновременная работа с Telegram и MAX

Вы можете использовать оба мини-приложения одновременно:
- `TGminiapp.html` - для Telegram
- `MAXminiapp.html` - для MAX

Оба используют:
- Один и тот же API
- Одну базу данных товаров
- Одни и те же изображения
- Общие стили (TGminiapp.css)
