// Package serverlessvshooks 提供 serverless (QuickJS) 与 jsvm (Goja) 的对比基准测试
package serverlessvshooks

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime/quickjs"
)

// =============================================================================
// 对比测试：简单函数调用
// =============================================================================

func BenchmarkComparison_SimpleCall(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`function hello(name) { return "Hello, " + name + "!"; }`)
		hello, _ := goja.AssertFunction(vm.Get("hello"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = hello(goja.Undefined(), vm.ToValue("World"))
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			function hello(name) { return "Hello, " + name + "!"; }
			hello("World");
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：计算密集型（斐波那契）
// =============================================================================

func BenchmarkComparison_Fibonacci(b *testing.B) {
	fibCode := `
		function fib(n) {
			if (n <= 1) return n;
			return fib(n - 1) + fib(n - 2);
		}
		fib(15);
	`

	b.Run("Goja_Fib15", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`function fib(n) { if (n <= 1) return n; return fib(n - 1) + fib(n - 2); }`)
		fib, _ := goja.AssertFunction(vm.Get("fib"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = fib(goja.Undefined(), vm.ToValue(15))
		}
	})

	b.Run("QuickJS_Fib15", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, fibCode, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：JSON 处理
// =============================================================================

func BenchmarkComparison_JSONParse(b *testing.B) {
	testJSON := `{"name":"test","value":123,"nested":{"a":1,"b":2},"array":[1,2,3,4,5]}`

	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`function parseJSON(str) { return JSON.parse(str); }`)
		parse, _ := goja.AssertFunction(vm.Get("parseJSON"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = parse(goja.Undefined(), vm.ToValue(testJSON))
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `JSON.parse('{"name":"test","value":123,"nested":{"a":1,"b":2},"array":[1,2,3,4,5]}')`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

func BenchmarkComparison_JSONStringify(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			var obj = {name:"test",value:123,nested:{a:1,b:2},array:[1,2,3,4,5]};
			function stringify() { return JSON.stringify(obj); }
		`)
		stringify, _ := goja.AssertFunction(vm.Get("stringify"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = stringify(goja.Undefined())
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			var obj = {name:"test",value:123,nested:{a:1,b:2},array:[1,2,3,4,5]};
			JSON.stringify(obj);
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：数组操作
// =============================================================================

func BenchmarkComparison_ArrayMap(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			var arr = [];
			for (var i = 0; i < 100; i++) arr.push(i);
			function mapArr() { return arr.map(function(x) { return x * 2; }); }
		`)
		mapFn, _ := goja.AssertFunction(vm.Get("mapArr"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = mapFn(goja.Undefined())
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			var arr = [];
			for (var i = 0; i < 100; i++) arr.push(i);
			arr.map(function(x) { return x * 2; }).length;
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：正则表达式
// =============================================================================

func BenchmarkComparison_Regex(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			var re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
			function validate(email) { return re.test(email); }
		`)
		validate, _ := goja.AssertFunction(vm.Get("validate"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = validate(goja.Undefined(), vm.ToValue("test@example.com"))
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			var re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
			re.test("test@example.com");
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：VM 创建开销
// =============================================================================

func BenchmarkComparison_VMCreation(b *testing.B) {
	b.Run("Goja_CreateOnly", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = goja.New()
		}
	})

	b.Run("QuickJS_CreateOnly", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			rt, err := quickjs.NewRuntime()
			if err != nil {
				b.Skip("QuickJS 运行时不可用")
			}
			rt.Close()
		}
	})

	b.Run("Goja_CreateAndRun", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			vm := goja.New()
			_, _ = vm.RunString(`1 + 1`)
		}
	})

	b.Run("QuickJS_CreateAndRun", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			rt, err := quickjs.NewRuntime()
			if err != nil {
				b.Skip("QuickJS 运行时不可用")
			}
			_, _ = rt.Eval(context.Background(), "1 + 1", quickjs.EvalOptions{})
			rt.Close()
		}
	})
}

// =============================================================================
// 对比测试：并发性能
// =============================================================================

func BenchmarkComparison_Concurrent(b *testing.B) {
	b.Run("Goja_Pool", func(b *testing.B) {
		pool := sync.Pool{
			New: func() interface{} {
				vm := goja.New()
				_, _ = vm.RunString(`function process(x) { var sum = 0; for (var i = 0; i < 100; i++) sum += x * i; return sum; }`)
				return vm
			},
		}

		// 预热
		for i := 0; i < 10; i++ {
			pool.Put(pool.New())
		}

		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				vm := pool.Get().(*goja.Runtime)
				process, _ := goja.AssertFunction(vm.Get("process"))
				_, _ = process(goja.Undefined(), vm.ToValue(42))
				pool.Put(vm)
			}
		})
	})

	b.Run("QuickJS_Pool", func(b *testing.B) {
		pool := sync.Pool{
			New: func() interface{} {
				rt, _ := quickjs.NewRuntime()
				return rt
			},
		}

		// 预热
		for i := 0; i < 10; i++ {
			pool.Put(pool.New())
		}

		code := `
			function process(x) { var sum = 0; for (var i = 0; i < 100; i++) sum += x * i; return sum; }
			process(42);
		`

		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				rt := pool.Get().(*quickjs.Runtime)
				if rt == nil {
					continue
				}
				_, _ = rt.Eval(context.Background(), code, quickjs.EvalOptions{})
				pool.Put(rt)
			}
		})
	})
}

// =============================================================================
// 对比测试：真实场景 - HTTP Handler
// =============================================================================

func BenchmarkComparison_HTTPHandler(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			function handleRequest(req) {
				var data = JSON.parse(req);
				var result = {
					status: "ok",
					data: { id: data.id, processed: true, timestamp: Date.now() }
				};
				return JSON.stringify(result);
			}
		`)
		handle, _ := goja.AssertFunction(vm.Get("handleRequest"))
		testReq := `{"id": 123, "action": "process"}`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = handle(goja.Undefined(), vm.ToValue(testReq))
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			var req = '{"id": 123, "action": "process"}';
			var data = JSON.parse(req);
			var result = {
				status: "ok",
				data: { id: data.id, processed: true, timestamp: Date.now() }
			};
			JSON.stringify(result);
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：数据验证
// =============================================================================

func BenchmarkComparison_Validation(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			function validate(data) {
				var errors = [];
				if (!data.name || data.name.length < 2) errors.push("Name too short");
				if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Invalid email");
				if (typeof data.age !== "number" || data.age < 0) errors.push("Invalid age");
				return { valid: errors.length === 0, errors: errors };
			}
		`)
		validate, _ := goja.AssertFunction(vm.Get("validate"))
		testData := map[string]interface{}{
			"name":  "Test User",
			"email": "test@example.com",
			"age":   25,
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = validate(goja.Undefined(), vm.ToValue(testData))
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			var data = { name: "Test User", email: "test@example.com", age: 25 };
			var errors = [];
			if (!data.name || data.name.length < 2) errors.push("Name too short");
			if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Invalid email");
			if (typeof data.age !== "number" || data.age < 0) errors.push("Invalid age");
			JSON.stringify({ valid: errors.length === 0, errors: errors });
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：超时控制
// =============================================================================

func BenchmarkComparison_Timeout(b *testing.B) {
	b.Run("Goja_WithTimeout", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			vm := goja.New()
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)

			done := make(chan struct{})
			go func() {
				select {
				case <-ctx.Done():
					vm.Interrupt("timeout")
				case <-done:
				}
			}()

			_, _ = vm.RunString(`var sum = 0; for (var i = 0; i < 1000; i++) sum += i; sum;`)
			close(done)
			cancel()
		}
	})

	b.Run("QuickJS_WithTimeout", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			rt, err := quickjs.NewRuntime()
			if err != nil {
				b.Skip("QuickJS 运行时不可用")
			}

			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			_, _ = rt.Eval(ctx, `var sum = 0; for (var i = 0; i < 1000; i++) sum += i; sum;`, quickjs.EvalOptions{})
			cancel()
			rt.Close()
		}
	})
}

// =============================================================================
// 对比测试：异常处理
// =============================================================================

func BenchmarkComparison_ExceptionHandling(b *testing.B) {
	b.Run("Goja_NoException", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			function safeDivide(a, b) {
				try {
					if (b === 0) throw new Error("Division by zero");
					return a / b;
				} catch (e) {
					return 0;
				}
			}
		`)
		divide, _ := goja.AssertFunction(vm.Get("safeDivide"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = divide(goja.Undefined(), vm.ToValue(10), vm.ToValue(2))
		}
	})

	b.Run("Goja_WithException", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			function safeDivide(a, b) {
				try {
					if (b === 0) throw new Error("Division by zero");
					return a / b;
				} catch (e) {
					return 0;
				}
			}
		`)
		divide, _ := goja.AssertFunction(vm.Get("safeDivide"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = divide(goja.Undefined(), vm.ToValue(10), vm.ToValue(0))
		}
	})

	b.Run("QuickJS_NoException", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			function safeDivide(a, b) {
				try {
					if (b === 0) throw new Error("Division by zero");
					return a / b;
				} catch (e) {
					return 0;
				}
			}
			safeDivide(10, 2);
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})

	b.Run("QuickJS_WithException", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			function safeDivide(a, b) {
				try {
					if (b === 0) throw new Error("Division by zero");
					return a / b;
				} catch (e) {
					return 0;
				}
			}
			safeDivide(10, 0);
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：字符串操作
// =============================================================================

func BenchmarkComparison_StringOps(b *testing.B) {
	b.Run("Goja_Concat100", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			function concat(n) {
				var s = "";
				for (var i = 0; i < n; i++) s += "item" + i + ",";
				return s;
			}
		`)
		concat, _ := goja.AssertFunction(vm.Get("concat"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = concat(goja.Undefined(), vm.ToValue(100))
		}
	})

	b.Run("QuickJS_Concat100", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			var s = "";
			for (var i = 0; i < 100; i++) s += "item" + i + ",";
			s.length;
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}

// =============================================================================
// 对比测试：闭包
// =============================================================================

func BenchmarkComparison_Closure(b *testing.B) {
	b.Run("Goja", func(b *testing.B) {
		vm := goja.New()
		_, _ = vm.RunString(`
			function createCounter() {
				var count = 0;
				return function() { return ++count; };
			}
			var counter = createCounter();
		`)
		counter, _ := goja.AssertFunction(vm.Get("counter"))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = counter(goja.Undefined())
		}
	})

	b.Run("QuickJS", func(b *testing.B) {
		rt, err := quickjs.NewRuntime()
		if err != nil {
			b.Skip("QuickJS 运行时不可用")
		}
		defer rt.Close()

		ctx := context.Background()
		code := `
			function createCounter() {
				var count = 0;
				return function() { return ++count; };
			}
			var counter = createCounter();
			counter();
		`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = rt.Eval(ctx, code, quickjs.EvalOptions{})
		}
	})
}
