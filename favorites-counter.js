// Favorites Counter - Updates the badge count in header
class FavoritesCounter {
    constructor() {
        this.counterElement = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.setupCounter(), 100);
            });
        } else {
            setTimeout(() => this.setupCounter(), 100);
        }

        // Listen for favorites updates
        window.addEventListener('favoritesUpdated', () => {
            this.updateCounter();
        });

        // Initial update after a delay to ensure everything is loaded
        setTimeout(() => {
            this.updateCounter();
        }, 300);
    }

    setupCounter() {
        // Find or create counter element
        // Try regular header icon first
        let favoritesIcon = document.querySelector('.favorites-icon');
        if (favoritesIcon) {
            // Check if counter already exists
            let counter = favoritesIcon.querySelector('.favorites-counter-badge');
            if (!counter) {
                counter = document.createElement('span');
                counter.className = 'favorites-counter-badge';
                favoritesIcon.appendChild(counter);
            }
            this.counterElement = counter;
            this.updateCounter();
        } else {
            // Try Telegram Mini App navigation item
            const tgNavItem = document.querySelector('.tg-favorites-nav-item');
            if (tgNavItem) {
                let counter = tgNavItem.querySelector('.tg-favorites-badge');
                if (!counter) {
                    counter = document.createElement('span');
                    counter.className = 'tg-favorites-badge';
                    tgNavItem.appendChild(counter);
                }
                this.counterElement = counter;
                this.updateCounter();
            }
        }
    }

    updateCounter() {
        if (!this.counterElement) {
            this.setupCounter();
            // Try again after setup
            if (!this.counterElement) {
                return;
            }
        }

        const count = window.favoritesManager ? window.favoritesManager.getCount() : 0;
        
        if (count > 0) {
            this.counterElement.textContent = count;
            // Check if it's Telegram Mini App badge (different display logic)
            if (this.counterElement.classList.contains('tg-favorites-badge')) {
                this.counterElement.style.display = 'block';
            } else {
                this.counterElement.style.display = 'flex';
            }
        } else {
            this.counterElement.style.display = 'none';
            this.counterElement.textContent = '';
        }
    }

    // Static method to update counter from anywhere
    static update() {
        if (window.favoritesCounter) {
            window.favoritesCounter.updateCounter();
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.favoritesCounter = new FavoritesCounter();
    });
} else {
    window.favoritesCounter = new FavoritesCounter();
}
