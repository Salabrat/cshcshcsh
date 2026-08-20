// Telegram Products Swipe Controller
// Makes horizontal scrolling smoother and less sensitive to accidental swipes

(function() {
    'use strict';

    // Configuration
    const SWIPE_THRESHOLD = 80; // Minimum distance for swipe (increased from default)
    const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for swipe
    const SCROLL_SNAP_DELAY = 100; // Delay before snap (ms)

    // Initialize swipe controllers for all product scroll containers
    function initSwipeControllers() {
        const scrollContainers = document.querySelectorAll('.tg-products-scroll');
        
        scrollContainers.forEach(container => {
            // Skip if already initialized
            if (container.dataset.swipeInitialized === 'true') {
                return;
            }

            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            let isScrolling = false;
            let scrollTimeout = null;

            // Touch start
            container.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                isScrolling = false;
            }, { passive: true });

            // Touch move - detect if user is scrolling
            container.addEventListener('touchmove', (e) => {
                if (!touchStartX) return;

                const touchCurrentX = e.touches[0].clientX;
                const touchCurrentY = e.touches[0].clientY;
                const deltaX = Math.abs(touchCurrentX - touchStartX);
                const deltaY = Math.abs(touchCurrentY - touchStartY);

                // If vertical movement is greater, user is scrolling page, not swiping products
                if (deltaY > deltaX) {
                    isScrolling = true;
                }
            }, { passive: true });

            // Touch end - handle swipe
            container.addEventListener('touchend', (e) => {
                if (!touchStartX || isScrolling) {
                    touchStartX = 0;
                    return;
                }

                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const touchEndTime = Date.now();

                const deltaX = touchStartX - touchEndX;
                const deltaY = Math.abs(touchEndY - touchStartY);
                const deltaTime = touchEndTime - touchStartTime;
                const velocity = Math.abs(deltaX) / deltaTime;

                // Reset
                touchStartX = 0;

                // Check if it's a valid horizontal swipe
                if (Math.abs(deltaX) < SWIPE_THRESHOLD || deltaY > Math.abs(deltaX) * 0.5) {
                    return; // Not a valid swipe
                }

                // Check velocity threshold
                if (velocity < SWIPE_VELOCITY_THRESHOLD && Math.abs(deltaX) < SWIPE_THRESHOLD * 1.5) {
                    return; // Too slow or too short
                }

                // Calculate scroll amount (one card width + gap)
                const cardWidth = container.querySelector('.tg-product-card')?.offsetWidth || 0;
                const gap = 12;
                const scrollAmount = cardWidth + gap;

                // Clear any pending scroll
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }

                // Smooth scroll to next/previous position
                scrollTimeout = setTimeout(() => {
                    const currentScroll = container.scrollLeft;
                    const scrollDirection = deltaX > 0 ? 1 : -1; // Positive = left swipe (scroll right)
                    const targetScroll = currentScroll + (scrollAmount * scrollDirection);

                    container.scrollTo({
                        left: targetScroll,
                        behavior: 'smooth'
                    });
                }, 10);

            }, { passive: true });

            // Mark as initialized
            container.dataset.swipeInitialized = 'true';
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initSwipeControllers();
            
            // Watch for dynamically added containers
            watchForNewContainers();
        });
    } else {
        initSwipeControllers();
        watchForNewContainers();
    }

    // Watch for dynamically added product scroll containers
    function watchForNewContainers() {
        const observer = new MutationObserver(() => {
            initSwipeControllers();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Export for manual initialization if needed
    window.initTelegramProductsSwipe = initSwipeControllers;
})();
