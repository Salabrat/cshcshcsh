// MAX Web App Integration
class MaxWebApp {
    constructor() {
        this.max = null;
        this.isMax = false;
        this.isTelegram = false;
        this.init();
    }

    init() {
        // Check if running in MAX messenger (window.WebApp is the real MAX SDK)
        if (window.WebApp) {
            this.max = window.WebApp;
            this.isMax = true;
            this.isTelegram = true; // Set isTelegram for compatibility with existing code
            console.log('MAX WebApp detected, initializing...');
            this.setupMaxApp();
        } else if (window.Telegram && window.Telegram.WebApp) {
            // Fallback to Telegram if MAX not available
            this.max = window.Telegram.WebApp;
            this.isMax = false;
            this.isTelegram = true;
            console.log('Telegram WebApp detected (fallback for MAX compatibility)');
            this.setupMaxApp();
        } else {
            // Not in MAX or Telegram, use regular web version
            console.log('Running in regular browser mode');
            this.setupRegularMode();
        }
    }

    setupMaxApp() {
        console.log('MAX Web App initialized');
        
        // Expand app to full height (MAX doesn't have expand, but we can set viewport)
        if (this.max.ready) {
            this.max.ready();
        }
        
        // Set theme colors based on MAX theme
        this.applyTheme();
        
        // Enable closing confirmation
        if (this.max.enableClosingConfirmation) {
            this.max.enableClosingConfirmation();
        }
        
        // Set main button
        this.setupMainButton();
        
        // Setup back button
        this.setupBackButton();
        
        // Listen for theme changes (MAX uses different event names)
        if (this.max.onEvent) {
            this.max.onEvent('themeChanged', () => {
                this.applyTheme();
            });
            
            // Listen for viewport changes
            this.max.onEvent('viewportChanged', () => {
                this.handleViewportChange();
            });
        }
        
        // Setup header
        this.setupHeader();

        this.applyUserAvatarToProfileNav();
        
        // Override fetch to add platform header for MAX
        this.setupFetchInterceptor();
    }
    
