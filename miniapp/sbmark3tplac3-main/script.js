// Header scroll effect with hide/show functionality
let lastScrollPosition = 0;
let isScrolling = false;
let scrollDelta = 5; // Minimum scroll delta to trigger hide/show

// Sticky shop controls functionality
function initStickyShopControls() {
    const shopControls = document.querySelector('.shop-controls');
    const header = document.querySelector('.header');
    const topBar = document.querySelector('.top-bar');
    
    if (!shopControls || !header) return;
    
    // Calculate the total header height (top-bar + header)
    const headerHeight = header.offsetHeight;
    const topBarHeight = topBar ? topBar.offsetHeight : 0;
    const totalHeaderHeight = headerHeight + topBarHeight;
    
    // Get the original position of shop-controls
    const shopControlsOffset = shopControls.offsetTop;
    
    // Create a placeholder to prevent layout jump
    const placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    placeholder.style.height = shopControls.offsetHeight + 'px';
    shopControls.parentNode.insertBefore(placeholder, shopControls.nextSibling);
    
    function handleStickyScroll() {
        const scrollPosition = window.scrollY;
        const headerHidden = header.classList.contains('hidden');
        
        // Adjust top position based on whether header is hidden
        let stickyTop = totalHeaderHeight;
        if (headerHidden) {
            stickyTop = 0; // If header is hidden, stick to top of viewport
        }
        
        // Check if we've scrolled past the shop-controls original position
        if (scrollPosition + totalHeaderHeight >= shopControlsOffset) {
            // Make it sticky
            if (!shopControls.classList.contains('sticky')) {
                shopControls.classList.add('sticky');
                placeholder.style.display = 'block';
            }
            // Always update top position
            shopControls.style.top = stickyTop + 'px';
        } else {
            // Remove sticky
            if (shopControls.classList.contains('sticky')) {
                shopControls.classList.remove('sticky');
                placeholder.style.display = 'none';
                shopControls.style.top = '';
            }
        }
    }
    
    window.addEventListener('scroll', handleStickyScroll);
    // Also listen for header state changes
    const observer = new MutationObserver(handleStickyScroll);
    observer.observe(header, { attributes: true, attributeFilter: ['class'] });
    
    handleStickyScroll(); // Initial check
}

function updateHeaderState() {
    const header = document.querySelector('.header');
    const topBar = document.querySelector('.top-bar');
    
    if (header) {
        const currentScrollPosition = window.scrollY;
        const scrollingDown = currentScrollPosition > lastScrollPosition;
        const scrollingUp = currentScrollPosition < lastScrollPosition;
        
        // Add/remove scrolled class for both header and top bar
        if (currentScrollPosition > 10) {
            header.classList.add('scrolled');
            if (topBar) topBar.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
            if (topBar) topBar.classList.remove('scrolled');
        }
        
        // Apply hide/show logic on all devices (desktop and mobile)
        {
            // Don't hide elements on category pages or shop-all page
            const isOnCategoryPage = window.location.pathname.includes('category-') || 
                                   window.location.pathname.includes('shop-all');
            if (isOnCategoryPage) {
                // На страницах категорий header всегда видим
                header.classList.remove('hidden');
                if (topBar) topBar.classList.remove('hidden');
                return;
            }
            
            // Hide both bars when scrolling down, show when scrolling up
            if (scrollingDown && currentScrollPosition > 100) {
                // Скрываем оба элемента при скролле вниз
                if (topBar) {
                    topBar.classList.add('hidden');
                }
                header.classList.add('hidden');
            } else if (scrollingUp) {
                // При скролле вверх показываем оба элемента
                if (topBar) {
                    topBar.classList.remove('hidden');
                }
                header.classList.remove('hidden');
            }
        }
        
        lastScrollPosition = currentScrollPosition;
    }
}

