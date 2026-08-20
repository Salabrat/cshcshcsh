#!/usr/bin/env python3
"""
API сервер для синхронизации miniapp с БД бота
Запускается на порту 5000
"""

import sqlite3
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os

DB_PATH = "database.db"

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # CORS headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        
        try:
            if path == '/api/themes':
                self.get_themes()
            elif path == '/api/brands':
                self.get_themes()  # brands и themes - одно и то же
            elif path == '/api/categories':
                self.get_categories()
            elif path == '/api/products':
                self.get_products()
            elif path == '/api/hero-content':
                self.get_hero_content()
            elif path == '/api/telegram/design-settings':
                self.get_design_settings()
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
    
    def get_themes(self):
        """Получить темы из БД (type='theme')"""
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, name, photo_id, description, position
                FROM catalog_items 
                WHERE type = 'theme' AND is_visible = 1
                ORDER BY position ASC
            ''')
            
            themes = []
            for row in cursor.fetchall():
                theme = {
                    "id": row['id'],
                    "name": row['name'],
                    "logo": row['photo_id'] if row['photo_id'] else "",
                    "description": row['description'] or "",
                    "isActive": True
                }
                themes.append(theme)
            
            conn.close()
            
            response = {"brands": themes}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            print(f"Error getting themes: {e}")
            self.wfile.write(json.dumps({"brands": []}).encode('utf-8'))
    
    def get_categories(self):
        """Получить категории из БД (type='category')"""
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, parent_id, name, photo_id, description, position
                FROM catalog_items 
                WHERE type = 'category' AND is_visible = 1
                ORDER BY position ASC
            ''')
            
            categories = []
            for row in cursor.fetchall():
                category = {
                    "id": row['id'],
                    "parent_id": row['parent_id'],
                    "name": row['name'],
                    "photo_id": row['photo_id'] if row['photo_id'] else "",
                    "description": row['description'] or "",
                    "position": row['position']
                }
                categories.append(category)
            
            conn.close()
            self.wfile.write(json.dumps({"categories": categories}, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            print(f"Error getting categories: {e}")
            self.wfile.write(json.dumps({"categories": []}).encode('utf-8'))
    
    def get_products(self):
        """Получить товары из БД (type='product')"""
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT ci.id, ci.parent_id, ci.name, ci.photo_id, ci.description, ci.position,
                       pp.price, pp.currency, pp.expiration_days
                FROM catalog_items ci
                LEFT JOIN product_prices pp ON ci.id = pp.product_id
                WHERE ci.type = 'product' AND ci.is_visible = 1
                ORDER BY ci.position ASC
            ''')
            
            products = []
            for row in cursor.fetchall():
                product = {
                    "id": row['id'],
                    "parent_id": row['parent_id'],
                    "name": row['name'],
                    "photo_id": row['photo_id'] if row['photo_id'] else "",
                    "description": row['description'] or "",
                    "price": row['price'] if row['price'] else 0,
                    "currency": row['currency'] if row['currency'] else 'RUB',
                    "expiration_days": row['expiration_days'] or ""
                }
                products.append(product)
            
            conn.close()
            self.wfile.write(json.dumps({"products": products}, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            print(f"Error getting products: {e}")
            self.wfile.write(json.dumps({"products": []}).encode('utf-8'))
    
    def get_hero_content(self):
        """Получить hero контент (заглушка)"""
        hero_content = {
            "title": "🛍 StreetSoft Catalog",
            "subtitle": "Лучшие товары по лучшим ценам",
            "buttonText": "🛒 Перейти к каталогу",
            "buttonLink": "#catalog",
            "mediaType": "image",
            "backgroundImage": "",
            "backgroundVideo": ""
        }
        self.wfile.write(json.dumps(hero_content, ensure_ascii=False).encode('utf-8'))
    
    def get_design_settings(self):
        """Получить дизайн настройки (заглушка)"""
        settings = {
            "logoImages": [],
            "loadingScreenImage": "",
            "primaryColor": "#0088cc",
            "backgroundColor": "#ffffff"
        }
        self.wfile.write(json.dumps(settings, ensure_ascii=False).encode('utf-8'))

def run_server():
    PORT = 5000
    server = HTTPServer(('localhost', PORT), APIHandler)
    print(f"🚀 API Server running on http://localhost:{PORT}")
    print(f"📋 Available endpoints:")
    print(f"   - GET /api/themes")
    print(f"   - GET /api/categories") 
    print(f"   - GET /api/products")
    print(f"📁 Database: {DB_PATH}")
    server.serve_forever()

if __name__ == "__main__":
    run_server()