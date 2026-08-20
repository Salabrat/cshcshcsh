// Telegram Mini App Page Loader Manager
// Tracks loading state and manages loader visibility

class TelegramPageLoader {
    constructor() {
        this.loader = document.getElementById('tgPageLoader');
        this.isLoading = true;
        this.dataLoaded = false;
        this.firstCoverLoaded = false;
        
        this.init();
    }

    init() {
        if (!this.loader) {
            console.warn('Page loader element not found');
            return;
        }

        // Load and display loading screen logo
        this.loadLoadingScreenLogo();

        // Record start time
        this.startTime = Date.now();

        // Add loading class to body
        document.body.classList.add('tg-loading');

        // Start tracking
        this.trackDataLoading();
        this.watchForFirstCover();
    }

    loadLoadingScreenLogo() {
        const wrap = document.getElementById('tgPageLoaderLogoWrap');
        if (!wrap) return;
        if (this.loader.querySelector('.tg-page-loader-logo') && wrap.children.length > 0) return;

        const injectLogo = (src) => {
            if (!src || this.loader.querySelector('.tg-page-loader-logo')) return;
            // iOS fix: convert data:video URLs to blob URLs
            if (typeof src === 'string' && src.startsWith('data:video/') && window._iosVideoFix && window._iosVideoFix.dataUrlToBlob) {
                const blobUrl = window._iosVideoFix.dataUrlToBlob(src);
                if (blobUrl) src = blobUrl;
            }
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(src) || src.startsWith('data:video/') || src.startsWith('blob:');
            
            if (isVideo) {
                const video = document.createElement('video');
                video.src = src;
                video.className = 'tg-page-loader-logo';
                if (typeof src === 'string' && src.startsWith('/uploads/') && !video.poster) {
                    video.poster = '/api/video-poster?src=' + encodeURIComponent(src);
                }
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.autoplay = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.setAttribute('muted', '');
                video.setAttribute('autoplay', '');
                video.setAttribute('preload', 'auto');
                video.onloadedmetadata = () => {
                    video.classList.add('tg-page-loader-logo-visible');
                };
                video.onloadeddata = () => {
                    video.classList.add('tg-page-loader-logo-visible');
                    video.play().catch(() => {});
                };
                video.onerror = () => video.classList.add('tg-page-loader-logo-visible');
                wrap.appendChild(video);
                video.load();
                video.play().catch(() => {});
                if (window._iosVideoFix) window._iosVideoFix.applyToVideo(video);
            } else {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'tg-page-loader-logo';
                img.alt = 'Loading...';
                img.onload = img.onerror = () => img.classList.add('tg-page-loader-logo-visible');
                wrap.appendChild(img);
            }
        };

        let logoSrc = null;
        try {
            const settings = localStorage.getItem('tg_miniapp_design_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                const firstLogo = Array.isArray(parsed.logoImages) && parsed.logoImages.length > 0 ? parsed.logoImages[0] : null;
                const firstLogoUrl = firstLogo && typeof firstLogo === 'object' ? firstLogo.url : (typeof firstLogo === 'string' ? firstLogo : null);
                logoSrc = parsed.loadingScreenImage || parsed.loaderLogoUrl || parsed.logoUrl || firstLogoUrl || null;
            }
        } catch (error) {
            console.error('Error parsing mini app design settings:', error);
        }

        if (logoSrc) {
            injectLogo(logoSrc);
            return;
        }

        // Fallback: request settings from server
        fetch('/api/telegram/design-settings')
            .then(resp => (resp.ok ? resp.json() : null))
            .then(data => {
                if (!data) return;
                const firstLogo = Array.isArray(data.logoImages) && data.logoImages.length > 0 ? data.logoImages[0] : null;
                const firstLogoUrl = firstLogo && typeof firstLogo === 'object' ? firstLogo.url : (typeof firstLogo === 'string' ? firstLogo : null);
                const remoteSrc = data.loadingScreenImage || data.loaderLogoUrl || data.logoUrl || firstLogoUrl;
                injectLogo(remoteSrc);
            })
            .catch(err => console.error('Error fetching design settings for loader logo:', err));
    }

