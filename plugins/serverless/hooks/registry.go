// Package hooks 提供 Serverless Hook 注册和管理
package hooks

import (
	"sync"
)

// HookType Hook 类型
type HookType string

const (
	HookTypeBeforeCreate HookType = "beforeCreate"
	HookTypeAfterCreate  HookType = "afterCreate"
	HookTypeBeforeUpdate HookType = "beforeUpdate"
	HookTypeAfterUpdate  HookType = "afterUpdate"
	HookTypeBeforeDelete HookType = "beforeDelete"
	HookTypeAfterDelete  HookType = "afterDelete"
)

// Record 表示一条记录
type Record struct {
	ID   string
	Data map[string]interface{}
}

// Get 获取字段值
func (r *Record) Get(field string) interface{} {
	return r.Data[field]
}

// Set 设置字段值
func (r *Record) Set(field string, value interface{}) {
	if r.Data == nil {
		r.Data = make(map[string]interface{})
	}
	r.Data[field] = value
}

// RecordEvent 记录事件
type RecordEvent struct {
	Record     *Record
	Collection string
	Auth       *Record
}

// HookError Hook 错误
type HookError struct {
	Message string
}

func (e *HookError) Error() string {
	return e.Message
}

// HookHandler Hook 处理函数
type HookHandler func(e *RecordEvent) error

// hookEntry Hook 条目
type hookEntry struct {
	Collection string
	Type       HookType
	Handler    HookHandler
}

// Registry Hook 注册表
type Registry struct {
	hooks []hookEntry
	mutex sync.RWMutex
}

// NewRegistry 创建新的 Hook 注册表
func NewRegistry() *Registry {
	return &Registry{
		hooks: []hookEntry{},
	}
}

// register 注册 Hook
func (r *Registry) register(collection string, hookType HookType, handler HookHandler) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.hooks = append(r.hooks, hookEntry{
		Collection: collection,
		Type:       hookType,
		Handler:    handler,
	})
}

// OnRecordBeforeCreate 注册 BeforeCreate Hook
func (r *Registry) OnRecordBeforeCreate(collection string, handler HookHandler) {
	r.register(collection, HookTypeBeforeCreate, handler)
}

// OnRecordAfterCreate 注册 AfterCreate Hook
func (r *Registry) OnRecordAfterCreate(collection string, handler HookHandler) {
	r.register(collection, HookTypeAfterCreate, handler)
}

// OnRecordBeforeUpdate 注册 BeforeUpdate Hook
func (r *Registry) OnRecordBeforeUpdate(collection string, handler HookHandler) {
	r.register(collection, HookTypeBeforeUpdate, handler)
}

// OnRecordAfterUpdate 注册 AfterUpdate Hook
func (r *Registry) OnRecordAfterUpdate(collection string, handler HookHandler) {
	r.register(collection, HookTypeAfterUpdate, handler)
}

// OnRecordBeforeDelete 注册 BeforeDelete Hook
func (r *Registry) OnRecordBeforeDelete(collection string, handler HookHandler) {
	r.register(collection, HookTypeBeforeDelete, handler)
}

// OnRecordAfterDelete 注册 AfterDelete Hook
func (r *Registry) OnRecordAfterDelete(collection string, handler HookHandler) {
	r.register(collection, HookTypeAfterDelete, handler)
}

// GetHooks 获取指定集合和类型的所有 Hooks
func (r *Registry) GetHooks(collection string, hookType HookType) []HookHandler {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	handlers := []HookHandler{}
	for _, entry := range r.hooks {
		if entry.Collection == collection && entry.Type == hookType {
			handlers = append(handlers, entry.Handler)
		}
	}
	return handlers
}

// Execute 执行 Hook 链
func (r *Registry) Execute(collection string, hookType HookType, event *RecordEvent) error {
	handlers := r.GetHooks(collection, hookType)

	for _, handler := range handlers {
		if err := handler(event); err != nil {
			return err
		}
	}

	return nil
}
