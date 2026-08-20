// Telegram Mini App Profile Page
class TelegramProfilePage {
    constructor() {
        this.page = null;
        this.user = null;
        this.isAdmin = false;
        this.init();
    }

    init() {
        // Создаем страницу сразу
        this.createPage();
        this.setupEventListeners();
        
        // Загружаем данные пользователя асинхронно
        this.loadUserData();
        
        // Listen for roulette wins to update discount in real-time
        window.addEventListener('tgRouletteWin', () => this.refreshDiscount());
    }

    async loadUserData() {
        // Get Telegram user data if available
        this.user = window.telegramWebApp ? window.telegramWebApp.getUserData() : null;
        console.log('Profile init: user data', this.user);
        const userId = this.user ? String(this.user.id) : null;
        
        // Check if user is admin via API (same as in telegram-admin-page.js)
        try {
            const response = await fetch('/api/admin-users', {
                headers: {
                    'X-MiniApp-User-Id': userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                }
            });
            if (response.ok) {
                const admins = await response.json();
                this.isAdmin = admins.some(admin => 
                    admin.type === 'telegram' && String(admin.id) === String(userId)
                );
                console.log('✅ Profile admin check:', { 
                    isAdmin: this.isAdmin, 
                    userId: userId,
                    userIdType: typeof userId,
                    admins: admins.map(a => ({ id: a.id, idType: typeof a.id, type: a.type }))
                });
            } else {
                // Fallback to hardcoded admin check
                this.isAdmin = String(userId) === '8222800886';
            }
        } catch (error) {
            console.error('Error checking admin status in profile:', error);
            // Fallback to hardcoded admin check
            this.isAdmin = String(userId) === '8222800886';
        }
        
        // Рендерим данные пользователя после их получения
        this.renderUserInfo();
    }

