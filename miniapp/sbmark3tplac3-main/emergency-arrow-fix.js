// EMERGENCY FIX - Disable next arrow at max position
// This runs immediately and continuously monitors the slider

(function() {
    'use strict';
    
    console.log('🚨 EMERGENCY ARROW FIX ACTIVATED');
    
    // Shared click blocker to prevent navigation past the end
    function blockNextClick(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('❌ Next arrow click blocked - already at last position');
        return false;
    }
    
    function disableNextArrowIfNeeded() {
        const grid = document.querySelector('.trending-grid');
        const nextArrow = document.querySelector('.next-arrow');
        const prevArrow = document.querySelector('.prev-arrow');
        
        if (!grid || !nextArrow) return;
        
        // Count actual items
        const items = document.querySelectorAll('.trending-item');
        const itemCount = items.length;
        
        // Determine items per view
        const vw = window.innerWidth;
        const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
        
        // Calculate true maximum index
        const maxIndex = Math.max(0, itemCount - itemsPerView);
        
        // Get current index
        const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        
        console.log('Arrow check:', {
            currentIndex,
            maxIndex,
            itemCount,
            itemsPerView,
            isAtMax: currentIndex >= maxIndex
        });
        
        // FORCE DISABLE NEXT ARROW IF AT MAX
        if (currentIndex >= maxIndex) {
            console.log('🛑 Disabling next arrow - at maximum position');
            
            // Multiple methods to ensure it's disabled
            nextArrow.style.opacity = '0.3';
            nextArrow.style.pointerEvents = 'none';
            nextArrow.style.cursor = 'not-allowed';
            nextArrow.setAttribute('disabled', 'true');
            nextArrow.classList.add('disabled');
            
            if (nextArrow.dataset.emergencyDisabled !== 'true') {
                nextArrow.addEventListener('click', blockNextClick, true);
                nextArrow.dataset.emergencyDisabled = 'true';
            }
        } else {
            // Enable next arrow if not at max
            nextArrow.style.opacity = '1';
            nextArrow.style.pointerEvents = 'auto';
            nextArrow.style.cursor = 'pointer';
            nextArrow.removeAttribute('disabled');
            nextArrow.classList.remove('disabled');
            
            if (nextArrow.dataset.emergencyDisabled === 'true') {
                nextArrow.removeEventListener('click', blockNextClick, true);
                delete nextArrow.dataset.emergencyDisabled;
            }
        }
        
        // Handle prev arrow
        if (prevArrow) {
            if (currentIndex === 0) {
                prevArrow.style.opacity = '0.3';
                prevArrow.style.pointerEvents = 'none';
                prevArrow.style.cursor = 'not-allowed';
            } else {
                prevArrow.style.opacity = '1';
                prevArrow.style.pointerEvents = 'auto';
                prevArrow.style.cursor = 'pointer';
            }
        }
    }
    
    // Run immediately
    disableNextArrowIfNeeded();
    
    // Run on various events
    document.addEventListener('DOMContentLoaded', disableNextArrowIfNeeded);
    window.addEventListener('load', disableNextArrowIfNeeded);
    
    // Run multiple times with delays
    const delays = [0, 50, 100, 200, 500, 1000, 1500, 2000, 3000];
    delays.forEach(delay => {
        setTimeout(disableNextArrowIfNeeded, delay);
    });
    
    // Monitor for any changes to the grid
    setTimeout(() => {
        const grid = document.querySelector('.trending-grid');
        if (grid) {
            const observer = new MutationObserver(() => {
                disableNextArrowIfNeeded();
            });
            
            observer.observe(grid, {
                attributes: true,
                attributeFilter: ['data-current-index', 'style'],
                subtree: false
            });
            
            // Also observe the parent for any slider reinitializations
            if (grid.parentElement) {
                observer.observe(grid.parentElement, {
                    childList: true,
                    subtree: true
                });
            }
        }
    }, 500);
    
    // Override any attempts to enable the next arrow when at max
    setInterval(() => {
        const grid = document.querySelector('.trending-grid');
        const nextArrow = document.querySelector('.next-arrow');
        
        if (grid && nextArrow) {
            const items = document.querySelectorAll('.trending-item');
            const vw = window.innerWidth;
            const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
            const maxIndex = Math.max(0, items.length - itemsPerView);
            const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
            
            if (currentIndex >= maxIndex && nextArrow.style.opacity !== '0.3') {
                console.log('⚠️ Next arrow was re-enabled incorrectly, fixing...');
                nextArrow.style.opacity = '0.3';
                nextArrow.style.pointerEvents = 'none';
                nextArrow.style.cursor = 'not-allowed';
            }
        }
    }, 1000);
    
    // Global function for manual fix
    window.fixArrows = disableNextArrowIfNeeded;
    
    console.log('✅ Emergency arrow fix ready. Use window.fixArrows() to manually fix.');
})();
