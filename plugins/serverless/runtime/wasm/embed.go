// Package wasm 提供 QuickJS WASM 运行时的嵌入和加载
//
// 此包负责：
// 1. 嵌入预编译的 pb_runtime.wasm 二进制文件
// 2. 提供 WASM 模块的加载和编译接口
// 3. 管理 WASM 模块的生命周期
package wasm

import (
	"context"
	_ "embed"
	"fmt"
	"sync"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
)

// 嵌入预编译的 QuickJS WASM 运行时
// 此文件由 wasi-sdk 编译 QuickJS + pb_bridge.c + bootloader.c 生成
//
//go:embed pb_runtime.wasm
var runtimeWasm []byte

// RuntimeWasm 返回嵌入的 WASM 二进制
func RuntimeWasm() []byte {
	return runtimeWasm
}

// CompiledModule 缓存已编译的 WASM 模块
type CompiledModule struct {
	mu       sync.RWMutex
	compiled wazero.CompiledModule
	runtime  wazero.Runtime
}

var (
	// 全局编译缓存
	globalCache     *CompiledModule
	globalCacheMu   sync.Mutex
	globalCacheInit sync.Once
)

// GetCompiledModule 获取或编译 WASM 模块（带缓存）
func GetCompiledModule(ctx context.Context, r wazero.Runtime) (wazero.CompiledModule, error) {
	globalCacheMu.Lock()
	defer globalCacheMu.Unlock()

	if globalCache != nil && globalCache.runtime == r {
		globalCache.mu.RLock()
		defer globalCache.mu.RUnlock()
		return globalCache.compiled, nil
	}

	// 编译 WASM 模块
	compiled, err := r.CompileModule(ctx, runtimeWasm)
	if err != nil {
		return nil, fmt.Errorf("编译 WASM 模块失败: %w", err)
	}

	globalCache = &CompiledModule{
		compiled: compiled,
		runtime:  r,
	}

	return compiled, nil
}

// ClearCache 清除编译缓存
func ClearCache() {
	globalCacheMu.Lock()
	defer globalCacheMu.Unlock()
	globalCache = nil
}

// ModuleConfig 模块配置
type ModuleConfig struct {
	// MaxMemoryPages 最大内存页数（每页 64KB）
	MaxMemoryPages uint32

	// Name 模块名称
	Name string
}

// DefaultModuleConfig 返回默认配置
func DefaultModuleConfig() ModuleConfig {
	return ModuleConfig{
		MaxMemoryPages: 2048, // 128MB
		Name:           "pb_runtime",
	}
}

// Instance 表示一个 WASM 实例
type Instance struct {
	Module api.Module
	Memory api.Memory
}

// InstantiateModule 实例化 WASM 模块
func InstantiateModule(ctx context.Context, r wazero.Runtime, compiled wazero.CompiledModule, config ModuleConfig) (*Instance, error) {
	// 创建模块配置
	modConfig := wazero.NewModuleConfig().
		WithName(config.Name)

	// 实例化模块
	mod, err := r.InstantiateModule(ctx, compiled, modConfig)
	if err != nil {
		return nil, fmt.Errorf("实例化 WASM 模块失败: %w", err)
	}

	return &Instance{
		Module: mod,
		Memory: mod.Memory(),
	}, nil
}

// Close 关闭实例
func (i *Instance) Close(ctx context.Context) error {
	if i.Module != nil {
		return i.Module.Close(ctx)
	}
	return nil
}

// ReadString 从 WASM 内存读取字符串
func (i *Instance) ReadString(ptr, length uint32) (string, bool) {
	if i.Memory == nil {
		return "", false
	}
	data, ok := i.Memory.Read(ptr, length)
	if !ok {
		return "", false
	}
	return string(data), true
}

// WriteString 向 WASM 内存写入字符串
func (i *Instance) WriteString(ptr uint32, s string) bool {
	if i.Memory == nil {
		return false
	}
	return i.Memory.Write(ptr, []byte(s))
}

// ReadBytes 从 WASM 内存读取字节
func (i *Instance) ReadBytes(ptr, length uint32) ([]byte, bool) {
	if i.Memory == nil {
		return nil, false
	}
	return i.Memory.Read(ptr, length)
}

// WriteBytes 向 WASM 内存写入字节
func (i *Instance) WriteBytes(ptr uint32, data []byte) bool {
	if i.Memory == nil {
		return false
	}
	return i.Memory.Write(ptr, data)
}
