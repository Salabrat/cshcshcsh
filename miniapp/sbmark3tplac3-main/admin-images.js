// Admin Images Management
document.addEventListener('DOMContentLoaded', function() {
    initHomepageImagesAdmin();
    // Load login image on page load if we're on the images section
    loadLoginImage();
    
    // Add event listeners for image preview
    const loginImageUpload = document.getElementById('loginImageUpload');
    const loginImageUrl = document.getElementById('loginImageUrl');
    
    if (loginImageUpload) {
        loginImageUpload.addEventListener('change', handleImageFileSelect);
    }
    
    if (loginImageUrl) {
        loginImageUrl.addEventListener('input', handleImageUrlInput);
    }

    const homepageImageUpload = document.getElementById('homepageImageUpload');
    const homepageImageUrl = document.getElementById('homepageImageUrl');
    if (homepageImageUpload) {
        homepageImageUpload.addEventListener('change', handleHomepageImageFileSelect);
    }
    if (homepageImageUrl) {
        homepageImageUrl.addEventListener('input', handleHomepageImageUrlInput);
    }
});

const HOMEPAGE_IMAGE_SLOTS = [
    { key: 'hero', title: 'Hero (фон)', requiredSize: '1920x1080' },
    { key: 'campaign1', title: 'Campaign 1', requiredSize: '800x1000' },
    { key: 'campaign2', title: 'Campaign 2', requiredSize: '800x1000' },
    { key: 'campaign3', title: 'Campaign 3', requiredSize: '800x1000' },
    { key: 'about1', title: 'About 1 (категория 1)', requiredSize: '600x400' },
    { key: 'about2', title: 'About 2 (категория 2)', requiredSize: '600x400' }
];
//salabratmadeitoday
let homepageImagesCache = {};
let currentHomepageImageKey = null;

async function initHomepageImagesAdmin() {
    const grid = document.getElementById('homepageImagesGrid');
    if (!grid) return;

    await loadHomepageImagesAdmin();
}

//salabratmadeitoday        
function renderHomepageImagesGrid() {
    const grid = document.getElementById('homepageImagesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    HOMEPAGE_IMAGE_SLOTS.forEach((slot) => {
        const url = homepageImagesCache[slot.key] || '';
        const isVideo = url && /\.(mp4|webm|ogg|mov)$/i.test(url);

        const card = document.createElement('div');
        card.className = 'homepage-image-card';
        card.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #fff; display: flex; gap: 12px; align-items: flex-start;';

        let preview;
        if (isVideo) {
            preview = document.createElement('video');
            preview.src = url;
            preview.muted = true;
            preview.loop = true;
            preview.playsInline = true;
            preview.style.cssText = 'width: 90px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; background: #f3f4f6;';
            preview.addEventListener('loadeddata', () => {
                preview.play().catch(() => {});
            });
        } else {
            preview = document.createElement('img');
            preview.src = url || '';
            preview.alt = slot.title;
            preview.style.cssText = 'width: 90px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; background: #f3f4f6;';
            preview.onerror = function() {
                this.src = '';
            };
        }

        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; color: #111827; margin-bottom: 4px;';
        title.textContent = `${slot.title} (${slot.requiredSize})`;

        const urlText = document.createElement('div');
        urlText.style.cssText = 'font-size: 12px; color: #6b7280; word-break: break-all; margin-bottom: 10px;';
        urlText.textContent = url || '—';

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

        const editBtn = document.createElement('button');
        editBtn.className = 'admin-btn admin-btn-primary';
        editBtn.type = 'button';
        editBtn.textContent = 'Изменить';
        editBtn.onclick = () => openHomepageImageModal(slot.key);

        actions.appendChild(editBtn);
        info.appendChild(title);
        info.appendChild(urlText);
        info.appendChild(actions);

        card.appendChild(preview);
        card.appendChild(info);
        grid.appendChild(card);
    });
}

