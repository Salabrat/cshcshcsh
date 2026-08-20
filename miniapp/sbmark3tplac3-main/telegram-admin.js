// Telegram Settings Management for Admin Panel

// Load telegram settings when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadTelegramSettings();
    loadSiteSettings();
    initSiteLogoPreview();
});

// Load saved telegram settings
function loadTelegramSettings() {
    try {
        const savedSettings = localStorage.getItem('telegram_settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            const telegramInput = document.getElementById('telegramUsername');
            if (telegramInput && settings.telegramUsername) {
                telegramInput.value = settings.telegramUsername;
            }
        } else {
            // Set default value
            const telegramInput = document.getElementById('telegramUsername');
            if (telegramInput) {
                telegramInput.value = 'pravitelstvo_russian';
            }
        }
    } catch (error) {
        console.error('Error loading telegram settings:', error);
    }
}

// Load site settings from server
async function loadSiteSettings() {
    const siteNameInput = document.getElementById('siteName');
    const siteTitleInput = document.getElementById('siteTitle');
    const menuShopLabelInput = document.getElementById('menuShopLabel');
    const menuBrandLabelInput = document.getElementById('menuBrandLabel');
    const menuSearchLabelInput = document.getElementById('menuSearchLabel');
    const menuShopAllLabelInput = document.getElementById('menuShopAllLabel');
    const menuCategoriesLabelInput = document.getElementById('menuCategoriesLabel');
    const loaderLogoUrlInput = document.getElementById('loaderLogoUrl');
    const headerLogoUrlInput = document.getElementById('headerLogoUrl');
    const loaderPreview = document.getElementById('loaderLogoPreview');
    const loaderPreviewImg = document.getElementById('loaderLogoPreviewImg');
    const headerPreview = document.getElementById('headerLogoPreview');
    const headerPreviewImg = document.getElementById('headerLogoPreviewImg');
    const socialTelegramInput = document.getElementById('socialTelegram');
    const socialVkInput = document.getElementById('socialVk');
    const socialInstagramInput = document.getElementById('socialInstagram');
    const loadingTextInput = document.getElementById('loadingText');

    try {
        const response = await fetch('/api/site-settings');
        if (!response.ok) return;

        const settings = await response.json();
        if (siteNameInput && typeof settings.siteName === 'string') {
            siteNameInput.value = settings.siteName;
        }
        if (siteTitleInput && typeof settings.siteTitle === 'string') {
            siteTitleInput.value = settings.siteTitle;
        }
        if (menuShopLabelInput && typeof settings.menuShopLabel === 'string') {
            menuShopLabelInput.value = settings.menuShopLabel;
        }
        if (menuBrandLabelInput && typeof settings.menuBrandLabel === 'string') {
            menuBrandLabelInput.value = settings.menuBrandLabel;
        }
        if (menuSearchLabelInput && typeof settings.menuSearchLabel === 'string') {
            menuSearchLabelInput.value = settings.menuSearchLabel;
        }
        if (menuShopAllLabelInput && typeof settings.menuShopAllLabel === 'string') {
            menuShopAllLabelInput.value = settings.menuShopAllLabel;
        }
        if (menuCategoriesLabelInput && typeof settings.menuCategoriesLabel === 'string') {
            menuCategoriesLabelInput.value = settings.menuCategoriesLabel;
        }
        
        // Load loader logo (use logoUrl for backward compatibility)
        const loaderLogoUrl = settings.loaderLogoUrl || settings.logoUrl || '';
        if (loaderLogoUrlInput) {
            loaderLogoUrlInput.value = loaderLogoUrl;
        }
        if (loaderPreview && loaderPreviewImg) {
            const loaderPreviewVideo = document.getElementById('loaderLogoPreviewVideo');
            if (loaderLogoUrl) {
                const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(loaderLogoUrl);
                if (isVideo && loaderPreviewVideo) {
                    loaderPreviewImg.style.display = 'none';
                    loaderPreviewVideo.src = loaderLogoUrl;
                    loaderPreviewVideo.style.display = 'block';
                    loaderPreviewVideo.load();
                } else {
                    if (loaderPreviewVideo) loaderPreviewVideo.style.display = 'none';
                    loaderPreviewImg.src = loaderLogoUrl;
                    loaderPreviewImg.style.display = 'block';
                }
                loaderPreview.style.display = 'block';
            } else {
                loaderPreviewImg.src = '';
                loaderPreviewImg.style.display = 'none';
                if (loaderPreviewVideo) {
                    loaderPreviewVideo.src = '';
                    loaderPreviewVideo.style.display = 'none';
                }
                loaderPreview.style.display = 'none';
            }
        }
        
        // Load header logo
        const headerLogoUrl = settings.headerLogoUrl || '';
        if (headerLogoUrlInput) {
            headerLogoUrlInput.value = headerLogoUrl;
        }
        if (headerPreview && headerPreviewImg) {
            if (headerLogoUrl) {
                headerPreviewImg.src = headerLogoUrl;
                headerPreview.style.display = 'block';
            } else {
                headerPreviewImg.src = '';
                headerPreview.style.display = 'none';
            }
        }
        
        if (loadingTextInput && typeof settings.loadingText === 'string') {
            loadingTextInput.value = settings.loadingText;
        } else if (loadingTextInput) {
            loadingTextInput.value = 'C.P. COMPANY';
        }
        
        // Load social links
        if (settings.socialLinks) {
            if (socialTelegramInput && typeof settings.socialLinks.telegram === 'string') {
                socialTelegramInput.value = settings.socialLinks.telegram;
            }
            if (socialVkInput && typeof settings.socialLinks.vk === 'string') {
                socialVkInput.value = settings.socialLinks.vk;
            }
            if (socialInstagramInput && typeof settings.socialLinks.instagram === 'string') {
                socialInstagramInput.value = settings.socialLinks.instagram;
            }
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
    }
}

function initSiteLogoPreview() {
    // Setup loader logo preview
    setupLogoPreview('loaderLogoUpload', 'loaderLogoUrl', 'loaderLogoPreview', 'loaderLogoPreviewImg');
    // Setup header logo preview
    setupLogoPreview('headerLogoUpload', 'headerLogoUrl', 'headerLogoPreview', 'headerLogoPreviewImg');
}

function setupLogoPreview(fileInputId, urlInputId, previewId, previewImgId) {
    const fileInput = document.getElementById(fileInputId);
    const urlInput = document.getElementById(urlInputId);
    const preview = document.getElementById(previewId);
    const previewImg = document.getElementById(previewImgId);
    const previewVideo = document.getElementById(previewImgId.replace('Img', 'Video'));

    if (!preview || !previewImg) return;

    function updatePreview(url, isVideo = false) {
        const safeUrl = (url || '').trim();
        if (!safeUrl) {
            previewImg.src = '';
            previewImg.style.display = 'none';
            if (previewVideo) {
                previewVideo.src = '';
                previewVideo.style.display = 'none';
            }
            preview.style.display = 'none';
            return;
        }
        
        if (isVideo && previewVideo) {
            previewImg.style.display = 'none';
            previewVideo.src = safeUrl;
            previewVideo.style.display = 'block';
            previewVideo.load();
        } else {
            if (previewVideo) previewVideo.style.display = 'none';
            previewImg.src = safeUrl;
            previewImg.style.display = 'block';
        }
        preview.style.display = 'block';
    }

    if (urlInput) {
        urlInput.addEventListener('input', () => {
            const url = urlInput.value;
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
            updatePreview(url, isVideo);
        });
        urlInput.addEventListener('change', () => {
            const url = urlInput.value;
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
            updatePreview(url, isVideo);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;

            const isVideo = file.type.startsWith('video/');
            const localUrl = URL.createObjectURL(file);
            updatePreview(localUrl, isVideo);
        });
    }
}

async function uploadLogoIfNeeded(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;

    const token = localStorage.getItem('adminToken');
    if (!token) {
        throw new Error('No admin token');
    }

    const file = fileInput.files[0];
    const isVideo = file.type.startsWith('video/');
    const formData = new FormData();
    
    if (isVideo) {
        formData.append('video', file);
    } else {
        formData.append('image', file);
    }

    const endpoint = isVideo ? '/api/upload-video' : '/api/upload-image';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload logo');
    }

    const data = await response.json();
    return data && data.url ? data.url : null;
}

