// Admin block editor - edit entire content blocks in modal
(function() {
    'use strict';
    
    console.log('Admin block editor initializing...');
    
    // Check if admin (with server verification)
    async function isAdmin() {
        const token = localStorage.getItem('adminToken');
        if (!token) return false;
        
        try {
            const response = await fetch('/api/check-admin', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.isAdmin === true;
            }
        } catch (error) {
            console.error('Admin check error:', error);
        }
        
        return false;
    }
    
    // Initialize block editor
    async function initBlockEditor() {
        const adminStatus = await isAdmin();
        if (!adminStatus) {
            console.log('Not admin, skipping block editor');
            // Remove any existing block edit buttons if user is not admin
            document.querySelectorAll('.block-edit-btn').forEach(btn => btn.remove());
            return;
        }
        
        console.log('Setting up block editors...');
        
        // Initial setup
        setupCampaignBlockEditors();
        
        // Re-run periodically for dynamic content
        setInterval(async () => {
            const adminStatus = await isAdmin();
            if (adminStatus) {
                setupCampaignBlockEditors();
            } else {
                // Remove buttons if no longer admin
                document.querySelectorAll('.block-edit-btn').forEach(btn => btn.remove());
            }
        }, 5000);
    }
    
    // Setup campaign block editors
    function setupCampaignBlockEditors() {
        // Skip hero section - handled by hero-admin-editor.js
        // const heroSection = document.querySelector('.hero');
        // if (heroSection && !heroSection.querySelector('.block-edit-btn')) {
        //     addHeroEditButton(heroSection);
        // }
        
        // Find campaign content blocks
        const blocks = [
            ...document.querySelectorAll('.campaign-content'),
            ...document.querySelectorAll('.campaign-split-content')
        ];
        
        console.log(`Found ${blocks.length} campaign blocks`);
        
        blocks.forEach((block, index) => {
            // Skip if already has edit button
            if (block.querySelector('.block-edit-btn')) {
                return;
            }
            
            // Add edit button to block
            addBlockEditButton(block, index);
        });
    }
    
    // Add edit button to hero section
    function addHeroEditButton(heroSection) {
        console.log('Adding edit button to hero section');
        
        // Find hero content container
        const heroContent = heroSection.querySelector('.hero-content');
        if (!heroContent) return;
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'block-edit-btn hero-edit-btn';
        editBtn.innerHTML = '📝 Изменить Hero';
        editBtn.title = 'Редактировать Hero секцию';
        editBtn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #ff6b00 0%, #ff8533 100%);
            color: white;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            z-index: 1000;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 6px 25px rgba(255, 107, 0, 0.5);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        // Add hover effect
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.transform = 'translateY(-3px) scale(1.05)';
            editBtn.style.boxShadow = '0 8px 30px rgba(255, 107, 0, 0.7)';
        });
        
        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.transform = 'translateY(0) scale(1)';
            editBtn.style.boxShadow = '0 6px 25px rgba(255, 107, 0, 0.5)';
        });
        
        // Add click handler
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openHeroEditModal(heroSection);
        });
        
        document.body.appendChild(editBtn);
    }
    
    // Add edit button to a block
    function addBlockEditButton(block, index) {
        console.log(`Adding edit button to block ${index}`);
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'block-edit-btn';
        editBtn.innerHTML = '📝 Изменить блок';
        editBtn.title = 'Редактировать весь блок';
        editBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            z-index: 1000;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        
        // Ensure block has relative positioning
        if (getComputedStyle(block).position === 'static') {
            block.style.position = 'relative';
        }
        
        // Add hover effect
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.transform = 'translateY(-2px)';
            editBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });
        
        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.transform = 'translateY(0)';
            editBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });
        
        // Add click handler
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openBlockEditModal(block);
        });
        
        block.appendChild(editBtn);
    }
    
    // Open hero edit modal
    function openHeroEditModal(heroSection) {
        // Get current values
        const titleElement = heroSection.querySelector('.hero-title');
        const subtitleElement = heroSection.querySelector('.hero-subtitle');
        const buttonElement = heroSection.querySelector('.btn');
        
        const currentTitle = titleElement ? titleElement.innerHTML : '';
        const currentSubtitle = subtitleElement ? subtitleElement.textContent : '';
        const currentButtonText = buttonElement ? buttonElement.textContent : '';
        const buttonId = buttonElement ? buttonElement.getAttribute('data-text-id') : '';
        
        // Get current background image
        const heroStyle = window.getComputedStyle(heroSection);
        const currentBgImage = heroStyle.backgroundImage;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'hero-edit-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'hero-edit-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 35px;
            width: 90%;
            max-width: 650px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.3s ease;
        `;
        
        modal.innerHTML = `
            <h2 style="
                margin: 0 0 30px 0;
                color: #222;
                font-size: 28px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 3px solid #ff6b00;
                padding-bottom: 15px;
            ">
                <span style="font-size: 32px;">🚀</span>
                Редактировать Hero секцию
            </h2>
            
            <div style="display: flex; flex-direction: column; gap: 25px;">
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 10px;
                        color: #555;
                        font-size: 15px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">Главный заголовок (Title)</label>
                    <textarea id="edit-hero-title" style="
                        width: 100%;
                        padding: 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 16px;
                        min-height: 120px;
                        resize: vertical;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                        font-family: inherit;
                        line-height: 1.5;
                    " onfocus="this.style.borderColor='#ff6b00'; this.style.boxShadow='0 0 0 3px rgba(255,107,0,0.1)'" 
                       onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">${currentTitle.replace(/<br>/g, '\n')}</textarea>
                    <small style="color: #999; font-size: 13px;">Используйте Enter для переноса строки</small>
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 10px;
                        color: #555;
                        font-size: 15px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">Подзаголовок (Subtitle)</label>
                    <input type="text" id="edit-hero-subtitle" value="${currentSubtitle}" style="
                        width: 100%;
                        padding: 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 16px;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                    " onfocus="this.style.borderColor='#ff6b00'; this.style.boxShadow='0 0 0 3px rgba(255,107,0,0.1)'" 
                       onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 10px;
                        color: #555;
                        font-size: 15px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">Текст кнопки (Button Text)</label>
                    <input type="text" id="edit-hero-button" value="${currentButtonText}" style="
                        width: 100%;
                        padding: 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 16px;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                    " onfocus="this.style.borderColor='#ff6b00'; this.style.boxShadow='0 0 0 3px rgba(255,107,0,0.1)'" 
                       onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 10px;
                        color: #555;
                        font-size: 15px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">Фоновое изображение (Background Image)</label>
                    <div style="
                        display: flex;
                        gap: 15px;
                        align-items: center;
                    ">
                        <input type="file" id="edit-hero-image" accept="image/*" style="display: none;">
                        <button type="button" onclick="document.getElementById('edit-hero-image').click()" style="
                            padding: 12px 24px;
                            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 15px;
                            font-weight: 600;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            🖼️ Выбрать изображение
                        </button>
                        <span id="hero-image-name" style="color: #666; font-size: 14px;">Файл не выбран</span>
                    </div>
                    <div id="hero-image-preview" style="
                        margin-top: 15px;
                        max-width: 100%;
                        border-radius: 8px;
                        overflow: hidden;
                        display: none;
                    ">
                        <img id="hero-preview-img" style="
                            width: 100%;
                            height: 150px;
                            object-fit: cover;
                        ">
                    </div>
                </div>
            </div>
            
            <div style="
                display: flex;
                gap: 15px;
                margin-top: 35px;
                justify-content: flex-end;
            ">
                <button id="cancel-hero-btn" style="
                    padding: 14px 28px;
                    background: #f5f5f5;
                    color: #666;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#e0e0e0'; this.style.transform='translateY(-2px)'" 
                   onmouseout="this.style.background='#f5f5f5'; this.style.transform='translateY(0)'">
                    Отмена
                </button>
                <button id="save-hero-btn" style="
                    padding: 14px 28px;
                    background: linear-gradient(135deg, #ff6b00 0%, #ff8533 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    box-shadow: 0 4px 20px rgba(255, 107, 0, 0.3);
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(255, 107, 0, 0.5)'" 
                   onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 20px rgba(255, 107, 0, 0.3)'">
                    💾 Сохранить изменения
                </button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('edit-hero-title').focus();
        }, 100);
        
        // Handle image selection
        const imageInput = document.getElementById('edit-hero-image');
        let selectedImageFile = null;
        
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedImageFile = file;
                document.getElementById('hero-image-name').textContent = file.name;
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('hero-preview-img').src = e.target.result;
                    document.getElementById('hero-image-preview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Handle save
        document.getElementById('save-hero-btn').addEventListener('click', async () => {
            const newTitle = document.getElementById('edit-hero-title').value;
            const newSubtitle = document.getElementById('edit-hero-subtitle').value;
            const newButtonText = document.getElementById('edit-hero-button').value;
            
            // Update elements
            if (titleElement) {
                titleElement.innerHTML = newTitle.replace(/\n/g, '<br>');
                await saveHeroText('hero-title', newTitle);
            }
            
            if (subtitleElement) {
                subtitleElement.textContent = newSubtitle;
                await saveHeroText('hero-subtitle', newSubtitle);
            }
            
            if (buttonElement && newButtonText !== currentButtonText) {
                buttonElement.textContent = newButtonText;
                if (buttonId) {
                    await saveButtonText(buttonId, newButtonText);
                }
            }
            
            // Upload and save hero image if selected
            if (selectedImageFile) {
                const imageUrl = await uploadHeroImage(selectedImageFile);
                if (imageUrl) {
                    heroSection.style.backgroundImage = `url(${imageUrl})`;
                    await saveHeroText('hero-background', imageUrl);
                }
            }
            
            showNotification('✅ Hero секция успешно обновлена!');
            overlay.remove();
        });
        
        // Handle cancel
        document.getElementById('cancel-hero-btn').addEventListener('click', () => {
            overlay.remove();
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // Close on Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }
    
    // Open block edit modal
    function openBlockEditModal(block) {
        // Get current values
        const labelElement = block.querySelector('.campaign-label');
        const titleElement = block.querySelector('.campaign-title');
        const descriptionElement = block.querySelector('.campaign-description');
        const buttonElement = block.querySelector('.btn');
        
        const currentLabel = labelElement ? labelElement.textContent : '';
        const currentTitle = titleElement ? titleElement.innerHTML : '';
        const currentDescription = descriptionElement ? descriptionElement.textContent : '';
        const currentButtonText = buttonElement ? buttonElement.textContent : '';
        const buttonId = buttonElement ? buttonElement.getAttribute('data-text-id') : '';
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'block-edit-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'block-edit-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
        `;
        
        modal.innerHTML = `
            <h2 style="
                margin: 0 0 25px 0;
                color: #333;
                font-size: 24px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <span style="font-size: 28px;">📝</span>
                Редактировать блок
            </h2>
            
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 8px;
                        color: #666;
                        font-size: 14px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Метка (Label)</label>
                    <input type="text" id="edit-label" value="${currentLabel}" style="
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                    " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 8px;
                        color: #666;
                        font-size: 14px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Заголовок (Title)</label>
                    <textarea id="edit-title" style="
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                        min-height: 80px;
                        resize: vertical;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                        font-family: inherit;
                    " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">${currentTitle.replace(/<br>/g, '\n')}</textarea>
                    <small style="color: #999; font-size: 12px;">Используйте Enter для переноса строки</small>
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 8px;
                        color: #666;
                        font-size: 14px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Описание (Description)</label>
                    <textarea id="edit-description" style="
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                        min-height: 80px;
                        resize: vertical;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                        font-family: inherit;
                    " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">${currentDescription}</textarea>
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 8px;
                        color: #666;
                        font-size: 14px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Текст кнопки (Button Text)</label>
                    <input type="text" id="edit-button" value="${currentButtonText}" style="
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                    " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                </div>
                
                <div>
                    <label style="
                        display: block;
                        margin-bottom: 8px;
                        color: #666;
                        font-size: 14px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Назначение кнопки (Button Link)</label>
                    <select id="edit-button-link" style="
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                        transition: all 0.3s ease;
                        box-sizing: border-box;
                        background: white;
                        cursor: pointer;
                    " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                        <option value="shop-all.html">Все товары (Shop All)</option>
                    </select>
                    <small style="color: #999; font-size: 12px; margin-top: 5px; display: block;">Выберите страницу, на которую будет вести кнопка</small>
                </div>
            </div>
            
            <div style="
                display: flex;
                gap: 12px;
                margin-top: 30px;
                justify-content: flex-end;
            ">
                <button id="cancel-btn" style="
                    padding: 12px 24px;
                    background: #f5f5f5;
                    color: #666;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f5f5f5'">
                    Отмена
                </button>
                <button id="save-btn" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'">
                    💾 Сохранить изменения
                </button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Load current campaign data including buttonLink
        const allBlocks = [...document.querySelectorAll('.campaign-content, .campaign-split-content')];
        const blockIndex = allBlocks.indexOf(block);
        const campaignId = `campaign${blockIndex + 1}`;
        
        // Load dynamic categories into select, then set saved value
        loadCategoriesForCampaignSelect('edit-button-link').then(() => {
            // Fetch current campaign content from server
            fetch('/api/campaign-content')
                .then(response => response.json())
                .then(data => {
                    if (data[campaignId] && data[campaignId].buttonLink) {
                        const select = document.getElementById('edit-button-link');
                        if (select) {
                            select.value = data[campaignId].buttonLink;
                            // Try without leading /
                            if (select.value !== data[campaignId].buttonLink) {
                                select.value = data[campaignId].buttonLink.replace(/^\//, '');
                            }
                        }
                    }
                })
                .catch(error => console.error('Error loading campaign data:', error));
        });
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('edit-label').focus();
        }, 100);
        
        // Handle save
        document.getElementById('save-btn').addEventListener('click', async () => {
            const newLabel = document.getElementById('edit-label').value;
            const newTitle = document.getElementById('edit-title').value;
            const newDescription = document.getElementById('edit-description').value;
            const newButtonText = document.getElementById('edit-button').value;
            const newButtonLink = document.getElementById('edit-button-link').value;
            
            // Determine campaign ID based on block index
            const allBlocks = [...document.querySelectorAll('.campaign-content, .campaign-split-content')];
            const blockIndex = allBlocks.indexOf(block);
            const campaignId = `campaign${blockIndex + 1}`;
            
            // Save all campaign data to server
            const saved = await saveCampaignContent(campaignId, {
                label: newLabel,
                title: newTitle.replace(/\n/g, '<br>'),
                description: newDescription,
                buttonText: newButtonText,
                buttonLink: newButtonLink
            });
            
            if (saved) {
                // Update elements in DOM
                if (labelElement) {
                    labelElement.textContent = newLabel;
                }
                
                if (titleElement) {
                    titleElement.innerHTML = newTitle.replace(/\n/g, '<br>');
                }
                
                if (descriptionElement) {
                    descriptionElement.textContent = newDescription;
                }
                
                if (buttonElement) {
                    buttonElement.textContent = newButtonText;
                    
                    // Update button link
                    if (newButtonLink) {
                        const parentLink = buttonElement.closest('a');
                        if (parentLink) {
                            parentLink.href = newButtonLink;
                        } else {
                            buttonElement.style.cursor = 'pointer';
                            buttonElement.onclick = function() {
                                window.location.href = newButtonLink;
                            };
                        }
                    }
                    
                    // Also save to button-texts if it has a data-text-id
                    if (buttonId && newButtonText !== currentButtonText) {
                        await saveButtonText(buttonId, newButtonText);
                    }
                }
                
                showNotification('✅ Блок успешно обновлен и сохранен на сервере!');
            } else {
                showNotification('❌ Ошибка сохранения на сервере', 'error');
            }
            
            overlay.remove();
        });
        
        // Handle cancel
        document.getElementById('cancel-btn').addEventListener('click', () => {
            overlay.remove();
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // Close on Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }
    
    // Upload hero image
    async function uploadHeroImage(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Hero image uploaded:', data.url);
                return data.url;
            } else {
                console.error('Failed to upload hero image');
                showNotification('❌ Ошибка загрузки изображения', 'error');
                return null;
            }
        } catch (error) {
            console.error('Error uploading hero image:', error);
            showNotification('❌ Ошибка загрузки изображения', 'error');
            return null;
        }
    }
    
    // Save hero text to server
    async function saveHeroText(elementId, text) {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/hero-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    [elementId]: text
                })
            });
            
            if (response.ok) {
                console.log(`Hero text saved: ${elementId}`);
            }
        } catch (error) {
            console.error('Error saving hero text:', error);
        }
    }
    
    // Load categories dynamically into a campaign select element
    async function loadCategoriesForCampaignSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // Default options
        select.innerHTML = `
            <option value="shop-all.html">Все товары (Shop All)</option>
        `;
        
        try {
            // Load admin-created categories from API
            const catResponse = await fetch('/api/categories');
            if (catResponse.ok) {
                const categories = await catResponse.json();
                categories.forEach(cat => {
                    const slug = cat.slug || cat.id;
                    const option = document.createElement('option');
                    option.value = 'category-' + encodeURIComponent(slug) + '.html';
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
            }
            
            // Load brands
            const brandResponse = await fetch('/api/brands');
            if (brandResponse.ok) {
                const brands = await brandResponse.json();
                if (brands.length > 0) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = '— Бренды —';
                    brands.forEach(brand => {
                        const option = document.createElement('option');
                        option.value = 'brand.html?brand=' + brand.id;
                        option.textContent = brand.name;
                        optgroup.appendChild(option);
                    });
                    select.appendChild(optgroup);
                }
            }
            
            // Add "no link" option
            const noLinkOption = document.createElement('option');
            noLinkOption.value = '#';
            noLinkOption.textContent = 'Без ссылки';
            select.appendChild(noLinkOption);
            
        } catch (error) {
            console.error('Error loading categories for select:', error);
        }
    }
    
    // Save campaign content to server
    async function saveCampaignContent(campaignId, content) {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch(`/api/campaign-content/${campaignId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(content)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`Campaign content saved for ${campaignId}:`, result);
                return true;
            } else {
                console.error('Failed to save campaign content:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error saving campaign content:', error);
            return false;
        }
    }
    
    // Save text to server (deprecated - kept for compatibility)
    async function saveTextToServer(className, text) {
        try {
            const token = localStorage.getItem('adminToken');
            
            const response = await fetch('/api/homepage-texts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    [className]: text
                })
            });
            
            if (response.ok) {
                console.log(`Text saved: ${className}`);
            }
        } catch (error) {
            console.error('Error saving text:', error);
        }
    }
    
    // Save button text
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
                console.log(`Button text saved: ${buttonId}`);
            }
        } catch (error) {
            console.error('Error saving button text:', error);
        }
    }
    
    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f44336'};
            color: white;
            border-radius: 50px;
            z-index: 100001;
            font-family: Arial, sans-serif;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translateY(20px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes slideDown {
            from { 
                opacity: 0;
                transform: translate(-50%, -20px);
            }
            to { 
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }
        
        .block-edit-btn {
            opacity: 0.9;
            transition: opacity 0.3s ease;
        }
        
        .campaign-content:hover .block-edit-btn,
        .campaign-split-content:hover .block-edit-btn {
            opacity: 1;
        }
        
        /* Ensure edit button is visible on mobile */
        @media (max-width: 768px) {
            .block-edit-btn {
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initBlockEditor, 500);
        });
    } else {
        setTimeout(initBlockEditor, 500);
    }
    
    // Export for manual use
    window.blockEditor = {
        init: initBlockEditor,
        setupBlocks: setupCampaignBlockEditors
    };
    
    console.log('Block editor loaded. Use window.blockEditor.init() to manually initialize.');
})();
