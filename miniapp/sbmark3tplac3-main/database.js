// Simple database management for C.P. Company products
class ProductDatabase {
    constructor() {
        this.storageKey = 'cpcompany_products';
        this.initializeDatabase();
    }

    // Initialize database with default structure
    initializeDatabase() {
        const existingData = localStorage.getItem(this.storageKey);
        if (!existingData) {
            const defaultData = {
                products: {
                    jackets: [],
                    shoes: [],
                    coats: [],
                    sweaters: [],
                    glasses: [],
                    pants: [],
                    hats: [],
                    kurtki: [],
                    obuv: []
                },
                lastId: 0
            };
            localStorage.setItem(this.storageKey, JSON.stringify(defaultData));
        }
    }

    // Get all data from database
    getAllData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : null;
    }

    // Save data to database
    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    // Get products by category
    getProductsByCategory(category) {
        const data = this.getAllData();
        return data.products[category] || [];
    }

    // Add new product
    addProduct(category, productData) {
        const data = this.getAllData();
        
        // Generate new ID
        data.lastId += 1;
        
        // Create product object
        const product = {
            id: data.lastId,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            oldPrice: productData.oldPrice || undefined,
            newPrice: productData.newPrice || undefined,
            sizes: productData.sizes || [],
            images: productData.images || [],
            category: category,
            dateAdded: new Date().toISOString(),
            isActive: true,
            isTrending: productData.isTrending || false,
            isPreorder: productData.isPreorder || false
        };

        // Add to category at the beginning (newest first)
        if (!data.products[category]) {
            data.products[category] = [];
        }
        data.products[category].unshift(product);

        // Save to database
        this.saveData(data);
        
        console.log(`Product added to ${category}:`, product);
        return product;
    }

    // Get product by ID
    getProductById(productId) {
        const data = this.getAllData();
        // Convert to number if it's a string
        const id = typeof productId === 'string' ? parseInt(productId, 10) : productId;
        
        for (const category in data.products) {
            const product = data.products[category].find(p => p.id === id);
            if (product) return product;
        }
        return null;
    }

    // Update product
    updateProduct(productId, updates) {
        const data = this.getAllData();
        for (const category in data.products) {
            const productIndex = data.products[category].findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                data.products[category][productIndex] = {
                    ...data.products[category][productIndex],
                    ...updates
                };
                this.saveData(data);
                return data.products[category][productIndex];
            }
        }
        return null;
    }

    // Delete product
    deleteProduct(productId) {
        const data = this.getAllData();
        for (const category in data.products) {
            const productIndex = data.products[category].findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                const deletedProduct = data.products[category].splice(productIndex, 1)[0];
                this.saveData(data);
                return deletedProduct;
            }
        }
        return null;
    }

    // Get all products (for search, etc.)
    getAllProducts() {
        const data = this.getAllData();
        const allProducts = [];
        for (const category in data.products) {
            allProducts.push(...data.products[category]);
        }
        return allProducts;
    }

    // Search products
    searchProducts(query) {
        const allProducts = this.getAllProducts();
        return allProducts.filter(product => 
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Get products count by category
    getProductsCount(category = null) {
        if (category) {
            return this.getProductsByCategory(category).length;
        }
        return this.getAllProducts().length;
    }

    // Get trending products
    getTrendingProducts(limit = null) {
        const allProducts = this.getAllProducts();
        const trendingProducts = allProducts.filter(product => product.isTrending && product.isActive);
        // Return limited number of trending products if limit is specified
        return limit ? trendingProducts.slice(0, limit) : trendingProducts;
    }

    // Clear all data (for testing)
    clearDatabase() {
        localStorage.removeItem(this.storageKey);
        this.initializeDatabase();
    }

    // Export data (for backup)
    exportData() {
        return this.getAllData();
    }

    // Import data (for restore)
    importData(data) {
        this.saveData(data);
    }
}

// Create global database instance
window.productDB = new ProductDatabase();

// Utility functions for working with images
class ImageManager {
    static convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static async processImages(files) {
        const images = [];
        for (const file of files) {
            try {
                const base64 = await this.convertFileToBase64(file);
                images.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: base64
                });
            } catch (error) {
                console.error('Error processing image:', error);
            }
        }
        return images;
    }
}

// Make ImageManager globally available
window.ImageManager = ImageManager;

console.log('Product Database initialized successfully');
