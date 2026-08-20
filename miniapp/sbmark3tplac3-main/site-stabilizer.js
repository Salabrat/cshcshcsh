// Site stabilizer - fixes common issues and prevents errors
(function() {
    'use strict';
    
    console.log('🛡️ Site stabilizer activated');
    
    // 1. Prevent duplicate script execution
    if (window.siteStabilizerLoaded) {
        console.log('Site stabilizer already loaded, skipping...');
        return;
    }
    window.siteStabilizerLoaded = true;
    
    // 2. Error prevention wrapper
    function safeExecute(fn, context = window) {
        return function(...args) {
            try {
                return fn.apply(context, args);
            } catch (error) {
                console.error('Caught error in function:', fn.name || 'anonymous', error);
                return null;
            }
        };
    }
    
    // 3. Fix missing elements errors
    function ensureElement(selector, fallback = null) {
        const element = document.querySelector(selector);
        if (!element && fallback) {
            console.warn(`Element not found: ${selector}, using fallback`);
            return fallback;
        }
        return element;
    }
    
    // 4. Prevent admin scripts from running for non-admins
    function cleanupAdminElements() {
        // Check both isAdminUser flag and adminToken
        const isAdmin = window.isAdminUser || localStorage.getItem('adminToken');
        
        if (!isAdmin) {
            // Remove all edit buttons ONLY for non-admins
            document.querySelectorAll('.admin-edit-btn').forEach(btn => btn.remove());
            document.querySelectorAll('.admin-edit-btn-wrapper').forEach(wrapper => {
                const child = wrapper.firstElementChild;
                if (child && wrapper.parentNode) {
                    wrapper.parentNode.insertBefore(child, wrapper);
                    wrapper.remove();
                }
            });
        }
    }
    
    // 5. Fix console.log spam
    const originalLog = console.log;
    let logCount = 0;
    console.log = function(...args) {
        logCount++;
        if (logCount < 100) { // Limit console logs to prevent spam
            originalLog.apply(console, args);
        }
    };
    
    // Reset log count every minute
    setInterval(() => { logCount = 0; }, 60000);
    
    // 6. Ensure critical functions exist
    window.safeCall = function(obj, method, ...args) {
        if (obj && typeof obj[method] === 'function') {
            return obj[method](...args);
        }
        return null;
    };
    
    // 7. Fix trending slider issues
    function fixTrendingSlider() {
        const grid = document.querySelector('.trending-grid');
        const prevArrow = document.querySelector('.prev-arrow');
        const nextArrow = document.querySelector('.next-arrow');
        
        if (grid && prevArrow && nextArrow) {
            // Ensure arrows are properly initialized
            if (!prevArrow.hasAttribute('data-initialized')) {
                prevArrow.setAttribute('data-initialized', 'true');
                nextArrow.setAttribute('data-initialized', 'true');
            }
        }
    }
    
    // 8. Prevent multiple modal instances
    function preventDuplicateModals() {
        const existingModals = document.querySelectorAll('#product-modal');
        if (existingModals.length > 1) {
            for (let i = 1; i < existingModals.length; i++) {
                existingModals[i].remove();
            }
        }
    }
    
    // 9. Clean up orphaned event listeners
    function cleanupEventListeners() {
        // Remove duplicate click handlers on product cards
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(card => {
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
        });
    }
    
    // 10. Initialize stabilization
    function stabilize() {
        cleanupAdminElements();
        fixTrendingSlider();
        preventDuplicateModals();
        
        // Run periodic cleanup
        setInterval(() => {
            cleanupAdminElements();
            preventDuplicateModals();
        }, 5000);
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', stabilize);
    } else {
        setTimeout(stabilize, 100);
    }
    
    // Export utilities
    window.siteStabilizer = {
        safeExecute,
        ensureElement,
        cleanupAdminElements,
        fixTrendingSlider,
        stabilize
    };
    
    console.log('✅ Site stabilizer ready');
})();
