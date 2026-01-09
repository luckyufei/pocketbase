package wasm

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// ============================================================================
// Runtime 接口测试
// ============================================================================

func TestMockRuntime_Init(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// 重复初始化应该成功
	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Re-init failed: %v", err)
	}
}

func TestMockRuntime_EvalSimple(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	tests := []struct {
		name     string
		code     string
		expected interface{}
	}{
		{"addition", "1 + 1", float64(2)},
		{"multiplication", "2 * 3", float64(6)},
		{"subtraction", "10 - 5", float64(5)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := rt.Eval(ctx, tt.code)
			if err != nil {
				t.Fatalf("Eval failed: %v", err)
			}

			var got interface{}
			if err := json.Unmarshal(result.Data, &got); err != nil {
				t.Fatalf("Unmarshal failed: %v", err)
			}

			if got != tt.expected {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestMockRuntime_EvalClosed(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	ctx := context.Background()

	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	if err := rt.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	_, err := rt.Eval(ctx, "1 + 1")
	if err == nil {
		t.Error("expected error when eval on closed runtime")
	}
}

func TestMockRuntime_HostHandler(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// 设置 Host Handler
	var receivedOp OpCode
	var receivedPayload []byte
	rt.SetHostHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		receivedOp = op
		receivedPayload = payload
		return []byte(`{"result":"ok"}`), nil
	})

	// 调用 Host Handler
	payload := []byte(`{"key":"test"}`)
	result, err := rt.InvokeHostHandler(ctx, OpFetch, payload)
	if err != nil {
		t.Fatalf("InvokeHostHandler failed: %v", err)
	}

	if receivedOp != OpFetch {
		t.Errorf("got op %d, want %d", receivedOp, OpFetch)
	}

	if string(receivedPayload) != string(payload) {
		t.Errorf("got payload %s, want %s", receivedPayload, payload)
	}

	if string(result) != `{"result":"ok"}` {
		t.Errorf("got result %s, want %s", result, `{"result":"ok"}`)
	}
}

func TestMockRuntime_LogHandler(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	var logLevel LogLevel
	var logMessage string
	rt.SetLogHandler(func(level LogLevel, message string) {
		logLevel = level
		logMessage = message
	})

	rt.InvokeLogHandler(LogLevelWarn, "test warning")

	if logLevel != LogLevelWarn {
		t.Errorf("got level %d, want %d", logLevel, LogLevelWarn)
	}

	if logMessage != "test warning" {
		t.Errorf("got message %s, want %s", logMessage, "test warning")
	}
}

func TestMockRuntime_CustomEvalFunc(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// 设置自定义求值函数
	rt.SetEvalFunc(func(code string) (*EvalResult, error) {
		return &EvalResult{
			Data: json.RawMessage(`"custom result"`),
		}, nil
	})

	result, err := rt.Eval(ctx, "any code")
	if err != nil {
		t.Fatalf("Eval failed: %v", err)
	}

	if string(result.Data) != `"custom result"` {
		t.Errorf("got %s, want %s", result.Data, `"custom result"`)
	}
}

func TestMockRuntime_Concurrent(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	if err := rt.Init(ctx); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var wg sync.WaitGroup
	errors := make(chan error, 10)

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := rt.Eval(ctx, "1 + 1")
			if err != nil {
				errors <- err
			}
		}()
	}

	wg.Wait()
	close(errors)

	for err := range errors {
		t.Errorf("concurrent eval error: %v", err)
	}
}

// ============================================================================
// OpCode 测试
// ============================================================================

func TestOpCode_Values(t *testing.T) {
	// 验证操作码值与 quickjs-wasm.md 规格一致
	tests := []struct {
		op   OpCode
		want uint32
	}{
		{OpFetch, 1},
		{OpDBQuery, 2},
		{OpKVGet, 3},
		{OpKVSet, 4},
		{OpSecretGet, 5},
		{OpJobEnqueue, 6},
		{OpFileRead, 7},
		{OpFileSave, 8},
		{OpVectorSearch, 9},
		{OpTxBegin, 10},
		{OpTxCommit, 11},
		{OpTxRollback, 12},
		{OpUtils, 13},
	}

	for _, tt := range tests {
		if uint32(tt.op) != tt.want {
			t.Errorf("OpCode %d got %d, want %d", tt.op, uint32(tt.op), tt.want)
		}
	}
}

func TestLogLevel_Values(t *testing.T) {
	tests := []struct {
		level LogLevel
		want  uint32
	}{
		{LogLevelLog, 0},
		{LogLevelWarn, 1},
		{LogLevelError, 2},
	}

	for _, tt := range tests {
		if uint32(tt.level) != tt.want {
			t.Errorf("LogLevel got %d, want %d", uint32(tt.level), tt.want)
		}
	}
}

