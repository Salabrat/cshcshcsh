// Console Fix - Команды для консоли браузера

console.log('%c🔧 CONSOLE FIX LOADED', 'background: red; color: white; font-size: 16px; padding: 5px;');
console.log('Доступные команды:');
console.log('  checkHero() - проверить состояние hero секции');
console.log('  fixHero() - восстановить тексты');
console.log('  addButtons() - добавить кнопки редактирования');

// Проверка состояния
window.checkHero = function() {
    console.log('=== ПРОВЕРКА HERO СЕКЦИИ ===');
    
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    
    console.log('1. Элементы:');
    console.log('   Hero title:', heroTitle ? '✅ Найден' : '❌ НЕ НАЙДЕН');
    console.log('   Hero subtitle:', heroSubtitle ? '✅ Найден' : '❌ НЕ НАЙДЕН');
    
    if (heroTitle) {
        console.log('2. Hero title:');
        console.log('   HTML:', heroTitle.innerHTML);
        console.log('   Text:', heroTitle.textContent);
        console.log('   Display:', getComputedStyle(heroTitle).display);
        console.log('   Visibility:', getComputedStyle(heroTitle).visibility);
        console.log('   Opacity:', getComputedStyle(heroTitle).opacity);
        console.log('   Color:', getComputedStyle(heroTitle).color);
    }
    
    if (heroSubtitle) {
        console.log('3. Hero subtitle:');
        console.log('   Text:', heroSubtitle.textContent);
        console.log('   Display:', getComputedStyle(heroSubtitle).display);
        console.log('   Visibility:', getComputedStyle(heroSubtitle).visibility);
        console.log('   Opacity:', getComputedStyle(heroSubtitle).opacity);
        console.log('   Color:', getComputedStyle(heroSubtitle).color);
    }
    
    console.log('4. Админ статус:');
    console.log('   adminLoggedIn:', localStorage.getItem('adminLoggedIn'));
    console.log('   username:', localStorage.getItem('username'));
};

// Восстановление текстов
window.fixHero = function() {
    console.log('Восстанавливаю тексты...');
    
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    
    if (heroTitle) {
        heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
        heroTitle.style.cssText = 'visibility: visible !important; display: block !important; opacity: 1 !important; color: white !important; font-size: 72px !important; font-weight: 700 !important; position: relative !important; z-index: 10 !important;';
        console.log('✅ Hero title восстановлен');
    }
    
    if (heroSubtitle) {
        heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
        heroSubtitle.style.cssText = 'visibility: visible !important; display: block !important; opacity: 1 !important; color: white !important; font-size: 16px !important; position: relative !important; z-index: 10 !important;';
        console.log('✅ Hero subtitle восстановлен');
    }
};

// Добавление кнопок
window.addButtons = function() {
    console.log('Добавляю кнопки редактирования...');
    
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    
    function addBtn(element, name) {
        if (!element) return;
        
        // Удаляем старую кнопку
        const oldBtn = element.querySelector('.console-edit-btn');
        if (oldBtn) oldBtn.remove();
        
        element.style.position = 'relative';
        
        const btn = document.createElement('button');
        btn.className = 'console-edit-btn';
        btn.innerHTML = '✏️ EDIT';
        btn.style.cssText = 'position: absolute; top: 0; right: 0; background: red; color: white; border: none; padding: 10px; cursor: pointer; z-index: 99999; font-weight: bold;';
        
        btn.onclick = function() {
            const newText = prompt('Edit ' + name + ':', element.innerHTML || element.textContent);
            if (newText) {
                if (name === 'title') {
                    element.innerHTML = newText;
                } else {
                    element.textContent = newText;
                }
            }
        };
        
        element.appendChild(btn);
        console.log('✅ Кнопка добавлена к ' + name);
    }
    
    addBtn(heroTitle, 'title');
    addBtn(heroSubtitle, 'subtitle');
};

// Автоматическая проверка при загрузке
setTimeout(() => {
    console.log('%c🔍 Автоматическая проверка...', 'background: blue; color: white; padding: 3px;');
    window.checkHero();
}, 1000);
