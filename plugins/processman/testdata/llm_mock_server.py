#!/usr/bin/env python3
"""
LLM API Mock Server - 模拟 OpenAI 兼容的 API 接口
用于测试 AI Agent 场景下的进程管理
"""
import json
import os
import sys
import time
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("LLM_PORT", "9200"))
MODEL_NAME = os.environ.get("MODEL_NAME", "mock-gpt-4")

class LLMHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[LLM] {self.address_string()} - {args[0]}")
        sys.stdout.flush()
    
    def do_GET(self):
        if self.path == "/health":
            self._json_response(200, {"status": "healthy", "model": MODEL_NAME})
        elif self.path == "/v1/models":
            self._json_response(200, {
                "object": "list",
                "data": [
                    {"id": MODEL_NAME, "object": "model", "owned_by": "mock"}
                ]
            })
        else:
            self._json_response(404, {"error": "not found"})
    
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        if self.path == "/v1/chat/completions":
            self._handle_chat_completion(body)
        elif self.path == "/v1/completions":
            self._handle_completion(body)
        else:
            self._json_response(404, {"error": "not found"})
    
    def _handle_chat_completion(self, body):
        try:
            data = json.loads(body)
            messages = data.get("messages", [])
            stream = data.get("stream", False)
            
            # 获取最后一条用户消息
            user_msg = ""
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    user_msg = msg.get("content", "")
                    break
            
            # 生成 mock 响应
            response_text = f"Mock response to: {user_msg[:50]}..."
            
            if stream:
                self._stream_response(response_text)
            else:
                self._json_response(200, {
                    "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": MODEL_NAME,
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": response_text
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": {
                        "prompt_tokens": len(user_msg) // 4,
                        "completion_tokens": len(response_text) // 4,
                        "total_tokens": (len(user_msg) + len(response_text)) // 4
                    }
                })
        except Exception as e:
            self._json_response(400, {"error": str(e)})
    
    def _handle_completion(self, body):
        try:
            data = json.loads(body)
            prompt = data.get("prompt", "")
            
            response_text = f"Completion for: {prompt[:50]}..."
            
            self._json_response(200, {
                "id": f"cmpl-{uuid.uuid4().hex[:8]}",
                "object": "text_completion",
                "created": int(time.time()),
                "model": MODEL_NAME,
                "choices": [{
                    "text": response_text,
                    "index": 0,
                    "finish_reason": "stop"
                }]
            })
        except Exception as e:
            self._json_response(400, {"error": str(e)})
    
    def _stream_response(self, text):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        
        # 模拟流式输出
        words = text.split()
        for i, word in enumerate(words):
            chunk = {
                "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": MODEL_NAME,
                "choices": [{
                    "index": 0,
                    "delta": {"content": word + " "},
                    "finish_reason": None
                }]
            }
            self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
            self.wfile.flush()
            time.sleep(0.05)  # 模拟延迟
        
        # 发送结束标记
        final_chunk = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
            "object": "chat.completion.chunk",
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
        }
        self.wfile.write(f"data: {json.dumps(final_chunk)}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()
    
    def _json_response(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

def main():
    print(f"[LLM] Starting mock LLM server on port {PORT}")
    print(f"[LLM] Model: {MODEL_NAME}, PID: {os.getpid()}")
    sys.stdout.flush()
    
    server = HTTPServer(("127.0.0.1", PORT), LLMHandler)
    print(f"[LLM] Server ready at http://127.0.0.1:{PORT}")
    print(f"[LLM] Endpoints: /health, /v1/models, /v1/chat/completions, /v1/completions")
    sys.stdout.flush()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[LLM] Received shutdown signal")
    finally:
        server.server_close()
        print("[LLM] Server stopped")

if __name__ == "__main__":
    main()
