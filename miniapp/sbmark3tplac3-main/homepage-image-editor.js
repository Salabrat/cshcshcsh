// Homepage Image Editor for Administrators
(function() {
    'use strict';
    
    // Check if user is admin
    function isAdmin() {
        return localStorage.getItem('adminLoggedIn') === 'true' || 
               localStorage.getItem('username') === 'admin' ||
               localStorage.getItem('userRole') === 'admin';
    }
    
    // Image mapping for homepage sections
    const imageMapping = {
        hero: '.hero-section .hero-image img',
        campaign1: '.campaign-content-wrapper .campaign-image img',
        campaign2: '.campaign-split .campaign-split-image img',
        campaign3: '.campaign-split-reverse .campaign-split-image img',
        about1: '.about-item:nth-child(1) .about-item-image img',
        about2: '.about-item:nth-child(2) .about-item-image img'
    };
    
    // Initialize image editor
    function initImageEditor() {
        if (!isAdmin()) return;
        
        // Add edit buttons to all mapped images
        Object.entries(imageMapping).forEach(([key, selector]) => {
            const img = document.querySelector(selector);
            if (img) {
                addEditButton(img, key);
            }
        });
        
        // Create modal if it doesn't exist
        if (!document.getElementById('imageEditModal')) {
            createImageEditModal();
        }
        
        // Load saved images
        loadSavedImages();
    }
    
    // Add edit button to image
    function addEditButton(img, imageKey) {
        // Check if button already exists
        if (img.parentElement.querySelector('.image-edit-btn')) return;
        
        // Create wrapper if image is not already wrapped
        let wrapper = img.parentElement;
        if (!wrapper.classList.contains('image-edit-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'image-edit-wrapper';
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'image-edit-btn';
        editBtn.innerHTML = '📷 Изменить фото';
        editBtn.onclick = () => openImageEditModal(imageKey, img);
        
        // Style the button
        editBtn.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            padding: 8px 15px;
            background: rgba(220, 38, 38, 0.9);
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            opacity: 1;
            transition: opacity 0.3s ease, transform 0.2s ease, background 0.2s ease;
            z-index: 10;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        // Add hover effects for better UX
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.background = 'rgba(220, 38, 38, 1)';
            editBtn.style.transform = 'scale(1.05)';
        });
        
        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.background = 'rgba(220, 38, 38, 0.9)';
            editBtn.style.transform = 'scale(1)';
        });
        
        wrapper.appendChild(editBtn);
    }
    
    // Create image edit modal
    function createImageEditModal() {
        const modal = document.createElement('div');
        modal.id = 'imageEditModal';
        modal.className = 'image-edit-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Изменить изображение</h2>
                    <button class="modal-close" onclick="closeImageEditModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="upload-options">
                        <div class="upload-option">
                            <label for="imageFileUpload">
                                <div class="upload-box">
                                    <span class="upload-icon">📁</span>
                                    <span>Выбрать файл с компьютера</span>
                                </div>
                            </label>
                            <input type="file" id="imageFileUpload" accept="image/*" style="display: none;">
                        </div>
                        
                        <div class="divider">или</div>
                        
                        <div class="upload-option">
                            <label>URL изображения:</label>
                            <input type="url" id="imageUrlInput" placeholder="https://example.com/image.jpg">
                        </div>
                    </div>
                    
                    <div id="imagePreviewContainer" style="display: none;">
                        <h3>Предпросмотр:</h3>
                        <img id="imagePreview" src="" alt="Preview">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="closeImageEditModal()">Отмена</button>
                    <button class="btn-save" onclick="saveImage()">Сохранить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('imageFileUpload').addEventListener('change', handleFileSelect);
        document.getElementById('imageUrlInput').addEventListener('input', handleUrlInput);
        
        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeImageEditModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeImageEditModal();
            }
        });
    }
    
    // Current editing image key
    let currentImageKey = null;
    let currentImageElement = null;
    
    // Open image edit modal
    window.openImageEditModal = function(imageKey, imgElement) {
        currentImageKey = imageKey;
        currentImageElement = imgElement;
        
        const modal = document.getElementById('imageEditModal');
        modal.style.display = 'flex';
        
        // Reset form
        document.getElementById('imageFileUpload').value = '';
        document.getElementById('imageUrlInput').value = '';
        document.getElementById('imagePreviewContainer').style.display = 'none';
        
        // Show current image in preview
        if (imgElement && imgElement.src) {
            showImagePreview(imgElement.src);
        }
    };
    
    // Close image edit modal
    window.closeImageEditModal = function() {
        const modal = document.getElementById('imageEditModal');
        modal.style.display = 'none';
        currentImageKey = null;
        currentImageElement = null;
    };
    
    // Handle file selection
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                showImagePreview(e.target.result);
                document.getElementById('imageUrlInput').value = '';
            };
            reader.readAsDataURL(file);
        }
    }
    
    // Handle URL input
    function handleUrlInput(event) {
        const url = event.target.value;
        if (url) {
            showImagePreview(url);
            document.getElementById('imageFileUpload').value = '';
        } else {
            document.getElementById('imagePreviewContainer').style.display = 'none';
        }
    }
    
    // Show image preview
    function showImagePreview(src) {
        const previewContainer = document.getElementById('imagePreviewContainer');
        const previewImg = document.getElementById('imagePreview');
        
        if (previewContainer && previewImg) {
            previewImg.src = src;
            previewContainer.style.display = 'block';
        }
    }
    
    // Save image
    window.saveImage = async function() {
        const fileInput = document.getElementById('imageFileUpload');
        const urlInput = document.getElementById('imageUrlInput');
        
        let imageUrl = '';
        
        // Check if file is selected
        if (fileInput.files.length > 0) {
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
                showNotification('Ошибка при загрузке изображения', 'error');
                return;
            }
        } else if (urlInput.value) {
            // Use URL directly
            imageUrl = urlInput.value;
        } else {
            showNotification('Пожалуйста, выберите изображение или введите URL', 'warning');
            return;
        }
        
        // Save the image URL to server
        try {
            // Get current images
            const response = await fetch('/api/homepage-images');
            const currentImages = await response.json();
            
            // Update the specific image
            currentImages[currentImageKey] = imageUrl;
            
            // Save updated images
            const saveResponse = await fetch('/api/homepage-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentImages)
            });
            
            if (!saveResponse.ok) {
                throw new Error('Failed to save image');
            }
            
            // Update image on page
            if (currentImageElement) {
                currentImageElement.src = imageUrl;
            }
            
            // Show success message
            showNotification('Изображение успешно обновлено', 'success');
            
            // Close modal
            closeImageEditModal();
        } catch (error) {
            console.error('Error saving image:', error);
            showNotification('Ошибка при сохранении изображения', 'error');
        }
    };
    
    // Load saved images
    async function loadSavedImages() {
        try {
            const response = await fetch('/api/homepage-images');
            const images = await response.json();
            
            // Update images on page
            Object.entries(images).forEach(([key, url]) => {
                if (url && imageMapping[key]) {
                    const img = document.querySelector(imageMapping[key]);
                    if (img) {
                        img.src = url;
                    }
                }
            });
        } catch (error) {
            console.error('Error loading saved images:', error);
        }
    }
    
    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `image-notification ${type}`;
        notification.textContent = message;
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${colors[type] || colors.success};
            color: white;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 100000;
            animation: slideIn 0.3s ease;
            font-size: 14px;
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
    
    // Add styles
    function addStyles() {
        if (document.getElementById('homepage-image-editor-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'homepage-image-editor-styles';
        style.textContent = `
            .image-edit-wrapper {
                position: relative;
                display: inline-block;
            }
            
            .image-edit-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                animation: fadeIn 0.3s ease;
            }
            
            .image-edit-modal .modal-content {
                background: white;
                border-radius: 10px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 5px 30px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }
            
            .image-edit-modal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .image-edit-modal .modal-header h2 {
                margin: 0;
                font-size: 1.5rem;
                color: #333;
            }
            
            .image-edit-modal .modal-close {
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
                transition: color 0.2s;
            }
            
            .image-edit-modal .modal-close:hover {
                color: #000;
            }
            
            .image-edit-modal .modal-body {
                padding: 30px;
            }
            
            .upload-options {
                margin-bottom: 30px;
            }
            
            .upload-option {
                margin-bottom: 20px;
            }
            
            .upload-box {
                border: 2px dashed #ddd;
                border-radius: 8px;
                padding: 30px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: #f9f9f9;
            }
            
            .upload-box:hover {
                border-color: #dc2626;
                background: #fff;
            }
            
            .upload-icon {
                font-size: 2rem;
                display: block;
                margin-bottom: 10px;
            }
            
            .divider {
                text-align: center;
                margin: 20px 0;
                color: #999;
                font-size: 14px;
            }
            
            #imageUrlInput {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
                margin-top: 10px;
            }
            
            #imagePreviewContainer {
                margin-top: 20px;
                padding: 15px;
                background: #f5f5f5;
                border-radius: 8px;
            }
            
            #imagePreviewContainer h3 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 1rem;
            }
            
            #imagePreview {
                max-width: 100%;
                max-height: 300px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .image-edit-modal .modal-footer {
                padding: 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .btn-cancel, .btn-save {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-cancel {
                background: #e0e0e0;
                color: #333;
            }
            
            .btn-cancel:hover {
                background: #d0d0d0;
            }
            
            .btn-save {
                background: #dc2626;
                color: white;
            }
            
            .btn-save:hover {
                background: #b91c1c;
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
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
        `;
        
        document.head.appendChild(style);
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            addStyles();
            initImageEditor();
        });
    } else {
        addStyles();
        initImageEditor();
    }
    
    // Also initialize on page visibility change (for SPA navigation)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isAdmin()) {
            initImageEditor();
        }
    });
    
    // Export for global access
    window.homepageImageEditor = {
        init: initImageEditor,
        reload: loadSavedImages
    };
})();
