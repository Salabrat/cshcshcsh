// FORCE ARROW FIX - Aggressive solution to ensure prev arrow always works
// This will run continuously and override any other scripts

(function() {
    'use strict';
    
    console.log('🚨 FORCE ARROW FIX LOADING - This will ensure arrows ALWAYS work correctly');
    
    // Global state
    let fixInterval = null;
    let lastKnownIndex = 0;
    
    // Force fix arrows function
    function forceFixArrows() {
        const grid = document.querySelector('.trending-grid');
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        const items = document.querySelectorAll('.trending-item');
        
        if (!grid || !prevArrow || !nextArrow || !items.length) {
            return;
        }
        
        // Get current state
        const vw = window.innerWidth;
        const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
        const maxIndex = Math.max(0, items.length - itemsPerView);
        const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        
        // Store last known index
        lastKnownIndex = currentIndex;
        
        // FORCE CORRECT ARROW STATES
        // Prev Arrow - Should ONLY be disabled at index 0
        if (currentIndex <= 0) {
            // At first position - disable prev
            if (prevArrow.style.pointerEvents !== 'none' || !prevArrow.disabled) {
                prevArrow.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
                prevArrow.disabled = true;
                prevArrow.setAttribute('aria-disabled', 'true');
                console.log('Disabled prev arrow at index 0');
            }
        } else {
            // NOT at first position - MUST enable prev
            if (prevArrow.style.pointerEvents === 'none' || prevArrow.disabled) {
                prevArrow.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
                prevArrow.disabled = false;
                prevArrow.setAttribute('aria-disabled', 'false');
                console.log('✅ FIXED: Enabled prev arrow at index', currentIndex);
            }
        }
        
        // Next Arrow - Should ONLY be disabled at max index
        if (currentIndex >= maxIndex) {
            // At last position - disable next
            if (nextArrow.style.pointerEvents !== 'none' || !nextArrow.disabled) {
                nextArrow.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
                nextArrow.disabled = true;
                nextArrow.setAttribute('aria-disabled', 'true');
                console.log('Disabled next arrow at max index', maxIndex);
            }
        } else {
            // NOT at last position - enable next
            if (nextArrow.style.pointerEvents === 'none' || nextArrow.disabled) {
                nextArrow.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
                nextArrow.disabled = false;
                nextArrow.setAttribute('aria-disabled', 'false');
                console.log('Enabled next arrow at index', currentIndex);
            }
        }
    }
    
    // Override click handlers to ensure they work
    function overrideClickHandlers() {
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        const grid = document.querySelector('.trending-grid');
        
        if (!prevArrow || !nextArrow || !grid) return;
        
        // Store original onclick handlers
        const originalPrevClick = prevArrow.onclick;
        const originalNextClick = nextArrow.onclick;
        
        // Override with our wrapper that ensures proper behavior
        prevArrow.onclick = function(e) {
            const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
            console.log('Prev clicked, current index:', currentIndex);
            
            if (currentIndex > 0) {
                // Allow the click
                if (originalPrevClick) originalPrevClick.call(this, e);
                // Force fix arrows after a short delay
                setTimeout(forceFixArrows, 50);
            } else {
                e.preventDefault();
                e.stopPropagation();
                console.log('Prevented prev click at index 0');
            }
        };
        
        nextArrow.onclick = function(e) {
            const items = document.querySelectorAll('.trending-item');
            const vw = window.innerWidth;
            const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
            const maxIndex = Math.max(0, items.length - itemsPerView);
            const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
            
            console.log('Next clicked, current:', currentIndex, 'max:', maxIndex);
            
            if (currentIndex < maxIndex) {
                // Allow the click
                if (originalNextClick) originalNextClick.call(this, e);
                // Force fix arrows after a short delay
                setTimeout(forceFixArrows, 50);
            } else {
                e.preventDefault();
                e.stopPropagation();
                console.log('Prevented next click at max index');
            }
        };
    }
    
    // Add keyboard navigation support
    function addKeyboardSupport() {
        document.addEventListener('keydown', function(e) {
            const grid = document.querySelector('.trending-grid');
            const prevArrow = document.querySelector('.prev-arrow');
            const nextArrow = document.querySelector('.next-arrow');
            
            if (!grid || !prevArrow || !nextArrow) return;
            
            // Left arrow key
            if (e.key === 'ArrowLeft' && !prevArrow.disabled) {
                prevArrow.click();
            }
            
            // Right arrow key
            if (e.key === 'ArrowRight' && !nextArrow.disabled) {
                nextArrow.click();
            }
        });
    }
    
    // Main initialization
    function initialize() {
        console.log('🔥 Initializing Force Arrow Fix...');
        
        // Initial fix
        forceFixArrows();
        
        // Override click handlers
        overrideClickHandlers();
        
        // Add keyboard support
        addKeyboardSupport();
        
        // Start continuous monitoring (every 100ms)
        if (fixInterval) clearInterval(fixInterval);
        fixInterval = setInterval(forceFixArrows, 100);
        
        // Also fix on any DOM changes
        const observer = new MutationObserver(() => {
            forceFixArrows();
            overrideClickHandlers(); // Re-override in case elements were replaced
        });
        
        const container = document.querySelector('.trending-slider');
        if (container) {
            observer.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'disabled', 'data-current-index']
            });
        }
        
        console.log('✅ Force Arrow Fix is now active and monitoring');
    }
    
    // Debug function
    window.debugSliderArrows = function() {
        const grid = document.querySelector('.trending-grid');
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        const items = document.querySelectorAll('.trending-item');
        
        const vw = window.innerWidth;
        const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
        const maxIndex = Math.max(0, items.length - itemsPerView);
        const currentIndex = parseInt(grid?.dataset.currentIndex) || 0;
        
        console.log('=== SLIDER DEBUG INFO ===');
        console.log('Current Index:', currentIndex);
        console.log('Max Index:', maxIndex);
        console.log('Items:', items.length);
        console.log('Items Per View:', itemsPerView);
        console.log('Prev Arrow:', {
            disabled: prevArrow?.disabled,
            pointerEvents: prevArrow?.style.pointerEvents,
            opacity: prevArrow?.style.opacity
        });
        console.log('Next Arrow:', {
            disabled: nextArrow?.disabled,
            pointerEvents: nextArrow?.style.pointerEvents,
            opacity: nextArrow?.style.opacity
        });
        console.log('========================');
    };
    
    // Force enable prev arrow (emergency function)
    window.forceEnablePrev = function() {
        const prevArrow = document.querySelector('.prev-arrow');
        if (prevArrow) {
            prevArrow.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
            prevArrow.disabled = false;
            prevArrow.removeAttribute('disabled');
            prevArrow.setAttribute('aria-disabled', 'false');
            
            console.log('🔥 FORCED prev arrow to be enabled');
        }
    };
    
    // Start everything
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Also reinitialize after delays to catch late-loading content
    setTimeout(initialize, 500);
    setTimeout(initialize, 1000);
    setTimeout(initialize, 2000);
    
    // Expose stop function if needed
    window.stopForceArrowFix = function() {
        if (fixInterval) {
            clearInterval(fixInterval);
            console.log('Force Arrow Fix stopped');
        }
    };
    
    console.log('💪 Force Arrow Fix loaded. Use window.debugSliderArrows() to debug or window.forceEnablePrev() to force enable prev arrow');
})();
