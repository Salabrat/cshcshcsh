// Product Database API Client
// This version works with the Node.js backend instead of localStorage

class ProductDatabaseAPI {
    constructor() {
        this.apiUrl = '/api';
        this.initialized = false;
        this.init();
    }

    async init() {
        try {
            // Test connection to server
            const response = await fetch(`${this.apiUrl}/products`);
            if (response.ok) {
                this.initialized = true;
                console.log('Connected to backend server');
            } else {
                console.error('Failed to connect to backend server');
                this.fallbackToLocalStorage();
            }
        } catch (error) {
            console.error('Server not running, falling back to localStorage:', error);
            this.fallbackToLocalStorage();
        }
    }

    fallbackToLocalStorage() {
        console.warn('Using localStorage fallback - start the server with "npm start" for persistent storage');
        // Load the original database.js as fallback
        if (window.ProductDatabase) {
            window.productDB = new ProductDatabase();
        }
    }

    // Get all products
    async getAllProducts() {
        try {
            const response = await fetch(`${this.apiUrl}/products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            
            const data = await response.json();
            const allProducts = [];
            
            for (const category in data.products) {
                allProducts.push(...data.products[category]);
            }
            
            return allProducts;
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    // Get products by category
    async getProductsByCategory(category) {
        try {
            const response = await fetch(`${this.apiUrl}/products/${category}`);
            if (!response.ok) throw new Error('Failed to fetch category products');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching category products:', error);
            return [];
        }
    }

    // Get trending products
    async getTrendingProducts(limit = 4) {
        try {
            const allProducts = await this.getAllProducts();
            const trendingProducts = allProducts.filter(product => product.isTrending && product.isActive);
            // Return limited number of trending products
            return trendingProducts.slice(0, limit);
        } catch (error) {
            console.error('Error getting trending products:', error);
            return [];
        }
    }

    // Get product by ID
    async getProductById(productId) {
        try {
            const response = await fetch(`${this.apiUrl}/product/${productId}`);
            if (!response.ok) throw new Error('Product not found');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching product:', error);
            return null;
        }
    }

    // Add new product
    async addProduct(category, productData) {
        try {
            const categorySlug = encodeURIComponent(String(category || '').trim());
            const response = await fetch(`${this.apiUrl}/products/${categorySlug}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            
            if (!response.ok) throw new Error('Failed to add product');
            
            const product = await response.json();
            console.log('Product added successfully:', product);
            return product;
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    }

    // Update product
    async updateProduct(productId, updates) {
        try {
            const response = await fetch(`${this.apiUrl}/product/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) throw new Error('Failed to update product');
            
            return await response.json();
        } catch (error) {
            console.error('Error updating product:', error);
            return null;
        }
    }

    // Delete product
    async deleteProduct(productId) {
        try {
            const response = await fetch(`${this.apiUrl}/product/${productId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete product');
            
            const result = await response.json();
            console.log('Product deleted:', result);
            return true;
        } catch (error) {
            console.error('Error deleting product:', error);
            return false;
        }
    }

    // Upload image
    async uploadImage(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to upload image');
            
            return await response.json();
        } catch (error) {
            console.error('Error uploading image:', error);
            // Fallback to base64 encoding
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({
                        url: reader.result,
                        filename: file.name,
                        size: file.size
                    });
                };
                reader.readAsDataURL(file);
            });
        }
    }

    // Clear all products (for testing)
    async clearAllProducts() {
        try {
            const response = await fetch(`${this.apiUrl}/products/all`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to clear products');
            
            console.log('All products cleared');
            return true;
        } catch (error) {
            console.error('Error clearing products:', error);
            return false;
        }
    }
}

// Image Manager for handling image uploads
class ImageManagerAPI {
    constructor(database) {
        this.db = database;
    }

    async processImage(file) {
        if (!file) return null;
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('Image size must be less than 10MB');
        }
        
        // Upload to server or convert to base64
        return await this.db.uploadImage(file);
    }

    async processMultipleImages(files) {
        const processed = [];
        
        for (const file of files) {
            try {
                const imageData = await this.processImage(file);
                if (imageData) {
                    processed.push(imageData);
                }
            } catch (error) {
                console.error('Error processing image:', error);
            }
        }
        
        return processed;
    }
}

// Initialize database when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Create new API-based database
    window.productDB = new ProductDatabaseAPI();
    window.imageManager = new ImageManagerAPI(window.productDB);
    
    console.log('Product Database API initialized');
    console.log('Make sure the server is running with: npm start');
});

// Export for use in other scripts
window.ProductDatabaseAPI = ProductDatabaseAPI;
window.ImageManagerAPI = ImageManagerAPI;
