// Load about content for all users
(function() {
    console.log('Loading about content...');
    
    // Load saved content
    async function loadAboutContent() {
        try {
            const response = await fetch('/api/about-content');
            if (response.ok) {
                const content = await response.json();
                console.log('About content loaded:', content);
                
                // Update about title
                const aboutTitle = document.querySelector('.about-title');
                if (aboutTitle && content.title && aboutTitle.dataset.homepageTextsOverride !== 'true') {
                    aboutTitle.textContent = content.title;
                }
                
                // Update about text
                const aboutText = document.querySelector('.about-text');
                if (aboutText && content.text && aboutText.dataset.homepageTextsOverride !== 'true') {
                    aboutText.textContent = content.text;
                }
            }
        } catch (error) {
            console.error('Error loading about content:', error);
        }
    }
    
    // Load content when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAboutContent);
    } else {
        loadAboutContent();
    }
})();
