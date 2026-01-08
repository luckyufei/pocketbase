// 示例: 调用 OpenAI API 的 Chat Handler
// 路由: POST /api/pb_serverless/chat

export async function POST(req: Request): Promise<Response> {
    const { message } = await req.json();
    
    // 读取 Secret
    const apiKey = pb.secrets.get('OPENAI_API_KEY');
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 调用 OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: message }],
            stream: true
        })
    });
    
    // 流式返回
    return new Response(response.body, {
        headers: { 'Content-Type': 'text/event-stream' }
    });
}
