// Homepage Text Admin - Inline text editing for admin users
class HomepageTextAdmin {
    constructor() {
        this.isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        this.editingElement = null;
        this.originalContent = null;
        this.texts = {};
        
        if (this.isAdmin) {
            this.init();
        }
    }

    async init() {
        // Load saved texts from server
        await this.loadTexts();
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupTextEditing());
        } else {
            this.setupTextEditing();
        }
        
        // Create edit modal
        this.createEditModal();
    }

    async loadTexts() {
        try {
            const response = await fetch('/api/homepage-texts');
            this.texts = await response.json();
            this.applyTexts();
        } catch (error) {
            console.error('Error loading texts:', error);
        }
    }

    applyTexts() {
        // Apply campaign 1 texts
        const campaign1Label = document.querySelector('.campaign-dark .campaign-label');
        const campaign1Title = document.querySelector('.campaign-dark .campaign-title');
        const campaign1Description = document.querySelector('.campaign-dark .campaign-description');
        if (campaign1Label && this.texts.campaign1) {
            campaign1Label.textContent = this.texts.campaign1.label;
        }
        if (campaign1Title && this.texts.campaign1) {
            campaign1Title.innerHTML = this.texts.campaign1.title;
        }
        if (campaign1Description && this.texts.campaign1 && this.texts.campaign1.description) {
            campaign1Description.textContent = this.texts.campaign1.description;
        }

        // Apply campaign 2 texts
        const campaign2Section = document.querySelector('.campaign-split:not(.campaign-split-reverse)');
        if (campaign2Section && this.texts.campaign2) {
            const label = campaign2Section.querySelector('.campaign-label');
            const title = campaign2Section.querySelector('.campaign-title');
            const description = campaign2Section.querySelector('.campaign-description');
            
            if (label) label.textContent = this.texts.campaign2.label;
            if (title) title.innerHTML = this.texts.campaign2.title;
            if (description) description.textContent = this.texts.campaign2.description;
        }

        // Apply campaign 3 texts
        const campaign3Section = document.querySelector('.campaign-split-reverse');
        if (campaign3Section && this.texts.campaign3) {
            const label = campaign3Section.querySelector('.campaign-label');
            const title = campaign3Section.querySelector('.campaign-title');
            const description = campaign3Section.querySelector('.campaign-description');
            
            if (label) label.textContent = this.texts.campaign3.label;
            if (title) title.innerHTML = this.texts.campaign3.title;
            if (description) description.textContent = this.texts.campaign3.description;
        }

        // Apply about section texts
        const aboutTitle = document.querySelector('.about-title');
        const aboutText = document.querySelector('.about-text');
        if (aboutTitle && this.texts.about) {
            aboutTitle.textContent = this.texts.about.title;
        }
        if (aboutText && this.texts.about) {
            aboutText.textContent = this.texts.about.text;
        }
    }

    setupTextEditing() {
        // Add edit buttons to campaign sections
        this.addEditButton('.campaign-dark .campaign-content', 'campaign1');
        this.addEditButton('.campaign-split:not(.campaign-split-reverse) .campaign-content', 'campaign2');
        this.addEditButton('.campaign-split-reverse .campaign-content', 'campaign3');
        this.addEditButton('.about-content', 'about');
    }

    addEditButton(selector, sectionId) {
        const element = document.querySelector(selector);
        if (!element) return;

        // Make sure container is positioned
        element.style.position = 'relative';

        const editBtn = document.createElement('button');
        editBtn.className = 'admin-text-edit-btn';
        editBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span style="margin-left: 5px; font-size: 12px;">Edit Text</span>
        `;
        
        editBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            font-family: inherit;
            font-weight: 500;
        `;

        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.background = 'rgba(255, 255, 255, 1)';
            editBtn.style.transform = 'scale(1.05)';
            editBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });

        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.background = 'rgba(255, 255, 255, 0.95)';
            editBtn.style.transform = 'scale(1)';
            editBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });

        editBtn.addEventListener('click', () => {
            this.openEditModal(sectionId);
        });

        element.appendChild(editBtn);
    }

    createEditModal() {
        const modal = document.createElement('div');
        modal.id = 'textEditModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            ">
                <div class="modal-header" style="
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h2 style="margin: 0; font-size: 1.5rem;">Edit Section Text</h2>
                    <button onclick="window.textAdmin.closeEditModal()" style="
                        background: none;
                        border: none;
                        font-size: 2rem;
                        cursor: pointer;
                        color: #666;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                    ">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div id="textEditFields"></div>
                </div>
                <div class="modal-footer" style="
                    padding: 20px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                ">
                    <button onclick="window.textAdmin.closeEditModal()" style="
                        padding: 10px 20px;
                        background: #f5f5f5;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                    <button onclick="window.textAdmin.saveTexts()" style="
                        padding: 10px 20px;
                        background: #000;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Make this instance globally accessible for onclick handlers
        window.textAdmin = this;
    }

    openEditModal(sectionId) {
        const modal = document.getElementById('textEditModal');
        const fieldsContainer = document.getElementById('textEditFields');
        
        this.currentSection = sectionId;
        
        // Clear previous fields
        fieldsContainer.innerHTML = '';
        
        // Create input fields based on section
        if (sectionId === 'campaign1' || sectionId === 'campaign2' || sectionId === 'campaign3') {
            const section = this.texts[sectionId] || {};
            
            fieldsContainer.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Label:</label>
                    <input type="text" id="edit-label" value="${section.label || ''}" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Title (use &lt;br&gt; for line breaks):</label>
                    <input type="text" id="edit-title" value="${section.title || ''}" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Description:</label>
                    <textarea id="edit-description" rows="3" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                        resize: vertical;
                    ">${section.description || ''}</textarea>
                </div>
            `;
        } else if (sectionId === 'about') {
            const section = this.texts.about || {};
            
            fieldsContainer.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Title:</label>
                    <input type="text" id="edit-title" value="${section.title || ''}" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Text:</label>
                    <textarea id="edit-text" rows="8" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                        resize: vertical;
                    ">${section.text || ''}</textarea>
                </div>
            `;
        }
        
        modal.style.display = 'flex';
    }

    closeEditModal() {
        const modal = document.getElementById('textEditModal');
        modal.style.display = 'none';
    }

    async saveTexts() {
        const sectionId = this.currentSection;
        
        if (sectionId === 'campaign1' || sectionId === 'campaign2' || sectionId === 'campaign3') {
            this.texts[sectionId] = {
                label: document.getElementById('edit-label').value,
                title: document.getElementById('edit-title').value,
                description: document.getElementById('edit-description')?.value || ''
            };
        } else if (sectionId === 'about') {
            this.texts.about = {
                title: document.getElementById('edit-title').value,
                text: document.getElementById('edit-text').value
            };
        }
        
        // Save to server
        try {
            const response = await fetch('/api/homepage-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.texts)
            });
            
            if (response.ok) {
                // Apply changes to page
                this.applyTexts();
                
                // Show success message
                this.showNotification('Text updated successfully!', 'success');
                
                // Close modal
                this.closeEditModal();
            } else {
                throw new Error('Failed to save texts');
            }
        } catch (error) {
            console.error('Error saving texts:', error);
            this.showNotification('Error saving text. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new HomepageTextAdmin();
});
