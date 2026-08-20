// Favorites Management System
class FavoritesManager {
    constructor() {
        this.baseStorageKey = 'cpcompany_favorites';
        this.userId = this.getUserId();
        this.storageKey = this.getStorageKey();
        this.favorites = this.loadFavorites();
    }

    // Get current user ID from Telegram
    getUserId() {
        if (window.telegramWebApp) {
            const user = window.telegramWebApp.getUserData();
            return user ? String(user.id) : null;
        }
        return null;
    }

    // Get storage key with user ID
    getStorageKey() {
        if (this.userId) {
            return `${this.baseStorageKey}_${this.userId}`;
        }
        return this.baseStorageKey; // Fallback for non-Telegram users
    }

    // Update user ID if changed (e.g., user switched accounts)
    updateUserId() {
        const newUserId = this.getUserId();
        if (newUserId !== this.userId) {
            // Save old favorites before switching
            if (this.userId) {
                this.saveFavorites();
            }
            this.userId = newUserId;
            this.storageKey = this.getStorageKey();
            this.favorites = this.loadFavorites();
        }
    }

    // Load favorites from localStorage
    loadFavorites() {
        try {
            this.updateUserId(); // Ensure we have the latest user ID
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading favorites:', error);
            return [];
        }
    }

    // Save favorites to localStorage
    saveFavorites() {
        try {
            this.updateUserId(); // Ensure we have the latest user ID
            localStorage.setItem(this.storageKey, JSON.stringify(this.favorites));
            // Dispatch event for other components to listen
            window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: this.favorites }));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    // Add product to favorites
    addToFavorites(productId) {
        if (!this.isFavorite(productId)) {
            // Нормализуем ID к числу при сохранении
            const normalizedId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
            this.favorites.push(normalizedId);
            this.saveFavorites();
            return true;
        }
        return false;
    }

    // Remove product from favorites
    removeFromFavorites(productId) {
        // Нормализуем ID к числу для сравнения
        const normalizedId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
        
        // Ищем индекс с учетом разных типов ID
        const index = this.favorites.findIndex(favId => {
            const normalizedFavId = typeof favId === 'string' ? parseInt(favId, 10) : favId;
            return normalizedFavId === normalizedId || favId === productId;
        });
        
        if (index > -1) {
            this.favorites.splice(index, 1);
            this.saveFavorites();
            return true;
        }
        return false;
    }

    // Toggle favorite status
    toggleFavorite(productId) {
        if (this.isFavorite(productId)) {
            this.removeFromFavorites(productId);
            return false;
        }

        this.addToFavorites(productId);
        return true;
    }

    // Check if product is in favorites
    isFavorite(productId) {
        // Нормализуем ID к числу для сравнения
        const normalizedId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
        return this.favorites.some(favId => {
            const normalizedFavId = typeof favId === 'string' ? parseInt(favId, 10) : favId;
            return normalizedFavId === normalizedId || favId === productId;
        });
    }

    // Get all favorite product IDs
    getFavoriteIds() {
        return [...this.favorites];
    }

    // Get favorite products (requires product database)
    async getFavoriteProducts() {
        if (!window.productDB) {
            console.error('Product database not available');
            return [];
        }

        if (this.favorites.length === 0) {
            return [];
        }

        const favoriteProducts = [];
        
        // Strategy 1: Try to get all products at once (more efficient)
        try {
            let allProducts = [];
            
            // Check if getAllProducts is async
            if (window.productDB.getAllProducts) {
                const result = window.productDB.getAllProducts();
                if (result instanceof Promise) {
                    allProducts = await result;
                } else {
                    allProducts = result;
                }
            }
            
            // If we got products, filter by favorite IDs
            if (Array.isArray(allProducts) && allProducts.length > 0) {
                this.favorites.forEach(productId => {
                    const id = typeof productId === 'string' ? parseInt(productId, 10) : productId;
                    const product = allProducts.find(p => {
                        if (!p) return false;
                        const productIdNum = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
                        return productIdNum === id || p.id === productId;
                    });
                    if (product) {
                        favoriteProducts.push(product);
                    }
                });
                
                if (favoriteProducts.length > 0) {
                    return favoriteProducts;
                }
            }
        } catch (error) {
            console.warn('Error getting all products, trying individual lookups:', error);
        }
        
        // Strategy 2: Get each product individually
        for (const productId of this.favorites) {
            try {
                let product = null;
                
                if (window.productDB.getProductById) {
                    const result = window.productDB.getProductById(productId);
                    if (result instanceof Promise) {
                        product = await result;
                    } else {
                        product = result;
                    }
                }
                
                if (product) {
                    favoriteProducts.push(product);
                }
            } catch (error) {
                console.warn(`Error getting product ${productId}:`, error);
            }
        }
        
        return favoriteProducts;
    }

    // Clear all favorites
    clearFavorites() {
        this.favorites = [];
        this.saveFavorites();
    }

    // Get count of favorites
    getCount() {
        return this.favorites.length;
    }
}

// Initialize global favorites manager
window.favoritesManager = new FavoritesManager();

// Export for use in other modules
window.FavoritesManager = FavoritesManager;
