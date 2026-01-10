// Package serverlessvshooks 提供 serverless (QuickJS) 与 jsvm (Goja) 的性能对比测试
package serverlessvshooks

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/dop251/goja"
)

// =============================================================================
// 测试场景 1: 简单函数调用 (Hello World)
// =============================================================================

func BenchmarkSimpleCall_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function hello(name) {
			return "Hello, " + name + "!";
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	hello, _ := goja.AssertFunction(vm.Get("hello"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := hello(goja.Undefined(), vm.ToValue("World"))
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSimpleCall_Goja_WithPool(b *testing.B) {
	// Goja VM 不是线程安全的，每个 goroutine 需要独立的 VM
	// 使用 sync.Pool 来复用 VM
	pool := sync.Pool{
		New: func() interface{} {
			vm := goja.New()
			_, _ = vm.RunString(`
				function hello(name) {
					return "Hello, " + name + "!";
				}
			`)
			return vm
		},
	}

	// 预热池
	for i := 0; i < 10; i++ {
		pool.Put(pool.New())
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			vm := pool.Get().(*goja.Runtime)
			hello, _ := goja.AssertFunction(vm.Get("hello"))
			_, _ = hello(goja.Undefined(), vm.ToValue("World"))
			pool.Put(vm)
		}
	})
}

// =============================================================================
// 测试场景 2: 计算密集型 (斐波那契)
// =============================================================================

func BenchmarkFibonacci_Goja(b *testing.B) {
	benchmarks := []struct {
		name string
		n    int
	}{
		{"Fib10", 10},
		{"Fib20", 20},
		{"Fib25", 25},
		{"Fib30", 30},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			vm := goja.New()
			_, err := vm.RunString(`
				function fib(n) {
					if (n <= 1) return n;
					return fib(n - 1) + fib(n - 2);
				}
			`)
			if err != nil {
				b.Fatal(err)
			}

			fib, _ := goja.AssertFunction(vm.Get("fib"))

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := fib(goja.Undefined(), vm.ToValue(bm.n))
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// =============================================================================
// 测试场景 3: JSON 处理
// =============================================================================

func BenchmarkJSONParse_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function parseJSON(str) {
			return JSON.parse(str);
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	parseJSON, _ := goja.AssertFunction(vm.Get("parseJSON"))
	testJSON := `{"name":"test","value":123,"nested":{"a":1,"b":2},"array":[1,2,3,4,5]}`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := parseJSON(goja.Undefined(), vm.ToValue(testJSON))
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJSONStringify_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		var testObj = {name:"test",value:123,nested:{a:1,b:2},array:[1,2,3,4,5]};
		function stringifyJSON() {
			return JSON.stringify(testObj);
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	stringify, _ := goja.AssertFunction(vm.Get("stringifyJSON"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := stringify(goja.Undefined())
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// 测试场景 4: 字符串处理
// =============================================================================

func BenchmarkStringConcat_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function concatStrings(count) {
			var result = "";
			for (var i = 0; i < count; i++) {
				result += "item" + i + ",";
			}
			return result;
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	concat, _ := goja.AssertFunction(vm.Get("concatStrings"))

	benchmarks := []struct {
		name  string
		count int
	}{
		{"Concat100", 100},
		{"Concat1000", 1000},
		{"Concat10000", 10000},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := concat(goja.Undefined(), vm.ToValue(bm.count))
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkRegex_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		var emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		function validateEmail(email) {
			return emailRegex.test(email);
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	validate, _ := goja.AssertFunction(vm.Get("validateEmail"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := validate(goja.Undefined(), vm.ToValue("test@example.com"))
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// 测试场景 5: 数组操作
// =============================================================================

func BenchmarkArrayMap_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		var arr = [];
		for (var i = 0; i < 1000; i++) arr.push(i);
		
		function mapArray() {
			return arr.map(function(x) { return x * 2; });
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	mapFn, _ := goja.AssertFunction(vm.Get("mapArray"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := mapFn(goja.Undefined())
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkArrayFilter_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		var arr = [];
		for (var i = 0; i < 1000; i++) arr.push(i);
		
		function filterArray() {
			return arr.filter(function(x) { return x % 2 === 0; });
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	filter, _ := goja.AssertFunction(vm.Get("filterArray"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := filter(goja.Undefined())
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkArrayReduce_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		var arr = [];
		for (var i = 0; i < 1000; i++) arr.push(i);
		
		function reduceArray() {
			return arr.reduce(function(acc, x) { return acc + x; }, 0);
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	reduce, _ := goja.AssertFunction(vm.Get("reduceArray"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := reduce(goja.Undefined())
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkArraySort_Goja(b *testing.B) {
	vm := goja.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// 每次创建新数组避免已排序的影响
		_, err := vm.RunString(`
			var arr = [];
			for (var i = 0; i < 1000; i++) arr.push(Math.random());
			arr.sort(function(a, b) { return a - b; });
		`)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// 测试场景 6: 对象操作
// =============================================================================

func BenchmarkObjectCreate_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function createObjects(count) {
			var result = [];
			for (var i = 0; i < count; i++) {
				result.push({
					id: i,
					name: "item" + i,
					value: i * 10,
					nested: { a: i, b: i * 2 }
				});
			}
			return result;
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	create, _ := goja.AssertFunction(vm.Get("createObjects"))

	benchmarks := []struct {
		name  string
		count int
	}{
		{"Create100", 100},
		{"Create1000", 1000},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := create(goja.Undefined(), vm.ToValue(bm.count))
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// =============================================================================
// 测试场景 7: 闭包和作用域
// =============================================================================

func BenchmarkClosure_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function createCounter() {
			var count = 0;
			return function() {
				return ++count;
			};
		}
		var counter = createCounter();
	`)
	if err != nil {
		b.Fatal(err)
	}

	counter, _ := goja.AssertFunction(vm.Get("counter"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := counter(goja.Undefined())
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// 测试场景 8: 异常处理
// =============================================================================

func BenchmarkTryCatch_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function safeDivide(a, b) {
			try {
				if (b === 0) throw new Error("Division by zero");
				return a / b;
			} catch (e) {
				return 0;
			}
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	divide, _ := goja.AssertFunction(vm.Get("safeDivide"))

	b.Run("NoException", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_, err := divide(goja.Undefined(), vm.ToValue(10), vm.ToValue(2))
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("WithException", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_, err := divide(goja.Undefined(), vm.ToValue(10), vm.ToValue(0))
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

// =============================================================================
// 测试场景 9: VM 创建开销
// =============================================================================

func BenchmarkVMCreation_Goja(b *testing.B) {
	b.Run("CreateOnly", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = goja.New()
		}
	})

	b.Run("CreateAndRunSimple", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			vm := goja.New()
			_, _ = vm.RunString(`1 + 1`)
		}
	})

	b.Run("CreateAndRunComplex", func(b *testing.B) {
		code := `
			function fib(n) {
				if (n <= 1) return n;
				return fib(n - 1) + fib(n - 2);
			}
			fib(10);
		`
		for i := 0; i < b.N; i++ {
			vm := goja.New()
			_, _ = vm.RunString(code)
		}
	})
}

// =============================================================================
// 测试场景 10: 并发性能
// =============================================================================

func BenchmarkConcurrent_Goja(b *testing.B) {
	concurrencyLevels := []int{1, 10, 50, 100}

	for _, concurrency := range concurrencyLevels {
		b.Run(fmt.Sprintf("Concurrent%d", concurrency), func(b *testing.B) {
			// Goja VM 不是线程安全的，使用 sync.Pool
			pool := sync.Pool{
				New: func() interface{} {
					vm := goja.New()
					_, _ = vm.RunString(`
						function process(data) {
							var result = 0;
							for (var i = 0; i < 100; i++) {
								result += data * i;
							}
							return result;
						}
					`)
					return vm
				},
			}

			// 预热池
			for i := 0; i < concurrency; i++ {
				pool.Put(pool.New())
			}

			b.ResetTimer()
			b.SetParallelism(concurrency / runtime.GOMAXPROCS(0))
			b.RunParallel(func(pb *testing.PB) {
				for pb.Next() {
					vm := pool.Get().(*goja.Runtime)
					process, _ := goja.AssertFunction(vm.Get("process"))
					_, _ = process(goja.Undefined(), vm.ToValue(42))
					pool.Put(vm)
				}
			})
		})
	}
}

// =============================================================================
// 测试场景 11: 内存分配
// =============================================================================

func BenchmarkMemoryAllocation_Goja(b *testing.B) {
	vm := goja.New()
	_, err := vm.RunString(`
		function allocateMemory(sizeMB) {
			var arr = [];
			var count = sizeMB * 1024 * 1024 / 8; // 每个数字约 8 字节
			for (var i = 0; i < count; i++) {
				arr.push(i);
			}
			return arr.length;
		}
	`)
	if err != nil {
		b.Fatal(err)
	}

	allocate, _ := goja.AssertFunction(vm.Get("allocateMemory"))

	benchmarks := []struct {
		name   string
		sizeMB int
	}{
		{"Alloc1MB", 1},
		{"Alloc5MB", 5},
		{"Alloc10MB", 10},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := allocate(goja.Undefined(), vm.ToValue(bm.sizeMB))
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// =============================================================================
// 测试场景 12: 超时控制
// =============================================================================

func BenchmarkTimeout_Goja(b *testing.B) {
	b.Run("WithTimeout", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			vm := goja.New()

			// 设置超时
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			vm.SetFieldNameMapper(goja.TagFieldNameMapper("json", true))

			// 在另一个 goroutine 中监控超时
			done := make(chan struct{})
			go func() {
				select {
				case <-ctx.Done():
					vm.Interrupt("timeout")
				case <-done:
				}
			}()

			_, _ = vm.RunString(`
				var sum = 0;
				for (var i = 0; i < 1000; i++) {
					sum += i;
				}
				sum;
			`)

			close(done)
			cancel()
		}
	})
}

// =============================================================================
// 综合测试：模拟真实场景
// =============================================================================

func BenchmarkRealWorld_Goja(b *testing.B) {
	b.Run("HTTPHandler", func(b *testing.B) {
		vm := goja.New()
		_, err := vm.RunString(`
			function handleRequest(req) {
				// 解析请求
				var data = JSON.parse(req);
				
				// 处理业务逻辑
				var result = {
					status: "ok",
					data: {
						id: data.id,
						processed: true,
						timestamp: Date.now()
					}
				};
				
				// 返回响应
				return JSON.stringify(result);
			}
		`)
		if err != nil {
			b.Fatal(err)
		}

		handle, _ := goja.AssertFunction(vm.Get("handleRequest"))
		testReq := `{"id": 123, "action": "process"}`

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, err := handle(goja.Undefined(), vm.ToValue(testReq))
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("DataTransform", func(b *testing.B) {
		vm := goja.New()
		_, err := vm.RunString(`
			function transformData(records) {
				return records.map(function(r) {
					return {
						id: r.id,
						fullName: r.firstName + " " + r.lastName,
						email: r.email.toLowerCase(),
						age: new Date().getFullYear() - r.birthYear,
						active: r.status === "active"
					};
				}).filter(function(r) {
					return r.active && r.age >= 18;
				}).sort(function(a, b) {
					return a.fullName.localeCompare(b.fullName);
				});
			}
		`)
		if err != nil {
			b.Fatal(err)
		}

		transform, _ := goja.AssertFunction(vm.Get("transformData"))

		// 创建测试数据
		records := make([]map[string]interface{}, 100)
		for i := 0; i < 100; i++ {
			records[i] = map[string]interface{}{
				"id":        i,
				"firstName": fmt.Sprintf("First%d", i),
				"lastName":  fmt.Sprintf("Last%d", i),
				"email":     fmt.Sprintf("USER%d@EXAMPLE.COM", i),
				"birthYear": 1980 + (i % 40),
				"status":    []string{"active", "inactive"}[i%2],
			}
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, err := transform(goja.Undefined(), vm.ToValue(records))
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("Validation", func(b *testing.B) {
		vm := goja.New()
		_, err := vm.RunString(`
			function validate(data) {
				var errors = [];
				
				if (!data.name || data.name.length < 2) {
					errors.push("Name must be at least 2 characters");
				}
				
				if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
					errors.push("Invalid email format");
				}
				
				if (typeof data.age !== "number" || data.age < 0 || data.age > 150) {
					errors.push("Age must be between 0 and 150");
				}
				
				if (data.tags && !Array.isArray(data.tags)) {
					errors.push("Tags must be an array");
				}
				
				return {
					valid: errors.length === 0,
					errors: errors
				};
			}
		`)
		if err != nil {
			b.Fatal(err)
		}

		validate, _ := goja.AssertFunction(vm.Get("validate"))
		testData := map[string]interface{}{
			"name":  "Test User",
			"email": "test@example.com",
			"age":   25,
			"tags":  []string{"tag1", "tag2"},
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, err := validate(goja.Undefined(), vm.ToValue(testData))
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}
