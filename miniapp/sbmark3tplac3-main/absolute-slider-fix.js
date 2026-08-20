// ABSOLUTE SLIDER FIX - The final solution
// This will definitively prevent any white space after the last product

(function() {
    'use strict';
    
    console.log('🔧 ABSOLUTE SLIDER FIX LOADING...');
    
    // Core fix function - simple and direct
    function absoluteFix() {
        const grid = document.querySelector('.trending-grid');
        if (!grid) return;
        
        const items = document.querySelectorAll('.trending-item');
        if (!items || items.length === 0) return;
        
        // Calculate items per view
        const vw = window.innerWidth;
        const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
        
        // CRITICAL: Calculate exact maximum index
        // For 10 items with 4 per view: max = 6 (shows items 7-10)
        // For 9 items with 4 per view: max = 5 (shows items 6-9)
        // For 8 items with 4 per view: max = 4 (shows items 5-8)
        const totalItems = items.length;
        const maxPossibleIndex = Math.max(0, totalItems - itemsPerView);
        
        // Get current index
        let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        
        console.log('Slider check:', {
            totalItems,
            itemsPerView,
            currentIndex,
            maxPossibleIndex,
            needsFix: currentIndex > maxPossibleIndex
        });
        
        // FORCE FIX if out of bounds
        if (currentIndex > maxPossibleIndex) {
            console.log('❌ SLIDER OUT OF BOUNDS! Fixing...');
            
            // Set to maximum valid position
            currentIndex = maxPossibleIndex;
            
            // Calculate transform
            const itemWidth = 100 / itemsPerView;
            const translateX = -(currentIndex * itemWidth);
            
            // Apply immediately
            grid.style.transform = `translateX(${translateX}%)`;
            grid.dataset.currentIndex = currentIndex.toString();
            
            // Fix arrows
            const nextArrow = document.querySelector('.next-arrow');
            const prevArrow = document.querySelector('.prev-arrow');
            
            if (nextArrow) {
                nextArrow.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
                nextArrow.disabled = true;
            }
            
            if (prevArrow && currentIndex > 0) {
                prevArrow.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
                prevArrow.disabled = false;
            }
            
            console.log('✅ FIXED! New position:', currentIndex);
        }
        
        // Also check if we're showing the correct number of items
        verifyVisibleItems(items, currentIndex, itemsPerView);
    }
    
    // Verify that we're showing the right number of items
    function verifyVisibleItems(items, currentIndex, itemsPerView) {
        const totalItems = items.length;
        const firstVisible = currentIndex;
        const lastVisible = currentIndex + itemsPerView - 1;
        
        if (lastVisible >= totalItems) {
            console.warn('⚠️ Trying to show item', lastVisible + 1, 'but only have', totalItems, 'items');
            
            // Adjust if necessary
            const correctIndex = Math.max(0, totalItems - itemsPerView);
            if (currentIndex !== correctIndex) {
                const grid = document.querySelector('.trending-grid');
                const itemWidth = 100 / itemsPerView;
                const translateX = -(correctIndex * itemWidth);
                
                grid.style.transform = `translateX(${translateX}%)`;
                grid.dataset.currentIndex = correctIndex.toString();
                
                console.log('✅ Adjusted to show last', itemsPerView, 'items');
            }
        }
    }
    
    // Override both buttons with proper state management
    function overrideSliderButtons() {
        const nextArrow = document.querySelector('.next-arrow');
        const prevArrow = document.querySelector('.prev-arrow');
        
        if (!nextArrow || !prevArrow) return;
        
        // Remove all existing listeners by cloning both arrows
        const newNext = nextArrow.cloneNode(true);
        const newPrev = prevArrow.cloneNode(true);
        nextArrow.parentNode.replaceChild(newNext, nextArrow);
        prevArrow.parentNode.replaceChild(newPrev, prevArrow);
        
        // Helper function to update arrow states
        function updateArrowStates(currentIndex, maxIndex) {
            if (currentIndex <= 0) {
                newPrev.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
                newPrev.disabled = true;
            } else {
                newPrev.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
                newPrev.disabled = false;
            }
            
            if (currentIndex >= maxIndex) {
                newNext.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
                newNext.disabled = true;
            } else {
                newNext.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
                newNext.disabled = false;
            }
        }
        
        // Add controlled listener to NEXT button
        newNext.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const grid = document.querySelector('.trending-grid');
            const items = document.querySelectorAll('.trending-item');
            const vw = window.innerWidth;
            const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
            const maxIndex = Math.max(0, items.length - itemsPerView);
            
            let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
            
            console.log('Next clicked. Current:', currentIndex, 'Max:', maxIndex);
            
            if (currentIndex < maxIndex) {
                currentIndex++;
                const itemWidth = 100 / itemsPerView;
                const translateX = -(currentIndex * itemWidth);
                
                grid.style.transform = `translateX(${translateX}%)`;
                grid.dataset.currentIndex = currentIndex.toString();
                
                // Update both arrow states
                updateArrowStates(currentIndex, maxIndex);
            } else {
                console.log('Already at maximum position');
            }
        });
        
        // Add controlled listener to PREV button
        newPrev.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const grid = document.querySelector('.trending-grid');
            const items = document.querySelectorAll('.trending-item');
            const vw = window.innerWidth;
            const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
            const maxIndex = Math.max(0, items.length - itemsPerView);
            
            let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
            
            console.log('Prev clicked. Current:', currentIndex);
            
            if (currentIndex > 0) {
                currentIndex--;
                const itemWidth = 100 / itemsPerView;
                const translateX = -(currentIndex * itemWidth);
                
                grid.style.transform = `translateX(${translateX}%)`;
                grid.dataset.currentIndex = currentIndex.toString();
                
                // Update both arrow states
                updateArrowStates(currentIndex, maxIndex);
            } else {
                console.log('Already at minimum position');
            }
        });
        
        // Set initial arrow states
        const grid = document.querySelector('.trending-grid');
        const items = document.querySelectorAll('.trending-item');
        const vw = window.innerWidth;
        const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
        const maxIndex = Math.max(0, items.length - itemsPerView);
        const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        updateArrowStates(currentIndex, maxIndex);
    }
    
    // Main initialization
    function initialize() {
        console.log('🚀 Initializing absolute slider fix...');
        
        // Fix position
        absoluteFix();
        
        // Override buttons with proper state management
        setTimeout(() => {
            overrideSliderButtons();
        }, 100);
        
        // Monitor for changes
        const observer = new MutationObserver(() => {
            absoluteFix();
        });
        
        const grid = document.querySelector('.trending-grid');
        if (grid) {
            observer.observe(grid, {
                attributes: true,
                attributeFilter: ['data-current-index', 'style']
            });
        }
    }
    
    // Run at multiple stages
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Run again after delays
    setTimeout(initialize, 500);
    setTimeout(initialize, 1000);
    setTimeout(initialize, 2000);
    
    // Expose globally
    window.absoluteSliderFix = absoluteFix;
    window.reinitSlider = initialize;
    window.overrideSliderButtons = overrideSliderButtons;
    
    console.log('✅ ABSOLUTE SLIDER FIX READY. Use window.absoluteSliderFix() to fix manually.');
})();
