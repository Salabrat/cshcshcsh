// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
    
    // Apply saved theme on page load
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // Theme toggle functionality
    const themeToggleBtn = document.getElementById('themeToggleLogin');
    if (themeToggleBtn) {
        // Set initial icon based on current theme
        updateThemeIcon();
        
        themeToggleBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        });
        
        function updateThemeIcon() {
            const isDark = document.body.classList.contains('dark-theme');
            themeToggleBtn.innerHTML = isDark ? 
                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>` : 
                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>`;
        }
    }
    
    // Close button functionality
    const closeBtn = document.getElementById('loginCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            // Set flag to skip loading screen
            sessionStorage.setItem('skipLoadingScreen', 'true');
            
            // Check if there's a referrer page to go back to
            if (document.referrer && document.referrer !== '') {
                window.history.back();
            } else {
                // Otherwise go to home page
                window.location.href = 'index.html';
            }
        });
    }
    
    // Password toggle functionality
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');
    
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle icon
            const icon = passwordToggle.querySelector('svg');
            if (type === 'text') {
                icon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                icon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }
    
    // Form validation
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInputField = document.getElementById('password');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInputField.value.trim();
            
            // Basic validation
            if (!email || !password) {
                showMessage('Пожалуйста, заполните все обязательные поля', 'error');
                return;
            }
            
            if (!isValidEmail(email)) {
                showMessage('Пожалуйста, введите корректный email адрес', 'error');
                return;
            }
            
            // Process login
            showMessage('Выполняется вход...', 'info');
            
            // Check for admin login (accepts admin, admin@admin.ru, admin@admin.com, etc.)
            if (email === 'admin' || email.toLowerCase().startsWith('admin@')) {
                // Try admin login via API
                fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: 'admin',
                        password: password
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Store admin token and flags
                        localStorage.setItem('adminToken', data.token);
                        localStorage.setItem('adminLoggedIn', 'true');
                        localStorage.setItem('userLoggedIn', 'true');
                        localStorage.setItem('username', 'admin');
                        localStorage.setItem('userEmail', email);
                        
                        showMessage('Добро пожаловать, администратор!', 'success');
                        
                        setTimeout(() => {
                            // Set flag to skip loading screen
                            sessionStorage.setItem('skipLoadingScreen', 'true');
                            window.location.href = 'index.html';
                        }, 1500);
                    } else {
                        showMessage('Неверные учетные данные администратора', 'error');
                    }
                })
                .catch(error => {
                    console.error('Login error:', error);
                    showMessage('Ошибка при входе. Попробуйте позже.', 'error');
                });
            } else {
                // Regular user login (simplified for now)
                localStorage.setItem('userLoggedIn', 'true');
                localStorage.removeItem('adminToken'); // Clear admin token for regular users
                
                // Extract username from email
                const username = email.split('@')[0];
                localStorage.setItem('username', username);
                localStorage.setItem('userEmail', email);
                
                showMessage('Вход выполнен успешно!', 'success');
                
                setTimeout(() => {
                    // Set flag to skip loading screen
                    sessionStorage.setItem('skipLoadingScreen', 'true');
                    window.location.href = 'index.html';
                }, 1500);
            }
        });
    }
    
    // Create account button functionality
    const createAccountBtn = document.querySelector('.create-account-btn');
    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', function() {
            // Redirect to registration page
            window.location.href = 'register.html';
        });
    }
    
    // Forgot password functionality
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            if (!email) {
                showMessage('Пожалуйста, введите ваш email адрес', 'error');
                emailInput.focus();
                return;
            }
            
            if (!isValidEmail(email)) {
                showMessage('Пожалуйста, введите корректный email адрес', 'error');
                emailInput.focus();
                return;
            }
            
            // Simulate password reset
            showMessage('Инструкции по восстановлению пароля отправлены на ваш email', 'success');
        });
    }
    
    // Input field enhancements
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        // Add focus/blur effects
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            if (this.value.trim() !== '') {
                this.parentElement.classList.add('filled');
            } else {
                this.parentElement.classList.remove('filled');
            }
        });
        
        // Real-time validation
        input.addEventListener('input', function() {
            if (this.type === 'email') {
                validateEmailField(this);
            }
        });
    });
    
    // Remember me functionality
    const rememberMeCheckbox = document.getElementById('rememberMe');
    if (rememberMeCheckbox) {
        // Load saved email if remember me was checked
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            emailInput.value = savedEmail;
            rememberMeCheckbox.checked = true;
        }
        
        rememberMeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                const email = emailInput.value.trim();
                if (email && isValidEmail(email)) {
                    localStorage.setItem('rememberedEmail', email);
                }
            } else {
                localStorage.removeItem('rememberedEmail');
            }
        });
    }
});

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateEmailField(input) {
    const email = input.value.trim();
    if (email && !isValidEmail(email)) {
        input.style.borderColor = '#ff0000';
    } else {
        input.style.borderColor = '';
    }
}

function showMessage(message, type = 'info') {
    // Remove existing message
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    // Style the message
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set colors based on type
    switch (type) {
        case 'success':
            messageDiv.style.backgroundColor = '#d4edda';
            messageDiv.style.color = '#155724';
            messageDiv.style.border = '1px solid #c3e6cb';
            break;
        case 'error':
            messageDiv.style.backgroundColor = '#f8d7da';
            messageDiv.style.color = '#721c24';
            messageDiv.style.border = '1px solid #f5c6cb';
            break;
        case 'info':
        default:
            messageDiv.style.backgroundColor = '#d1ecf1';
            messageDiv.style.color = '#0c5460';
            messageDiv.style.border = '1px solid #bee5eb';
            break;
    }
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }
    }, 5000);
}
