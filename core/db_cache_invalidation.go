// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"sync"
)

// InvalidationHandler 单个集合的失效处理函数
type InvalidationHandler func(recordID string)

// GlobalInvalidationHandler 全局失效处理函数
type GlobalInvalidationHandler func(collection, recordID string)

// CacheInvalidator 缓存失效管理器
type CacheInvalidator struct {
	pubsub           *PubSubManager
	handlers         map[string][]InvalidationHandler
	globalHandlers   []GlobalInvalidationHandler
	mu               sync.RWMutex
	subscriptionID   string
}

// NewCacheInvalidator 创建新的缓存失效器
func NewCacheInvalidator(pubsub *PubSubManager) *CacheInvalidator {
	return &CacheInvalidator{
		pubsub:   pubsub,
		handlers: make(map[string][]InvalidationHandler),
	}
}

// OnInvalidate 注册特定集合的失效处理器
func (c *CacheInvalidator) OnInvalidate(collection string, handler InvalidationHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[collection] = append(c.handlers[collection], handler)
}

// OnInvalidateAll 注册全局失效处理器
func (c *CacheInvalidator) OnInvalidateAll(handler GlobalInvalidationHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.globalHandlers = append(c.globalHandlers, handler)
}

// Start 启动缓存失效监听
func (c *CacheInvalidator) Start(ctx context.Context) error {
	// 订阅缓存失效频道
	c.subscriptionID = c.pubsub.Subscribe(ChannelCacheInvalidation, func(payload EventPayload) {
		c.handleInvalidation(payload)
	})

	// 等待上下文取消
	<-ctx.Done()

	// 取消订阅
	if c.subscriptionID != "" {
		c.pubsub.Unsubscribe(c.subscriptionID)
	}

	return ctx.Err()
}

// handleInvalidation 处理失效事件
func (c *CacheInvalidator) handleInvalidation(payload EventPayload) {
	// 忽略来自本节点的事件
	if payload.NodeID == c.pubsub.NodeID() {
		return
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	// 调用特定集合的处理器
	if handlers, ok := c.handlers[payload.Collection]; ok {
		for _, handler := range handlers {
			go handler(payload.RecordID)
		}
	}

	// 调用全局处理器
	for _, handler := range c.globalHandlers {
		go handler(payload.Collection, payload.RecordID)
	}
}

// InvalidateRecord 发送单个记录的失效通知
func (c *CacheInvalidator) InvalidateRecord(ctx context.Context, collection, recordID string) error {
	return c.pubsub.PublishCacheInvalidation(ctx, collection, recordID)
}

// InvalidateRecords 发送多个记录的失效通知
func (c *CacheInvalidator) InvalidateRecords(ctx context.Context, collection string, recordIDs []string) error {
	for _, recordID := range recordIDs {
		if err := c.InvalidateRecord(ctx, collection, recordID); err != nil {
			return err
		}
	}
	return nil
}

// InvalidateCollection 发送整个集合的失效通知
func (c *CacheInvalidator) InvalidateCollection(ctx context.Context, collection string) error {
	// 使用特殊的 recordID 表示整个集合
	return c.pubsub.PublishCacheInvalidation(ctx, collection, "*")
}

// ClearHandlers 清除所有处理器
func (c *CacheInvalidator) ClearHandlers() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers = make(map[string][]InvalidationHandler)
	c.globalHandlers = nil
}
