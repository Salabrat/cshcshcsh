// Safe admin loader - minimal version to prevent conflicts
(function() {
    'use strict';
    
    console.log('Safe admin loader starting...');
    
    // Check if user is authenticated admin via server
    async function checkAdminAuth() {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                console.log('No admin token found');
                return false;
            }
            
            const response = await fetch('/api/check-admin', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token
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
    
      async function loadAdminScripts() {
        const isAdmin = await checkAdminAuth();
        
        if (isAdmin) {
            console.log('Admin authenticated, loading minimal admin tools...');
            
            // Set admin flag IMMEDIATELY
            window.isAdminUser = true;
            console.log('Admin flag set: window.isAdminUser = true');
            
            // Load admin scripts sequentially
            const adminScripts = [
                { src: 'admin-button-editor.js', name: 'Button editor' },
                { src: 'homepage-image-editor.js', name: 'Image editor' },
                { src: 'homepage-text-editor.js', name: 'Text editor' }
            ];
            
            let scriptIndex = 0;
            
            function loadNextScript() {
                if (scriptIndex >= adminScripts.length) {
                    console.log('All admin scripts loaded successfully');
                    // Ensure admin flag is still set
                    window.isAdminUser = true;
                    return;
                }
                
                const scriptInfo = adminScripts[scriptIndex];
                const script = document.createElement('script');
                script.src = scriptInfo.src;
                script.onload = () => {
                    console.log(`${scriptInfo.name} loaded`);
                    scriptIndex++;
                    loadNextScript();
                };
                script.onerror = () => {
                    console.error(`Failed to load ${scriptInfo.name}`);
                    scriptIndex++;
                    loadNextScript(); // Continue with next script even if one fails
                };
                document.body.appendChild(script);
            }
            
            // Start loading scripts
            loadNextScript();
            
        } else {
            // Clear any admin data from localStorage for security
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminToken');
            window.isAdminUser = false;
            console.log('Not an admin user');
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAdminScripts);
    } else {
        // Small delay to ensure other scripts are loaded
        setTimeout(loadAdminScripts, 100);
    }
})();