    trackDataLoading() {
        // Listen for custom events from loaders
        window.addEventListener('tgDataLoaded', () => {
            this.dataLoaded = true;
            this.checkComplete();
        }, { once: false });

        // Wait for full window load (all resources including images/scripts)
        if (document.readyState === 'complete') {
            this.windowLoaded = true;
        } else {
            window.addEventListener('load', () => {
                this.windowLoaded = true;
                console.log('Page loader: window.load fired');
                this.checkComplete();
            }, { once: true });
        }

        // Also check after a delay to ensure data is loaded (fallback)
        // This ensures loader doesn't stay forever if events are missed
        setTimeout(() => {
            if (!this.dataLoaded) {
                console.log('Page loader: Data loading timeout, marking as loaded');
                this.dataLoaded = true;
                this.checkComplete();
            }
        }, 3000);

        // Hard fallback: hide loader after 10s no matter what
        setTimeout(() => {
            if (this.isLoading) {
                console.log('Page loader: Hard timeout, forcing hide');
                this.windowLoaded = true;
                this.dataLoaded = true;
                this.firstCoverLoaded = true;
                this.hideLoader();
            }
        }, 10000);
    }

    watchForFirstCover() {
        // Watch for the first product cover image to appear and load in .tg-main-content
        const observer = new MutationObserver((mutations) => {
            if (this.firstCoverLoaded) return;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    // Look for product card images inside .tg-main-content
                    const imgs = node.tagName === 'IMG' ? [node] : 
                                 (node.querySelectorAll ? Array.from(node.querySelectorAll('.tg-product-card img, .tg-section img')) : []);

                    for (const img of imgs) {
                        if (!img.src || img.src.startsWith('data:')) continue;

                        const onLoaded = () => {
                            if (this.firstCoverLoaded) return;
                            this.firstCoverLoaded = true;
                            console.log('Page loader: First cover image loaded');
                            observer.disconnect();
                            this.checkComplete();
                        };

                        if (img.complete && img.naturalHeight !== 0) {
                            onLoaded();
                            return;
                        }

                        img.addEventListener('load', onLoaded, { once: true });
                        img.addEventListener('error', onLoaded, { once: true });
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Also check images already in the DOM
        setTimeout(() => {
            if (this.firstCoverLoaded) return;
            const existing = document.querySelectorAll('.tg-main-content .tg-product-card img, .tg-main-content .tg-section img');
            for (const img of existing) {
                if (!img.src || img.src.startsWith('data:')) continue;
                if (img.complete && img.naturalHeight !== 0) {
                    this.firstCoverLoaded = true;
                    console.log('Page loader: First cover image already loaded');
                    observer.disconnect();
                    this.checkComplete();
                    return;
                }
                img.addEventListener('load', () => {
                    if (this.firstCoverLoaded) return;
                    this.firstCoverLoaded = true;
                    console.log('Page loader: First cover image loaded (existing)');
                    observer.disconnect();
                    this.checkComplete();
                }, { once: true });
            }
        }, 200);

        // Fallback: if no cover images appear after 5s, hide loader anyway
        setTimeout(() => {
            if (!this.firstCoverLoaded) {
                console.log('Page loader: Cover image timeout, proceeding anyway');
                this.firstCoverLoaded = true;
                observer.disconnect();
                this.checkComplete();
            }
        }, 5000);
    }

    checkComplete() {
        // Hide loader when data is loaded AND first cover loaded AND window fully loaded
        if (this.dataLoaded && this.firstCoverLoaded && this.windowLoaded && this.isLoading) {
            const minDisplayTime = 800;
            const elapsed = Date.now() - (this.startTime || Date.now());
            if (elapsed >= minDisplayTime) {
                this.hideLoader();
            } else {
                setTimeout(() => this.hideLoader(), minDisplayTime - elapsed);
            }
        }
    }

    hideLoader() {
        if (!this.isLoading) return;
        
        this.isLoading = false;

        // Add hiding class for smooth transition
        this.loader.classList.add('hiding');

        // Remove loading class from body
        document.body.classList.remove('tg-loading');
        document.body.classList.add('tg-loaded');

        // Remove loader after animation
        setTimeout(() => {
            this.loader.classList.add('hidden');
        }, 500);
    }

    // Public method to manually mark as loaded
    markAsLoaded() {
        this.dataLoaded = true;
        this.firstCoverLoaded = true;
        this.hideLoader();
    }

    // Public method to show loader again (for page transitions)
    show() {
        this.isLoading = true;
        this.dataLoaded = false;
        this.firstCoverLoaded = false;
        this.startTime = Date.now();
        
        this.loader.classList.remove('hidden', 'hiding');
        document.body.classList.add('tg-loading');
        document.body.classList.remove('tg-loaded');
        
        // Restart tracking
        this.watchForFirstCover();
    }
}

// Initialize page loader
let telegramPageLoader = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramPageLoader = new TelegramPageLoader();
        window.telegramPageLoader = telegramPageLoader;
    });
} else {
    telegramPageLoader = new TelegramPageLoader();
    window.telegramPageLoader = telegramPageLoader;
}

// Export for use in other modules
window.TelegramPageLoader = TelegramPageLoader;
