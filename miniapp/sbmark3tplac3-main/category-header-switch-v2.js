/**
 * Category Header Switch V2 - улучшенная версия с точным позиционированием
 */

(function() {
    'use strict';
    
    // Включаем скрипт для категорий main collection (category-*.html)
    // Отключаем только для brand.html, где используется simple-sticky-swap.js
    const pathname = window.location.pathname || '';
    const isBrandPage = pathname.includes('brand.html');
    
    if (isBrandPage) {
        console.log('Category Header Switch V2 disabled on brand page (using simple-sticky-swap instead)');
        return;
    }
    
    function initHeaderSwitch() {
        // Проверяем, что мы на нужной странице (категории main collection)
        const pathname = window.location.pathname;
        const isTargetPage = (pathname.includes('category-') || pathname.includes('shop-all')) && pathname.includes('.html');
        
        if (!isTargetPage) {
            console.log('Category Header Switch V2: not a category page, skipping');
            return;
        }
        
        console.log('Header switch V2 initializing...');
        
        // Находим элементы
        const topBar = document.querySelector('.top-bar');
        const header = document.querySelector('.header');
        const shopControls = document.querySelector('.shop-controls');
        
        if (!shopControls || !header) {
            console.warn('Required elements not found, retrying...');
            setTimeout(initHeaderSwitch, 100);
            return;
        }
        
        // Создаем обертку для фиксированного позиционирования если её нет
        let fixedWrapper = document.querySelector('.fixed-controls-wrapper');
        if (!fixedWrapper) {
            fixedWrapper = document.createElement('div');
            fixedWrapper.className = 'fixed-controls-wrapper';
            fixedWrapper.style.cssText = `
                position: fixed;
                top: -100px;
                left: 0;
                right: 0;
                width: 100%;
                z-index: 9999;
                transition: top 0.3s ease-out;
                pointer-events: none;
            `;
            document.body.appendChild(fixedWrapper);
        }
        
        // Клонируем shop-controls для фиксированной версии
        const fixedControls = shopControls.cloneNode(true);
        fixedControls.className = 'shop-controls-fixed';
        fixedControls.style.cssText = `
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-bottom: 1px solid #e0e0e0;
            padding: 15px 20px;
            pointer-events: auto;
        `;
        fixedWrapper.appendChild(fixedControls);
        
        // Синхронизируем события между оригинальными и клонированными контролами
        const syncControls = () => {
            // Синхронизация фильтров
            const originalFilter = shopControls.querySelector('#filterBtn');
            const fixedFilter = fixedControls.querySelector('#filterBtn');
            
            if (originalFilter && fixedFilter) {
                fixedFilter.onclick = (e) => {
                    e.preventDefault();
                    originalFilter.click();
                };
            }
            
            // Синхронизация view controls
            const originalViews = shopControls.querySelectorAll('.view-btn');
            const fixedViews = fixedControls.querySelectorAll('.view-btn');
            
            fixedViews.forEach((btn, index) => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    if (originalViews[index]) {
                        originalViews[index].click();
                    }
                };
            });
        };
        
        syncControls();
        
        // Функция синхронизации счетчика товаров
        const syncProductCounter = () => {
            const originalCounter = shopControls.querySelector('.product-count');
            const fixedCounter = fixedControls.querySelector('.product-count');
            
            if (originalCounter && fixedCounter) {
                // Копируем текст из оригинала в клон
                fixedCounter.textContent = originalCounter.textContent;
                // Копируем атрибут data-category если есть
                if (originalCounter.hasAttribute('data-category')) {
                    fixedCounter.setAttribute('data-category', originalCounter.getAttribute('data-category'));
                }
            }
        };
        
        // Наблюдатель за изменениями счетчика в оригинале
        const originalCounter = shopControls.querySelector('.product-count');
        if (originalCounter) {
            const counterObserver = new MutationObserver(() => {
                syncProductCounter();
            });
            
            counterObserver.observe(originalCounter, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }
        
        // Синхронизируем счетчик при инициализации
        syncProductCounter();
        
        // Также синхронизируем счетчик при обновлении через глобальные функции
        const originalUpdateProductCounter = window.updateProductCounter;
        if (originalUpdateProductCounter) {
            window.updateProductCounter = function(...args) {
                const result = originalUpdateProductCounter.apply(this, args);
                setTimeout(syncProductCounter, 100);
                return result;
            };
        }
        
        // Слушаем события обновления счетчика
        document.addEventListener('productCounterUpdated', syncProductCounter);
        
        // Периодическая синхронизация (на случай если MutationObserver не сработал)
        setInterval(syncProductCounter, 1000);
        
        // Синхронизация после загрузки продуктов
        setTimeout(() => {
            syncProductCounter();
            // Также обновляем через все счетчики на странице
            const allCounters = document.querySelectorAll('.product-count');
            allCounters.forEach(counter => {
                const category = counter.getAttribute('data-category');
                if (category) {
                    const originalCounter = shopControls.querySelector(`.product-count[data-category="${category}"]`);
                    if (originalCounter && originalCounter.textContent) {
                        counter.textContent = originalCounter.textContent;
                    }
                }
            });
        }, 500);
        
        // Переменные для отслеживания
        const topBarHeight = topBar ? topBar.offsetHeight : 0;
        const headerHeight = header.offsetHeight;
        const totalHeaderHeight = topBarHeight + headerHeight;
        const shopControlsTop = shopControls.getBoundingClientRect().top + window.pageYOffset;
        
        let lastScrollY = 0;
        let isHeaderHidden = false;
        let ticking = false;
        
        // Функция обработки скролла
        function updateScroll() {
            const currentScrollY = window.pageYOffset;
            const scrollDiff = currentScrollY - lastScrollY;
            
            // Вычисляем точку, когда низ header достигает верха фильтр-бара
            const switchPoint = shopControlsTop - totalHeaderHeight;
            
            // Скролл вниз - скрываем header только когда доходим до фильтр-бара
            if (scrollDiff > 0 && currentScrollY > 80) {
                // Скрываем headers только когда достигли точки переключения (достигли фильтр-бара)
                if (currentScrollY >= switchPoint - 10) {
                    if (!isHeaderHidden) {
                        isHeaderHidden = true;
                        
                        // Скрываем headers
                        if (topBar) {
                            topBar.style.cssText = `
                                position: fixed;
                                top: 0;
                                left: 0;
                                right: 0;
                                z-index: 1002;
                                transform: translateY(-100%);
                                transition: transform 0.3s ease-out;
                            `;
                        }
                        
                        header.style.cssText = `
                            position: fixed;
                            top: ${topBarHeight}px;
                            left: 0;
                            right: 0;
                            z-index: 1001;
                            transform: translateY(-${headerHeight + topBarHeight}px);
                            transition: transform 0.3s ease-out;
                        `;
                    }
                    
                    // Показываем фиксированные controls
                    fixedWrapper.style.top = '0';
                    shopControls.style.opacity = '0';
                }
            }
            // Скролл вверх - показываем header обратно
            else if (scrollDiff < 0) {
                const switchPoint = shopControlsTop - totalHeaderHeight;
                
                // Показываем headers когда скроллим вверх и еще не достигли точки переключения
                if (currentScrollY < switchPoint - 10) {
                    // Показываем headers
                    if (isHeaderHidden) {
                        isHeaderHidden = false;
                        
                        if (topBar) {
                            topBar.style.transform = 'translateY(0)';
                        }
                        header.style.transform = 'translateY(0)';
                        
                        setTimeout(() => {
                            if (!isHeaderHidden) {
                                if (topBar) {
                                    topBar.style.cssText = '';
                                }
                                header.style.cssText = '';
                            }
                        }, 300);
                    }
                    
                    // Скрываем фиксированные controls
                    fixedWrapper.style.top = '-100px';
                    shopControls.style.opacity = '1';
                }
            }
            
            // В самом верху
            if (currentScrollY <= 5) {
                isHeaderHidden = false;
                
                if (topBar) {
                    topBar.style.cssText = '';
                }
                header.style.cssText = '';
                
                fixedWrapper.style.top = '-100px';
                shopControls.style.opacity = '1';
            }
            
            lastScrollY = currentScrollY;
            ticking = false;
        }
        
        // Оптимизированный обработчик
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(updateScroll);
                ticking = true;
            }
        }
        
        window.addEventListener('scroll', onScroll, { passive: true });
        
        // Начальная проверка
        updateScroll();
        
        console.log('Header switch V2 initialized');
    }
    
    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderSwitch);
    } else {
        initHeaderSwitch();
    }
})();
