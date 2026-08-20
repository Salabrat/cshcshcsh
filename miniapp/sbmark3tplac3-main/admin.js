// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.categoriesCache = null; // Cache for categories
        this.imageSelections = new Map();
        this.imageDropConfigs = {};
        this.MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
        this.init();
    }

    async init() {
        // Check admin authentication
        await this.checkAdminAuth();
        
        // Initialize navigation
        this.initNavigation();

        this.updateLoaderBrand();
        this.initLoaderBrandObserver();
        
        // Load initial data
        this.loadDashboardData();
        
        // Initialize forms
        this.initForms();
        this.initImageUploadDropzones();
        
        // Initialize admins management
        this.initAdmins();
        
        console.log('Admin Dashboard initialized');
    }

    async updateLoaderBrand() {
        try {
            const els = document.querySelectorAll('.loader-brand');
            if (!els || els.length === 0) return;

            const response = await fetch('/api/site-settings');
            if (!response.ok) return;

            const settings = await response.json();
            const siteName = (settings && typeof settings.siteName === 'string') ? settings.siteName.trim() : '';
            const loadingText = (settings && typeof settings.loadingText === 'string') ? settings.loadingText.trim() : '';
            const logoUrl = (settings && typeof settings.logoUrl === 'string') ? settings.logoUrl.trim() : '';
            const text = loadingText || siteName || 'C.P. COMPANY';

            els.forEach((el) => {
                if (logoUrl) {
                    const img = document.createElement('img');
                    img.className = 'loader-brand-logo';
                    img.alt = text;
                    img.onerror = () => {
                        el.innerHTML = '';
                        el.textContent = text;
                    };
                    img.src = logoUrl;

                    el.innerHTML = '';
                    el.appendChild(img);
                } else {
                    el.innerHTML = '';
                    el.textContent = text;
                }
            });
        } catch (error) {
            console.error('Error updating loader brand:', error);
        }
    }

    initLoaderBrandObserver() {
        if (this._loaderBrandObserver) return;
        if (!document.body) return;

        let scheduled = false;
        const scheduleUpdate = () => {
            if (scheduled) return;
            scheduled = true;
            setTimeout(() => {
                scheduled = false;
                this.updateLoaderBrand();
            }, 0);
        };

        this._loaderBrandObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!node || node.nodeType !== 1) continue;
                    const el = /** @type {HTMLElement} */ (node);
                    if (el.classList && el.classList.contains('loader-brand')) {
                        scheduleUpdate();
                        return;
                    }
                    if (el.querySelector && el.querySelector('.loader-brand')) {
                        scheduleUpdate();
                        return;
                    }
                }
            }
        });

        this._loaderBrandObserver.observe(document.body, { childList: true, subtree: true });
    }
    
    initAdmins() {
        // Show/hide fields based on admin type
        const adminTypeSelect = document.getElementById('adminType');
        if (adminTypeSelect) {
            adminTypeSelect.addEventListener('change', (e) => {
                const type = e.target.value;
                const idGroup = document.getElementById('adminIdGroup');
                const usernameGroup = document.getElementById('adminUsernameGroup');
                
                if (idGroup) idGroup.style.display = type === 'telegram' ? 'block' : 'none';
                if (usernameGroup) usernameGroup.style.display = type === 'website' ? 'block' : 'none';
            });
        }
        
        // Handle add admin form
        const addAdminForm = document.getElementById('addAdminForm');
        if (addAdminForm) {
            addAdminForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleAddAdmin();
            });
        }
        
        // Load admins list
        this.loadAdmins();
    }
    
    async loadAdmins() {
        try {
            const token = localStorage.getItem('adminToken');
            
            // Проверяем, что токен есть
            if (!token) {
                console.error('❌ No admin token found');
                const listContainer = document.getElementById('adminsList');
                if (listContainer) {
                    listContainer.innerHTML = '<p style="text-align: center; color: #ff4444; padding: 20px;">Требуется авторизация. <a href="login.html">Войти</a></p>';
                }
                return;
            }
            
            const response = await fetch('/api/admin-users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('❌ Unauthorized - token expired or invalid');
                    // Токен истек, очищаем и перенаправляем на логин
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminLoggedIn');
                    const listContainer = document.getElementById('adminsList');
                    if (listContainer) {
                        listContainer.innerHTML = '<p style="text-align: center; color: #ff4444; padding: 20px;">Сессия истекла. <a href="login.html">Войти снова</a></p>';
                    }
                    return;
                }
                throw new Error('Failed to fetch admins');
            }
            
            const admins = await response.json();
            const listContainer = document.getElementById('adminsList');
            
            if (!listContainer) return;
            
            if (admins.length === 0) {
                listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Нет админов</p>';
                return;
            }
            
            listContainer.innerHTML = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Тип</th>
                            <th>ID/Username</th>
                            <th>Добавлен</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${admins.map(admin => `
                            <tr>
                                <td>${admin.type === 'telegram' ? 'Telegram' : 'Сайт'}</td>
                                <td>${admin.type === 'telegram' ? admin.id : admin.username}</td>
                                <td>${new Date(admin.addedAt).toLocaleDateString('ru-RU')}</td>
                                <td>
                                    <button class="admin-btn admin-btn-danger" onclick="window.adminDashboard.deleteAdmin('${admin.type === 'telegram' ? admin.id : admin.username}', '${admin.type}')">
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('Error loading admins:', error);
            const listContainer = document.getElementById('adminsList');
            if (listContainer) {
                listContainer.innerHTML = '<p style="text-align: center; color: #ff4444; padding: 20px;">Ошибка загрузки админов</p>';
            }
        }
    }
    
    async handleAddAdmin() {
        const type = document.getElementById('adminType').value;
        const id = document.getElementById('adminId')?.value.trim();
        const username = document.getElementById('adminUsername')?.value.trim();
        
        if (!type) {
            alert('Выберите тип админа');
            return;
        }
        
        if (type === 'telegram' && !id) {
            alert('Введите Telegram ID');
            return;
        }
        
        if (type === 'website' && !username) {
            alert('Введите username');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            if (!token) {
                alert('Требуется авторизация. Перейдите на страницу входа.');
                window.location.href = 'login.html';
                return;
            }
            
            const response = await fetch('/api/admin-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type,
                    id: type === 'telegram' ? id : undefined,
                    username: type === 'website' ? username : undefined
                })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    alert('Сессия истекла. Перейдите на страницу входа.');
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminLoggedIn');
                    window.location.href = 'login.html';
                    return;
                }
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при добавлении админа');
            }
            
            alert('Админ успешно добавлен');
            
            // Reset form
            document.getElementById('addAdminForm').reset();
            document.getElementById('adminIdGroup').style.display = 'none';
            document.getElementById('adminUsernameGroup').style.display = 'none';
            
            // Reload admins list
            this.loadAdmins();
        } catch (error) {
            console.error('Error adding admin:', error);
            alert(error.message || 'Ошибка при добавлении админа');
        }
    }
    
    async deleteAdmin(adminId, adminType) {
        if (!confirm(`Удалить админа ${adminType === 'telegram' ? adminId : adminId}?`)) {
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            
            if (!token) {
                alert('Требуется авторизация. Перейдите на страницу входа.');
                window.location.href = 'login.html';
                return;
            }
            
            const response = await fetch(`/api/admin-users/${adminId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    alert('Сессия истекла. Перейдите на страницу входа.');
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminLoggedIn');
                    window.location.href = 'login.html';
                    return;
                }
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при удалении админа');
            }
            
            alert('Админ успешно удален');
            
            // Reload admins list
            this.loadAdmins();
        } catch (error) {
            console.error('Error deleting admin:', error);
            alert(error.message || 'Ошибка при удалении админа');
        }
    }

    async checkAdminAuth() {
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
        const username = localStorage.getItem('username');
        const token = localStorage.getItem('adminToken');
        
        console.log('Checking admin auth:', {
            isAdmin: isAdmin,
            isLoggedIn: isLoggedIn,
            username: username,
            hasToken: !!token
        });
        
        // Проверяем токен через API, если он есть
        if (token) {
            try {
                const response = await fetch('/api/check-admin', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.isAdmin) {
                        console.log('✅ Admin token verified via API');
                        return; // Токен валиден
                    } else {
                        console.log('❌ Admin token invalid, clearing...');
                        localStorage.removeItem('adminToken');
                        localStorage.removeItem('adminLoggedIn');
                    }
                } else {
                    console.log('❌ Admin token check failed, clearing...');
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminLoggedIn');
                }
            } catch (error) {
                console.error('Error checking admin token:', error);
                // При ошибке сети оставляем локальные флаги, но проверяем их
            }
        }
        
        // Allow access if admin or username is 'admin'
        const canAccess = isAdmin || username === 'admin';
        
        if (!canAccess) {
            const shouldRedirect = confirm('Доступ к админ панели ограничен.\n\nПерейти на страницу входа?');
            if (shouldRedirect) {
                window.location.href = 'login.html';
            } else {
                // Set flag to skip loading screen
                sessionStorage.setItem('skipLoadingScreen', 'true');
                window.location.href = 'index.html';
            }
            return;
        }
        
        console.log('Admin authentication verified');
    }

    initNavigation() {
        const navItems = document.querySelectorAll('.admin-nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.switchSection(section);
            });
        });
    }

    switchSection(sectionName, callback) {
        // Remove active class from all nav items and sections
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Add active class to current nav item and section
        const currentNavItem = document.querySelector(`[data-section="${sectionName}"]`);
        const currentSection = document.getElementById(`${sectionName}-section`);
        
        if (currentNavItem) currentNavItem.classList.add('active');
        if (currentSection) currentSection.classList.add('active');
        
        // Dispatch event for section switch
        document.dispatchEvent(new CustomEvent('sectionSwitched', { detail: sectionName }));
        
        // Load section-specific data
        this.loadSectionData(sectionName);
        
        // Execute callback after section is loaded
        if (callback && typeof callback === 'function') {
            setTimeout(callback, 200);
        }
    }

    async loadDashboardData() {
        try {
            // Load products count
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                let totalProducts = 0;
                
                if (data.products) {
                    Object.values(data.products).forEach(categoryProducts => {
                        totalProducts += categoryProducts.length;
                    });
                }
                
                document.getElementById('totalProducts').textContent = totalProducts;
            }

            // Load categories count
            const categoriesResponse = await fetch('/api/categories');
            if (categoriesResponse.ok) {
                const categories = await categoriesResponse.json();
                const totalCategoriesEl = document.getElementById('totalCategories');
                if (totalCategoriesEl) {
                    totalCategoriesEl.textContent = Array.isArray(categories) ? categories.length : 0;
                }
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'products':
                this.loadProducts();
                break;
            case 'categories':
                // Load categories in admin-categories.js (this will display full category cards)
                if (typeof loadCategories === 'function') {
                    loadCategories();
                }
                // Don't call this.loadCategories() here - it would overwrite the full cards with simple ones
                break;
            case 'images':
                this.loadImages();
                break;
            default:
                break;
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                this.displayProducts(data.products || {});
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async loadCategoriesCache() {
        if (this.categoriesCache) {
            return this.categoriesCache;
        }
        
        this.categoriesCache = {};
        
        // Load ALL categories from categories.json
        try {
            const response = await fetch('/categories.json');
            if (response.ok) {
                const data = await response.json();
                const categories = data.categories || [];
                categories.forEach(category => {
                    this.categoriesCache[category.slug] = category.name;
                });
            }
        } catch (error) {
            console.error('Error loading categories cache:', error);
        }
        
        return this.categoriesCache;
    }

    async getCategoryName(slug) {
        const cache = await this.loadCategoriesCache();
        return cache[slug] || slug.toUpperCase();
    }

    async displayProducts(products) {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        let hasProducts = false;
        
        for (const [category, categoryProducts] of Object.entries(products)) {
            const categoryName = await this.getCategoryName(category);
            
            for (const product of categoryProducts) {
                hasProducts = true;
                const row = document.createElement('tr');
                
                const imageUrl = product.images && product.images.length > 0 
                    ? (product.images[0].url || product.images[0].data || '/placeholder.jpg')
                    : '/placeholder.jpg';
                
                row.innerHTML = `
                    <td>
                        <img src="${imageUrl}" alt="${product.name}" class="product-thumb" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNkMyMi4yIDEyIDI0LjcgMTggMjAgMjRDMTUuMyAxOCAxNy44IDEyIDIwIDE2WiIgZmlsbD0iI0U1RTdFQiIvPgo8L3N2Zz4K'">
                    </td>
                    <td><strong>${product.name}</strong></td>
                    <td>
                        <select class="brand-select" data-product-id="${product.id}" data-current-brand="${product.brandId || 1}" onchange="quickChangeBrand(${product.id}, this.value, ${product.brandId || 1})">
                            <option value="${product.brandId || 1}">${product.brandName || 'C.P. Company'}</option>
                        </select>
                    </td>
                    <td>
                        <select class="category-select" data-product-id="${product.id}" data-current-category="${category}" onchange="quickChangeCategory(${product.id}, this.value, '${category}')">
                            <option value="">${categoryName}</option>
                        </select>
                    </td>
                    <td>${product.sizes ? product.sizes.join(', ') : 'Не указано'}</td>
                    <td><strong>${product.price ? product.price + ' ₽' : 'Не указано'}</strong></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-edit" onclick="editProduct(${product.id})" title="Редактировать">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-action btn-delete" onclick="deleteProduct(${product.id})" title="Удалить">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                `;
                
                tbody.appendChild(row);
                
                // Load categories into the select after adding the row
                const categorySelect = row.querySelector('.category-select');
                if (categorySelect && window.adminDashboard) {
                    window.adminDashboard.loadCategoriesIntoSelect(categorySelect, category).then(() => {
                        categorySelect.value = category;
                    });
                }
                
                // Load brands into the select
                const brandSelect = row.querySelector('.brand-select');
                if (brandSelect && window.adminDashboard) {
                    window.adminDashboard.loadBrandsIntoSelect(brandSelect, product.brandId || 1).then(() => {
                        brandSelect.value = product.brandId || 1;
                    });
                }
            }
        }
        
        if (!hasProducts) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7">
                        <div class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <path d="M16 10a4 4 0 0 1-8 0"></path>
                            </svg>
                            <p>Товары не найдены</p>
                            <button class="admin-btn admin-btn-primary" onclick="showAddProductModal()">Добавить первый товар</button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const categoriesData = await response.json();
                // API already filters out default categories, so we just use what we get
                // Keep full category data including id for editing
                this.displayCategories(categoriesData);
            } else {
                // Show empty if API fails
                this.displayCategories([]);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.displayCategories([]);
        }
    }

    displayCategories(categories) {
        // Only display simple cards on dashboard section, not on categories section
        const categoriesSection = document.getElementById('categories-section');
        if (categoriesSection && categoriesSection.classList.contains('active')) {
            // If we're on categories section, don't overwrite - let admin-categories.js handle it
            return;
        }
        
        const grid = document.getElementById('categoriesGrid');
        if (!grid) return;
        
        if (!categories || categories.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <p style="color: #666;">Категории не найдены</p>
                    <button class="admin-btn admin-btn-primary" style="margin-top: 16px;" onclick="switchSection('categories')">
                        Добавить категорию
                    </button>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = categories.map(category => `
            <div class="category-card">
                <h3>${category.name}</h3>
                <p>${category.productCount || 0} товаров</p>
                <div class="category-actions">
                    <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="switchToCategoryEdit('${category.id}')">Управление</button>
                </div>
            </div>
        `).join('');
    }

    loadImages() {
        // Load current login image
        this.loadLoginImage();
    }

    async loadLoginImage() {
        try {
            const response = await fetch('/api/login-image');
            if (response.ok) {
                const data = await response.json();
                const preview = document.getElementById('loginImagePreview');
                if (preview && data.loginImage) {
                    preview.src = data.loginImage;
                }
            }
        } catch (error) {
            console.error('Error loading login image:', error);
        }
    }

    initForms() {
        // Add Product Form
        const addProductForm = document.getElementById('addProductForm');
        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddProduct(e);
            });
        }
    }

    initImageUploadDropzones() {
        this.setupImageDropArea('productImageDropArea', 'productImage', 'productImagePreview', { maxFiles: 6 });
        this.setupImageDropArea('editProductImageDropArea', 'editProductImage', 'editProductImagePreview', { maxFiles: 6 });
    }

    ensureImageSelection(previewId) {
        if (!this.imageSelections.has(previewId)) {
            this.imageSelections.set(previewId, []);
        }
    }

    setupImageDropArea(dropAreaId, inputId, previewId, options = {}) {
        const dropArea = document.getElementById(dropAreaId);
        const fileInput = document.getElementById(inputId);
        const preview = document.getElementById(previewId);

        this.ensureImageSelection(previewId);
        this.imageDropConfigs[previewId] = {
            maxFiles: options.maxFiles || 6
        };

        if (!dropArea || !fileInput || !preview || dropArea.dataset.dropInit === 'true') {
            return;
        }

        const preventDefaults = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults);
        });

        const highlight = () => dropArea.classList.add('drag-over');
        const unhighlight = () => dropArea.classList.remove('drag-over');

        dropArea.addEventListener('dragenter', highlight);
        dropArea.addEventListener('dragover', highlight);
        dropArea.addEventListener('dragleave', unhighlight);
        dropArea.addEventListener('drop', (event) => {
            unhighlight();
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) {
                this.handleImageFiles(previewId, fileInput, preview, files);
            }
        });

        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                this.handleImageFiles(previewId, fileInput, preview, files);
            }
        });

        if (preview.dataset.removeListener !== 'true') {
            preview.addEventListener('click', (event) => {
                const removeButton = event.target.closest('[data-remove-image]');
                if (!removeButton) return;
                const selectionKey = removeButton.dataset.removeImage;
                const index = parseInt(removeButton.dataset.index, 10);
                if (Number.isNaN(index)) return;
                this.removeImageFromSelection(selectionKey, fileInput, preview, index);
            });
            preview.dataset.removeListener = 'true';
        }

        dropArea.dataset.dropInit = 'true';
    }

    handleImageFiles(previewId, fileInput, preview, files) {
        if (!fileInput || !preview) return;

        const config = this.imageDropConfigs[previewId] || { maxFiles: 6 };
        const currentSelection = [...(this.imageSelections.get(previewId) || [])];
        const incomingFiles = Array.from(files || []);
        let filesAdded = false;
        let limitReached = false;

        for (const file of incomingFiles) {
            if (!this.validateImageFile(file)) {
                continue;
            }

            if (currentSelection.length >= config.maxFiles) {
                limitReached = true;
                break;
            }

            currentSelection.push(file);
            filesAdded = true;
        }

        if (limitReached) {
            alert(`Можно загрузить не более ${config.maxFiles} изображений.`);
        }

        if (!filesAdded) {
            return;
        }

        this.imageSelections.set(previewId, currentSelection);
        this.syncFileInputWithSelection(fileInput, currentSelection);
        this.renderImagePreview(preview, currentSelection);
    }

    validateImageFile(file) {
        if (!file.type || !file.type.startsWith('image/')) {
            alert('Пожалуйста, загрузите файл изображения (JPG, PNG, WebP).');
            return false;
        }

        if (file.size > this.MAX_IMAGE_SIZE) {
            alert('Файл слишком большой. Максимальный размер изображения 5 МБ.');
            return false;
        }

        return true;
    }

    syncFileInputWithSelection(fileInput, files) {
        if (!fileInput || typeof DataTransfer === 'undefined') {
            return;
        }

        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
    }

    renderImagePreview(previewElement, files) {
        if (!previewElement) return;

        previewElement.classList.toggle('has-images', files.length > 0);

        if (!files.length) {
            previewElement.innerHTML = '';
            return;
        }

        const gridHtml = files.map((file, index) => {
            const objectUrl = URL.createObjectURL(file);
            return `
                <div class="image-preview-item">
                    <img src="${objectUrl}" data-object-url="${objectUrl}" alt="Загруженное изображение ${index + 1}">
                    <button type="button" class="image-remove-btn" aria-label="Удалить изображение" data-remove-image="${previewElement.id}" data-index="${index}">&times;</button>
                </div>
            `;
        }).join('');

        previewElement.innerHTML = `<div class="image-preview-grid">${gridHtml}</div>`;

        previewElement.querySelectorAll('[data-object-url]').forEach((img) => {
            const objectUrl = img.getAttribute('data-object-url');
            if (!objectUrl) return;
            const revoke = () => {
                URL.revokeObjectURL(objectUrl);
                img.removeAttribute('data-object-url');
                img.removeEventListener('load', revoke);
                img.removeEventListener('error', revoke);
            };
            img.addEventListener('load', revoke);
            img.addEventListener('error', revoke);
        });
    }

    removeImageFromSelection(previewId, fileInput, preview, index) {
        const selection = [...(this.imageSelections.get(previewId) || [])];
        if (index < 0 || index >= selection.length) return;
        selection.splice(index, 1);
        this.imageSelections.set(previewId, selection);
        this.syncFileInputWithSelection(fileInput, selection);
        this.renderImagePreview(preview, selection);
    }

    resetImageSelection(previewId, inputId) {
        this.imageSelections.set(previewId, []);
        const fileInput = document.getElementById(inputId);
        if (fileInput) {
            fileInput.value = '';
            if (typeof DataTransfer !== 'undefined') {
                const dataTransfer = new DataTransfer();
                fileInput.files = dataTransfer.files;
            }
        }
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.classList.remove('has-images');
            preview.innerHTML = '';
        }
    }

    getSelectedFiles(previewId) {
        return [...(this.imageSelections.get(previewId) || [])];
    }

    async uploadSelectedImages(files) {
        const uploaded = [];
        for (const file of files) {
            const uploadResult = await this.uploadSingleImage(file);
            if (uploadResult?.url) {
                uploaded.push(uploadResult);
            }
        }
        return uploaded;
    }

    async uploadSingleImage(file) {
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: uploadFormData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(errorText || 'Ошибка при загрузке изображения');
        }

        return uploadResponse.json();
    }

    async handleAddProduct(e) {
        const formData = new FormData(e.target);
        const brandSelect = document.getElementById('productBrand');
        const selectedBrandOption = brandSelect ? brandSelect.options[brandSelect.selectedIndex] : null;
        
        const rawCategory = (formData.get('productCategory') || '').trim();
        if (!rawCategory) {
            alert('Выберите категорию перед добавлением товара.');
            return;
        }

        const priceRaw = (formData.get('productPrice') || '').replace(/[^0-9]/g, '');
        const parsedPrice = priceRaw ? parseInt(priceRaw, 10) : 0;
        const oldPriceRaw = (formData.get('productOldPrice') || '').replace(/[^0-9]/g, '');
        const newPriceRaw = (formData.get('productNewPrice') || '').replace(/[^0-9]/g, '');
        const hasOldPrice = !!oldPriceRaw;
        const hasNewPrice = !!newPriceRaw;

        if (hasOldPrice !== hasNewPrice) {
            alert('Чтобы применить скидку, заполните оба поля: старую и новую цену.');
            return;
        }

        let oldPriceValue = null;
        let newPriceValue = null;
        if (hasOldPrice && hasNewPrice) {
            oldPriceValue = parseInt(oldPriceRaw, 10) || null;
            newPriceValue = parseInt(newPriceRaw, 10) || null;
            if (!oldPriceValue || !newPriceValue) {
                alert('Проверьте значения скидки — используйте только цифры.');
                return;
            }
            if (newPriceValue >= oldPriceValue) {
                alert('Цена со скидкой должна быть меньше старой цены.');
                return;
            }
        }

        const productData = {
            name: formData.get('productName'),
            category: rawCategory,
            description: formData.get('productDescription'),
            price: parsedPrice,
            oldPrice: oldPriceValue || undefined,
            newPrice: newPriceValue || undefined,
            brandId: parseInt(formData.get('productBrand')),
            brandName: selectedBrandOption ? selectedBrandOption.getAttribute('data-brand-name') : 'C.P. Company',
            sizes: Array.from(formData.getAll('sizes')),
            isTrending: formData.get('isTrending') === 'on',
            images: [],
            image: ''
        };

        const selectedImageFiles = this.getSelectedFiles('productImagePreview');
        if (selectedImageFiles.length === 0) {
            alert('Добавьте хотя бы одно фото товара.');
            return;
        }
        if (selectedImageFiles.length > 0) {
            try {
                productData.images = await this.uploadSelectedImages(selectedImageFiles);
            } catch (error) {
                console.error('Error uploading images:', error);
                alert('Ошибка загрузки изображений. Попробуйте еще раз.');
                return;
            }
        }

        if (productData.images.length > 0) {
            const firstImage = productData.images[0];
            productData.image = typeof firstImage === 'string' ? firstImage : (firstImage?.url || firstImage?.data || '');
        }
        
        try {
            const categorySlugForEndpoint = encodeURIComponent(rawCategory);
            const response = await fetch(`/api/products/${categorySlugForEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            
            if (response.ok) {
                alert('Товар успешно добавлен!');
                this.closeAddProductModal();
                this.resetImageSelection('productImagePreview', 'productImage');
                this.loadProducts();
                this.loadDashboardData();
            } else {
                alert('Ошибка при добавлении товара');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            alert('Ошибка при добавлении товара');
        }
    }

    async loadCategoriesIntoSelect(selectElement, currentCategory = null) {
        if (!selectElement) return;
        
        // Start with default option
        selectElement.innerHTML = '<option value="">Выберите категорию</option>';
        
        // Load only admin-created categories (excluding default ones)
        try {
            const response = await fetch('/api/categories');
            
            if (response.ok) {
                const categories = await response.json();
                // Filter out sweaters and pants categories
                const filteredCategories = categories.filter(c => c.slug !== 'sweaters' && c.slug !== 'pants');
                const categorySlugs = filteredCategories.map(c => c.slug);
                
                // If current category is not in the list and it's not sweaters or pants, add it first
                if (currentCategory && currentCategory !== 'sweaters' && currentCategory !== 'pants' && !categorySlugs.includes(currentCategory)) {
                    const currentCategoryName = await this.getCategoryName(currentCategory);
                    selectElement.innerHTML += `<option value="${currentCategory}">${currentCategoryName} (текущая)</option>`;
                }
                
                // Add only custom categories to select (excluding sweaters and pants)
                filteredCategories.forEach(category => {
                    selectElement.innerHTML += `<option value="${category.slug}">${category.name}</option>`;
                });
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async loadBrandsIntoSelect(selectElement, currentBrandId = null) {
        if (!selectElement) return;
        
        try {
            const response = await fetch('/api/brands');
            
            if (response.ok) {
                const brands = await response.json();
                selectElement.innerHTML = '';
                
                // Add all active brands to select
                brands.forEach(brand => {
                    if (brand.isActive) {
                        const selected = currentBrandId && brand.id === currentBrandId ? 'selected' : '';
                        selectElement.innerHTML += `<option value="${brand.id}" data-brand-name="${brand.name}" ${selected}>${brand.name}</option>`;
                    }
                });
            }
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    }

    async showAddProductModal() {
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.style.display = 'flex';
            this.resetImageSelection('productImagePreview', 'productImage');
            
            // Load brands into select dropdown
            try {
                const response = await fetch('/api/brands');
                if (response.ok) {
                    const brands = await response.json();
                    const brandSelect = document.getElementById('productBrand');
                    if (brandSelect) {
                        brandSelect.innerHTML = '<option value="">Выберите бренд</option>';
                        brands.forEach(brand => {
                            if (brand.isActive) {
                                brandSelect.innerHTML += `<option value="${brand.id}" data-brand-name="${brand.name}">${brand.name}</option>`;
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading brands:', error);
            }
            
            // Load categories into select dropdown
            const categorySelect = document.getElementById('productCategory');
            await this.loadCategoriesIntoSelect(categorySelect);
        }
    }

    closeAddProductModal() {
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.style.display = 'none';
            // Reset form
            const form = document.getElementById('addProductForm');
            if (form) form.reset();
            this.resetImageSelection('productImagePreview', 'productImage');
        }
    }
}

// Global functions
function switchSection(sectionName) {
    if (window.adminDashboard) {
        window.adminDashboard.switchSection(sectionName);
    }
}

function showAddProductModal() {
    if (window.adminDashboard) {
        window.adminDashboard.showAddProductModal();
    }
}

function closeAddProductModal() {
    if (window.adminDashboard) {
        window.adminDashboard.closeAddProductModal();
    }
}

function logout() {
    // Clear all admin-related data
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('userLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('userEmail');
    // Set flag to skip loading screen
    sessionStorage.setItem('skipLoadingScreen', 'true');
    window.location.href = 'index.html';
}

function saveSettings() {
    alert('Настройки сохранены!');
}

function saveProducts() {
    if (window.adminDashboard) {
        window.adminDashboard.loadProducts();
        window.adminDashboard.loadDashboardData();
        alert('Товары обновлены!');
    } else {
        alert('Ошибка: панель администратора не инициализирована');
    }
}

async function editProduct(id) {
    try {
        // Получаем данные товара
        const response = await fetch(`/api/product/${id}`);
        if (!response.ok) {
            alert('Ошибка при загрузке данных товара');
            return;
        }
        
        const product = await response.json();
        
        // Открываем модальное окно редактирования
        showEditProductModal(product);
    } catch (error) {
        console.error('Error loading product:', error);
        alert('Ошибка при загрузке данных товара');
    }
}

async function deleteProduct(id) {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        try {
            const response = await fetch(`/api/product/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('Товар успешно удален!');
                // Перезагружаем список товаров
                if (window.adminDashboard) {
                    window.adminDashboard.loadProducts();
                    window.adminDashboard.loadDashboardData();
                }
            } else {
                const error = await response.json();
                alert(`Ошибка при удалении товара: ${error.error || 'Неизвестная ошибка'}`);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Ошибка при удалении товара');
        }
    }
}

