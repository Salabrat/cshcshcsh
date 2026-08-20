const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3002;

// Simple in-memory session storage (in production use Redis or database)
const sessions = new Map();

// Admin credentials (in production store hashed in database)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123'; // Change this!

// MAX Bot Token for validation
const MAX_BOT_TOKEN = 'f9LHodD0cOJoFZB4Aoe4oyAgMW6g4P4ToSKa3FAqRPgoWWLipVoVCVJwhJ4u3yAzbpxwRilAnwRIvv4NsX7H';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Middleware to skip ngrok browser warning
app.use((req, res, next) => {
    // Set header to skip ngrok browser warning for all requests
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// Serve category pages with any slug (/, spaces, Cyrillic etc.)
// Must be before express.static to intercept encoded paths
// Use a catch-all route that matches everything starting with /category-
app.use((req, res, next) => {
    // Only handle GET requests
    if (req.method !== 'GET') return next();
    
    // Use originalUrl and decode it manually (Express doesn't decode %2F in path)
    let reqUrl = req.originalUrl.split('?')[0]; // Remove query string
    
    // Check if it's a category page request
    if (!reqUrl.startsWith('/category-') || !reqUrl.endsWith('.html')) {
        return next();
    }

    // Decode the URL to get the actual slug
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(reqUrl);
    } catch (e) {
        decodedUrl = reqUrl;
    }

    // Extract slug from decoded path: /category-SLUG.html
    const match = decodedUrl.match(/^\/category-(.+)\.html$/);
    if (!match) return next();

    const slug = match[1]; // decoded slug (may contain /, spaces, etc.)
    const encodedSlug = encodeURIComponent(slug);

    console.log(`Category request: slug="${slug}", encoded="${encodedSlug}"`);

    // 1. Try encoded filename (new format)
    const encodedFilePath = path.join(__dirname, `category-${encodedSlug}.html`);
    console.log(`Checking encoded file: ${encodedFilePath}`);
    if (fs.existsSync(encodedFilePath)) {
        console.log('Found encoded file, serving...');
        return res.sendFile(encodedFilePath);
    }

    // 2. Try raw filename (legacy format, e.g. category-jackets.html)
    // Only safe if slug doesn't contain path separators
    if (!slug.includes('/') && !slug.includes('\\')) {
        const rawFilePath = path.join(__dirname, `category-${slug}.html`);
        console.log(`Checking raw file: ${rawFilePath}`);
        if (fs.existsSync(rawFilePath)) {
            console.log('Found raw file, serving...');
            return res.sendFile(rawFilePath);
        }
    }

    // 3. Auto-create from template if category exists in database
    console.log('File not found, attempting auto-create...');
    try {
        if (!fs.existsSync(CATEGORIES_FILE)) {
            console.log('Categories file not found');
            return next();
        }
        const categoriesData = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
        const cat = (categoriesData.categories || []).find(c => (c.slug || c.id) === slug);
        if (!cat) {
            console.log(`Category not found in database: ${slug}`);
            return next();
        }
        const templatePath = path.join(__dirname, 'category-template.html');
        if (!fs.existsSync(templatePath)) {
            console.log('Template not found');
            return next();
        }
        let template = fs.readFileSync(templatePath, 'utf8');
        template = template.replace(/{{CATEGORY_NAME}}/g, cat.name);
        template = template.replace(/{{CATEGORY_SLUG}}/g, slug);
        template = template.replace(/{{CATEGORY_DESCRIPTION}}/g, cat.description || `Коллекция товаров категории ${cat.name}`);
        fs.writeFileSync(encodedFilePath, template);
        console.log(`Created category page: ${encodedFilePath}`);
        return res.sendFile(encodedFilePath);
    } catch (e) {
        console.error('Error auto-creating category page:', e);
        next();
    }
});

// Legacy miniapp route - serve TGminiapp.html for /tgmiap.html requests
app.get('/tgmiap.html', (req, res) => {
    const tgminiappPath = path.join(__dirname, 'TGminiapp.html');
    if (fs.existsSync(tgminiappPath)) {
        return res.sendFile(tgminiappPath);
    } else {
        return res.status(404).send('Miniapp not found');
    }
});

// iOS video streaming: Handle HTTP 206 Partial Content for Range requests
// Express.static sets Accept-Ranges but doesn't actually handle Range requests
app.get('/uploads/*.mp4', (req, res, next) => {
    const videoPath = path.join(__dirname, req.path);
    
    if (!fs.existsSync(videoPath)) {
        return next();
    }
    
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        
        const stream = fs.createReadStream(videoPath, { start, end });
        stream.pipe(res);
    } else {
        res.setHeader('Content-Length', fileSize);
        const stream = fs.createReadStream(videoPath);
        stream.pipe(res);
    }
});

app.get('/uploads/*.webm', (req, res, next) => {
    const videoPath = path.join(__dirname, req.path);
    
    if (!fs.existsSync(videoPath)) {
        return next();
    }
    
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Accept-Ranges', 'bytes');
    
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        
        const stream = fs.createReadStream(videoPath, { start, end });
        stream.pipe(res);
    } else {
        res.setHeader('Content-Length', fileSize);
        const stream = fs.createReadStream(videoPath);
        stream.pipe(res);
    }
});

// Serve static files with proper MIME types for video (iOS requires correct Content-Type)
app.use(express.static(__dirname, {
    setHeaders: function (res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store');
        }
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: function (res, filePath) {
        // Video MIME types handled by Range handlers above
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
        else if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    }
}));

const VIDEO_POSTERS_DIR = path.join(__dirname, 'uploads', 'posters');
if (!fs.existsSync(VIDEO_POSTERS_DIR)) {
    try {
        fs.mkdirSync(VIDEO_POSTERS_DIR, { recursive: true });
    } catch (e) {}
}

// iOS requires moov atom at the start of MP4 for streaming (faststart)
// Re-mux MP4 files with -movflags +faststart using ffmpeg
function ensureFaststart(filePath) {
    return new Promise((resolve) => {
        if (!filePath || !fs.existsSync(filePath)) return resolve(false);
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.mp4' && ext !== '.m4v') return resolve(false);

        const tmpPath = filePath + '.faststart.tmp.mp4';
        const args = [
            '-hide_banner', '-loglevel', 'error',
            '-i', filePath,
            '-c', 'copy',
            '-movflags', '+faststart',
            '-y', tmpPath
        ];

        const ff = spawn('ffmpeg', args, { stdio: 'ignore' });
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            if (ok && fs.existsSync(tmpPath)) {
                try {
                    fs.renameSync(tmpPath, filePath);
                    console.log('✅ faststart applied:', path.basename(filePath));
                    resolve(true);
                } catch (e) {
                    try { fs.unlinkSync(tmpPath); } catch (_) {}
                    resolve(false);
                }
            } else {
                try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
                resolve(false);
            }
        };
        ff.on('error', () => finish(false));
        ff.on('close', (code) => finish(code === 0));
        setTimeout(() => { finish(false); try { ff.kill(); } catch (_) {} }, 30000);
    });
}

// Process all existing MP4 uploads with faststart on startup
async function processExistingVideosForFaststart() {
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) return;
        const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.mp4'));
        if (files.length === 0) return;
        console.log(`🎬 Processing ${files.length} MP4 files for iOS faststart...`);
        for (const file of files) {
            await ensureFaststart(path.join(uploadsDir, file));
        }
        console.log('✅ Faststart processing complete');
    } catch (e) {
        console.error('Faststart processing error:', e.message);
    }
}
processExistingVideosForFaststart();

function normalizeUploadsSrc(src) {
    if (!src || typeof src !== 'string') return null;
    try {
        if (src.startsWith('http://') || src.startsWith('https://')) {
            const u = new URL(src);
            src = u.pathname;
        }
    } catch (e) {}
    if (!src.startsWith('/uploads/')) return null;
    const rel = src.slice('/uploads/'.length);
    if (!rel || rel.includes('..') || rel.includes('\\')) return null;
    return path.join(__dirname, 'uploads', rel);
}

app.get('/api/video-poster', (req, res) => {
    try {
        const src = String(req.query.src || '');
        const inputPath = normalizeUploadsSrc(src);
        if (!inputPath || !fs.existsSync(inputPath)) return res.status(404).end();

        const hash = crypto.createHash('sha1').update(src).digest('hex');
        const posterPath = path.join(VIDEO_POSTERS_DIR, hash + '.jpg');
        if (fs.existsSync(posterPath)) {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return res.sendFile(posterPath);
        }

        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-ss', '0.0',
            '-i', inputPath,
            '-frames:v', '1',
            '-q:v', '2',
            posterPath
        ];

        const ff = spawn('ffmpeg', args, { stdio: 'ignore' });
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            if (ok && fs.existsSync(posterPath)) {
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return res.sendFile(posterPath);
            }
            return res.status(404).end();
        };

        ff.on('error', () => finish(false));
        ff.on('close', (code) => finish(code === 0));

        setTimeout(() => finish(false), 8000);
    } catch (e) {
        res.status(500).end();
    }
});

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Multer для видео (до 25МБ)
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadVideo = multer({ 
    storage: videoStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit для видео
    fileFilter: function (req, file, cb) {
        const allowedTypes = /mp4|webm|ogg|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype.startsWith('video/');
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files (mp4, webm, ogg, mov) up to 25MB are allowed'));
        }
    }
});

// Multer для hero (изображения + видео до 50МБ)
const heroUpload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        const imageTypes = /jpeg|jpg|png|gif|webp/;
        const videoTypes = /mp4|webm|ogg|mov/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        const isImage = imageTypes.test(ext);
        const isVideo = videoTypes.test(ext) || file.mimetype.startsWith('video/');
        
        if (isImage || isVideo) {
            return cb(null, true);
        } else {
            cb(new Error('Only image (jpeg, jpg, png, gif, webp) or video (mp4, webm, ogg, mov) files are allowed'));
        }
    }
});

// Products file path
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const HOMEPAGE_IMAGES_FILE = path.join(__dirname, 'homepage-images.json');
const HOMEPAGE_TEXTS_FILE = path.join(__dirname, 'homepage-texts.json');
const BUTTON_TEXTS_FILE = path.join(__dirname, 'button-texts.json');
const BRANDS_FILE = path.join(__dirname, 'brands.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');
const SITE_SETTINGS_FILE = path.join(__dirname, 'site-settings.json');
const ADMIN_USERS_FILE = path.join(__dirname, 'admin-users.json');
const TELEGRAM_DESIGN_SETTINGS_FILE = path.join(__dirname, 'telegram-design-settings.json');
const CHECKOUT_SETTINGS_FILE = path.join(__dirname, 'checkout-settings.json');

// Initialize products file if it doesn't exist
if (!fs.existsSync(PRODUCTS_FILE)) {
    const initialData = {
        lastId: 0,
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
        }
    };
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(initialData, null, 2));
    console.log('Created products.json file');
}

// Initialize homepage images file if it doesn't exist
if (!fs.existsSync(HOMEPAGE_IMAGES_FILE)) {
    const initialImages = {
        hero: null,
        campaign1: null,
        campaign2: null,
        campaign3: null,
        about1: null,
        about2: null
    };
    fs.writeFileSync(HOMEPAGE_IMAGES_FILE, JSON.stringify(initialImages, null, 2));
    console.log('Created homepage-images.json file');
}

// Initialize homepage texts file if it doesn't exist
if (!fs.existsSync(HOMEPAGE_TEXTS_FILE)) {
    const initialTexts = {
        campaign1: {
            label: "FALL WINTER 025",
            title: "FW025 ADV<br>CAMPAIGN",
            description: ""
        },
        campaign2: {
            label: "FALL WINTER 025",
            title: "PUFFER",
            description: "Cold-Weather Icons: soft-touch essentials in updated colourways"
        },
        campaign3: {
            label: "FALL WINTER 025",
            title: "THE METROPOLIS<br>SERIES",
            description: "Functionality and performance for the contemporary urban environment"
        },
        about: {
            title: "ABOUT C.P. COMPANY",
            text: "In 1971, Italian designer Massimo Osti founded Chester Perry..."
        }
    };
    fs.writeFileSync(HOMEPAGE_TEXTS_FILE, JSON.stringify(initialTexts, null, 2));
    console.log('Created homepage-texts.json file');
}

// Initialize site settings file if it doesn't exist
if (!fs.existsSync(SITE_SETTINGS_FILE)) {
    const initialSettings = {
        siteName: 'C.P. Company',
        siteTitle: 'C.P. Company - High Performance Jackets',
        menuShopLabel: 'SHOP',
        menuBrandLabel: 'BRAND',
        menuSearchLabel: 'SEARCH',
        menuShopAllLabel: 'SHOP ALL',
        menuCategoriesLabel: 'CATEGORIES',
        logoUrl: '',
        loadingText: 'C.P. COMPANY',
        socialLinks: {
            telegram: '',
            vk: '',
            instagram: ''
        }
    };
    fs.writeFileSync(SITE_SETTINGS_FILE, JSON.stringify(initialSettings, null, 2));
    console.log('Created site-settings.json file');
}

// Initialize checkout settings file if it doesn't exist
if (!fs.existsSync(CHECKOUT_SETTINGS_FILE)) {
    const initialSettings = {
        pickupAddress: '',
        telegramLink: 'pravitelstvo_russian',
        maxLink: '',
        vkLink: ''
    };
    fs.writeFileSync(CHECKOUT_SETTINGS_FILE, JSON.stringify(initialSettings, null, 2));
    console.log('Created checkout-settings.json file');
}

// Initialize button texts file if it doesn't exist
if (!fs.existsSync(BUTTON_TEXTS_FILE)) {
    const initialButtonTexts = {
        "hero-btn": "SHOP NOW",
        "campaign1-btn": "DISCOVER MORE",
        "campaign2-btn": "DISCOVER MORE",
        "campaign3-btn": "DISCOVER MORE"
    };
    fs.writeFileSync(BUTTON_TEXTS_FILE, JSON.stringify(initialButtonTexts, null, 2));
    console.log('Created button-texts.json file');
}

// Initialize brands file if it doesn't exist
if (!fs.existsSync(BRANDS_FILE)) {
    const initialBrands = {
        brands: [
            { id: 1, name: "C.P. Company", isActive: true },
            { id: 2, name: "Stone Island", isActive: true }
        ],
        lastId: 2
    };
    fs.writeFileSync(BRANDS_FILE, JSON.stringify(initialBrands, null, 2));
    console.log('Created brands.json file');
}

// Initialize categories file if it doesn't exist
if (!fs.existsSync(CATEGORIES_FILE)) {
    const initialCategories = {
        categories: []
    };
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(initialCategories, null, 2));
    console.log('Created categories.json file (empty, no default categories)');
}

// Helper functions
function readProducts() {
    try {
        const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading products file:', error);
        return {
            lastId: 0,
            products: {}
        };
    }
}

function writeProducts(data) {
    try {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing products file:', error);
        return false;
    }
}

// API Routes

// Admin authentication endpoint
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Store session
        sessions.set(token, {
            username,
            isAdmin: true,
            createdAt: Date.now()
        });
        
        // Clean old sessions (older than 24 hours)
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        for (const [key, session] of sessions.entries()) {
            if (session.createdAt < dayAgo) {
                sessions.delete(key);
            }
        }
        
        res.json({ 
            success: true, 
            token,
            message: 'Admin logged in successfully'
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials' 
        });
    }
});

// Check admin authentication
app.get('/api/check-admin', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ isAdmin: false });
    }
    
    const token = authHeader.substring(7);
    const session = sessions.get(token);
    
    if (session && session.isAdmin) {
        // Check if session is not older than 24 hours
        const isValid = (Date.now() - session.createdAt) < (24 * 60 * 60 * 1000);
        
        if (isValid) {
            return res.json({ isAdmin: true, username: session.username });
        } else {
            sessions.delete(token);
        }
    }
    
    res.json({ isAdmin: false });
});

// Logout endpoint
app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        sessions.delete(token);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
});

