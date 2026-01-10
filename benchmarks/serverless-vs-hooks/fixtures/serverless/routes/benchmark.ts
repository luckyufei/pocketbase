// Serverless HTTP Handler 性能测试代码
// 放置到 pb_serverless/routes/benchmark.ts

import { pb, HttpRequest, HttpResponse } from '@pocketbase/sdk';

// ============================================================================
// S1: HTTP Handler 测试
// ============================================================================

export async function GET_hello(req: HttpRequest): Promise<HttpResponse> {
    return {
        status: 200,
        body: JSON.stringify({
            message: "Hello from serverless",
            timestamp: Date.now(),
            runtime: "serverless"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    };
}

// ============================================================================
// S3: 计算密集型测试 - 斐波那契
// ============================================================================

function fib(n: number): number {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}

export async function GET_fib(req: HttpRequest): Promise<HttpResponse> {
    const url = new URL(req.url, 'http://localhost');
    const n = parseInt(url.searchParams.get('n') || '20');
    
    const start = Date.now();
    const result = fib(n);
    const elapsed = Date.now() - start;
    
    return {
        status: 200,
        body: JSON.stringify({
            n,
            result,
            elapsed_ms: elapsed,
            runtime: "serverless"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    };
}

// ============================================================================
// S4: I/O 密集型测试 - 数据库查询
// ============================================================================

export async function GET_query(req: HttpRequest): Promise<HttpResponse> {
    const url = new URL(req.url, 'http://localhost');
    const count = parseInt(url.searchParams.get('count') || '1');
    const results: number[] = [];
    
    for (let i = 0; i < count; i++) {
        try {
            const records = await pb.collection('benchmark_data').getList(1, 1, {
                sort: '-created'
            });
            results.push(records.items.length);
        } catch (err) {
            results.push(0);
        }
    }
    
    return {
        status: 200,
        body: JSON.stringify({
            count,
            results,
            runtime: "serverless"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    };
}

// ============================================================================
// S5: 内存压力测试
// ============================================================================

export async function GET_memory(req: HttpRequest): Promise<HttpResponse> {
    const url = new URL(req.url, 'http://localhost');
    const sizeMB = parseInt(url.searchParams.get('size') || '1');
    const sizeBytes = sizeMB * 1024 * 1024;
    
    try {
        // 分配大数组
        const arr = new Array(Math.floor(sizeBytes / 8));
        for (let i = 0; i < arr.length; i++) {
            arr[i] = i;
        }
        
        return {
            status: 200,
            body: JSON.stringify({
                size_mb: sizeMB,
                allocated: true,
                length: arr.length,
                runtime: "serverless"
            }),
            headers: {
                "Content-Type": "application/json"
            }
        };
    } catch (err: any) {
        return {
            status: 500,
            body: JSON.stringify({
                size_mb: sizeMB,
                allocated: false,
                error: err.message,
                runtime: "serverless"
            }),
            headers: {
                "Content-Type": "application/json"
            }
        };
    }
}

// ============================================================================
// S7: 错误恢复测试
// ============================================================================

export async function GET_error(req: HttpRequest): Promise<HttpResponse> {
    const url = new URL(req.url, 'http://localhost');
    const errorType = url.searchParams.get('type') || 'none';
    
    switch (errorType) {
        case 'syntax_error':
            // 语法错误在编译时检测
            return {
                status: 200,
                body: JSON.stringify({
                    type: 'syntax_error',
                    handled: true,
                    note: '语法错误在加载时检测',
                    runtime: 'serverless'
                }),
                headers: { "Content-Type": "application/json" }
            };
            
        case 'runtime_error':
            // 运行时错误 - serverless 会捕获并返回错误
            const obj: any = undefined;
            return {
                status: 200,
                body: JSON.stringify({ value: obj.property })
            };
            
        case 'infinite_loop':
            // 死循环 - serverless 有超时控制，会被终止
            while (true) {
                // 无限循环
            }
            
        case 'stack_overflow':
            // 栈溢出
            function recurse(): number { return recurse(); }
            return {
                status: 200,
                body: JSON.stringify({ result: recurse() })
            };
            
        case 'memory_overflow':
            // 内存溢出 - serverless 有内存限制
            const arr: number[][] = [];
            while (true) {
                arr.push(new Array(1000000));
            }
            
        default:
            return {
                status: 200,
                body: JSON.stringify({
                    type: errorType,
                    handled: true,
                    runtime: 'serverless'
                }),
                headers: { "Content-Type": "application/json" }
            };
    }
}
