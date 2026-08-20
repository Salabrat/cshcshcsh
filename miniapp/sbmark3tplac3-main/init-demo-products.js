// Initialize demo products if database is empty
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!window.productDB) {
            console.error('Database not initialized');
            return;
        }
        
        // Check if we have any products
        const allProducts = window.productDB.getAllProducts();
        console.log('Current products in database:', allProducts.length);
        
        if (allProducts.length === 0) {
            console.log('No products found, adding demo products...');
            
            // Demo products for different categories
            const demoProducts = [
                // Jackets
                {
                    name: 'GORE G-TYPE JACKET',
                    description: 'Водонепроницаемая куртка с капюшоном из технологичной ткани GORE-TEX',
                    price: 89900,
                    sizes: ['S', 'M', 'L', 'XL'],
                    images: ['https://via.placeholder.com/400x600/000000/FFFFFF?text=Jacket+1'],
                    category: 'jackets'
                },
                {
                    name: 'METROPOLIS SERIES JACKET',
                    description: 'Утепленная куртка из коллекции Metropolis с фирменными линзами на капюшоне',
                    price: 125000,
                    sizes: ['M', 'L', 'XL'],
                    images: ['https://via.placeholder.com/400x600/333333/FFFFFF?text=Jacket+2'],
                    category: 'jackets'
                },
                // Shoes
                {
                    name: 'TECHNICAL SNEAKERS',
                    description: 'Технологичные кроссовки с амортизирующей подошвой',
                    price: 45000,
                    sizes: ['40', '41', '42', '43', '44'],
                    images: ['https://via.placeholder.com/400x600/666666/FFFFFF?text=Shoes+1'],
                    category: 'shoes'
                },
                {
                    name: 'URBAN BOOTS',
                    description: 'Городские ботинки из премиальной кожи',
                    price: 68000,
                    sizes: ['41', '42', '43', '44', '45'],
                    images: ['https://via.placeholder.com/400x600/999999/FFFFFF?text=Shoes+2'],
                    category: 'shoes'
                },
                // Coats
                {
                    name: 'WOOL OVERCOAT',
                    description: 'Классическое пальто из шерсти мериноса',
                    price: 145000,
                    sizes: ['S', 'M', 'L', 'XL'],
                    images: ['https://via.placeholder.com/400x600/2C2C2C/FFFFFF?text=Coat+1'],
                    category: 'coats'
                },
                // Sweaters
                {
                    name: 'LENS CREW SWEATER',
                    description: 'Свитер с фирменной линзой на рукаве',
                    price: 35000,
                    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
                    images: ['https://via.placeholder.com/400x600/4A4A4A/FFFFFF?text=Sweater+1'],
                    category: 'sweaters'
                },
                // Glasses
                {
                    name: 'AVIATOR SUNGLASSES',
                    description: 'Солнцезащитные очки в стиле авиатор',
                    price: 28000,
                    sizes: ['ONE SIZE'],
                    images: ['https://via.placeholder.com/400x600/1A1A1A/FFFFFF?text=Glasses+1'],
                    category: 'glasses'
                },
                // Pants
                {
                    name: 'CARGO PANTS',
                    description: 'Функциональные карго брюки с множеством карманов',
                    price: 52000,
                    sizes: ['28', '30', '32', '34', '36'],
                    images: ['https://via.placeholder.com/400x600/3D3D3D/FFFFFF?text=Pants+1'],
                    category: 'pants'
                },
                // Hats
                {
                    name: 'GOGGLE BEANIE',
                    description: 'Вязаная шапка с фирменными линзами',
                    price: 18000,
                    sizes: ['ONE SIZE'],
                    images: ['https://via.placeholder.com/400x600/5A5A5A/FFFFFF?text=Hat+1'],
                    category: 'hats'
                }
            ];
            
            // Add demo products to database
            demoProducts.forEach(product => {
                window.productDB.addProduct(product.category, product);
            });
            
            console.log('Demo products added successfully!');
            
            // Reload products display
            if (window.productLoader) {
                window.productLoader.refresh();
            }
        }
    }, 500);
});
