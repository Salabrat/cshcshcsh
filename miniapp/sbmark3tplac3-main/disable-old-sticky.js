// Disable old sticky controls to prevent conflicts
(function() {
    'use strict';
    
    // Отключаем старую функцию initStickyShopControls
    if (typeof window.initStickyShopControls !== 'undefined') {
        window.initStickyShopControls = function() {
            console.log('Old sticky controls disabled in favor of advanced animation');
        };
    }
    
    // Ждем загрузки DOM и переопределяем функцию
    document.addEventListener('DOMContentLoaded', function() {
        // Переопределяем глобальную функцию
        window.initStickyShopControls = function() {
            console.log('Old sticky controls disabled');
        };
        
        // Удаляем старые классы sticky если они есть
        const shopControls = document.querySelector('.shop-controls');
        if (shopControls) {
            shopControls.classList.remove('sticky');
            shopControls.style.position = '';
            shopControls.style.top = '';
            shopControls.style.transform = '';
        }
        
        // Удаляем старые placeholder элементы
        const oldPlaceholders = document.querySelectorAll('.shop-controls-placeholder');
        oldPlaceholders.forEach(el => {
            if (el && !el.classList.contains('advanced-placeholder')) {
                el.remove();
            }
        });
    });
    
    console.log('Old sticky controls disabler loaded');
})();
