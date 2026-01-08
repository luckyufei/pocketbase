// 示例: 简单的 HTTP Handler
// 路由: GET /api/pb_serverless/hello

export async function GET(req: Request): Promise<Response> {
    return new Response(JSON.stringify({
        message: "Hello from PocketBase Serverless!",
        timestamp: new Date().toISOString()
    }), {
        headers: { "Content-Type": "application/json" }
    });
}

export async function POST(req: Request): Promise<Response> {
    const body = await req.json();
    
    console.log("Received POST request:", body);
    
    return new Response(JSON.stringify({
        received: body,
        processed: true
    }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
    });
}
