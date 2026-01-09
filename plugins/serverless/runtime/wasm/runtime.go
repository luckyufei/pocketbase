// Package wasm 提供 QuickJS WASM 运行时接口
//
// 此包定义了 WASM 运行时的核心接口，支持：
// 1. 真正的 QuickJS WASM 运行时（生产环境）
// 2. 模拟运行时（测试环境）
package wasm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
)

// Runtime 定义 WASM 运行时接口
type Runtime interface {
	// Init 初始化运行时
	Init(ctx context.Context) error

	// Eval 执行 JavaScript 代码
	Eval(ctx context.Context, code string) (*EvalResult, error)

	// SetHostHandler 设置 Host Function 处理器
	SetHostHandler(handler HostHandler)

	// SetLogHandler 设置日志处理器
	SetLogHandler(handler LogHandler)

	// Reset 重置运行时状态
	Reset() error

	// Close 关闭运行时
	Close() error
}

// EvalResult 执行结果
type EvalResult struct {
	// Data 返回的数据（JSON）
	Data json.RawMessage `json:"data,omitempty"`

	// Error 错误信息
	Error string `json:"error,omitempty"`
}

// HostHandler 是 Host Function 处理器类型（复用 hostfn.go 中的定义）
// 使用 HostFunctionHandler 类型别名
type HostHandler = HostFunctionHandler

// 注意: LogHandler 已在 hostfn.go 中定义

// Config 运行时配置
type Config struct {
	// MaxMemory 最大内存限制（字节）
	MaxMemory uint64

	// MaxInstructions 最大指令数（防死循环）
	MaxInstructions uint64

	// EnableDebug 启用调试模式
	EnableDebug bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		MaxMemory:       128 * 1024 * 1024, // 128MB
		MaxInstructions: 1000000000,        // 10亿指令
		EnableDebug:     false,
	}
}

// RuntimeFactory 运行时工厂函数类型
type RuntimeFactory func(config Config) (Runtime, error)

var (
	// 默认运行时工厂
	defaultFactory RuntimeFactory
	factoryMu      sync.RWMutex
)

// SetDefaultFactory 设置默认运行时工厂
func SetDefaultFactory(factory RuntimeFactory) {
	factoryMu.Lock()
	defer factoryMu.Unlock()
	defaultFactory = factory
}

// NewRuntime 创建新的运行时实例
func NewRuntime(config Config) (Runtime, error) {
	factoryMu.RLock()
	factory := defaultFactory
	factoryMu.RUnlock()

	if factory == nil {
		// 默认使用 Wazero 运行时
		return NewWazeroRuntime(config)
	}
	return factory(config)
}

// WazeroRuntime 基于 Wazero 的 QuickJS WASM 运行时
type WazeroRuntime struct {
	mu          sync.Mutex
	config      Config
	hostHandler HostHandler
	logHandler  LogHandler
	hostFn      *HostFunctions
	initialized bool
	closed      bool

	// Wazero 相关
	wasmRuntime interface{} // wazero.Runtime
	wasmModule  interface{} // api.Module
}

// NewWazeroRuntime 创建 Wazero 运行时
func NewWazeroRuntime(config Config) (*WazeroRuntime, error) {
	return &WazeroRuntime{
		config: config,
		hostFn: NewHostFunctions(),
	}, nil
}

// Init 初始化运行时
func (r *WazeroRuntime) Init(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.initialized {
		return nil
	}

	// 检查 WASM 二进制是否可用
	wasmBytes := RuntimeWasm()
	if len(wasmBytes) < 100 {
		// WASM 文件太小，可能是占位文件
		return errors.New("QuickJS WASM 二进制不可用（需要编译）")
	}

	// TODO: 初始化真正的 Wazero 运行时
	// 当 WASM 编译完成后实现

	r.initialized = true
	return nil
}

