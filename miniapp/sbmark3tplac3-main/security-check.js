// Security check - ensure non-admins don't have admin features
(function() {
    'use strict';

    async function performSecurityCheck() {
        const token = localStorage.getItem('adminToken');
        
        // If no token, ensure no admin features
        if (!token) {
            cleanupAdminFeatures();
            return;
        }

        // Verify token with server
        try {
            const response = await fetch('/api/check-admin', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            const data = await response.json();
            
            if (!data.isAdmin) {
                // Token is invalid or expired
                console.log('Invalid admin token detected, cleaning up...');
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminLoggedIn');
                cleanupAdminFeatures();
            }
        } catch (error) {
            console.error('Security check failed:', error);
            // On error, be safe and remove admin features
            cleanupAdminFeatures();
        }
    }

    function cleanupAdminFeatures() {
        // Set admin flag to false
        window.isAdminUser = false;
        
        // Remove any edit buttons
        const editButtons = document.querySelectorAll('button[title="Редактировать текст кнопки"]');
        editButtons.forEach(btn => btn.remove());
        
        // Remove any admin UI elements
        const adminElements = document.querySelectorAll('.admin-only, .edit-mode, .admin-panel');
        adminElements.forEach(el => el.remove());
        
        // Clear any admin-related localStorage items
        const keysToRemove = ['adminLoggedIn', 'editMode', 'adminMode'];
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Run security check on page load
    performSecurityCheck();

    // Run periodic security checks
    setInterval(performSecurityCheck, 30000); // Every 30 seconds

    // Check when page becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            performSecurityCheck();
        }
    });

    // Export for debugging
    window.securityCheck = {
        performCheck: performSecurityCheck,
        cleanup: cleanupAdminFeatures
    };
})();
