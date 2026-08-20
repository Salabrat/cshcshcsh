// Script to start server with Cloudflare Tunnel
const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;

// Try to find cloudflared in multiple locations
function findCloudflared() {
    // 1. Check if cloudflared.exe exists in project directory (local installation)
    const localPath = path.join(__dirname, 'cloudflared.exe');
    if (fs.existsSync(localPath)) {
        return localPath;
    }
    
    // 2. Check environment variable
    if (process.env.CLOUDFLARE_PATH) {
        return process.env.CLOUDFLARE_PATH;
    }
    
    // 3. Check npm global installation (cmd file)
    const npmCmdPath = path.join(process.env.APPDATA || process.env.HOME, 'npm', 'cloudflared.cmd');
    if (fs.existsSync(npmCmdPath)) {
        return npmCmdPath;
    }
    
    // 4. Check npm global installation (exe file)
    const npmExePath = path.join(process.env.APPDATA || process.env.HOME, 'npm', 'node_modules', 'cloudflared', 'bin', 'cloudflared.exe');
    if (fs.existsSync(npmExePath)) {
        return npmExePath;
    }
    
    // 5. Try to find cloudflared in PATH using 'where' command (Windows)
    try {
        if (process.platform === 'win32') {
            const whereResult = execSync('where cloudflared', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            if (whereResult && whereResult.trim()) {
                // Prefer .cmd file over .exe if both exist
                const paths = whereResult.trim().split('\n').map(p => p.trim());
                const cmdPath = paths.find(p => p.endsWith('.cmd'));
                return cmdPath || paths[0];
            }
        }
    } catch (e) {
        // cloudflared not found in PATH
    }
    
    // 5. Default: try to use cloudflared from PATH
    return 'cloudflared';
}

const CLOUDFLARE_PATH = findCloudflared();

console.log('🚀 Starting server and Cloudflare Tunnel...\n');

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: true
});

// Wait for server to be ready before starting tunnel
setTimeout(() => {
    console.log('\n📡 Checking if server is ready...\n');
    
    // Simple check if server responds
    const http = require('http');
    const checkRequest = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        console.log('✅ Server is ready, starting Cloudflare Tunnel...\n');
        startCloudflareTunnel();
    });
    
    checkRequest.on('error', (err) => {
        console.log('⚠️  Server check failed, waiting a bit more...\n');
        // Wait additional 2 seconds and start anyway
        setTimeout(() => {
            console.log('📡 Starting Cloudflare Tunnel (server should be ready)...\n');
            startCloudflareTunnel();
        }, 2000);
    });
    
    checkRequest.setTimeout(2000, () => {
        checkRequest.destroy();
        console.log('⚠️  Server check timeout, starting tunnel anyway...\n');
        startCloudflareTunnel();
    });
}, 3000);

