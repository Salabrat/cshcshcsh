const fs = require('fs');
const path = require('path');

// List of HTML files to update
const htmlFiles = [
    'index.html',
    'category-jackets.html',
    'category-shoes.html',
    'category-coats.html',
    'category-sweaters.html',
    'category-glasses.html',
    'category-pants.html',
    'category-hats.html',
    'category-kurtki.html',
    'category-obuv.html',
    'shop-all.html',
    'product.html',
    'login.html',
    'admin-login.html',
    'admin-dashboard.html'
];

// Script tag to add
const themeScriptTag = '    <script src="theme-toggle.js"></script>\n';

htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if theme-toggle.js is already included
        if (!content.includes('theme-toggle.js')) {
            // Add the script tag before </body>
            content = content.replace('</body>', themeScriptTag + '</body>');
            
            // Write the updated content back
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${file}`);
        } else {
            console.log(`Already has theme script: ${file}`);
        }
    } else {
        console.log(`File not found: ${file}`);
    }
});

console.log('Done adding theme-toggle.js to HTML files!');
