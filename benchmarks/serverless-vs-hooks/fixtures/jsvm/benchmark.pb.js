// jsvm Hooks 性能测试代码
// 放置到 pb_hooks/benchmark.pb.js

// ============================================================================
// S1: HTTP Handler 测试
// ============================================================================

routerAdd("GET", "/api/benchmark/jsvm/hello", (e) => {
    return e.json(200, {
        message: "Hello from jsvm",
        timestamp: Date.now(),
        runtime: "jsvm"
    });
});

// ============================================================================
// S3: 计算密集型测试 - 斐波那契
// ============================================================================

function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}

routerAdd("GET", "/api/benchmark/jsvm/fib", (e) => {
    const n = parseInt(e.request.url.query().get("n") || "20");
    const start = Date.now();
    const result = fib(n);
    const elapsed = Date.now() - start;
    
    return e.json(200, {
        n: n,
        result: result,
        elapsed_ms: elapsed,
        runtime: "jsvm"
    });
});

// ============================================================================
// S4: I/O 密集型测试 - 数据库查询
// ============================================================================

routerAdd("GET", "/api/benchmark/jsvm/query", (e) => {
    const count = parseInt(e.request.url.query().get("count") || "1");
    const results = [];
    
    for (let i = 0; i < count; i++) {
        try {
            const records = $app.findRecordsByFilter(
                "benchmark_data",
                "1=1",
                "-created",
                1,
                0
            );
            results.push(records.length);
        } catch (err) {
            results.push(0);
        }
    }
    
    return e.json(200, {
        count: count,
        results: results,
        runtime: "jsvm"
    });
});

// ============================================================================
// S5: 内存压力测试
// ============================================================================

routerAdd("GET", "/api/benchmark/jsvm/memory", (e) => {
    const sizeMB = parseInt(e.request.url.query().get("size") || "1");
    const sizeBytes = sizeMB * 1024 * 1024;
    
    try {
        // 分配大数组
        const arr = new Array(sizeBytes / 8);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = i;
        }
        
        return e.json(200, {
            size_mb: sizeMB,
            allocated: true,
            length: arr.length,
            runtime: "jsvm"
        });
    } catch (err) {
        return e.json(500, {
            size_mb: sizeMB,
            allocated: false,
            error: err.message,
            runtime: "jsvm"
        });
    }
});

// ============================================================================
// S7: 错误恢复测试
// ============================================================================

routerAdd("GET", "/api/benchmark/jsvm/error", (e) => {
    const errorType = e.request.url.query().get("type") || "none";
    
    switch (errorType) {
        case "syntax_error":
            // 语法错误无法在运行时触发，返回模拟结果
            return e.json(200, {
                type: "syntax_error",
                handled: true,
                note: "语法错误在加载时检测",
                runtime: "jsvm"
            });
            
        case "runtime_error":
            // 运行时错误
            const obj = undefined;
            return e.json(200, { value: obj.property });
            
        case "infinite_loop":
            // 死循环 (jsvm 无超时控制，会阻塞)
            // 为安全起见，限制迭代次数
            let i = 0;
            while (i < 1000000) { i++; }
            return e.json(200, {
                type: "infinite_loop",
                iterations: i,
                runtime: "jsvm"
            });
            
        case "stack_overflow":
            // 栈溢出
            function recurse() { return recurse(); }
            return e.json(200, { result: recurse() });
            
        case "memory_overflow":
            // 内存溢出
            const arr = [];
            while (true) {
                arr.push(new Array(1000000));
            }
            
        default:
            return e.json(200, {
                type: errorType,
                handled: true,
                runtime: "jsvm"
            });
    }
});

// ============================================================================
// DB Hook 测试 (需要创建 benchmark_jsvm collection)
// ============================================================================

onRecordCreate((e) => {
    // 简单的字段计算
    const value = e.record.get("value") || 0;
    e.record.set("computed", value * 2);
    e.record.set("processed_at", new Date().toISOString());
    return e.next();
}, "benchmark_jsvm");