    setupFetchInterceptor() {
        if (!this.isMax) return;
        
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const [url, options = {}] = args;
            const headers = options.headers || {};
            
            // Add platform header for MAX requests
            if (this.isMax) {
                headers['X-MiniApp-Platform'] = 'max';
            }
            
            return originalFetch(url, { ...options, headers });
        };
    }

    applyTheme() {
        // FORCE WHITE THEME - Always use light colors regardless of MAX theme
        document.documentElement.style.setProperty('--tg-theme-bg-color', '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-text-color', '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', '#999999');
        document.documentElement.style.setProperty('--tg-theme-link-color', '#0088cc');
        document.documentElement.style.setProperty('--tg-theme-button-color', '#0088cc');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', '#f5f5f5');
        
        // Force light theme - remove dark class if exists
        document.body.classList.remove('tg-dark');
        document.body.classList.add('tg-theme-applied');
    }

    setupHeader() {
        // Hide top bar in MAX (it's handled by MAX)
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            topBar.style.display = 'none';
        }
        
        // Adjust header for MAX
        const header = document.querySelector('.header');
        if (header) {
            header.classList.add('tg-header');
        }
    }

    applyUserAvatarToProfileNav() {
        if (!this.isMax) return;

        const user = this.getUserData();
        const photoUrl = user && user.photo_url;
        if (!photoUrl) return;

        const profileNavItem = document.querySelector('.tg-bottom-nav .tg-nav-item[href="#profile"]');
        if (!profileNavItem) return;

        const svg = profileNavItem.querySelector('svg');

        let avatarImg = profileNavItem.querySelector('.tg-nav-avatar');
        if (!avatarImg) {
            avatarImg = document.createElement('img');
            avatarImg.className = 'tg-nav-avatar';
            avatarImg.alt = '';
            avatarImg.decoding = 'async';

            if (svg) {
                svg.insertAdjacentElement('afterend', avatarImg);
            } else {
                profileNavItem.insertBefore(avatarImg, profileNavItem.firstChild);
            }
        }

        avatarImg.onload = () => {
            profileNavItem.classList.add('tg-nav-item-has-avatar');
        };

        avatarImg.onerror = () => {
            profileNavItem.classList.remove('tg-nav-item-has-avatar');
            if (avatarImg && avatarImg.parentNode) {
                avatarImg.parentNode.removeChild(avatarImg);
            }
        };

        profileNavItem.classList.remove('tg-nav-item-has-avatar');
        avatarImg.src = photoUrl;

        if (avatarImg.complete && avatarImg.naturalWidth > 0) {
            profileNavItem.classList.add('tg-nav-item-has-avatar');
        }
    }

    setupMainButton() {
        // Main button will be set dynamically based on context
        // (e.g., "Add to Cart", "Checkout", etc.)
        this.hideMainButton();
    }

    showMainButton(text, callback) {
        if (!this.isMax) return;
        
        if (this.max.MainButton) {
            this.max.MainButton.setText(text);
            this.max.MainButton.onClick(callback);
            this.max.MainButton.show();
        }
    }

    hideMainButton() {
        if (!this.isMax) return;
        if (this.max.MainButton) {
            this.max.MainButton.hide();
        }
    }

    setupBackButton() {
        if (!this.isMax) return;
        
        if (this.max.BackButton) {
            this.max.BackButton.onClick(() => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    this.close();
                }
            });
        }
    }

    showBackButton() {
        if (!this.isMax) return;
        if (this.max.BackButton) {
            this.max.BackButton.show();
        }
    }

    hideBackButton() {
        if (!this.isMax) return;
        if (this.max.BackButton) {
            this.max.BackButton.hide();
        }
    }

    handleViewportChange() {
        // Adjust layout based on viewport
        const viewportHeight = this.max.viewportHeight;
        if (viewportHeight) {
            document.documentElement.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
        }
    }

    setupRegularMode() {
        // Add padding for safe area in regular browser
        document.body.style.paddingTop = '0';
    }

    // Share product via MAX
    shareProduct(product) {
        if (!this.isMax) return;
        
        const text = `${product.name}\n${product.price} ₽\n${product.description || ''}`;
        
        if (this.max && this.max.shareLink) {
            // Share link if available
            const url = `${window.location.origin}/product.html?id=${product.id}`;
            this.max.shareLink(url, text);
        } else {
            // Fallback: copy to clipboard or show share dialog
            this.copyToClipboard(`${text}\n${window.location.origin}/product.html?id=${product.id}`);
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Скопировано в буфер обмена');
            });
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showNotification('Скопировано в буфер обмена');
        }
    }

    showNotification(message) {
        // Лёгкий ненавязчивый toast без кнопки OK
        let toast = document.getElementById('maxToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'maxToast';
            toast.className = 'tg-toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('show');

        // Автоматически скрываем через 2 секунды
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // Get user data from MAX or Telegram
    getUserData() {
        if (!this.isMax && !this.isTelegram) return null;
        
        // MAX uses window.WebApp.initDataUnsafe.user
        if (this.isMax && this.max && this.max.initDataUnsafe && this.max.initDataUnsafe.user) {
            const maxUser = this.max.initDataUnsafe.user;
            // Convert MAX user format to Telegram format for compatibility
            return {
                id: maxUser.id,
                first_name: maxUser.first_name,
                last_name: maxUser.last_name,
                username: maxUser.username,
                language_code: maxUser.language_code,
                photo_url: maxUser.photo_url
            };
        }
        
        // Telegram uses initDataUnsafe.user
        if (this.isTelegram && this.max && this.max.initDataUnsafe && this.max.initDataUnsafe.user) {
            return this.max.initDataUnsafe.user;
        }
        
        return null;
    }

    // Haptic feedback
    hapticFeedback(type = 'impact') {
        if (!this.isMax) return;
        
        if (this.max.HapticFeedback) {
            switch (type) {
                case 'impact':
                    this.max.HapticFeedback.impactOccurred('medium');
                    break;
                case 'success':
                    this.max.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    this.max.HapticFeedback.notificationOccurred('error');
                    break;
                default:
                    this.max.HapticFeedback.impactOccurred('light');
            }
        }
    }

    // Close app
    close() {
        if (this.isMax && this.max.close) {
            this.max.close();
        }
    }

    // Open link externally
    openLink(url) {
        if (this.isMax && this.max.openLink) {
            this.max.openLink(url, { try_instant_view: false });
        } else {
            window.open(url, '_blank');
        }
    }

    // Open MAX
    openMax(username) {
        if (this.isMax && this.max.openMaxLink) {
            this.max.openMaxLink(`https://max.ru/${username}`);
        } else if (this.isMax && this.max.openTelegramLink) {
            // Fallback to Telegram link format
            this.max.openTelegramLink(`https://t.me/${username}`);
        } else {
            window.open(`https://max.ru/${username}`, '_blank');
        }
    }
}

// Initialize MAX Web App
const maxWebApp = new MaxWebApp();
window.maxWebApp = maxWebApp;

// Also expose as telegramWebApp for compatibility with existing code
window.telegramWebApp = maxWebApp;
