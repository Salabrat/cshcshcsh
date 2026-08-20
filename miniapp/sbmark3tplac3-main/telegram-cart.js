// Telegram Mini App Cart Manager
class TelegramCart {
    constructor() {
        this.baseStorageKey = 'telegram_cart';
        this.userId = this.getUserId();
        this.storageKey = this.getStorageKey();
        this.items = [];
        this.loadCart();
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
            // Save old cart before switching
            if (this.userId) {
                this.saveCart();
            }
            this.userId = newUserId;
            this.storageKey = this.getStorageKey();
            this.items = [];
            this.loadCart();
            this.updateCartBadge();
        }
    }

    loadCart() {
        try {
            this.updateUserId(); // Ensure we have the latest user ID
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.items = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.items = [];
        }
    }

    saveCart() {
        try {
            this.updateUserId(); // Ensure we have the latest user ID
            localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    hasProduct(productId, size = null) {
        return this.items.some(item =>
            String(item.productId) === String(productId) &&
            (size == null ? true : item.size === size)
        );
    }

    removeByProduct(productId, size = null) {
        const index = this.items.findIndex(item =>
            String(item.productId) === String(productId) &&
            (size == null ? true : item.size === size)
        );
        if (index !== -1) {
            this.removeItem(index);
            return true;
        }
        return false;
    }

    getEffectivePrice(product) {
        if (!product) return 0;

        const raw = (product.oldPrice && product.newPrice) ? product.newPrice : product.price;
        if (raw == null) return 0;

        if (typeof raw === 'string') {
            const parsed = parseInt(raw.replace(/\s/g, ''), 10);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        return Number.isFinite(raw) ? raw : 0;
    }

    getItemUnitPrice(item) {
        if (!item) return 0;

        const fromProduct = this.getEffectivePrice(item.product);
        if (fromProduct) return fromProduct;

        const raw = item.price;
        if (raw == null) return 0;

        if (typeof raw === 'string') {
            const parsed = parseInt(raw.replace(/\s/g, ''), 10);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        return Number.isFinite(raw) ? raw : 0;
    }

    addItem(product, size = null, quantity = 1) {
        // Check if item already exists (same product and size)
        const existingIndex = this.items.findIndex(item => 
            item.productId === product.id && item.size === size
        );

        if (existingIndex !== -1) {
            return false;
        }
        
        const effectivePrice = this.getEffectivePrice(product);

        this.items.push({
            productId: product.id,
            product: product,
            size: size,
            quantity: quantity,
            price: effectivePrice || product.price
        });

        this.saveCart();
        this.updateCartBadge();
        window.dispatchEvent(new CustomEvent('tgCartUpdated', { detail: { productId: product.id, size } }));
        return true;
    }

    removeItem(index) {
        const removed = this.items[index];
        this.items.splice(index, 1);
        this.saveCart();
        this.updateCartBadge();
        if (removed) {
            window.dispatchEvent(new CustomEvent('tgCartUpdated', { detail: { productId: removed.productId, size: removed.size } }));
        }
        if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('light');
    }

    updateQuantity(index, quantity) {
        if (quantity <= 0) {
            this.removeItem(index);
            return;
        }
        
        this.items[index].quantity = quantity;
        this.saveCart();
        this.updateCartBadge();
    }

    getTotal() {
        return this.items.reduce((total, item) => {
            const unitPrice = this.getItemUnitPrice(item);
            const quantity = item.quantity || 0;
            return total + (unitPrice * quantity);
        }, 0);
    }

    getItemsCount() {
        return this.items.reduce((count, item) => count + item.quantity, 0);
    }

    clear() {
        this.items = [];
        this.saveCart();
        this.updateCartBadge();
    }

    updateCartBadge() {
        const count = this.getItemsCount();
        const cartNavItem = document.querySelector('.tg-nav-item[href="#cart"]');
        
        if (cartNavItem) {
            // Remove existing badge
            const existingBadge = cartNavItem.querySelector('.tg-cart-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Add badge if items exist
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'tg-cart-badge';
                badge.textContent = count > 99 ? '99+' : count;
                cartNavItem.appendChild(badge);
            }
        }
    }
}

// Initialize cart
const telegramCart = new TelegramCart();
window.telegramCart = telegramCart;

// Update badge on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramCart.updateCartBadge();
    });
} else {
    telegramCart.updateCartBadge();
}
