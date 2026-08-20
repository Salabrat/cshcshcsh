// Product Loader - loads and displays products on category pages
class ProductLoader {
    constructor() {
        this.currentCategory = this.detectCategory();
        this.productsGrid = document.getElementById('productsGrid');
        this.productCounter = document.querySelector('.product-count');
    }

    // Detect current category from page URL or data attribute
    detectCategory() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        
        // Map filenames to category keys
        const categoryMap = {
            'category-jackets.html': 'jackets',
            'category-shoes.html': 'shoes',
            'category-coats.html': 'coats',
            'category-sweaters.html': 'sweaters',
            'category-glasses.html': 'glasses',
            'category-pants.html': 'pants',
            'category-hats.html': 'hats',
            'category-kurtki.html': 'kurtki',       
            'category-obuv.html': 'obuv',
            'shop-all.html': 'all'
        };

        
    }

    // Load and display products for current category
    loadProducts() {
        if (!window.productDB) {
            console.error('Product database not initialized');
            return;
        }

        let products = [];
        
        if (this.currentCategory === 'all') {
            // Load all products for shop-all page
            products = window.productDB.getAllProducts();
        } else if (this.currentCategory !== 'unknown') {
            // Load products for specific category
            products = window.productDB.getProductsByCategory(this.currentCategory);
        }

        console.log(`Loading ${products.length} products for category: ${this.currentCategory}`);
        
        this.displayProducts(products);
        this.updateProductCounter(products.length);
    }

    // Display products in the grid
    displayProducts(products) {
        if (!this.productsGrid) {
            console.error('Products grid not found');
            return;
        }

        // Clear existing content
        this.productsGrid.innerHTML = '';

        if (products.length === 0) {
            this.showEmptyState();
            return;
        }

        // Create product cards
        products.forEach(product => {
            const productCard = this.createProductCard(product);
            this.productsGrid.appendChild(productCard);
        });
    }

    // Show empty state when no products
    showEmptyState() {
        const categoryNames = {
            'jackets': 'КУРТКИ',
            'shoes': 'ОБУВЬ',
            'coats': 'ПАЛЬТО',
            'sweaters': 'КОФТЫ',
            'glasses': 'ОЧКИ',
            'pants': 'ШТАНЫ',
            'hats': 'ГОЛОВНОЙ УБОР',
            'kurtki': 'КУРТКИ',
            'obuv': 'ОБУВЬ',
            'all': 'ТОВАРЫ'
        };

        const categoryName = categoryNames[this.currentCategory] || 'ТОВАРЫ';
        
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

    // Create product card HTML
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
        const hasDiscount = !!(oldPriceValue && ((newPriceValue && newPriceValue < oldPriceValue) || (!newPriceValue && basePriceValue && basePriceValue < oldPriceValue)));
        const currentPriceValue = hasDiscount ? (newPriceValue || basePriceValue) : basePriceValue;
        const formattedCurrentPrice = currentPriceValue !== null ? `${priceFormatter.format(currentPriceValue)} ₽` : 'Цена по запросу';
        const formattedOldPrice = hasDiscount && oldPriceValue ? `${priceFormatter.format(oldPriceValue)} ₽` : null;

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
                  data-current-price="${currentPriceValue ?? 0}"
                  data-old-price="${hasDiscount && oldPriceValue ? oldPriceValue : ''}">
                ${hasDiscount && formattedOldPrice
                    ? `<span class="price-old">${formattedOldPrice}</span><span class="price-new">${formattedCurrentPrice}</span>`
                    : formattedCurrentPrice}
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
            }
        }
    }

    // Open product page using modal
    openProductPage(productId) {
        console.log('Opening product page for ID:', productId);
        
        // Get product from database
        const product = window.productDB.getProductById(productId);
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
    }

    // Refresh products (useful after adding new products)
    refresh() {
        this.loadProducts();
    }
}

// Initialize product loader when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    
    // Don't initialize on brand.html or shop-all.html - they have their own loaders
    if (filename === 'brand.html' || filename === 'shop-all.html') {
        console.log(`Skipping product-loader initialization on ${filename}`);
        return;
    }
    
    // Wait a bit to ensure database is initialized
    setTimeout(() => {
        if (window.productDB) {
            window.productLoader = new ProductLoader();
            window.productLoader.loadProducts();
            console.log('Product loader initialized successfully');
        } else {
            console.error('Product database not available, retrying...');
            // Retry after another second
            setTimeout(() => {
                if (window.productDB) {
                    window.productLoader = new ProductLoader();
                    window.productLoader.loadProducts();
                    console.log('Product loader initialized successfully (retry)');
                }
            }, 1000);
        }
    }, 100);
});

// Export for global use
window.ProductLoader = ProductLoader;
