#!/usr/bin/env python3
"""
Python HTTP 服务器 - 用于测试 HTTP 服务进程管理
提供健康检查和简单 API 端点
"""
import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("HTTP_PORT", "9100"))

class SimpleHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # 输出到 stdout 便于日志桥接测试
        print(f"[HTTP] {self.address_string()} - {args[0]}")
    
    def do_GET(self):
        if self.path == "/health":
            self._json_response(200, {"status": "healthy", "pid": os.getpid()})
        elif self.path == "/info":
            self._json_response(200, {
                "service": "test-http-server",
                "pid": os.getpid(),
                "port": PORT,
                "env": dict(os.environ)
            })
        elif self.path == "/shutdown":
            self._json_response(200, {"message": "shutting down"})
            # 延迟关闭，让响应先发出去
            import threading
            threading.Timer(0.1, lambda: os._exit(0)).start()
        else:
            self._json_response(404, {"error": "not found"})
    
    def _json_response(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

def main():
    print(f"[HTTP] Starting server on port {PORT}, PID: {os.getpid()}")
    sys.stdout.flush()
    
    server = HTTPServer(("127.0.0.1", PORT), SimpleHandler)
    print(f"[HTTP] Server ready at http://127.0.0.1:{PORT}")
    sys.stdout.flush()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[HTTP] Received shutdown signal")
    finally:
        server.server_close()
        print("[HTTP] Server stopped")

if __name__ == "__main__":
    main()
