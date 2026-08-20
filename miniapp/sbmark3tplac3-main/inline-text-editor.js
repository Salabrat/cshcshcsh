// Inline Text Editor for Admin
(function() {
    let isAdminMode = false;
    let editingElement = null;
    let originalContent = null;
    let hasUnsavedChanges = false;

    // Check if user is logged in as admin
    function checkAdminStatus() {
        // Проверяем статус администратора в localStorage
        const currentUser = localStorage.getItem('currentUser');
        const adminLoggedIn = localStorage.getItem('adminLoggedIn');
        const username = localStorage.getItem('username');
        
        // Разрешаем доступ если:
        // 1. Имеется флаг adminLoggedIn=true ИЛИ
        // 2. username='admin' ИЛИ
        // 3. В объекте currentUser роль пользователя 'admin'
        
        if (adminLoggedIn === 'true') {
            return true;
        }
        
        if (username === 'admin') {
            return true;
        }
        
        if (currentUser) {
            try {
                const user = JSON.parse(currentUser);
                return user.role === 'admin';
            } catch (e) {
                return false;
            }
        }
        
        return false;
    }

    // Create edit button
    function createEditButton() {
        const button = document.createElement('button');
        button.className = 'inline-edit-btn';
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        button.title = 'Edit text';
        return button;
    }

    // Create save/cancel buttons
    function createEditControls() {
        const controls = document.createElement('div');
        controls.className = 'inline-edit-controls';
        controls.innerHTML = `
            <button class="inline-edit-save" title="Save changes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </button>
            <button class="inline-edit-cancel" title="Cancel">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        return controls;
    }

    // Get text content ID based on element
    function getTextContentId(element) {
        // Generate ID based on element's position and content
        const parent = element.closest('section') || element.closest('div');
        const className = element.className;
        const tagName = element.tagName.toLowerCase();
        
        if (parent) {
            const sectionClass = parent.className.split(' ')[0];
            return `${sectionClass}_${className}_${tagName}`.replace(/\s+/g, '_');
        }
        
        return `${className}_${tagName}`.replace(/\s+/g, '_');
    }

    // Save text content to server
    async function saveTextContent(elementId, content) {
        try {
            const response = await fetch('/api/page-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: elementId,
                    content: content,
                    page: 'index',
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save text');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving text:', error);
            throw error;
        }
    }

    // Load text content from server
    async function loadTextContent() {
        try {
            const response = await fetch('/api/page-texts?page=index');
            if (response.ok) {
                const texts = await response.json();
                return texts;
            }
        } catch (error) {
            console.error('Error loading texts:', error);
        }
        return {};
    }

    // Make element editable
    function makeEditable(element) {
        if (editingElement) {
            cancelEdit(editingElement);
        }

        editingElement = element;
        originalContent = element.innerHTML;
        
        element.contentEditable = true;
        element.classList.add('inline-editing');
        element.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Add controls
        const controls = createEditControls();
        element.parentNode.insertBefore(controls, element.nextSibling);

        // Hide edit button
        const editBtn = element.parentNode.querySelector('.inline-edit-btn');
        if (editBtn) editBtn.style.display = 'none';

        // Add event listeners
        controls.querySelector('.inline-edit-save').addEventListener('click', () => saveEdit(element));
        controls.querySelector('.inline-edit-cancel').addEventListener('click', () => cancelEdit(element));

        // Save on Enter for single-line elements
        if (element.tagName !== 'P' && element.tagName !== 'DIV') {
            element.addEventListener('keydown', handleKeyDown);
        }

        hasUnsavedChanges = true;
    }

    // Handle keyboard shortcuts
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit(e.target);
        } else if (e.key === 'Escape') {
            cancelEdit(e.target);
        }
    }

    // Save edited content
    async function saveEdit(element) {
        const newContent = element.innerHTML.trim();
        const elementId = getTextContentId(element);

        try {
            await saveTextContent(elementId, newContent);
            
            element.contentEditable = false;
            element.classList.remove('inline-editing');
            
            // Remove controls
            const controls = element.parentNode.querySelector('.inline-edit-controls');
            if (controls) controls.remove();

            // Show edit button
            const editBtn = element.parentNode.querySelector('.inline-edit-btn');
            if (editBtn) editBtn.style.display = '';

            element.removeEventListener('keydown', handleKeyDown);
            editingElement = null;
            hasUnsavedChanges = false;

            // Show success message
            showNotification('Text saved successfully', 'success');
        } catch (error) {
            showNotification('Failed to save text', 'error');
            element.innerHTML = originalContent;
            cancelEdit(element);
        }
    }

    // Cancel editing
    function cancelEdit(element) {
        element.innerHTML = originalContent;
        element.contentEditable = false;
        element.classList.remove('inline-editing');

        // Remove controls
        const controls = element.parentNode.querySelector('.inline-edit-controls');
        if (controls) controls.remove();

        // Show edit button
        const editBtn = element.parentNode.querySelector('.inline-edit-btn');
        if (editBtn) editBtn.style.display = '';

        element.removeEventListener('keydown', handleKeyDown);
        editingElement = null;
        hasUnsavedChanges = false;
    }

    // Show notification
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `inline-edit-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Add edit buttons to editable elements
    function addEditButtons() {
        const editableSelectors = [
            // Существующие селекторы
            '.hero-title',
            '.hero-subtitle',
            '.campaign-label',
            '.campaign-title',
            '.campaign-description',
            '.section-label',
            '.about-title',
            '.about-text',
            '.footer-section h4',
            '.footer-section p',
            '.newsletter-title',
            '.newsletter-subtitle'
        ];

        editableSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if already has edit button
                if (element.parentNode.querySelector('.inline-edit-btn')) return;

                // Create wrapper if needed
                if (!element.parentNode.classList.contains('editable-wrapper')) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'editable-wrapper';
                    element.parentNode.insertBefore(wrapper, element);
                    wrapper.appendChild(element);
                }

                // Add edit button
                const editBtn = createEditButton();
                element.parentNode.appendChild(editBtn);

                // Add click handler
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    makeEditable(element);
                });
            });
        });
    }

    // Remove edit buttons
    function removeEditButtons() {
        document.querySelectorAll('.inline-edit-btn').forEach(btn => btn.remove());
        document.querySelectorAll('.inline-edit-controls').forEach(ctrl => ctrl.remove());
        document.querySelectorAll('.editable-wrapper').forEach(wrapper => {
            const parent = wrapper.parentNode;
            while (wrapper.firstChild) {
                parent.insertBefore(wrapper.firstChild, wrapper);
            }
            wrapper.remove();
        });
    }

    // Toggle admin mode
    function toggleAdminMode(enable) {
        isAdminMode = enable;
        if (isAdminMode) {
            document.body.classList.add('admin-edit-mode');
            addEditButtons();
            showNotification('Edit mode enabled', 'success');
        } else {
            document.body.classList.remove('admin-edit-mode');
            removeEditButtons();
            if (editingElement) {
                cancelEdit(editingElement);
            }
        }
    }

    // Add admin mode toggle button
    function addAdminToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'admin-mode-toggle';
        toggle.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Edit Mode</span>
        `;
        toggle.title = 'Toggle edit mode';
        document.body.appendChild(toggle);

        toggle.addEventListener('click', () => {
            toggleAdminMode(!isAdminMode);
            toggle.classList.toggle('active', isAdminMode);
        });
    }

    // Load saved texts on page load
    async function loadSavedTexts() {
        const texts = await loadTextContent();
        Object.keys(texts).forEach(id => {
            // Find element by generated ID and update content
            // This would need more sophisticated matching logic in production
        });
    }

    // Initialize
    function init() {
        if (checkAdminStatus()) {
            // Removed addAdminToggle() - we don't need this button
            loadSavedTexts();

            // Warn before leaving with unsaved changes
            window.addEventListener('beforeunload', (e) => {
                if (hasUnsavedChanges) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