// Eval 执行 JavaScript 代码
func (r *WazeroRuntime) Eval(ctx context.Context, code string) (*EvalResult, error) {
	r.mu.Lock()
	closed := r.closed
	initialized := r.initialized
	r.mu.Unlock()

	if closed {
		return nil, errors.New("运行时已关闭")
	}

	if !initialized {
		if err := r.Init(ctx); err != nil {
			return nil, fmt.Errorf("初始化失败: %w", err)
		}
	}

	// TODO: 调用真正的 WASM run_handler
	// 当 WASM 编译完成后实现

	return nil, errors.New("Wazero 运行时未完全实现")
}

// SetHostHandler 设置 Host Function 处理器
func (r *WazeroRuntime) SetHostHandler(handler HostHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.hostHandler = handler
	if r.hostFn != nil {
		r.hostFn.SetRequestHandler(func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
			if handler == nil {
				return nil, errors.New("no host handler")
			}
			return handler(ctx, op, payload)
		})
	}
}

// SetLogHandler 设置日志处理器
func (r *WazeroRuntime) SetLogHandler(handler LogHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.logHandler = handler
	if r.hostFn != nil {
		r.hostFn.SetLogHandler(handler)
	}
}

// Reset 重置运行时状态
func (r *WazeroRuntime) Reset() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// TODO: 调用 WASM reset_runtime
	return nil
}

// Close 关闭运行时
func (r *WazeroRuntime) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil
	}
	r.closed = true

	// TODO: 释放 Wazero 资源
	return nil
}

// MockRuntime 模拟运行时（用于测试）
type MockRuntime struct {
	mu          sync.Mutex
	config      Config
	hostHandler HostHandler
	logHandler  LogHandler
	initialized bool
	closed      bool

	// 模拟行为
	evalFunc func(code string) (*EvalResult, error)
}

// NewMockRuntime 创建模拟运行时
func NewMockRuntime(config Config) *MockRuntime {
	return &MockRuntime{
		config: config,
	}
}

// Init 初始化
func (r *MockRuntime) Init(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.initialized = true
	return nil
}

// Eval 执行代码
func (r *MockRuntime) Eval(ctx context.Context, code string) (*EvalResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil, errors.New("运行时已关闭")
	}

	if r.evalFunc != nil {
		return r.evalFunc(code)
	}

	// 默认行为：简单表达式求值
	return r.evalSimple(code)
}

// evalSimple 简单表达式求值
func (r *MockRuntime) evalSimple(code string) (*EvalResult, error) {
	// 简单的数字求值
	var result interface{}

	switch code {
	case "1 + 1":
		result = 2
	case "2 * 3":
		result = 6
	case "10 - 5":
		result = 5
	case "undefined":
		return &EvalResult{Data: json.RawMessage("null")}, nil
	default:
		// 尝试解析为 JSON
		var v interface{}
		if err := json.Unmarshal([]byte(code), &v); err == nil {
			result = v
		} else {
			result = code
		}
	}

	data, _ := json.Marshal(result)
	return &EvalResult{Data: data}, nil
}

// SetHostHandler 设置处理器
func (r *MockRuntime) SetHostHandler(handler HostHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.hostHandler = handler
}

// SetLogHandler 设置日志处理器
func (r *MockRuntime) SetLogHandler(handler LogHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.logHandler = handler
}

// Reset 重置
func (r *MockRuntime) Reset() error {
	return nil
}

// Close 关闭
func (r *MockRuntime) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.closed = true
	return nil
}

// SetEvalFunc 设置自定义求值函数（用于测试）
func (r *MockRuntime) SetEvalFunc(fn func(code string) (*EvalResult, error)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.evalFunc = fn
}

// InvokeHostHandler 直接调用 Host Handler（用于测试）
func (r *MockRuntime) InvokeHostHandler(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
	r.mu.Lock()
	handler := r.hostHandler
	r.mu.Unlock()

	if handler == nil {
		return nil, errors.New("no host handler")
	}
	return handler(ctx, op, payload)
}

// InvokeLogHandler 直接调用日志处理器（用于测试）
func (r *MockRuntime) InvokeLogHandler(level LogLevel, message string) {
	r.mu.Lock()
	handler := r.logHandler
	r.mu.Unlock()

	if handler != nil {
		handler(level, message)
	}
}
