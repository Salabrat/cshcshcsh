// Force text editor initialization for admin - DISABLED
(function() {
    'use strict';
    
    console.log('Force text editor script - DISABLED (using block editor instead)');
    return; // Exit immediately - we're using block editor now
    
    // Wait for admin status and initialize editors
    function forceInitializeTextEditors() {
        // Check if admin
        const isAdmin = window.isAdminUser === true || localStorage.getItem('adminToken');
        
        if (!isAdmin) {
            console.log('Not admin, skipping forced text editor initialization');
            return;
        }
        
        console.log('Forcing text editor initialization for admin...');
        
        // Initialize homepage text editor if available
        if (window.homepageTextEditor && typeof window.homepageTextEditor.init === 'function') {
            console.log('Initializing homepage text editor...');
            window.homepageTextEditor.init();
        }
        
        // Add edit buttons to all elements with data-original-content
        const elementsWithContent = document.querySelectorAll('[data-original-content]');
        console.log(`Found ${elementsWithContent.length} elements with data-original-content`);
        
        elementsWithContent.forEach((element, index) => {
            // Skip if already has edit button
            if (element.parentElement && element.parentElement.querySelector('.text-edit-btn')) {
                return;
            }
            
            // Create wrapper
            let wrapper = element.parentElement;
            if (!wrapper || !wrapper.classList.contains('text-edit-wrapper')) {
                wrapper = document.createElement('div');
                wrapper.className = 'text-edit-wrapper';
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                
                if (element.parentNode) {
                    element.parentNode.insertBefore(wrapper, element);
                    wrapper.appendChild(element);
                }
            }
            
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'text-edit-btn admin-text-btn';
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Редактировать текст';
            
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
                visibility: visible !important;
                transition: all 0.2s ease;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                pointer-events: auto !important;
            `;
            
            // Add click handler
            editBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Get current text
                const currentText = element.innerHTML;
                const originalText = element.getAttribute('data-original-content') || currentText;
                
                // Create simple edit dialog
                const newText = prompt('Редактировать текст:', currentText.replace(/<br>/g, '\n'));
                
                if (newText !== null && newText !== currentText) {
                    // Update text
                    element.innerHTML = newText.replace(/\n/g, '<br>');
                    
                    // Save to server if possible
                    saveTextToServer(element, newText);
                }
            };
            
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
            console.log(`Added edit button to element ${index + 1}`);
        });
    }
    
    // Save text to server
    async function saveTextToServer(element, newText) {
        try {
            // Get element identifier
            const className = Array.from(element.classList).find(cls => 
                cls.includes('title') || cls.includes('subtitle') || 
                cls.includes('description') || cls.includes('label') || 
                cls.includes('text')
            );
            
            if (!className) {
                console.log('No identifiable class for saving');
                return;
            }
            
            const token = localStorage.getItem('adminToken');
            if (!token) {
                console.log('No admin token for saving');
                return;
            }
            
            // Try to save via homepage texts API
            const response = await fetch('/api/homepage-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    [className]: newText
                })
            });
            
            if (response.ok) {
                console.log('Text saved successfully');
                // Show success notification
                showNotification('Текст сохранен!');
            }
        } catch (error) {
            console.error('Error saving text:', error);
        }
    }
    
    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-family: Inter, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Wait for DOM and admin status
    function waitAndInitialize() {
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            // Check if we can initialize
            if (window.isAdminUser === true || localStorage.getItem('adminToken')) {
                clearInterval(checkInterval);
                forceInitializeTextEditors();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log('Max attempts reached, checking one more time...');
                if (localStorage.getItem('adminToken')) {
                    forceInitializeTextEditors();
                }
            }
        }, 500);
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitAndInitialize);
    } else {
        waitAndInitialize();
    }
    
    // Export for manual use
    window.forceTextEditor = {
        init: forceInitializeTextEditors
    };
})();