// Function to update top bar based on login status
function updateTopBarAuth() {
    const topBarRight = document.querySelector('.top-bar-right');
    if (!topBarRight) return;
    
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    const username = localStorage.getItem('username');
    
    if (isLoggedIn && username) {
        // User is logged in - show username/logout
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        const dashboardLink = isAdmin ? 'admin-dashboard.html' : '#';
        const adminIndicator = isAdmin ? ' 👑' : '';
        const adminTitle = isAdmin ? 'Нажмите для входа в админ панель' : 'Обычный пользователь';
        topBarRight.innerHTML = `
            <a href="#" class="top-bar-username" id="adminUsernameLink" title="${adminTitle}" style="text-decoration: none; color: inherit; cursor: pointer;">${username}${adminIndicator}</a>
            <span class="top-bar-separator">/</span>
            <a href="#" class="top-bar-link" onclick="logout(event)">logout</a>
        `;
        
        // Add click handler for admin username
        const adminUsernameLink = document.getElementById('adminUsernameLink');
        if (adminUsernameLink) {
            adminUsernameLink.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Debug information
                console.log('Admin link clicked:', {
                    isAdmin: isAdmin,
                    adminLoggedIn: localStorage.getItem('adminLoggedIn'),
                    userLoggedIn: localStorage.getItem('userLoggedIn'),
                    username: localStorage.getItem('username')
                });
                
                // For now, let's allow access if user is logged in as admin
                // We'll check username or make it easier to access
                const canAccessAdmin = isAdmin || username === 'admin';
                
                if (canAccessAdmin) {
                    // Open admin dashboard
                    if (e.ctrlKey || e.metaKey || e.button === 1) {
                        // Open in new tab if Ctrl/Cmd is pressed or middle mouse button
                        window.open('admin-dashboard.html', '_blank');
                    } else {
                        // Open in current tab
                        window.location.href = 'admin-dashboard.html';
                    }
                } else {
                    // Show message for non-admin users
                    alert('Доступ к админ панели только для администраторов.\n\nДля теста: войдите как admin');
                }
            });
            
            // Also handle middle mouse button click
            adminUsernameLink.addEventListener('mousedown', function(e) {
                if (e.button === 1 && isAdmin) { // Middle mouse button
                    e.preventDefault();
                    window.open('admin-dashboard.html', '_blank');
                }
            });
        }
    } else {
        // User is not logged in - show login/register
        topBarRight.innerHTML = `
            <a href="login.html" class="top-bar-link">Login</a>
            <span class="top-bar-separator">/</span>
            <a href="register.html" class="top-bar-link">Register</a>
        `;
    }
}

// Logout function
function logout(event) {
    if (event) event.preventDefault();
    
    // Clear all user-related data from localStorage
    localStorage.removeItem('userLoggedIn');
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('userEmail');
    
    // Update the top bar
    updateTopBarAuth();
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// Quick admin access function (for testing)
function quickAdminAccess() {
    localStorage.setItem('userLoggedIn', 'true');
    localStorage.setItem('adminLoggedIn', 'true');
    localStorage.setItem('username', 'admin');
    updateTopBarAuth();
    console.log('Quick admin access enabled');
    alert('Админ доступ активирован! Теперь можете нажать на username для входа в админ панель.');
}

// Make it globally available
window.quickAdminAccess = quickAdminAccess;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    updateTopBarAuth(); // Update top bar on page load

    (async function applySiteTitleForHomePage() {
        try {
            const pathname = (window.location.pathname || '').toLowerCase();
            const isHomePage = pathname === '/' || pathname.endsWith('/index.html') || pathname.endsWith('index.html') || pathname === '';
            if (!isHomePage) return;

            const response = await fetch('/api/site-settings');
            if (!response.ok) return;
            const settings = await response.json();
            const siteTitle = (settings && typeof settings.siteTitle === 'string') ? settings.siteTitle.trim() : '';
            if (siteTitle) {
                document.title = siteTitle;
            }
        } catch (e) {
            // ignore
        }
    })();
        
    // Auto-enable admin access for 'admin' username
    if (localStorage.getItem('username') === 'admin') {
        // Enable admin access
        localStorage.setItem('adminLoggedIn', 'true');
        console.log('Admin access auto-enabled for admin user');
    }
        
    // Force initial state to ensure proper colors
    const header = document.querySelector('.header');
    const topBar = document.querySelector('.top-bar');
    if (header && window.scrollY < 10) {
        header.classList.remove('scrolled');
        header.classList.remove('hidden');
        if (topBar) {
            topBar.classList.remove('scrolled');
            topBar.classList.remove('hidden');
        }
    }
});

// Update on scroll with throttling
window.addEventListener('scroll', function() {
    if (!isScrolling) {
        window.requestAnimationFrame(function() {
            updateHeaderState();
            isScrolling = false;
        });
        isScrolling = true;
    }
});