// Helper functions for admin users
function readAdminUsers() {
    try {
        if (fs.existsSync(ADMIN_USERS_FILE)) {
            const data = fs.readFileSync(ADMIN_USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading admin users file:', error);
    }
    // Return default structure if file doesn't exist
    return {
        admins: [{ id: '8222800886', type: 'telegram', username: null, addedAt: new Date().toISOString(), addedBy: 'system' }],
        lastId: 1
    };
}

function writeAdminUsers(data) {
    try {
        fs.writeFileSync(ADMIN_USERS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing admin users file:', error);
        return false;
    }
}

function isAdminUser(userId, username = null) {
    const data = readAdminUsers();
    console.log('🔍 isAdminUser check:', { userId, username, admins: data.admins });
    const result = data.admins.some(admin => {
        if (admin.type === 'telegram' && userId && String(admin.id) === String(userId)) {
            console.log('✅ Found telegram admin match:', { adminId: admin.id, userId, match: String(admin.id) === String(userId) });
            return true;
        }
        if (admin.type === 'website' && username && admin.username === username) {
            console.log('✅ Found website admin match:', { adminUsername: admin.username, username });
            return true;
        }
        return false;
    });
    console.log('🔍 isAdminUser result:', result);
    return result;
}

// Middleware to check admin for protected routes
function requireAdmin(req, res, next) {
    console.log('🔐 requireAdmin check:', {
        method: req.method,
        path: req.path,
        headers: {
            'x-miniapp-user-id': req.headers['x-miniapp-user-id'],
            'x-miniapp-admin-key': req.headers['x-miniapp-admin-key'] ? 'present' : 'missing',
            'x-miniapp-platform': req.headers['x-miniapp-platform'],
            'authorization': req.headers['authorization'] ? 'present' : 'missing'
        }
    });
    
    // 1) Mini app (Telegram/MAX) — проверка по списку админов
    const miniAppUserId = req.headers['x-miniapp-user-id'];
    const miniAppPlatform = req.headers['x-miniapp-platform']; // 'telegram' or 'max'
    
    if (miniAppUserId) {
        console.log('📱 Checking mini app user:', miniAppUserId, 'platform:', miniAppPlatform);
        const isAdmin = isAdminUser(miniAppUserId);
        console.log('📱 Admin check result:', isAdmin);
        if (isAdmin) {
            req.admin = { isAdmin: true, source: 'miniapp', userId: miniAppUserId, platform: miniAppPlatform || 'telegram' };
            console.log('✅ Mini app admin authorized');
            return next();
        }
    }

    // 2) Резервный спец‑ключ для mini app (если нужен)
    const miniAppKey = process.env.MINIAPP_ADMIN_KEY || 'salik-miniapp-admin-8222800886';
    const miniAppHeader = req.headers['x-miniapp-admin-key'];

    if (miniAppHeader && miniAppHeader === miniAppKey) {
        console.log('✅ Mini app admin key authorized');
        req.admin = { isAdmin: true, source: 'miniapp-key', platform: miniAppPlatform || 'telegram' };
        return next();
    }

    // 3) Обычная админ‑сессия сайта
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No valid authorization header');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    const session = sessions.get(token);
    
    if (session && session.isAdmin) {
        const isValid = (Date.now() - session.createdAt) < (24 * 60 * 60 * 1000);
        
        if (isValid) {
            console.log('✅ Bearer token admin authorized');
            req.admin = session;
            return next();
        }
    }
    
    console.log('❌ All authorization methods failed');
    res.status(401).json({ error: 'Unauthorized' });
}

// Admin Users API endpoints

// Get all admin users (admin only)
// Get admin users - allow access with mini app headers OR admin token (for checking admin status)
app.get('/api/admin-users', (req, res) => {
    console.log('📋 GET /api/admin-users called:', {
        headers: {
            'x-miniapp-user-id': req.headers['x-miniapp-user-id'],
            'x-miniapp-admin-key': req.headers['x-miniapp-admin-key'] ? 'present' : 'missing',
            'authorization': req.headers['authorization'] ? 'present' : 'missing'
        },
        query: req.query,
        method: req.method
    });
    try {
        // Allow access for checking admin status (needed for Telegram Mini App)
        // Full admin operations still require requireAdmin middleware
        const data = readAdminUsers();
        console.log('✅ Returning admin users:', data.admins.length, 'admins');
        res.json(data.admins);
    } catch (error) {
        console.error('❌ Error reading admin users:', error);
        res.status(500).json({ error: 'Failed to read admin users' });
    }
});

// Add new admin user (admin only)
app.post('/api/admin-users', requireAdmin, (req, res) => {
    try {
        const { id, type, username } = req.body;
        
        if (!id && !username) {
            return res.status(400).json({ error: 'ID or username is required' });
        }
        
        if (!type || (type !== 'telegram' && type !== 'website')) {
            return res.status(400).json({ error: 'Type must be "telegram" or "website"' });
        }
        
        if (type === 'telegram' && !id) {
            return res.status(400).json({ error: 'ID is required for Telegram admin' });
        }
        
        if (type === 'website' && !username) {
            return res.status(400).json({ error: 'Username is required for website admin' });
        }
        
        const data = readAdminUsers();
        
        // Check if admin already exists
        const existingAdmin = data.admins.find(admin => {
            if (type === 'telegram' && admin.id === String(id)) {
                return true;
            }
            if (type === 'website' && admin.username === username) {
                return true;
            }
            return false;
        });
        
        if (existingAdmin) {
            return res.status(400).json({ error: 'Admin already exists' });
        }
        
        // Get current admin info for addedBy
        const currentAdmin = req.admin;
        const addedBy = currentAdmin.userId || currentAdmin.username || 'unknown';
        
        // Add new admin
        const newAdmin = {
            id: type === 'telegram' ? String(id) : null,
            type: type,
            username: type === 'website' ? username : null,
            addedAt: new Date().toISOString(),
            addedBy: addedBy
        };
        
        data.admins.push(newAdmin);
        
        if (writeAdminUsers(data)) {
            console.log(`Admin added: ${type === 'telegram' ? id : username}`);
            res.json(newAdmin);
        } else {
            res.status(500).json({ error: 'Failed to save admin user' });
        }
    } catch (error) {
        console.error('Error adding admin user:', error);
        res.status(500).json({ error: 'Failed to add admin user' });
    }
});

// Delete admin user (admin only)
app.delete('/api/admin-users/:id', requireAdmin, (req, res) => {
    try {
        const adminId = req.params.id;
        const data = readAdminUsers();
        
        const adminIndex = data.admins.findIndex(admin => {
            if (admin.type === 'telegram' && admin.id === adminId) {
                return true;
            }
            if (admin.type === 'website' && admin.username === adminId) {
                return true;
            }
            return false;
        });
        
        if (adminIndex === -1) {
            return res.status(404).json({ error: 'Admin not found' });
        }
        
        // Prevent deleting yourself
        const currentAdmin = req.admin;
        const currentAdminId = currentAdmin.userId || currentAdmin.username;
        const adminToDelete = data.admins[adminIndex];
        
        if ((adminToDelete.type === 'telegram' && adminToDelete.id === String(currentAdminId)) ||
            (adminToDelete.type === 'website' && adminToDelete.username === currentAdminId)) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        const deletedAdmin = data.admins.splice(adminIndex, 1)[0];
        
        if (writeAdminUsers(data)) {
            console.log(`Admin deleted: ${adminId}`);
            res.json({ message: 'Admin deleted', admin: deletedAdmin });
        } else {
            res.status(500).json({ error: 'Failed to delete admin user' });
        }
    } catch (error) {
        console.error('Error deleting admin user:', error);
        res.status(500).json({ error: 'Failed to delete admin user' });
    }
});

// Brand API endpoints

// Get all brands
app.get('/api/brands', (req, res) => {
    try {
        const data = fs.readFileSync(BRANDS_FILE, 'utf8');
        const brandsData = JSON.parse(data);
        res.json(brandsData.brands);
    } catch (error) {
        console.error('Error reading brands:', error);
        res.json([]);
    }
});

// Add new brand (admin only)
app.post('/api/brands', requireAdmin, (req, res) => {
    try {
        const { name, description, logo, covers } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Brand name is required' });
        }
        
        const data = fs.readFileSync(BRANDS_FILE, 'utf8');
        const brandsData = JSON.parse(data);
        
        // Check if brand already exists
        const existingBrand = brandsData.brands.find(b => b.name.toLowerCase() === name.toLowerCase());
        if (existingBrand) {
            return res.status(400).json({ error: 'Brand already exists' });
        }
        
        // Create new brand
        brandsData.lastId++;
        const newBrand = {
            id: brandsData.lastId,
            name: name.trim(),
            isActive: true
        };
        
        // Add optional fields
        if (description && description.trim() !== '') {
            newBrand.description = description.trim();
        }
        
        if (logo && logo.trim() !== '') {
            newBrand.logo = logo.trim();
        }
        
        // Обложки каталога (массив)
        if (covers && Array.isArray(covers) && covers.length > 0) {
            newBrand.covers = covers.filter(c => c && c.trim() !== '');
        }
        
        brandsData.brands.push(newBrand);
        fs.writeFileSync(BRANDS_FILE, JSON.stringify(brandsData, null, 2));
        
        console.log('Brand added:', newBrand.name);
        res.json(newBrand);
    } catch (error) {
        console.error('Error adding brand:', error);
        res.status(500).json({ error: 'Failed to add brand' });
    }
});

// Update brand (admin only)
app.put('/api/brands/:id', requireAdmin, (req, res) => {
    try {
        const brandId = parseInt(req.params.id);
        
        // Log full request body first
        console.log('🔵 PUT /api/brands/' + brandId);
        console.log('📦 Full request body:', JSON.stringify(req.body, null, 2));
        
        // Extract fields - get all values directly from req.body
        const name = req.body.name;
        const isActive = req.body.isActive;
        const description = req.body.description;
        const logoFromBody = req.body.logo; // Get logo separately to check
        
        console.log('🎨 Logo from req.body.logo:', logoFromBody, 'Type:', typeof logoFromBody, 'Has key:', 'logo' in req.body);
        console.log('🎨 req.body keys:', Object.keys(req.body));
        
        const data = fs.readFileSync(BRANDS_FILE, 'utf8');
        const brandsData = JSON.parse(data);
        
        const brandIndex = brandsData.brands.findIndex(b => b.id === brandId);
        if (brandIndex === -1) {
            return res.status(404).json({ error: 'Brand not found' });
        }
        
        console.log('📋 Brand before update:', JSON.stringify(brandsData.brands[brandIndex], null, 2));
        
        if (name !== undefined) brandsData.brands[brandIndex].name = name.trim();
        if (isActive !== undefined) brandsData.brands[brandIndex].isActive = isActive;
        
        // CRITICAL: Always save logo if it's provided in request
        // Check req.body.logo DIRECTLY (don't use variable, check source)
        const logoToSave = req.body.logo;
        console.log('🔍 Processing logo DIRECTLY from req.body.logo:', logoToSave, 'Type:', typeof logoToSave);
        console.log('🔍 req.body.logo === undefined:', req.body.logo === undefined);
        
        // FORCE: Always check req.body.logo directly and save if it's a string
        // This bypasses any issues with variable assignment
        if (req.body.logo !== undefined) {
            console.log('✅ Logo field EXISTS in req.body, value:', req.body.logo);
            if (req.body.logo && typeof req.body.logo === 'string' && req.body.logo.trim() !== '') {
                // Save the logo directly
                brandsData.brands[brandIndex].logo = req.body.logo.trim();
                console.log('✅ Logo SAVED to brand:', req.body.logo.trim());
            } else {
                // Remove logo if it's null, empty string, or falsy
                delete brandsData.brands[brandIndex].logo;
                console.log('🗑️ Logo REMOVED (value was:', req.body.logo, ')');
            }
        } else {
            // Logo field was NOT in request - keep existing logo
            console.log('⚠️ req.body.logo is undefined - keeping existing logo (if any)');
        }
        
        // Handle covers field (массив обложек)
        if (req.body.covers !== undefined) {
            if (req.body.covers && Array.isArray(req.body.covers) && req.body.covers.length > 0) {
                brandsData.brands[brandIndex].covers = req.body.covers.filter(c => c && c.trim() !== '');
                console.log('✅ Covers SAVED to brand:', brandsData.brands[brandIndex].covers);
            } else {
                delete brandsData.brands[brandIndex].covers;
                // Удаляем старый формат cover если есть
                delete brandsData.brands[brandIndex].cover;
                console.log('🗑️ Covers REMOVED');
            }
        }
        
        if (description !== undefined) {
            if (description && description.trim() !== '') {
                brandsData.brands[brandIndex].description = description.trim();
            } else {
                delete brandsData.brands[brandIndex].description;
            }
        }
        
        fs.writeFileSync(BRANDS_FILE, JSON.stringify(brandsData, null, 2));
        
        console.log('✅ Brand updated on server:', JSON.stringify(brandsData.brands[brandIndex], null, 2));
        console.log('🎨 Logo in saved brand:', brandsData.brands[brandIndex].logo);
        res.json(brandsData.brands[brandIndex]);
    } catch (error) {
        console.error('Error updating brand:', error);
        res.status(500).json({ error: 'Failed to update brand' });
    }
});

// Delete brand (admin only)
app.delete('/api/brands/:id', requireAdmin, (req, res) => {
    try {
        const brandId = parseInt(req.params.id);
        
        const data = fs.readFileSync(BRANDS_FILE, 'utf8');
        const brandsData = JSON.parse(data);
        
        const brandIndex = brandsData.brands.findIndex(b => b.id === brandId);
        if (brandIndex === -1) {
            return res.status(404).json({ error: 'Brand not found' });
        }
        
        const deletedBrand = brandsData.brands.splice(brandIndex, 1)[0];
        fs.writeFileSync(BRANDS_FILE, JSON.stringify(brandsData, null, 2));
        
        console.log('Brand deleted:', deletedBrand.name);
        res.json({ message: 'Brand deleted', brand: deletedBrand });
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(500).json({ error: 'Failed to delete brand' });
    }
});

// Get products by brand
app.get('/api/products/brand/:brandId', (req, res) => {
    try {
        const brandId = parseInt(req.params.brandId);
        const data = readProducts();
        
        const brandProducts = [];
        for (const category in data.products) {
            const categoryProducts = data.products[category].filter(p => p.brandId === brandId);
            brandProducts.push(...categoryProducts);
        }
        
        res.json(brandProducts);
    } catch (error) {
        console.error('Error getting products by brand:', error);
        res.status(500).json({ error: 'Failed to get products by brand' });
    }
});

// Categories API endpoints

function isSafeCategorySlug(slug) {
    if (typeof slug !== 'string') return false;
    if (!slug.trim()) return false;
    if (slug.includes('\0')) return false;
    if (slug.includes('..')) return false;
    return true;
}

function categorySlugToFileComponent(slug) {
    return encodeURIComponent(String(slug));
}

// Get all categories (excluding default categories)
// Get all categories (for admin product management)
app.get('/api/categories/all', (req, res) => {
    try {
        if (!fs.existsSync(CATEGORIES_FILE)) {
            res.json([]);
            return;
        }
        const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
        const categoriesData = JSON.parse(data);

        // Return ALL categories including default ones
        res.json(categoriesData.categories || []);
    } catch (error) {
        console.error('Error reading all categories:', error);
        res.json([]);
    }
});

// Get categories (filtered - only custom categories for category management)
app.get('/api/categories', (req, res) => {
    try {
        if (!fs.existsSync(CATEGORIES_FILE)) {
            res.json([]);
            return;
        }
        const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
        const categoriesData = JSON.parse(data);

        // Filter out default categories - only show real categories
        const realCategories = categoriesData.categories.filter(category => !category.isDefault);

        // Add product count for each category
        const productsData = readProducts();
        const categoriesWithCount = realCategories.map(category => {
            const productCount = productsData.products[category.slug] ? productsData.products[category.slug].length : 0;
            return {
                ...category,
                productCount
            };
        });

        res.json(categoriesWithCount);
    } catch (error) {
        console.error('Error reading categories:', error);
        res.json([]);
    }
});

// Add new category (admin only)
app.post('/api/categories', requireAdmin, (req, res) => {
    try {
        const { name, slug, description, isVisible } = req.body;
        
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }

        if (!isSafeCategorySlug(slug)) {
            return res.status(400).json({ error: 'Invalid slug' });
        }
        
        // Read current categories
        let categoriesData;
        if (fs.existsSync(CATEGORIES_FILE)) {
            const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
            categoriesData = JSON.parse(data);
        } else {
            categoriesData = { categories: [] };
        }
        
        // Check if category already exists
        const existingCategory = categoriesData.categories.find(c => c.slug === slug);
        if (existingCategory) {
            return res.status(400).json({ error: 'Category with this slug already exists' });
        }
        
        // Create new category
        const newCategory = {
            id: slug,
            name: name,
            slug: slug,
            description: description || '',
            isVisible: isVisible !== false, // Default to true if not specified
            isDefault: false
        };
        
        categoriesData.categories.push(newCategory);
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categoriesData, null, 2));
        
        // Add category to products structure if it doesn't exist
        const productsData = readProducts();
        if (!productsData.products[slug]) {
            productsData.products[slug] = [];
            writeProducts(productsData);
        }
        
        console.log('Category added:', newCategory.name);
        res.json(newCategory);
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ error: 'Failed to add category' });
    }
});

