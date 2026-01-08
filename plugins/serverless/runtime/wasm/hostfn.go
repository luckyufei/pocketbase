// Package wasm 提供 Host Functions 的 WASM 绑定
package wasm

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
)

// OpCode 定义操作码
type OpCode uint32

const (
	// OpFetch HTTP 请求
	OpFetch OpCode = 1
	// OpDBQuery 数据库查询
	OpDBQuery OpCode = 2
	// OpKVGet KV 读取
	OpKVGet OpCode = 3
	// OpKVSet KV 写入
	OpKVSet OpCode = 4
	// OpSecretGet 密钥读取
	OpSecretGet OpCode = 5
	// OpJobEnqueue 任务入队
	OpJobEnqueue OpCode = 6
	// OpFileRead 文件读取
	OpFileRead OpCode = 7
	// OpFileSave 文件保存
	OpFileSave OpCode = 8
	// OpVectorSearch 向量搜索
	OpVectorSearch OpCode = 9
	// OpTxBegin 事务开始
	OpTxBegin OpCode = 10
	// OpTxCommit 事务提交
	OpTxCommit OpCode = 11
	// OpTxRollback 事务回滚
	OpTxRollback OpCode = 12
	// OpUtils 工具函数
	OpUtils OpCode = 13
)

// LogLevel 日志级别
type LogLevel uint32

const (
	LogLevelLog   LogLevel = 0
	LogLevelWarn  LogLevel = 1
	LogLevelError LogLevel = 2
)

// HostFunctionHandler 是处理 host_request 的回调函数类型
type HostFunctionHandler func(ctx context.Context, op OpCode, payload []byte) ([]byte, error)

// LogHandler 是处理日志的回调函数类型
type LogHandler func(level LogLevel, message string)

// ErrorHandler 是处理错误的回调函数类型
type ErrorHandler func(message string)

// HostFunctions 管理 WASM Host Functions
type HostFunctions struct {
	mu sync.RWMutex

	// 回调处理器
	requestHandler HostFunctionHandler
	logHandler     LogHandler
	errorHandler   ErrorHandler

	// 当前模块实例（用于内存操作）
	currentModule api.Module

	// 响应缓冲区
	responseBuffer []byte
	responsePtr    uint32
	responseLen    uint32
}

// NewHostFunctions 创建新的 HostFunctions
func NewHostFunctions() *HostFunctions {
	return &HostFunctions{}
}

// SetRequestHandler 设置请求处理器
func (hf *HostFunctions) SetRequestHandler(handler HostFunctionHandler) {
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.requestHandler = handler
}

// SetLogHandler 设置日志处理器
func (hf *HostFunctions) SetLogHandler(handler LogHandler) {
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.logHandler = handler
}

// SetErrorHandler 设置错误处理器
func (hf *HostFunctions) SetErrorHandler(handler ErrorHandler) {
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.errorHandler = handler
}

// SetCurrentModule 设置当前模块实例
func (hf *HostFunctions) SetCurrentModule(mod api.Module) {
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.currentModule = mod
}

// RegisterTo 注册 Host Functions 到 wazero 运行时
func (hf *HostFunctions) RegisterTo(ctx context.Context, r wazero.Runtime) error {
	_, err := r.NewHostModuleBuilder("env").
		// host_request: 万能网关
		NewFunctionBuilder().
		WithFunc(hf.hostRequest).
		WithParameterNames("op", "ptr", "len").
		Export("host_request").
		// host_log: 日志转发
		NewFunctionBuilder().
		WithFunc(hf.hostLog).
		WithParameterNames("ptr", "len", "level").
		Export("host_log").
		// host_error: 错误处理
		NewFunctionBuilder().
		WithFunc(hf.hostError).
		WithParameterNames("ptr", "len").
		Export("host_error").
		// host_alloc: 内存分配（由 WASM 侧实现，这里只是占位）
		NewFunctionBuilder().
		WithFunc(hf.hostAlloc).
		WithParameterNames("size").
		Export("host_alloc").
		// host_free: 内存释放（由 WASM 侧实现，这里只是占位）
		NewFunctionBuilder().
		WithFunc(hf.hostFree).
		WithParameterNames("ptr").
		Export("host_free").
		// 兼容旧的 console 函数
		NewFunctionBuilder().
		WithFunc(hf.consoleLog).
		Export("console_log").
		NewFunctionBuilder().
		WithFunc(hf.consoleWarn).
		Export("console_warn").
		NewFunctionBuilder().
		WithFunc(hf.consoleError).
		Export("console_error").
		Instantiate(ctx)

	return err
}

