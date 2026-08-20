// Force Edit Buttons - Добавляет кнопки редактирования ТОЛЬКО для администратора

(function() {
    // Проверяем, является ли пользователь администратором
    function isAdmin() {
        const adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        const username = localStorage.getItem('username') === 'admin';
        return adminLoggedIn || username;
    }
    
    // Если не админ - выходим
    if (!isAdmin()) {
        console.log('Force Edit Buttons: User is not admin, skipping...');
        return;
    }
    
    console.log('Force Edit Buttons: Admin detected, initializing...');
    
    function addEditButtonForce(element) {
        if (!element) {
            console.log('Element not found');
            return;
        }
        
        // Удаляем существующую кнопку если есть
        const existingButton = element.querySelector('.force-edit-btn');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Убеждаемся что элемент позиционирован
        element.style.position = 'relative';
        
        // Создаем кнопку
        const button = document.createElement('button');
        button.className = 'force-edit-btn';
        button.innerHTML = '✏️';
        button.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 40px;
            height: 40px;
            background: #ff0000;
            color: white;
            border: 3px solid white;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            z-index: 99999;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        button.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Для элементов с HTML используем innerHTML, для остальных textContent
            const isHtmlElement = element.classList.contains('hero-title') || 
                                 element.classList.contains('campaign-title') || 
                                 element.classList.contains('about-title');
            
            const currentText = isHtmlElement ? element.innerHTML : element.textContent;
            const newText = prompt('Edit text (use <br> for line breaks in titles):', currentText);
            
            if (newText !== null && newText !== currentText) {
                if (isHtmlElement) {
                    // Для заголовков сохраняем HTML
                    element.innerHTML = newText;
                } else {
                    element.textContent = newText;
                }
                
                // Показываем уведомление
                const notification = document.createElement('div');
                notification.textContent = '✅ Text updated!';
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #4CAF50;
                    color: white;
                    padding: 15px 25px;
                    border-radius: 8px;
                    z-index: 100000;
                    font-family: Arial;
                    font-weight: bold;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.remove();
                }, 3000);
                
                // Пытаемся сохранить через API
                const contentToSave = isHtmlElement ? element.innerHTML : element.textContent;
                saveToAPI(element, contentToSave);
            }
        };
        
        element.appendChild(button);
        console.log('Button added to:', element.className);
    }
    
    function saveToAPI(element, content) {
        let sectionId = '';
        let key = '';
        
        // Определяем секцию и ключ для сохранения
        if (element.classList.contains('hero-title')) {
            sectionId = 'hero';
            key = 'title';
        } else if (element.classList.contains('hero-subtitle')) {
            sectionId = 'hero';
            key = 'subtitle';
        } else if (element.classList.contains('campaign-title')) {
            // Определяем какая это кампания
            const campaignSection = element.closest('.campaign-section');
            if (campaignSection) {
                if (campaignSection.classList.contains('campaign-dark')) {
                    sectionId = 'campaign1';
                } else if (campaignSection.classList.contains('campaign-split-reverse')) {
                    sectionId = 'campaign3';
                } else {
                    sectionId = 'campaign2';
                }
            }
            key = 'title';
        } else if (element.classList.contains('campaign-description')) {
            const campaignSection = element.closest('.campaign-section');
            if (campaignSection) {
                if (campaignSection.classList.contains('campaign-dark')) {
                    sectionId = 'campaign1';
                } else if (campaignSection.classList.contains('campaign-split-reverse')) {
                    sectionId = 'campaign3';
                } else {
                    sectionId = 'campaign2';
                }
            }
            key = 'description';
        } else if (element.classList.contains('about-title')) {
            sectionId = 'about';
            key = 'title';
        } else if (element.classList.contains('about-text')) {
            sectionId = 'about';
            key = 'text';
        }
        
        if (sectionId && key) {
            fetch('/api/homepage-texts')
                .then(response => response.json())
                .then(data => {
                    if (!data[sectionId]) {
                        data[sectionId] = {};
                    }
                    data[sectionId][key] = content;
                    
                    return fetch('/api/homepage-texts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });
                })
                .then(() => {
                    console.log('Saved to API');
                })
                .catch(error => {
                    console.error('Error saving:', error);
                });
        }
    }
    
    function init() {
        console.log('Force Edit Buttons: Initializing...');
        
        // Ищем элементы
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        
        console.log('Found elements:', {
            heroTitle: !!heroTitle,
            heroSubtitle: !!heroSubtitle
        });
        
        // Добавляем кнопки
        if (heroTitle) {
            addEditButtonForce(heroTitle);
        } else {
            console.error('Hero title not found!');
        }
        
        if (heroSubtitle) {
            addEditButtonForce(heroSubtitle);
        } else {
            console.error('Hero subtitle not found!');
        }
        
        // Также добавим к другим элементам для теста
        document.querySelectorAll('.campaign-title, .campaign-description, .about-title, .about-text').forEach(el => {
            addEditButtonForce(el);
        });
    }
    
    // Запускаем когда DOM готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Даем время другим скриптам загрузиться
        setTimeout(init, 1000);
    }
    
    // Также добавляем глобальную функцию для ручного запуска
    window.forceEditButtons = init;
    
    console.log('Force Edit Buttons: Script loaded. Call window.forceEditButtons() to manually trigger.');
})();
