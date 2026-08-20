// Immediate fix for trending slider position issue
// This script fixes the slider scrolling beyond the last product

// Wait for DOM and other scripts to load
window.addEventListener('load', function() {
    setTimeout(function() {
        console.log('Applying slider position fix...');
    
    const trendingGrid = document.querySelector('.trending-grid');
    if (!trendingGrid) {
        console.error('Trending grid not found');
        return;
    }
    
    const items = document.querySelectorAll('.trending-item');
    const itemsPerView = window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
    
    // Calculate proper max index
    const maxIndex = Math.max(0, items.length - itemsPerView);
    
    console.log('Slider state:', {
        currentItems: items.length,
        itemsPerView: itemsPerView,
        maxIndex: maxIndex,
        currentIndex: trendingGrid.dataset.currentIndex
    });
    
    // Reset to first position
    trendingGrid.style.transform = 'translateX(0)';
    trendingGrid.dataset.currentIndex = '0';
    
    // Remove initialization flags
    const prevArrow = document.querySelector('.prev-arrow');
    const nextArrow = document.querySelector('.next-arrow');
    
    if (prevArrow) {
        prevArrow.removeAttribute('data-initialized');
        prevArrow.style.opacity = '0.3';
        prevArrow.style.pointerEvents = 'none';
    }
    
    if (nextArrow) {
        nextArrow.removeAttribute('data-initialized');
        if (items.length > itemsPerView) {
            nextArrow.style.opacity = '1';
            nextArrow.style.pointerEvents = 'auto';
            nextArrow.style.cursor = 'pointer';
        } else {
            nextArrow.style.opacity = '0.3';
            nextArrow.style.pointerEvents = 'none';
        }
    }
    
    // Re-initialize the slider
    if (window.initTrendingSlider) {
        window.initTrendingSlider();
        console.log('Slider re-initialized successfully');
    } else {
        console.error('initTrendingSlider function not found');
    }
    }, 1000); // Wait 1 second for all scripts to load
});