async function loadHomepageImagesAdmin() {
    try {
        const response = await fetch('/api/homepage-images');
        if (!response.ok) {
            throw new Error('Failed to load homepage images');
        }
        homepageImagesCache = await response.json();
        renderHomepageImagesGrid();
    } catch (error) {
        console.error('Error loading homepage images:', error);
    }
}

function openHomepageImageModal(imageKey) {
    const modal = document.getElementById('homepageImageModal');
    if (!modal) return;

    currentHomepageImageKey = imageKey;
    const slot = HOMEPAGE_IMAGE_SLOTS.find(s => s.key === imageKey);

    const titleEl = document.getElementById('homepageImageModalTitle');
    const sizeEl = document.getElementById('homepageImageRecommendedSize');
    if (titleEl) titleEl.textContent = `Изменить изображение: ${slot ? slot.title : imageKey}`;
    if (sizeEl) sizeEl.textContent = `Рекомендуемый размер: ${slot ? slot.requiredSize : '—'}px`;

    modal.style.display = 'flex';

    const uploadInput = document.getElementById('homepageImageUpload');
    const urlInput = document.getElementById('homepageImageUrl');
    if (uploadInput) uploadInput.value = '';
    if (urlInput) urlInput.value = '';

    const previewContainer = document.getElementById('homepageImageUploadPreview');
    if (previewContainer) previewContainer.style.display = 'none';

    const currentUrl = homepageImagesCache[imageKey];
    if (currentUrl) {
        showHomepageImagePreview(currentUrl);
    }
}

function closeHomepageImageModal() {
    const modal = document.getElementById('homepageImageModal');
    if (!modal) return;
    modal.style.display = 'none';
    currentHomepageImageKey = null;

    const uploadInput = document.getElementById('homepageImageUpload');
    const urlInput = document.getElementById('homepageImageUrl');
    if (uploadInput) uploadInput.value = '';
    if (urlInput) urlInput.value = '';

    const previewContainer = document.getElementById('homepageImageUploadPreview');
    if (previewContainer) previewContainer.style.display = 'none';
}

function handleHomepageImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.type.startsWith('video/')) {
            // Handle video
            const url = URL.createObjectURL(file);
            showHomepageVideoPreview(url);
            const urlInput = document.getElementById('homepageImageUrl');
            if (urlInput) urlInput.value = '';
        } else if (file.type.startsWith('image/')) {
            // Handle image
            const reader = new FileReader();
            reader.onload = function(e) {
                showHomepageImagePreview(e.target.result);
                const urlInput = document.getElementById('homepageImageUrl');
                if (urlInput) urlInput.value = '';
            };
            reader.readAsDataURL(file);
        }
    }
}

function handleHomepageImageUrlInput(event) {
    const url = event.target.value;
    if (url) {
        // Detect if URL is video or image
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
        if (isVideo) {
            showHomepageVideoPreview(url);
        } else {
            showHomepageImagePreview(url);
        }
        const fileInput = document.getElementById('homepageImageUpload');
        if (fileInput) fileInput.value = '';
    } else {
        const previewContainer = document.getElementById('homepageImageUploadPreview');
        if (previewContainer) previewContainer.style.display = 'none';
    }
}

function showHomepageImagePreview(src) {
    const previewContainer = document.getElementById('homepageImageUploadPreview');
    const previewImg = document.getElementById('homepageImageUploadPreviewImg');
    const previewVideo = document.getElementById('homepageImageUploadPreviewVideo');
    if (previewContainer && previewImg) {
        previewImg.src = src;
        previewImg.style.display = 'block';
        if (previewVideo) {
            previewVideo.style.display = 'none';
            previewVideo.pause();
            previewVideo.src = '';
        }
        previewContainer.style.display = 'block';
    }
}

function showHomepageVideoPreview(src) {
    const previewContainer = document.getElementById('homepageImageUploadPreview');
    const previewImg = document.getElementById('homepageImageUploadPreviewImg');
    const previewVideo = document.getElementById('homepageImageUploadPreviewVideo');
    if (previewContainer && previewVideo) {
        previewVideo.src = src;
        previewVideo.style.display = 'block';
        previewVideo.load();
        previewVideo.play().catch(() => {});
        if (previewImg) {
            previewImg.style.display = 'none';
            previewImg.src = '';
        }
        previewContainer.style.display = 'block';
    }
}

