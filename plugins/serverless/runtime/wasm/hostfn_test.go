package wasm

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// setupWazeroWithWASI 创建带 WASI 支持的 wazero 运行时
func setupWazeroWithWASI(ctx context.Context) wazero.Runtime {
	r := wazero.NewRuntime(ctx)
	wasi_snapshot_preview1.MustInstantiate(ctx, r)
	return r
}

// TestNewHostFunctions 测试创建 HostFunctions
func TestNewHostFunctions(t *testing.T) {
	hf := NewHostFunctions()
	if hf == nil {
		t.Fatal("NewHostFunctions() 返回 nil")
	}
}

// TestHostFunctionsSetHandlers 测试设置处理器
func TestHostFunctionsSetHandlers(t *testing.T) {
	hf := NewHostFunctions()

	t.Run("SetRequestHandler", func(t *testing.T) {
		hf.SetRequestHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
			return nil, nil
		})

		hf.mu.RLock()
		handler := hf.requestHandler
		hf.mu.RUnlock()

		if handler == nil {
			t.Error("requestHandler 不应为 nil")
		}
	})

	t.Run("SetLogHandler", func(t *testing.T) {
		hf.SetLogHandler(func(level LogLevel, message string) {
		})

		hf.mu.RLock()
		handler := hf.logHandler
		hf.mu.RUnlock()

		if handler == nil {
			t.Error("logHandler 不应为 nil")
		}
	})

	t.Run("SetErrorHandler", func(t *testing.T) {
		hf.SetErrorHandler(func(message string) {
		})

		hf.mu.RLock()
		handler := hf.errorHandler
		hf.mu.RUnlock()

		if handler == nil {
			t.Error("errorHandler 不应为 nil")
		}
	})
}

// TestHostFunctionsRegisterTo 测试注册到 wazero
func TestHostFunctionsRegisterTo(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()
	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}
}

// TestHostFunctionsWithModule 测试与 WASM 模块集成
func TestHostFunctionsWithModule(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	// 设置处理器
	hf.SetRequestHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		_ = op
		_ = payload
		return []byte(`{"result":"ok"}`), nil
	})

	hf.SetLogHandler(func(level LogLevel, message string) {
		_ = level
		_ = message
	})

	hf.SetErrorHandler(func(message string) {
		_ = message
	})

	// 注册 Host Functions
	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	// 编译并实例化测试模块
	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 验证模块已正确实例化
	if instance.Memory == nil {
		t.Error("Memory 不应为 nil")
	}
}

// TestOpCodeConstants 测试操作码常量
func TestOpCodeConstants(t *testing.T) {
	tests := []struct {
		name string
		op   OpCode
		want uint32
	}{
		{"OpFetch", OpFetch, 1},
		{"OpDBQuery", OpDBQuery, 2},
		{"OpKVGet", OpKVGet, 3},
		{"OpKVSet", OpKVSet, 4},
		{"OpSecretGet", OpSecretGet, 5},
		{"OpJobEnqueue", OpJobEnqueue, 6},
		{"OpFileRead", OpFileRead, 7},
		{"OpFileSave", OpFileSave, 8},
		{"OpVectorSearch", OpVectorSearch, 9},
		{"OpTxBegin", OpTxBegin, 10},
		{"OpTxCommit", OpTxCommit, 11},
		{"OpTxRollback", OpTxRollback, 12},
		{"OpUtils", OpUtils, 13},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if uint32(tt.op) != tt.want {
				t.Errorf("%s = %d, want %d", tt.name, tt.op, tt.want)
			}
		})
	}
}

// TestLogLevelConstants 测试日志级别常量
func TestLogLevelConstants(t *testing.T) {
	tests := []struct {
		name  string
		level LogLevel
		want  uint32
	}{
		{"LogLevelLog", LogLevelLog, 0},
		{"LogLevelWarn", LogLevelWarn, 1},
		{"LogLevelError", LogLevelError, 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if uint32(tt.level) != tt.want {
				t.Errorf("%s = %d, want %d", tt.name, tt.level, tt.want)
			}
		})
	}
}

// TestParseRequestPayload 测试解析请求载荷
func TestParseRequestPayload(t *testing.T) {
	t.Run("有效载荷", func(t *testing.T) {
		data := []byte(`{"op":"list","col":"users","id":"123"}`)
		payload, err := ParseRequestPayload(data)
		if err != nil {
			t.Fatalf("ParseRequestPayload() error = %v", err)
		}

		if payload.Op != "list" {
			t.Errorf("Op = %s, want list", payload.Op)
		}
		if payload.Col != "users" {
			t.Errorf("Col = %s, want users", payload.Col)
		}
		if payload.ID != "123" {
			t.Errorf("ID = %s, want 123", payload.ID)
		}
	})

	t.Run("无效 JSON", func(t *testing.T) {
		data := []byte(`{invalid}`)
		_, err := ParseRequestPayload(data)
		if err == nil {
			t.Error("无效 JSON 应返回错误")
		}
	})

	t.Run("带 Data 字段", func(t *testing.T) {
		data := []byte(`{"op":"create","col":"users","data":{"name":"test"}}`)
		payload, err := ParseRequestPayload(data)
		if err != nil {
			t.Fatalf("ParseRequestPayload() error = %v", err)
		}

		if payload.Data == nil {
			t.Error("Data 不应为 nil")
		}
	})
}

