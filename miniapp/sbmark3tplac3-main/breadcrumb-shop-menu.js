/**
 * Breadcrumb Menu Integration
 * Связывает клик на "SHOP" и "BRAND" в breadcrumb с открытием mega menu
 */

(function() {
    'use strict';

    function initBreadcrumbShopMenu() {
        // Находим ссылку SHOP в breadcrumb
        const breadcrumb = document.querySelector('.breadcrumb');
        if (!breadcrumb) return;

        // Находим все ссылки в breadcrumb
        const breadcrumbLinks = breadcrumb.querySelectorAll('a');
        let shopBreadcrumbLink = null;
        let brandBreadcrumbLink = null;

        // Ищем ссылки с текстом "SHOP" или "BRAND"
        breadcrumbLinks.forEach(link => {
            const text = link.textContent.trim().toUpperCase();
            if (text === 'SHOP') {
                shopBreadcrumbLink = link;
            } else if (text === 'BRAND') {
                brandBreadcrumbLink = link;
            }
        });

        // Инициализируем SHOP menu
        if (shopBreadcrumbLink) {
            const shopLink = document.getElementById('shopLink');
            const megaMenu = document.getElementById('megaMenu');
            const hasDropdown = shopLink ? shopLink.closest('.has-dropdown') : null;

            if (shopLink && megaMenu && hasDropdown) {
                initMenuLink(shopBreadcrumbLink, hasDropdown, megaMenu, 'SHOP');
            } else {
                console.log('Breadcrumb: SHOP mega menu elements not found');
            }
        }

        // Инициализируем BRAND menu
        if (brandBreadcrumbLink) {
            const brandLink = document.getElementById('brandLink');
            const brandMegaMenu = document.getElementById('brandMegaMenu');
            const brandDropdown = brandLink ? brandLink.closest('.has-dropdown') : null;

            if (brandLink && brandMegaMenu && brandDropdown) {
                initMenuLink(brandBreadcrumbLink, brandDropdown, brandMegaMenu, 'BRAND');
            } else {
                console.log('Breadcrumb: BRAND mega menu elements not found');
            }
        }
    }

    /**
     * Инициализация обработчика для breadcrumb ссылки
     */
    function initMenuLink(breadcrumbLink, dropdown, megaMenu, menuType) {

        // Добавляем обработчик клика на breadcrumb ссылку
        breadcrumbLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log(`Breadcrumb ${menuType} clicked - opening mega menu`);

            // Прокручиваем страницу вверх, чтобы header был виден
            const header = document.querySelector('.header');
            const topBar = document.querySelector('.top-bar');
            const headerTop = header ? header.getBoundingClientRect().top + window.scrollY : 0;
            const topBarHeight = topBar ? topBar.offsetHeight : 40;

            // Плавная прокрутка к header
            window.scrollTo({
                top: Math.max(0, headerTop - topBarHeight - 10),
                behavior: 'smooth'
            });

            // Небольшая задержка перед открытием меню, чтобы прокрутка началась
            setTimeout(() => {
                // Программно открываем mega menu
                dropdown.classList.add('active');
                megaMenu.style.opacity = '1';
                megaMenu.style.visibility = 'visible';

                // Делаем header белым (как при нормальном открытии меню)
                if (header) {
                    header.classList.add('scrolled');
                }
                if (topBar) {
                    topBar.classList.add('scrolled');
                }

                // Обновляем флаг в основном скрипте, если он существует
                if (window.megaMenuState !== undefined) {
                    window.megaMenuState.isOpen = true;
                }

                console.log(`${menuType} mega menu opened from breadcrumb`);
            }, 300); // Задержка для плавной прокрутки

            // Добавляем временный обработчик для закрытия меню при клике вне его
            const closeHandler = function(event) {
                if (!dropdown.contains(event.target) && 
                    !megaMenu.contains(event.target) &&
                    event.target !== breadcrumbLink) {
                    
                    dropdown.classList.remove('active');
                    megaMenu.style.opacity = '0';
                    megaMenu.style.visibility = 'hidden';
                    
                    // Убираем обработчик
                    document.removeEventListener('click', closeHandler);
                    
                    if (window.megaMenuState !== undefined) {
                        window.megaMenuState.isOpen = false;
                    }
                    
                    console.log(`${menuType} mega menu closed`);
                }
            };

            // Добавляем обработчик с небольшой задержкой, чтобы текущий клик не закрыл меню
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 100);
        });

        console.log(`Breadcrumb ${menuType} menu integration initialized`);
    }

    // Инициализация после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBreadcrumbShopMenu);
    } else {
        initBreadcrumbShopMenu();
    }

})();
