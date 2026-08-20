const fs = require('fs');
const path = require('path');

// Список файлов для обновления
const files = [
    'category-jackets.html',
    'category-shoes.html',
    'category-coats.html',
    'category-sweaters.html',
    'category-glasses.html',
    'category-pants.html',
    'category-hats.html',
    'category-kurtki.html',
    'category-obuv.html'
];

// Старый HTML код
const oldHTML = `                <div class="shop-actions">
                    <button class="filters-btn">
                        FILTERS
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="4" y1="21" x2="4" y2="14"></line>
                            <line x1="4" y1="10" x2="4" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12" y2="3"></line>
                            <line x1="20" y1="21" x2="20" y2="16"></line>
                            <line x1="20" y1="12" x2="20" y2="3"></line>
                            <line x1="1" y1="14" x2="7" y2="14"></line>
                            <line x1="9" y1="8" x2="15" y2="8"></line>
                            <line x1="17" y1="16" x2="23" y2="16"></line>
                        </svg>
                    </button>`;

// Новый HTML код
const newHTML = `                <div class="shop-actions">
                    <div class="filter-dropdown">
                        <button class="filters-btn" id="filterBtn">
                            FILTERS
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div class="filter-menu" id="filterMenu">
                            <div class="filter-option" data-sort="price-asc">
                                <span>Цена: по возрастанию</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="18 15 12 9 6 15"></polyline>
                                </svg>
                            </div>
                            <div class="filter-option" data-sort="price-desc">
                                <span>Цена: по убыванию</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                            <div class="filter-option" data-sort="name-asc">
                                <span>Название: А-Я</span>
                            </div>
                            <div class="filter-option" data-sort="name-desc">
                                <span>Название: Я-А</span>
                            </div>
                        </div>
                    </div>`;

// Обновляем каждый файл
files.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Заменяем старый код на новый
        if (content.includes('filters-btn')) {
            content = content.replace(oldHTML, newHTML);
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Updated ${file}`);
        } else {
            console.log(`⚠ No filters-btn found in ${file}`);
        }
    } catch (error) {
        console.error(`✗ Error updating ${file}:`, error.message);
    }
});

console.log('\nДобавьте стили в styles.css и JavaScript в script.js для работы фильтров!');
