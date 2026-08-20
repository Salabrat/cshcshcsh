// Special loader for shop-all page
// Loads products from server API if available, otherwise uses local database

class ShopAllLoader {
    constructor() {
        this.apiUrl = '/api';
        this.productsGrid = document.getElementById('productsGrid');
        this.productCounter = document.querySelector('.product-count');
        this.allProducts = [];
        this.displayedCount = 0;
        this.productsPerPage = 20; // Количество товаров на странице
    }
    
    async loadAllProducts() {
        console.log('Loading all products for shop-all page...');
        
        let products = [];
        
        // Check for brand filter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const brandId = urlParams.get('brand');
        
        // First try to load from API
        try {
            if (brandId) {
                // Load products for specific brand
                const response = await fetch(`${this.apiUrl}/products/brand/${brandId}`);
                if (response.ok) {
                    products = await response.json();
                    console.log(`Found ${products.length} products for brand ${brandId}`);
                    
                    // Update page title for brand
                    const pageTitle = document.querySelector('.shop-title');
                    if (pageTitle && products.length > 0) {
                        pageTitle.textContent = products[0].brandName || 'BRAND COLLECTION';
                    }
                }
            } else {
                // Load all products
                const response = await fetch(`${this.apiUrl}/products`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Loaded data from API:', data);
                    
                    // Collect all products from all categories
                    for (const category in data.products) {
                        if (data.products[category] && Array.isArray(data.products[category])) {
                            products.push(...data.products[category]);
                        }
                    }
                    console.log(`Found ${products.length} products from API`);
                }
            }
        } catch (error) {
            console.log('API not available, using local database');
        }
        
        // If no products from API, try local database
        if (products.length === 0 && window.productDB) {
            products = window.productDB.getAllProducts();
            console.log(`Found ${products.length} products from local database`);
        }

        // If still no products, try loading from products.json (static fallback)
        if (products.length === 0) {
            try {
                const response = await fetch('/products.json', { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();

                    if (data && data.products && typeof data.products === 'object') {
                        for (const category in data.products) {
                            if (data.products[category] && Array.isArray(data.products[category])) {
                                products.push(...data.products[category]);
                            }
                        }
                    }

                    if (brandId) {
                        const brandIdNum = Number(brandId);
                        if (!Number.isNaN(brandIdNum)) {
                            products = products.filter(p => p && p.brandId === brandIdNum);
                        }
                    }

                    console.log(`Found ${products.length} products from products.json`);

                    const pageTitle = document.querySelector('.shop-title');
                    if (pageTitle && brandId && products.length > 0) {
                        pageTitle.textContent = products[0].brandName || 'BRAND COLLECTION';
                    }
                }
            } catch (error) {
                console.log('Failed to load products.json fallback');
            }
        }
        
        // Store all products
        this.allProducts = products;
        this.displayedCount = 0;
        
        // Display products
        this.displayProducts(products);
        
        // Setup load more button
        this.setupLoadMoreButton();
        
        // Update counter
        if (this.productCounter) {
            const count = products && Array.isArray(products) ? products.length : 0;
            this.productCounter.textContent = `${count} изделий`;
            
            // Обновляем все счетчики на странице (включая фиксированные)
            const allCounters = document.querySelectorAll('.product-count[data-category="ALL"]');
            allCounters.forEach(counter => {
                counter.textContent = `${count} изделий`;
            });
            
            // Отправляем событие для синхронизации
            document.dispatchEvent(new CustomEvent('productCounterUpdated'));
        }
    }
    
    displayProducts(products) {
        if (!this.productsGrid) {
            console.error('Products grid not found');
            return;
        }
        
        // Clear existing content
        this.productsGrid.innerHTML = '';
        
        if (products.length === 0) {
            this.showEmptyState();
            this.updateLoadMoreButton();
            return;
        }
        
        // Display first page of products
        this.displayNextPage();
        // Update button state after first page
        this.updateLoadMoreButton(this.displayedCount >= this.allProducts.length);
    }
    
    // Display next page of products
    displayNextPage() {
        const remainingProducts = this.allProducts.slice(this.displayedCount);
        const productsToShow = remainingProducts.slice(0, this.productsPerPage);
        
        if (productsToShow.length === 0) {
            this.updateLoadMoreButton(true);
            return;
        }
        
        productsToShow.forEach(product => {
            const card = this.createProductCard(product);
            this.productsGrid.appendChild(card);
        });
        
        this.displayedCount += productsToShow.length;
        this.updateLoadMoreButton(this.displayedCount >= this.allProducts.length);
    }
    
    // Setup load more button
    setupLoadMoreButton() {
        const loadMoreBtn = document.querySelector('.btn-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreProducts();
            });
        }
    }
    
    // Load more products
    loadMoreProducts() {
        const loadMoreBtn = document.querySelector('.btn-load-more');
        if (!loadMoreBtn || loadMoreBtn.disabled) return;
        
        loadMoreBtn.textContent = 'ЗАГРУЗКА...';
        loadMoreBtn.disabled = true;
        
        // Simulate slight delay for better UX
        setTimeout(() => {
            this.displayNextPage();
            // displayNextPage() calls updateLoadMoreButton internally.
            // Only re-enable if there are still products left.
            if (this.displayedCount < this.allProducts.length) {
                loadMoreBtn.disabled = false;
            }
        }, 300);
    }
    
    // Update load more button state
    updateLoadMoreButton(allLoaded = false) {
        const loadMoreBtn = document.querySelector('.btn-load-more');
        const loadMoreSection = document.querySelector('.load-more-section');
        
        if (!loadMoreBtn || !loadMoreSection) return;
        
        // Если товаров меньше или равно productsPerPage, скрываем кнопку
        if (this.allProducts.length <= this.productsPerPage) {
            loadMoreSection.style.display = 'none';
            return;
        }
        
        if (allLoaded || this.displayedCount >= this.allProducts.length) {
            loadMoreBtn.textContent = 'ПОКА ЧТО ЭТО ВСЕ ТОВАРЫ';
            loadMoreBtn.disabled = true;
            loadMoreBtn.style.opacity = '0.6';
            loadMoreBtn.style.cursor = 'not-allowed';
            loadMoreSection.style.display = 'block';
        } else {
            loadMoreBtn.textContent = 'ПОКАЗАТЬ ЕЩЕ';
            loadMoreBtn.disabled = false;
            loadMoreBtn.style.opacity = '1';
            loadMoreBtn.style.cursor = 'pointer';
            loadMoreSection.style.display = 'block';
        }
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
            <h3>В магазине пока нет товаров</h3>
            <p>Товары будут добавлены администратором</p>
        `;
        
        this.productsGrid.appendChild(emptyState);
    }
    
    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-id', product.id);
        
        // Get images
        const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTIwQzE2NS0xNSAxODUgMTM1IDE1MCAyMDBDMTE1IDEzNSAxMzUgMTE1IDE1MCAxMjBaIiBmaWxsPSIjRTVFN0VCIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEzIiBmb250LXNpemU9IjE0Ij5ObyBpbWFnZTwvdGV4dD4KPC9zdmc+';
        
        let firstImage = placeholder;
        let secondImage = placeholder;
        
        if (product.images && product.images.length > 0) {
            // Handle different image formats
            if (typeof product.images[0] === 'string') {
                firstImage = product.images[0];
            } else if (product.images[0].url) {
                firstImage = product.images[0].url;
            } else if (product.images[0].data) {
                firstImage = product.images[0].data;
            }
            
            if (product.images.length > 1) {
                if (typeof product.images[1] === 'string') {
                    secondImage = product.images[1];
                } else if (product.images[1].url) {
                    secondImage = product.images[1].url;
                } else if (product.images[1].data) {
                    secondImage = product.images[1].data;
                }
            } else {
                secondImage = firstImage;
            }
        }
        
        const parsePriceValue = (value) => {
            if (value === null || value === undefined || value === '') return null;
            if (typeof value === 'number') return value;
            const numeric = parseInt(String(value).replace(/[^\d]/g, ''), 10);
            return Number.isFinite(numeric) ? numeric : null;
        };

        const priceFormatter = new Intl.NumberFormat('ru-RU');
        const basePriceValue = parsePriceValue(product.price);
        const newPriceValue = parsePriceValue(product.newPrice);
        const oldPriceValue = parsePriceValue(product.oldPrice);
        const hasDiscount = Number.isFinite(oldPriceValue) && Number.isFinite(newPriceValue) && newPriceValue > 0 && newPriceValue < oldPriceValue;
        const currentPriceValue = hasDiscount ? newPriceValue : basePriceValue;
        const formattedCurrentPrice = currentPriceValue !== null ? `${priceFormatter.format(currentPriceValue)} ₽` : 'Цена по запросу';
        const formattedOldPrice = hasDiscount ? `${priceFormatter.format(oldPriceValue)} ₽` : null;
        
        card.innerHTML = `
            <div class="product-image">
                <img class="product-image-primary" src="${firstImage}" alt="${product.name}" loading="lazy" onerror="this.src='${placeholder}'">
                ${secondImage !== firstImage ? `<img class="product-image-hover" src="${secondImage}" alt="${product.name}" loading="lazy" onerror="this.src='${placeholder}'">` : ''}
            </div>
            <h3 class="product-name">${product.name || 'Без названия'}</h3>
            <span class="product-price ${hasDiscount ? 'has-discount' : ''}"
                  data-current-price="${currentPriceValue ?? 0}"
                  data-old-price="${hasDiscount && oldPriceValue ? oldPriceValue : ''}">
                ${hasDiscount && formattedOldPrice
                    ? `<span class="price-old">${formattedOldPrice}</span><span class="price-new">${formattedCurrentPrice}</span>`
                    : formattedCurrentPrice}
            </span>
        `;

        // Add click handler
        card.addEventListener('click', () => {
            if (window.productModal && window.productModal.open) {
                window.productModal.open(product);
            } else {
                console.log('Product clicked:', product.name);
            }
        });
        
        return card;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Only run on shop-all page
    if (window.location.pathname.includes('shop-all.html')) {
        const shopAllLoader = new ShopAllLoader();
        
        // Load products after a short delay to ensure everything is initialized
        setTimeout(() => {
            shopAllLoader.loadAllProducts();
        }, 100);
    }
});
