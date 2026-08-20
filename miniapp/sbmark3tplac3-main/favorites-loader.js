// Favorites Page Loader
class FavoritesLoader {
    constructor() {
        this.favoritesList = document.getElementById('favoritesList');
        this.init();
    }

    init() {
        // Wait for database and favorites manager to be ready
        this.waitForDatabase().then(() => {
            this.loadFavorites();
        }).catch(() => {
            console.error('Failed to initialize database');
            this.showEmptyState();
        });

        // Listen for favorites updates
        window.addEventListener('favoritesUpdated', () => {
            this.loadFavorites();
        });
    }

    async waitForDatabase(maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
            if (window.favoritesManager && window.productDB) {
                // If database has init method, wait for it
                if (window.productDB.init && typeof window.productDB.init === 'function') {
                    try {
                        await window.productDB.init();
                        console.log('Database initialized');
                    } catch (error) {
                        console.warn('Database init error:', error);
                    }
                }
                console.log('Database ready, favorites count:', window.favoritesManager.getCount());
                return Promise.resolve();
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        console.error('Database not available after', maxAttempts, 'attempts');
        return Promise.reject(new Error('Database not available'));
    }

    async loadFavorites() {
        if (!this.favoritesList) {
            console.error('Favorites list container not found');
            return;
        }

        if (!window.favoritesManager) {
            console.error('Favorites manager not available');
            this.showEmptyState();
            return;
        }

        const favoriteIds = window.favoritesManager.getFavoriteIds();
        console.log('Loading favorites, IDs:', favoriteIds);

        if (favoriteIds.length === 0) {
            console.log('No favorites found');
            this.showEmptyState();
            return;
        }

        try {
            const favoriteProducts = await window.favoritesManager.getFavoriteProducts();
            console.log('Loaded favorite products:', favoriteProducts.length);
            
            if (favoriteProducts.length === 0) {
                console.log('No products found for favorite IDs');
                this.showEmptyState();
                return;
            }

            this.favoritesList.innerHTML = '';
            
            favoriteProducts.forEach(product => {
                const favoriteItem = this.createFavoriteItem(product);
                this.favoritesList.appendChild(favoriteItem);
            });
            
            console.log('Favorites displayed successfully');
        } catch (error) {
            console.error('Error loading favorites:', error);
            this.showEmptyState();
        }
    }

    createFavoriteItem(product) {
        const item = document.createElement('div');
        item.className = 'favorite-item';
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

        // Format price
        const formattedPrice = new Intl.NumberFormat('ru-RU').format(product.price || 0);

        // Get sizes text
        const sizesText = product.sizes && product.sizes.length > 0 
            ? product.sizes.join('-') 
            : 'Один размер';

        // Get brand name (if available)
        const brandName = product.brandName || product.brand || '';

        item.innerHTML = `
            <div class="favorite-item-image">
                <img src="${productImage}" alt="${product.name}" loading="lazy" onerror="this.src='${placeholder}'">
            </div>
            <div class="favorite-item-info">
                <h3 class="favorite-item-name">${product.name}</h3>
                <div class="favorite-item-details">
                    <p class="favorite-item-detail">-${brandName ? brandName + ' -' : ''}Размер ${sizesText}</p>
                    <p class="favorite-item-detail">-Состояние новое! -Цена ${formattedPrice}p</p>
                </div>
                <button class="favorite-item-delete" data-product-id="${product.id}" aria-label="Удалить из избранного">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Удалить</span>
                </button>
            </div>
        `;

        // Add click handler to open product
        const imageEl = item.querySelector('.favorite-item-image');
        const nameEl = item.querySelector('.favorite-item-name');
        
        if (imageEl) {
            imageEl.style.cursor = 'pointer';
            imageEl.addEventListener('click', () => {
                if (window.productModal && window.productModal.open) {
                    window.productModal.open(product);
                } else {
                    window.location.href = `product.html?id=${product.id}`;
                }
            });
        }
        
        if (nameEl) {
            nameEl.style.cursor = 'pointer';
            nameEl.addEventListener('click', () => {
                if (window.productModal && window.productModal.open) {
                    window.productModal.open(product);
                } else {
                    window.location.href = `product.html?id=${product.id}`;
                }
            });
        }

        // Add delete button handler
        const deleteBtn = item.querySelector('.favorite-item-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.favoritesManager) {
                    window.favoritesManager.removeFromFavorites(product.id);
                    item.remove();
                    
                    // If no more favorites, show empty state
                    if (this.favoritesList.children.length === 0) {
                        this.showEmptyState();
                    }
                }
            });
        }

        return item;
    }

    showEmptyState() {
        if (!this.favoritesList) return;
        
        this.favoritesList.innerHTML = `
            <div class="favorites-empty">
                <div class="favorites-empty-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </div>
                <h3>В избранном пока нет товаров</h3>
                <p>Добавьте товары в избранное, нажав на иконку сердца</p>
                <a href="shop-all.html" class="btn btn-primary">Перейти в магазин</a>
            </div>
        `;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('favorites.html') || window.location.pathname.endsWith('/favorites.html')) {
        // Wait a bit for all scripts to load
        setTimeout(() => {
            if (!window.favoritesLoader) {
                window.favoritesLoader = new FavoritesLoader();
            }
        }, 300);
    }
});
