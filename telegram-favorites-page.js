// Telegram Mini App Favorites Page
class TelegramFavoritesPage {
    constructor() {
        this.page = null;
        this.init();
    }

    init() {
        this.createPage();
        this.setupEventListeners();
        
        // Listen for favorites updates
        window.addEventListener('favoritesUpdated', () => {
            if (this.page && this.page.style.display !== 'none') {
                this.render();
            }
        });
    }

    createPage() {
        const pageHTML = `
            <div class="tg-favorites-page" id="tgFavoritesPage" style="display: none;">
                <div class="tg-favorites-page-header">
                    <h1 class="tg-favorites-page-title">Избранное</h1>
                </div>
                
                <div class="tg-favorites-page-content">
                    <div class="tg-favorites-items" id="tgFavoritesItems">
                        <!-- Favorites items will be loaded here -->
                    </div>
                    
                    <div class="tg-favorites-empty" id="tgFavoritesEmpty" style="display: none;">
                        <div class="tg-favorites-empty-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </div>
                        <div class="tg-favorites-empty-text">В избранном пока нет товаров</div>
                        <div class="tg-favorites-empty-subtext">Добавьте товары в избранное, нажав на иконку сердца</div>
                        <button class="tg-favorites-empty-btn" id="tgFavoritesEmptyBtn">Перейти в каталог</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgFavoritesPage');
    }

    setupEventListeners() {
        const emptyBtn = document.getElementById('tgFavoritesEmptyBtn');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => this.goToCatalog());
        }
    }

    show() {
        if (!this.page) return;
        
        this.page.style.display = 'block';
        this.page.style.visibility = 'visible';
        this.page.style.pointerEvents = 'auto';
        this.render();
        
        // Show back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
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

    close() {
        if (!this.page) return;
        
        this.page.style.display = 'none';
        
        // Force hide to ensure it doesn't block navigation
        this.page.style.visibility = 'hidden';
        this.page.style.pointerEvents = 'none';
        
        // Hide back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            window.telegramWebApp.setupBackButton();
        }
    }

    async render() {
        const itemsContainer = document.getElementById('tgFavoritesItems');
        const emptyState = document.getElementById('tgFavoritesEmpty');
        
        if (!window.favoritesManager) {
            console.error('Favorites manager not available');
            if (emptyState) emptyState.style.display = 'block';
            if (itemsContainer) itemsContainer.style.display = 'none';
            return;
        }

        try {
            const favoriteProducts = await window.favoritesManager.getFavoriteProducts();
            
            if (favoriteProducts.length === 0) {
                if (emptyState) emptyState.style.display = 'block';
                if (itemsContainer) itemsContainer.style.display = 'none';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';
            if (itemsContainer) {
                itemsContainer.style.display = 'block';
                itemsContainer.innerHTML = '';
                
                favoriteProducts.forEach(product => {
                    const item = this.createFavoriteItem(product);
                    itemsContainer.appendChild(item);
                });
            }
        } catch (error) {
            console.error('Error rendering favorites:', error);
            if (emptyState) emptyState.style.display = 'block';
            if (itemsContainer) itemsContainer.style.display = 'none';
        }
        
        // Notify page loader that data is loaded
        if (window.telegramPageLoader) {
            window.dispatchEvent(new CustomEvent('tgDataLoaded'));
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    formatPrice(price) {
        const num = typeof price === 'string' ? parseInt(price.replace(/\s/g, ''), 10) : price;
        const safe = Number.isFinite(num) ? num : 0;
        return safe.toLocaleString('ru-RU') + ' ₽';
    }

    createFavoriteItem(product) {
        const item = document.createElement('div');
        item.className = 'tg-favorite-item';
        item.setAttribute('data-product-id', product.id);

        // Get product image
        const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTIwQzE2NS0xNSAxODUgMTM1IDE1MCAyMDBDMTE1IDEzNSAxMzUgMTE1IDE1MCAxMjBaIiBmaWxsPSIjRTVFN0VCIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEzIiBmb250LXNpemU9IjE0Ij5ObyBpbWFnZTwvdGV4dD4KPC9zdmc+';
        
        let productImage = placeholder;
        if (product.images && product.images.length > 0) {
            if (typeof product.images[0] === 'string') {
                productImage = product.images[0];
            } else if (product.images[0].url) {
                productImage = product.images[0].url;
            } else if (product.images[0].data) {
                productImage = product.images[0].data;
            }
        }

        // Format price (with discount support)
        let priceHtml = this.formatPrice(product.price || 0);
        if (product.oldPrice && product.newPrice) {
            priceHtml = `
                <span class="tg-price-old">${this.formatPrice(product.oldPrice)}</span>
                <span class="tg-price-new">${this.formatPrice(product.newPrice)}</span>
            `;
        }

        // Short description (first 40-50 chars)
        const rawDescription = product.description || '';
        const shortDescription = rawDescription
            ? (rawDescription.length > 40 ? rawDescription.slice(0, 40).trim() + '…' : rawDescription.trim())
            : 'Описание товара';

        // Get sizes text
        const sizesText = product.sizes && product.sizes.length > 0 
            ? product.sizes.join('-') 
            : 'Один размер';

        const brandName = product.brandName || product.brand || '';
        const isInCart = window.telegramCart && window.telegramCart.hasProduct(product.id, null);

        item.innerHTML = `
            <div class="tg-favorite-item-image" data-product-id="${product.id}">
                <img src="${productImage}" alt="${this.escapeHtml(product.name)}" loading="lazy" onerror="this.src='${placeholder}'">
            </div>
            <div class="tg-favorite-item-info">
                <h3 class="tg-favorite-item-name" data-product-id="${product.id}">${this.escapeHtml(product.name)}</h3>
                <div class="tg-favorite-item-details">
                    <p class="tg-favorite-item-detail">-${this.escapeHtml(brandName ? brandName + ' -' : '')}Размер ${this.escapeHtml(sizesText)}</p>
                    <p class="tg-favorite-item-detail">${this.escapeHtml(shortDescription)} — ${priceHtml}</p>
                </div>
                <div class="tg-favorite-item-actions">
                    <button class="tg-favorite-item-cart-btn ${isInCart ? 'in-cart' : ''}" data-product-id="${product.id}" aria-label="${isInCart ? 'В корзине' : 'Добавить в корзину'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                        <span>${isInCart ? 'В корзине' : 'Добавить в корзину'}</span>
                    </button>
                    <button class="tg-favorite-item-delete" data-product-id="${product.id}" aria-label="Удалить из избранного">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        <span>Удалить</span>
                    </button>
                </div>
            </div>
        `;

        // Add click handler to open product
        const imageEl = item.querySelector('.tg-favorite-item-image');
        const nameEl = item.querySelector('.tg-favorite-item-name');
        
        const openProduct = () => {
            if (window.telegramProductModal && window.telegramProductModal.open && product.id) {
                window.telegramProductModal.open(product.id);
            }
        };
        
        if (imageEl) {
            imageEl.style.cursor = 'pointer';
            imageEl.addEventListener('click', openProduct);
        }
        
        if (nameEl) {
            nameEl.style.cursor = 'pointer';
            nameEl.addEventListener('click', openProduct);
        }

        // Открытие по нажатию на карточку (кроме кнопок)
        item.addEventListener('click', (e) => {
            if (e.target.closest('.tg-favorite-item-actions')) return;
            openProduct();
        });

        // Add cart button handler
        const cartBtn = item.querySelector('.tg-favorite-item-cart-btn');
        if (cartBtn && window.telegramCart) {
            cartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const inCart = cartBtn.classList.contains('in-cart');
                if (inCart) {
                    const removed = window.telegramCart.removeByProduct(product.id, null);
                    if (removed) {
                        cartBtn.classList.remove('in-cart');
                        cartBtn.setAttribute('aria-label', 'Добавить в корзину');
                        const label = cartBtn.querySelector('span');
                        if (label) label.textContent = 'Добавить в корзину';
                        if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('light');
                    }
                } else {
                    const added = window.telegramCart.addItem(product, null, 1);
                    if (added) {
                        cartBtn.classList.add('in-cart');
                        cartBtn.setAttribute('aria-label', 'В корзине');
                        const label = cartBtn.querySelector('span');
                        if (label) label.textContent = 'В корзине';
                        if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('success');
                    }
                }
            });
        }

        // Add delete button handler
        const deleteBtn = item.querySelector('.tg-favorite-item-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (window.favoritesManager) {
                    // Нормализуем ID перед удалением
                    const productId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
                    const removed = window.favoritesManager.removeFromFavorites(productId);
                    
                    if (removed) {
                        // Удаляем элемент из DOM
                        item.style.transition = 'opacity 0.3s ease';
                        item.style.opacity = '0';
                        setTimeout(() => {
                            item.remove();
                            
                            // Проверяем, остались ли еще товары
                            const itemsContainer = document.getElementById('tgFavoritesItems');
                            if (itemsContainer && itemsContainer.children.length === 0) {
                                const emptyState = document.getElementById('tgFavoritesEmpty');
                                if (emptyState) emptyState.style.display = 'block';
                                if (itemsContainer) itemsContainer.style.display = 'none';
                            }
                        }, 300);
                        
                        // Haptic feedback
                        if (window.telegramWebApp) {
                            window.telegramWebApp.hapticFeedback('impact');
                            window.telegramWebApp.showNotification('Удалено из избранного');
                        }
                    } else {
                        // Если не удалось удалить, перерисовываем страницу
                        console.warn('Failed to remove from favorites, re-rendering...');
                        this.render();
                    }
                }
            });
        }

        return item;
    }

    goToCatalog() {
        if (window.telegramNavigation) {
            window.telegramNavigation.navigate('#catalog');
        }
    }
}

// Initialize when DOM is ready
let telegramFavoritesPage = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramFavoritesPage = new TelegramFavoritesPage();
        window.telegramFavoritesPage = telegramFavoritesPage;
    });
} else {
    telegramFavoritesPage = new TelegramFavoritesPage();
    window.telegramFavoritesPage = telegramFavoritesPage;
}