async function saveHomepageImage() {
    if (!currentHomepageImageKey) {
        return;
    }

    const fileInput = document.getElementById('homepageImageUpload');
    const urlInput = document.getElementById('homepageImageUrl');

    let imageUrl = '';

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('adminToken');
            const uploadResponse = await fetch('/api/hero-content', {
                method: 'POST',
                headers: token ? { 'Authorization': 'Bearer ' + token } : {},
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }

            const uploadData = await uploadResponse.json();
            // Extract the URL from hero-content response
            imageUrl = uploadData.content.backgroundVideo || uploadData.content.backgroundImage;
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Ошибка при загрузке файла');
            return;
        }
    } else if (urlInput && urlInput.value) {
        imageUrl = urlInput.value;
    } else {
        alert('Пожалуйста, выберите изображение/видео или введите URL');
        return;
    }

    try {
        const newImages = { ...homepageImagesCache, [currentHomepageImageKey]: imageUrl };
        const response = await fetch('/api/homepage-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newImages)
        });

        if (!response.ok) {
            throw new Error('Failed to save homepage images');
        }

        homepageImagesCache = newImages;
        renderHomepageImagesGrid();
        showNotification('Изображение успешно обновлено', 'success');
        closeHomepageImageModal();
    } catch (error) {
        console.error('Error saving homepage images:', error);
        alert('Ошибка при сохранении изображения');
    }
}

// Load current login image
async function loadLoginImage() {
    try {
        const response = await fetch('/api/login-image');
        const data = await response.json();
        
        const preview = document.getElementById('loginImagePreview');
        if (preview && data.loginImage) {
            const url = data.loginImage;
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
            const container = preview.parentElement;
            
            if (isVideo) {
                // Replace img with video
                let video = container.querySelector('video.login-preview-video');
                if (!video) {
                    video = document.createElement('video');
                    video.className = 'login-preview-video';
                    video.id = 'loginImagePreview';
                    video.style.cssText = preview.style.cssText || 'max-width: 400px; height: auto; border: 1px solid #ddd; border-radius: 8px;';
                    video.muted = true;
                    video.loop = true;
                    video.playsInline = true;
                    video.setAttribute('playsinline', '');
                    video.setAttribute('webkit-playsinline', '');
                    video.setAttribute('muted', '');
                    video.setAttribute('preload', 'auto');
                    container.replaceChild(video, preview);
                }
                video.src = url;
                video.load();
                video.play().catch(() => {});
            } else {
                // Ensure we have an img element
                if (preview.tagName === 'VIDEO') {
                    const img = document.createElement('img');
                    img.id = 'loginImagePreview';
                    img.alt = 'Login Page Image';
                    img.style.cssText = preview.style.cssText;
                    container.replaceChild(img, preview);
                    img.src = url;
                } else {
                    preview.src = url;
                }
            }
        }
    } catch (error) {
        console.error('Error loading login image:', error);
    }
}

// Open login image modal
function openLoginImageModal() {
    const modal = document.getElementById('loginImageModal');
    if (modal) {
        modal.style.display = 'flex';
        loadLoginImage(); // Reload current image
    }
}

// Close login image modal
function closeLoginImageModal() {
    const modal = document.getElementById('loginImageModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear inputs
        document.getElementById('loginImageUpload').value = '';
        document.getElementById('loginImageUrl').value = '';
        document.getElementById('loginImageUploadPreview').style.display = 'none';
    }
}

// Handle file selection
function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.type.startsWith('video/')) {
            // Handle video
            const url = URL.createObjectURL(file);
            showVideoPreview(url);
            document.getElementById('loginImageUrl').value = '';
        } else if (file.type.startsWith('image/')) {
            // Handle image
            const reader = new FileReader();
            reader.onload = function(e) {
                showImagePreview(e.target.result);
                document.getElementById('loginImageUrl').value = '';
            };
            reader.readAsDataURL(file);
        }
    }
}

