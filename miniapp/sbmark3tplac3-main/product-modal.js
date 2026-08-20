// Product Modal System for displaying product details
class ProductModal {
    constructor() {
        this.modal = null;
        this.currentProduct = null;
        this.currentImageIndex = 0;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.savedScrollPosition = 0;
        this.selectedSize = null;
        this.createModal();
    }

    createModal() {
        // Create modal HTML structure
        const modalHTML = `
            <div class="product-modal-overlay" id="productModalOverlay">
                <div class="product-modal-content">
                    <div class="product-modal-header">
                        <button class="product-modal-close" id="productModalClose">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="product-modal-body">
                        <div class="product-modal-images">
                            <div class="product-image-container" id="productImageContainer">
                                <img id="productModalImage" src="" alt="" />
                                <div class="image-navigation">
                                    <button class="image-nav-btn prev" id="prevImageBtn">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="15,18 9,12 15,6"></polyline>
                                        </svg>
                                    </button>
                                    <button class="image-nav-btn next" id="nextImageBtn">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9,18 15,12 9,6"></polyline>
                                        </svg>
                                    </button>
                                </div>
                                <div class="image-indicators" id="imageIndicators"></div>
                            </div>
                        </div>
                        <div class="product-modal-info">
                            <div class="product-breadcrumb" id="productBreadcrumb"></div>
                            <h2 class="product-modal-title" id="productModalTitle"></h2>
                            
                            <div class="product-modal-sizes">
                                <h4>Размер</h4>
                                <div class="size-options" id="productModalSizes"></div>
                            </div>
                            
                            <div class="product-modal-price" id="productModalPrice"></div>
                            
                            <button class="add-to-wishlist-btn" id="contactSellerBtn">СВЯЗАТЬСЯ С ПРОДАВЦОМ</button>
                            
                            <div class="product-description-section">
                                <div class="description-toggle" onclick="toggleDescription()">
                                    <span>ОПИСАНИЕ</span>
                                    <span>+</span>
                                </div>
                                <div class="description-content" id="productModalDescription"></div>
                            </div>
                            
                            <div class="product-tag" id="productTag"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        this.modal = document.getElementById('productModalOverlay');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close modal events
        const closeBtn = document.getElementById('productModalClose');
        const overlay = document.getElementById('productModalOverlay');
        
        closeBtn.addEventListener('click', () => this.close());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });

        // Image navigation
        const prevBtn = document.getElementById('prevImageBtn');
        const nextBtn = document.getElementById('nextImageBtn');
        
        prevBtn.addEventListener('click', () => this.previousImage());
        nextBtn.addEventListener('click', () => this.nextImage());

        // Touch/swipe events for mobile
        const imageContainer = document.getElementById('productImageContainer');
        
        imageContainer.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        });

        imageContainer.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.modal.classList.contains('active')) return;
            
            if (e.key === 'ArrowLeft') {
                this.previousImage();
            } else if (e.key === 'ArrowRight') {
                this.nextImage();
            }
        });

        // Contact seller button
        const contactBtn = document.getElementById('contactSellerBtn');
        contactBtn.addEventListener('click', () => this.contactSeller());
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next image
                this.nextImage();
            } else {
                // Swipe right - previous image
                this.previousImage();
            }
        }
    }

    open(product) {
        if (!product) return;
        
        this.currentProduct = product;
        this.currentImageIndex = 0;
        
        // Save current scroll position before opening modal
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        // Reset scroll position to top instantly (without animation)
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        
        // Update modal content
        this.updateModalContent();
        
        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Restore scroll position when closing modal
        window.scrollTo({ top: this.savedScrollPosition, left: 0, behavior: 'instant' });
        
        this.currentProduct = null;
        this.currentImageIndex = 0;
        this.savedScrollPosition = 0;
    }

    updateModalContent() {
        if (!this.currentProduct) return;

        const product = this.currentProduct;
        
        // Update breadcrumb with real category path
        const categoryMap = {
            'jackets': 'SHOP / MAIN COLLECTION / CLOTHING / JACKETS',
            'kurtki': 'SHOP / MAIN COLLECTION / CLOTHING / KURTKI',
            'shoes': 'SHOP / MAIN COLLECTION / FOOTWEAR / SHOES',
            'obuv': 'SHOP / MAIN COLLECTION / FOOTWEAR / OBUV',
            'coats': 'SHOP / MAIN COLLECTION / CLOTHING / COATS',
            'sweaters': 'SHOP / MAIN COLLECTION / CLOTHING / SWEATERS',
            'glasses': 'SHOP / MAIN COLLECTION / ACCESSORIES / GLASSES',
            'pants': 'SHOP / MAIN COLLECTION / CLOTHING / PANTS',
            'hats': 'SHOP / MAIN COLLECTION / ACCESSORIES / HATS'
        };
        
        const breadcrumb = categoryMap[product.category] || 'SHOP / MAIN COLLECTION';
        document.getElementById('productBreadcrumb').textContent = breadcrumb;
        
        // Update title and price
        document.getElementById('productModalTitle').textContent = product.name;
        const priceElement = document.getElementById('productModalPrice');

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

        if (priceElement) {
            priceElement.classList.toggle('has-discount', hasDiscount);
            if (hasDiscount && oldPriceValue) {
                priceElement.innerHTML = `
                    <span class="price-old">${priceFormatter.format(oldPriceValue)} ₽</span>
                    <span class="price-new">${priceFormatter.format(newPriceValue)} ₽</span>
                `;
            } else if (currentPriceValue !== null) {
                priceElement.textContent = `${priceFormatter.format(currentPriceValue)} ₽`;
            } else {
                priceElement.textContent = 'Цена по запросу';
            }
        }
        document.getElementById('productModalDescription').textContent = product.description;
        
        // Update product tag with product name
        document.getElementById('productTag').textContent = product.name;

        // Update sizes
        const sizesContainer = document.getElementById('productModalSizes');
        sizesContainer.innerHTML = '';
        this.selectedSize = null; // Сброс выбранного размера
        
        if (product.sizes && product.sizes.length > 0) {
            product.sizes.forEach(size => {
                const sizeElement = document.createElement('span');
                sizeElement.className = 'size-option';
                sizeElement.textContent = size;
                sizeElement.addEventListener('click', () => this.selectSize(size, sizeElement));
                sizesContainer.appendChild(sizeElement);
            });
        }

        // Update images
        this.updateImages();
        
        // Auto-expand all descriptions on desktop
        if (window.innerWidth > 768) {
            this.expandAllDescriptions();
        }
    }

    updateImages() {
        if (!this.currentProduct || !this.currentProduct.images) return;

        const images = this.currentProduct.images;
        const imageContainer = document.getElementById('productImageContainer');
        const indicatorsContainer = document.getElementById('imageIndicators');
        const prevBtn = document.getElementById('prevImageBtn');
        const nextBtn = document.getElementById('nextImageBtn');

        if (images.length === 0) {
            imageContainer.innerHTML = '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDQwMCA1MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNTAgMTIwQzE2NS0xNSAxODUgMTM1IDE1MCAyMDBDMTE1IDEzNSAxMzUgMTE1IDE1MCAxMjBaIiBmaWxsPSIjRTVFN0VCIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUI5QkEzIiBmb250LXNpemU9IjE0Ij5ObyBpbWFnZTwvdGV4dD4KPC9zdmc+" alt="No image">';
            return;
        }

        // For desktop: show all images vertically
        if (window.innerWidth > 768) {
            imageContainer.innerHTML = '';
            images.forEach((image, index) => {
                const img = document.createElement('img');
                // Handle both object format {url: ...} and direct URL string
                img.src = (typeof image === 'object' && image.url) ? image.url : image;
                img.alt = `${this.currentProduct.name} - Image ${index + 1}`;
                img.id = index === 0 ? 'productModalImage' : `productModalImage${index}`;
                img.style.width = '100%';
                img.style.marginBottom = '10px';
                imageContainer.appendChild(img);
            });
            
            // Hide navigation for desktop (all images visible)
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (indicatorsContainer) indicatorsContainer.style.display = 'none';
        } else {
            // For mobile: show single image with navigation
            // Clear container and rebuild with image and navigation
            const currentImage = images[this.currentImageIndex];
            // Handle both object format {url: ...} and direct URL string
            const imageUrl = (typeof currentImage === 'object' && currentImage.url) ? currentImage.url : currentImage;
            
            imageContainer.innerHTML = `
                <img id="productModalImage" 
                     src="${imageUrl}" 
                     alt="${this.currentProduct.name}"
                     style="width: 100%; height: 100%;">
                <div class="image-navigation">
                    <button class="image-nav-btn prev" id="prevImageBtn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                    </button>
                    <button class="image-nav-btn next" id="nextImageBtn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="image-indicators" id="imageIndicators"></div>
            `;
            
            // Re-attach event listeners for navigation buttons
            document.getElementById('prevImageBtn').addEventListener('click', () => this.previousImage());
            document.getElementById('nextImageBtn').addEventListener('click', () => this.nextImage());

            // Update indicators for mobile
            const newIndicatorsContainer = document.getElementById('imageIndicators');
            if (newIndicatorsContainer) {
                newIndicatorsContainer.style.display = 'flex';
                images.forEach((_, index) => {
                    const indicator = document.createElement('div');
                    indicator.className = `image-indicator ${index === this.currentImageIndex ? 'active' : ''}`;
                    indicator.onclick = () => this.goToImage(index);
                    newIndicatorsContainer.appendChild(indicator);
                });
            }

            // Show/hide navigation buttons for mobile
            if (prevBtn) prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
            if (nextBtn) nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
        }
    }

    previousImage() {
        if (!this.currentProduct || !this.currentProduct.images) return;
        
        const images = this.currentProduct.images;
        if (images.length <= 1) return;

        this.currentImageIndex = this.currentImageIndex > 0 
            ? this.currentImageIndex - 1 
            : images.length - 1;
        
        this.updateImages();
    }

    nextImage() {
        if (!this.currentProduct || !this.currentProduct.images) return;
        
        const images = this.currentProduct.images;
        if (images.length <= 1) return;

        this.currentImageIndex = this.currentImageIndex < images.length - 1 
            ? this.currentImageIndex + 1 
            : 0;
        
        this.updateImages();
    }

    goToImage(index) {
        if (!this.currentProduct || !this.currentProduct.images) return;
        
        const images = this.currentProduct.images;
        if (index < 0 || index >= images.length) return;
        
        this.currentImageIndex = index;
        this.updateImages();
    }

    selectSize(size, element) {
        // Убираем выделение с предыдущего размера
        const allSizes = document.querySelectorAll('.size-option');
        allSizes.forEach(sizeEl => sizeEl.classList.remove('selected'));
        
        // Выделяем выбранный размер
        element.classList.add('selected');
        this.selectedSize = size;
    }

    expandAllDescriptions() {
        // Expand all description sections on desktop
        const descriptionIds = [
            'productModalDescription',
            'productCareInfo',
            'productDeliveryInfo',
            'productSizeInfo',
            'productPassport'
        ];
        
        descriptionIds.forEach(id => {
            const content = document.getElementById(id);
            if (content) {
                content.classList.add('active');
                const toggle = content.previousElementSibling?.querySelector('span:last-child');
                if (toggle) {
                    toggle.textContent = '-';
                }
            }
        });
    }

    async contactSeller() {
        try {
            // Get telegram settings
            const settings = await this.getTelegramSettings();
            
            // Get current product URL
            const productUrl = window.location.href;
            const productName = this.currentProduct ? this.currentProduct.name : 'товар';
            
            // Create message with product info and selected size
            let message = `Здравствуйте! Заинтересовал данный товар: ${productName}`;
            
            // Add size information if selected
            if (this.selectedSize) {
                message += `\nРазмер: ${this.selectedSize}`;
            }
            
            message += `\n${productUrl}`;
            
            // Encode message for URL
            const encodedMessage = encodeURIComponent(message);
            
            // Create Telegram URL
            const telegramUrl = `https://t.me/${settings.telegramUsername}?text=${encodedMessage}`;
            
            // Open Telegram in new tab
            window.open(telegramUrl, '_blank');
        } catch (error) {
            console.error('Error contacting seller:', error);
            // Fallback to default
            const defaultUrl = 'https://t.me/pravitelstvo_russian';
            window.open(defaultUrl, '_blank');
        }
    }

    async getTelegramSettings() {
        try {
            // Try to get settings from localStorage first
            const savedSettings = localStorage.getItem('telegram_settings');
            if (savedSettings) {
                return JSON.parse(savedSettings);
            }
            
            // Default settings
            return {
                telegramUsername: 'pravitelstvo_russian'
            };
        } catch (error) {
            console.error('Error getting telegram settings:', error);
            return {
                telegramUsername: 'pravitelstvo_russian'
            };
        }
    }
}

// Initialize product modal when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.productModal = new ProductModal();
});

// Toggle function for description section
function toggleDescription() {
    // Don't toggle on desktop - sections are always open
    if (window.innerWidth > 768) return;
    
    const content = document.getElementById('productModalDescription');
    const toggle = content.previousElementSibling.querySelector('span:last-child');
    
    if (content.classList.contains('active')) {
        content.classList.remove('active');
        toggle.textContent = '+';
    } else {
        content.classList.add('active');
        toggle.textContent = '-';
    }
}

// Make toggle function global
window.toggleDescription = toggleDescription;

// Export for global use
window.ProductModal = ProductModal;

// Initialize product modal when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (!window.productModal) {
        window.productModal = new ProductModal();
        console.log('Product modal initialized');
    }
});
