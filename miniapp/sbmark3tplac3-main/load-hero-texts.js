// Load saved hero texts for all users
(function() {
    'use strict';
    
    console.log('Loading saved hero texts...');
    
    async function loadHeroTexts() {
        try {
            const response = await fetch('/api/hero-texts');
            if (!response.ok) {
                console.error('Failed to load hero texts');
                return;
            }
            
            const texts = await response.json();
            console.log('Hero texts loaded:', texts);
            
            // Update hero title
            if (texts['hero-title']) {
                const titleElement = document.querySelector('.hero-title');
                if (titleElement) {
                    titleElement.innerHTML = texts['hero-title'];
                    console.log('Updated hero title');
                }
            }
            
            // Update hero subtitle
            if (texts['hero-subtitle']) {
                const subtitleElement = document.querySelector('.hero-subtitle');
                if (subtitleElement) {
                    subtitleElement.textContent = texts['hero-subtitle'];
                    console.log('Updated hero subtitle');
                }
            }
            
            // Update hero background image
            if (texts['hero-background']) {
                const heroSection = document.querySelector('.hero');
                if (heroSection) {
                    heroSection.style.backgroundImage = `url(${texts['hero-background']})`;
                    console.log('Updated hero background image');
                }
            }
            
        } catch (error) {
            console.error('Error loading hero texts:', error);
        }
    }
    
    // Load texts when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadHeroTexts);
    } else {
        loadHeroTexts();
    }
    
    // Export for manual use
    window.loadHeroTexts = loadHeroTexts;
})();
