# 🚀 Настройка и запуск сервера

## 📋 Требования

- Node.js (версия 14 или выше)
- npm (обычно устанавливается вместе с Node.js)

## 🔧 Установка

1. **Откройте терминал** в папке проекта `c:\Users\namename\Documents\SITEcpcompany`

2. **Установите зависимости:**
   ```bash
   npm install
   ```
   Это установит:
   - Express (веб-сервер)
   - CORS (для кросс-доменных запросов)
   - Multer (для загрузки изображений)
   - Body-parser (для обработки JSON)
   - Nodemon (для автоматической перезагрузки сервера при изменениях)

## 🎯 Запуск сервера

### Обычный запуск:
```bash
npm start
```
Сервер запустится на `http://localhost:3000`

### Режим разработки (с автоматической перезагрузкой):
```bash
npm run dev
```

## 🔄 Переключение на серверную версию

Чтобы сайт начал использовать сервер вместо localStorage:

1. **Замените скрипты в HTML файлах категорий:**
   
   Найдите эти строки:
   ```html
   <script src="database.js"></script>
   <script src="product-manager.js"></script>
   <script src="product-loader.js"></script>
   ```
   
   Замените на:
   ```html
   <script src="database-api.js"></script>
   <script src="product-manager-api.js"></script>
   <script src="product-loader-api.js"></script>
   ```

2. **Обновите все 9 страниц категорий:**
   - category-jackets.html
   - category-shoes.html
   - category-coats.html
   - category-sweaters.html
   - category-glasses.html
   - category-pants.html
   - category-hats.html
   - category-kurtki.html
   - category-obuv.html

## 📁 Структура данных

Товары сохраняются в файл `products.json` в корне проекта:
```json
{
  "lastId": 0,
  "products": {
    "jackets": [],
    "shoes": [],
    "coats": [],
    ...
  }
}
```

Изображения сохраняются в папку `uploads/`

## 🌐 API Endpoints

После запуска сервера доступны следующие API endpoints:

- `GET /api/products` - получить все товары
- `GET /api/products/:category` - получить товары категории
- `GET /api/product/:id` - получить один товар
- `POST /api/products/:category` - добавить товар
- `PUT /api/product/:id` - обновить товар
- `DELETE /api/product/:id` - удалить товар
- `POST /api/upload` - загрузить изображение
- `DELETE /api/products/all` - удалить все товары

## ✅ Проверка работы

1. **Запустите сервер:**
   ```bash
   npm start
   ```

2. **Откройте сайт:**
   ```
   http://localhost:3000
   ```

3. **Проверьте консоль браузера** (F12):
   - Должно быть сообщение: "Connected to backend server"
   - Не должно быть ошибок подключения

4. **Добавьте товар через админку:**
   - Войдите как админ (admin@admin.ru / admin)
   - Перейдите в категорию
   - Нажмите "Добавить товар"
   - Заполните форму и сохраните

5. **Проверьте файл products.json:**
   - Откройте файл в редакторе
   - Должен появиться добавленный товар

## ⚠️ Возможные проблемы

### Порт 3000 занят:
Измените порт в `server.js`:
```javascript
const PORT = 3001; // или любой другой свободный порт
```

И в `database-api.js`:
```javascript
this.apiUrl = 'http://localhost:3001/api';
```

### Ошибка CORS:
Убедитесь, что открываете сайт через `http://localhost:3000`, а не через `file://`

### Товары не сохраняются:
1. Проверьте, что сервер запущен
2. Проверьте консоль сервера на ошибки
3. Убедитесь, что файл products.json не открыт в другой программе

## 🎉 Готово!

Теперь все товары будут сохраняться в файл `products.json` и будут видны в preview вашего IDE!
