// Load Campaign Content for All Users
(function() {
    'use strict';
    
    // Load saved campaign content
    async function loadCampaignContent() {
        try {
            const response = await fetch('/api/campaign-content');
            if (!response.ok) {
                console.error('Failed to fetch campaign content');
                return;
            }
            
            const content = await response.json();
            console.log('Loaded campaign content:', content);
            
            // Find all campaign blocks
            const campaignBlocks = [
                ...document.querySelectorAll('.campaign-content'),
                ...document.querySelectorAll('.campaign-split-content')
            ];
            
            campaignBlocks.forEach((block, index) => {
                const campaignKey = `campaign${index + 1}`;
                const campaignData = content[campaignKey];
                
                if (!campaignData) {
                    console.log(`No saved data for ${campaignKey}`);
                    return;
                }
                
                // Update label
                const labelElement = block.querySelector('.campaign-label');
                if (labelElement && campaignData.label && labelElement.dataset.homepageTextsOverride !== 'true') {
                    labelElement.textContent = campaignData.label;
                    console.log(`Updated label for ${campaignKey}:`, campaignData.label);
                }
                
                // Update title
                const titleElement = block.querySelector('.campaign-title');
                if (titleElement && campaignData.title && titleElement.dataset.homepageTextsOverride !== 'true') {
                    titleElement.innerHTML = campaignData.title;
                    console.log(`Updated title for ${campaignKey}:`, campaignData.title);
                }
                
                // Update description
                const descriptionElement = block.querySelector('.campaign-description');
                if (descriptionElement && campaignData.description && descriptionElement.dataset.homepageTextsOverride !== 'true') {
                    descriptionElement.textContent = campaignData.description;
                    console.log(`Updated description for ${campaignKey}:`, campaignData.description);
                }
                
                // Update button text and link
                const buttonElement = block.querySelector('.btn');
                if (buttonElement) {
                    // Update button text if provided
                    if (campaignData.buttonText) {
                        // Preserve the data-text-id attribute if it exists
                        const buttonId = buttonElement.getAttribute('data-text-id');
                        
                        // Only update if it's not being managed by button-texts system
                        // or if the campaign content is different
                        if (buttonId) {
                            // This button might be managed by button-texts.json
                            // But we'll still update it from campaign content
                            // The button-texts system will override it if needed
                            console.log(`Button ${buttonId} might be managed by button-texts system`);
                        }
                        
                        buttonElement.textContent = campaignData.buttonText;
                        console.log(`Updated button text for ${campaignKey}:`, campaignData.buttonText);
                    }
                    
                    // Update button link if provided
                    if (campaignData.buttonLink) {
                        // If button is inside an anchor tag, update the href
                        const parentLink = buttonElement.closest('a');
                        if (parentLink) {
                            parentLink.href = campaignData.buttonLink;
                            console.log(`Updated parent link href for ${campaignKey}:`, campaignData.buttonLink);
                        } else {
                            // If button is not in an anchor, make it clickable
                            buttonElement.style.cursor = 'pointer';
                            buttonElement.onclick = function() {
                                window.location.href = campaignData.buttonLink;
                            };
                            console.log(`Added click handler for ${campaignKey}:`, campaignData.buttonLink);
                        }
                    }
                }
            });
            
            console.log('Campaign content loaded successfully');
        } catch (error) {
            console.error('Error loading campaign content:', error);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCampaignContent);
    } else {
        loadCampaignContent();
    }
    
    // Export for manual reload
    window.loadCampaignContent = loadCampaignContent;
})();
