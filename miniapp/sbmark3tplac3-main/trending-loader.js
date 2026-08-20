// Trending Products Loader for main page
class TrendingLoader {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadTrendingProducts());
        } else {
            this.loadTrendingProducts();
        }
    }

    async loadTrendingProducts() {
        // Find trending grid container
        this.container = document.querySelector('.trending-grid');
        if (!this.container) {
            console.log('Trending grid container not found');
            return;
        }

        try {
            console.log('Loading trending products...');
            let trendingProducts = [];
            let allProducts = []; // Declare outside try block for access in error handling
            
            // Load from API only - no localStorage fallback to prevent demo data
            try {
                const response = await fetch('/api/products');
                if (response.ok) {
                    const data = await response.json();
                    console.log('API data received:', data);
                    
                    // Extract all products and filter trending ones
                    allProducts = [];
                    if (data.products) {
                        Object.entries(data.products).forEach(([category, categoryProducts]) => {
                            console.log(`Category "${category}": ${categoryProducts.length} products`);
                            categoryProducts.forEach(product => {
                                allProducts.push(product);
                                // Log specific product if it matches
                                if (product.name && product.name.includes('Кожаная куртка')) {
                                    console.log('Found leather jacket product:', {
                                        id: product.id,
                                        name: product.name,
                                        category: product.category,
                                        isTrending: product.isTrending,
                                        isActive: product.isActive,
                                        dateAdded: product.dateAdded
                                    });
                                }
                        });
                        });
                    }
                    
                    console.log(`Total products extracted: ${allProducts.length}`);
                    trendingProducts = allProducts.filter(product => {
                        const isTrending = product.isTrending === true;
                        const isActive = product.isActive !== false;
                        const matches = isTrending && isActive;
                        if (product.name && product.name.includes('Кожаная куртка')) {
                            console.log('Filtering leather jacket:', {
                                isTrending,
                                isActive,
                                matches
                            });
                        }
                        return matches;
                    }); // Show all trending products without limit
                    
                    // Sort by dateAdded (newest first)
                    trendingProducts.sort((a, b) => {
                        const dateA = new Date(a.dateAdded || 0);
                        const dateB = new Date(b.dateAdded || 0);
                        return dateB - dateA; // Newest first
                    });
                    
                    console.log('Trending products from API:', trendingProducts.length);
                    console.log('Trending products list:', trendingProducts.map(p => ({
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        isTrending: p.isTrending,
                        isActive: p.isActive
                    })));
                } else {
                    console.log('API response not OK:', response.status);
                }
            } catch (apiError) {
                console.error('API error loading trending products:', apiError.message);
                // Do not fallback to localStorage to avoid showing demo products
            }
            
            if (trendingProducts.length === 0) {
                console.log('No trending products found');
                if (allProducts.length > 0) {
                    console.log('All products check:', allProducts.map(p => ({
                        id: p.id,
                        name: p.name,
                        isTrending: p.isTrending,
                        isActive: p.isActive
                    })));
                }
                this.showEmptyMessage();
            } else {
                console.log('Displaying', trendingProducts.length, 'trending products');
                this.displayTrendingProducts(trendingProducts);
            }
        } catch (error) {
            console.error('Error loading trending products:', error);
            this.showEmptyMessage();
        }
    }

    displayTrendingProducts(products) {
        // Clear container
        this.container.innerHTML = '';

        products.forEach((product, index) => {
            const productElement = this.createTrendingItem(product, index);
            this.container.appendChild(productElement);
        });

        // Add animation
        this.animateProducts();
        
        // Initialize slider after items are loaded
        setTimeout(() => {
            console.log('Initializing trending slider with', products.length, 'products');
            
            // Re-initialize the slider with fresh event listeners
            const prevArrow = document.querySelector('.prev-arrow');
            const nextArrow = document.querySelector('.next-arrow');
            const trendingGrid = document.querySelector('.trending-grid');
            
            if (prevArrow && nextArrow && trendingGrid) {
                // Reset the current index to 0 when loading new products
                trendingGrid.dataset.currentIndex = '0';
                
                // Remove data-initialized attribute to allow re-initialization
                prevArrow.removeAttribute('data-initialized');
                nextArrow.removeAttribute('data-initialized');
                
                // Reset the transform to start position
                trendingGrid.style.transform = 'translateX(0)';
                
                // Call the slider initialization
                if (window.initTrendingSlider) {
                    window.initTrendingSlider();
                }
            }
        }, 200);
    }

    createTrendingItem(product, index) {
        const item = document.createElement('div');
        item.className = 'trending-item';
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        
        // Get first and second images or use placeholder
        const placeholder = 'https://via.placeholder.com/400x500?text=No+Image';
        let firstImage = placeholder;
        let secondImage = placeholder;
        
        if (product.images && product.images.length > 0) {
            // Try to get URL from different possible formats
            const firstImg = product.images[0];
            firstImage = firstImg.url || firstImg.data || (typeof firstImg === 'string' ? firstImg : placeholder);
            
            // Ensure URL is absolute if it starts with /uploads
            if (firstImage.startsWith('/uploads')) {
                firstImage = firstImage; // Keep as is, server will serve it
            }
            
            // Get second image if available
            if (product.images.length > 1) {
                const secondImg = product.images[1];
                secondImage = secondImg.url || secondImg.data || (typeof secondImg === 'string' ? secondImg : firstImage);
                if (secondImage.startsWith('/uploads')) {
                    secondImage = secondImage; // Keep as is
                }
            } else {
                secondImage = firstImage;
            }
        }
        
        // Log for debugging specific product
        if (product.name && product.name.includes('Кожаная куртка')) {
            console.log('Creating trending item for leather jacket:', {
                name: product.name,
                imagesCount: product.images ? product.images.length : 0,
                firstImage: firstImage,
                secondImage: secondImage
            });
        }

        item.innerHTML = `
            <div class="trending-image">
                <img class="trending-image-primary" src="${firstImage}" alt="${product.name}">
                ${secondImage !== firstImage ? `<img class="trending-image-hover" src="${secondImage}" alt="${product.name}">` : ''}
            </div>
            <h3 class="trending-title">${product.name.toUpperCase()}</h3>
        `;

        // Add click handler to open product modal
        item.addEventListener('click', () => {
            this.openProductDetails(product);
        });

        item.style.cursor = 'pointer';

        return item;
    }

    animateProducts() {
        const items = this.container.querySelectorAll('.trending-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.style.transition = 'opacity 0.6s, transform 0.6s';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    openProductDetails(product) {
        console.log('Opening product details for:', product.name);
        
        // Try to initialize modal if not exists
        if (!window.productModal && window.ProductModal) {
            window.productModal = new ProductModal();
            console.log('Product modal initialized on demand');
        }
        
        // Check if product modal exists
        if (window.productModal) {
            console.log('Opening modal for product:', product);
            window.productModal.open(product);
        } else {
            console.error('Product modal not available, trying fallback...');
            
            // Try to load modal script dynamically
            if (!document.querySelector('script[src="product-modal.js"]')) {
                const script = document.createElement('script');
                script.src = 'product-modal.js';
                script.onload = () => {
                    setTimeout(() => {
                        if (window.ProductModal) {
                            window.productModal = new ProductModal();
                            window.productModal.open(product);
                        }
                    }, 100);
                };
                document.head.appendChild(script);
            } else {
                // Final fallback - navigate to category page
                const categoryMap = {
                    'jackets': 'category-jackets.html',
                    'shoes': 'category-shoes.html',
                    'coats': 'category-coats.html',
                    'sweaters': 'category-sweaters.html',
                    'glasses': 'category-glasses.html',
                    'pants': 'category-pants.html',
                    'hats': 'category-hats.html',
                    'kurtki': 'category-kurtki.html',
                    'obuv': 'category-obuv.html'
                };

                const categoryPage = categoryMap[product.category];
                if (categoryPage) {
                    console.log('Navigating to category page:', categoryPage);
                    window.location.href = categoryPage;
                }
            }
        }
    }

    showEmptyMessage() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create empty state message
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'trending-empty';
        emptyMessage.style.cssText = `
            grid-column: 1 / -1;
            text-align: center;
            padding: 60px 20px;
            color: #666;
        `;
        emptyMessage.innerHTML = `
            <p style="font-size: 14px; margin-bottom: 10px;">Нет товаров в тренде</p>
            <p style="font-size: 12px; opacity: 0.7;">Администратор может отметить товары как "Trending Now" при добавлении</p>
        `;
        
        this.container.appendChild(emptyMessage);
    }

    // Refresh trending products (call after adding/updating products)
    async refresh() {
        await this.loadTrendingProducts();
    }
}

// Initialize trending loader
window.trendingLoader = new TrendingLoader();
