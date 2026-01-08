// 示例: RAG (Retrieval-Augmented Generation) Handler
// 路由: POST /api/pb_serverless/rag

export async function POST(req: Request): Promise<Response> {
    const { query } = await req.json();
    
    const apiKey = pb.secrets.get('OPENAI_API_KEY');
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 1. 生成查询向量
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query
        })
    });
    const { data } = await embeddingRes.json();
    const queryVector = data[0].embedding;
    
    // 2. 向量搜索
    const docs = await pb.collection('documents').vectorSearch({
        vector: queryVector,
        field: 'embedding',
        filter: 'status = "published"',
        top: 5
    });
    
    // 3. 构建上下文
    const context = docs.map(d => d.content).join('\n\n');
    
    // 4. 生成回答
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: `Answer based on context:\n${context}` },
                { role: 'user', content: query }
            ]
        })
    });
    
    const { choices } = await chatRes.json();
    return new Response(JSON.stringify({ 
        answer: choices[0].message.content,
        sources: docs.map(d => ({ id: d.id, title: d.title }))
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