// Update category (admin only)
app.put('/api/categories/:id', requireAdmin, (req, res) => {
    try {
        const categoryId = decodeURIComponent(req.params.id);
        const { name, slug, description, isVisible } = req.body;
        
        const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
        const categoriesData = JSON.parse(data);
        
        const categoryIndex = categoriesData.categories.findIndex(c => c.id === categoryId);
        if (categoryIndex === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Don't allow changing slug of default categories
        if (categoriesData.categories[categoryIndex].isDefault && slug !== categoriesData.categories[categoryIndex].slug) {
            return res.status(400).json({ error: 'Cannot change slug of default category' });
        }

        if (slug !== undefined && !isSafeCategorySlug(slug)) {
            return res.status(400).json({ error: 'Invalid slug' });
        }
        
        if (name) categoriesData.categories[categoryIndex].name = name;
        if (description !== undefined) categoriesData.categories[categoryIndex].description = description;
        if (isVisible !== undefined) categoriesData.categories[categoryIndex].isVisible = isVisible;
        
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categoriesData, null, 2));
        
        // Regenerate category HTML file from template with updated name/description
        const updatedCat = categoriesData.categories[categoryIndex];
        const catSlug = updatedCat.slug || updatedCat.id;
        const encodedSlug = encodeURIComponent(catSlug);
        const templatePath = path.join(__dirname, 'category-template.html');
        const categoryFilePath = path.join(__dirname, `category-${encodedSlug}.html`);
        
        try {
            if (fs.existsSync(templatePath)) {
                let template = fs.readFileSync(templatePath, 'utf8');
                template = template.replace(/{{CATEGORY_NAME}}/g, updatedCat.name);
                template = template.replace(/{{CATEGORY_SLUG}}/g, catSlug);
                template = template.replace(/{{CATEGORY_DESCRIPTION}}/g, updatedCat.description || `Коллекция товаров категории ${updatedCat.name}`);
                fs.writeFileSync(categoryFilePath, template);
                console.log(`Category page regenerated: ${categoryFilePath}`);
            }
        } catch (e) {
            console.error('Error regenerating category page:', e);
        }
        
        console.log('Category updated:', updatedCat);
        res.json(updatedCat);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category by body (admin only) - handles IDs with slashes/special chars
app.delete('/api/categories-delete', requireAdmin, (req, res) => {
    try {
        const categoryId = req.body.id;
        if (!categoryId) {
            return res.status(400).json({ error: 'Category ID is required' });
        }
        
        const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
        const categoriesData = JSON.parse(data);
        
        const categoryIndex = categoriesData.categories.findIndex(c => c.id === categoryId);
        if (categoryIndex === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        if (categoriesData.categories[categoryIndex].isDefault) {
            return res.status(400).json({ error: 'Cannot delete default category' });
        }
        
        const deletedCategory = categoriesData.categories.splice(categoryIndex, 1)[0];
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categoriesData, null, 2));
        
        const productsData = readProducts();
        if (productsData.products[deletedCategory.slug]) {
            delete productsData.products[deletedCategory.slug];
            writeProducts(productsData);
        }
        
        console.log('Category deleted:', deletedCategory.name);
        res.json({ message: 'Category deleted', category: deletedCategory });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Delete category (admin only) - simple IDs without slashes
app.delete('/api/categories/:id', requireAdmin, (req, res) => {
    try {
        const categoryId = decodeURIComponent(req.params.id);
        
        const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
        const categoriesData = JSON.parse(data);
        
        const categoryIndex = categoriesData.categories.findIndex(c => c.id === categoryId);
        if (categoryIndex === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Don't allow deleting default categories
        if (categoriesData.categories[categoryIndex].isDefault) {
            return res.status(400).json({ error: 'Cannot delete default category' });
        }
        
        const deletedCategory = categoriesData.categories.splice(categoryIndex, 1)[0];
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categoriesData, null, 2));
        
        // Remove category from products structure
        const productsData = readProducts();
        if (productsData.products[deletedCategory.slug]) {
            delete productsData.products[deletedCategory.slug];
            writeProducts(productsData);
        }
        
        console.log('Category deleted:', deletedCategory.name);
        res.json({ message: 'Category deleted', category: deletedCategory });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Create category page from template (admin only)
app.post('/api/create-category-page', requireAdmin, (req, res) => {
    try {
        const { slug, name, description } = req.body;
        
        if (!slug || !name) {
            return res.status(400).json({ error: 'Slug and name are required' });
        }

        if (!isSafeCategorySlug(slug)) {
            return res.status(400).json({ error: 'Invalid slug' });
        }
        
        // Read template
        const templatePath = path.join(__dirname, 'category-template.html');
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: 'Template file not found' });
        }
        
        let template = fs.readFileSync(templatePath, 'utf8');
        
        // Replace placeholders
        template = template.replace(/{{CATEGORY_NAME}}/g, name);
        template = template.replace(/{{CATEGORY_SLUG}}/g, slug);
        template = template.replace(/{{CATEGORY_DESCRIPTION}}/g, description || `Коллекция товаров категории ${name}`);
        
        // Write new category page
        const slugFileComponent = categorySlugToFileComponent(slug);
        const newFilePath = path.join(__dirname, `category-${slugFileComponent}.html`);
        fs.writeFileSync(newFilePath, template);
        
        console.log('Category page created:', newFilePath);
        res.json({ message: 'Category page created successfully', file: `category-${slugFileComponent}.html` });
    } catch (error) {
        console.error('Error creating category page:', error);
        res.status(500).json({ error: 'Failed to create category page' });
    }
});

// Delete category page (admin only)
app.delete('/api/delete-category-page', requireAdmin, (req, res) => {
    try {
        const { slug } = req.body;
        
        if (!slug) {
            return res.status(400).json({ error: 'Slug is required' });
        }

        if (!isSafeCategorySlug(slug)) {
            return res.status(400).json({ error: 'Invalid slug' });
        }
        
        const slugFileComponent = categorySlugToFileComponent(slug);
        const filePath = path.join(__dirname, `category-${slugFileComponent}.html`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Category page deleted:', filePath);
            res.json({ message: 'Category page deleted successfully' });
        } else {
            res.status(404).json({ error: 'Category page not found' });
        }
    } catch (error) {
        console.error('Error deleting category page:', error);
        res.status(500).json({ error: 'Failed to delete category page' });
    }
});

// Get all products
app.get('/api/products', (req, res) => {
    const data = readProducts();
    res.json(data);
});

// Get products by category
app.get('/api/products/:category', (req, res) => {
    const { category } = req.params;
    const data = readProducts();
    
    if (data.products[category]) {
        res.json(data.products[category]);
    } else {
        res.status(404).json({ error: 'Category not found' });
    }
});

// Get single product by ID
app.get('/api/product/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const data = readProducts();
    
    for (const category in data.products) {
        const product = data.products[category].find(p => p.id === productId);
        if (product) {
            return res.json(product);
        }
    }
    
    res.status(404).json({ error: 'Product not found' });
});

// Add new product
app.post('/api/products/:category', (req, res) => {
    let { category } = req.params;
    const productData = req.body;
    if (!category && productData.category) category = productData.category;
    
    const data = readProducts();
    
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
        brandId: productData.brandId || 1, // Default to C.P. Company if not specified
        brandName: productData.brandName || 'C.P. Company',
        dateAdded: new Date().toISOString(),
        isActive: true,
        isTrending: productData.isTrending || false,
        isPreorder: productData.isPreorder || false
    };
    
    // Initialize category if it doesn't exist
    if (!data.products[category]) {
        data.products[category] = [];
    }
    
    // Add product to category at the beginning (newest first)
    data.products[category].unshift(product);
    
    // Save to file
    if (writeProducts(data)) {
        res.json(product);
        console.log(`Product added: ${product.name} to ${category}`);
    } else {
        res.status(500).json({ error: 'Failed to save product' });
    }
});

// Update product
app.put('/api/product/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const updates = req.body;
    
    const data = readProducts();
    
    for (const oldCategory in data.products) {
        const productIndex = data.products[oldCategory].findIndex(p => p.id === productId);
        if (productIndex !== -1) {
            const oldProduct = data.products[oldCategory][productIndex];
            const newCategory = updates.category || oldCategory;
            
            // If category changed, move product to new category
            if (newCategory !== oldCategory) {
                // Remove from old category
                data.products[oldCategory].splice(productIndex, 1);
                
                // Initialize new category if it doesn't exist
                if (!data.products[newCategory]) {
                    data.products[newCategory] = [];
                }
                
                // Add to new category with updated data at the beginning (newest first)
                const updatedProduct = {
                    ...oldProduct,
                    ...updates
                };
                data.products[newCategory].unshift(updatedProduct);
                
                if (writeProducts(data)) {
                    console.log(`Product ${productId} moved from ${oldCategory} to ${newCategory}`);
                    return res.json(updatedProduct);
                } else {
                    return res.status(500).json({ error: 'Failed to update product' });
                }
            } else {
                // Just update in place
                data.products[oldCategory][productIndex] = {
                    ...oldProduct,
                    ...updates
                };
                
                if (writeProducts(data)) {
                    return res.json(data.products[oldCategory][productIndex]);
                } else {
                    return res.status(500).json({ error: 'Failed to update product' });
                }
            }
        }
    }
    
    res.status(404).json({ error: 'Product not found' });
});

// Delete product
app.delete('/api/product/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    
    const data = readProducts();
    
    for (const category in data.products) {
        const productIndex = data.products[category].findIndex(p => p.id === productId);
        if (productIndex !== -1) {
            const deletedProduct = data.products[category].splice(productIndex, 1)[0];
            
            if (writeProducts(data)) {
                return res.json({ message: 'Product deleted', product: deletedProduct });
            } else {
                return res.status(500).json({ error: 'Failed to delete product' });
            }
        }
    }
    
    res.status(404).json({ error: 'Product not found' });
});

// Upload image endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ 
        url: imageUrl,
        filename: req.file.filename,
        size: req.file.size
    });
});

// Upload video endpoint (до 25МБ)
app.post('/api/upload-video', uploadVideo.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
    }
    
    // Apply faststart for iOS compatibility (move moov atom to start)
    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    await ensureFaststart(filePath);
    
    const videoUrl = `/uploads/${req.file.filename}`;
    res.json({ 
        url: videoUrl,
        filename: req.file.filename,
        size: req.file.size,
        type: 'video'
    });
});

