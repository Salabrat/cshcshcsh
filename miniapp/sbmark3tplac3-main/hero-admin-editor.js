// Hero Admin Editor
(function() {
    'use strict';
    
    let isAdmin = false;
    let heroData = {
        title: '',
        subtitle: '',
        buttonText: '',
        backgroundImage: '',
        backgroundVideo: '',
        mediaType: 'image'
    };
    
    // Check admin status
    async function checkAdminStatus() {
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
    
    // Create edit button
    function createEditButton() {
        // Remove any existing conflicting edit buttons first
        const existingButtons = document.querySelectorAll('.hero-edit-button, .block-edit-btn');
        existingButtons.forEach(btn => btn.remove());
        
        const button = document.createElement('button');
        button.className = 'hero-edit-button hero-section-editor';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Изменить Hero</span>
        `;
        button.onclick = openEditModal;
        
        // Add button to hero section
        const heroSection = document.querySelector('.hero, .hero-section');
        if (heroSection) {
            heroSection.appendChild(button);
            console.log('Hero edit button added');
        }
    }
    
    // Create modal HTML
    function createModal() {
        const modal = document.createElement('div');
        modal.className = 'hero-edit-modal';
        modal.innerHTML = `
            <div class="hero-edit-modal-content">
                <div class="hero-edit-modal-header">
                    <h2>Редактирование Hero секции</h2>
                    <button class="hero-edit-close" onclick="closeHeroEditModal()">×</button>
                </div>
                
                <div class="hero-edit-modal-body">
                    <div class="hero-edit-preview">
                        <div class="hero-edit-preview-image" id="heroPreviewImage">
                            <div class="hero-edit-preview-content">
                                <h3 id="heroPreviewTitle">Preview Title</h3>
                                <p id="heroPreviewSubtitle">Preview Subtitle</p>
                                <button id="heroPreviewButton">BUTTON</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="hero-edit-form">
                        <div class="hero-edit-group">
                            <label for="heroTitle">Заголовок</label>
                            <textarea id="heroTitle" rows="3" placeholder="HIGH&#10;PERFORMANCE&#10;JACKETS"></textarea>
                            <small>Используйте Enter для переноса строк</small>
                        </div>
                        
                        <div class="hero-edit-group">
                            <label for="heroSubtitle">Подзаголовок</label>
                            <input type="text" id="heroSubtitle" placeholder="Cutting-edge technologies for all winter conditions">
                        </div>
                        
                        <div class="hero-edit-group">
                            <label for="heroButtonText">Текст кнопки</label>
                            <input type="text" id="heroButtonText" placeholder="SHOP NOW">
                        </div>
                        
                        <div class="hero-edit-group">
                            <label for="heroButtonLink">Назначение кнопки (куда ведёт)</label>
                            <select id="heroButtonLink">
                                <option value="shop-all.html">Все товары (Shop All)</option>
                            </select>
                            <small>Выберите страницу, на которую будет вести кнопка</small>
                        </div>
                        
                        <div class="hero-edit-group">
                            <label for="heroImage">Фоновое изображение / видео</label>
                            <div class="hero-edit-file-wrapper">
                                <input type="file" id="heroImage" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime">
                                <button type="button" class="hero-edit-file-button">
                                    📷 Выбрать изображение или видео
                                </button>
                            </div>
                            <small id="heroImageName"></small>
                            <small style="display:block;color:#999;margin-top:4px;">Поддерживаются: JPG, PNG, GIF, WEBP, MP4, WEBM, OGG, MOV (видео до 50 МБ)</small>
                            <div id="heroVideoPreviewWrap" style="display:none;margin-top:8px;">
                                <video id="heroVideoPreview" style="max-width:100%;max-height:200px;border-radius:8px;" muted playsinline></video>
                            </div>
                        </div>
                        
                        <div class="hero-edit-actions">
                            <button type="button" class="hero-edit-save" onclick="saveHeroChanges()">
                                💾 Сохранить изменения
                            </button>
                            <button type="button" class="hero-edit-cancel" onclick="closeHeroEditModal()">
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup file input
        const fileInput = document.getElementById('heroImage');
        const fileButton = modal.querySelector('.hero-edit-file-button');
        
        fileButton.onclick = () => fileInput.click();
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('heroImageName').textContent = `Выбрано: ${file.name}`;
                const videoWrap = document.getElementById('heroVideoPreviewWrap');
                const videoEl = document.getElementById('heroVideoPreview');
                
                if (file.type.startsWith('video/')) {
                    // Preview video
                    const url = URL.createObjectURL(file);
                    videoEl.src = url;
                    videoEl.load();
                    videoEl.play().catch(() => {});
                    videoWrap.style.display = 'block';
                    document.getElementById('heroPreviewImage').style.backgroundImage = 'none';
                } else {
                    // Preview image
                    videoWrap.style.display = 'none';
                    videoEl.pause();
                    videoEl.src = '';
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        document.getElementById('heroPreviewImage').style.backgroundImage = `url(${ev.target.result})`;
                    };
                    reader.readAsDataURL(file);
                }
            }
        };
        
        // Setup real-time preview
        document.getElementById('heroTitle').oninput = updatePreview;
        document.getElementById('heroSubtitle').oninput = updatePreview;
        document.getElementById('heroButtonText').oninput = updatePreview;
        
        // Load categories into button link selector
        loadCategoriesForSelect('heroButtonLink');
    }
    
    // Load categories dynamically into a select element
    async function loadCategoriesForSelect(selectId) {
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
    
    // Update preview
    function updatePreview() {
        const title = document.getElementById('heroTitle').value || 'Preview Title';
        const subtitle = document.getElementById('heroSubtitle').value || 'Preview Subtitle';
        const buttonText = document.getElementById('heroButtonText').value || 'BUTTON';
        
        document.getElementById('heroPreviewTitle').innerHTML = title.replace(/\n/g, '<br>');
        document.getElementById('heroPreviewSubtitle').textContent = subtitle;
        document.getElementById('heroPreviewButton').textContent = buttonText;
    }
    
    // Open edit modal
    async function openEditModal() {
        const modal = document.querySelector('.hero-edit-modal');
        if (!modal) {
            createModal();
        }
        
        // Load current values from API to ensure we have the latest data
        try {
            const response = await fetch('/api/hero-content');
            if (response.ok) {
                const content = await response.json();
                console.log('Loaded content for editing:', content);
                
                // Set form values from server data
                document.getElementById('heroTitle').value = content.title ? content.title.replace(/<br>/g, '\n') : '';
                document.getElementById('heroSubtitle').value = content.subtitle || '';
                document.getElementById('heroButtonText').value = content.buttonText || '';
                
                // Set button link after categories are loaded
                if (content.buttonLink) {
                    const linkSelect = document.getElementById('heroButtonLink');
                    if (linkSelect) {
                        // Wait for categories to load, then set value
                        const setLinkValue = () => {
                            linkSelect.value = content.buttonLink;
                            // If value wasn't found in options, try without leading /
                            if (linkSelect.value !== content.buttonLink) {
                                const cleanLink = content.buttonLink.replace(/^\//, '');
                                linkSelect.value = cleanLink;
                            }
                        };
                        // Try immediately and also after a delay (for async category loading)
                        setLinkValue();
                        setTimeout(setLinkValue, 500);
                    }
                }
                
                // Set preview background (image or video)
                const videoWrap = document.getElementById('heroVideoPreviewWrap');
                const videoEl = document.getElementById('heroVideoPreview');
                if (content.mediaType === 'video' && content.backgroundVideo) {
                    let videoUrl = content.backgroundVideo;
                    if (!videoUrl.startsWith('http')) {
                        videoUrl = window.location.origin + videoUrl;
                    }
                    if (videoWrap && videoEl) {
                        videoEl.src = videoUrl;
                        videoEl.load();
                        videoEl.play().catch(() => {});
                        videoWrap.style.display = 'block';
                    }
                    document.getElementById('heroPreviewImage').style.backgroundImage = 'none';
                } else if (content.backgroundImage) {
                    let imageUrl = content.backgroundImage;
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = window.location.origin + imageUrl;
                    }
                    document.getElementById('heroPreviewImage').style.backgroundImage = `url('${imageUrl}')`;
                    if (videoWrap) videoWrap.style.display = 'none';
                }
            } else {
                // Fallback to reading from DOM
                const heroTitle = document.querySelector('.hero-title');
                const heroSubtitle = document.querySelector('.hero-subtitle');
                const heroButton = document.querySelector('[data-text-id="hero-btn"]') || document.querySelector('.hero .btn');
                const heroSection = document.querySelector('.hero');
                
                if (heroTitle) {
                    document.getElementById('heroTitle').value = heroTitle.innerHTML.replace(/<br>/g, '\n');
                }
                if (heroSubtitle) {
                    document.getElementById('heroSubtitle').value = heroSubtitle.textContent;
                }
                if (heroButton) {
                    document.getElementById('heroButtonText').value = heroButton.textContent;
                }
                
                // Get current background image
                const bgImage = window.getComputedStyle(heroSection).backgroundImage;
                if (bgImage && bgImage !== 'none') {
                    document.getElementById('heroPreviewImage').style.backgroundImage = bgImage;
                }
            }
        } catch (error) {
            console.error('Error loading content:', error);
        }
        
        updatePreview();
        
        document.querySelector('.hero-edit-modal').style.display = 'flex';
    }
    
    // Close modal
    window.closeHeroEditModal = function() {
        const modal = document.querySelector('.hero-edit-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    // Save changes
    window.saveHeroChanges = async function() {
        const title = document.getElementById('heroTitle').value;
        const subtitle = document.getElementById('heroSubtitle').value;
        const buttonText = document.getElementById('heroButtonText').value;
        const buttonLink = document.getElementById('heroButtonLink').value;
        const mediaFile = document.getElementById('heroImage').files[0];
        
        console.log('Saving hero content:', {
            title,
            subtitle,
            buttonText,
            buttonLink,
            hasFile: !!mediaFile,
            fileType: mediaFile ? mediaFile.type : 'none'
        });
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('subtitle', subtitle);
        formData.append('buttonText', buttonText);
        formData.append('buttonLink', buttonLink);
        
        if (mediaFile) {
            formData.append('image', mediaFile);
            console.log('Uploading file:', mediaFile.name, mediaFile.type);
        }
        
        const token = localStorage.getItem('adminToken');
        
        try {
            const response = await fetch('/api/hero-content', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });
            
            if (response.ok) {
                alert('✅ Изменения успешно сохранены!');
                closeHeroEditModal();
                location.reload();
            } else {
                const error = await response.text();
                alert('❌ Ошибка сохранения: ' + error);
            }
        } catch (error) {
            alert('❌ Ошибка: ' + error.message);
        }
    };
    
    // Initialize
    async function init() {
        isAdmin = await checkAdminStatus();
        
        if (isAdmin) {
            createEditButton();
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Re-check admin status periodically
    setInterval(async () => {
        const currentAdminStatus = await checkAdminStatus();
        
        if (currentAdminStatus !== isAdmin) {
            isAdmin = currentAdminStatus;
            
            const button = document.querySelector('.hero-edit-button');
            if (isAdmin && !button) {
                createEditButton();
            } else if (!isAdmin && button) {
                button.remove();
                closeHeroEditModal();
            }
        }
    }, 10000);
})();
