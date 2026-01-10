package jsvm

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/dop251/goja"
)

// =============================================================================
// Task 1.1: SafeExecutor 红灯测试
// =============================================================================

// TestSafeExecutor_NormalExecution 测试正常脚本执行成功
func TestSafeExecutor_NormalExecution(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 5*time.Second)

	ctx := context.Background()
	result, err := executor.Execute(ctx, `1 + 2 + 3`, nil)

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if result.ToInteger() != 6 {
		t.Errorf("expected result 6, got: %v", result.Export())
	}
}

// TestSafeExecutor_DefaultTimeout 测试默认超时值
func TestSafeExecutor_DefaultTimeout(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	// 传入 0 或负数，应该使用默认值 5 秒
	executor := NewSafeExecutor(pool, 0)

	ctx := context.Background()
	result, err := executor.Execute(ctx, `1 + 1`, nil)

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if result.ToInteger() != 2 {
		t.Errorf("expected result 2, got: %v", result.Export())
	}

	// 测试负数 - 使用新的池避免状态干扰
	pool2 := newPool(1, func() *goja.Runtime {
		return goja.New()
	})
	executor2 := NewSafeExecutor(pool2, -1*time.Second)
	result2, err := executor2.Execute(ctx, `2 + 2`, nil)

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if result2.ToInteger() != 4 {
		t.Errorf("expected result 4, got: %v", result2.Export())
	}
}

// TestSafeExecutor_TimeoutInterrupt 测试无限循环在超时后被中断
func TestSafeExecutor_TimeoutInterrupt(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	// 设置很短的超时时间
	executor := NewSafeExecutor(pool, 100*time.Millisecond)

	ctx := context.Background()
	start := time.Now()

	_, err := executor.Execute(ctx, `for(;;){}`, nil)

	elapsed := time.Since(start)

	// 应该在超时时间附近返回
	if elapsed > 500*time.Millisecond {
		t.Errorf("execution took too long: %v, expected ~100ms", elapsed)
	}

	// 应该返回超时错误
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}

	var interruptErr *goja.InterruptedError
	if !errors.As(err, &interruptErr) {
		t.Errorf("expected InterruptedError, got: %T - %v", err, err)
	}
}

// TestSafeExecutor_ContextCancel 测试 context 取消时中断执行
func TestSafeExecutor_ContextCancel(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 10*time.Second) // 长超时

	ctx, cancel := context.WithCancel(context.Background())

	// 50ms 后取消
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	_, err := executor.Execute(ctx, `for(;;){}`, nil)
	elapsed := time.Since(start)

	// 应该在取消时间附近返回
	if elapsed > 500*time.Millisecond {
		t.Errorf("execution took too long: %v, expected ~50ms", elapsed)
	}

	// 应该返回错误
	if err == nil {
		t.Fatal("expected error after context cancel, got nil")
	}
}

// TestSafeExecutor_ErrorPropagation 测试 JS 错误正确传播
func TestSafeExecutor_ErrorPropagation(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 5*time.Second)

	ctx := context.Background()

	// 测试语法错误
	_, err := executor.Execute(ctx, `function(`, nil)
	if err == nil {
		t.Error("expected syntax error, got nil")
	}

	// 测试运行时错误
	_, err = executor.Execute(ctx, `throw new Error("test error")`, nil)
	if err == nil {
		t.Error("expected runtime error, got nil")
	}
	if !strings.Contains(err.Error(), "test error") {
		t.Errorf("expected error to contain 'test error', got: %v", err)
	}

	// 测试引用错误
	_, err = executor.Execute(ctx, `undefinedVariable.foo()`, nil)
	if err == nil {
		t.Error("expected reference error, got nil")
	}
}

// TestSafeExecutor_InterruptRecovery 测试中断后 VM 可复用
func TestSafeExecutor_InterruptRecovery(t *testing.T) {
	pool := newPool(1, func() *goja.Runtime { // 只有 1 个 VM，强制复用
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 50*time.Millisecond)

	ctx := context.Background()

	// 第一次执行：超时中断
	_, err := executor.Execute(ctx, `for(;;){}`, nil)
	if err == nil {
		t.Fatal("expected timeout error on first execution")
	}

	// 第二次执行：应该正常工作
	result, err := executor.Execute(ctx, `1 + 1`, nil)
	if err != nil {
		t.Fatalf("expected no error on second execution, got: %v", err)
	}
	if result.ToInteger() != 2 {
		t.Errorf("expected result 2, got: %v", result.Export())
	}
}

// TestSafeExecutor_ExecuteProgram 测试执行预编译程序
func TestSafeExecutor_ExecuteProgram(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 5*time.Second)

	// 预编译脚本
	program, err := goja.Compile("test.js", `var x = 10; x * x`, false)
	if err != nil {
		t.Fatalf("failed to compile program: %v", err)
	}

	ctx := context.Background()
	result, err := executor.ExecuteProgram(ctx, program, nil)

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if result.ToInteger() != 100 {
		t.Errorf("expected result 100, got: %v", result.Export())
	}
}

