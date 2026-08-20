// Hero Section Editor - Специальный редактор для hero секции
(function() {
    'use strict';
    
    // Проверяем, является ли пользователь администратором
    function isAdmin() {
        const adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        const username = localStorage.getItem('username') === 'admin';
        const userRole = localStorage.getItem('userRole') === 'admin';
        return adminLoggedIn || username || userRole;
    }
    
    // Создаем уведомление
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `hero-editor-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 100000;
            animation: slideIn 0.3s ease;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Создаем модальное окно редактирования
    function createEditModal(element, isTitle) {
        const modal = document.createElement('div');
        modal.className = 'hero-edit-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            animation: fadeIn 0.3s ease;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            animation: slideUp 0.3s ease;
        `;
        
        const title = document.createElement('h3');
        title.textContent = isTitle ? 'Редактировать заголовок' : 'Редактировать подзаголовок';
        title.style.cssText = `
            margin: 0 0 20px 0;
            font-family: 'Inter', sans-serif;
            font-size: 20px;
            color: #333;
        `;
        
        const label = document.createElement('label');
        label.textContent = isTitle ? 'Текст заголовка (поддерживает HTML теги):' : 'Текст подзаголовка:';
        label.style.cssText = `
            display: block;
            margin-bottom: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            color: #666;
        `;
        
        const input = isTitle ? document.createElement('textarea') : document.createElement('input');
        if (isTitle) {
            input.value = element.innerHTML;
            input.rows = 4;
            input.style.cssText = `
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-family: 'Inter', sans-serif;
                font-size: 16px;
                resize: vertical;
                min-height: 100px;
                box-sizing: border-box;
                transition: border-color 0.3s ease;
            `;
        } else {
            input.type = 'text';
            input.value = element.textContent;
            input.style.cssText = `
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-family: 'Inter', sans-serif;
                font-size: 16px;
                box-sizing: border-box;
                transition: border-color 0.3s ease;
            `;
        }
        
        input.addEventListener('focus', () => {
            input.style.borderColor = '#4CAF50';
        });
        
        input.addEventListener('blur', () => {
            input.style.borderColor = '#e0e0e0';
        });
        
        if (isTitle) {
            const hint = document.createElement('p');
            hint.textContent = 'Подсказка: используйте <br> для переноса строки';
            hint.style.cssText = `
                margin: 10px 0;
                font-size: 12px;
                color: #999;
                font-family: 'Inter', sans-serif;
            `;
            modalContent.appendChild(hint);
        }
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 20px;
            justify-content: flex-end;
        `;
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Отмена';
        cancelButton.style.cssText = `
            padding: 10px 20px;
            background: #f5f5f5;
            border: none;
            border-radius: 6px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s ease;
        `;
        
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.background = '#e0e0e0';
        });
        
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.background = '#f5f5f5';
        });
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Сохранить';
        saveButton.style.cssText = `
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s ease;
        `;
        
        saveButton.addEventListener('mouseenter', () => {
            saveButton.style.background = '#45a049';
        });
        
        saveButton.addEventListener('mouseleave', () => {
            saveButton.style.background = '#4CAF50';
        });
        
        // Обработчики кнопок
        cancelButton.addEventListener('click', () => {
            modal.remove();
        });
        
        saveButton.addEventListener('click', async () => {
            const newValue = input.value.trim();
            if (!newValue) {
                showNotification('Текст не может быть пустым', 'error');
                return;
            }
            
            // Обновляем элемент на странице
            if (isTitle) {
                element.innerHTML = newValue;
            } else {
                element.textContent = newValue;
            }
            
            // Сохраняем на сервере
            try {
                const response = await fetch('/api/homepage-texts', {
                    method: 'GET'
                });
                const data = await response.json();
                
                // Обновляем данные
                if (!data.hero) {
                    data.hero = {};
                }
                
                if (isTitle) {
                    data.hero.title = newValue;
                } else {
                    data.hero.subtitle = newValue;
                }
                
                // Отправляем обновленные данные
                const saveResponse = await fetch('/api/homepage-texts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                if (saveResponse.ok) {
                    showNotification('Текст успешно сохранен!');
                    modal.remove();
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                console.error('Error saving text:', error);
                showNotification('Ошибка при сохранении', 'error');
            }
        });
        
        // Сохранение по Enter (только для input, не для textarea)
        if (!isTitle) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveButton.click();
                }
            });
        }
        
        // Закрытие по Escape
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
        
        // Собираем модальное окно
        modalContent.appendChild(title);
        modalContent.appendChild(label);
        modalContent.appendChild(input);
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);
        
        return modal;
    }
    
    // Добавляем кнопку редактирования к элементу
    function addEditButton(element, isTitle) {
        if (!element || element.dataset.heroEditorAdded) {
            return;
        }
        
        element.dataset.heroEditorAdded = 'true';
        element.style.position = 'relative';
        
        const button = document.createElement('button');
        button.className = 'hero-edit-btn';
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        button.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #ff4444;
            color: white;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4);
        `;
        
        // Показываем кнопку при наведении
        const showButton = () => {
            button.style.opacity = '1';
            button.style.transform = 'scale(1.1)';
        };
        
        const hideButton = () => {
            button.style.opacity = '0';
            button.style.transform = 'scale(1)';
        };
        
        element.addEventListener('mouseenter', showButton);
        element.addEventListener('mouseleave', hideButton);
        button.addEventListener('mouseenter', showButton);
        button.addEventListener('mouseleave', hideButton);
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = createEditModal(element, isTitle);
            document.body.appendChild(modal);
        });
        
        element.appendChild(button);
    }
    
    // Добавляем стили анимации
    function addAnimationStyles() {
        if (document.getElementById('hero-editor-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'hero-editor-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes slideIn {
                from { 
                    opacity: 0;
                    transform: translateX(100px);
                }
                to { 
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOut {
                from { 
                    opacity: 1;
                    transform: translateX(0);
                }
                to { 
                    opacity: 0;
                    transform: translateX(100px);
                }
            }
            
            .hero-edit-btn:hover svg {
                transform: rotate(5deg);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Инициализация
    function init() {
        if (!isAdmin()) {
            console.log('Hero Editor: User is not admin');
            return;
        }
        
        console.log('Hero Editor: Initializing for admin user');
        
        addAnimationStyles();
        
        // Находим элементы hero секции
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        if (heroTitle) {
            console.log('Hero Editor: Adding edit button to hero title');
            addEditButton(heroTitle, true);
        }
        
        if (heroSubtitle) {
            console.log('Hero Editor: Adding edit button to hero subtitle');
            addEditButton(heroSubtitle, false);
        }
        
        // НЕ загружаем тексты здесь, так как load-saved-texts.js уже делает это
        // loadSavedTexts();
    }
    
    // Функция loadSavedTexts удалена, так как load-saved-texts.js уже загружает тексты
    
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Экспортируем функцию для принудительной инициализации
    window.heroEditor = {
        init: init,
        isAdmin: isAdmin
    };
})();
