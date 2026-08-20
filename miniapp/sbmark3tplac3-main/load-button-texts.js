// Load saved button texts for all users
(function() {
    'use strict';

    async function loadButtonTexts() {
        try {
            const response = await fetch('/api/button-texts');
            if (!response.ok) {
                console.error('Failed to load button texts');
                return;
            }

            const buttonTexts = await response.json();
            
            // Update all buttons with saved texts (except hero-btn which is managed by hero-content)
            Object.keys(buttonTexts).forEach(buttonId => {
                // Skip hero-btn as it's managed by hero-content system
                if (buttonId === 'hero-btn') {
                    console.log('Skipping hero-btn - managed by hero-content system');
                    return;
                }
                
                const button = document.querySelector(`[data-text-id="${buttonId}"]`);
                if (button) {
                    button.textContent = buttonTexts[buttonId];
                }
            });
            
            console.log('Button texts loaded successfully');
        } catch (error) {
            console.error('Error loading button texts:', error);
        }
    }

    // Load when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadButtonTexts);
    } else {
        loadButtonTexts();
    }

    // Export for use by other scripts
    window.loadButtonTexts = loadButtonTexts;
})();
