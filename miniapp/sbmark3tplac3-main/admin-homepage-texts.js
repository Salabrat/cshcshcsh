// Admin Homepage Texts Editor
class AdminHomepageTexts {
    constructor() {
        this.texts = {
            hero: {},
            trending: {},
            campaign1: {},
            campaign2: {},
            campaign3: {},
            about: {},
            buttons: {}
        };
        this.categories = [];
        this.brands = [];
        this.campaignContent = {};
        this.heroContent = {};
        this.init();
    }

    async init() {
        // Listen for section switch event
        document.addEventListener('sectionSwitched', (e) => {
            if (e.detail === 'homepage-texts') {
                this.loadTexts();
            }
        });

        // Load texts if section is already active
        const section = document.getElementById('homepage-texts-section');
        if (section && section.classList.contains('active')) {
            this.loadTexts();
        }
    }

    async loadTexts() {
        try {
            // Load homepage texts
            const homepageResponse = await fetch('/api/homepage-texts');
            if (homepageResponse.ok) {
                const homepageData = await homepageResponse.json();
                // Merge with existing structure
                if (homepageData.hero) this.texts.hero = homepageData.hero;
                if (homepageData.trending) this.texts.trending = homepageData.trending;
                if (homepageData.campaign1) this.texts.campaign1 = homepageData.campaign1;
                if (homepageData.campaign2) this.texts.campaign2 = homepageData.campaign2;
                if (homepageData.campaign3) this.texts.campaign3 = homepageData.campaign3;
                if (homepageData.about) this.texts.about = homepageData.about;
            }

            try {
                const categoriesResponse = await fetch('/api/categories/all');
                if (categoriesResponse.ok) {
                    const allCategories = await categoriesResponse.json();
                    if (Array.isArray(allCategories)) {
                        this.categories = allCategories.filter(c => c && typeof c.slug === 'string' && typeof c.name === 'string' && c.isVisible !== false);
                    }
                }
            } catch (e) {
                this.categories = [];
            }

            // Load hero texts (fallback if not in homepage-texts)
            const heroResponse = await fetch('/api/hero-texts');
            if (heroResponse.ok) {
                const heroData = await heroResponse.json();
                if (!this.texts.hero || !this.texts.hero.title) {
                    this.texts.hero = {
                        title: heroData['hero-title'] || '',
                        subtitle: heroData['hero-subtitle'] || ''
                    };
                }
            }

            // Load button texts
            const buttonResponse = await fetch('/api/button-texts');
            if (buttonResponse.ok) {
                this.texts.buttons = await buttonResponse.json();
            }

            // Load campaign content (for buttonLink values)
            try {
                const campaignResponse = await fetch('/api/campaign-content');
                if (campaignResponse.ok) {
                    this.campaignContent = await campaignResponse.json();
                }
            } catch (e) {
                this.campaignContent = {};
            }

            // Load hero content (for buttonLink)
            try {
                const heroContentResponse = await fetch('/api/hero-content');
                if (heroContentResponse.ok) {
                    this.heroContent = await heroContentResponse.json();
                }
            } catch (e) {
                this.heroContent = {};
            }

            // Load brands
            try {
                const brandsResponse = await fetch('/api/brands');
                if (brandsResponse.ok) {
                    this.brands = await brandsResponse.json();
                }
            } catch (e) {
                this.brands = [];
            }

            this.renderEditor();
        } catch (error) {
            console.error('Error loading texts:', error);
            this.showError('Ошибка загрузки текстов');
        }
    }

