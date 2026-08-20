// Force initialization of all admin editors
(function() {
    'use strict';
    
    console.log('Force init editors script loaded');
    
    // Wait for admin authentication
    function waitForAdmin() {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            console.log('No admin token, skipping force init');
            return;
        }
        
        console.log('Admin token found, forcing editor initialization...');
        
        // Force initialize enhanced editor
        if (window.enhancedEditor && typeof window.enhancedEditor.init === 'function') {
            console.log('Forcing enhanced editor init...');
            window.enhancedEditor.init();
        }
        
        // Force initialize button editor
        if (window.adminButtonEditor && typeof window.adminButtonEditor.init === 'function') {
            console.log('Forcing button editor init...');
            window.adminButtonEditor.init();
        }
        
        // Force initialize text editor
        if (window.forceTextEditor && typeof window.forceTextEditor.init === 'function') {
            console.log('Forcing text editor init...');
            window.forceTextEditor.init();
        }
        
        // Also try to manually setup buttons if needed
        setTimeout(() => {
            setupManualButtons();
        }, 500);
    }
    
    // Manual button setup as fallback
    function setupManualButtons() {
        console.log('Manual button setup...');
        
        // Find all buttons with data-text-id
        const buttons = document.querySelectorAll('[data-text-id]');
        console.log(`Found ${buttons.length} buttons with data-text-id`);
        
        buttons.forEach((button, index) => {
            // Check if button already has edit icon
            if (button.parentElement && button.parentElement.querySelector('.btn-edit-icon, .text-edit-btn')) {
                console.log(`Button ${index} already has edit icon`);
                return;
            }
            
            console.log(`Adding manual edit button to button ${index}: ${button.getAttribute('data-text-id')}`);
            
            // Create wrapper
            let wrapper = button.parentElement;
            if (!wrapper || (!wrapper.classList.contains('edit-wrapper') && !wrapper.classList.contains('text-edit-wrapper'))) {
                wrapper = document.createElement('div');
                wrapper.className = 'manual-edit-wrapper';
                wrapper.style.cssText = 'position: relative; display: inline-block;';
                button.parentNode.insertBefore(wrapper, button);
                wrapper.appendChild(button);
            }
            
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'manual-edit-btn';
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Edit button text';
            editBtn.style.cssText = `
                position: absolute;
                top: -10px;
                right: -10px;
                width: 35px;
                height: 35px;
                background: #ff6b00;
                color: white;
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                display: flex !important;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.4);
                opacity: 1 !important;
                visibility: visible !important;
            `;
            
            // Add click handler
            editBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const buttonId = button.getAttribute('data-text-id');
                const currentText = button.textContent;
                const newText = prompt(`Edit button text for "${buttonId}":`, currentText);
                
                if (newText !== null && newText !== currentText) {
                    button.textContent = newText;
                    saveButtonText(buttonId, newText);
                }
            };
            
            wrapper.appendChild(editBtn);
            console.log(`Manual edit button added for ${button.getAttribute('data-text-id')}`);
        });
        
        // Also setup image editors
        setupManualImageEditors();
    }
    
    // Manual image editor setup
    function setupManualImageEditors() {
        console.log('Setting up manual image editors...');
        
        const images = document.querySelectorAll('img');
        console.log(`Found ${images.length} images`);
        
        images.forEach((img, index) => {
            // Skip small images and icons
            if (img.width < 100 || img.height < 100) {
                return;
            }
            
            // Skip if already has edit button
            if (img.parentElement && img.parentElement.querySelector('.img-edit-icon, .manual-img-edit-btn')) {
                return;
            }
            
            console.log(`Adding manual edit button to image ${index}`);
            
            // Create wrapper
            let wrapper = img.parentElement;
            if (!wrapper || !wrapper.classList.contains('img-edit-wrapper')) {
                wrapper = document.createElement('div');
                wrapper.className = 'manual-img-wrapper';
                wrapper.style.cssText = 'position: relative; display: inline-block;';
                img.parentNode.insertBefore(wrapper, img);
                wrapper.appendChild(img);
            }
            
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'manual-img-edit-btn';
            editBtn.innerHTML = '🖼️';
            editBtn.title = 'Replace image';
            editBtn.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                width: 45px;
                height: 45px;
                background: #4CAF50;
                color: white;
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                font-size: 22px;
                display: flex !important;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.4);
                opacity: 0.9 !important;
                visibility: visible !important;
            `;
            
            // Add click handler
            editBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                
                fileInput.onchange = function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            if (confirm('Replace this image?')) {
                                img.src = e.target.result;
                                uploadImage(img, file);
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                };
                
                fileInput.click();
            };
            
            wrapper.appendChild(editBtn);
            console.log('Manual image edit button added');
        });
    }
    
    // Save button text
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
                console.log(`Button text saved: ${buttonId} = ${text}`);
                showNotification('✅ Button text saved!');
            } else {
                console.error('Failed to save button text');
                showNotification('❌ Failed to save', 'error');
            }
        } catch (error) {
            console.error('Error saving button text:', error);
            showNotification('❌ Error saving', 'error');
        }
    }
    
    // Upload image
    async function uploadImage(img, file) {
        try {
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
                img.src = data.url;
                console.log('Image uploaded:', data.url);
                showNotification('✅ Image uploaded!');
            } else {
                console.error('Failed to upload image');
                showNotification('❌ Upload failed', 'error');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            showNotification('❌ Upload error', 'error');
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
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitForAdmin, 1000);
        });
    } else {
        setTimeout(waitForAdmin, 1000);
    }
    
    // Also try again after a delay
    setTimeout(waitForAdmin, 3000);
    
    // Export for manual use
    window.forceInitEditors = {
        init: waitForAdmin,
        setupButtons: setupManualButtons,
        setupImages: setupManualImageEditors
    };
})();
