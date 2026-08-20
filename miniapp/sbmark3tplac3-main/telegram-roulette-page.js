// Telegram Mini App Roulette Page
class TelegramRoulettePage {
    constructor() {
        try {
            this.page = null;
            this.config = null;
            this.slots = [];
            this.isSpinning = false;
            this.userId = null;
            this.stripItems = [];
            this.ITEM_WIDTH = 185; // 180px item + 5px spacing in the strip
            this.VISIBLE_ITEMS = 40; // items in the strip
            this.init();
        } catch (error) {
            console.error('❌ TelegramRoulettePage constructor failed:', error);
        }
    }

    init() {
        try {
            this.createPage();
            this.setupEventListeners();
            console.log('✅ TelegramRoulettePage.init() completed, page:', this.page);
        } catch (error) {
            console.error('❌ TelegramRoulettePage.init() failed:', error);
        }
    }

    getUserId() {
        if (window.telegramWebApp) {
            const user = window.telegramWebApp.getUserData();
            return user ? String(user.id) : null;
        }
        return null;
    }

    createPage() {
        const pageHTML = `
            <div class="tg-roulette-page" id="tgRoulettePage" style="display: none;">
                <div class="tg-roulette-header">
                    <button class="tg-roulette-back-btn" id="tgRouletteBackBtn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <h1 class="tg-roulette-title">Рулетка Бонусов</h1>
                </div>

                <div class="tg-roulette-content" id="tgRouletteContent">
                    <div class="tg-roulette-hero">
                        <h2 class="tg-roulette-heading">РУЛЕТКА БОНУСОВ</h2>
                        <p class="tg-roulette-subtitle">Открывай кейс раз в сутки и забирай персональную скидку на товары в магазине.</p>
                    </div>

                    <div class="tg-roulette-machine">
                        <div class="tg-roulette-viewport">
                            <div class="tg-roulette-pointer"></div>
                            <div class="tg-roulette-strip" id="tgRouletteStrip">
                                <!-- Items populated by JS -->
                            </div>
                        </div>
                    </div>

                    <button class="tg-roulette-spin-btn" id="tgRouletteSpinBtn" disabled>
                        Крутить!
                    </button>

                    <div class="tg-roulette-cooldown-msg" id="tgRouletteCooldownMsg" style="display: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Следующий спин через <strong id="tgRouletteTimer">--:--:--</strong></span>
                    </div>

                    <p class="tg-roulette-footer-text">1 кейс каждые <span id="tgRouletteFooterCooldown">24</span> часа. Купон действует <span id="tgRouletteFooterCoupon">24</span> часа.</p>
                </div>

                <!-- Win modal -->
                <div class="tg-roulette-win-overlay" id="tgRouletteWinOverlay" style="display: none;">
                    <div class="tg-roulette-win-modal">
                        <div class="tg-roulette-win-glow" id="tgRouletteWinGlow"></div>
                        <div class="tg-roulette-win-image" id="tgRouletteWinImage"></div>
                        <h3 class="tg-roulette-win-title">Поздравляем!</h3>
                        <p class="tg-roulette-win-name" id="tgRouletteWinName"></p>
                        <p class="tg-roulette-win-prize" id="tgRouletteWinPrize"></p>
                        <div class="tg-roulette-win-rarity" id="tgRouletteWinRarity"></div>
                        <button class="tg-roulette-win-close" id="tgRouletteWinClose">Отлично!</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.page = document.getElementById('tgRoulettePage');
    }

    setupEventListeners() {
        document.getElementById('tgRouletteBackBtn')?.addEventListener('click', () => this.close());
        document.getElementById('tgRouletteSpinBtn')?.addEventListener('click', () => this.spin());
        document.getElementById('tgRouletteWinClose')?.addEventListener('click', () => this.closeWinModal());
    }

    async show() {
        if (!this.page) return;
        this.userId = this.getUserId();
        this.page.style.display = 'block';

        this.applyRouletteCover();

        if (window.telegramWebApp && window.telegramWebApp.isTelegram) {
            window.telegramWebApp.tg.BackButton.onClick(() => this.close());
            window.telegramWebApp.showBackButton();
        }
        if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('impact');

        await this.loadConfig();
        await this.checkSpinAvailability();
    }

    applyRouletteCover() {
        if (!this.page) return;
        try {
            const saved = localStorage.getItem('tg_miniapp_design_settings');
            const settings = saved ? JSON.parse(saved) : {};
            const cover = settings && settings.rouletteCoverImage;
            const coverUrl = typeof cover === 'string' ? cover : (cover && cover.url ? cover.url : '');

            if (coverUrl) {
                this.page.style.backgroundImage = `url(${coverUrl})`;
                this.page.style.backgroundSize = 'cover';
                this.page.style.backgroundPosition = 'center center';
                this.page.style.backgroundRepeat = 'no-repeat';
            } else {
                this.page.style.backgroundImage = '';
                this.page.style.backgroundSize = '';
                this.page.style.backgroundPosition = '';
                this.page.style.backgroundRepeat = '';
            }
        } catch (e) {
            // ignore
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

    async loadConfig() {
        try {
            const resp = await fetch('/api/roulette/config');
            if (!resp.ok) throw new Error('Failed to load config');
            this.config = await resp.json();
            this.slots = this.config.slots || [];

            // Update UI text
            const cooldown = this.config.spinCooldownHours || 24;
            const coupon = this.config.couponDurationHours || 24;
            const cooldownEl = document.getElementById('tgRouletteFooterCooldown');
            if (cooldownEl) cooldownEl.textContent = cooldown;
            const couponEl = document.getElementById('tgRouletteFooterCoupon');
            if (couponEl) couponEl.textContent = coupon;

            this.buildStrip();
        } catch (e) {
            console.error('Error loading roulette config:', e);
        }
    }

    buildStrip() {
        const strip = document.getElementById('tgRouletteStrip');
        if (!strip || this.slots.length === 0) return;

        // Build a long strip with randomized item positions for visual variety.
        // Winner odds remain unchanged because winner is selected on the server by weight.
        this.stripItems = [];
        for (let i = 0; i < this.VISIBLE_ITEMS; i++) {
            const slot = this.slots[Math.floor(Math.random() * this.slots.length)];
            this.stripItems.push(slot);
        }

        const renderItems = (items, baseIndexOffset = 0) => items.map((slot, idx) => `
            <div class="tg-roulette-item rarity-${slot.rarity || 'common'}" data-index="${baseIndexOffset + idx}">
                <div class="tg-roulette-item-inner">
                    ${slot.image
                        ? `<img src="${slot.image}" alt="${this.escapeHtml(slot.name)}" class="tg-roulette-item-img" loading="lazy">`
                        : `<div class="tg-roulette-item-placeholder">${this.escapeHtml(slot.name.charAt(0))}</div>`
                    }
                </div>
                <span class="tg-roulette-item-name">${this.escapeHtml(slot.name)}</span>
            </div>
        `).join('');

        // Duplicate for seamless idle scrolling
        const doubled = this.stripItems.concat(this.stripItems);
        strip.innerHTML = renderItems(doubled);

        // Set strip width and idle scroll distance (one set length)
        const oneLoopWidth = this.stripItems.length * this.ITEM_WIDTH;
        strip.style.setProperty('--tg-roulette-idle-distance', oneLoopWidth + 'px');
        const viewport = strip.parentElement;
        const startOffset = viewport ? Math.floor(viewport.clientWidth / 2) : 0;
        strip.style.setProperty('--tg-roulette-start-offset', startOffset + 'px');
        strip.style.width = (doubled.length * this.ITEM_WIDTH) + 'px';
        strip.style.transform = `translateX(${startOffset}px)`;
    }

    async checkSpinAvailability() {
        const spinBtn = document.getElementById('tgRouletteSpinBtn');
        const cooldownMsg = document.getElementById('tgRouletteCooldownMsg');

        if (!this.userId) {
            spinBtn.disabled = true;
            spinBtn.textContent = 'Войдите через Telegram';
            return;
        }

        if (!this.config || !this.config.enabled) {
            spinBtn.disabled = true;
            spinBtn.textContent = 'Рулетка недоступна';
            return;
        }

        if (this.slots.length === 0) {
            spinBtn.disabled = true;
            spinBtn.textContent = 'Нет призов';
            return;
        }

        try {
            const resp = await fetch(`/api/roulette/check/${this.userId}`);
            const data = await resp.json();

            if (data.canSpin) {
                spinBtn.disabled = false;
                spinBtn.textContent = 'Крутить!';
                cooldownMsg.style.display = 'none';
                this.stopTimer();
            } else if (data.reason === 'cooldown') {
                spinBtn.disabled = true;
                spinBtn.textContent = 'Ожидайте...';
                cooldownMsg.style.display = 'flex';
                this.startTimer(new Date(data.nextSpinAt));
            } else {
                spinBtn.disabled = true;
                spinBtn.textContent = 'Рулетка недоступна';
            }
        } catch (e) {
            console.error('Error checking spin:', e);
            spinBtn.disabled = true;
            spinBtn.textContent = 'Ошибка загрузки';
        }
    }

    startTimer(nextSpinAt) {
        this.stopTimer();
        const timerEl = document.getElementById('tgRouletteTimer');

        const update = () => {
            const now = Date.now();
            const diff = nextSpinAt.getTime() - now;
            if (diff <= 0) {
                timerEl.textContent = '00:00:00';
                this.stopTimer();
                this.checkSpinAvailability();
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        update();
        this._timerInterval = setInterval(update, 1000);
    }

    stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    async spin() {
        if (this.isSpinning || !this.userId) return;
        this.isSpinning = true;

        // Re-randomize visible strip positions before each spin.
        this.buildStrip();

        const spinBtn = document.getElementById('tgRouletteSpinBtn');
        spinBtn.disabled = true;
        spinBtn.textContent = 'Запускаем...';

        if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('impact');

        try {
            const resp = await fetch('/api/roulette/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Spin failed');
            }

            const result = await resp.json();
            await this.animateSpin(result.winner);
            this.showWinModal(result.winner, result.couponDurationHours);
        } catch (e) {
            console.error('Spin error:', e);
            if (window.telegramWebApp) window.telegramWebApp.showNotification('Ошибка: ' + e.message);
        } finally {
            this.isSpinning = false;
            await this.checkSpinAvailability();
        }
    }

    animateSpin(winner) {
        return new Promise(resolve => {
            const strip = document.getElementById('tgRouletteStrip');
            if (!strip) { resolve(); return; }

            // Pause idle animation
            strip.classList.add('is-spinning');

            // Find the winner index in our strip (place it near the end for effect)
            const winnerIndex = Math.floor(this.VISIBLE_ITEMS * 0.75);

            // Replace that item in the strip with the winner
            const winnerSlot = this.slots.find(s => s.id === winner.id) || winner;
            this.stripItems[winnerIndex] = winnerSlot;

            // Re-render the ENTIRE strip to ensure winner is at the correct position
            const renderItems = (items, baseIndexOffset = 0) => items.map((slot, idx) => `
                <div class="tg-roulette-item rarity-${slot.rarity || 'common'}" data-index="${baseIndexOffset + idx}">
                    <div class="tg-roulette-item-inner">
                        ${slot.image
                            ? `<img src="${slot.image}" alt="${this.escapeHtml(slot.name)}" class="tg-roulette-item-img" loading="lazy">`
                            : `<div class="tg-roulette-item-placeholder">${this.escapeHtml(slot.name.charAt(0))}</div>`
                        }
                    </div>
                    <span class="tg-roulette-item-name">${this.escapeHtml(slot.name)}</span>
                </div>
            `).join('');

            // Duplicate for seamless idle scrolling
            const doubled = this.stripItems.concat(this.stripItems);
            strip.innerHTML = renderItems(doubled);
            strip.style.width = (doubled.length * this.ITEM_WIDTH) + 'px';

            // Get the updated item elements
            const itemEls = strip.querySelectorAll('.tg-roulette-item');

            // Calculate offset to center the winner item in the viewport
            const viewport = strip.parentElement;
            const vpWidth = viewport.clientWidth;
            const targetOffset = (winnerIndex * this.ITEM_WIDTH) - (vpWidth / 2) + (this.ITEM_WIDTH / 2);
            const startOffset = Math.floor(vpWidth / 2);

            // Animate with CSS transition (ease-out for deceleration effect)
            strip.style.transition = 'none';
            strip.style.transform = `translateX(${startOffset}px)`;

            // Force reflow
            strip.offsetHeight;

            strip.style.transition = 'transform 7.5s cubic-bezier(0.15, 0.85, 0.25, 1)';
            strip.style.transform = `translateX(${startOffset - targetOffset}px)`;

            // Haptic ticks during animation
            let tickCount = 0;
            const tickInterval = setInterval(() => {
                if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('light');
                tickCount++;
                if (tickCount > 15) clearInterval(tickInterval);
            }, 250);

            setTimeout(() => {
                clearInterval(tickInterval);
                if (window.telegramWebApp) window.telegramWebApp.hapticFeedback('success');

                // Highlight winner
                if (itemEls[winnerIndex]) {
                    itemEls[winnerIndex].classList.add('tg-roulette-item-winner');
                }

                resolve();
            }, 7800);
        });
    }

    saveWinToHistory(winner, couponHours) {
        try {
            const key = 'tg_roulette_wins';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const parseDiscount = (value) => {
                if (value == null) return 0;
                if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
                const str = String(value);
                const m = str.match(/(\d{1,2})\s*%/);
                if (!m) return 0;
                const n = parseInt(m[1], 10);
                return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 0;
            };

            const discountValue = parseDiscount(winner.discount) || parseDiscount(winner.prize) || parseDiscount(winner.name);
            const entry = {
                id: winner.id,
                name: winner.name,
                prize: winner.prize || winner.name,
                image: winner.image || null,
                rarity: winner.rarity || 'common',
                discount: discountValue,
                couponHours: couponHours || 24,
                wonAt: Date.now(),
                expiresAt: Date.now() + ((couponHours || 24) * 60 * 60 * 1000)
            };
            existing.unshift(entry);
            // Keep last 50 wins
            if (existing.length > 50) existing.length = 50;
            localStorage.setItem(key, JSON.stringify(existing));

            // Update personal discount if this win has a discount value
            if (entry.discount > 0) {
                localStorage.setItem('tg_personal_discount', JSON.stringify({
                    value: entry.discount,
                    expiresAt: entry.expiresAt,
                    winName: entry.name
                }));
            }

            // Notify profile page to refresh discount
            window.dispatchEvent(new CustomEvent('tgRouletteWin', { detail: entry }));
        } catch (e) {
            console.error('Error saving win to history:', e);
        }
    }

    showWinModal(winner, couponHours) {
        // Save win to history first
        this.saveWinToHistory(winner, couponHours);

        const overlay = document.getElementById('tgRouletteWinOverlay');
        const imgContainer = document.getElementById('tgRouletteWinImage');
        const nameEl = document.getElementById('tgRouletteWinName');
        const prizeEl = document.getElementById('tgRouletteWinPrize');
        const rarityEl = document.getElementById('tgRouletteWinRarity');
        const glowEl = document.getElementById('tgRouletteWinGlow');

        if (winner.image) {
            imgContainer.innerHTML = `<img src="${winner.image}" alt="${this.escapeHtml(winner.name)}" class="tg-roulette-win-img">`;
        } else {
            imgContainer.innerHTML = `<div class="tg-roulette-win-placeholder">${this.escapeHtml(winner.name.charAt(0))}</div>`;
        }

        nameEl.textContent = winner.name;
        prizeEl.textContent = winner.prize || winner.name;

        const rarityLabels = {
            common: 'Обычный',
            uncommon: 'Необычный',
            rare: 'Редкий',
            epic: 'Эпический',
            legendary: 'Легендарный'
        };
        rarityEl.textContent = rarityLabels[winner.rarity] || winner.rarity || 'Обычный';
        rarityEl.className = `tg-roulette-win-rarity rarity-${winner.rarity || 'common'}`;
        glowEl.className = `tg-roulette-win-glow rarity-${winner.rarity || 'common'}`;

        overlay.style.display = 'flex';
        overlay.classList.add('tg-roulette-win-show');
    }

    closeWinModal() {
        const overlay = document.getElementById('tgRouletteWinOverlay');
        overlay.classList.remove('tg-roulette-win-show');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);

        // Remove winner highlight but keep strip position so next spin starts from last stop
        const strip = document.getElementById('tgRouletteStrip');
        if (strip) {
            strip.querySelectorAll('.tg-roulette-item-winner').forEach(el => {
                el.classList.remove('tg-roulette-item-winner');
            });

            // Restore idle animation only after user closes the win modal
            strip.style.transition = 'none';
            strip.style.transform = 'translateX(0)';
            strip.classList.remove('is-spinning');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }
}

// Initialize
let telegramRoulettePage = null;
console.log('🎰 telegram-roulette-page.js loaded, readyState:', document.readyState);

try {
    if (document.readyState === 'loading') {
        console.log('🎰 Document still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🎰 DOMContentLoaded fired, creating TelegramRoulettePage...');
            try {
                telegramRoulettePage = new TelegramRoulettePage();
                window.telegramRoulettePage = telegramRoulettePage;
                console.log('✅ TelegramRoulettePage created and assigned to window');
            } catch (error) {
                console.error('❌ Error creating TelegramRoulettePage:', error);
            }
        });
    } else {
        console.log('🎰 Document already loaded, creating TelegramRoulettePage immediately...');
        telegramRoulettePage = new TelegramRoulettePage();
        window.telegramRoulettePage = telegramRoulettePage;
        console.log('✅ TelegramRoulettePage created and assigned to window');
    }
} catch (error) {
    console.error('❌ Fatal error initializing TelegramRoulettePage:', error);
}
