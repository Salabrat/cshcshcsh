/**
 * Category Sticky Navigation
 * 
 * Современная реализация переключения между фиксированным навигационным меню
 * и блоком фильтров при скролле страницы категорий товаров.
 * 
 * Использует IntersectionObserver для оптимизации производительности
 * и обеспечивает плавные анимации переключения.
 */

(function() {
    'use strict';

    // Полностью отключаем этот скрипт: используем более простую логику initStickyShopControls
    if (typeof window !== 'undefined') {
        console.log('CategoryStickyNavigation disabled (using initStickyShopControls instead)');
        return;
    }

    /**
     * Класс для управления sticky навигацией
     */
    class CategoryStickyNavigation {
        constructor() {
            // Элементы DOM
            this.topBar = null;
            this.navbar = null; // header с классом .header
            this.filterBar = null; // .shop-controls
            this.sentinel = null; // Невидимый элемент для отслеживания пересечения
            
            // Состояние
            this.isNavbarVisible = true;
            this.isFilterBarSticky = false;
            this.lastScrollY = 0;
            this.scrollDirection = 'down';
            
            // Настройки
            this.config = {
                // Порог для IntersectionObserver (0 = начало пересечения, 1 = полное пересечение)
                threshold: [0, 0.1, 1],
                // Задержка для debounce скролла (мс)
                scrollDelay: 10,
                // Минимальная скорость скролла для активации (px)
                minScrollSpeed: 5,
                // Высота top-bar для расчета позиций
                topBarHeight: 40
            };
            
            // Observers
            this.intersectionObserver = null;
            this.scrollObserver = null;
            
            // Флаги для оптимизации
            this.isInitialized = false;
            this.rafId = null;
            
            this.init();
        }

        /**
         * Инициализация компонента
         */
        init() {
            // Проверяем, что мы на странице категории
            if (!this.isCategoryPage()) {
                return;
            }

            // Ждем загрузки DOM
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        }

        /**
         * Проверка, что мы на странице категории
         */
        isCategoryPage() {
            const pathname = window.location.pathname;
            return (pathname.includes('category-') || pathname.includes('shop-all')) && 
                   pathname.includes('.html');
        }

        /**
         * Настройка элементов и observers
         */
        setup() {
            // Находим элементы
            this.topBar = document.querySelector('.top-bar');
            this.navbar = document.querySelector('.header');
            this.filterBar = document.querySelector('.shop-controls');

            // Проверяем наличие необходимых элементов
            if (!this.navbar || !this.filterBar) {
                console.warn('CategoryStickyNavigation: Required elements not found. Retrying...');
                setTimeout(() => this.setup(), 100);
                return;
            }

            // Создаем sentinel элемент для отслеживания пересечения
            this.createSentinel();

            // Инициализируем стили
            this.initializeStyles();

            // Настраиваем IntersectionObserver
            this.setupIntersectionObserver();

            // Настраиваем scroll listener для определения направления
            this.setupScrollListener();

            // Синхронизируем события между оригинальным и sticky filter-bar
            this.syncFilterBarEvents();

            this.isInitialized = true;
            console.log('CategoryStickyNavigation: Initialized successfully');
        }

        /**
         * Создание sentinel элемента для отслеживания позиции filter-bar
         */
        createSentinel() {
            // Удаляем старый sentinel, если есть
            const oldSentinel = document.querySelector('.filter-bar-sentinel');
            if (oldSentinel) {
                oldSentinel.remove();
            }

            // Создаем новый sentinel
            this.sentinel = document.createElement('div');
            this.sentinel.className = 'filter-bar-sentinel';
            this.sentinel.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 1px;
                height: 1px;
                pointer-events: none;
                visibility: hidden;
            `;

            // Вставляем sentinel перед filter-bar
            this.filterBar.parentNode.insertBefore(this.sentinel, this.filterBar);
            
            // Позиционируем sentinel на уровне начала filter-bar
            const filterBarRect = this.filterBar.getBoundingClientRect();
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            this.sentinel.style.top = `${filterBarRect.top + scrollY}px`;
        }

        /**
         * Инициализация начальных стилей
         */
        initializeStyles() {
            // Убеждаемся, что navbar фиксирован
            if (!this.navbar.classList.contains('navbar-fixed')) {
                this.navbar.classList.add('navbar-fixed');
            }

            // Добавляем класс для плавных переходов
            this.navbar.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
            this.filterBar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            // Сохраняем оригинальные стили filter-bar
            this.filterBarOriginalStyles = {
                position: this.filterBar.style.position || 'relative',
                top: this.filterBar.style.top || '',
                left: this.filterBar.style.left || '',
                right: this.filterBar.style.right || '',
                width: this.filterBar.style.width || '',
                zIndex: this.filterBar.style.zIndex || '',
                boxShadow: this.filterBar.style.boxShadow || '',
                backgroundColor: this.filterBar.style.backgroundColor || ''
            };
        }

        /**
         * Настройка IntersectionObserver для отслеживания sentinel
         */
        setupIntersectionObserver() {
            const options = {
                root: null, // viewport
                rootMargin: `-${this.getNavbarHeight()}px 0px 0px 0px`, // Учитываем высоту navbar
                threshold: this.config.threshold
            };

            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    // Когда sentinel пересекает верхнюю границу viewport
                    if (entry.isIntersecting) {
                        // Sentinel виден - filter-bar еще не достиг верха
                        this.handleSentinelVisible();
                    } else {
                        // Sentinel не виден - filter-bar достиг или прошел верх viewport
                        this.handleSentinelHidden();
                    }
                });
            }, options);

            // Начинаем наблюдение за sentinel
            if (this.sentinel) {
                this.intersectionObserver.observe(this.sentinel);
            }
        }

        /**
         * Настройка scroll listener для определения направления скролла
         */
        setupScrollListener() {
            let ticking = false;

            const handleScroll = () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
                        
                        // Определяем направление скролла
                        if (currentScrollY > this.lastScrollY) {
                            this.scrollDirection = 'down';
                        } else if (currentScrollY < this.lastScrollY) {
                            this.scrollDirection = 'up';
                        }

                        // Обновляем позицию sentinel при необходимости
                        this.updateSentinelPosition();

                        this.lastScrollY = currentScrollY;
                        ticking = false;
                    });
                    ticking = true;
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
        }

        /**
         * Обновление позиции sentinel при изменении layout
         */
        updateSentinelPosition() {
            if (!this.sentinel || !this.filterBar) return;

            const filterBarRect = this.filterBar.getBoundingClientRect();
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            
            // Обновляем позицию только если filter-bar не sticky
            if (!this.isFilterBarSticky) {
                this.sentinel.style.top = `${filterBarRect.top + scrollY}px`;
            }
        }

        /**
         * Обработка события: sentinel виден (filter-bar еще не достиг верха)
         */
        handleSentinelVisible() {
            // Показываем navbar, убираем sticky с filter-bar
            if (!this.isNavbarVisible) {
                this.showNavbar();
            }
            
            if (this.isFilterBarSticky) {
                this.unstickFilterBar();
            }
        }

        /**
         * Обработка события: sentinel скрыт (filter-bar достиг или прошел верх viewport)
         */
        handleSentinelHidden() {
            // Скрываем navbar только при скролле вниз
            if (this.scrollDirection === 'down' && this.isNavbarVisible) {
                this.hideNavbar();
            }

            // Делаем filter-bar sticky только при скролле вниз
            if (this.scrollDirection === 'down' && !this.isFilterBarSticky) {
                this.stickFilterBar();
            }

            // При скролле вверх показываем navbar обратно
            if (this.scrollDirection === 'up' && !this.isNavbarVisible) {
                // Проверяем, не достигли ли мы верха страницы
                const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                if (scrollY < this.getFilterBarOriginalTop()) {
                    this.showNavbar();
                    this.unstickFilterBar();
                }
            }
        }

        /**
         * Показать navbar
         */
        showNavbar() {
            this.navbar.style.transform = 'translateY(0)';
            this.navbar.style.opacity = '1';
            this.navbar.classList.remove('navbar-hidden');
            this.isNavbarVisible = true;
        }

        /**
         * Скрыть navbar
         */
        hideNavbar() {
            const navbarHeight = this.getNavbarHeight();
            this.navbar.style.transform = `translateY(-${navbarHeight}px)`;
            this.navbar.style.opacity = '0';
            this.navbar.classList.add('navbar-hidden');
            this.isNavbarVisible = false;
        }

        /**
         * Закрепить filter-bar вверху
         */
        stickFilterBar() {
            // Сохраняем оригинальную ширину
            const filterBarRect = this.filterBar.getBoundingClientRect();
            const originalWidth = filterBarRect.width;
            const originalLeft = filterBarRect.left;

            // Применяем sticky стили
            this.filterBar.style.position = 'fixed';
            this.filterBar.style.top = '0';
            this.filterBar.style.left = `${originalLeft}px`;
            this.filterBar.style.width = `${originalWidth}px`;
            this.filterBar.style.zIndex = '1000';
            this.filterBar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            this.filterBar.style.backgroundColor = 'white';
            this.filterBar.classList.add('filter-bar-sticky');

            // Добавляем отступ сверху для контента, чтобы он не скрывался под sticky filter-bar
            this.addSpacerForStickyFilterBar();

            this.isFilterBarSticky = true;
        }

        /**
         * Убрать sticky с filter-bar
         */
        unstickFilterBar() {
            // Восстанавливаем оригинальные стили
            Object.keys(this.filterBarOriginalStyles).forEach(key => {
                this.filterBar.style[key] = this.filterBarOriginalStyles[key];
            });

            this.filterBar.classList.remove('filter-bar-sticky');

            // Убираем spacer
            this.removeSpacerForStickyFilterBar();

            this.isFilterBarSticky = false;
        }

        /**
         * Добавить spacer для компенсации высоты sticky filter-bar
         */
        addSpacerForStickyFilterBar() {
            // Удаляем старый spacer, если есть
            this.removeSpacerForStickyFilterBar();

            const spacer = document.createElement('div');
            spacer.className = 'filter-bar-spacer';
            spacer.style.cssText = `
                height: ${this.filterBar.offsetHeight}px;
                width: 100%;
                pointer-events: none;
            `;

            // Вставляем spacer перед filter-bar
            this.filterBar.parentNode.insertBefore(spacer, this.filterBar);
        }

        /**
         * Удалить spacer
         */
        removeSpacerForStickyFilterBar() {
            const spacer = document.querySelector('.filter-bar-spacer');
            if (spacer) {
                spacer.remove();
            }
        }

        /**
         * Синхронизация событий между оригинальным и sticky filter-bar
         * (на случай, если понадобится клонирование)
         */
        syncFilterBarEvents() {
            // Если filter-bar становится sticky, события остаются на том же элементе
            // Дополнительная синхронизация не требуется, так как мы используем один элемент
        }

        /**
         * Получить высоту navbar (включая top-bar)
         */
        getNavbarHeight() {
            const navbarHeight = this.navbar ? this.navbar.offsetHeight : 0;
            const topBarHeight = this.topBar ? this.topBar.offsetHeight : this.config.topBarHeight;
            return navbarHeight + topBarHeight;
        }

        /**
         * Получить оригинальную позицию filter-bar
         */
        getFilterBarOriginalTop() {
            if (!this.sentinel) return 0;
            const sentinelRect = this.sentinel.getBoundingClientRect();
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            return sentinelRect.top + scrollY;
        }

        /**
         * Очистка при уничтожении компонента
         */
        destroy() {
            if (this.intersectionObserver && this.sentinel) {
                this.intersectionObserver.unobserve(this.sentinel);
            }
            
            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
            }

            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
            }

            this.removeSpacerForStickyFilterBar();
            
            if (this.sentinel) {
                this.sentinel.remove();
            }
        }
    }

    // Инициализация при загрузке страницы
    let categoryStickyNav = null;

    function initializeCategoryStickyNavigation() {
        // Проверяем, что мы на странице категории
        const pathname = window.location.pathname;
        const isCategoryPage = (pathname.includes('category-') || pathname.includes('shop-all')) && 
                              pathname.includes('.html');

        if (isCategoryPage && !categoryStickyNav) {
            categoryStickyNav = new CategoryStickyNavigation();
        }
    }

    // Запуск инициализации
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCategoryStickyNavigation);
    } else {
        initializeCategoryStickyNavigation();
    }

    // Экспорт для возможного использования в других модулях
    if (typeof window !== 'undefined') {
        window.CategoryStickyNavigation = CategoryStickyNavigation;
    }

})();

