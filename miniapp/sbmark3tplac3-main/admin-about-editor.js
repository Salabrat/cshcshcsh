// Admin about editor
(function() {
    console.log('Admin about editor initializing...');
    
    // Check if user is admin
    async function isAdmin() {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) return false;
        
        try {
            const response = await fetch('/api/check-admin', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }
    
    // Create edit button for about section
    function createEditButton() {
        const aboutHeader = document.querySelector('.about-header');
        if (!aboutHeader) return;
        
        // Check if button already exists
        if (aboutHeader.querySelector('.about-edit-btn')) return;
        
        const editBtn = document.createElement('button');
        editBtn.className = 'about-edit-btn';
        editBtn.innerHTML = '✏️ Edit About';
        editBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            z-index: 1000;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        `;
        
        // Make about-header position relative
        aboutHeader.style.position = 'relative';
        
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.transform = 'translateY(-2px)';
            editBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
        });
        
        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.transform = 'translateY(0)';
            editBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });
        
        editBtn.addEventListener('click', openEditModal);
        aboutHeader.appendChild(editBtn);
    }
    
    // Open edit modal
    function openEditModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('aboutEditModal');
        if (existingModal) existingModal.remove();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'aboutEditModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        `;
        
        // Get current content
        const aboutTitle = document.querySelector('.about-title');
        const aboutText = document.querySelector('.about-text');
        
        modalContent.innerHTML = `
            <h2 style="margin-top: 0; color: #333; font-size: 24px; margin-bottom: 20px;">Edit About Section</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 600;">Title:</label>
                <input type="text" id="aboutTitleInput" value="${aboutTitle ? aboutTitle.textContent : ''}" 
                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 600;">Text:</label>
                <textarea id="aboutTextInput" rows="10" 
                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; line-height: 1.5; resize: vertical;">${aboutText ? aboutText.textContent : ''}</textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelAboutEdit" style="
                    padding: 10px 20px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                ">Cancel</button>
                <button id="saveAboutEdit" style="
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                ">Save Changes</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Event listeners
        document.getElementById('cancelAboutEdit').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('saveAboutEdit').addEventListener('click', saveAboutContent);
        
        // Close on escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    // Save about content
    async function saveAboutContent() {
        const title = document.getElementById('aboutTitleInput').value;
        const text = document.getElementById('aboutTextInput').value;
        
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            alert('Admin authorization required');
            return;
        }
        
        try {
            const response = await fetch('/api/about-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ title, text })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('About content saved:', result);
                
                // Update the page immediately
                const aboutTitle = document.querySelector('.about-title');
                if (aboutTitle) aboutTitle.textContent = title;
                
                const aboutText = document.querySelector('.about-text');
                if (aboutText) aboutText.textContent = text;
                
                // Close modal
                const modal = document.getElementById('aboutEditModal');
                if (modal) modal.remove();
                
                // Show success message
                showNotification('About content saved successfully!', 'success');
            } else {
                const errorData = await response.json().catch(() => null);
                console.error('Server error:', response.status, errorData);
                throw new Error(errorData?.error || `Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error saving about content:', error);
            showNotification(error.message || 'Failed to save content', 'error');
        }
    }
    
    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#dc3545'};
            color: white;
            border-radius: 5px;
            z-index: 10001;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `;
        notification.textContent = message;
        
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
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Remove edit button for non-admins
    function removeEditButton() {
        const editBtn = document.querySelector('.about-edit-btn');
        if (editBtn) editBtn.remove();
    }
    
    // Initialize
    async function init() {
        const adminStatus = await isAdmin();
        if (adminStatus) {
            createEditButton();
            console.log('About edit button added for admin');
        } else {
            removeEditButton();
        }
    }
    
    // Check admin status periodically
    setInterval(async () => {
        const adminStatus = await isAdmin();
        if (!adminStatus) {
            removeEditButton();
        }
    }, 5000);
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
