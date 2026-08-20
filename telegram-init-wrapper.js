// Telegram Mini App Initialization Wrapper
// Ensures the app loads even with network issues

(function() {
    'use strict';
    
    let initAttempts = 0;
    const maxAttempts = 3;
    
    // Override console.error to track initialization errors
    const originalError = console.error;
    let initErrors = [];
    console.error = function() {
        originalError.apply(console, arguments);
        if (arguments[0] && typeof arguments[0] === 'string') {
            if (arguments[0].includes('TelegramMiniAppLoader') || 
                arguments[0].includes('TelegramNavigation') ||
                arguments[0].includes('TelegramPageLoader')) {
                initErrors.push(arguments[0]);
            }
        }
    };
    
    // Ensure Telegram WebApp is ready
    function ensureTelegramReady() {
        return new Promise((resolve) => {
            if (window.Telegram && window.Telegram.WebApp) {
                resolve();
            } else {
                // Wait for Telegram SDK
                let checkCount = 0;
                const checkInterval = setInterval(() => {
                    checkCount++;
                    if (window.Telegram && window.Telegram.WebApp) {
                        clearInterval(checkInterval);
                        resolve();
                    } else if (checkCount > 20) { // 2 seconds timeout
                        clearInterval(checkInterval);
                        console.warn('Telegram SDK not available, continuing anyway');
                        resolve();
                    }
                }, 100);
            }
        });
    }
    
    // Initialize all components with error recovery
    async function initializeApp() {
        initAttempts++;
        console.log(`Initialization attempt ${initAttempts}/${maxAttempts}`);
        
        try {
            // Ensure Telegram is ready
            await ensureTelegramReady();
            
            // Initialize components in order
            const components = [
                { name: 'TelegramWebApp', check: () => window.telegramWebApp },
                { name: 'TelegramMiniAppLoader', check: () => window.telegramMiniAppLoader },
                { name: 'TelegramPageLoader', check: () => window.telegramPageLoader },
                { name: 'TelegramNavigation', check: () => window.telegramNavigation },
                { name: 'TelegramCatalog', check: () => window.telegramCatalog }
            ];
            
            for (const component of components) {
                if (!component.check()) {
                    console.warn(`${component.name} not initialized, attempting to create...`);
                    
                    // Try to create the component
                    switch(component.name) {
                        case 'TelegramWebApp':
                            if (window.TelegramWebApp) {
                                window.telegramWebApp = new TelegramWebApp();
                            }
                            break;
                        case 'TelegramMiniAppLoader':
                            if (window.TelegramMiniAppLoader) {
                                window.telegramMiniAppLoader = new TelegramMiniAppLoader();
                            }
                            break;
                        case 'TelegramPageLoader':
                            if (window.TelegramPageLoader) {
                                window.telegramPageLoader = new TelegramPageLoader();
                            }
                            break;
                        case 'TelegramNavigation':
                            if (window.TelegramNavigation) {
                                window.telegramNavigation = new TelegramNavigation();
                            }
                            break;
                        case 'TelegramCatalog':
                            if (window.TelegramCatalog) {
                                window.telegramCatalog = new TelegramCatalog();
                            }
                            break;
                    }
                }
            }
            
            // Hide loader after a short delay if still visible
            setTimeout(() => {
                const loader = document.getElementById('tgPageLoader');
                if (loader && loader.style.display !== 'none') {
                    console.log('Force hiding loader after initialization');
                    loader.style.opacity = '0';
                    setTimeout(() => {
                        loader.style.display = 'none';
                        document.body.classList.remove('tg-loading');
                    }, 300);
                }
            }, 3000);
            
            console.log('App initialization complete');
            
        } catch (error) {
            console.error('App initialization error:', error);
            
            if (initAttempts < maxAttempts) {
                console.log(`Retrying initialization in 1 second...`);
                setTimeout(initializeApp, 1000);
            } else {
                console.error('Max initialization attempts reached, showing fallback UI');
                showFallbackUI();
            }
        }
    }
    
    // Show fallback UI if initialization fails
    function showFallbackUI() {
        // Hide loader
        const loader = document.getElementById('tgPageLoader');
        if (loader) {
            loader.style.display = 'none';
        }
        document.body.classList.remove('tg-loading');
        
        // Show error message
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <h2>Ошибка загрузки</h2>
                    <p>Не удалось загрузить приложение. Пожалуйста, попробуйте позже.</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #007bff; color: white; border: none; border-radius: 5px;">
                        Обновить
                    </button>
                </div>
            `;
        }
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM already loaded, initialize immediately
        setTimeout(initializeApp, 100);
    }
    
    // Also initialize on window load as fallback
    window.addEventListener('load', () => {
        setTimeout(() => {
            // Check if app is initialized
            if (!window.telegramMiniAppLoader || !window.telegramNavigation) {
                console.log('App not initialized on window load, attempting initialization...');
                initializeApp();
            }
        }, 500);
    });
    
})();
