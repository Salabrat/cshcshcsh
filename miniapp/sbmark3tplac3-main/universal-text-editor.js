// Universal Text Editor for Administrators - Edit ANY text on the page
(function() {
    'use strict';

    // Check if user is admin
    function isAdmin() {
        return localStorage.getItem('adminLoggedIn') === 'true' ||
               localStorage.getItem('username') === 'admin' ||
               localStorage.getItem('userRole') === 'admin';
    }

    // Get unique identifier for element
    function getElementId(element) {
        // Try to get existing ID or generate one based on content and position
        if (element.id) return element.id;
        
        const tagName = element.tagName.toLowerCase();
        const className = element.className || 'no-class';
        const textContent = element.textContent.substring(0, 20).replace(/\s+/g, '-');
        const parent = element.parentElement;
        const index = parent ? Array.from(parent.children).indexOf(element) : 0;
        
        return `${tagName}-${className}-${index}-${textContent}`.replace(/[^a-zA-Z0-9-]/g, '');
    }

    // Initialize text editor
    function initUniversalTextEditor() {
        if (!isAdmin()) return;

        // Select ALL text elements on the page
        const textSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',  // All headings
            'p',                                   // All paragraphs
            'span',                                // All spans
            'a',                                   // All links
            'button',                              // All buttons
            'label',                               // All labels
            'li',                                  // All list items
            '.hero-title',
            '.hero-subtitle',
            '.campaign-label',
            '.campaign-title', 
            '.campaign-description',
            '.section-label',
            '.about-title',
            '.about-text',
            '.about-item-title',
            '.footer-newsletter-title',
            '.footer-newsletter-text',
            '.footer-column h4'
        ];

        // Process each selector
        textSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if element has no text content or is script/style
                if (!element.textContent.trim()) return;
                if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
                
                // Skip if element already has edit button
                if (element.querySelector('.universal-edit-btn')) return;
                if (element.parentElement && element.parentElement.querySelector('.universal-edit-btn')) return;
                
                // Skip if element is inside modal or edit interface
                if (element.closest('#textEditModal') || element.closest('.universal-edit-btn')) return;
                
                // Add edit button
                addUniversalEditButton(element);
            });
        });

        // Create modal if it doesn't exist
        if (!document.getElementById('universalTextEditModal')) {
            createUniversalTextEditModal();
        }
    }

    // Add edit button to any text element
    function addUniversalEditButton(element) {
        // Create wrapper if needed
        let wrapper = element.parentElement;
        if (!wrapper.classList.contains('universal-edit-wrapper')) {
            // For inline elements, create wrapper
            if (getComputedStyle(element).display === 'inline') {
                wrapper = document.createElement('span');
                wrapper.className = 'universal-edit-wrapper';
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                element.parentNode.insertBefore(wrapper, element);
                wrapper.appendChild(element);
            } else {
                // For block elements, make parent relative
                element.style.position = 'relative';
                wrapper = element;
            }
        }

        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'universal-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Редактировать текст';
        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openUniversalTextEditModal(element);
        };

        // Style the button
        editBtn.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 25px;
            height: 25px;
            background: rgba(220, 38, 38, 0.9);
            color: white;
            border: 1px solid white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: all 0.2s ease;
            z-index: 1000;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            pointer-events: none;
        `;

        // Show button on hover
        wrapper.addEventListener('mouseenter', () => {
            editBtn.style.opacity = '1';
            editBtn.style.pointerEvents = 'auto';
        });

        wrapper.addEventListener('mouseleave', () => {
            editBtn.style.opacity = '0';
            editBtn.style.pointerEvents = 'none';
        });

        // Add hover effect to button itself
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.background = 'rgba(220, 38, 38, 1)';
            editBtn.style.transform = 'scale(1.1)';
        });

        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.background = 'rgba(220, 38, 38, 0.9)';
            editBtn.style.transform = 'scale(1)';
        });

        wrapper.appendChild(editBtn);
    }

    // Create universal text edit modal
    function createUniversalTextEditModal() {
        const modal = document.createElement('div');
        modal.id = 'universalTextEditModal';
        modal.className = 'universal-text-edit-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Редактировать текст</h2>
                    <button class="modal-close" onclick="closeUniversalTextEditModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="text-edit-form">
                        <label for="universalTextContent">Текст:</label>
                        <textarea id="universalTextContent" rows="6" placeholder="Введите текст..."></textarea>
                        <div class="edit-options">
                            <label>
                                <input type="checkbox" id="universalAllowHtml"> Разрешить HTML
                            </label>
                        </div>
                        <div class="element-info">
                            <small>Элемент: <span id="elementInfo"></span></small>
                        </div>
                        <div class="current-preview">
                            <h3>Предпросмотр:</h3>
                            <div id="universalTextPreview"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="closeUniversalTextEditModal()">Отмена</button>
                    <button class="btn-save" onclick="saveUniversalText()">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('universalTextContent').addEventListener('input', updateUniversalPreview);
        document.getElementById('universalAllowHtml').addEventListener('change', updateUniversalPreview);

        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeUniversalTextEditModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeUniversalTextEditModal();
            }
        });
    }

    // Current editing element
    let currentEditingElement = null;

    // Open universal text edit modal
    window.openUniversalTextEditModal = function(element) {
        currentEditingElement = element;

        const modal = document.getElementById('universalTextEditModal');
        modal.style.display = 'flex';

        // Set current content
        const isHtml = element.innerHTML !== element.textContent;
        const currentContent = isHtml ? element.innerHTML : element.textContent;
        
        document.getElementById('universalTextContent').value = currentContent;
        document.getElementById('universalAllowHtml').checked = isHtml;
        
        // Show element info
        const elementInfo = `${element.tagName.toLowerCase()}${element.className ? '.' + element.className.split(' ').join('.') : ''}`;
        document.getElementById('elementInfo').textContent = elementInfo;

        // Update preview
        updateUniversalPreview();
    };

    // Close universal text edit modal
    window.closeUniversalTextEditModal = function() {
        const modal = document.getElementById('universalTextEditModal');
        modal.style.display = 'none';
        currentEditingElement = null;
    };

    // Update preview
    function updateUniversalPreview() {
        const content = document.getElementById('universalTextContent').value;
        const allowHtml = document.getElementById('universalAllowHtml').checked;
        const preview = document.getElementById('universalTextPreview');

        if (allowHtml) {
            preview.innerHTML = content;
        } else {
            preview.textContent = content;
        }
    }

    // Save universal text
    window.saveUniversalText = async function() {
        const content = document.getElementById('universalTextContent').value.trim();
        const allowHtml = document.getElementById('universalAllowHtml').checked;

        if (!content) {
            showUniversalNotification('Текст не может быть пустым', 'warning');
            return;
        }

        try {
            // Update element on page
            if (currentEditingElement) {
                if (allowHtml) {
                    currentEditingElement.innerHTML = content;
                } else {
                    currentEditingElement.textContent = content;
                }
            }

            // Save to server
            const elementId = getElementId(currentEditingElement);
            await saveTextToServer(elementId, content);

            // Show success message
            showUniversalNotification('Текст успешно обновлен', 'success');

            // Close modal
            closeUniversalTextEditModal();
        } catch (error) {
            console.error('Error saving text:', error);
            showUniversalNotification('Ошибка при сохранении текста', 'error');
        }
    };

    // Save text to server
    async function saveTextToServer(elementId, content) {
        try {
            // Get all saved texts
            const response = await fetch('/api/page-texts?page=index');
            let savedTexts = {};
            
            if (response.ok) {
                savedTexts = await response.json();
            }

            // Update or add new text
            savedTexts[elementId] = {
                content: content,
                timestamp: new Date().toISOString()
            };

            // Save back to server
            const saveResponse = await fetch('/api/page-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    page: 'index',
                    texts: savedTexts
                })
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save text');
            }

            return await saveResponse.json();
        } catch (error) {
            console.error('Error saving to server:', error);
            // Still update locally even if server save fails
        }
    }

    // Load saved texts on page load
    async function loadSavedTexts() {
        try {
            const response = await fetch('/api/page-texts?page=index');
            if (!response.ok) return;

            const savedTexts = await response.json();
            
            // Apply saved texts to elements
            Object.entries(savedTexts).forEach(([elementId, data]) => {
                // Try to find element by various methods
                let element = document.getElementById(elementId);
                
                if (!element) {
                    // Try to find by generated ID pattern
                    const parts = elementId.split('-');
                    if (parts.length >= 2) {
                        const tagName = parts[0];
                        const className = parts[1] !== 'no-class' ? parts[1] : '';
                        
                        if (className) {
                            element = document.querySelector(`${tagName}.${className}`);
                        }
                    }
                }

                if (element && data.content) {
                    // Check if content has HTML
                    if (data.content.includes('<')) {
                        element.innerHTML = data.content;
                    } else {
                        element.textContent = data.content;
                    }
                }
            });
        } catch (error) {
            console.error('Error loading saved texts:', error);
        }
    }

    // Show notification
    function showUniversalNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `universal-notification ${type}`;
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
    function addUniversalStyles() {
        if (document.getElementById('universal-text-editor-styles')) return;

        const style = document.createElement('style');
        style.id = 'universal-text-editor-styles';
        style.textContent = `
            .universal-edit-wrapper {
                position: relative;
                display: inline-block;
            }

            .universal-text-edit-modal {
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

            .universal-text-edit-modal .modal-content {
                background: white;
                border-radius: 10px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 5px 30px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }

            .universal-text-edit-modal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .universal-text-edit-modal .modal-header h2 {
                margin: 0;
                font-size: 1.5rem;
                color: #333;
            }

            .universal-text-edit-modal .modal-close {
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

            .universal-text-edit-modal .modal-close:hover {
                color: #000;
            }

            .universal-text-edit-modal .modal-body {
                padding: 30px;
            }

            .text-edit-form label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #333;
            }

            #universalTextContent {
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

            .element-info {
                margin: 10px 0;
                color: #666;
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

            #universalTextPreview {
                padding: 10px;
                background: white;
                border-radius: 4px;
                border: 1px solid #e0e0e0;
                min-height: 40px;
            }

            .universal-text-edit-modal .modal-footer {
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
                from { opacity: 0; }
                to { opacity: 1; }
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
    function init() {
        addUniversalStyles();
        loadSavedTexts();
        initUniversalTextEditor();
        
        // Re-initialize when DOM changes (for dynamic content)
        const observer = new MutationObserver(() => {
            initUniversalTextEditor();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also reinitialize on page visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isAdmin()) {
            initUniversalTextEditor();
        }
    });

    // Export for global access
    window.universalTextEditor = {
        init: initUniversalTextEditor,
        refresh: () => {
            document.querySelectorAll('.universal-edit-btn').forEach(btn => btn.remove());
            document.querySelectorAll('.universal-edit-wrapper').forEach(wrapper => {
                if (wrapper.children.length === 1) {
                    const child = wrapper.firstElementChild;
                    wrapper.parentNode.insertBefore(child, wrapper);
                    wrapper.remove();
                }
            });
            initUniversalTextEditor();
        }
    };
})();
