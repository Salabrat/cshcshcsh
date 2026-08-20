// Admin Categories Management
let categories = [];

// Initialize categories when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load categories if we're on the categories section
    if (document.getElementById('categories-section')) {
        loadCategories();
    }
});

// Also listen for section switches to reload categories
document.addEventListener('sectionSwitched', function(e) {
    if (e.detail === 'categories') {
        loadCategories();
    }
});

// Load and display categories
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            categories = await response.json();
            // API already filters out default categories, so we just display what we get
            displayCategories(categories);
        } else {
            // If API doesn't exist yet, show empty state
            categories = [];
            displayCategories(categories);
        }
    } catch (error) {
        console.log('Error loading categories:', error);
        // Show empty state on error
        categories = [];
        displayCategories(categories);
    }
}

// Default categories function removed - we only show real categories from API

// Display categories in grid
function displayCategories(categoriesList) {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;

    // Show only real categories (no default categories)
    if (!categoriesList || categoriesList.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
                <p style="margin-top: 16px; color: #666;">Категории не найдены</p>
                <p style="color: #999; font-size: 12px;">Добавьте первую категорию, чтобы начать</p>
                <button class="admin-btn admin-btn-primary" style="margin-top: 16px;" onclick="showAddCategoryModal()">
                    Добавить категорию
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = categoriesList.map(category => `
        <div class="category-card" ondblclick="editCategory('${category.id}')" style="cursor: pointer;" title="Двойной клик для редактирования">
            <div class="category-card-header">
                <h3 class="category-name">${category.name}</h3>
            </div>
            <div class="category-card-body">
                <div class="category-info">
                    <span class="category-label">URL:</span>
                    <span class="category-value">/category-${encodeURIComponent(category.slug)}.html</span>
                </div>
                <div class="category-info">
                    <span class="category-label">Товаров:</span>
                    <span class="category-value">${category.productCount || 0}</span>
                </div>
                ${category.description ? `
                    <div class="category-info">
                        <span class="category-label">Описание:</span>
                        <span class="category-value">${category.description}</span>
                    </div>
                ` : ''}
                <div class="category-info">
                    <span class="category-label">Отображение:</span>
                    <span class="category-value">
                        ${category.isVisible !== false ? 
                            '<span style="color: #2e7d32; font-weight: 600;">✓ Видима</span>' : 
                            '<span style="color: #c62828; font-weight: 600;">✗ Скрыта</span>'
                        }
                    </span>
                </div>
            </div>
            <div class="category-card-actions">
                <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="editCategory('${category.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Изменить
                </button>
                <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="deleteCategory('${category.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                    </svg>
                    Удалить
                </button>
            </div>
        </div>
    `).join('');

    // Update total categories count
    const totalCategories = document.getElementById('totalCategories');
    if (totalCategories) {
        totalCategories.textContent = categoriesList.length;
    }
}

// Show add category modal
function showAddCategoryModal() {
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.style.display = 'flex';
        // Clear form
        document.getElementById('categoryName').value = '';
        document.getElementById('categorySlug').value = '';
        document.getElementById('categoryDescription').value = '';
        document.getElementById('categoryVisible').checked = true;
    }
}

// Close add category modal
function closeAddCategoryModal() {
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Reset modal to "Add" mode
        const modalTitle = modal.querySelector('.modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = 'Добавить категорию';
        }
        
        const saveBtn = modal.querySelector('.admin-btn-primary');
        if (saveBtn) {
            saveBtn.textContent = 'Добавить';
            saveBtn.onclick = saveCategory;
        }
        
        // Clear form fields
        document.getElementById('categoryName').value = '';
        document.getElementById('categorySlug').value = '';
        document.getElementById('categoryDescription').value = '';
        document.getElementById('categoryVisible').checked = true;
    }
}

// Save new category
async function saveCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const slug = document.getElementById('categorySlug').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();
    const isVisible = document.getElementById('categoryVisible').checked;

    if (!name || !slug) {
        alert('Пожалуйста, заполните обязательные поля');
        return;
    }

    // Check if category with this slug already exists
    if (categories.some(cat => cat.slug === slug)) {
        alert('Категория с таким URL идентификатором уже существует');
        return;
    }

    // Check if admin token is valid before making request
    const isValidToken = await checkAdminToken();
    if (!isValidToken) {
        showNotification('Сессия истекла. Пожалуйста, перелогиньтесь.', 'error');
        setTimeout(() => {
            if (confirm('Перейти на страницу входа?')) {
                window.location.href = 'login.html';
            }
        }, 1000);
        return;
    }

    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ name, slug, description, isVisible })
        });

        if (response.ok) {
            const newCategory = await response.json();
            showNotification('Категория успешно добавлена', 'success');
            closeAddCategoryModal();
            loadCategories();
            
            // Create category page file if needed
            createCategoryPage(slug, name, description);
            
            // Trigger menu refresh on all open pages
            if (window.opener && typeof window.opener.refreshCategoryMenus === 'function') {
                window.opener.refreshCategoryMenus();
            }
            // Dispatch event for dynamic menu refresh
            document.dispatchEvent(new CustomEvent('categoriesUpdated'));
        } else if (response.status === 401) {
            showNotification('Сессия истекла. Пожалуйста, перелогиньтесь.', 'error');
            setTimeout(() => {
                if (confirm('Перейти на страницу входа?')) {
                    window.location.href = 'login.html';
                }
            }, 1000);
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to add category');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        showNotification('Ошибка при добавлении категории: ' + (error.message || 'Проверьте подключение к серверу.'), 'error');
    }
}

