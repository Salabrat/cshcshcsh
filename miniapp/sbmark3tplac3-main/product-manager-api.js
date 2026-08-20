// Product Management System - API Version
let currentCategory = '';
window.selectedSizes = [];
let selectedSizes = window.selectedSizes;
let uploadedImages = [];

// Admin mode toggle
let isAdminMode = false;

// Sample admin credentials (in real app, this would be server-side)
const ADMIN_CREDENTIALS = {
    email: 'admin@admin.ru',
    password: 'admin'
};

// Initialize admin mode
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired in product-manager-api.js');
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
        document.body.appendChild(indicator);
    }
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
}

// Logout admin function
function logoutAdmin() {
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('userLoggedIn');
    disableAdminMode();
    window.location.href = 'login.html';
}

// Make logout function global
window.logoutAdmin = logoutAdmin;

// Product management functions
function openAddProductModal(category) {
    // If no category provided, try to get it from the page
    if (!category) {
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            category = productsGrid.getAttribute('data-category');
        }
        if (!category) {
            console.error('Category not found');
            alert('Ошибка: категория не определена');
            return;
        }
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
        // Try to create modal if it doesn't exist
        createProductModal();
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

// Initialize size selector
function initializeSizeSelector() {
    const sizeOptions = document.querySelectorAll('.size-option');
    console.log('Initializing size selector, found options:', sizeOptions.length);
    
    sizeOptions.forEach(option => {
        // Remove any existing listeners
        option.replaceWith(option.cloneNode(true));
    });
    
    // Re-select and add new listeners
    const freshOptions = document.querySelectorAll('.size-option');
    freshOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.toggle('selected');
            updateSelectedSizes();
        });
    });
}

function updateSelectedSizes() {
    selectedSizes = [];
    const selectedOptions = document.querySelectorAll('.size-option.selected');
    selectedOptions.forEach(option => {
        const size = option.getAttribute('data-size') || option.textContent.trim();
        selectedSizes.push(size);
    });
    console.log('Selected sizes:', selectedSizes);
}

function toggleSize(size, element) {
    // Get the button element - either from parameter or event
    const sizeButton = element || (event ? (event.target || event.currentTarget) : null);
    if (!sizeButton) {
        console.error('Size button not found');
        return;
    }
    
    sizeButton.classList.toggle('selected');
    
    // Use window.selectedSizes to ensure we're updating the global array
    const index = window.selectedSizes.indexOf(size);
    if (index > -1) {
        window.selectedSizes.splice(index, 1);
    } else {
        window.selectedSizes.push(size);
    }
    
    // Update local reference
    selectedSizes = window.selectedSizes;
    
    console.log('Selected sizes:', window.selectedSizes);
    console.log('Button classes:', sizeButton.className);
    
    // Force style update
    if (sizeButton.classList.contains('selected')) {
        sizeButton.style.background = '#000';
        sizeButton.style.color = '#fff';
        sizeButton.style.borderColor = '#000';
    } else {
        sizeButton.style.background = '';
        sizeButton.style.color = '';
        sizeButton.style.borderColor = '';
    }
}

// Image handling
async function handleImageUpload(event) {
    const files = event.target.files;
    const imagePreview = document.getElementById('imagePreview');
    
    if (!files || files.length === 0) return;
    
    // Clear previous images
    uploadedImages = [];
    imagePreview.innerHTML = '';
    
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            console.error('File is not an image:', file.name);
            continue;
        }
        
        try {
            // Process image using the image manager
            if (window.imageManager) {
                const imageData = await window.imageManager.processImage(file);
                uploadedImages.push(imageData);
                
                // Create preview
                const previewItem = document.createElement('div');
                previewItem.className = 'image-preview-item';
                previewItem.innerHTML = `
                    <img src="${imageData.url}" alt="Preview">
                    <button type="button" onclick="removeImage(${uploadedImages.length - 1})">×</button>
                `;
                imagePreview.appendChild(previewItem);
            } else {
                // Fallback to base64
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageData = {
                        url: e.target.result,
                        name: file.name,
                        size: file.size
                    };
                    uploadedImages.push(imageData);
                    
                    // Create preview
                    const previewItem = document.createElement('div');
                    previewItem.className = 'image-preview-item';
                    previewItem.innerHTML = `
                        <img src="${imageData.url}" alt="Preview">
                        <button type="button" onclick="removeImage(${uploadedImages.length - 1})">×</button>
                    `;
                    imagePreview.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Error processing image:', error);
            alert(`Ошибка при обработке изображения ${file.name}: ${error.message}`);
        }
    }
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImagePreviews();
}

function updateImagePreviews() {
    const imagePreview = document.getElementById('imagePreview');
    imagePreview.innerHTML = '';
    
    uploadedImages.forEach((image, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item';
        previewItem.innerHTML = `
            <img src="${image.url}" alt="Preview">
            <button type="button" onclick="removeImage(${index})">×</button>
        `;
        imagePreview.appendChild(previewItem);
    });
}

