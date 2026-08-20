// ULTIMATE ARROW OVERRIDE - Complete replacement of arrow logic
// This script COMPLETELY takes over arrow functionality

(function() {
    'use strict';
    
    console.log('🔴 ULTIMATE ARROW OVERRIDE - Taking complete control of arrows');
    
    // Wait for DOM to be ready
    function waitForElements(callback) {
        const check = setInterval(() => {
            const grid = document.querySelector('.trending-grid');
            const prevArrow = document.querySelector('.prev-arrow');
            const nextArrow = document.querySelector('.next-arrow');
            
            if (grid && prevArrow && nextArrow) {
                clearInterval(check);
                callback(grid, prevArrow, nextArrow);
            }
        }, 50);
    }
    
    // Main override function
    function overrideArrows(grid, prevArrow, nextArrow) {
        console.log('Taking control of slider arrows...');
        
        // Remove ALL existing event listeners by cloning
        const newPrev = prevArrow.cloneNode(true);
        const newNext = nextArrow.cloneNode(true);
        
        prevArrow.parentNode.replaceChild(newPrev, prevArrow);
        nextArrow.parentNode.replaceChild(newNext, nextArrow);
        
        // Calculate slider parameters
        function getSliderParams() {
            const items = document.querySelectorAll('.trending-item');
            const vw = window.innerWidth;
            const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
            const maxIndex = Math.max(0, items.length - itemsPerView);
            const currentIndex = parseInt(grid.dataset.currentIndex) || 0;
            
            return {
                items: items.length,
                itemsPerView,
                maxIndex,
                currentIndex
            };
        }
        
        // Move slider to specific index
        function moveToIndex(index) {
            const params = getSliderParams();
            
            // Clamp index to valid range
            index = Math.max(0, Math.min(index, params.maxIndex));
            
            // Calculate transform
            const itemWidth = 100 / params.itemsPerView;
            const translateX = -(index * itemWidth);
            
            // Apply transform
            grid.style.transition = 'transform 0.3s ease';
            grid.style.transform = `translateX(${translateX}%)`;
            grid.dataset.currentIndex = index.toString();
            
            console.log(`Moved to index ${index} (transform: ${translateX}%)`);
            
            // Update arrow states
            updateArrowStates(index, params.maxIndex);
            
            return index;
        }
        
        // Update arrow visual states
        function updateArrowStates(currentIndex, maxIndex) {
            // Prev arrow
            if (currentIndex <= 0) {
                newPrev.style.opacity = '0.3';
                newPrev.style.pointerEvents = 'none';
                newPrev.style.cursor = 'default';
                newPrev.disabled = true;
            } else {
                newPrev.style.opacity = '1';
                newPrev.style.pointerEvents = 'auto';
                newPrev.style.cursor = 'pointer';
                newPrev.disabled = false;
            }
            
            // Next arrow
            if (currentIndex >= maxIndex) {
                newNext.style.opacity = '0.3';
                newNext.style.pointerEvents = 'none';
                newNext.style.cursor = 'default';
                newNext.disabled = true;
            } else {
                newNext.style.opacity = '1';
                newNext.style.pointerEvents = 'auto';
                newNext.style.cursor = 'pointer';
                newNext.disabled = false;
            }
            
            console.log(`Arrow states updated - Prev: ${!newPrev.disabled}, Next: ${!newNext.disabled}`);
        }
        
        // NEW EVENT HANDLERS
        
        // Previous button handler
        newPrev.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const params = getSliderParams();
            
            if (params.currentIndex > 0) {
                const newIndex = moveToIndex(params.currentIndex - 1);
                console.log(`✅ Moved PREV from ${params.currentIndex} to ${newIndex}`);
            } else {
                console.log('Already at first position');
            }
        }, true);
        
        // Next button handler  
        newNext.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const params = getSliderParams();
            
            if (params.currentIndex < params.maxIndex) {
                const newIndex = moveToIndex(params.currentIndex + 1);
                console.log(`✅ Moved NEXT from ${params.currentIndex} to ${newIndex}`);
            } else {
                console.log('Already at last position');
            }
        }, true);
        
        // Also add as direct onclick handlers
        newPrev.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const params = getSliderParams();
            if (params.currentIndex > 0) {
                moveToIndex(params.currentIndex - 1);
            }
            return false;
        };
        
        newNext.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const params = getSliderParams();
            if (params.currentIndex < params.maxIndex) {
                moveToIndex(params.currentIndex + 1);
            }
            return false;
        };
        
        // Initial state update
        const initialParams = getSliderParams();
        updateArrowStates(initialParams.currentIndex, initialParams.maxIndex);
        
        // Monitor for external changes
        let lastIndex = initialParams.currentIndex;
        setInterval(() => {
            const params = getSliderParams();
            if (params.currentIndex !== lastIndex) {
                console.log(`External change detected: ${lastIndex} -> ${params.currentIndex}`);
                updateArrowStates(params.currentIndex, params.maxIndex);
                lastIndex = params.currentIndex;
            }
        }, 100);
        
        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft' && !newPrev.disabled) {
                newPrev.click();
            } else if (e.key === 'ArrowRight' && !newNext.disabled) {
                newNext.click();
            }
        });
        
        console.log('✅ ARROWS FULLY OVERRIDDEN - New handlers installed');
    }
    
    // Initialize
    function init() {
        console.log('Initializing Ultimate Arrow Override...');
        
        // Clear any existing intervals from other scripts
        for (let i = 0; i < 10000; i++) {
            clearInterval(i);
        }
        
        waitForElements(overrideArrows);
        
        // Re-override if elements change
        const observer = new MutationObserver(() => {
            const grid = document.querySelector('.trending-grid');
            const prevArrow = document.querySelector('.prev-arrow');
            const nextArrow = document.querySelector('.next-arrow');
            
            // Check if arrows need re-overriding
            if (grid && prevArrow && nextArrow && !prevArrow.hasAttribute('data-overridden')) {
                console.log('Arrows changed, re-overriding...');
                prevArrow.setAttribute('data-overridden', 'true');
                nextArrow.setAttribute('data-overridden', 'true');
                overrideArrows(grid, prevArrow, nextArrow);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Debug functions
    window.sliderDebug = function() {
        const grid = document.querySelector('.trending-grid');
        const items = document.querySelectorAll('.trending-item');
        const vw = window.innerWidth;
        const itemsPerView = vw > 768 ? 4 : vw > 480 ? 2 : 1;
        const maxIndex = Math.max(0, items.length - itemsPerView);
        const currentIndex = parseInt(grid?.dataset.currentIndex) || 0;
        
        console.log('=== SLIDER STATE ===');
        console.log('Current:', currentIndex);
        console.log('Max:', maxIndex);
        console.log('Items:', items.length);
        console.log('Per View:', itemsPerView);
        console.log('Transform:', grid?.style.transform);
        console.log('===================');
    };
    
    window.forcePrev = function() {
        const grid = document.querySelector('.trending-grid');
        const params = {
            items: document.querySelectorAll('.trending-item').length,
            itemsPerView: window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1,
            currentIndex: parseInt(grid?.dataset.currentIndex) || 0
        };
        params.maxIndex = Math.max(0, params.items - params.itemsPerView);
        
        if (params.currentIndex > 0) {
            const newIndex = params.currentIndex - 1;
            const itemWidth = 100 / params.itemsPerView;
            const translateX = -(newIndex * itemWidth);
            
            grid.style.transform = `translateX(${translateX}%)`;
            grid.dataset.currentIndex = newIndex.toString();
            
            console.log(`FORCED move to index ${newIndex}`);
        }
    };
    
    // Start immediately
    init();
    
    // Also start after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    }
    
    // And after window load
    window.addEventListener('load', () => setTimeout(init, 100));
    
    console.log('🎯 Ultimate Arrow Override ready. Use window.sliderDebug() or window.forcePrev()');
})();
