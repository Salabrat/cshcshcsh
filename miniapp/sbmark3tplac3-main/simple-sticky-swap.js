// Simple Sticky Swap - Простая и надежная анимация замены меню и фильтров
(function() {
    'use strict';
    
    // Определяем, на какой странице мы находимся
    let path = '';
    try {
        if (typeof window !== 'undefined' && window.location && window.location.pathname) {
            path = window.location.pathname;
        }
    } catch (e) {}

    const isCategoryPage = path.includes('category-') || path.includes('shop-all');
    const isBrandPage = path.includes('brand.html');

    // На страницах категорий main collection отключаем simple-sticky-swap,
    // чтобы использовать category-header-switch-v2.js
    // Но на brand.html оставляем simple-sticky-swap активным
    if (isCategoryPage && !isBrandPage) {
        console.log('Simple Sticky Swap: disabled on category pages (using category-header-switch-v2 instead)');
        return;
    }

    // Полностью отключаем все старые sticky функции на остальных страницах
    window.initStickyShopControls = function() {};
    window.smoothStickyControls = null;
    window.advancedStickyAnimation = null;
    window.fixedStickyAnimation = null;
    window.CategoryStickyNavigation = function() { return { init: function() {} }; };
    
    // Отключаем другие sticky скрипты
    if (window.CategoryStickyNavigation) {
        window.CategoryStickyNavigation.prototype.init = function() {};
    }
    
    // Флаг инициализации
    let isInitialized = false;
    
    // Конфигурация
    const CONFIG = {
        startScroll: 50,      // Когда начинать отслеживание взаимодействия (px)
        swapDistance: 150,    // Расстояние для полной замены (px)
        headerFadeStart: 100, // Когда header начинает исчезать
        controlsFixPoint: 120 // Когда controls становятся fixed
    };
    
    // Элементы
    let header = null;
    let controls = null;
    let placeholder = null;
    let topBar = null;
    let topBarHeight = 0;
    let fixedWrapper = null;
    let fixedControls = null;
    
    // Состояние
    let lastScroll = 0;
    let headerOriginalHeight = 0;
    let controlsOriginalTop = 0;
    let isSwapped = false;
    let isHeaderHidden = false;
    
    function init() {
        // Предотвращаем повторную инициализацию
        if (isInitialized) return;
        
        console.log('Инициализация simple-sticky-swap...');
        
        // БЕЗОПАСНО находим элементы с проверками
        try {
            header = document.querySelector('.header');
            if (!header) {
                // Пробуем альтернативные селекторы
                header = document.querySelector('.header-container') || document.querySelector('header');
            }
            
            // Также ищем top-bar, если он есть
            topBar = document.querySelector('.top-bar');
            if (topBar && !header) {
                header = topBar.closest('.header-container') || topBar.parentElement;
            }
            
            topBarHeight = topBar ? (topBar.offsetHeight || 0) : 0;
            
            console.log('Header найден:', header);
            
            controls = document.querySelector('.shop-controls');
            if (!controls) {
                // Пробуем альтернативные селекторы для фильтров
                controls = document.querySelector('.filter-bar') || document.querySelector('.filters');
            }
            console.log('Controls найден:', controls);
            
            // КРИТИЧЕСКАЯ ПРОВЕРКА - элементы обязательны
            if (!header || !controls) {
                console.warn('Simple Sticky Swap: Required elements not found - ОТКЛЮЧАЕМ СКРИПТ');
                console.warn('Header:', header, 'Controls:', controls);
                return;
            }
        } catch (err) {
            console.error('Ошибка при поиске элементов:', err);
            return;
        }
        
        // Удаляем старые классы и стили
        cleanupOldStyles();
        
        // Создаем placeholder
        createPlaceholder();
        
        // Создаем фиксированный wrapper для controls (как в SHOP)
        createFixedControlsWrapper();
        
        // Сохраняем исходные размеры
        saveOriginalDimensions();
        
        // Добавляем стили
        injectStyles();
        
        // Добавляем обработчик скролла
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        
        isInitialized = true;
        console.log('Simple Sticky Swap initialized');
        console.log('Header element:', header);
        console.log('Controls element:', controls);
        console.log('Original controls top:', controlsOriginalTop);
    }
    
    function cleanupOldStyles() {
        // Удаляем все старые sticky классы
        if (controls) {
            controls.classList.remove('sticky', 'fixed', 'swapped', 'swapping', 'filter-bar-sticky');
            controls.style.cssText = ''; // Полная очистка всех inline стилей
        }
        
        if (header) {
            header.classList.remove('sliding', 'hidden', 'navbar-hidden');
            header.style.cssText = ''; // Полная очистка всех inline стилей
        }
        
        // Отключаем все другие observers и события
        document.removeEventListener('scroll', window.otherStickyHandler || function(){});
        
        // Удаляем старые placeholder элементы
        document.querySelectorAll('.shop-controls-placeholder, .controls-placeholder, .controls-placeholder-fixed, .sentinel').forEach(el => {
            if (el) el.remove();
        });
        
        // Удаляем старые fixed-wrapper элементы
        document.querySelectorAll('.fixed-controls-wrapper').forEach(el => {
            if (el) el.remove();
        });
        
        // Удаляем старые стили
        const oldStyles = document.querySelectorAll('style[id*="sticky"], style[id*="category-navigation"]');
        oldStyles.forEach(style => {
            if (style.id !== 'simple-sticky-swap-styles') {
                style.remove();
            }
        });
    }
    
    function createPlaceholder() {
        try {
            if (!controls || !controls.parentNode) {
                console.warn('Не могу создать placeholder - controls не найден или нет родителя');
                return;
            }
            
            placeholder = document.createElement('div');
            placeholder.className = 'simple-controls-placeholder';
            placeholder.style.display = 'none';
            placeholder.style.height = '0';
            controls.parentNode.insertBefore(placeholder, controls.nextSibling);
            console.log('Placeholder создан успешно');
        } catch (err) {
            console.error('Ошибка создания placeholder:', err);
        }
    }
    
    function createFixedControlsWrapper() {
        // Создаем обертку для фиксированного позиционирования (как в SHOP)
        fixedWrapper = document.querySelector('.fixed-controls-wrapper');
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
        if (controls && !fixedWrapper.querySelector('.shop-controls-fixed')) {
            fixedControls = controls.cloneNode(true);
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
            syncControls();
        }
    }
    
    function syncControls() {
        if (!controls || !fixedControls) return;
        
        // Синхронизация фильтров
        const originalFilter = controls.querySelector('#filterBtn');
        const fixedFilter = fixedControls.querySelector('#filterBtn');
        
        if (originalFilter && fixedFilter) {
            fixedFilter.onclick = (e) => {
                e.preventDefault();
                originalFilter.click();
            };
        }
        
        // Синхронизация view controls
        const originalViews = controls.querySelectorAll('.view-btn');
        const fixedViews = fixedControls.querySelectorAll('.view-btn');
        
        fixedViews.forEach((btn, index) => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (originalViews[index]) {
                    originalViews[index].click();
                }
            };
        });
        
        // Синхронизация счетчика товаров
        const originalCounter = controls.querySelector('.product-count');
        const fixedCounter = fixedControls.querySelector('.product-count');
        
        if (originalCounter && fixedCounter) {
            const syncProductCounter = () => {
                fixedCounter.textContent = originalCounter.textContent;
                if (originalCounter.hasAttribute('data-category')) {
                    fixedCounter.setAttribute('data-category', originalCounter.getAttribute('data-category'));
                }
            };
            
            const counterObserver = new MutationObserver(syncProductCounter);
            counterObserver.observe(originalCounter, {
                childList: true,
                characterData: true,
                subtree: true
            });
            
            syncProductCounter();
            setInterval(syncProductCounter, 1000);
        }
    }
    
    function saveOriginalDimensions() {
        if (!header || !controls) {
            console.log('Elements not found, retrying...');
            setTimeout(saveOriginalDimensions, 200);
            return;
        }
        
        headerOriginalHeight = header.offsetHeight;
        const rect = controls.getBoundingClientRect();
        controlsOriginalTop = rect.top + window.pageYOffset;
        
        console.log('Saved dimensions:', {
            headerHeight: headerOriginalHeight,
            controlsTop: controlsOriginalTop
        });
        
        // Проверка корректности
        if (controlsOriginalTop <= 100 || headerOriginalHeight <= 0) {
            console.log('Invalid dimensions, retrying...');
            setTimeout(saveOriginalDimensions, 300);
            return;
        }
        
        console.log('Dimensions saved successfully');
    }
    
    // Интервал логирования, чтобы не захламлять консоль
    let lastLogTime = 0;
    const LOG_THROTTLE = 1000; // Логируем не чаще чем раз в секунду
    
    // Оптимизация скролла с requestAnimationFrame для плавной анимации
    let ticking = false;
    
    function handleScroll() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                processScroll();
                ticking = false;
            });
            ticking = true;
        }
    }
    
    function processScroll() {
        // Базовые проверки безопасности
        if (!header || !controls || !isInitialized) {
            return;
        }

        const scrollY = window.pageYOffset;
        const scrollDiff = scrollY - lastScroll;

        // Если по какой-то причине ещё не сохранили корректные размеры - пробуем ещё раз
        if (!controlsOriginalTop || controlsOriginalTop <= 0) {
            saveOriginalDimensions();
        }

        // Текущая высота header и эффективная высота для расчёта точки переключения
        const currentHeaderRect = header.getBoundingClientRect();
        const currentHeaderHeight = currentHeaderRect && currentHeaderRect.height ? currentHeaderRect.height : 0;
        const effectiveHeaderHeight = headerOriginalHeight || currentHeaderHeight || 0;

        const totalHeaderHeight = effectiveHeaderHeight + topBarHeight;
        const switchPoint = Math.max(0, controlsOriginalTop - totalHeaderHeight);

        // Скролл вниз - скрываем header только когда доходим до фильтр-бара (как в SHOP)
        if (scrollDiff > 0 && scrollY > 80) {
            // Скрываем headers только когда достигли точки переключения (достигли фильтр-бара)
            if (scrollY >= switchPoint - 10) {
                if (!isHeaderHidden) {
                    isHeaderHidden = true;
                    isSwapped = true;
                    
                    // Скрываем headers (как в SHOP)
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
                        transform: translateY(-${effectiveHeaderHeight + topBarHeight}px);
                        transition: transform 0.3s ease-out;
                    `;
                }
                
                // Показываем фиксированные controls
                if (fixedWrapper) {
                    fixedWrapper.style.top = '0';
                }
                if (controls) {
                    controls.style.opacity = '0';
                }
            }
        }
        // Скролл вверх - показываем header обратно
        else if (scrollDiff < 0) {
            // Показываем headers когда скроллим вверх и еще не достигли точки переключения
            if (scrollY < switchPoint - 10) {
                // Показываем headers
                if (isHeaderHidden) {
                    isHeaderHidden = false;
                    isSwapped = false;
                    
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
                if (fixedWrapper) {
                    fixedWrapper.style.top = '-100px';
                }
                if (controls) {
                    controls.style.opacity = '1';
                }
            }
        }
        
        // В самом верху
        if (scrollY <= 5) {
            isHeaderHidden = false;
            isSwapped = false;
            
            if (topBar) {
                topBar.style.cssText = '';
            }
            header.style.cssText = '';
            
            if (fixedWrapper) {
                fixedWrapper.style.top = '-100px';
            }
            if (controls) {
                controls.style.opacity = '1';
            }
        }
        
        lastScroll = scrollY;
    }
    
    function resetElements() {
        // Просто вызываем нашу новую функцию сброса
        resetAllStyles();
    }
    
    // НОВАЯ ФУНКЦИЯ: делает header sticky (всегда видимым сверху)
    function makeStickyHeader() {
        try {
            if (!header) return;
            
            isSwapped = false; // Еще не в компактном режиме
            
            const stickyTop = topBarHeight || 0;
            
            // Header остается sticky - всегда видим сверху, но с полной высотой
            header.style.cssText = `
                position: sticky !important;
                top: ${stickyTop}px !important;
                left: 0;
                right: 0;
                width: 100%;
                z-index: 1001;
                background: white;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            `;
            
            // В sticky режиме - скрываем только мега-меню, но не ограничиваем размеры
            const allMenus = header.querySelectorAll('.mega-menu, .mega-menu-content, .mega-menu-tab-content, #main-content');
            allMenus.forEach(menu => {
                menu.style.display = 'none'; // Просто скрываем мега-меню
            });
            
            // НЕ ограничиваем размеры навигационных элементов в sticky режиме
            const navElements = header.querySelectorAll('.header-wrapper, .main-nav, .nav-list');
            navElements.forEach(el => {
                if (el) {
                    el.style.height = '';
                    el.style.maxHeight = '';
                    el.style.overflow = '';
                }
            });
            
            header.classList.add('simple-sticky');
            header.classList.remove('simple-fixed');
            
            // Controls остаются в естественном положении
            if (controls) {
                controls.style.cssText = '';
                controls.style.position = '';
                controls.style.top = '';
                controls.classList.remove('simple-fixed', 'simple-sticky');
            }
            
            // Скрываем placeholder
            if (placeholder) {
                placeholder.style.display = 'none';
                placeholder.style.height = '0';
            }
            
            document.body.classList.remove('simple-swap-complete');
            document.body.classList.add('simple-sticky-active');
            
        } catch (err) {
            console.error('Ошибка в makeStickyHeader:', err);
        }
    }
    
    function resetAllStyles() {
        console.log('Сбрасываем все стили - БЕЗОПАСНО');
        isSwapped = false;
        isHeaderHidden = false;
        
        try {
            // БЕЗОПАСНЫЙ сброс header - возвращаем к ЕСТЕСТВЕННОМУ скроллингу
            if (header) {
                // Полностью сбрасываем все принудительные стили
                header.style.cssText = '';
                header.style.position = '';
                header.style.top = '';
                header.style.transform = '';
                header.style.transition = '';
                header.style.opacity = '1';
                header.classList.remove('simple-hidden', 'simple-sliding', 'simple-fixed');
            }
            
            // БЕЗОПАСНЫЙ сброс top-bar
            if (topBar) {
                topBar.style.cssText = '';
                topBar.style.position = '';
                topBar.style.top = '';
                topBar.style.transform = '';
                topBar.style.transition = '';
            }
            
            // БЕЗОПАСНЫЙ сброс controls - с проверками
            if (controls) {
                controls.style.cssText = '';
                controls.style.position = '';
                controls.style.top = '';
                controls.style.opacity = '1';
                controls.classList.remove('simple-fixed', 'simple-sticky');
            }
            
            // Скрываем фиксированные controls
            if (fixedWrapper) {
                fixedWrapper.style.top = '-100px';
            }
            
            // БЕЗОПАСНОЕ скрытие placeholder
            if (placeholder) {
                placeholder.style.display = 'none';
                placeholder.style.height = '0';
            }
            
            // Убираем классы с body
            document.body.classList.remove('simple-swap-active', 'simple-swap-complete');
            
        } catch (err) {
            console.error('Ошибка при сбросе стилей:', err);
        }
    }
    
    // Для совместимости со старым кодом сохраняем имена функций
    function performPushAnimation() {
        // Вызываем новую функцию
        fixElements(window.pageYOffset);
    }
    
    function completeSwap() {
        // Вызываем новую функцию
        fixElements(window.pageYOffset);
    }
    
    function performReverseAnimation() {
        // Вызываем новую функцию
        fixElements(window.pageYOffset);
    }
    
    function fixHeaderAtFilterBarPosition() {
        // Вызываем новую функцию
        fixElements(window.pageYOffset);
    }
    
    // ДУБЛИРУЮЩАЯСЯ ФУНКЦИЯ УДАЛЕНА - ИСПОЛЬЗУЕМ ЕДИНУЮ resetAllStyles
    
    // Функция больше не используется, логика перенесена в processScroll
    // Оставляем для совместимости со старым кодом
    function fixElements(scrollY) {
        // Логика теперь в processScroll
    }
    
    
    function handleResize() {
        // Пересчитываем размеры при изменении окна
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            topBarHeight = topBar.offsetHeight || 0;
        }
        if (!isSwapped) {
            saveOriginalDimensions();
        }
    }
    
    function injectStyles() {
        const styleId = 'simple-sticky-swap-styles';
        if (document.getElementById(styleId)) return;
        
        const css = `
            /* Simple Sticky Swap Styles */
            /* ГЛОБАЛЬНЫЕ ПРАВИЛА ДЛЯ HEADER */
            .header,
            .header-container,
            .header .menu-bar,
            .menu-bar,
            .top-bar {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                transition: none !important;
            }
            
            /* МЕГА-МЕНЮ СКРЫТО ТОЛЬКО В ФИКСИРОВАННОМ РЕЖИМЕ И ПО УМОЛЧАНИЮ */
            .mega-menu,
            .mega-menu-content,
            .mega-menu-columns,
            .mega-menu-tab-content,
            #main-content {
                display: none !important; /* По умолчанию мега-меню скрыто */
            }
            
            /* В ФИКСИРОВАННОМ РЕЖИМЕ - АГРЕССИВНОЕ СКРЫТИЕ */
            .header[style*="position: fixed"] .mega-menu,
            .header[style*="height: 60px"] .mega-menu,
            .header[style*="max-height: 60px"] .mega-menu,
            .header.simple-fixed .mega-menu,
            .header.simple-fixed .mega-menu-content,
            .header.simple-fixed .mega-menu-columns,
            .header.simple-fixed .mega-menu-tab-content,
            .header.simple-fixed #main-content {
                display: none !important;
                height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                opacity: 0 !important;
                visibility: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                z-index: -1 !important;
                transform: scale(0) !important;
            }
            
            /* РЕЖИМЫ HEADER */
            
            /* STICKY РЕЖИМ - header всегда видим, но естественной высоты */
            .header.simple-sticky,
            .header[style*="position: sticky"],
            body.simple-sticky-active .header {
                position: sticky !important;
                z-index: 1001 !important;
                background: white !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                /* НЕ ограничиваем высоту в sticky режиме */
            }
            
            /* ФИКСИРОВАННЫЙ КОМПАКТНЫЙ РЕЖИМ - при достижении фильтр-бара */
            .header.simple-fixed,
            .header-container.simple-fixed,
            body.simple-swap-complete .header,
            .header[style*="position: fixed"][style*="height: 60px"] {
                height: 60px !important;
                max-height: 60px !important;
                min-height: 60px !important;
                overflow: hidden !important;
            }
            
            /* МАКСИМАЛЬНО АГРЕССИВНО УБИРАЕМ ВСЕ МЕГА-МЕНЮ */
            .header.simple-fixed .mega-menu,
            .header-container.simple-fixed .mega-menu,
            body.simple-swap-complete .header .mega-menu,
            .header.simple-fixed .dropdown-menu,
            .header.simple-fixed .sub-menu,
            .simple-fixed .mega-menu-tab-content,
            .simple-fixed #main-content,
            .header[style*="position: fixed"] .mega-menu,
            .header[style*="position: fixed"] .dropdown,
            .header[style*="position: fixed"] .mega-menu-content,
            .header[style*="position: fixed"] .mega-menu-columns,
            .header[style*="position: fixed"] .mega-menu-column,
            .header[style*="position: fixed"] .mega-menu-tabs,
            .header[style*="position: fixed"] [id*="content"],
            .header[style*="height: 60px"] .mega-menu,
            .header[style*="height: 60px"] .mega-menu-content,
            .header[style*="height: 60px"] #main-content,
            .header[style*="height: 60px"] .mega-menu-tab-content {
                display: none !important;
                height: 0 !important;
                max-height: 0 !important;
                min-height: 0 !important;
                overflow: hidden !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                z-index: -1 !important;
                transform: scale(0) !important;
            }
            
            /* ПРИНУДИТЕЛЬНО ДЕЛАЕМ НАВИГАЦИЮ КОМПАКТНОЙ */
            .header.simple-fixed .nav-list,
            .header.simple-fixed .header-wrapper,
            .header.simple-fixed .logo,
            .header.simple-fixed .main-nav,
            .header[style*="position: fixed"] .nav-list,
            .header[style*="position: fixed"] .header-wrapper,
            .header[style*="position: fixed"] .logo,
            .header[style*="position: fixed"] .main-nav {
                display: flex !important;
                height: 60px !important;
                max-height: 60px !important;
                min-height: 60px !important;
                overflow: hidden !important;
                align-items: center !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            .header {
                /* Основные стили */
                position: relative;
                background: white;
                z-index: 98;
            }
            
            .header.simple-fixed,
            .header.simple-sliding {
                /* Стили для фиксированного состояния */
                background: white;
                width: 100%;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            
            .shop-controls {
                transition: none !important;
                will-change: auto;
                background: white;
            }
            
            .shop-controls.simple-sticky {
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            
            .shop-controls.simple-fixed {
                box-shadow: 0 2px 15px rgba(0,0,0,0.1);
                background: white;
                width: 100% !important;
            }
            
            /* Фиксированные состояния для эффекта вытеснения */
            .header[style*="position: fixed"],
            .shop-controls[style*="position: fixed"] {
                background: white !important;
                width: 100% !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            /* Анимация удалена */
            
            .simple-controls-placeholder {
                visibility: hidden;
                transition: none;
            }
            
            /* Состояния body */
            body.simple-swap-active {
                /* Можно добавить дополнительные стили */
            }
            
            body.simple-swap-complete .header {
                z-index: 90;
            }
            
            body.simple-swap-complete .shop-controls {
                z-index: 999;
            }
            
            /* Убираем конфликтующие стили */
            .shop-controls.sticky:not(.simple-sticky) {
                position: relative !important;
                top: auto !important;
            }
            
            /* Удалена анимация фильтров */
            .filter-dropdown {
                transition: none;
            }
            
            /* Исправленная мобильная адаптация */
            @media (max-width: 768px) {
                .shop-controls.simple-fixed,
                .shop-controls.simple-sticky {
                    padding: 10px 15px;
                }
                
                /* ИСПРАВЛЕНО: ГАРАНТИРУЕМ ВИДИМОСТЬ ДАЖЕ НА МОБИЛЬНЫХ */
                .header.simple-hidden {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                
                /* Улучшаем прокрутку на мобильных */
                .shop-controls-fixed-container {
                    padding-top: env(safe-area-inset-top);
                }
            }
            
            /* Удалены стили для плавности */
        `;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }
    
    // БЕЗОПАСНАЯ инициализация после загрузки DOM
    function safeInit() {
        try {
            console.log('Попытка инициализации simple-sticky-swap...');
            
            // Проверяем готовность DOM
            if (!document.body) {
                console.log('DOM не готов, повторяем через 100ms');
                setTimeout(safeInit, 100);
                return;
            }
            
            // Проверяем наличие основных элементов
            const headerCheck = document.querySelector('.header') || document.querySelector('header');
            const controlsCheck = document.querySelector('.shop-controls') || document.querySelector('.filter-bar');
            
            if (!headerCheck || !controlsCheck) {
                console.log('Основные элементы не найдены, повторяем через 200ms');
                setTimeout(safeInit, 200);
                return;
            }
            
            // Запускаем инициализацию
            init();
        } catch (err) {
            console.error('Критическая ошибка инициализации:', err);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInit);
    } else {
        setTimeout(safeInit, 100);
    }
    
    // API для отладки
    window.simpleStickySwap = {
        init: init,
        reset: function() {
            resetElements();
            window.scrollTo(0, 0);
        },
        getState: function() {
            return {
                isInitialized: isInitialized,
                isSwapped: isSwapped,
                scrollY: window.pageYOffset,
                config: CONFIG
            };
        }
    };
})();
