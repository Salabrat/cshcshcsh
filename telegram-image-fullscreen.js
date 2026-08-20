// Telegram Mini App Fullscreen Image Viewer with Zoom
class TelegramImageFullscreen {
    constructor() {
        this.viewer = null;
        this.images = [];
        this.currentIndex = 0;
        this.scale = 1;
        this.minScale = 1;
        this.maxScale = 3;
        this.lastTouchDistance = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.translateX = 0;
        this.translateY = 0;
        this.init();
    }

    init() {
        this.createViewer();
        this.setupEventListeners();
    }

    createViewer() {
        const viewerHTML = `
            <div class="tg-image-fullscreen" id="tgImageFullscreen">
                <div class="tg-image-fullscreen-overlay"></div>
                <button class="tg-image-fullscreen-close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div class="tg-image-fullscreen-container">
                    <div class="tg-image-fullscreen-wrapper" id="tgImageFullscreenWrapper">
                        <img id="tgImageFullscreenImage" src="" alt="" draggable="false">
                    </div>
                    <div class="tg-image-fullscreen-thumbs" id="tgImageFullscreenThumbs"></div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', viewerHTML);
        this.viewer = document.getElementById('tgImageFullscreen');
        this.imageElement = document.getElementById('tgImageFullscreenImage');
        this.wrapper = document.getElementById('tgImageFullscreenWrapper');
        this.thumbsContainer = document.getElementById('tgImageFullscreenThumbs');
    }

    setupEventListeners() {
        // Close button
        const closeBtn = this.viewer.querySelector('.tg-image-fullscreen-close');
        const overlay = this.viewer.querySelector('.tg-image-fullscreen-overlay');
        
        closeBtn.addEventListener('click', () => this.close());
        overlay.addEventListener('click', () => this.close());
        
        // Prevent closing on image click
        this.wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Double tap to zoom (в точку тапа)
        let lastTap = 0;
        let lastTapX = 0;
        let lastTapY = 0;
        this.wrapper.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
                const t = e.changedTouches[0];
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    e.preventDefault();
                    this.toggleZoomAt(t.clientX, t.clientY);
                }
                lastTap = currentTime;
                lastTapX = t.clientX;
                lastTapY = t.clientY;
            }
        }, { passive: false });
        
        // Mouse double click for desktop
        this.wrapper.addEventListener('dblclick', (e) => {
            this.toggleZoomAt(e.clientX, e.clientY);
        });
        
        // Touch events for pinch zoom and pan
        this.setupTouchEvents();
        
        // Back button handler
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            // Will be set when viewer opens
        }
    }

    setupTouchEvents() {
        let touches = [];
        let pinchCenterX = 0;
        let pinchCenterY = 0;
        
        this.wrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                const touch = e.touches[0];
                this.startX = touch.clientX - this.translateX;
                this.startY = touch.clientY - this.translateY;
            } else if (e.touches.length === 2) {
                this.isDragging = false;
                touches = Array.from(e.touches);
                const distance = this.getTouchDistance(touches[0], touches[1]);
                this.lastTouchDistance = distance;
                pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
                pinchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
            }
        });
        
        this.wrapper.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && this.isDragging && this.scale > 1) {
                const touch = e.touches[0];
                this.translateX = touch.clientX - this.startX;
                this.translateY = touch.clientY - this.startY;
                this.updateTransform();
            } else if (e.touches.length === 2) {
                touches = Array.from(e.touches);
                const distance = this.getTouchDistance(touches[0], touches[1]);
                const scaleChange = distance / this.lastTouchDistance;
                const oldScale = this.scale;
                const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scaleChange));
                
                // Zoom вокруг центра между пальцами
                const rect = this.wrapper.getBoundingClientRect();
                const wrapperCenterX = rect.left + rect.width / 2;
                const wrapperCenterY = rect.top + rect.height / 2;
                const cx = pinchCenterX - wrapperCenterX;
                const cy = pinchCenterY - wrapperCenterY;
                this.translateX = cx - (cx - this.translateX) * (newScale / oldScale);
                this.translateY = cy - (cy - this.translateY) * (newScale / oldScale);
                this.scale = newScale;
                
                pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
                pinchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
                this.lastTouchDistance = distance;
                this.updateTransform();
            }
        });
        
        this.wrapper.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.isDragging = false;
                // Snap back if zoomed out too much
                if (this.scale < this.minScale) {
                    this.scale = this.minScale;
                    this.translateX = 0;
                    this.translateY = 0;
                    this.updateTransform();
                }
            } else if (e.touches.length === 1) {
                // One touch remaining - update for panning
                this.isDragging = true;
                const touch = e.touches[0];
                this.startX = touch.clientX - this.translateX;
                this.startY = touch.clientY - this.translateY;
            }
        });
        
        // Swipe to change image
        let swipeStartX = 0;
        let swipeStartY = 0;
        
        this.wrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1 && this.scale === 1) {
                swipeStartX = e.touches[0].clientX;
                swipeStartY = e.touches[0].clientY;
            }
        });
        
        this.wrapper.addEventListener('touchend', (e) => {
            if (this.scale === 1 && swipeStartX !== 0 && e.changedTouches && e.changedTouches[0]) {
                const swipeEndX = e.changedTouches[0].clientX;
                const swipeEndY = e.changedTouches[0].clientY;
                const deltaX = swipeEndX - swipeStartX;
                const deltaY = swipeEndY - swipeStartY;
                
                // Check if horizontal swipe is greater than vertical
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                    if (deltaX > 0 && this.currentIndex > 0) {
                        // Swipe right - previous image
                        this.showImage(this.currentIndex - 1);
                    } else if (deltaX < 0 && this.currentIndex < this.images.length - 1) {
                        // Swipe left - next image
                        this.showImage(this.currentIndex + 1);
                    }
                }
                
                swipeStartX = 0;
                swipeStartY = 0;
            }
        });
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    toggleZoomAt(clientX, clientY) {
        const rect = this.wrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;

        if (this.scale === this.minScale) {
            // Zoom in — центр в точке тапа
            this.scale = 2;
            this.translateX = -dx * (this.scale - 1);
            this.translateY = -dy * (this.scale - 1);
        } else {
            // Zoom out
            this.scale = this.minScale;
            this.translateX = 0;
            this.translateY = 0;
        }
        this.updateTransform();
    }

    updateTransform() {
        this.imageElement.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }

    open(images, startIndex = 0) {
        if (!images || images.length === 0) return;
        
        this.images = images;
        this.currentIndex = Math.max(0, Math.min(startIndex, images.length - 1));
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        
        // Hide bottom navigation bar
        const bottomNav = document.querySelector('.tg-bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }
        
        // Show image
        this.showImage(this.currentIndex);
        
        // Show viewer
        this.viewer.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Thumbnails
        this.updateThumbs();
        
        // Show back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => {
                this.close();
            });
            window.telegramWebApp.showBackButton();
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
        }
    }

    showImage(index) {
        if (index < 0 || index >= this.images.length) return;
        
        this.currentIndex = index;
        this.imageElement.src = this.images[index];
        
        // Reset zoom and position
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
        
        // Thumbnails
        this.updateThumbs();
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('light');
        }
    }

    updateThumbs() {
        if (!this.thumbsContainer) return;
        if (this.images.length <= 1) {
            this.thumbsContainer.style.display = 'none';
            return;
        }
        this.thumbsContainer.style.display = 'flex';
        this.thumbsContainer.innerHTML = this.images.map((src, i) => `
            <div class="tg-image-fullscreen-thumb ${i === this.currentIndex ? 'active' : ''}" data-index="${i}">
                <img src="${src}" alt="" loading="lazy">
            </div>
        `).join('');
        this.thumbsContainer.querySelectorAll('.tg-image-fullscreen-thumb').forEach((thumb) => {
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(thumb.dataset.index, 10);
                if (!isNaN(idx) && idx !== this.currentIndex) {
                    this.showImage(idx);
                }
            });
        });
    }

    close() {
        this.viewer.classList.remove('active');
        document.body.style.overflow = '';
        
        // Show bottom navigation bar back
        const bottomNav = document.querySelector('.tg-bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = '';
        }
        
        // Reset zoom
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
        
        // Hide back button in Telegram
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            
            // Restore back button handler
            if (window.telegramProductModal && window.telegramProductModal.modal && window.telegramProductModal.modal.classList.contains('active')) {
                // Product modal is open
                window.telegramWebApp.tg.BackButton.onClick(() => {
                    window.telegramProductModal.close();
                });
                window.telegramWebApp.showBackButton();
            } else if (window.telegramCategoryPage && window.telegramCategoryPage.page && window.telegramCategoryPage.page.classList.contains('active')) {
                // Category page is open
                window.telegramWebApp.tg.BackButton.onClick(() => {
                    window.telegramCategoryPage.close();
                });
                window.telegramWebApp.showBackButton();
            } else {
                // Restore default behavior
                window.telegramWebApp.setupBackButton();
            }
        }
        
        // Haptic feedback
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('light');
        }
    }
}

// Initialize fullscreen image viewer
let telegramImageFullscreen = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramImageFullscreen = new TelegramImageFullscreen();
        window.TelegramImageFullscreen = TelegramImageFullscreen;
        window.telegramImageFullscreen = telegramImageFullscreen;
    });
} else {
    telegramImageFullscreen = new TelegramImageFullscreen();
    window.TelegramImageFullscreen = TelegramImageFullscreen;
    window.telegramImageFullscreen = telegramImageFullscreen;
}
