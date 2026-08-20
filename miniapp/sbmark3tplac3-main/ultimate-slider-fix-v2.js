// ULTIMATE SLIDER FIX V2 - Complete rewrite to ensure arrows always work
// This completely replaces the slider logic with a bulletproof implementation

(function() {
    'use strict';
    
    console.log('🔧 ULTIMATE SLIDER FIX V2 LOADING...');
    
    let sliderState = {
        currentIndex: 0,
        maxIndex: 0,
        itemsPerView: 4,
        totalItems: 0,
        isInitialized: false
    };
    
    // Calculate items per view based on viewport
    function getItemsPerView() {
        const vw = window.innerWidth;
        if (vw > 768) return 4;
        if (vw > 480) return 2;
        return 1;
    }
    
    // Update slider position and arrow states
    function updateSlider() {
        const grid = document.querySelector('.trending-grid');
        const nextArrow = document.querySelector('.next-arrow');
        const prevArrow = document.querySelector('.prev-arrow');
        
        if (!grid || !nextArrow || !prevArrow) {
            console.error('Slider elements not found');
            return;
        }
        
        // Calculate transform
        const itemWidth = 100 / sliderState.itemsPerView;
        const translateX = -(sliderState.currentIndex * itemWidth);
        
        // Apply transform
        grid.style.transform = `translateX(${translateX}%)`;
        grid.dataset.currentIndex = sliderState.currentIndex.toString();
        
        // Update arrow states - CRITICAL: Always update both arrows
        // Prev arrow
        if (sliderState.currentIndex <= 0) {
            prevArrow.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
            prevArrow.disabled = true;
            prevArrow.setAttribute('aria-disabled', 'true');
        } else {
            prevArrow.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
            prevArrow.disabled = false;
            prevArrow.setAttribute('aria-disabled', 'false');
        }
        
        // Next arrow
        if (sliderState.currentIndex >= sliderState.maxIndex) {
            nextArrow.style.cssText = 'opacity: 0.3 !important; pointer-events: none !important; cursor: default !important;';
            nextArrow.disabled = true;
            nextArrow.setAttribute('aria-disabled', 'true');
        } else {
            nextArrow.style.cssText = 'opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important;';
            nextArrow.disabled = false;
            nextArrow.setAttribute('aria-disabled', 'false');
        }
        
        console.log('Slider updated:', {
            currentIndex: sliderState.currentIndex,
            maxIndex: sliderState.maxIndex,
            prevDisabled: prevArrow.disabled,
            nextDisabled: nextArrow.disabled
        });
    }
    
    // Handle next button click
    function handleNext(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log('Next clicked. Current:', sliderState.currentIndex, 'Max:', sliderState.maxIndex);
        
        if (sliderState.currentIndex < sliderState.maxIndex) {
            sliderState.currentIndex++;
            updateSlider();
        } else {
            console.log('Already at maximum position');
            // Ensure the arrow states are correct even if at max
            updateSlider();
        }
    }
    
    // Handle prev button click
    function handlePrev(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log('Prev clicked. Current:', sliderState.currentIndex);
        
        if (sliderState.currentIndex > 0) {
            sliderState.currentIndex--;
            updateSlider();
        } else {
            console.log('Already at minimum position');
            // Ensure the arrow states are correct even if at min
            updateSlider();
        }
    }
    
    // Initialize or reinitialize the slider
    function initializeSlider() {
        console.log('Initializing Ultimate Slider Fix V2...');
        
        const grid = document.querySelector('.trending-grid');
        const nextArrow = document.querySelector('.next-arrow');
        const prevArrow = document.querySelector('.prev-arrow');
        const items = document.querySelectorAll('.trending-item');
        
        if (!grid || !nextArrow || !prevArrow) {
            console.error('Required slider elements not found');
            setTimeout(initializeSlider, 500); // Try again
            return;
        }
        
        // Update state
        sliderState.totalItems = items.length;
        sliderState.itemsPerView = getItemsPerView();
        sliderState.maxIndex = Math.max(0, sliderState.totalItems - sliderState.itemsPerView);
        
        // Get current index from grid or reset if invalid
        let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        if (currentIndex < 0 || currentIndex > sliderState.maxIndex) {
            currentIndex = Math.min(Math.max(0, currentIndex), sliderState.maxIndex);
        }
        sliderState.currentIndex = currentIndex;
        
        console.log('Slider state initialized:', sliderState);
        
        // Remove ALL existing event listeners by cloning
        const newNext = nextArrow.cloneNode(true);
        const newPrev = prevArrow.cloneNode(true);
        
        // Replace arrows
        nextArrow.parentNode.replaceChild(newNext, nextArrow);
        prevArrow.parentNode.replaceChild(newPrev, prevArrow);
        
        // Add new event listeners
        newNext.addEventListener('click', handleNext, { capture: true });
        newPrev.addEventListener('click', handlePrev, { capture: true });
        
        // Also add backup listeners
        newNext.onclick = handleNext;
        newPrev.onclick = handlePrev;
        
        // Mark as initialized
        sliderState.isInitialized = true;
        
        // Apply initial state
        updateSlider();
        
        // Double-check arrow states after a short delay
        setTimeout(updateSlider, 100);
    }
    
    // Fix slider position if it's out of bounds
    function fixSliderPosition() {
        const grid = document.querySelector('.trending-grid');
        const items = document.querySelectorAll('.trending-item');
        
        if (!grid || !items.length) return;
        
        sliderState.totalItems = items.length;
        sliderState.itemsPerView = getItemsPerView();
        sliderState.maxIndex = Math.max(0, sliderState.totalItems - sliderState.itemsPerView);
        
        // Check if current position is valid
        let currentIndex = parseInt(grid.dataset.currentIndex) || 0;
        
        if (currentIndex > sliderState.maxIndex) {
            console.log('🔧 Fixing out of bounds slider position');
            sliderState.currentIndex = sliderState.maxIndex;
            updateSlider();
        } else if (currentIndex < 0) {
            console.log('🔧 Fixing negative slider position');
            sliderState.currentIndex = 0;
            updateSlider();
        } else {
            sliderState.currentIndex = currentIndex;
            // Still update to ensure arrow states are correct
            updateSlider();
        }
    }
    
    // Monitor for dynamic changes
    function setupObserver() {
        const grid = document.querySelector('.trending-grid');
        if (!grid) {
            setTimeout(setupObserver, 500);
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            
            for (let mutation of mutations) {
                // Check if items were added/removed
                if (mutation.type === 'childList' && mutation.target === grid) {
                    needsUpdate = true;
                    break;
                }
                // Check if transform was changed externally
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const currentTransform = grid.style.transform;
                    const expectedTransform = `translateX(${-(sliderState.currentIndex * (100 / sliderState.itemsPerView))}%)`;
                    if (currentTransform !== expectedTransform && sliderState.isInitialized) {
                        console.log('Transform mismatch detected, fixing...');
                        needsUpdate = true;
                        break;
                    }
                }
            }
            
            if (needsUpdate) {
                console.log('Slider change detected, updating...');
                fixSliderPosition();
            }
        });
        
        observer.observe(grid, {
            attributes: true,
            attributeFilter: ['style', 'data-current-index'],
            childList: true,
            subtree: false
        });
    }
    
    // Handle window resize
    function handleResize() {
        const newItemsPerView = getItemsPerView();
        if (newItemsPerView !== sliderState.itemsPerView) {
            console.log('Viewport changed, reinitializing slider...');
            initializeSlider();
        }
    }
    
    // Emergency fix function that can be called manually
    window.emergencySliderFix = function() {
        console.log('🚨 Emergency slider fix triggered');
        sliderState.isInitialized = false;
        initializeSlider();
        setTimeout(() => {
            fixSliderPosition();
        }, 100);
    };
    
    // Main initialization
    function init() {
        console.log('====== ULTIMATE SLIDER FIX V2 STARTING ======');
        
        // Initial setup
        initializeSlider();
        
        // Setup monitoring
        setupObserver();
        
        // Handle resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(handleResize, 250);
        });
        
        // Periodic check to ensure slider is working
        setInterval(() => {
            const nextArrow = document.querySelector('.next-arrow');
            const prevArrow = document.querySelector('.prev-arrow');
            
            if (!nextArrow || !prevArrow) {
                console.log('Arrows missing, reinitializing...');
                initializeSlider();
                return;
            }
            
            // Check if arrows have correct state
            const shouldPrevBeDisabled = sliderState.currentIndex <= 0;
            const shouldNextBeDisabled = sliderState.currentIndex >= sliderState.maxIndex;
            
            const isPrevDisabled = prevArrow.disabled || prevArrow.style.pointerEvents === 'none';
            const isNextDisabled = nextArrow.disabled || nextArrow.style.pointerEvents === 'none';
            
            if (shouldPrevBeDisabled !== isPrevDisabled || shouldNextBeDisabled !== isNextDisabled) {
                console.log('Arrow states incorrect, fixing...');
                updateSlider();
            }
        }, 1000);
        
        console.log('====== ULTIMATE SLIDER FIX V2 READY ======');
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also run after window load
    window.addEventListener('load', () => {
        setTimeout(init, 100);
    });
    
    // Expose functions globally
    window.ultimateSliderFix = {
        init: init,
        updateSlider: updateSlider,
        fixPosition: fixSliderPosition,
        getState: () => sliderState,
        goNext: handleNext,
        goPrev: handlePrev
    };
    
    console.log('✅ Ultimate Slider Fix V2 loaded. Use window.emergencySliderFix() if needed.');
})();