// Mega Menu functionality
document.addEventListener('DOMContentLoaded', function() {
    const shopLink = document.getElementById('shopLink');
    const megaMenu = document.getElementById('megaMenu');
    const hasDropdown = document.querySelector('.has-dropdown');
    
    let menuTimeout;

    // Dynamic positioning function
    function positionMegaMenu() {
        if (!megaMenu || !hasDropdown) return;
        
        // Reset positioning classes
        megaMenu.classList.remove('align-left', 'align-right');
        
        // Get viewport width and menu dimensions
        const viewportWidth = window.innerWidth;
        const dropdownRect = hasDropdown.getBoundingClientRect();
        const menuWidth = megaMenu.offsetWidth;
        
        // Calculate if menu would overflow on the right
        const menuLeft = dropdownRect.left + (dropdownRect.width / 2) - (menuWidth / 2);
        const menuRight = menuLeft + menuWidth;
        
        // Adjust positioning if menu overflows
        if (menuLeft < 20) {
            // Menu overflows on the left, align to left edge
            megaMenu.classList.add('align-left');
        } else if (menuRight > viewportWidth - 20) {
            // Menu overflows on the right, align to right edge
            megaMenu.classList.add('align-right');
        }
        // Otherwise keep default center alignment
    }

    if (hasDropdown && megaMenu && shopLink) {
        let isMenuOpen = false;
        
        // Toggle mega menu on click
        shopLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isMenuOpen = !isMenuOpen;
            
            if (isMenuOpen) {
                positionMegaMenu(); // Position menu before showing
                megaMenu.style.opacity = '1';
                megaMenu.style.visibility = 'visible';
                
                // Make header white when menu is open
                const header = document.querySelector('.header');
                const topBar = document.querySelector('.top-bar');
                if (header) {
                    header.classList.add('scrolled');
                }
                if (topBar) {
                    topBar.classList.add('scrolled');
                }
            } else {
                megaMenu.style.opacity = '0';
                megaMenu.style.visibility = 'hidden';
                
                // Restore header state based on scroll position
                updateHeaderState();
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (isMenuOpen && !hasDropdown.contains(e.target) && !megaMenu.contains(e.target)) {
                isMenuOpen = false;
                megaMenu.style.opacity = '0';
                megaMenu.style.visibility = 'hidden';
                
                // Restore header state based on scroll position
                updateHeaderState();
            }
        });
        
        // Prevent menu from closing when clicking inside it
        megaMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // Handle tab switching
        const megaMenuTabs = document.querySelectorAll('.mega-menu-tab');
        const tabContents = document.querySelectorAll('.mega-menu-tab-content');
        
        megaMenuTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs and contents
                megaMenuTabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Show corresponding content
                const tabName = this.getAttribute('data-tab');
                const targetContent = document.getElementById(tabName + '-content');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });

        // Reposition menu on window resize
        window.addEventListener('resize', function() {
            if (megaMenu.style.visibility === 'visible') {
                positionMegaMenu();
            }
        });
    }
});

// Mobile Menu functionality
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    
    // Debug: Check if elements exist
    console.log('Mobile Menu Elements:', {
        btn: !!mobileMenuBtn,
        menu: !!mobileMenu,
        close: !!mobileMenuClose,
        overlay: !!mobileMenuOverlay
    });
    
    function openMobileMenu() {
        console.log('Opening mobile menu');
        if (mobileMenu) mobileMenu.classList.add('active');
        if (mobileMenuOverlay) mobileMenuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
        console.log('Closing mobile menu');
        if (mobileMenu) mobileMenu.classList.remove('active');
        if (mobileMenuOverlay) mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (mobileMenuBtn) {
        // Remove any existing listeners
        mobileMenuBtn.removeEventListener('click', openMobileMenu);
        // Add new listener
        mobileMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile menu button clicked');
            openMobileMenu();
        });
    }

    if (mobileMenuClose) {
        mobileMenuClose.removeEventListener('click', closeMobileMenu);
        mobileMenuClose.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeMobileMenu();
        });
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.removeEventListener('click', closeMobileMenu);
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileMenu && mobileMenu.classList.contains('active')) {
            closeMobileMenu();
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && mobileMenu && mobileMenu.classList.contains('active')) {
            closeMobileMenu();
        }
    });
}

// Initialize mobile menu when DOM is ready
document.addEventListener('DOMContentLoaded', initMobileMenu);

// Also try to initialize after a short delay in case of timing issues
setTimeout(initMobileMenu, 100);

