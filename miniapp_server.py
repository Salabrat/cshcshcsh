#!/usr/bin/env python3
"""
Простой HTTP сервер для Telegram Mini App
Запускайте этот сервер отдельно от бота и используйте ngrok для туннелирования
"""

import http.server
import socketserver
import os
import pathlib

PORT = 8000
DIRECTORY = pathlib.Path(__file__).parent

class MiniAppHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Добавляем CORS заголовки для Telegram
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_GET(self):
        # Обслуживаем TGMiniapp.html как главную страницу
        if self.path == '/' or self.path == '':
            self.path = '/TGMiniapp.html'
        return super().do_GET()

def run_server():
    with socketserver.TCPServer(("", PORT), MiniAppHandler) as httpd:
        print(f"🚀 Mini App сервер запущен на порту {PORT}")
        print(f"📁 Директория: {DIRECTORY}")
        print(f"🔗 Локальный URL: http://localhost:{PORT}")
        print(f"📱 Mini App URL: http://localhost:{PORT}/TGMiniapp.html")
        print("\n📝 Для работы с Telegram используйте ngrok:")
        print(f"   ngrok http {PORT}")
        print("\n⚠️ Не забудьте обновить MINIAPP_URL в config.py с вашим ngrok URL")
        print("⚠️ Пример: MINIAPP_URL=https://your-ngrok-url.ngrok-free.app/TGMiniapp.html")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Сервер остановлен")

if __name__ == "__main__":
    run_server()