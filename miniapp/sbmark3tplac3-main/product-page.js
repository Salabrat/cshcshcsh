// Product Page JavaScript
let currentProduct = null;
let selectedSize = null;
const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU');

function parsePriceValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    const numeric = parseInt(String(value).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrency(value) {
    if (value === null || value === undefined) {
        return 'Цена по запросу';
    }
    return `${PRICE_FORMATTER.format(value)} ₽`;
}

function getProductPriceInfo(product = {}) {
    const basePriceValue = parsePriceValue(product.price);
    const oldPriceValue = parsePriceValue(product.oldPrice);
    const newPriceValue = parsePriceValue(product.newPrice);
    const hasDiscount = Number.isFinite(oldPriceValue)
        && Number.isFinite(newPriceValue)
        && newPriceValue > 0
        && newPriceValue < oldPriceValue;
    const currentPriceValue = hasDiscount ? newPriceValue : basePriceValue;

    return {
        hasDiscount,
        currentPriceValue,
        currentPriceText: formatCurrency(currentPriceValue),
        oldPriceText: hasDiscount ? formatCurrency(oldPriceValue) : null,
        newPriceText: hasDiscount ? formatCurrency(newPriceValue) : null
    };
}

document.addEventListener('DOMContentLoaded', function() {
    // Reset scroll position to top when page loads (instantly)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    loadProduct();
    initializeProductPage();
});

async function loadProduct() {
    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        showError('Product not found');
        return;
    }
    
    try {
        // First try to get product directly by ID
        const response = await fetch(`/api/product/${productId}`);
        if (response.ok) {
            currentProduct = await response.json();
            displayProduct(currentProduct);
            return;
        }
        
        // If direct fetch fails, try to find in all products
        const allProductsResponse = await fetch('/api/products');
        if (allProductsResponse.ok) {
            const data = await allProductsResponse.json();
            
            // Search in all categories
            for (const category in data.products) {
                const found = data.products[category].find(p => 
                    p.id == productId || // Non-strict comparison to handle string/number mismatch
                    p.id === parseInt(productId) || 
                    p.id === productId.toString()
                );
                
                if (found) {
                    currentProduct = found;
                    currentProduct.category = category; // Add category info
                    displayProduct(currentProduct);
                    return;
                }
            }
        }
        
        // Also check localStorage as fallback
        const products = JSON.parse(localStorage.getItem('products') || '[]');
        currentProduct = products.find(p => 
            p.id == productId || // Non-strict comparison
            p.id === parseInt(productId) || 
            p.id === productId.toString()
        );
        
        if (currentProduct) {
            displayProduct(currentProduct);
            return;
        }
        
        // Product not found anywhere
        showError('Product not found');
        
    } catch (error) {
        console.error('Error loading product:', error);
        
        // Try localStorage as last resort
        const products = JSON.parse(localStorage.getItem('products') || '[]');
        currentProduct = products.find(p => 
            p.id == productId || 
            p.id === parseInt(productId) || 
            p.id === productId.toString()
        );
        
        if (currentProduct) {
            displayProduct(currentProduct);
        } else {
            showError('Product not found');
        }
    }
}

function displayProduct(product) {
    // Update page title
    document.title = `${product.name} - C.P. COMPANY`;
    
    // Update breadcrumb
    updateBreadcrumb(product);
    
    // Display images
    displayProductImages(product.images);
    
    // Display product info
    displayProductInfo(product);
    
    // Display sizes
    displaySizes(product.sizes);
    
    // Add color swatches (for demo)
    addColorSwatches();
}

function updateBreadcrumb(product) {
    const categoryNames = {
        'jackets': 'КУРТКИ',
        'shoes': 'ОБУВЬ',
        'coats': 'ПАЛЬТО',
        'sweaters': 'КОФТЫ',
        'glasses': 'ОЧКИ',
        'pants': 'ШТАНЫ',
        'hats': 'ГОЛОВНОЙ УБОР'
    };
    
    const categoryName = categoryNames[product.category] || product.category.toUpperCase();
    
    // Update breadcrumb in header
    const breadcrumbCategory = document.getElementById('breadcrumbCategory');
    const breadcrumbProduct = document.getElementById('breadcrumbProduct');
    
    if (breadcrumbCategory) {
        breadcrumbCategory.textContent = categoryName;
    }
    
    if (breadcrumbProduct) {
        breadcrumbProduct.textContent = product.name.toUpperCase();
    }
    
    // Update product breadcrumb
    const productBreadcrumb = document.getElementById('productBreadcrumb');
    if (productBreadcrumb) {
        productBreadcrumb.textContent = `SHOP / MAIN COLLECTION / CLOTHING / ${categoryName}`;
    }
}

function displayProductImages(images) {
    const imageGallery = document.getElementById('imageGallery');
    if (!imageGallery) return;
    
    imageGallery.innerHTML = '';
    
    // Handle both array of strings and array of objects
    if (!images || images.length === 0) {
        // Add placeholder if no images
        const imageDiv = document.createElement('div');
        imageDiv.className = 'product-image';
        imageDiv.innerHTML = `
            <img src="/placeholder.jpg" alt="Product image" loading="lazy">
        `;
        imageGallery.appendChild(imageDiv);
        return;
    }
    
    images.forEach((image, index) => {
        // Handle both string URLs and image objects
        const imageUrl = typeof image === 'string' 
            ? image 
            : (image.url || image.data || '/placeholder.jpg');
            
        const imageDiv = document.createElement('div');
        imageDiv.className = 'product-image';
        imageDiv.innerHTML = `
            <img src="${imageUrl}" alt="Product image ${index + 1}" loading="lazy">
        `;
        imageGallery.appendChild(imageDiv);
    });
}