// Handle URL input
function handleImageUrlInput(event) {
    const url = event.target.value;
    if (url) {
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
        if (isVideo) {
            showVideoPreview(url);
        } else {
            showImagePreview(url);
        }
        document.getElementById('loginImageUpload').value = '';
    } else {
        document.getElementById('loginImageUploadPreview').style.display = 'none';
    }
}

// Show image preview
function showImagePreview(src) {
    const previewContainer = document.getElementById('loginImageUploadPreview');
    const previewImg = document.getElementById('loginImageUploadPreviewImg');
    const previewVideo = document.getElementById('loginImageUploadPreviewVideo');
    
    if (previewContainer && previewImg) {
        previewImg.src = src;
        previewImg.style.display = 'block';
        if (previewVideo) {
            previewVideo.style.display = 'none';
            previewVideo.pause();
            previewVideo.src = '';
        }
        previewContainer.style.display = 'block';
    }
}

// Show video preview
function showVideoPreview(src) {
    const previewContainer = document.getElementById('loginImageUploadPreview');
    const previewImg = document.getElementById('loginImageUploadPreviewImg');
    const previewVideo = document.getElementById('loginImageUploadPreviewVideo');
    
    if (previewContainer && previewVideo) {
        previewVideo.src = src;
        previewVideo.style.display = 'block';
        previewVideo.load();
        previewVideo.play().catch(() => {});
        if (previewImg) {
            previewImg.style.display = 'none';
            previewImg.src = '';
        }
        previewContainer.style.display = 'block';
    }
}

// Save login image
async function saveLoginImage() {
    const fileInput = document.getElementById('loginImageUpload');
    const urlInput = document.getElementById('loginImageUrl');
    
    let imageUrl = '';
    
    // Check if file is selected
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Upload file
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const token = localStorage.getItem('adminToken');
            const uploadResponse = await fetch('/api/hero-content', {
                method: 'POST',
                headers: token ? { 'Authorization': 'Bearer ' + token } : {},
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }
            
            const uploadData = await uploadResponse.json();
            imageUrl = uploadData.content.backgroundVideo || uploadData.content.backgroundImage;
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Ошибка при загрузке файла');
            return;
        }
    } else if (urlInput.value) {
        // Use URL directly
        imageUrl = urlInput.value;
    } else {
        alert('Пожалуйста, выберите изображение/видео или введите URL');
        return;
    }
    
    // Save the image URL to server
    try {
        const response = await fetch('/api/login-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ loginImage: imageUrl })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save image');
        }
        
        const data = await response.json();
        
        // Update preview
        document.getElementById('loginImagePreview').src = data.loginImage;
        
        // Show success message
        showNotification('Изображение успешно обновлено', 'success');
        
        // Close modal
        closeLoginImageModal();
    } catch (error) {
        console.error('Error saving login image:', error);
        alert('Ошибка при сохранении изображения');
    }
}

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
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

// Add CSS animation if not exists
if (!document.querySelector('#admin-images-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-images-styles';
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
        
        .images-management {
            padding: 20px;
            background: white;
            border-radius: 8px;
            margin-top: 20px;
        }
        
        .image-preview-container {
            display: flex;
            gap: 30px;
            align-items: flex-start;
            margin-top: 20px;
        }
        
        .current-image h3 {
            margin-bottom: 15px;
            color: #333;
        }
        
        .image-actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        #loginImageModal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        
        #loginImageModal .modal-content {
            background: white;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        #loginImageModal .modal-header {
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #loginImageModal .modal-header h2 {
            margin: 0;
            font-size: 1.5rem;
        }
        
        #loginImageModal .modal-close {
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
        }
        
        #loginImageModal .modal-body {
            padding: 20px;
        }
        
        #loginImageModal .modal-footer {
            padding: 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .help-text {
            font-size: 0.875rem;
            color: #666;
            margin-top: 5px;
        }
    `;
    document.head.appendChild(style);
}
