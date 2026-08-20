# ✨ SHOP Mega Menu Redesign

## Что сделано

Полностью переделан SHOP mega menu в стильном минималистичном дизайне с двумя вкладками: **MAIN COLLECTION** и **BRAND**.

---

## 🎨 Новый дизайн

### Вкладки (Tabs):
- **MAIN COLLECTION** - категории товаров
- **BRAND** - список брендов
- Черный фон для вкладок
- Активная вкладка выделена (#000)
- Разделитель "+" между вкладками

### Категории:
- Одноколоночная структура
- Стрелка ">" перед каждой категорией
- Минималистичный список
- Hover эффекты с плавной анимацией

---

## 📋 Структура меню

### MAIN COLLECTION Tab:

```
┌──────────────────────────┐
│ MAIN COLLECTION + BRAND  │ ← Вкладки (черный фон)
├──────────────────────────┤
│ SHOP ALL                 │ ← Основная ссылка
├──────────────────────────┤
│ CLOTHING                 │ ← Заголовок секции
│                          │
│ > КУРТКИ                 │
│ > ОБУВЬ                  │
│ > ПАЛЬТО                 │
│ > КОФТЫ                  │
│ > ОЧКИ                   │
│ > ШТАНЫ                  │
│ > ГОЛОВНОЙ УБОР          │
└──────────────────────────┘
```

### BRAND Tab:

```
┌──────────────────────────┐
│ MAIN COLLECTION + BRAND  │ ← Вкладки
├──────────────────────────┤
│ BRANDS                   │ ← Заголовок
│                          │
│ > C.P. COMPANY           │
│ > STONE ISLAND           │
│ > BARBERRY               │
│ > DIOR                   │
│ > CALVIN KLEIN           │
└──────────────────────────┘
```

---

## 🔧 Технические детали

### Созданные файлы:

#### 1. `mega-menu-tabs.js`
Новый JavaScript модуль для:
- Переключения между вкладками
- Загрузки брендов из API
- Динамического наполнения Brand tab

**Функции:**
```javascript
- initMegaMenuTabs()      // Инициализация переключения вкладок
- loadBrandsIntoShopMenu() // Загрузка брендов
```

---

### Обновленные файлы:

#### 1. `index.html`
**Изменения в HTML структуре:**

**Раньше:**
```html
<div class="mega-menu-tabs">
    <button class="mega-menu-tab active" data-tab="main">
        MAIN COLLECTION
    </button>
</div>
```

**Теперь:**
```html
<div class="mega-menu-tabs">
    <button class="mega-menu-tab active" data-tab="main-collection">
        MAIN COLLECTION
    </button>
    <button class="mega-menu-tab" data-tab="brand-collection">
        BRAND
    </button>
</div>
```

**Новая структура категорий:**
```html
<div class="mega-menu-single-column">
    <div class="mega-menu-section">
        <a href="shop-all.html" class="mega-menu-link">SHOP ALL</a>
    </div>
    
    <div class="mega-menu-section">
        <h4 class="mega-menu-heading">CLOTHING</h4>
        <ul class="mega-menu-list">
            <li>
                <a href="category-jackets.html" class="mega-menu-link">
                    <span class="arrow">></span> КУРТКИ
                </a>
            </li>
            <!-- ... другие категории ... -->
        </ul>
    </div>
</div>
```

---

#### 2. `styles.css`

**Новые CSS классы:**

```css
/* Одноколоночное меню */
.mega-menu-single-column {
    padding: 30px 40px;
    max-width: 400px;
}

/* Секция меню */
.mega-menu-section {
    margin-bottom: 30px;
}

/* Заголовок секции */
.mega-menu-heading {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    border-bottom: 1px solid #f0f0f0;
}

/* Ссылка в меню */
.mega-menu-link {
    display: flex;
    align-items: center;
    padding: 12px 0;
    font-size: 12px;
    transition: all 0.2s ease;
}

/* Стрелка перед категорией */
.mega-menu-link .arrow {
    margin-right: 12px;
    font-size: 14px;
    opacity: 0.6;
}

/* Hover эффект */
.mega-menu-link:hover {
    padding-left: 10px;
    border-bottom: 1px solid #e0e0e0;
}

.mega-menu-link:hover .arrow {
    opacity: 1;
}
```

**Обновленные стили вкладок:**

```css
.mega-menu-tabs {
    background-color: #1a1a1a;  /* Черный фон */
}

.mega-menu-tab {
    color: #666;  /* Серый текст */
    letter-spacing: 1.2px;
}

.mega-menu-tab.active {
    background-color: #000;  /* Чисто черный для активной */
    color: #fff;  /* Белый текст */
}

/* Разделитель "+" */
.mega-menu-tab:not(:last-child)::after {
    content: '+';
    color: #666;
}
```

---

## 🎯 Функциональность

### Переключение вкладок:
1. Клик на **MAIN COLLECTION** → показываются категории
2. Клик на **BRAND** → показываются бренды
3. Плавная анимация переключения

### Загрузка брендов:
- Автоматически загружаются из `/api/brands`
- Только активные бренды (`isActive: true`)
- Динамически добавляются в Brand tab
- Формат: `> BRAND NAME`

---

## 📱 Адаптивность

- **Desktop:** 420px максимальная ширина меню
- **Tablet:** 85vw ширина
- **Mobile:** Скрыто (используется mobile menu)

---

## 🎨 Стилистика

### Цвета:
- **Вкладки фон:** `#1a1a1a` (темно-серый)
- **Активная вкладка:** `#000` (черный)
- **Текст вкладок:** `#666` (серый) / `#fff` (белый для активной)
- **Заголовки:** `#999` (светло-серый)
- **Ссылки:** `var(--primary-color)` (основной цвет сайта)

### Типографика:
- **Вкладки:** 11px, uppercase, letter-spacing: 1.2px
- **Заголовки:** 11px, uppercase, letter-spacing: 1px
- **Ссылки:** 12px, uppercase, letter-spacing: 0.5px

### Эффекты:
- **Hover на вкладках:** Изменение фона на `#222`
- **Hover на ссылках:** Сдвиг на 10px вправо, появление нижней границы
- **Hover на стрелке:** Увеличение opacity с 0.6 до 1

---

## 🔍 Как использовать

### Открытие меню:
1. Наведите курсор на **SHOP** в header
2. Или кликните на **SHOP**
3. Mega menu откроется с активной вкладкой MAIN COLLECTION

### Переключение вкладок:
1. Кликните на **BRAND** для просмотра брендов
2. Кликните на **MAIN COLLECTION** для возврата к категориям

### Навигация:
- Клик на категорию → переход на страницу категории
- Клик на бренд → переход на страницу бренда
- Клик на **SHOP ALL** → переход на страницу всех товаров

---

## 🐛 Отладка

### Консоль браузера (F12):

Проверьте сообщения:
```
✅ "Mega menu tabs initialized"
✅ "Loaded X brands into SHOP menu"
✅ "Switched to tab: brand-collection"
```

### Если не работает:

1. **Вкладки не переключаются:**
   - Проверьте, подключен ли `mega-menu-tabs.js`
   - Проверьте консоль на ошибки

2. **Бренды не загружаются:**
   - Проверьте, работает ли `/api/brands`
   - Проверьте, есть ли активные бренды в БД

3. **Стили не применяются:**
   - Очистите кэш браузера (`Ctrl + Shift + Delete`)
   - Перезагрузите страницу с очисткой (`Ctrl + Shift + R`)

---

## 📊 Производительность

- ✅ GPU acceleration включен
- ✅ Debouncing для событий
- ✅ Оптимизированные transitions
- ✅ Кэширование DOM элементов

---

## ✨ Преимущества нового дизайна

1. **Минималистичный** - чистый и современный
2. **Интуитивный** - легко понять структуру
3. **Быстрый** - плавные анимации 60 FPS
4. **Удобный** - две вкладки для разделения контента
5. **Стильный** - черный фон вкладок, стрелки перед категориями

---

## 🎉 Готово!

SHOP mega menu теперь выглядит стильно и современно с вкладками MAIN COLLECTION и BRAND!

**Файлы:**
- ✅ `index.html` - обновлена HTML структура
- ✅ `styles.css` - добавлены новые стили
- ✅ `mega-menu-tabs.js` - новый функционал переключения
- ✅ `SHOP-MEGA-MENU-REDESIGN.md` - документация