function displayProductInfo(product) {
    // Update title
    const productTitle = document.getElementById('productTitle');
    if (productTitle) {
        productTitle.textContent = (product.name || 'Product').toUpperCase();
    }
    
    // Update description
    const productDescription = document.getElementById('productDescription');
    if (productDescription) {
        productDescription.textContent = product.description || `High-quality ${product.name || 'product'} from our exclusive collection.`;
    }
    
    // Update color label (for demo, using product color or default)
    const productColor = document.getElementById('productColor');
    if (productColor) {
        const colorName = product.color || 'BLACK';
        productColor.textContent = `ЦВЕТ: ${colorName.toUpperCase()}`;
    }
    
    const priceDisplay = document.getElementById('productPriceDisplay');
    const priceInfo = getProductPriceInfo(product);
    if (priceDisplay) {
        priceDisplay.classList.toggle('has-discount', priceInfo.hasDiscount);
        if (priceInfo.hasDiscount && priceInfo.oldPriceText && priceInfo.newPriceText) {
            priceDisplay.innerHTML = `
                <span class="price-old">${priceInfo.oldPriceText}</span>
                <span class="price-new">${priceInfo.newPriceText}</span>
            `;
        } else {
            priceDisplay.textContent = priceInfo.currentPriceText;
        }
    }
    
    // Update price in wishlist button 
    const wishlistBtn = document.querySelector('.add-to-wishlist');
    if (wishlistBtn) {
        wishlistBtn.textContent = `ADD TO WISHLIST - ${priceInfo.currentPriceText}`;
    }
}

function displaySizes(sizes) {
    const sizeSelector = document.getElementById('sizeSelector');
    if (!sizeSelector) return;
    
    sizeSelector.innerHTML = '';
    
    // Default sizes if none provided
    const defaultSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const sizesToDisplay = sizes && sizes.length > 0 ? sizes : defaultSizes;
    
    sizesToDisplay.forEach(size => {
        const sizeOption = document.createElement('div');
        sizeOption.className = 'size-option';
        sizeOption.textContent = size;
        sizeOption.onclick = () => selectSize(size, sizeOption);
        sizeSelector.appendChild(sizeOption);
    });
}

function selectSize(size, element) {
    // Remove previous selection
    const sizeOptions = document.querySelectorAll('#sizeSelector .size-option');
    sizeOptions.forEach(option => option.classList.remove('selected'));
    
    // Select current size
    element.classList.add('selected');
    selectedSize = size;
}

function addColorSwatches() {
    const colorOptions = document.getElementById('colorOptions');
    if (!colorOptions) return;
    
    // Add demo color swatches
    const colors = ['#2c2c2c', '#8b4513', '#4a4a4a', '#1a1a1a'];
    
    colors.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        if (index === 0) swatch.classList.add('active');
        swatch.onclick = () => selectColor(swatch);
        colorOptions.appendChild(swatch);
    });
}

function selectColor(element) {
    // Remove previous selection
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => swatch.classList.remove('active'));
    
    // Select current color
    element.classList.add('active');
}

function initializeProductPage() {
    // Initialize section toggles
    const sectionToggles = document.querySelectorAll('.section-toggle');
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const sectionName = this.getAttribute('data-section');
            const content = document.getElementById(sectionName + 'Content');
            
            if (this.classList.contains('active')) {
                // Close section
                this.classList.remove('active');
                content.classList.remove('active');
            } else {
                // Close all other sections
                sectionToggles.forEach(t => {
                    t.classList.remove('active');
                    const c = document.getElementById(t.getAttribute('data-section') + 'Content');
                    if (c) c.classList.remove('active');
                });
                
                // Open this section
                this.classList.add('active');
                content.classList.add('active');
            }
        });
    });
    
    // Initialize wishlist button
    const wishlistBtn = document.querySelector('.add-to-wishlist');
    if (wishlistBtn) {
        wishlistBtn.addEventListener('click', function() {
            if (!selectedSize) {
                alert('Пожалуйста, выберите размер');
                return;
            }
            
            // Contact seller functionality
            alert(`Свяжитесь с продавцом для покупки товара "${currentProduct.name}" размера ${selectedSize}`);
        });
    }
    
    // Initialize read more button
    const readMoreBtn = document.querySelector('.read-more');
    if (readMoreBtn) {
        readMoreBtn.addEventListener('click', function() {
            const description = document.getElementById('productDescription');
            if (description) {
                if (description.style.maxHeight) {
                    description.style.maxHeight = '';
                    this.textContent = 'ЧИТАТЬ ДАЛЕЕ';
                } else {
                    description.style.maxHeight = 'none';
                    this.textContent = 'СКРЫТЬ';
                }
            }
        });
    }
}

function showError(message) {
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column;">
            <h1 style="color: #333; margin-bottom: 20px;">${message}</h1>
            <a href="shop-all.html" style="color: #333; text-decoration: underline;">Вернуться в каталог</a>
        </div>
    `;
}

// Smooth scrolling for image gallery
document.addEventListener('DOMContentLoaded', function() {
    const imageGallery = document.getElementById('imageGallery');
    if (imageGallery) {
        // Add smooth scrolling behavior
        imageGallery.style.scrollBehavior = 'smooth';
        
        // Optional: Add scroll indicators or navigation
        let isScrolling = false;
        
        imageGallery.addEventListener('scroll', function() {
            if (!isScrolling) {
                // Add any scroll-based effects here
                isScrolling = true;
                setTimeout(() => {
                    isScrolling = false;
                }, 100);
            }
        });
    }
});
