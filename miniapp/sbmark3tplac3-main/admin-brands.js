// Admin Brands Management
class BrandsManager {
    constructor() {
        this.brands = [];
        this.init();
    }

    init() {
        this.loadBrands();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add brand form submission
        const addBrandForm = document.getElementById('add-brand-form');
        if (addBrandForm) {
            addBrandForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addBrand();
            });
        }

        // Setup logo preview for new brand form
        const logoInput = document.getElementById('brand-logo-input');
        const logoUrlInput = document.getElementById('brand-logo-url-input');
        const previewContainer = document.getElementById('brand-logo-preview-container');
        const previewImg = document.getElementById('brand-logo-preview-img');

        if (logoInput && previewContainer && previewImg) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewImg.src = event.target.result;
                        previewContainer.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    previewContainer.style.display = 'none';
                }
            });
        }

        if (logoUrlInput && previewContainer && previewImg) {
            logoUrlInput.addEventListener('input', (e) => {
                const url = e.target.value.trim();
                if (url) {
                    previewImg.src = url;
                    previewContainer.style.display = 'block';
                } else {
                    previewContainer.style.display = 'none';
                }
            });
        }
    }

    getAuthHeaders() {
        const token = localStorage.getItem('adminToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    async checkAuthAndRelogin() {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            this.showMessage('Необходимо войти в систему как администратор', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
        
        // Verify token is still valid
        try {
            const response = await fetch('/api/check-admin', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (!data.isAdmin) {
                this.showMessage('Сессия истекла. Пожалуйста, войдите снова.', 'error');
                localStorage.removeItem('adminToken');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Auth check error:', error);
            return true; // Continue anyway, let the API call fail if needed
        }
    }

    async loadBrands() {
        try {
            const response = await fetch('/api/brands');
            if (response.ok) {
                const brands = await response.json();
                this.brands = brands;
                console.log('Brands loaded:', brands.map(b => ({ id: b.id, name: b.name, logo: b.logo, hasLogo: !!(b.logo || b.image) })));
                this.renderBrands();
            } else {
                console.error('Error loading brands, status:', response.status);
                this.showMessage('Ошибка загрузки брендов', 'error');
            }
        } catch (error) {
            console.error('Error loading brands:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    renderBrands() {
        const brandsList = document.getElementById('brands-list');
        if (!brandsList) return;

        if (this.brands.length === 0) {
            brandsList.innerHTML = '<p class="empty-message">Нет добавленных брендов</p>';
            return;
        }

        brandsList.innerHTML = this.brands.map(brand => {
            const logoUrl = brand.logo || brand.image || '';
            const hasLogo = logoUrl && logoUrl.trim() !== '' && logoUrl !== 'null' && logoUrl !== 'undefined';
            
            // Debug logging
            if (brand.name === 'C.P. Company') {
                console.log('Rendering brand:', brand.name, 'logo:', logoUrl, 'hasLogo:', hasLogo);
            }
            
            return `
            <div class="brand-item ${!brand.isActive ? 'inactive' : ''}" data-brand-id="${brand.id}">
                <div class="brand-logo-preview">
                    ${hasLogo ? 
                        `<img src="${logoUrl}" alt="${brand.name}" class="brand-logo-img" onerror="this.parentElement.querySelector('.brand-logo-placeholder').style.display='flex'; this.style.display='none'">` :
                        ''
                    }
                    <div class="brand-logo-placeholder" style="${hasLogo ? 'display: none;' : 'display: flex;'}">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="brand-info">
                    <h3 class="brand-name">${brand.name}</h3>
                    <span class="brand-status">${brand.isActive ? 'Активный' : 'Неактивный'}</span>
                </div>
                <div class="brand-actions">
                    <button class="btn-edit" onclick="brandsManager.editBrand(${brand.id})" title="Редактировать">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    async addBrand() {
        const nameInput = document.getElementById('brand-name-input');
        const descriptionInput = document.getElementById('brand-description-input');
        const logoInput = document.getElementById('brand-logo-input');
        const logoUrlInput = document.getElementById('brand-logo-url-input');

        if (!nameInput || !nameInput.value.trim()) {
            this.showMessage('Введите название бренда', 'error');
            return;
        }

        const brandName = nameInput.value.trim();
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        let logoUrl = '';

        // Check authorization first
        const isAuthorized = await this.checkAuthAndRelogin();
        if (!isAuthorized) return;

        // Handle logo upload or URL
        if (logoInput && logoInput.files.length > 0) {
            // Upload file
            const file = logoInput.files[0];
            const formData = new FormData();
            formData.append('image', file);

            try {
                const token = localStorage.getItem('adminToken');
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }

                const uploadData = await uploadResponse.json();
                logoUrl = uploadData.url;
            } catch (error) {
                console.error('Error uploading logo:', error);
                this.showMessage('Ошибка при загрузке изображения', 'error');
                return;
            }
        } else if (logoUrlInput && logoUrlInput.value.trim()) {
            logoUrl = logoUrlInput.value.trim();
        }

        try {
            const brandData = {
                name: brandName,
                description: description || undefined,
                logo: logoUrl || undefined
            };

            const response = await fetch('/api/brands', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(brandData)
            });

            if (response.ok) {
                const newBrand = await response.json();
                this.brands.push(newBrand);
                this.renderBrands();
                
                // Clear form
                nameInput.value = '';
                if (descriptionInput) descriptionInput.value = '';
                if (logoInput) logoInput.value = '';
                if (logoUrlInput) logoUrlInput.value = '';
                const previewContainer = document.getElementById('brand-logo-preview-container');
                if (previewContainer) previewContainer.style.display = 'none';
                
                this.showMessage(`Бренд "${brandName}" успешно добавлен`, 'success');
            } else if (response.status === 401) {
                this.showMessage('Ошибка авторизации. Пожалуйста, войдите снова.', 'error');
                localStorage.removeItem('adminToken');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Ошибка при добавлении бренда', 'error');
            }
        } catch (error) {
            console.error('Error adding brand:', error);
            this.showMessage('Ошибка подключения к серверу. Убедитесь, что сервер запущен.', 'error');
        }
    }

    editBrand(brandId) {
        const brand = this.brands.find(b => b.id === brandId);
        if (!brand) return;

        this.openEditBrandModal(brandId);
    }

    async toggleBrand(brandId) {
        const brand = this.brands.find(b => b.id === brandId);
        if (!brand) return;

        // Check authorization first
        const isAuthorized = await this.checkAuthAndRelogin();
        if (!isAuthorized) return;

        try {
            const response = await fetch(`/api/brands/${brandId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ isActive: !brand.isActive })
            });

            if (response.ok) {
                const updatedBrand = await response.json();
                const index = this.brands.findIndex(b => b.id === brandId);
                this.brands[index] = updatedBrand;
                this.renderBrands();
                this.showMessage('Статус бренда изменен', 'success');
            } else if (response.status === 401) {
                this.showMessage('Ошибка авторизации. Пожалуйста, войдите снова.', 'error');
                localStorage.removeItem('adminToken');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Ошибка при изменении статуса', 'error');
            }
        } catch (error) {
            console.error('Error toggling brand:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    async deleteBrand(brandId) {
        const brand = this.brands.find(b => b.id === brandId);
        if (!brand) return;

        if (!confirm(`Вы уверены, что хотите удалить бренд "${brand.name}"?`)) {
            return;
        }

        // Check authorization first
        const isAuthorized = await this.checkAuthAndRelogin();
        if (!isAuthorized) return;

        try {
            const response = await fetch(`/api/brands/${brandId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                this.brands = this.brands.filter(b => b.id !== brandId);
                this.renderBrands();
                this.showMessage(`Бренд "${brand.name}" удален`, 'success');
            } else if (response.status === 401) {
                this.showMessage('Ошибка авторизации. Пожалуйста, войдите снова.', 'error');
                localStorage.removeItem('adminToken');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Ошибка при удалении бренда', 'error');
            }
        } catch (error) {
            console.error('Error deleting brand:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    async uploadBrandLogo(brandId) {
        const fileInput = document.getElementById('brandLogoUpload');
        const urlInput = document.getElementById('brandLogoUrl');
        
        let logoUrl = '';

        // Check authorization first
        const isAuthorized = await this.checkAuthAndRelogin();
        if (!isAuthorized) return;

        if (fileInput && fileInput.files.length > 0) {
            // Upload file
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('image', file);

            try {
                const token = localStorage.getItem('adminToken');
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }

                const uploadData = await uploadResponse.json();
                logoUrl = uploadData.url;
            } catch (error) {
                console.error('Error uploading logo:', error);
                this.showMessage('Ошибка при загрузке изображения', 'error');
                return;
            }
        } else if (urlInput && urlInput.value) {
            logoUrl = urlInput.value.trim();
        } else {
            this.showMessage('Пожалуйста, выберите изображение или введите URL', 'error');
            return;
        }

        // Save logo to brand
        try {
            const response = await fetch(`/api/brands/${brandId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ logo: logoUrl })
            });

            if (response.ok) {
                const updatedBrand = await response.json();
                const index = this.brands.findIndex(b => b.id === brandId);
                this.brands[index] = updatedBrand;
                this.renderBrands();
                this.closeBrandLogoModal();
                this.showMessage('Логотип успешно загружен', 'success');
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Ошибка при сохранении логотипа', 'error');
            }
        } catch (error) {
            console.error('Error saving brand logo:', error);
            this.showMessage('Ошибка при сохранении логотипа', 'error');
        }
    }

    openBrandLogoModal(brandId) {
        const brand = this.brands.find(b => b.id === brandId);
        if (!brand) return;

        let modalElement = document.getElementById('brandLogoModal');
        if (!modalElement) {
            this.createBrandLogoModal();
            modalElement = document.getElementById('brandLogoModal');
        }

        if (!modalElement) return;

        const brandName = document.getElementById('brandLogoModalTitle');
        
        if (brandName) {
            brandName.textContent = `Логотип бренда: ${brand.name}`;
        }

        // Store current brand ID
        modalElement.dataset.brandId = brandId;

        // Load current logo if exists
        const preview = document.getElementById('brandLogoPreview');
        const previewImg = document.getElementById('brandLogoPreviewImg');
        const logoUrl = brand.logo || brand.image || '';
        
        if (preview && previewImg) {
            if (logoUrl) {
                previewImg.src = logoUrl;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
        }

        // Clear preview
        const uploadPreview = document.getElementById('brandLogoUploadPreview');
        if (uploadPreview) {
            uploadPreview.style.display = 'none';
        }

        modalElement.style.display = 'flex';
    }

    closeBrandLogoModal() {
        const modal = document.getElementById('brandLogoModal');
        if (modal) {
            modal.style.display = 'none';
            // Clear inputs
            const fileInput = document.getElementById('brandLogoUpload');
            const urlInput = document.getElementById('brandLogoUrl');
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            const preview = document.getElementById('brandLogoUploadPreview');
            if (preview) preview.style.display = 'none';
        }
    }

    createBrandLogoModal() {
        const modal = document.createElement('div');
        modal.id = 'brandLogoModal';
        modal.className = 'modal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;';
        
        modal.innerHTML = `
            <div class="modal-content" style="background: white; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <h2 id="brandLogoModalTitle" style="margin: 0; font-size: 1.25rem;">Загрузить логотип</h2>
                    <button onclick="brandsManager.closeBrandLogoModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div id="brandLogoPreview" style="margin-bottom: 20px; text-align: center; display: none;">
                        <h4>Текущий логотип:</h4>
                        <img id="brandLogoPreviewImg" src="" alt="Brand Logo" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="brandLogoUpload" style="display: block; margin-bottom: 8px; font-weight: 500;">Выберите изображение:</label>
                        <input type="file" id="brandLogoUpload" accept="image/*" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <small style="display: block; margin-top: 4px; color: #666;">Рекомендуемый размер: 200x200px или квадратное изображение</small>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="brandLogoUrl" style="display: block; margin-bottom: 8px; font-weight: 500;">Или введите URL изображения:</label>
                        <input type="text" id="brandLogoUrl" placeholder="https://example.com/logo.png" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div id="brandLogoUploadPreview" style="margin-top: 20px; display: none; text-align: center;">
                        <h4>Предпросмотр:</h4>
                        <img id="brandLogoUploadPreviewImg" src="" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd;">
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="brandsManager.closeBrandLogoModal()" class="admin-btn admin-btn-secondary" style="padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Отмена</button>
                    <button onclick="brandsManager.saveBrandLogo()" class="admin-btn admin-btn-primary" style="padding: 10px 20px; background: #000; color: white; border: none; border-radius: 4px; cursor: pointer;">Сохранить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Setup file preview
        const fileInput = document.getElementById('brandLogoUpload');
        const urlInput = document.getElementById('brandLogoUrl');
        const preview = document.getElementById('brandLogoUploadPreview');
        const previewImg = document.getElementById('brandLogoUploadPreviewImg');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewImg.src = event.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (urlInput) {
            urlInput.addEventListener('input', (e) => {
                const url = e.target.value.trim();
                if (url) {
                    previewImg.src = url;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            });
        }
    }

    saveBrandLogo() {
        const modal = document.getElementById('brandLogoModal');
        if (!modal) return;
        
        const brandId = parseInt(modal.dataset.brandId);
        if (!brandId) return;

        this.uploadBrandLogo(brandId);
    }

    openEditBrandModal(brandId) {
        const brand = this.brands.find(b => b.id === brandId);
        if (!brand) return;

        let modalElement = document.getElementById('editBrandModal');
        if (!modalElement) {
            this.createEditBrandModal();
            modalElement = document.getElementById('editBrandModal');
        }

        if (!modalElement) return;

        // Store current brand ID
        modalElement.dataset.brandId = brandId;

        // Populate form fields
        const nameInput = document.getElementById('edit-brand-name-input');
        const descriptionInput = document.getElementById('edit-brand-description-input');
        const logoUrlInput = document.getElementById('edit-brand-logo-url-input');
        const currentLogoPreview = document.getElementById('edit-brand-logo-current-preview');
        const currentLogoImg = document.getElementById('edit-brand-logo-current-img');
        const uploadPreview = document.getElementById('edit-brand-logo-upload-preview');
        const uploadPreviewImg = document.getElementById('edit-brand-logo-upload-preview-img');

        if (nameInput) nameInput.value = brand.name || '';
        if (descriptionInput) descriptionInput.value = brand.description || '';

        const logoUrl = brand.logo || brand.image || '';
        console.log('Opening edit modal for brand:', brand.name, 'logo:', logoUrl);
        
        if (currentLogoPreview && currentLogoImg) {
            if (logoUrl) {
                currentLogoImg.src = logoUrl;
                currentLogoPreview.style.display = 'block';
                console.log('Showing current logo preview:', logoUrl);
            } else {
                currentLogoPreview.style.display = 'none';
            }
        }

        if (uploadPreview) uploadPreview.style.display = 'none';
        // Show current logo URL in input field if it exists
        if (logoUrlInput) {
            logoUrlInput.value = logoUrl || '';
            console.log('Setting logo URL input value:', logoUrl);
        }

        const fileInput = document.getElementById('edit-brand-logo-input');
        if (fileInput) fileInput.value = '';

        // Update toggle button text
        const toggleBtn = document.getElementById('edit-brand-toggle-btn');
        if (toggleBtn) {
            toggleBtn.textContent = brand.isActive ? 'Деактивировать' : 'Активировать';
        }

        modalElement.style.display = 'flex';
    }

    closeEditBrandModal() {
        const modal = document.getElementById('editBrandModal');
        if (modal) {
            modal.style.display = 'none';
            // Clear inputs
            const fileInput = document.getElementById('edit-brand-logo-input');
            const urlInput = document.getElementById('edit-brand-logo-url-input');
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            const uploadPreview = document.getElementById('edit-brand-logo-upload-preview');
            if (uploadPreview) uploadPreview.style.display = 'none';
        }
    }

    createEditBrandModal() {
        const modal = document.createElement('div');
        modal.id = 'editBrandModal';
        modal.className = 'modal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;';
        
        modal.innerHTML = `
            <div class="modal-content" style="background: white; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.25rem;">Редактировать бренд</h2>
                    <button onclick="brandsManager.closeEditBrandModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-brand-name-input" style="display: block; margin-bottom: 8px; font-weight: 500;">Название бренда:</label>
                        <input type="text" id="edit-brand-name-input" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="edit-brand-description-input" style="display: block; margin-bottom: 8px; font-weight: 500;">Описание бренда:</label>
                        <textarea id="edit-brand-description-input" class="form-control" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Логотип бренда:</label>
                        <div id="edit-brand-logo-current-preview" style="margin-bottom: 12px; text-align: center; display: none;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Текущий логотип:</div>
                            <img id="edit-brand-logo-current-img" src="" alt="Current Logo" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">
                        </div>
                        <input type="file" id="edit-brand-logo-input" accept="image/*" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
                        <input type="text" id="edit-brand-logo-url-input" placeholder="Или введите URL изображения" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <div id="edit-brand-logo-upload-preview" style="margin-top: 12px; display: none; text-align: center;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Предпросмотр:</div>
                            <img id="edit-brand-logo-upload-preview-img" src="" alt="Preview" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px; border-top: 1px solid #e0e0e0; display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="brandsManager.deleteBrandFromModal()" class="admin-btn" style="width: 100%; padding: 10px 20px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer;">Удалить</button>
                    <button onclick="brandsManager.toggleBrandFromModal()" class="admin-btn" style="width: 100%; padding: 10px 20px; background: #fb8c00; color: white; border: none; border-radius: 4px; cursor: pointer;" id="edit-brand-toggle-btn">Активировать/Деактивировать</button>
                    <button onclick="brandsManager.closeEditBrandModal()" class="admin-btn admin-btn-secondary" style="width: 100%; padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Отмена</button>
                    <button onclick="brandsManager.saveEditBrand()" class="admin-btn admin-btn-primary" style="width: 100%; padding: 10px 20px; background: #000; color: white; border: none; border-radius: 4px; cursor: pointer;">Сохранить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Setup file preview
        const fileInput = document.getElementById('edit-brand-logo-input');
        const urlInput = document.getElementById('edit-brand-logo-url-input');
        const preview = document.getElementById('edit-brand-logo-upload-preview');
        const previewImg = document.getElementById('edit-brand-logo-upload-preview-img');

        if (fileInput && preview && previewImg) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewImg.src = event.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (urlInput && preview && previewImg) {
            urlInput.addEventListener('input', (e) => {
                const url = e.target.value.trim();
                if (url) {
                    previewImg.src = url;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            });
        }
    }

    async saveEditBrand() {
        const modal = document.getElementById('editBrandModal');
        if (!modal) return;
        
        const brandId = parseInt(modal.dataset.brandId);
        if (!brandId) return;

        const brand = this.brands.find(b => b.id === brandId);
        if (!brand) return;

        const nameInput = document.getElementById('edit-brand-name-input');
        const descriptionInput = document.getElementById('edit-brand-description-input');
        const logoInput = document.getElementById('edit-brand-logo-input');
        const logoUrlInput = document.getElementById('edit-brand-logo-url-input');

        if (!nameInput || !nameInput.value.trim()) {
            this.showMessage('Введите название бренда', 'error');
            return;
        }

        const brandName = nameInput.value.trim();
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        const currentLogoUrl = brand.logo || brand.image || '';
        let logoUrl = currentLogoUrl;

        // Check authorization first
        const isAuthorized = await this.checkAuthAndRelogin();
        if (!isAuthorized) return;

        // Handle logo upload or URL
        const logoInputHasFile = logoInput && logoInput.files.length > 0;
        const logoUrlInputValue = logoUrlInput ? logoUrlInput.value.trim() : '';
        let logoWasUploaded = false;

        if (logoInputHasFile) {
            // Upload file
            const file = logoInput.files[0];
            console.log('Uploading file:', file.name, 'size:', file.size);
            const formData = new FormData();
            formData.append('image', file);

            try {
                const token = localStorage.getItem('adminToken');
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error('Upload failed:', uploadResponse.status, errorText);
                    throw new Error(`Failed to upload image: ${uploadResponse.status}`);
                }

                const uploadData = await uploadResponse.json();
                logoUrl = uploadData.url;
                logoWasUploaded = true;
                console.log('File uploaded successfully. URL:', logoUrl);
                
                // Update preview with uploaded URL
                const uploadPreviewImg = document.getElementById('edit-brand-logo-upload-preview-img');
                const uploadPreview = document.getElementById('edit-brand-logo-upload-preview');
                if (uploadPreviewImg && uploadPreview) {
                    uploadPreviewImg.src = logoUrl;
                    uploadPreview.style.display = 'block';
                }
                
                // Also update URL input field with the new URL
                if (logoUrlInput) {
                    logoUrlInput.value = logoUrl;
                }
            } catch (error) {
                console.error('Error uploading logo:', error);
                this.showMessage('Ошибка при загрузке изображения: ' + error.message, 'error');
                return;
            }
        } else if (logoUrlInputValue) {
            // Use URL from input (can be current or new)
            logoUrl = logoUrlInputValue;
            console.log('Using URL from input:', logoUrl);
        } else if (logoUrlInputValue === '' && currentLogoUrl) {
            // If URL input was cleared and there was a logo, remove it
            logoUrl = '';
            console.log('Logo URL cleared');
        }
        // Otherwise logoUrl remains currentLogoUrl (preserves existing logo)

        console.log('Final logoUrl before save:', logoUrl, 'Current logo:', currentLogoUrl, 'Was uploaded:', logoWasUploaded);

        // Save changes
        try {
            const updateData = {
                name: brandName
            };

            // Always include description (even if empty, to allow deletion)
            updateData.description = description || undefined;

            // CRITICAL: Always include logo in updateData if it exists
            // Check logoUrl first (could be from upload or input)
            // Then check currentLogoUrl as fallback
            const finalLogoUrl = (logoUrl && logoUrl.trim()) || (currentLogoUrl && currentLogoUrl.trim()) || null;
            
            if (finalLogoUrl) {
                updateData.logo = finalLogoUrl;
                console.log('✅ Including logo in update:', updateData.logo);
            } else if (logoWasUploaded) {
                // File was uploaded but URL is empty - error!
                console.error('❌ File uploaded but URL is empty! logoUrl:', logoUrl, 'currentLogoUrl:', currentLogoUrl);
                this.showMessage('Файл загружен, но URL не получен. Попробуйте снова.', 'error');
                return;
            } else {
                // No logo - set undefined to remove it (or keep existing if not passed)
                updateData.logo = undefined;
                console.log('ℹ️ No logo value - will not update logo field');
            }

            console.log('📤 Saving brand update - updateData:', JSON.stringify(updateData, null, 2));
            console.log('🎨 Logo in updateData:', updateData.logo, 'Type:', typeof updateData.logo);

            const response = await fetch(`/api/brands/${brandId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                const savedBrand = await response.json();
                console.log('Brand saved on server:', JSON.stringify(savedBrand, null, 2));
                
                // Always reload brands from server to ensure we have the latest data
                // This ensures logo and description are properly loaded
                await this.loadBrands();
                
                // Check if logo was saved
                const reloadedBrand = this.brands.find(b => b.id === brandId);
                if (reloadedBrand) {
                    console.log('Brand after reload:', reloadedBrand.name, 'logo:', reloadedBrand.logo);
                }
                
                // Re-render to show updated logo and other changes
                this.renderBrands();
                this.closeEditBrandModal();
                this.showMessage('Бренд успешно обновлен', 'success');
            } else if (response.status === 401) {
                this.showMessage('Ошибка авторизации. Пожалуйста, войдите снова.', 'error');
                localStorage.removeItem('adminToken');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Ошибка при обновлении бренда', 'error');
            }
        } catch (error) {
            console.error('Error updating brand:', error);
            this.showMessage('Ошибка подключения к серверу', 'error');
        }
    }

    async deleteBrandFromModal() {
        const modal = document.getElementById('editBrandModal');
        if (!modal) return;
        
        const brandId = parseInt(modal.dataset.brandId);
        if (!brandId) return;

        this.closeEditBrandModal();
        await this.deleteBrand(brandId);
    }

    async toggleBrandFromModal() {
        const modal = document.getElementById('editBrandModal');
        if (!modal) return;
        
        const brandId = parseInt(modal.dataset.brandId);
        if (!brandId) return;

        await this.toggleBrand(brandId);
        
        // Update button text after toggle
        const brand = this.brands.find(b => b.id === brandId);
        const toggleBtn = document.getElementById('edit-brand-toggle-btn');
        if (toggleBtn && brand) {
            toggleBtn.textContent = brand.isActive ? 'Деактивировать' : 'Активировать';
        }
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `admin-message ${type}`;
        messageDiv.textContent = message;
        
        // Add to page
        document.body.appendChild(messageDiv);
        
        // Style the message
        Object.assign(messageDiv.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '4px',
            backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3',
            color: 'white',
            zIndex: '10000',
            animation: 'slideIn 0.3s ease'
        });
        
        // Remove after 3 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Initialize when DOM is ready
let brandsManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        brandsManager = new BrandsManager();
    });
} else {
    brandsManager = new BrandsManager();
}
