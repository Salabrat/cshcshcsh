// Telegram Mini App Cart Page
class TelegramCartPage {
    constructor() {
        this.page = null;
        this.init();
    }

    init() {
        this.createPage();
        this.setupEventListeners();
    }

    createPage() {
        const pageHTML = `
            <div class="tg-cart-page" id="tgCartPage" style="display: none;">
                <div class="tg-cart-page-header">
                    <h1 class="tg-cart-page-title">Корзина</h1>
                    <button class="tg-cart-promo-btn" id="tgCartPromoBtn">Активировать промокод</button>
                </div>
                
                <div class="tg-cart-page-content">
                    <div class="tg-cart-items-container">
                        <div class="tg-cart-items" id="tgCartItems">
                            <!-- Cart items will be loaded here -->
                        </div>
                        
                        <div class="tg-cart-empty" id="tgCartEmpty" style="display: none;">
                            <div class="tg-cart-empty-text">Корзина пуста</div>
                            <button class="tg-cart-empty-btn" id="tgCartEmptyBtn">Перейти в каталог</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="tg-cart-footer" id="tgCartFooter" style="display: none;">
                <div class="tg-cart-summary" id="tgCartSummary">
                    <div class="tg-cart-summary-row tg-cart-summary-total">
                        <span>Итого</span>
                        <span id="tgCartTotal">0 ₽</span>
                    </div>
                </div>
                
                <button class="tg-cart-checkout-btn" id="tgCartCheckoutBtn">
                    Связаться с продавцом
                </button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgCartPage');
    }

    setupEventListeners() {
        const checkoutBtn = document.getElementById('tgCartCheckoutBtn');
        checkoutBtn.addEventListener('click', () => this.openCheckout());
        
        const emptyBtn = document.getElementById('tgCartEmptyBtn');
        emptyBtn.addEventListener('click', () => this.goToCatalog());
        
        const promoBtn = document.getElementById('tgCartPromoBtn');
        promoBtn.addEventListener('click', () => this.activatePromo());
    }

    show() {
        this.page.style.display = 'block';
        const footer = document.getElementById('tgCartFooter');
        if (footer) {
            footer.style.display = 'block';
        }
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
        this.page.style.display = 'none';
        const footer = document.getElementById('tgCartFooter');
        if (footer) {
            footer.style.display = 'none';
        }
        
        // Hide back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            window.telegramWebApp.setupBackButton();
        }
    }

    render() {
        const items = window.telegramCart ? window.telegramCart.items : [];
        const itemsContainer = document.getElementById('tgCartItems');
        const emptyState = document.getElementById('tgCartEmpty');
        const summary = document.getElementById('tgCartSummary');
        const checkoutBtn = document.getElementById('tgCartCheckoutBtn');
        const footer = document.getElementById('tgCartFooter');
        
        if (items.length === 0) {
            itemsContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            if (summary) summary.style.display = 'none';
            if (checkoutBtn) checkoutBtn.style.display = 'none';
            if (footer) footer.style.display = 'none';
            return;
        }
        
        itemsContainer.style.display = 'block';
        emptyState.style.display = 'none';
        if (summary) summary.style.display = 'block';
        if (checkoutBtn) checkoutBtn.style.display = 'block';
        if (footer) footer.style.display = 'block';
        
        // Render items
        itemsContainer.innerHTML = items.map((item, index) => this.createCartItem(item, index)).join('');
        
        // Open product on click (image/name area)
        itemsContainer.querySelectorAll('.tg-cart-item-clickable').forEach((el) => {
            el.addEventListener('click', () => {
                const cartItem = el.closest('.tg-cart-item');
                const productId = cartItem && cartItem.dataset.productId;
                const preselectedSize = cartItem && cartItem.dataset.size ? cartItem.dataset.size : null;
                if (productId && window.telegramProductModal) {
                    window.telegramProductModal.open(productId, preselectedSize);
                    if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('impact');
                }
            });
        });
        
        // Add event listeners
        itemsContainer.querySelectorAll('.tg-cart-item-remove').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.telegramCart.removeItem(index);
                this.render();
            });
        });
        
        itemsContainer.querySelectorAll('.tg-cart-item-quantity-minus').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const newQuantity = items[index].quantity - 1;
                window.telegramCart.updateQuantity(index, newQuantity);
                this.render();
            });
        });
        
        itemsContainer.querySelectorAll('.tg-cart-item-quantity-plus').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const newQuantity = items[index].quantity + 1;
                window.telegramCart.updateQuantity(index, newQuantity);
                this.render();
            });
        });
        
        // Update totals
        const total = window.telegramCart.getTotal();
        document.getElementById('tgCartTotal').textContent = this.formatPrice(total);
        
        // Notify page loader that data is loaded
        if (window.telegramPageLoader) {
            window.dispatchEvent(new CustomEvent('tgDataLoaded'));
        }
    }

    createCartItem(item, index) {
        const product = item.product;
        const imageUrl = this.getProductImage(product);
        const sizeText = item.size ? ` (${item.size})` : '';
        const productId = product.id || product.productId;
        
        const sizeValue = item.size ? this.escapeHtml(String(item.size)) : '';

        const quantity = item.quantity || 1;
        const unitPrice = window.telegramCart && typeof window.telegramCart.getItemUnitPrice === 'function'
            ? window.telegramCart.getItemUnitPrice(item)
            : (typeof item.price === 'number' ? item.price : 0);

        let priceHtml = this.formatPrice(unitPrice * quantity);

        if (product && product.oldPrice && product.newPrice) {
            const oldUnit = typeof product.oldPrice === 'string' ? parseInt(product.oldPrice, 10) : product.oldPrice;
            const newUnit = typeof product.newPrice === 'string' ? parseInt(product.newPrice, 10) : product.newPrice;

            if (Number.isFinite(oldUnit) && Number.isFinite(newUnit)) {
                const oldTotal = oldUnit * quantity;
                const newTotal = newUnit * quantity;
                priceHtml = `
                    <span class="tg-price-old">${this.formatPrice(oldTotal)}</span>
                    <span class="tg-price-new">${this.formatPrice(newTotal)}</span>
                `;
            }
        }

        return `
            <div class="tg-cart-item" data-product-id="${productId}" data-size="${sizeValue}" data-index="${index}">
                <div class="tg-cart-item-clickable">
                    <img src="${imageUrl}" alt="${this.escapeHtml(product.name)}" class="tg-cart-item-image" loading="lazy" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
                    <div class="tg-cart-item-info">
                        <div class="tg-cart-item-name">${this.escapeHtml(product.name)}${sizeText}</div>
                        <div class="tg-cart-item-price-label">Цена</div>
                        <div class="tg-cart-item-price">${priceHtml}</div>
                    </div>
                </div>
                <button class="tg-cart-item-remove" aria-label="Удалить из корзины">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
    }

