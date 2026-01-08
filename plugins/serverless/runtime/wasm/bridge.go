// Package wasm 提供 Host Functions 桥接层
//
// 此文件将 WASM Host Functions 与 PocketBase 的 hostfn 包连接起来
package wasm

import (
	"context"
	"encoding/json"
	"fmt"
)

// Bridge 是 WASM 和 Go Host Functions 之间的桥接层
type Bridge struct {
	// 处理器映射
	handlers map[OpCode]OpHandler
}

// OpHandler 是操作处理器类型
type OpHandler func(ctx context.Context, payload *RequestPayload) (any, error)

// NewBridge 创建新的桥接层
func NewBridge() *Bridge {
	return &Bridge{
		handlers: make(map[OpCode]OpHandler),
	}
}

// RegisterHandler 注册操作处理器
func (b *Bridge) RegisterHandler(op OpCode, handler OpHandler) {
	b.handlers[op] = handler
}

// Handle 处理请求
func (b *Bridge) Handle(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
	// 解析请求载荷
	req, err := ParseRequestPayload(payload)
	if err != nil {
		return nil, fmt.Errorf("解析请求失败: %w", err)
	}

	// 查找处理器
	handler, ok := b.handlers[op]
	if !ok {
		return nil, fmt.Errorf("未知操作码: %d", op)
	}

	// 执行处理器
	result, err := handler(ctx, req)
	if err != nil {
		return MarshalResponse(nil, err), nil
	}

	return MarshalResponse(result, nil), nil
}

// ToHostFunctionHandler 转换为 HostFunctionHandler
func (b *Bridge) ToHostFunctionHandler() HostFunctionHandler {
	return func(ctx context.Context, op OpCode, payload []byte) ([]byte, error) {
		return b.Handle(ctx, op, payload)
	}
}

// DBQueryPayload 数据库查询载荷
type DBQueryPayload struct {
	Op      string          `json:"op"`      // list, one, create, update, delete, vector
	Col     string          `json:"col"`     // collection name
	ID      string          `json:"id"`      // record id
	Page    int             `json:"page"`    // page number
	PerPage int             `json:"perPage"` // items per page
	Filter  string          `json:"filter"`  // filter expression
	Sort    string          `json:"sort"`    // sort expression
	Expand  string          `json:"expand"`  // expand relations
	Data    json.RawMessage `json:"data"`    // create/update data
	// Vector search
	Vector []float64 `json:"vector"` // query vector
	Field  string    `json:"field"`  // vector field name
	Top    int       `json:"top"`    // top N results
}

// ParseDBQueryPayload 解析数据库查询载荷
func ParseDBQueryPayload(data []byte) (*DBQueryPayload, error) {
	var payload DBQueryPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 DB 查询载荷失败: %w", err)
	}
	return &payload, nil
}

// FetchPayload HTTP 请求载荷
type FetchPayload struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	Timeout int               `json:"timeout"` // 超时秒数
}

// ParseFetchPayload 解析 HTTP 请求载荷
func ParseFetchPayload(data []byte) (*FetchPayload, error) {
	var payload FetchPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 Fetch 载荷失败: %w", err)
	}
	return &payload, nil
}

// KVPayload KV 操作载荷
type KVPayload struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
	TTL   int    `json:"ttl"` // TTL 秒数
}

// ParseKVPayload 解析 KV 操作载荷
func ParseKVPayload(data []byte) (*KVPayload, error) {
	var payload KVPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 KV 载荷失败: %w", err)
	}
	return &payload, nil
}

// SecretPayload 密钥操作载荷
type SecretPayload struct {
	Key string `json:"key"`
}

// ParseSecretPayload 解析密钥操作载荷
func ParseSecretPayload(data []byte) (*SecretPayload, error) {
	var payload SecretPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 Secret 载荷失败: %w", err)
	}
	return &payload, nil
}

// JobPayload 任务操作载荷
type JobPayload struct {
	Topic   string `json:"topic"`
	Payload any    `json:"payload"`
}

// ParseJobPayload 解析任务操作载荷
func ParseJobPayload(data []byte) (*JobPayload, error) {
	var payload JobPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 Job 载荷失败: %w", err)
	}
	return &payload, nil
}

// FilePayload 文件操作载荷
type FilePayload struct {
	Collection string `json:"collection"`
	RecordID   string `json:"recordId"`
	Filename   string `json:"filename"`
	Data       []byte `json:"data"` // base64 encoded
}

// ParseFilePayload 解析文件操作载荷
func ParseFilePayload(data []byte) (*FilePayload, error) {
	var payload FilePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 File 载荷失败: %w", err)
	}
	return &payload, nil
}

// TxPayload 事务操作载荷
type TxPayload struct {
	TxID string `json:"txId"`
}

// ParseTxPayload 解析事务操作载荷
func ParseTxPayload(data []byte) (*TxPayload, error) {
	var payload TxPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 Tx 载荷失败: %w", err)
	}
	return &payload, nil
}

// UtilsPayload 工具函数载荷
type UtilsPayload struct {
	Func  string `json:"func"`  // uuid, hash, randomString
	Input string `json:"input"` // 输入参数
	Len   int    `json:"len"`   // 长度参数
}

// ParseUtilsPayload 解析工具函数载荷
func ParseUtilsPayload(data []byte) (*UtilsPayload, error) {
	var payload UtilsPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 Utils 载荷失败: %w", err)
	}
	return &payload, nil
}