// hostRequest 实现 host_request Host Function
// 这是万能网关，所有 DB/Fetch/KV/Queue 操作都走这个入口
func (hf *HostFunctions) hostRequest(ctx context.Context, m api.Module, op, ptr, length uint32) uint32 {
	hf.mu.RLock()
	handler := hf.requestHandler
	hf.mu.RUnlock()

	if handler == nil {
		return 0
	}

	// 从 WASM 内存读取 payload
	payload, ok := m.Memory().Read(ptr, length)
	if !ok {
		return 0
	}

	// 调用处理器
	result, err := handler(ctx, OpCode(op), payload)

	// 构建响应
	var response []byte
	if err != nil {
		response, _ = json.Marshal(map[string]any{
			"error": err.Error(),
		})
	} else {
		response, _ = json.Marshal(map[string]any{
			"data": json.RawMessage(result),
		})
	}

	// 写入响应到 WASM 内存
	// 使用固定的响应缓冲区地址 (0x2000)
	responsePtr := uint32(0x2000)
	if !m.Memory().Write(responsePtr, response) {
		return 0
	}

	// 返回响应指针（高 16 位是长度，低 16 位是指针偏移）
	// 简化实现：直接返回指针，长度通过约定的内存位置传递
	hf.mu.Lock()
	hf.responseBuffer = response
	hf.responsePtr = responsePtr
	hf.responseLen = uint32(len(response))
	hf.mu.Unlock()

	return responsePtr
}

// hostLog 实现 host_log Host Function
func (hf *HostFunctions) hostLog(ctx context.Context, m api.Module, ptr, length, level uint32) {
	hf.mu.RLock()
	handler := hf.logHandler
	hf.mu.RUnlock()

	if handler == nil {
		return
	}

	msg, ok := m.Memory().Read(ptr, length)
	if !ok {
		return
	}

	handler(LogLevel(level), string(msg))
}

// hostError 实现 host_error Host Function
func (hf *HostFunctions) hostError(ctx context.Context, m api.Module, ptr, length uint32) {
	hf.mu.RLock()
	handler := hf.errorHandler
	hf.mu.RUnlock()

	if handler == nil {
		return
	}

	msg, ok := m.Memory().Read(ptr, length)
	if !ok {
		return
	}

	handler(string(msg))
}

// hostAlloc 实现 host_alloc Host Function
// 注意：真正的内存分配应该由 WASM 侧（QuickJS）实现
// 这里只是一个简单的占位实现
func (hf *HostFunctions) hostAlloc(ctx context.Context, m api.Module, size uint32) uint32 {
	// 简单实现：从固定地址开始分配
	// 真正的实现需要 QuickJS 内部的内存管理
	return 0x3000 // 返回堆起始地址
}

// hostFree 实现 host_free Host Function
// 注意：真正的内存释放应该由 WASM 侧（QuickJS）实现
func (hf *HostFunctions) hostFree(ctx context.Context, m api.Module, ptr uint32) {
	// 占位实现
}

// consoleLog 兼容旧的 console_log
func (hf *HostFunctions) consoleLog(ctx context.Context, m api.Module, ptr, length uint32) {
	hf.hostLog(ctx, m, ptr, length, uint32(LogLevelLog))
}

// consoleWarn 兼容旧的 console_warn
func (hf *HostFunctions) consoleWarn(ctx context.Context, m api.Module, ptr, length uint32) {
	hf.hostLog(ctx, m, ptr, length, uint32(LogLevelWarn))
}

// consoleError 兼容旧的 console_error
func (hf *HostFunctions) consoleError(ctx context.Context, m api.Module, ptr, length uint32) {
	hf.hostLog(ctx, m, ptr, length, uint32(LogLevelError))
}

// GetResponseLen 获取最后一次响应的长度
func (hf *HostFunctions) GetResponseLen() uint32 {
	hf.mu.RLock()
	defer hf.mu.RUnlock()
	return hf.responseLen
}

// RequestPayload 请求载荷结构
type RequestPayload struct {
	Op   string          `json:"op"`
	Col  string          `json:"col,omitempty"`
	ID   string          `json:"id,omitempty"`
	Data json.RawMessage `json:"data,omitempty"`
	Key  string          `json:"key,omitempty"`
	Name string          `json:"name,omitempty"`
}

// ParseRequestPayload 解析请求载荷
func ParseRequestPayload(data []byte) (*RequestPayload, error) {
	var payload RequestPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析请求载荷失败: %w", err)
	}
	return &payload, nil
}

// ResponsePayload 响应载荷结构
type ResponsePayload struct {
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

// MarshalResponse 序列化响应
func MarshalResponse(data any, err error) []byte {
	resp := ResponsePayload{}
	if err != nil {
		resp.Error = err.Error()
	} else {
		resp.Data = data
	}
	result, _ := json.Marshal(resp)
	return result
}
