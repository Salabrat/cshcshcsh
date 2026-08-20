// Load and apply custom menu labels from site settings
(function() {
    'use strict';

    // Store labels globally so they can be re-applied after dynamic content loads
    window._menuLabels = null;

    function applyMenuLabels(labels) {
        const { shopLabel, brandLabel, searchLabel, shopAllLabel, categoriesLabel } = labels;

        // Update desktop SHOP link
        const shopLink = document.getElementById('shopLink');
        if (shopLink) shopLink.textContent = shopLabel;

        // Update mobile SHOP menu toggle (preserve SVG)
        const shopMenuToggle = document.getElementById('shopMenuToggle');
        if (shopMenuToggle) {
            const arrow = shopMenuToggle.querySelector('svg');
            shopMenuToggle.textContent = shopLabel;
            if (arrow) {
                shopMenuToggle.appendChild(document.createTextNode(' '));
                shopMenuToggle.appendChild(arrow);
            }
        }

        // Update mobile BRAND menu toggle (preserve SVG)
        const brandMenuToggle = document.getElementById('brandMenuToggle');
        if (brandMenuToggle) {
            const arrow = brandMenuToggle.querySelector('svg');
            brandMenuToggle.textContent = brandLabel;
            if (arrow) {
                brandMenuToggle.appendChild(document.createTextNode(' '));
                brandMenuToggle.appendChild(arrow);
            }
        }

        // Update BRAND tab in mega menu
        const brandTab = document.querySelector('.mega-menu-tab[data-tab="brand-collection"]');
        if (brandTab) brandTab.textContent = brandLabel;

        // Update MAIN COLLECTION tab in mega menu
        const mainCollectionTabBtn = document.querySelector('.mega-menu-tab[data-tab="main-collection"]');
        if (mainCollectionTabBtn) mainCollectionTabBtn.textContent = shopLabel;

        // Replace hardcoded MAIN COLLECTION text in common desktop areas
        const maybeReplaceMainCollection = (el) => {
            if (!el) return;
            const text = (el.textContent || '').trim();
            if (text === 'MAIN COLLECTION') {
                el.textContent = shopLabel;
            }
        };

        // Breadcrumb last segment
        const breadcrumbLast = document.querySelector('.breadcrumb span:last-child');
        maybeReplaceMainCollection(breadcrumbLast);

        // Shop page title (shop-all page)
        const shopTitle = document.querySelector('.shop-title');
        maybeReplaceMainCollection(shopTitle);

        // Document title prefix
        if (typeof document.title === 'string' && document.title.trim().startsWith('MAIN COLLECTION')) {
            document.title = document.title.replace(/^MAIN COLLECTION/, shopLabel);
        }

        // Update SEARCH button (text node only, preserve children)
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            let found = false;
            searchBtn.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    node.textContent = searchLabel;
                    found = true;
                }
            });
            if (!found) searchBtn.textContent = searchLabel;
        }

        // Update SHOP ALL in desktop mega menu
        document.querySelectorAll('.mega-menu-link').forEach(link => {
            if (link.href && link.href.includes('shop-all.html')) {
                const arrow = link.querySelector('.arrow');
                Array.from(link.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) node.remove();
                });
                if (arrow) {
                    link.appendChild(document.createTextNode(' ' + shopAllLabel));
                } else {
                    link.textContent = shopAllLabel;
                }
            }
        });

        // Update SHOP ALL in mobile menu
        document.querySelectorAll('.mobile-dropdown-link').forEach(link => {
            if (link.href && link.href.includes('shop-all.html')) {
                link.textContent = shopAllLabel;
            }
        });

        // Update CATEGORIES in mobile menu (preserve SVG arrow)
        const categoriesToggle = document.querySelector('.focus-toggle');
        if (categoriesToggle) {
            const svgArrow = categoriesToggle.querySelector('svg');
            Array.from(categoriesToggle.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
            if (svgArrow) {
                categoriesToggle.insertBefore(document.createTextNode(categoriesLabel + ' '), svgArrow);
            } else {
                categoriesToggle.textContent = categoriesLabel;
            }
        }
    }

    async function loadMenuLabels() {
        try {
            const response = await fetch('/api/site-settings');
            if (!response.ok) return;

            const settings = await response.json();
            
            // Get custom labels or use defaults
            const labels = {
                shopLabel: (settings && typeof settings.menuShopLabel === 'string' && settings.menuShopLabel.trim()) ? settings.menuShopLabel.trim() : 'SHOP',
                brandLabel: (settings && typeof settings.menuBrandLabel === 'string' && settings.menuBrandLabel.trim()) ? settings.menuBrandLabel.trim() : 'BRAND',
                searchLabel: (settings && typeof settings.menuSearchLabel === 'string' && settings.menuSearchLabel.trim()) ? settings.menuSearchLabel.trim() : 'SEARCH',
                shopAllLabel: (settings && typeof settings.menuShopAllLabel === 'string' && settings.menuShopAllLabel.trim()) ? settings.menuShopAllLabel.trim() : 'SHOP ALL',
                categoriesLabel: (settings && typeof settings.menuCategoriesLabel === 'string' && settings.menuCategoriesLabel.trim()) ? settings.menuCategoriesLabel.trim() : 'CATEGORIES'
            };

            // Store globally for re-use
            window._menuLabels = labels;

            // Apply immediately
            applyMenuLabels(labels);

            // Re-apply after short delay to catch dynamically loaded content
            setTimeout(() => applyMenuLabels(labels), 300);
            setTimeout(() => applyMenuLabels(labels), 800);

            console.log(`Menu labels applied: SHOP="${labels.shopLabel}", BRAND="${labels.brandLabel}", SEARCH="${labels.searchLabel}", SHOP ALL="${labels.shopAllLabel}", CATEGORIES="${labels.categoriesLabel}"`);
        } catch (error) {
            console.error('Error loading menu labels:', error);
        }
    }

    // Load on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMenuLabels);
    } else {
        loadMenuLabels();
    }
})();
