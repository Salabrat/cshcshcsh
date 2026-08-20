// Fix Hero Texts - Утилита для восстановления текстов hero секции

(function() {
    'use strict';
    
    // Функция для восстановления текстов
    window.fixHeroTexts = function() {
        console.log('Fixing hero texts...');
        
        // Загружаем тексты с сервера
        fetch('/api/homepage-texts')
            .then(response => response.json())
            .then(data => {
                console.log('Loaded data:', data);
                
                // Восстанавливаем hero тексты
                if (data.hero) {
                    const heroTitle = document.querySelector('.hero-title');
                    const heroSubtitle = document.querySelector('.hero-subtitle');
                    
                    if (heroTitle) {
                        if (data.hero.title) {
                            heroTitle.innerHTML = data.hero.title;
                            console.log('✓ Hero title restored:', data.hero.title);
                        } else {
                            // Дефолтный текст если нет сохраненного
                            heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
                            console.log('✓ Hero title set to default');
                        }
                    } else {
                        console.error('✗ Hero title element not found');
                    }
                    
                    if (heroSubtitle) {
                        if (data.hero.subtitle) {
                            heroSubtitle.textContent = data.hero.subtitle;
                            console.log('✓ Hero subtitle restored:', data.hero.subtitle);
                        } else {
                            // Дефолтный текст если нет сохраненного
                            heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
                            console.log('✓ Hero subtitle set to default');
                        }
                    } else {
                        console.error('✗ Hero subtitle element not found');
                    }
                } else {
                    console.log('No hero data found, setting defaults...');
                    
                    const heroTitle = document.querySelector('.hero-title');
                    const heroSubtitle = document.querySelector('.hero-subtitle');
                    
                    if (heroTitle) {
                        heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
                    }
                    
                    if (heroSubtitle) {
                        heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
                    }
                }
                
                console.log('✓ Hero texts fixed successfully!');
            })
            .catch(error => {
                console.error('Error loading texts:', error);
                console.log('Setting default texts...');
                
                // В случае ошибки устанавливаем дефолтные тексты
                const heroTitle = document.querySelector('.hero-title');
                const heroSubtitle = document.querySelector('.hero-subtitle');
                
                if (heroTitle) {
                    heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
                }
                
                if (heroSubtitle) {
                    heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
                }
            });
    };
    
    // Автоматически исправляем тексты при загрузке
    function autoFix() {
        // Проверяем, есть ли тексты в hero секции
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        if (heroTitle && !heroTitle.textContent.trim()) {
            console.log('Hero title is empty, fixing...');
            window.fixHeroTexts();
        } else if (heroSubtitle && !heroSubtitle.textContent.trim()) {
            console.log('Hero subtitle is empty, fixing...');
            window.fixHeroTexts();
        }
    }
    
    // Запускаем автоматическое исправление
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(autoFix, 200);
        });
    } else {
        setTimeout(autoFix, 200);
    }
    
    console.log('Fix Hero Texts loaded. Use window.fixHeroTexts() to manually restore texts.');
})();