// ============================================================================
// Config 测试
// ============================================================================

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.MaxMemory != 128*1024*1024 {
		t.Errorf("MaxMemory got %d, want %d", cfg.MaxMemory, 128*1024*1024)
	}

	if cfg.MaxInstructions != 1000000000 {
		t.Errorf("MaxInstructions got %d, want %d", cfg.MaxInstructions, 1000000000)
	}

	if cfg.EnableDebug != false {
		t.Error("EnableDebug should be false by default")
	}
}

// ============================================================================
// RuntimeFactory 测试
// ============================================================================

func TestSetDefaultFactory(t *testing.T) {
	// 保存原始工厂
	factoryMu.Lock()
	originalFactory := defaultFactory
	factoryMu.Unlock()
	defer func() {
		SetDefaultFactory(originalFactory)
	}()

	// 设置自定义工厂
	customCalled := false
	SetDefaultFactory(func(config Config) (Runtime, error) {
		customCalled = true
		return NewMockRuntime(config), nil
	})

	// 创建运行时
	rt, err := NewRuntime(DefaultConfig())
	if err != nil {
		t.Fatalf("NewRuntime failed: %v", err)
	}
	defer rt.Close()

	if !customCalled {
		t.Error("custom factory was not called")
	}
}

// ============================================================================
// WazeroRuntime 测试（需要真正的 WASM）
// ============================================================================

func TestWazeroRuntime_Init_NoWasm(t *testing.T) {
	// 当 WASM 文件不可用时应该返回错误
	rt, err := NewWazeroRuntime(DefaultConfig())
	if err != nil {
		t.Fatalf("NewWazeroRuntime failed: %v", err)
	}
	defer rt.Close()

	ctx := context.Background()
	err = rt.Init(ctx)

	// 由于 WASM 文件是占位符，应该返回错误
	if err == nil {
		t.Skip("WASM 文件可用，跳过此测试")
	}

	if err.Error() != "QuickJS WASM 二进制不可用（需要编译）" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWazeroRuntime_Close(t *testing.T) {
	rt, err := NewWazeroRuntime(DefaultConfig())
	if err != nil {
		t.Fatalf("NewWazeroRuntime failed: %v", err)
	}

	// 关闭应该成功
	if err := rt.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// 重复关闭应该成功
	if err := rt.Close(); err != nil {
		t.Fatalf("Re-close failed: %v", err)
	}
}

func TestWazeroRuntime_EvalWithoutInit(t *testing.T) {
	rt, err := NewWazeroRuntime(DefaultConfig())
	if err != nil {
		t.Fatalf("NewWazeroRuntime failed: %v", err)
	}
	defer rt.Close()

	ctx := context.Background()
	_, err = rt.Eval(ctx, "1 + 1")

	// 由于 WASM 不可用，应该返回初始化错误
	if err == nil {
		t.Skip("WASM 文件可用，跳过此测试")
	}
}

// ============================================================================
// EvalResult 测试
// ============================================================================

func TestEvalResult_JSON(t *testing.T) {
	result := &EvalResult{
		Data: json.RawMessage(`{"key":"value"}`),
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var decoded EvalResult
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if string(decoded.Data) != `{"key":"value"}` {
		t.Errorf("got %s, want %s", decoded.Data, `{"key":"value"}`)
	}
}

func TestEvalResult_Error(t *testing.T) {
	result := &EvalResult{
		Error: "test error",
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var decoded EvalResult
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if decoded.Error != "test error" {
		t.Errorf("got %s, want %s", decoded.Error, "test error")
	}
}

// ============================================================================
// 集成测试场景
// ============================================================================

func TestMockRuntime_HostHandlerTimeout(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// 设置一个会超时的 Host Handler
	rt.SetHostHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(200 * time.Millisecond):
			return []byte(`{"result":"ok"}`), nil
		}
	})

	_, err := rt.InvokeHostHandler(ctx, OpFetch, []byte(`{}`))
	if err == nil {
		t.Error("expected timeout error")
	}
}

func TestMockRuntime_NoHostHandler(t *testing.T) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	_, err := rt.InvokeHostHandler(ctx, OpFetch, []byte(`{}`))
	if err == nil {
		t.Error("expected error when no host handler")
	}
}

// ============================================================================
// Benchmark
// ============================================================================

func BenchmarkMockRuntime_Eval(b *testing.B) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	rt.Init(ctx)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rt.Eval(ctx, "1 + 1")
	}
}

func BenchmarkMockRuntime_HostHandler(b *testing.B) {
	rt := NewMockRuntime(DefaultConfig())
	defer rt.Close()

	ctx := context.Background()
	rt.SetHostHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		return []byte(`{"result":"ok"}`), nil
	})

	payload := []byte(`{"key":"test"}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rt.InvokeHostHandler(ctx, OpFetch, payload)
	}
}
