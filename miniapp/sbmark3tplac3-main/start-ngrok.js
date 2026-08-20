// Script to start server with ngrok tunnel
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const NGROK_PATH = process.env.NGROK_PATH || 'ngrok'; // Path to ngrok executable

console.log('🚀 Starting server and ngrok tunnel...\n');

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: true
});

// Wait a bit for server to start
setTimeout(() => {
    console.log('\n📡 Starting ngrok tunnel...\n');
    
    // Start ngrok
    const ngrok = spawn(NGROK_PATH, ['http', PORT.toString()], {
        stdio: 'pipe',
        shell: true
    });

    let ngrokOutput = '';
    
    ngrok.stdout.on('data', (data) => {
        const output = data.toString();
        ngrokOutput += output;
        process.stdout.write(output);
        
        // Try to extract URL from ngrok output
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok\.io/g);
        if (urlMatch && urlMatch.length > 0) {
            const ngrokUrl = urlMatch[0];
            const miniAppUrl = `${ngrokUrl}/TGminiapp.html`;
            
            console.log('\n' + '='.repeat(60));
            console.log('✅ NGROK TUNNEL READY!');
            console.log('='.repeat(60));
            console.log('\n📱 Mini App URL для BotFather:');
            console.log(`\n   ${miniAppUrl}\n`);
            console.log('📋 Скопируйте этот URL и отправьте BotFather');
            console.log('='.repeat(60) + '\n');
            
            // Save URL to file
            const urlFile = path.join(__dirname, 'ngrok-url.txt');
            fs.writeFileSync(urlFile, miniAppUrl);
            console.log(`💾 URL сохранен в файл: ngrok-url.txt\n`);
        }
    });

    ngrok.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    ngrok.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n❌ ngrok exited with code ${code}`);
            console.log('\n💡 Убедитесь, что ngrok установлен и доступен в PATH');
            console.log('   Или укажите путь: NGROK_PATH=/path/to/ngrok node start-ngrok.js\n');
        }
    });

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping ngrok and server...');
        ngrok.kill();
        server.kill();
        process.exit();
    });

}, 2000);

server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
