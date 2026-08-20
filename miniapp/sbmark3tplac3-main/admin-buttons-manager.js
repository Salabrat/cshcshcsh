// Admin buttons manager - ensures admin buttons work properly
(function() {
    'use strict';
    
    // Wait for admin status to be determined
    function waitForAdminStatus(callback) {
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds max
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            // Check if admin status is determined
            if (window.isAdminUser !== undefined) {
                clearInterval(checkInterval);
                callback(window.isAdminUser);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                // Default to checking token
                const hasToken = localStorage.getItem('adminToken');
                callback(!!hasToken);
            }
        }, 500);
    }
    
    // Manage admin buttons based on user status
    function manageAdminButtons(isAdmin) {
        console.log('Managing admin buttons. Is admin:', isAdmin);
        
        if (isAdmin) {
            // Admin user - ensure buttons are visible
            ensureAdminButtonsVisible();
            
            // Re-initialize admin editors if needed
            reinitializeAdminEditors();
        } else {
            // Non-admin user - remove all admin buttons
            removeAllAdminButtons();
        }
    }
    
    // Ensure admin buttons are visible
    function ensureAdminButtonsVisible() {
        // Check all types of edit buttons
        const editButtons = document.querySelectorAll('.admin-edit-btn, .text-edit-btn, .admin-text-btn');
        editButtons.forEach(btn => {
            // Make sure buttons are visible
            btn.style.display = 'flex';
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.style.visibility = 'visible';
        });
        
        console.log(`Ensured ${editButtons.length} admin buttons are visible`);
    }
    
    // Re-initialize admin editors if they're not working
    function reinitializeAdminEditors() {
        // Check if button editor exists and initialize it
        if (window.adminButtonEditor && typeof window.adminButtonEditor.init === 'function') {
            console.log('Re-initializing button editor...');
            window.adminButtonEditor.init();
        }
        
        // Check if homepage text editor exists
        if (window.homepageTextEditor && typeof window.homepageTextEditor.init === 'function') {
            console.log('Re-initializing homepage text editor...');
            window.homepageTextEditor.init();
        }
        
        // Check if image editor exists
        if (window.homepageImageEditor && typeof window.homepageImageEditor.init === 'function') {
            console.log('Re-initializing homepage image editor...');
            window.homepageImageEditor.init();
        }
    }
    
    // Remove all admin buttons for non-admins
    function removeAllAdminButtons() {
        // Remove all types of edit buttons
        const editButtons = document.querySelectorAll('.admin-edit-btn, .text-edit-btn, .admin-text-btn');
        editButtons.forEach(btn => btn.remove());
        
        // Remove wrappers
        const wrappers = document.querySelectorAll('.admin-edit-btn-wrapper, .text-edit-wrapper');
        wrappers.forEach(wrapper => {
            const child = wrapper.firstElementChild;
            if (child && wrapper.parentNode) {
                wrapper.parentNode.insertBefore(child, wrapper);
                wrapper.remove();
            }
        });
        
        console.log('Removed admin buttons for non-admin user');
    }
    
    // Initialize
    waitForAdminStatus(manageAdminButtons);
    
    // Export for debugging
    window.adminButtonsManager = {
        manageAdminButtons,
        ensureAdminButtonsVisible,
        reinitializeAdminEditors,
        removeAllAdminButtons
    };
})();
