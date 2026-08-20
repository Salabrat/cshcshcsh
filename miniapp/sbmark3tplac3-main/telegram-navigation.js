// Telegram Mini App Navigation Handler
class TelegramNavigation {
    constructor() {
        this.currentPage = 'home';
        // По вкладкам храним последний открытый товар: { [page]: { productId } }
        this.activeProductsByPage = {};
        this.isLoading = false; // Флаг загрузки для блокировки навигации
        this.init();
    }

    init() {
        console.log('TelegramNavigation: Initializing...');
        
        // Setup navigation click handlers with event delegation for better reliability
        // Используем capture phase, чтобы перехватить клики до того, как их заблокирует overlay
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.tg-nav-item');
            if (navItem) {
                // Блокируем навигацию во время загрузки
                if (this.isLoading) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const href = navItem.getAttribute('href');
                if (href) {
                    const page = href.replace('#', '');

                    // Если нажали на уже активную вкладку и открыт товар — сбрасываем её:
                    // закрываем модалку и очищаем сохранённый товар для этой вкладки.
                    if (page === this.currentPage &&
                        window.telegramProductModal &&
                        window.telegramProductModal.modal &&
                        window.telegramProductModal.modal.classList.contains('active')) {

                        // Закрываем модалку как пользовательское действие
                        window.telegramProductModal.close(true);

                        // Удаляем сохранённый товар для текущей вкладки
                        if (this.activeProductsByPage && this.activeProductsByPage[this.currentPage]) {
                            delete this.activeProductsByPage[this.currentPage];
                            this.saveState();
                        }

                        return; // Не запускаем повторную навигацию, вкладка уже активна
                    }

                    this.navigate(href);
                }
            }
        }, true); // Используем capture phase

        // Also keep direct handlers as backup
        document.querySelectorAll('.tg-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Блокируем навигацию во время загрузки
                if (this.isLoading) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                const href = item.getAttribute('href');
                if (href) {
                this.navigate(href);
                }
            });
        });

        // Load saved state
        this.loadState();
        
        // Show home page by default
        this.showPage('home');
        
        // Применяем обложку главной страницы при инициализации
        setTimeout(() => {
            if (this.currentPage === 'home') {
                this.applyHomeLogo();
            } else if (this.currentPage === 'catalog') {
                this.applyCatalogCover();
            }
        }, 100);

        window.addEventListener('tgDesignSettingsReady', (event) => {
            const settings = event?.detail || window.__tgDesignSettings;
            if (!settings) return;

            window.homeLogoImages = settings.logoImages || (settings.logoImage ? [settings.logoImage] : []);
            const catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
            if (catalogCovers.length > 0) {
                const normalizedCatalog = catalogCovers.map(item => typeof item === 'string'
                    ? { url: item, type: /data:video\/|\.(mp4|webm|ogg|mov)(\?|$)/i.test(item) ? 'video' : 'image' }
                    : item
                );
                window.catalogCoverImages = normalizedCatalog;
                window.catalogCoverImage = normalizedCatalog[0];
                window.catalogCoverCurrentIndex = 0;
            }

            if (this.currentPage === 'home') {
                this.applyHomeLogo();
            } else if (this.currentPage === 'catalog') {
                this.applyCatalogCover();
            }
        });
    }

    // Save navigation state to sessionStorage
    saveState() {
        try {
            const state = {
                currentPage: this.currentPage,
                catalogState: this.getCatalogState(),
                categoryState: this.getCategoryState(),
                activeProductsByPage: this.activeProductsByPage
            };
            sessionStorage.setItem('tgNavigationState', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving navigation state:', error);
        }
    }

    // Load navigation state from sessionStorage
    loadState() {
        try {
            const savedState = sessionStorage.getItem('tgNavigationState');
            if (savedState) {
                const state = JSON.parse(savedState);
                if (state.activeProductsByPage) {
                    this.activeProductsByPage = state.activeProductsByPage;
                }
                return state;
            }
        } catch (error) {
            console.error('Error loading navigation state:', error);
        }
        return null;
    }

    // Get current catalog state
    getCatalogState() {
        const state = {
            searchQuery: '',
            selectedBrand: null,
            scrollPosition: 0
        };
        
        // Get search query if catalog is visible
        const catalogPage = document.getElementById('catalogPage');
        if (catalogPage && catalogPage.style.display !== 'none') {
            const searchInput = document.getElementById('catalogSearch');
            if (searchInput) {
                state.searchQuery = searchInput.value || '';
            }
            
            // Get scroll position
            const catalogContent = catalogPage.querySelector('.tg-catalog-content');
            if (catalogContent) {
                state.scrollPosition = catalogContent.scrollTop || 0;
            }
        }
        
        // Check if category page is open
        if (window.telegramCategoryPage && window.telegramCategoryPage.page && window.telegramCategoryPage.page.classList.contains('active')) {
            state.selectedBrand = {
                categoryId: window.telegramCategoryPage.currentCategory,
                title: document.getElementById('tgCategoryPageTitle')?.textContent || ''
            };
        }
        
        return state;
    }

    // Save catalog scroll position
    saveCatalogScrollPosition() {
        const catalogPage = document.getElementById('catalogPage');
        if (catalogPage && catalogPage.style.display !== 'none') {
            const catalogContent = catalogPage.querySelector('.tg-catalog-content');
            if (catalogContent) {
                const scrollPosition = catalogContent.scrollTop || 0;
                try {
                    let savedState = this.loadState() || {};
                    savedState.catalogState = savedState.catalogState || {};
                    savedState.catalogState.scrollPosition = scrollPosition;
                    sessionStorage.setItem('tgNavigationState', JSON.stringify(savedState));
                } catch (error) {
                    console.error('Error saving scroll position:', error);
                }
            }
        }
    }

    // Restore catalog scroll position
    restoreCatalogScrollPosition() {
        try {
            const savedState = this.loadState();
            if (savedState && savedState.catalogState && savedState.catalogState.scrollPosition) {
                const catalogPage = document.getElementById('catalogPage');
                if (catalogPage) {
                    const catalogContent = catalogPage.querySelector('.tg-catalog-content');
                    if (catalogContent) {
                        setTimeout(() => {
                            catalogContent.scrollTop = savedState.catalogState.scrollPosition;
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error('Error restoring scroll position:', error);
        }
    }

    // Get current category state
    getCategoryState() {
        if (window.telegramCategoryPage && window.telegramCategoryPage.page && window.telegramCategoryPage.page.classList.contains('active')) {
            return {
                categoryId: window.telegramCategoryPage.currentCategory,
                title: document.getElementById('tgCategoryPageTitle')?.textContent || '',
                isOpen: true
            };
        }
        return null;
    }

    // Restore catalog state
    restoreCatalogState(savedState) {
        if (!savedState || !savedState.catalogState) return;
        
        const catalogState = savedState.catalogState;
        
        // Restore search query
        if (catalogState.searchQuery) {
            const searchInput = document.getElementById('catalogSearch');
            if (searchInput) {
                searchInput.value = catalogState.searchQuery;
                // Trigger search if catalog is initialized
                const catalog = window.telegramCatalog;
                if (catalog) {
                    catalog.renderBrands(catalogState.searchQuery);
                }
            }
        }
        
        // Restore scroll position (will be called separately after render)
        // This is handled in restoreCatalogScrollPosition()
        
        // Restore selected brand (category page) if it was open
        if (catalogState.selectedBrand && catalogState.selectedBrand.categoryId) {
            // Store category info for restoration after catalog loads
            this.pendingCategoryRestore = catalogState.selectedBrand;
        }
    }

    async navigate(href) {
        const page = href.replace('#', '');
        await this.showPage(page);
    }

    // Remember product opened on the current page
    setActiveProduct(productId) {
        if (!this.currentPage || !productId) return;
        this.activeProductsByPage[this.currentPage] = { productId };
        this.saveState();
    }

    // Clear active product only for current page (когда пользователь сам закрывает товар)
    clearActiveProductForCurrentPage() {
        if (!this.currentPage) return;
        if (this.activeProductsByPage && this.activeProductsByPage[this.currentPage]) {
            delete this.activeProductsByPage[this.currentPage];
            this.saveState();
        }
    }

    hideCartFooter() {
        const cartFooter = document.getElementById('tgCartFooter');
        if (cartFooter) {
            cartFooter.style.display = 'none';
        }
    }

    getPageContainers(page) {
        const logo = document.querySelector('.tg-logo-card');
        const main = document.getElementById('mainContent');
        const catalog = document.getElementById('catalogPage');
        const cart = document.getElementById('tgCartPage');
        const fav = document.getElementById('tgFavoritesPage');
        const profile = document.getElementById('tgProfilePage');
        switch (page) {
            case 'home': return [logo, main].filter(Boolean);
            case 'catalog': return [logo, catalog].filter(Boolean);
            case 'cart': return [cart].filter(Boolean);
            case 'favorites': return [fav].filter(Boolean);
            case 'profile': return [profile].filter(Boolean);
            default: return [];
        }
    }

    async fadeOutContainers(containers) {
        if (!containers.length) return;
        containers.forEach(el => {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
        });
        await new Promise(r => setTimeout(r, 500));
    }

    async fadeInContainers(containers) {
        if (!containers.length) return;
        containers.forEach(el => {
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
        });
        await new Promise(r => requestAnimationFrame(() => r()));
        containers.forEach(el => { el.style.opacity = '1'; });
        await new Promise(r => setTimeout(r, 500));
    }

    async showPage(page) {
        const mainContent = document.getElementById('mainContent');
        const catalogPage = document.getElementById('catalogPage');
        const bottomNav = document.querySelector('.tg-bottom-nav');
        const previousPage = this.currentPage;
        const pagesWithLogo = ['home', 'catalog'];
        
        this.isLoading = true;
        this.setNavigationDisabled(true);

        try {

        // Проверяем состояние модалки ДО переключения вкладки
        let shouldKeepModalOpen = false;
        if (window.telegramProductModal && window.telegramProductModal.modal) {
            const modal = window.telegramProductModal.modal;
            const isModalActive = modal.classList.contains('active');
            const currentProductId = window.telegramProductModal.currentProduct?.id;
            const savedProduct = this.activeProductsByPage && this.activeProductsByPage[page];
            const savedProductId = savedProduct?.productId;
            if (isModalActive && savedProductId && currentProductId === savedProductId) {
                shouldKeepModalOpen = true;
            }
        }

        // Save current scroll position if catalog is visible
        if (this.currentPage === 'catalog' && catalogPage && catalogPage.style.display !== 'none') {
            this.saveCatalogScrollPosition();
        }

        // =============================================
        // ФАЗА 1: Загрузка контента новой вкладки в фоне (невидимо)
        // Пользователь остаётся на старой вкладке
        // При первом запуске (previousPage === page) — просто показываем страницу
        // =============================================
        if (previousPage === page) {
            // Первый запуск или повторный вызов той же страницы — ничего не загружаем
            // Просто убеждаемся что контейнеры видимы
            if (page === 'home' || !['catalog','cart','favorites','profile'].includes(page)) {
                if (mainContent) { mainContent.style.display = 'block'; mainContent.style.opacity = '1'; }
            } else if (page === 'catalog') {
                if (catalogPage) { catalogPage.style.display = 'block'; catalogPage.style.opacity = '1'; }
            }
            if (bottomNav) bottomNav.style.display = 'flex';
            this.isLoading = false;
            this.setNavigationDisabled(false);
            return;
        }
        
        if (page === 'catalog') {
            this.saveState();
            
            // Подготавливаем каталог невидимо
            if (catalogPage) {
                catalogPage.style.display = 'block';
                catalogPage.style.transition = 'none';
                catalogPage.style.opacity = '0';
            }
            
            // Initialize catalog and wait for full load
            if (window.initCatalog) {
                await window.initCatalog();
                const brandsGrid = document.getElementById('brandsGrid');
                if (brandsGrid) {
                    const imgs = brandsGrid.querySelectorAll('img');
                    if (imgs.length > 0) {
                        await Promise.all(Array.from(imgs).map(img => {
                            if (img.complete) return Promise.resolve();
                            return new Promise(r => { img.onload = img.onerror = r; });
                        }));
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                const savedState = this.loadState();
                if (savedState) {
                    this.restoreCatalogState(savedState);
                }
                this.restoreCatalogScrollPosition();
                if (this.pendingCategoryRestore) {
                    await this.restoreCategoryPage(this.pendingCategoryRestore);
                    this.pendingCategoryRestore = null;
                }
            } else {
                this.restoreCatalogScrollPosition();
            }

        } else if (page === 'cart') {
            this.saveState();
            // Показываем корзину невидимо и ждём рендера
            if (window.telegramCartPage) {
                window.telegramCartPage.show();
                const cartEl = document.getElementById('tgCartPage');
                if (cartEl) { cartEl.style.transition = 'none'; cartEl.style.opacity = '0'; }
                await new Promise(resolve => {
                    const checkRender = () => {
                        if (document.getElementById('tgCartItems') || document.getElementById('tgCartEmpty')) {
                            resolve();
                        } else {
                            setTimeout(checkRender, 50);
                        }
                    };
                    checkRender();
                });
            }

        } else if (page === 'favorites') {
            this.saveState();
            if (window.telegramFavoritesPage) {
                window.telegramFavoritesPage.show();
                const favEl = document.getElementById('tgFavoritesPage');
                if (favEl) { favEl.style.transition = 'none'; favEl.style.opacity = '0'; }
                await new Promise(resolve => {
                    const checkRender = () => {
                        const itemsContainer = document.getElementById('tgFavoritesItems');
                        const emptyState = document.getElementById('tgFavoritesEmpty');
                        if (itemsContainer || (emptyState && emptyState.style.display !== 'none')) {
                            resolve();
                        } else {
                            setTimeout(checkRender, 50);
                        }
                    };
                    setTimeout(checkRender, 100);
                });
            }

        } else if (page === 'profile') {
            this.saveState();
            if (window.telegramProfilePage) {
                await window.telegramProfilePage.show();
                const profEl = document.getElementById('tgProfilePage');
                if (profEl) { profEl.style.transition = 'none'; profEl.style.opacity = '0'; }
            }

        } else {
            // home
            this.saveState();
            
            if (mainContent) {
                mainContent.style.display = 'block';
                mainContent.style.transition = 'none';
                mainContent.style.opacity = '0';
            }
            
            // Ждем загрузки главной страницы
            if (window.telegramMiniAppLoader) {
                await new Promise(resolve => {
                    const checkLoaded = () => {
                        const mc = document.getElementById('mainContent');
                        if (mc && mc.querySelectorAll('.tg-section').length > 0) {
                            resolve();
                        } else if (window.telegramMiniAppLoader.categories && Object.keys(window.telegramMiniAppLoader.categories).length > 0) {
                            setTimeout(() => {
                                const mc2 = document.getElementById('mainContent');
                                if (mc2 && mc2.querySelectorAll('.tg-section').length > 0) resolve();
                                else resolve();
                            }, 300);
                        } else {
                            setTimeout(checkLoaded, 100);
                        }
                    };
                    checkLoaded();
                });
            } else {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Ждём загрузки хотя бы 1 обложки товара
            await this.waitForFirstImage('#mainContent');
        }

        // =============================================
        // ФАЗА 2: Контент загружен — переключаем визуально
        // =============================================
        
        // Закрываем оверлеи только сейчас
        if (page !== 'catalog') {
            if (window.telegramCategoryPage && window.telegramCategoryPage.page && window.telegramCategoryPage.page.classList.contains('active')) {
                window.telegramCategoryPage.close();
            }
        } else {
            const categoryWasOpen = window.telegramCategoryPage && 
                                   window.telegramCategoryPage.page && 
                                   window.telegramCategoryPage.page.classList.contains('active');
            if (categoryWasOpen) {
                const categoryState = this.getCategoryState();
                if (categoryState) {
                    let savedState = this.loadState() || {};
                    savedState.catalogState = savedState.catalogState || {};
                    savedState.catalogState.selectedBrand = {
                        categoryId: categoryState.categoryId,
                        title: categoryState.title
                    };
                    sessionStorage.setItem('tgNavigationState', JSON.stringify(savedState));
                }
                window.telegramCategoryPage.close();
            }
        }
        
        // Закрываем оверлей-страницы которые не нужны новой вкладке
        if (page !== 'cart' && window.telegramCartPage) window.telegramCartPage.close();
        if (page !== 'favorites' && window.telegramFavoritesPage) window.telegramFavoritesPage.close();
        if (page !== 'profile' && window.telegramProfilePage) window.telegramProfilePage.close();
        if (window.telegramRoulettePage) window.telegramRoulettePage.close();
        if (window.telegramPrivacyPage) window.telegramPrivacyPage.close();
        if (window.telegramCheckout) window.telegramCheckout.close();
        
        if (page !== 'cart') this.hideCartFooter();
        
        // Применяем обложку для новой вкладки
        if (page === 'catalog') {
            await this.applyCatalogCover();
        } else if (page === 'home' || !pagesWithLogo.includes(page)) {
            await this.applyHomeLogo();
        }
        
        // Обновляем активную вкладку в навигации
        document.querySelectorAll('.tg-nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${page}`) {
                item.classList.add('active');
            }
        });
        
        if (bottomNav) bottomNav.style.display = 'flex';
        
        // Показываем нужные контейнеры
        if (page === 'home') {
            if (mainContent) mainContent.style.display = 'block';
        } else if (page === 'catalog') {
            if (catalogPage) catalogPage.style.display = 'block';
        }
        
        this.currentPage = page === 'home' || !['catalog','cart','favorites','profile'].includes(page) ? 'home' : page;
        
        // Плавное переключение: потухание старой, появление новой
        if (previousPage !== this.currentPage) {
            const logo = document.querySelector('.tg-logo-card');
            const oldHasLogo = pagesWithLogo.includes(previousPage);
            const newHasLogo = pagesWithLogo.includes(this.currentPage);
            const skipLogo = oldHasLogo && newHasLogo;
            
            const oldContainers = this.getPageContainers(previousPage);
            const newContainers = this.getPageContainers(this.currentPage);
            const toFadeOut = oldContainers.filter(el => !(el === logo && skipLogo));
            const toFadeIn = newContainers.filter(el => !(el === logo && skipLogo));
            
            // Одновременное потухание/появление
            await Promise.all([
                this.fadeOutContainers(toFadeOut),
                this.fadeInContainers(toFadeIn)
            ]);
            
            // Скрываем старые контейнеры ПОСЛЕ анимации
            if (this.currentPage !== 'home' && mainContent) mainContent.style.display = 'none';
            if (this.currentPage !== 'catalog' && catalogPage) catalogPage.style.display = 'none';
        }
        
        // Save state after page change
        this.saveState();

        // Умная логика управления модалкой товара при переключении вкладок
        if (!shouldKeepModalOpen && window.telegramProductModal && window.telegramProductModal.modal) {
            const modal = window.telegramProductModal.modal;
            const isModalActive = modal.classList.contains('active');
            const currentProductId = window.telegramProductModal.currentProduct?.id;
            
            const savedProduct = this.activeProductsByPage && this.activeProductsByPage[this.currentPage];
            const savedProductId = savedProduct?.productId;
            
            if (savedProductId) {
                if (!isModalActive) {
                    if (currentProductId === savedProductId && typeof window.telegramProductModal.showExisting === 'function') {
                        window.telegramProductModal.showExisting();
                    } else {
                        window.telegramProductModal.open(savedProductId);
                    }
                } else if (isModalActive && currentProductId !== savedProductId) {
                    window.telegramProductModal.close(false);
                    window.telegramProductModal.open(savedProductId);
                }
            } else {
                if (isModalActive) {
                    window.telegramProductModal.close(false);
                }
            }
        }

        } catch (error) {
            console.error('Error loading page:', error);
        } finally {
            this.isLoading = false;
            this.setNavigationDisabled(false);
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }
    }

    waitForFirstImage(containerSelector) {
        return new Promise((resolve) => {
            const fallback = setTimeout(resolve, 3000);
            const check = () => {
                const container = document.querySelector(containerSelector);
                if (!container) { clearTimeout(fallback); resolve(); return; }
                const imgs = container.querySelectorAll('img');
                for (const img of imgs) {
                    if (!img.src || img.src.startsWith('data:')) continue;
                    if (img.complete && img.naturalHeight !== 0) {
                        clearTimeout(fallback);
                        resolve();
                        return;
                    }
                    img.addEventListener('load', () => { clearTimeout(fallback); resolve(); }, { once: true });
                    img.addEventListener('error', () => { clearTimeout(fallback); resolve(); }, { once: true });
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
    }

    async applyCatalogCover() {
        const logoContent = document.querySelector('.tg-logo-content');
        if (!logoContent) return;
        
        // Сначала из кэша (без задержки) — глобальные переменные или localStorage
        let catalogCovers = window.catalogCoverImages || (window.catalogCoverImage ? [window.catalogCoverImage] : []);
        if (catalogCovers.length === 0) {
            try {
                const saved = localStorage.getItem('tg_miniapp_design_settings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
                }
            } catch (e) {}
        }
        
        this.applyCatalogCoverToElement(logoContent, catalogCovers);
        
        // Фоновое обновление с сервера (без блокировки переключения)
        fetch('/api/telegram/design-settings').then(r => r.ok ? r.json() : null).then(serverSettings => {
            if (serverSettings) {
                const fromServer = serverSettings.catalogCovers || (serverSettings.catalogCover ? [serverSettings.catalogCover] : []);
                if (fromServer.length > 0) {
                    const localSettings = JSON.parse(localStorage.getItem('tg_miniapp_design_settings') || '{}');
                    localSettings.catalogCovers = fromServer;
                    localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(localSettings));
                    const norm = item => typeof item === 'string' ? { url: item, type: /data:video\/|\.(mp4|webm|ogg|mov)(\?|$)/i.test(item) ? 'video' : 'image' } : item;
                    window.catalogCoverImages = fromServer.map(norm);
                }
            }
        }).catch(() => {});
    }
    
    applyCatalogCoverToElement(logoContent, catalogCovers) {
        if (catalogCovers.length > 0) {
            // Нормализуем формат (поддерживаем старый формат строк и новый формат объектов)
            const normalizedCovers = catalogCovers.map(item => {
                if (typeof item === 'string') {
                    const url = item;
                    const isVideo = url.startsWith('data:video/') || 
                                   url.endsWith('.mp4') || 
                                   url.endsWith('.webm') || 
                                   url.endsWith('.ogg') || 
                                   url.endsWith('.mov');
                    return { url: url, type: isVideo ? 'video' : 'image' };
                }
                return item;
            });
            
            console.log('Applying catalog covers:', normalizedCovers.length);
            
            // Сохраняем массив обложек в data-атрибут
            logoContent.setAttribute('data-logo-images', JSON.stringify(normalizedCovers));
            logoContent.setAttribute('data-current-index', '0');
            logoContent.setAttribute('data-cover-type', 'catalog'); // Помечаем что это обложка каталога
            
            // Применяем первую обложку
            if (window.telegramMiniAppLoader && typeof window.telegramMiniAppLoader.applyLogoContent === 'function') {
                window.telegramMiniAppLoader.applyLogoContent(logoContent, normalizedCovers[0]);
            } else {
                // Fallback если метод не доступен
                this.applyLogoContentDirect(logoContent, normalizedCovers[0]);
            }
            
            // Инициализируем листание если еще не инициализировано
            if (!logoContent.hasAttribute('data-swipe-initialized')) {
                if (window.telegramMiniAppLoader && typeof window.telegramMiniAppLoader.initLogoSwipe === 'function') {
                    window.telegramMiniAppLoader.initLogoSwipe(logoContent);
                }
            }
        } else {
            // Нет обложки каталога - очищаем
            console.log('No catalog covers found, clearing logo content');
            logoContent.removeAttribute('data-logo-images');
            logoContent.removeAttribute('data-current-index');
            logoContent.removeAttribute('data-cover-type');
            logoContent.innerHTML = '';
            logoContent.style.backgroundImage = '';
            logoContent.style.backgroundSize = '';
            logoContent.style.backgroundPosition = '';
            logoContent.style.backgroundRepeat = '';
            logoContent.style.aspectRatio = '';
        }
    }
    
    async applyHomeLogo() {
        const logoContent = document.querySelector('.tg-logo-content');
        if (!logoContent) return;
        
        // Сначала из кэша (без задержки)
        let logoImages = window.homeLogoImages || [];
        if (logoImages.length === 0) {
            try {
                const saved = localStorage.getItem('tg_miniapp_design_settings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    logoImages = settings.logoImages || (settings.logoImage ? [settings.logoImage] : []);
                }
            } catch (e) {}
        }
        
        this.applyHomeLogoToElement(logoContent, logoImages);
        
        // Фоновое обновление с сервера
        fetch('/api/telegram/design-settings').then(r => r.ok ? r.json() : null).then(serverSettings => {
            if (serverSettings) {
                const fromServer = serverSettings.logoImages || (serverSettings.logoImage ? [serverSettings.logoImage] : []);
                if (fromServer.length > 0) {
                    window.homeLogoImages = fromServer;
                    const localSettings = JSON.parse(localStorage.getItem('tg_miniapp_design_settings') || '{}');
                    localSettings.logoImages = fromServer;
                    localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(localSettings));
                    this.applyHomeLogoToElement(logoContent, fromServer);
                }
            }
        }).catch(() => {});
    }
    
    applyHomeLogoToElement(logoContent, logoImages) {
        if (logoImages.length > 0) {
            // Нормализуем формат
            const normalizedImages = logoImages.map(item => {
                if (typeof item === 'string') {
                    const url = item;
                    const isVideo = url.startsWith('data:video/') || 
                                   url.endsWith('.mp4') || 
                                   url.endsWith('.webm') || 
                                   url.endsWith('.ogg') || 
                                   url.endsWith('.mov');
                    return { url: url, type: isVideo ? 'video' : 'image' };
                }
                return item;
            });
            
            console.log('Applying home logo images:', normalizedImages.length);
            
            // Сохраняем массив изображений/видео в data-атрибут
            logoContent.setAttribute('data-logo-images', JSON.stringify(normalizedImages));
            logoContent.setAttribute('data-current-index', '0');
            logoContent.setAttribute('data-cover-type', 'home'); // Помечаем что это обложка главной
            
            // Применяем первый элемент
            if (window.telegramMiniAppLoader && typeof window.telegramMiniAppLoader.applyLogoContent === 'function') {
                window.telegramMiniAppLoader.applyLogoContent(logoContent, normalizedImages[0]);
            } else {
                this.applyLogoContentDirect(logoContent, normalizedImages[0]);
            }
            
            // Инициализируем листание если еще не инициализировано
            if (!logoContent.hasAttribute('data-swipe-initialized')) {
                if (window.telegramMiniAppLoader && typeof window.telegramMiniAppLoader.initLogoSwipe === 'function') {
                    window.telegramMiniAppLoader.initLogoSwipe(logoContent);
                }
            }
        } else {
            // Нет логотипов - очищаем
            console.log('No home logo images found, clearing logo content');
            logoContent.removeAttribute('data-logo-images');
            logoContent.removeAttribute('data-current-index');
            logoContent.removeAttribute('data-cover-type');
            logoContent.innerHTML = '';
            logoContent.style.backgroundImage = '';
            logoContent.style.backgroundSize = '';
            logoContent.style.backgroundPosition = '';
            logoContent.style.backgroundRepeat = '';
            logoContent.style.aspectRatio = '';
        }
    }
    
    isVideoUrl(url) {
        if (!url || typeof url !== 'string') return false;
        const lower = url.toLowerCase();
        return lower.startsWith('data:video/') || 
               /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(lower) ||
               lower.includes('/video/');
    }

    createCoverLoader() {
        const loader = document.createElement('div');
        loader.className = 'tg-cover-loader';
        loader.setProgress = () => {};
        return loader;
    }

    applyLogoContentDirect(logoContent, item) {
        let url = typeof item === 'string' ? item : (item?.url || item);
        const explicitType = typeof item === 'object' && item ? item.type : null;
        const type = explicitType === 'video' || (explicitType !== 'image' && this.isVideoUrl(url)) ? 'video' : 'image';
        
        // iOS fix: convert data:video URLs to blob URLs (iOS has data URL size limits)
        if (typeof url === 'string' && url.startsWith('data:video/') && window._iosVideoFix && window._iosVideoFix.dataUrlToBlob) {
            const blobUrl = window._iosVideoFix.dataUrlToBlob(url);
            if (blobUrl) url = blobUrl;
        }
        
        logoContent.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'tg-cover-placeholder';
        logoContent.appendChild(placeholder);
        const loader = this.createCoverLoader();
        logoContent.appendChild(loader);
        const hideLoader = () => {
            loader.classList.add('tg-cover-loader-hidden');
            placeholder.style.opacity = '0';
            placeholder.style.pointerEvents = 'none';
        };
        
        const setImgAndHide = (src) => {
            if (loader.setProgress) loader.setProgress(100);
            hideLoader();
            logoContent.style.backgroundImage = `url(${src})`;
        };
        
        if (type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            video.style.aspectRatio = '16 / 9';
            video.style.display = 'block';
            // Set transparent poster to hide browser play button overlay
            video.poster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            
            video.setAttribute('autoplay', '');
            video.setAttribute('loop', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('preload', 'auto');
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.autoplay = true;
            video.onerror = () => { loader.remove(); logoContent.innerHTML = ''; logoContent.style.backgroundImage = ''; };
            video.onloadedmetadata = () => { video.currentTime = 0; };
            video.onloadeddata = () => {
                video.currentTime = 0;
                hideLoader();
                video.play().catch(() => {});
            };
            video.oncanplay = () => { hideLoader(); video.play().catch(() => {}); };
            logoContent.appendChild(video);
            video.load();
            video.play().catch(() => {});
            setTimeout(() => video.play().catch(() => {}), 100);
            setTimeout(() => video.play().catch(() => {}), 500);
            if (window._iosVideoFix) window._iosVideoFix.applyToVideo(video);
            logoContent.style.backgroundImage = '';
            logoContent.style.backgroundSize = '';
            logoContent.style.backgroundPosition = '';
            logoContent.style.backgroundRepeat = '';
            logoContent.style.aspectRatio = '16 / 9';
            
            // Hold-to-pause on video covers (iOS-friendly)
            let holdTimer = null;
            const handlePointerDown = (e) => {
                e.preventDefault();
                if (!video.paused) {
                    holdTimer = setTimeout(() => {
                        video.pause();
                        video.style.opacity = '0.7';
                        video.style.filter = 'brightness(0.7)';
                    }, 200);
                }
            };
            const handlePointerUp = (e) => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
                video.style.opacity = '';
                video.style.filter = '';
                if (video.paused && video.readyState >= 2) {
                    video.play().catch(() => {});
                }
            };
            const handlePointerCancel = () => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
                video.style.opacity = '';
                video.style.filter = '';
                if (video.paused && video.readyState >= 2) {
                    video.play().catch(() => {});
                }
            };
            video.addEventListener('pointerdown', handlePointerDown, { passive: false });
            video.addEventListener('pointerup', handlePointerUp);
            video.addEventListener('pointercancel', handlePointerCancel);
            video.addEventListener('pointerleave', handlePointerCancel);
        } else {
            logoContent.style.backgroundSize = 'cover';
            logoContent.style.backgroundPosition = 'center';
            logoContent.style.backgroundRepeat = 'no-repeat';
            logoContent.style.aspectRatio = '16 / 9';
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                const img = new Image();
                img.onerror = () => { loader.remove(); };
                img.onload = () => setImgAndHide(url);
                img.src = url;
            } else {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.responseType = 'blob';
                xhr.onprogress = (e) => {
                    if (e.lengthComputable && loader.setProgress) loader.setProgress((e.loaded / e.total) * 100);
                };
                xhr.onload = () => {
                    if (xhr.status === 200) setImgAndHide(URL.createObjectURL(xhr.response));
                    else { const img = new Image(); img.onerror = () => loader.remove(); img.onload = () => setImgAndHide(url); img.src = url; }
                };
                xhr.onerror = () => { const img = new Image(); img.onerror = () => loader.remove(); img.onload = () => setImgAndHide(url); img.src = url; };
                xhr.send();
            }
        }
    }

    // Блокировка/разблокировка навигации
    setNavigationDisabled(disabled) {
        const navItems = document.querySelectorAll('.tg-nav-item');
        navItems.forEach(item => {
            if (disabled) {
                item.style.pointerEvents = 'none';
                item.style.opacity = '0.5';
            } else {
                item.style.pointerEvents = '';
                item.style.opacity = '';
            }
        });
    }

    // Restore category page from saved state
    async restoreCategoryPage(categoryInfo) {
        if (!categoryInfo || !categoryInfo.categoryId) return;
        
        // Extract brand ID from category ID (format: brand-{id})
        if (categoryInfo.categoryId.startsWith('brand-')) {
            const brandId = categoryInfo.categoryId.replace('brand-', '');
            
            // Get catalog instance (use global instance if available)
            let catalog = window.telegramCatalog;
            if (!catalog && window.initCatalog) {
                catalog = await window.initCatalog();
            }
            
            if (catalog) {
                // Wait for brands and products to load if needed
                if (!catalog.brands || catalog.brands.length === 0) {
                    await catalog.loadBrands();
                }
                if (!catalog.allProducts || catalog.allProducts.length === 0) {
                    await catalog.loadProducts();
                }
                
                const brand = catalog.brands.find(b => b.id === brandId);
                if (brand) {
                    const brandProducts = catalog.allProducts.filter(p => p.brandId === brandId);
                    if (brandProducts.length > 0) {
                        // Open category page with saved brand
                        if (window.telegramCategoryPage) {
                            window.telegramCategoryPage.open(categoryInfo.categoryId, brand.name, brandProducts);
                        }
                    }
                }
            }
        }
    }
}

// Initialize navigation when DOM is ready
let telegramNavigation = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramNavigation = new TelegramNavigation();
        window.telegramNavigation = telegramNavigation;
    });
} else {
    telegramNavigation = new TelegramNavigation();
    window.telegramNavigation = telegramNavigation;
}
