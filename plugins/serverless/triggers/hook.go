// Package triggers 提供 Serverless 触发器实现
package triggers

import (
	"context"
	"time"
)

// RecordEvent 记录事件（用于 Hook 触发器）
type RecordEvent struct {
	Collection string         // 集合名称
	Action     string         // 操作类型: create, update, delete
	Phase      string         // 阶段: before, after
	Record     map[string]any // 记录数据
	Auth       map[string]any // 认证用户数据
}

// Get 获取记录字段值
func (e *RecordEvent) Get(field string) any {
	if e.Record == nil {
		return nil
	}
	return e.Record[field]
}

// Set 设置记录字段值
func (e *RecordEvent) Set(field string, value any) {
	if e.Record == nil {
		e.Record = make(map[string]any)
	}
	e.Record[field] = value
}

// HookHandler Hook 处理函数类型
type HookHandler func(e *RecordEvent) error

// HookTriggerConfig Hook 触发器配置
type HookTriggerConfig struct {
	Timeout int // 超时时间（毫秒）
}

// HookTrigger Hook 触发器
type HookTrigger struct {
	config HookTriggerConfig
}

// NewHookTrigger 创建新的 Hook 触发器
func NewHookTrigger(config HookTriggerConfig) *HookTrigger {
	if config.Timeout <= 0 {
		config.Timeout = 5000 // 默认 5 秒
	}
	return &HookTrigger{
		config: config,
	}
}

// Execute 执行单个 Hook
func (t *HookTrigger) Execute(ctx context.Context, event *RecordEvent, handler HookHandler) (*RecordEvent, error) {
	// 创建超时上下文
	timeout := time.Duration(t.config.Timeout) * time.Millisecond
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// 创建结果通道
	done := make(chan error, 1)

	go func() {
		done <- handler(event)
	}()

	select {
	case err := <-done:
		if err != nil {
			return nil, err
		}
		return event, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// ExecuteChain 执行 Hook 链
func (t *HookTrigger) ExecuteChain(ctx context.Context, event *RecordEvent, handlers []HookHandler) (*RecordEvent, error) {
	for _, handler := range handlers {
		result, err := t.Execute(ctx, event, handler)
		if err != nil {
			return nil, err
		}
		event = result
	}
	return event, nil
}

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

// ParseHookType 解析 Hook 类型
func ParseHookType(action, phase string) HookType {
	switch phase {
	case "before":
		switch action {
		case "create":
			return HookTypeBeforeCreate
		case "update":
			return HookTypeBeforeUpdate
		case "delete":
			return HookTypeBeforeDelete
		}
	case "after":
		switch action {
		case "create":
			return HookTypeAfterCreate
		case "update":
			return HookTypeAfterUpdate
		case "delete":
			return HookTypeAfterDelete
		}
	}
	return ""
}
