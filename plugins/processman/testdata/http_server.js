#!/usr/bin/env node
/**
 * Node.js HTTP 服务器 - 用于测试 HTTP 服务进程管理
 * 提供健康检查和简单 API 端点
 */

const http = require('http');

const PORT = parseInt(process.env.HTTP_PORT || '9101', 10);

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    console.log(`[HTTP] ${req.method} ${url.pathname}`);
    
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'GET') {
        if (url.pathname === '/health') {
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'healthy', pid: process.pid, runtime: 'node' }));
        } else if (url.pathname === '/info') {
            res.writeHead(200);
            res.end(JSON.stringify({
                service: 'test-http-server',
                pid: process.pid,
                port: PORT,
                runtime: process.version,
                env: process.env
            }));
        } else if (url.pathname === '/shutdown') {
            res.writeHead(200);
            res.end(JSON.stringify({ message: 'shutting down' }));
            setTimeout(() => process.exit(0), 100);
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'not found' }));
        }
    } else {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'method not allowed' }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[HTTP] Starting server on port ${PORT}, PID: ${process.pid}`);
    console.log(`[HTTP] Server ready at http://127.0.0.1:${PORT}`);
});

// 处理信号
process.on('SIGTERM', () => {
    console.log('[HTTP] Received SIGTERM');
    server.close(() => {
        console.log('[HTTP] Server stopped');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[HTTP] Received SIGINT');
    server.close(() => {
        console.log('[HTTP] Server stopped');
        process.exit(0);
    });
});
