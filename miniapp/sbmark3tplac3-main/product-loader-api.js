// Product Loader for API version
class ProductLoaderAPI {
    constructor() {
        this.productsGrid = document.getElementById('productsGrid');
        this.productCounter = document.querySelector('.product-count');
        this.currentCategory = this.detectCategory();
        this.allProducts = [];
        this.displayedCount = 0;
        this.productsPerPage = 20; // Количество товаров на странице
        this.init();
    }

    async init() {
        // Load category info (name, description) dynamically from API
        await this.loadCategoryInfo();
        // Load products directly from API
        await this.loadProducts();
        // Setup load more button
        this.setupLoadMoreButton();
    }

    // Load category name and description from API and update page elements
    async loadCategoryInfo() {
        if (this.currentCategory === 'all') return;

        try {
            const response = await fetch('/api/categories');
            if (!response.ok) return;

            const categories = await response.json();
            const cat = categories.find(c => c.slug === this.currentCategory || c.id === this.currentCategory);
            if (!cat) return;

            // Update page title
            const shopTitle = document.querySelector('.shop-title');
            if (shopTitle && cat.name) {
                shopTitle.textContent = cat.name;
            }

            // Update page description
            const shopDescription = document.querySelector('.shop-description');
            if (shopDescription && cat.description) {
                shopDescription.textContent = cat.description;
            }

            // Update document title
            if (cat.name) {
                document.title = cat.name + ' - ' + (document.title.split(' - ').pop() || 'Shop');
            }

            // Update breadcrumb
            const breadcrumb = document.querySelector('.breadcrumb');
            if (breadcrumb && cat.name) {
                const breadcrumbSpan = breadcrumb.querySelector('span:last-child');
                if (breadcrumbSpan) {
                    breadcrumbSpan.textContent = cat.name;
                }
            }

            // Update product count data-category attribute
            const productCount = document.querySelector('.product-count');
            if (productCount && cat.name) {
                productCount.setAttribute('data-category', cat.name);
            }

            console.log(`Category info loaded: ${cat.name}`);
        } catch (error) {
            console.error('Error loading category info:', error);
        }
    }

    // Detect current category from URL
    detectCategory() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        
        // Special case for shop-all
        if (filename === 'shop-all.html') {
            return 'all';
        }
        
        // Extract category from filename pattern: category-{slug}.html
        if (filename.startsWith('category-') && filename.endsWith('.html')) {
            const rawCategory = filename.replace('category-', '').replace('.html', '');
            const category = decodeURIComponent(rawCategory);
            console.log(`Detected category from filename: ${category}`);
            return category;
        }
        