// Search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchBtn = document.querySelector('.search-btn');
    const searchOverlay = document.querySelector('.search-overlay');
    const searchClose = document.querySelector('.search-close');
    const searchInput = document.querySelector('.search-input');

    // Open search overlay
    searchBtn.addEventListener('click', function() {
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            searchInput.focus();
        }, 300);
    });

    // Close search overlay
    searchClose.addEventListener('click', function() {
        searchOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Close on overlay click
    searchOverlay.addEventListener('click', function(e) {
        if (e.target === searchOverlay) {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

function initTrendingSlider() {
    console.log('Initializing trending slider...');
    const prevArrow = document.querySelector('.prev-arrow');
    const nextArrow = document.querySelector('.next-arrow');
    const trendingGrid = document.querySelector('.trending-grid');
    
    if (!prevArrow || !nextArrow || !trendingGrid) {
        console.log('Slider elements not found');
        return;
    }
    
    // Get all items
    const items = document.querySelectorAll('.trending-item');
    const itemsPerView = window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
    
    // Calculate the true maximum index (ensuring we can see all products)
    // If we have 10 items and show 4 at a time, max index should be 6 (to show items 7-10)
    const maxIndex = Math.max(0, items.length - itemsPerView);
    
    // Initialize or get current index, but always validate it
    let currentIndex = trendingGrid.dataset.currentIndex ? parseInt(trendingGrid.dataset.currentIndex) : 0;
    
    // Force reset if currentIndex is invalid or exceeds maxIndex
    // Always validate and correct on desktop
    if (isNaN(currentIndex) || currentIndex < 0 || currentIndex > maxIndex) {
        currentIndex = Math.min(Math.max(0, currentIndex), maxIndex);
    }
    
    // Always apply the correct transform to ensure proper position
    const itemWidth = 100 / itemsPerView;
    const correctTranslateX = -(currentIndex * itemWidth);
    const currentTransform = trendingGrid.style.transform;
    const expectedTransform = `translateX(${correctTranslateX}%)`;
    
    // Check if transform needs correction
    if (currentTransform !== expectedTransform) {
        console.log('Correcting slider transform:', {
            current: currentTransform,
            expected: expectedTransform,
            currentIndex: currentIndex,
            maxIndex: maxIndex
        });
        trendingGrid.style.transform = expectedTransform;
        trendingGrid.dataset.currentIndex = currentIndex;
    }
    
    console.log('Slider initialization:', {
        currentIndex: currentIndex,
        maxIndex: maxIndex,
        itemsCount: items.length,
        itemsPerView: itemsPerView
    });
    
    // Check if already initialized
    if (prevArrow.dataset.initialized === 'true' && nextArrow.dataset.initialized === 'true') {
        console.log('Slider already initialized, resetting state...');
        // Reset and re-initialize to ensure proper state
        prevArrow.removeAttribute('data-initialized');
        nextArrow.removeAttribute('data-initialized');
        // Continue with initialization
    }
    
    prevArrow.dataset.initialized = 'true';
    nextArrow.dataset.initialized = 'true';
    
    // Remove any existing event listeners by cloning
    const newPrevArrow = prevArrow.cloneNode(true);
    const newNextArrow = nextArrow.cloneNode(true);
    prevArrow.parentNode.replaceChild(newPrevArrow, prevArrow);
    nextArrow.parentNode.replaceChild(newNextArrow, nextArrow);
    
    function getItemsPerView() {
        return window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
    }
    
    function updateSlider() {
        const items = document.querySelectorAll('.trending-item');
        const itemsPerView = getItemsPerView();
        
        // Recalculate maxIndex every time to ensure accuracy
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        // Ensure currentIndex doesn't exceed maxIndex
        if (currentIndex > maxIndex) {
            currentIndex = maxIndex;
        }
        
        console.log('Updating slider:', {
            itemsCount: items.length,
            itemsPerView: itemsPerView,
            currentIndex: currentIndex,
            maxIndex: maxIndex
        });
        
        // Save current index to data attribute
        trendingGrid.dataset.currentIndex = currentIndex;
        
        if (items.length === 0) {
            console.log('No items found, disabling arrows');
            // No items, disable both arrows
            newPrevArrow.style.opacity = '0.3';
            newPrevArrow.style.pointerEvents = 'none';
            newNextArrow.style.opacity = '0.3';
            newNextArrow.style.pointerEvents = 'none';
            return;
        }
        
        // Calculate precise transform to show exact products
        const itemWidth = 100 / itemsPerView;
        const translateX = -(currentIndex * itemWidth);
        
        trendingGrid.style.transform = `translateX(${translateX}%)`;
        
        // Update arrow visibility and pointer events
        if (items.length <= itemsPerView) {
            console.log('All items fit in view, disabling arrows');
            // All items fit in view, disable both arrows
            newPrevArrow.style.opacity = '0.3';
            newPrevArrow.style.pointerEvents = 'none';
            newNextArrow.style.opacity = '0.3';
            newNextArrow.style.pointerEvents = 'none';
        } else {
            console.log('Enabling arrows based on position');
            // Enable/disable arrows based on current position
            newPrevArrow.style.opacity = currentIndex === 0 ? '0.3' : '1';
            newPrevArrow.style.pointerEvents = currentIndex === 0 ? 'none' : 'auto';
            newPrevArrow.style.cursor = currentIndex === 0 ? 'default' : 'pointer';
            newNextArrow.style.opacity = currentIndex >= maxIndex ? '0.3' : '1';
            newNextArrow.style.pointerEvents = currentIndex >= maxIndex ? 'none' : 'auto';
            newNextArrow.style.cursor = currentIndex >= maxIndex ? 'default' : 'pointer';
            
            console.log('Arrow states:', {
                prev: { opacity: newPrevArrow.style.opacity, events: newPrevArrow.style.pointerEvents },
                next: { opacity: newNextArrow.style.opacity, events: newNextArrow.style.pointerEvents }
            });
        }
    }

    newNextArrow.addEventListener('click', function(e) {
        e.preventDefault();
        const items = document.querySelectorAll('.trending-item');
        const itemsPerView = getItemsPerView();
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        console.log('Next arrow clicked:', {
            currentIndex: currentIndex,
            maxIndex: maxIndex,
            itemsCount: items.length,
            itemsPerView: itemsPerView
        });
        
        if (currentIndex < maxIndex) {
            currentIndex++;
            updateSlider();
        } else {
            console.log('Already at max position, not moving');
        }
    });

    newPrevArrow.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentIndex > 0) {
            currentIndex--;
            updateSlider();
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const items = document.querySelectorAll('.trending-item');
            const itemsPerView = getItemsPerView();
            const newMaxIndex = Math.max(0, items.length - itemsPerView);
            
            if (currentIndex > newMaxIndex) {
                currentIndex = newMaxIndex;
            }
            updateSlider();
        }, 250);
    });
    
    // Initial update with delay to ensure items are loaded
    setTimeout(() => {
        updateSlider();
    }, 100);
}

// Initialize slider on page load and after trending items are loaded
document.addEventListener('DOMContentLoaded', function() {
    // Immediate correction of any broken slider state
    const trendingGrid = document.querySelector('.trending-grid');
    if (trendingGrid) {
        const items = document.querySelectorAll('.trending-item');
        const itemsPerView = window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
        const maxIndex = Math.max(0, items.length - itemsPerView);
        
        let currentIndex = trendingGrid.dataset.currentIndex ? parseInt(trendingGrid.dataset.currentIndex) : 0;
        
        // Force correction if index is out of bounds
        if (currentIndex > maxIndex) {
            currentIndex = maxIndex;
            const itemWidth = 100 / itemsPerView;
            const translateX = -(currentIndex * itemWidth);
            trendingGrid.style.transform = `translateX(${translateX}%)`;
            trendingGrid.dataset.currentIndex = currentIndex;
            console.log('Corrected slider position on load:', currentIndex);
        }
    }
    
    // Wait for trending items to be loaded
    setTimeout(initTrendingSlider, 500);
});

// Make it globally available for re-initialization
window.initTrendingSlider = initTrendingSlider;

// Force fix slider position immediately (can be called from console)
window.fixSliderPosition = function() {
    const trendingGrid = document.querySelector('.trending-grid');
    if (!trendingGrid) return;
    
    const items = document.querySelectorAll('.trending-item');
    const itemsPerView = window.innerWidth > 768 ? 4 : window.innerWidth > 480 ? 2 : 1;
    const maxIndex = Math.max(0, items.length - itemsPerView);
    
    // Reset to valid position
    const currentIndex = Math.min(maxIndex, 0); // Start from beginning
    const itemWidth = 100 / itemsPerView;
    const translateX = -(currentIndex * itemWidth);
    
    trendingGrid.style.transform = `translateX(${translateX}%)`;
    trendingGrid.dataset.currentIndex = currentIndex;
    
    // Re-initialize slider
    const prevArrow = document.querySelector('.prev-arrow');
    const nextArrow = document.querySelector('.next-arrow');
    if (prevArrow) prevArrow.removeAttribute('data-initialized');
    if (nextArrow) nextArrow.removeAttribute('data-initialized');
    
    initTrendingSlider();
    
    console.log('Fixed slider position:', {
        currentIndex: currentIndex,
        maxIndex: maxIndex,
        itemsCount: items.length,
        itemsPerView: itemsPerView
    });
};

// Force slider initialization function for debugging
window.forceSliderInit = function() {
    console.log('Force initializing slider...');
    
    // Wait for elements to be available
    setTimeout(() => {
        const items = document.querySelectorAll('.trending-item');
        console.log('Found', items.length, 'trending items');
        
        if (items.length > 0) {
            initTrendingSlider();
            console.log('Slider initialized with', items.length, 'items');
        } else {
            console.log('No trending items found, cannot initialize slider');
        }
    }, 100);
};

// Debug function to check slider state
window.checkSliderState = function() {
    const prevArrow = document.querySelector('.prev-arrow');
    const nextArrow = document.querySelector('.next-arrow');
    const trendingGrid = document.querySelector('.trending-grid');
    const items = document.querySelectorAll('.trending-item');
    
    console.log('Slider State:', {
        prevArrow: {
            exists: !!prevArrow,
            opacity: prevArrow?.style.opacity || 'default',
            pointerEvents: prevArrow?.style.pointerEvents || 'default'
        },
        nextArrow: {
            exists: !!nextArrow,
            opacity: nextArrow?.style.opacity || 'default',
            pointerEvents: nextArrow?.style.pointerEvents || 'default'
        },
        trendingGrid: {
            exists: !!trendingGrid,
            transform: trendingGrid?.style.transform || 'default'
        },
        items: {
            count: items.length,
            visible: Array.from(items).map(item => ({
                opacity: item.style.opacity,
                transform: item.style.transform
            }))
        }
    });
};

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href === '#') {
                e.preventDefault();
                return;
            }
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Newsletter form handling
document.addEventListener('DOMContentLoaded', function() {
    const newsletterForm = document.querySelector('.newsletter-form');
    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            
            if (email) {
                // Here you would typically send the email to your backend
                alert('Thank you for subscribing!');
                this.reset();
            }
        });
    }
});

