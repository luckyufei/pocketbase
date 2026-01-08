package runtime

import (
	"context"
	"testing"
	"time"
)

// T005-T008: WASM 引擎核心测试

func TestEngine(t *testing.T) {
	t.Run("创建引擎实例", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		if engine == nil {
			t.Fatal("engine 不应为 nil")
		}
	})

	t.Run("加载 QuickJS WASM 模块", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		if !engine.IsReady() {
			t.Error("引擎应该处于就绪状态")
		}
	})

	t.Run("执行简单 JS 代码", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		ctx := context.Background()
		result, err := engine.Execute(ctx, "1 + 2", DefaultRuntimeConfig())
		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if result.Value != "3" {
			t.Errorf("Execute() = %v, want 3", result.Value)
		}
	})

	t.Run("执行带返回值的函数", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		ctx := context.Background()
		code := `
			function add(a, b) { return a + b; }
			add(10, 20);
		`
		result, err := engine.Execute(ctx, code, DefaultRuntimeConfig())
		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if result.Value != "30" {
			t.Errorf("Execute() = %v, want 30", result.Value)
		}
	})

	t.Run("执行超时控制", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		ctx := context.Background()
		cfg := RuntimeConfig{
			MaxMemory:       128 * 1024 * 1024,
			Timeout:         100 * time.Millisecond, // 100ms 超时
			MaxInstructions: 100_000_000,
		}

		// 死循环代码
		code := `while(true) {}`
		_, err = engine.Execute(ctx, code, cfg)
		if err == nil {
			t.Error("死循环应该超时")
		}
	})

	t.Run("console.log 捕获", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		ctx := context.Background()
		code := `console.log("hello", "world"); 42;`
		result, err := engine.Execute(ctx, code, DefaultRuntimeConfig())
		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if len(result.Logs) == 0 {
			t.Error("应该捕获 console.log 输出")
		}
		if result.Value != "42" {
			t.Errorf("Execute() = %v, want 42", result.Value)
		}
	})
}

func TestEngineError(t *testing.T) {
	t.Run("语法错误", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		ctx := context.Background()
		code := `function { invalid }`
		_, err = engine.Execute(ctx, code, DefaultRuntimeConfig())
		if err == nil {
			t.Error("语法错误应返回 error")
		}
	})

	t.Run("运行时错误", func(t *testing.T) {
		engine, err := NewEngine()
		if err != nil {
			t.Fatalf("NewEngine() error = %v", err)
		}
		defer engine.Close()

		ctx := context.Background()
		code := `throw new Error("test error");`
		_, err = engine.Execute(ctx, code, DefaultRuntimeConfig())
		if err == nil {
			t.Error("throw 应返回 error")
		}
	})
}