        // Default to 'all' if pattern doesn't match
        return 'all';
    }

    // Load products for current category
    async loadProducts() {
        if (!this.productsGrid) {
            console.log('Products grid not found');
            return;
        }

        console.log(`Loading products for category: ${this.currentCategory}`);
        
        try {
            let products = [];
            
            // Load from API only - no localStorage to prevent demo data
            try {
                const response = await fetch('/api/products');
                if (response.ok) {
                    const data = await response.json();
                    console.log('API data received for category page:', data);
                    
                    if (this.currentCategory === 'all') {
                        // Load all products from API
                        if (data.products) {
                            Object.values(data.products).forEach(categoryProducts => {
                                products.push(...categoryProducts);
                            });
                        }
                    } else {
                        // Load specific category products from API
                        if (data.products && data.products[this.currentCategory]) {
                            products = data.products[this.currentCategory];
                        }
                    }
                } else {
                    console.error('API response not OK:', response.status);
                    throw new Error(`API error: ${response.status}`);
                }
            } catch (apiError) {
                console.error('Error fetching from API:', apiError);
                throw apiError;
            }
            
            console.log(`Found ${products.length} products`);
            
            // Store all products
            this.allProducts = products;
            this.displayedCount = 0;
            
            // Clear grid
            this.productsGrid.innerHTML = '';
            
            if (products.length === 0) {
                await this.showEmptyState();
                this.updateLoadMoreButton();
            } else {
                // Display first page of products
                this.displayNextPage();
                // Update button state after first page
                this.updateLoadMoreButton(this.displayedCount >= this.allProducts.length);
            }
            
            // Update counter
            this.updateProductCounter(products.length);
            
        } catch (error) {
            console.error('Error loading products:', error);
            this.showErrorState();
        }
    }

    // Show empty state when no products
    async showEmptyState() {
        let categoryName = 'ТОВАРЫ';
        
        // Try to get category name from API
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const categories = await response.json();
                const currentCat = categories.find(cat => cat.slug === this.currentCategory);
                if (currentCat) {
                    categoryName = currentCat.name.toUpperCase();
                }
            }
        } catch (error) {
            console.error('Error fetching category name:', error);
            // Fallback to formatted slug
            categoryName = this.currentCategory.toUpperCase();
        }
        
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
            <h3>В категории "${categoryName}" пока нет товаров</h3>
            <p>Товары будут добавлены администратором</p>
        `;
        
        this.productsGrid.appendChild(emptyState);
    }

    // Show error state
    showErrorState() {
        const errorState = document.createElement('div');
        errorState.className = 'empty-catalog';
        errorState.innerHTML = `
            <div class="empty-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h3>Ошибка загрузки товаров</h3>
            <p>Убедитесь, что сервер запущен командой: npm start</p>
            <button onclick="window.location.reload()" class="btn-primary" style="margin-top: 20px;">
                Обновить страницу
            </button>
        `;
        
        this.productsGrid.appendChild(errorState);
    }

    // Create product card HTML
    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-id', product.id);
        
        // Get first and second images or placeholder
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
        
        // Format price (support discount)
        const hasDiscount = product.oldPrice && product.newPrice;
        const formattedPrice = new Intl.NumberFormat('ru-RU').format(product.price);
        const formattedOldPrice = hasDiscount ? new Intl.NumberFormat('ru-RU').format(product.oldPrice) : null;
        const formattedNewPrice = hasDiscount ? new Intl.NumberFormat('ru-RU').format(product.newPrice) : null;
        const currentPriceValue = hasDiscount ? product.newPrice : product.price;
        
        // Format sizes
        const sizesText = product.sizes && product.sizes.length > 0 
            ? product.sizes.join(', ') 
            : 'Один размер';

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

        // Add click handler to open product page
        card.addEventListener('click', () => {
            this.openProductPage(product.id);
        });

        return card;
    }

    // Update product counter
    updateProductCounter(count) {
        if (this.productCounter) {
            const categoryAttribute = this.productCounter.getAttribute('data-category');
            if (categoryAttribute) {
                const productCount = typeof count === 'number' ? count : (count && Array.isArray(count) ? count.length : 0);
                this.productCounter.textContent = `${productCount} изделий`;
                
                // Обновляем все счетчики с таким же data-category (включая фиксированные)
                const allCounters = document.querySelectorAll(`.product-count[data-category="${categoryAttribute}"]`);
                allCounters.forEach(counter => {
                    counter.textContent = `${productCount} изделий`;
                });
                
                // Отправляем событие для синхронизации
                document.dispatchEvent(new CustomEvent('productCounterUpdated'));
            }
        }
    }

    // Open product page using modal
    async openProductPage(productId) {
        console.log('Opening product page for ID:', productId);
        
        try {
            // Get product from API only, not localStorage
            const response = await fetch(`/api/product/${productId}`);
            if (!response.ok) {
                console.error('Failed to fetch product from API');
                return;
            }
            
            const product = await response.json();
            console.log('Product found:', product);
            
            if (!product) {
                console.error('Product not found with ID:', productId);
                return;
            }
            
            // Check if modal is available
            if (window.productModal) {
                console.log('Opening modal with product:', product.name);
                window.productModal.open(product);
            } else {
                console.error('Product modal not available, trying to initialize...');
                // Try to initialize modal
                if (!window.productModal && window.ProductModal) {
                    window.productModal = new ProductModal();
                    setTimeout(() => {
                        window.productModal.open(product);
                    }, 100);
                } else {
                    // Fallback if modal is not available
                    alert(`Товар: ${product.name}\nЦена: ${product.price} ₽\nОписание: ${product.description}`);
                }
            }
        } catch (error) {
            console.error('Error opening product:', error);
        }
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

    // Refresh products (useful after adding new products)
    async refresh() {
        await this.loadProducts();
    }
}

// Initialize product loader when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Don't initialize on brand.html page - it has its own loader
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    if (filename === 'brand.html' || window.isBrandPage) {
        console.log('Skipping product-loader-api initialization on brand.html');
        return;
    }
    
    // Initialize loader directly - no database dependency
    window.productLoader = new ProductLoaderAPI();
    console.log('Product loader API initialized');
});

// Export for global use
window.ProductLoaderAPI = ProductLoaderAPI;
