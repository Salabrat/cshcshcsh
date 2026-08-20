// Telegram Mini App Search Functionality
class TelegramSearch {
    constructor() {
        this.searchBtn = document.getElementById('tgSearchBtn');
        this.searchPanel = document.getElementById('tgSearchPanel');
        this.searchPanelOverlay = document.getElementById('tgSearchPanelOverlay');
        this.searchPanelClose = document.getElementById('tgSearchPanelClose');
        this.searchInput = document.getElementById('tgSearchPanelInput');
        this.searchResults = document.getElementById('tgSearchResults');
        this.searchTimeout = null;
        this.allProducts = [];
        this.allBrands = [];
        this.init();
    }

    async init() {
        if (!this.searchBtn || !this.searchPanel) return;

        // Load products and brands
        await this.loadData();

        // Setup event listeners
        this.searchBtn.addEventListener('click', () => this.openSearch());
        this.searchPanelClose.addEventListener('click', () => this.closeSearch());
        this.searchPanelOverlay.addEventListener('click', () => this.closeSearch());
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSearch();
            }
        });

        // Close on back button (Telegram)
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => {
                if (this.searchPanel.classList.contains('active')) {
                    this.closeSearch();
                }
            });
        }
    }

    async loadData() {
        try {
            // Load products
            const productsResponse = await fetch('/api/products');
            if (productsResponse.ok) {
                const productsData = await productsResponse.json();
                this.allProducts = [];
                for (const category in productsData.products) {
                    if (Array.isArray(productsData.products[category])) {
                        this.allProducts.push(...productsData.products[category]);
                    }
                }
            }

            // Load brands
            const brandsResponse = await fetch('/api/brands');
            if (brandsResponse.ok) {
                this.allBrands = await brandsResponse.json();
            }
        } catch (error) {
            console.error('Error loading search data:', error);
        }
    }

    openSearch() {
        this.searchPanel.classList.add('active');
        this.searchPanelOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Show back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.showBackButton();
        }

        // Focus input after animation
        setTimeout(() => {
            this.searchInput.focus();
        }, 300);
    }

    closeSearch() {
        this.searchPanel.classList.remove('active');
        this.searchPanelOverlay.classList.remove('active');
        document.body.style.overflow = '';
        this.searchInput.value = '';
        this.searchResults.classList.remove('active');
        this.searchResults.innerHTML = '';

        // Hide back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
        }
    }

    handleSearch(query) {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        this.searchTimeout = setTimeout(() => {
            if (query.trim().length === 0) {
                this.searchResults.classList.remove('active');
                this.searchResults.innerHTML = '';
                return;
            }

            const results = this.performSearch(query.trim());
            this.displayResults(results);
        }, 300);
    }

    performSearch(query) {
        const lowerQuery = query.toLowerCase();
        const results = {
            products: [],
            brands: []
        };

        // Search products
        this.allProducts.forEach(product => {
            if (!product.isActive) return;

            const nameMatch = product.name && product.name.toLowerCase().includes(lowerQuery);
            const brandMatch = product.brandName && product.brandName.toLowerCase().includes(lowerQuery);
            const descMatch = product.description && product.description.toLowerCase().includes(lowerQuery);

            if (nameMatch || brandMatch || descMatch) {
                results.products.push(product);
            }
        });

        // Search brands
        this.allBrands.forEach(brand => {
            if (brand.name && brand.name.toLowerCase().includes(lowerQuery)) {
                results.brands.push(brand);
            }
        });

        return results;
    }

    displayResults(results) {
        const totalResults = results.products.length + results.brands.length;

        if (totalResults === 0) {
            this.searchResults.innerHTML = `
                <div class="tg-search-result-empty">
                    <p>Ничего не найдено</p>
                    <p style="font-size: 12px; margin-top: 8px; color: #999;">Попробуйте другой запрос</p>
                </div>
            `;
            this.searchResults.classList.add('active');
            return;
        }

        let html = '';

        // Display products
        results.products.slice(0, 10).forEach(product => {
            const imageUrl = this.getProductImage(product);
            const price = this.formatPrice(product.price, product);
            
            html += `
                <div class="tg-search-result-item" data-type="product" data-id="${product.id}">
                    <img src="${imageUrl}" alt="${this.escapeHtml(product.name)}" class="tg-search-result-item-image" onerror="this.style.display='none'">
                    <div class="tg-search-result-item-info">
                        <div class="tg-search-result-item-name">${this.escapeHtml(product.name)}</div>
                        <div class="tg-search-result-item-price">${price}</div>
                    </div>
                </div>
            `;
        });

        // Display brands
        results.brands.slice(0, 5).forEach(brand => {
            const imageUrl = brand.logo || '';
            
            html += `
                <div class="tg-search-result-item" data-type="brand" data-id="${brand.id}">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${this.escapeHtml(brand.name)}" class="tg-search-result-item-image" onerror="this.style.display='none'">` : '<div class="tg-search-result-item-image" style="background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 20px;">📦</div>'}
                    <div class="tg-search-result-item-info">
                        <div class="tg-search-result-item-name">${this.escapeHtml(brand.name)}</div>
                        <div class="tg-search-result-item-price" style="font-size: 12px; color: #999;">Бренд</div>
                    </div>
                </div>
            `;
        });

        this.searchResults.innerHTML = html;
        this.searchResults.classList.add('active');

        // Add click handlers
        this.searchResults.querySelectorAll('.tg-search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const id = item.dataset.id;

                if (type === 'product') {
                    this.openProduct(id);
                } else if (type === 'brand') {
                    this.openBrand(id);
                }
            });
        });
    }

    openProduct(productId) {
        if (window.telegramProductModal) {
            window.telegramProductModal.open(productId);
            this.closeSearch();
        }
    }

    openBrand(brandId) {
        if (window.telegramNavigation) {
            window.telegramNavigation.navigate('#catalog');
            // Navigate to brand page
            setTimeout(() => {
                if (window.telegramCatalog) {
                    const brand = this.allBrands.find(b => b.id === parseInt(brandId));
                    if (brand) {
                        window.telegramCatalog.openBrand(brand);
                    }
                }
            }, 100);
            this.closeSearch();
        }
    }

    getProductImage(product) {
        if (product.images && product.images.length > 0) {
            const img = product.images[0];
            if (typeof img === 'string') return img;
            if (img.url) return img.url;
            if (img.data) return img.data;
        }
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    formatPrice(price, product = null) {
        if (!price) return '0 ₽';
        const numPrice = typeof price === 'string' ? parseInt(price.replace(/\s/g, '')) : price;
        
        if (product && product.oldPrice && product.newPrice) {
            return parseInt(product.newPrice).toLocaleString('ru-RU') + ' ₽';
        }
        
        return numPrice.toLocaleString('ru-RU') + ' ₽';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize search
let telegramSearch = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramSearch = new TelegramSearch();
        window.telegramSearch = telegramSearch;
    });
} else {
    telegramSearch = new TelegramSearch();
    window.telegramSearch = telegramSearch;
}