function startCloudflareTunnel() {
    
    // Check if cloudflared exists (if it's a full path)
    const isFullPath = CLOUDFLARE_PATH.includes(path.sep) || CLOUDFLARE_PATH.includes('/') || CLOUDFLARE_PATH.includes('\\');
    if (isFullPath && !fs.existsSync(CLOUDFLARE_PATH)) {
        console.error(`❌ Cloudflared not found at: ${CLOUDFLARE_PATH}`);
        console.log('\n💡 Убедитесь, что cloudflared установлен и доступен в PATH');
        console.log('   Скачайте с: https://github.com/cloudflare/cloudflared/releases');
        console.log('   Или установите через npm: npm install -g cloudflared\n');
        return;
    }
    
    // Start Cloudflare Tunnel
    // Handle paths with spaces properly
    // Use 127.0.0.1 instead of localhost to avoid DNS/VPN issues
    // Add --no-tls-verify to help with VPN/network issues (development only)
    const cloudflareArgs = [
        'tunnel', 
        '--url', `http://127.0.0.1:${PORT}`,
        '--no-autoupdate'  // Disable auto-update to avoid interruptions
    ];
    
    // .cmd files require shell: true on Windows
    const isCmdFile = CLOUDFLARE_PATH.endsWith('.cmd');
    const hasSpaces = CLOUDFLARE_PATH.includes(' ');
    
    // For .cmd files with spaces, use exec with properly quoted command
    // For others, use spawn
    let cloudflare;
    
    if (isCmdFile && hasSpaces) {
        // Use exec for .cmd files with spaces - it handles quoting better
        const fullCommand = `"${CLOUDFLARE_PATH}" ${cloudflareArgs.join(' ')}`;
        cloudflare = exec(fullCommand);
    } else {
        // Use spawn for regular files or files without spaces
        const useShell = !isFullPath || isCmdFile;
        const cloudflareOptions = {
            stdio: 'pipe',
            shell: useShell
        };
        
        let cloudflareCommand = CLOUDFLARE_PATH;
        if (useShell && hasSpaces) {
            cloudflareCommand = `"${CLOUDFLARE_PATH}"`;
        }
        
        cloudflare = spawn(cloudflareCommand, cloudflareArgs, cloudflareOptions);
    }

    let cloudflareOutput = '';
    
    let urlExtracted = false; // Flag to prevent multiple extractions
    
    cloudflare.stdout.on('data', (data) => {
        const output = data.toString();
        cloudflareOutput += output;
        process.stdout.write(output);
        
        // Try to extract URL from Cloudflare output
        // Cloudflare outputs: https://random-name.trycloudflare.com
        // Also check for URLs in different formats
        if (!urlExtracted) {
            const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
            if (urlMatch && urlMatch.length > 0) {
                urlExtracted = true;
                const cloudflareUrl = urlMatch[0];
                const miniAppUrl = `${cloudflareUrl}/TGminiapp.html`;
                
                console.log('\n' + '='.repeat(60));
                console.log('✅ CLOUDFLARE TUNNEL READY!');
                console.log('='.repeat(60));
                console.log('\n📱 Mini App URL для BotFather:');
                console.log(`\n   ${miniAppUrl}\n`);
                console.log('📋 Скопируйте этот URL и отправьте BotFather');
                console.log('='.repeat(60) + '\n');
                
                // Save URL to file
                const urlFile = path.join(__dirname, 'cloudflare-url.txt');
                fs.writeFileSync(urlFile, miniAppUrl);
                console.log(`💾 URL сохранен в файл: cloudflare-url.txt\n`);
            }
        }
    });

    cloudflare.stderr.on('data', (data) => {
        const output = data.toString();
        process.stderr.write(output);
        
        // Cloudflare sometimes outputs URL to stderr
        if (!urlExtracted) {
            const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
            if (urlMatch && urlMatch.length > 0) {
                urlExtracted = true;
                const cloudflareUrl = urlMatch[0];
                const miniAppUrl = `${cloudflareUrl}/TGminiapp.html`;
                
                console.log('\n' + '='.repeat(60));
                console.log('✅ CLOUDFLARE TUNNEL READY!');
                console.log('='.repeat(60));
                console.log('\n📱 Mini App URL для BotFather:');
                console.log(`\n   ${miniAppUrl}\n`);
                console.log('📋 Скопируйте этот URL и отправьте BotFather');
                console.log('='.repeat(60) + '\n');
                
                // Save URL to file
                const urlFile = path.join(__dirname, 'cloudflare-url.txt');
                fs.writeFileSync(urlFile, miniAppUrl);
                console.log(`💾 URL сохранен в файл: cloudflare-url.txt\n`);
            }
        }
    });

    cloudflare.on('error', (err) => {
        console.error(`\n❌ Failed to start Cloudflare Tunnel: ${err.message}`);
        if (err.code === 'ENOENT') {
            console.log('\n💡 Cloudflared не найден в системе');
            console.log('   Скачайте с: https://github.com/cloudflare/cloudflared/releases');
            console.log('   Или установите через npm: npm install -g cloudflared');
            console.log(`   Искали по пути: ${CLOUDFLARE_PATH}\n`);
        } else {
            console.log(`\n💡 Ошибка: ${err.message}\n`);
        }
    });

    cloudflare.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n❌ Cloudflare Tunnel exited with code ${code}`);
            console.log('\n💡 Убедитесь, что cloudflared установлен и доступен в PATH');
            console.log('   Скачайте с: https://github.com/cloudflare/cloudflared/releases');
            console.log('   Или установите через npm: npm install -g cloudflared\n');
        }
    });

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping Cloudflare Tunnel and server...');
        cloudflare.kill();
        server.kill();
        process.exit();
    });

}

server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