    renderEditor() {
        const container = document.getElementById('homepage-texts-editor');
        if (!container) return;

        const categoryOptions = [
            '<option value="">Не выбрано</option>',
            ...((this.categories || []).map(cat => {
                const slug = String(cat.slug || '').trim();
                const name = String(cat.name || '').trim();
                if (!slug || !name) return '';
                return `<option value="${slug}">${name}</option>`;
            }).filter(Boolean))
        ].join('');

        // Build link options from admin-created categories only
        let linkCategoryOptions = '';
        (this.categories || []).forEach(cat => {
            const slug = String(cat.slug || cat.id || '').trim();
            const name = String(cat.name || '').trim();
            if (slug && name) {
                linkCategoryOptions += `<option value="category-${encodeURIComponent(slug)}.html">${name}</option>`;
            }
        });

        let linkBrandOptions = '';
        if (this.brands && this.brands.length > 0) {
            linkBrandOptions = '<optgroup label="— Бренды —">';
            this.brands.forEach(brand => {
                linkBrandOptions += `<option value="brand.html?brand=${brand.id}">${brand.name}</option>`;
            });
            linkBrandOptions += '</optgroup>';
        }

        const linkOptions = `
            <option value="shop-all.html">Все товары (Shop All)</option>
            ${linkCategoryOptions}
            ${linkBrandOptions}
            <option value="#">Без ссылки</option>
        `;

        container.innerHTML = `
            <div class="admin-card" style="margin-bottom: 24px;">
                <h2>Hero секция</h2>
                <div class="form-group">
                    <label>Заголовок (HTML разрешен)</label>
                    <textarea id="hero-title" class="form-control" rows="3" placeholder="HIGH<br>PERFORMANCE<br>JACKETS">${this.heroContent.title || this.texts.hero.title || ''}</textarea>
                    <small class="form-hint">Можно использовать &lt;br&gt; для переноса строки</small>
                </div>
                <div class="form-group">
                    <label>Подзаголовок</label>
                    <input type="text" id="hero-subtitle" class="form-control" placeholder="Cutting-edge technologies for all winter conditions" value="${this.heroContent.subtitle || this.texts.hero.subtitle || ''}">
                </div>
                <div class="form-group">
                    <label>Текст кнопки</label>
                    <input type="text" id="hero-btn" class="form-control" placeholder="SHOP NOW" value="${this.heroContent.buttonText || this.texts.buttons['hero-btn'] || ''}">
                </div>
                <div class="form-group">
                    <label>Назначение кнопки (куда ведёт)</label>
                    <select id="hero-btn-link" class="form-control">${linkOptions}</select>
                    <small class="form-hint">Выберите страницу, на которую будет вести кнопка</small>
                </div>
            </div>

            <div class="admin-card" style="margin-bottom: 24px;">
                <h2>Trending секция</h2>
                <div class="form-group">
                    <label>Заголовок секции</label>
                    <input type="text" id="trending-label" class="form-control" placeholder="TRENDING NOW" value="${(this.texts.trending && this.texts.trending.label) ? this.texts.trending.label : ''}">
                </div>
            </div>

            <div class="admin-card" style="margin-bottom: 24px;">
                <h2>Кампания 1 (FW025 ADV)</h2>
                <div class="form-group">
                    <label>Метка</label>
                    <input type="text" id="campaign1-label" class="form-control" placeholder="FALL WINTER 025" value="${(this.texts.campaign1 && this.texts.campaign1.label) ? this.texts.campaign1.label : ''}">
                </div>
                <div class="form-group">
                    <label>Заголовок (HTML разрешен)</label>
                    <textarea id="campaign1-title" class="form-control" rows="2" placeholder="FW025 ADV<br>CAMPAIGN">${(this.texts.campaign1 && this.texts.campaign1.title) ? this.texts.campaign1.title : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="campaign1-description" class="form-control" rows="2" placeholder="Sportswear, Not for playing in">${(this.texts.campaign1 && this.texts.campaign1.description) ? this.texts.campaign1.description : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Текст кнопки</label>
                    <input type="text" id="campaign1-btn" class="form-control" placeholder="DISCOVER MORE" value="${this.texts.buttons['campaign1-btn'] || ''}">
                </div>
                <div class="form-group">
                    <label>Назначение кнопки (куда ведёт)</label>
                    <select id="campaign1-btn-link" class="form-control">${linkOptions}</select>
                </div>
            </div>

            <div class="admin-card" style="margin-bottom: 24px;">
                <h2>Кампания 2 (Puffer)</h2>
                <div class="form-group">
                    <label>Метка</label>
                    <input type="text" id="campaign2-label" class="form-control" placeholder="FALL WINTER 025" value="${(this.texts.campaign2 && this.texts.campaign2.label) ? this.texts.campaign2.label : ''}">
                </div>
                <div class="form-group">
                    <label>Заголовок (HTML разрешен)</label>
                    <textarea id="campaign2-title" class="form-control" rows="2" placeholder="PUFFER">${(this.texts.campaign2 && this.texts.campaign2.title) ? this.texts.campaign2.title : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="campaign2-description" class="form-control" rows="3" placeholder="Cold-Weather Icons: soft-touch essentials in updated colourways">${(this.texts.campaign2 && this.texts.campaign2.description) ? this.texts.campaign2.description : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Текст кнопки</label>
                    <input type="text" id="campaign2-btn" class="form-control" placeholder="DISCOVER MORE" value="${this.texts.buttons['campaign2-btn'] || ''}">
                </div>
                <div class="form-group">
                    <label>Назначение кнопки (куда ведёт)</label>
                    <select id="campaign2-btn-link" class="form-control">${linkOptions}</select>
                </div>
            </div>

            <div class="admin-card" style="margin-bottom: 24px;">
                <h2>Кампания 3 (Metropolis)</h2>
                <div class="form-group">
                    <label>Метка</label>
                    <input type="text" id="campaign3-label" class="form-control" placeholder="FALL WINTER 025" value="${(this.texts.campaign3 && this.texts.campaign3.label) ? this.texts.campaign3.label : ''}">
                </div>
                <div class="form-group">
                    <label>Заголовок (HTML разрешен)</label>
                    <textarea id="campaign3-title" class="form-control" rows="2" placeholder="THE METROPOLIS<br>SERIES">${(this.texts.campaign3 && this.texts.campaign3.title) ? this.texts.campaign3.title : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="campaign3-description" class="form-control" rows="2" placeholder="Functionality and performance for the contemporary urban environment">${(this.texts.campaign3 && this.texts.campaign3.description) ? this.texts.campaign3.description : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Текст кнопки</label>
                    <input type="text" id="campaign3-btn" class="form-control" placeholder="DISCOVER MORE" value="${this.texts.buttons['campaign3-btn'] || ''}">
                </div>
                <div class="form-group">
                    <label>Назначение кнопки (куда ведёт)</label>
                    <select id="campaign3-btn-link" class="form-control">${linkOptions}</select>
                </div>
            </div>

            <div class="admin-card" style="margin-bottom: 24px;">
                <h2>About секция</h2>
                <div class="form-group">
                    <label>Заголовок</label>
                    <input type="text" id="about-title" class="form-control" placeholder="ABOUT C.P. COMPANY" value="${(this.texts.about && this.texts.about.title) ? this.texts.about.title : ''}">
                </div>
                <div class="form-group">
                    <label>Текст</label>
                    <textarea id="about-text" class="form-control" rows="6" placeholder="In 1971, Italian designer Massimo Osti...">${(this.texts.about && this.texts.about.text) ? this.texts.about.text : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Заголовок элемента 1 (JACKETS & COATS)</label>
                    <input type="text" id="about-item1-title" class="form-control" placeholder="JACKETS & COATS" value="${(this.texts.about && this.texts.about.item1Title) ? this.texts.about.item1Title : ''}">
                </div>
                <div class="form-group">
                    <label>Категория для перехода (элемент 1)</label>
                    <select id="about-item1-category" class="form-control">${categoryOptions}</select>
                </div>
                <div class="form-group">
                    <label>Заголовок элемента 2 (SWEATSHIRTS)</label>
                    <input type="text" id="about-item2-title" class="form-control" placeholder="SWEATSHIRTS" value="${(this.texts.about && this.texts.about.item2Title) ? this.texts.about.item2Title : ''}">
                </div>
                <div class="form-group">
                    <label>Категория для перехода (элемент 2)</label>
                    <select id="about-item2-category" class="form-control">${categoryOptions}</select>
                </div>
            </div>

            <div class="admin-card">
                <button class="admin-btn admin-btn-primary" onclick="adminHomepageTexts.saveTexts()" style="width: 100%; padding: 12px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Сохранить все изменения
                </button>
            </div>
        `;

        const item1Category = document.getElementById('about-item1-category');
        if (item1Category) item1Category.value = (this.texts.about && typeof this.texts.about.item1Category === 'string') ? this.texts.about.item1Category : '';

        const item2Category = document.getElementById('about-item2-category');
        if (item2Category) item2Category.value = (this.texts.about && typeof this.texts.about.item2Category === 'string') ? this.texts.about.item2Category : '';

        // Set hero button link
        const heroBtnLink = document.getElementById('hero-btn-link');
        if (heroBtnLink && this.heroContent.buttonLink) {
            heroBtnLink.value = this.heroContent.buttonLink;
            if (heroBtnLink.value !== this.heroContent.buttonLink) {
                heroBtnLink.value = this.heroContent.buttonLink.replace(/^\//, '');
            }
        }

        // Set campaign button links from campaign-content.json
        ['campaign1', 'campaign2', 'campaign3'].forEach(key => {
            const select = document.getElementById(key + '-btn-link');
            if (select && this.campaignContent[key] && this.campaignContent[key].buttonLink) {
                const link = this.campaignContent[key].buttonLink;
                select.value = link;
                if (select.value !== link) {
                    select.value = link.replace(/^\//, '');
                }
            }
        });
    }

    async saveTexts() {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                this.showError('Требуется авторизация администратора');
                return;
            }

            // Collect all form values
            const homepageTexts = {
                hero: {
                    title: document.getElementById('hero-title')?.value || '',
                    subtitle: document.getElementById('hero-subtitle')?.value || ''
                },
                trending: {
                    label: document.getElementById('trending-label')?.value || ''
                },
                campaign1: {
                    label: document.getElementById('campaign1-label')?.value || '',
                    title: document.getElementById('campaign1-title')?.value || '',
                    description: document.getElementById('campaign1-description')?.value || ''
                },
                campaign2: {
                    label: document.getElementById('campaign2-label')?.value || '',
                    title: document.getElementById('campaign2-title')?.value || '',
                    description: document.getElementById('campaign2-description')?.value || ''
                },
                campaign3: {
                    label: document.getElementById('campaign3-label')?.value || '',
                    title: document.getElementById('campaign3-title')?.value || '',
                    description: document.getElementById('campaign3-description')?.value || ''
                },
                about: {
                    title: document.getElementById('about-title')?.value || '',
                    text: document.getElementById('about-text')?.value || '',
                    item1Title: document.getElementById('about-item1-title')?.value || '',
                    item2Title: document.getElementById('about-item2-title')?.value || '',
                    item1Category: document.getElementById('about-item1-category')?.value || '',
                    item2Category: document.getElementById('about-item2-category')?.value || ''
                }
            };

            // Save homepage texts
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }

            const homepageResponse = await fetch('/api/homepage-texts', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(homepageTexts)
            });

