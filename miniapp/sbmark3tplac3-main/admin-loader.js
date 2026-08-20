// Admin scripts loader with proper authentication check
(function() {
    'use strict';

    // Check if user is authenticated admin via server
    async function checkAdminAuth() {
        try {
            const response = await fetch('/api/check-admin', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.isAdmin === true;
            }
            return false;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }

    // Load admin scripts only for authenticated admins
    async function loadAdminScripts() {
        const isAdmin = await checkAdminAuth();
        
        if (isAdmin) {
            console.log('Admin authenticated, loading admin tools...');
            
            // Load admin CSS
            const adminStyles = [
                'inline-text-editor.css',
                'direct-text-editor.css'
            ];
            
            adminStyles.forEach(style => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = style;
                document.head.appendChild(link);
            });
            
            // Load admin scripts
            const adminScripts = [
                'cleanup-orange-buttons.js', // Remove orange text edit buttons
                'simple-admin-editor.js', // Simple editor (only for images now)
                'admin-block-editor.js', // Block editor for campaign sections (hero handled by hero-admin-editor.js)
                'admin-about-editor.js', // About section editor
                'homepage-image-editor.js',
                // 'admin-text-editor-enhanced.js', // Disabled to prevent duplicate buttons  
                // 'admin-button-editor.js', // Disabled - using block editor
                // 'admin-enhanced-editor.js', // Disabled - using block editor
                // 'force-init-editors.js', // Disabled - using block editor
                'disable-enhanced-editor.js' // Add cleanup script
            ];
            
            // Load scripts sequentially
            let loadIndex = 0;
            function loadNextScript() {
                if (loadIndex < adminScripts.length) {
                    const scriptElement = document.createElement('script');
                    scriptElement.src = adminScripts[loadIndex];
                    scriptElement.onload = () => {
                        loadIndex++;
                        loadNextScript();
                    };
                    document.body.appendChild(scriptElement);
                } else {
                    // After all admin scripts are loaded, run cleanup
                    setTimeout(() => {
                        if (window.cleanupEditButtons) {
                            window.cleanupEditButtons();
                        }
                    }, 500);
                }
            }
            
            // Set admin flag
            window.isAdminUser = true;
            
            // Start loading scripts
            loadNextScript();
        } else {
            // Clear any admin data from localStorage for security
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminToken');
            window.isAdminUser = false;
            
            // Remove all admin buttons if present
            document.querySelectorAll('.block-edit-btn, .hero-edit-button, .simple-img-edit, .about-edit-btn').forEach(btn => btn.remove());
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAdminScripts);
    } else {
        loadAdminScripts();
    }
    
    // Periodically check admin status
    setInterval(async () => {
        const isAdmin = await checkAdminAuth();
        if (!isAdmin) {
            // User is no longer admin, remove all admin buttons
            console.log('Admin session expired, removing admin tools...');
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminToken');
            window.isAdminUser = false;
            
            // Remove all admin buttons
            document.querySelectorAll('.block-edit-btn, .hero-edit-button, .simple-img-edit, .img-edit-icon, .about-edit-btn').forEach(btn => btn.remove());
            
            // Close any open modals
            document.querySelectorAll('.hero-edit-modal, .block-edit-modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    }, 15000); // Check every 15 seconds
})();
