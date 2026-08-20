// Product Counter System
class ProductCounter {
    constructor() {
        this.products = this.loadProducts();
        this.updateAllCounters();
    }

    // Load products from localStorage
    loadProducts() {
        const products = localStorage.getItem('cpcompany_products');
        return products ? JSON.parse(products) : [];
    }

    // Save products to localStorage
    saveProducts(products) {
        localStorage.setItem('cpcompany_products', JSON.stringify(products));
        this.products = products;
        this.updateAllCounters();
    }

    // Get products by category
    getProductsByCategory(category) {
        if (!category || category === 'ALL') {
            return this.products;
        }
        return this.products.filter(product => product.category === category);
    }

    // Get total product count
    getTotalCount() {
        return this.products.length;
    }

    // Get count by category
    getCategoryCount(category) {
        return this.getProductsByCategory(category).length;
    }

    // Update all counters on the page
    updateAllCounters() {
        // Update total count (for shop-all page)
        const totalCounters = document.querySelectorAll('.product-count:not([data-category])');
        totalCounters.forEach(counter => {
            const count = this.getTotalCount();
            counter.textContent = `${count} ${this.getProductWord(count)}`;
        });

        // Update category-specific counters
        const categoryCounters = document.querySelectorAll('.product-count[data-category]');
        categoryCounters.forEach(counter => {
            const category = counter.getAttribute('data-category');
            const count = this.getCategoryCount(category);
            counter.textContent = `${count} ${this.getProductWord(count)}`;
        });

        // Update admin dashboard counters
        const adminTotalProducts = document.getElementById('totalProducts');
        if (adminTotalProducts) {
            adminTotalProducts.textContent = this.getTotalCount();
        }
    }

    // Get correct word form for product count (Russian grammar)
    getProductWord(count) {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;

        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
            return 'изделий';
        }

        if (lastDigit === 1) {
            return 'изделие';
        }

        if (lastDigit >= 2 && lastDigit <= 4) {
            return 'изделия';
        }

        return 'изделий';
    }

    // Add new product
    addProduct(product) {
        const newProduct = {
            id: Date.now().toString(),
            name: product.name,
            category: product.category,
            sizes: product.sizes || [],
            colors: product.colors || [],
            image: product.image || null,
            createdAt: new Date().toISOString()
        };

        const updatedProducts = [...this.products, newProduct];
        this.saveProducts(updatedProducts);
        
        // Update product grid if on category page
        this.updateProductGrid();
        
        return newProduct;
    }

    // Remove product
    removeProduct(productId) {
        const updatedProducts = this.products.filter(product => product.id !== productId);
        this.saveProducts(updatedProducts);
        this.updateProductGrid();
    }

    // Update product grid display
    updateProductGrid() {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;

        const category = productsGrid.getAttribute('data-category');
        const products = category ? this.getProductsByCategory(category) : this.products;

        // Clear existing content
        productsGrid.innerHTML = '';

        if (products.length === 0) {
            // Show empty state
            const categoryName = category || 'каталоге';
            productsGrid.innerHTML = `
                <div class="empty-catalog">
                    <div class="empty-icon">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="m1 1 4 4 2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                    </div>
                    <h3>${category ? `В категории "${category}" пока нет товаров` : 'Каталог пуст'}</h3>
                    <p>Товары будут добавлены администратором</p>
                </div>
            `;
        } else {
            // Show products
            products.forEach(product => {
                const productCard = this.createProductCard(product);
                productsGrid.appendChild(productCard);
            });
        }

        // Show/hide load more button
        const loadMoreSection = document.querySelector('.load-more-section');
        if (loadMoreSection) {
            loadMoreSection.style.display = products.length > 0 ? 'block' : 'none';
        }
    }

    // Create product card HTML element
    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-id', product.id);

        const imageUrl = product.image || 'https://via.placeholder.com/300x400/f0f0f0/666666?text=' + encodeURIComponent(product.name);
        
        const colorsHtml = product.colors && product.colors.length > 0 ? `
            <div class="product-colors">
                <span class="color-dot" style="background: ${product.colors[0].value || '#000000'};"></span>
                ${product.colors.length > 1 ? `<span class="color-count">+${product.colors.length - 1}</span>` : ''}
            </div>
        ` : '';

        card.innerHTML = `
            <div class="product-image">
                <img src="${imageUrl}" alt="${product.name}" loading="lazy">
                ${colorsHtml}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
            </div>
        `;

        // Add click handler
        card.addEventListener('click', () => {
            console.log('Clicked on product:', product.name);
            // Here you could navigate to product detail page
        });

        return card;
    }

    // Initialize counter system
    static init() {
        return new ProductCounter();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.productCounter = ProductCounter.init();
});

// Export for use in admin panel
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductCounter;
}