// Save settings including telegram
function saveSettings() {
    try {
        const telegramInput = document.getElementById('telegramUsername');
        if (telegramInput) {
            const username = telegramInput.value.trim();
            
            // Remove @ if user accidentally included it
            const cleanUsername = username.replace('@', '');
            
            // Save to localStorage
            const settings = {
                telegramUsername: cleanUsername || 'pravitelstvo_russian'
            };
            
            localStorage.setItem('telegram_settings', JSON.stringify(settings));
            
            // Update input to show clean username
            telegramInput.value = cleanUsername;
            
            // Show success message
            showNotification('Настройки успешно сохранены!', 'success');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Ошибка при сохранении настроек', 'error');
    }
}

// Override saveSettings with async version (keeps global API)
async function saveSettingsAsync() {
    // Save telegram to localStorage (existing behavior)
    try {
        const telegramInput = document.getElementById('telegramUsername');
        if (telegramInput) {
            const username = telegramInput.value.trim();
            const cleanUsername = username.replace('@', '');
            const settings = {
                telegramUsername: cleanUsername || 'pravitelstvo_russian'
            };
            localStorage.setItem('telegram_settings', JSON.stringify(settings));
            telegramInput.value = cleanUsername;
        }
    } catch (error) {
        console.error('Error saving telegram settings:', error);
    }

    // Save site settings to server
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            showNotification('Нет токена администратора. Войдите заново.', 'error');
            return;
        }

        const siteNameInput = document.getElementById('siteName');
        const siteTitleInput = document.getElementById('siteTitle');
        const menuShopLabelInput = document.getElementById('menuShopLabel');
        const menuBrandLabelInput = document.getElementById('menuBrandLabel');
        const menuSearchLabelInput = document.getElementById('menuSearchLabel');
        const menuShopAllLabelInput = document.getElementById('menuShopAllLabel');
        const menuCategoriesLabelInput = document.getElementById('menuCategoriesLabel');
        const loaderLogoUrlInput = document.getElementById('loaderLogoUrl');
        const headerLogoUrlInput = document.getElementById('headerLogoUrl');

        // Handle loader logo upload
        let loaderLogoUrl = loaderLogoUrlInput ? loaderLogoUrlInput.value.trim() : '';
        const uploadedLoaderUrl = await uploadLogoIfNeeded('loaderLogoUpload');
        if (uploadedLoaderUrl) {
            loaderLogoUrl = uploadedLoaderUrl;
            if (loaderLogoUrlInput) loaderLogoUrlInput.value = uploadedLoaderUrl;
        }

        // Handle header logo upload
        let headerLogoUrl = headerLogoUrlInput ? headerLogoUrlInput.value.trim() : '';
        const uploadedHeaderUrl = await uploadLogoIfNeeded('headerLogoUpload');
        if (uploadedHeaderUrl) {
            headerLogoUrl = uploadedHeaderUrl;
            if (headerLogoUrlInput) headerLogoUrlInput.value = uploadedHeaderUrl;
        }

        const socialTelegramInput = document.getElementById('socialTelegram');
        const socialVkInput = document.getElementById('socialVk');
        const socialInstagramInput = document.getElementById('socialInstagram');
        const loadingTextInput = document.getElementById('loadingText');

        const payload = {
            siteName: siteNameInput ? siteNameInput.value : undefined,
            siteTitle: siteTitleInput ? siteTitleInput.value.trim() : undefined,
            menuShopLabel: menuShopLabelInput ? menuShopLabelInput.value.trim() : undefined,
            menuBrandLabel: menuBrandLabelInput ? menuBrandLabelInput.value.trim() : undefined,
            menuSearchLabel: menuSearchLabelInput ? menuSearchLabelInput.value.trim() : undefined,
            menuShopAllLabel: menuShopAllLabelInput ? menuShopAllLabelInput.value.trim() : undefined,
            menuCategoriesLabel: menuCategoriesLabelInput ? menuCategoriesLabelInput.value.trim() : undefined,
            loaderLogoUrl,
            headerLogoUrl,
            logoUrl: loaderLogoUrl, // Keep for backward compatibility
            loadingText: loadingTextInput ? loadingTextInput.value.trim() : undefined,
            socialLinks: {
                telegram: socialTelegramInput ? socialTelegramInput.value.trim() : undefined,
                vk: socialVkInput ? socialVkInput.value.trim() : undefined,
                instagram: socialInstagramInput ? socialInstagramInput.value.trim() : undefined
            }
        };

        const response = await fetch('/api/site-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Ошибка при сохранении настроек сайта');
        }

        await loadSiteSettings();
        showNotification('Настройки успешно сохранены!', 'success');
    } catch (error) {
        console.error('Error saving site settings:', error);
        showNotification('Ошибка при сохранении настроек', 'error');
    }
}

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    
    // Add styles if not exist
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .admin-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 4px;
                background: #4CAF50;
                color: white;
                font-size: 14px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .admin-notification.error {
                background: #f44336;
            }
            
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
        `;
        document.head.appendChild(styles);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Make saveSettings global
window.saveSettings = saveSettingsAsync;
