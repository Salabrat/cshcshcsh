// Telegram Mini App Catalog (Brands) Loader
class TelegramCatalog {
    constructor() {
        this.brands = [];
        this.allProducts = [];
        this.init();
    }

    async init() {
        await this.loadProducts();
        await this.loadBrands();
        
        // Загружаем обложку каталога из настроек дизайна
        this.loadCatalogCover();
        
        this.renderBrands();
        
        // Notify page loader that data is loaded
        if (window.telegramPageLoader) {
            window.dispatchEvent(new CustomEvent('tgDataLoaded'));
        }
    }
    
    async loadCatalogCover() {
        try {
            // Сначала пытаемся загрузить с сервера
            try {
                const response = await fetch('/api/telegram/design-settings');
                if (response.ok) {
                    const serverSettings = await response.json();
                    const catalogCovers = serverSettings.catalogCovers || (serverSettings.catalogCover ? [serverSettings.catalogCover] : []);
                    if (catalogCovers.length > 0) {
                        // Нормализуем формат (поддерживаем старый формат строк и новый формат объектов)
                        const normalizedCovers = catalogCovers.map(item => {
                            if (typeof item === 'string') {
                                return { url: item, type: item.startsWith('data:video/') || item.endsWith('.mp4') || item.endsWith('.webm') || item.endsWith('.ogg') || item.endsWith('.mov') ? 'video' : 'image' };
                            }
                            return item;
                        });
                        window.catalogCoverImages = normalizedCovers;
                        window.catalogCoverImage = normalizedCovers[0];
                        window.catalogCoverCurrentIndex = 0;
                        console.log('✅ Catalog covers loaded from server:', normalizedCovers.length);
                        // Синхронизируем с localStorage
                        const localSettings = JSON.parse(localStorage.getItem('tg_miniapp_design_settings') || '{}');
                        localSettings.catalogCovers = catalogCovers;
                        if (localSettings.catalogCover) delete localSettings.catalogCover;
                        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(localSettings));
                        return;
                    }
                }
            } catch (serverError) {
                console.warn('⚠️ Failed to load catalog covers from server, using localStorage:', serverError);
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem('tg_miniapp_design_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                // Поддерживаем как массив, так и одиночное значение для обратной совместимости
                const catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
                if (catalogCovers.length > 0) {
                    // Нормализуем формат (поддерживаем старый формат строк и новый формат объектов)
                    const normalizedCovers = catalogCovers.map(item => {
                        if (typeof item === 'string') {
                            return { url: item, type: item.startsWith('data:video/') || item.endsWith('.mp4') || item.endsWith('.webm') || item.endsWith('.ogg') || item.endsWith('.mov') ? 'video' : 'image' };
                        }
                        return item;
                    });
                    window.catalogCoverImages = normalizedCovers;
                    window.catalogCoverImage = normalizedCovers[0]; // Первая обложка по умолчанию
                    window.catalogCoverCurrentIndex = 0;
                    console.log('✅ Catalog covers loaded from localStorage:', normalizedCovers.length);
                } else {
                    delete window.catalogCoverImages;
                    delete window.catalogCoverImage;
                    delete window.catalogCoverCurrentIndex;
                    console.log('ℹ️ No catalog covers in settings');
                }
            } else {
                delete window.catalogCoverImages;
                delete window.catalogCoverImage;
                delete window.catalogCoverCurrentIndex;
            }
        } catch (error) {
            console.error('❌ Error loading catalog covers:', error);
            delete window.catalogCoverImages;
            delete window.catalogCoverImage;
            delete window.catalogCoverCurrentIndex;
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error('Failed to load products');
            }

            const data = await response.json();
            this.allProducts = [];

            // Flatten products from all categories
            if (data.products) {
                Object.values(data.products).forEach(categoryProducts => {
                    if (Array.isArray(categoryProducts)) {
                        this.allProducts.push(...categoryProducts);
                    }
                });
            }

            console.log(`Loaded ${this.allProducts.length} products for catalog`);
        } catch (error) {
            console.error('Error loading products:', error);
            this.allProducts = [];
        }
    }

    async loadBrands() {
        try {
            const response = await fetch('/api/brands');
            if (!response.ok) {
                throw new Error('Failed to load brands');
            }

            const brands = await response.json();
            // Only show active brands and sort A-Z
            this.brands = brands
                .filter(brand => brand.isActive === true)
                .sort((a, b) => {
                    const nameA = (a.name || '').trim();
                    const nameB = (b.name || '').trim();
                    return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
                });

            console.log(`Loaded ${this.brands.length} brands`);
        } catch (error) {
            console.error('Error loading brands:', error);
            this.brands = [];
        }
    }

    getBrandProductCount(brandId) {
        return this.allProducts.filter(p => p.brandId === brandId).length;
    }

    getBrandImage(brand) {
        // Приоритет: обложка для каталога, затем логотип, затем image
        if (brand.cover) return brand.cover;
        if (brand.logo) return brand.logo;
        if (brand.image) return brand.image;
        return null;
    }

    renderBrands() {
        const grid = document.getElementById('brandsGrid');
        if (!grid) return;

        if (this.brands.length === 0) {
            grid.innerHTML = '<div class="tg-empty"><div class="tg-empty-text">Бренды не найдены</div></div>';
            return;
        }

        grid.innerHTML = this.brands.map(brand => this.createBrandCard(brand)).join('');

        // Add click handlers
        grid.querySelectorAll('.tg-brand-card').forEach((card, index) => {
            const brand = this.brands[index];
            const logoContainer = card.querySelector('.tg-brand-logo-container');
            const coverElement = card.querySelector('.tg-brand-cover');
            
            // Если есть несколько обложек, добавляем листание по нажатию на обложку
            if (coverElement && card.dataset.catalogCovers) {
                try {
                    const covers = JSON.parse(card.dataset.catalogCovers);
                    if (covers.length > 1) {
                        let currentIndex = parseInt(coverElement.dataset.coverIndex || '0');
                        
                        logoContainer.addEventListener('click', (e) => {
                            e.stopPropagation();
                            
                            // Переключаем на следующую обложку
                            currentIndex = (currentIndex + 1) % covers.length;
                            const nextCover = covers[currentIndex];
                            
                            // Обновляем обложку
                            const cssUrl = nextCover.replace(/'/g, "\\'").replace(/"/g, '\\"');
                            coverElement.style.backgroundImage = `url('${cssUrl}')`;
                            coverElement.setAttribute('data-cover-index', currentIndex.toString());
                            
                            // Обновляем индикатор
                            const indicator = card.querySelector('.tg-brand-cover-indicator');
                            if (indicator) {
                                indicator.textContent = (currentIndex + 1) + '/' + covers.length;
                            }
                            
                            // Тактильная обратная связь
                            if (window.telegramWebApp) {
                                window.telegramWebApp.hapticFeedback('light');
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error parsing catalog covers:', error);
                }
            }
            
            // Обработчик клика на карточку для открытия бренда
            card.addEventListener('click', (e) => {
                // Не открываем бренд если кликнули на обложку с листанием
                if (e.target.closest('.tg-brand-cover') && coverElement && card.dataset.catalogCovers) {
                    return;
                }
                this.openBrand(brand);
            });
        });
    }

    createBrandCard(brand) {
        const productCount = this.getBrandProductCount(brand.id);
        const imageUrl = this.getBrandImage(brand);
        const isEmpty = productCount === 0;
        const hasImage = imageUrl && imageUrl.trim() !== '' && imageUrl !== 'null' && imageUrl !== 'undefined';
        
        // Используем обложки из данных бренда (может быть массив)
        const brandCovers = brand.covers || (brand.cover ? [brand.cover] : []);
        const hasBrandCovers = brandCovers.length > 0;
        const currentCoverIndex = 0; // Начинаем с первой обложки
        const currentCover = hasBrandCovers ? brandCovers[currentCoverIndex] : null;

        let imageHtml = '';
        if (hasImage || hasBrandCovers) {
            // Если есть обложки бренда, используем текущую как фон, логотип показываем поверх
            if (hasBrandCovers && currentCover) {
                // Экранируем URL для CSS (заменяем одинарные кавычки и экранируем специальные символы)
                const cssUrl = currentCover.replace(/'/g, "\\'").replace(/"/g, '\\"');
                // Сохраняем индекс обложки и массив в data-атрибуты для листания
                imageHtml = `
                    <div class="tg-brand-cover" data-cover-index="${currentCoverIndex}" data-cover-count="${brandCovers.length}" style="background-image: url('${cssUrl}'); background-size: cover; background-position: center; width: 100%; height: 100%; position: absolute; top: 0; left: 0; border-radius: 16px; transition: background-image 0.3s ease;">
                    </div>
                    ${brand.logo ? `<img src="${this.escapeHtml(brand.logo)}" alt="${this.escapeHtml(brand.name)}" class="tg-brand-logo" style="position: relative; z-index: 1; max-width: 60%; max-height: 60%; object-fit: contain;" onerror="this.style.display='none';">` : ''}
                    ${brandCovers.length > 1 ? '<div class="tg-brand-cover-indicator" style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; z-index: 2;">' + (currentCoverIndex + 1) + '/' + brandCovers.length + '</div>' : ''}
                `;
            } else if (hasImage) {
                imageHtml = `<img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(brand.name)}" class="tg-brand-logo" onerror="this.style.display='none'; this.parentElement.querySelector('.tg-brand-no-image').style.display='flex';">`;
            } else {
                imageHtml = '<div class="tg-brand-no-image">Нет фото</div>';
            }
        } else {
            imageHtml = '<div class="tg-brand-no-image">Нет фото</div>';
        }

        const emptyOverlay = isEmpty ? '<div class="tg-brand-empty-overlay"><div class="tg-brand-empty-text">Категория пуста</div></div>' : '';

        const cardHtml = `
            <div class="tg-brand-card ${isEmpty ? 'tg-brand-empty' : ''}" ${hasBrandCovers && brandCovers.length > 1 ? 'data-brand-covers="' + this.escapeHtml(JSON.stringify(brandCovers)) + '"' : ''}>
                ${emptyOverlay}
                <div class="tg-brand-logo-container" style="${hasBrandCovers && currentCover ? 'position: relative; display: flex; align-items: center; justify-content: center; min-height: 200px; cursor: pointer;' : ''}">
                    ${imageHtml}
                </div>
                <div class="tg-brand-name">${this.escapeHtml(brand.name)}</div>
            </div>
        `;
        
        return cardHtml;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    openBrand(brand) {
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }

        // Get products for this brand
        const brandProducts = this.allProducts.filter(p => p.brandId === brand.id);
        const productCount = brandProducts.length;
        
        if (productCount === 0) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('В этой категории пока нет товаров');
            }
            return;
        }

        // Save state before opening brand
        if (window.telegramNavigation) {
            window.telegramNavigation.saveState();
        }

        // Open brand products in category page (2 columns layout)
        if (window.telegramCategoryPage) {
            window.telegramCategoryPage.open(`brand-${brand.id}`, brand.name, brandProducts);
        } else if (window.TelegramCategoryPage) {
            // Initialize if not already initialized
            window.telegramCategoryPage = new window.TelegramCategoryPage();
            window.telegramCategoryPage.open(`brand-${brand.id}`, brand.name, brandProducts);
        } else {
            console.error('Category page not available');
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Ошибка открытия категории');
            }
        }
        
        // Save state after opening brand
        if (window.telegramNavigation) {
            window.telegramNavigation.saveState();
        }
    }
}

// Initialize catalog when catalog page is shown
let catalogInstance = null;

async function initCatalog() {
    const catalogPage = document.getElementById('catalogPage');
    if (!catalogPage) return null;
    
    // Only initialize if catalog page is visible
    if (catalogPage.style.display !== 'none' && !catalogInstance) {
        catalogInstance = new TelegramCatalog();
        await catalogInstance.init();
    } else if (catalogInstance) {
        // Reload brands if already initialized
        await catalogInstance.loadCatalogCover();
        await catalogInstance.loadProducts();
        await catalogInstance.loadBrands();
        catalogInstance.renderBrands();
    }
    
    // Make catalog instance globally available
    window.telegramCatalog = catalogInstance;
    
    return catalogInstance;
}

// Export for use in navigation
window.TelegramCatalog = TelegramCatalog;
window.initCatalog = initCatalog;
