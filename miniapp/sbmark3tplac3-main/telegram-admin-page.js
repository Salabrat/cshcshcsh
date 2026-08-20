// Telegram Mini App Admin Page - Add Product
class TelegramAdminPage {
    constructor() {
        this.page = null;
        this.isAdmin = false;
        this.selectedSizes = new Set();
        this.currentMode = 'product'; // 'product', 'category', 'brand'
        this.userId = null;
        this.catalogCoverState = [];
        this._catalogCoverIdCounter = 0;
        this.rouletteBannerState = null;
        // init() вызывается асинхронно из initTelegramAdminPage после создания экземпляра
        // Не вызываем здесь, чтобы избежать проблем с async/await в конструкторе
    }

    async init() {
        try {
            console.log('🔐 TelegramAdminPage init() starting...');
            
            // Инициализируем базовые свойства
            this.isAdmin = false;
            this.userId = null;
            this.page = null;
            this.selectedSizes = new Set();
            this.currentMode = 'product';
            
            // Пытаемся получить данные пользователя
        try {
            const user = window.telegramWebApp ? window.telegramWebApp.getUserData() : null;
            this.userId = user ? String(user.id) : null;
            
            console.log('🔐 TelegramAdminPage init()', { 
                userId: this.userId, 
                hasTelegramWebApp: !!window.telegramWebApp,
                user: user ? { id: user.id, first_name: user.first_name } : null
            });
            } catch (error) {
                console.error('❌ Error getting user data:', error);
                this.userId = null;
            }
            
            // Если userId не определен, пытаемся получить его позже
            if (!this.userId && window.telegramWebApp) {
                console.log('⚠️ userId not available in init(), will check later');
            }
            
            // Check if user is admin via API (только если userId есть)
            if (this.userId) {
            try {
                const response = await fetch('/api/admin-users', {
                    headers: {
                            'X-MiniApp-User-Id': this.userId,
                        'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                    }
                });
                if (response.ok) {
                    const admins = await response.json();
                    console.log('🔍 Checking admin status:', {
                        userId: this.userId,
                        userIdType: typeof this.userId,
                        admins: admins.map(a => ({
                            id: a.id,
                            idType: typeof a.id,
                            type: a.type,
                            idString: String(a.id),
                            userIdString: String(this.userId),
                            match: String(a.id) === String(this.userId)
                        }))
                    });
                    this.isAdmin = admins.some(admin => {
                        const adminIdStr = String(admin.id);
                        const userIdStr = String(this.userId);
                        const isMatch = admin.type === 'telegram' && adminIdStr === userIdStr;
                        if (isMatch) {
                            console.log('✅ Admin match found:', { adminId: admin.id, userId: this.userId });
                        }
                        return isMatch;
                    });
                    console.log('✅ Admin check via API result:', { 
                        isAdmin: this.isAdmin, 
                        userId: this.userId
                    });
                } else {
                    // Fallback to hardcoded admin check
                    this.isAdmin = String(this.userId) === '8222800886';
                    console.log('⚠️ API failed, using fallback:', { isAdmin: this.isAdmin });
                }
            } catch (error) {
                console.error('❌ Error checking admin status:', error);
                // Fallback to hardcoded admin check
                this.isAdmin = String(this.userId) === '8222800886';
                console.log('⚠️ Using fallback after error:', { isAdmin: this.isAdmin });
                }
            } else {
                // Если userId нет, проверяем fallback для тестирования
                this.isAdmin = false;
                console.log('⚠️ No userId, admin status set to false');
            }
            
            // НЕ создаем страницу сразу - она будет создана при первом вызове show()
            // Это позволяет объекту существовать всегда, даже если пользователь не админ
            console.log('✅ TelegramAdminPage object initialized successfully', { 
                isAdmin: this.isAdmin, 
                userId: this.userId,
                page: null,
                hasShowMethod: typeof this.show === 'function',
                hasCreatePageMethod: typeof this.createPage === 'function'
            });
        } catch (error) {
            console.error('❌ Fatal error in TelegramAdminPage.init():', error);
            console.error('Error stack:', error.stack);
            // Устанавливаем значения по умолчанию, чтобы объект был валидным
            this.isAdmin = false;
            this.userId = null;
            this.page = null;
            this.selectedSizes = new Set();
            this.currentMode = 'product';
            console.log('⚠️ TelegramAdminPage initialized with default values due to error');
        }
    }

    createPage() {
        console.log('📄 Creating admin page HTML...');
        const pageHTML = `
            <div class="tg-admin-page" id="tgAdminPage" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; background: #f5f5f5;">
                <div class="tg-admin-page-header">
                    <button class="tg-admin-page-back" id="tgAdminBackBtn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <h1 class="tg-admin-page-title" id="tgAdminPageTitle">Админка</h1>
                    <button class="tg-admin-page-site-btn" id="tgAdminSiteBtn" title="Перейти на сайт">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                </div>
                <div class="tg-admin-page-content">
                    <!-- Меню выбора режима -->
                    <div class="tg-admin-menu" id="tgAdminMenu">
                        <button type="button" class="tg-admin-menu-item active" data-mode="product">
                            <span>Товар</span>
                        </button>
                        <button type="button" class="tg-admin-menu-item" data-mode="category">
                            <span>Категория</span>
                        </button>
                        <button type="button" class="tg-admin-menu-item" data-mode="brand">
                            <span>Бренд</span>
                        </button>
                        <button type="button" class="tg-admin-menu-item" data-mode="admin">
                            <span>Админы</span>
                        </button>
                        <button type="button" class="tg-admin-menu-item" data-mode="design">
                            <span>Дизайн</span>
                        </button>
                        <button type="button" class="tg-admin-menu-item" data-mode="roulette">
                            <span>Рулетка</span>
                        </button>
                        <button type="button" class="tg-admin-menu-item" data-mode="checkout">
                            <span>Оформление</span>
                        </button>
                    </div>
                    <div class="tg-admin-status" id="tgAdminStatus"></div>
                    
                    <!-- Форма добавления товара -->
                    <form class="tg-admin-form" id="tgAdminProductForm" data-form="product">
                        <div class="tg-admin-field">
                            <label for="tgAdminCategory">Категория</label>
                            <select id="tgAdminCategory" required>
                                <option value="">Загрузка категорий...</option>
                            </select>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgAdminBrand">Бренд</label>
                            <select id="tgAdminBrand" required>
                                <option value="">Загрузка брендов...</option>
                            </select>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgAdminName">Название</label>
                            <input type="text" id="tgAdminName" placeholder="Название товара" required />
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgAdminDescription">Описание</label>
                            <textarea id="tgAdminDescription" rows="3" placeholder="Краткое описание" required></textarea>
                        </div>
                        <div class="tg-admin-field-group">
                            <div class="tg-admin-field">
                                <label for="tgAdminPrice">Цена (₽)</label>
                                <input type="number" id="tgAdminPrice" placeholder="145600" required />
                            </div>
                            <div class="tg-admin-field">
                                <label class="tg-admin-checkbox">
                                    <input type="checkbox" id="tgAdminTrending" />
                                    <span>Trending now</span>
                                </label>
                            </div>
                        </div>
                        <div class="tg-admin-field-group">
                            <div class="tg-admin-field">
                                <label for="tgAdminOldPrice">Старая цена (₽) - для скидки</label>
                                <input type="number" id="tgAdminOldPrice" placeholder="Оставьте пустым, если нет скидки" />
                            </div>
                            <div class="tg-admin-field">
                                <label for="tgAdminNewPrice">Новая цена (₽) - со скидкой</label>
                                <input type="number" id="tgAdminNewPrice" placeholder="Оставьте пустым, если нет скидки" />
                            </div>
                        </div>
                        <div class="tg-admin-field">
                            <label class="tg-admin-checkbox">
                                <input type="checkbox" id="tgAdminPreorder" />
                                <span>Предзаказ (товар доступен для предзаказа)</span>
                            </label>
                        </div>
                        <div class="tg-admin-field">
                            <label>Размеры</label>
                            <div class="tg-admin-sizes" id="tgAdminSizes">
                                ${['XS','S','M','L','XL','XXL'].map(size => `
                                    <button type="button" class="tg-admin-size-btn" data-size="${size}">${size}</button>
                                `).join('')}
                            </div>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgAdminImages">Фото товара</label>
                            <input type="file" id="tgAdminImages" accept="image/*" multiple />
                            <div class="tg-admin-images-preview" id="tgAdminImagesPreview"></div>
                        </div>
                        <button type="button" class="tg-admin-submit-btn" id="tgAdminProductSubmitBtn">Добавить товар</button>
                    </form>
                    
                    <!-- Форма добавления категории -->
                    <form class="tg-admin-form" id="tgAdminCategoryForm" data-form="category" style="display: none;">
                        <div class="tg-admin-field">
                            <label for="tgCategoryName">Название категории</label>
                            <input type="text" id="tgCategoryName" placeholder="Например: Куртки" required />
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgCategorySlug">Slug (без пробелов)</label>
                            <input type="text" id="tgCategorySlug" placeholder="куртки или jackets" required pattern="[a-zа-яё0-9-_]+" />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Буквы (латиница и кириллица), цифры, дефисы и подчёркивания</small>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgCategoryDescription">Описание</label>
                            <textarea id="tgCategoryDescription" rows="2" placeholder="Краткое описание категории"></textarea>
                        </div>
                        <div class="tg-admin-field">
                            <label class="tg-admin-checkbox">
                                <input type="checkbox" id="tgCategoryIsVisible" checked />
                                <span>Видимая категория</span>
                            </label>
                        </div>
                        <button type="button" class="tg-admin-submit-btn" id="tgAdminCategorySubmitBtn">Добавить категорию</button>
                    </form>
                    
                    <!-- Форма добавления бренда -->
                    <form class="tg-admin-form" id="tgAdminBrandForm" data-form="brand" style="display: none;">
                        <div class="tg-admin-field">
                            <label for="tgBrandName">Название бренда</label>
                            <input type="text" id="tgBrandName" placeholder="Например: C.P. Company" required />
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgBrandDescription">Описание</label>
                            <textarea id="tgBrandDescription" rows="2" placeholder="Краткое описание бренда"></textarea>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgBrandLogo">Логотип бренда</label>
                            <input type="file" id="tgBrandLogo" accept="image/*" />
                            <div class="tg-admin-images-preview" id="tgBrandLogoPreview"></div>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgBrandCover">Обложка для каталога - можно загрузить несколько</label>
                            <input type="file" id="tgBrandCover" accept="image/*" multiple />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Рекомендуемый размер: 1080x1080px или 1920x1080px. Можно загрузить несколько обложек для листания</small>
                            <div class="tg-admin-images-preview" id="tgBrandCoverPreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgBrandCoverRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить все обложки</button>
                        </div>
                        <button type="button" class="tg-admin-submit-btn" id="tgAdminBrandSubmitBtn">Добавить бренд</button>
                    </form>
                    
                    <!-- Форма управления админами -->
                    <div class="tg-admin-form" id="tgAdminAdminForm" data-form="admin" style="display: none;">
                        <div class="tg-admin-field">
                            <label for="tgAdminType">Тип админа</label>
                            <select id="tgAdminType" required>
                                <option value="">Выберите тип</option>
                                <option value="telegram">Telegram (по ID)</option>
                                <option value="website">Сайт (по username)</option>
                            </select>
                        </div>
                        <div class="tg-admin-field" id="tgAdminIdField" style="display: none;">
                            <label for="tgAdminId">Telegram ID</label>
                            <input type="text" id="tgAdminId" placeholder="Например: 1234567890" />
                        </div>
                        <div class="tg-admin-field" id="tgAdminUsernameField" style="display: none;">
                            <label for="tgAdminUsername">Username</label>
                            <input type="text" id="tgAdminUsername" placeholder="Например: admin" />
                        </div>
                        <button type="button" class="tg-admin-submit-btn" id="tgAdminAdminSubmitBtn">Добавить админа</button>
                        
                        <div class="tg-admin-admins-list" id="tgAdminAdminsList" style="margin-top: 24px;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Список админов</h3>
                            <div id="tgAdminAdminsListContent">Загрузка...</div>
                        </div>
                    </div>
                    
                    <!-- Форма настройки дизайна -->
                    <form class="tg-admin-form" id="tgAdminDesignForm" data-form="design" style="display: none;">
                        <div class="tg-admin-field">
                            <label for="tgLogoImage">Фото/Видео логотипа (1920x1080) - можно загрузить несколько</label>
                            <input type="file" id="tgLogoImage" accept="image/*,video/*" multiple />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Рекомендуемый размер: 1920x1080px. Видео: до 5МБ, до 15 секунд. Можно загрузить несколько фото/видео для листания</small>
                            <div class="tg-admin-images-preview" id="tgLogoImagePreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgLogoImageRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить все фото/видео</button>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgLoadingScreenImage">Фото/Видео для загрузочного экрана</label>
                            <input type="file" id="tgLoadingScreenImage" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime" />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Логотип или видео для экрана загрузки. Изображение: 200x200px, Видео: ~1920x1080px (до 50 МБ)</small>
                            <div class="tg-admin-images-preview" id="tgLoadingScreenImagePreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgLoadingScreenImageRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить фото/видео</button>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgRouletteBannerImage">Обложка для кнопки рулетки</label>
                            <input type="file" id="tgRouletteBannerImage" accept="image/*,video/*" />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Фото или видео появится внутри кнопки рулетки. Рекомендуемый размер: 1280x720px, видео до 25&nbsp;МБ (до 15 секунд).</small>
                            <div class="tg-admin-images-preview" id="tgRouletteBannerImagePreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgRouletteBannerImageRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить обложку</button>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgBackgroundImage">Фон страницы</label>
                            <input type="file" id="tgBackgroundImage" accept="image/*" />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Фон будет растянут на весь экран (cover). Рекомендуемый размер: 1080x1920px или больше</small>
                            <div class="tg-admin-images-preview" id="tgBackgroundImagePreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgBackgroundImageRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить фон</button>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgRouletteCoverImage">Обложка страницы рулетки (1080x1920)</label>
                            <input type="file" id="tgRouletteCoverImage" accept="image/*" />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Обложка будет установлена как задний фон страницы рулетки (cover). Рекомендуемый размер: 1080x1920px</small>
                            <div class="tg-admin-images-preview" id="tgRouletteCoverImagePreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgRouletteCoverImageRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить обложку</button>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgCatalogCover">Обложка каталога (1080x1080) - можно загрузить несколько</label>
                            <input type="file" id="tgCatalogCover" accept="image/*,video/*" multiple />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Рекомендуемый размер: 1080x1080px или 1920x1080px. Видео: до 5МБ, до 15 секунд. Можно загрузить несколько обложек для листания</small>
                            <div class="tg-admin-images-preview" id="tgCatalogCoverPreview"></div>
                            <button type="button" class="tg-admin-remove-btn" id="tgCatalogCoverRemoveBtn" style="display: none; margin-top: 8px; background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить все обложки</button>
                        </div>
                        <button type="button" class="tg-admin-submit-btn" id="tgAdminDesignSubmitBtn">Сохранить дизайн</button>
                    </form>

                    <!-- Форма настройки рулетки -->
                    <form class="tg-admin-form" id="tgAdminRouletteForm" data-form="roulette" style="display: none;">
                        <div class="tg-admin-field">
                            <label class="tg-admin-checkbox">
                                <input type="checkbox" id="tgRouletteEnabled" />
                                <span>Рулетка включена</span>
                            </label>
                        </div>
                        <div class="tg-admin-field">
                            <label class="tg-admin-checkbox">
                                <input type="checkbox" id="tgRouletteUnlimitedSpins" />
                                <span>Бесконечные спины (без кулдауна)</span>
                            </label>
                        </div>
                        <div class="tg-admin-field-group">
                            <div class="tg-admin-field">
                                <label for="tgRouletteSpinCooldown">Кулдаун спина (часы)</label>
                                <input type="number" id="tgRouletteSpinCooldown" value="24" min="1" max="168" />
                            </div>
                            <div class="tg-admin-field">
                                <label for="tgRouletteCouponDurationAdmin">Длительность купона (часы)</label>
                                <input type="number" id="tgRouletteCouponDurationAdmin" value="24" min="1" max="168" />
                            </div>
                        </div>

                        <div class="tg-admin-field">
                            <label>Слоты рулетки (<span id="tgRouletteSlotCount">0</span> / 100)</label>
                            <button type="button" class="tg-admin-submit-btn" id="tgRouletteAddSlotBtn" style="margin-bottom: 12px; background: #28a745;">+ Добавить слот</button>
                            <div id="tgRouletteSlotsList"></div>
                        </div>

                        <button type="button" class="tg-admin-submit-btn" id="tgAdminRouletteSubmitBtn">Сохранить настройки рулетки</button>
                    </form>

                    <!-- Форма настройки оформления заказа -->
                    <form class="tg-admin-form" id="tgAdminCheckoutForm" data-form="checkout" style="display: none;">
                        <div class="tg-admin-field">
                            <label for="tgCheckoutPickupAddress">Адрес самовывоза</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="tgCheckoutPickupAddress" placeholder="Например: г. Москва, ул. Примерная, д. 1, офис 101" readonly style="flex: 1; background: #f5f5f5;" />
                                <button type="button" id="tgEditAddressBtn" style="padding: 8px 16px; background: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer;">Изменить</button>
                            </div>
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Этот адрес будет показан на странице оформления заказа</small>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgCheckoutTelegramLink">Ссылка Telegram (обязательно)</label>
                            <input type="text" id="tgCheckoutTelegramLink" placeholder="pravitelstvo_russian" required />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Username без @. Например: pravitelstvo_russian</small>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgCheckoutMaxLink">Ссылка MAX (опционально)</label>
                            <input type="text" id="tgCheckoutMaxLink" placeholder="https://max.com/..." />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Полная ссылка на диалог в MAX</small>
                        </div>
                        <div class="tg-admin-field">
                            <label for="tgCheckoutVkLink">Ссылка ВК (опционально)</label>
                            <input type="text" id="tgCheckoutVkLink" placeholder="https://vk.me/..." />
                            <small style="color: #999; font-size: 11px; margin-top: 4px; display: block;">Полная ссылка на диалог в ВКонтакте</small>
                        </div>
                        <button type="button" class="tg-admin-submit-btn" id="tgAdminCheckoutSubmitBtn">Сохранить настройки оформления</button>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgAdminPage');
        
        if (!this.page) {
            console.error('Failed to find tgAdminPage element after creation');
            return;
        }
        
        // Загружаем категории и бренды после создания страницы
        this.loadCategories();
        this.loadBrands();
        
        // Загружаем настройки дизайна
        this.loadDesignSettings();
        
        // Загружаем настройки оформления
        this.loadCheckoutSettings();
    }
    
    // Вспомогательная функция для fetch с таймаутом
    async fetchWithTimeout(url, options = {}, timeout = 10000) {
        // Проверяем поддержку AbortController
        if (typeof AbortController === 'undefined') {
            console.warn('⚠️ AbortController not supported, using regular fetch');
            return fetch(url, options);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            try {
                controller.abort();
            } catch (e) {
                console.warn('Error aborting request:', e);
            }
        }, timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                throw new Error('Запрос превысил время ожидания');
            }
            throw error;
        }
    }

    async loadBrands() {
        const select = document.getElementById('tgAdminBrand');
        if (!select) return;
        
        try {
            // Показываем индикатор загрузки
            select.innerHTML = '<option value="">Загрузка брендов...</option>';
            select.disabled = true;
            
            const response = await this.fetchWithTimeout('/api/brands', {}, 10000);
            if (!response.ok) {
                throw new Error('Failed to fetch brands');
            }
            
            const brands = await response.json();
            
            // Очищаем select
            select.innerHTML = '';
            
            // Добавляем опцию по умолчанию
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Выберите бренд';
            select.appendChild(defaultOption);
            
            // Добавляем все активные бренды
            brands.forEach(brand => {
                if (brand.isActive) {
                    const option = document.createElement('option');
                    option.value = brand.id;
                    option.setAttribute('data-brand-name', brand.name);
                    option.textContent = brand.name;
                    select.appendChild(option);
                }
            });
            
            if (brands.filter(b => b.isActive).length === 0) {
                const noBrandsOption = document.createElement('option');
                noBrandsOption.value = '';
                noBrandsOption.textContent = 'Нет брендов. Создайте бренд на сайте';
                select.appendChild(noBrandsOption);
                select.disabled = true;
            } else {
                select.disabled = false;
            }
        } catch (error) {
            console.error('Error loading brands:', error);
            if (select) {
                select.innerHTML = '<option value="">Ошибка загрузки брендов</option>';
                select.disabled = true;
            }
        }
    }
    
    async loadCategories() {
        const select = document.getElementById('tgAdminCategory');
        if (!select) return;
        
        try {
            // Показываем индикатор загрузки
            select.innerHTML = '<option value="">Загрузка категорий...</option>';
            select.disabled = true;
            
            // Загружаем все категории (как на главной) для добавления товаров
            const response = await this.fetchWithTimeout('/api/categories/all', {}, 10000);
            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }
            
            let categories = await response.json();
            if (!Array.isArray(categories)) categories = [];
            // Только видимые категории (как на главной)
            categories = categories.filter(c => c.isVisible !== false);
            
            select.innerHTML = '';
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Выберите категорию';
            select.appendChild(defaultOption);
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.slug || category.id;
                option.textContent = category.name || category.slug || category.id;
                select.appendChild(option);
            });
            
            if (categories.length === 0) {
                const noCategoriesOption = document.createElement('option');
                noCategoriesOption.value = '';
                noCategoriesOption.textContent = 'Нет категорий. Создайте категорию на сайте';
                select.appendChild(noCategoriesOption);
                select.disabled = true;
            } else {
                select.disabled = false;
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            if (select) {
                select.innerHTML = '<option value="">Ошибка загрузки категорий</option>';
                select.disabled = true;
            }
        }
    }

    setupEventListeners() {
        if (!this.page) return;
        const backBtn = document.getElementById('tgAdminBackBtn');
        const siteBtn = document.getElementById('tgAdminSiteBtn');
        const productSubmitBtn = document.getElementById('tgAdminProductSubmitBtn');
        const categorySubmitBtn = document.getElementById('tgAdminCategorySubmitBtn');
        const brandSubmitBtn = document.getElementById('tgAdminBrandSubmitBtn');
        const adminSubmitBtn = document.getElementById('tgAdminAdminSubmitBtn');
        const adminTypeSelect = document.getElementById('tgAdminType');
        const sizesContainer = document.getElementById('tgAdminSizes');
        const imagesInput = document.getElementById('tgAdminImages');
        const brandLogoInput = document.getElementById('tgBrandLogo');
        const brandCoverInput = document.getElementById('tgBrandCover');
        const logoImageInput = document.getElementById('tgLogoImage');
        const loadingScreenImageInput = document.getElementById('tgLoadingScreenImage');
        const backgroundImageInput = document.getElementById('tgBackgroundImage');
        const rouletteCoverInput = document.getElementById('tgRouletteCoverImage');
        const rouletteBannerInput = document.getElementById('tgRouletteBannerImage');
        const catalogCoverInput = document.getElementById('tgCatalogCover');
        const designSubmitBtn = document.getElementById('tgAdminDesignSubmitBtn');
        const logoImageRemoveBtn = document.getElementById('tgLogoImageRemoveBtn');
        const loadingScreenImageRemoveBtn = document.getElementById('tgLoadingScreenImageRemoveBtn');
        const backgroundImageRemoveBtn = document.getElementById('tgBackgroundImageRemoveBtn');
        const rouletteCoverRemoveBtn = document.getElementById('tgRouletteCoverImageRemoveBtn');
        const catalogCoverRemoveBtn = document.getElementById('tgCatalogCoverRemoveBtn');
        const rouletteBannerRemoveBtn = document.getElementById('tgRouletteBannerImageRemoveBtn');
        const brandCoverRemoveBtn = document.getElementById('tgBrandCoverRemoveBtn');
        const menuItems = this.page.querySelectorAll('.tg-admin-menu-item');

        if (backBtn) backBtn.addEventListener('click', () => this.close());
        if (siteBtn) siteBtn.addEventListener('click', () => this.openSite());
        if (productSubmitBtn) productSubmitBtn.addEventListener('click', () => this.handleProductSubmit());
        if (categorySubmitBtn) categorySubmitBtn.addEventListener('click', () => this.handleCategorySubmit());
        if (brandSubmitBtn) brandSubmitBtn.addEventListener('click', () => this.handleBrandSubmit());
        if (adminSubmitBtn) adminSubmitBtn.addEventListener('click', () => this.handleAdminSubmit());
        if (designSubmitBtn) designSubmitBtn.addEventListener('click', () => this.handleDesignSubmit());
        
        // Roulette event listeners
        const rouletteSubmitBtn = document.getElementById('tgAdminRouletteSubmitBtn');
        const rouletteAddSlotBtn = document.getElementById('tgRouletteAddSlotBtn');
        if (rouletteSubmitBtn) rouletteSubmitBtn.addEventListener('click', () => this.handleRouletteSubmit());
        if (rouletteAddSlotBtn) rouletteAddSlotBtn.addEventListener('click', () => this.addRouletteSlot());
        
        // Checkout event listeners
        const checkoutSubmitBtn = document.getElementById('tgAdminCheckoutSubmitBtn');
        if (checkoutSubmitBtn) checkoutSubmitBtn.addEventListener('click', () => this.handleCheckoutSubmit());
        
        // Edit address button - use prompt
        const editAddressBtn = document.getElementById('tgEditAddressBtn');
        if (editAddressBtn) {
            editAddressBtn.addEventListener('click', () => {
                const currentAddress = document.getElementById('tgCheckoutPickupAddress').value;
                const newAddress = prompt('Введите адрес самовывоза:', currentAddress);
                if (newAddress !== null) {
                    document.getElementById('tgCheckoutPickupAddress').value = newAddress;
                }
            });
        }
        
        if (logoImageRemoveBtn) logoImageRemoveBtn.addEventListener('click', () => this.removeLogoImage());
        if (loadingScreenImageRemoveBtn) loadingScreenImageRemoveBtn.addEventListener('click', () => this.removeLoadingScreenImage());
        if (backgroundImageRemoveBtn) backgroundImageRemoveBtn.addEventListener('click', () => this.removeBackgroundImage());
        if (rouletteCoverRemoveBtn) rouletteCoverRemoveBtn.addEventListener('click', () => this.removeRouletteCoverImage());
        if (catalogCoverRemoveBtn) catalogCoverRemoveBtn.addEventListener('click', () => this.removeCatalogCover());
        if (rouletteBannerInput) rouletteBannerInput.addEventListener('change', (e) => this.handleRouletteBannerImageChange(e));
        if (rouletteBannerRemoveBtn) rouletteBannerRemoveBtn.addEventListener('click', () => this.removeRouletteBannerImage());
        
        // Show/hide fields based on admin type
        if (adminTypeSelect) {
            adminTypeSelect.addEventListener('change', (e) => {
                const type = e.target.value;
                const idField = document.getElementById('tgAdminIdField');
                const usernameField = document.getElementById('tgAdminUsernameField');
                
                if (idField) idField.style.display = type === 'telegram' ? 'block' : 'none';
                if (usernameField) usernameField.style.display = type === 'website' ? 'block' : 'none';
            });
        }

        // Переключение между режимами
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const mode = item.dataset.mode;
                this.switchMode(mode);
            });
        });

        if (sizesContainer) {
            sizesContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.tg-admin-size-btn');
                if (!btn) return;
                e.preventDefault();
                const size = btn.dataset.size;
                if (this.selectedSizes.has(size)) {
                    this.selectedSizes.delete(size);
                    btn.classList.remove('active');
                } else {
                    this.selectedSizes.add(size);
                    btn.classList.add('active');
                }
            });
        }

        if (imagesInput) {
            imagesInput.addEventListener('change', (e) => this.handleImagesChange(e));
        }

        if (brandLogoInput) {
            brandLogoInput.addEventListener('change', (e) => this.handleBrandLogoChange(e));
        }
        if (brandCoverInput) {
            brandCoverInput.addEventListener('change', (e) => this.handleBrandCoverChange(e));
        }

        if (logoImageInput) {
            logoImageInput.addEventListener('change', (e) => this.handleLogoImageChange(e));
        }

        if (loadingScreenImageInput) {
            loadingScreenImageInput.addEventListener('change', (e) => this.handleLoadingScreenImageChange(e));
        }

        if (backgroundImageInput) {
            backgroundImageInput.addEventListener('change', (e) => this.handleBackgroundImageChange(e));
        }

        if (rouletteCoverInput) {
            rouletteCoverInput.addEventListener('change', (e) => this.handleRouletteCoverImageChange(e));
        }

        if (catalogCoverInput) {
            catalogCoverInput.addEventListener('change', (e) => this.handleCatalogCoverChange(e));
        }
        const catalogCoverPreview = document.getElementById('tgCatalogCoverPreview');
        if (catalogCoverPreview) {
            catalogCoverPreview.addEventListener('click', (e) => this.handleCatalogCoverPreviewClick(e));
        }
        
        // Автогенерация slug из названия категории
        const categoryNameInput = document.getElementById('tgCategoryName');
        const categorySlugInput = document.getElementById('tgCategorySlug');
        if (categoryNameInput && categorySlugInput) {
            categoryNameInput.addEventListener('input', () => {
                // Генерируем slug только если поле slug пустое или пользователь не редактировал его вручную
                if (!categorySlugInput.dataset.manualEdit) {
                    const name = categoryNameInput.value.trim();
                    const slug = name.toLowerCase()
                        .replace(/[^a-zа-яё0-9\s-]/g, '') // Разрешаем латиницу, кириллицу, цифры, пробелы и дефисы
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                    categorySlugInput.value = slug;
                }
            });
            
            // Отслеживаем ручное редактирование slug
            categorySlugInput.addEventListener('input', () => {
                categorySlugInput.dataset.manualEdit = 'true';
            });
        }
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        // Обновляем активный пункт меню
        document.querySelectorAll('.tg-admin-menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.mode === mode);
        });
        
        // Обновляем заголовок
        const title = document.getElementById('tgAdminPageTitle');
        if (title) {
            const titles = {
                product: 'Добавить товар',
                category: 'Добавить категорию',
                brand: 'Добавить бренд',
                admin: 'Управление админами',
                design: 'Настройка дизайна',
                roulette: 'Настройка рулетки'
            };
            title.textContent = titles[mode] || 'Админка';
        }
        
        // Показываем/скрываем формы
        document.querySelectorAll('[data-form]').forEach(form => {
            form.style.display = form.dataset.form === mode ? 'block' : 'none';
        });
        
        const statusEl = document.getElementById('tgAdminStatus');
        if (statusEl) statusEl.textContent = '';
        
        // Загружаем список админов при переключении на режим админов
        if (mode === 'admin') {
            this.loadAdmins();
        }
        
        // Загружаем настройки дизайна при переключении на режим дизайна
        if (mode === 'design') {
            this.loadDesignSettings();
        }
        
        // Загружаем настройки оформления при переключении на режим оформления
        if (mode === 'checkout') {
            this.loadCheckoutSettings();
        }
        
        // Загружаем настройки рулетки при переключении на режим рулетки
        if (mode === 'roulette') {
            this.loadRouletteConfig();
        }
    }
    
    async handleBrandLogoChange(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('tgBrandLogoPreview');
        if (!file || !preview) return;
        
        preview.innerHTML = '';
        const url = URL.createObjectURL(file);
        const item = document.createElement('div');
        item.className = 'tg-admin-image-item';
        item.innerHTML = `<img src="${url}" alt="logo preview" />`;
        preview.appendChild(item);
    }

    async validateVideo(file) {
        return new Promise((resolve, reject) => {
            // Проверка размера (до 25МБ)
            if (file.size > 25 * 1024 * 1024) {
                reject(new Error('Видео должно быть не более 25 МБ'));
                return;
            }
            
            // Проверка типа файла
            if (!file.type.startsWith('video/')) {
                resolve({ isValid: true, isVideo: false });
                return;
            }
            
            // Проверка длительности (до 15 секунд)
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                const duration = video.duration;
                if (duration > 15) {
                    reject(new Error('Видео должно быть не более 15 секунд'));
                } else {
                    resolve({ isValid: true, isVideo: true, duration });
                }
            };
            video.onerror = () => {
                window.URL.revokeObjectURL(video.src);
                reject(new Error('Ошибка при проверке видео'));
            };
            video.src = URL.createObjectURL(file);
        });
    }

    async handleLogoImageChange(event) {
        const files = event.target.files;
        const preview = document.getElementById('tgLogoImagePreview');
        const removeBtn = document.getElementById('tgLogoImageRemoveBtn');
        if (!files || files.length === 0 || !preview) return;
        
        preview.innerHTML = '';
        
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const isVideo = file.type.startsWith('video/');
            
            // Валидация видео ПЕРЕД созданием URL
            if (isVideo) {
                try {
                    await this.validateVideo(file);
                } catch (error) {
                    if (window.telegramWebApp) {
                        window.telegramWebApp.showNotification(error.message);
                    }
                    continue; // Пропускаем невалидное видео
                }
            }
            
            // Создаем URL только после успешной валидации
            const url = URL.createObjectURL(file);
            
            const item = document.createElement('div');
            item.className = 'tg-admin-image-item';
            item.style.position = 'relative';
            // Сохраняем URL в data-атрибуте, чтобы он не был освобожден
            item.dataset.objectUrl = url;
            
            if (isVideo) {
                const video = document.createElement('video');
                video.src = url;
                video.style.maxWidth = '100%';
                video.style.height = 'auto';
                video.style.display = 'block';
                video.controls = true;
                video.muted = true;
                
                const span = document.createElement('span');
                span.style.cssText = 'position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;';
                span.textContent = `${index + 1} (VIDEO)`;
                
                item.appendChild(video);
                item.appendChild(span);
            } else {
                const img = document.createElement('img');
                img.src = url;
                img.alt = `logo preview ${index + 1}`;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                
                const span = document.createElement('span');
                span.style.cssText = 'position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;';
                span.textContent = `${index + 1}`;
                
                item.appendChild(img);
                item.appendChild(span);
            }
            preview.appendChild(item);
        }
        
        if (removeBtn) removeBtn.style.display = 'block';
    }

    async handleBrandCoverChange(event) {
        const files = event.target.files;
        const preview = document.getElementById('tgBrandCoverPreview');
        const removeBtn = document.getElementById('tgBrandCoverRemoveBtn');
        if (!files || files.length === 0 || !preview) return;
        
        preview.innerHTML = '';
        Array.from(files).forEach((file, index) => {
            const url = URL.createObjectURL(file);
            const item = document.createElement('div');
            item.className = 'tg-admin-image-item';
            item.style.position = 'relative';
            item.innerHTML = `
                <img src="${url}" alt="brand cover preview ${index + 1}" style="max-width: 100%; height: auto;" />
                <span style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${index + 1}</span>
            `;
            preview.appendChild(item);
        });
        if (removeBtn) removeBtn.style.display = 'block';
    }

    async handleCatalogCoverChange(event) {
        const files = event.target.files;
        const removeBtn = document.getElementById('tgCatalogCoverRemoveBtn');
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            const isVideo = file.type.startsWith('video/');
            if (isVideo) {
                try {
                    await this.validateVideo(file);
                } catch (error) {
                    if (window.telegramWebApp) {
                        window.telegramWebApp.showNotification(error.message);
                    }
                    continue;
                }
            }

            const previewUrl = URL.createObjectURL(file);
            this.catalogCoverState.push({
                id: this.generateCatalogCoverId(),
                source: 'file',
                file,
                mediaType: isVideo ? 'video' : 'image',
                previewUrl,
                revokeOnRemove: true
            });
        }

        event.target.value = '';
        this.updateCatalogCoverPreview();
        if (removeBtn) removeBtn.style.display = this.catalogCoverState.length > 0 ? 'block' : 'none';
    }
    
    removeBrandCover() {
        const preview = document.getElementById('tgBrandCoverPreview');
        const removeBtn = document.getElementById('tgBrandCoverRemoveBtn');
        const input = document.getElementById('tgBrandCover');
        
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (input) input.value = '';
    }

    async handleLoadingScreenImageChange(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('tgLoadingScreenImagePreview');
        const removeBtn = document.getElementById('tgLoadingScreenImageRemoveBtn');
        if (!file || !preview) return;
        
        const isVideo = file.type.startsWith('video/');
        
        if (isVideo) {
            try {
                await this.validateVideo(file, 50 * 1024 * 1024); // 50MB limit
            } catch (error) {
                if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification(error.message);
                    window.telegramWebApp.hapticFeedback('error');
                }
                event.target.value = '';
                return;
            }
        }
        
        preview.innerHTML = '';
        const url = URL.createObjectURL(file);
        const item = document.createElement('div');
        item.className = 'tg-admin-image-item';
        
        if (isVideo) {
            item.innerHTML = `<video src="${url}" muted loop playsinline style="max-width: 300px; height: auto; border-radius: 8px;" autoplay></video>`;
        } else {
            item.innerHTML = `<img src="${url}" alt="loading screen preview" style="max-width: 200px; height: auto;" />`;
        }
        
        preview.appendChild(item);
        if (removeBtn) removeBtn.style.display = 'block';
    }

    async handleRouletteCoverImageChange(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('tgRouletteCoverImagePreview');
        const removeBtn = document.getElementById('tgRouletteCoverImageRemoveBtn');
        if (!file || !preview) return;

        preview.innerHTML = '';
        const url = URL.createObjectURL(file);
        const item = document.createElement('div');
        item.className = 'tg-admin-image-item';
        item.innerHTML = `<img src="${url}" alt="roulette cover preview" style="max-width: 100%; height: auto;" />`;
        preview.appendChild(item);
        if (removeBtn) removeBtn.style.display = 'block';
    }

    async handleRouletteBannerImageChange(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('tgRouletteBannerImagePreview');
        const removeBtn = document.getElementById('tgRouletteBannerImageRemoveBtn');
        if (!file || !preview) return;

        const isVideo = file.type.startsWith('video/');
        if (isVideo) {
            try {
                await this.validateVideo(file);
            } catch (error) {
                if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification(error.message);
                    window.telegramWebApp.hapticFeedback('error');
                }
                event.target.value = '';
                return;
            }
        }

        this.cleanupRouletteBannerPreviewUrl();

        const previewUrl = URL.createObjectURL(file);
        this.rouletteBannerState = {
            source: 'file',
            file,
            previewUrl,
            revokeOnRemove: true,
            mediaType: isVideo ? 'video' : 'image'
        };

        this.renderRouletteBannerPreview(previewUrl, this.rouletteBannerState.mediaType);
        if (removeBtn) removeBtn.style.display = 'block';
    }

    renderRouletteBannerPreview(url, mediaType = 'image') {
        const preview = document.getElementById('tgRouletteBannerImagePreview');
        if (!preview || !url) return;
        preview.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'tg-admin-image-item';
        if (mediaType === 'video') {
            item.innerHTML = `
                <video src="${url}" autoplay muted loop playsinline style="width: 100%; height: auto; border-radius: 8px;">
                    Ваш браузер не поддерживает видео.
                </video>
            `;
        } else {
            item.innerHTML = `<img src="${url}" alt="roulette banner preview" style="max-width: 100%; height: auto;" />`;
        }
        preview.appendChild(item);
    }

    cleanupRouletteBannerPreviewUrl() {
        if (this.rouletteBannerState?.previewUrl && this.rouletteBannerState.revokeOnRemove) {
            URL.revokeObjectURL(this.rouletteBannerState.previewUrl);
        }
    }

    clearRouletteBannerPreview() {
        this.cleanupRouletteBannerPreviewUrl();
        this.rouletteBannerState = null;
        const preview = document.getElementById('tgRouletteBannerImagePreview');
        const removeBtn = document.getElementById('tgRouletteBannerImageRemoveBtn');
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
    }

    setRouletteBannerStateFromSettings(media) {
        const normalized = this.normalizeRouletteBannerData(media);
        if (!normalized) {
            this.clearRouletteBannerPreview();
            return;
        }

        this.cleanupRouletteBannerPreviewUrl();
        this.rouletteBannerState = {
            source: 'existing',
            data: normalized,
            previewUrl: normalized.url,
            mediaType: normalized.type || 'image',
            revokeOnRemove: false
        };
        this.renderRouletteBannerPreview(normalized.url, this.rouletteBannerState.mediaType);
        const removeBtn = document.getElementById('tgRouletteBannerImageRemoveBtn');
        if (removeBtn) removeBtn.style.display = 'block';
    }

    async removeRouletteBannerImage() {
        const input = document.getElementById('tgRouletteBannerImage');
        if (input) input.value = '';
        this.clearRouletteBannerPreview();

        const settings = await this.getDesignSettings();
        delete settings.rouletteBannerMedia;
        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));

        try {
            await fetch('/api/telegram/design-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
        } catch (error) {
            console.error('❌ Error updating design settings on server:', error);
        }

        this.applyDesignSettings(settings);
        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification('Обложка рулетки удалена');
            window.telegramWebApp.hapticFeedback('success');
        }
    }

    async processRouletteBannerFile(file) {
        if (!file) return null;
        const isVideo = file.type.startsWith('video/');

        if (isVideo) {
            try {
                const formData = new FormData();
                formData.append('video', file);
                const headers = {};
                if (this.userId) {
                    headers['X-MiniApp-User-Id'] = this.userId;
                    headers['X-MiniApp-Admin-Key'] = 'salik-miniapp-admin-8222800886';
                }
                const uploadResponse = await fetch('/api/upload-video', {
                    method: 'POST',
                    headers,
                    body: formData
                });
                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    return { url: uploadData.url, type: 'video' };
                }
            } catch (error) {
                console.error('Error uploading roulette banner video:', error);
            }
        } else {
            try {
                const formData = new FormData();
                formData.append('image', file);
                const headers = this.getAdminHeaders();
                const adminToken = localStorage.getItem('adminToken');
                if (adminToken) {
                    headers['Authorization'] = 'Bearer ' + adminToken;
                }
                delete headers['Content-Type'];
                const uploadResponse = await fetch('/api/upload-image', {
                    method: 'POST',
                    headers,
                    body: formData
                });
                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    return { url: uploadData.url, type: 'image' };
                }
            } catch (error) {
                console.error('Error uploading roulette banner image:', error);
            }
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({
                url: reader.result,
                type: isVideo ? 'video' : 'image'
            });
            reader.readAsDataURL(file);
        });
    }

    async prepareRouletteBannerMedia() {
        if (!this.rouletteBannerState) return null;
        if (this.rouletteBannerState.source === 'existing' && this.rouletteBannerState.data) {
            const normalized = this.normalizeRouletteBannerData(this.rouletteBannerState.data);
            if (normalized) {
                this.rouletteBannerState.data = normalized;
                return normalized;
            }
            return null;
        }

        if (this.rouletteBannerState.source === 'file' && this.rouletteBannerState.file) {
            const processed = await this.processRouletteBannerFile(this.rouletteBannerState.file);
            if (processed) {
                this.cleanupRouletteBannerPreviewUrl();
                this.rouletteBannerState = {
                    source: 'existing',
                    data: processed,
                    previewUrl: processed.url,
                    mediaType: processed.type || this.rouletteBannerState.mediaType || 'image',
                    revokeOnRemove: false
                };
                return processed;
            }
        }
        return null;
    }

    async handleBackgroundImageChange(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('tgBackgroundImagePreview');
        const removeBtn = document.getElementById('tgBackgroundImageRemoveBtn');
        if (!file || !preview) return;
        
        preview.innerHTML = '';
        const url = URL.createObjectURL(file);
        const item = document.createElement('div');
        item.className = 'tg-admin-image-item';
        item.innerHTML = `<img src="${url}" alt="background preview" style="max-width: 100%; height: auto;" />`;
        preview.appendChild(item);
        if (removeBtn) removeBtn.style.display = 'block';
    }

    async handleImagesChange(event) {
        const files = event.target.files;
        const preview = document.getElementById('tgAdminImagesPreview');
        if (!files || files.length === 0 || !preview) return;

        preview.innerHTML = '';

        for (const file of files) {
            const url = URL.createObjectURL(file);
            const item = document.createElement('div');
            item.className = 'tg-admin-image-item';
            item.innerHTML = `<img src="${url}" alt="preview" />`;
            preview.appendChild(item);
        }
    }

    async handleProductSubmit() {
        if (!window.productDB) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Бекенд недоступен');
            }
            return;
        }

        const form = document.getElementById('tgAdminProductForm');
        if (!form.reportValidity()) return;

        const category = document.getElementById('tgAdminCategory').value;
        const brandSelect = document.getElementById('tgAdminBrand');
        const brandId = brandSelect ? parseInt(brandSelect.value) : null;
        const selectedBrandOption = brandSelect ? brandSelect.options[brandSelect.selectedIndex] : null;
        const brandName = selectedBrandOption ? selectedBrandOption.getAttribute('data-brand-name') : null;
        
        const name = document.getElementById('tgAdminName').value.trim();
        const description = document.getElementById('tgAdminDescription').value.trim();
        const price = parseInt(document.getElementById('tgAdminPrice').value, 10);
        const oldPriceInput = document.getElementById('tgAdminOldPrice').value.trim();
        const newPriceInput = document.getElementById('tgAdminNewPrice').value.trim();
        const oldPrice = oldPriceInput ? parseInt(oldPriceInput, 10) : null;
        const newPrice = newPriceInput ? parseInt(newPriceInput, 10) : null;
        const isTrending = document.getElementById('tgAdminTrending').checked;
        const isPreorder = document.getElementById('tgAdminPreorder').checked;
        const files = document.getElementById('tgAdminImages').files;

        if (!category) {
            if (window.telegramWebApp) window.telegramWebApp.showNotification('Выберите категорию');
            return;
        }
        if (!brandId || !brandName) {
            if (window.telegramWebApp) window.telegramWebApp.showNotification('Выберите бренд');
            return;
        }
        if (!this.selectedSizes.size) {
            if (window.telegramWebApp) window.telegramWebApp.showNotification('Выберите хотя бы один размер');
            return;
        }
        if (!files || files.length === 0) {
            if (window.telegramWebApp) window.telegramWebApp.showNotification('Загрузите хотя бы одно фото');
            return;
        }

        const productSubmitBtn = document.getElementById('tgAdminProductSubmitBtn');
        const statusEl = document.getElementById('tgAdminStatus');
        if (productSubmitBtn) {
            productSubmitBtn.textContent = 'Товар загружается';
            productSubmitBtn.disabled = true;
        }
        if (statusEl) statusEl.textContent = 'Товар загружается';
        
        try {
            let images = [];
            if (window.imageManager && typeof window.imageManager.processMultipleImages === 'function') {
                images = await window.imageManager.processMultipleImages(files);
            } else if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                for (const file of files) {
                    const img = await window.imageManager.processImage(file);
                    if (img) images.push(img);
                }
            }

            const categorySlug = (category || '').trim();
            const productData = {
                name,
                description,
                price,
                oldPrice: oldPrice || undefined,
                newPrice: newPrice || undefined,
                sizes: Array.from(this.selectedSizes),
                images,
                isTrending,
                isPreorder: isPreorder || false,
                isActive: true,
                brandId: brandId,
                brandName: brandName,
                category: categorySlug
            };

            const saved = await window.productDB.addProduct(categorySlug, productData);

            if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('success');
            if (productSubmitBtn) {
                productSubmitBtn.textContent = 'Добавить товар';
                productSubmitBtn.disabled = false;
            }
            if (statusEl) statusEl.textContent = 'Товар добавлен';

            console.log('Admin product saved from mini app:', saved);
            form.reset();
            this.selectedSizes.clear();
            const preview = document.getElementById('tgAdminImagesPreview');
            if (preview) preview.innerHTML = '';
            document.querySelectorAll('.tg-admin-size-btn.active').forEach(btn => btn.classList.remove('active'));
            if (window.telegramMiniAppLoader) window.telegramMiniAppLoader.loadData();
        } catch (error) {
            console.error('Error adding product from mini app admin:', error);
            if (productSubmitBtn) {
                productSubmitBtn.textContent = 'Добавить товар';
                productSubmitBtn.disabled = false;
            }
            if (statusEl) statusEl.textContent = 'Ошибка при добавлении товара';
            if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('error');
        }
    }

    async handleCategorySubmit() {
        const form = document.getElementById('tgAdminCategoryForm');
        if (!form.reportValidity()) return;
        
        const name = document.getElementById('tgCategoryName').value.trim();
        const slug = document.getElementById('tgCategorySlug').value.trim().toLowerCase();
        const description = document.getElementById('tgCategoryDescription').value.trim();
        const isVisible = document.getElementById('tgCategoryIsVisible').checked;
        
        if (!/^[a-zа-яё0-9-_]+$/i.test(slug)) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Slug может содержать буквы (латиница и кириллица), цифры, дефисы и подчёркивания');
            }
            return;
        }
        
        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify({
                    name,
                    slug,
                    description,
                    isVisible
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при добавлении категории');
            }
            
            const category = await response.json();
            
            // Создаём HTML-страницу категории для сайта
            try {
                const createPageRes = await fetch('/api/create-category-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-MiniApp-User-Id': this.userId || '',
                        'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                    },
                    body: JSON.stringify({ slug, name, description })
                });
                if (!createPageRes.ok) {
                    console.warn('Не удалось создать страницу категории:', await createPageRes.text());
                }
            } catch (e) {
                console.warn('Ошибка создания страницы категории:', e);
            }
            
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Категория добавлена');
                window.telegramWebApp.hapticFeedback('success');
            }
            
            form.reset();
            const categorySlugInput = document.getElementById('tgCategorySlug');
            if (categorySlugInput) delete categorySlugInput.dataset.manualEdit;
            this.loadCategories();
            if (window.telegramMiniAppLoader) window.telegramMiniAppLoader.loadData();
        } catch (error) {
            console.error('Error adding category:', error);
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification(error.message || 'Ошибка при добавлении категории');
                window.telegramWebApp.hapticFeedback('error');
            }
        }
    }
    
    async handleBrandSubmit() {
        const form = document.getElementById('tgAdminBrandForm');
        if (!form.reportValidity()) return;
        
        const name = document.getElementById('tgBrandName').value.trim();
        const description = document.getElementById('tgBrandDescription').value.trim();
        const logoFile = document.getElementById('tgBrandLogo').files[0];
        const coverFiles = document.getElementById('tgBrandCover').files;
        
        let logo = null;
        if (logoFile) {
            try {
                if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                    const logoData = await window.imageManager.processImage(logoFile);
                    logo = logoData.url || logoData.data || logoData;
                } else {
                    // Fallback to base64
                    const reader = new FileReader();
                    logo = await new Promise((resolve) => {
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(logoFile);
                    });
                }
            } catch (error) {
                console.error('Error processing brand logo:', error);
                if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification('Ошибка при загрузке логотипа');
                }
                return;
            }
        }
        
        // Обрабатываем обложки бренда (может быть несколько)
        let covers = [];
        if (coverFiles && coverFiles.length > 0) {
            for (const coverFile of Array.from(coverFiles)) {
                try {
                    let coverUrl = null;
                    if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                        const coverData = await window.imageManager.processImage(coverFile);
                        coverUrl = coverData.url || coverData.data || coverData;
                    } else {
                        // Fallback to base64
                        const reader = new FileReader();
                        coverUrl = await new Promise((resolve) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(coverFile);
                        });
                    }
                    if (coverUrl) covers.push(coverUrl);
                } catch (error) {
                    console.error('Error processing brand cover:', error);
                }
            }
        }
        
        try {
            const response = await fetch('/api/brands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify({
                    name,
                    description: description || undefined,
                    logo: logo || undefined,
                    covers: covers.length > 0 ? covers : undefined
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при добавлении бренда');
            }
            
            const brand = await response.json();
            
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Бренд добавлен');
                window.telegramWebApp.hapticFeedback('success');
            }
            
            form.reset();
            const logoPreview = document.getElementById('tgBrandLogoPreview');
            const coverPreview = document.getElementById('tgBrandCoverPreview');
            const coverRemoveBtn = document.getElementById('tgBrandCoverRemoveBtn');
            if (logoPreview) logoPreview.innerHTML = '';
            if (coverPreview) coverPreview.innerHTML = '';
            if (coverRemoveBtn) coverRemoveBtn.style.display = 'none';
            this.loadBrands();
            if (window.telegramMiniAppLoader) window.telegramMiniAppLoader.loadData();
            if (window.telegramCatalog) { window.telegramCatalog.loadBrands().then(() => window.telegramCatalog.renderBrands()); }
        } catch (error) {
            console.error('Error adding brand:', error);
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification(error.message || 'Ошибка при добавлении бренда');
                window.telegramWebApp.hapticFeedback('error');
            }
        }
    }

    async show() {
        console.log('🔐 TelegramAdminPage.show() called - FORCING OPEN');
        
        // ПРОСТАЯ ЛОГИКА - получаем userId и проверяем админа БЫСТРО
        if (!this.userId) {
            try {
                const user = window.telegramWebApp ? window.telegramWebApp.getUserData() : null;
                this.userId = user ? String(user.id) : null;
            } catch (e) {
                console.error('Error getting user:', e);
            }
        }

        // БЫСТРАЯ проверка админа - если userId есть, проверяем, иначе используем fallback
        if (this.userId) {
            try {
                const response = await this.fetchWithTimeout('/api/admin-users', {
                    headers: {
                        'X-MiniApp-User-Id': this.userId,
                        'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                    }
                }, 10000);
                if (response.ok) {
                    const admins = await response.json();
                    this.isAdmin = admins.some(admin => 
                        admin.type === 'telegram' && String(admin.id) === String(this.userId)
                    );
                } else {
                    this.isAdmin = this.userId === '8222800886';
                }
            } catch (error) {
                console.warn('⚠️ Admin check timeout or error, using fallback:', error);
                this.isAdmin = this.userId === '8222800886';
            }
        } else {
            // Если userId нет, все равно пытаемся открыть (для тестирования)
            this.isAdmin = true; // ВРЕМЕННО разрешаем для отладки
            console.log('⚠️ No userId, but allowing access for debugging');
        }

        // НЕ БЛОКИРУЕМ если не админ - просто логируем
        if (!this.isAdmin) {
            console.warn('⚠️ User is not admin, but continuing anyway');
        }

        // ПРОВЕРЯЕМ - ЕСЛИ ЕСТЬ MINIMAL СТРАНИЦА, УДАЛЯЕМ ЕЁ
        // ВАЖНО: Проверяем только отсутствие меню, НЕ проверяем текст "Загрузка..." 
        // потому что в нормальной странице тоже есть элементы с текстом "Загрузка категорий..." и т.д.
        const existingPage = document.getElementById('tgAdminPage');
        if (existingPage && !existingPage.querySelector('.tg-admin-menu')) {
            // Дополнительная проверка: если это действительно минимальная страница (нет форм)
            const hasForms = existingPage.querySelectorAll('[data-form]').length > 0;
            if (!hasForms) {
                console.log('🗑️ Removing minimal/fallback page (no menu and no forms)...');
                existingPage.remove();
                this.page = null;
            } else {
                console.log('⚠️ Page has forms but no menu - keeping it, will add menu');
            }
        }
        
        // СОЗДАЕМ ПОЛНУЮ СТРАНИЦУ ЕСЛИ ЕЁ НЕТ
        if (!this.page) {
            console.log('📄 Creating FULL admin page with all functionality...');
            try {
                // Проверяем что метод createPage существует
                if (typeof this.createPage !== 'function') {
                    console.error('❌ createPage method not found');
                    throw new Error('createPage method not found');
                }
                
                this.createPage();
                console.log('✅ createPage() called');
                
                // Ждем и проверяем
                await new Promise(resolve => setTimeout(resolve, 100));
                this.page = document.getElementById('tgAdminPage');
                
                if (!this.page) {
                    console.error('❌ Page not found after createPage(), retrying...');
                    // Удаляем возможные дубликаты
                    document.querySelectorAll('#tgAdminPage').forEach(el => el.remove());
                    try {
                        this.createPage();
                        await new Promise(resolve => setTimeout(resolve, 150));
                        this.page = document.getElementById('tgAdminPage');
                    } catch (retryError) {
                        console.error('❌ Retry createPage failed:', retryError);
                    }
                }
                
                if (!this.page) {
                    console.error('❌ Page element not found in DOM after createPage()');
                    throw new Error('Page element not found in DOM after createPage()');
                }
                
                // Проверяем что это полная страница (есть меню)
                if (!this.page.querySelector('.tg-admin-menu')) {
                    console.error('❌ Created page is not full - missing menu!');
                    this.page.remove();
                    this.page = null;
                    throw new Error('Created page is incomplete');
                }
                
                console.log('✅ Full admin page created successfully!', {
                    hasMenu: !!this.page.querySelector('.tg-admin-menu'),
                    hasForms: !!this.page.querySelectorAll('[data-form]').length,
                    formsCount: this.page.querySelectorAll('[data-form]').length
                });
                
                // Настраиваем обработчики событий
                if (!this.page.hasAttribute('data-listeners-setup')) {
                    console.log('🔧 Setting up event listeners...');
                    this.setupEventListeners();
                    this.page.setAttribute('data-listeners-setup', 'true');
                    console.log('✅ Event listeners set up');
                }
            } catch (error) {
                console.error('❌ Error creating full page:', error);
                console.error('Error stack:', error.stack);
                // НЕ создаем fallback - пробуем еще раз
                console.log('🔄 Retrying page creation...');
                try {
                    document.querySelectorAll('#tgAdminPage').forEach(el => el.remove());
                    this.createPage();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    this.page = document.getElementById('tgAdminPage');
                    if (this.page && !this.page.hasAttribute('data-listeners-setup')) {
                        this.setupEventListeners();
                        this.page.setAttribute('data-listeners-setup', 'true');
        }
                } catch (retryError) {
                    console.error('❌ Retry also failed:', retryError);
                    // Не выбрасываем ошибку - продолжаем с тем, что есть
                    console.log('⚠️ Continuing despite retry failure...');
                }
            }
        }
        
        // ФИНАЛЬНАЯ ПРОВЕРКА - ДОЛЖНА БЫТЬ ПОЛНАЯ СТРАНИЦА
        if (!this.page) {
            console.error('❌ CRITICAL: Page element not found!');
            return; // Выходим без ошибки
        }
        
        // Проверяем наличие меню - если нет, значит страница неполная
        if (!this.page.querySelector('.tg-admin-menu')) {
            console.error('❌ CRITICAL: Full page not created - missing menu!');
            // Пытаемся пересоздать страницу еще раз
            console.log('🔄 Attempting to recreate page...');
            try {
                this.page.remove();
                this.page = null;
                this.createPage();
                await new Promise(resolve => setTimeout(resolve, 200));
                this.page = document.getElementById('tgAdminPage');
                
                if (!this.page || !this.page.querySelector('.tg-admin-menu')) {
                    console.error('❌ Page recreation failed!');
                    // Создаем минимальную страницу с ошибкой
                    const minimalHTML = `
                        <div id="tgAdminPage" class="tg-admin-page" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#f5f5f5;display:flex;flex-direction:column;">
                            <div style="padding:20px;background:#fff;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;">
                                <h1 style="margin:0;">Админка</h1>
                                <button onclick="document.getElementById('tgAdminPage').style.display='none'" style="background:#ff4444;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Закрыть</button>
                            </div>
                            <div style="padding:20px;flex:1;overflow:auto;">
                                <p>Ошибка загрузки админки. Попробуйте обновить страницу.</p>
                                <button onclick="location.reload()" style="background:#4CAF50;color:white;border:none;padding:12px 24px;border-radius:4px;cursor:pointer;margin-top:16px;">Обновить страницу</button>
                            </div>
                        </div>
                    `;
                    if (this.page) this.page.remove();
                    document.body.insertAdjacentHTML('beforeend', minimalHTML);
                    this.page = document.getElementById('tgAdminPage');
                    return; // Выходим
                }
            } catch (recreateError) {
                console.error('❌ Error recreating page:', recreateError);
                return; // Выходим без ошибки
            }
        }
        
        console.log('✅ FORCING ADMIN PAGE TO SHOW', {
            isAdmin: this.isAdmin,
            userId: this.userId,
            hasPage: !!this.page,
            pageId: this.page ? this.page.id : 'null',
            hasMenu: this.page ? !!this.page.querySelector('.tg-admin-menu') : false,
            hasForms: this.page ? this.page.querySelectorAll('[data-form]').length : 0
        });
        
        // ПРИНУДИТЕЛЬНОЕ ОТКРЫТИЕ - БЕЗ ЛИШНИХ ПРОВЕРОК
        try {
            // Скрываем ВСЕ остальное
            document.querySelectorAll('.tg-profile-page, .tg-catalog-page, .tg-cart-page, .tg-favorites-page, .tg-main-content, .tg-logo-card, .tg-bottom-nav').forEach(el => {
                if (el && el !== this.page) {
                    el.style.display = 'none';
                }
            });
            
            // ПРИНУДИТЕЛЬНО показываем админку
            // Удаляем все возможные классы, которые могут скрывать страницу
            this.page.classList.remove('hidden', 'hide', 'invisible');
            this.page.removeAttribute('hidden');
            this.page.removeAttribute('style'); // Удаляем старый style с display:none
            
            // Устанавливаем новые стили
            this.page.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 99999 !important;
                background: #f5f5f5 !important;
                overflow: auto !important;
                margin: 0 !important;
                padding: 0 !important;
            `;
            
            // Дополнительная проверка через небольшую задержку
            setTimeout(() => {
                const computedStyle = window.getComputedStyle(this.page);
                console.log('✅ Admin page display status:', {
                    inlineDisplay: this.page.style.display,
                    computedDisplay: computedStyle.display,
                    computedVisibility: computedStyle.visibility,
                    computedOpacity: computedStyle.opacity,
                    computedZIndex: computedStyle.zIndex,
                    offsetParent: this.page.offsetParent !== null,
                    clientWidth: this.page.clientWidth,
                    clientHeight: this.page.clientHeight,
                    isInDOM: document.body.contains(this.page)
                });
                
                // Если страница все еще не видна, принудительно показываем
                if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
                    console.warn('⚠️ Page still hidden, forcing display...');
                    this.page.style.setProperty('display', 'flex', 'important');
                    this.page.style.setProperty('visibility', 'visible', 'important');
                    this.page.style.setProperty('opacity', '1', 'important');
                }
            }, 100);
            
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            
            console.log('✅ Admin page display set to flex', {
                display: this.page.style.display,
                computedDisplay: window.getComputedStyle(this.page).display,
                zIndex: this.page.style.zIndex,
                isVisible: this.page.offsetParent !== null,
                visibility: window.getComputedStyle(this.page).visibility,
                opacity: window.getComputedStyle(this.page).opacity
            });
            
        
            // Переключаемся на режим товара
            try {
        this.switchMode('product');
            } catch (e) {
                console.error('Error switching mode:', e);
            }
        
            // Загружаем категории и бренды (не блокируем если ошибка)
            try {
        this.loadCategories();
        this.loadBrands();
            } catch (e) {
                console.error('Error loading categories/brands:', e);
            }

            // Настраиваем кнопку назад
            try {
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => this.close());
            window.telegramWebApp.showBackButton();
        }
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback('impact');
                }
            } catch (e) {
                console.error('Error setting up back button:', e);
            }
            
            console.log('✅ ADMIN PAGE OPENED SUCCESSFULLY!');
            
        } catch (error) {
            console.error('❌ Error showing admin page:', error);
            // ВСЕ РАВНО ПОКАЗЫВАЕМ СТРАНИЦУ даже при ошибке
            if (this.page) {
                this.page.style.cssText = 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 99999 !important; background: #fff !important;';
            }
        }
    }

    close() {
        if (!this.page) return;
        this.page.style.display = 'none';

        // Восстанавливаем overflow для body и html
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // ПОКАЗЫВАЕМ ГЛАВНУЮ СТРАНИЦУ - возвращаемся на home
        const mainContent = document.getElementById('mainContent');
        const catalogPage = document.getElementById('catalogPage');
        const bottomNav = document.querySelector('.tg-bottom-nav');
        const logoCard = document.querySelector('.tg-logo-card');
        
        // Показываем главный контент
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        
        // Скрываем каталог если он был открыт
        if (catalogPage) {
            catalogPage.style.display = 'none';
        }
        
        // Показываем логотип
        if (logoCard) {
            logoCard.style.display = 'block';
        }
        
        // Показываем нижнюю навигацию
        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }
        
        // Скрываем другие страницы
        const profilePage = document.querySelector('.tg-profile-page');
        const cartPage = document.querySelector('.tg-cart-page');
        const favoritesPage = document.querySelector('.tg-favorites-page');
        
        if (profilePage) profilePage.style.display = 'none';
        if (cartPage) cartPage.style.display = 'none';
        if (favoritesPage) favoritesPage.style.display = 'none';
        
        // Используем навигацию если она доступна
        if (window.telegramNavigation && typeof window.telegramNavigation.navigate === 'function') {
            window.telegramNavigation.navigate('#home');
        } else {
            // Fallback - просто показываем главную
            console.log('Navigation not available, showing home page directly');
        }

        // Восстанавливаем другие страницы, если они были видимы
        const otherPages = document.querySelectorAll('[data-was-visible="true"]');
        otherPages.forEach(page => {
            page.style.display = '';
            page.removeAttribute('data-was-visible');
        });

        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.hideBackButton();
            window.telegramWebApp.setupBackButton();
        }
        
        console.log('✅ Admin page closed, returned to home');
    }

    openSite() {
        // Получаем URL основного сайта (без /TGminiapp.html)
        const siteUrl = window.location.origin + '/index.html';
        
        // Открываем в новой вкладке/окне
        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            // В Telegram Mini App используем openLink
            window.telegramWebApp.openLink(siteUrl);
        } else {
            // В обычном браузере открываем в новой вкладке
            window.open(siteUrl, '_blank');
        }
    }

    async loadAdmins() {
        const listContent = document.getElementById('tgAdminAdminsListContent');
        if (!listContent) return;
        
        try {
            // Показываем индикатор загрузки
            listContent.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Загрузка...</p>';
            
            const response = await this.fetchWithTimeout('/api/admin-users', {
                headers: {
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                }
            }, 10000);
            
            if (!response.ok) {
                throw new Error('Failed to fetch admins');
            }
            
            const admins = await response.json();
            
            if (admins.length === 0) {
                listContent.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Нет админов</p>';
                return;
            }
            
            listContent.innerHTML = admins.map(admin => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">
                            ${admin.type === 'telegram' ? `Telegram ID: ${admin.id}` : `Username: ${admin.username}`}
                        </div>
                        <div style="font-size: 12px; color: #999;">
                            Добавлен: ${new Date(admin.addedAt).toLocaleDateString('ru-RU')}
                        </div>
                    </div>
                    <button type="button" class="tg-admin-delete-btn" data-admin-id="${admin.type === 'telegram' ? admin.id : admin.username}" data-admin-type="${admin.type}" style="background: #ff4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Удалить
                    </button>
                </div>
            `).join('');
            
            // Add delete handlers
            listContent.querySelectorAll('.tg-admin-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => this.deleteAdmin(btn.dataset.adminId, btn.dataset.adminType));
            });
        } catch (error) {
            console.error('Error loading admins:', error);
            if (listContent) {
                listContent.innerHTML = '<p style="color: #ff4444; text-align: center; padding: 20px;">Ошибка загрузки админов</p>';
            }
        }
    }

    async handleAdminSubmit() {
        const type = document.getElementById('tgAdminType').value;
        const id = document.getElementById('tgAdminId')?.value.trim();
        const username = document.getElementById('tgAdminUsername')?.value.trim();
        
        if (!type) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Выберите тип админа');
            }
            return;
        }
        
        if (type === 'telegram' && !id) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Введите Telegram ID');
            }
            return;
        }
        
        if (type === 'website' && !username) {
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Введите username');
            }
            return;
        }
        
        try {
            const response = await fetch('/api/admin-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify({
                    type,
                    id: type === 'telegram' ? id : undefined,
                    username: type === 'website' ? username : undefined
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при добавлении админа');
            }
            
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Админ добавлен');
                window.telegramWebApp.hapticFeedback('success');
            }
            
            // Reset form
            document.getElementById('tgAdminType').value = '';
            document.getElementById('tgAdminId').value = '';
            document.getElementById('tgAdminUsername').value = '';
            document.getElementById('tgAdminIdField').style.display = 'none';
            document.getElementById('tgAdminUsernameField').style.display = 'none';
            
            // Reload admins list
            this.loadAdmins();
        } catch (error) {
            console.error('Error adding admin:', error);
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification(error.message || 'Ошибка при добавлении админа');
                window.telegramWebApp.hapticFeedback('error');
            }
        }
    }

    async deleteAdmin(adminId, adminType) {
        if (!confirm(`Удалить админа ${adminType === 'telegram' ? adminId : adminId}?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin-users/${adminId}`, {
                method: 'DELETE',
                headers: {
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при удалении админа');
            }
            
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Админ удален');
                window.telegramWebApp.hapticFeedback('success');
            }
            
            // Reload admins list
            this.loadAdmins();
        } catch (error) {
            console.error('Error deleting admin:', error);
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification(error.message || 'Ошибка при удалении админа');
                window.telegramWebApp.hapticFeedback('error');
            }
        }
    }

    async handleDesignSubmit() {
        const logoFiles = document.getElementById('tgLogoImage').files;
        const loadingScreenFile = document.getElementById('tgLoadingScreenImage').files[0];
        const backgroundFile = document.getElementById('tgBackgroundImage').files[0];
        const rouletteCoverFile = document.getElementById('tgRouletteCoverImage').files[0];
        console.log('📤 Starting design submit...');
        console.log('📁 Catalog cover entries:', this.catalogCoverState.length);

        const rouletteBannerMedia = await this.prepareRouletteBannerMedia();
        
        try {
            let logoImages = [];
            let loadingScreenUrl = null;
            let backgroundUrl = null;
            let rouletteCoverUrl = null;
            let catalogCovers = [];
            
            // Обрабатываем логотипы (может быть несколько) - изображения и видео
            if (logoFiles && logoFiles.length > 0) {
                for (const logoFile of Array.from(logoFiles)) {
                    const isVideo = logoFile.type.startsWith('video/');
                    
                    // Валидация видео
                    if (isVideo) {
                        try {
                            await this.validateVideo(logoFile);
                        } catch (error) {
                            if (window.telegramWebApp) {
                                window.telegramWebApp.showNotification(error.message);
                            }
                            continue; // Пропускаем невалидное видео
                        }
                    }
                    
                    let logoUrl = null;
                    if (isVideo) {
                        // Для видео загружаем на сервер
                        try {
                            const formData = new FormData();
                            formData.append('video', logoFile);
                            
                            const headers = {};
                            // Для miniapp используем специальные заголовки
                            if (this.userId) {
                                headers['X-MiniApp-User-Id'] = this.userId;
                                headers['X-MiniApp-Admin-Key'] = 'salik-miniapp-admin-8222800886';
                            }
                            
                            const uploadResponse = await fetch('/api/upload-video', {
                                method: 'POST',
                                headers: headers,
                                body: formData
                            });
                            
                            if (uploadResponse.ok) {
                                const uploadData = await uploadResponse.json();
                                logoUrl = uploadData.url;
                            } else {
                                // Fallback to base64 если загрузка не удалась
                                const reader = new FileReader();
                                logoUrl = await new Promise((resolve) => {
                                    reader.onloadend = () => resolve(reader.result);
                                    reader.readAsDataURL(logoFile);
                                });
                            }
                        } catch (error) {
                            console.error('Error uploading video:', error);
                            // Fallback to base64
                            const reader = new FileReader();
                            logoUrl = await new Promise((resolve) => {
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(logoFile);
                            });
                        }
                    } else if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                        const logoData = await window.imageManager.processImage(logoFile);
                        logoUrl = logoData.url || logoData.data || logoData;
                    } else {
                        // Fallback to base64
                        const reader = new FileReader();
                        logoUrl = await new Promise((resolve) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(logoFile);
                        });
                    }
                    if (logoUrl) logoImages.push({ url: logoUrl, type: isVideo ? 'video' : 'image' });
                }
            }
            
            // Обрабатываем изображение/видео загрузочного экрана
            if (loadingScreenFile) {
                const isVideo = loadingScreenFile.type.startsWith('video/');
                
                if (isVideo) {
                    // Для видео загружаем на сервер
                    try {
                        const formData = new FormData();
                        formData.append('video', loadingScreenFile);
                        
                        const headers = {};
                        if (this.userId) {
                            headers['X-MiniApp-User-Id'] = this.userId;
                            headers['X-MiniApp-Admin-Key'] = 'salik-miniapp-admin-8222800886';
                        }
                        
                        const uploadResponse = await fetch('/api/upload-video', {
                            method: 'POST',
                            headers: headers,
                            body: formData
                        });
                        
                        if (uploadResponse.ok) {
                            const uploadData = await uploadResponse.json();
                            loadingScreenUrl = uploadData.url;
                        } else {
                            // Fallback to base64
                            const reader = new FileReader();
                            loadingScreenUrl = await new Promise((resolve) => {
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(loadingScreenFile);
                            });
                        }
                    } catch (error) {
                        console.error('Error uploading loading screen video:', error);
                        // Fallback to base64
                        const reader = new FileReader();
                        loadingScreenUrl = await new Promise((resolve) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(loadingScreenFile);
                        });
                    }
                } else if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                    const loadingScreenData = await window.imageManager.processImage(loadingScreenFile);
                    loadingScreenUrl = loadingScreenData.url || loadingScreenData.data || loadingScreenData;
                } else {
                    // Fallback to base64
                    const reader = new FileReader();
                    loadingScreenUrl = await new Promise((resolve) => {
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(loadingScreenFile);
                    });
                }
            }
            
            // Обрабатываем фон
            if (backgroundFile) {
                if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                    const backgroundData = await window.imageManager.processImage(backgroundFile);
                    backgroundUrl = backgroundData.url || backgroundData.data || backgroundData;
                } else {
                    // Fallback to base64
                    const reader = new FileReader();
                    backgroundUrl = await new Promise((resolve) => {
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(backgroundFile);
                    });
                }
            }

            // Обрабатываем обложку страницы рулетки
            if (rouletteCoverFile) {
                if (window.imageManager && typeof window.imageManager.processImage === 'function') {
                    const rouletteCoverData = await window.imageManager.processImage(rouletteCoverFile);
                    rouletteCoverUrl = rouletteCoverData.url || rouletteCoverData.data || rouletteCoverData;
                } else {
                    const reader = new FileReader();
                    rouletteCoverUrl = await new Promise((resolve) => {
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(rouletteCoverFile);
                    });
                }
            }
            
            // Обрабатываем обложки каталога (может быть несколько) - изображения и видео
            if (this.catalogCoverState.length > 0) {
                for (const entry of this.catalogCoverState) {
                    if (entry.source === 'existing' && entry.data?.url) {
                        catalogCovers.push({
                            url: entry.data.url,
                            type: entry.data.type || entry.mediaType || 'image'
                        });
                        continue;
                    }

                    if (entry.source === 'file' && entry.file) {
                        const processedCover = await this.processCatalogCoverFile(entry.file);
                        if (processedCover) {
                            catalogCovers.push(processedCover);
                            entry.source = 'existing';
                            entry.data = processedCover;
                            entry.mediaType = processedCover.type || 'image';
                            entry.previewUrl = processedCover.url;
                            entry.revokeOnRemove = false;
                            entry.file = null;
                        } else {
                            console.error('❌ Failed to process catalog cover from state');
                        }
                    }
                }
                console.log('📊 Total catalog covers prepared:', catalogCovers.length);
            } else {
                console.log('⚠️ No catalog cover entries to process');
            }
            
            // Загружаем текущие настройки
            const currentSettings = await this.getDesignSettings();
            
            // Сохраняем настройки
            const settings = {
                logoImages: logoImages.length > 0 ? logoImages : (currentSettings.logoImages || []),
                loadingScreenImage: loadingScreenUrl || currentSettings.loadingScreenImage || null,
                backgroundImage: backgroundUrl || currentSettings.backgroundImage || null,
                rouletteCoverImage: rouletteCoverUrl || currentSettings.rouletteCoverImage || null,
                catalogCovers: catalogCovers.length > 0 ? catalogCovers : [],
                rouletteBannerMedia: rouletteBannerMedia || currentSettings.rouletteBannerMedia || null
            };
            
            console.log('📋 Current settings before save:', {
                logoImages: currentSettings.logoImages?.length || 0,
                catalogCovers: currentSettings.catalogCovers?.length || 0,
                newCatalogCovers: catalogCovers.length
            });
            
            // Если загружены новые изображения, заменяем старые
            if (logoImages.length > 0) {
                settings.logoImages = logoImages;
                console.log('✅ Saving new logo images:', logoImages.length);
            }
            if (catalogCovers.length > 0) {
                settings.catalogCovers = catalogCovers;
                console.log('✅ Saving catalog covers:', catalogCovers.length, 'items');
            } else {
                settings.catalogCovers = [];
                console.log('ℹ️ No catalog covers in state, clearing remote value');
            }
            
            // Удаляем null значения и старые форматы
            if (!settings.loadingScreenImage) delete settings.loadingScreenImage;
            if (!settings.backgroundImage) delete settings.backgroundImage;
            if (!settings.rouletteCoverImage) delete settings.rouletteCoverImage;
            if (settings.catalogCovers && settings.catalogCovers.length === 0) delete settings.catalogCovers;
            // Удаляем старый формат catalogCover если есть
            if (settings.catalogCover) delete settings.catalogCover;
            if (settings.logoImages && settings.logoImages.length === 0) delete settings.logoImages;
            if (!settings.rouletteBannerMedia) delete settings.rouletteBannerMedia;
            
            // Сохраняем настройки на сервере
            let serverSaveSuccess = false;
            try {
                console.log('📤 Sending design settings to server:', JSON.stringify(settings, null, 2));
                const response = await fetch('/api/telegram/design-settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-MiniApp-User-Id': this.userId || '',
                        'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                    },
                    body: JSON.stringify(settings)
                });
                
                if (response.ok) {
                    console.log('✅ Design settings saved to server');
                    serverSaveSuccess = true;
                } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to save design settings to server:', response.status, errorText);
                }
            } catch (error) {
                console.error('❌ Error saving design settings to server:', error);
            }
            
            // Сохраняем в localStorage
            localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));
            console.log('💾 Settings saved to localStorage:', settings);
            
            // Применяем настройки
            this.applyDesignSettings(settings);
            
            // Обновляем превью БЕЗ перезагрузки с сервера (чтобы не потерять данные)
            this.updateDesignPreview(settings);
            this.setCatalogCoverStateFromArray(settings.catalogCovers || []);
            
            // Принудительно обновляем каталог если он открыт
            setTimeout(() => {
                if (window.telegramCatalog) {
                    window.telegramCatalog.loadCatalogCover();
                    window.telegramCatalog.renderBrands();
                }
            }, 100);
            
            const statusEl = document.getElementById('tgAdminStatus');
            if (statusEl) statusEl.textContent = serverSaveSuccess ? 'Контент сохранен' : 'Сохранено локально. Ошибка сервера.';
            if (window.telegramWebApp) {
                window.telegramWebApp.hapticFeedback(serverSaveSuccess ? 'success' : 'warning');
            }
            
            // Очищаем поля ввода файлов
            document.getElementById('tgLogoImage').value = '';
            document.getElementById('tgLoadingScreenImage').value = '';
            document.getElementById('tgBackgroundImage').value = '';
            document.getElementById('tgRouletteCoverImage').value = '';
            document.getElementById('tgCatalogCover').value = '';
            const rouletteBannerInput = document.getElementById('tgRouletteBannerImage');
            if (rouletteBannerInput) rouletteBannerInput.value = '';
        } catch (error) {
            console.error('Error saving design:', error);
            const statusEl = document.getElementById('tgAdminStatus');
            if (statusEl) statusEl.textContent = 'Ошибка при сохранении дизайна';
            if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('error');
        }
    }

    async getDesignSettings() {
        try {
            // Сначала пытаемся загрузить с сервера
            try {
                const response = await this.fetchWithTimeout('/api/telegram/design-settings', {}, 10000);
                if (response.ok) {
                    const serverSettings = await response.json();
                    // Синхронизируем с localStorage
                    localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(serverSettings));
                    return serverSettings;
                }
            } catch (serverError) {
                console.warn('⚠️ Failed to load design settings from server, using localStorage:', serverError);
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem('tg_miniapp_design_settings');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading design settings:', error);
            return {};
        }
    }

    async loadDesignSettings() {
        const settings = await this.getDesignSettings();
        
        // Показываем превью логотипов (может быть массив)
        const logoImages = settings.logoImages || (settings.logoImage ? [settings.logoImage] : []);
        if (logoImages.length > 0) {
            const preview = document.getElementById('tgLogoImagePreview');
            const removeBtn = document.getElementById('tgLogoImageRemoveBtn');
            if (preview) {
                preview.innerHTML = '';
                logoImages.forEach((logoItem, index) => {
                    // Обрабатываем как старый формат (строка), так и новый (объект с url)
                    const logoUrl = typeof logoItem === 'string' ? logoItem : (logoItem?.url || '');
                    if (!logoUrl || typeof logoUrl !== 'string') {
                        console.warn('⚠️ Invalid logo URL:', logoItem);
                        return; // Пропускаем невалидный элемент
                    }
                    
                    const item = document.createElement('div');
                    item.className = 'tg-admin-image-item';
                    item.style.position = 'relative';
                    item.innerHTML = `
                        <img src="${logoUrl}" alt="logo preview ${index + 1}" style="max-width: 100%; height: auto;" />
                        <span style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${index + 1}</span>
                    `;
                    preview.appendChild(item);
                });
            }
            if (removeBtn) removeBtn.style.display = 'block';
        }
        
        // Показываем превью изображения загрузочного экрана
        if (settings.loadingScreenImage) {
            const preview = document.getElementById('tgLoadingScreenImagePreview');
            const removeBtn = document.getElementById('tgLoadingScreenImageRemoveBtn');
            if (preview) {
                preview.innerHTML = '';
                const loadingScreenUrl = typeof settings.loadingScreenImage === 'string' 
                    ? settings.loadingScreenImage 
                    : (settings.loadingScreenImage?.url || '');
                
                if (loadingScreenUrl && typeof loadingScreenUrl === 'string') {
                    const item = document.createElement('div');
                    item.className = 'tg-admin-image-item';
                    item.innerHTML = `<img src="${loadingScreenUrl}" alt="loading screen preview" style="max-width: 200px; height: auto;" />`;
                    preview.appendChild(item);
                }
            }
            if (removeBtn) removeBtn.style.display = 'block';
        }
        
        // Показываем превью фона
        if (settings.backgroundImage) {
            const preview = document.getElementById('tgBackgroundImagePreview');
            const removeBtn = document.getElementById('tgBackgroundImageRemoveBtn');
            if (preview) {
                preview.innerHTML = '';
                // Проверяем, что backgroundImage - это строка, а не объект
                const backgroundUrl = typeof settings.backgroundImage === 'string' 
                    ? settings.backgroundImage 
                    : (settings.backgroundImage?.url || '');
                
                if (backgroundUrl && typeof backgroundUrl === 'string') {
                    const item = document.createElement('div');
                    item.className = 'tg-admin-image-item';
                    item.innerHTML = `<img src="${backgroundUrl}" alt="background preview" style="max-width: 100%; height: auto;" />`;
                    preview.appendChild(item);
                }
            }
            if (removeBtn) removeBtn.style.display = 'block';
        }

        // Показываем превью обложки страницы рулетки
        if (settings.rouletteCoverImage) {
            const preview = document.getElementById('tgRouletteCoverImagePreview');
            const removeBtn = document.getElementById('tgRouletteCoverImageRemoveBtn');
            const coverUrl = typeof settings.rouletteCoverImage === 'string'
                ? settings.rouletteCoverImage
                : (settings.rouletteCoverImage?.url || '');

            if (preview) {
                preview.innerHTML = '';
                if (coverUrl && typeof coverUrl === 'string') {
                    const item = document.createElement('div');
                    item.className = 'tg-admin-image-item';
                    item.innerHTML = `<img src="${coverUrl}" alt="roulette cover preview" style="max-width: 100%; height: auto;" />`;
                    preview.appendChild(item);
                }
            }
            if (removeBtn) removeBtn.style.display = coverUrl ? 'block' : 'none';
        }
        
        // Показываем превью обложек каталога (может быть массив)
        const catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
        this.setCatalogCoverStateFromArray(catalogCovers);

        // Обновляем обложку рулетки
        this.setRouletteBannerStateFromSettings(settings.rouletteBannerMedia || null);
        
        // Применяем настройки к странице
        this.applyDesignSettings(settings);
    }

    // Обновление превью без загрузки с сервера (используется после сохранения)
    updateDesignPreview(settings) {
        // Sync mini app title input
        const miniAppTitleInput = document.getElementById('tgMiniAppTitle');
        if (miniAppTitleInput) {
            miniAppTitleInput.value = (settings && typeof settings.miniAppTitle === 'string') ? settings.miniAppTitle : '';
        }

        // Показываем превью логотипов
        const logoImages = settings.logoImages || [];
        const logoPreview = document.getElementById('tgLogoImagePreview');
        const logoRemoveBtn = document.getElementById('tgLogoImageRemoveBtn');
        if (logoPreview) {
            logoPreview.innerHTML = '';
            logoImages.forEach((logoItem, index) => {
                const logoUrl = typeof logoItem === 'string' ? logoItem : (logoItem?.url || '');
                if (!logoUrl) return;
                const item = document.createElement('div');
                item.className = 'tg-admin-image-item';
                item.style.position = 'relative';
                item.innerHTML = `
                    <img src="${logoUrl}" alt="logo preview ${index + 1}" style="max-width: 100%; height: auto;" />
                    <span style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${index + 1}</span>
                `;
                logoPreview.appendChild(item);
            });
        }
        if (logoRemoveBtn) logoRemoveBtn.style.display = logoImages.length > 0 ? 'block' : 'none';
        
        // Показываем превью фона
        const backgroundPreview = document.getElementById('tgBackgroundImagePreview');
        const backgroundRemoveBtn = document.getElementById('tgBackgroundImageRemoveBtn');
        if (backgroundPreview && settings.backgroundImage) {
            const backgroundUrl = typeof settings.backgroundImage === 'string' 
                ? settings.backgroundImage : (settings.backgroundImage?.url || '');
            if (backgroundUrl) {
                backgroundPreview.innerHTML = `<div class="tg-admin-image-item"><img src="${backgroundUrl}" alt="background preview" style="max-width: 100%; height: auto;" /></div>`;
            }
        }
        if (backgroundRemoveBtn) backgroundRemoveBtn.style.display = settings.backgroundImage ? 'block' : 'none';

        // Превью обложки страницы рулетки
        const rouletteCoverPreview = document.getElementById('tgRouletteCoverImagePreview');
        const rouletteCoverRemoveBtn = document.getElementById('tgRouletteCoverImageRemoveBtn');
        if (rouletteCoverPreview && settings.rouletteCoverImage) {
            const coverUrl = typeof settings.rouletteCoverImage === 'string'
                ? settings.rouletteCoverImage
                : (settings.rouletteCoverImage?.url || '');
            if (coverUrl) {
                rouletteCoverPreview.innerHTML = `<div class="tg-admin-image-item"><img src="${coverUrl}" alt="roulette cover preview" style="max-width: 100%; height: auto;" /></div>`;
            }
        }
        if (rouletteCoverRemoveBtn) rouletteCoverRemoveBtn.style.display = settings.rouletteCoverImage ? 'block' : 'none';
        
        const catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
        this.setCatalogCoverStateFromArray(catalogCovers);
        
        console.log('✅ Design preview updated:', {
            logoImages: logoImages.length,
            hasBackground: !!settings.backgroundImage,
            catalogCovers: catalogCovers.length
        });
    }

    async loadCheckoutSettings() {
        try {
            const response = await fetch('/api/settings/checkout');
            const settings = await response.json();
            
            const pickupAddressInput = document.getElementById('tgCheckoutPickupAddress');
            const telegramLinkInput = document.getElementById('tgCheckoutTelegramLink');
            const maxLinkInput = document.getElementById('tgCheckoutMaxLink');
            const vkLinkInput = document.getElementById('tgCheckoutVkLink');
            
            if (pickupAddressInput) {
                pickupAddressInput.value = settings.pickupAddress || '';
            }
            if (telegramLinkInput) {
                telegramLinkInput.value = settings.telegramLink || '';
            }
            if (maxLinkInput) {
                maxLinkInput.value = settings.maxLink || '';
            }
            if (vkLinkInput) {
                vkLinkInput.value = settings.vkLink || '';
            }
        } catch (error) {
            console.error('Error loading checkout settings:', error);
        }
    }

    async handleCheckoutSubmit() {
        const pickupAddress = document.getElementById('tgCheckoutPickupAddress').value.trim();
        const telegramLink = document.getElementById('tgCheckoutTelegramLink').value.trim();
        const maxLink = document.getElementById('tgCheckoutMaxLink').value.trim();
        const vkLink = document.getElementById('tgCheckoutVkLink').value.trim();
        
        if (!telegramLink) {
            this.showStatus('Ссылка Telegram обязательна', 'error');
            return;
        }
        
        const settings = {
            pickupAddress,
            telegramLink,
            maxLink,
            vkLink
        };
        
        try {
            const response = await fetch('/api/settings/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save checkout settings');
            }
            
            this.showStatus('Настройки оформления сохранены', 'success');
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Настройки оформления сохранены');
                window.telegramWebApp.hapticFeedback('success');
            }
            
            // Reload checkout page settings if it's open
            if (window.telegramCheckout) {
                window.telegramCheckout.loadSettings();
            }
        } catch (error) {
            console.error('Error saving checkout settings:', error);
            this.showStatus('Ошибка при сохранении настроек', 'error');
        }
    }

    applyDesignSettings(settings) {
        // Применяем логотипы к элементу .tg-logo-content (может быть массив)
        const logoContent = document.querySelector('.tg-logo-content');
        if (logoContent) {
            const logoImages = settings.logoImages || (settings.logoImage ? [settings.logoImage] : []);
            
            if (logoImages.length > 0) {
                // Нормализуем массив изображений (извлекаем URL из объектов)
                const normalizedLogoImages = logoImages.map(item => {
                    if (typeof item === 'string') return item;
                    return item.url || item;
                });
                
                // Сохраняем массив изображений в data-атрибут
                logoContent.setAttribute('data-logo-images', JSON.stringify(normalizedLogoImages));
                logoContent.setAttribute('data-current-index', '0');
                
                // Применяем первое изображение
                const firstLogoUrl = normalizedLogoImages[0];
                if (firstLogoUrl && typeof firstLogoUrl === 'string') {
                    logoContent.style.backgroundImage = `url(${firstLogoUrl})`;
                    logoContent.style.backgroundSize = 'cover';
                    logoContent.style.backgroundPosition = 'center';
                    logoContent.style.backgroundRepeat = 'no-repeat';
                    logoContent.style.aspectRatio = '16 / 9';
                }
                
                // Инициализируем листание если еще не инициализировано
                if (!logoContent.hasAttribute('data-swipe-initialized')) {
                    this.initLogoSwipe(logoContent);
                }
            } else {
                logoContent.removeAttribute('data-logo-images');
                logoContent.removeAttribute('data-current-index');
                logoContent.style.backgroundImage = '';
                logoContent.style.backgroundSize = '';
                logoContent.style.backgroundPosition = '';
                logoContent.style.backgroundRepeat = '';
                logoContent.style.aspectRatio = '';
            }
        }
        
        // Применяем фон к элементам html и body
        const htmlElement = document.documentElement;
        const bodyElement = document.body;
        
        if (settings.backgroundImage) {
            // Проверяем, что backgroundImage - это строка, а не объект
            const backgroundUrl = typeof settings.backgroundImage === 'string' 
                ? settings.backgroundImage 
                : (settings.backgroundImage?.url || '');
            
            if (backgroundUrl && typeof backgroundUrl === 'string') {
                // Применяем к html - фон на всю ширину и высоту устройства
                if (htmlElement) {
                    htmlElement.style.setProperty('background-image', `url(${backgroundUrl})`, 'important');
                    htmlElement.style.setProperty('background-size', 'cover', 'important'); // Покрывает всю ширину и высоту
                    htmlElement.style.setProperty('background-position', 'center center', 'important');
                    htmlElement.style.setProperty('background-repeat', 'no-repeat', 'important'); // Без повторения
                    htmlElement.style.setProperty('background-attachment', 'fixed', 'important');
                    htmlElement.style.setProperty('min-height', '100vh', 'important');
                }
                // Применяем к body для надежности
                if (bodyElement) {
                    bodyElement.style.setProperty('background-image', `url(${backgroundUrl})`, 'important');
                    bodyElement.style.setProperty('background-size', 'cover', 'important'); // Покрывает всю ширину и высоту
                    bodyElement.style.setProperty('background-position', 'center center', 'important');
                    bodyElement.style.setProperty('background-repeat', 'no-repeat', 'important'); // Без повторения
                    bodyElement.style.setProperty('background-attachment', 'fixed', 'important');
                    bodyElement.style.setProperty('min-height', '100vh', 'important');
                }
            }
        } else {
            // Удаляем фон
            if (htmlElement) {
                htmlElement.style.removeProperty('background-image');
                htmlElement.style.removeProperty('background-size');
                htmlElement.style.removeProperty('background-position');
                htmlElement.style.removeProperty('background-repeat');
                htmlElement.style.removeProperty('background-attachment');
                htmlElement.style.removeProperty('min-height');
            }
            if (bodyElement) {
                bodyElement.style.removeProperty('background-image');
                bodyElement.style.removeProperty('background-size');
                bodyElement.style.removeProperty('background-position');
                bodyElement.style.removeProperty('background-repeat');
                bodyElement.style.removeProperty('background-attachment');
                bodyElement.style.removeProperty('min-height');
            }
        }
        
        // Сохраняем обложки каталога в глобальную переменную для использования в каталоге (может быть массив)
        const catalogCovers = settings.catalogCovers || (settings.catalogCover ? [settings.catalogCover] : []);
        if (catalogCovers.length > 0) {
            // Нормализуем обложки (извлекаем URL из объектов)
            const normalizedCovers = catalogCovers.map(item => {
                if (typeof item === 'string') return item;
                return item.url || item;
            });
            
            window.catalogCoverImages = normalizedCovers;
            window.catalogCoverImage = normalizedCovers[0]; // Первая обложка по умолчанию
            window.catalogCoverCurrentIndex = 0;
            console.log('✅ Catalog covers set in applyDesignSettings:', normalizedCovers.length);
        } else {
            delete window.catalogCoverImages;
            delete window.catalogCoverImage;
            delete window.catalogCoverCurrentIndex;
            console.log('ℹ️ Catalog covers removed in applyDesignSettings');
        }
        
        // Обновляем каталог если он открыт
        setTimeout(() => {
            if (window.telegramCatalog && window.telegramCatalog.renderBrands) {
                window.telegramCatalog.loadCatalogCover();
                window.telegramCatalog.renderBrands();
            }
        }, 100);

        if (settings.rouletteBannerMedia && settings.rouletteBannerMedia.url) {
            window.telegramRouletteBannerMedia = settings.rouletteBannerMedia;
        } else {
            delete window.telegramRouletteBannerMedia;
        }
    }

    async removeLogoImage() {
        const settings = await this.getDesignSettings();
        delete settings.logoImage;
        delete settings.logoImages;
        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));
        
        // Сохраняем на сервере
        try {
            const response = await fetch('/api/telegram/design-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('✅ Design settings updated on server');
            }
        } catch (error) {
            console.error('❌ Error updating design settings on server:', error);
        }
        
        const preview = document.getElementById('tgLogoImagePreview');
        const removeBtn = document.getElementById('tgLogoImageRemoveBtn');
        const input = document.getElementById('tgLogoImage');
        
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (input) input.value = '';
        
        this.applyDesignSettings(settings);
        
        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification('Все фото удалены');
            window.telegramWebApp.hapticFeedback('success');
        }
    }
    
    initLogoSwipe(logoContent) {
        if (logoContent.hasAttribute('data-swipe-initialized')) return;
        logoContent.setAttribute('data-swipe-initialized', 'true');
        
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        const handleStart = (e) => {
            isDragging = true;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            logoContent.style.transition = 'none';
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            currentX = e.touches ? e.touches[0].clientX : e.clientX;
        };
        
        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            logoContent.style.transition = 'background-image 0.3s ease';
            
            const diff = startX - currentX;
            const threshold = 50;
            
            if (Math.abs(diff) > threshold) {
                const images = JSON.parse(logoContent.getAttribute('data-logo-images') || '[]');
                let currentIndex = parseInt(logoContent.getAttribute('data-current-index') || '0');
                
                if (diff > 0 && currentIndex < images.length - 1) {
                    // Свайп влево - следующее изображение
                    currentIndex++;
                } else if (diff < 0 && currentIndex > 0) {
                    // Свайп вправо - предыдущее изображение
                    currentIndex--;
                }
                
                    if (currentIndex >= 0 && currentIndex < images.length) {
                        const imageUrl = images[currentIndex];
                        // Проверяем, что это строка, а не объект
                        const url = typeof imageUrl === 'string' ? imageUrl : (imageUrl?.url || '');
                        if (url) {
                            logoContent.setAttribute('data-current-index', currentIndex.toString());
                            logoContent.style.backgroundImage = `url(${url})`;
                            
                            if (window.telegramWebApp) {
                                window.telegramWebApp.hapticFeedback('light');
                            }
                        }
                    }
            }
        };
        
        logoContent.addEventListener('touchstart', handleStart);
        logoContent.addEventListener('touchmove', handleMove);
        logoContent.addEventListener('touchend', handleEnd);
        logoContent.addEventListener('mousedown', handleStart);
        logoContent.addEventListener('mousemove', handleMove);
        logoContent.addEventListener('mouseup', handleEnd);
        logoContent.addEventListener('mouseleave', handleEnd);
        
        // Добавляем курсор pointer для индикации интерактивности
        logoContent.style.cursor = 'pointer';
    }

    async removeLoadingScreenImage() {
        const settings = await this.getDesignSettings();
        delete settings.loadingScreenImage;
        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));
        
        // Сохраняем на сервере
        try {
            const response = await fetch('/api/telegram/design-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('✅ Design settings updated on server');
            }
        } catch (error) {
            console.error('❌ Error updating design settings on server:', error);
        }
        
        const preview = document.getElementById('tgLoadingScreenImagePreview');
        const removeBtn = document.getElementById('tgLoadingScreenImageRemoveBtn');
        const input = document.getElementById('tgLoadingScreenImage');
        
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (input) input.value = '';
        
        this.applyDesignSettings(settings);
        
        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification('Изображение загрузочного экрана удалено');
            window.telegramWebApp.hapticFeedback('success');
        }
    }

    async removeBackgroundImage() {
        const settings = await this.getDesignSettings();
        delete settings.backgroundImage;
        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));
        
        // Сохраняем на сервере
        try {
            const response = await fetch('/api/telegram/design-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('✅ Design settings updated on server');
            }
        } catch (error) {
            console.error('❌ Error updating design settings on server:', error);
        }
        
        const preview = document.getElementById('tgBackgroundImagePreview');
        const removeBtn = document.getElementById('tgBackgroundImageRemoveBtn');
        const input = document.getElementById('tgBackgroundImage');
        
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (input) input.value = '';
        
        this.applyDesignSettings(settings);
        
        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification('Фон удален');
            window.telegramWebApp.hapticFeedback('success');
        }
    }

    async removeRouletteCoverImage() {
        const settings = await this.getDesignSettings();
        delete settings.rouletteCoverImage;
        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));

        try {
            const response = await fetch('/api/telegram/design-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('✅ Design settings updated on server');
            }
        } catch (error) {
            console.error('❌ Error updating design settings on server:', error);
        }

        const preview = document.getElementById('tgRouletteCoverImagePreview');
        const removeBtn = document.getElementById('tgRouletteCoverImageRemoveBtn');
        const input = document.getElementById('tgRouletteCoverImage');
        if (preview) preview.innerHTML = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (input) input.value = '';

        this.applyDesignSettings(settings);

        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification('Обложка рулетки удалена');
            window.telegramWebApp.hapticFeedback('success');
        }
    }

    async removeCatalogCover() {
        this.setCatalogCoverStateFromArray([]);
        const input = document.getElementById('tgCatalogCover');
        if (input) input.value = '';

        const settings = await this.getDesignSettings();
        delete settings.catalogCover;
        delete settings.catalogCovers;
        localStorage.setItem('tg_miniapp_design_settings', JSON.stringify(settings));
        
        try {
            const response = await fetch('/api/telegram/design-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-MiniApp-User-Id': this.userId || '',
                    'X-MiniApp-Admin-Key': 'salik-miniapp-admin-8222800886'
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('✅ Design settings updated on server');
            }
        } catch (error) {
            console.error('❌ Error updating design settings on server:', error);
        }

        this.applyDesignSettings(settings);

        setTimeout(() => {
            if (window.telegramCatalog) {
                window.telegramCatalog.loadCatalogCover();
                window.telegramCatalog.renderBrands();
            }
        }, 100);

        if (window.telegramWebApp) {
            window.telegramWebApp.showNotification('Все обложки каталога удалены');
            window.telegramWebApp.hapticFeedback('success');
        }
    }

    generateCatalogCoverId() {
        this._catalogCoverIdCounter += 1;
        return `catalog-cover-${this._catalogCoverIdCounter}`;
    }

    detectMediaTypeFromUrl(url) {
        if (!url || typeof url !== 'string') return 'image';
        return (url.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)$/i.test(url)) ? 'video' : 'image';
    }

    normalizeRouletteBannerData(media) {
        if (!media) return null;
        if (typeof media === 'string') {
            return { url: media, type: this.detectMediaTypeFromUrl(media) };
        }
        const url = media.url || '';
        if (!url) return null;
        const type = media.type || this.detectMediaTypeFromUrl(url);
        return { url, type };
    }

    setCatalogCoverStateFromArray(catalogCovers = []) {
        this.catalogCoverState.forEach(entry => {
            if (entry.revokeOnRemove && entry.previewUrl) {
                URL.revokeObjectURL(entry.previewUrl);
            }
        });

        this.catalogCoverState = [];
        catalogCovers.forEach((cover) => {
            const url = typeof cover === 'string' ? cover : (cover?.url || '');
            if (!url) return;
            const type = typeof cover === 'object' ? (cover?.type || this.detectMediaTypeFromUrl(url)) : this.detectMediaTypeFromUrl(url);
            this.catalogCoverState.push({
                id: this.generateCatalogCoverId(),
                source: 'existing',
                data: { url, type },
                mediaType: type,
                previewUrl: url,
                revokeOnRemove: false
            });
        });

        this.updateCatalogCoverPreview();
        const removeBtn = document.getElementById('tgCatalogCoverRemoveBtn');
        if (removeBtn) removeBtn.style.display = this.catalogCoverState.length > 0 ? 'block' : 'none';
    }

    updateCatalogCoverPreview() {
        const preview = document.getElementById('tgCatalogCoverPreview');
        if (!preview) return;

        if (this.catalogCoverState.length === 0) {
            preview.innerHTML = '<p class="tg-admin-empty-placeholder">Нет обложек. Загрузите файлы, чтобы они появились в каталоге.</p>';
            return;
        }

        preview.innerHTML = this.catalogCoverState.map((entry, index) => {
            const isVideo = entry.mediaType === 'video';
            const media = isVideo
                ? `<video src="${entry.previewUrl}" muted controls playsinline></video>`
                : `<img src="${entry.previewUrl}" alt="catalog cover ${index + 1}">`;
            return `
                <div class="tg-admin-image-item tg-catalog-cover-item" data-cover-id="${entry.id}">
                    ${media}
                    <span class="tg-catalog-cover-index">#${index + 1}${isVideo ? ' · VIDEO' : ''}</span>
                    <div class="tg-catalog-cover-actions">
                        <button type="button" class="tg-catalog-cover-btn" data-cover-action="up" data-cover-id="${entry.id}" ${index === 0 ? 'disabled' : ''}>
                            ↑
                        </button>
                        <button type="button" class="tg-catalog-cover-btn" data-cover-action="down" data-cover-id="${entry.id}" ${index === this.catalogCoverState.length - 1 ? 'disabled' : ''}>
                            ↓
                        </button>
                        <button type="button" class="tg-catalog-cover-btn danger" data-cover-action="remove" data-cover-id="${entry.id}">
                            Удалить
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    handleCatalogCoverPreviewClick(event) {
        const btn = event.target.closest('[data-cover-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-cover-action');
        const coverId = btn.getAttribute('data-cover-id');
        if (!coverId) return;

        if (action === 'up') {
            this.moveCatalogCover(coverId, -1);
        } else if (action === 'down') {
            this.moveCatalogCover(coverId, 1);
        } else if (action === 'remove') {
            this.removeCatalogCoverItem(coverId);
        }
    }

    moveCatalogCover(coverId, direction) {
        const index = this.catalogCoverState.findIndex(entry => entry.id === coverId);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.catalogCoverState.length) return;
        const [entry] = this.catalogCoverState.splice(index, 1);
        this.catalogCoverState.splice(newIndex, 0, entry);
        this.updateCatalogCoverPreview();
    }

    removeCatalogCoverItem(coverId) {
        const index = this.catalogCoverState.findIndex(entry => entry.id === coverId);
        if (index === -1) return;
        const [entry] = this.catalogCoverState.splice(index, 1);
        if (entry && entry.revokeOnRemove && entry.previewUrl) {
            URL.revokeObjectURL(entry.previewUrl);
        }
        this.updateCatalogCoverPreview();
        const removeBtn = document.getElementById('tgCatalogCoverRemoveBtn');
        if (removeBtn) removeBtn.style.display = this.catalogCoverState.length > 0 ? 'block' : 'none';
    }

    async processCatalogCoverFile(coverFile) {
        if (!coverFile) return null;
        const isVideo = coverFile.type.startsWith('video/');
        if (isVideo) {
            try {
                const formData = new FormData();
                formData.append('video', coverFile);
                const headers = {};
                if (this.userId) {
                    headers['X-MiniApp-User-Id'] = this.userId;
                    headers['X-MiniApp-Admin-Key'] = 'salik-miniapp-admin-8222800886';
                }
                const uploadResponse = await fetch('/api/upload-video', {
                    method: 'POST',
                    headers,
                    body: formData
                });
                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    return { url: uploadData.url, type: 'video' };
                }
            } catch (error) {
                console.error('Error uploading catalog cover video:', error);
            }
        } else {
            try {
                const formData = new FormData();
                formData.append('image', coverFile);
                const adminToken = localStorage.getItem('adminToken');
                const headers = {};
                if (this.userId) {
                    headers['X-MiniApp-User-Id'] = this.userId;
                    headers['X-MiniApp-Admin-Key'] = 'salik-miniapp-admin-8222800886';
                }
                if (adminToken) {
                    headers['Authorization'] = 'Bearer ' + adminToken;
                }
                const uploadResponse = await fetch('/api/upload-image', {
                    method: 'POST',
                    headers,
                    body: formData
                });
                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    return { url: uploadData.url, type: 'image' };
                }
            } catch (error) {
                console.error('Error uploading catalog cover image:', error);
            }
        }

        // Fallback to base64 if upload failed
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({
                url: reader.result,
                type: isVideo ? 'video' : 'image'
            });
            reader.readAsDataURL(coverFile);
        });
    }

    getAdminHeaders() {
        const headers = {};
        if (this.userId) {
            headers['X-MiniApp-User-Id'] = this.userId;
            headers['X-MiniApp-Admin-Key'] = 'salik-miniapp-admin-8222800886';
        }
        return headers;
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('tgAdminStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = type === 'error' ? '#ff4444' : type === 'success' ? '#28a745' : '#666';
        }
        if (window.telegramWebApp) {
            window.telegramWebApp.hapticFeedback(type === 'error' ? 'error' : type === 'success' ? 'success' : 'light');
        }
    }

    // ==================== ROULETTE ADMIN ====================
    
    _rouletteSlots = [];
    _rouletteLastSlotId = 0;

    async loadRouletteConfig() {
        try {
            const headers = this.getAdminHeaders();
            const resp = await this.fetchWithTimeout('/api/roulette/config/full', { headers }, 10000);
            if (!resp.ok) throw new Error('Failed to load roulette config');
            const config = await resp.json();

            document.getElementById('tgRouletteEnabled').checked = !!config.enabled;
            document.getElementById('tgRouletteUnlimitedSpins').checked = !!config.unlimitedSpins;
            document.getElementById('tgRouletteSpinCooldown').value = config.spinCooldownHours || 24;
            document.getElementById('tgRouletteCouponDurationAdmin').value = config.couponDurationHours || 24;

            this._rouletteSlots = config.slots || [];
            this._rouletteLastSlotId = config.lastSlotId || 0;
            this.renderRouletteSlots();
        } catch (e) {
            console.error('Error loading roulette config:', e);
            this.showStatus('Ошибка загрузки настроек рулетки', 'error');
        }
    }

    renderRouletteSlots() {
        const list = document.getElementById('tgRouletteSlotsList');
        const countEl = document.getElementById('tgRouletteSlotCount');
        if (!list) return;
        if (countEl) countEl.textContent = this._rouletteSlots.length;

        if (this._rouletteSlots.length === 0) {
            list.innerHTML = '<p style="color:#999; font-size: 13px; text-align: center; padding: 16px 0;">Нет слотов. Нажмите «+ Добавить слот» чтобы начать.</p>';
            return;
        }

        list.innerHTML = this._rouletteSlots.map((slot, idx) => `
            <div class="tg-roulette-admin-slot" data-slot-index="${idx}">
                <div class="tg-roulette-admin-slot-header">
                    <span class="tg-roulette-admin-slot-num">#${idx + 1}</span>
                    <span class="tg-roulette-admin-slot-rarity rarity-${slot.rarity || 'common'}">${slot.rarity || 'common'}</span>
                    <label class="tg-admin-checkbox" style="margin-left: auto; margin-right: 8px;">
                        <input type="checkbox" class="tg-roulette-slot-active" data-idx="${idx}" ${slot.isActive !== false ? 'checked' : ''} />
                        <span style="font-size:12px;">Активен</span>
                    </label>
                    <button type="button" class="tg-roulette-slot-delete" data-idx="${idx}" title="Удалить слот" style="background:#ff4444;color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px;">✕</button>
                </div>
                <div class="tg-admin-field-group" style="margin-top:8px;">
                    <div class="tg-admin-field" style="flex:1;">
                        <label>Название</label>
                        <input type="text" class="tg-roulette-slot-name" data-idx="${idx}" value="${this.escapeAttr(slot.name || '')}" placeholder="Название приза" />
                    </div>
                    <div class="tg-admin-field" style="flex:1;">
                        <label>Приз</label>
                        <input type="text" class="tg-roulette-slot-prize" data-idx="${idx}" value="${this.escapeAttr(slot.prize || '')}" placeholder="Напр: 10% скидка" />
                    </div>
                </div>
                <div class="tg-admin-field-group" style="margin-top:4px;">
                    <div class="tg-admin-field" style="flex:1;">
                        <label>Редкость</label>
                        <select class="tg-roulette-slot-rarity-select" data-idx="${idx}">
                            <option value="common" ${slot.rarity === 'common' ? 'selected' : ''}>Обычный</option>
                            <option value="uncommon" ${slot.rarity === 'uncommon' ? 'selected' : ''}>Необычный</option>
                            <option value="rare" ${slot.rarity === 'rare' ? 'selected' : ''}>Редкий</option>
                            <option value="epic" ${slot.rarity === 'epic' ? 'selected' : ''}>Эпический</option>
                            <option value="legendary" ${slot.rarity === 'legendary' ? 'selected' : ''}>Легендарный</option>
                        </select>
                    </div>
                    <div class="tg-admin-field" style="flex:1;">
                        <label>Вес (шанс)</label>
                        <input type="number" class="tg-roulette-slot-weight" data-idx="${idx}" value="${slot.weight || 1}" min="1" max="1000" />
                        <small style="color:#999;font-size:10px;">Больше = чаще выпадает</small>
                    </div>
                </div>
                <div class="tg-admin-field" style="margin-top:4px;">
                    <label>Изображение</label>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${slot.image ? `<img src="${slot.image}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />` : ''}
                        <input type="file" class="tg-roulette-slot-image-input" data-idx="${idx}" accept="image/png,image/jpeg,image/webp" style="font-size:12px;" />
                    </div>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        list.querySelectorAll('.tg-roulette-slot-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                this._rouletteSlots.splice(idx, 1);
                this.renderRouletteSlots();
            });
        });

        list.querySelectorAll('.tg-roulette-slot-name').forEach(input => {
            input.addEventListener('change', () => {
                this._rouletteSlots[parseInt(input.dataset.idx)].name = input.value;
            });
        });

        list.querySelectorAll('.tg-roulette-slot-prize').forEach(input => {
            input.addEventListener('change', () => {
                this._rouletteSlots[parseInt(input.dataset.idx)].prize = input.value;
            });
        });

        list.querySelectorAll('.tg-roulette-slot-rarity-select').forEach(select => {
            select.addEventListener('change', () => {
                this._rouletteSlots[parseInt(select.dataset.idx)].rarity = select.value;
            });
        });

        list.querySelectorAll('.tg-roulette-slot-weight').forEach(input => {
            input.addEventListener('change', () => {
                this._rouletteSlots[parseInt(input.dataset.idx)].weight = parseInt(input.value) || 1;
            });
        });

        list.querySelectorAll('.tg-roulette-slot-active').forEach(cb => {
            cb.addEventListener('change', () => {
                this._rouletteSlots[parseInt(cb.dataset.idx)].isActive = cb.checked;
            });
        });

        list.querySelectorAll('.tg-roulette-slot-image-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const idx = parseInt(input.dataset.idx);
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const url = await this.uploadRouletteSlotImage(file);
                    this._rouletteSlots[idx].image = url;
                    this.renderRouletteSlots();
                } catch (err) {
                    this.showStatus('Ошибка загрузки изображения: ' + err.message, 'error');
                }
            });
        });
    }

    addRouletteSlot() {
        if (this._rouletteSlots.length >= 100) {
            this.showStatus('Максимум 100 слотов', 'error');
            return;
        }
        this._rouletteLastSlotId++;
        this._rouletteSlots.push({
            id: this._rouletteLastSlotId,
            name: '',
            prize: '',
            image: '',
            rarity: 'common',
            weight: 1,
            isActive: true
        });
        this.renderRouletteSlots();

        // Scroll to new slot
        setTimeout(() => {
            const list = document.getElementById('tgRouletteSlotsList');
            if (list) list.scrollTop = list.scrollHeight;
        }, 50);
    }

    async uploadRouletteSlotImage(file) {
        const formData = new FormData();
        formData.append('image', file);

        const headers = this.getAdminHeaders();
        delete headers['Content-Type']; // Let browser set for multipart

        const resp = await fetch('/api/roulette/upload-slot-image', {
            method: 'POST',
            headers,
            body: formData
        });

        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.url;
    }

    async handleRouletteSubmit() {
        // Sync latest values from inputs
        document.querySelectorAll('.tg-roulette-slot-name').forEach(input => {
            this._rouletteSlots[parseInt(input.dataset.idx)].name = input.value;
        });
        document.querySelectorAll('.tg-roulette-slot-prize').forEach(input => {
            this._rouletteSlots[parseInt(input.dataset.idx)].prize = input.value;
        });
        document.querySelectorAll('.tg-roulette-slot-rarity-select').forEach(select => {
            this._rouletteSlots[parseInt(select.dataset.idx)].rarity = select.value;
        });
        document.querySelectorAll('.tg-roulette-slot-weight').forEach(input => {
            this._rouletteSlots[parseInt(input.dataset.idx)].weight = parseInt(input.value) || 1;
        });
        document.querySelectorAll('.tg-roulette-slot-active').forEach(cb => {
            this._rouletteSlots[parseInt(cb.dataset.idx)].isActive = cb.checked;
        });

        const config = {
            enabled: document.getElementById('tgRouletteEnabled').checked,
            unlimitedSpins: document.getElementById('tgRouletteUnlimitedSpins').checked,
            spinCooldownHours: parseInt(document.getElementById('tgRouletteSpinCooldown').value) || 24,
            couponDurationHours: parseInt(document.getElementById('tgRouletteCouponDurationAdmin').value) || 24,
            slots: this._rouletteSlots,
            lastSlotId: this._rouletteLastSlotId
        };

        try {
            const headers = this.getAdminHeaders();
            headers['Content-Type'] = 'application/json';
            const resp = await this.fetchWithTimeout('/api/roulette/config', {
                method: 'POST',
                headers,
                body: JSON.stringify(config)
            }, 10000);

            if (!resp.ok) throw new Error('Failed to save');
            
            // Clear cached config so banner updates
            delete window._rouletteConfigCache;

            this.showStatus('Настройки рулетки сохранены!', 'success');
            if (window.telegramWebApp) {
                window.telegramWebApp.showNotification('Настройки рулетки сохранены');
                window.telegramWebApp.hapticFeedback('success');
            }
        } catch (e) {
            console.error('Error saving roulette config:', e);
            this.showStatus('Ошибка сохранения: ' + e.message, 'error');
        }
    }

    escapeAttr(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

let telegramAdminPage = null;

// Делаем класс доступным глобально
window.TelegramAdminPage = TelegramAdminPage;

// Функция инициализации админки (делаем её глобальной)
window.initTelegramAdminPage = async function initTelegramAdminPage() {
    try {
        console.log('🚀 Initializing TelegramAdminPage...', {
            hasTelegramWebApp: !!window.telegramWebApp,
            hasTelegramSDK: !!(window.Telegram && window.Telegram.WebApp),
            readyState: document.readyState,
            alreadyExists: !!window.telegramAdminPage
        });
        
        // Если объект уже существует и правильно инициализирован, не переинициализируем
        if (window.telegramAdminPage && 
            typeof window.telegramAdminPage === 'object' &&
            window.telegramAdminPage.hasOwnProperty('isAdmin')) {
            console.log('✅ TelegramAdminPage already initialized, skipping...');
            return window.telegramAdminPage;
        }
        
        // Проверяем, что Telegram Web App SDK загружен (или работаем в обычном браузере)
        // Если telegramWebApp еще не создан, но Telegram SDK доступен, ждем его создания
        if (!window.telegramWebApp) {
            if (window.Telegram && window.Telegram.WebApp) {
                console.log('⚠️ telegramWebApp not initialized yet, waiting...');
                // Ждем еще немного для создания telegramWebApp
                setTimeout(() => initTelegramAdminPage(), 300);
                return null;
            } else {
                // Не в Telegram, но можем работать в обычном браузере
                console.log('ℹ️ Not in Telegram, initializing in browser mode');
            }
        }
        
        try {
            // Проверяем, что класс доступен
            if (typeof TelegramAdminPage === 'undefined') {
                console.error('❌ TelegramAdminPage class is not defined!');
                console.log('Available on window:', {
                    hasTelegramAdminPage: typeof window.TelegramAdminPage,
                    hasClass: typeof TelegramAdminPage
                });
                throw new Error('TelegramAdminPage class is not defined');
            }
            
            console.log('📦 Creating TelegramAdminPage instance...');
            telegramAdminPage = new TelegramAdminPage();
            
            // Убеждаемся что базовые свойства есть
            if (!telegramAdminPage.hasOwnProperty('isAdmin')) {
                telegramAdminPage.isAdmin = false;
            }
            if (!telegramAdminPage.hasOwnProperty('userId')) {
                telegramAdminPage.userId = null;
            }
            if (!telegramAdminPage.hasOwnProperty('page')) {
                telegramAdminPage.page = null;
            }
            
            // Ждем завершения асинхронной инициализации
            if (telegramAdminPage.init && typeof telegramAdminPage.init === 'function') {
                console.log('🔄 Calling init()...');
                try {
                    await telegramAdminPage.init();
                    console.log('✅ init() completed');
                } catch (initError) {
                    console.error('❌ Error in init():', initError);
                    // Продолжаем даже если init() упал
                }
            } else {
                console.warn('⚠️ No init() method found, initializing manually...');
                // Инициализируем вручную
                try {
                    const user = window.telegramWebApp ? window.telegramWebApp.getUserData() : null;
                    telegramAdminPage.userId = user ? String(user.id) : null;
                    telegramAdminPage.isAdmin = false;
                    telegramAdminPage.page = null;
                } catch (e) {
                    console.error('Error manual init:', e);
                }
            }
            
            window.telegramAdminPage = telegramAdminPage;
            console.log('✅ TelegramAdminPage initialized:', { 
                hasPage: !!telegramAdminPage.page, 
                isAdmin: telegramAdminPage.isAdmin,
                userId: telegramAdminPage.userId,
                hasShowMethod: typeof telegramAdminPage.show === 'function',
                hasInitMethod: typeof telegramAdminPage.init === 'function',
                hasCreatePageMethod: typeof telegramAdminPage.createPage === 'function'
            });
        } catch (error) {
            console.error('❌ Error creating TelegramAdminPage instance:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            // Создаем минимальный объект вместо throw
            telegramAdminPage = {
                isAdmin: false,
                userId: null,
                page: null,
                show: async function() {
                    console.error('TelegramAdminPage fallback show() called');
                    // Пытаемся создать минимальную страницу
                    const minimalHTML = '<div id="tgAdminPage" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#fff;padding:20px;"><h1>Админка</h1><p>Ошибка инициализации. Обновите страницу.</p></div>';
                    document.body.insertAdjacentHTML('beforeend', minimalHTML);
                }
            };
            window.telegramAdminPage = telegramAdminPage;
            throw error;
        }
    } catch (error) {
        console.error('❌ Error initializing TelegramAdminPage:', error);
        console.error('Error stack:', error.stack);
        // Создаем объект с базовыми методами, чтобы window.telegramAdminPage существовал
        telegramAdminPage = { 
            isAdmin: false, 
            page: null,
            userId: null,
            show: async function() { 
                console.error('TelegramAdminPage not properly initialized, attempting to reinitialize...');
                // Пытаемся переинициализировать
                try {
                    if (typeof window.initTelegramAdminPage === 'function') {
                        window.initTelegramAdminPage();
                        // Ждем немного и пробуем снова
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (window.telegramAdminPage && 
                            window.telegramAdminPage.show && 
                            window.telegramAdminPage !== this &&
                            typeof window.telegramAdminPage.show === 'function') {
                            return window.telegramAdminPage.show();
                        }
                    }
                } catch (reinitError) {
                    console.error('Failed to reinitialize:', reinitError);
                }
                if (window.telegramWebApp) {
                    window.telegramWebApp.showNotification('Админка не инициализирована. Обновите страницу.');
                }
            }
        };
        window.telegramAdminPage = telegramAdminPage;
        console.log('⚠️ Created fallback TelegramAdminPage object');
    }
}

// Инициализация с задержкой, чтобы убедиться, что Telegram Web App SDK загружен
function startInitTelegramAdminPage() {
    // Функция проверки готовности
    function checkAndInit() {
        // Проверяем, что telegramWebApp создан или мы не в Telegram
        // Также проверяем, что объект еще не создан или создан неправильно
        const needsInit = !window.telegramAdminPage || 
            typeof window.telegramAdminPage !== 'object' ||
            !window.telegramAdminPage.hasOwnProperty('isAdmin');
        
        if (needsInit && (window.telegramWebApp || (!window.Telegram || !window.Telegram.WebApp))) {
            console.log('✅ Ready to initialize TelegramAdminPage');
            initTelegramAdminPage();
        } else if (needsInit) {
            console.log('⏳ Waiting for telegramWebApp...');
            setTimeout(checkAndInit, 200);
        } else {
            console.log('✅ TelegramAdminPage already initialized');
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Увеличиваем задержку для гарантии, что все скрипты загружены
            setTimeout(() => {
                checkAndInit();
            }, 1000);
        });
    } else {
        // Если DOM уже загружен, ждем больше для загрузки Telegram Web App SDK
        setTimeout(() => {
            checkAndInit();
        }, 1000);
    }
    
    // Дополнительная попытка через большее время на случай медленной загрузки
    setTimeout(() => {
        // Проверяем, что объект существует и правильно инициализирован
        if (!window.telegramAdminPage || 
            typeof window.telegramAdminPage !== 'object' ||
            !window.telegramAdminPage.hasOwnProperty('isAdmin')) {
            console.log('🔄 Retrying TelegramAdminPage initialization...');
            checkAndInit();
        }
    }, 2000);
    
    // Еще одна попытка через 3 секунды на случай очень медленной загрузки
    setTimeout(() => {
        if (!window.telegramAdminPage || 
            typeof window.telegramAdminPage !== 'object' ||
            !window.telegramAdminPage.hasOwnProperty('isAdmin')) {
            console.log('🔄 Final retry for TelegramAdminPage initialization...');
            checkAndInit();
        }
    }, 3000);
}

// Запускаем инициализацию
startInitTelegramAdminPage();

// ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.telegramAdminPage || typeof window.telegramAdminPage !== 'object') {
                console.log('🔄 Force initializing TelegramAdminPage on DOMContentLoaded...');
                if (typeof window.initTelegramAdminPage === 'function') {
                    window.initTelegramAdminPage();
                }
            }
        }, 500);
    });
} else {
    setTimeout(() => {
        if (!window.telegramAdminPage || typeof window.telegramAdminPage !== 'object') {
            console.log('🔄 Force initializing TelegramAdminPage on ready...');
            if (typeof window.initTelegramAdminPage === 'function') {
                window.initTelegramAdminPage();
            }
        }
    }, 500);
}

