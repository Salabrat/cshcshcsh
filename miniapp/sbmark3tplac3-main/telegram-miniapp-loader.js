// Telegram Mini App Product Loader - Mobile App Style
class TelegramMiniAppLoader {
    constructor() {
        this.products = [];
        this.adminCategories = []; // Categories created by admin
        this.categories = {}; // Dynamic categories based on admin categories
        this.coverArrowContainer = null;
        this.handleArrowClick = this.handleArrowClick.bind(this);
        this.ensurePaginationStyles();
        this.init();
        
        // Auto-refresh products and categories every 30 seconds
        setInterval(() => {
            this.loadCategories().then(() => {
                this.loadProducts().then(() => this.renderProducts());
            });
        }, 30000);
    }

    async loadData() {
        await this.loadCategories();
        await this.loadProducts();
        await this.refreshDesignSettings();
        this.renderProducts();
        if (window.telegramPageLoader) window.dispatchEvent(new CustomEvent('tgDataLoaded'));
    }

    async init() {
        try {
            console.log('TelegramMiniAppLoader: Starting initialization...');
            await this.loadData();
            
            // Apply design settings
            this.applyDesignSettings();
            await this.applySiteTitleFromSettings();
            console.log('TelegramMiniAppLoader: Initialization complete');
        } catch (error) {
            console.error('TelegramMiniAppLoader: Initialization failed:', error);
            // Continue anyway to prevent complete failure
        }
    }

    async applySiteTitleFromSettings() {
        try {
            const response = await fetch('/api/site-settings', { cache: 'no-store' });
            if (!response.ok) return;

            const settings = await response.json();
            const siteTitle = (settings && typeof settings.siteTitle === 'string') ? settings.siteTitle.trim() : '';
            const loadingText = (settings && typeof settings.loadingText === 'string') ? settings.loadingText.trim() : '';
            const siteName = (settings && typeof settings.siteName === 'string') ? settings.siteName.trim() : '';
            const miniAppTitle = siteTitle || loadingText || siteName;

            if (miniAppTitle) {
                document.title = miniAppTitle;
            }
        } catch (error) {
            // Ignore network errors to keep miniapp loading resilient
        }
    }
    
    getDesignSettings() {
        try {
            const saved = localStorage.getItem('tg_miniapp_design_settings');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading design settings:', error);
            return {};
        }
    }