// Get homepage images
app.get('/api/homepage-images', (req, res) => {
    try {
        const data = fs.readFileSync(HOMEPAGE_IMAGES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading homepage images:', error);
        res.status(500).json({ error: 'Failed to read homepage images' });
    }
});

// Update homepage images
app.post('/api/homepage-images', (req, res) => {
    try {
        const images = req.body;
        fs.writeFileSync(HOMEPAGE_IMAGES_FILE, JSON.stringify(images, null, 2));
        res.json({ success: true, images });
        console.log('Homepage images updated');
    } catch (error) {
        console.error('Error saving homepage images:', error);
        res.status(500).json({ error: 'Failed to save homepage images' });
    }
});

// Get login page image
app.get('/api/login-image', (req, res) => {
    try {
        const data = fs.readFileSync(HOMEPAGE_IMAGES_FILE, 'utf8');
        const images = JSON.parse(data);
        res.json({ loginImage: images.loginImage || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1200&fit=crop' });
    } catch (error) {
        console.error('Error reading login image:', error);
        res.json({ loginImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1200&fit=crop' });
    }
});

// Update login page image
app.post('/api/login-image', (req, res) => {
    try {
        const { loginImage } = req.body;
        const data = fs.readFileSync(HOMEPAGE_IMAGES_FILE, 'utf8');
        const images = JSON.parse(data);
        images.loginImage = loginImage;
        fs.writeFileSync(HOMEPAGE_IMAGES_FILE, JSON.stringify(images, null, 2));
        res.json({ success: true, loginImage });
        console.log('Login image updated');
    } catch (error) {
        console.error('Error saving login image:', error);
        res.status(500).json({ error: 'Failed to save login image' });
    }
});

// Get homepage texts
app.get('/api/homepage-texts', (req, res) => {
    try {
        const data = fs.readFileSync(HOMEPAGE_TEXTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading homepage texts:', error);
        res.status(500).json({ error: 'Failed to read homepage texts' });
    }
});

// Get site settings (public)
app.get('/api/site-settings', (req, res) => {
    try {
        const data = fs.readFileSync(SITE_SETTINGS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading site settings:', error);
        res.status(500).json({ error: 'Failed to read site settings' });
    }
});

// Update site settings (requires admin)
app.post('/api/site-settings', requireAdmin, (req, res) => {
    try {
        const { siteName, siteTitle, menuShopLabel, menuBrandLabel, menuSearchLabel, menuShopAllLabel, menuCategoriesLabel, logoUrl, headerLogoUrl, loadingText, socialLinks } = req.body || {};
        const data = fs.readFileSync(SITE_SETTINGS_FILE, 'utf8');
        const existing = JSON.parse(data);

        if (typeof siteName === 'string') {
            existing.siteName = siteName.trim();
        }
        if (typeof siteTitle === 'string') {
            existing.siteTitle = siteTitle.trim();
        }
        if (typeof menuShopLabel === 'string') {
            existing.menuShopLabel = menuShopLabel.trim();
        }
        if (typeof menuBrandLabel === 'string') {
            existing.menuBrandLabel = menuBrandLabel.trim();
        }
        if (typeof menuSearchLabel === 'string') {
            existing.menuSearchLabel = menuSearchLabel.trim();
        }
        if (typeof menuShopAllLabel === 'string') {
            existing.menuShopAllLabel = menuShopAllLabel.trim();
        }
        if (typeof menuCategoriesLabel === 'string') {
            existing.menuCategoriesLabel = menuCategoriesLabel.trim();
        }
        if (typeof logoUrl === 'string') {
            existing.logoUrl = logoUrl.trim();
        }
        if (typeof headerLogoUrl === 'string') {
            existing.headerLogoUrl = headerLogoUrl.trim();
        }
        if (typeof loadingText === 'string') {
            existing.loadingText = loadingText.trim();
        }
        if (socialLinks && typeof socialLinks === 'object') {
            if (!existing.socialLinks) {
                existing.socialLinks = {};
            }
            if (typeof socialLinks.telegram === 'string') {
                existing.socialLinks.telegram = socialLinks.telegram.trim();
            }
            if (typeof socialLinks.vk === 'string') {
                existing.socialLinks.vk = socialLinks.vk.trim();
            }
            if (typeof socialLinks.instagram === 'string') {
                existing.socialLinks.instagram = socialLinks.instagram.trim();
            }
        }

        fs.writeFileSync(SITE_SETTINGS_FILE, JSON.stringify(existing, null, 2));
        res.json({ success: true, settings: existing });
        console.log('Site settings updated');
    } catch (error) {
        console.error('Error saving site settings:', error);
        res.status(500).json({ error: 'Failed to save site settings' });
    }
});

// Get checkout settings (public)
app.get('/api/settings/checkout', (req, res) => {
    try {
        const data = fs.readFileSync(CHECKOUT_SETTINGS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading checkout settings:', error);
        res.status(500).json({ error: 'Failed to read checkout settings' });
    }
});

// Debug log endpoint (for debugging client-side issues)
app.post('/api/debug-log', (req, res) => {
    try {
        console.log('🐛 DEBUG LOG:', req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Error logging debug:', error);
        res.status(500).json({ error: 'Failed to log debug' });
    }
});

// Update checkout settings (requires admin)
app.post('/api/settings/checkout', requireAdmin, (req, res) => {
    try {
        console.log('📝 Received checkout settings update:', req.body);
        const { pickupAddress, telegramLink, maxLink, vkLink } = req.body || {};
        const data = fs.readFileSync(CHECKOUT_SETTINGS_FILE, 'utf8');
        const existing = JSON.parse(data);

        if (typeof pickupAddress === 'string') {
            existing.pickupAddress = pickupAddress.trim();
        }
        if (typeof telegramLink === 'string') {
            existing.telegramLink = telegramLink.trim();
        }
        if (typeof maxLink === 'string') {
            existing.maxLink = maxLink.trim();
        }
        if (typeof vkLink === 'string') {
            existing.vkLink = vkLink.trim();
        }

        fs.writeFileSync(CHECKOUT_SETTINGS_FILE, JSON.stringify(existing, null, 2));
        console.log('✅ Checkout settings saved:', existing);
        res.json({ success: true, settings: existing });
    } catch (error) {
        console.error('❌ Error saving checkout settings:', error);
        res.status(500).json({ error: 'Failed to save checkout settings' });
    }
});

// Get button texts
app.get('/api/button-texts', (req, res) => {
    try {
        const data = fs.readFileSync(BUTTON_TEXTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading button texts:', error);
        res.status(500).json({ error: 'Failed to read button texts' });
    }
});

// Update button text (requires admin)
app.post('/api/button-texts/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        
        const data = fs.readFileSync(BUTTON_TEXTS_FILE, 'utf8');
        const buttonTexts = JSON.parse(data);
        
        buttonTexts[id] = text;
        
        fs.writeFileSync(BUTTON_TEXTS_FILE, JSON.stringify(buttonTexts, null, 2));
        res.json({ success: true, id, text });
        console.log(`Button text updated: ${id} = ${text}`);
    } catch (error) {
        console.error('Error saving button text:', error);
        res.status(500).json({ error: 'Failed to save button text' });
    }
});

// Update homepage texts
app.post('/api/homepage-texts', (req, res) => {
    try {
        const texts = req.body;
        fs.writeFileSync(HOMEPAGE_TEXTS_FILE, JSON.stringify(texts, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving homepage texts:', error);
        res.status(500).json({ error: 'Failed to save texts' });
    }
});

// Hero texts file
const HERO_TEXTS_FILE = path.join(__dirname, 'hero-texts.json');

// Initialize hero texts file if it doesn't exist
if (!fs.existsSync(HERO_TEXTS_FILE)) {
    fs.writeFileSync(HERO_TEXTS_FILE, JSON.stringify({
        'hero-title': 'HIGH<br>PERFORMANCE<br>JACKETS',
        'hero-subtitle': 'Cutting-edge technologies for all winter conditions'
    }, null, 2));
}

// Get hero texts
app.get('/api/hero-texts', (req, res) => {
    try {
        const data = fs.readFileSync(HERO_TEXTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading hero texts:', error);
        res.json({});
    }
});

// Update hero texts (requires admin)
app.post('/api/hero-texts', requireAdmin, (req, res) => {
    try {
        // Read existing texts
        let existingTexts = {};
        if (fs.existsSync(HERO_TEXTS_FILE)) {
            existingTexts = JSON.parse(fs.readFileSync(HERO_TEXTS_FILE, 'utf8'));
        }
        
        // Merge with new texts
        const updatedTexts = { ...existingTexts, ...req.body };
        
        // Save to file
        fs.writeFileSync(HERO_TEXTS_FILE, JSON.stringify(updatedTexts, null, 2));
        
        console.log('Hero texts updated:', req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving hero texts:', error);
        res.status(500).json({ error: 'Failed to save hero texts' });
    }
});

// Hero content file
const HERO_CONTENT_FILE = path.join(__dirname, 'hero-content.json');

// Initialize hero content file if it doesn't exist
if (!fs.existsSync(HERO_CONTENT_FILE)) {
    fs.writeFileSync(HERO_CONTENT_FILE, JSON.stringify({
        title: 'HIGH<br>PERFORMANCE<br>JACKETS',
        subtitle: 'Cutting-edge technologies for all winter conditions',
        buttonText: 'SHOP NOW',
        buttonLink: 'shop-all.html',
        backgroundImage: '/uploads/hero-default.jpg'
    }, null, 2));
}

// Get hero content
app.get('/api/hero-content', (req, res) => {
    try {
        const data = fs.readFileSync(HERO_CONTENT_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading hero content:', error);
        res.json({
            title: 'HIGH<br>PERFORMANCE<br>JACKETS',
            subtitle: 'Cutting-edge technologies for all winter conditions',
            buttonText: 'SHOP NOW',
            backgroundImage: '/uploads/hero-default.jpg'
        });
    }
});

// Update hero content (JSON only, no image) - requires admin
app.put('/api/hero-content', requireAdmin, (req, res) => {
    try {
        let heroContent = {
            title: 'HIGH<br>PERFORMANCE<br>JACKETS',
            subtitle: 'Cutting-edge technologies for all winter conditions',
            buttonText: 'SHOP NOW',
            buttonLink: 'shop-all.html',
            backgroundImage: '/uploads/hero-default.jpg'
        };
        
        if (fs.existsSync(HERO_CONTENT_FILE)) {
            heroContent = JSON.parse(fs.readFileSync(HERO_CONTENT_FILE, 'utf8'));
        }
        
        if (req.body.title) heroContent.title = req.body.title.replace(/\n/g, '<br>');
        if (req.body.subtitle) heroContent.subtitle = req.body.subtitle;
        if (req.body.buttonText) heroContent.buttonText = req.body.buttonText;
        if (req.body.buttonLink !== undefined) heroContent.buttonLink = req.body.buttonLink;
        
        fs.writeFileSync(HERO_CONTENT_FILE, JSON.stringify(heroContent, null, 2));
        console.log('Hero content updated (JSON):', heroContent);
        res.json({ success: true, content: heroContent });
    } catch (error) {
        console.error('Error saving hero content:', error);
        res.status(500).json({ error: 'Failed to save hero content' });
    }
});

// Update hero content with image/video upload (requires admin)
app.post('/api/hero-content', requireAdmin, heroUpload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, buttonText } = req.body;
        
        // Read existing content
        let heroContent = {
            title: 'HIGH<br>PERFORMANCE<br>JACKETS',
            subtitle: 'Cutting-edge technologies for all winter conditions',
            buttonText: 'SHOP NOW',
            backgroundImage: '/uploads/hero-default.jpg',
            backgroundVideo: '',
            mediaType: 'image'
        };
        
        if (fs.existsSync(HERO_CONTENT_FILE)) {
            heroContent = JSON.parse(fs.readFileSync(HERO_CONTENT_FILE, 'utf8'));
        }
        
        // Update text fields
        if (title) heroContent.title = title.replace(/\n/g, '<br>');
        if (subtitle) heroContent.subtitle = subtitle;
        if (buttonText) heroContent.buttonText = buttonText;
        if (req.body.buttonLink !== undefined) heroContent.buttonLink = req.body.buttonLink;
        
        // Update media if uploaded
        if (req.file) {
            const fileUrl = '/uploads/' + req.file.filename;
            const isVideo = req.file.mimetype.startsWith('video/');
            
            if (isVideo) {
                // Apply faststart for iOS compatibility
                await ensureFaststart(path.join(__dirname, 'uploads', req.file.filename));
                heroContent.backgroundVideo = fileUrl;
                heroContent.backgroundImage = '';
                heroContent.mediaType = 'video';
                console.log('New hero video uploaded:', req.file.filename);
            } else {
                heroContent.backgroundImage = fileUrl;
                heroContent.backgroundVideo = '';
                heroContent.mediaType = 'image';
                console.log('New hero image uploaded:', req.file.filename);
            }
        }
        
        // Save to file
        fs.writeFileSync(HERO_CONTENT_FILE, JSON.stringify(heroContent, null, 2));
        
        console.log('Hero content updated:', heroContent);
        res.json({ success: true, content: heroContent });
    } catch (error) {
        console.error('Error saving hero content:', error);
        res.status(500).json({ error: 'Failed to save hero content' });
    }
});

// Campaign content file
const CAMPAIGN_CONTENT_FILE = path.join(__dirname, 'campaign-content.json');

// Initialize campaign content file if it doesn't exist
if (!fs.existsSync(CAMPAIGN_CONTENT_FILE)) {
    fs.writeFileSync(CAMPAIGN_CONTENT_FILE, JSON.stringify({
        campaign1: {
            label: 'FALL WINTER 025',
            title: 'FW025 ADV<br>CAMPAIGN',
            description: 'Sportswear, Not for playing in',
            buttonText: 'DISCOVER MORE'
        },
        campaign2: {
            label: 'NEW ARRIVAL',
            title: 'GOGGLE JACKETS',
            description: 'New Italian Sportswear icons with integrated lens protection',
            buttonText: 'DISCOVER MORE'
        },
        campaign3: {
            label: 'FALL WINTER 025',
            title: 'THE METROPOLIS<br>SERIES',
            description: 'Functionality and performance for the contemporary urban environment',
            buttonText: 'DISCOVER MORE'
        }
    }, null, 2));
}

// Get campaign content
app.get('/api/campaign-content', (req, res) => {
    try {
        const data = fs.readFileSync(CAMPAIGN_CONTENT_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading campaign content:', error);
        res.json({});
    }
});

// Update campaign content (requires admin)
app.post('/api/campaign-content/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { label, title, description, buttonText, buttonLink } = req.body;
        
        // Read existing content
        const data = fs.readFileSync(CAMPAIGN_CONTENT_FILE, 'utf8');
        const campaignContent = JSON.parse(data);
        
        // Create campaign object if it doesn't exist
        if (!campaignContent[id]) {
            campaignContent[id] = {};
        }
        
        // Update only provided fields
        if (label !== undefined) campaignContent[id].label = label;
        if (title !== undefined) campaignContent[id].title = title;
        if (description !== undefined) campaignContent[id].description = description;
        if (buttonText !== undefined) campaignContent[id].buttonText = buttonText;
        if (buttonLink !== undefined) campaignContent[id].buttonLink = buttonLink;
        
        // Save to file
        fs.writeFileSync(CAMPAIGN_CONTENT_FILE, JSON.stringify(campaignContent, null, 2));
        
        console.log(`Campaign content updated for ${id}:`, campaignContent[id]);
        res.json({ success: true, content: campaignContent[id] });
    } catch (error) {
        console.error('Error saving campaign content:', error);
        res.status(500).json({ error: 'Failed to save campaign content' });
    }
});

// About content file
const ABOUT_CONTENT_FILE = path.join(__dirname, 'about-content.json');

// Initialize about content file if it doesn't exist
if (!fs.existsSync(ABOUT_CONTENT_FILE)) {
    fs.writeFileSync(ABOUT_CONTENT_FILE, JSON.stringify({
        title: 'ABOUT C.P. COMPANY',
        text: 'In 1971, Italian designer Massimo Osti founded Chester Perry, a brand best known for its screen-printed t-shirts. In 1978, it was renamed C.P. Company, marking the beginning of one of the most creative and influential eras in contemporary sportswear. For over 50 years, C.P. Company has pioneered a hybrid style that merged military, workwear, and sportswear influences, supported by ongoing research into cutting-edge fabrics and textile technologies. Among its most significant innovations is garment dyeing, first developed in the mid-\'70s and still a defining hallmark of the brand\'s collections. This fusion of functional design and Italian textile innovation lies at the core of C.P. Company and continues to shape every garment that carries its name.'
    }, null, 2));
}

// Get about content
app.get('/api/about-content', (req, res) => {
    try {
        const data = fs.readFileSync(ABOUT_CONTENT_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading about content:', error);
        res.json({});
    }
});

// Update about content (requires admin)
app.post('/api/about-content', requireAdmin, (req, res) => {
    try {
        const { title, text } = req.body;
        
        // Read current content
        const currentData = fs.readFileSync(ABOUT_CONTENT_FILE, 'utf8');
        const aboutContent = JSON.parse(currentData);
        
        // Update fields if provided
        if (title !== undefined) aboutContent.title = title;
        if (text !== undefined) aboutContent.text = text;
        
        // Save to file
        fs.writeFileSync(ABOUT_CONTENT_FILE, JSON.stringify(aboutContent, null, 2));
        
        console.log('About content updated:', aboutContent);
        res.json({ success: true, content: aboutContent });
    } catch (error) {
        console.error('Error saving about content:', error);
        res.status(500).json({ error: 'Failed to save about content' });
    }
});

// Page texts API
const PAGE_TEXTS_FILE = path.join(__dirname, 'page-texts.json');

// Initialize page texts file if it doesn't exist
if (!fs.existsSync(PAGE_TEXTS_FILE)) {
    fs.writeFileSync(PAGE_TEXTS_FILE, JSON.stringify({}, null, 2));
    console.log('Created page-texts.json file');
}

// Get page texts
app.get('/api/page-texts', (req, res) => {
    try {
        const { page } = req.query;
        const data = fs.readFileSync(PAGE_TEXTS_FILE, 'utf8');
        const texts = JSON.parse(data);
        
        if (page && texts[page]) {
            res.json(texts[page]);
        } else if (page) {
            res.json({});
        } else {
            res.json(texts);
        }
    } catch (error) {
        console.error('Error reading page texts:', error);
        res.status(500).json({ error: 'Failed to read page texts' });
    }
});

// Save page text
app.post('/api/page-texts', (req, res) => {
    try {
        const { id, content, page, timestamp } = req.body;
        
        const data = fs.readFileSync(PAGE_TEXTS_FILE, 'utf8');
        const texts = JSON.parse(data);
        
        if (!texts[page]) {
            texts[page] = {};
        }
        
        texts[page][id] = {
            content,
            timestamp,
            lastModified: new Date().toISOString()
        };
        
        fs.writeFileSync(PAGE_TEXTS_FILE, JSON.stringify(texts, null, 2));
        res.json({ success: true, id, content });
        console.log(`Page text updated: ${page}/${id}`);
    } catch (error) {
        console.error('Error saving page text:', error);
        res.status(500).json({ error: 'Failed to save page text' });
    }
});

// Clear all products (for testing)
app.delete('/api/products/all', (req, res) => {
    const initialData = {
        lastId: 0,
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
        }
    };
    
    if (writeProducts(initialData)) {
        res.json({ message: 'All products cleared' });
    } else {
        res.status(500).json({ error: 'Failed to clear products' });
    }
});

// Upload image endpoint (requires admin auth)
app.post('/api/upload-image', requireAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ 
            success: true, 
            url: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Get all uploaded images (admin only)
app.get('/api/images', requireAdmin, (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            return res.json({ images: [] });
        }
        
        const files = fs.readdirSync(uploadsDir);
        const images = files
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map(file => ({
                filename: file,
                url: `/uploads/${file}`,
                size: fs.statSync(path.join(uploadsDir, file)).size,
                modified: fs.statSync(path.join(uploadsDir, file)).mtime
            }));
        
        res.json({ images });
    } catch (error) {
        console.error('Error reading images:', error);
        res.status(500).json({ error: 'Failed to get images' });
    }
});

// Serve uploads directory with proper video MIME types for iOS
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: function (res, filePath) {
        if (filePath.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
        else if (filePath.endsWith('.webm')) res.setHeader('Content-Type', 'video/webm');
        else if (filePath.endsWith('.ogg')) res.setHeader('Content-Type', 'video/ogg');
        else if (filePath.endsWith('.mov')) res.setHeader('Content-Type', 'video/quicktime');
        res.setHeader('Accept-Ranges', 'bytes');
    }
}));

// Telegram bot config
const TELEGRAM_BOT_CONFIG = path.join(__dirname, 'telegram-bot-config.json');
let botToken = null;
let adminChatId = null;

// Admin state management for multi-step commands
const BOT_ADMIN_STATE_FILE = path.join(__dirname, 'bot-admin-state.json');

// Initialize admin state file
if (!fs.existsSync(BOT_ADMIN_STATE_FILE)) {
    fs.writeFileSync(BOT_ADMIN_STATE_FILE, JSON.stringify({}, null, 2));
}

// Read admin state
function readAdminState() {
    try {
        if (fs.existsSync(BOT_ADMIN_STATE_FILE)) {
            const data = fs.readFileSync(BOT_ADMIN_STATE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading admin state:', error);
    }
    return {};
}

// Write admin state
function writeAdminState(data) {
    try {
        fs.writeFileSync(BOT_ADMIN_STATE_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing admin state:', error);
        return false;
    }
}

// Set admin state
function setAdminState(userId, state) {
    const states = readAdminState();
    states[String(userId)] = {
        ...state,
        timestamp: new Date().toISOString()
    };
    writeAdminState(states);
}

// Get admin state
function getAdminState(userId) {
    const states = readAdminState();
    const state = states[String(userId)];
    if (state) {
        // Check if state is not too old (30 minutes)
        const stateTime = new Date(state.timestamp);
        const now = new Date();
        if ((now - stateTime) > 30 * 60 * 1000) {
            delete states[String(userId)];
            writeAdminState(states);
            return null;
        }
    }
    return state;
}

// Clear admin state
function clearAdminState(userId) {
    const states = readAdminState();
    delete states[String(userId)];
    writeAdminState(states);
}

// Send message with inline keyboard
function sendTelegramMessageWithKeyboard(chatId, message, keyboard) {
    return new Promise((resolve, reject) => {
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            console.warn('Telegram bot not configured');
            resolve(false);
            return;
        }
        
        const data = JSON.stringify({
            chat_id: chatIdStr,
            text: message,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const request = https.request(options, (response) => {
            let responseData = '';
            response.on('data', (chunk) => responseData += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.ok) {
                        console.log('Message with keyboard sent to', chatIdStr);
                        resolve(true);
                    } else {
                        console.error('Telegram API error:', result);
                        resolve(false);
                    }
                } catch (e) {
                    resolve(true);
                }
            });
        });
        
        request.on('error', (error) => {
            console.error('Request error:', error);
            resolve(false);
        });
        
        request.write(data);
        request.end();
    });
}

// Edit message text
function editTelegramMessage(chatId, messageId, text, keyboard) {
    return new Promise((resolve, reject) => {
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            resolve(false);
            return;
        }
        
        const data = JSON.stringify({
            chat_id: chatIdStr,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/editMessageText`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const request = https.request(options, (response) => {
            let responseData = '';
            response.on('data', (chunk) => responseData += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result.ok);
                } catch (e) {
                    resolve(true);
                }
            });
        });
        
        request.on('error', () => resolve(false));
        request.write(data);
        request.end();
    });
}

// Load bot config
function loadBotConfig() {
    try {
        if (fs.existsSync(TELEGRAM_BOT_CONFIG)) {
            const botConfig = JSON.parse(fs.readFileSync(TELEGRAM_BOT_CONFIG, 'utf8'));
            botToken = botConfig.botToken;
            // Ensure adminChatId is a string (Telegram API requires string)
            adminChatId = botConfig.adminChatId ? String(botConfig.adminChatId) : null;
            
            if (botToken) {
                console.log('✅ Telegram bot token loaded');
            } else {
                console.warn('⚠️ Telegram bot token not found in config');
            }
            
            if (adminChatId) {
                console.log(`✅ Admin chat ID loaded: ${adminChatId} (type: ${typeof adminChatId})`);
            } else {
                console.warn('⚠️ Admin chat ID not found in config');
            }
        } else {
            console.warn('⚠️ Telegram bot config file not found:', TELEGRAM_BOT_CONFIG);
        }
    } catch (error) {
        console.error('❌ Error loading Telegram bot config:', error);
    }
}

// Load config on startup
loadBotConfig();

// Grok API config
const GROK_CONFIG = path.join(__dirname, 'grok-config.json');
let grokApiKey = null;
let grokApiUrl = null;
let grokModel = null;

// Load Grok config
function loadGrokConfig() {
    try {
        if (fs.existsSync(GROK_CONFIG)) {
            const grokConfig = JSON.parse(fs.readFileSync(GROK_CONFIG, 'utf8'));
            grokApiKey = grokConfig.apiKey;
            grokApiUrl = grokConfig.apiUrl || 'https://api.x.ai/v1';
            grokModel = grokConfig.model || 'grok-beta';
            
            if (grokApiKey) {
                console.log('✅ Grok API key loaded');
                console.log(`✅ Grok API URL: ${grokApiUrl}`);
                console.log(`✅ Grok Model: ${grokModel}`);
            } else {
                console.warn('⚠️ Grok API key not found in config');
            }
        } else {
            console.warn('⚠️ Grok config file not found:', GROK_CONFIG);
        }
    } catch (error) {
        console.error('❌ Error loading Grok config:', error);
    }
}

// Load Grok config on startup
loadGrokConfig();

// Download file from Telegram and save locally
function downloadTelegramFile(fileUrl, filename) {
    return new Promise((resolve, reject) => {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, filename);
        const file = fs.createWriteStream(filePath);
        
        https.get(fileUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                resolve(`/uploads/${filename}`);
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            reject(err);
        });
    });
}

// Send plain text message (no HTML parsing)
function sendTelegramMessagePlain(chatId, message) {
    return new Promise((resolve, reject) => {
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            console.warn('❌ Telegram bot not configured');
            resolve(false);
            return;
        }
        
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            console.error('❌ ERROR: Cannot send empty message!');
            resolve(false);
            return;
        }
        
        const messageStr = String(message).trim();
        
        // Escape HTML special characters to prevent parsing issues
        const escapedMessage = messageStr
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        const data = JSON.stringify({
            chat_id: chatIdStr,
            text: escapedMessage
            // No parse_mode - plain text
        });
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.ok) {
                        console.log('✅ Plain message sent successfully');
                        resolve(true);
                    } else {
                        console.error('❌ Telegram API error:', result);
                        resolve(false);
                    }
                } catch (e) {
                    resolve(true);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve(false);
        });
        
        req.write(data);
        req.end();
    });
}

// Send message to Telegram bot
function sendTelegramMessage(chatId, message) {
    return new Promise((resolve, reject) => {
        // Ensure chatId is a string
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            console.warn('❌ Telegram bot not configured - botToken:', !!botToken, 'chatId:', !!chatIdStr);
            resolve(false);
            return;
        }
        
        console.log('📤 Sending Telegram message to chat ID:', chatIdStr);
        console.log('📝 Message length:', message ? message.length : 0);
        console.log('📝 Message preview:', message ? message.substring(0, 200) + '...' : 'NULL');
        
        // Validate message before sending
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            console.error('❌ ERROR: Cannot send empty message!');
            console.error('❌ Message value:', message);
            console.error('❌ Message type:', typeof message);
            resolve(false);
            return;
        }
        
        // Ensure message is a valid string
        const messageStr = String(message).trim();
        
        if (!messageStr || messageStr.length === 0) {
            console.error('❌ ERROR: Message is empty after string conversion!');
            console.error('❌ Original message type:', typeof message);
            console.error('❌ Original message:', message);
            resolve(false);
            return;
        }
        
        const data = JSON.stringify({
            chat_id: chatIdStr,
            text: messageStr,
            parse_mode: 'HTML'
        });
        
        console.log('📦 Request data length:', data.length);
        console.log('📦 Request data preview:', data.substring(0, 500));
        console.log('📦 Full message being sent:', messageStr);
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(responseData);
                        if (result.ok) {
                            console.log('✅ Telegram message sent successfully');
                            resolve(true);
                        } else {
                            console.error('❌ Telegram API returned error:', result);
                            resolve(false);
                        }
                    } catch (e) {
                        console.log('✅ Telegram message sent (response parsing failed)');
                        resolve(true);
                    }
                } else {
                    console.error('❌ Telegram API HTTP error. Status:', res.statusCode);
                    try {
                        const error = JSON.parse(responseData);
                        console.error('❌ Telegram API error details:', JSON.stringify(error, null, 2));
                    } catch (e) {
                        console.error('❌ Telegram API error response:', responseData);
                    }
                    resolve(false);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Network error sending Telegram message:', error);
            resolve(false);
        });
        
        req.write(data);
        req.end();
    });
}

// Order submission endpoint
app.post('/api/telegram/order', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Format order message with code tags for easy copying
        let message = `<b>🛒 Новый заказ</b>\n\n`;
        message += `ФИО <code>${orderData.fullName || 'Не указано'}</code>\n`;
        
        // City
        const city = orderData.deliveryType === 'delivery' && orderData.city 
            ? orderData.city 
            : (orderData.deliveryType === 'pickup' && orderData.pickupPoint 
                ? orderData.pickupPoint 
                : 'Не указан');
        message += `Город <code>${city}</code>\n`;
        
        // Address (using comment as address, or city/pickup point if no comment)
        const address = orderData.comment || city;
        message += `Адрес <code>${address}</code>\n`;
        
        message += `Номер тлф <code>${orderData.phone || 'Не указан'}</code>\n`;
        
        message += `\n<b>Тип доставки:</b> ${orderData.deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз'}\n`;
        if (orderData.username && orderData.username !== 'Не указан') {
            message += `<b>Пользователь:</b> ${orderData.username}\n`;
        }
        
        message += `\n<b>Товары:</b>\n`;
        
        // Check if items exist
        if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            console.warn('⚠️ No items in order!');
            message += `Товары не указаны\n`;
        } else {
            orderData.items.forEach((item, index) => {
                const productName = item.productName || 'Товар без названия';
                const size = item.size ? ` (Размер: ${item.size})` : '';
                const quantity = item.quantity || 1;
                const price = item.price || 0;
                const totalPrice = price * quantity;
                
                message += `${index + 1}. ${productName}${size} - ${quantity} шт. x ${price.toLocaleString('ru-RU')} ₽ = ${totalPrice.toLocaleString('ru-RU')} ₽\n`;
            });
        }
        
        const total = orderData.total || 0;
        message += `\n<b>Итого:</b> ${total.toLocaleString('ru-RU')} ₽`;
        
        // Log order data for debugging
        console.log('📦 Received order:', JSON.stringify(orderData, null, 2));
        console.log('📝 Formatted message length:', message ? message.length : 0);
        console.log('📝 Formatted message type:', typeof message);
        console.log('📝 Formatted message:', message);
        console.log('📝 Message preview (first 500 chars):', message ? message.substring(0, 500) : 'NULL');
        
        // Validate message is not empty
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            console.error('❌ ERROR: Message is empty or invalid!');
            console.error('❌ Message value:', message);
            console.error('❌ Message type:', typeof message);
            console.error('❌ Order data:', JSON.stringify(orderData, null, 2));
            
            // Try to create a fallback message
            const fallbackMessage = `Новый заказ\n\nФИО: ${orderData.fullName || 'Не указано'}\nТелефон: ${orderData.phone || 'Не указан'}\nГород: ${orderData.city || orderData.pickupPoint || 'Не указан'}`;
            console.log('🔄 Using fallback message:', fallbackMessage);
            message = fallbackMessage;
        }
        
        // Send to admin
        if (!adminChatId) {
            console.warn('⚠️ Admin chat ID not configured. Order data:', JSON.stringify(orderData, null, 2));
            // Still return success to user, but log the order
            return res.json({ 
                success: true, 
                message: 'Order received (notification not sent - add "adminChatId" to telegram-bot-config.json)' 
            });
        }
        
        if (!botToken) {
            console.warn('⚠️ Bot token not configured');
            return res.json({ 
                success: true, 
                message: 'Order received (notification not sent - bot token missing)' 
            });
        }
        
        // Send message
        console.log('🚀 Attempting to send message to admin...');
        console.log('📤 Message to send (full):', JSON.stringify(message));
        const sent = await sendTelegramMessage(adminChatId, message);
        
        if (sent) {
            console.log('✅ Order notification sent successfully');
            res.json({ success: true, message: 'Order submitted successfully' });
        } else {
            // Still return success to user, but log error
            console.error('❌ Failed to send Telegram notification');
            res.json({ success: true, message: 'Order received (notification failed)' });
        }
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Failed to process order' });
    }
});

// Get sticker file URL endpoint
app.get('/api/telegram/sticker/:stickerId', async (req, res) => {
    try {
        const stickerId = req.params.stickerId;
        
        if (!botToken) {
            return res.status(500).json({ error: 'Bot token not configured' });
        }
        
        // Get sticker file info from Telegram Bot API
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/getFile?file_id=${stickerId}`,
            method: 'GET'
        };
        
        https.get(options, (telegramRes) => {
            let data = '';
            
            telegramRes.on('data', (chunk) => {
                data += chunk;
            });
            
            telegramRes.on('end', () => {
                try {
                    const fileData = JSON.parse(data);
                    console.log('Telegram API response for sticker:', JSON.stringify(fileData, null, 2));
                    
                    if (fileData.ok && fileData.result) {
                        const filePath = fileData.result.file_path;
                        console.log('Sticker file path:', filePath);
                        
                        // Validate file path
                        if (!filePath || filePath.length === 0) {
                            console.error('Invalid file path from Telegram API');
                            return res.status(404).json({ error: 'Invalid file path' });
                        }
                        
                        // Check if it's a TGS file (animated sticker)
                        if (filePath.endsWith('.tgs')) {
                            // TGS files need special handling - convert to Lottie or use webp alternative
                            console.log('Sticker is in TGS format, need special handling');
                            // For now, try to get webp version if available
                            // Note: Some stickers may not have webp version
                            return res.status(400).json({ 
                                error: 'TGS format not directly supported in browser',
                                message: 'Animated stickers in TGS format require special rendering library'
                            });
                        }
                        
                        const stickerUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
                        console.log('Generated sticker URL:', stickerUrl);
                        res.json({ url: stickerUrl });
                    } else {
                        console.error('Telegram API error:', fileData);
                        res.status(404).json({ 
                            error: 'Sticker not found',
                            details: fileData.description || 'Unknown error'
                        });
                    }
                } catch (error) {
                    console.error('Error parsing Telegram API response:', error);
                    console.error('Response data:', data);
                    res.status(500).json({ error: 'Failed to get sticker', details: error.message });
                }
            });
        }).on('error', (error) => {
            console.error('Error requesting sticker from Telegram:', error);
            res.status(500).json({ error: 'Failed to get sticker' });
        });
    } catch (error) {
        console.error('Error in sticker endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Telegram Mini App Design Settings API
function readTelegramDesignSettings() {
    try {
        if (fs.existsSync(TELEGRAM_DESIGN_SETTINGS_FILE)) {
            const data = fs.readFileSync(TELEGRAM_DESIGN_SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading telegram design settings file:', error);
    }
    return {};
}

function writeTelegramDesignSettings(data) {
    try {
        fs.writeFileSync(TELEGRAM_DESIGN_SETTINGS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing telegram design settings file:', error);
        return false;
    }
}

// Migrate data: URLs in design settings to real files (iOS cannot play large data URL videos)
function migrateDesignSettingsDataUrls() {
    try {
        const settings = readTelegramDesignSettings();
        let changed = false;
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        function saveDataUrlAsFile(dataUrl, prefix) {
            try {
                const match = dataUrl.match(/^data:(video\/[^;]+|image\/[^;]+);base64,(.+)$/s);
                if (!match) return null;
                const mime = match[1];
                const ext = mime.split('/')[1].replace('quicktime', 'mov') || 'mp4';
                const buf = Buffer.from(match[2], 'base64');
                const filename = prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e9) + '.' + ext;
                fs.writeFileSync(path.join(uploadsDir, filename), buf);
                console.log('✅ Migrated data URL to file:', '/uploads/' + filename);
                return '/uploads/' + filename;
            } catch (e) {
                console.error('Failed to save data URL as file:', e.message);
                return null;
            }
        }

        if (Array.isArray(settings.catalogCovers)) {
            settings.catalogCovers = settings.catalogCovers.map((item, i) => {
                const url = typeof item === 'string' ? item : item && item.url;
                if (url && url.startsWith('data:')) {
                    const fileUrl = saveDataUrlAsFile(url, 'catalog-cover');
                    if (fileUrl) { changed = true; return typeof item === 'string' ? fileUrl : { ...item, url: fileUrl }; }
                }
                return item;
            });
        }

        if (Array.isArray(settings.logoImages)) {
            settings.logoImages = settings.logoImages.map((item, i) => {
                const url = typeof item === 'string' ? item : item && item.url;
                if (url && url.startsWith('data:')) {
                    const fileUrl = saveDataUrlAsFile(url, 'logo-image');
                    if (fileUrl) { changed = true; return typeof item === 'string' ? fileUrl : { ...item, url: fileUrl }; }
                }
                return item;
            });
        }

        if (settings.loadingScreenImage && settings.loadingScreenImage.startsWith('data:')) {
            const fileUrl = saveDataUrlAsFile(settings.loadingScreenImage, 'loading-screen');
            if (fileUrl) { settings.loadingScreenImage = fileUrl; changed = true; }
        }

        if (settings.rouletteBannerMedia && settings.rouletteBannerMedia.url && settings.rouletteBannerMedia.url.startsWith('data:')) {
            const fileUrl = saveDataUrlAsFile(settings.rouletteBannerMedia.url, 'roulette-banner');
            if (fileUrl) { settings.rouletteBannerMedia.url = fileUrl; changed = true; }
        }

        if (settings.rouletteCoverImage && settings.rouletteCoverImage.startsWith('data:')) {
            const fileUrl = saveDataUrlAsFile(settings.rouletteCoverImage, 'roulette-cover');
            if (fileUrl) { settings.rouletteCoverImage = fileUrl; changed = true; }
        }

        if (changed) {
            writeTelegramDesignSettings(settings);
            console.log('✅ Design settings data URL migration complete');
        }
    } catch (e) {
        console.error('Design settings migration error:', e.message);
    }
}

// Run migration on startup
migrateDesignSettingsDataUrls();

// Get Telegram Mini App design settings (catalog covers, logos, etc.)
app.get('/api/telegram/design-settings', (req, res) => {
    try {
        const settings = readTelegramDesignSettings();
        console.log('📖 Returning design settings:', {
            hasLogoImages: !!(settings.logoImages && settings.logoImages.length),
            hasCatalogCovers: !!(settings.catalogCovers && settings.catalogCovers.length),
            catalogCoversCount: settings.catalogCovers ? settings.catalogCovers.length : 0
        });
        res.json(settings);
    } catch (error) {
        console.error('Error reading telegram design settings:', error);
        res.status(500).json({ error: 'Failed to read design settings' });
    }
});

// Save Telegram Mini App design settings (admin only)
app.post('/api/telegram/design-settings', requireAdmin, (req, res) => {
    try {
        const settings = req.body;
        console.log('💾 Saving design settings:', {
            hasLogoImages: !!(settings.logoImages && settings.logoImages.length),
            hasCatalogCovers: !!(settings.catalogCovers && settings.catalogCovers.length),
            catalogCoversCount: settings.catalogCovers ? settings.catalogCovers.length : 0
        });
        writeTelegramDesignSettings(settings);
        console.log('✅ Telegram design settings saved successfully');
        res.json({ success: true, message: 'Design settings saved' });
    } catch (error) {
        console.error('Error saving telegram design settings:', error);
        res.status(500).json({ error: 'Failed to save design settings' });
    }
});

// ==================== ROULETTE API ====================
const ROULETTE_CONFIG_FILE = path.join(__dirname, 'roulette-config.json');
const ROULETTE_HISTORY_FILE = path.join(__dirname, 'roulette-history.json');

function readRouletteConfig() {
    try {
        if (fs.existsSync(ROULETTE_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(ROULETTE_CONFIG_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading roulette config:', e); }
    return { enabled: false, spinCooldownHours: 24, couponDurationHours: 24, slots: [], lastSlotId: 0 };
}

function writeRouletteConfig(data) {
    try { fs.writeFileSync(ROULETTE_CONFIG_FILE, JSON.stringify(data, null, 2)); return true; }
    catch (e) { console.error('Error writing roulette config:', e); return false; }
}

function readRouletteHistory() {
    try {
        if (fs.existsSync(ROULETTE_HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(ROULETTE_HISTORY_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading roulette history:', e); }
    return { spins: [] };
}

function writeRouletteHistory(data) {
    try { fs.writeFileSync(ROULETTE_HISTORY_FILE, JSON.stringify(data, null, 2)); return true; }
    catch (e) { console.error('Error writing roulette history:', e); return false; }
}

// Get roulette config (public - slots without weights for client)
app.get('/api/roulette/config', (req, res) => {
    try {
        const config = readRouletteConfig();
        // Strip weights from public response so users can't see odds
        const publicSlots = (config.slots || []).filter(s => s.isActive !== false).map(s => ({
            id: s.id, name: s.name, image: s.image, rarity: s.rarity, prize: s.prize
        }));
        res.json({
            enabled: config.enabled,
            spinCooldownHours: config.spinCooldownHours || 24,
            couponDurationHours: config.couponDurationHours || 24,
            slots: publicSlots
        });
    } catch (e) {
        console.error('Error getting roulette config:', e);
        res.status(500).json({ error: 'Failed to read roulette config' });
    }
});

// Get full roulette config (admin only - includes weights)
app.get('/api/roulette/config/full', requireAdmin, (req, res) => {
    try {
        res.json(readRouletteConfig());
    } catch (e) {
        res.status(500).json({ error: 'Failed to read roulette config' });
    }
});

// Save roulette config (admin only)
app.post('/api/roulette/config', requireAdmin, (req, res) => {
    try {
        const config = req.body;
        writeRouletteConfig(config);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save roulette config' });
    }
});

// Upload roulette slot image
app.post('/api/roulette/upload-slot-image', requireAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        const imageUrl = '/uploads/' + req.file.filename;
        res.json({ success: true, url: imageUrl });
    } catch (e) {
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Check spin availability for user
app.get('/api/roulette/check/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const config = readRouletteConfig();
        if (!config.enabled) return res.json({ canSpin: false, reason: 'disabled' });

        // If unlimited spins enabled, always allow
        if (config.unlimitedSpins) {
            return res.json({ canSpin: true, unlimited: true });
        }

        const history = readRouletteHistory();
        const cooldownMs = (config.spinCooldownHours || 24) * 60 * 60 * 1000;
        const lastSpin = history.spins
            .filter(s => String(s.userId) === String(userId))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        if (lastSpin) {
            const elapsed = Date.now() - new Date(lastSpin.timestamp).getTime();
            if (elapsed < cooldownMs) {
                const nextSpinAt = new Date(new Date(lastSpin.timestamp).getTime() + cooldownMs);
                return res.json({ canSpin: false, reason: 'cooldown', nextSpinAt: nextSpinAt.toISOString(), lastPrize: lastSpin.prize });
            }
        }
        res.json({ canSpin: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to check spin' });
    }
});

// Spin the roulette
app.post('/api/roulette/spin', (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const config = readRouletteConfig();
        if (!config.enabled) return res.status(400).json({ error: 'Roulette is disabled' });

        const activeSlots = (config.slots || []).filter(s => s.isActive !== false);
        if (activeSlots.length === 0) return res.status(400).json({ error: 'No active slots' });

        // Check cooldown (skip if unlimited spins enabled)
        const history = readRouletteHistory();
        if (!config.unlimitedSpins) {
            const cooldownMs = (config.spinCooldownHours || 24) * 60 * 60 * 1000;
            const lastSpin = history.spins
                .filter(s => String(s.userId) === String(userId))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

            if (lastSpin) {
                const elapsed = Date.now() - new Date(lastSpin.timestamp).getTime();
                if (elapsed < cooldownMs) {
                    const nextSpinAt = new Date(new Date(lastSpin.timestamp).getTime() + cooldownMs);
                    return res.status(429).json({ error: 'Cooldown active', nextSpinAt: nextSpinAt.toISOString() });
                }
            }
        }

        // Weighted random selection
        const totalWeight = activeSlots.reduce((sum, s) => sum + (s.weight || 1), 0);
        let rand = Math.random() * totalWeight;
        let winner = activeSlots[0];
        for (const slot of activeSlots) {
            rand -= (slot.weight || 1);
            if (rand <= 0) { winner = slot; break; }
        }

        // Save spin to history
        const spinRecord = {
            userId: String(userId),
            timestamp: new Date().toISOString(),
            slotId: winner.id,
            slotName: winner.name,
            prize: winner.prize || winner.name,
            rarity: winner.rarity
        };
        history.spins.push(spinRecord);

        // Keep only last 1000 spins to prevent file bloat
        if (history.spins.length > 1000) {
            history.spins = history.spins.slice(-1000);
        }
        writeRouletteHistory(history);

        // Return winner info (without weight)
        res.json({
            success: true,
            winner: {
                id: winner.id,
                name: winner.name,
                image: winner.image,
                rarity: winner.rarity,
                prize: winner.prize
            },
            couponDurationHours: config.couponDurationHours || 24
        });
    } catch (e) {
        console.error('Error spinning roulette:', e);
        res.status(500).json({ error: 'Failed to spin' });
    }
});

// Get spin history for a user
app.get('/api/roulette/history/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const history = readRouletteHistory();
        const userSpins = history.spins
            .filter(s => String(s.userId) === String(userId))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);
        res.json(userSpins);
    } catch (e) {
        res.status(500).json({ error: 'Failed to get history' });
    }
});

// ===== TELEGRAM BOT BROADCAST & USER MANAGEMENT =====
const BOT_USERS_FILE = path.join(__dirname, 'bot-users.json');
const BOT_WELCOME_CONFIG_FILE = path.join(__dirname, 'bot-welcome-config.json');

// Initialize bot users file
if (!fs.existsSync(BOT_USERS_FILE)) {
    fs.writeFileSync(BOT_USERS_FILE, JSON.stringify({ users: [], totalCount: 0 }, null, 2));
}

// Initialize welcome config file
if (!fs.existsSync(BOT_WELCOME_CONFIG_FILE)) {
    fs.writeFileSync(BOT_WELCOME_CONFIG_FILE, JSON.stringify({
        enabled: true,
        photo: '',
        text: 'Добро пожаловать! Спасибо за регистрацию.',
        buttonText: 'Открыть магазин',
        buttonUrl: 'https://salikstore.ru',
        buttonType: 'url'
    }, null, 2));
}

// Read bot users
function readBotUsers() {
    try {
        if (fs.existsSync(BOT_USERS_FILE)) {
            const data = fs.readFileSync(BOT_USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading bot users:', error);
    }
    return { users: [], totalCount: 0 };
}

// Write bot users
function writeBotUsers(data) {
    try {
        fs.writeFileSync(BOT_USERS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing bot users:', error);
        return false;
    }
}

// Read welcome config
function readWelcomeConfig() {
    try {
        if (fs.existsSync(BOT_WELCOME_CONFIG_FILE)) {
            const data = fs.readFileSync(BOT_WELCOME_CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading welcome config:', error);
    }
    return { enabled: true, photo: '', text: '', buttonText: '', buttonUrl: '', buttonType: 'url' };
}

// Write welcome config
function writeWelcomeConfig(data) {
    try {
        fs.writeFileSync(BOT_WELCOME_CONFIG_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing welcome config:', error);
        return false;
    }
}

// Send photo with caption and inline keyboard to Telegram
function sendTelegramPhotoWithButton(chatId, photoUrl, caption, buttonText, buttonUrl, buttonType = 'url') {
    return new Promise((resolve, reject) => {
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            console.warn('Telegram bot not configured');
            resolve(false);
            return;
        }
        
        // Build button based on type
        const button = buttonType === 'webapp' 
            ? { text: buttonText, web_app: { url: buttonUrl } }
            : { text: buttonText, url: buttonUrl };
        
        const data = JSON.stringify({
            chat_id: chatIdStr,
            photo: photoUrl,
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[button]]
            }
        });
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendPhoto`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const request = https.request(options, (response) => {
            let responseData = '';
            response.on('data', (chunk) => responseData += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.ok) {
                        console.log('Photo sent successfully to', chatIdStr);
                        resolve(true);
                    } else {
                        console.error('Telegram API error:', result);
                        resolve(false);
                    }
                } catch (e) {
                    resolve(true);
                }
            });
        });
        
        request.on('error', (error) => {
            console.error('Request error:', error);
            resolve(false);
        });
        
        request.write(data);
        request.end();
    });
}

// Send message with inline button and entities (native Telegram formatting)
function sendTelegramMessageWithButtonAndEntities(chatId, message, entities, buttonText, buttonUrl, buttonType = 'url') {
    return new Promise((resolve, reject) => {
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            console.warn('Telegram bot not configured');
            resolve(false);
            return;
        }
        
        // Build button based on type
        const button = buttonType === 'webapp' 
            ? { text: buttonText, web_app: { url: buttonUrl } }
            : { text: buttonText, url: buttonUrl };
        
        const payload = {
            chat_id: chatIdStr,
            text: message,
            reply_markup: {
                inline_keyboard: [[button]]
            }
        };
        
        // Add entities if provided (native Telegram formatting)
        if (entities && entities.length > 0) {
            payload.entities = entities;
        }
        
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.ok) {
                        resolve(true);
                    } else {
                        console.error('Telegram API error:', result);
                        resolve(false);
                    }
                } catch (e) {
                    resolve(true);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve(false);
        });
        
        req.write(data);
        req.end();
    });
}

