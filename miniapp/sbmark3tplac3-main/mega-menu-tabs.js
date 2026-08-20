/**
 * Mega Menu Tabs Functionality
 * Управление переключением вкладок в SHOP mega menu
 */

(function() {
    'use strict';

    // Определяет текущую страницу и возвращает нужную вкладку
    function getActiveTabBasedOnPage() {
        const pathname = window.location.pathname.toLowerCase();
        const filename = pathname.split('/').pop() || pathname;
        
        // Если находимся на странице бренда - выбираем BRAND
        if (filename === 'brand.html' || pathname.includes('brand.html')) {
            return 'brand-collection';
        }
        
        // Во всех остальных случаях (index.html, shop-all.html, category-*.html, product.html) - MAIN COLLECTION
        return 'main-collection';
    }

    // Устанавливает активную вкладку в зависимости от текущей страницы
    function setActiveTabBasedOnPage() {
        const targetTab = getActiveTabBasedOnPage();
        
        // Находим все вкладки
        const tabs = document.querySelectorAll('.mega-menu-tab');
        const tabContents = document.querySelectorAll('.mega-menu-tab-content');
        
        if (!tabs || tabs.length === 0) {
            return;
        }

        // Убираем active класс у всех вкладок
        tabs.forEach(t => t.classList.remove('active'));
        
        // Скрываем все tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        // Находим нужную вкладку и активируем её
        tabs.forEach(tab => {
            const tabName = tab.getAttribute('data-tab');
            if (tabName === targetTab) {
                tab.classList.add('active');
                
                // Показываем соответствующий tab content
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });

        console.log(`Auto-selected tab: ${targetTab} based on page: ${window.location.pathname}`);
    }

    function initMegaMenuTabs() {
        // Находим все вкладки
        const tabs = document.querySelectorAll('.mega-menu-tab');
        
        if (!tabs || tabs.length === 0) {
            console.log('Mega menu tabs not found');
            return;
        }

        // Устанавливаем активную вкладку в зависимости от текущей страницы
        setActiveTabBasedOnPage();

        // Обработчик клика на вкладку
        tabs.forEach(tab => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const targetTab = this.getAttribute('data-tab');
                
                // Убираем active класс у всех вкладок
                tabs.forEach(t => t.classList.remove('active'));
                
                // Добавляем active класс к текущей вкладке
                this.classList.add('active');

                // Скрываем все tab content
                const tabContents = document.querySelectorAll('.mega-menu-tab-content');
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });

                // Показываем выбранный tab content
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                console.log(`Switched to tab: ${targetTab}`);
            });
        });

        console.log('Mega menu tabs initialized');
    }

    // Функция для загрузки брендов в Brand tab
    async function loadBrandsIntoShopMenu() {
        try {
            const response = await fetch('/api/brands');
            if (!response.ok) {
                console.warn('Could not load brands');
                return;
            }

            const brands = await response.json();
            const brandsList = document.getElementById('brandMenuList');

            if (!brandsList) {
                console.warn('Brand menu list not found');
                return;
            }

            // Очищаем список
            brandsList.innerHTML = '';

            const sortedActiveBrands = brands
                .filter(brand => brand.isActive)
                .sort((a, b) => {
                    const nameA = (a.name || '').trim();
                    const nameB = (b.name || '').trim();
                    return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
                });

            // Добавляем бренды
            sortedActiveBrands.forEach(brand => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `brand.html?id=${brand.id}`;
                a.className = 'mega-menu-link';
                a.innerHTML = `<span class="arrow">></span> ${brand.name.toUpperCase()}`;
                li.appendChild(a);
                brandsList.appendChild(li);
            });

            console.log(`Loaded ${sortedActiveBrands.length} brands into SHOP menu`);
        } catch (error) {
            console.error('Error loading brands into SHOP menu:', error);
        }
    }

    // Инициализация после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initMegaMenuTabs();
            loadBrandsIntoShopMenu();
        });
    } else {
        initMegaMenuTabs();
        loadBrandsIntoShopMenu();
    }

})();