            if (!homepageResponse.ok) {
                throw new Error('Ошибка сохранения текстов главной страницы');
            }

            // Save hero texts
            const heroTexts = {
                'hero-title': homepageTexts.hero.title,
                'hero-subtitle': homepageTexts.hero.subtitle
            };
            const heroHeaders = {
                'Content-Type': 'application/json'
            };
            if (token) {
                heroHeaders['Authorization'] = 'Bearer ' + token;
            }
            const heroResponse = await fetch('/api/hero-texts', {
                method: 'POST',
                headers: heroHeaders,
                body: JSON.stringify(heroTexts)
            });

            if (!heroResponse.ok) {
                console.warn('Ошибка сохранения hero текстов, продолжаем...');
            }

            // Save button texts
            const buttonTexts = {
                'hero-btn': document.getElementById('hero-btn')?.value || '',
                'campaign1-btn': document.getElementById('campaign1-btn')?.value || '',
                'campaign2-btn': document.getElementById('campaign2-btn')?.value || '',
                'campaign3-btn': document.getElementById('campaign3-btn')?.value || ''
            };

            // Save each button text
            for (const [id, text] of Object.entries(buttonTexts)) {
                if (text) {
                    const buttonHeaders = {
                        'Content-Type': 'application/json'
                    };
                    if (token) {
                        buttonHeaders['Authorization'] = 'Bearer ' + token;
                    }
                    await fetch(`/api/button-texts/${id}`, {
                        method: 'POST',
                        headers: buttonHeaders,
                        body: JSON.stringify({ text })
                    });
                }
            }

