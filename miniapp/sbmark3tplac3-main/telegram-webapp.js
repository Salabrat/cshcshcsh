// Telegram Web App Integration
class TelegramWebApp {
    constructor() {
        this.tg = null;
        this.isTelegram = false;
        this._initialized = false;
        this._pendingInit = null;
        this.init();
    }

    init() {
        // If already initializing, wait for it
        if (this._pendingInit) {
            return this._pendingInit;
        }
        
        this._pendingInit = (async () => {
            // Wait for Telegram SDK to load (up to 2 seconds)
            let attempts = 0;
            while (!window.Telegram?.WebApp && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            console.log('Telegram SDK loading attempts:', attempts);
            console.log('window.Telegram:', window.Telegram);
            console.log('window.Telegram?.WebApp:', window.Telegram?.WebApp);
            
            // Check if running in Telegram
            if (window.Telegram && window.Telegram.WebApp) {
                this.tg = window.Telegram.WebApp;
                this.isTelegram = true;
                console.log('Telegram WebApp detected, initializing...');
                this.setupTelegramApp();
            } else {
                // Not in Telegram, use regular web version
                console.log('Running in regular browser mode');
                this.setupRegularMode();
            }
            
            this._initialized = true;
            this._pendingInit = null;
        })();
        
        return this._pendingInit;
    }

    setupTelegramApp() {
        console.log('Telegram Web App initialized');
        
        // Expand app to full height
        this.tg.expand();
        
        // Set theme colors based on Telegram theme
        this.applyTheme();
        
        // Enable closing confirmation
        this.tg.enableClosingConfirmation();
        
        // Set main button
        this.setupMainButton();
        
        // Setup back button
        this.setupBackButton();
        
        // Listen for theme changes
        this.tg.onEvent('themeChanged', () => {
            this.applyTheme();
        });
        
        // Listen for viewport changes
        this.tg.onEvent('viewportChanged', () => {
            this.handleViewportChange();
        });
        
        // Setup header
        this.setupHeader();

        // Apply avatar after DOM is ready
        setTimeout(() => this.applyUserAvatarToProfileNav(), 500);
        
        // Set initial state
        this.tg.ready();
    }

    applyTheme() {
        // FORCE WHITE THEME - Always use light colors regardless of Telegram theme
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
        // Hide top bar in Telegram (it's handled by Telegram)
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            topBar.style.display = 'none';
        }
        
        // Adjust header for Telegram
        const header = document.querySelector('.header');
        if (header) {
            header.classList.add('tg-header');
        }
    }

    applyUserAvatarToProfileNav() {
        if (!this.isTelegram) return;

        const user = this.getUserData();
        console.log('applyUserAvatarToProfileNav: user data', user);
        const photoUrl = user && user.photo_url;
        console.log('applyUserAvatarToProfileNav: photoUrl', photoUrl);
        if (!photoUrl) {
            console.log('applyUserAvatarToProfileNav: no photoUrl, skipping');
            return;
        }

        const profileNavItem = document.querySelector('.tg-bottom-nav .tg-nav-item[href="#profile"]');
        if (!profileNavItem) {
            console.log('applyUserAvatarToProfileNav: profileNavItem not found');
            return;
        }
        console.log('applyUserAvatarToProfileNav: profileNavItem found', profileNavItem);

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
        if (!this.isTelegram) return;
        
        this.tg.MainButton.setText(text);
        this.tg.MainButton.onClick(callback);
        this.tg.MainButton.show();
    }

    hideMainButton() {
        if (!this.isTelegram) return;
        this.tg.MainButton.hide();
    }

    setupBackButton() {
        if (!this.isTelegram) return;
        
        this.tg.BackButton.onClick(() => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                this.tg.close();
            }
        });
    }

    showBackButton() {
        if (!this.isTelegram) return;
        this.tg.BackButton.show();
    }

    hideBackButton() {
        if (!this.isTelegram) return;
        this.tg.BackButton.hide();
    }

    handleViewportChange() {
        // Adjust layout based on viewport
        const viewportHeight = this.tg.viewportHeight;
        if (viewportHeight) {
            document.documentElement.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
        }
    }

    setupRegularMode() {
        // Add padding for safe area in regular browser
        document.body.style.paddingTop = '0';
    }

    // Share product via Telegram
    shareProduct(product) {
        if (!this.isTelegram) return;
        
        const text = `${product.name}\n${product.price} ₽\n${product.description || ''}`;
        
        if (this.tg && this.tg.shareLink) {
            // Share link if available
            const url = `${window.location.origin}/product.html?id=${product.id}`;
            this.tg.shareLink(url, text);
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
        let toast = document.getElementById('tgToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tgToast';
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

    // Get user data from Telegram
    getUserData() {
        if (!this.isTelegram) return null;
        return this.tg.initDataUnsafe?.user || null;
    }

    // Haptic feedback
    hapticFeedback(type = 'impact') {
        if (!this.isTelegram) return;
        
        if (this.tg.HapticFeedback) {
            switch (type) {
                case 'impact':
                    this.tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'success':
                    this.tg.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    this.tg.HapticFeedback.notificationOccurred('error');
                    break;
                default:
                    this.tg.HapticFeedback.impactOccurred('light');
            }
        }
    }

    // Close app
    close() {
        if (this.isTelegram && this.tg.close) {
            this.tg.close();
        }
    }

    // Open link externally
    openLink(url) {
        if (this.isTelegram && this.tg.openLink) {
            this.tg.openLink(url, { try_instant_view: false });
        } else {
            window.open(url, '_blank');
        }
    }

    // Open Telegram
    openTelegram(username) {
        if (this.isTelegram && this.tg.openTelegramLink) {
            this.tg.openTelegramLink(`https://t.me/${username}`);
        } else {
            window.open(`https://t.me/${username}`, '_blank');
        }
    }
}

// Initialize Telegram Web App (only if not already set by MAX)
if (!window.telegramWebApp) {
    const telegramWebApp = new TelegramWebApp();
    window.telegramWebApp = telegramWebApp;
}