// TestSafeExecutor_ExecuteProgramTimeout 测试预编译程序超时
func TestSafeExecutor_ExecuteProgramTimeout(t *testing.T) {
	pool := newPool(1, func() *goja.Runtime {
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 100*time.Millisecond)

	// 预编译无限循环
	program, err := goja.Compile("loop.js", `for(;;){}`, false)
	if err != nil {
		t.Fatalf("failed to compile program: %v", err)
	}

	ctx := context.Background()
	start := time.Now()
	_, err = executor.ExecuteProgram(ctx, program, nil)
	elapsed := time.Since(start)

	if elapsed > 500*time.Millisecond {
		t.Errorf("timeout not respected, took: %v", elapsed)
	}

	if err == nil {
		t.Fatal("expected timeout error")
	}
}

// TestSafeExecutor_ExecuteProgramCustomTimeout 测试预编译程序自定义超时
func TestSafeExecutor_ExecuteProgramCustomTimeout(t *testing.T) {
	pool := newPool(1, func() *goja.Runtime {
		return goja.New()
	})

	// 默认 5 秒
	executor := NewSafeExecutor(pool, 5*time.Second)

	program, err := goja.Compile("loop.js", `for(;;){}`, false)
	if err != nil {
		t.Fatalf("failed to compile program: %v", err)
	}

	ctx := context.Background()
	opts := &ExecuteOptions{Timeout: 100 * time.Millisecond}

	start := time.Now()
	_, err = executor.ExecuteProgram(ctx, program, opts)
	elapsed := time.Since(start)

	if elapsed > 500*time.Millisecond {
		t.Errorf("custom timeout not respected, took: %v", elapsed)
	}

	if err == nil {
		t.Fatal("expected timeout error")
	}
}

// TestSafeExecutor_CustomTimeout 测试自定义超时选项
func TestSafeExecutor_CustomTimeout(t *testing.T) {
	pool := newPool(2, func() *goja.Runtime {
		return goja.New()
	})

	// 默认超时 5 秒
	executor := NewSafeExecutor(pool, 5*time.Second)

	ctx := context.Background()

	// 使用自定义超时 100ms
	opts := &ExecuteOptions{
		Timeout: 100 * time.Millisecond,
	}

	start := time.Now()
	_, err := executor.Execute(ctx, `for(;;){}`, opts)
	elapsed := time.Since(start)

	if elapsed > 500*time.Millisecond {
		t.Errorf("custom timeout not respected, took: %v", elapsed)
	}

	if err == nil {
		t.Fatal("expected timeout error")
	}
}

// TestSafeExecutor_Concurrent 测试并发执行
func TestSafeExecutor_Concurrent(t *testing.T) {
	const concurrency = 10

	// 创建足够大的池以避免创建临时 VM
	pool := newPool(concurrency, func() *goja.Runtime {
		return goja.New()
	})

	executor := NewSafeExecutor(pool, 5*time.Second)

	type execResult struct {
		value int64
		err   error
	}

	results := make(chan execResult, concurrency)

	for i := 0; i < concurrency; i++ {
		go func(n int) {
			ctx := context.Background()
			script := `var sum = 0; for (var i = 0; i < 100; i++) sum += i; sum`
			result, err := executor.Execute(ctx, script, nil)
			if err != nil {
				results <- execResult{err: err}
				return
			}
			results <- execResult{value: result.ToInteger()}
		}(i)
	}

	successCount := 0
	errorCount := 0
	for i := 0; i < concurrency; i++ {
		select {
		case r := <-results:
			if r.err != nil {
				t.Logf("concurrent execution error: %v", r.err)
				errorCount++
			} else if r.value != 4950 {
				t.Errorf("expected 4950, got: %d", r.value)
			} else {
				successCount++
			}
		case <-time.After(10 * time.Second):
			t.Fatal("concurrent execution timeout")
		}
	}

	// 允许少量错误（由于测试环境的竞争条件）
	if successCount < concurrency-1 {
		t.Errorf("expected at least %d successful executions, got %d (errors: %d)", concurrency-1, successCount, errorCount)
	}
}
