// Admin button text editor with server save
(function() {
    'use strict';

    let isEditing = false;
    let originalTexts = {};

    function initButtonEditor() {
        // Double-check if user is admin
        if (!window.isAdminUser) {
            console.log('Not an admin user, skipping button editor initialization');
            // Remove any existing edit buttons if they exist
            removeAllEditButtons();
            return;
        }

        // Additional server-side check
        verifyAdminStatus().then(isAdmin => {
            if (!isAdmin) {
                console.log('Admin verification failed, removing edit buttons');
                removeAllEditButtons();
                window.isAdminUser = false;
                return;
            }
            console.log('Admin verified, initializing button editor...');
            setupEditButtons();
        });
    }

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

    function removeAllEditButtons() {
        // Remove any existing edit buttons
        const editButtons = document.querySelectorAll('button[title="Редактировать текст кнопки"]');
        editButtons.forEach(btn => {
            const wrapper = btn.parentElement;
            if (wrapper && wrapper.style.position === 'relative') {
                const originalButton = wrapper.querySelector('[data-text-id]');
                if (originalButton && wrapper.parentElement) {
                    wrapper.parentElement.insertBefore(originalButton, wrapper);
                    wrapper.remove();
                }
            } else {
                btn.remove();
            }
        });
    }

    function setupEditButtons() {
        console.log('Setting up edit buttons for admin...');
        
        // Add edit buttons to all buttons with data-text-id
        const buttons = document.querySelectorAll('[data-text-id]');
        
        buttons.forEach(button => {
            makeButtonEditable(button);
        });

        // Add save notification container
        if (!document.getElementById('save-notification')) {
            const notification = document.createElement('div');
            notification.id = 'save-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 4px;
                z-index: 10000;
                display: none;
                font-family: Inter, sans-serif;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(notification);
        }
    }

    function makeButtonEditable(button) {
        const buttonId = button.getAttribute('data-text-id');
        
        // Skip buttons that shouldn't be editable
        if (!buttonId) return;
        
        // Skip form submit buttons and system buttons
        if (button.type === 'submit' || 
            button.classList.contains('search-submit') ||
            button.classList.contains('btn-newsletter') ||
            button.classList.contains('theme-toggle') ||
            button.classList.contains('header-icon') ||
            button.classList.contains('mobile-menu-btn') ||
            button.classList.contains('slider-arrow')) {
            return;
        }
        
        // Create edit wrapper
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        button.parentNode.insertBefore(wrapper, button);
        wrapper.appendChild(button);

        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '✏️';
        editBtn.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: #ff6b00;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            z-index: 1000;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        editBtn.title = 'Редактировать текст кнопки';
        wrapper.appendChild(editBtn);

        // Edit functionality
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!isEditing) {
                startEditing(button, buttonId);
            }
        });
    }

    function startEditing(button, buttonId) {
        isEditing = true;
        originalTexts[buttonId] = button.textContent;

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = button.textContent;
        input.style.cssText = `
            padding: 10px 15px;
            font-size: 14px;
            border: 2px solid #ff6b00;
            border-radius: 4px;
            outline: none;
            min-width: 200px;
            font-family: inherit;
        `;

        // Create save/cancel buttons
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = 'margin-top: 10px; display: flex; gap: 10px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Сохранить';
        saveBtn.style.cssText = `
            padding: 8px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Отмена';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;

        buttonsContainer.appendChild(saveBtn);
        buttonsContainer.appendChild(cancelBtn);

        // Create edit container
        const editContainer = document.createElement('div');
        editContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            padding: 15px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1001;
            margin-top: 10px;
        `;
        editContainer.appendChild(input);
        editContainer.appendChild(buttonsContainer);

        button.parentElement.appendChild(editContainer);
        input.focus();
        input.select();

        // Save functionality
        saveBtn.addEventListener('click', async () => {
            const newText = input.value.trim();
            if (newText && newText !== originalTexts[buttonId]) {
                await saveButtonText(buttonId, newText);
                button.textContent = newText;
            }
            editContainer.remove();
            isEditing = false;
        });

        // Cancel functionality
        cancelBtn.addEventListener('click', () => {
            editContainer.remove();
            isEditing = false;
        });

        // Save on Enter
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const newText = input.value.trim();
                if (newText && newText !== originalTexts[buttonId]) {
                    await saveButtonText(buttonId, newText);
                    button.textContent = newText;
                }
                editContainer.remove();
                isEditing = false;
            } else if (e.key === 'Escape') {
                editContainer.remove();
                isEditing = false;
            }
        });
    }

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
                showNotification('Текст кнопки сохранен!');
                console.log(`Button text saved: ${buttonId} = ${text}`);
            } else {
                showNotification('Ошибка при сохранении', 'error');
                console.error('Failed to save button text');
            }
        } catch (error) {
            showNotification('Ошибка при сохранении', 'error');
            console.error('Error saving button text:', error);
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.getElementById('save-notification');
        if (notification) {
            notification.textContent = message;
            notification.style.background = type === 'success' ? '#4CAF50' : '#f44336';
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButtonEditor);
    } else {
        // Wait a bit for admin status to be set
        setTimeout(initButtonEditor, 100);
    }

    // Periodic check to ensure only admins have edit buttons
    setInterval(() => {
        if (!window.isAdminUser) {
            removeAllEditButtons();
        }
    }, 5000); // Check every 5 seconds

    // Export for debugging
    window.adminButtonEditor = {
        init: initButtonEditor,
        saveButtonText,
        removeAllEditButtons
    };
})();
