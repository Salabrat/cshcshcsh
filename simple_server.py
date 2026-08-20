#!/usr/bin/env python3
"""
Максимально простой HTTP сервер для Mini App
"""

import http.server
import socketserver
import os

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '':
            self.path = '/TGMiniapp.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

print(f"Starting server on port {PORT}...")
print(f"Open http://localhost:{PORT} in browser")

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    httpd.serve_forever()