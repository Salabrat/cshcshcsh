// Telegram Mini App Category Page - Shows all products in a category
class TelegramCategoryPage {
    constructor() {
        this.page = null;
        this.currentCategory = null;
        this.currentProducts = [];
        this.init();
    }

    init() {
        // Create category page structure
        this.createPage();
        // Setup event listeners
        this.setupEventListeners();
    }

    createPage() {
        const pageHTML = `
            <div class="tg-category-page" id="tgCategoryPage">
                <div class="tg-category-page-header">
                    <button class="tg-category-page-back">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <h1 class="tg-category-page-title" id="tgCategoryPageTitle"></h1>
                    <div class="tg-category-page-spacer"></div>
                </div>
                <div class="tg-category-page-content">
                    <div class="tg-category-products-grid" id="tgCategoryProductsGrid">
                        <!-- Products will be loaded here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgCategoryPage');
    }

    setupEventListeners() {
        // Back button
        const backBtn = this.page.querySelector('.tg-category-page-back');
        backBtn.addEventListener('click', () => this.close());
        
        // Back button handler for Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            // Will be set when page opens
        }
    }

    open(categorySlug, categoryTitle, products) {
        this.currentCategory = categorySlug;
        this.currentProducts = products || [];
        
        // Set title
        document.getElementById('tgCategoryPageTitle').textContent = categoryTitle || 'Категория';
        
        // Display products
        this.displayProducts(this.currentProducts);
        
        // Show page
        this.page.style.display = 'flex';
        this.page.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Show back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            // Override back button to close category page
            window.telegramWebApp.tg.BackButton.onClick(() => {
                this.close();
            });
            window.telegramWebApp.showBackButton();
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }
    }

    displayProducts(products) {
        const grid = document.getElementById('tgCategoryProductsGrid');
        
        if (!products || products.length === 0) {
            grid.innerHTML = `
                <div class="tg-category-empty">
                    <div class="tg-category-empty-text">Товары не найдены</div>
                </div>
            `;
            // Notify page loader that data is loaded (even if empty)
            if (window.telegramPageLoader) {
                window.dispatchEvent(new CustomEvent('tgDataLoaded'));
            }
            return;
        }
        
        // Create product cards (2 per row)
        grid.innerHTML = products.map(product => this.createProductCard(product)).join('');
        
        // Add click handlers for cards (excluding buttons)
        grid.querySelectorAll('.tg-category-product-card').forEach((card, index) => {
            card.addEventListener('click', (e) => {
                // Don't open product if clicking on favorite button
                if (e.target.closest('.tg-category-product-favorite-btn')) {
                    return;
                }
                this.openProduct(products[index]);
            });
        });

        // Add click handlers for favorite buttons
        grid.querySelectorAll('.tg-category-product-favorite-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.productId;
                this.toggleFavorite(productId, btn);
            });
        });
        
        // Notify page loader that data is loaded
        if (window.telegramPageLoader) {
            window.dispatchEvent(new CustomEvent('tgDataLoaded'));
        }
    }

    createProductCard(product) {
        const imageUrl = this.getProductImage(product);
        
        // Badge for sale/preorder
        let badge = '';
        if (product.isSale) {
            badge = '<div class="tg-category-product-badge">ПРЕДАЛКАЯ</div>';
        } else if (product.isPreorder || product.preorder) {
            badge = '<div class="tg-category-product-badge preorder">ПРЕДЗАКАЗ</div>';
        }
        
        const price = this.formatPrice(product);
        const brand = product.brandName || product.brand || '';
        const name = product.name || '';
        const productId = product.id;

        const isFavorite = window.favoritesManager && window.favoritesManager.isFavorite(productId);

        return `
            <div class="tg-category-product-card" data-product-id="${productId}">
                ${badge}
                <img src="${imageUrl}" alt="${this.escapeHtml(name)}" class="tg-category-product-image" loading="lazy" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
                <div class="tg-category-product-info">
                    ${brand ? `<div class="tg-category-product-brand">${this.escapeHtml(brand)}</div>` : ''}
                    <div class="tg-category-product-name">${this.escapeHtml(name)}</div>
                    <div class="tg-category-product-footer">
                        <div class="tg-category-product-price">${price}</div>
                        <div class="tg-category-product-actions">
                            <button class="tg-category-product-favorite-btn ${isFavorite ? 'active' : ''}" data-product-id="${productId}" aria-label="Добавить в избранное">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
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

    openProduct(product) {
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }

        // Don't close category page - keep it open behind the modal
        // Open product modal directly
        if (window.telegramProductModal) {
            window.telegramProductModal.open(product.id);
        } else if (window.TelegramProductModal) {
            window.telegramProductModal = new window.TelegramProductModal();
            window.telegramProductModal.open(product.id);
        }
    }

    formatPrice(product) {
        if (!product) return '0 ₽';

        const price = product.price;
        if (!price) return '0 ₽';

        const numPrice = typeof price === 'string' ? parseInt(price.replace(/\s/g, '')) : price;

        if (product.oldPrice && product.newPrice) {
            const oldPriceFormatted = parseInt(product.oldPrice).toLocaleString('ru-RU') + ' ₽';
            const newPriceFormatted = parseInt(product.newPrice).toLocaleString('ru-RU') + ' ₽';
            return `
                <span class="tg-price-old">${oldPriceFormatted}</span>
                <span class="tg-price-new">${newPriceFormatted}</span>
            `;
        }

        return numPrice.toLocaleString('ru-RU') + ' ₽';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addToCart(product) {
        if (!product || !window.telegramCart) return false;
        const added = window.telegramCart.addItem(product, null, 1);
        if (added && window.telegramWebApp) window.telegramWebApp.hapticFeedback('success');
        return !!added;
    }

    toggleFavorite(productId, buttonElement) {
        if (!productId || !window.favoritesManager) return;

        const isNowFavorite = window.favoritesManager.toggleFavorite(productId);
        
        // Update button state
        if (buttonElement) {
            buttonElement.classList.toggle('active', isNowFavorite);
        }

        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback(isNowFavorite ? 'success' : 'light');
        }
    }

    close() {
        if (!this.page) return;
        
        // Save state before closing
        if (window.telegramNavigation) {
            window.telegramNavigation.saveState();
        }
        
        this.page.classList.remove('active');
        this.page.style.display = 'none';
        document.body.style.overflow = '';
        
        // Force hide page to ensure it doesn't block navigation
        this.page.style.display = 'none';
        
        // Hide back button in Telegram and restore original handler
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            // Restore original back button behavior
            window.telegramWebApp.setupBackButton();
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('light');
        }
        
        // Clear current category to prevent state issues
        this.currentCategory = null;
        this.currentProducts = [];
    }
}

// Initialize category page
let telegramCategoryPage = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramCategoryPage = new TelegramCategoryPage();
        window.TelegramCategoryPage = TelegramCategoryPage;
        window.telegramCategoryPage = telegramCategoryPage;
    });
} else {
    telegramCategoryPage = new TelegramCategoryPage();
    window.TelegramCategoryPage = TelegramCategoryPage;
    window.telegramCategoryPage = telegramCategoryPage;
}
