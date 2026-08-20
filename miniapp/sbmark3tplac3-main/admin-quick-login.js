// Quick Admin Login Script
// This script provides a quick way to login as admin for testing purposes

(function() {
    // Add keyboard shortcut for quick admin login (Ctrl+Shift+A)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            toggleAdminMode();
        }
    });

    function toggleAdminMode() {
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        
        if (isAdmin) {
            // Logout
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('username');
            showNotification('Admin mode disabled. Refresh the page to apply changes.', 'info');
        } else {
            // Login as admin
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('username', 'admin');
            showNotification('Admin mode enabled! Refresh the page to see edit buttons.', 'success');
        }
    }

    function showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existing = document.querySelector('.admin-quick-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'admin-quick-notification';
        notification.textContent = message;
        
        const colors = {
            success: '#4CAF50',
            info: '#2196F3',
            error: '#f44336'
        };
        
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 16px 24px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 10002;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            animation: slideUpNotification 0.3s ease;
        `;
        
        // Add animation style if not exists
        if (!document.querySelector('#admin-quick-styles')) {
            const style = document.createElement('style');
            style.id = 'admin-quick-styles';
            style.textContent = `
                @keyframes slideUpNotification {
                    from {
                        opacity: 0;
                        transform: translate(-50%, 20px);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, 0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideUpNotification 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    // Show hint on page load - DISABLED
    // if (!sessionStorage.getItem('adminHintShown')) {
    //     setTimeout(() => {
    //         showNotification('Press Ctrl+Shift+A to toggle admin mode', 'info');
    //         sessionStorage.setItem('adminHintShown', 'true');
    //     }, 2000);
    // }
})();
