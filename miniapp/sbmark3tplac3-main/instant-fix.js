// INSTANT FIX - Copy and paste this into browser console RIGHT NOW

(function() {
    const grid = document.querySelector('.trending-grid');
    const items = document.querySelectorAll('.trending-item');
    
    // For desktop: 4 items per view
    const itemsPerView = 4;
    const totalItems = items.length;
    
    // Maximum index for 10 items = 6 (shows items 7,8,9,10)
    const maxIndex = Math.max(0, totalItems - itemsPerView);
    
    // Current broken index is 6, which is actually valid for 10 items
    // But let's check if we actually have 10 items
    console.log('Total items:', totalItems);
    console.log('Max valid index:', maxIndex);
    console.log('Current index:', grid.dataset.currentIndex);
    
    // If current index is too high, fix it
    let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
    
    if (totalItems <= 10 && currentIndex > maxIndex) {
        // We have less than 10 items but slider thinks there are more
        currentIndex = maxIndex;
        const translateX = -(currentIndex * 25); // 25% per item for 4 items view
        
        grid.style.transform = `translateX(${translateX}%)`;
        grid.dataset.currentIndex = currentIndex.toString();
        
        // Disable next arrow
        const next = document.querySelector('.next-arrow');
        if (next) {
            next.style.opacity = '0.3';
            next.style.pointerEvents = 'none';
            next.style.cursor = 'default';
        }
        
        console.log('✅ FIXED! Moved to index', currentIndex);
    } else if (currentIndex === 6 && totalItems === 10) {
        // This is actually correct! Index 6 shows items 7,8,9,10
        console.log('✅ Position is correct for 10 items');
        
        // Just make sure the transform is right
        grid.style.transform = 'translateX(-150%)';
        
        // And disable the next arrow
        const next = document.querySelector('.next-arrow');
        if (next) {
            next.style.opacity = '0.3';
            next.style.pointerEvents = 'none';
            next.style.cursor = 'default';
        }
    } else {
        console.log('❓ Unexpected state. Resetting to start...');
        grid.style.transform = 'translateX(0)';
        grid.dataset.currentIndex = '0';
    }
    
    return 'Slider fixed!';
})();