    createPage() {
        const pageHTML = `
            <div class="tg-profile-page" id="tgProfilePage" style="display: none;">
                <div class="tg-profile-scroll">
                    <div class="tg-profile-card">
                        <div class="tg-profile-avatar" id="tgProfileAvatar"></div>
                        <div class="tg-profile-user-info">
                            <div class="tg-profile-nickname" id="tgProfileNickname">Профиль</div>
                            <div class="tg-profile-username" id="tgProfileUsername"></div>
                            <div class="tg-profile-bonus-row">
                                <span>Бонусы: <span id="tgProfileBonusValue">0 ✨</span></span>
                            </div>
                            <div class="tg-profile-discount-row">
                                Персональная скидка: <span id="tgProfileDiscountValue">0%</span></span>
                            </div>
                        </div>
                    </div>

                    <div class="tg-profile-section">
                        <button class="tg-profile-item" data-action="favorites">
                            <div class="tg-profile-item-left">
                                <span class="tg-profile-item-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                </span>
                                <span class="tg-profile-item-title">Избранное</span>
                            </div>
                            <span class="tg-profile-item-chevron">›</span>
                        </button>
                        <button class="tg-profile-item" data-action="wins">
                            <div class="tg-profile-item-left">
                                <span class="tg-profile-item-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="8" r="6"></circle>
                                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"></path>
                                    </svg>
                                </span>
                                <span class="tg-profile-item-title">Мои выигрыши</span>
                            </div>
                            <span class="tg-profile-item-chevron">›</span>
                        </button>
                        <button class="tg-profile-item" data-action="roulette">
                            <div class="tg-profile-item-left">
                                <span class="tg-profile-item-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="9"></circle>
                                        <line x1="12" y1="3" x2="12" y2="21"></line>
                                        <line x1="3" y1="12" x2="21" y2="12"></line>
                                        <line x1="12" y1="12" x2="20" y2="16"></line>
                                    </svg>
                                </span>
                                <span class="tg-profile-item-title">Рулетка</span>
                            </div>
                            <span class="tg-profile-item-chevron">›</span>
                        </button>
                    </div>

                    <div class="tg-profile-section">
                        <button class="tg-profile-item" data-action="privacy">
                            <div class="tg-profile-item-left">
                                <span class="tg-profile-item-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="9" y1="13" x2="15" y2="13"></line>
                                        <line x1="9" y1="17" x2="13" y2="17"></line>
                                    </svg>
                                </span>
                                <span class="tg-profile-item-title">Политика конфиденциальности</span>
                            </div>
                            <span class="tg-profile-item-chevron">›</span>
                        </button>
                    </div>

                    ${this.isAdmin ? `
                    <div class="tg-profile-section tg-profile-admin-section">
                        <button class="tg-profile-item" data-action="admin">
                            <div class="tg-profile-item-left">
                                <span class="tg-profile-item-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect>
                                        <path d="M7 15h10M7 11h6M7 7h4"></path>
                                    </svg>
                                </span>
                                <span class="tg-profile-item-title">Админка</span>
                            </div>
                            <span class="tg-profile-item-chevron">›</span>
                        </button>
                    </div>
                    ` : ''}

                    <div class="tg-profile-version">version 9.1</div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgProfilePage');
    }

    setupEventListeners() {
        if (!this.page) return;

        this.page.addEventListener('click', (e) => {
            const item = e.target.closest('.tg-profile-item');
            if (!item) return;

            const action = item.getAttribute('data-action');
            this.handleAction(action);
        });
    }

    renderUserInfo() {
        if (!this.user) return;

        const avatarEl = document.getElementById('tgProfileAvatar');
        const nicknameEl = document.getElementById('tgProfileNickname');
        const usernameEl = document.getElementById('tgProfileUsername');

        const fullName = [this.user.first_name, this.user.last_name].filter(Boolean).join(' ');
        const username = this.user.username ? `@${this.user.username}` : '';

        if (nicknameEl) nicknameEl.textContent = fullName || 'Профиль';
        if (usernameEl) usernameEl.textContent = username;

        if (avatarEl) {
            avatarEl.innerHTML = '';
            if (this.user.photo_url) {
                const img = document.createElement('img');
                img.src = this.user.photo_url;
                img.alt = fullName || 'avatar';
                avatarEl.appendChild(img);
            } else {
                const initials = (this.user.first_name || '?')[0];
                avatarEl.textContent = initials;
            }
        }
    }

    async handleAction(action) {
        switch (action) {
            case 'favorites':
                if (window.telegramNavigation) {
                    window.telegramNavigation.navigate('#favorites');
                }
                break;
            case 'wins':
                this.showWinsPage();
                break;
            case 'roulette':
                if (window.telegramMiniAppLoader && typeof window.telegramMiniAppLoader.openRoulette === 'function') {
                    window.telegramMiniAppLoader.openRoulette();
                } else if (window.telegramRoulettePage) {
                    window.telegramRoulettePage.show();
                } else if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification('Рулетка скоро будет доступна');
                }
                break;
            case 'privacyPending':
                if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification('Скоро будет доступно');
                }
                break;
            case 'privacy':
                if (window.telegramPrivacyPage) {
                    window.telegramPrivacyPage.show();
                }
                break;
            case 'admin':
                console.log('🔐 Admin button clicked - FORCING OPEN!');
                
                // ПРОСТАЯ ЛОГИКА - получаем userId и открываем админку
                const user = window.telegramWebApp ? window.telegramWebApp.getUserData() : null;
                const userId = user ? String(user.id) : null;
                
                // ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ - НЕСКОЛЬКО ПОПЫТОК
                let initAttempts = 0;
                const maxAttempts = 3;
                
                while ((!window.telegramAdminPage || typeof window.telegramAdminPage.show !== 'function') && initAttempts < maxAttempts) {
                    initAttempts++;
                    console.log(`🔄 Initializing admin page (attempt ${initAttempts}/${maxAttempts})...`);
                    
                    // Попытка 1: через initTelegramAdminPage
                    if (typeof window.initTelegramAdminPage === 'function') {
                        try {
                            await window.initTelegramAdminPage();
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (e) {
                            console.error('Error in initTelegramAdminPage:', e);
                        }
                }
                
                    // Попытка 2: создаем напрямую
                    if ((!window.telegramAdminPage || typeof window.telegramAdminPage.show !== 'function') && 
                        typeof window.TelegramAdminPage !== 'undefined') {
                        try {
                            console.log('Creating TelegramAdminPage directly...');
                            window.telegramAdminPage = new window.TelegramAdminPage();
                            if (window.telegramAdminPage.init) {
                                await window.telegramAdminPage.init();
                            }
                            await new Promise(resolve => setTimeout(resolve, 300));
                        } catch (e) {
                            console.error('Error creating TelegramAdminPage:', e);
                        }
                    }
                    
                    // Проверяем результат
                    if (window.telegramAdminPage && typeof window.telegramAdminPage.show === 'function') {
                        console.log('✅ Admin page initialized successfully!');
                        break;
                }
                
                    // Ждем перед следующей попыткой
                    if (initAttempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    
                // Устанавливаем userId
                if (window.telegramAdminPage && userId) {
                    window.telegramAdminPage.userId = userId;
                    console.log('✅ Set userId:', userId);
                }
                    
                // ОТКРЫВАЕМ АДМИНКУ - ДАЖЕ ЕСЛИ НЕ ИНИЦИАЛИЗИРОВАНА
                if (window.telegramAdminPage && typeof window.telegramAdminPage.show === 'function') {
                    console.log('✅ Opening admin page...');
                    try {
                        // Убеждаемся, что userId установлен перед вызовом show()
                        if (window.telegramAdminPage && userId) {
                            window.telegramAdminPage.userId = userId;
                        }
                        await window.telegramAdminPage.show();
                        console.log('✅ Admin page opened!');
                    } catch (error) {
                        console.error('❌ Error opening admin:', error);
                        console.error('Error stack:', error.stack);
                        // Показываем пользователю сообщение об ошибке
                        if (window.telegramWebApp) {
                            window.telegramWebApp.showNotification('Ошибка открытия админки. Попробуйте обновить страницу.');
                        }
                        // Пытаемся создать минимальную страницу
                        try {
                            const minimalHTML = `
                                <div id="tgAdminPage" class="tg-admin-page" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#f5f5f5;display:flex;flex-direction:column;">
                                    <div style="padding:20px;background:#fff;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;">
                                        <h1 style="margin:0;">Админка</h1>
                                        <button onclick="document.getElementById('tgAdminPage').style.display='none'" style="background:#ff4444;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Закрыть</button>
                                    </div>
                                    <div style="padding:20px;flex:1;overflow:auto;">
                                        <p style="color:#ff4444;">Ошибка: ${error.message || 'Не удалось открыть админку'}</p>
                                        <p>Попробуйте обновить страницу.</p>
                                        <button onclick="location.reload()" style="background:#4CAF50;color:white;border:none;padding:12px 24px;border-radius:4px;cursor:pointer;margin-top:16px;">Обновить страницу</button>
                                    </div>
                                </div>
                            `;
                            const oldPage = document.getElementById('tgAdminPage');
                            if (oldPage) oldPage.remove();
                            document.body.insertAdjacentHTML('beforeend', minimalHTML);
                        } catch (e) {
                            console.error('❌ Cannot create error page:', e);
                        }
                    }
                } else {
                    // ПОСЛЕДНЯЯ ПОПЫТКА - создаем минимальную админку
                    console.error('❌ Cannot initialize admin page, creating minimal version...');
                    try {
                        const minimalHTML = `
                            <div id="tgAdminPage" class="tg-admin-page" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#f5f5f5;display:flex;flex-direction:column;">
                                <div style="padding:20px;background:#fff;border-bottom:1px solid #ddd;">
                                    <h1>Админка</h1>
                                    <button onclick="document.getElementById('tgAdminPage').style.display='none'">Закрыть</button>
                                </div>
                                <div style="padding:20px;flex:1;overflow:auto;">
                                    <p>Админка загружается...</p>
                                    <p>Попробуйте обновить страницу</p>
                                </div>
                            </div>
                        `;
                        document.body.insertAdjacentHTML('beforeend', minimalHTML);
                        const minimalPage = document.getElementById('tgAdminPage');
                        if (minimalPage) {
                            console.log('✅ Minimal admin page created');
                            // Пытаемся инициализировать еще раз через 1 секунду
                            setTimeout(async () => {
                                if (typeof window.initTelegramAdminPage === 'function') {
                                    await window.initTelegramAdminPage();
                                    if (window.telegramAdminPage && typeof window.telegramAdminPage.show === 'function') {
                            await window.telegramAdminPage.show();
                        }
                                }
                            }, 1000);
                        }
                    } catch (e) {
                        console.error('❌ Cannot create even minimal admin page:', e);
                    }
                }
                break;
        }
    }

    getPersonalDiscount() {
        try {
            const raw = localStorage.getItem('tg_personal_discount');
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() > data.expiresAt) {
                localStorage.removeItem('tg_personal_discount');
                return null;
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    refreshDiscount() {
        const discountEl = document.getElementById('tgProfileDiscountValue');
        if (!discountEl) return;
        const discount = this.getPersonalDiscount();
        if (discount && discount.value > 0) {
            const hoursLeft = Math.ceil((discount.expiresAt - Date.now()) / 3600000);
            discountEl.textContent = `${discount.value}% (ещё ${hoursLeft}ч)`;
            discountEl.style.color = '#f59e0b';
            discountEl.style.fontWeight = '600';
        } else {
            discountEl.textContent = '0%';
            discountEl.style.color = '';
            discountEl.style.fontWeight = '';
        }
    }

    showWinsPage() {
        // Remove existing wins page if any
        const existing = document.getElementById('tgWinsPage');
        if (existing) existing.remove();

        const wins = (() => {
            try { return JSON.parse(localStorage.getItem('tg_roulette_wins') || '[]'); }
            catch (e) { return []; }
        })();

        const rarityLabels = { common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' };

        const formatDate = (ts) => {
            const d = new Date(ts);
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const getEmptyMedia = () => {
            try {
                const saved = localStorage.getItem('tg_miniapp_design_settings');
                const d = saved ? JSON.parse(saved) : {};
                const logos = Array.isArray(d.logoImages) ? d.logoImages : [];
                const first = logos[0];
                const url = first && typeof first === 'object' ? first.url : (typeof first === 'string' ? first : '');
                const type = first && typeof first === 'object' ? (first.type || '') : '';
                if (url) return { url, type };
                if (typeof d.loadingScreenImage === 'string' && d.loadingScreenImage) {
                    return { url: d.loadingScreenImage, type: '' };
                }
            } catch (e) {}
            return null;
        };

        const emptyMedia = getEmptyMedia();
        const isVideoMedia = (m) => {
            if (!m || !m.url) return false;
            if (typeof m.type === 'string' && m.type.toLowerCase() === 'video') return true;
            return /\.(mp4|webm|ogg|mov)$/i.test(m.url) || String(m.url).startsWith('data:video/');
        };

        const emptyMediaHtml = emptyMedia && emptyMedia.url
            ? (isVideoMedia(emptyMedia)
                ? `<video class="tg-wins-empty-media" src="${emptyMedia.url}" muted loop playsinline webkit-playsinline x-webkit-airplay="allow" autoplay preload="auto"></video>`
                : `<img class="tg-wins-empty-media" src="${emptyMedia.url}" alt="" />`)
            : '';

        const winsHTML = wins.length === 0 ? `
            <div class="tg-wins-empty">
                ${emptyMediaHtml}
                <p class="tg-wins-empty-text">Пока нет выигрышей</p>
                <p class="tg-wins-empty-sub">Попробуй свою удачу!</p>
                <button class="tg-wins-spin-btn" id="tgWinsSpinBtn">
                    <span class="tg-wins-spin-btn-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="3" x2="12" y2="21"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="12" x2="20" y2="16"></line></svg>
                        Крутить рулетку
                    </span>
                </button>
            </div>
        ` : wins.map(w => {
            const expired = Date.now() > w.expiresAt;
            const hoursLeft = Math.ceil((w.expiresAt - Date.now()) / 3600000);
            return `
            <div class="tg-win-item rarity-${w.rarity || 'common'}">
                <div class="tg-win-item-img-wrap">
                    ${w.image ? `<img src="${w.image}" alt="${w.name}" class="tg-win-item-img">` : `<div class="tg-win-item-placeholder">${(w.name||'?')[0]}</div>`}
                </div>
                <div class="tg-win-item-info">
                    <div class="tg-win-item-name">${w.name}</div>
                    <div class="tg-win-item-prize">${w.prize}</div>
                    <div class="tg-win-item-meta">
                        <span class="tg-win-item-rarity">${rarityLabels[w.rarity] || w.rarity || 'Обычный'}</span>
                        <span class="tg-win-item-date">${formatDate(w.wonAt)}</span>
                    </div>
                    ${w.discount > 0 ? `<div class="tg-win-item-discount ${expired ? 'expired' : ''}">${expired ? 'Скидка истекла' : `Скидка ${w.discount}% — ещё ${hoursLeft}ч`}</div>` : ''}
                </div>
            </div>`;
        }).join('');

        const pageHTML = `
            <div class="tg-wins-page" id="tgWinsPage">
                <div class="tg-wins-header">
                    <button class="tg-wins-back-btn" id="tgWinsBackBtn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <h1 class="tg-wins-title">Мои выигрыши</h1>
                    <div class="tg-wins-tabs">
                        <button class="tg-wins-tab-btn" type="button" data-nav="#catalog">Каталог</button>
                        <button class="tg-wins-tab-btn" type="button" data-nav="#favorites">Избранное</button>
                    </div>
                </div>
                <div class="tg-wins-list">${winsHTML}</div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', pageHTML);
        const page = document.getElementById('tgWinsPage');

        const detachBottomNavListener = () => {
            if (this._winsBottomNavCaptureListener) {
                document.removeEventListener('click', this._winsBottomNavCaptureListener, true);
                this._winsBottomNavCaptureListener = null;
            }
        };

        // When bottom nav is used, close overlay so navigation becomes visible.
        // Use capture to run before telegram-navigation handlers.
        detachBottomNavListener();
        this._winsBottomNavCaptureListener = (e) => {
            const navItem = e.target && e.target.closest ? e.target.closest('.tg-bottom-nav .tg-nav-item') : null;
            if (!navItem) return;
            if (page && page.parentNode) page.remove();
            detachBottomNavListener();
        };
        document.addEventListener('click', this._winsBottomNavCaptureListener, true);

        document.getElementById('tgWinsBackBtn').addEventListener('click', () => {
            page.remove();
            detachBottomNavListener();
            if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
                window.telegramWebApp.hideBackButton();
                window.telegramWebApp.showBackButton();
            }
        });

