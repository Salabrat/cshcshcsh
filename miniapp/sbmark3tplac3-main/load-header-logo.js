// Load header logo from site settings
(function() {
    'use strict';

    async function loadHeaderLogo() {
        try {
            const response = await fetch('/api/site-settings');
            if (!response.ok) return;

            const settings = await response.json();
            const siteName = (settings && typeof settings.siteName === 'string') ? settings.siteName.trim() : 'C.P. Company';
            
            // Use headerLogoUrl first, fall back to logoUrl for backward compatibility
            const logoUrl = (settings && typeof settings.headerLogoUrl === 'string' && settings.headerLogoUrl.trim())
                ? settings.headerLogoUrl.trim()
                : ((settings && typeof settings.logoUrl === 'string') ? settings.logoUrl.trim() : '');

            // Find all logo containers on the page (including mobile menu logo)
            const logoContainers = document.querySelectorAll('.header-logo a, .logo a, .mobile-menu-logo');
            
            logoContainers.forEach(container => {
                if (!container) return;

                if (logoUrl) {
                    // Create image element
                    const existingImg = container.querySelector('img[data-header-logo="true"]');
                    const img = existingImg || document.createElement('img');
                    img.setAttribute('data-header-logo', 'true');
                    img.alt = siteName;
                    const isMobileLogo = container.classList.contains('mobile-menu-logo');
                    img.style.height = isMobileLogo ? '90px' : '80px';
                    img.style.width = 'auto';
                    img.style.display = 'block';
                    img.style.transition = 'opacity 0.3s ease';
                    img.style.objectFit = 'contain';

                    if (!existingImg) {
                        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        img.style.opacity = '0';
                    }

                    // Load actual logo with fade-in
                    const tempImg = new Image();
                    tempImg.onload = function() {
                        img.src = logoUrl;
                        requestAnimationFrame(() => {
                            img.style.opacity = '1';
                        });
                    };
                    tempImg.onerror = function() {
                        console.warn('Failed to load header logo:', logoUrl);
                        // Show text fallback
                        showTextLogo(container, siteName);
                    };
                    tempImg.src = logoUrl;

                    if (!existingImg) {
                        container.innerHTML = '';
                        container.appendChild(img);
                    }
                } else {
                    // Show text logo
                    showTextLogo(container, siteName);
                }
            });
        } catch (error) {
            console.error('Error loading header logo:', error);
        }
    }

    function showTextLogo(container, siteName) {
        // Create SVG text logo as fallback
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '120');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 120 40');
        svg.style.display = 'block';

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '25');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', 'currentColor');
        text.textContent = siteName;

        svg.appendChild(text);
        container.innerHTML = '';
        container.appendChild(svg);
    }

    // Load logo when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadHeaderLogo);
    } else {
        loadHeaderLogo();
    }

    // Export for manual refresh
    window.refreshHeaderLogo = loadHeaderLogo;
})();
