// Advanced Sticky Animation - Сложная анимация меню и фильтров
(function() {
    'use strict';
    
    let initialized = false;
    let animationFrame = null;
    
    // Конфигурация
    const config = {
        smoothness: 0.15, // Плавность анимации
        threshold: 2, // Минимальный порог скролла
        transitionDuration: 400, // Длительность перехода в мс
        headerHideOffset: 100, // Когда начинать скрывать header
        swapPoint: 200 // Точка, где происходит замена
    };
    
    // Элементы
    const elements = {};
    
    // Состояние
    const state = {
        scrollY: 0,
        lastScrollY: 0,
        headerHeight: 0,
        topBarHeight: 0,
        controlsHeight: 0,
        originalControlsOffset: 0,
        headerTranslateY: 0,
        controlsTranslateY: 0,
        phase: 'initial', // initial, sliding, swapping, swapped
        isAnimating: false
    };
    
    function initElements() {
        elements.header = document.querySelector('.header');
        elements.topBar = document.querySelector('.top-bar');
        elements.controls = document.querySelector('.shop-controls');
        elements.shopHeader = document.querySelector('.shop-header');
        elements.body = document.body;
        
        if (!elements.controls || !elements.header) {
            console.log('Required elements not found');
            return false;
        }
        
        // Создаем контейнеры для анимации
        createAnimationContainers();
        
        return true;
    }
    
    function createAnimationContainers() {
        // Создаем обертку для header
        if (!elements.header.parentElement.classList.contains('header-animation-wrapper')) {
            const headerWrapper = document.createElement('div');
            headerWrapper.className = 'header-animation-wrapper';
            elements.header.parentNode.insertBefore(headerWrapper, elements.header);
            headerWrapper.appendChild(elements.header);
            elements.headerWrapper = headerWrapper;
        }
        
        // Создаем placeholder для controls
        if (!document.querySelector('.controls-placeholder')) {
            const placeholder = document.createElement('div');
            placeholder.className = 'controls-placeholder';
            placeholder.style.display = 'none';
            elements.controls.parentNode.insertBefore(placeholder, elements.controls.nextSibling);
            elements.controlsPlaceholder = placeholder;
        }
        
        // Создаем клон controls для анимации
        if (!elements.controlsClone) {
            elements.controlsClone = elements.controls.cloneNode(true);
            elements.controlsClone.className = 'shop-controls-clone';
            elements.controlsClone.style.display = 'none';
            document.body.appendChild(elements.controlsClone);
        }
    }
    
    function calculateDimensions() {
        state.headerHeight = elements.header ? elements.header.offsetHeight : 0;
        state.topBarHeight = elements.topBar ? elements.topBar.offsetHeight : 0;
        state.controlsHeight = elements.controls ? elements.controls.offsetHeight : 0;
        state.originalControlsOffset = elements.controls ? elements.controls.offsetTop : 0;
        
        // Обновляем высоту placeholder
        if (elements.controlsPlaceholder) {
            elements.controlsPlaceholder.style.height = state.controlsHeight + 'px';
        }
    }
    
    function updateAnimation() {
        if (!elements.controls || !elements.header) return;
        
        state.scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDelta = state.scrollY - state.lastScrollY;
        const scrollDirection = scrollDelta > 0 ? 'down' : 'up';
        
        // Рассчитываем позиции для разных фаз анимации
        const totalHeaderHeight = state.headerHeight + state.topBarHeight;
        const controlsTargetTop = state.originalControlsOffset - state.scrollY;
        
        // Фаза 1: Initial - все элементы на своих местах
        if (state.scrollY < config.headerHideOffset) {
            state.phase = 'initial';
            resetToInitial();
        }
        // Фаза 2: Sliding - header начинает опускаться к controls
        else if (state.scrollY >= config.headerHideOffset && state.scrollY < config.swapPoint) {
            state.phase = 'sliding';
            performSliding(scrollDirection);
        }
        // Фаза 3: Swapping - происходит замена местами
        else if (state.scrollY >= config.swapPoint && state.scrollY < config.swapPoint + 100) {
            state.phase = 'swapping';
            performSwapping();
        }
        // Фаза 4: Swapped - controls наверху, header внизу
        else {
            state.phase = 'swapped';
            maintainSwapped(scrollDirection);
        }
        
        state.lastScrollY = state.scrollY;
    }
    
    function resetToInitial() {
        // Возвращаем все в исходное состояние
        elements.header.style.transform = 'translateY(0)';
        elements.header.style.position = '';
        elements.header.style.top = '';
        elements.header.style.zIndex = '';
        
        elements.controls.style.transform = 'translateY(0)';
        elements.controls.style.position = '';
        elements.controls.style.top = '';
        elements.controls.style.zIndex = '';
        elements.controls.classList.remove('sticky', 'swapped');
        
        elements.controlsPlaceholder.style.display = 'none';
        elements.controlsClone.style.display = 'none';
        
        // Убираем классы анимации
        elements.body.classList.remove('header-sliding', 'controls-swapping', 'controls-swapped');
    }
    
    function performSliding(scrollDirection) {
        // Header плавно опускается вниз
        const progress = (state.scrollY - config.headerHideOffset) / (config.swapPoint - config.headerHideOffset);
        const headerOffset = progress * (state.originalControlsOffset - state.headerHeight - state.topBarHeight);
        
        // Применяем трансформацию к header
        elements.header.style.position = 'fixed';
        elements.header.style.top = state.topBarHeight + 'px';
        elements.header.style.left = '0';
        elements.header.style.right = '0';
        elements.header.style.zIndex = '98';
        elements.header.style.transform = `translateY(${headerOffset}px)`;
        elements.header.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Controls остаются на месте пока
        elements.controls.classList.remove('sticky');
        elements.controls.style.transform = 'translateY(0)';
        
        // Добавляем класс для стилизации
        elements.body.classList.add('header-sliding');
        elements.body.classList.remove('controls-swapping', 'controls-swapped');
    }
    
    function performSwapping() {
        // Происходит замена местами
        const swapProgress = (state.scrollY - config.swapPoint) / 100;
        
        // Header занимает место controls
        const headerFinalY = state.originalControlsOffset - state.headerHeight - state.topBarHeight;
        elements.header.style.transform = `translateY(${headerFinalY}px)`;
        elements.header.style.opacity = 1 - swapProgress * 0.3;
        
        // Controls поднимаются наверх
        elements.controls.style.position = 'fixed';
        elements.controls.style.top = state.topBarHeight + 'px';
        elements.controls.style.left = '0';
        elements.controls.style.right = '0';
        elements.controls.style.zIndex = '99';
        elements.controls.style.transform = `translateY(${-swapProgress * 20}px)`;
        elements.controls.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        elements.controls.classList.add('sticky', 'swapping');
        
        // Показываем placeholder
        elements.controlsPlaceholder.style.display = 'block';
        
        // Добавляем классы анимации
        elements.body.classList.add('controls-swapping');
        elements.body.classList.remove('header-sliding');
    }
    
    function maintainSwapped(scrollDirection) {
        // Controls остаются наверху как sticky
        elements.controls.style.position = 'fixed';
        elements.controls.style.top = '0';
        elements.controls.style.transform = 'translateY(0)';
        elements.controls.classList.add('sticky', 'swapped');
        elements.controls.classList.remove('swapping');
        
        // Header остается внизу на месте controls
        const headerFinalY = state.originalControlsOffset - state.headerHeight - state.topBarHeight;
        elements.header.style.transform = `translateY(${headerFinalY}px)`;
        elements.header.style.opacity = '0.7';
        
        // При скролле вверх можем показывать/скрывать controls
        if (scrollDirection === 'up' && state.scrollY < state.lastScrollY - config.threshold) {
            elements.controls.style.transform = 'translateY(0)';
        } else if (scrollDirection === 'down' && state.scrollY > state.lastScrollY + config.threshold) {
            // Можем немного прятать controls при быстром скролле вниз
            elements.controls.style.transform = 'translateY(-5px)';
        }
        
        // Добавляем финальный класс
        elements.body.classList.add('controls-swapped');
        elements.body.classList.remove('controls-swapping', 'header-sliding');
    }
    
    function handleScroll() {
        if (!state.isAnimating) {
            state.isAnimating = true;
            animationFrame = requestAnimationFrame(() => {
                updateAnimation();
                state.isAnimating = false;
            });
        }
    }
    
    function handleResize() {
        calculateDimensions();
        updateAnimation();
    }
    
    function addStyles() {
        const styleId = 'advanced-sticky-styles';
        if (document.getElementById(styleId)) return;
        
        const styles = `
            /* Advanced Sticky Animation Styles */
            .header-animation-wrapper {
                position: relative;
                z-index: 98;
            }
            
            .shop-controls {
                will-change: transform, top;
                backface-visibility: hidden;
            }
            
            .shop-controls.swapping {
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(10px);
            }
            
            .shop-controls.swapped {
                box-shadow: 0 2px 15px rgba(0,0,0,0.15);
                background: white;
            }
            
            .controls-placeholder {
                visibility: hidden;
            }
            
            .shop-controls-clone {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 97;
                pointer-events: none;
            }
            
            /* Состояния анимации */
            body.header-sliding .header {
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            
            body.controls-swapping .shop-controls {
                animation: controls-rise 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            
            body.controls-swapped .header {
                pointer-events: none;
                user-select: none;
            }
            
            @keyframes controls-rise {
                from {
                    opacity: 0.8;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Плавные переходы для всех элементов */
            .header,
            .shop-controls {
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                           opacity 0.3s ease,
                           box-shadow 0.3s ease;
            }
            
            /* Мобильная адаптация */
            @media (max-width: 768px) {
                .shop-controls.swapped {
                    top: 0 !important;
                }
            }
            
            /* Оптимизация производительности */
            @media (prefers-reduced-motion: reduce) {
                .header,
                .shop-controls {
                    transition: none !important;
                    animation: none !important;
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
    
    function init() {
        if (initialized) return;
        
        // Проверяем, что мы на странице категории
        const isCategory = document.querySelector('.shop-controls') && 
                          document.querySelector('.shop-header');
        
        if (!isCategory) {
            console.log('Not a category page, skipping advanced sticky animation');
            return;
        }
        
        if (!initElements()) return;
        
        calculateDimensions();
        addStyles();
        
        // Добавляем слушатели событий
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        
        // Начальная позиция
        updateAnimation();
        
        initialized = true;
        console.log('Advanced sticky animation initialized');
    }
    
    // Инициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100); // Небольшая задержка для загрузки других скриптов
    }
    
    // Экспорт для отладки
    window.advancedStickyAnimation = {
        init,
        state,
        config,
        reset: () => {
            state.scrollY = 0;
            state.lastScrollY = 0;
            resetToInitial();
            window.scrollTo(0, 0);
        },
        getPhase: () => state.phase
    };
})();
