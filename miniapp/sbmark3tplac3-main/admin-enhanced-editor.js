// Enhanced admin editor for buttons and images
(function() {
    'use strict';

    console.log('Enhanced admin editor loading...');

    let isEditing = false;
    let editingImage = false;

    // Initialize enhanced editor
    function initEnhancedEditor() {
        // Check admin status
        const token = localStorage.getItem('adminToken');
        if (!token) {
            console.log('No admin token, skipping enhanced editor');
            return;
        }

        // Verify admin status
        verifyAdminStatus().then(isAdmin => {
            if (!isAdmin) {
                console.log('Admin verification failed');
                return;
            }
            
            console.log('Admin verified, initializing enhanced editor...');
            
            // Initialize button editors
            setupButtonEditors();
            
            // Initialize image editors
            setupImageEditors();
            
            // Re-initialize on dynamic content changes
            observeContentChanges();
        });
    }

    // Verify admin status with server
    async function verifyAdminStatus() {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return false;
            
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
            console.error('Admin verification error:', error);
            return false;
        }
    }

    // Setup button editors
    function setupButtonEditors() {
        console.log('Setting up button editors...');
        
        // Find all buttons with data-text-id
        const buttons = document.querySelectorAll('[data-text-id]');
        console.log(`Found ${buttons.length} buttons with data-text-id`);
        
        buttons.forEach(button => {
            // Skip if already has edit button
            if (button.parentElement && button.parentElement.querySelector('.btn-edit-icon')) {
                return;
            }
            
            addButtonEditor(button);
        });
    }

    // Add editor to a button
    function addButtonEditor(button) {
        const buttonId = button.getAttribute('data-text-id');
        if (!buttonId) return;
        
        console.log(`Adding editor to button: ${buttonId}`);
        
        // Create wrapper if needed
        let wrapper = button.parentElement;
        if (!wrapper || !wrapper.classList.contains('edit-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'edit-wrapper';
            wrapper.style.cssText = 'position: relative; display: inline-block;';
            button.parentNode.insertBefore(wrapper, button);
            wrapper.appendChild(button);
        }
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-icon';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Редактировать текст кнопки';
        editBtn.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 32px;
            height: 32px;
            background: #ff6b00;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
        `;
        
        // Add click handler
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Edit button clicked for: ${buttonId}`);
            
            if (!isEditing) {
                editButtonText(button, buttonId);
            }
        });
        
        // Add hover effect
        editBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.background = '#ff4500';
        });
        
        editBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.background = '#ff6b00';
        });
        
        wrapper.appendChild(editBtn);
        console.log(`Edit button added for: ${buttonId}`);
    }

    // Edit button text
    function editButtonText(button, buttonId) {
        isEditing = true;
        const originalText = button.textContent;
        
        console.log(`Starting edit for button: ${buttonId}, current text: ${originalText}`);
        
        // Create edit dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 300px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #333;">Редактировать текст кнопки</h3>
            <input type="text" id="edit-input" value="${originalText}" style="
                width: 100%;
                padding: 10px;
                border: 2px solid #ff6b00;
                border-radius: 4px;
                font-size: 14px;
                margin-bottom: 15px;
                box-sizing: border-box;
            ">
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="save-btn" style="
                    padding: 8px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Сохранить</button>
                <button id="cancel-btn" style="
                    padding: 8px 20px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Отмена</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const input = dialog.querySelector('#edit-input');
        const saveBtn = dialog.querySelector('#save-btn');
        const cancelBtn = dialog.querySelector('#cancel-btn');
        
        input.focus();
        input.select();
        
        // Save handler
        const saveHandler = async () => {
            const newText = input.value.trim();
            if (newText && newText !== originalText) {
                console.log(`Saving new text: ${newText}`);
                button.textContent = newText;
                await saveButtonText(buttonId, newText);
            }
            dialog.remove();
            isEditing = false;
        };
        
        // Cancel handler
        const cancelHandler = () => {
            dialog.remove();
            isEditing = false;
        };
        
        saveBtn.addEventListener('click', saveHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        
        // Keyboard handlers
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveHandler();
            } else if (e.key === 'Escape') {
                cancelHandler();
            }
        });
    }

    // Save button text to server
    async function saveButtonText(buttonId, text) {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/button-texts/${buttonId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ text })
            });

            if (response.ok) {
                showNotification('✅ Текст кнопки сохранен!');
                console.log(`Button text saved: ${buttonId} = ${text}`);
            } else {
                showNotification('❌ Ошибка при сохранении', 'error');
                console.error('Failed to save button text');
            }
        } catch (error) {
            showNotification('❌ Ошибка при сохранении', 'error');
            console.error('Error saving button text:', error);
        }
    }

    // Setup image editors
    function setupImageEditors() {
        console.log('Setting up image editors...');
        
        // Find all images
        const images = document.querySelectorAll('img');
        console.log(`Found ${images.length} images`);
        
        images.forEach(img => {
            // Skip if already has edit button or is an icon
            if (img.parentElement && img.parentElement.querySelector('.img-edit-icon')) {
                return;
            }
            
            // Skip small icons and logos
            if (img.width < 50 || img.height < 50) {
                return;
            }
            
            // Skip header icons and system images
            if (img.classList.contains('header-icon') || 
                img.classList.contains('logo') ||
                img.parentElement.classList.contains('header-icon')) {
                return;
            }
            
            addImageEditor(img);
        });
    }

    // Add editor to an image
    function addImageEditor(img) {
        console.log(`Adding editor to image: ${img.src}`);
        
        // Create wrapper if needed
        let wrapper = img.parentElement;
        if (!wrapper || !wrapper.classList.contains('img-edit-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'img-edit-wrapper';
            wrapper.style.cssText = 'position: relative; display: inline-block;';
            
            // Copy important styles
            if (img.style.width) wrapper.style.width = img.style.width;
            if (img.style.height) wrapper.style.height = img.style.height;
            
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'img-edit-icon';
        editBtn.innerHTML = '🖼️';
        editBtn.title = 'Заменить изображение';
        editBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            background: #4CAF50;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
            opacity: 0.8;
        `;
        
        // Show on hover
        wrapper.addEventListener('mouseenter', () => {
            editBtn.style.opacity = '1';
        });
        
        wrapper.addEventListener('mouseleave', () => {
            editBtn.style.opacity = '0.8';
        });
        
        // Add click handler
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Image edit button clicked');
            
            if (!editingImage) {
                editImage(img);
            }
        });
        
        // Add hover effect
        editBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.background = '#45a049';
        });
        
        editBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.background = '#4CAF50';
        });
        
        wrapper.appendChild(editBtn);
        console.log('Image edit button added');
    }

    // Edit image
    function editImage(img) {
        editingImage = true;
        
        console.log('Starting image edit');
        
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                console.log(`Selected file: ${file.name}`);
                
                // Create preview
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Update image source
                    const oldSrc = img.src;
                    img.src = e.target.result;
                    
                    // Show confirmation
                    showImageConfirmation(img, oldSrc, e.target.result, file);
                };
                reader.readAsDataURL(file);
            }
            editingImage = false;
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        fileInput.remove();
    }

    // Show image confirmation dialog
    function showImageConfirmation(img, oldSrc, newSrc, file) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 500px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #333;">Подтвердить замену изображения</h3>
            <div style="display: flex; gap: 20px; margin-bottom: 15px;">
                <div style="text-align: center;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">Текущее</p>
                    <img src="${oldSrc}" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd;">
                </div>
                <div style="text-align: center;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">Новое</p>
                    <img src="${newSrc}" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd;">
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="confirm-btn" style="
                    padding: 8px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Подтвердить</button>
                <button id="cancel-btn" style="
                    padding: 8px 20px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Отмена</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const confirmBtn = dialog.querySelector('#confirm-btn');
        const cancelBtn = dialog.querySelector('#cancel-btn');
        
        confirmBtn.addEventListener('click', async () => {
            // Keep new image
            await saveImage(img, file);
            showNotification('✅ Изображение обновлено!');
            dialog.remove();
        });
        
        cancelBtn.addEventListener('click', () => {
            // Restore old image
            img.src = oldSrc;
            dialog.remove();
        });
    }

    // Save image to server
    async function saveImage(img, file) {
        try {
            console.log(`Uploading image: ${file.name}`);
            
            const formData = new FormData();
            formData.append('image', file);
            
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Image uploaded successfully:', data.url);
                
                // Update image source to server URL
                img.src = data.url;
                
                // Store mapping for this specific image
                const imgId = img.alt || img.className || 'img_' + Date.now();
                localStorage.setItem(`admin_img_${imgId}`, data.url);
                
                return data.url;
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error saving image:', error);
            showNotification('❌ Ошибка при сохранении изображения', 'error');
            throw error;
        }
    }

    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            z-index: 10001;
            font-family: Inter, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Observe content changes
    function observeContentChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Re-initialize editors for new content
                    setTimeout(() => {
                        setupButtonEditors();
                        setupImageEditors();
                    }, 100);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Add CSS animations
    const style = document.createElement('style');
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
        
        .edit-wrapper:hover .btn-edit-icon,
        .img-edit-wrapper:hover .img-edit-icon {
            opacity: 1 !important;
        }
    `;
    document.head.appendChild(style);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEnhancedEditor);
    } else {
        // Wait for other scripts to load
        setTimeout(initEnhancedEditor, 500);
    }

    // Re-initialize periodically to catch dynamic content
    setInterval(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            setupButtonEditors();
            setupImageEditors();
        }
    }, 3000);

    // Export for debugging
    window.enhancedEditor = {
        init: initEnhancedEditor,
        setupButtonEditors,
        setupImageEditors
    };
})();