// TestMarshalResponse 测试序列化响应
func TestMarshalResponse(t *testing.T) {
	t.Run("成功响应", func(t *testing.T) {
		result := MarshalResponse(map[string]string{"name": "test"}, nil)

		var resp ResponsePayload
		if err := json.Unmarshal(result, &resp); err != nil {
			t.Fatalf("Unmarshal error = %v", err)
		}

		if resp.Error != "" {
			t.Errorf("Error = %s, want empty", resp.Error)
		}
		if resp.Data == nil {
			t.Error("Data 不应为 nil")
		}
	})

	t.Run("错误响应", func(t *testing.T) {
		result := MarshalResponse(nil, errors.New("test error"))

		var resp ResponsePayload
		if err := json.Unmarshal(result, &resp); err != nil {
			t.Fatalf("Unmarshal error = %v", err)
		}

		if resp.Error != "test error" {
			t.Errorf("Error = %s, want 'test error'", resp.Error)
		}
	})
}

// TestGetResponseLen 测试获取响应长度
func TestGetResponseLen(t *testing.T) {
	hf := NewHostFunctions()

	// 初始应为 0
	if hf.GetResponseLen() != 0 {
		t.Errorf("初始 GetResponseLen() = %d, want 0", hf.GetResponseLen())
	}

	// 设置响应长度
	hf.mu.Lock()
	hf.responseLen = 100
	hf.mu.Unlock()

	if hf.GetResponseLen() != 100 {
		t.Errorf("GetResponseLen() = %d, want 100", hf.GetResponseLen())
	}
}

// TestHostFunctionsSetCurrentModule 测试设置当前模块
func TestHostFunctionsSetCurrentModule(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()
	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	hf.SetCurrentModule(instance.Module)

	hf.mu.RLock()
	mod := hf.currentModule
	hf.mu.RUnlock()

	if mod == nil {
		t.Error("currentModule 不应为 nil")
	}
}

// TestHostFunctionsNilHandlers 测试 nil 处理器
func TestHostFunctionsNilHandlers(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()
	// 不设置任何处理器

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	// 验证不会 panic
	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)
}

// TestHostFunctionsConcurrency 测试并发安全
func TestHostFunctionsConcurrency(t *testing.T) {
	hf := NewHostFunctions()

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			hf.SetRequestHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
				return nil, nil
			})
			hf.SetLogHandler(func(level LogLevel, message string) {})
			hf.SetErrorHandler(func(message string) {})
			hf.GetResponseLen()
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestHostRequestDirectCall 测试直接调用 hostRequest
func TestHostRequestDirectCall(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	// 设置处理器
	var receivedOp OpCode
	var receivedPayload string
	hf.SetRequestHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		receivedOp = op
		receivedPayload = string(payload)
		return []byte(`{"result":"success"}`), nil
	})

	// 注册 Host Functions
	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 写入测试数据到内存
	testPayload := `{"op":"test"}`
	ptr := uint32(0x1000)
	instance.WriteString(ptr, testPayload)

	// 直接调用 hostRequest
	result := hf.hostRequest(ctx, instance.Module, uint32(OpDBQuery), ptr, uint32(len(testPayload)))

	// 验证处理器被调用
	if receivedOp != OpDBQuery {
		t.Errorf("receivedOp = %d, want %d", receivedOp, OpDBQuery)
	}
	if receivedPayload != testPayload {
		t.Errorf("receivedPayload = %s, want %s", receivedPayload, testPayload)
	}
	if result == 0 {
		t.Error("result 不应为 0")
	}
}

// TestHostRequestWithError 测试 hostRequest 错误处理
func TestHostRequestWithError(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	// 设置返回错误的处理器
	hf.SetRequestHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		return nil, errors.New("test error")
	})

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 写入测试数据
	ptr := uint32(0x1000)
	instance.WriteString(ptr, `{}`)

	// 调用 hostRequest
	result := hf.hostRequest(ctx, instance.Module, uint32(OpFetch), ptr, 2)

	// 应该返回非零指针（错误响应）
	if result == 0 {
		t.Error("result 不应为 0")
	}
}

// TestHostRequestNilHandler 测试 nil 处理器
func TestHostRequestNilHandler(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()
	// 不设置处理器

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 调用 hostRequest（应该返回 0）
	result := hf.hostRequest(ctx, instance.Module, uint32(OpFetch), 0x1000, 10)
	if result != 0 {
		t.Errorf("nil handler should return 0, got %d", result)
	}
}

