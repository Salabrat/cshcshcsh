// Simple admin editor that definitely works
(function() {
    'use strict';
    
    console.log('Simple admin editor starting...');
    
    // Check if admin
    function isAdmin() {
        return localStorage.getItem('adminToken') !== null;
    }
    
    // Initialize editors
    function initEditors() {
        if (!isAdmin()) {
            console.log('Not admin, skipping editors');
            return;
        }
        
        console.log('Initializing simple editors...');
        
        // Setup button editors - DISABLED (using block editor instead)
        // setupButtonEditors();
        
        // Setup image editors  
        setupImageEditors();
        
        // Re-run periodically for dynamic content
        setInterval(() => {
            if (isAdmin()) {
                // setupButtonEditors(); // DISABLED
                setupImageEditors();
            }
        }, 2000);
    }
    
    // Setup button editors
    function setupButtonEditors() {
        const buttons = document.querySelectorAll('[data-text-id]');
        
        buttons.forEach(button => {
            // Skip if already has edit button
            const existingBtn = button.parentElement?.querySelector('.simple-btn-edit');
            if (existingBtn) return;
            
            const buttonId = button.getAttribute('data-text-id');
            console.log(`Adding editor to button: ${buttonId}`);
            
            // Ensure button is in a wrapper
            let wrapper = button.parentElement;
            if (!wrapper || wrapper.tagName === 'BODY' || wrapper.tagName === 'HTML') {
                wrapper = document.createElement('span');
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                button.parentNode.insertBefore(wrapper, button);
                wrapper.appendChild(button);
            }
            
            // Make wrapper relative positioned
            if (wrapper.style.position !== 'absolute' && wrapper.style.position !== 'fixed') {
                wrapper.style.position = 'relative';
            }
            
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'simple-btn-edit';
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Edit text';
            editBtn.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                width: 30px;
                height: 30px;
                background: #ff6b00;
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10000;
                font-size: 14px;
                line-height: 1;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            `;
            
            editBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                editButtonText(button, buttonId);
            };
            
            wrapper.appendChild(editBtn);
        });
    }
    
    // Setup image editors
    function setupImageEditors() {
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            // Skip small images
            if (img.width < 100 || img.height < 100) return;
            
            // Skip if already has edit button
            const existingBtn = img.parentElement?.querySelector('.simple-img-edit');
            if (existingBtn) return;
            
            console.log(`Adding editor to image: ${img.src}`);
            
            // Ensure image is in a wrapper
            let wrapper = img.parentElement;
            if (!wrapper || wrapper.tagName === 'BODY' || wrapper.tagName === 'HTML') {
                wrapper = document.createElement('span');
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                img.parentNode.insertBefore(wrapper, img);
                wrapper.appendChild(img);
            }
            
            // Make wrapper relative positioned
            if (wrapper.style.position !== 'absolute' && wrapper.style.position !== 'fixed') {
                wrapper.style.position = 'relative';
            }
            
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'simple-img-edit';
            editBtn.innerHTML = '🖼️';
            editBtn.title = 'Replace image';
            editBtn.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                width: 40px;
                height: 40px;
                background: #4CAF50;
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10000;
                font-size: 20px;
                line-height: 1;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            `;
            
            editBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                editImage(img);
            };
            
            wrapper.appendChild(editBtn);
        });
    }
    
    // Edit button text
    function editButtonText(button, buttonId) {
        const currentText = button.textContent;
        const newText = prompt('Edit button text:', currentText);
        
        if (newText && newText !== currentText) {
            button.textContent = newText;
            
            // Save to server
            fetch(`/api/button-texts/${buttonId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                },
                body: JSON.stringify({ text: newText })
            }).then(response => {
                if (response.ok) {
                    showNotification('✅ Text saved!');
                } else {
                    showNotification('❌ Save failed!', 'error');
                }
            }).catch(error => {
                console.error('Save error:', error);
                showNotification('❌ Save error!', 'error');
            });
        }
    }
    
    // Edit image
    function editImage(img) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Preview
            const reader = new FileReader();
            reader.onload = (e) => {
                if (confirm('Replace this image?')) {
                    const oldSrc = img.src;
                    img.src = e.target.result;
                    
                    // Upload to server
                    const formData = new FormData();
                    formData.append('image', file);
                    
                    fetch('/api/upload-image', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                        },
                        body: formData
                    }).then(response => response.json())
                    .then(data => {
                        if (data.url) {
                            img.src = data.url;
                            showNotification('✅ Image uploaded!');
                        } else {
                            img.src = oldSrc;
                            showNotification('❌ Upload failed!', 'error');
                        }
                    }).catch(error => {
                        console.error('Upload error:', error);
                        img.src = oldSrc;
                        showNotification('❌ Upload error!', 'error');
                    });
                }
            };
            reader.readAsDataURL(file);
        };
        
        input.click();
    }
    
    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 4px;
            z-index: 100000;
            font-family: Arial, sans-serif;
            animation: slideIn 0.3s;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .simple-btn-edit:hover {
            transform: scale(1.1);
            background: #ff4500 !important;
        }
        .simple-img-edit:hover {
            transform: scale(1.1);
            background: #45a049 !important;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize
    console.log('Waiting for DOM...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initEditors, 500);
        });
    } else {
        setTimeout(initEditors, 500);
    }
    
    // Export for manual use
    window.simpleAdminEditor = {
        init: initEditors,
        setupButtons: setupButtonEditors,
        setupImages: setupImageEditors
    };
    
    console.log('Simple admin editor loaded. Use window.simpleAdminEditor.init() to manually initialize.');
})();
