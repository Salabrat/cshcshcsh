// Homepage Text Editor for Administrators
(function() {
    'use strict';

    // Check if user is admin
    function isAdmin() {
        return window.isAdminUser === true || 
               localStorage.getItem('adminToken') !== null;
    }

    // Text mapping for homepage sections
    const textMapping = {
        'hero-title': { section: 'hero', field: 'title', allowHtml: true },
        'hero-subtitle': { section: 'hero', field: 'subtitle', allowHtml: false },
        'campaign1-label': { section: 'campaign1', field: 'label', allowHtml: false },
        'campaign1-title': { section: 'campaign1', field: 'title', allowHtml: true },
        'campaign1-description': { section: 'campaign1', field: 'description', allowHtml: false },
        'campaign2-label': { section: 'campaign2', field: 'label', allowHtml: false },
        'campaign2-title': { section: 'campaign2', field: 'title', allowHtml: true },
        'campaign2-description': { section: 'campaign2', field: 'description', allowHtml: false },
        'campaign3-label': { section: 'campaign3', field: 'label', allowHtml: false },
        'campaign3-title': { section: 'campaign3', field: 'title', allowHtml: true },
        'campaign3-description': { section: 'campaign3', field: 'description', allowHtml: false },
        'about-title': { section: 'about', field: 'title', allowHtml: false },
        'about-text': { section: 'about', field: 'text', allowHtml: false }
    };

    // Initialize text editor
    function initTextEditor() {
        if (!isAdmin()) {
            console.log('Not admin, skipping text editor initialization');
            return;
        }
        
        console.log('Initializing homepage text editor for admin...');

        // Add edit buttons to all mapped text elements
        Object.keys(textMapping).forEach(className => {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                addEditButton(element, className);
            });
        });
        
        // Also add edit buttons to elements with data-original-content
        const elementsWithContent = document.querySelectorAll('[data-original-content]');
        elementsWithContent.forEach(element => {
            // Get class name for mapping
            const classList = Array.from(element.classList);
            const mappedClass = classList.find(cls => textMapping[cls]);
            if (mappedClass) {
                addEditButton(element, mappedClass);
            }
        });

        // Create modal if it doesn't exist
        if (!document.getElementById('textEditModal')) {
            createTextEditModal();
        }
    }

    // Add edit button to text element
    function addEditButton(element, className) {
        // Check if button already exists
        if (element.parentElement.querySelector('.text-edit-btn')) return;

        // Create wrapper if text element is not already wrapped
        let wrapper = element.parentElement;
        if (!wrapper.classList.contains('text-edit-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'text-edit-wrapper';
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            element.parentNode.insertBefore(wrapper, element);
            wrapper.appendChild(element);
        }

        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'text-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Редактировать текст';
        editBtn.onclick = () => openTextEditModal(element, className);

        // Style the button
        editBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            width: 30px;
            height: 30px;
            background: #ff6b00;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex !important;
            align-items: center;
            justify-content: center;
            opacity: 1 !important;
            transition: all 0.2s ease;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: auto !important;
        `;

        // Add hover effects
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.background = '#ff4500';
            editBtn.style.transform = 'scale(1.1)';
        });

        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.background = '#ff6b00';
            editBtn.style.transform = 'scale(1)';
        });

        wrapper.appendChild(editBtn);
    }

    // Create text edit modal
    function createTextEditModal() {
        const modal = document.createElement('div');
        modal.id = 'textEditModal';
        modal.className = 'text-edit-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Редактировать текст</h2>
                    <button class="modal-close" onclick="closeTextEditModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="text-edit-form">
                        <label for="textContent">Текст:</label>
                        <textarea id="textContent" rows="6" placeholder="Введите текст..."></textarea>
                        <div class="edit-options">
                            <label>
                                <input type="checkbox" id="allowHtml"> Разрешить HTML (для заголовков)
                            </label>
                        </div>
                        <div class="current-preview">
                            <h3>Предпросмотр:</h3>
                            <div id="textPreview"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="closeTextEditModal()">Отмена</button>
                    <button class="btn-save" onclick="saveText()">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('textContent').addEventListener('input', updatePreview);
        document.getElementById('allowHtml').addEventListener('change', updatePreview);

        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeTextEditModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeTextEditModal();
            }
        });
    }

    // Current editing element and mapping
    let currentElement = null;
    let currentMapping = null;

    // Open text edit modal
    window.openTextEditModal = function(element, className) {
        currentElement = element;
        currentMapping = textMapping[className];

        const modal = document.getElementById('textEditModal');
        modal.style.display = 'flex';

        // Set current content
        const currentContent = currentMapping.allowHtml ? element.innerHTML : element.textContent;
        document.getElementById('textContent').value = currentContent;
        document.getElementById('allowHtml').checked = currentMapping.allowHtml;

        // Update preview
        updatePreview();
    };

    // Close text edit modal
    window.closeTextEditModal = function() {
        const modal = document.getElementById('textEditModal');
        modal.style.display = 'none';
        currentElement = null;
        currentMapping = null;
    };

    // Update preview
    function updatePreview() {
        const content = document.getElementById('textContent').value;
        const allowHtml = document.getElementById('allowHtml').checked;
        const preview = document.getElementById('textPreview');

        if (allowHtml) {
            preview.innerHTML = content;
        } else {
            preview.textContent = content;
        }
    }

    // Save text
    window.saveText = async function() {
        const content = document.getElementById('textContent').value.trim();

        if (!content) {
            showNotification('Текст не может быть пустым', 'warning');
            return;
        }

        try {
            // Get current texts
            const response = await fetch('/api/homepage-texts');
            const currentTexts = await response.json();

            // Update the specific text
            if (!currentTexts[currentMapping.section]) {
                currentTexts[currentMapping.section] = {};
            }
            currentTexts[currentMapping.section][currentMapping.field] = content;

            // Save updated texts
            const saveResponse = await fetch('/api/homepage-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentTexts)
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save text');
            }

            // Update text on page
            if (currentElement) {
                if (currentMapping.allowHtml) {
                    currentElement.innerHTML = content;
                } else {
                    currentElement.textContent = content;
                }
            }

            // Show success message
            showNotification('Текст успешно обновлен', 'success');

            // Close modal
            closeTextEditModal();
        } catch (error) {
            console.error('Error saving text:', error);
            showNotification('Ошибка при сохранении текста', 'error');
        }
    };

    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `text-notification ${type}`;
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
            z-index: 100001;
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
        if (document.getElementById('homepage-text-editor-styles')) return;

        const style = document.createElement('style');
        style.id = 'homepage-text-editor-styles';
        style.textContent = `
            .text-edit-wrapper {
                position: relative;
                display: block;
            }

            .text-edit-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 99998;
                animation: fadeIn 0.3s ease;
            }

            .text-edit-modal .modal-content {
                background: white;
                border-radius: 10px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 5px 30px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }

            .text-edit-modal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .text-edit-modal .modal-header h2 {
                margin: 0;
                font-size: 1.5rem;
                color: #333;
            }

            .text-edit-modal .modal-close {
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

            .text-edit-modal .modal-close:hover {
                color: #000;
            }

            .text-edit-modal .modal-body {
                padding: 30px;
            }

            .text-edit-form label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #333;
            }

            #textContent {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                min-height: 120px;
            }

            .edit-options {
                margin: 15px 0;
            }

            .edit-options label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: normal;
                font-size: 14px;
            }

            .current-preview {
                margin-top: 20px;
                padding: 15px;
                background: #f5f5f5;
                border-radius: 8px;
            }

            .current-preview h3 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 1rem;
            }

            #textPreview {
                padding: 10px;
                background: white;
                border-radius: 4px;
                border: 1px solid #e0e0e0;
                min-height: 40px;
            }

            .text-edit-modal .modal-footer {
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
            initTextEditor();
        });
    } else {
        addStyles();
        initTextEditor();
    }

    // Also initialize on page visibility change (for SPA navigation)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isAdmin()) {
            initTextEditor();
        }
    });

    // Export for global access
    window.homepageTextEditor = {
        init: initTextEditor
    };
})();
