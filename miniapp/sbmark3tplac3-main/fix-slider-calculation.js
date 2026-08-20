// Fix for slider calculation issue
(function() {
    console.log('Loading slider calculation fix...');
    
    // Override the initTrendingSlider function with fixed calculation
    window.initTrendingSlider = function() {
        console.log('Initializing trending slider with FIX...');
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        const trendingGrid = document.querySelector('.trending-grid');
        
        if (!prevArrow || !nextArrow || !trendingGrid) {
            console.log('Slider elements not found');
            return;
        }
        
        // Get all items
        const items = document.querySelectorAll('.trending-item');
        const itemsPerView = window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
        
        // FIXED CALCULATION: maxIndex should allow scrolling to see ALL items
        // For example: 10 items, 4 per view -> we need to scroll 6 positions to see the last 4 items
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        console.log('FIXED Slider calculation:', {
            totalItems: items.length,
            itemsPerView: itemsPerView,
            maxIndex: maxIndex,
            explanation: `Can scroll from 0 to ${maxIndex} to see all ${items.length} items`
        });
        
        // Initialize or get current index
        let currentIndex = trendingGrid.dataset.currentIndex ? parseInt(trendingGrid.dataset.currentIndex) : 0;
        
        // Validate and correct index
        if (isNaN(currentIndex) || currentIndex < 0 || currentIndex > maxIndex) {
            currentIndex = Math.min(Math.max(0, currentIndex), maxIndex);
        }
        
        // Apply correct transform
        const itemWidth = 100 / itemsPerView;
        const correctTranslateX = -(currentIndex * itemWidth);
        trendingGrid.style.transform = `translateX(${correctTranslateX}%)`;
        trendingGrid.dataset.currentIndex = currentIndex;
        
        // Clone arrows to remove old event listeners
        const newPrevArrow = prevArrow.cloneNode(true);
        const newNextArrow = nextArrow.cloneNode(true);
        prevArrow.parentNode.replaceChild(newPrevArrow, prevArrow);
        nextArrow.parentNode.replaceChild(newNextArrow, nextArrow);
        
        function getItemsPerView() {
            return window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
        }
        
        function updateSlider() {
            const items = document.querySelectorAll('.trending-item');
            const itemsPerView = getItemsPerView();
            
            // Recalculate maxIndex
            const maxIndex = Math.max(0, items.length - itemsPerView);
            
            // Ensure currentIndex is valid
            if (currentIndex > maxIndex) {
                currentIndex = maxIndex;
            }
            
            console.log('Updating slider position:', {
                currentIndex: currentIndex,
                maxIndex: maxIndex,
                canGoNext: currentIndex < maxIndex,
                canGoPrev: currentIndex > 0
            });
            
            // Save current index
            trendingGrid.dataset.currentIndex = currentIndex;
            
            if (items.length === 0) {
                // No items
                newPrevArrow.style.opacity = '0.3';
                newPrevArrow.style.pointerEvents = 'none';
                newNextArrow.style.opacity = '0.3';
                newNextArrow.style.pointerEvents = 'none';
                return;
            }
            
            // Calculate transform
            const itemWidth = 100 / itemsPerView;
            const translateX = -(currentIndex * itemWidth);
            trendingGrid.style.transform = `translateX(${translateX}%)`;
            
            // Update arrow states
            if (items.length <= itemsPerView) {
                // All items fit in view
                newPrevArrow.style.opacity = '0.3';
                newPrevArrow.style.pointerEvents = 'none';
                newNextArrow.style.opacity = '0.3';
                newNextArrow.style.pointerEvents = 'none';
            } else {
                // Enable/disable arrows based on position
                newPrevArrow.style.opacity = currentIndex === 0 ? '0.3' : '1';
                newPrevArrow.style.pointerEvents = currentIndex === 0 ? 'none' : 'auto';
                newPrevArrow.style.cursor = currentIndex === 0 ? 'default' : 'pointer';
                
                // FIXED: Use < instead of >= for next arrow
                newNextArrow.style.opacity = currentIndex < maxIndex ? '1' : '0.3';
                newNextArrow.style.pointerEvents = currentIndex < maxIndex ? 'auto' : 'none';
                newNextArrow.style.cursor = currentIndex < maxIndex ? 'pointer' : 'default';
                
                console.log('Arrow states:', {
                    prevDisabled: currentIndex === 0,
                    nextDisabled: currentIndex >= maxIndex,
                    currentIndex: currentIndex,
                    maxIndex: maxIndex
                });
            }
        }
        
        newNextArrow.addEventListener('click', function(e) {
            e.preventDefault();
            const items = document.querySelectorAll('.trending-item');
            const itemsPerView = getItemsPerView();
            const maxIndex = Math.max(0, items.length - itemsPerView);
            
            console.log('Next arrow clicked:', {
                currentIndex: currentIndex,
                maxIndex: maxIndex,
                canMove: currentIndex < maxIndex
            });
            
            if (currentIndex < maxIndex) {
                currentIndex++;
                updateSlider();
            }
        });
        
        newPrevArrow.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentIndex > 0) {
                currentIndex--;
                updateSlider();
            }
        });
        
        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                const items = document.querySelectorAll('.trending-item');
                const itemsPerView = getItemsPerView();
                const newMaxIndex = Math.max(0, items.length - itemsPerView);
                
                if (currentIndex > newMaxIndex) {
                    currentIndex = newMaxIndex;
                }
                updateSlider();
            }, 250);
        });
        
        // Initial update
        updateSlider();
    };
    
    // Debug function to check slider state
    window.debugSlider = function() {
        const items = document.querySelectorAll('.trending-item');
        const itemsPerView = window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
        const trendingGrid = document.querySelector('.trending-grid');
        const currentIndex = parseInt(trendingGrid.dataset.currentIndex) || 0;
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        console.log('=== SLIDER DEBUG INFO ===');
        console.log('Total items:', items.length);
        console.log('Items per view:', itemsPerView);
        console.log('Current index:', currentIndex);
        console.log('Max index:', maxIndex);
        console.log('Current transform:', trendingGrid.style.transform);
        
        // Show which items are visible
        const firstVisible = currentIndex + 1;
        const lastVisible = Math.min(currentIndex + itemsPerView, items.length);
        console.log(`Showing items ${firstVisible} to ${lastVisible} of ${items.length}`);
        
        // Check if we can see all items
        if (currentIndex === maxIndex) {
            const visibleCount = items.length - currentIndex;
            console.log(`At max position, showing last ${visibleCount} items`);
        }
        
        return {
            totalItems: items.length,
            itemsPerView: itemsPerView,
            currentIndex: currentIndex,
            maxIndex: maxIndex,
            visibleRange: `${firstVisible}-${lastVisible}`,
            canGoNext: currentIndex < maxIndex,
            canGoPrev: currentIndex > 0
        };
    };
    
    // Re-initialize slider after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (window.initTrendingSlider) {
            console.log('Re-initializing slider with fix...');
            window.initTrendingSlider();
        }
    }, 100);
    
})();
