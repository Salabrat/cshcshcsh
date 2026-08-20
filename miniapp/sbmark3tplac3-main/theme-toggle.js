// Theme Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check for saved theme preference or default to light theme
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Apply saved theme on page load
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // Add theme toggle button to all pages
    function addThemeToggleButton() {
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            // Check if button already exists
            if (!document.querySelector('.theme-toggle')) {
                // Create theme toggle button
                const themeToggle = document.createElement('button');
                themeToggle.className = 'theme-toggle header-icon';
                themeToggle.setAttribute('aria-label', 'Toggle theme');
                
                // Set icon based on current theme
                const isDark = document.body.classList.contains('dark-theme');
                themeToggle.innerHTML = isDark ? 
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
                
                // Insert before the first icon in header-actions
                const firstIcon = headerActions.querySelector('.header-icon');
                if (firstIcon) {
                    headerActions.insertBefore(themeToggle, firstIcon);
                } else {
                    headerActions.appendChild(themeToggle);
                }
                
                // Add click event listener
                themeToggle.addEventListener('click', toggleTheme);
            }
        }
    }
    
    // Toggle theme function
    function toggleTheme() {
        const body = document.body;
        const themeToggle = document.querySelector('.theme-toggle');
        
        if (body.classList.contains('dark-theme')) {
            // Switch to light theme
            body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            
            // Update icon to moon
            if (themeToggle) {
                themeToggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>`;
            }
        } else {
            // Switch to dark theme
            body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            
            // Update icon to sun
            if (themeToggle) {
                themeToggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>`;
            }
        }
    }
    
    // Add theme toggle button when DOM is ready
    addThemeToggleButton();
    
    // Also try to add button after a short delay in case of dynamic content
    setTimeout(addThemeToggleButton, 100);
    
    // Make toggleTheme globally available
    window.toggleTheme = toggleTheme;
});
