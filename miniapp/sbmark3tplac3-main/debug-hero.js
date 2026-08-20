// Debug Hero - Диагностика проблем с hero секцией

(function() {
    'use strict';
    
    window.debugHero = function() {
        console.log('=== HERO SECTION DEBUG ===');
        
        // 1. Проверяем наличие элементов
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        console.log('1. Elements check:');
        console.log('   - Hero title element:', heroTitle ? '✓ Found' : '✗ Not found');
        console.log('   - Hero subtitle element:', heroSubtitle ? '✓ Found' : '✗ Not found');
        
        if (heroTitle) {
            console.log('   - Hero title content:', heroTitle.innerHTML || '(empty)');
            console.log('   - Hero title text:', heroTitle.textContent || '(empty)');
        }
        
        if (heroSubtitle) {
            console.log('   - Hero subtitle content:', heroSubtitle.innerHTML || '(empty)');
            console.log('   - Hero subtitle text:', heroSubtitle.textContent || '(empty)');
        }
        
        // 2. Проверяем статус админа
        console.log('\n2. Admin status:');
        console.log('   - adminLoggedIn:', localStorage.getItem('adminLoggedIn'));
        console.log('   - username:', localStorage.getItem('username'));
        console.log('   - userRole:', localStorage.getItem('userRole'));
        
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true' || 
                       localStorage.getItem('username') === 'admin' ||
                       localStorage.getItem('userRole') === 'admin';
        console.log('   - Is admin?:', isAdmin ? '✓ Yes' : '✗ No');
        
        // 3. Проверяем наличие кнопок редактирования
        console.log('\n3. Edit buttons check:');
        const editButtons = document.querySelectorAll('.hero-edit-btn, .direct-edit-button, .inline-edit-button');
        console.log('   - Edit buttons found:', editButtons.length);
        editButtons.forEach((btn, i) => {
            console.log(`   - Button ${i + 1}:`, btn.className, 'Parent:', btn.parentElement?.className);
        });
        
        // 4. Проверяем загруженные скрипты
        console.log('\n4. Scripts check:');
        const scripts = [
            'load-saved-texts.js',
            'hero-editor.js',
            'direct-text-editor.js',
            'inline-text-editor.js',
            'force-edit-buttons.js',
            'fix-hero-texts.js'
        ];
        
        scripts.forEach(scriptName => {
            const scriptTag = document.querySelector(`script[src*="${scriptName}"]`);
            console.log(`   - ${scriptName}:`, scriptTag ? '✓ Loaded' : '✗ Not loaded');
        });
        
        // 5. Проверяем глобальные функции
        console.log('\n5. Global functions:');
        console.log('   - window.loadSavedTexts:', typeof window.loadSavedTexts);
        console.log('   - window.fixHeroTexts:', typeof window.fixHeroTexts);
        console.log('   - window.heroEditor:', typeof window.heroEditor);
        console.log('   - window.forceEditButtons:', typeof window.forceEditButtons);
        
        // 6. Пробуем загрузить тексты
        console.log('\n6. Trying to load texts from API...');
        fetch('/api/homepage-texts')
            .then(response => response.json())
            .then(data => {
                console.log('   - API Response:', data);
                if (data.hero) {
                    console.log('   - Hero data found:');
                    console.log('     • Title:', data.hero.title);
                    console.log('     • Subtitle:', data.hero.subtitle);
                } else {
                    console.log('   - No hero data in response');
                }
            })
            .catch(error => {
                console.error('   - Error loading from API:', error);
            });
        
        console.log('\n=== END DEBUG ===');
        console.log('Run window.fixHero() to force fix the hero section');
    };
    
    // Функция принудительного исправления
    window.fixHero = function() {
        console.log('Forcing hero section fix...');
        
        // Устанавливаем тексты
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        if (heroTitle) {
            heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
            console.log('✓ Hero title set');
        }
        
        if (heroSubtitle) {
            heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
            console.log('✓ Hero subtitle set');
        }
        
        // Если админ, добавляем кнопки редактирования
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true' || 
                       localStorage.getItem('username') === 'admin' ||
                       localStorage.getItem('userRole') === 'admin';
        
        if (isAdmin) {
            console.log('Adding edit buttons for admin...');
            
            // Пробуем разные методы добавления кнопок
            if (window.heroEditor && typeof window.heroEditor.init === 'function') {
                window.heroEditor.init();
                console.log('✓ Called heroEditor.init()');
            }
            
            if (typeof window.forceEditButtons === 'function') {
                window.forceEditButtons();
                console.log('✓ Called forceEditButtons()');
            }
            
            // Прямое добавление кнопки если другие методы не сработали
            if (heroTitle && !heroTitle.querySelector('.hero-edit-btn')) {
                addQuickEditButton(heroTitle, true);
            }
            
            if (heroSubtitle && !heroSubtitle.querySelector('.hero-edit-btn')) {
                addQuickEditButton(heroSubtitle, false);
            }
        }
        
        console.log('✓ Hero section fixed!');
    };
    
    // Быстрая функция добавления кнопки
    function addQuickEditButton(element, isTitle) {
        element.style.position = 'relative';
        
        const button = document.createElement('button');
        button.className = 'hero-edit-btn-quick';
        button.innerHTML = '✏️';
        button.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 30px;
            height: 30px;
            background: red;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 9999;
            font-size: 16px;
        `;
        
        button.onclick = function() {
            const newText = prompt(`Редактировать ${isTitle ? 'заголовок' : 'подзаголовок'}:`, 
                                  isTitle ? element.innerHTML : element.textContent);
            if (newText !== null) {
                if (isTitle) {
                    element.innerHTML = newText;
                } else {
                    element.textContent = newText;
                }
                
                // Сохраняем на сервере
                fetch('/api/homepage-texts')
                    .then(r => r.json())
                    .then(data => {
                        if (!data.hero) data.hero = {};
                        data.hero[isTitle ? 'title' : 'subtitle'] = newText;
                        return fetch('/api/homepage-texts', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(data)
                        });
                    })
                    .then(() => console.log('✓ Saved to server'))
                    .catch(e => console.error('Error saving:', e));
            }
        };
        
        element.appendChild(button);
        console.log(`✓ Quick edit button added to ${isTitle ? 'title' : 'subtitle'}`);
    }
    
    // Автоматический запуск отладки при загрузке
    console.log('Debug Hero loaded. Run window.debugHero() for diagnostics or window.fixHero() to fix.');
    
    // Запускаем отладку через секунду после загрузки
    setTimeout(() => {
        console.log('Auto-running debug...');
        window.debugHero();
    }, 1000);
})();
