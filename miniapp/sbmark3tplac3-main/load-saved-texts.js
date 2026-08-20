// Load Saved Texts - Загружает сохраненные тексты из API для всех пользователей

(function() {
    console.log('Load Saved Texts: Starting...');
    
    function loadTexts() {
        fetch('/api/homepage-texts')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load texts');
                }
                return response.json();
            })
            .then(data => {
                console.log('Load Saved Texts: Data received:', data);
                
                // Загружаем тексты hero секции
                if (data.hero) {
                    const heroTitle = document.querySelector('.hero-title');
                    const heroSubtitle = document.querySelector('.hero-subtitle');
                    
                    if (heroTitle && data.hero.title) {
                        heroTitle.innerHTML = data.hero.title;
                        console.log('Updated hero title');
                    }
                    
                    if (heroSubtitle && data.hero.subtitle) {
                        heroSubtitle.textContent = data.hero.subtitle;
                        console.log('Updated hero subtitle');
                    }
                }
                
                // Загружаем тексты кампаний
                if (data.campaign1) {
                    updateCampaignTexts('.campaign-dark', data.campaign1);
                }
                
                if (data.campaign2) {
                    updateCampaignTexts('.campaign-split:not(.campaign-split-reverse)', data.campaign2);
                }
                
                if (data.campaign3) {
                    updateCampaignTexts('.campaign-split-reverse', data.campaign3);
                }
                
                // Загружаем тексты about секции
                if (data.about) {
                    const aboutTitle = document.querySelector('.about-title');
                    const aboutText = document.querySelector('.about-text');
                    
                    if (aboutTitle && data.about.title) {
                        aboutTitle.innerHTML = data.about.title;
                        console.log('Updated about title');
                    }
                    
                    if (aboutText && data.about.text) {
                        aboutText.textContent = data.about.text;
                        console.log('Updated about text');
                    }
                }
                
                console.log('Load Saved Texts: All texts loaded successfully');
            })
            .catch(error => {
                console.error('Load Saved Texts: Error loading texts:', error);
                // Не показываем ошибку пользователю, просто используем дефолтные тексты
            });
    }
    
    function updateCampaignTexts(selector, data) {
        const section = document.querySelector(selector);
        if (!section) return;
        
        const label = section.querySelector('.campaign-label');
        const title = section.querySelector('.campaign-title');
        const description = section.querySelector('.campaign-description');
        
        if (label && data.label) {
            label.textContent = data.label;
        }
        
        if (title && data.title) {
            title.innerHTML = data.title;
        }
        
        if (description && data.description) {
            description.textContent = data.description;
        }
    }
    
    // Загружаем тексты при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Небольшая задержка, чтобы DOM полностью загрузился
            setTimeout(loadTexts, 50);
        });
    } else {
        // Даем время другим скриптам инициализироваться
        setTimeout(loadTexts, 100);
    }
    
    // Экспортируем функцию для ручного вызова
    window.loadSavedTexts = loadTexts;
})();
