// Load Themes from Database
// Загружает темы из БД бота и заменяет бренды в miniapp

(function() {
    'use strict';
    
    async function loadThemesFromDatabase() {
        try {
            console.log('Loading themes from database...');
            
            // Try to fetch themes from the API (through proxy)
            const response = await fetch('/api/themes');
            
            if (!response.ok) {
                console.error('Failed to fetch themes from API, using fallback');
                return;
            }
            
            const data = await response.json();
            const themes = data.brands || [];
            
            console.log('Loaded themes from database:', themes);
            
            // Update brands.json with database themes
            if (window.brandsData) {
                window.brandsData.brands = themes.map(theme => ({
                    id: theme.id,
                    name: theme.name,
                    isActive: theme.isActive,
                    logo: theme.logo || theme.photo_id || '',
                    description: theme.description || ''
                }));
                
                console.log('Updated brands data with database themes');
                
                // Trigger reload of brands display
                if (window.loadBrands) {
                    window.loadBrands();
                }
                
                // Update localStorage to persist the changes
                localStorage.setItem('brands', JSON.stringify(window.brandsData));
            }
            
            // If there's a brands grid in the DOM, update it directly
            const brandsGrid = document.getElementById('brandsGrid');
            if (brandsGrid && themes.length > 0) {
                brandsGrid.innerHTML = '';
                
                themes.forEach(theme => {
                    const brandCard = document.createElement('div');
                    brandCard.className = 'tg-brand-card';
                    brandCard.dataset.brandId = theme.id;
                    
                    const logoHtml = theme.logo ? 
                        `<img src="${theme.logo}" alt="${theme.name}" class="tg-brand-logo">` : 
                        `<div class="tg-brand-placeholder">${theme.name.charAt(0)}</div>`;
                    
                    brandCard.innerHTML = `
                        ${logoHtml}
                        <div class="tg-brand-name">${theme.name}</div>
                    `;
                    
                    brandCard.addEventListener('click', () => {
                        // Handle theme click - navigate to theme page
                        console.log('Theme clicked:', theme.name);
                        // Here you can add navigation logic
                    });
                    
                    brandsGrid.appendChild(brandCard);
                });
                
                console.log('Updated brands grid with database themes');
            }
            
        } catch (error) {
            console.error('Error loading themes from database:', error);
            console.log('Falling back to default brands');
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadThemesFromDatabase);
    } else {
        loadThemesFromDatabase();
    }
    
    // Expose function globally for manual reload
    window.loadThemesFromDatabase = loadThemesFromDatabase;
})();