function addColorInput() {
    const container = document.getElementById('colorInputs');
    const newRow = document.createElement('div');
    newRow.className = 'color-input-row';
    newRow.innerHTML = `
        <input type="text" name="colors" placeholder="Название цвета" class="form-control">
        <input type="color" name="colorValues" value="#000000" class="color-picker">
        <button type="button" class="btn-remove-color" onclick="removeColorInput(this)">×</button>
    `;
    container.appendChild(newRow);
}

function removeColorInput(button) {
    button.parentElement.remove();
}

// Функции для модального окна редактирования
async function showEditProductModal(product) {
    // Создаем модальное окно, если его еще нет
    let modal = document.getElementById('editProductModal');
    if (!modal) {
        modal = createEditProductModal();
        document.body.appendChild(modal);
    }
    
    if (window.adminDashboard) {
        window.adminDashboard.resetImageSelection('editProductImagePreview', 'editProductImage');
    }

    // Загружаем бренды
    let brandsLoaded = false;
    try {
        const response = await fetch('/api/brands');
        if (response.ok) {
            const brands = await response.json();
            const brandSelect = document.getElementById('editProductBrand');
            if (brandSelect) {
                brandSelect.innerHTML = '<option value="">Выберите бренд</option>';
                brands.forEach(brand => {
                    if (brand.isActive) {
                        brandSelect.innerHTML += `<option value="${brand.id}" data-brand-name="${brand.name}">${brand.name}</option>`;
                    }
                });
                brandsLoaded = true;
            }
        }
    } catch (error) {
        console.error('Error loading brands for edit modal:', error);
    }
    
    // Загружаем категории
    const categorySelect = document.getElementById('editProductCategory');
    if (categorySelect && window.adminDashboard) {
        await window.adminDashboard.loadCategoriesIntoSelect(categorySelect);
    }
    
    // Заполняем форму данными товара
    const form = document.getElementById('editProductForm');
    if (form) {
        form.dataset.productId = product.id;
        form.querySelector('[name="productName"]').value = product.name || '';
        form.querySelector('[name="productDescription"]').value = product.description || '';
        form.querySelector('[name="productPrice"]').value = product.price || '';
        form.querySelector('[name="productOldPrice"]').value = product.oldPrice || '';
        form.querySelector('[name="productNewPrice"]').value = product.newPrice || '';
        
        // Устанавливаем бренд только если он существует в списке
        const brandSelect = form.querySelector('[name="productBrand"]');
        if (brandSelect && brandsLoaded) {
            const brandId = product.brandId || '';
            // Проверяем, существует ли такой option
            const optionExists = Array.from(brandSelect.options).some(opt => opt.value == brandId);
            if (optionExists && brandId) {
                brandSelect.value = brandId;
            } else {
                // Если бренд не найден, оставляем "Выберите бренд"
                brandSelect.value = '';
            }
        }
        
        // Устанавливаем категорию (используем slug)
        const categorySelectField = form.querySelector('[name="productCategory"]');
        if (categorySelectField) {
            categorySelectField.value = product.category || '';
        }
        
        // Устанавливаем размеры
        const sizeCheckboxes = form.querySelectorAll('[name="sizes"]');
        sizeCheckboxes.forEach(checkbox => {
            checkbox.checked = product.sizes && product.sizes.includes(checkbox.value);
        });
        
        // Показываем текущие изображения
        const imagePreview = document.getElementById('editProductImagePreview');
        if (imagePreview) {
            imagePreview.innerHTML = '';
            if (product.images && product.images.length > 0) {
                const grid = document.createElement('div');
                grid.className = 'image-preview-grid existing-images';
                product.images.forEach(image => {
                    const item = document.createElement('div');
                    item.className = 'image-preview-item';
                    const img = document.createElement('img');
                    img.src = image.url || image.data || '';
                    img.alt = 'Текущее изображение товара';
                    item.appendChild(img);
                    grid.appendChild(item);
                });
                imagePreview.appendChild(grid);
            }
        }
        
        // Устанавливаем статус "В тренде"
        const trendingCheckbox = form.querySelector('[name="isTrending"]');
        if (trendingCheckbox) {
            trendingCheckbox.checked = product.isTrending || false;
        }
    }
    
    modal.style.display = 'flex';
}