// TestHostLogDirectCall 测试直接调用 hostLog
func TestHostLogDirectCall(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	var loggedLevel LogLevel
	var loggedMessage string
	hf.SetLogHandler(func(level LogLevel, message string) {
		loggedLevel = level
		loggedMessage = message
	})

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 写入测试消息
	testMsg := "Hello, World!"
	ptr := uint32(0x1000)
	instance.WriteString(ptr, testMsg)

	// 测试各种日志级别
	tests := []struct {
		level LogLevel
		name  string
	}{
		{LogLevelLog, "log"},
		{LogLevelWarn, "warn"},
		{LogLevelError, "error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hf.hostLog(ctx, instance.Module, ptr, uint32(len(testMsg)), uint32(tt.level))

			if loggedLevel != tt.level {
				t.Errorf("loggedLevel = %d, want %d", loggedLevel, tt.level)
			}
			if loggedMessage != testMsg {
				t.Errorf("loggedMessage = %s, want %s", loggedMessage, testMsg)
			}
		})
	}
}

// TestHostLogNilHandler 测试 nil 日志处理器
func TestHostLogNilHandler(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()
	// 不设置日志处理器

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 应该不会 panic
	hf.hostLog(ctx, instance.Module, 0x1000, 10, 0)
}

// TestHostErrorDirectCall 测试直接调用 hostError
func TestHostErrorDirectCall(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	var errorMsg string
	hf.SetErrorHandler(func(message string) {
		errorMsg = message
	})

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 写入错误消息
	testError := "Fatal error occurred"
	ptr := uint32(0x1000)
	instance.WriteString(ptr, testError)

	// 调用 hostError
	hf.hostError(ctx, instance.Module, ptr, uint32(len(testError)))

	if errorMsg != testError {
		t.Errorf("errorMsg = %s, want %s", errorMsg, testError)
	}
}

// TestHostErrorNilHandler 测试 nil 错误处理器
func TestHostErrorNilHandler(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()
	// 不设置错误处理器

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 应该不会 panic
	hf.hostError(ctx, instance.Module, 0x1000, 10)
}

// TestHostAllocAndFree 测试内存分配和释放
func TestHostAllocAndFree(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 测试 hostAlloc
	ptr := hf.hostAlloc(ctx, instance.Module, 1024)
	if ptr == 0 {
		t.Error("hostAlloc 应返回非零指针")
	}

	// 测试 hostFree（不应 panic）
	hf.hostFree(ctx, instance.Module, ptr)
}

// TestConsoleLogWarnError 测试 console 兼容函数
func TestConsoleLogWarnError(t *testing.T) {
	ctx := context.Background()
	r := setupWazeroWithWASI(ctx)
	defer r.Close(ctx)

	hf := NewHostFunctions()

	var logs []struct {
		level   LogLevel
		message string
	}
	hf.SetLogHandler(func(level LogLevel, message string) {
		logs = append(logs, struct {
			level   LogLevel
			message string
		}{level, message})
	})

	err := hf.RegisterTo(ctx, r)
	if err != nil {
		t.Fatalf("RegisterTo() error = %v", err)
	}

	ClearCache()
	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	// 写入测试消息
	ptr := uint32(0x1000)
	instance.WriteString(ptr, "test message")

	// 测试 consoleLog
	hf.consoleLog(ctx, instance.Module, ptr, 12)
	// 测试 consoleWarn
	hf.consoleWarn(ctx, instance.Module, ptr, 12)
	// 测试 consoleError
	hf.consoleError(ctx, instance.Module, ptr, 12)

	if len(logs) != 3 {
		t.Errorf("应该有 3 条日志，实际有 %d 条", len(logs))
	}

	if logs[0].level != LogLevelLog {
		t.Errorf("第一条日志级别应为 Log")
	}
	if logs[1].level != LogLevelWarn {
		t.Errorf("第二条日志级别应为 Warn")
	}
	if logs[2].level != LogLevelError {
		t.Errorf("第三条日志级别应为 Error")
	}
}

// TestParseRequestPayloadAllFields 测试解析所有字段
func TestParseRequestPayloadAllFields(t *testing.T) {
	data := []byte(`{"op":"enqueue","col":"tasks","id":"task-1","key":"mykey","name":"myname","data":{"foo":"bar"}}`)
	payload, err := ParseRequestPayload(data)
	if err != nil {
		t.Fatalf("ParseRequestPayload() error = %v", err)
	}

	if payload.Op != "enqueue" {
		t.Errorf("Op = %s, want enqueue", payload.Op)
	}
	if payload.Col != "tasks" {
		t.Errorf("Col = %s, want tasks", payload.Col)
	}
	if payload.ID != "task-1" {
		t.Errorf("ID = %s, want task-1", payload.ID)
	}
	if payload.Key != "mykey" {
		t.Errorf("Key = %s, want mykey", payload.Key)
	}
	if payload.Name != "myname" {
		t.Errorf("Name = %s, want myname", payload.Name)
	}
}
