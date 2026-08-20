// Run this in the browser console to immediately fix the slider
// Copy and paste this entire code into the console

(function() {
    const grid = document.querySelector('.trending-grid');
    const items = document.querySelectorAll('.trending-item');
    const itemsPerView = window.innerWidth > 768 ? 4 : 2;
    const maxIndex = Math.max(0, items.length - itemsPerView);
    
    console.log('Current state:', {
        currentIndex: grid.dataset.currentIndex,
        transform: grid.style.transform,
        itemCount: items.length,
        itemsPerView: itemsPerView,
        maxIndex: maxIndex
    });
    
    // If we have 10 items and show 4, max should be 6 (shows items 7-10)
    // Current index 6 with transform -150% is correct for 10 items
    // But if we have less items, it needs adjustment
    
    let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
    
    if (currentIndex > maxIndex) {
        currentIndex = maxIndex;
        const itemWidth = 100 / itemsPerView;
        const translateX = -(currentIndex * itemWidth);
        
        grid.style.transform = `translateX(${translateX}%)`;
        grid.dataset.currentIndex = currentIndex;
        
        console.log('Fixed to:', {
            newIndex: currentIndex,
            newTransform: `translateX(${translateX}%)`
        });
        
        // Update arrows
        const next = document.querySelector('.next-arrow');
        const prev = document.querySelector('.prev-arrow');
        
        if (next) {
            next.style.opacity = '0.3';
            next.style.pointerEvents = 'none';
        }
        
        if (prev && currentIndex > 0) {
            prev.style.opacity = '1';
            prev.style.pointerEvents = 'auto';
        }
        
        // Re-init slider
        if (window.initTrendingSlider) {
            setTimeout(() => {
                const p = document.querySelector('.prev-arrow');
                const n = document.querySelector('.next-arrow');
                if (p) p.removeAttribute('data-initialized');
                if (n) n.removeAttribute('data-initialized');
                window.initTrendingSlider();
            }, 100);
        }
        
        return 'Slider fixed!';
    } else {
        return 'Slider position is already correct';
    }
})();