function createEditProductModal() {
    const modal = document.createElement('div');
    modal.id = 'editProductModal';
    modal.className = 'admin-modal';
    modal.innerHTML = `
        <div class="admin-modal-content admin-modal-wide">
            <div class="admin-modal-header">
                <h2>Редактировать товар</h2>
                <button class="admin-modal-close" onclick="closeEditProductModal()">&times;</button>
            </div>
            <form id="editProductForm" class="admin-form admin-form-grid">
                <!-- Основная информация -->
                <div class="form-section">
                    <h3 class="form-section-title">Основная информация</h3>
                    
                    <div class="form-group">
                        <label for="editProductName">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Название товара
                        </label>
                        <input type="text" id="editProductName" name="productName" required class="form-control" placeholder="Введите название товара">
                    </div>
                    
                    <div class="form-group">
                        <label for="editProductDescription">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            Описание
                        </label>
                        <textarea id="editProductDescription" name="productDescription" rows="6" class="form-control" placeholder="Подробное описание товара"></textarea>
                    </div>
                </div>

                <!-- Цена и категории -->
                <div class="form-section">
                    <h3 class="form-section-title">Классификация</h3>
                    
                    <div class="form-group">
                        <label for="editProductPrice">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            Цена (₽)
                        </label>
                        <input type="text" id="editProductPrice" name="productPrice" class="form-control" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1v22"></path>
                                <path d="M5 6h9a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11"></path>
                            </svg>
                            Скидка (необязательно)
                        </label>
                        <div class="discount-fields">
                            <div class="discount-field">
                                <span class="discount-label">Старая цена</span>
                                <input type="text" id="editProductOldPrice" name="productOldPrice" class="form-control" placeholder="Например, 19 990">
                            </div>
                            <div class="discount-field">
                                <span class="discount-label">Цена со скидкой</span>
                                <input type="text" id="editProductNewPrice" name="productNewPrice" class="form-control" placeholder="Например, 14 990">
                            </div>
                        </div>
                        <small class="form-hint">Заполните оба поля, чтобы сохранить скидку.</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="editProductBrand">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1"></path>
                                <polygon points="12 15 17 21 7 21 12 15"></polygon>
                            </svg>
                            Бренд
                        </label>
                        <select id="editProductBrand" name="productBrand" required class="form-control">
                            <option value="">Выберите бренд</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="editProductCategory">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            Категория
                        </label>
                        <select id="editProductCategory" name="productCategory" required class="form-control">
                            <option value="">Выберите категорию</option>
                        </select>
                    </div>
                </div>

                <!-- Размеры и опции -->
                <div class="form-section">
                    <h3 class="form-section-title">Размеры</h3>
                    
                    <div class="form-group">
                        <label>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                            Доступные размеры
                        </label>
                        <div class="sizes-group">
                            <label class="size-checkbox">
                                <input type="checkbox" name="sizes" value="XS">
                                <span>XS</span>
                            </label>
                            <label class="size-checkbox">
                                <input type="checkbox" name="sizes" value="S">
                                <span>S</span>
                            </label>
                            <label class="size-checkbox">
                                <input type="checkbox" name="sizes" value="M">
                                <span>M</span>
                            </label>
                            <label class="size-checkbox">
                                <input type="checkbox" name="sizes" value="L">
                                <span>L</span>
                            </label>
                            <label class="size-checkbox">
                                <input type="checkbox" name="sizes" value="XL">
                                <span>XL</span>
                            </label>
                            <label class="size-checkbox">
                                <input type="checkbox" name="sizes" value="XXL">
                                <span>XXL</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label checkbox-label-featured">
                            <input type="checkbox" name="isTrending">
                            <span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                                В тренде
                            </span>
                        </label>
                    </div>
                </div>

                <!-- Изображение -->
                <div class="form-section">
                    <h3 class="form-section-title">Изображение</h3>
                    
                    <div class="form-group">
                        <label for="editProductImage" class="file-upload-label">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            Загрузить
                        </label>
                        <input type="file" id="editProductImage" name="productImage" accept="image/*" class="form-control file-input">
                        <div id="editProductImagePreview" class="image-preview"></div>
                    </div>
                </div>
                
                <div class="form-actions form-section-full">
                    <button type="button" class="admin-btn admin-btn-secondary" onclick="closeEditProductModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Отмена
                    </button>
                    <button type="submit" class="admin-btn admin-btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Сохранить изменения
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Добавляем обработчик формы
    const form = modal.querySelector('#editProductForm');
    form.addEventListener('submit', handleEditProduct);
    if (window.adminDashboard) {
        window.adminDashboard.setupImageDropArea('editProductImageDropArea', 'editProductImage', 'editProductImagePreview', { maxFiles: 6 });
    }
    
    return modal;
}

function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.style.display = 'none';
        if (window.adminDashboard) {
            window.adminDashboard.resetImageSelection('editProductImagePreview', 'editProductImage');
        }
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    
    const form = e.target;
    const productId = form.dataset.productId;
    
    if (!productId) {
        alert('Ошибка: ID товара не найден');
        return;
    }
    
    const formData = new FormData(form);
    const brandSelect = document.getElementById('editProductBrand');
    const selectedBrandOption = brandSelect ? brandSelect.options[brandSelect.selectedIndex] : null;
    
    const priceRaw = (formData.get('productPrice') || '').replace(/[^0-9]/g, '');
    const parsedPrice = priceRaw ? parseInt(priceRaw, 10) : 0;
    const oldPriceRaw = (formData.get('productOldPrice') || '').replace(/[^0-9]/g, '');
    const newPriceRaw = (formData.get('productNewPrice') || '').replace(/[^0-9]/g, '');
    const hasOldPrice = !!oldPriceRaw;
    const hasNewPrice = !!newPriceRaw;

    if (hasOldPrice !== hasNewPrice) {
        alert('Чтобы применить скидку, заполните оба поля: старую и новую цену.');
        return;
    }

    let oldPriceValue = null;
    let newPriceValue = null;
    if (hasOldPrice && hasNewPrice) {
        oldPriceValue = parseInt(oldPriceRaw, 10) || null;
        newPriceValue = parseInt(newPriceRaw, 10) || null;
        if (!oldPriceValue || !newPriceValue) {
            alert('Проверьте значения скидки — используйте только цифры.');
            return;
        }
        if (newPriceValue >= oldPriceValue) {
            alert('Цена со скидкой должна быть меньше старой цены.');
            return;
        }
    }

    const productData = {
        name: formData.get('productName'),
        description: formData.get('productDescription'),
        price: parsedPrice,
        oldPrice: oldPriceValue || undefined,
        newPrice: newPriceValue || undefined,
        category: formData.get('productCategory'),
        brandId: parseInt(formData.get('productBrand')),
        brandName: selectedBrandOption ? selectedBrandOption.getAttribute('data-brand-name') : 'C.P. Company',
        sizes: Array.from(formData.getAll('sizes')),
        isTrending: formData.get('isTrending') === 'on'
    };
    
    const newImageFiles = window.adminDashboard ? window.adminDashboard.getSelectedFiles('editProductImagePreview') : [];
    if (newImageFiles.length > 0) {
        try {
            productData.images = await window.adminDashboard.uploadSelectedImages(newImageFiles);
        } catch (error) {
            console.error('Error uploading images:', error);
            alert('Ошибка загрузки изображений. Попробуйте еще раз.');
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/product/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            alert('Товар успешно обновлен!');
            closeEditProductModal();
            if (window.adminDashboard) {
                window.adminDashboard.resetImageSelection('editProductImagePreview', 'editProductImage');
            }
            // Перезагружаем список товаров
            if (window.adminDashboard) {
                window.adminDashboard.loadProducts();
                window.adminDashboard.loadDashboardData();
            }
        } else {
            const error = await response.json();
            alert(`Ошибка при обновлении товара: ${error.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Ошибка при обновлении товара');
    }
}

