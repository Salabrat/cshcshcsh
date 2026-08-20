// Disable the enhanced text editor to prevent duplicate edit buttons
(function() {
    'use strict';
    
    // Override the enhanced editor initialization
    if (window.adminEnhancedEditor) {
        window.adminEnhancedEditor.init = function() {
            console.log('Enhanced text editor disabled to prevent duplicate buttons');
        };
        window.adminEnhancedEditor.refresh = function() {
            console.log('Enhanced text editor refresh disabled');
        };
    }
    
    // Remove any existing admin-edit-btn elements that shouldn't be there
    function removeUnwantedEditButtons() {
        // Only clean up if NOT admin
        const isAdmin = window.isAdminUser || localStorage.getItem('adminToken');
        if (isAdmin) {
            return; // Don't remove buttons for admins
        }
        
        // Get all edit buttons
        const allEditButtons = document.querySelectorAll('.admin-edit-btn');
        
        allEditButtons.forEach(button => {
            // Check if this button is attached to a proper data-text-id button
            const parent = button.closest('[data-text-id]');
            
            // If not attached to a proper button, remove it
            if (!parent) {
                button.remove();
            }
        });
        
        // Also remove edit buttons from specific elements
        const problematicSelectors = [
            'svg', 'path', 'g', 
            '.console', '[id*="console"]',
            '.windsurf', '[class*="windsurf"]'
        ];
        
        problematicSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const editBtns = element.querySelectorAll('.admin-edit-btn');
                editBtns.forEach(btn => btn.remove());
            });
        });
    }
    
    // Run cleanup immediately
    removeUnwantedEditButtons();
    
    // Run periodically to catch any new buttons
    setInterval(removeUnwantedEditButtons, 2000);
    
    // Export for debugging
    window.disableEnhancedEditor = {
        cleanup: removeUnwantedEditButtons
    };
})();
