// Admin Hero Fix - Простое и надежное решение для редактирования hero секции

(function() {
    'use strict';
    
    // Главная функция инициализации
    function initAdminHeroEditor() {
        console.log('Admin Hero Fix: Starting initialization...');
        
        // Проверяем статус админа
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true' || 
                       localStorage.getItem('username') === 'admin' ||
                       localStorage.getItem('userRole') === 'admin';
        
        console.log('Admin status:', isAdmin);
        
        // Сначала восстанавливаем тексты для всех
        restoreTexts();
        
        // Если админ - добавляем кнопки редактирования
        if (isAdmin) {
            setTimeout(() => {
                addEditButtons();
            }, 500);
        }
    }
    
    // Восстановление текстов
    function restoreTexts() {
        console.log('Restoring hero texts...');
        
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        // Загружаем с сервера
        fetch('/api/homepage-texts')
            .then(response => response.json())
            .then(data => {
                if (data.hero) {
                    if (heroTitle && data.hero.title) {
                        heroTitle.innerHTML = data.hero.title;
                        console.log('Title restored from server');
                    }
                    if (heroSubtitle && data.hero.subtitle) {
                        heroSubtitle.textContent = data.hero.subtitle;
                        console.log('Subtitle restored from server');
                    }
                } else {
                    // Если нет данных на сервере, ставим дефолтные
                    setDefaultTexts();
                }
            })
            .catch(error => {
                console.error('Error loading texts:', error);
                setDefaultTexts();
            });
    }
    
    // Установка дефолтных текстов
    function setDefaultTexts() {
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        if (heroTitle && !heroTitle.innerHTML.trim()) {
            heroTitle.innerHTML = 'HIGH<br>PERFORMANCE<br>JACKETS';
            console.log('Default title set');
        }
        
        if (heroSubtitle && !heroSubtitle.textContent.trim()) {
            heroSubtitle.textContent = 'Cutting-edge technologies for all winter conditions';
            console.log('Default subtitle set');
        }
    }
    
    // Добавление кнопок редактирования
    function addEditButtons() {
        console.log('Adding edit buttons for admin...');
        
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        // Удаляем старые кнопки если есть
        document.querySelectorAll('.admin-hero-edit-btn').forEach(btn => btn.remove());
        
        if (heroTitle) {
            addEditButton(heroTitle, 'title');
        }
        
        if (heroSubtitle) {
            addEditButton(heroSubtitle, 'subtitle');
        }
    }
    
    // Добавление кнопки к элементу
    function addEditButton(element, type) {
        // Убеждаемся что элемент позиционирован
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        // Создаем кнопку
        const button = document.createElement('button');
        button.className = 'admin-hero-edit-btn';
        button.innerHTML = '✏️';
        button.title = `Редактировать ${type === 'title' ? 'заголовок' : 'подзаголовок'}`;
        button.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            width: 35px;
            height: 35px;
            background: #ff4444;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            opacity: 0.8;
        `;
        
        // Эффекты при наведении
        button.onmouseenter = () => {
            button.style.opacity = '1';
            button.style.transform = 'scale(1.1)';
        };
        
        button.onmouseleave = () => {
            button.style.opacity = '0.8';
            button.style.transform = 'scale(1)';
        };
        
        // Обработчик клика
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEditDialog(element, type);
        };
        
        element.appendChild(button);
        console.log(`Edit button added to ${type}`);
    }
    
    // Открытие диалога редактирования
    function openEditDialog(element, type) {
        const isTitle = type === 'title';
        const currentValue = isTitle ? element.innerHTML : element.textContent;
        
        // Создаем оверлей
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Создаем диалог
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0; font-family: 'Inter', sans-serif;">
                Редактировать ${isTitle ? 'заголовок' : 'подзаголовок'}
            </h3>
            ${isTitle ? 
                `<textarea id="edit-input" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: 'Inter', sans-serif; font-size: 14px; box-sizing: border-box;">${currentValue}</textarea>
                 <p style="margin: 10px 0; color: #666; font-size: 12px;">Используйте &lt;br&gt; для переноса строки</p>` :
                `<input type="text" id="edit-input" value="${currentValue}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: 'Inter', sans-serif; font-size: 14px; box-sizing: border-box;">`
            }
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-btn" style="padding: 10px 20px; background: #f0f0f0; border: none; border-radius: 5px; cursor: pointer;">Отмена</button>
                <button id="save-btn" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Сохранить</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Фокус на поле ввода
        const input = document.getElementById('edit-input');
        input.focus();
        input.select();
        
        // Обработчики кнопок
        document.getElementById('cancel-btn').onclick = () => {
            overlay.remove();
        };
        
        document.getElementById('save-btn').onclick = () => {
            const newValue = input.value.trim();
            if (newValue) {
                // Обновляем на странице
                if (isTitle) {
                    element.innerHTML = newValue;
                } else {
                    element.textContent = newValue;
                }
                
                // Сохраняем на сервере
                saveToServer(type, newValue);
                
                // Закрываем диалог
                overlay.remove();
                
                // Показываем уведомление
                showNotification('Текст успешно сохранен!');
                
                // Восстанавливаем кнопку редактирования
                setTimeout(() => {
                    addEditButton(element, type);
                }, 100);
            }
        };
        
        // Закрытие по Escape
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
            }
        });
        
        // Закрытие по клику вне диалога
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
    }
    
    // Сохранение на сервере
    function saveToServer(type, value) {
        fetch('/api/homepage-texts')
            .then(response => response.json())
            .then(data => {
                if (!data.hero) {
                    data.hero = {};
                }
                data.hero[type] = value;
                
                return fetch('/api/homepage-texts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            })
            .then(response => {
                if (response.ok) {
                    console.log('Saved to server successfully');
                } else {
                    throw new Error('Server error');
                }
            })
            .catch(error => {
                console.error('Error saving:', error);
                showNotification('Ошибка при сохранении!', 'error');
            });
    }
    
    // Показ уведомления
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 100000;
            font-family: 'Inter', sans-serif;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Добавляем стили анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdminHeroEditor);
    } else {
        // Небольшая задержка для загрузки DOM
        setTimeout(initAdminHeroEditor, 100);
    }
    
    // Экспортируем функции для отладки
    window.adminHeroFix = {
        init: initAdminHeroEditor,
        restoreTexts: restoreTexts,
        addButtons: addEditButtons
    };
    
    console.log('Admin Hero Fix loaded. Use window.adminHeroFix.init() to reinitialize.');
})();
