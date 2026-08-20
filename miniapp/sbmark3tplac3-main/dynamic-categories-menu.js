// Dynamic Categories Menu Loader
// This script loads categories from API and dynamically populates the menu

(function() {
    // Load categories and update menu when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDynamicCategories);
    } else {
        loadDynamicCategories();
    }

    async function loadDynamicCategories() {
        try {
            // Fetch categories from API
            const response = await fetch('/api/categories');
            let categories = [];
            
            if (response.ok) {
                categories = await response.json();
                console.log('Categories loaded from API:', categories);
            } else {
                // If API fails, show empty menu
                categories = [];
                console.log('API failed, showing empty menu');
            }

            // Filter out categories with (RU) in the name
            categories = categories.filter(cat => !cat.name.includes('(RU)'));
            
            // Filter out hidden categories (isVisible === false)
            categories = categories.filter(cat => cat.isVisible !== false);
            
            // API already filters out default categories, so we just use what we get
            console.log('Categories after filtering:', categories);

            // Update desktop mega menu
            updateDesktopMenu(categories);
            
            // Update mobile menu
            updateMobileMenu(categories);
            
        } catch (error) {
            console.error('Error loading categories:', error);
            // Show empty menu on error
            updateDesktopMenu([]);
            updateMobileMenu([]);
        }
    }

    function updateDesktopMenu(categories) {
        const shopAllLabel = (window._menuLabels && typeof window._menuLabels.shopAllLabel === 'string' && window._menuLabels.shopAllLabel.trim())
            ? window._menuLabels.shopAllLabel.trim()
            : 'SHOP ALL';

        // Find main collection menu (inside #main-collection tab)
        const mainCollectionTab = document.getElementById('main-collection');
        if (!mainCollectionTab) {
            // Try alternative selectors
            updateAlternativeMenus(categories);
            return;
        }
        
        console.log('Updating main collection menu with', categories.length, 'categories');
        
        const maxCategoriesPerColumn = 10;
        const totalCategories = categories.length;
        const needsMultipleColumns = totalCategories > maxCategoriesPerColumn;
        
        // Get or create container
        let container = mainCollectionTab.querySelector('.mega-menu-single-column') || 
                       mainCollectionTab.querySelector('.mega-menu-columns');
        
        if (!container) {
            // Create single column container
            container = document.createElement('div');
            container.className = 'mega-menu-single-column';
            const section = document.createElement('div');
            section.className = 'mega-menu-section';
            const ul = document.createElement('ul');
            ul.className = 'mega-menu-list';
            section.appendChild(ul);
            container.appendChild(section);
            mainCollectionTab.appendChild(container);
        } else {
            // If container exists, ensure all old category links are removed
            // This handles the case where HTML has hardcoded categories
            const allCategoryLinks = container.querySelectorAll('a[href*="category-"]');
            allCategoryLinks.forEach(link => {
                const li = link.closest('li');
                if (li) li.remove();
            });
        }
        
        // Convert to columns if needed
        if (needsMultipleColumns && container.classList.contains('mega-menu-single-column')) {
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'mega-menu-columns';
            
            // Create fresh first column (don't move old content to preserve styling)
            const firstColumn = document.createElement('div');
            firstColumn.className = 'mega-menu-column';
            const section = document.createElement('div');
            section.className = 'mega-menu-section';
            const ul = document.createElement('ul');
            ul.className = 'mega-menu-list';
            section.appendChild(ul);
            firstColumn.appendChild(section);
            columnsContainer.appendChild(firstColumn);
            
            container.parentNode.replaceChild(columnsContainer, container);
            container = columnsContainer;
        }
        
        // Convert back to single column if not needed
        if (!needsMultipleColumns && container.classList.contains('mega-menu-columns')) {
            const singleColumn = document.createElement('div');
            singleColumn.className = 'mega-menu-single-column';
            const firstColumn = container.querySelector('.mega-menu-column');
            if (firstColumn) {
                const section = firstColumn.querySelector('.mega-menu-section');
                if (section) {
                    singleColumn.appendChild(section);
                }
            }
            container.parentNode.replaceChild(singleColumn, container);
            container = singleColumn;
        }
        
        // Now populate the menu
        if (needsMultipleColumns) {
            // Multiple columns layout
            const columnsContainer = container;
            
            // Get or create first column
            let firstColumn = columnsContainer.querySelector('.mega-menu-column:first-child');
            if (!firstColumn) {
                firstColumn = document.createElement('div');
                firstColumn.className = 'mega-menu-column';
                columnsContainer.appendChild(firstColumn);
            }
            
            // Get or create first column section and list
            let firstSection = firstColumn.querySelector('.mega-menu-section');
            if (!firstSection) {
                firstSection = document.createElement('div');
                firstSection.className = 'mega-menu-section';
                firstColumn.appendChild(firstSection);
            }
            
            let firstList = firstSection.querySelector('.mega-menu-list');
            if (!firstList) {
                firstList = document.createElement('ul');
                firstList.className = 'mega-menu-list';
                firstSection.appendChild(firstList);
            }
            
            // Clear first column list completely and rebuild
            firstList.innerHTML = '';
            
            // Add SHOP ALL first (same format as brands)
            const shopAllLi = document.createElement('li');
            const shopAllLink = document.createElement('a');
            shopAllLink.href = 'shop-all.html';
            shopAllLink.className = 'mega-menu-link';
            shopAllLink.innerHTML = `<span class="arrow">></span> ${shopAllLabel}`;
            shopAllLi.appendChild(shopAllLink);
            firstList.appendChild(shopAllLi);
            
            // Add first 10 categories to first column with proper styling (same format as brands)
            for (let i = 0; i < Math.min(maxCategoriesPerColumn, totalCategories); i++) {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `category-${encodeURIComponent(categories[i].slug)}.html`;
                a.className = 'mega-menu-link';
                a.innerHTML = `<span class="arrow">></span> ${categories[i].name.toUpperCase()}`;
                li.appendChild(a);
                firstList.appendChild(li);
            }
            
            // Handle second column
            if (totalCategories > maxCategoriesPerColumn) {
                // Get or create second column
                let secondColumn = columnsContainer.querySelector('.mega-menu-column:nth-child(2)');
                if (!secondColumn) {
                    secondColumn = document.createElement('div');
                    secondColumn.className = 'mega-menu-column';
                    columnsContainer.appendChild(secondColumn);
                }
                
                // Get or create second column section and list
                let secondSection = secondColumn.querySelector('.mega-menu-section');
                if (!secondSection) {
                    secondSection = document.createElement('div');
                    secondSection.className = 'mega-menu-section';
                    secondColumn.appendChild(secondSection);
                }
                
                let secondList = secondSection.querySelector('.mega-menu-list');
                if (!secondList) {
                    secondList = document.createElement('ul');
                    secondList.className = 'mega-menu-list';
                    secondSection.appendChild(secondList);
                }
                
                // Clear second column list
                secondList.innerHTML = '';
                
                // Add remaining categories to second column (same format as brands)
                for (let i = maxCategoriesPerColumn; i < totalCategories; i++) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = `category-${encodeURIComponent(categories[i].slug)}.html`;
                    a.className = 'mega-menu-link';
                    a.innerHTML = `<span class="arrow">></span> ${categories[i].name.toUpperCase()}`;
                    li.appendChild(a);
                    secondList.appendChild(li);
                }
            } else {
                // Remove second column if not needed
                const secondColumn = columnsContainer.querySelector('.mega-menu-column:nth-child(2)');
                if (secondColumn) {
                    secondColumn.remove();
                }
            }
        } else {
            // Single column layout
            let list = container.querySelector('.mega-menu-list');
            if (!list) {
                let section = container.querySelector('.mega-menu-section');
                if (!section) {
                    section = document.createElement('div');
                    section.className = 'mega-menu-section';
                    container.appendChild(section);
                }
                list = document.createElement('ul');
                list.className = 'mega-menu-list';
                section.appendChild(list);
            }
            
            // Clear list completely and rebuild to ensure consistent styling
            list.innerHTML = '';
            
            // Add SHOP ALL first (same format as brands)
            const shopAllLi = document.createElement('li');
            const shopAllLink = document.createElement('a');
            shopAllLink.href = 'shop-all.html';
            shopAllLink.className = 'mega-menu-link';
            shopAllLink.innerHTML = `<span class="arrow">></span> ${shopAllLabel}`;
            shopAllLi.appendChild(shopAllLink);
            list.appendChild(shopAllLi);
            
            // Add categories with proper styling (same format as brands)
            categories.forEach(category => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `category-${encodeURIComponent(category.slug)}.html`;
                a.className = 'mega-menu-link';
                a.innerHTML = `<span class="arrow">></span> ${category.name.toUpperCase()}`;
                li.appendChild(a);
                list.appendChild(li);
            });
        }
        
        // Also update alternative menu structures
        updateAlternativeMenus(categories);
    }
    
    function updateAlternativeMenus(categories) {
        // IMPORTANT: Do NOT update menus inside #main-collection - they are already handled
        // Only update menus outside of main-collection tab
        
        const megaMenuAlt = document.querySelector('.dropdown-content');
        
        // Update dropdown menu structure (outside of mega menu)
        if (megaMenuAlt) {
            const existingLinks = megaMenuAlt.querySelectorAll('a[href*="category-"]');
            
            if (existingLinks.length > 0) {
                // Clear existing category links
                existingLinks.forEach(link => link.remove());
                
                // Ensure shop all link exists
                let shopAllLink = megaMenuAlt.querySelector('a[href*="shop-all.html"]');
                if (!shopAllLink) {
                    shopAllLink = document.createElement('a');
                    shopAllLink.href = 'shop-all.html';
                    shopAllLink.className = 'dropdown-item';
                    shopAllLink.textContent = (window._menuLabels && typeof window._menuLabels.shopAllLabel === 'string' && window._menuLabels.shopAllLabel.trim())
                        ? window._menuLabels.shopAllLabel.trim()
                        : 'SHOP ALL';
                    megaMenuAlt.insertBefore(shopAllLink, megaMenuAlt.firstChild);
                }
                
                // Add categories
                categories.forEach(category => {
                    const link = document.createElement('a');
                    link.href = `category-${encodeURIComponent(category.slug)}.html`;
                    link.className = 'dropdown-item';
                    link.textContent = category.name;
                    megaMenuAlt.appendChild(link);
                });
            }
        }
        
        // Update any other category lists on the page (but not main-collection)
        updateOtherCategoryLists(categories);
    }

    function updateMobileMenu(categories) {
        // Find mobile menu categories container by ID first (preferred)
        let mobileCategories = document.getElementById('mobileCategoriesMenu');
        
        // If not found by ID, try to find by class
        if (!mobileCategories) {
            mobileCategories = document.querySelector('.mobile-dropdown-nested');
        }
        
        if (mobileCategories) {
            // Always update - clear existing categories and add new ones
                mobileCategories.innerHTML = '';
                
            // Add categories dynamically
                categories.forEach(category => {
                    const li = document.createElement('li');
                li.innerHTML = `<a href="category-${encodeURIComponent(category.slug)}.html" class="mobile-dropdown-nested-link">${category.name.toUpperCase()}</a>`;
                    mobileCategories.appendChild(li);
                });
            
            console.log('Mobile menu updated with', categories.length, 'categories');
        } else {
            console.log('Mobile categories menu container not found');
        }
    }

    function updateOtherCategoryLists(categories) {
        // Update any standalone category lists (like in product page mega menu)
        const categoryContainers = document.querySelectorAll('[data-category-list]');
        
        categoryContainers.forEach(container => {
            container.innerHTML = '';
            categories.forEach(category => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="category-${encodeURIComponent(category.slug)}.html">${category.name}</a>`;
                container.appendChild(li);
            });
        });
        
        // Also check for mega menu content areas that might have categories
        const megaMenuSections = document.querySelectorAll('.mega-menu-section ul');
        megaMenuSections.forEach(section => {
            // Check if this section contains category links (but not in main-collection)
            const parentTab = section.closest('#main-collection');
            if (parentTab) return; // Skip main-collection, it's handled separately
            
            const firstLink = section.querySelector('a');
            if (firstLink && firstLink.href && firstLink.href.includes('category-')) {
                // This is a category list, update it
                section.innerHTML = '';
                categories.forEach(category => {
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="category-${encodeURIComponent(category.slug)}.html">${category.name}</a>`;
                    section.appendChild(li);
                });
            }
        });
    }

    // Export function to manually refresh categories
    window.refreshCategoryMenus = loadDynamicCategories;
    
    // Auto-refresh categories when coming back to the page
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Page is visible again, refresh categories
            loadDynamicCategories();
        }
    });
    
    // Listen for custom event to refresh categories
    document.addEventListener('categoriesUpdated', loadDynamicCategories);
    
    // Refresh every 3 seconds if we are on a page with category menu
    if (document.getElementById('main-collection') || 
        document.querySelector('.mega-menu-column ul') || 
        document.querySelector('.mega-menu-columns .mega-menu-column ul') ||
        document.querySelector('.dropdown-content')) {
        setInterval(loadDynamicCategories, 3000);
    }
})();
