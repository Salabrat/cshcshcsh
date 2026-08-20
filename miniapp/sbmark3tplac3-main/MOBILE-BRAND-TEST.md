# 🧪 Тест Mobile BRAND Menu

## Что исправлено

Добавлены недостающие классы для корректной работы mobile BRAND dropdown.

---

## 🔧 Исправления

### 1. Добавлены классы в HTML

**Раньше:**
```html
<li>  <!-- Нет классов! -->
    <a href="#" class="mobile-dropdown-link focus-toggle">
        BRANDS
    </a>
    <ul class="mobile-dropdown-nested" id="mobileBrandsList">
        ...
    </ul>
</li>
```

**Теперь:**
```html
<li class="mobile-dropdown-item expandable">  <!-- Добавлены классы! -->
    <a href="#" class="mobile-dropdown-link focus-toggle">
        BRANDS
    </a>
    <ul class="mobile-dropdown-nested" id="mobileBrandsList">
        ...
    </ul>
</li>
```

**Зачем нужны классы:**
- `mobile-dropdown-item` - базовый стиль
- `expandable` - для CSS правила `.expandable.expanded .mobile-dropdown-nested { display: block; }`

---

### 2. Обновлен JavaScript

**Обработчик для всех focus-toggle:**

```javascript
// Раньше - только один элемент:
const focusToggle = document.querySelector('.focus-toggle');

// Теперь - все элементы:
const focusToggles = document.querySelectorAll('.focus-toggle');
focusToggles.forEach(function(toggle) {
    toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        let expandableItem = this.closest('.expandable');
        if (!expandableItem) {
            expandableItem = this.closest('li');
        }
        
        if (expandableItem) {
            expandableItem.classList.toggle('expanded');
        }
    });
});
```

---

## 📱 Как это работает

### Шаг 1: Открытие мобильного меню
```
Клик на ☰
  ↓
Мобильное меню открывается
  ↓
Показывается:
- SHOP
- BRAND
```

### Шаг 2: Клик на BRAND
```
Клик на "BRAND"
  ↓
brandMenuToggle обработчик
  ↓
.mobile-menu-item получает класс 'active'
  ↓
CSS: .has-dropdown.active .mobile-dropdown-menu { display: block; }
  ↓
Показывается dropdown с "BRANDS ▼"
```

### Шаг 3: Клик на BRANDS
```
Клик на "BRANDS"
  ↓
focus-toggle обработчик
  ↓
<li class="expandable"> получает класс 'expanded'
  ↓
CSS: .expandable.expanded .mobile-dropdown-nested { display: block; }
  ↓
Показывается список брендов:
- C.P. COMPANY
- STONE ISLAND
- и т.д.
```

---

## 🎯 CSS правила

### Для первого уровня (BRAND):
```css
.has-dropdown.active .mobile-dropdown-menu {
    display: block;
}
```

### Для второго уровня (список брендов):
```css
.expandable.expanded .mobile-dropdown-nested {
    display: block;
}
```

### Для анимации стрелок:
```css
.has-dropdown.active .dropdown-arrow {
    transform: rotate(180deg);
}

.expandable.expanded .focus-arrow {
    transform: rotate(180deg);
}
```

---

## 🔍 Пошаговый тест

### 1. Откройте сайт на мобильном:
```
http://localhost:3002
```
Или уменьшите окно браузера до <768px

### 2. Откройте мобильное меню:
- Кликните на ☰ (hamburger icon)
- Должно открыться боковое меню

### 3. Кликните на BRAND:
- Стрелка должна повернуться вниз (▼)
- Должен появиться "BRANDS ▼"

### 4. Кликните на BRANDS:
- Стрелка должна повернуться вниз (▼)
- Должен появиться список:
  ```
  > C.P. COMPANY
  > STONE ISLAND
  > BARBERRY
  > DIOR
  > CALVIN KLEIN
  ```

### 5. Кликните на любой бренд:
- Переход на страницу бренда ✅

---

## 🐛 Отладка

### Консоль (F12):

**Проверьте сообщения:**
```
✅ "Loaded X brands into mobile menu"
```

**Проверьте элементы:**
```javascript
// Должны существовать:
document.getElementById('brandMenuToggle')
document.getElementById('mobileBrandsList')

// После клика на BRAND:
document.querySelector('.mobile-menu-item.has-dropdown.active')

// После клика на BRANDS:
document.querySelector('.expandable.expanded')
```

**Проверьте классы:**
```
1. Клик на BRAND:
   <li class="mobile-menu-item has-dropdown active">

2. Клик на BRANDS:
   <li class="mobile-dropdown-item expandable expanded">
```

---

## 📊 Структура DOM

```html
<ul class="mobile-menu-list">
    <!-- SHOP -->
    <li class="mobile-menu-item has-dropdown active">
        <a href="#" id="shopMenuToggle">SHOP</a>
        <ul class="mobile-dropdown-menu">
            <li>SHOP ALL</li>
            <li class="mobile-dropdown-item expandable expanded">
                <a href="#" class="focus-toggle">CATEGORIES</a>
                <ul class="mobile-dropdown-nested">...</ul>
            </li>
        </ul>
    </li>
    
    <!-- BRAND -->
    <li class="mobile-menu-item has-dropdown active">
        <a href="#" id="brandMenuToggle">BRAND</a>
        <ul class="mobile-dropdown-menu">
            <li class="mobile-dropdown-item expandable expanded">
                <a href="#" class="focus-toggle">BRANDS</a>
                <ul class="mobile-dropdown-nested" id="mobileBrandsList">
                    <li><a href="...">C.P. COMPANY</a></li>
                    <li><a href="...">STONE ISLAND</a></li>
                    ...
                </ul>
            </li>
        </ul>
    </li>
</ul>
```

---

## ⚠️ Важно

### Обновлены только 2 страницы:
- ✅ `index.html`
- ✅ `category-jackets.html`

### Нужно обновить остальные:
- ⚠️ 10 остальных категорий
- ⚠️ shop-all.html
- ⚠️ brand.html
- ⚠️ product.html

---

## 🎉 Результат

После этих исправлений BRAND в мобильном меню:
- ✅ Раскрывается при клике
- ✅ Показывает список брендов
- ✅ Стрелки поворачиваются
- ✅ Навигация работает

**Файлы изменены:**
- ✅ `index.html` - добавлены классы
- ✅ `category-jackets.html` - добавлены классы
- ✅ `script.js` - обновлен обработчик focus-toggle
- ✅ `MOBILE-BRAND-TEST.md` - документация для тестирования