    async refreshDesignSettings() {
        try {
            const response = await fetch('/api/telegram/design-settings', { cache: 'no-store' });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (!data || typeof data !== 'object') {
                return null;
            }

            try {
                localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(data));
            } catch (storageError) {
                console.warn('Unable to cache design settings in localStorage:', storageError);
            }

            window.__tgDesignSettings = data;

            if (data.rouletteBannerMedia) {
                const normalized = this.normalizeRouletteBannerMedia(data.rouletteBannerMedia);
                if (normalized) {
                    window.telegramRouletteBannerMedia = normalized;
                }
            }

            window.dispatchEvent(new CustomEvent('tgDesignSettingsReady', { detail: data }));

            return data;
        } catch (error) {
            console.warn('Failed to refresh design settings from server:', error);
            return null;
        }
    }

    detectMediaTypeFromUrl(url) {
        if (!url || typeof url !== 'string') return 'image';
        return (url.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)$/i.test(url)) ? 'video' : 'image';
    }

    normalizeRouletteBannerMedia(media) {
        if (!media) return null;
        if (typeof media === 'string') {
            return { url: media, type: this.detectMediaTypeFromUrl(media) };
        }
        const url = media.url || '';
        if (!url) return null;
        const type = media.type || this.detectMediaTypeFromUrl(url);
        return { url, type };
    }

    getRouletteBannerMedia() {
        const cached = this.normalizeRouletteBannerMedia(window.telegramRouletteBannerMedia);
        if (cached) {
            window.telegramRouletteBannerMedia = cached;
            return cached;
        }

        const settings = this.getDesignSettings();
        const normalized = this.normalizeRouletteBannerMedia(settings.rouletteBannerMedia);
        if (normalized) {
            window.telegramRouletteBannerMedia = normalized;
            return normalized;
        }

        delete window.telegramRouletteBannerMedia;
        return null;
    }
    
    applyDesignSettings() {
        const settings = this.getDesignSettings();

        // Apply mini app title
        if (settings && typeof settings.miniAppTitle === 'string' && settings.miniAppTitle.trim()) {
            document.title = settings.miniAppTitle.trim();
        }
        
        // НЕ применяем обложки здесь - это будет сделано в навигации в зависимости от текущей страницы
        // Просто сохраняем настройки в глобальные переменные для использования в навигации
        
        // Сохраняем обложки главной страницы
        const logoImages = settings.logoImages || (settings.logoImage ? [settings.logoImage] : []);
        if (logoImages.length > 0) {
            window.homeLogoImages = logoImages;
        } else {
            delete window.homeLogoImages;
        }
        
        // Сохраняем обложки каталога в глобальную переменную
        const catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
        if (catalogCovers.length > 0) {
            // Нормализуем формат
            const normalizedCovers = catalogCovers.map(item => {
                if (typeof item === 'string') {
                    return { url: item, type: item.startsWith('data:video/') || item.endsWith('.mp4') || item.endsWith('.webm') || item.endsWith('.ogg') || item.endsWith('.mov') ? 'video' : 'image' };
                }
                return item;
            });
            window.catalogCoverImages = normalizedCovers;
            window.catalogCoverImage = normalizedCovers[0];
            window.catalogCoverCurrentIndex = 0;
        } else {
            delete window.catalogCoverImages;
            delete window.catalogCoverImage;
            delete window.catalogCoverCurrentIndex;
        }
        
        // Обновляем каталог если он открыт
        if (window.telegramCatalog && window.telegramCatalog.renderBrands) {
            window.telegramCatalog.renderBrands();
        }
        
        // Apply background to html and body elements
        const htmlElement = document.documentElement;
        const bodyElement = document.body;
        
        if (settings.backgroundImage) {
            // Apply to html
            if (htmlElement) {
                htmlElement.style.setProperty('background-image', `url(${settings.backgroundImage})`, 'important');
                htmlElement.style.setProperty('background-size', 'cover', 'important'); // Cover entire viewport
                htmlElement.style.setProperty('background-position', 'center center', 'important');
                htmlElement.style.setProperty('background-repeat', 'no-repeat', 'important'); // No tiling
                htmlElement.style.setProperty('background-attachment', 'fixed', 'important');
            }
            // Apply to body for reliability
            if (bodyElement) {
                bodyElement.style.setProperty('background-image', `url(${settings.backgroundImage})`, 'important');
                bodyElement.style.setProperty('background-size', 'cover', 'important'); // Cover entire viewport
                bodyElement.style.setProperty('background-position', 'center center', 'important');
                bodyElement.style.setProperty('background-repeat', 'no-repeat', 'important'); // No tiling
                bodyElement.style.setProperty('background-attachment', 'fixed', 'important');
            }
        } else {
            // Remove background
            if (htmlElement) {
                htmlElement.style.removeProperty('background-image');
                htmlElement.style.removeProperty('background-size');
                htmlElement.style.removeProperty('background-position');
                htmlElement.style.removeProperty('background-repeat');
                htmlElement.style.removeProperty('background-attachment');
            }
            if (bodyElement) {
                bodyElement.style.removeProperty('background-image');
                bodyElement.style.removeProperty('background-size');
                bodyElement.style.removeProperty('background-position');
                bodyElement.style.removeProperty('background-repeat');
                bodyElement.style.removeProperty('background-attachment');
            }
        }
    }

    async loadCategories() {
        try {
            // Use /api/categories/all to get ALL categories including default ones
            const response = await fetch('/api/categories/all');
            if (!response.ok) {
                // Fallback to /api/categories if /all doesn't exist
                const fallbackResponse = await fetch('/api/categories');
                if (!fallbackResponse.ok) {
                    console.warn('Failed to load categories, using empty list');
                    this.adminCategories = [];
                    return;
                }
                const categories = await fallbackResponse.json();
                this.adminCategories = categories.filter(cat => 
                    !cat.name.includes('(RU)') && cat.isVisible !== false
                );
            } else {
                const allCategories = await response.json();
                
                // Filter out categories with (RU) in the name
                // Filter out hidden categories (isVisible === false)
                // Include both default and non-default categories
                this.adminCategories = allCategories.filter(cat => 
                    !cat.name.includes('(RU)') && cat.isVisible !== false
                );
            }

            // Initialize categories object based on admin categories
            this.categories = {};
            this.adminCategories.forEach(cat => {
                this.categories[cat.slug] = [];
            });

            // Always add "updates" for trending products
            this.categories['updates'] = [];

            console.log(`Loaded ${this.adminCategories.length} admin categories`);
        } catch (error) {
            console.error('Error loading categories:', error);
            this.adminCategories = [];
            this.categories = { 'updates': [] };
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                console.warn('Failed to load products, status:', response.status);
                this.products = [];
                this.categorizeProducts();
                return;
            }

            const data = await response.json();
            const allProducts = [];

            // Flatten products from all categories
            if (data.products) {
                Object.values(data.products).forEach(categoryProducts => {
                    if (Array.isArray(categoryProducts)) {
                        allProducts.push(...categoryProducts);
                    }
                });
            }

            this.products = allProducts;
            this.categorizeProducts();
            
            console.log(`Loaded ${allProducts.length} products`);
        } catch (error) {
            console.error('Error loading products:', error);
            // Don't show error to user, just use empty products
            this.products = [];
            this.categorizeProducts();
        }
    }

    categorizeProducts() {
        // Clear all categories
        Object.keys(this.categories).forEach(key => {
            this.categories[key] = [];
        });

        // First: Get trending products for "Обновление" section
        this.categories.updates = this.products.filter(p => p.isTrending === true);
        
        // Sort trending products by dateAdded (newest first)
        this.categories.updates.sort((a, b) => {
            const dateA = new Date(a.dateAdded || 0);
            const dateB = new Date(b.dateAdded || 0);
            return dateB - dateA; // Newest first
        });
        
        // If no trending products, use first few products for updates
        if (this.categories.updates.length === 0) {
            this.categories.updates = this.products.slice(0, 10);
        }

        // Then: Categorize ALL products by their category slug (including trending)
        this.products.forEach(product => {
            const productCategory = (product.category || '').toLowerCase();
            
            // Check if product category matches any admin category slug
            const adminCategory = this.adminCategories.find(cat => 
                cat.slug.toLowerCase() === productCategory
            );

            if (adminCategory && this.categories[adminCategory.slug]) {
                // Add product at the beginning (newest first)
                this.categories[adminCategory.slug].unshift(product);
                console.log(`Product "${product.name}" added to category "${adminCategory.slug}" (${adminCategory.name})`);
            } else {
                // Log unmatched products for debugging
                console.warn(`Product "${product.name}" with category "${productCategory}" not matched to any admin category. Available categories:`, 
                    this.adminCategories.map(c => c.slug).join(', '));
            }
        });

        console.log('Categorized products:', Object.keys(this.categories).map(k => ({
            category: k,
            count: this.categories[k].length,
            products: this.categories[k].slice(0, 3).map(p => p.name) // Show first 3 product names
        })));
        
        // Log all admin categories for debugging
        console.log('Admin categories loaded:', this.adminCategories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            isVisible: c.isVisible
        })));
    }

    renderProducts() {
        const mainContent = document.querySelector('.tg-main-content');
        if (!mainContent) return;

        // Preserve hero/cover section so load-hero-content.js keeps its target
        const heroSection = mainContent.querySelector('.hero-section');

        // Clear dynamic sections
        mainContent.innerHTML = '';
        if (heroSection) {
            mainContent.appendChild(heroSection);
        }

        // Roulette banner (injected before product sections)
        this.renderRouletteBanner(mainContent);

        // First, render "Обновление" section if there are trending products
        // Limit to maximum 10 products
        if (this.categories.updates && this.categories.updates.length > 0) {
            this.createSection('updates', 'Обновление');
            this.renderCategory('updates', 'updatesGrid', 10); // Limit to 10 products
        }

        // Отображаем все добавленные категории (включая пустые)
        this.adminCategories.forEach(category => {
            const slug = category.slug;
            this.createSection(slug, category.name);
            this.renderCategory(slug, slug + 'Grid');
        });
    }

    renderRouletteBanner(container) {
        const banner = document.createElement('div');
        banner.className = 'tg-roulette-banner';
        banner.setAttribute('role', 'button');
        banner.setAttribute('tabindex', '0');
        banner.setAttribute('aria-label', 'Открыть рулетку');

        const rouletteBannerMedia = this.getRouletteBannerMedia();
        // iOS fix: convert data:video URLs to blob URLs
        if (rouletteBannerMedia && rouletteBannerMedia.url && rouletteBannerMedia.url.startsWith('data:video/') && window._iosVideoFix && window._iosVideoFix.dataUrlToBlob) {
            const blobUrl = window._iosVideoFix.dataUrlToBlob(rouletteBannerMedia.url);
            if (blobUrl) rouletteBannerMedia.url = blobUrl;
        }
        const hasMedia = !!(rouletteBannerMedia && rouletteBannerMedia.url);
        
        banner.classList.toggle('tg-roulette-banner-has-media', hasMedia);

        if (hasMedia && rouletteBannerMedia.type === 'video') {
            const video = document.createElement('video');
            video.className = 'tg-roulette-banner-media';
            video.src = rouletteBannerMedia.url;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            video.style.display = 'block';
            
            // Set poster for uploaded videos
            if (typeof rouletteBannerMedia.url === 'string' && rouletteBannerMedia.url.startsWith('/uploads/')) {
                video.poster = '/api/video-poster?src=' + encodeURIComponent(rouletteBannerMedia.url);
            }
            
            // iOS attributes
            video.setAttribute('autoplay', '');
            video.setAttribute('loop', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('preload', 'auto');
            video.setAttribute('x-webkit-airplay', 'allow');
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.autoplay = true;
            try { video.disableRemotePlayback = true; } catch (e) {}
            
            video.onloadeddata = () => {
                video.play().catch(e => console.warn('Roulette video autoplay prevented:', e));
            };
            
            // iOS error handling with fallback
            video.onerror = () => {
                console.error('Roulette video failed to load:', rouletteBannerMedia.url);
                const fallbackImg = document.createElement('img');
                fallbackImg.className = 'tg-roulette-banner-media';
                fallbackImg.src = rouletteBannerMedia.url;
                fallbackImg.alt = 'Рулетка';
                fallbackImg.style.width = '100%';
                fallbackImg.style.height = '100%';
                fallbackImg.style.objectFit = 'cover';
                fallbackImg.style.display = 'block';
                fallbackImg.onerror = () => {
                    console.error('Roulette image fallback also failed');
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'tg-roulette-banner-fallback';
                    banner.innerHTML = '';
                    banner.appendChild(fallbackDiv);
                };
                banner.innerHTML = '';
                banner.appendChild(fallbackImg);
            };
            
            banner.appendChild(video);
            
            // iOS: explicitly play video after DOM insertion
            video.load();
            video.play().catch(function(){});
            setTimeout(function() { video.play().catch(function(){}); }, 300);
            if (window._iosVideoFix) window._iosVideoFix.applyToVideo(video);
        } else if (hasMedia && rouletteBannerMedia.type === 'image') {
            const img = document.createElement('img');
            img.className = 'tg-roulette-banner-media';
            img.src = rouletteBannerMedia.url;
            img.alt = 'Рулетка';
            img.loading = 'lazy';
            banner.appendChild(img);
        } else {
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'tg-roulette-banner-fallback';
            banner.appendChild(fallbackDiv);
        }
        
        container.appendChild(banner);

        banner.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎰 Roulette banner clicked');
            this.openRoulette();
        }, { passive: false });
        banner.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎰 Roulette banner touched');
            this.openRoulette();
        }, { passive: false });
        banner.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.openRoulette();
            }
        });

        // Cache config for roulette page (non-blocking)
        if (!window._rouletteConfigCache) {
            fetch('/api/roulette/config')
                .then(r => r.json())
                .then(config => { window._rouletteConfigCache = config; })
                .catch(() => {});
        }
    }

    openRoulette() {
        console.log('🎰 openRoulette() called');
        console.log('🎰 window.telegramRoulettePage:', window.telegramRoulettePage);
        
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }
        
        if (window.telegramRoulettePage && typeof window.telegramRoulettePage.show === 'function') {
            console.log('🎰 Calling telegramRoulettePage.show()');
            try {
                window.telegramRoulettePage.show();
            } catch (error) {
                console.error('❌ Error calling telegramRoulettePage.show():', error);
            }
        } else {
            console.error('❌ Roulette page not available - window.telegramRoulettePage is undefined or show() method missing');
            console.log('Available window properties:', Object.keys(window).filter(k => k.includes('telegram')));
            
            // Try to wait and retry once
            console.log('⏳ Waiting 500ms and retrying...');
            setTimeout(() => {
                if (window.telegramRoulettePage && typeof window.telegramRoulettePage.show === 'function') {
                    console.log('✅ Roulette page now available, opening...');
                    try {
                        window.telegramRoulettePage.show();
                    } catch (error) {
                        console.error('❌ Error on retry:', error);
                    }
                } else {
                    console.error('❌ Roulette page still not available after retry');
                    if (window.telegramWebApp) {
                        window.telegramWebApp.showNotification('Рулетка временно недоступна');
                    }
                }
            }, 500);
        }
    }

    createSection(slug, title) {
        const mainContent = document.querySelector('.tg-main-content');
        const sectionId = slug + 'Section';
        
        const section = document.createElement('section');
        section.id = sectionId;
        section.className = 'tg-section';
        section.innerHTML = `
            <div class="tg-section-header">
                <h2 class="tg-section-title">${this.escapeHtml(title)}</h2>
                <button class="tg-view-all-btn" data-category="${slug}" data-title="${this.escapeHtml(title)}">Смотреть все</button>
            </div>
            <div class="tg-products-scroll" id="${slug}Grid">
                <!-- Products will be loaded here -->
            </div>
        `;
        
        mainContent.appendChild(section);
        
        // Add click handler for "View All" button
        const viewAllBtn = section.querySelector('.tg-view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categorySlug = viewAllBtn.dataset.category;
                const categoryTitle = viewAllBtn.dataset.title;
                this.openCategoryPage(categorySlug, categoryTitle);
            });
        }
    }


    renderCategory(categoryKey, gridId, maxProducts = null) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        let products = this.categories[categoryKey] || [];
        
        // Limit products if maxProducts is specified
        if (maxProducts && products.length > maxProducts) {
            products = products.slice(0, maxProducts);
        }

        if (products.length === 0) {
            grid.innerHTML = '<div class="tg-empty"><div class="tg-empty-text">Товары не найдены</div></div>';
            return;
        }

        grid.innerHTML = products.map(product => this.createProductCard(product)).join('');
        
        // Add click handlers
        grid.querySelectorAll('.tg-product-card').forEach((card, index) => {
            card.addEventListener('click', () => {
                this.openProduct(products[index]);
            });
        });
    }

    getProductImage(product) {
        // Try product.image first (single image string)
        let imageUrl = product.image || '';
        
        // If no image, try product.images array
        if (!imageUrl && product.images && product.images.length > 0) {
            const firstImage = product.images[0];
            if (typeof firstImage === 'string') {
                imageUrl = firstImage;
            } else if (firstImage.url) {
                imageUrl = firstImage.url;
            } else if (firstImage.data) {
                imageUrl = firstImage.data;
            }
        }
        
        // Normalize image URL
        if (imageUrl) {
            // If relative path starting with /uploads/, make it absolute
            if (imageUrl.startsWith('/uploads/')) {
                imageUrl = imageUrl; // Will work relative to current domain
            }
            // If already absolute URL (http/https), use as is
            else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
                // If relative path without leading slash, add it
                if (!imageUrl.startsWith('/')) {
                    imageUrl = '/uploads/' + imageUrl;
                }
            }
        }
        
        // Default placeholder if no image
        if (!imageUrl) {
            imageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
        
        return imageUrl;
    }

    createProductCard(product) {
        const imageUrl = this.getProductImage(product);
        
        // Badge for sale/preorder
        let badge = '';
        if (product.isSale) {
            badge = '<div class="tg-product-badge">ПРЕДАЛКАЯ</div>';
        } else if (product.isPreorder || product.preorder) {
            badge = '<div class="tg-product-badge preorder">ПРЕДЗАКАЗ</div>';
        }
        
        const price = this.formatPrice(product.price, product);
        const hasDiscount = !!(product && product.oldPrice && product.newPrice);
        const snippet = !hasDiscount ? this.getDescriptionSnippet(product) : '';
        const priceBlock = snippet
            ? `<span class="tg-price-snippet">${this.escapeHtml(snippet)}</span><span class="tg-price-value">${price}</span>`
            : price;
        const brand = product.brand || '';
        const name = product.name || '';
        const keepBrandTogether = (text) => String(text || '').replace(/C\.P\. Company/g, 'C.P.\u00A0Company');
        const safeBrand = keepBrandTogether(brand);
        const safeName = keepBrandTogether(name);

        return `
            <div class="tg-product-card">
                ${badge}
                <img src="${imageUrl}" alt="${this.escapeHtml(safeName)}" class="tg-product-image" loading="lazy" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
                <div class="tg-product-info">
                    ${brand ? `<div class="tg-product-brand">${this.escapeHtml(safeBrand)}</div>` : ''}
                    <div class="tg-product-name">${this.escapeHtml(safeName)}</div>
                    <div class="tg-product-price">${priceBlock}</div>
                </div>
            </div>
        `;
    }

    getDescriptionSnippet(product, wordsCount = 3) {
        if (!product) return '';
        const source = product.description || product.shortDescription || product.name || '';
        if (!source) return '';
        const stripped = source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!stripped) return '';
        const words = stripped.split(' ').slice(0, wordsCount).join(' ');
        return words;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatPrice(price, product = null) {
        if (!price) return '0 ₽';
        const numPrice = typeof price === 'string' ? parseInt(price.replace(/\s/g, '')) : price;
        
        // Если есть скидка (oldPrice и newPrice)
        if (product && product.oldPrice && product.newPrice) {
            const oldPriceFormatted = parseInt(product.oldPrice).toLocaleString('ru-RU') + ' ₽';
            const newPriceFormatted = parseInt(product.newPrice).toLocaleString('ru-RU') + ' ₽';
            return `
                <span class="tg-price-old">${oldPriceFormatted}</span>
                <span class="tg-price-new">${newPriceFormatted}</span>
            `;
        }
        
        return numPrice.toLocaleString('ru-RU') + ' ₽';
    }

    openProduct(product) {
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }

        // Open product modal in mini app
        if (window.telegramProductModal) {
            window.telegramProductModal.open(product.id);
        } else if (window.TelegramProductModal) {
            window.telegramProductModal = new window.TelegramProductModal();
            window.telegramProductModal.open(product.id);
        } else {
            // Fallback: show error
            console.error('Product modal not available');
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Ошибка открытия товара');
            }
        }
    }

    openCategoryPage(categorySlug, categoryTitle) {
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }

        // Get all products for this category
        const products = this.categories[categorySlug] || [];
        
        // Open category page
        if (window.telegramCategoryPage) {
            window.telegramCategoryPage.open(categorySlug, categoryTitle, products);
        } else if (window.TelegramCategoryPage) {
            // Initialize if not already initialized
            window.telegramCategoryPage = new window.TelegramCategoryPage();
            window.telegramCategoryPage.open(categorySlug, categoryTitle, products);
        } else {
            console.error('Category page not available');
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Ошибка открытия категории');
            }
        }
    }

    showError(message) {
        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification(message);
        } else {
            console.error(message);
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

    applyLogoContent(logoContent, item) {
        const url = typeof item === 'string' ? item : (item?.url || item);
        const explicitType = typeof item === 'object' && item ? item.type : null;
        const type = explicitType === 'video' || (explicitType !== 'image' && this.isVideoUrl(url)) ? 'video' : 'image';
        
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
            video.setAttribute('x-webkit-airplay', 'allow');
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.autoplay = true;
            try { video.disableRemotePlayback = true; } catch (e) {}
            
            video.onloadedmetadata = () => { video.currentTime = 0; };
            video.onloadeddata = () => {
                video.currentTime = 0;
                if (loader.setProgress) loader.setProgress(100);
                hideLoader();
                video.play().catch(e => console.warn('Video autoplay prevented:', e));
            };
            
            // iOS-specific error handling
            video.onerror = () => {
                console.error('Video failed to load:', url);
                // Fallback: try to load as image if video fails
                if (loader.setProgress) loader.setProgress(100);
                hideLoader();
                const fallbackImg = document.createElement('img');
                fallbackImg.src = url;
                fallbackImg.style.width = '100%';
                fallbackImg.style.height = '100%';
                fallbackImg.style.objectFit = 'cover';
                fallbackImg.style.aspectRatio = '16 / 9';
                fallbackImg.style.display = 'block';
                fallbackImg.onerror = () => {
                    console.error('Image fallback also failed for:', url);
                    placeholder.textContent = 'Видео недоступно';
                };
                logoContent.innerHTML = '';
                logoContent.appendChild(fallbackImg);
            };
            
            video.onprogress = () => {
                if (video.buffered.length > 0 && video.duration > 0) {
                    const p = (video.buffered.end(0) / video.duration) * 100;
                    if (loader.setProgress) loader.setProgress(p);
                }
            };
            
            video.oncanplay = () => {
                if (loader.setProgress) loader.setProgress(100);
                hideLoader();
                video.play().catch(e => console.warn('Video play on canplay failed:', e));
                const tryPlay = () => video.play().then(() => {}).catch(() => {});
                tryPlay();
                setTimeout(tryPlay, 100);
                setTimeout(tryPlay, 500);
                
                logoContent.style.backgroundImage = '';
                logoContent.style.backgroundSize = '';
                logoContent.style.backgroundPosition = '';
                logoContent.style.backgroundRepeat = '';
                logoContent.style.aspectRatio = '16 / 9';
            };
            
            logoContent.appendChild(video);
            const tryPlay = () => video.play().then(() => {}).catch(() => {});
            tryPlay();
            setTimeout(tryPlay, 100);
            setTimeout(tryPlay, 500);
            
            logoContent.style.backgroundImage = '';
            logoContent.style.backgroundSize = '';
            logoContent.style.backgroundPosition = '';
            logoContent.style.backgroundRepeat = '';
            logoContent.style.aspectRatio = '16 / 9';
        } else {
            const setImgAndHide = (src) => {
                if (loader.setProgress) loader.setProgress(100);
                hideLoader();
                logoContent.style.backgroundImage = `url(${src})`;
            };
            
            logoContent.style.backgroundSize = 'cover';
            logoContent.style.backgroundPosition = 'center';
            logoContent.style.backgroundRepeat = 'no-repeat';
            logoContent.style.aspectRatio = '16 / 9';
            
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                const img = new Image();
                img.onerror = () => {
                    console.error('Error loading image:', url);
                    loader.remove();
                };
                img.onload = () => setImgAndHide(url);
                img.src = url;
            } else {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.responseType = 'blob';
                xhr.onprogress = (e) => {
                    if (e.lengthComputable && loader.setProgress) {
                        loader.setProgress((e.loaded / e.total) * 100);
                    }
                };
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const blobUrl = URL.createObjectURL(xhr.response);
                        setImgAndHide(blobUrl);
                    } else {
                        loader.remove();
                        const img = new Image();
                        img.onerror = () => loader.remove();
                        img.onload = () => setImgAndHide(url);
                        img.src = url;
                    }
                };
                xhr.onerror = () => {
                    const img = new Image();
                    img.onerror = () => { loader.remove(); };
                    img.onload = () => setImgAndHide(url);
                    img.src = url;
                };
                xhr.send();
            }
        }

        this.refreshCoverNavigation(logoContent);
    }

    cycleToNext(logoContent) {
        const images = JSON.parse(logoContent.getAttribute('data-logo-images') || '[]');
        if (images.length <= 1) return;
        let currentIndex = parseInt(logoContent.getAttribute('data-current-index') || '0');
        currentIndex = (currentIndex + 1) % images.length; // циклично
        logoContent.setAttribute('data-current-index', currentIndex.toString());
        this.applyLogoContent(logoContent, images[currentIndex]);
        if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('light');
    }

    initLogoSwipe(logoContent) {
        if (logoContent.hasAttribute('data-swipe-initialized')) return;
        logoContent.setAttribute('data-swipe-initialized', 'true');
        
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        const handleStart = (e) => {
            isDragging = true;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            logoContent.style.transition = 'none';
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            currentX = e.touches ? e.touches[0].clientX : e.clientX;
        };
        
        const handleEnd = (e) => {
            if (!isDragging) return;
            const diff = startX - currentX;
            const threshold = 50;
            isDragging = false;
            logoContent.style.transition = 'opacity 0.3s ease';
            
            if (Math.abs(diff) > threshold) {
                const images = JSON.parse(logoContent.getAttribute('data-logo-images') || '[]');
                let currentIndex = parseInt(logoContent.getAttribute('data-current-index') || '0');
                
                if (diff > 0) {
                    currentIndex = (currentIndex + 1) % images.length;
                } else {
                    currentIndex = currentIndex <= 0 ? images.length - 1 : currentIndex - 1;
                }
                
                if (images.length > 0) {
                    logoContent.setAttribute('data-current-index', currentIndex.toString());
                    this.applyLogoContent(logoContent, images[currentIndex]);
                    if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('light');
                }
            } else {
                const images = JSON.parse(logoContent.getAttribute('data-logo-images') || '[]');
                if (images.length > 1) this.cycleToNext(logoContent);
            }
        };
        
        logoContent.addEventListener('touchstart', handleStart, { passive: true });
        logoContent.addEventListener('touchmove', handleMove, { passive: true });
        logoContent.addEventListener('touchend', handleEnd);
        logoContent.addEventListener('mousedown', handleStart);
        logoContent.addEventListener('mousemove', handleMove);
        logoContent.addEventListener('mouseup', handleEnd);
        logoContent.addEventListener('mouseleave', handleEnd);
        
        logoContent.style.cursor = 'pointer';
    }

    refreshCoverNavigation(logoContent) {
        if (!logoContent) return;
        const imagesAttr = logoContent.getAttribute('data-logo-images');
        if (!imagesAttr) {
            this.updateCoverArrows([]);
            return;
        }
        try {
            const items = JSON.parse(imagesAttr);
            this.updateCoverArrows(items);
        } catch (error) {
            console.error('Error parsing logo images for navigation controls:', error);
            this.updateCoverArrows([]);
        }
    }

    getCoverArrowContainer() {
        if (this.coverArrowContainer && !document.body.contains(this.coverArrowContainer)) {
            this.coverArrowContainer = null;
        }
        if (!this.coverArrowContainer) {
            const card = document.querySelector('.tg-logo-card');
            if (!card) return null;
            let container = card.querySelector('.tg-cover-arrows');
            if (!container) {
                container = document.createElement('div');
                container.className = 'tg-cover-arrows tg-cover-arrows-hidden';
                container.innerHTML = `
                    <button type="button" class="tg-cover-arrow-button tg-cover-arrow-prev" data-direction="prev" aria-label="Предыдущая обложка">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 6 9 12 15 18"></polyline>
                        </svg>
                    </button>
                    <button type="button" class="tg-cover-arrow-button tg-cover-arrow-next" data-direction="next" aria-label="Следующая обложка">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 6 15 12 9 18"></polyline>
                        </svg>
                    </button>
                `;
                container.addEventListener('click', this.handleArrowClick);
                card.appendChild(container);
            }
            this.coverArrowContainer = container;
        }
        return this.coverArrowContainer;
    }

    updateCoverArrows(items = []) {
        const container = this.getCoverArrowContainer();
        if (!container) return;
        if (!items || items.length <= 1) {
            container.classList.add('tg-cover-arrows-hidden');
            container.querySelectorAll('button').forEach(btn => btn.disabled = true);
            return;
        }
        container.classList.remove('tg-cover-arrows-hidden');
        container.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }

    handleArrowClick(event) {
        const button = event.target.closest('.tg-cover-arrow-button');
        if (!button || button.disabled) return;
        const direction = button.dataset.direction;
        if (direction === 'prev') {
            this.goToPreviousLogoSlide();
        } else if (direction === 'next') {
            this.goToNextLogoSlide();
        }
    }

    navigateLogoByOffset(offset = 1) {
        const logoContent = document.querySelector('.tg-logo-content');
        if (!logoContent) return;
        const imagesAttr = logoContent.getAttribute('data-logo-images');
        if (!imagesAttr) return;
        let images = [];
        try {
            images = JSON.parse(imagesAttr);
        } catch (error) {
            console.error('Error parsing logo images for arrow navigation:', error);
            return;
        }
        if (!images || images.length <= 1) return;

        const total = images.length;
        let currentIndex = parseInt(logoContent.getAttribute('data-current-index') || '0');
        if (Number.isNaN(currentIndex)) currentIndex = 0;
        let nextIndex = (currentIndex + offset) % total;
        if (nextIndex < 0) nextIndex = total - 1;

        logoContent.setAttribute('data-current-index', nextIndex.toString());
        this.applyLogoContent(logoContent, images[nextIndex]);
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('medium');
        }
    }

    goToPreviousLogoSlide() {
        this.navigateLogoByOffset(-1);
    }

    goToNextLogoSlide() {
        this.navigateLogoByOffset(1);
    }

    ensurePaginationStyles() {
        if (document.getElementById('tg-cover-pagination-styles')) return;
        const style = document.createElement('style');
        style.id = 'tg-cover-pagination-styles';
        style.textContent = `
.tg-logo-card { position: relative; }
.tg-cover-arrows { position: absolute; bottom: 18px; right: 18px; display: flex; gap: 8px; z-index: 6; }
.tg-cover-arrows-hidden { opacity: 0; pointer-events: none; transform: translateY(8px); }
.tg-cover-arrow-button { width: 35px; height: 35px; border: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(11px) saturate(170%); -webkit-backdrop-filter: blur(11px) saturate(170%); color: rgba(20, 20, 35, 0.8); cursor: pointer; transition: transform 0.2s ease, opacity 0.2s ease; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; outline: none; }
.tg-cover-arrow-button svg { width: 16px; height: 16px; stroke: currentColor; }
.tg-cover-arrow-button:active { transform: scale(0.95); }
.tg-cover-arrow-button:disabled { opacity: 0.4; cursor: default; }
body.tg-dark .tg-cover-arrow-button { background: rgba(15, 18, 32, 0.5); border-color: rgba(255, 255, 255, 0.18); color: rgba(235, 235, 250, 0.9); }
body.tg-dark .tg-cover-arrow-button:disabled { opacity: 0.3; }
`;
        document.head.appendChild(style);
    }
}

// Initialize when DOM is ready
let telegramMiniAppLoaderInstance = null;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramMiniAppLoaderInstance = new TelegramMiniAppLoader();
        window.telegramMiniAppLoader = telegramMiniAppLoaderInstance;
    });
} else {
    telegramMiniAppLoaderInstance = new TelegramMiniAppLoader();
    window.telegramMiniAppLoader = telegramMiniAppLoaderInstance;
}
