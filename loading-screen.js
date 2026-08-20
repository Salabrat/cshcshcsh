// Loading Screen Manager
(function() {
    'use strict';
    
    // Check if we're on the main page (index.html)
    const isMainPage = window.location.pathname === '/' || 
                       window.location.pathname.endsWith('index.html') || 
                       window.location.pathname === '/index.html';
    
    if (!isMainPage) {
        return; // Only show loading screen on main page
    }
    
    // Check if we should skip loading screen (e.g., coming from login page)
    const skipLoading = sessionStorage.getItem('skipLoadingScreen');
    if (skipLoading === 'true') {
        sessionStorage.removeItem('skipLoadingScreen');
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
        document.body.classList.add('loading-complete');
        return; // Skip loading screen
    }
    
    // Load loading screen settings
    async function loadLoadingBrandSettings() {
        try {
            const response = await fetch('/api/site-settings');
            if (response.ok) {
                const settings = await response.json();
                const siteName = (settings && typeof settings.siteName === 'string') ? settings.siteName.trim() : '';
                const loadingText = (settings && typeof settings.loadingText === 'string') ? settings.loadingText.trim() : '';
                // Use loaderLogoUrl first, fall back to logoUrl for backward compatibility
                const logoUrl = (settings && typeof settings.loaderLogoUrl === 'string' && settings.loaderLogoUrl.trim()) 
                    ? settings.loaderLogoUrl.trim() 
                    : ((settings && typeof settings.logoUrl === 'string') ? settings.logoUrl.trim() : '');

                return {
                    text: loadingText || siteName || 'C.P. COMPANY',
                    logoUrl
                };
            }
        } catch (error) {
            console.error('Error loading loading brand settings:', error);
        }

        return {
            text: 'C.P. COMPANY',
            logoUrl: ''
        };
    }
    
    // Create loading screen HTML
    async function createLoadingScreen() {
        const loadingScreen = document.createElement('div');
        loadingScreen.className = 'loading-screen';
        loadingScreen.id = 'loadingScreen';
        
        // Create main container
        const loaderContainer = document.createElement('div');
        loaderContainer.className = 'loader-container';
        
        // Create brand logo/text
        const brandEl = document.createElement('div');
        brandEl.className = 'loader-brand';

        const brandSettings = await loadLoadingBrandSettings();

        if (brandSettings.logoUrl) {
            // iOS fix: convert data:video URLs to blob URLs
            if (brandSettings.logoUrl.startsWith('data:video/') && window._iosVideoFix && window._iosVideoFix.dataUrlToBlob) {
                const blobUrl = window._iosVideoFix.dataUrlToBlob(brandSettings.logoUrl);
                if (blobUrl) brandSettings.logoUrl = blobUrl;
            }
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(brandSettings.logoUrl) || brandSettings.logoUrl.startsWith('blob:');
            
            if (isVideo) {
                const video = document.createElement('video');
                video.className = 'loader-brand-logo';
                if (typeof brandSettings.logoUrl === 'string' && brandSettings.logoUrl.startsWith('/uploads/') && !video.poster) {
                    video.poster = '/api/video-poster?src=' + encodeURIComponent(brandSettings.logoUrl);
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
                video.onloadeddata = () => {
                    video.classList.add('loaded');
                    video.play().catch(() => {});
                };
                video.onerror = () => {
                    brandEl.innerHTML = '';
                    brandEl.textContent = brandSettings.text;
                };
                video.src = brandSettings.logoUrl;
                brandEl.appendChild(video);
                video.load();
                video.play().catch(() => {});
                if (window._iosVideoFix) window._iosVideoFix.applyToVideo(video);
            } else {
                const img = document.createElement('img');
                img.className = 'loader-brand-logo';
                img.alt = brandSettings.text;
                img.onload = () => img.classList.add('loaded');
                img.onerror = () => {
                    brandEl.innerHTML = '';
                    brandEl.textContent = brandSettings.text;
                };
                img.src = brandSettings.logoUrl;
                brandEl.appendChild(img);
            }
        } else {
            brandEl.textContent = brandSettings.text;
        }

        loaderContainer.appendChild(brandEl);
        
        loadingScreen.appendChild(loaderContainer);
        document.body.insertBefore(loadingScreen, document.body.firstChild);
        
        // Make body visible now that loading screen is in place
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
    }
    
    // Hide loading screen with animation
    function hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            // Add hide class to trigger fade out animation
            loadingScreen.classList.add('hide');
            
            // Add loading-complete class to body
            document.body.classList.add('loading-complete');
            
            // Remove element after animation completes
            setTimeout(() => {
                loadingScreen.remove();
                // Enable body scroll if it was disabled
                document.body.style.overflow = '';
            }, 800); // Match the CSS transition duration
        }
    }
    
    // Initialize loading screen
    async function init() {
        // Create loading screen immediately
        await createLoadingScreen();
        
        // Temporarily disable body scroll
        document.body.style.overflow = 'hidden';
        
        // Set minimum display time (2.5 seconds) to show the animation
        const minDisplayTime = 2500;
        const startTime = Date.now();
        
        // Wait for page to fully load
        window.addEventListener('load', () => {
            const loadTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minDisplayTime - loadTime);
            
            // Hide loading screen after minimum time or when page is loaded
            setTimeout(hideLoadingScreen, remainingTime);
        });
        
        // Fallback: Hide loading screen after 5 seconds max
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen && !loadingScreen.classList.contains('hide')) {
                hideLoadingScreen();
            }
        }, 5000);
    }
    
    // Start loading screen immediately when script loads
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for it
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already loaded
        init();
    }
})();
