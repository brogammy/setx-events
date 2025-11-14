#!/usr/bin/env python3
import http.server
import socketserver
import os
from pathlib import Path

PORT = 8081
PUBLIC_DIR = Path(__file__).parent

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Get the original path translation
        translated = super().translate_path(path)

        # Handle dynamic routes: /venue/123 -> venue.html, /event/45 -> event.html
        path_parts = [p for p in path.strip('/').split('/') if p]  # Filter out empty strings

        # Check for single-level routes like /venue, /event, /dashboard
        if len(path_parts) == 1:
            # Route like /venues -> venues.html
            single_file = path_parts[0] + '.html'
            single_path = os.path.join(str(PUBLIC_DIR), single_file)
            if os.path.exists(single_path):
                return single_path

        # Check for parameterized routes like /venue/1, /event/5
        if len(path_parts) >= 2:
            base = path_parts[0]
            # Check if second part is a number (ID)
            if path_parts[1].isdigit():
                html_file = base + '.html'
                html_path = os.path.join(str(PUBLIC_DIR), html_file)
                if os.path.exists(html_path):
                    return html_path

        # If the requested path is a directory or doesn't exist, try adding .html
        if path.endswith('/'):
            # Try index.html first
            index_path = os.path.join(translated, 'index.html')
            if os.path.exists(index_path):
                return index_path

        # If file doesn't exist, try adding .html extension
        if not os.path.exists(translated) and not translated.endswith('.html'):
            html_path = translated + '.html'
            if os.path.exists(html_path):
                return html_path

        return translated

    def end_headers(self):
        # Add CORS headers for API requests
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(str(PUBLIC_DIR))
    
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print(f"Serving from: {PUBLIC_DIR}")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")
