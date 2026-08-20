// Load saved homepage images for all users
(function() {
    'use strict';
    
    // Image mapping for homepage sections
    const imageMapping = {
        hero: '.hero-section .hero-image img',
        campaign1: '.campaign-content-wrapper .campaign-image img',
        campaign2: '.campaign-split .campaign-split-image img',
        campaign3: '.campaign-split-reverse .campaign-split-image img',
        about1: '.about-item:nth-child(1) .about-item-image img',
        about2: '.about-item:nth-child(2) .about-item-image img'
    };
    
    // Load saved images
    async function loadHomepageImages() {
        try {
            const response = await fetch('/api/homepage-images', {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            if (!response.ok) {
                // If server returned 304 (Not Modified), fall back to last cached images
                if (response.status === 304 && window.__lastHomepageImages) {
                    console.warn('Homepage images not modified, reusing cached data');
                    applyImages(window.__lastHomepageImages);
                    return;
                }
                console.warn('Could not load homepage images');
                return;
            }

            const images = await response.json();
            window.__lastHomepageImages = images;
            
            // Normalize URL to absolute so images load from correct origin (fixes Telegram/miniapp, etc.)
            function toAbsoluteUrl(url) {
                if (!url || typeof url !== 'string') return url;
                if (url.startsWith('http://') || url.startsWith('https://')) return url;
                const base = window.location.origin;
                return url.startsWith('/') ? base + url : base + '/' + url;
            }

            function applyImages(imgMap) {
                Object.entries(imgMap).forEach(([key, url]) => {
                    if (url && imageMapping[key]) {
                        const img = document.querySelector(imageMapping[key]);
                        if (img) {
                            const absoluteUrl = toAbsoluteUrl(url);
                            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
                            
                            if (isVideo) {
                                // Replace img with video element
                                const container = img.parentElement;
                                let video = container.querySelector('video.homepage-media-video');
                                
                                if (!video) {
                                    video = document.createElement('video');
                                    video.className = 'homepage-media-video';
                                    video.style.cssText = img.style.cssText || 'width: 100%; height: 100%; object-fit: cover;';
                                    video.muted = true;
                                    video.loop = true;
                                    video.playsInline = true;
                                    video.autoplay = true;
                                    video.setAttribute('playsinline', '');
                                    video.setAttribute('webkit-playsinline', '');
                                    container.insertBefore(video, img);
                                }
                                
                                video.src = absoluteUrl;
                                video.load();
                                video.play().catch(err => console.warn(`Video autoplay blocked for ${key}:`, err));
                                img.style.display = 'none';
                            } else {
                                // Handle image
                                // Remove any existing video element
                                const existingVideo = img.parentElement.querySelector('video.homepage-media-video');
                                if (existingVideo) {
                                    existingVideo.pause();
                                    existingVideo.remove();
                                }
                                
                                // Save original src only if it's a real image URL (not the 1x1 placeholder)
                                const isPlaceholder = img.src && (img.src.startsWith('data:image/gif;base64,') || img.src.includes('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'));
                                if (!img.dataset.originalSrc && !isPlaceholder) {
                                    img.dataset.originalSrc = img.src;
                                }

                                // Update image source with absolute URL
                                img.src = absoluteUrl;
                                img.style.display = '';

                                // On error: don't fall back to placeholder (user would see blank). Just log.
                                img.onerror = function() {
                                    console.warn(`Failed to load image for ${key}:`, absoluteUrl);
                                };
                            }
                        }
                    }
                });
            }

            // Update images on page
            applyImages(images);
            
            console.log('Homepage images loaded successfully');
        } catch (error) {
            console.error('Error loading homepage images:', error);
        }
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadHomepageImages);
    } else {
        loadHomepageImages();
    }
    
    // Also reload on visibility change (for SPA navigation)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadHomepageImages();
        }
    });
    
    // Export for global access
    window.loadHomepageImages = loadHomepageImages;
})();
