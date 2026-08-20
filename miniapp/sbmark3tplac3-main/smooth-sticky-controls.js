// Smooth Sticky Controls - Плавное поведение sticky элементов
(function() {
    'use strict';
    
    let isInitialized = false;
    let rafId = null;
    let lastScrollY = 0;
    let currentScrollY = 0;
    let ticking = false;
    
    // Конфигурация
    const config = {
        headerSelector: '.header',
        topBarSelector: '.top-bar',
        controlsSelector: '.shop-controls',
        smoothness: 0.12, // Плавность анимации (0-1)
        threshold: 5, // Минимальный порог скролла
        transitionDuration: 300 // Длительность перехода в мс
    };
    
    // Элементы
    let elements = {};
    
    // Состояние
    let state = {
        isSticky: false,
        headerVisible: true,
        controlsTop: 0,
        originalOffset: 0,
        headerHeight: 0,
        topBarHeight: 0,
        totalHeaderHeight: 0,
        placeholder: null
    };
    
    function initElements() {
        elements.header = document.querySelector(config.headerSelector);
        elements.topBar = document.querySelector(config.topBarSelector);
        elements.controls = document.querySelector(config.controlsSelector);
        
        if (!elements.controls) {
            console.log('Shop controls not found, skipping initialization');
            return false;
        }
        
        // Создаем placeholder для предотвращения прыжков
        state.placeholder = document.createElement('div');
        state.placeholder.className = 'shop-controls-placeholder';
        state.placeholder.style.display = 'none';
        elements.controls.parentNode.insertBefore(state.placeholder, elements.controls.nextSibling);
        
        return true;
    }
    
    function calculateDimensions() {
        state.headerHeight = elements.header ? elements.header.offsetHeight : 0;
        state.topBarHeight = elements.topBar ? elements.topBar.offsetHeight : 0;
        state.totalHeaderHeight = state.headerHeight + state.topBarHeight;
        state.originalOffset = elements.controls.offsetTop;
    }
    
    function updateControlsPosition() {
        if (!elements.controls) return;
        
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDelta = scrollY - lastScrollY;
        const scrollDirection = scrollDelta > 0 ? 'down' : 'up';
        
        // Проверяем видимость header
        const headerHidden = elements.header && elements.header.classList.contains('hidden');
        
        // Вычисляем целевую позицию для controls
        let targetTop = state.totalHeaderHeight;
        if (headerHidden) {
            targetTop = 0;
        }
        
        // Плавно интерполируем текущую позицию к целевой
        if (state.isSticky) {
            const currentTop = parseFloat(elements.controls.style.top) || targetTop;
            const newTop = currentTop + (targetTop - currentTop) * config.smoothness;
            
            // Применяем новую позицию
            elements.controls.style.top = `${newTop}px`;
            
            // Добавляем тень при прокрутке
            if (scrollY > state.originalOffset + 50) {
                elements.controls.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            } else {
                elements.controls.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            }
        }
        
        // Определяем, должны ли controls быть sticky
        if (scrollY + targetTop >= state.originalOffset) {
            if (!state.isSticky) {
                makeSticky(targetTop);
            }
        } else {
            if (state.isSticky) {
                removeSticky();
            }
        }
        
        lastScrollY = scrollY;
    }
    
    function makeSticky(targetTop) {
        state.isSticky = true;
        
        // Добавляем класс с анимацией
        elements.controls.classList.add('sticky', 'sticky-transition');
        
        // Устанавливаем начальную позицию
        elements.controls.style.top = `${targetTop}px`;
        
        // Показываем placeholder
        state.placeholder.style.display = 'block';
        state.placeholder.style.height = `${elements.controls.offsetHeight}px`;
        
        // Добавляем плавную анимацию
        elements.controls.style.transition = `all ${config.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        
        // Убираем класс transition после анимации
        setTimeout(() => {
            elements.controls.classList.remove('sticky-transition');
            elements.controls.style.transition = '';
        }, config.transitionDuration);
    }
    
    function removeSticky() {
        state.isSticky = false;
        
        // Добавляем класс для анимации
        elements.controls.classList.add('sticky-transition');
        
        // Плавная анимация при удалении sticky
        elements.controls.style.transition = `all ${config.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        
        setTimeout(() => {
            elements.controls.classList.remove('sticky', 'sticky-transition');
            elements.controls.style.top = '';
            elements.controls.style.boxShadow = '';
            elements.controls.style.transition = '';
            state.placeholder.style.display = 'none';
        }, 10);
    }
    
    function requestTick() {
        if (!ticking) {
            rafId = requestAnimationFrame(updateControlsPosition);
            ticking = true;
        }
    }
    
    function handleScroll() {
        currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        requestTick();
        ticking = false;
    }
    
    function handleResize() {
        calculateDimensions();
        updateControlsPosition();
    }
    
    function init() {
        if (isInitialized) return;
        
        if (!initElements()) return;
        
        calculateDimensions();
        
        // Добавляем стили для плавных переходов
        addSmoothStyles();
        
        // Слушатели событий с пассивными флагами для производительности
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        
        // Наблюдаем за изменениями в header
        observeHeaderChanges();
        
        isInitialized = true;
        console.log('Smooth sticky controls initialized');
    }
    
    function observeHeaderChanges() {
        if (!elements.header) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Header класс изменился, обновляем позицию controls
                    requestTick();
                }
            });
        });
        
        observer.observe(elements.header, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    function addSmoothStyles() {
        const styleId = 'smooth-sticky-styles';
        if (document.getElementById(styleId)) return;
        
        const styles = `
            .shop-controls {
                will-change: transform, top;
                transform: translateZ(0);
                backface-visibility: hidden;
            }
            
            .shop-controls.sticky {
                position: fixed;
                left: 0;
                right: 0;
                z-index: 99;
                background: white;
                transition: box-shadow 0.3s ease;
            }
            
            .shop-controls.sticky-transition {
                transition: all ${config.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            
            .shop-controls-placeholder {
                visibility: hidden;
            }
            
            /* Плавная анимация для filter dropdown */
            .filter-dropdown .filter-menu {
                transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s ease;
                transform-origin: top center;
            }
            
            .filter-dropdown .filter-menu:not(.active) {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
                visibility: hidden;
                pointer-events: none;
            }
            
            .filter-dropdown .filter-menu.active {
                opacity: 1;
                transform: translateY(0) scale(1);
                visibility: visible;
                pointer-events: auto;
            }
            
            /* Плавная анимация для view controls */
            .view-controls .view-btn {
                transition: all 0.2s ease;
            }
            
            .view-controls .view-btn:hover {
                transform: scale(1.1);
            }
            
            .view-controls .view-btn.active {
                background-color: #000;
                color: #fff;
            }
            
            /* Оптимизация производительности */
            @media (prefers-reduced-motion: reduce) {
                .shop-controls,
                .shop-controls.sticky-transition,
                .filter-dropdown .filter-menu,
                .view-controls .view-btn {
                    transition: none !important;
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
    
    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Экспортируем для отладки
    window.smoothStickyControls = {
        init,
        state,
        config,
        updateControlsPosition,
        recalculate: () => {
            calculateDimensions();
            updateControlsPosition();
        }
    };
})();
