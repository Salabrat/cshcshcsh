// Cleanup script to remove duplicate and misplaced edit buttons
(function() {
    'use strict';

    function cleanupEditButtons() {
        // Silent cleanup - no console spam
        let removedCount = 0;
        
        // ONLY remove edit buttons if NOT admin
        // Check both isAdminUser flag and adminToken
        const isAdmin = window.isAdminUser || localStorage.getItem('adminToken');
        
        if (!isAdmin) {
            const allEditButtons = document.querySelectorAll('.admin-edit-btn');
            allEditButtons.forEach(btn => {
                btn.remove();
                removedCount++;
            });
            return; // Exit early if not admin
        }
        
        // Remove duplicate edit buttons
        const allButtons = document.querySelectorAll('button.admin-edit-btn');
        
        allButtons.forEach(button => {
            // Check if this button is a duplicate or misplaced
            const parent = button.parentElement;
            
            // Remove if:
            // 1. Button is inside another button
            // 2. Button is next to another edit button
            // 3. Button contains only the pencil emoji
            // 4. Parent already has another edit button
            if (parent) {
                const otherEditButtons = parent.querySelectorAll('.admin-edit-btn');
                if (otherEditButtons.length > 1) {
                    // Keep only the first one
                    for (let i = 1; i < otherEditButtons.length; i++) {
                        otherEditButtons[i].remove();
                        removedCount++;
                    }
                }
                
                // Remove buttons that are children of other buttons
                if (parent.tagName === 'BUTTON') {
                    button.remove();
                    removedCount++;
                }
                
                // Remove buttons attached to SVG elements
                if (parent.tagName === 'SVG' || parent.querySelector('svg')) {
                    button.remove();
                    removedCount++;
                }
            }
        });
        
        // Remove any edit buttons from text that shouldn't have them
        const elementsToClean = [
            'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon',
            '.search-submit', '.btn-newsletter', '.theme-toggle', 
            '.header-icon', '.mobile-menu-btn', '.slider-arrow'
        ];
        
        elementsToClean.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const editBtns = element.querySelectorAll('.admin-edit-btn');
                editBtns.forEach(btn => {
                    btn.remove();
                    removedCount++;
                });
            });
        });
        
        // Clean up any buttons that are just floating text nodes
        document.querySelectorAll('button').forEach(button => {
            if (button.textContent === '✏️' && !button.classList.contains('admin-edit-btn')) {
                button.remove();
                removedCount++;
            }
        });
        
        // Remove edit buttons from console elements (Windsurf specific)
        const consoleElements = document.querySelectorAll('[class*="console"], [id*="console"]');
        consoleElements.forEach(element => {
            const editBtns = element.querySelectorAll('.admin-edit-btn');
            editBtns.forEach(btn => {
                btn.remove();
                removedCount++;
            });
        });
        
        // Only log if we actually removed something
        if (removedCount > 0) {
            console.log(`Cleanup: Removed ${removedCount} duplicate/misplaced edit buttons.`);
        }
        
        // Also clean up any inline styles that show hidden buttons
        const hiddenButtons = document.querySelectorAll('.admin-edit-btn[style*="display: none"]');
        hiddenButtons.forEach(btn => {
            btn.style.display = 'none';
            btn.style.opacity = '0';
        });
    }
    
    // Run cleanup immediately
    cleanupEditButtons();
    
    // Run cleanup periodically but less frequently
    setTimeout(cleanupEditButtons, 2000);
    setInterval(cleanupEditButtons, 10000); // Every 10 seconds instead of multiple times
    
    // Export for manual use
    window.cleanupEditButtons = cleanupEditButtons;
})();
