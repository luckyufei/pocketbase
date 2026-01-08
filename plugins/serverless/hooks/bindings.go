// Package hooks 提供 Serverless Hook 注册和管理
package hooks

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// ServerlessHookBinding Serverless Hook 绑定
type ServerlessHookBinding struct {
	app      core.App
	pool     *runtime.Pool
	registry *Registry
	mutex    sync.RWMutex
}

// NewServerlessHookBinding 创建新的 Serverless Hook 绑定
func NewServerlessHookBinding(app core.App, pool *runtime.Pool) *ServerlessHookBinding {
	return &ServerlessHookBinding{
		app:      app,
		pool:     pool,
		registry: NewRegistry(),
	}
}

// BindHooks 绑定所有已注册的 Hooks 到 PocketBase
func (b *ServerlessHookBinding) BindHooks() {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	// 遍历所有已注册的 hooks，绑定到 core.App
	for _, entry := range b.registry.hooks {
		b.bindSingleHook(entry)
	}
}

// bindSingleHook 绑定单个 Hook
func (b *ServerlessHookBinding) bindSingleHook(entry hookEntry) {
	collection := entry.Collection
	hookType := entry.Type
	handler := entry.Handler

	switch hookType {
	case HookTypeBeforeCreate:
		b.app.OnRecordCreate(collection).BindFunc(func(e *core.RecordEvent) error {
			return b.executeServerlessHook(e, handler)
		})
	case HookTypeAfterCreate:
		b.app.OnRecordAfterCreateSuccess(collection).BindFunc(func(e *core.RecordEvent) error {
			return b.executeServerlessHook(e, handler)
		})
	case HookTypeBeforeUpdate:
		b.app.OnRecordUpdate(collection).BindFunc(func(e *core.RecordEvent) error {
			return b.executeServerlessHook(e, handler)
		})
	case HookTypeAfterUpdate:
		b.app.OnRecordAfterUpdateSuccess(collection).BindFunc(func(e *core.RecordEvent) error {
			return b.executeServerlessHook(e, handler)
		})
	case HookTypeBeforeDelete:
		b.app.OnRecordDelete(collection).BindFunc(func(e *core.RecordEvent) error {
			return b.executeServerlessHook(e, handler)
		})
	case HookTypeAfterDelete:
		b.app.OnRecordAfterDeleteSuccess(collection).BindFunc(func(e *core.RecordEvent) error {
			return b.executeServerlessHook(e, handler)
		})
	}
}

// executeServerlessHook 执行 Serverless Hook
func (b *ServerlessHookBinding) executeServerlessHook(e *core.RecordEvent, handler HookHandler) error {
	// 构建 RecordEvent
	event := &RecordEvent{
		Record: &Record{
			ID:   e.Record.Id,
			Data: e.Record.PublicExport(),
		},
		Collection: e.Record.Collection().Name,
	}

	// 执行 Hook
	if err := handler(event); err != nil {
		return err
	}

	// 同步修改回 core.Record（仅 before hooks）
	if event.Record != nil && event.Record.Data != nil {
		for key, value := range event.Record.Data {
			if key != "id" && key != "created" && key != "updated" {
				e.Record.Set(key, value)
			}
		}
	}

	return e.Next()
}

// Registry 返回 Hook 注册表
func (b *ServerlessHookBinding) Registry() *Registry {
	return b.registry
}

// JSHookBinding JS Hook 绑定（用于从 JS 代码注册 hooks）
type JSHookBinding struct {
	app      core.App
	pool     *runtime.Pool
	handlers map[string][]jsHookHandler
	mutex    sync.RWMutex
}

// jsHookHandler JS Hook 处理器
type jsHookHandler struct {
	Collection string
	HookType   HookType
	Code       string // JS 代码
	ModulePath string // 模块路径
}

// NewJSHookBinding 创建新的 JS Hook 绑定
func NewJSHookBinding(app core.App, pool *runtime.Pool) *JSHookBinding {
	return &JSHookBinding{
		app:      app,
		pool:     pool,
		handlers: make(map[string][]jsHookHandler),
	}
}