    getProductImage(product) {
        let imageUrl = product.image || '';
        
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
        
        if (imageUrl) {
            if (imageUrl.startsWith('/uploads/')) {
                return imageUrl;
            } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
                return imageUrl.startsWith('/') ? imageUrl : '/uploads/' + imageUrl;
            }
        }
        
        return imageUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    formatPrice(price) {
        if (!price) return '0 ₽';
        const numPrice = typeof price === 'string' ? parseInt(price.replace(/\s/g, '')) : price;
        return numPrice.toLocaleString('ru-RU') + ' ₽';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openCheckout() {
        if (window.telegramCart.items.length === 0) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Корзина пуста');
            }
            return;
        }
        
        // Hide cart footer when opening checkout
        const footer = document.getElementById('tgCartFooter');
        if (footer) {
            footer.style.display = 'none';
        }
        
        // Open checkout form
        if (window.telegramCheckout) {
            window.telegramCheckout.open();
        } else if (window.TelegramCheckout) {
            window.telegramCheckout = new window.TelegramCheckout();
            window.telegramCheckout.open();
        }
    }


    goToCatalog() {
        // Navigate to catalog using navigation handler
        if (window.telegramNavigation) {
            window.telegramNavigation.navigate('#catalog');
        } else if (window.telegramWebApp && window.telegramWebApp.tg) {
            // Fallback: trigger catalog navigation
            const catalogNav = document.querySelector('a[href="#catalog"]');
            if (catalogNav) {
                catalogNav.click();
            }
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }
    }

    activatePromo() {
        // Show promo code input or modal
        if (window.telegramWebApp) {
            window.telegramWebApp.showAlert('Функция промокодов скоро будет доступна');
            window.telegramWebApp.hapticFeedback('impact');
        }
    }
}

// Initialize cart page
let telegramCartPage = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramCartPage = new TelegramCartPage();
        window.TelegramCartPage = TelegramCartPage;
        window.telegramCartPage = telegramCartPage;
    });
} else {
    telegramCartPage = new TelegramCartPage();
    window.TelegramCartPage = TelegramCartPage;
    window.telegramCartPage = telegramCartPage;
}
