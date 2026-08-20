// Telegram Mini App Product Modal
class TelegramProductModal {
    constructor() {
        this.modal = null;
        this.currentProduct = null;
        this.selectedSize = null;
        this.currentImages = [];
        this.currentImageIndex = 0;
        this.init();
    }

    init() {
        // Create modal structure
        this.createModal();
        // Setup event listeners
        this.setupEventListeners();
    }

    createModal() {
        const modalHTML = `
            <div class="tg-product-modal" id="tgProductModal">
                <div class="tg-product-modal-overlay"></div>
                <div class="tg-product-modal-content">
                    <button class="tg-product-modal-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    
                    <div class="tg-product-modal-scroll">
                        <!-- Product Images -->
                        <div class="tg-product-images">
                            <div class="tg-product-image-main">
                                <img id="tgProductMainImage" src="" alt="" loading="lazy">
                            </div>
                            <div class="tg-product-image-thumbs" id="tgProductImageThumbs"></div>
                        </div>
                        
                        <!-- Product Info -->
                        <div class="tg-product-modal-info">
                            <div class="tg-product-modal-header">
                                <div class="tg-product-modal-brand" id="tgProductBrand"></div>
                                <div class="tg-product-modal-name" id="tgProductName"></div>
                                <div class="tg-product-modal-price" id="tgProductPrice"></div>
                            </div>
                            
                            <!-- Product Description -->
                            <div class="tg-product-description" id="tgProductDescription"></div>
                            
                            <!-- Sizes -->
                            <div class="tg-product-sizes-section" id="tgProductSizesSection">
                                <div class="tg-product-sizes-label">Размер</div>
                                <div class="tg-product-sizes" id="tgProductSizes"></div>
                            </div>
                            
                            <!-- Actions: Add to Cart + Favorite + Preorder -->
                            <div class="tg-product-actions">
                                <button class="tg-product-add-to-cart" id="tgProductAddToCart" style="display: none;">
                                    Добавить в корзину
                                </button>
                                <button class="tg-product-preorder-btn" id="tgProductPreorderBtn" style="display: none;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    ПРЕДЗАКАЗ
                                </button>
                                <button class="tg-product-like-btn" id="tgProductLikeBtn" aria-label="Добавить в избранное">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('tgProductModal');
    }

    setupEventListeners() {
        // Close button
        const closeBtn = this.modal.querySelector('.tg-product-modal-close');
        const overlay = this.modal.querySelector('.tg-product-modal-overlay');
        const addToCartBtn = document.getElementById('tgProductAddToCart');
        const preorderBtn = document.getElementById('tgProductPreorderBtn');
        const likeBtn = document.getElementById('tgProductLikeBtn');
        
        closeBtn.addEventListener('click', () => this.close(true));
        overlay.addEventListener('click', () => this.close(true));
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => this.addToCart());
        }
        if (preorderBtn) {
            preorderBtn.addEventListener('click', () => this.handlePreorder());
        }

        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite();
            });
        }
    }

    // Показ уже загруженного товара без повторного запроса
    showExisting() {
        if (!this.modal || !this.currentProduct) return;

        this.modal.classList.add('active');
        document.body.classList.add('tg-product-modal-open');
        document.body.style.overflow = 'hidden';

        // Настройка back-кнопки Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => {
                this.close(true);
            });
            window.telegramWebApp.showBackButton();
        }

        // Лёгкий haptic при первом полноценном открытии уже обрабатывается в open()
        // Для восстановления по вкладкам можно не дергать вибро, чтобы не раздражать
    }

    async open(productId, preselectedSize = null) {
        try {
            // Fetch product data
            const response = await fetch(`/api/product/${productId}`);
            if (!response.ok) {
                throw new Error('Product not found');
            }
            
            const product = await response.json();
            this.currentProduct = product;
            this.selectedSize = preselectedSize || null;
            
            // Display product
            this.displayProduct(product, preselectedSize);

            // Notify navigation which product is active on current page
            if (window.telegramNavigation && product.id) {
                window.telegramNavigation.setActiveProduct(product.id);
            }

            // Sync like button state with favorites
            const likeBtn = document.getElementById('tgProductLikeBtn');
            if (likeBtn && window.favoritesManager) {
                const isFav = window.favoritesManager.isFavorite(product.id);
                likeBtn.classList.toggle('active', isFav);
            }
            
            // Show modal (полное открытие с обновлением данных)
            this.showExisting();
        } catch (error) {
            console.error('Error opening product:', error);
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Ошибка загрузки товара');
            }
        }
    }

    displayProduct(product, preselectedSize = null) {
        // Brand
        const brandEl = document.getElementById('tgProductBrand');
        if (product.brandName || product.brand) {
            brandEl.textContent = product.brandName || product.brand;
            brandEl.style.display = 'block';
        } else {
            brandEl.style.display = 'none';
        }
        
        // Name
        document.getElementById('tgProductName').textContent = product.name || '';
        
        // Price with discount support
        const priceEl = document.getElementById('tgProductPrice');
        if (product.oldPrice && product.newPrice) {
            const oldPriceFormatted = parseInt(product.oldPrice).toLocaleString('ru-RU') + ' ₽';
            const newPriceFormatted = parseInt(product.newPrice).toLocaleString('ru-RU') + ' ₽';
            priceEl.innerHTML = `
                <span class="tg-price-old">${oldPriceFormatted}</span>
                <span class="tg-price-new">${newPriceFormatted}</span>
            `;
        } else {
            const price = this.formatPrice(product.price);
            priceEl.textContent = price;
        }
        
        const preorderBtn = document.getElementById('tgProductPreorderBtn');
        const addToCartBtn = document.getElementById('tgProductAddToCart');
        if (product.isPreorder || product.preorder) {
            if (preorderBtn) preorderBtn.style.display = 'flex';
            if (addToCartBtn) addToCartBtn.style.display = 'none';
        } else {
            if (preorderBtn) preorderBtn.style.display = 'none';
            if (addToCartBtn) addToCartBtn.style.display = 'flex';
        }
        
        // Description with expand/collapse for long text
        const descEl = document.getElementById('tgProductDescription');
        if (product.description) {
            const description = product.description;
            const maxLength = 150; // Character limit before showing expand button
            
            if (description.length > maxLength) {
                // Long description - add expand/collapse functionality
                const shortText = description.substring(0, maxLength) + '...';
                descEl.innerHTML = `
                    <div class="tg-description-text" data-full="${this.escapeHtml(description)}" data-short="${this.escapeHtml(shortText)}">
                        ${this.escapeHtml(shortText)}
                    </div>
                    <button class="tg-description-toggle" data-expanded="false">
                        Показать полностью
                    </button>
                `;
                
                // Add click handler for toggle button
                const toggleBtn = descEl.querySelector('.tg-description-toggle');
                const textEl = descEl.querySelector('.tg-description-text');
                
                if (toggleBtn && textEl) {
                    toggleBtn.addEventListener('click', () => {
                        const isExpanded = toggleBtn.dataset.expanded === 'true';
                        
                        if (isExpanded) {
                            // Collapse
                            textEl.textContent = textEl.dataset.short;
                            toggleBtn.textContent = 'Показать полностью';
                            toggleBtn.dataset.expanded = 'false';
                        } else {
                            // Expand
                            textEl.textContent = textEl.dataset.full;
                            toggleBtn.textContent = 'Свернуть';
                            toggleBtn.dataset.expanded = 'true';
                        }
                        
                        // Haptic feedback
                        if (window.telegramWebApp) {
                            window.telegramWebApp.hapticFeedback('light');
                        }
                    });
                }
            } else {
                // Short description - just display as is
                descEl.textContent = description;
            }
            
            descEl.style.display = 'block';
        } else {
            descEl.style.display = 'none';
        }
        
        // Images
        this.displayImages(product);
        
        // Sizes (with preselected size if opening from cart)
        this.displaySizes(product.sizes || [], preselectedSize);
        this.updateAddToCartState();
    }

    displayImages(product) {
        // Get all images
        let images = [];
        
        // Try product.images array first
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            images = product.images.map(img => {
                if (typeof img === 'string') return img;
                if (img.url) return img.url;
                if (img.data) return img.data;
                return null;
            }).filter(Boolean);
        }
        // Try product.image (single image)
        else if (product.image) {
            images = [product.image];
        }
        
        // Normalize image URLs
        images = images.map(img => {
            if (img.startsWith('/uploads/')) {
                return img;
            } else if (!img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('data:')) {
                return img.startsWith('/') ? img : '/uploads/' + img;
            }
            return img;
        });
        
        // If no images, use placeholder
        if (images.length === 0) {
            images = ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'];
        }
        
        // Store images for fullscreen view
        this.currentImages = images;
        this.currentImageIndex = 0;
        
        // Set main image
        const mainImage = document.getElementById('tgProductMainImage');
        mainImage.src = images[0];
        mainImage.alt = product.name || '';
        
        // Add click handler for fullscreen
        mainImage.style.cursor = 'pointer';
        mainImage.addEventListener('click', () => {
            this.openFullscreenImage(0);
        });
        
        // Set thumbnails if multiple images
        const thumbsContainer = document.getElementById('tgProductImageThumbs');
        if (images.length > 1) {
            thumbsContainer.innerHTML = images.map((img, index) => `
                <div class="tg-product-thumb ${index === 0 ? 'active' : ''}" data-index="${index}">
                    <img src="${img}" alt="Thumbnail ${index + 1}" loading="lazy">
                </div>
            `).join('');
            
            // Add click handlers for thumbnails
            thumbsContainer.querySelectorAll('.tg-product-thumb').forEach(thumb => {
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(thumb.dataset.index);
                    this.switchImage(index, images);
                    
                    // Update active thumbnail
                    thumbsContainer.querySelectorAll('.tg-product-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
            });
            
            thumbsContainer.style.display = 'flex';
        } else {
            thumbsContainer.style.display = 'none';
        }
    }

    switchImage(index, images) {
        const mainImage = document.getElementById('tgProductMainImage');
        if (images[index]) {
            mainImage.src = images[index];
            this.currentImageIndex = index;
        }
    }

    openFullscreenImage(index) {
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }

        // Open fullscreen image viewer
        if (window.telegramImageFullscreen) {
            window.telegramImageFullscreen.open(this.currentImages, index || this.currentImageIndex);
        } else if (window.TelegramImageFullscreen) {
            window.telegramImageFullscreen = new window.TelegramImageFullscreen();
            window.telegramImageFullscreen.open(this.currentImages, index || this.currentImageIndex);
        }
    }

    displaySizes(sizes, preselectedSize = null) {
        const sizesSection = document.getElementById('tgProductSizesSection');
        const sizesContainer = document.getElementById('tgProductSizes');
        
        if (!sizes || sizes.length === 0) {
            sizesSection.style.display = 'none';
            return;
        }
        
        sizesSection.style.display = 'block';
        const preselectedStr = preselectedSize != null ? String(preselectedSize).trim() : '';
        sizesContainer.innerHTML = sizes.map(size => {
            const sizeValue = typeof size === 'string' ? size : (size.size || size.value || size);
            const sizeStr = String(sizeValue).trim();
            const isActive = preselectedStr && sizeStr === preselectedStr;
            return `
                <button class="tg-size-btn ${isActive ? 'active' : ''}" data-size="${this.escapeHtml(sizeStr)}">
                    ${this.escapeHtml(sizeStr)}
                </button>
            `;
        }).join('');
        
        sizesContainer.querySelectorAll('.tg-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                sizesContainer.querySelectorAll('.tg-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedSize = btn.dataset.size;
                this.updateAddToCartState();
            });
        });
    }

    updateAddToCartState() {
        if (!this.currentProduct) return;
        const addToCartBtn = document.getElementById('tgProductAddToCart');
        if (!addToCartBtn || addToCartBtn.style.display === 'none') return;
        const sizes = this.currentProduct.sizes || [];
        const sizeRequired = sizes.length > 0;
        const inCart = window.telegramCart && (
            sizeRequired ? (this.selectedSize && window.telegramCart.hasProduct(this.currentProduct.id, this.selectedSize)) : window.telegramCart.hasProduct(this.currentProduct.id, null)
        );
        addToCartBtn.classList.toggle('in-cart', !!inCart);
        addToCartBtn.textContent = inCart ? 'В корзине' : 'Добавить в корзину';
        addToCartBtn.disabled = false;
    }

    formatPrice(price) {
        if (!price) return '0 ₽';
        const numPrice = typeof price === 'string' ? parseInt(price.replace(/\s/g, '')) : price;
        return numPrice.toLocaleString('ru-RU') + ' ₽';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Toggle favorite for current product
    toggleFavorite() {
        if (!this.currentProduct || !window.favoritesManager) return;

        const likeBtn = document.getElementById('tgProductLikeBtn');
        if (!likeBtn) return;

        const productId = this.currentProduct.id;
        const isNowFavorite = window.favoritesManager.toggleFavorite(productId);

        likeBtn.classList.toggle('active', isNowFavorite);

        // Haptic feedback for favorite toggle
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback(isNowFavorite ? 'success' : 'light');
        }
    }

    // closeModal
    // clearNavigation = true  -> пользователь сам закрыл товар, чистим сохранённое состояние
    // clearNavigation = false -> навигация временно скрывает модалку, чтобы потом восстановить
    close(clearNavigation = true) {
        this.modal.classList.remove('active');
        document.body.classList.remove('tg-product-modal-open');
        document.body.style.overflow = '';
        
        // Очищаем активный товар в навигации только если явно нужно
        if (clearNavigation && window.telegramNavigation && typeof window.telegramNavigation.clearActiveProductForCurrentPage === 'function') {
            window.telegramNavigation.clearActiveProductForCurrentPage();
        }
        
        // Hide back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            // Check if category page is open - if so, restore its back button handler
            if (window.telegramCategoryPage && window.telegramCategoryPage.page && window.telegramCategoryPage.page.classList.contains('active')) {
                // Restore category page back button handler
                window.telegramWebApp.tg.BackButton.onClick(() => {
                    window.telegramCategoryPage.close();
                });
                window.telegramWebApp.showBackButton();
            } else {
                // No category page open, restore default behavior
                window.telegramWebApp.hideBackButton();
                window.telegramWebApp.setupBackButton();
            }
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('light');
        }
    }

    // Add to cart handler (toggle: add / remove)
    addToCart() {
        if (!this.currentProduct || !window.telegramCart) return;
        
        const sizes = this.currentProduct.sizes || [];
        const addToCartBtn = document.getElementById('tgProductAddToCart');
        const inCart = addToCartBtn && addToCartBtn.classList.contains('in-cart');
        
        if (inCart) {
            const removed = window.telegramCart.removeByProduct(this.currentProduct.id, this.selectedSize);
            if (removed && addToCartBtn) {
                addToCartBtn.classList.remove('in-cart');
                addToCartBtn.textContent = 'Добавить в корзину';
                addToCartBtn.disabled = false;
            }
            if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('light');
            return;
        }
        
        if (sizes.length > 0 && !this.selectedSize) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Выберите размер');
                window.telegramWebApp.hapticFeedback('error');
            }
            return;
        }
        
        const added = window.telegramCart.addItem(this.currentProduct, this.selectedSize, 1);
        if (added && addToCartBtn) {
            addToCartBtn.classList.add('in-cart');
            addToCartBtn.textContent = 'В корзине';
        }
        if (added && window.telegramWebApp) window.telegramWebApp.hapticFeedback('success');
        setTimeout(() => this.close(true), 500);
    }
}

// Initialize modal
let telegramProductModal = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramProductModal = new TelegramProductModal();
        window.TelegramProductModal = TelegramProductModal;
        window.telegramProductModal = telegramProductModal;
    });
} else {
    telegramProductModal = new TelegramProductModal();
    window.TelegramProductModal = TelegramProductModal;
    window.telegramProductModal = telegramProductModal;
}
