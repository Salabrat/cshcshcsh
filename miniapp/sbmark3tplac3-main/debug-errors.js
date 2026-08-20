// Debug script to catch and log all errors
(function() {
    'use strict';
    
    console.log('🔍 Debug mode activated');
    
    // Catch all errors
    window.addEventListener('error', function(event) {
        console.error('❌ JavaScript Error:', {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error
        });
    });
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('❌ Unhandled Promise Rejection:', event.reason);
    });
    
    // Check for missing dependencies
    function checkDependencies() {
        const requiredScripts = [
            'script.js',
            'theme-toggle.js',
            'database-api.js',
            'trending-loader.js',
            'product-modal.js',
            'load-homepage-images.js',
            'load-homepage-texts.js',
            'load-button-texts.js'
        ];
        
        const loadedScripts = Array.from(document.querySelectorAll('script[src]'))
            .map(script => script.src.split('/').pop());
        
        requiredScripts.forEach(script => {
            if (!loadedScripts.includes(script)) {
                console.warn('⚠️ Missing script:', script);
            } else {
                console.log('✅ Loaded:', script);
            }
        });
    }
    
    // Check for conflicting scripts
    function checkConflicts() {
        // Check if multiple edit button systems are active
        const editButtonSystems = [
            window.adminButtonEditor,
            window.adminEnhancedEditor,
            window.homepageImageEditor,
            window.universalTextEditor
        ];
        
        const activeSystems = editButtonSystems.filter(system => system !== undefined);
        
        if (activeSystems.length > 1) {
            console.warn('⚠️ Multiple edit systems detected:', activeSystems.length);
            console.log('Active systems:', activeSystems);
        }
        
        // Check for duplicate edit buttons
        const editButtons = document.querySelectorAll('.admin-edit-btn');
        if (editButtons.length > 0) {
            console.log(`Found ${editButtons.length} edit buttons`);
            
            // Check for duplicates
            const buttonParents = new Set();
            editButtons.forEach(btn => {
                const parent = btn.parentElement;
                if (buttonParents.has(parent)) {
                    console.warn('⚠️ Duplicate edit button in:', parent);
                }
                buttonParents.add(parent);
            });
        }
    }
    
    // Check API endpoints
    async function checkAPI() {
        const endpoints = [
            '/api/products',
            '/api/homepage-images',
            '/api/homepage-texts',
            '/api/button-texts'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    console.log(`✅ API endpoint working: ${endpoint}`);
                } else {
                    console.error(`❌ API endpoint error: ${endpoint} - Status: ${response.status}`);
                }
            } catch (error) {
                console.error(`❌ API endpoint failed: ${endpoint}`, error);
            }
        }
    }
    
    // Run diagnostics
    setTimeout(() => {
        console.log('=== Running diagnostics ===');
        checkDependencies();
        checkConflicts();
        checkAPI();
        console.log('=== Diagnostics complete ===');
    }, 2000);
    
    // Export for manual use
    window.debugSite = {
        checkDependencies,
        checkConflicts,
        checkAPI,
        runAll: function() {
            checkDependencies();
            checkConflicts();
            checkAPI();
        }
    };
})();