// RegisterHook 注册 JS Hook
func (b *JSHookBinding) RegisterHook(collection string, hookType HookType, code string, modulePath string) {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	key := fmt.Sprintf("%s:%s", collection, hookType)
	b.handlers[key] = append(b.handlers[key], jsHookHandler{
		Collection: collection,
		HookType:   hookType,
		Code:       code,
		ModulePath: modulePath,
	})
}

// BindAllHooks 绑定所有 JS Hooks 到 PocketBase
func (b *JSHookBinding) BindAllHooks() {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	for _, handlers := range b.handlers {
		for _, h := range handlers {
			b.bindJSHook(h)
		}
	}
}

// bindJSHook 绑定单个 JS Hook
func (b *JSHookBinding) bindJSHook(h jsHookHandler) {
	collection := h.Collection
	hookType := h.HookType
	code := h.Code

	handlerFunc := func(e *core.RecordEvent) error {
		return b.executeJSHook(e, code)
	}

	switch hookType {
	case HookTypeBeforeCreate:
		b.app.OnRecordCreate(collection).Bind(&hook.Handler[*core.RecordEvent]{
			Id:   fmt.Sprintf("serverless:%s:%s", collection, hookType),
			Func: handlerFunc,
		})
	case HookTypeAfterCreate:
		b.app.OnRecordAfterCreateSuccess(collection).Bind(&hook.Handler[*core.RecordEvent]{
			Id:   fmt.Sprintf("serverless:%s:%s", collection, hookType),
			Func: handlerFunc,
		})
	case HookTypeBeforeUpdate:
		b.app.OnRecordUpdate(collection).Bind(&hook.Handler[*core.RecordEvent]{
			Id:   fmt.Sprintf("serverless:%s:%s", collection, hookType),
			Func: handlerFunc,
		})
	case HookTypeAfterUpdate:
		b.app.OnRecordAfterUpdateSuccess(collection).Bind(&hook.Handler[*core.RecordEvent]{
			Id:   fmt.Sprintf("serverless:%s:%s", collection, hookType),
			Func: handlerFunc,
		})
	case HookTypeBeforeDelete:
		b.app.OnRecordDelete(collection).Bind(&hook.Handler[*core.RecordEvent]{
			Id:   fmt.Sprintf("serverless:%s:%s", collection, hookType),
			Func: handlerFunc,
		})
	case HookTypeAfterDelete:
		b.app.OnRecordAfterDeleteSuccess(collection).Bind(&hook.Handler[*core.RecordEvent]{
			Id:   fmt.Sprintf("serverless:%s:%s", collection, hookType),
			Func: handlerFunc,
		})
	}
}

// executeJSHook 执行 JS Hook
func (b *JSHookBinding) executeJSHook(e *core.RecordEvent, code string) error {
	ctx := context.Background()

	// 检查 pool 是否为 nil
	if b.pool == nil {
		return fmt.Errorf("pool is nil")
	}

	// 获取运行时实例
	engine, err := b.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("failed to acquire runtime: %w", err)
	}
	defer b.pool.Release(engine)

	// 构建事件数据
	eventData := map[string]any{
		"record": e.Record.PublicExport(),
		"collection": map[string]any{
			"name": e.Record.Collection().Name,
			"id":   e.Record.Collection().Id,
		},
		"type": e.Type,
	}

	eventJSON, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// 构建执行代码
	execCode := fmt.Sprintf(`
		(async function() {
			const event = %s;
			const handler = %s;
			await handler(event);
			return JSON.stringify(event.record);
		})()
	`, string(eventJSON), code)

	// 执行 JS 代码
	result, err := engine.Execute(ctx, execCode, runtime.DefaultRuntimeConfig())
	if err != nil {
		return fmt.Errorf("hook execution failed: %w", err)
	}

	// 解析结果并同步回 Record
	var updatedRecord map[string]any
	if err := json.Unmarshal([]byte(result.Value), &updatedRecord); err == nil {
		for key, value := range updatedRecord {
			if key != "id" && key != "created" && key != "updated" {
				e.Record.Set(key, value)
			}
		}
	}

	return e.Next()
}