            // Save hero content to hero-content.json (single source of truth for hero section)
            const heroTitle = document.getElementById('hero-title')?.value || '';
            const heroSubtitle = document.getElementById('hero-subtitle')?.value || '';
            const heroBtnText = document.getElementById('hero-btn')?.value || '';
            const heroBtnLink = document.getElementById('hero-btn-link')?.value || 'shop-all.html';
            const heroContentHeaders = { 'Content-Type': 'application/json' };
            if (token) heroContentHeaders['Authorization'] = 'Bearer ' + token;
            await fetch('/api/hero-content', {
                method: 'PUT',
                headers: heroContentHeaders,
                body: JSON.stringify({ 
                    title: heroTitle, 
                    subtitle: heroSubtitle, 
                    buttonText: heroBtnText, 
                    buttonLink: heroBtnLink 
                })
            });

            // Save campaign button links via campaign-content API
            for (const key of ['campaign1', 'campaign2', 'campaign3']) {
                const linkValue = document.getElementById(key + '-btn-link')?.value || '';
                const campHeaders = { 'Content-Type': 'application/json' };
                if (token) campHeaders['Authorization'] = 'Bearer ' + token;
                await fetch(`/api/campaign-content/${key}`, {
                    method: 'POST',
                    headers: campHeaders,
                    body: JSON.stringify({ buttonLink: linkValue })
                });
            }

            this.showSuccess('Все изменения успешно сохранены!');
            
            // Reload texts to reflect changes
            setTimeout(() => {
                this.loadTexts();
                // Trigger reload on the main page if it's open
                if (window.loadHomepageTexts) {
                    window.loadHomepageTexts();
                }
            }, 1000);

        } catch (error) {
            console.error('Error saving texts:', error);
            this.showError('Ошибка сохранения: ' + error.message);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'success') {
        // Remove existing notification
        const existing = document.querySelector('.admin-text-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'admin-text-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
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

// Initialize when DOM is ready
let adminHomepageTexts;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        adminHomepageTexts = new AdminHomepageTexts();
        window.adminHomepageTexts = adminHomepageTexts;
    });
} else {
    adminHomepageTexts = new AdminHomepageTexts();
    window.adminHomepageTexts = adminHomepageTexts;
}

// Add CSS animations
if (!document.getElementById('admin-text-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-text-notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
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
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
