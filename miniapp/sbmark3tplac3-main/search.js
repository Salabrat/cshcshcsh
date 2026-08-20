// Search functionality with autocomplete and results page
class SearchFunctionality {
    constructor() {
        this.searchInput = document.querySelector('.search-input');
        this.searchForm = document.querySelector('.search-form');
        this.searchOverlay = document.getElementById('searchOverlay');
        this.autocompleteContainer = null;
        this.allProducts = [];
        this.currentSuggestions = [];
        
        this.init();
    }

    async init() {
        // Load all products
        await this.loadAllProducts();
        
        // Setup search input events
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleInput(e));
            this.searchInput.addEventListener('focus', () => {
                // Show autocomplete if there's text
                if (this.searchInput.value.trim().length >= 1) {
                    this.showSuggestions(this.searchInput.value.trim());
                }
            });
            this.searchInput.addEventListener('blur', () => {
                // Delay to allow clicking on suggestions
                setTimeout(() => this.hideAutocomplete(), 200);
            });
        }
        
        // Setup form submission
        if (this.searchForm) {
            this.searchForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        // Setup autocomplete container
        this.createAutocompleteContainer();
    }

    async loadAllProducts() {
        // Try window.productDB first (if already loaded)
        if (window.productDB && typeof window.productDB.getAllProducts === 'function') {
            const dbProducts = window.productDB.getAllProducts();
            if (dbProducts && dbProducts.length > 0) {
                this.allProducts = dbProducts;
                console.log(`[Search] Loaded ${this.allProducts.length} products from database`);
                return;
            }
        }
        
        // Try API
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                if (data.products) {
                    for (const category in data.products) {
                        if (data.products[category] && Array.isArray(data.products[category])) {
                            this.allProducts.push(...data.products[category]);
                        }
                    }
                }
                if (this.allProducts.length > 0) {
                    console.log(`[Search] Loaded ${this.allProducts.length} products from API`);
                    return;
                }
            }
        } catch (error) {
            console.log('[Search] API not available, trying products.json');
        }
        
        // Fallback to products.json
        try {
            const response = await fetch('/products.json');
            if (response.ok) {
                const data = await response.json();
                if (data.products) {
                    for (const category in data.products) {
                        if (data.products[category] && Array.isArray(data.products[category])) {
                            this.allProducts.push(...data.products[category]);
                        }
                    }
                }
                if (this.allProducts.length > 0) {
                    console.log(`[Search] Loaded ${this.allProducts.length} products from products.json`);
                    return;
                }
            }
        } catch (error) {
            console.error('[Search] Failed to load products.json:', error);
        }
        
        // Final fallback - wait a bit and try window.productDB again (might load later)
        if (this.allProducts.length === 0) {
            setTimeout(() => {
                if (window.productDB && typeof window.productDB.getAllProducts === 'function') {
                    const dbProducts = window.productDB.getAllProducts();
                    if (dbProducts && dbProducts.length > 0) {
                        this.allProducts = dbProducts;
                        console.log(`[Search] Loaded ${this.allProducts.length} products from database (delayed)`);
                    }
                }
            }, 500);
        }
        
        if (this.allProducts.length === 0) {
            console.warn('[Search] No products loaded for search');
        }
    }

    createAutocompleteContainer() {
        if (!this.searchInput || !this.searchInput.parentElement) return;
        
        this.autocompleteContainer = document.createElement('div');
        this.autocompleteContainer.className = 'search-autocomplete';
        this.autocompleteContainer.style.display = 'none';
        
        const searchContent = this.searchInput.closest('.search-content');
        if (searchContent) {
            searchContent.appendChild(this.autocompleteContainer);
        }
    }

    handleInput(e) {
        const query = e.target.value.trim();
        
        if (query.length < 1) {
            this.hideAutocomplete();
            return;
        }
        
        this.showSuggestions(query);
    }

    showSuggestions(query) {
        const allSuggestions = this.searchProducts(query); // Get all suggestions
        const maxVisible = 5;
        const visibleSuggestions = allSuggestions.slice(0, maxVisible);
        this.currentSuggestions = allSuggestions;
        
        if (!this.autocompleteContainer) return;
        
        if (visibleSuggestions.length === 0) {
            this.hideAutocomplete();
            return;
        }
        
        // Build suggestions HTML
        let html = '<ul class="search-suggestions-list">';
        visibleSuggestions.forEach(product => {
            html += `
                <li class="search-suggestion-item" data-product-id="${product.id}">
                    <span class="suggestion-name">${this.highlightMatch(product.name, query)}</span>
                    <span class="suggestion-price">${this.formatPrice(product.price)} ₽</span>
                </li>
            `;
        });
        html += '</ul>';
        
        // Add "Show more" button if there are more results
        if (allSuggestions.length > maxVisible) {
            html += `
                <div class="search-show-more">
                    <button class="search-show-more-btn" data-query="${query}">
                        Показать больше... (${allSuggestions.length - maxVisible} ещё)
                    </button>
                </div>
            `;
        }
        
        this.autocompleteContainer.innerHTML = html;
        this.showAutocomplete();
        
        // Add click handlers for suggestions
        const suggestionItems = this.autocompleteContainer.querySelectorAll('.search-suggestion-item');
        suggestionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const productId = parseInt(item.getAttribute('data-product-id'));
                const product = this.allProducts.find(p => p.id === productId);
                if (product) {
                    this.selectSuggestion(product);
                }
            });
        });
        
        // Add click handler for "Show more" button
        const showMoreBtn = this.autocompleteContainer.querySelector('.search-show-more-btn');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.performSearch(query);
            });
        }
    }

    selectSuggestion(product) {
        if (this.searchInput) {
            this.searchInput.value = product.name;
        }
        this.hideAutocomplete();
        // Submit search with product name
        this.performSearch(product.name);
    }

    showAutocomplete() {
        if (this.autocompleteContainer && this.currentSuggestions.length > 0) {
            this.autocompleteContainer.style.display = 'block';
        }
    }

    hideAutocomplete() {
        if (this.autocompleteContainer) {
            this.autocompleteContainer.style.display = 'none';
        }
    }

    handleSubmit(e) {
        e.preventDefault();
        const query = this.searchInput ? this.searchInput.value.trim() : '';
        
        if (query.length === 0) {
            return;
        }
        
        this.performSearch(query);
    }

    performSearch(query) {
        // Redirect to search results page
        const searchUrl = `search-results.html?q=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
    }

    searchProducts(query, limit = null) {
        const lowerQuery = query.toLowerCase();
        const matches = [];
        
        this.allProducts.forEach(product => {
            const name = (product.name || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            
            // Check if query matches name or description
            if (name.includes(lowerQuery) || description.includes(lowerQuery)) {
                matches.push(product);
            }
        });
        
        // Sort by relevance (name matches first)
        matches.sort((a, b) => {
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();
            const aNameMatch = aName.startsWith(lowerQuery);
            const bNameMatch = bName.startsWith(lowerQuery);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            return 0;
        });
        
        return limit ? matches.slice(0, limit) : matches;
    }

    highlightMatch(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU').format(price);
    }
}

// Search Results Page Handler
class SearchResultsPage {
    constructor() {
        this.searchQuery = this.getQueryFromURL();
        this.productsGrid = document.getElementById('productsGrid');
        this.shopTitle = document.querySelector('.shop-title');
        this.productCounter = document.querySelector('.product-count');
        this.allProducts = [];
        
        if (this.searchQuery) {
            this.init();
        }
    }

    getQueryFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('q') || '';
    }

    async init() {
        // Update page title
        if (this.shopTitle) {
            this.shopTitle.textContent = this.searchQuery.toUpperCase();
        }
        
        // Update search input value if exists
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = this.searchQuery;
        }
        
        // Load all products and search
        await this.loadAllProducts();
        const results = this.searchProducts(this.searchQuery);
        this.displayResults(results);
    }

    async loadAllProducts() {
        // Try window.productDB first (if already loaded)
        if (window.productDB && typeof window.productDB.getAllProducts === 'function') {
            const dbProducts = window.productDB.getAllProducts();
            if (dbProducts && dbProducts.length > 0) {
                this.allProducts = dbProducts;
                console.log(`[SearchResults] Loaded ${this.allProducts.length} products from database`);
                return;
            }
        }
        
        // Try API
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                if (data.products) {
                    for (const category in data.products) {
                        if (data.products[category] && Array.isArray(data.products[category])) {
                            this.allProducts.push(...data.products[category]);
                        }
                    }
                }
                if (this.allProducts.length > 0) {
                    console.log(`[SearchResults] Loaded ${this.allProducts.length} products from API`);
                    return;
                }
            }
        } catch (error) {
            console.log('[SearchResults] API not available, trying products.json');
        }
        
        // Fallback to products.json
        try {
            const response = await fetch('/products.json');
            if (response.ok) {
                const data = await response.json();
                if (data.products) {
                    for (const category in data.products) {
                        if (data.products[category] && Array.isArray(data.products[category])) {
                            this.allProducts.push(...data.products[category]);
                        }
                    }
                }
                if (this.allProducts.length > 0) {
                    console.log(`[SearchResults] Loaded ${this.allProducts.length} products from products.json`);
                    return;
                }
            }
        } catch (error) {
            console.error('[SearchResults] Failed to load products.json:', error);
        }
        
        // Final fallback - wait a bit and try window.productDB again (might load later)
        if (this.allProducts.length === 0) {
            setTimeout(() => {
                if (window.productDB && typeof window.productDB.getAllProducts === 'function') {
                    const dbProducts = window.productDB.getAllProducts();
                    if (dbProducts && dbProducts.length > 0) {
                        this.allProducts = dbProducts;
                        console.log(`[SearchResults] Loaded ${this.allProducts.length} products from database (delayed)`);
                        // Re-run search with loaded products
                        const results = this.searchProducts(this.searchQuery);
                        this.displayResults(results);
                    }
                }
            }, 500);
        }
        
        if (this.allProducts.length === 0) {
            console.warn('[SearchResults] No products loaded for search');
        }
    }

    searchProducts(query) {
        const lowerQuery = query.toLowerCase();
        const matches = [];
        
        this.allProducts.forEach(product => {
            const name = (product.name || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            
            if (name.includes(lowerQuery) || description.includes(lowerQuery)) {
                matches.push(product);
            }
        });
        
        return matches;
    }

    displayResults(products) {
        if (!this.productsGrid) {
            console.error('Products grid not found');
            return;
        }
        
        // Update counter
        if (this.productCounter) {
            const count = products && Array.isArray(products) ? products.length : 0;
            this.productCounter.textContent = `${count} изделий`;
        }
        
        // Clear existing content
        this.productsGrid.innerHTML = '';
        
        if (products.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Display products
        products.forEach(product => {
            const card = this.createProductCard(product);
            this.productsGrid.appendChild(card);
        });
    }

    showEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-catalog';
        emptyState.innerHTML = `
            <div class="empty-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="m1 1 4 4 2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
            </div>
            <h3>По вашему запросу товар не найден</h3>
            <p>Попробуйте изменить запрос или просмотрите другие товары в каталоге</p>
        `;
        this.productsGrid.appendChild(emptyState);
    }

    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-id', product.id);
        
        // Get first and second images or placeholder
        const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTIwQzE2NS0xNSAxODUgMTM1IDE1MCAyMDBDMTE1IDEzNSAxMzUgMTE1IDE1MCAxMjBaIiBmaWxsPSIjRTVFN0VCIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEzIiBmb250LXNpemU9IjE0Ij5ObyBpbWFnZTwvdGV4dD4KPC9zdmc+';
        
        const firstImage = product.images && product.images.length > 0 
            ? product.images[0].url || product.images[0] 
            : placeholder;
            
        // Get second image if available, otherwise use first image
        const secondImage = product.images && product.images.length > 1 
            ? product.images[1].url || product.images[1]
            : firstImage;
        
        const hasDiscount = product.oldPrice && product.newPrice;
        const formattedPrice = new Intl.NumberFormat('ru-RU').format(product.price);
        const formattedOldPrice = hasDiscount ? new Intl.NumberFormat('ru-RU').format(product.oldPrice) : null;
        const formattedNewPrice = hasDiscount ? new Intl.NumberFormat('ru-RU').format(product.newPrice) : null;
        const currentPriceValue = hasDiscount ? product.newPrice : product.price;
        
        card.innerHTML = `
            <div class="product-image">
                <img class="product-image-primary" src="${firstImage}" alt="${product.name}" loading="lazy" onerror="this.src='${placeholder}'">
                ${secondImage !== firstImage ? `<img class="product-image-hover" src="${secondImage}" alt="${product.name}" loading="lazy" onerror="this.src='${placeholder}'">` : ''}
            </div>
            <h3 class="product-name">${product.name}</h3>
            <span class="product-price ${hasDiscount ? 'has-discount' : ''}"
                  data-current-price="${currentPriceValue || 0}"
                  data-old-price="${hasDiscount ? product.oldPrice || '' : ''}">
                ${hasDiscount
                    ? `<span class="price-old">${formattedOldPrice} ₽</span><span class="price-new">${formattedNewPrice} ₽</span>`
                    : `${formattedPrice} ₽`}
            </span>
        `;
        
        // Add click handler
        card.addEventListener('click', () => {
            this.openProductPage(product.id);
        });
        
        return card;
    }

    openProductPage(productId) {
        const product = this.allProducts.find(p => p.id === productId);
        if (!product) return;
        
        if (window.productModal) {
            window.productModal.open(product);
        } else if (window.ProductModal) {
            window.productModal = new ProductModal();
            setTimeout(() => {
                window.productModal.open(product);
            }, 100);
        } else {
            window.location.href = `product.html?id=${productId}`;
        }
    }
}

// Initialize search functionality on pages with search overlay
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on search results page
    if (window.location.pathname.includes('search-results.html')) {
        // Initialize search results page handler
        window.searchResultsPage = new SearchResultsPage();
        
        // Also initialize search functionality for the search overlay on this page
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            window.searchFunctionality = new SearchFunctionality();
        }
    } else {
        // Initialize search functionality for other pages
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            window.searchFunctionality = new SearchFunctionality();
        }
    }
});