// Global function to switch to category edit
function switchToCategoryEdit(categoryId) {
    if (window.adminDashboard) {
        window.adminDashboard.switchSection('categories', () => {
            // Wait for categories to load, then open edit modal
            setTimeout(() => {
                if (typeof editCategory === 'function') {
                    editCategory(categoryId);
                } else {
                    // If editCategory is not yet available, try again
                    setTimeout(() => {
                        if (typeof editCategory === 'function') {
                            editCategory(categoryId);
                        }
                    }, 300);
                }
            }, 300);
        });
    }
}

// Quick change category function
async function quickChangeCategory(productId, newCategory, oldCategory) {
    if (!newCategory || newCategory === oldCategory) {
        return;
    }
    
    if (!confirm(`Изменить категорию товара?`)) {
        // Reset select to old value
        const select = document.querySelector(`select.category-select[data-product-id="${productId}"]`);
        if (select) {
            select.value = oldCategory;
        }
        return;
    }
    
    try {
        // Get product data
        const response = await fetch(`/api/product/${productId}`);
        if (!response.ok) {
            throw new Error('Failed to load product');
        }
        
        const product = await response.json();
        
        // Update product category
        const updateResponse = await fetch(`/api/product/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...product,
                category: newCategory
            })
        });
        
        if (updateResponse.ok) {
            alert('Категория успешно изменена!');
            // Reload products
            if (window.adminDashboard) {
                window.adminDashboard.loadProducts();
                window.adminDashboard.loadDashboardData();
            }
        } else {
            throw new Error('Failed to update product');
        }
    } catch (error) {
        console.error('Error changing category:', error);
        alert('Ошибка при изменении категории');
        // Reset select to old value
        const select = document.querySelector(`select.category-select[data-product-id="${productId}"]`);
        if (select) {
            select.value = oldCategory;
        }
    }
}

// Quick change brand function
async function quickChangeBrand(productId, newBrandId, oldBrandId) {
    newBrandId = parseInt(newBrandId);
    oldBrandId = parseInt(oldBrandId);
    
    if (!newBrandId || newBrandId === oldBrandId) {
        return;
    }
    
    // Get brand name from the select option
    const select = document.querySelector(`select.brand-select[data-product-id="${productId}"]`);
    const selectedOption = select ? select.options[select.selectedIndex] : null;
    const newBrandName = selectedOption ? selectedOption.getAttribute('data-brand-name') : '';
    
    if (!confirm(`Изменить бренд товара на "${newBrandName}"?`)) {
        // Reset select to old value
        if (select) {
            select.value = oldBrandId;
        }
        return;
    }
    
    try {
        // Get product data
        const response = await fetch(`/api/product/${productId}`);
        if (!response.ok) {
            throw new Error('Failed to load product');
        }
        
        const product = await response.json();
        
        // Update product brand
        const updateResponse = await fetch(`/api/product/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...product,
                brandId: newBrandId,
                brandName: newBrandName
            })
        });
        
        if (updateResponse.ok) {
            alert('Бренд успешно изменён!');
            // Reload products
            if (window.adminDashboard) {
                window.adminDashboard.loadProducts();
                window.adminDashboard.loadDashboardData();
            }
        } else {
            throw new Error('Failed to update product');
        }
    } catch (error) {
        console.error('Error changing brand:', error);
        alert('Ошибка при изменении бренда');
        // Reset select to old value
        if (select) {
            select.value = oldBrandId;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminDashboard = new AdminDashboard();
});