// Intersection Observer for animations
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.trending-item, .campaign-content, .about-item');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Image lazy loading
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
});

// Mobile Shop Dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
    const shopMenuToggle = document.getElementById('shopMenuToggle');
    const shopDropdown = document.getElementById('shopDropdown');
    const shopMenuItem = shopMenuToggle ? shopMenuToggle.closest('.mobile-menu-item') : null;
    const brandMenuToggle = document.getElementById('brandMenuToggle');
    const brandMenuItem = brandMenuToggle ? brandMenuToggle.closest('.mobile-menu-item') : null;
    const focusOnItem = document.querySelector('.expandable');
    const focusToggle = document.querySelector('.focus-toggle');

    // Toggle shop dropdown
    if (shopMenuToggle && shopMenuItem) {
        shopMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            shopMenuItem.classList.toggle('active');
            shopMenuToggle.classList.toggle('active');
            // Close brand dropdown when opening shop
            if (brandMenuItem && shopMenuItem.classList.contains('active')) {
                brandMenuItem.classList.remove('active');
                if (brandMenuToggle) brandMenuToggle.classList.remove('active');
            }
        });
    }

    // Toggle brand dropdown
    if (brandMenuToggle && brandMenuItem) {
        brandMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            brandMenuItem.classList.toggle('active');
            brandMenuToggle.classList.toggle('active');
            // Close shop dropdown when opening brand
            if (shopMenuItem && brandMenuItem.classList.contains('active')) {
                shopMenuItem.classList.remove('active');
                if (shopMenuToggle) shopMenuToggle.classList.remove('active');
            }
        });
    }

    // Handle FOCUS ON expandable menu
    if (focusToggle && focusOnItem) {
        focusToggle.addEventListener('click', function(e) {
            e.preventDefault();
            focusOnItem.classList.toggle('expanded');
        });
    }

    // Close dropdown when main mobile menu is closed
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    
    function closeAllDropdowns() {
        if (shopMenuItem) {
            shopMenuItem.classList.remove('active');
        }
        if (shopMenuToggle) {
            shopMenuToggle.classList.remove('active');
        }
        if (brandMenuItem) {
            brandMenuItem.classList.remove('active');
        }
        if (brandMenuToggle) {
            brandMenuToggle.classList.remove('active');
        }
        if (focusOnItem) {
            focusOnItem.classList.remove('expanded');
        }
    }

    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', closeAllDropdowns);
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeAllDropdowns);
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeAllDropdowns();
        }
    });
});

