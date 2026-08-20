// Telegram Mini App Checkout Form
class TelegramCheckout {
    constructor() {
        this.page = null;
        this.deliveryType = 'delivery'; // 'delivery' or 'pickup'
        this.init();
    }

    init() {
        this.createPage();
        this.setupEventListeners();
    }

    createPage() {
        const pageHTML = `
            <div class="tg-checkout-page" id="tgCheckoutPage" style="display: none;">
                <div class="tg-checkout-page-header">
                    <button class="tg-checkout-page-back">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <h1 class="tg-checkout-page-title">Оформление заказа</h1>
                    <div class="tg-checkout-page-spacer"></div>
                </div>
                
                <div class="tg-checkout-page-content">
                    <div class="tg-checkout-pickup-info">
                        <div class="tg-checkout-pickup-label">Самовывоз</div>
                        <div class="tg-checkout-pickup-address" id="tgCheckoutPickupAddress">
                            Загрузка адреса...
                        </div>
                    </div>
                    
                    <div class="tg-checkout-contact-buttons">
                        <button class="tg-checkout-contact-btn tg-contact-telegram" id="tgCheckoutTelegramBtn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.154.232.17.325.015.094.034.31.019.478z"/>
                            </svg>
                            Связаться в Telegram
                        </button>
                        
                        <button class="tg-checkout-contact-btn tg-contact-max" id="tgCheckoutMaxBtn" style="display: none;">
                            Связаться в MAX
                        </button>
                        
                        <button class="tg-checkout-contact-btn tg-contact-vk" id="tgCheckoutVkBtn" style="display: none;">
                            Связаться в ВК
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgCheckoutPage');
    }

    setupEventListeners() {
        const backBtn = this.page.querySelector('.tg-checkout-page-back');
        backBtn.addEventListener('click', () => this.close());
        
        // Contact buttons
        const telegramBtn = document.getElementById('tgCheckoutTelegramBtn');
        telegramBtn.addEventListener('click', () => this.contactSeller('telegram'));
        
        const maxBtn = document.getElementById('tgCheckoutMaxBtn');
        maxBtn.addEventListener('click', () => this.contactSeller('max'));
        
        const vkBtn = document.getElementById('tgCheckoutVkBtn');
        vkBtn.addEventListener('click', () => this.contactSeller('vk'));
        
        // Load settings
        this.loadSettings();
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings/checkout');
            const settings = await response.json();
            
            // Update pickup address
            const addressElement = document.getElementById('tgCheckoutPickupAddress');
            if (addressElement) {
                if (settings.pickupAddress) {
                    addressElement.textContent = settings.pickupAddress;
                    addressElement.style.display = 'block';
                } else {
                    addressElement.style.display = 'none';
                }
            }
            
            // Show/hide contact buttons based on settings
            const maxBtn = document.getElementById('tgCheckoutMaxBtn');
            const vkBtn = document.getElementById('tgCheckoutVkBtn');
            
            if (maxBtn) {
                maxBtn.style.display = settings.maxLink ? 'flex' : 'none';
            }
            
            if (vkBtn) {
                vkBtn.style.display = settings.vkLink ? 'flex' : 'none';
            }
            
            this.settings = settings;
        } catch (error) {
            console.error('Error loading settings:', error);
            // Fallback to defaults
            const addressElement = document.getElementById('tgCheckoutPickupAddress');
            if (addressElement) {
                addressElement.textContent = 'Адрес не указан';
            }
        }
    }

    open() {
        this.page.style.display = 'block';
        this.loadSettings();
        
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
        
        // Show cart footer again when closing checkout (if cart has items)
        if (window.telegramCart && window.telegramCart.items && window.telegramCart.items.length > 0) {
            const footer = document.getElementById('tgCartFooter');
            if (footer) {
                footer.style.display = 'block';
            }
        }
        
        // Hide back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            
            // Restore back button for cart page
            if (window.telegramCartPage && window.telegramCartPage.page && window.telegramCartPage.page.style.display !== 'none') {
                window.telegramWebApp.tg.BackButton.onClick(() => {
                    window.telegramCartPage.close();
                });
                window.telegramWebApp.showBackButton();
            } else {
                window.telegramWebApp.setupBackButton();
            }
        }
    }

    async contactSeller(platform) {
        try {
            // Get cart items
            const cartItems = window.telegramCart ? window.telegramCart.items : [];
            
            if (cartItems.length === 0) {
                if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification('Корзина пуста');
                }
                return;
            }
            
            // Build message (preserving current format)
            let message = 'Здравствуйте! Заинтересовал данный товар:\n\n';
            cartItems.forEach((item, index) => {
                const product = item.product;
                const sizeText = item.size ? ` (Размер: ${item.size})` : '';
                const quantityText = item.quantity > 1 ? ` x${item.quantity}` : '';
                const unitPrice = window.telegramCart && typeof window.telegramCart.getItemUnitPrice === 'function'
                    ? window.telegramCart.getItemUnitPrice(item)
                    : item.price;
                const price = this.formatPrice(unitPrice * (item.quantity || 1));
                
                message += `${index + 1}. ${product.name}${sizeText}${quantityText} - ${price}\n`;
                
                const imageUrl = this.getProductImageUrl(product);
                if (imageUrl) {
                    message += `Фото товара: ${imageUrl}`;
                }
                if (index < cartItems.length - 1) {
                    message += '\n\n';
                }
            });
            
            // Encode message for URL
            const encodedMessage = encodeURIComponent(message);
            
            let url = '';
            
            if (platform === 'telegram') {
                const telegramUsername = this.settings?.telegramLink || 'pravitelstvo_russian';
                url = `https://t.me/${telegramUsername}?text=${encodedMessage}`;
            } else if (platform === 'max') {
                const maxLink = this.settings?.maxLink;
                if (maxLink) {
                    url = `${maxLink}?text=${encodedMessage}`;
                } else {
                    console.error('MAX link not configured');
                    return;
                }
            } else if (platform === 'vk') {
                const vkLink = this.settings?.vkLink;
                if (vkLink) {
                    url = `${vkLink}?message=${encodedMessage}`;
                } else {
                    console.error('VK link not configured');
                    return;
                }
            }
            
            // Open in new tab
            window.open(url, '_blank');
            
            // Haptic feedback
            if (window.telegramWebApp) {
                window.telegramWebApp.hapticFeedback('impact');
            }
        } catch (error) {
            console.error('Error contacting seller:', error);
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Ошибка при открытии диалога');
            }
        }
    }

    getProductImageUrl(product) {
        let url = product.image || '';
        if (!url && product.images && product.images.length > 0) {
            const first = product.images[0];
            url = typeof first === 'string' ? first : (first.url || first.data || '');
        }
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        const base = window.location.origin;
        return url.startsWith('/') ? base + url : base + '/' + url;
    }

    formatPrice(price) {
        if (!price) return '0 ₽';
        const numPrice = typeof price === 'string' ? parseInt(price.replace(/\s/g, '')) : price;
        return numPrice.toLocaleString('ru-RU') + ' ₽';
    }
}

// Initialize checkout
let telegramCheckout = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramCheckout = new TelegramCheckout();
        window.TelegramCheckout = TelegramCheckout;
        window.telegramCheckout = telegramCheckout;
    });
} else {
    telegramCheckout = new TelegramCheckout();
    window.TelegramCheckout = TelegramCheckout;
    window.telegramCheckout = telegramCheckout;
}
