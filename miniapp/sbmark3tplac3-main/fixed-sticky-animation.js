// Fixed Sticky Animation - Исправленная версия анимации меню и фильтров
(function() {
    'use strict';
    
    // Отключаем старые sticky скрипты
    if (typeof window.initStickyShopControls !== 'undefined') {
        window.initStickyShopControls = function() {
            console.log('Old sticky disabled');
        };
    }
    
    let initialized = false;
    let animationFrame = null;
    let resizeTimeout = null;
    
    // Конфигурация
    const config = {
        startOffset: 50,      // Когда начинать анимацию
        swapDuration: 300,    // Длительность замены (px скролла)
        smoothness: 0.12,     // Плавность (0-1)
        debounceDelay: 10     // Задержка для оптимизации
    };
    
    // Элементы
    const elements = {};
    
    // Состояние
    const state = {
        scrollY: 0,
        lastScrollY: 0,
        headerHeight: 0,
        controlsHeight: 0,
        controlsOffset: 0,
        isSticky: false,
        phase: 'normal' // normal, sliding, swapped
    };
    
    function initElements() {
        elements.header = document.querySelector('.header');
        elements.controls = document.querySelector('.shop-controls');
        elements.shopHeader = document.querySelector('.shop-header');
        
        if (!elements.controls || !elements.header) {
            return false;
        }
        
        // Создаем placeholder для предотвращения прыжков
        if (!elements.placeholder) {
            elements.placeholder = document.createElement('div');
            elements.placeholder.className = 'controls-placeholder-fixed';
            elements.placeholder.style.display = 'none';
            elements.placeholder.style.visibility = 'hidden';
            elements.controls.parentNode.insertBefore(elements.placeholder, elements.controls.nextSibling);
        }
        
        return true;
    }
    
    function calculateDimensions() {
        if (!elements.controls || !elements.header) return;
        
        // Сохраняем текущие размеры
        state.headerHeight = elements.header.offsetHeight;
        state.controlsHeight = elements.controls.offsetHeight;
        
        // Получаем оригинальную позицию controls
        if (!state.isSticky) {
            const rect = elements.controls.getBoundingClientRect();
            state.controlsOffset = rect.top + window.pageYOffset;
        }
        
        // Обновляем placeholder
        if (elements.placeholder) {
            elements.placeholder.style.height = state.controlsHeight + 'px';
        }
    }
    
    function updateAnimation() {
        if (!elements.controls || !elements.header) return;
        
        state.scrollY = window.pageYOffset;
        const scrollDelta = state.scrollY - state.lastScrollY;
        
        // Определяем фазу анимации
        const relativeScroll = state.scrollY - config.startOffset;
        
        if (relativeScroll < 0) {
            // Фаза 1: Normal - все на местах
            resetToNormal();
        } else if (relativeScroll < config.swapDuration) {
            // Фаза 2: Sliding - плавный переход
            const progress = relativeScroll / config.swapDuration;
            performSliding(progress);
        } else {
            // Фаза 3: Swapped - controls наверху
            maintainSwapped();
        }
        
        state.lastScrollY = state.scrollY;
    }
    
    function resetToNormal() {
        if (state.phase === 'normal') return;
        
        state.phase = 'normal';
        state.isSticky = false;
        
        // Сбрасываем header
        elements.header.style.transform = '';
        elements.header.style.opacity = '';
        elements.header.style.position = '';
        elements.header.style.zIndex = '';
        elements.header.classList.remove('sliding', 'hidden');
        
        // Сбрасываем controls
        elements.controls.style.position = '';
        elements.controls.style.top = '';
        elements.controls.style.transform = '';
        elements.controls.style.zIndex = '';
        elements.controls.classList.remove('sticky', 'fixed', 'swapping', 'swapped');
        
        // Скрываем placeholder
        if (elements.placeholder) {
            elements.placeholder.style.display = 'none';
        }
        
        document.body.classList.remove('header-sliding', 'controls-swapped');
    }
    
    function performSliding(progress) {
        state.phase = 'sliding';
        
        // Плавное движение header вниз
        const headerOffset = progress * state.controlsOffset;
        elements.header.style.transform = `translateY(${headerOffset * 0.5}px)`;
        elements.header.style.opacity = 1 - (progress * 0.3);
        elements.header.classList.add('sliding');
        
        // Начинаем поднимать controls
        if (progress > 0.5) {
            if (!state.isSticky) {
                state.isSticky = true;
                elements.controls.classList.add('sticky');
                elements.controls.style.position = 'fixed';
                elements.controls.style.top = '100px';
                elements.controls.style.left = '0';
                elements.controls.style.right = '0';
                elements.controls.style.zIndex = '99';
                
                // Показываем placeholder
                if (elements.placeholder) {
                    elements.placeholder.style.display = 'block';
                }
            }
            
            // Анимируем подъем controls
            const liftProgress = (progress - 0.5) * 2;
            const targetTop = 100 - (liftProgress * 100);
            elements.controls.style.top = `${targetTop}px`;
            elements.controls.style.transform = `translateY(${(1 - liftProgress) * 20}px)`;
        }
        
        document.body.classList.add('header-sliding');
    }
    
    function maintainSwapped() {
        if (state.phase === 'swapped') return;
        
        state.phase = 'swapped';
        state.isSticky = true;
        
        // Header остается внизу
        elements.header.style.transform = `translateY(${state.controlsOffset * 0.5}px)`;
        elements.header.style.opacity = '0.7';
        elements.header.classList.add('hidden');
        
        // Controls фиксированы наверху
        elements.controls.style.position = 'fixed';
        elements.controls.style.top = '0';
        elements.controls.style.transform = '';
        elements.controls.style.left = '0';
        elements.controls.style.right = '0';
        elements.controls.style.zIndex = '100';
        elements.controls.classList.add('swapped');
        elements.controls.classList.remove('swapping');
        
        // Placeholder активен
        if (elements.placeholder) {
            elements.placeholder.style.display = 'block';
        }
        
        document.body.classList.add('controls-swapped');
        document.body.classList.remove('header-sliding');
    }
    
    let scrollTimeout;
    function handleScroll() {
        // Debounce для производительности
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            
            animationFrame = requestAnimationFrame(updateAnimation);
        }, config.debounceDelay);
    }
    
    function handleResize() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        
        resizeTimeout = setTimeout(() => {
            calculateDimensions();
            updateAnimation();
        }, 100);
    }
    
    function addStyles() {
        const styleId = 'fixed-sticky-styles';
        if (document.getElementById(styleId)) return;
        
        const styles = `
            /* Fixed Sticky Animation Styles */
            .shop-controls {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                will-change: transform, top;
                backface-visibility: hidden;
            }
            
            .shop-controls.sticky {
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(10px);
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .shop-controls.swapped {
                background: white;
                box-shadow: 0 2px 15px rgba(0,0,0,0.12);
            }
            
            .header.sliding {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .header.hidden {
                pointer-events: none;
            }
            
            .controls-placeholder-fixed {
                visibility: hidden;
            }
            
            body.header-sliding .header {
                z-index: 97;
            }
            
            body.controls-swapped .header {
                z-index: 96;
            }
            
            /* Убираем конфликтующие стили */
            .shop-controls.sticky:not(.swapped) {
                position: fixed !important;
            }
            
            /* Мобильная адаптация */
            @media (max-width: 768px) {
                .shop-controls.swapped {
                    padding: 12px 16px;
                }
                
                body.controls-swapped .header {
                    display: none;
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
    
    function cleanup() {
        // Очистка при деинициализации
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
        
        resetToNormal();
    }
    
    function init() {
        // Предотвращаем множественную инициализацию
        if (initialized) {
            console.log('Fixed sticky animation already initialized');
            return;
        }
        
        // Проверяем, что мы на странице категории
        const isCategory = document.querySelector('.shop-controls') && 
                          document.querySelector('.shop-header');
        
        if (!isCategory) {
            console.log('Not a category page');
            return;
        }
        
        // Отключаем старые скрипты
        if (window.smoothStickyControls) {
            window.smoothStickyControls = null;
        }
        
        if (!initElements()) {
            console.log('Required elements not found');
            return;
        }
        
        // Инициализация
        calculateDimensions();
        addStyles();
        
        // Слушатели событий
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        
        // Начальное состояние
        updateAnimation();
        
        initialized = true;
        console.log('Fixed sticky animation initialized successfully');
    }
    
    // Ждем полной загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Даем время другим скриптам загрузиться
        setTimeout(init, 200);
    }
    
    // API для отладки
    window.fixedStickyAnimation = {
        init,
        cleanup,
        state,
        config,
        reset: () => {
            cleanup();
            setTimeout(init, 100);
        },
        getPhase: () => state.phase
    };
})();