        const spinBtn = document.getElementById('tgWinsSpinBtn');
        if (spinBtn) {
            spinBtn.addEventListener('click', () => {
                page.remove();
                detachBottomNavListener();
                if (window.telegramMiniAppLoader && typeof window.telegramMiniAppLoader.openRoulette === 'function') {
                    window.telegramMiniAppLoader.openRoulette();
                } else if (window.telegramRoulettePage) {
                    window.telegramRoulettePage.show();
                }
            });
        }

        page.querySelectorAll('.tg-wins-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const hash = btn.getAttribute('data-nav');
                page.remove();
                detachBottomNavListener();
                if (window.telegramNavigation && hash) {
                    window.telegramNavigation.navigate(hash);
                }
            });
        });

        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => {
                page.remove();
                detachBottomNavListener();
                window.telegramWebApp.hideBackButton();
                window.telegramWebApp.showBackButton();
            });
            window.telegramWebApp.showBackButton();
        }
    }

    async show() {
        if (!this.page) return;
        
        // Обновляем статус админа при каждом открытии профиля
        const user = window.telegramWebApp ? window.telegramWebApp.getUserData() : null;
        const userId = user ? String(user.id) : null;
        
        try {
            const response = await fetch('/api/admin-users', {
                headers: {
                    'X-MiniApp-User-Id': userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                }
            });
            if (response.ok) {
                const admins = await response.json();
                this.isAdmin = admins.some(admin => 
                    admin.type === 'telegram' && String(admin.id) === String(userId)
                );
                console.log('✅ Profile show() admin check:', { 
                    isAdmin: this.isAdmin, 
                    userId: userId,
                    admins: admins.map(a => ({ id: a.id, type: a.type }))
                });
            } else {
                console.log('⚠️ Profile show() API failed, status:', response.status);
                this.isAdmin = String(userId) === '8222800886';
            }
        } catch (error) {
            console.error('❌ Error checking admin status in show():', error);
            this.isAdmin = String(userId) === '8222800886';
        }
        
        // Обновляем кнопку админки в зависимости от статуса
        const adminSection = this.page.querySelector('.tg-profile-admin-section');
        if (this.isAdmin && !adminSection) {
            // Добавляем секцию админки если её нет
            const sections = this.page.querySelectorAll('.tg-profile-section');
            const lastSection = sections[sections.length - 1];
            if (lastSection) {
                const adminHTML = `
                    <div class="tg-profile-section tg-profile-admin-section">
                        <button class="tg-profile-item" data-action="admin">
                            <div class="tg-profile-item-left">
                                <span class="tg-profile-item-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect>
                                        <path d="M7 15h10M7 11h6M7 7h4"></path>
                                    </svg>
                                </span>
                                <span class="tg-profile-item-title">Админка</span>
                            </div>
                            <span class="tg-profile-item-chevron">›</span>
                        </button>
                    </div>
                `;
                lastSection.insertAdjacentHTML('afterend', adminHTML);
            }
        } else if (!this.isAdmin && adminSection) {
            // Удаляем секцию админки если пользователь не админ
            adminSection.remove();
        }
        
        this.page.style.display = 'block';
        this.renderUserInfo();
        this.refreshDiscount();
        
        // Apply avatar to menu bar when profile is shown
        if (window.telegramWebApp) {
            window.telegramWebApp.applyUserAvatarToProfileNav();
        }

        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => {
                this.close();
            });
            window.telegramWebApp.showBackButton();
        }
    }

    close() {
        if (!this.page) return;
        this.page.style.display = 'none';

        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            window.telegramWebApp.setupBackButton();
        }
    }
}

// Initialize when DOM is ready
let telegramProfilePage = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        telegramProfilePage = new TelegramProfilePage();
        window.telegramProfilePage = telegramProfilePage;
    });
} else {
    telegramProfilePage = new TelegramProfilePage();
    window.telegramProfilePage = telegramProfilePage;
}
