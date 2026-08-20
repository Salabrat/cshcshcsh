// Immediate aggressive fix for desktop slider position
// This runs immediately and continuously monitors the slider

(function() {
    'use strict';
    
    function fixSliderNow() {
        const trendingGrid = document.querySelector('.trending-grid');
        if (!trendingGrid) return false;
        
        const items = document.querySelectorAll('.trending-item');
        if (items.length === 0) return false;
        
        // Get viewport width to determine items per view
        const viewportWidth = window.innerWidth;
        let itemsPerView;
        
        if (viewportWidth > 768) {
            itemsPerView = 4; // Desktop
        } else if (viewportWidth > 480) {
            itemsPerView = 2; // Tablet
        } else {
            itemsPerView = 1; // Mobile
        }
        
        // Calculate the true maximum index
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        // Get current index
        let currentIndex = parseInt(trendingGrid.dataset.currentIndex) || 0;
        
        // Check if current index is out of bounds
        if (currentIndex > maxIndex) {
            console.log('Fixing slider position:', {
                oldIndex: currentIndex,
                newIndex: maxIndex,
                totalItems: items.length,
                itemsPerView: itemsPerView,
                viewportWidth: viewportWidth
            });
            
            // Reset to maximum valid position
            currentIndex = maxIndex;
            
            // Calculate the correct transform
            const itemWidth = 100 / itemsPerView;
            const translateX = -(currentIndex * itemWidth);
            
            // Apply the fix
            trendingGrid.style.transform = `translateX(${translateX}%)`;
            trendingGrid.dataset.currentIndex = currentIndex.toString();
            
            // Update arrow states
            const prevArrow = document.querySelector('.prev-arrow');
            const nextArrow = document.querySelector('.next-arrow');
            
            if (nextArrow) {
                nextArrow.style.opacity = '0.3';
                nextArrow.style.pointerEvents = 'none';
                nextArrow.style.cursor = 'default';
            }
            
            if (prevArrow && currentIndex > 0) {
                prevArrow.style.opacity = '1';
                prevArrow.style.pointerEvents = 'auto';
                prevArrow.style.cursor = 'pointer';
            }
            
            return true;
        }
        
        return false;
    }
    
    // Run immediately
    console.log('Desktop slider fix: Running immediate check...');
    fixSliderNow();
    
    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Desktop slider fix: DOM loaded, checking...');
            fixSliderNow();
        });
    }
    
    // Run after a short delay to catch any dynamic updates
    setTimeout(function() {
        console.log('Desktop slider fix: Delayed check...');
        if (fixSliderNow()) {
            console.log('Desktop slider fix: Position corrected!');
        }
    }, 100);
    
    // Run after products might be loaded
    setTimeout(function() {
        console.log('Desktop slider fix: Final check...');
        if (fixSliderNow()) {
            console.log('Desktop slider fix: Final position corrected!');
        }
    }, 2000);
    
    // Also fix on window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fixSliderNow, 250);
    });
    
    // Make function globally available for manual fixing
    window.forceFixDesktopSlider = fixSliderNow;
})();