// Дополнительная проверка через 5 секунд - если объект все еще не создан, создаем fallback
setTimeout(() => {
    if (!window.telegramAdminPage || 
        typeof window.telegramAdminPage !== 'object' ||
        !window.telegramAdminPage.hasOwnProperty('isAdmin')) {
        console.error('❌ TelegramAdminPage still not initialized after 5 seconds, creating fallback...');
        try {
            window.initTelegramAdminPage();
        } catch (error) {
            console.error('❌ Failed to initialize even with fallback:', error);
            // Создаем минимальный объект, чтобы избежать ошибок
            window.telegramAdminPage = {
                isAdmin: false,
                page: null,
                userId: null,
                show: async function() {
                    console.error('TelegramAdminPage fallback: attempting initialization...');
                    if (typeof window.initTelegramAdminPage === 'function') {
                        window.initTelegramAdminPage();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (window.telegramAdminPage && 
                            window.telegramAdminPage !== this &&
                            typeof window.telegramAdminPage.show === 'function') {
                            return window.telegramAdminPage.show();
                        }
                    }
                    if (window.telegramWebApp) {
                        window.telegramWebApp.showNotification('Админка не инициализирована. Обновите страницу.');
                    }
                }
            };
        }
    } else {
        console.log('✅ TelegramAdminPage successfully initialized');
    }
}, 5000);