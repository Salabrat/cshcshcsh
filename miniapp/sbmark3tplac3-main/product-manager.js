// Product Management System
let currentCategory = '';
let selectedSizes = [];
let uploadedImages = [];

// Admin mode toggle (for demo purposes)
let isAdminMode = false;

// Sample admin credentials (in real app, this would be server-side)
const ADMIN_CREDENTIALS = {
    email: 'admin@admin.ru',
    password: 'admin'
};

// Initialize admin mode
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired in product-manager.js');
    // Check if admin is logged in
    checkAdminLogin();
    
    // Initialize size selector
    initializeSizeSelector();
    
    // Check for admin toggle (Ctrl+Alt+A) - backup method
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.altKey && e.key === 'a') {
            toggleAdminMode();
        }
    });
});

function checkAdminLogin() {
    console.log('checkAdminLogin called');
    const adminLoggedIn = localStorage.getItem('adminLoggedIn');
    const userLoggedIn = localStorage.getItem('userLoggedIn');
    console.log('adminLoggedIn value:', adminLoggedIn);
    console.log('userLoggedIn value:', userLoggedIn);
    
    if (adminLoggedIn === 'true') {
        console.log('Admin is logged in, enabling admin mode');
        // Use a larger delay to ensure DOM is fully loaded
        setTimeout(() => {
            enableAdminMode();
        }, 500);
    } else {
        console.log('Admin is not logged in');
        // Also check if we need to retry after DOM is loaded
        if (document.readyState !== 'complete') {
            console.log('DOM not fully loaded, retrying...');
            setTimeout(() => {
                checkAdminLogin();
            }, 1000);
        }
    }
}

function toggleAdminMode() {
    if (isAdminMode) {
        disableAdminMode();
    } else {
        const password = prompt('Введите пароль администратора:');
        if (password === ADMIN_CREDENTIALS.password) {
            enableAdminMode();
        } else {
            alert('Неверный пароль!');
        }
    }
}

function enableAdminMode() {
    isAdminMode = true;
    
    // Show admin controls
    const adminControls = document.querySelectorAll('.admin-controls');
    console.log('Found admin controls:', adminControls.length);
    if (adminControls.length > 0) {
        adminControls.forEach(control => {
            console.log('Making admin control visible');
            control.classList.add('visible');
        });
    } else {
        console.log('No admin controls found in the DOM');
        // Try to find the admin controls by ID
        const adminControlsById = document.getElementById('adminControls');
        if (adminControlsById) {
            console.log('Found admin controls by ID, making visible');
            adminControlsById.classList.add('visible');
        } else {
            console.log('No admin controls found by ID either');
        }
    }
    
    // Add admin indicator
    if (!document.querySelector('.admin-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'admin-indicator';
        indicator.innerHTML = '👑 ADMIN MODE <span style="margin-left: 10px; cursor: pointer;" onclick="logoutAdmin()">ВЫЙТИ</span>';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        indicator.onclick = function(e) {
            if (e.target.textContent === 'ВЫЙТИ') {
                logoutAdmin();
            }
        };
        document.body.appendChild(indicator);
    }
    
    console.log('Admin mode enabled.');
}

function disableAdminMode() {
    isAdminMode = false;
    
    // Hide admin controls
    const adminControls = document.querySelectorAll('.admin-controls');
    adminControls.forEach(control => {
        control.classList.remove('visible');
    });
    
    // Remove admin indicator
    const indicator = document.querySelector('.admin-indicator');
    if (indicator) {
        indicator.remove();
    }
    
    console.log('Admin mode disabled.');
}

function logoutAdmin() {
    // Clear admin login status
    localStorage.removeItem('adminLoggedIn');
    
    // Disable admin mode
    disableAdminMode();
    
    // Redirect to login page
    if (confirm('Вы уверены, что хотите выйти из админ-панели?')) {
        window.location.href = 'login.html';
    }
}

function openAddProductModal(category) {
    if (!isAdminMode) {
        alert('Доступ запрещен. Включите режим администратора.');
        return;
    }
    
    currentCategory = category;
    // Try both possible modal IDs
    let modal = document.getElementById('productModal');
    if (!modal) {
        modal = document.getElementById('addProductModal');
    }
    
    if (modal) {
        // Check if modal uses 'active' class or display style
        if (modal.classList.contains('product-modal')) {
            modal.classList.add('active');
        } else {
            modal.style.display = 'block';
        }
        console.log('Opening add product modal for category:', category);
        
        // Initialize form if needed
        initializeSizeSelector();
    } else {
        console.error('Product modal not found in DOM');
    }
}

function closeProductModal() {
    // Try both possible modal IDs
    let modal = document.getElementById('productModal');
    if (!modal) {
        modal = document.getElementById('addProductModal');
    }
    
    if (modal) {
        // Check if modal uses 'active' class or display style
        if (modal.classList.contains('product-modal')) {
            modal.classList.remove('active');
        } else {
            modal.style.display = 'none';
        }
    }
    resetProductForm();
}

function resetProductForm() {
    const form = document.getElementById('productForm');
    if (form) {
        form.reset();
    }
    
    selectedSizes = [];
    uploadedImages = [];
    
    // Reset size selector
    const sizeOptions = document.querySelectorAll('.size-option');
    sizeOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    // Clear image preview
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
    }
}

function initializeSizeSelector() {
    const sizeOptions = document.querySelectorAll('.size-option');
    sizeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const size = this.getAttribute('data-size');
            
            if (this.classList.contains('selected')) {
                // Remove size
                this.classList.remove('selected');
                selectedSizes = selectedSizes.filter(s => s !== size);
            } else {
                // Add size
                this.classList.add('selected');
                selectedSizes.push(size);
            }
        });
    });
}

