# ✅ Удаление кнопки Theme Toggle

## Что сделано

Удалена кнопка переключения темы (Theme Toggle) из header-actions на всех основных страницах.

---

## 📝 Изменения

### Файлы:
- **`index.html`** - удалена кнопка `<button class="theme-toggle" id="themeToggle">`
- **`shop-all.html`** - удалена кнопка `<button class="theme-toggle" id="themeToggle">`

### HTML структура:

**Раньше:**
```html
<div class="header-actions">
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">
        <svg>...</svg>
    </button>
    <button class="header-icon search-btn">...</button>
    ...
</div>
```

**Теперь:**
```html
<div class="header-actions">
    <button class="header-icon search-btn">...</button>
    ...
</div>
```

---

## ✅ Готово!

Кнопка Theme Toggle удалена из header-actions. Теперь в header остаются только кнопки поиска и мобильного меню.
