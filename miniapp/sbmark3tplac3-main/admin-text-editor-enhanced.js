// Enhanced Admin Text Editor - Edit ALL text elements with always visible buttons
(function() {
    'use strict';

    // Check if user is admin
    function isAdmin() {
        return localStorage.getItem('adminLoggedIn') === 'true' ||
               localStorage.getItem('username') === 'admin' ||
               localStorage.getItem('userRole') === 'admin';
    }

    // Initialize enhanced editor
    function initEnhancedEditor() {
        if (!isAdmin()) return;

        console.log('Initializing Enhanced Text Editor for Admin...');

        // Find ALL text elements
        const allElements = document.querySelectorAll('*');

        // Check if element should be editable
        function shouldBeEditable(element) {
            // Skip if not visible
            if (!element.offsetParent) return false;
            
            // Skip certain elements
            if (element.tagName === 'SCRIPT' || 
                element.tagName === 'STYLE' || 
                element.tagName === 'META' ||
                element.tagName === 'LINK' ||
                element.tagName === 'SVG' ||
                element.tagName === 'PATH') return;

            // Skip if element is part of our editing interface or already has edit button
            if (element.closest('.admin-edit-btn-wrapper') ||
                element.closest('#adminTextEditModal') ||
                element.classList.contains('admin-edit-btn') ||
                element.innerHTML.includes('admin-edit-btn') ||
                element.textContent === '') return;

            // Check if element has direct text content (not just from children)
            const hasDirectText = Array.from(element.childNodes).some(node => 
                node.nodeType === Node.TEXT_NODE && node.textContent.trim()
            );

            return hasDirectText || (element.children.length === 0 && element.textContent.trim());
        }

        let processedCount = 0;

        allElements.forEach(element => {
            if (shouldBeEditable(element)) {
                addAdminEditButton(element);
                processedCount++;
            }
        });

        console.log(`Added edit buttons to ${processedCount} text elements`);

        // Create modal if it doesn't exist
        if (!document.getElementById('adminTextEditModal')) {
            createAdminEditModal();
        }

        // Add global styles
        addAdminStyles();
    }

    // Add edit button to element
    function addAdminEditButton(element) {
        // Skip if already has button or is a button itself
        if (element.querySelector('.admin-edit-btn') || 
            element.classList.contains('admin-edit-btn') ||
            element.tagName === 'BUTTON' && element.textContent.includes('✏️')) return;
        
        // Skip system buttons and UI elements
        if (element.type === 'submit' || 
            element.classList.contains('search-submit') ||
            element.classList.contains('btn-newsletter') ||
            element.classList.contains('theme-toggle') ||
            element.classList.contains('header-icon') ||
            element.classList.contains('mobile-menu-btn') ||
            element.classList.contains('slider-arrow') ||
            element.closest('svg') ||
            element.querySelector('svg')) return;
        
        // Create wrapper
        const wrapper = document.createElement('span');
        wrapper.className = 'admin-edit-btn-wrapper';
        wrapper.style.cssText = `
            position: relative;
            display: inline-block;
        `;

        // Wrap the element
        if (element.parentNode) {
            element.parentNode.insertBefore(wrapper, element);
            wrapper.appendChild(element);
        }

        // Make element position relative for button positioning
        element.style.position = 'relative';

        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'admin-edit-btn';
        editBtn.innerHTML = '';
        editBtn.title = '';

        // Style the button
        editBtn.style.cssText = `
            position: absolute;
            top: -5px;
            right: -5px;
            width: 22px;
            height: 22px;
            background: #ff6b00;
            color: white;
            border: 1px solid white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 9999;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            transform: scale(1.2);
        `;

        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAdminEditModal(element);
        };

        // Hover effects
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.transform = 'scale(1.2)';
            editBtn.style.background = 'rgba(255, 0, 0, 1)';
        });

        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.transform = 'scale(1)';
            editBtn.style.background = 'rgba(220, 38, 38, 1)';
        });

        // Append button to element
        element.appendChild(editBtn);
    }

    // Create edit modal
    function createAdminEditModal() {
        const modal = document.createElement('div');
        modal.id = 'adminTextEditModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100000;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 10px; padding: 30px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <h2 style="margin-top: 0; color: #333;">Редактировать текст</h2>
                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 10px; font-weight: bold;">Текст:</label>
                    <textarea id="adminTextInput" style="width: 100%; min-height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; resize: vertical;"></textarea>
                </div>
                <div style="margin: 20px 0;">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="adminAllowHtml">
                        <span>Разрешить HTML</span>
                    </label>
                </div>
                <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    <strong>Предпросмотр:</strong>
                    <div id="adminTextPreview" style="margin-top: 10px; padding: 10px; background: white; border: 1px solid #ddd; border-radius: 3px; min-height: 50px;"></div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeAdminEditModal()" style="padding: 10px 20px; background: #e0e0e0; border: none; border-radius: 5px; cursor: pointer;">Отмена</button>
                    <button onclick="saveAdminText()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 5px; cursor: pointer;">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const textInput = document.getElementById('adminTextInput');
        const allowHtml = document.getElementById('adminAllowHtml');
        const preview = document.getElementById('adminTextPreview');

        textInput.addEventListener('input', () => {
            if (allowHtml.checked) {
                preview.innerHTML = textInput.value;
            } else {
                preview.textContent = textInput.value;
            }
        });

        allowHtml.addEventListener('change', () => {
            if (allowHtml.checked) {
                preview.innerHTML = textInput.value;
            } else {
                preview.textContent = textInput.value;
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAdminEditModal();
            }
        });
    }

    // Current editing element
    let currentEditElement = null;

    // Open edit modal
    window.openAdminEditModal = function(element) {
        currentEditElement = element;
        const modal = document.getElementById('adminTextEditModal');
        modal.style.display = 'flex';

        // Remove edit button from text before getting content
        const editBtn = element.querySelector('.admin-edit-btn');
        if (editBtn) editBtn.style.display = 'none';

        // Get current content
        const isHtml = element.innerHTML !== element.textContent;
        const content = isHtml ? element.innerHTML : element.textContent;

        // Restore edit button
        if (editBtn) editBtn.style.display = 'flex';

        // Set modal values
        document.getElementById('adminTextInput').value = content;
        document.getElementById('adminAllowHtml').checked = isHtml;
        
        // Update preview
        const preview = document.getElementById('adminTextPreview');
        if (isHtml) {
            preview.innerHTML = content;
        } else {
            preview.textContent = content;
        }
    };

    // Close edit modal
    window.closeAdminEditModal = function() {
        const modal = document.getElementById('adminTextEditModal');
        modal.style.display = 'none';
        currentEditElement = null;
    };

    // Save text
    window.saveAdminText = async function() {
        let content = document.getElementById('adminTextInput').value.trim();
        const allowHtml = document.getElementById('adminAllowHtml').checked;

        if (!content) {
            alert('Текст не может быть пустым!');
            return;
        }

        // Clean content from any edit buttons that might have been included
        if (allowHtml) {
            // Remove any admin-edit-btn elements from the content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            tempDiv.querySelectorAll('.admin-edit-btn').forEach(btn => btn.remove());
            tempDiv.querySelectorAll('button').forEach(btn => {
                if (btn.textContent === '✏️') btn.remove();
            });
            content = tempDiv.innerHTML;
        }

        if (currentEditElement) {
            // Remove edit button temporarily
            const editBtn = currentEditElement.querySelector('.admin-edit-btn');
            if (editBtn) {
                editBtn.remove();
            }

            // Update content
            if (allowHtml) {
                currentEditElement.innerHTML = content;
            } else {
                currentEditElement.textContent = content;
            }

            // Re-add edit button after content update
            addAdminEditButton(currentEditElement);

            // Try to save to server
            try {
                await saveToServer(currentEditElement, content);
                showNotification('Текст успешно сохранен!', 'success');
                
                // Trigger reload of saved texts for all users
                if (window.loadHomepageTexts) {
                    await window.loadHomepageTexts();
                }
                
                // Notify other tabs/windows about the update
                if (window.notifyTextUpdate) {
                    window.notifyTextUpdate();
                }
            } catch (error) {
                console.error('Error saving to server:', error);
                showNotification('Текст обновлен локально', 'warning');
            }
        }

        closeAdminEditModal();
    };

    // Save to server
    async function saveToServer(element, content) {
        // Determine which API to use based on element class
        const className = element.className || '';
        
        // Check if it's a homepage text element
        if (className.includes('hero') || className.includes('campaign') || className.includes('about')) {
            // Try homepage-texts API
            const response = await fetch('/api/homepage-texts');
            const data = await response.json();
            
            // Update appropriate field
            if (className.includes('hero-title')) {
                if (!data.hero) data.hero = {};
                data.hero.title = content;
            } else if (className.includes('hero-subtitle')) {
                if (!data.hero) data.hero = {};
                data.hero.subtitle = content;
            } else if (className.includes('campaign')) {
                // Determine which campaign
                const parent = element.closest('.campaign-section');
                if (parent) {
                    const campaignNum = parent.classList.contains('campaign-split-reverse') ? '3' : 
                                       parent.classList.contains('campaign-split') ? '2' : '1';
                    const key = `campaign${campaignNum}`;
                    if (!data[key]) data[key] = {};
                    
                    if (className.includes('label')) data[key].label = content;
                    else if (className.includes('title')) data[key].title = content;
                    else if (className.includes('description')) data[key].description = content;
                }
            } else if (className.includes('about')) {
                if (!data.about) data.about = {};
                if (className.includes('title')) data.about.title = content;
                else if (className.includes('text')) data.about.text = content;
            }
            
            // Save back
            await fetch('/api/homepage-texts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // Use generic page-texts API
            await fetch('/api/page-texts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page: 'index',
                    elementId: generateElementId(element),
                    content: content,
                    timestamp: new Date().toISOString()
                })
            });
        }
    }

    // Generate element ID
    function generateElementId(element) {
        const tag = element.tagName.toLowerCase();
        const className = element.className.replace(/\s+/g, '-') || 'no-class';
        const text = element.textContent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
        return `${tag}-${className}-${text}`;
    }

    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#f44336'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            z-index: 100001;
            animation: slideInRight 0.3s ease;
            font-size: 14px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Add global styles
    function addAdminStyles() {
        if (document.getElementById('admin-enhanced-styles')) return;

        const style = document.createElement('style');
        style.id = 'admin-enhanced-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            /* Highlight editable elements on hover */
            .admin-edit-btn-wrapper:hover > * {
                outline: 2px dashed rgba(220, 38, 38, 0.5);
                outline-offset: 2px;
            }

            /* Ensure buttons are always on top */
            .admin-edit-btn {
                pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize
    function init() {
        if (!isAdmin()) {
            console.log('User is not admin, skipping enhanced editor initialization');
            return;
        }

        // Wait a bit for page to fully load
        setTimeout(() => {
            initEnhancedEditor();
            
            // Re-init on dynamic content changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.textContent.trim()) {
                            // Check if it's not our own button
                            if (!node.classList.contains('admin-edit-btn') && 
                                !node.closest('.admin-edit-btn-wrapper')) {
                                addAdminEditButton(node);
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }, 1000);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for debugging
    window.adminEnhancedEditor = {
        init: initEnhancedEditor,
        refresh: () => {
            document.querySelectorAll('.admin-edit-btn').forEach(btn => btn.remove());
            document.querySelectorAll('.admin-edit-btn-wrapper').forEach(wrapper => {
                const child = wrapper.firstElementChild;
                if (child && wrapper.parentNode) {
                    wrapper.parentNode.insertBefore(child, wrapper);
                    wrapper.remove();
                }
            });
            initEnhancedEditor();
        }
    };
})();
