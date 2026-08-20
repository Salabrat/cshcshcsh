// Admin Logo Management
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentLogo();
    
    // Add event listeners
    const logoUpload = document.getElementById('logoUpload');
    const logoUrl = document.getElementById('logoUrl');
    
    if (logoUpload) {
        logoUpload.addEventListener('change', handleLogoFileSelect);
    }
    
    if (logoUrl) {
        logoUrl.addEventListener('input', handleLogoUrlInput);
    }
});

// Check if admin token is valid
async function checkAdminToken() {
    const token = localStorage.getItem('adminToken');
    
    console.log('Checking admin token...');
    console.log('Token exists:', !!token);
    console.log('Token value:', token ? token.substring(0, 10) + '...' : 'null');
    
    if (!token) {
        console.error('No admin token found in localStorage');
        return false;
    }
    
    try {
        const response = await fetch('/api/check-admin', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        console.log('Token check response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Token check response:', data);
            return data.isAdmin === true;
        }
        console.error('Token check failed with status:', response.status);
        return false;
    } catch (error) {
        console.error('Token check failed:', error);
        return false;
    }
}

let currentLogoUrl = '';

// Load current logo from site settings
async function loadCurrentLogo() {
    try {
        const response = await fetch('/api/site-settings');
        if (!response.ok) {
            throw new Error('Failed to load site settings');
        }
        
        const settings = await response.json();
        currentLogoUrl = settings.logoUrl || '';
        
        // Update preview
        const preview = document.getElementById('logoPreview');
        const noLogoText = document.getElementById('noLogoText');
        if (preview) {
            if (currentLogoUrl) {
                preview.src = currentLogoUrl;
                preview.style.display = 'block';
                if (noLogoText) noLogoText.style.display = 'none';
            } else {
                preview.style.display = 'none';
                if (noLogoText) noLogoText.style.display = 'block';
            }
        }
        
        // Update URL input if exists
        const urlInput = document.getElementById('logoUrl');
        if (urlInput) {
            urlInput.value = currentLogoUrl;
        }
    } catch (error) {
        console.error('Error loading logo:', error);
    }
}

// Open logo modal (global function)
window.openLogoModal = async function() {
    // Check token validity first
    const isValid = await checkAdminToken();
    if (!isValid) {
        alert('Сессия истекла. Войдите заново.');
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
        return;
    }
    
    const modal = document.getElementById('logoModal');
    if (modal) {
        modal.style.display = 'flex';
        loadCurrentLogo(); // Reload current logo
        
        // Close on outside click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeLogoModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeLogoModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }
}

// Close logo modal (global function)
window.closeLogoModal = function() {
    const modal = document.getElementById('logoModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear inputs
        const uploadInput = document.getElementById('logoUpload');
        const urlInput = document.getElementById('logoUrl');
        if (uploadInput) uploadInput.value = '';
        if (urlInput) urlInput.value = currentLogoUrl;
        
        const previewContainer = document.getElementById('logoUploadPreview');
        if (previewContainer) previewContainer.style.display = 'none';
    }
}

// Handle file selection
function handleLogoFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            showLogoPreview(e.target.result);
            // Clear URL input when file is selected
            const urlInput = document.getElementById('logoUrl');
            if (urlInput) urlInput.value = '';
        };
        reader.readAsDataURL(file);
    }
}

// Handle URL input
function handleLogoUrlInput(event) {
    const url = event.target.value;
    if (url) {
        showLogoPreview(url);
        // Clear file input when URL is entered
        const uploadInput = document.getElementById('logoUpload');
        if (uploadInput) uploadInput.value = '';
    } else {
        const previewContainer = document.getElementById('logoUploadPreview');
        if (previewContainer) previewContainer.style.display = 'none';
    }
}

// Show logo preview
function showLogoPreview(src) {
    const previewContainer = document.getElementById('logoUploadPreview');
    const previewImg = document.getElementById('logoUploadPreviewImg');
    
    if (previewContainer && previewImg) {
        previewImg.src = src;
        previewContainer.style.display = 'block';
    }
}