// Send message with inline button
function sendTelegramMessageWithButton(chatId, message, buttonText, buttonUrl, buttonType = 'url') {
    return new Promise((resolve, reject) => {
        const chatIdStr = String(chatId);
        
        if (!botToken || !chatIdStr) {
            console.warn('Telegram bot not configured');
            resolve(false);
            return;
        }
        
        // Build button based on type
        const button = buttonType === 'webapp' 
            ? { text: buttonText, web_app: { url: buttonUrl } }
            : { text: buttonText, url: buttonUrl };
        
        const data = JSON.stringify({
            chat_id: chatIdStr,
            text: message,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[button]]
            }
        });
        
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const request = https.request(options, (response) => {
            let responseData = '';
            response.on('data', (chunk) => responseData += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.ok) {
                        console.log('Message with button sent to', chatIdStr);
                        resolve(true);
                    } else {
                        console.error('Telegram API error:', result);
                        resolve(false);
                    }
                } catch (e) {
                    resolve(true);
                }
            });
        });
        
        request.on('error', (error) => {
            console.error('Request error:', error);
            resolve(false);
        });
        
        request.write(data);
        request.end();
    });
}

// Register new bot user (called when user starts bot)
app.post('/api/bot/register-user', (req, res) => {
    try {
        const { chatId, username, firstName, lastName } = req.body;
        
        if (!chatId) {
            return res.status(400).json({ error: 'chatId is required' });
        }
        
        const data = readBotUsers();
        const existingUser = data.users.find(u => u.chatId === String(chatId));
        
        if (existingUser) {
            // Update existing user
            existingUser.lastActive = new Date().toISOString();
            existingUser.username = username || existingUser.username;
            existingUser.firstName = firstName || existingUser.firstName;
            existingUser.lastName = lastName || existingUser.lastName;
            writeBotUsers(data);
            return res.json({ success: true, message: 'User updated', isNew: false });
        }
        
        // Add new user
        const newUser = {
            chatId: String(chatId),
            username: username || null,
            firstName: firstName || null,
            lastName: lastName || null,
            registeredAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        
        data.users.push(newUser);
        data.totalCount = data.users.length;
        writeBotUsers(data);
        
        // Send welcome message if enabled
        const welcomeConfig = readWelcomeConfig();
        if (welcomeConfig.enabled && welcomeConfig.text) {
            if (welcomeConfig.photo) {
                sendTelegramPhotoWithButton(
                    chatId,
                    welcomeConfig.photo,
                    welcomeConfig.text,
                    welcomeConfig.buttonText || 'Открыть магазин',
                    welcomeConfig.buttonUrl || 'https://salikstore.ru',
                    welcomeConfig.buttonType || 'url'
                );
            } else {
                sendTelegramMessageWithButton(
                    chatId,
                    welcomeConfig.text,
                    welcomeConfig.buttonText || 'Открыть магазин',
                    welcomeConfig.buttonUrl || 'https://salikstore.ru',
                    welcomeConfig.buttonType || 'url'
                );
            }
        }
        
        res.json({ success: true, message: 'User registered', isNew: true });
    } catch (error) {
        console.error('Error registering bot user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Get bot users count (admin only)
app.get('/api/bot/users-count', requireAdmin, (req, res) => {
    try {
        const data = readBotUsers();
        res.json({
            totalUsers: data.users.length,
            totalCount: data.totalCount,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting users count:', error);
        res.status(500).json({ error: 'Failed to get users count' });
    }
});

// Get bot users list (admin only)
app.get('/api/bot/users', requireAdmin, (req, res) => {
    try {
        const data = readBotUsers();
        res.json(data.users);
    } catch (error) {
        console.error('Error getting bot users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Broadcast message to all users (admin only)
app.post('/api/bot/broadcast', requireAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { message, buttonText, buttonUrl } = req.body;
        const photoFile = req.file;
        
        if (!message && !photoFile) {
            return res.status(400).json({ error: 'Message or photo is required' });
        }
        
        const data = readBotUsers();
        const users = data.users;
        
        if (users.length === 0) {
            return res.status(400).json({ error: 'No users to broadcast to' });
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // Send to each user with delay to avoid rate limiting
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            try {
                if (photoFile) {
                    const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${photoFile.filename}`;
                    const sent = await sendTelegramPhotoWithButton(
                        user.chatId,
                        photoUrl,
                        message || '',
                        buttonText || 'Подробнее',
                        buttonUrl || 'https://salikstore.ru'
                    );
                    if (sent) successCount++;
                    else failCount++;
                } else {
                    const sent = await sendTelegramMessageWithButton(
                        user.chatId,
                        message,
                        buttonText || 'Подробнее',
                        buttonUrl || 'https://salikstore.ru'
                    );
                    if (sent) successCount++;
                    else failCount++;
                }
                
                // Delay to avoid rate limiting (30 messages per second max)
                if (i < users.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error('Error sending to user', user.chatId, error);
                failCount++;
            }
        }
        
        res.json({
            success: true,
            totalUsers: users.length,
            successCount,
            failCount
        });
    } catch (error) {
        console.error('Error broadcasting:', error);
        res.status(500).json({ error: 'Failed to broadcast message' });
    }
});

// Get welcome message config (admin only)
app.get('/api/bot/welcome-config', requireAdmin, (req, res) => {
    try {
        const config = readWelcomeConfig();
        res.json(config);
    } catch (error) {
        console.error('Error getting welcome config:', error);
        res.status(500).json({ error: 'Failed to get config' });
    }
});

// Update welcome message config (admin only)
app.post('/api/bot/welcome-config', requireAdmin, upload.single('photo'), (req, res) => {
    try {
        const { enabled, text, buttonText, buttonUrl } = req.body;
        const photoFile = req.file;
        
        const currentConfig = readWelcomeConfig();
        
        const newConfig = {
            enabled: enabled === 'true' || enabled === true,
            text: text || currentConfig.text,
            buttonText: buttonText || currentConfig.buttonText,
            buttonUrl: buttonUrl || currentConfig.buttonUrl,
            photo: photoFile ? `/uploads/${photoFile.filename}` : (req.body.photoUrl || currentConfig.photo)
        };
        
        if (writeWelcomeConfig(newConfig)) {
            res.json({ success: true, config: newConfig });
        } else {
            res.status(500).json({ error: 'Failed to save config' });
        }
    } catch (error) {
        console.error('Error updating welcome config:', error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// Telegram webhook endpoint - receives messages from Telegram
app.post('/webhook', express.json(), async (req, res) => {
    try {
        const update = req.body;
        console.log('📩 Telegram webhook received:', JSON.stringify(update, null, 2));
        
        // Acknowledge receipt immediately
        res.sendStatus(200);
        
        // Handle callback queries (inline keyboard button presses)
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message?.chat?.id;
            const messageId = query.message?.message_id;
            const userId = query.from?.id;
            const data = query.data;
            
            console.log(`🔘 Callback query from ${userId}: ${data}`);
            
            // Check admin
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            if (!isAdmin) {
                await sendTelegramMessagePlain(chatId, 'У вас нет прав администратора.');
                return;
            }
            
            // Answer callback query
            await new Promise((resolve) => {
                const answerData = JSON.stringify({
                    callback_query_id: query.id,
                    text: ''
                });
                const options = {
                    hostname: 'api.telegram.org',
                    path: `/bot${botToken}/answerCallbackQuery`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(answerData)
                    }
                };
                const request = https.request(options, (res) => resolve());
                request.on('error', () => resolve());
                request.write(answerData);
                request.end();
            });
            
            // Handle different callback actions
            if (data === 'admin_menu') {
                await editTelegramMessage(
                    chatId,
                    messageId,
                    'Панель администратора\n\nВыберите действие:',
                    [
                        [
                            { text: 'Массовая рассылка', callback_data: 'broadcast_start' },
                            { text: 'Приветствие', callback_data: 'welcome_menu' }
                        ],
                        [
                            { text: 'Статистика', callback_data: 'stats' },
                            { text: 'Отмена', callback_data: 'cancel' }
                        ]
                    ]
                );
                return;
            }
            
            if (data === 'broadcast_start') {
                setAdminState(userId, { action: 'broadcast_text' });
                await editTelegramMessage(
                    chatId,
                    messageId,
                    'Массовая рассылка\n\nВведите текст сообщения:\n\nИспользуйте HTML для форматирования:\n&lt;b&gt;жирный&lt;/b&gt;\n&lt;i&gt;курсив&lt;/i&gt;\n&lt;a href="url"&gt;ссылка&lt;/a&gt;\n\nОтправьте /cancel для отмены',
                    [
                        [{ text: 'Отмена', callback_data: 'cancel' }]
                    ]
                );
                return;
            }
            
            if (data === 'welcome_menu') {
                console.log(`✋ welcome_menu clicked by user ${userId}`);
                try {
                    const config = readWelcomeConfig();
                    const status = config.enabled ? 'Включено' : 'Выключено';
                    
                    const typeLabel = config.buttonType === 'webapp' ? 'Mini App' : 'Ссылка';
                    const messageText = `Настройка приветствия\n\nСтатус: ${status}\n\nТекущий текст:\n${config.text || '(не задан)'}\n\nКнопка: ${config.buttonText || '(не задана)'}\nТип: ${typeLabel}\nURL: ${config.buttonUrl || '(не задан)'}`;
                    
                    const keyboard = [
                        [
                            { text: 'Изменить текст', callback_data: 'welcome_text' },
                            { text: 'Фото', callback_data: 'welcome_photo' }
                        ],
                        [
                            { text: 'Кнопка', callback_data: 'welcome_button' },
                            { text: config.enabled ? 'Выключить' : 'Включить', callback_data: 'welcome_toggle' }
                        ],
                        [
                            { text: 'Назад', callback_data: 'admin_menu' }
                        ]
                    ];
                    
                    console.log(`✋ Editing message ${messageId} in chat ${chatId}`);
                    const result = await editTelegramMessage(chatId, messageId, messageText, keyboard);
                    console.log(`✋ editTelegramMessage result: ${result}`);
                } catch (error) {
                    console.error(`❌ Error in welcome_menu handler:`, error);
                    await sendTelegramMessagePlain(chatId, 'Произошла ошибка. Попробуйте снова: /admin');
                }
                return;
            }
            
            if (data === 'welcome_text') {
                console.log(`✏️ Setting admin state for welcome_edit_text, userId: ${userId}`);
                setAdminState(userId, { action: 'welcome_edit_text' });
                const sent = await sendTelegramMessagePlain(
                    chatId,
                    'Введите новый текст приветствия:\n\nИспользуйте HTML для форматирования:\n<b>жирный</b>, <i>курсив</i>, <a href="url">ссылка</a>\n\nОтправьте /cancel для отмены'
                );
                console.log(`✏️ welcome_text message sent: ${sent}`);
                return;
            }
            
            if (data === 'welcome_button') {
                console.log(`🔘 Setting admin state for welcome_button_type, userId: ${userId}`);
                setAdminState(userId, { action: 'welcome_button_type' });
                const sent = await sendTelegramMessageWithKeyboard(
                    chatId,
                    'Выберите тип кнопки:',
                    [
                        [
                            { text: 'Ссылка (URL)', callback_data: 'button_type_url' },
                            { text: 'Mini App', callback_data: 'button_type_webapp' }
                        ],
                        [
                            { text: 'Отмена', callback_data: 'welcome_menu' }
                        ]
                    ]
                );
                console.log(`🔘 welcome_button_type message sent: ${sent}`);
                return;
            }
            
            if (data === 'button_type_url') {
                console.log(`🌐 Setting admin state for welcome_edit_button_url, userId: ${userId}`);
                setAdminState(userId, { action: 'welcome_edit_button', buttonType: 'url' });
                const sent = await sendTelegramMessagePlain(
                    chatId,
                    'Введите текст кнопки и URL через разделитель | :\n\nНапример: Открыть магазин | https://salikstore.ru\n\nОтправьте /cancel для отмены'
                );
                console.log(`🌐 button_type_url message sent: ${sent}`);
                return;
            }
            
            if (data === 'button_type_webapp') {
                console.log(`📱 Setting admin state for welcome_edit_button_webapp, userId: ${userId}`);
                setAdminState(userId, { action: 'welcome_edit_button', buttonType: 'webapp' });
                const sent = await sendTelegramMessagePlain(
                    chatId,
                    'Введите текст кнопки и URL Mini App через разделитель | :\n\nНапример: Открыть магазин | https://salikstore.ru/TGminiapp.html\n\nОтправьте /cancel для отмены'
                );
                console.log(`📱 button_type_webapp message sent: ${sent}`);
                return;
            }
            
            if (data === 'welcome_photo') {
                console.log(`🖼 Setting admin state for welcome_edit_photo, userId: ${userId}`);
                setAdminState(userId, { action: 'welcome_edit_photo' });
                const sent = await sendTelegramMessagePlain(
                    chatId,
                    'Отправьте фото для приветственного сообщения:\n\nОтправьте /skip чтобы удалить фото\nОтправьте /cancel для отмены'
                );
                console.log(`🖼 welcome_photo message sent: ${sent}`);
                return;
            }
            
            if (data === 'welcome_toggle') {
                const config = readWelcomeConfig();
                config.enabled = !config.enabled;
                writeWelcomeConfig(config);
                
                const status = config.enabled ? 'Включено' : 'Выключено';
                await editTelegramMessage(
                    chatId,
                    messageId,
                    `Настройка приветствия\n\nСтатус: ${status}\n\nТекущий текст:\n${config.text || '(не задан)'}\n\nКнопка: ${config.buttonText || '(не задана)'}\nURL: ${config.buttonUrl || '(не задан)'}`,
                    [
                        [
                            { text: 'Изменить текст', callback_data: 'welcome_text' },
                            { text: 'Фото', callback_data: 'welcome_photo' }
                        ],
                        [
                            { text: 'Кнопка', callback_data: 'welcome_button' },
                            { text: config.enabled ? 'Выключить' : 'Включить', callback_data: 'welcome_toggle' }
                        ],
                        [
                            { text: 'Назад', callback_data: 'admin_menu' }
                        ]
                    ]
                );
                await sendTelegramMessagePlain(chatId, config.enabled ? 'Приветствие включено!' : 'Приветствие выключено!');
                return;
            }
            
            if (data === 'stats') {
                const userData = readBotUsers();
                const today = new Date().toDateString();
                const todayUsers = userData.users.filter(u => {
                    const userDate = new Date(u.registeredAt).toDateString();
                    return today === userDate;
                }).length;
                
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekUsers = userData.users.filter(u => new Date(u.registeredAt) >= weekAgo).length;
                
                // Create CSV content for Excel
                let csvContent = 'ID,Username,First Name,Last Name,Chat ID,Registered At,Last Active\n';
                userData.users.forEach(user => {
                    csvContent += `${user.userId || ''},"${user.username || ''}","${user.firstName || ''}","${user.lastName || ''}",${user.chatId},${user.registeredAt || ''},${user.lastActive || ''}\n`;
                });
                
                // Save CSV file
                const csvFileName = `users-stats-${Date.now()}.csv`;
                const csvFilePath = path.join(__dirname, 'uploads', csvFileName);
                
                if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
                    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
                }
                
                fs.writeFileSync(csvFilePath, csvContent, 'utf8');
                
                // Send file URL to admin
                const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${csvFileName}`;
                
                await editTelegramMessage(
                    chatId,
                    messageId,
                    `Статистика\n\nВсего: ${userData.users.length}\nСегодня: ${todayUsers}\nНеделя: ${weekUsers}\n\nФайл со всеми пользователями:\n${fileUrl}`,
                    [
                        [{ text: 'Назад', callback_data: 'admin_menu' }]
                    ]
                );
                return;
            }
            
            if (data === 'cancel') {
                clearAdminState(userId);
                await editTelegramMessage(
                    chatId,
                    messageId,
                    'Действие отменено.',
                    [[{ text: 'Меню', callback_data: 'admin_menu' }]]
                );
                return;
            }
            
            if (data === 'broadcast_confirm') {
                const adminState = getAdminState(userId);
                if (!adminState || adminState.action !== 'broadcast_confirm') {
                    await sendTelegramMessagePlain(chatId, 'Сессия истекла. Начните заново: /broadcast');
                    return;
                }
                
                // Perform broadcast
                const userData = readBotUsers();
                let successCount = 0;
                let failCount = 0;
                
                await sendTelegramMessagePlain(chatId, `Начинаю рассылку для ${userData.users.length} пользователей...`);
                
                for (let i = 0; i < userData.users.length; i++) {
                    const user = userData.users[i];
                    try {
                        if (adminState.photo) {
                            const sent = await sendTelegramPhotoWithButton(
                                user.chatId,
                                adminState.photo,
                                adminState.text || '',
                                adminState.buttonText || 'Подробнее',
                                adminState.buttonUrl || 'https://salikstore.ru'
                            );
                            if (sent) successCount++;
                            else failCount++;
                        } else {
                            const sent = await sendTelegramMessageWithButtonAndEntities(
                                user.chatId,
                                adminState.text,
                                adminState.entities || [],
                                adminState.buttonText || 'Подробнее',
                                adminState.buttonUrl || 'https://salikstore.ru'
                            );
                            if (sent) successCount++;
                            else failCount++;
                        }
                        
                        if (i < userData.users.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (error) {
                        failCount++;
                    }
                }
                
                clearAdminState(userId);
                await sendTelegramMessagePlain(
                    chatId,
                    `Рассылка завершена!\n\nУспешно: ${successCount}\nНе удалось: ${failCount}`
                );
                return;
            }
            
            return;
        }
        
        // Check if it's a message
        if (!update.message) {
            console.log('No message in update');
            return;
        }
        
        const msg = update.message;
        const chatId = msg.chat?.id;
        const text = msg.text || '';
        const username = msg.from?.username;
        const firstName = msg.from?.first_name;
        const lastName = msg.from?.last_name;
        const userId = msg.from?.id;
        
        if (!chatId) {
            console.log('No chat ID in message');
            return;
        }
        
        console.log(`👤 User ${userId} (${username}) sent: ${text}`);
        
        // Handle /start command
        if (text === '/start') {
            console.log('🚀 /start command received');
            
            // Register or update user
            const userData = readBotUsers();
            const existingUser = userData.users.find(u => u.chatId === String(chatId));
            const isNewUser = !existingUser;
            
            if (existingUser) {
                existingUser.lastActive = new Date().toISOString();
                existingUser.username = username || existingUser.username;
                existingUser.firstName = firstName || existingUser.firstName;
                existingUser.lastName = lastName || existingUser.lastName;
            } else {
                const newUser = {
                    chatId: String(chatId),
                    userId: String(userId),
                    username: username || null,
                    firstName: firstName || null,
                    lastName: lastName || null,
                    registeredAt: new Date().toISOString(),
                    lastActive: new Date().toISOString()
                };
                userData.users.push(newUser);
                userData.totalCount = userData.users.length;
            }
            writeBotUsers(userData);
            
            // Send welcome message
            const welcomeConfig = readWelcomeConfig();
            if (welcomeConfig.enabled && welcomeConfig.text) {
                if (welcomeConfig.photo) {
                    const fullPhotoUrl = welcomeConfig.photo.startsWith('http') 
                        ? welcomeConfig.photo 
                        : `${req.protocol}://${req.get('host')}${welcomeConfig.photo}`;
                    await sendTelegramPhotoWithButton(
                        chatId,
                        fullPhotoUrl,
                        welcomeConfig.text,
                        welcomeConfig.buttonText || 'Открыть магазин',
                        welcomeConfig.buttonUrl || 'https://salikstore.ru',
                        welcomeConfig.buttonType || 'url'
                    );
                } else {
                    await sendTelegramMessageWithButton(
                        chatId,
                        welcomeConfig.text,
                        welcomeConfig.buttonText || 'Открыть магазин',
                        welcomeConfig.buttonUrl || 'https://salikstore.ru',
                        welcomeConfig.buttonType || 'url'
                    );
                }
            } else {
                // Default welcome message if not configured
                await sendTelegramMessageWithButton(
                    chatId,
                    'Добро пожаловать! Спасибо за регистрацию.',
                    'Открыть магазин',
                    'https://salikstore.ru'
                );
            }
            
            // Notify admin about new user
            if (isNewUser && adminChatId) {
                await sendTelegramMessagePlain(
                    adminChatId,
                    `Новый пользователь бота!\n\nID: ${userId}\nUsername: @${username || 'нет'}\nИмя: ${firstName || 'нет'} ${lastName || ''}`
                );
            }
            
            return;
        }
        
        // Handle /admin command - show admin panel in bot
        if (text === '/admin') {
            console.log('👑 /admin command received');
            
            // Check if user is admin
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            if (isAdmin) {
                await sendTelegramMessageWithKeyboard(
                    chatId,
                    'Панель администратора\n\nВыберите действие:',
                    [
                        [
                            { text: 'Массовая рассылка', callback_data: 'broadcast_start' },
                            { text: 'Приветствие', callback_data: 'welcome_menu' }
                        ],
                        [
                            { text: 'Статистика', callback_data: 'stats' },
                            { text: 'Отмена', callback_data: 'cancel' }
                        ]
                    ]
                );
            } else {
                await sendTelegramMessagePlain(
                    chatId,
                    'У вас нет прав администратора.'
                );
            }
            
            return;
        }
        
        // Handle /broadcast command - start broadcast flow
        if (text === '/broadcast') {
            console.log('📢 /broadcast command received');
            
            // Check if user is admin
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            if (isAdmin) {
                setAdminState(userId, { action: 'broadcast_text' });
                await sendTelegramMessagePlain(
                    chatId,
                    'Массовая рассылка\n\nВведите текст сообщения:\n\nИспользуйте HTML для форматирования:\n<b>жирный</b>, <i>курсив</i>, <a href="url">ссылка</a>\n\nОтправьте /cancel для отмены'
                );
            } else {
                await sendTelegramMessagePlain(
                    chatId,
                    'У вас нет прав администратора.'
                );
            }
            
            return;
        }
        
        // Handle /welcome command - edit welcome message
        if (text === '/welcome') {
            console.log('✋ /welcome command received');
            
            // Check if user is admin
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            if (isAdmin) {
                const config = readWelcomeConfig();
                const status = config.enabled ? 'Включено' : 'Выключено';
                
                await sendTelegramMessageWithKeyboard(
                    chatId,
                    `Настройка приветствия\n\nСтатус: ${status}\n\nТекущий текст:\n${config.text || '(не задан)'}\n\nКнопка: ${config.buttonText || '(не задана)'}\nURL: ${config.buttonUrl || '(не задан)'}`,
                    [
                        [
                            { text: 'Изменить текст', callback_data: 'welcome_text' },
                            { text: 'Фото', callback_data: 'welcome_photo' }
                        ],
                        [
                            { text: 'Кнопка', callback_data: 'welcome_button' },
                            { text: config.enabled ? 'Выключить' : 'Включить', callback_data: 'welcome_toggle' }
                        ],
                        [
                            { text: 'Назад', callback_data: 'admin_menu' }
                        ]
                    ]
                );
            } else {
                await sendTelegramMessagePlain(
                    chatId,
                    'У вас нет прав администратора.'
                );
            }
            
            return;
        }
        
        // Handle /stats command (admin only)
        if (text === '/stats' || text === '/users') {
            console.log('📊 /stats command received');
            
            // Check if user is admin
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            if (isAdmin) {
                const userData = readBotUsers();
                const today = new Date().toDateString();
                const todayUsers = userData.users.filter(u => {
                    const userDate = new Date(u.registeredAt).toDateString();
                    return today === userDate;
                }).length;
                
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekUsers = userData.users.filter(u => new Date(u.registeredAt) >= weekAgo).length;
                
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                const monthUsers = userData.users.filter(u => new Date(u.registeredAt) >= monthAgo).length;
                
                await sendTelegramMessage(
                    chatId,
                    `Статистика бота\n\n` +
                    `Всего пользователей: ${userData.users.length}\n` +
                    `Сегодня: ${todayUsers}\n` +
                    `За неделю: ${weekUsers}\n` +
                    `За месяц: ${monthUsers}\n\n` +
                    `Последнее обновление: ${new Date().toLocaleString('ru-RU')}`
                );
            } else {
                await sendTelegramMessagePlain(
                    chatId,
                    'У вас нет прав администратора.'
                );
            }
            
            return;
        }
        
        // Handle /cancel command
        if (text === '/cancel') {
            clearAdminState(userId);
            await sendTelegramMessagePlain(
                chatId,
                'Действие отменено.'
            );
            return;
        }
        
        // Handle admin state (multi-step commands)
        const adminState = getAdminState(userId);
        if (adminState) {
            // Check if user is still admin
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            if (!isAdmin) {
                clearAdminState(userId);
                await sendTelegramMessagePlain(chatId, 'У вас нет прав администратора.');
                return;
            }
            
            // Handle broadcast flow
            if (adminState.action === 'broadcast_text') {
                // Store message entities for native formatting
                const entities = msg.entities || [];
                setAdminState(userId, { 
                    action: 'broadcast_photo', 
                    text: text,
                    entities: entities,
                    previewMessage: msg.message_id 
                });
                await sendTelegramMessagePlain(
                    chatId,
                    'Шаг 2/4\n\nОтправьте фото для рассылки или нажмите /skip чтобы пропустить'
                );
                return;
            }
            
            if (adminState.action === 'broadcast_button') {
                const parts = text.split('|').map(p => p.trim());
                if (parts.length !== 2) {
                    await sendTelegramMessagePlain(
                        chatId,
                        'Неверный формат. Используйте:\nТекст кнопки | https://ссылка'
                    );
                    return;
                }
                
                setAdminState(userId, { 
                    ...adminState,
                    action: 'broadcast_confirm', 
                    buttonText: parts[0],
                    buttonUrl: parts[1]
                });
                
                await sendTelegramMessageWithKeyboard(
                    chatId,
                    `Подтверждение рассылки\n\n` +
                    `Текст: ${adminState.text.substring(0, 100)}${adminState.text.length > 100 ? '...' : ''}\n\n` +
                    `Кнопка: ${parts[0]}\n` +
                    `URL: ${parts[1]}\n\n` +
                    `Получателей: ${readBotUsers().users.length}`,
                    [
                        [
                            { text: 'Отправить', callback_data: 'broadcast_confirm' },
                            { text: 'Отмена', callback_data: 'cancel' }
                        ]
                    ]
                );
                return;
            }
            
            if (adminState.action === 'welcome_edit_text') {
                const config = readWelcomeConfig();
                config.text = text;
                writeWelcomeConfig(config);
                clearAdminState(userId);
                
                await sendTelegramMessagePlain(
                    chatId,
                    'Текст приветствия обновлен!'
                );
                
                // Show welcome menu again
                const status = config.enabled ? 'Включено' : 'Выключено';
                await sendTelegramMessageWithKeyboard(
                    chatId,
                    `Настройка приветствия\n\nСтатус: ${status}\n\nТекущий текст:\n${config.text || '(не задан)'}\n\nКнопка: ${config.buttonText || '(не задана)'}\nURL: ${config.buttonUrl || '(не задан)'}`,
                    [
                        [
                            { text: 'Изменить текст', callback_data: 'welcome_text' },
                            { text: 'Фото', callback_data: 'welcome_photo' }
                        ],
                        [
                            { text: 'Кнопка', callback_data: 'welcome_button' },
                            { text: config.enabled ? 'Выключить' : 'Включить', callback_data: 'welcome_toggle' }
                        ],
                        [
                            { text: 'Назад', callback_data: 'admin_menu' }
                        ]
                    ]
                );
                return;
            }
            
            if (adminState.action === 'welcome_edit_button') {
                const parts = text.split('|').map(p => p.trim());
                if (parts.length !== 2) {
                    await sendTelegramMessagePlain(
                        chatId,
                        'Неверный формат. Используйте:\nТекст кнопки | https://ссылка'
                    );
                    return;
                }
                
                const config = readWelcomeConfig();
                config.buttonText = parts[0];
                config.buttonUrl = parts[1];
                config.buttonType = adminState.buttonType || 'url';
                writeWelcomeConfig(config);
                clearAdminState(userId);
                
                const typeLabel = config.buttonType === 'webapp' ? 'Mini App' : 'ссылка';
                await sendTelegramMessagePlain(
                    chatId,
                    `Кнопка приветствия обновлена!\n\nТип: ${typeLabel}\nТекст: ${config.buttonText}\nURL: ${config.buttonUrl}`
                );
                return;
            }
        }
        
        // Handle /skip command
        if (text === '/skip') {
            const adminState = getAdminState(userId);
            if (adminState) {
                // Check admin
                const adminData = readAdminUsers();
                const isAdmin = adminData.admins.some(admin => 
                    admin.type === 'telegram' && String(admin.id) === String(userId)
                );
                
                if (!isAdmin) {
                    await sendTelegramMessagePlain(chatId, 'У вас нет прав администратора.');
                    return;
                }
                
                if (adminState.action === 'broadcast_photo') {
                    setAdminState(userId, { 
                        ...adminState,
                        action: 'broadcast_button',
                        photo: null 
                    });
                    await sendTelegramMessagePlain(
                        chatId,
                        'Шаг 3/4\n\nВведите кнопку в формате:\nТекст кнопки | https://ссылка\n\nОтправьте /skip чтобы без кнопки'
                    );
                    return;
                }
                
                if (adminState.action === 'broadcast_button') {
                    setAdminState(userId, { 
                        ...adminState,
                        action: 'broadcast_confirm',
                        buttonText: null,
                        buttonUrl: null
                    });
                    
                    await sendTelegramMessageWithKeyboard(
                        chatId,
                        `Подтверждение рассылки\n\n` +
                        `Текст: ${adminState.text.substring(0, 100)}${adminState.text.length > 100 ? '...' : ''}\n\n` +
                        `Фото: ${adminState.photo ? 'Да' : 'Нет'}\n` +
                        `Кнопка: Нет\n\n` +
                        `Получателей: ${readBotUsers().users.length}`,
                        [
                            [
                                { text: 'Отправить', callback_data: 'broadcast_confirm' },
                                { text: 'Отмена', callback_data: 'cancel' }
                            ]
                        ]
                    );
                    return;
                }
                
                if (adminState.action === 'welcome_edit_photo') {
                    const config = readWelcomeConfig();
                    config.photo = '';
                    writeWelcomeConfig(config);
                    clearAdminState(userId);
                    await sendTelegramMessagePlain(chatId, 'Фото приветствия удалено!');
                    return;
                }
            }
        }
        
        // Handle photos in admin state
        if (msg.photo && msg.photo.length > 0) {
            const adminState = getAdminState(userId);
            if (adminState) {
                // Check admin
                const adminData = readAdminUsers();
                const isAdmin = adminData.admins.some(admin => 
                    admin.type === 'telegram' && String(admin.id) === String(userId)
                );
                
                if (!isAdmin) {
                    await sendTelegramMessagePlain(chatId, 'У вас нет прав администратора.');
                    return;
                }
                
                // Get the largest photo
                const photo = msg.photo[msg.photo.length - 1];
                const fileId = photo.file_id;
                
                // Get file URL from Telegram
                const fileData = await new Promise((resolve) => {
                    const data = JSON.stringify({ file_id: fileId });
                    const options = {
                        hostname: 'api.telegram.org',
                        path: `/bot${botToken}/getFile`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(data)
                        }
                    };
                    const request = https.request(options, (res) => {
                        let responseData = '';
                        res.on('data', (chunk) => responseData += chunk);
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(responseData));
                            } catch (e) {
                                resolve(null);
                            }
                        });
                    });
                    request.on('error', () => resolve(null));
                    request.write(data);
                    request.end();
                });
                
                if (fileData && fileData.ok && fileData.result) {
                    const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
                    const fileExt = path.extname(fileData.result.file_path) || '.jpg';
                    const localFileName = `welcome-photo-${Date.now()}${fileExt}`;
                    
                    try {
                        // Download file locally
                        const localFileUrl = await downloadTelegramFile(telegramFileUrl, localFileName);
                        const fullLocalUrl = `${req.protocol}://${req.get('host')}${localFileUrl}`;
                        
                        if (adminState.action === 'broadcast_photo') {
                            setAdminState(userId, { 
                                ...adminState,
                                action: 'broadcast_button',
                                photo: fullLocalUrl 
                            });
                            await sendTelegramMessagePlain(
                                chatId,
                                'Шаг 3/4\n\nВведите кнопку в формате:\nТекст кнопки | https://ссылка\n\nОтправьте /skip чтобы без кнопки'
                            );
                            return;
                        }
                        
                        if (adminState.action === 'welcome_edit_photo') {
                            const config = readWelcomeConfig();
                            config.photo = localFileUrl;
                            writeWelcomeConfig(config);
                            clearAdminState(userId);
                            await sendTelegramMessagePlain(chatId, 'Фото приветствия обновлено!');
                            return;
                        }
                    } catch (downloadError) {
                        console.error('Error downloading file:', downloadError);
                        await sendTelegramMessagePlain(chatId, 'Не удалось скачать фото. Попробуйте снова.');
                    }
                } else {
                    await sendTelegramMessagePlain(chatId, 'Не удалось получить фото');
                }
                return;
            }
        }
        
        // Handle /help command
        if (text === '/help') {
            const adminData = readAdminUsers();
            const isAdmin = adminData.admins.some(admin => 
                admin.type === 'telegram' && String(admin.id) === String(userId)
            );
            
            let helpText = 'Доступные команды:\n\n' +
                '/start - Начать работу с ботом\n' +
                '/help - Показать эту справку';
            
            if (isAdmin) {
                helpText += '\n\nКоманды администратора:\n' +
                    '/admin - Панель администратора\n' +
                    '/broadcast - Массовая рассылка\n' +
                    '/welcome - Настройка приветствия\n' +
                    '/stats - Статистика пользователей\n' +
                    '/users - Список пользователей\n' +
                    '/cancel - Отменить текущее действие';
            }
            
            await sendTelegramMessage(chatId, helpText);
            return;
        }
        
    } catch (error) {
        console.error('❌ Error in webhook handler:', error);
        // Still return 200 to Telegram to prevent retries
        res.sendStatus(200);
    }
});

// Default route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
// Listen on all interfaces (0.0.0.0) to allow cloudflared to connect
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Products will be saved to: ${PRODUCTS_FILE}`);
    console.log('\nAPI Endpoints:');
    console.log('GET    /api/products          - Get all products');
    console.log('GET    /api/products/:category - Get products by category');
    console.log('GET    /api/product/:id        - Get single product');
    console.log('POST   /api/products/:category - Add new product');
    console.log('PUT    /api/product/:id        - Update product');
    console.log('DELETE /api/product/:id        - Delete product');
    console.log('POST   /api/upload             - Upload image');
    console.log('\nTo stop server, press Ctrl+C');
});
