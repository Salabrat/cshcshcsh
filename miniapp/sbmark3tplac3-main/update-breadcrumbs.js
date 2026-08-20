const fs = require('fs');
const path = require('path');

// List of category files to update
const categoryFiles = [
    'category-shoes.html',
    'category-coats.html',
    'category-sweaters.html',
    'category-glasses.html',
    'category-pants.html',
    'category-hats.html',
    'category-kurtki.html',
    'category-obuv.html'
];

// Category names mapping
const categoryNames = {
    'category-shoes.html': 'ОБУВЬ',
    'category-coats.html': 'ПАЛЬТО',
    'category-sweaters.html': 'КОФТЫ',
    'category-glasses.html': 'ОЧКИ',
    'category-pants.html': 'ШТАНЫ',
    'category-hats.html': 'ГОЛОВНОЙ УБОР',
    'category-kurtki.html': 'КУРТКИ',
    'category-obuv.html': 'ОБУВЬ'
};

categoryFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const categoryName = categoryNames[file];
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Find and remove the breadcrumb section outside main
        const breadcrumbPattern = /    <!-- Breadcrumb -->\n    <nav class="breadcrumb">\n        <div class="container">\n            <a href="index\.html">HOME<\/a> \/ <a href="#">SHOP<\/a> \/ <span>[^<]+<\/span>\n        <\/div>\n    <\/nav>\n\n    <!-- Main Content -->\n    <main class="shop-main">\n        <div class="container">/g;
        
        // Replace with main content with breadcrumb inside
        const replacement = `    <!-- Main Content -->
    <main class="shop-main">
        <div class="container">
            <!-- Breadcrumb -->
            <nav class="breadcrumb">
                <a href="index.html">HOME</a> / <a href="#">SHOP</a> / <span>${categoryName}</span>
            </nav>
`;
        
        content = content.replace(breadcrumbPattern, replacement);
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${file}`);
    } catch (error) {
        console.error(`Error updating ${file}:`, error);
    }
});

console.log('All category files updated!');