function handleImageUpload(input) {
    const files = Array.from(input.files);
    
    if (uploadedImages.length + files.length > 10) {
        alert('Максимум 10 изображений!');
        return;
    }
    
    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert(`Файл ${file.name} слишком большой. Максимум 5MB.`);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = {
                file: file,
                url: e.target.result,
                name: file.name
            };
            
            uploadedImages.push(imageData);
            displayImagePreview();
        };
        reader.readAsDataURL(file);
    });
}

function displayImagePreview() {
    const imagePreview = document.getElementById('imagePreview');
    if (!imagePreview) return;
    
    imagePreview.innerHTML = '';
    
    uploadedImages.forEach((image, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <img src="${image.url}" alt="${image.name}">
            <button class="preview-remove" onclick="removeImage(${index})">×</button>
        `;
        imagePreview.appendChild(previewItem);
    });
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    displayImagePreview();
}

async function saveProduct() {
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = document.getElementById('productPrice').value;
    const isTrending = document.getElementById('productTrending') ? document.getElementById('productTrending').checked : false;
    
    if (!name || !description || !price) {
        alert('Заполните все обязательные поля!');
        return;
    }
    
    if (selectedSizes.length === 0) {
        alert('Выберите хотя бы один размер!');
        return;
    }
    
    if (uploadedImages.length === 0) {
        alert('Добавьте хотя бы одно изображение!');
        return;
    }

    try {
        // Process images for database storage
        const processedImages = [];
        for (const imageData of uploadedImages) {
            processedImages.push({
                name: imageData.name,
                url: imageData.url,
                size: imageData.file ? imageData.file.size : 0
            });
        }

        const productData = {
            name: name,
            description: description,
            price: parseInt(price),
            sizes: selectedSizes,
            images: processedImages,
            isTrending: isTrending
        };
        
        // Save to database using our new database system
        const savedProduct = window.productDB.addProduct(currentCategory, productData);
        
        // Refresh products display using product loader
        if (window.productLoader) {
            window.productLoader.refresh();
        } else {
            // Fallback - add product to current page
            addProductToPage(savedProduct);
        }
        
        // Update product counter
        updateProductCounter();
        
        // Refresh trending products if this product is marked as trending
        if (isTrending && window.trendingLoader) {
            window.trendingLoader.refresh();
        }
        
        // Close modal and reset form
        closeProductModal();
        resetProductForm();
        
        alert('Товар успешно добавлен!');
        console.log('Product saved successfully:', savedProduct);
        
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Ошибка при сохранении товара. Попробуйте еще раз.');
    }
}

function resetProductForm() {
    // Clear form fields
    document.getElementById('productName').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productPrice').value = '';
    
    // Clear selected sizes
    selectedSizes = [];
    document.querySelectorAll('.size-option.selected').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Clear uploaded images
    uploadedImages = [];
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
    }
    
    // Clear file input
    const fileInput = document.getElementById('productImages');
    if (fileInput) {
        fileInput.value = '';
    }
}

function saveProductToStorage(product) {
    let products = JSON.parse(localStorage.getItem('products') || '[]');
    products.push(product);
    localStorage.setItem('products', JSON.stringify(products));
}

function addProductToPage(product) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    // Remove empty catalog message if exists
    const emptyMessage = productsGrid.querySelector('.empty-catalog');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    // Create product card
    const productCard = createProductCard(product);
    productsGrid.appendChild(productCard);
    
    // Update product counter
    updateProductCounter();
}

function addProductToShopAll(product) {
    // This would typically be handled by the server
    // For now, we'll just save it to localStorage and it will appear when shop-all page loads
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => openProductPage(product.id);
    
    card.innerHTML = `
        <div class="product-image">
            <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-price">${product.price.toLocaleString()} ₽</p>
        </div>
    `;
    
    return card;
}

function openProductPage(productId) {
    // Reset scroll position to top before navigation (instantly)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    // Create product page URL
    const url = `product.html?id=${productId}`;
    window.location.href = url;
}

function updateProductCounter() {
    const counter = document.querySelector('.product-count');
    if (counter) {
        const category = counter.getAttribute('data-category');
        const products = getProductsByCategory(category);
        counter.textContent = `${products.length} изделий`;
    }
}

function getProductsByCategory(category) {
    const products = JSON.parse(localStorage.getItem('products') || '[]');
    return products.filter(product => product.category === category);
}

function loadCategoryProducts() {
    const counter = document.querySelector('.product-count');
    if (!counter) return;
    
    const category = counter.getAttribute('data-category');
    const products = getProductsByCategory(category);
    
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    // Clear existing products (except empty message)
    const existingProducts = productsGrid.querySelectorAll('.product-card');
    existingProducts.forEach(card => card.remove());
    
    if (products.length === 0) {
        // Show empty message if no products
        if (!productsGrid.querySelector('.empty-catalog')) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-catalog';
            emptyMessage.innerHTML = `
                <div class="empty-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21,15 16,10 5,21"></polyline>
                    </svg>
                </div>
                <h3>В категории "${category}" пока нет товаров</h3>
                <p>Товары будут добавлены администратором</p>
            `;
            productsGrid.appendChild(emptyMessage);
        }
    } else {
        // Add products
        products.forEach(product => {
            const productCard = createProductCard(product);
            productsGrid.appendChild(productCard);
        });
    }
    
    // Update counter
    updateProductCounter();
}

// Load products when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure DOM is fully loaded
    setTimeout(loadCategoryProducts, 100);
});

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('productModal');
    if (modal && e.target === modal) {
        closeProductModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeProductModal();
    }
});
