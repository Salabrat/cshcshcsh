// Brand Navigation System - Updated to use mega menu structure
class BrandNavigation {
    constructor() {
        this.brands = [];
        this.init();
    }

    async init() {
        await this.loadBrands();
        this.populateBrandMegaMenu();
        this.populateMobileBrands();
    }

    async loadBrands() {
        try {
            const response = await fetch('/api/brands');
            if (response.ok) {
                const allBrands = await response.json();
                // Only show active brands
                this.brands = allBrands
                    .filter(brand => brand.isActive)
                    .sort((a, b) => {
                        const nameA = (a.name || '').trim();
                        const nameB = (b.name || '').trim();
                        return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
                    });
            }
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    }

    populateBrandMegaMenu() {
        const brandsList = document.getElementById('brandsList');
        
        if (!brandsList) {
            console.log('brandsList container not found');
            return;
        }

        // Clear existing content
        brandsList.innerHTML = '';

        if (this.brands.length === 0) {
            brandsList.innerHTML = `
                <h4>BRANDS</h4>
                <p style="color: #999; font-size: 14px; margin-top: 10px;">Нет доступных брендов</p>
            `;
        } else {
            // Create title
            const title = document.createElement('h4');
            title.textContent = 'BRANDS';
            brandsList.appendChild(title);

            // Create list
            const ul = document.createElement('ul');
            
            this.brands.forEach(brand => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `/brand.html?id=${brand.id}`;
                a.textContent = brand.name;
                
                // Click handler to navigate to brand page
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = `/brand.html?id=${brand.id}`;
                });
                
                li.appendChild(a);
                ul.appendChild(li);
            });
            
            brandsList.appendChild(ul);
        }
    }

    populateMobileBrands() {
        const mobileBrandsList = document.getElementById('mobileBrandsList');
        
        if (!mobileBrandsList) {
            console.log('mobileBrandsList container not found');
            return;
        }

        // Clear existing content
        mobileBrandsList.innerHTML = '';

        if (this.brands.length === 0) {
            mobileBrandsList.innerHTML = `
                <li class="mobile-dropdown-item">
                    <a href="#" class="mobile-dropdown-link">Нет доступных брендов</a>
                </li>
            `;
        } else {
            this.brands.forEach(brand => {
                const li = document.createElement('li');
                li.className = 'mobile-dropdown-item';
                
                const a = document.createElement('a');
                a.href = `/brand.html?id=${brand.id}`;
                a.className = 'mobile-dropdown-link';
                a.textContent = brand.name.toUpperCase();
                
                li.appendChild(a);
                mobileBrandsList.appendChild(li);
            });
        }

        console.log(`Loaded ${this.brands.length} brands into mobile menu`);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new BrandNavigation();
    });
} else {
    new BrandNavigation();
}
