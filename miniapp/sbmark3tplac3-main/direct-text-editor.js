// Direct Text Editor - Добавляет редактирование текста напрямую на странице для админов
(function() {
    // Проверяем, является ли пользователь администратором
    function isAdmin() {
        const adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        const username = localStorage.getItem('username') === 'admin';
        return adminLoggedIn || username;
    }

    // Добавляем кнопку редактирования к элементу
    function addEditButton(element) {
        // Проверяем, что элемент существует и еще не имеет кнопки редактирования
        if (!element || element.querySelector('.direct-edit-button')) {
            return;
        }

        // Получаем текущее позиционирование элемента
        const position = window.getComputedStyle(element).position;
        if (position === 'static') {
            element.style.position = 'relative';
        }

        // Создаем кнопку редактирования
        const editButton = document.createElement('button');
        editButton.className = 'direct-edit-button';
        editButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editButton.setAttribute('title', 'Редактировать текст');
        
        // Стилизуем кнопку
        editButton.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #ff4444;
            color: white;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        // Добавляем обработчики событий для подсветки
        element.addEventListener('mouseenter', () => {
            editButton.style.opacity = '1';
        });
        
        element.addEventListener('mouseleave', () => {
            editButton.style.opacity = '0';
        });
        
        // Добавляем обработчик нажатия
        editButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEditor(element);
        });
        
        element.appendChild(editButton);
    }
    
    // Открываем редактор для элемента
    function openEditor(element) {
        // Сохраняем исходный текст
        const originalContent = element.innerHTML;
        const originalText = element.tagName === 'INPUT' ? element.value : element.textContent;
        
        // Создаем форму редактирования
        const editor = document.createElement('div');
        editor.className = 'direct-text-editor';
        editor.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            width: 90%;
            max-width: 500px;
        `;
        
        // Определяем тип элемента и создаем соответствующее поле ввода
        let inputField;
        if (element.classList.contains('campaign-title') || element.classList.contains('about-title') || element.classList.contains('hero-title')) {
            // Для заголовков - поле ввода с поддержкой HTML
            inputField = document.createElement('input');
            inputField.value = element.innerHTML;
            inputField.style.cssText = `
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 16px;
                margin-bottom: 15px;
            `;
        } else {
            // Для описаний - текстовая область
            inputField = document.createElement('textarea');
            inputField.value = originalText;
            inputField.rows = 5;
            inputField.style.cssText = `
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 16px;
                margin-bottom: 15px;
                resize: vertical;
            `;
        }
        
        // Создаем кнопки управления
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Сохранить';
        saveButton.style.cssText = `
            padding: 8px 16px;
            background: #000;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Отмена';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
        `;
        
        // Добавляем обработчики событий
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(editor);
            document.body.removeChild(overlay);
        });
        
        saveButton.addEventListener('click', () => {
            // Сохраняем изменения
            const newContent = inputField.value;
            
            if (element.tagName === 'INPUT') {
                element.value = newContent;
            } else if (element.classList.contains('campaign-title') || element.classList.contains('about-title')) {
                element.innerHTML = newContent;
            } else {
                element.textContent = newContent;
            }
            
            // Сохраняем в API если это доступно
            saveToAPI(element, newContent);
            
            // Закрываем редактор
            document.body.removeChild(editor);
            document.body.removeChild(overlay);
            
            // Показываем уведомление
            showNotification('Изменения сохранены!');
        });
        
        // Собираем все вместе
        buttonsContainer.appendChild(cancelButton);
        buttonsContainer.appendChild(saveButton);
        
        const title = document.createElement('h3');
        title.textContent = 'Редактирование текста';
        title.style.marginTop = '0';
        
        editor.appendChild(title);
        editor.appendChild(inputField);
        editor.appendChild(buttonsContainer);
        
        // Создаем затемненный фон
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
        `;
        
        // Добавляем на страницу
        document.body.appendChild(overlay);
        document.body.appendChild(editor);
        
        // Фокус на поле ввода
        inputField.focus();
    }
    
    // Сохраняем в API
    function saveToAPI(element, content) {
        // Определяем, какой раздел мы редактируем
        let sectionId = '';
        let key = '';
        
        const campaignSection = element.closest('.campaign-section');
        const aboutSection = element.closest('.about-section');
        const heroSection = element.closest('.hero-section');
        
        if (campaignSection) {
            if (campaignSection.classList.contains('campaign-dark')) {
                sectionId = 'campaign1';
            } else if (campaignSection.classList.contains('campaign-split')) {
                if (campaignSection.classList.contains('campaign-split-reverse')) {
                    sectionId = 'campaign3';
                } else {
                    sectionId = 'campaign2';
                }
            }
            
            // Определяем тип элемента
            if (element.classList.contains('campaign-label')) {
                key = 'label';
            } else if (element.classList.contains('campaign-title')) {
                key = 'title';
            } else if (element.classList.contains('campaign-description')) {
                key = 'description';
            }
        } else if (aboutSection) {
            sectionId = 'about';
            if (element.classList.contains('about-title')) {
                key = 'title';
            } else if (element.classList.contains('about-text')) {
                key = 'text';
            }
        } else if (heroSection || element.classList.contains('hero-title') || element.classList.contains('hero-subtitle')) {
            sectionId = 'hero';
            if (element.classList.contains('hero-title')) {
                key = 'title';
            } else if (element.classList.contains('hero-subtitle')) {
                key = 'subtitle';
            }
        }
        
        // Если удалось определить раздел и ключ, сохраняем
        if (sectionId && key) {
            // Получаем текущие данные
            fetch('/api/homepage-texts')
                .then(response => response.json())
                .then(data => {
                    // Обновляем данные
                    if (!data[sectionId]) {
                        data[sectionId] = {};
                    }
                    
                    data[sectionId][key] = content;
                    
                    // Сохраняем обновленные данные
                    return fetch('/api/homepage-texts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });
                })
                .catch(error => {
                    console.error('Error saving text:', error);
                    showNotification('Ошибка при сохранении. Изменения могут не сохраниться при перезагрузке страницы.', 'error');
                });
        }
    }
    
    // Показываем уведомление
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `direct-edit-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // Основная функция инициализации
    function init() {
        // Проверяем, является ли пользователь администратором
        if (!isAdmin()) {
            console.log('Direct Text Editor: User is not admin');
            return;
        }
        
        console.log('Direct Text Editor: Admin mode active, initializing...');
        
        // Добавляем стили для анимации
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
            
            .direct-edit-button:hover {
                background: #ff0000 !important;
                transform: scale(1.15) !important;
                box-shadow: 0 4px 12px rgba(255, 0, 0, 0.4) !important;
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(style);
        
        // Находим все нужные элементы
        const campaignLabels = document.querySelectorAll('.campaign-label');
        const campaignTitles = document.querySelectorAll('.campaign-title');
        const campaignDescriptions = document.querySelectorAll('.campaign-description');
        const aboutTitle = document.querySelector('.about-title');
        const aboutText = document.querySelector('.about-text');
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        console.log('Direct Text Editor: Found elements:', {
            campaignLabels: campaignLabels.length,
            campaignTitles: campaignTitles.length,
            campaignDescriptions: campaignDescriptions.length,
            aboutTitle: !!aboutTitle,
            aboutText: !!aboutText,
            heroTitle: !!heroTitle,
            heroSubtitle: !!heroSubtitle
        });
        
        // Добавляем кнопки редактирования
        campaignLabels.forEach(element => addEditButton(element));
        campaignTitles.forEach(element => addEditButton(element));
        campaignDescriptions.forEach(element => addEditButton(element));
        
        if (aboutTitle) addEditButton(aboutTitle);
        if (aboutText) addEditButton(aboutText);
        if (heroTitle) {
            console.log('Adding edit button to hero-title');
            addEditButton(heroTitle);
        }
        if (heroSubtitle) {
            console.log('Adding edit button to hero-subtitle');
            addEditButton(heroSubtitle);
        }
    }
    
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
