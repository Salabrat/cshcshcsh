// Homepage Admin Panel for managing homepage images
class HomepageAdmin {
    constructor() {
        this.storageKey = 'cpcompany_homepage_images';
        this.isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        this.init();
    }

    init() {
        // Always load saved images for all users
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.loadSavedImages();
                // Setup admin controls only for admin
                if (this.isAdmin) {
                    this.setupAdminControls();
                }
            });
        } else {
            this.loadSavedImages();
            // Setup admin controls only for admin
            if (this.isAdmin) {
                this.setupAdminControls();
            }
        }
    }

    setupAdminControls() {
        // Add edit buttons to hero images
        this.addEditButton('.hero-image img', 'hero');
        
        // Add edit buttons to campaign section images
        this.addEditButton('.campaign-section.campaign-dark .campaign-image img', 'campaign1');
        this.addEditButton('.campaign-section.campaign-split:not(.campaign-split-reverse) .campaign-split-image img', 'campaign2');
        this.addEditButton('.campaign-section.campaign-split-reverse .campaign-split-image img', 'campaign3');
        
        // Add edit buttons to about section images (Jackets & Coats, Sweatshirts)
        this.addEditButton('.about-grid .about-item:nth-child(1) img', 'about1');
        this.addEditButton('.about-grid .about-item:nth-child(2) img', 'about2');

        // Create modal for image upload
        this.createImageUploadModal();
    }

    addEditButton(selector, imageId) {
        const element = document.querySelector(selector);
        if (!element) return;

        const container = element.parentElement;
        container.style.position = 'relative';

        const editBtn = document.createElement('button');
        editBtn.className = 'admin-image-edit-btn';
        editBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editBtn.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            padding: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;

        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.background = 'rgba(0, 0, 0, 0.95)';
            editBtn.style.transform = 'scale(1.05)';
            editBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        });

        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.background = 'rgba(0, 0, 0, 0.8)';
            editBtn.style.transform = 'scale(1)';
            editBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        });

        editBtn.addEventListener('click', () => {
            this.openImageUploadModal(imageId, element);
        });

        container.appendChild(editBtn);
    }

    createImageUploadModal() {
        const modal = document.createElement('div');
        modal.id = 'imageUploadModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            align-items: center;
            justify-content: center;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%;">
                <h2 style="margin-bottom: 20px; color: #000; font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600;">Изменить изображение</h2>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; color: #333; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;">Выберите новое изображение:</label>
                    <input type="file" id="imageUploadInput" accept="image/*" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Inter', sans-serif; font-size: 14px;">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; color: #333; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;">Или введите URL изображения:</label>
                    <input type="text" id="imageUrlInput" placeholder="https://example.com/image.jpg" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Inter', sans-serif; font-size: 14px; color: #000; background: white;">
                </div>
                <div id="imagePreview" style="margin-bottom: 20px; max-height: 300px; overflow: hidden; display: none;">
                    <img id="previewImg" style="width: 100%; height: auto;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelUpload" style="padding: 10px 20px; border: 1px solid #ddd; background: white; color: #333; border-radius: 4px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; transition: all 0.3s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">Отмена</button>
                    <button id="saveImage" style="padding: 10px 20px; border: none; background: black; color: white; border-radius: 4px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; transition: all 0.3s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='black'">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup modal event handlers
        const fileInput = document.getElementById('imageUploadInput');
        const urlInput = document.getElementById('imageUrlInput');
        const preview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        const cancelBtn = document.getElementById('cancelUpload');
        const saveBtn = document.getElementById('saveImage');

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    preview.style.display = 'block';
                    urlInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        });

        urlInput.addEventListener('input', (e) => {
            const url = e.target.value;
            if (url) {
                previewImg.src = url;
                preview.style.display = 'block';
                fileInput.value = '';
            } else {
                preview.style.display = 'none';
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.closeImageUploadModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeImageUploadModal();
            }
        });
    }

    openImageUploadModal(imageId, imageElement) {
        const modal = document.getElementById('imageUploadModal');
        modal.style.display = 'flex';

        const saveBtn = document.getElementById('saveImage');
        
        // Remove old event listener and add new one
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', () => {
            this.saveImage(imageId, imageElement);
        });
    }

    closeImageUploadModal() {
        const modal = document.getElementById('imageUploadModal');
        modal.style.display = 'none';
        
        // Reset inputs
        document.getElementById('imageUploadInput').value = '';
        document.getElementById('imageUrlInput').value = '';
        document.getElementById('imagePreview').style.display = 'none';
    }

    async saveImage(imageId, imageElement) {
        const fileInput = document.getElementById('imageUploadInput');
        const urlInput = document.getElementById('imageUrlInput');
        
        let imageUrl = '';

        if (fileInput.files.length > 0) {
            // Upload file to server
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('image', file);
            
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Upload failed');
                
                const data = await response.json();
                imageUrl = data.url;
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('Ошибка при загрузке изображения');
                return;
            }
        } else if (urlInput.value) {
            imageUrl = urlInput.value;
        } else {
            alert('Пожалуйста, выберите изображение или введите URL');
            return;
        }

        // Save to server
        try {
            const savedImages = await this.getSavedImagesFromServer();
            savedImages[imageId] = imageUrl;
            
            const response = await fetch('/api/homepage-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(savedImages)
            });
            
            if (!response.ok) throw new Error('Save failed');
            
            // Update image on page
            imageElement.src = imageUrl;
            console.log(`Image updated: ${imageId} = ${imageUrl}`);
            
            // Reload all images to ensure consistency
            await this.loadSavedImages();
            
            // Close modal
            this.closeImageUploadModal();
            
            alert('Изображение успешно обновлено!');
        } catch (error) {
            console.error('Error saving image:', error);
            alert('Ошибка при сохранении изображения');
        }
    }

    async getSavedImagesFromServer() {
        try {
            console.log('Fetching images from /api/homepage-images...');
            const response = await fetch('/api/homepage-images');
            if (!response.ok) throw new Error('Failed to fetch images');
            const data = await response.json();
            console.log('Fetched images data:', data);
            return data;
        } catch (error) {
            console.error('Error fetching images from server:', error);
            return {};
        }
    }
    
    getSavedImages() {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? JSON.parse(saved) : {};
    }

    async loadSavedImages() {
        console.log('Loading saved images from server...');
        try {
            // Load from server
            const savedImages = await this.getSavedImagesFromServer();
            console.log('Saved images from server:', savedImages);
            
            // Map of imageId to selector
            const imageMap = {
                'hero': '.hero-image img',
                'campaign1': '.campaign-section.campaign-dark .campaign-image img',
                'campaign2': '.campaign-section.campaign-split:not(.campaign-split-reverse) .campaign-split-image img',
                'campaign3': '.campaign-section.campaign-split-reverse .campaign-split-image img',
                'about1': '.about-grid .about-item:nth-child(1) img',
                'about2': '.about-grid .about-item:nth-child(2) img'
            };

            for (const [imageId, selector] of Object.entries(imageMap)) {
                if (savedImages[imageId]) {
                    const element = document.querySelector(selector);
                    if (element) {
                        console.log(`Updating ${imageId}: ${savedImages[imageId]}`);
                        element.src = savedImages[imageId];
                    } else {
                        console.warn(`Element not found for selector: ${selector}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading saved images:', error);
        }
    }
}

// Initialize homepage admin
window.homepageAdmin = new HomepageAdmin();