// Save logo (global function)
window.saveLogo = async function() {
    const fileInput = document.getElementById('logoUpload');
    const urlInput = document.getElementById('logoUrl');
    
    let imageUrl = '';
    
    // Check if file is selected
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Upload file
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload image');
            }
            
            const uploadData = await uploadResponse.json();
            imageUrl = uploadData.url;
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Ошибка при загрузке изображения');
            return;
        }
    } else if (urlInput && urlInput.value) {
        // Use URL directly
        imageUrl = urlInput.value;
    } else {
        alert('Пожалуйста, выберите изображение или введите URL');
        return;
    }
    
    // Save the logo URL to server
    try {
        console.log('=== Starting logo save process ===');
        
        // Check token validity first
        const isValid = await checkAdminToken();
        console.log('Token is valid:', isValid);
        
        if (!isValid) {
            alert('Сессия истекла. Войдите заново.');
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
            return;
        }
        
        const token = localStorage.getItem('adminToken');
        console.log('Retrieved token for save:', token ? token.substring(0, 10) + '...' : 'null');
        
        if (!token) {
            alert('Нет токена администратора. Войдите заново.');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('Sending request to /api/site-settings');
        console.log('Request body:', { logoUrl: imageUrl });
        
        const response = await fetch('/api/site-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ logoUrl: imageUrl })
        });
        
        console.log('Save logo response status:', response.status);
        console.log('Save logo response ok:', response.ok);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            if (response.status === 401) {
                let errorMessage = 'Нет токена администратора. Войдите заново.';
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Use default message
                }
                alert(errorMessage);
                localStorage.removeItem('adminToken');
                window.location.href = 'login.html';
                return;
            }
            let errorMessage = 'Ошибка при сохранении логотипа';
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = errorText;
                }
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Update current logo URL
        currentLogoUrl = data.settings.logoUrl;
        
        // Update preview
        const preview = document.getElementById('logoPreview');
        const noLogoText = document.getElementById('noLogoText');
        if (preview) {
            preview.src = currentLogoUrl;
            preview.style.display = 'block';
            if (noLogoText) noLogoText.style.display = 'none';
        }
        
        // Show success message
        showNotification('Логотип успешно обновлен', 'success');
        
        // Close modal
        closeLogoModal();
        
        // Reload page after a short delay to apply changes
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        console.error('Error saving logo:', error);
        alert('Ошибка при сохранении логотипа: ' + error.message);
    }
}

// Remove logo (global function)
window.removeLogo = async function() {
    if (!confirm('Вы уверены, что хотите удалить логотип?')) {
        return;
    }
    
    try {
        // Check token validity first
        const isValid = await checkAdminToken();
        if (!isValid) {
            alert('Сессия истекла. Войдите заново.');
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
            return;
        }
        
        const token = localStorage.getItem('adminToken');
        
        if (!token) {
            alert('Нет токена администратора. Войдите заново.');
            window.location.href = 'login.html';
            return;
        }
        
        const response = await fetch('/api/site-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ logoUrl: '' })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                let errorMessage = 'Нет токена администратора. Войдите заново.';
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Use default message
                }
                alert(errorMessage);
                localStorage.removeItem('adminToken');
                window.location.href = 'login.html';
                return;
            }
            let errorMessage = 'Ошибка при удалении логотипа';
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = errorText;
                }
            }
            throw new Error(errorMessage);
        }
        
        currentLogoUrl = '';
        
        // Update preview
        const preview = document.getElementById('logoPreview');
        const noLogoText = document.getElementById('noLogoText');
        if (preview) {
            preview.style.display = 'none';
            if (noLogoText) noLogoText.style.display = 'block';
        }
        
        // Show success message
        showNotification('Логотип удален', 'success');
        
        // Close modal
        closeLogoModal();
        
        // Reload page after a short delay to apply changes
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        console.error('Error removing logo:', error);
        alert('Ошибка при удалении логотипа: ' + error.message);
    }
}

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS animation if not exists
if (!document.querySelector('#admin-logo-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-logo-styles';
    style.textContent = `
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
        
        #logoModal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        
        #logoModal .modal-content {
            background: white;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        #logoModal .modal-header {
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #logoModal .modal-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: #333;
        }
        
        #logoModal .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
        
        #logoModal .modal-close:hover {
            color: #333;
        }
        
        #logoModal .modal-body {
            padding: 20px;
        }
        
        #logoModal .modal-footer {
            padding: 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .logo-preview-container {
            margin-bottom: 20px;
        }
        
        .logo-preview-container h3 {
            margin-bottom: 10px;
            color: #333;
            font-size: 1rem;
        }
        
        #logoPreview {
            max-width: 200px;
            max-height: 80px;
            object-fit: contain;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 10px;
            background: #f9f9f9;
            display: none;
        }
        
        #logoUploadPreview {
            margin-top: 15px;
            display: none;
        }
        
        #logoUploadPreviewImg {
            max-width: 200px;
            max-height: 80px;
            object-fit: contain;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 10px;
            background: #f9f9f9;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
        }
        
        .form-group input[type="file"],
        .form-group input[type="url"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        .form-group input[type="file"] {
            cursor: pointer;
        }
        
        .help-text {
            font-size: 0.875rem;
            color: #666;
            margin-top: 5px;
        }
        
        .admin-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.3s;
        }
        
        .admin-btn-primary {
            background: #007bff;
            color: white;
        }
        
        .admin-btn-primary:hover {
            background: #0056b3;
        }
        
        .admin-btn-danger {
            background: #dc3545;
            color: white;
        }
        
        .admin-btn-danger:hover {
            background: #c82333;
        }
        
        .admin-btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .admin-btn-secondary:hover {
            background: #5a6268;
        }
    `;
    document.head.appendChild(style);
}
