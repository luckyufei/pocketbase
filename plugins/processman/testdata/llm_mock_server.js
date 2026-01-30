#!/usr/bin/env node
/**
 * LLM API Mock Server (Node.js) - 模拟 OpenAI 兼容的 API 接口
 * 用于测试 AI Agent 场景下的进程管理
 */

const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.LLM_PORT || '9201', 10);
const MODEL_NAME = process.env.MODEL_NAME || 'mock-gpt-4-node';

function generateId(prefix = 'cmpl') {
    return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    console.log(`[LLM] ${req.method} ${url.pathname}`);
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
        if (req.method === 'GET') {
            if (url.pathname === '/health') {
                res.writeHead(200);
                res.end(JSON.stringify({ status: 'healthy', model: MODEL_NAME, runtime: 'node' }));
            } else if (url.pathname === '/v1/models') {
                res.writeHead(200);
                res.end(JSON.stringify({
                    object: 'list',
                    data: [{ id: MODEL_NAME, object: 'model', owned_by: 'mock-node' }]
                }));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'not found' }));
            }
        } else if (req.method === 'POST') {
            const body = await parseBody(req);
            
            if (url.pathname === '/v1/chat/completions') {
                const messages = body.messages || [];
                const stream = body.stream || false;
                
                // 获取最后一条用户消息
                let userMsg = '';
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'user') {
                        userMsg = messages[i].content || '';
                        break;
                    }
                }
                
                const responseText = `Mock Node.js response to: ${userMsg.substring(0, 50)}...`;
                
                if (stream) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.writeHead(200);
                    
                    const words = responseText.split(' ');
                    for (const word of words) {
                        const chunk = {
                            id: generateId('chatcmpl'),
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: MODEL_NAME,
                            choices: [{
                                index: 0,
                                delta: { content: word + ' ' },
                                finish_reason: null
                            }]
                        };
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        await new Promise(r => setTimeout(r, 50));
                    }
                    
                    const finalChunk = {
                        id: generateId('chatcmpl'),
                        object: 'chat.completion.chunk',
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                    };
                    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        id: generateId('chatcmpl'),
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: MODEL_NAME,
                        choices: [{
                            index: 0,
                            message: { role: 'assistant', content: responseText },
                            finish_reason: 'stop'
                        }],
                        usage: {
                            prompt_tokens: Math.floor(userMsg.length / 4),
                            completion_tokens: Math.floor(responseText.length / 4),
                            total_tokens: Math.floor((userMsg.length + responseText.length) / 4)
                        }
                    }));
                }
            } else if (url.pathname === '/v1/completions') {
                const prompt = body.prompt || '';
                const responseText = `Node.js completion for: ${prompt.substring(0, 50)}...`;
                
                res.writeHead(200);
                res.end(JSON.stringify({
                    id: generateId('cmpl'),
                    object: 'text_completion',
                    created: Math.floor(Date.now() / 1000),
                    model: MODEL_NAME,
                    choices: [{
                        text: responseText,
                        index: 0,
                        finish_reason: 'stop'
                    }]
                }));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'not found' }));
            }
        } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'method not allowed' }));
        }
    } catch (e) {
        console.error('[LLM] Error:', e);
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[LLM] Starting mock LLM server on port ${PORT}`);
    console.log(`[LLM] Model: ${MODEL_NAME}, PID: ${process.pid}`);
    console.log(`[LLM] Server ready at http://127.0.0.1:${PORT}`);
    console.log(`[LLM] Endpoints: /health, /v1/models, /v1/chat/completions, /v1/completions`);
});

// 处理信号
process.on('SIGTERM', () => {
    console.log('[LLM] Received SIGTERM');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('[LLM] Received SIGINT');
    server.close(() => process.exit(0));
});
