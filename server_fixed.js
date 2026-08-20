const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_PORT = 5000;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.svg': 'image/svg+xml',
};

// Proxy requests to Python API server
function proxyRequest(req, res, apiPath) {
    const options = {
        hostname: 'localhost',
        port: API_PORT,
        path: apiPath,
        method: req.method,
        headers: {
            ...req.headers,
            host: `localhost:${API_PORT}`
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error' }));
    });

    req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);
    
    // Remove query parameters from file path
    let urlPath = req.url.split('?')[0];
    
    // Proxy API requests to Python server
    if (urlPath.startsWith('/api/')) {
        console.log(`Proxying API request to Python server: ${urlPath}`);
        proxyRequest(req, res, urlPath);
        return;
    }
    
    // Handle Telegram file IDs (redirect to Telegram CDN)
    if (urlPath.startsWith('/AgAC') || urlPath.startsWith('/AQAD')) {
        console.log(`Telegram file ID detected, redirecting to placeholder`);
        res.writeHead(302, { 'Location': 'https://via.placeholder.com/150' });
        res.end();
        return;
    }
    
    let filePath = '.' + urlPath;
    
    if (filePath === './' || filePath === '.') {
        filePath = './TGMiniapp.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                console.log(`File not found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                console.log(`Server error: ${error.code}`);
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            console.log(`Serving: ${filePath} (${contentType})`);
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Open http://localhost:${PORT}/TGMiniapp.html`);
    console.log('Server is ready for connections...');
});