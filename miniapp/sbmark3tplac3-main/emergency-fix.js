// Emergency Fix - Экстренное восстановление hero секции

(function() {
    'use strict';
    
    console.log('🚨 EMERGENCY FIX STARTING...');
    
    // Немедленное восстановление текстов
    function emergencyRestore() {
        console.log('Step 1: Finding hero elements...');
        
        // Ищем элементы
        let heroTitle = document.querySelector('.hero-title');
        let heroSubtitle = document.querySelector('.hero-subtitle');
        
        // Если не нашли, пробуем найти по структуре
        if (!heroTitle) {
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) {
                heroTitle = heroContent.querySelector('h1');
                if (heroTitle && !heroTitle.classList.contains('hero-title')) {
                    heroTitle.classList.add('hero-title');
                }
            }
        }
        
        if (!heroSubtitle) {
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) {
                heroSubtitle = heroContent.querySelector('p');
                if (heroSubtitle && !heroSubtitle.classList.contains('hero-subtitle')) {
                    heroSubtitle.classList.add('hero-subtitle');
                }
            }
        }
        
        console.log('Hero title found:', !!heroTitle);
        console.log('Hero subtitle found:', !!heroSubtitle);
        
        // Восстанавливаем тексты
        if (heroTitle) {
            heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
            heroTitle.style.visibility = 'visible';
            heroTitle.style.display = 'block';
            console.log('✅ Title text restored');
        } else {
            console.error('❌ Hero title element not found!');
        }
        
        if (heroSubtitle) {
            heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
            heroSubtitle.style.visibility = 'visible';
            heroSubtitle.style.display = 'block';
            console.log('✅ Subtitle text restored');
        } else {
            console.error('❌ Hero subtitle element not found!');
        }
        
        // Проверяем админ статус
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true' || 
                       localStorage.getItem('username') === 'admin';
        
        console.log('Step 2: Admin status:', isAdmin);
        
        if (isAdmin && heroTitle && heroSubtitle) {
            console.log('Step 3: Adding edit functionality for admin...');
            
            // Добавляем простые кнопки редактирования
            addSimpleEditButton(heroTitle, 'title');
            addSimpleEditButton(heroSubtitle, 'subtitle');
            
            console.log('✅ Edit buttons added');
        }
    }
    
    // Простая кнопка редактирования
    function addSimpleEditButton(element, type) {
        // Удаляем старые кнопки
        const oldBtn = element.querySelector('.emergency-edit-btn');
        if (oldBtn) oldBtn.remove();
        
        // Позиционирование
        element.style.position = 'relative';
        
        // Создаем кнопку
        const btn = document.createElement('button');
        btn.className = 'emergency-edit-btn';
        btn.innerHTML = '📝 EDIT';
        btn.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            padding: 5px 10px;
            background: red;
            color: white;
            border: none;
            cursor: pointer;
            z-index: 99999;
            font-weight: bold;
            font-size: 12px;
        `;
        
        btn.onclick = function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            const currentText = type === 'title' ? element.innerHTML : element.textContent;
            const newText = prompt(`Edit ${type}:`, currentText);
            
            if (newText !== null && newText !== '') {
                if (type === 'title') {
                    element.innerHTML = newText;
                } else {
                    element.textContent = newText;
                }
                
                // Сохраняем
                saveText(type, newText);
                
                alert('✅ Saved!');
            }
        };
        
        element.appendChild(btn);
    }
    
    // Сохранение текста
    function saveText(type, value) {
        fetch('/api/homepage-texts')
            .then(r => r.json())
            .then(data => {
                if (!data.hero) data.hero = {};
                data.hero[type] = value;
                
                return fetch('/api/homepage-texts', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
            })
            .then(() => console.log('✅ Saved to server'))
            .catch(e => console.error('❌ Save error:', e));
    }
    
    // Запускаем восстановление сразу
    emergencyRestore();
    
    // И еще раз через секунду на всякий случай
    setTimeout(emergencyRestore, 1000);
    
    // Экспортируем для ручного вызова
    window.emergencyFix = emergencyRestore;
    
    console.log('🚨 EMERGENCY FIX LOADED');
    console.log('Run window.emergencyFix() to restore again');
})();
