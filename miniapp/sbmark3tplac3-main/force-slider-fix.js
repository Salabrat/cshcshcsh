// AGGRESSIVE SLIDER FIX - Forces correct positioning
// This will definitively fix the slider white space issue

(function() {
    'use strict';
    
    // Main fix function
    function forceFixSlider() {
        const grid = document.querySelector('.trending-grid');
        if (!grid) {
            console.warn('Trending grid not found, retrying...');
            return false;
        }
        
        const items = document.querySelectorAll('.trending-item');
        if (!items || items.length === 0) {
            console.warn('No trending items found');
            return false;
        }
        
        // Determine items per view based on viewport
        const viewportWidth = window.innerWidth;
        let itemsPerView;
        
        if (viewportWidth > 768) {
            itemsPerView = 4; // Desktop: 4 items
        } else if (viewportWidth > 480) {
            itemsPerView = 2; // Tablet: 2 items  
        } else {
            itemsPerView = 1; // Mobile: 1 item
        }
        
        // Calculate the absolute maximum index
        // For 10 items showing 4 at a time: max = 6 (shows items 7,8,9,10)
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        // Get current index from data attribute
        let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        
        // Log current state
        console.log('Slider State Check:', {
            totalItems: items.length,
            itemsPerView: itemsPerView,
            currentIndex: currentIndex,
            maxIndex: maxIndex,
            currentTransform: grid.style.transform,
            needsFix: currentIndex > maxIndex
        });
        
        // Force correction if needed
        if (currentIndex > maxIndex || currentIndex < 0) {
            console.log('🔧 FIXING SLIDER POSITION...');
            
            // Clamp to valid range
            currentIndex = Math.min(Math.max(0, currentIndex), maxIndex);
            
            // Calculate exact transform percentage
            // Each item takes up (100 / itemsPerView)% of the container width
            const itemWidthPercent = 100 / itemsPerView;
            const translateX = -(currentIndex * itemWidthPercent);
            
            // Apply the fix
            grid.style.transform = `translateX(${translateX}%)`;
            grid.dataset.currentIndex = currentIndex.toString();
            
            console.log('✅ SLIDER FIXED:', {
                newIndex: currentIndex,
                newTransform: `translateX(${translateX}%)`
            });
            
            // Fix arrow states
            updateArrows(currentIndex, maxIndex);
            
            return true;
        }
        
        // Even if index is valid, ensure transform is correct
        const expectedItemWidth = 100 / itemsPerView;
        const expectedTranslateX = -(currentIndex * expectedItemWidth);
        const expectedTransform = `translateX(${expectedTranslateX}%)`;
        
        if (grid.style.transform !== expectedTransform) {
            console.log('🔧 Correcting transform mismatch');
            grid.style.transform = expectedTransform;
            updateArrows(currentIndex, maxIndex);
            return true;
        }
        
        return false;
    }
    
    // Update arrow button states
    function updateArrows(currentIndex, maxIndex) {
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        
        if (prevArrow) {
            if (currentIndex === 0) {
                prevArrow.style.opacity = '0.3';
                prevArrow.style.pointerEvents = 'none';
                prevArrow.style.cursor = 'default';
            } else {
                prevArrow.style.opacity = '1';
                prevArrow.style.pointerEvents = 'auto';
                prevArrow.style.cursor = 'pointer';
            }
        }
        
        if (nextArrow) {
            if (currentIndex >= maxIndex) {
                nextArrow.style.opacity = '0.3';
                nextArrow.style.pointerEvents = 'none';
                nextArrow.style.cursor = 'default';
            } else {
                nextArrow.style.opacity = '1';
                nextArrow.style.pointerEvents = 'auto';
                nextArrow.style.cursor = 'pointer';
            }
        }
    }
    
    // Re-initialize the slider with correct handlers
    function reinitializeSlider() {
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        
        if (prevArrow) prevArrow.removeAttribute('data-initialized');
        if (nextArrow) nextArrow.removeAttribute('data-initialized');
        
        if (window.initTrendingSlider) {
            console.log('Re-initializing slider...');
            window.initTrendingSlider();
        }
    }
    
    // Run the fix multiple times to ensure it sticks
    function applyFix() {
        console.log('====== FORCE SLIDER FIX STARTING ======');
        
        // Try to fix immediately
        forceFixSlider();
        
        // Try again after short delays
        setTimeout(forceFixSlider, 100);
        setTimeout(forceFixSlider, 500);
        setTimeout(forceFixSlider, 1000);
        
        // Final check and reinitialize
        setTimeout(() => {
            if (forceFixSlider()) {
                console.log('Applied final fix, reinitializing...');
                reinitializeSlider();
            }
            console.log('====== FORCE SLIDER FIX COMPLETE ======');
        }, 2000);
    }
    
    // Apply fix when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyFix);
    } else {
        applyFix();
    }
    
    // Also apply on window load to catch late-loading content
    window.addEventListener('load', () => {
        setTimeout(applyFix, 100);
    });
    
    // Monitor for dynamic content changes
    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.type === 'childList' && mutation.target.classList && 
                mutation.target.classList.contains('trending-grid')) {
                console.log('Trending grid changed, applying fix...');
                setTimeout(forceFixSlider, 100);
                break;
            }
        }
    });
    
    // Start observing when grid is available
    setTimeout(() => {
        const grid = document.querySelector('.trending-grid');
        if (grid && grid.parentElement) {
            observer.observe(grid.parentElement, {
                childList: true,
                subtree: true
            });
        }
    }, 1000);
    
    // Make functions globally available
    window.forceSliderFix = forceFixSlider;
    window.applySliderFix = applyFix;
    
    console.log('Force slider fix loaded. Use window.forceSliderFix() to manually fix.');
})();
