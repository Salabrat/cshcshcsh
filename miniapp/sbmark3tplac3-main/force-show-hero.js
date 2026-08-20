// Force Show Hero - Принудительное отображение текстов hero секции

(function() {
    console.log('🔧 FORCE SHOW HERO - Starting...');
    
    function forceShow() {
        // Метод 1: Поиск по классу
        let heroTitle = document.querySelector('.hero-title');
        let heroSubtitle = document.querySelector('.hero-subtitle');
        
        // Метод 2: Поиск по структуре если не нашли по классу
        if (!heroTitle || !heroSubtitle) {
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) {
                if (!heroTitle) {
                    heroTitle = heroContent.querySelector('h1');
                }
                if (!heroSubtitle) {
                    heroSubtitle = heroContent.querySelector('p');
                }
            }
        }
        
        // Метод 3: Поиск по позиции в DOM
        if (!heroTitle || !heroSubtitle) {
            const heroSection = document.querySelector('.hero-section');
            if (heroSection) {
                if (!heroTitle) {
                    heroTitle = heroSection.querySelector('h1');
                }
                if (!heroSubtitle) {
                    heroSubtitle = heroSection.querySelector('p');
                }
            }
        }
        
        console.log('Found hero title:', !!heroTitle);
        console.log('Found hero subtitle:', !!heroSubtitle);
        
        // ПРИНУДИТЕЛЬНО устанавливаем тексты и стили
        if (heroTitle) {
            // Устанавливаем текст
            heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
            
            // Принудительно показываем
            heroTitle.style.display = 'block !important';
            heroTitle.style.visibility = 'visible !important';
            heroTitle.style.opacity = '1 !important';
            heroTitle.style.color = 'white';
            heroTitle.style.fontSize = '72px';
            heroTitle.style.fontWeight = '700';
            heroTitle.style.position = 'relative';
            heroTitle.style.zIndex = '10';
            
            // Убираем возможные скрытия
            heroTitle.style.removeProperty('display');
            heroTitle.style.removeProperty('visibility');
            heroTitle.style.removeProperty('opacity');
            
            console.log('✅ Hero title forced to show');
            console.log('   Content:', heroTitle.innerHTML);
            console.log('   Display:', getComputedStyle(heroTitle).display);
            console.log('   Visibility:', getComputedStyle(heroTitle).visibility);
        } else {
            console.error('❌ CANNOT FIND HERO TITLE!');
            // Пробуем создать элемент
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) {
                const newTitle = document.createElement('h1');
                newTitle.className = 'hero-title';
                newTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
                newTitle.style.color = 'white';
                newTitle.style.fontSize = '72px';
                newTitle.style.fontWeight = '700';
                
                // Вставляем перед первым элементом в hero-content
                heroContent.insertBefore(newTitle, heroContent.firstChild);
                console.log('✅ Created new hero title');
            }
        }
        
        if (heroSubtitle) {
            // Устанавливаем текст
            heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
            
            // Принудительно показываем
            heroSubtitle.style.display = 'block !important';
            heroSubtitle.style.visibility = 'visible !important';
            heroSubtitle.style.opacity = '1 !important';
            heroSubtitle.style.color = 'white';
            heroSubtitle.style.fontSize = '16px';
            heroSubtitle.style.position = 'relative';
            heroSubtitle.style.zIndex = '10';
            
            // Убираем возможные скрытия
            heroSubtitle.style.removeProperty('display');
            heroSubtitle.style.removeProperty('visibility');
            heroSubtitle.style.removeProperty('opacity');
            
            console.log('✅ Hero subtitle forced to show');
            console.log('   Content:', heroSubtitle.textContent);
            console.log('   Display:', getComputedStyle(heroSubtitle).display);
            console.log('   Visibility:', getComputedStyle(heroSubtitle).visibility);
        } else {
            console.error('❌ CANNOT FIND HERO SUBTITLE!');
            // Пробуем создать элемент
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) {
                const newSubtitle = document.createElement('p');
                newSubtitle.className = 'hero-subtitle';
                newSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
                newSubtitle.style.color = 'white';
                newSubtitle.style.fontSize = '16px';
                
                // Вставляем после заголовка
                const title = heroContent.querySelector('.hero-title, h1');
                if (title) {
                    title.insertAdjacentElement('afterend', newSubtitle);
                } else {
                    heroContent.appendChild(newSubtitle);
                }
                console.log('✅ Created new hero subtitle');
            }
        }
        
        // Добавляем кнопки для админа
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true' || 
                       localStorage.getItem('username') === 'admin';
        
        if (isAdmin) {
            console.log('👤 Admin detected, adding edit buttons...');
            
            // Находим элементы заново
            const title = document.querySelector('.hero-title');
            const subtitle = document.querySelector('.hero-subtitle');
            
            if (title) {
                addForceEditButton(title, 'title');
            }
            if (subtitle) {
                addForceEditButton(subtitle, 'subtitle');
            }
        }
    }
    
    function addForceEditButton(element, type) {
        // Удаляем старую кнопку если есть
        const oldBtn = element.querySelector('.force-edit-btn');
        if (oldBtn) oldBtn.remove();
        
        element.style.position = 'relative';
        
        const btn = document.createElement('button');
        btn.className = 'force-edit-btn';
        btn.innerHTML = '✏️';
        btn.title = `Edit ${type}`;
        btn.style.cssText = `
            position: absolute;
            top: -5px;
            right: -5px;
            width: 40px;
            height: 40px;
            background: #ff0000;
            color: white;
            border: 3px solid white;
            border-radius: 50%;
            cursor: pointer;
            z-index: 999999;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const current = type === 'title' ? element.innerHTML : element.textContent;
            const newText = prompt(`Edit ${type}:`, current);
            
            if (newText !== null && newText.trim() !== '') {
                if (type === 'title') {
                    element.innerHTML = newText;
                } else {
                    element.textContent = newText;
                }
                
                // Сохраняем
                fetch('/api/homepage-texts')
                    .then(r => r.json())
                    .then(data => {
                        if (!data.hero) data.hero = {};
                        data.hero[type] = newText;
                        return fetch('/api/homepage-texts', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(data)
                        });
                    })
                    .then(() => {
                        console.log('✅ Saved!');
                        alert('Saved successfully!');
                    })
                    .catch(e => {
                        console.error('Save error:', e);
                        alert('Error saving!');
                    });
            }
        };
        
        element.appendChild(btn);
        console.log(`✅ Edit button added to ${type}`);
    }
    
    // Запускаем сразу
    forceShow();
    
    // И еще раз через полсекунды
    setTimeout(forceShow, 500);
    
    // И еще раз через секунду
    setTimeout(forceShow, 1000);
    
    // Экспортируем
    window.forceShowHero = forceShow;
    
    console.log('🔧 FORCE SHOW HERO - Ready!');
    console.log('   Run window.forceShowHero() to force show again');
})();
