// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// HookExecutionMode 定义 Hook 执行模式
type HookExecutionMode string

const (
	// HookModeLocal 仅本地执行
	HookModeLocal HookExecutionMode = "local"
	// HookModeBroadcast 广播到所有节点执行
	HookModeBroadcast HookExecutionMode = "broadcast"
	// HookModeCompete 竞争消费模式（只有一个节点执行）
	HookModeCompete HookExecutionMode = "compete"
)

// Hook 频道
const (
	ChannelHookEvents = "pb_hook_events"
)

// HookHandler Hook 处理函数
type HookHandler func(ctx context.Context, data map[string]any) error

// HookPayload Hook 事件负载
type HookPayload struct {
	NodeID    string            `json:"node_id"`
	EventName string            `json:"event_name"`
	Mode      HookExecutionMode `json:"mode"`
	Data      map[string]any    `json:"data,omitempty"`
	Timestamp int64             `json:"timestamp"`
}

// HookRetryConfig Hook 重试配置
type HookRetryConfig struct {
	MaxRetries   int
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Multiplier   float64
}

// DefaultHookRetryConfig 返回默认重试配置
func DefaultHookRetryConfig() HookRetryConfig {
	return HookRetryConfig{
		MaxRetries:   3,
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     5 * time.Second,
		Multiplier:   2.0,
	}
}

// RetryableError 可重试错误
type RetryableError struct {
	Message string
	Cause   error
}

func (e *RetryableError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

// hookRegistration Hook 注册信息
type hookRegistration struct {
	name    string
	mode    HookExecutionMode
	handler HookHandler
}

// DistributedHookManager 分布式 Hook 管理器
type DistributedHookManager struct {
	pubsub         *PubSubManager
	hooks          map[string]*hookRegistration
	mu             sync.RWMutex
	retryConfig    HookRetryConfig
	subscriptionID string
}

// NewDistributedHookManager 创建新的分布式 Hook 管理器
func NewDistributedHookManager(pubsub *PubSubManager) *DistributedHookManager {
	return &DistributedHookManager{
		pubsub:      pubsub,
		hooks:       make(map[string]*hookRegistration),
		retryConfig: DefaultHookRetryConfig(),
	}
}

// SetRetryConfig 设置重试配置
func (m *DistributedHookManager) SetRetryConfig(config HookRetryConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.retryConfig = config
}

// RegisterHook 注册 Hook
func (m *DistributedHookManager) RegisterHook(eventName string, mode HookExecutionMode, handler HookHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.hooks[eventName] = &hookRegistration{
		name:    eventName,
		mode:    mode,
		handler: handler,
	}
}

// UnregisterHook 取消注册 Hook
func (m *DistributedHookManager) UnregisterHook(eventName string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.hooks, eventName)
}

// TriggerHook 触发 Hook
func (m *DistributedHookManager) TriggerHook(ctx context.Context, eventName string, data map[string]any) error {
	m.mu.RLock()
	hook, ok := m.hooks[eventName]
	m.mu.RUnlock()

	if !ok {
		return nil // 没有注册的 Hook
	}

	switch hook.mode {
	case HookModeLocal:
		// 仅本地执行
		return hook.handler(ctx, data)

	case HookModeBroadcast:
		// 先本地执行
		if err := hook.handler(ctx, data); err != nil {
			return err
		}
		// 然后广播到其他节点
		return m.broadcastHook(ctx, eventName, data)

	case HookModeCompete:
		// 竞争模式：尝试获取锁，成功则执行
		// 简化实现：本地直接执行，实际应该使用分布式锁
		return hook.handler(ctx, data)

	default:
		return hook.handler(ctx, data)
	}
}

// TriggerHookWithRetry 带重试的触发 Hook
func (m *DistributedHookManager) TriggerHookWithRetry(ctx context.Context, eventName string, data map[string]any) error {
	m.mu.RLock()
	config := m.retryConfig
	m.mu.RUnlock()

	var lastErr error
	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		err := m.TriggerHook(ctx, eventName, data)
		if err == nil {
			return nil
		}

		// 检查是否为可重试错误
		if _, ok := err.(*RetryableError); !ok {
			return err
		}

		lastErr = err

		if attempt < config.MaxRetries {
			delay := config.getDelay(attempt + 1)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
				// 继续重试
			}
		}
	}

	return fmt.Errorf("达到最大重试次数 (%d): %w", config.MaxRetries, lastErr)
}

// broadcastHook 广播 Hook 到其他节点
func (m *DistributedHookManager) broadcastHook(ctx context.Context, eventName string, data map[string]any) error {
	if m.pubsub == nil || m.pubsub.db == nil {
		return nil // mock 模式
	}

	payload := HookPayload{
		NodeID:    m.pubsub.NodeID(),
		EventName: eventName,
		Mode:      HookModeBroadcast,
		Data:      data,
		Timestamp: time.Now().Unix(),
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("序列化 Hook payload 失败: %w", err)
	}

	_, err = m.pubsub.db.NewQuery(fmt.Sprintf("SELECT pg_notify('%s', :payload)", ChannelHookEvents)).
		Bind(map[string]any{"payload": string(jsonData)}).
		WithContext(ctx).
		Execute()

	return err
}

// Start 启动 Hook 监听
func (m *DistributedHookManager) Start(ctx context.Context) error {
	// 订阅 Hook 事件频道
	m.subscriptionID = m.pubsub.Subscribe(ChannelHookEvents, func(payload EventPayload) {
		// 解析 Hook payload
		var hookPayload HookPayload
		if data, ok := payload.Data["raw"].(string); ok {
			json.Unmarshal([]byte(data), &hookPayload)
		}
		m.handleRemoteHook(hookPayload)
	})

	<-ctx.Done()

	if m.subscriptionID != "" {
		m.pubsub.Unsubscribe(m.subscriptionID)
	}

	return ctx.Err()
}

// handleRemoteHook 处理远程 Hook 事件
func (m *DistributedHookManager) handleRemoteHook(payload HookPayload) {
	// 忽略自己发送的事件
	if payload.NodeID == m.pubsub.NodeID() {
		return
	}

	m.mu.RLock()
	hook, ok := m.hooks[payload.EventName]
	m.mu.RUnlock()

	if !ok {
		return
	}

	// 只处理广播模式的远程事件
	if payload.Mode == HookModeBroadcast {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			hook.handler(ctx, payload.Data)
		}()
	}
}

// getDelay 计算重试延迟
func (c HookRetryConfig) getDelay(attempt int) time.Duration {
	if attempt <= 0 {
		return c.InitialDelay
	}

	delay := c.InitialDelay
	for i := 1; i < attempt; i++ {
		delay = time.Duration(float64(delay) * c.Multiplier)
		if delay > c.MaxDelay {
			return c.MaxDelay
		}
	}
	return delay
}
