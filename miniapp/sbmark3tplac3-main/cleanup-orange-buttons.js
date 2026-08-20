// Cleanup script to remove all orange text edit buttons
(function() {
    'use strict';
    
    console.log('Cleaning up orange text edit buttons...');
    
    function removeOrangeButtons() {
        // Remove all orange text edit buttons with various classes
        const selectors = [
            '.text-edit-btn',
            '.admin-text-btn',
            '.btn-edit-icon',
            '.simple-btn-edit',
            '.manual-edit-btn',
            'button[title="Редактировать текст"]',
            'button[title="Редактировать текст кнопки"]',
            'button[title="Edit text"]',
            'button[title="Edit button text"]'
        ];
        
        selectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
                // Check if it's an orange button (text editor)
                const btnStyle = btn.style.background || '';
                const btnContent = btn.innerHTML || '';
                
                // Remove if it's orange or has pencil emoji for text
                // Skip hero edit button
                if (btn.classList.contains('hero-edit-button') || btn.classList.contains('hero-section-editor')) {
                    return; // Skip our hero edit button
                }
                
                // Skip campaign block edit buttons (purple gradient buttons)
                if (btn.classList.contains('block-edit-btn')) {
                    return; // Skip block edit buttons
                }
                
                if (btnStyle.includes('ff6b00') || 
                    btnStyle.includes('ff4500') ||
                    btnStyle.includes('orange') ||
                    (btnContent.includes('✏️'))) {
                    
                    console.log('Removing orange button:', btn.className);
                    
                    // If button is in a wrapper, unwrap the original element
                    const wrapper = btn.parentElement;
                    if (wrapper && (wrapper.classList.contains('text-edit-wrapper') || 
                                   wrapper.classList.contains('edit-wrapper') ||
                                   wrapper.classList.contains('manual-edit-wrapper'))) {
                        
                        // Find the original element (button with data-text-id)
                        const originalElement = wrapper.querySelector('[data-text-id]');
                        if (originalElement && wrapper.parentElement) {
                            // Move original element back
                            wrapper.parentElement.insertBefore(originalElement, wrapper);
                            // Remove wrapper
                            wrapper.remove();
                        } else {
                            // Just remove the edit button
                            btn.remove();
                        }
                    } else {
                        // Just remove the button
                        btn.remove();
                    }
                }
            });
        });
        
        // Also clean up any orphaned wrappers
        const wrappers = document.querySelectorAll('.text-edit-wrapper, .manual-edit-wrapper');
        wrappers.forEach(wrapper => {
            const editBtn = wrapper.querySelector('.text-edit-btn, .simple-btn-edit, .manual-edit-btn');
            if (!editBtn) {
                // No edit button, check if we need to unwrap
                const child = wrapper.firstElementChild;
                if (child && wrapper.parentElement) {
                    wrapper.parentElement.insertBefore(child, wrapper);
                    wrapper.remove();
                }
            }
        });
        
        console.log('Orange buttons cleanup completed');
    }
    
    // Run cleanup immediately
    removeOrangeButtons();
    
    // Run cleanup periodically to catch any dynamically added buttons
    setInterval(removeOrangeButtons, 3000);
    
    // Also run on DOM changes
    const observer = new MutationObserver(() => {
        removeOrangeButtons();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Export for manual use
    window.cleanupOrangeButtons = removeOrangeButtons;
    
    console.log('Orange button cleanup script active');
})();