// Shop Page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize sticky shop controls
    initStickyShopControls();
    
    // View controls functionality
    const viewBtns = document.querySelectorAll('.view-btn');
    const productsGrid = document.getElementById('productsGrid');
    
    if (viewBtns.length > 0 && productsGrid) {
        viewBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                viewBtns.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                
                // Remove all grid classes
                productsGrid.classList.remove('grid-2', 'grid-4');
                
                // Add new grid class based on data-view
                const viewType = this.getAttribute('data-view');
                if (viewType) {
                    productsGrid.classList.add(viewType);
                }
            });
        });
    }
    
    // Load more functionality
    const loadMoreBtn = document.querySelector('.btn-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            // Simulate loading more products
            this.textContent = 'ЗАГРУЗКА...';
            this.disabled = true;
            
            setTimeout(() => {
                // Here you would typically load more products from server
                // For demo purposes, we'll just change the button text
                this.textContent = 'ПОКАЗАТЬ ЕЩЕ';
                this.disabled = false;
                
                // You could add more product cards here
                console.log('Loading more products...');
            }, 1000);
        });
    }
    
    // Product card hover effects and click handlers
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        card.addEventListener('click', function() {
            // Here you would navigate to product detail page
            const productName = this.querySelector('.product-name').textContent;
            console.log('Clicked on product:', productName);
            // window.location.href = 'product-detail.html?product=' + encodeURIComponent(productName);
        });
    });
    
    // Filter dropdown functionality
    const filterBtn = document.getElementById('filterBtn');
    const filterMenu = document.getElementById('filterMenu');
    const filterOptions = document.querySelectorAll('.filter-option');
    
    if (filterBtn && filterMenu) {
        // Toggle dropdown menu
        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            filterMenu.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
                filterMenu.classList.remove('active');
            }
        });
        
        // Handle filter option clicks
        filterOptions.forEach(option => {
            option.addEventListener('click', function() {
                const sortType = this.getAttribute('data-sort');
                
                // Remove active class from all options
                filterOptions.forEach(opt => opt.classList.remove('active'));
                // Add active class to clicked option
                this.classList.add('active');
                
                // Close dropdown
                filterMenu.classList.remove('active');
                
                // Apply sorting
                sortProducts(sortType);
            });
        });
    }
    
    // Sort products function
    function sortProducts(sortType) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;
        
        const products = Array.from(productsGrid.querySelectorAll('.product-card'));
        
        products.sort((a, b) => {
            switch(sortType) {
                case 'price-asc':
                    const priceA = parseFloat(a.querySelector('.product-price').textContent.replace(/[^\d]/g, ''));
                    const priceB = parseFloat(b.querySelector('.product-price').textContent.replace(/[^\d]/g, ''));
                    return priceA - priceB;
                    
                case 'price-desc':
                    const priceA2 = parseFloat(a.querySelector('.product-price').textContent.replace(/[^\d]/g, ''));
                    const priceB2 = parseFloat(b.querySelector('.product-price').textContent.replace(/[^\d]/g, ''));
                    return priceB2 - priceA2;
                    
                case 'name-asc':
                    const nameA = a.querySelector('.product-name').textContent.toLowerCase();
                    const nameB = b.querySelector('.product-name').textContent.toLowerCase();
                    return nameA.localeCompare(nameB, 'ru');
                    
                case 'name-desc':
                    const nameA2 = a.querySelector('.product-name').textContent.toLowerCase();
                    const nameB2 = b.querySelector('.product-name').textContent.toLowerCase();
                    return nameB2.localeCompare(nameA2, 'ru');
                    
                default:
                    return 0;
            }
        });
        
        // Clear and re-append sorted products
        productsGrid.innerHTML = '';
        products.forEach(product => {
            productsGrid.appendChild(product);
        });
    }
});
