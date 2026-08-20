# 🐛 Отладка Mobile BRAND Menu

## Инструкция для проверки

Я добавил подробную отладку в код. Давайте проверим, что именно не работает.

---

## 🔍 Шаг 1: Откройте консоль браузера

1. Нажмите **F12** (или Ctrl+Shift+I)
2. Перейдите на вкладку **Console**
3. Очистите консоль (кнопка 🚫 или Ctrl+L)

---

## 🔍 Шаг 2: Перезагрузите страницу

1. Нажмите **Ctrl + Shift + R** (перезагрузка с очисткой кэша)
2. В консоли должны появиться сообщения:

### Ожидаемые сообщения при загрузке:

```
✅ "Mobile BRAND menu toggle initialized"
✅ "Found X focus-toggle elements"
✅ "Loaded X brands into mobile menu"
```

### Если НЕ появилось "Mobile BRAND menu toggle initialized":
**Проблема:** Element #brandMenuToggle не найден в DOM

**Решение:**
- Проверьте, что в HTML есть `<a id="brandMenuToggle">`
- Проверьте, что скрипт загружается после HTML

---

## 🔍 Шаг 3: Откройте мобильное меню

1. Уменьшите окно браузера (< 768px) или включите Device Toolbar (Ctrl+Shift+M)
2. Кликните на кнопку меню **☰**
3. Мобильное меню должно открыться

---

## 🔍 Шаг 4: Кликните на BRAND

1. В мобильном меню кликните на **BRAND**
2. В консоли должны появиться:

```
✅ "Mobile BRAND clicked, toggling active state"
✅ "Mobile BRAND is now: OPEN"
```

### Если сообщения НЕ появились:
**Проблема:** Обработчик клика не работает

**Проверьте в консоли:**
```javascript
// Проверка элемента:
document.getElementById('brandMenuToggle')

// Если null - элемент не найден!
```

### Если dropdown не раскрылся:
**Проблема:** CSS стили не работают

**Проверьте в Elements tab:**
```html
<!-- Должно быть: -->
<li class="mobile-menu-item has-dropdown active">
```

**Если нет класса 'active' - JavaScript не работает**
**Если есть класс 'active', но dropdown не показан - CSS проблема**

---

## 🔍 Шаг 5: Кликните на BRANDS

1. После того как BRAND раскрылся, кликните на **BRANDS**
2. В консоли должны появиться:

```
✅ "Focus-toggle 0 clicked" (или другой номер)
✅ "Expandable item is now: EXPANDED"
```

### Если список брендов не показался:

**Проверьте в Elements tab:**
```html
<!-- Должно быть: -->
<li class="mobile-dropdown-item expandable expanded">
```

**Если нет класса 'expanded' - JavaScript не сработал**
**Если есть, но список не виден - проверьте CSS**

---

## 🔍 Шаг 6: Проверьте CSS

В Elements tab → Computed styles:

### Для dropdown:
```css
.mobile-dropdown-menu {
    display: none;  /* До клика */
}

.has-dropdown.active .mobile-dropdown-menu {
    display: block;  /* После клика */
}
```

### Для nested:
```css
.mobile-dropdown-nested {
    display: none;  /* До клика */
}

.expandable.expanded .mobile-dropdown-nested {
    display: block;  /* После клика */
}
```

---

## 🐛 Возможные проблемы и решения

### Проблема 1: Элемент не найден

**Симптом:**
```
⚠️ "Mobile BRAND menu elements not found"
```

**Решение:**
- Убедитесь, что HTML содержит `<a id="brandMenuToggle">`
- Проверьте, что скрипт загружается после HTML (в конце body)

---

### Проблема 2: Клик не работает

**Симптом:**
- Нет сообщений в консоли при клике
- Dropdown не раскрывается

**Решение:**
```javascript
// Вручную в консоли:
const el = document.getElementById('brandMenuToggle');
el.addEventListener('click', (e) => {
    console.log('Manual click handler works!');
    e.target.closest('.mobile-menu-item').classList.toggle('active');
});
```

---

### Проблема 3: CSS не применяется

**Симптом:**
- Класс 'active' добавляется, но dropdown не показан

**Решение:**
```javascript
// Проверьте в консоли:
const item = document.querySelector('.mobile-menu-item.has-dropdown.active');
const dropdown = item.querySelector('.mobile-dropdown-menu');
const styles = window.getComputedStyle(dropdown);
console.log('Display:', styles.display);  // Должно быть 'block'
```

---

### Проблема 4: Конфликт с другими скриптами

**Симптом:**
- Код должен работать, но не работает

**Решение:**
- Проверьте, нет ли ошибок в консоли выше
- Проверьте, что другие скрипты не переопределяют обработчики

---

## 📝 Быстрая проверка

Выполните в консоли:

```javascript
// 1. Проверка элементов
console.log('brandMenuToggle:', document.getElementById('brandMenuToggle'));
console.log('mobileBrandsList:', document.getElementById('mobileBrandsList'));

// 2. Ручное открытие
const brandItem = document.querySelector('.mobile-menu-item.has-dropdown');
if (brandItem) {
    brandItem.classList.add('active');
    console.log('Manually added active class');
}

// 3. Проверка CSS
const dropdown = document.querySelector('.mobile-dropdown-menu');
console.log('Dropdown display:', window.getComputedStyle(dropdown).display);
```

---

## 🔄 Следующие шаги

### Если проблема не решена:

1. **Скопируйте все сообщения из консоли**
2. **Сделайте скриншот Elements tab**
3. **Отправьте информацию**

### Временное решение:

Если ничего не помогает, можно временно использовать прямую ссылку:
```html
<li class="mobile-menu-item">
    <a href="brand.html" class="mobile-menu-link">
        BRAND
    </a>
</li>
```

---

## 💡 Ожидаемый вывод в консоли

### При загрузке страницы:
```
Mobile BRAND menu toggle initialized
Found 2 focus-toggle elements
Loaded 5 brands into mobile menu
```

### При клике на BRAND:
```
Mobile BRAND clicked, toggling active state
Mobile BRAND is now: OPEN
```

### При клике на BRANDS:
```
Focus-toggle 1 clicked
Expandable item is now: EXPANDED
```

---

## 🎉 После успешной отладки

Когда найдете проблему и исправите, удалите лишние `console.log` из кода для production.
