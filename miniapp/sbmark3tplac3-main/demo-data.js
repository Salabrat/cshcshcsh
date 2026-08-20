// Demo data for testing the product database
function createDemoProducts() {
    // Function disabled - no demo products
    console.log('Demo products disabled');
    return;
}

// Function to clear all products (for testing)
function clearAllProducts() {
    if (!window.productDB) {
        console.error('Product database not available');
        return;
    }
    
    if (confirm('Вы уверены, что хотите удалить ВСЕ товары? Это действие нельзя отменить.')) {
        window.productDB.clearDatabase();
        console.log('All products cleared');
        
        // Refresh product display if loader is available
        if (window.productLoader) {
            window.productLoader.refresh();
        }
        
        alert('Все товары удалены');
    }
}

// Function to remove specific product by name
function removeProductByName(productName) {
    if (!window.productDB) {
        console.error('Product database not available');
        return;
    }
    
    const allProducts = window.productDB.getAllProducts();
    const productToRemove = allProducts.find(p => p.name === productName);
    
    if (productToRemove) {
        window.productDB.deleteProduct(productToRemove.id);
        console.log(`Product "${productName}" removed from database`);
        
        // Refresh product display if loader is available
        if (window.productLoader) {
            window.productLoader.refresh();
        }
        
        alert(`Товар "${productName}" удален`);
    } else {
        console.log(`Product "${productName}" not found`);
        alert(`Товар "${productName}" не найден`);
    }
}

// Make functions globally available for testing
window.createDemoProducts = createDemoProducts;
window.clearAllProducts = clearAllProducts;
window.removeProductByName = removeProductByName;

// Clear all existing demo/test products on load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.productDB) {
            const allProducts = window.productDB.getAllProducts();
            const testProductNames = [
                'Куртка C.P. Company Goggle',
                'Кроссовки C.P. Company',
                'Очки C.P. Company',
                'GORE G-TYPE LONG MILLE JACKET'
            ];
            
            let removedCount = 0;
            allProducts.forEach(product => {
                // Remove any test products
                if (testProductNames.includes(product.name) || product.name.includes('DEMO') || product.name.includes('TEST')) {
                    console.log(`Removing test product: ${product.name}`);
                    window.productDB.deleteProduct(product.id);
                    removedCount++;
                }
            });
            
            if (removedCount > 0) {
                console.log(`Removed ${removedCount} test products`);
                if (window.productLoader) {
                    window.productLoader.refresh();
                }
            }
        }
    }, 1500);
});