// Save product
async function saveProduct() {
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = document.getElementById('productPrice').value;
    const isTrending = document.getElementById('productTrending') ? document.getElementById('productTrending').checked : false;
    
    // Validation
    if (!name || !description || !price) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    
    if (!window.selectedSizes || window.selectedSizes.length === 0) {
        alert('Пожалуйста, выберите хотя бы один размер');
        console.error('No sizes selected. Current selectedSizes:', window.selectedSizes);
        return;
    }
    
    if (uploadedImages.length === 0) {
        alert('Пожалуйста, добавьте хотя бы одно изображение');
        return;
    }
    
    try {
        const productData = {
            name: name,
            description: description,
            price: parseInt(price),
            sizes: window.selectedSizes,
            images: uploadedImages,
            isTrending: isTrending
        };
        
        // Save to database using API
        const savedProduct = await window.productDB.addProduct(currentCategory, productData);
        
        // Refresh products display using product loader
        if (window.productLoader) {
            await window.productLoader.refresh();
        }
        
        // Update product counter
        updateProductCounter();
        
        // Close modal and reset form
        closeProductModal();
        resetProductForm();
        
        if (isTrending) {
            alert('Товар успешно добавлен и отмечен как "Trending Now"! Он появится в разделе TRENDING NOW на главной странице.');
        } else {
            alert('Товар успешно добавлен!');
        }
        console.log('Product saved successfully:', savedProduct);
        
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Ошибка при сохранении товара. Убедитесь, что сервер запущен (npm start)');
    }
}

// Reset form
function resetProductForm() {
    const form = document.getElementById('productForm') || document.getElementById('addProductForm');
    if (form) {
        form.reset();
    }
    
    // Clear selected sizes
    window.selectedSizes = [];
    selectedSizes = window.selectedSizes;
    const sizeOptions = document.querySelectorAll('.size-option');
    sizeOptions.forEach(option => {
        option.classList.remove('selected');
        option.style.background = '';
        option.style.color = '';
        option.style.borderColor = '';
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
    
    // Clear trending checkbox
    const trendingCheckbox = document.getElementById('productTrending');
    if (trendingCheckbox) {
        trendingCheckbox.checked = false;
    }
}

// Update product counter
async function updateProductCounter() {
    const productCounter = document.querySelector('.product-count');
    if (!productCounter || !window.productDB) return;
    
    try {
        const categoryAttribute = productCounter.getAttribute('data-category');
        if (categoryAttribute && categoryAttribute !== 'all') {
            const products = await window.productDB.getProductsByCategory(categoryAttribute);
            const count = products && Array.isArray(products) ? products.length : 0;
            productCounter.textContent = `${count} изделий`;
        }
    } catch (error) {
        console.error('Error updating product counter:', error);
    }
}

// Function to create product modal if it doesn't exist
function createProductModal() {
    const modalHTML = `
        <div id="productModal" class="product-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Добавить товар</h2>
                    <button class="close-modal" onclick="closeProductModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="productForm">
                        <div class="form-group">
                            <label>Название товара</label>
                            <input type="text" id="productName" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Цена (₽)</label>
                            <input type="number" id="productPrice" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Описание</label>
                            <textarea id="productDescription" rows="4"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>Размеры</label>
                            <div class="size-selector">
                                <button type="button" class="size-option" onclick="toggleSize('XS', this)">XS</button>
                                <button type="button" class="size-option" onclick="toggleSize('S', this)">S</button>
                                <button type="button" class="size-option" onclick="toggleSize('M', this)">M</button>
                                <button type="button" class="size-option" onclick="toggleSize('L', this)">L</button>
                                <button type="button" class="size-option" onclick="toggleSize('XL', this)">XL</button>
                                <button type="button" class="size-option" onclick="toggleSize('XXL', this)">XXL</button>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Изображения</label>
                            <input type="file" id="productImages" multiple accept="image/*" onchange="handleImageUpload(event)">
                            <div id="imagePreview" class="image-preview"></div>
                        </div>
                        
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="productTrending" style="width: auto; margin: 0;">
                                <span>Trending Now (показывать на главной)</span>
                            </label>
                        </div>
                        
                        <button type="button" class="btn btn-primary" onclick="saveProduct()">Сохранить товар</button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add styles if not already present
    if (!document.querySelector('#productModalStyles')) {
        const styles = `
            <style id="productModalStyles">
                .product-modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 10000;
                    overflow-y: auto;
                }
                .product-modal.active {
                    display: block;
                }
                .product-modal .modal-content {
                    background: white;
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 20px;
                    border-radius: 8px;
                }
                .product-modal .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .product-modal .close-modal {
                    background: none;
                    border: none;
                    font-size: 30px;
                    cursor: pointer;
                }
                .product-modal .form-group {
                    margin-bottom: 20px;
                }
                .product-modal label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                .product-modal input[type="text"],
                .product-modal input[type="number"],
                .product-modal textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .product-modal .size-selector {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .product-modal .size-option {
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    cursor: pointer;
                    border-radius: 4px;
                }
                .product-modal .size-option.selected {
                    background: #000 !important;
                    color: white !important;
                    border-color: #000 !important;
                }
                .product-modal .image-preview {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 10px;
                }
                .product-modal .image-preview img {
                    width: 100px;
                    height: 100px;
                    object-fit: cover;
                    border-radius: 4px;
                }
                .product-modal .btn-primary {
                    background: #000;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                .product-modal .btn-primary:hover {
                    background: #333;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    // Try to open the modal after creating it
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.add('active');
        console.log('Product modal created and opened');
        initializeSizeSelector();
    }
}

// Make functions globally available
window.openAddProductModal = openAddProductModal;
window.closeProductModal = closeProductModal;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.saveProduct = saveProduct;
window.toggleAdminMode = toggleAdminMode;
window.createProductModal = createProductModal;
window.toggleSize = toggleSize;