// Check if admin token is valid
async function checkAdminToken() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        return false;
    }
    
    try {
        const response = await fetch('/api/check-admin', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (response.ok) {
            const data = await response.json();
            return data.isAdmin === true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Edit category
function editCategory(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    // Show modal with existing data
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Change modal title
        const modalTitle = modal.querySelector('.modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = 'Редактировать категорию';
        }
        
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categorySlug').value = category.slug;
        document.getElementById('categoryDescription').value = category.description || '';
        document.getElementById('categoryVisible').checked = category.isVisible !== false; // Default to true if not set
        
        // Change button text
        const saveBtn = modal.querySelector('.admin-btn-primary');
        if (saveBtn) {
            saveBtn.textContent = 'Сохранить изменения';
            saveBtn.onclick = () => updateCategory(categoryId);
        }
    }
}

// Update category
async function updateCategory(categoryId) {
    const name = document.getElementById('categoryName').value.trim();
    const slug = document.getElementById('categorySlug').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();
    const isVisible = document.getElementById('categoryVisible').checked;

    if (!name || !slug) {
        alert('Пожалуйста, заполните обязательные поля');
        return;
    }

    try {
        const response = await fetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ name, slug, description, isVisible })
        });

        if (response.ok) {
            showNotification('Категория успешно обновлена', 'success');
            
            // Update category page HTML file
            await createCategoryPage(slug, name, description);
            
            closeAddCategoryModal();
            loadCategories();
            // Trigger menu refresh
            document.dispatchEvent(new CustomEvent('categoriesUpdated'));
        } else {
            throw new Error('Failed to update category');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        // Update locally if API fails
        const categoryIndex = categories.findIndex(cat => cat.id === categoryId);
        if (categoryIndex !== -1) {
            categories[categoryIndex] = {
                ...categories[categoryIndex],
                name: name,
                slug: slug,
                description: description,
                isVisible: isVisible
            };
            
            // Update category page HTML file
            await createCategoryPage(slug, name, description);
            
            displayCategories(categories);
            closeAddCategoryModal();
            showNotification('Категория обновлена локально', 'success');
            // Trigger menu refresh
            document.dispatchEvent(new CustomEvent('categoriesUpdated'));
        }
    }
}

// Delete category
async function deleteCategory(categoryId) {
    if (!confirm('Вы уверены, что хотите удалить эту категорию? Все товары в этой категории также будут удалены.')) {
        return;
    }

    // Find category to get its slug for file deletion
    const category = categories.find(cat => cat.id === categoryId);
    const categorySlug = category ? category.slug : categoryId;

    try {
        const response = await fetch('/api/categories-delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ id: categoryId })
        });

        if (response.ok) {
            showNotification('Категория успешно удалена', 'success');
            
            // Try to delete the HTML file
            try {
                const deletePageResponse = await fetch('/api/delete-category-page', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                    },
                    body: JSON.stringify({ slug: categorySlug })
                });
                
                if (deletePageResponse.ok) {
                    console.log(`Category page category-${categorySlug}.html deleted`);
                }
            } catch (pageError) {
                console.log('Could not delete category page file:', pageError);
            }
            
            loadCategories();
            // Trigger menu refresh
            document.dispatchEvent(new CustomEvent('categoriesUpdated'));
        } else {
            throw new Error('Failed to delete category');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        // Delete locally if API fails
        categories = categories.filter(cat => cat.id !== categoryId);
        displayCategories(categories);
        showNotification('Категория удалена локально', 'success');
        // Trigger menu refresh
        document.dispatchEvent(new CustomEvent('categoriesUpdated'));
    }
}

// Create category page HTML file
async function createCategoryPage(slug, name, description = '') {
    console.log(`Creating category page: category-${slug}.html for ${name}`);
    
    try {
        // Send request to server to create category page
        const response = await fetch('/api/create-category-page', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ slug, name, description })
        });
        
        if (response.ok) {
            showNotification(`Страница категории category-${slug}.html создана`, 'success');
        } else {
            showNotification(`Страница category-${slug}.html будет создана вручную`, 'info');
        }
    } catch (error) {
        console.error('Error creating category page:', error);
        showNotification(`Страница category-${slug}.html будет создана вручную`, 'info');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `admin-notification admin-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS for category cards
const style = document.createElement('style');
style.textContent = `
    .categories-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 30px;
    }

    .category-card {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        transition: all 0.3s ease;
    }

    .category-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .category-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #f0f0f0;
    }

    .category-name {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
    }

    .badge {
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 4px;
    }

    .badge-info {
        background: #e3f2fd;
        color: #1976d2;
    }

    .category-card-body {
        margin-bottom: 15px;
    }

    .category-info {
        display: flex;
        margin-bottom: 8px;
        font-size: 14px;
    }

    .category-label {
        font-weight: 600;
        color: #666;
        margin-right: 8px;
        min-width: 70px;
    }

    .category-value {
        color: #333;
        word-break: break-word;
    }

    .category-card-actions {
        display: flex;
        gap: 10px;
    }

    .admin-btn-sm {
        padding: 6px 12px;
        font-size: 12px;
    }

    .admin-btn-danger {
        background: #f44336;
        color: white;
    }

    .admin-btn-danger:hover {
        background: #d32f2f;
    }

    .empty-state {
        text-align: center;
        padding: 60px;
        color: #666;
    }

    .empty-state svg {
        margin: 0 auto;
        opacity: 0.3;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .section-actions {
        display: flex;
        gap: 10px;
    }

    .admin-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .admin-section-header > div:first-child {
        flex: 1;
    }
`;
document.head.appendChild(style);
