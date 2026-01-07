// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
)

// ============================================================================
// T-5.1.6: 注入 Realtime 订阅管理器
// ============================================================================

// WALRealtimeConfig WAL Realtime 配置
type WALRealtimeConfig struct {
	// SlotName 复制槽名称
	SlotName string
	// PublicationName 发布名称
	PublicationName string
	// EnableWAL 是否启用 WAL 订阅
	EnableWAL bool
	// DSN 数据库连接字符串
	DSN string
	// HeartbeatInterval 心跳间隔
	HeartbeatInterval time.Duration
	// MaxReconnectAttempts 最大重连次数
	MaxReconnectAttempts int
}

// DefaultWALRealtimeConfig 返回默认配置
func DefaultWALRealtimeConfig() *WALRealtimeConfig {
	return &WALRealtimeConfig{
		SlotName:             "pocketbase_realtime",
		PublicationName:      "pocketbase_pub",
		EnableWAL:            true,
		HeartbeatInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
	}
}

// WALRealtimeMetrics WAL Realtime 指标
type WALRealtimeMetrics struct {
	// EventsReceived 接收的事件数
	EventsReceived int64
	// EventsDispatched 分发的事件数
	EventsDispatched int64
	// EventsFiltered 过滤的事件数
	EventsFiltered int64
	// SubscribersCount 订阅者数量
	SubscribersCount int64
	// LastEventTime 最后事件时间
	LastEventTime time.Time
}

// WALRealtimeEngine WAL Realtime 引擎
type WALRealtimeEngine struct {
	config            *WALRealtimeConfig
	consumer          *WALConsumer
	decoder           *WALMessageDecoder
	converter         *WALToRecordConverter
	dispatcher        *WALEventDispatcher
	subManager        *SubscriptionManager
	bridge            *WALSubscriptionBridge
	collectionFilters map[string]struct{}
	metrics           *WALRealtimeMetrics
	running           atomic.Bool
	stopCh            chan struct{}
	mu                sync.RWMutex
}

// NewWALRealtimeEngine 创建 WAL Realtime 引擎
func NewWALRealtimeEngine(config *WALRealtimeConfig) *WALRealtimeEngine {
	if config == nil {
		config = DefaultWALRealtimeConfig()
	}

	subManager := NewSubscriptionManager()

	engine := &WALRealtimeEngine{
		config:            config,
		decoder:           NewWALMessageDecoder(),
		converter:         NewWALToRecordConverter(),
		dispatcher:        NewWALEventDispatcher(),
		subManager:        subManager,
		bridge:            NewWALSubscriptionBridge(subManager),
		collectionFilters: make(map[string]struct{}),
		metrics:           &WALRealtimeMetrics{},
		stopCh:            make(chan struct{}),
	}

	// 创建 WAL 消费者
	if config.EnableWAL {
		consumerConfig := &WALConsumerConfig{
			SlotName:        config.SlotName,
			PublicationName: config.PublicationName,
		}
		engine.consumer = NewWALConsumer(consumerConfig)

		// 设置消息处理器
		engine.consumer.OnMessage(engine.handleWALMessage)
	}

	return engine
}

// Start 启动引擎
func (e *WALRealtimeEngine) Start(ctx context.Context) error {
	if e.running.Load() {
		return nil
	}

	e.running.Store(true)
	e.stopCh = make(chan struct{})

	// 如果启用 WAL，启动消费者
	if e.config.EnableWAL && e.consumer != nil && e.config.DSN != "" {
		if err := e.consumer.Start(ctx, e.config.DSN); err != nil {
			e.running.Store(false)
			return err
		}
	}

	return nil
}

// Stop 停止引擎
func (e *WALRealtimeEngine) Stop() error {
	if !e.running.Load() {
		return nil
	}

	e.running.Store(false)
	close(e.stopCh)

	// 停止 WAL 消费者
	if e.consumer != nil {
		if err := e.consumer.Stop(); err != nil {
			return err
		}
	}

	return nil
}

// IsRunning 检查引擎是否正在运行
func (e *WALRealtimeEngine) IsRunning() bool {
	return e.running.Load()
}

// handleWALMessage 处理 WAL 消息
func (e *WALRealtimeEngine) handleWALMessage(msg *WALChangeMessage) error {
	e.incrementEventsReceived()

	// 检查是否应该处理该集合
	if !e.ShouldProcessCollection(msg.Table) {
		e.incrementEventsFiltered()
		return nil
	}

	// 转换为 Record 事件
	event, err := e.converter.Convert(msg)
	if err != nil {
		return err
	}

	// 如果是 BEGIN/COMMIT 等不产生事件的消息，跳过
	if event == nil {
		return nil
	}

	// 分发事件
	e.dispatcher.Dispatch(event)

	// 路由到订阅者
	e.bridge.RouteEvent(event)

	e.incrementEventsDispatched()
	e.updateLastEventTime()

	return nil
}

// Subscribe 订阅集合
func (e *WALRealtimeEngine) Subscribe(sub *Subscriber) {
	e.subManager.Subscribe(sub)
	atomic.AddInt64(&e.metrics.SubscribersCount, 1)
}

// Unsubscribe 取消订阅
func (e *WALRealtimeEngine) Unsubscribe(id string) {
	e.subManager.Unsubscribe(id)
	atomic.AddInt64(&e.metrics.SubscribersCount, -1)
}

// GetSubscribers 获取集合的订阅者
func (e *WALRealtimeEngine) GetSubscribers(collection string) []*Subscriber {
	return e.subManager.GetSubscribers(collection)
}

// OnEvent 注册事件处理器
func (e *WALRealtimeEngine) OnEvent(collection string, handler func(*RealtimeRecordEvent)) string {
	return e.dispatcher.OnEvent(collection, handler)
}

// RemoveEventHandler 移除事件处理器
func (e *WALRealtimeEngine) RemoveEventHandler(id string) {
	e.dispatcher.RemoveHandler(id)
}

// AddCollectionFilter 添加集合过滤器
func (e *WALRealtimeEngine) AddCollectionFilter(collection string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.collectionFilters[collection] = struct{}{}
}

// RemoveCollectionFilter 移除集合过滤器
func (e *WALRealtimeEngine) RemoveCollectionFilter(collection string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.collectionFilters, collection)
}

// ClearCollectionFilters 清空集合过滤器
func (e *WALRealtimeEngine) ClearCollectionFilters() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.collectionFilters = make(map[string]struct{})
}

// ShouldProcessCollection 检查是否应该处理该集合
func (e *WALRealtimeEngine) ShouldProcessCollection(collection string) bool {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// 如果没有过滤器，处理所有集合
	if len(e.collectionFilters) == 0 {
		return true
	}

	_, ok := e.collectionFilters[collection]
	return ok
}

// Metrics 获取指标
func (e *WALRealtimeEngine) Metrics() *WALRealtimeMetrics {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return &WALRealtimeMetrics{
		EventsReceived:   atomic.LoadInt64(&e.metrics.EventsReceived),
		EventsDispatched: atomic.LoadInt64(&e.metrics.EventsDispatched),
		EventsFiltered:   atomic.LoadInt64(&e.metrics.EventsFiltered),
		SubscribersCount: atomic.LoadInt64(&e.metrics.SubscribersCount),
		LastEventTime:    e.metrics.LastEventTime,
	}
}

// incrementEventsReceived 增加接收事件计数
func (e *WALRealtimeEngine) incrementEventsReceived() {
	atomic.AddInt64(&e.metrics.EventsReceived, 1)
}

// incrementEventsDispatched 增加分发事件计数
func (e *WALRealtimeEngine) incrementEventsDispatched() {
	atomic.AddInt64(&e.metrics.EventsDispatched, 1)
}

// incrementEventsFiltered 增加过滤事件计数
func (e *WALRealtimeEngine) incrementEventsFiltered() {
	atomic.AddInt64(&e.metrics.EventsFiltered, 1)
}

// updateLastEventTime 更新最后事件时间
func (e *WALRealtimeEngine) updateLastEventTime() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.metrics.LastEventTime = time.Now()
}

// ============================================================================
// WAL 事件分发器
// ============================================================================

// WALEventDispatcher WAL 事件分发器
type WALEventDispatcher struct {
	handlers   map[string][]eventHandler
	nextID     int64
	mu         sync.RWMutex
}

type eventHandler struct {
	id       string
	handler  func(*RealtimeRecordEvent)
}

// NewWALEventDispatcher 创建事件分发器
func NewWALEventDispatcher() *WALEventDispatcher {
	return &WALEventDispatcher{
		handlers: make(map[string][]eventHandler),
	}
}

// OnEvent 注册事件处理器
// 返回处理器 ID，可用于移除
func (d *WALEventDispatcher) OnEvent(collection string, handler func(*RealtimeRecordEvent)) string {
	d.mu.Lock()
	defer d.mu.Unlock()

	id := d.generateID()
	d.handlers[collection] = append(d.handlers[collection], eventHandler{
		id:      id,
		handler: handler,
	})

	return id
}

// RemoveHandler 移除处理器
func (d *WALEventDispatcher) RemoveHandler(id string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	for collection, handlers := range d.handlers {
		for i, h := range handlers {
			if h.id == id {
				d.handlers[collection] = append(handlers[:i], handlers[i+1:]...)
				return
			}
		}
	}
}

// Dispatch 分发事件
func (d *WALEventDispatcher) Dispatch(event *RealtimeRecordEvent) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	// 分发到特定集合的处理器
	if handlers, ok := d.handlers[event.Collection]; ok {
		for _, h := range handlers {
			go h.handler(event)
		}
	}

	// 分发到通配符处理器
	if handlers, ok := d.handlers["*"]; ok {
		for _, h := range handlers {
			go h.handler(event)
		}
	}
}

// generateID 生成处理器 ID
func (d *WALEventDispatcher) generateID() string {
	id := atomic.AddInt64(&d.nextID, 1)
	return string(rune(id))
}

// ============================================================================
// WAL 订阅桥接
// ============================================================================

// WALSubscriptionBridge WAL 订阅桥接
type WALSubscriptionBridge struct {
	subManager *SubscriptionManager
	evaluator  *ViewRuleEvaluator
}

// NewWALSubscriptionBridge 创建订阅桥接
func NewWALSubscriptionBridge(subManager *SubscriptionManager) *WALSubscriptionBridge {
	return &WALSubscriptionBridge{
		subManager: subManager,
		evaluator:  NewViewRuleEvaluator(),
	}
}

// RouteEvent 路由事件到订阅者
func (b *WALSubscriptionBridge) RouteEvent(event *RealtimeRecordEvent) {
	// 获取该集合的所有订阅者
	subscribers := b.subManager.GetSubscribers(event.Collection)

	for _, sub := range subscribers {
		// TODO: 评估 ViewRule 决定是否发送
		// 目前简单地发送给所有订阅者

		// 非阻塞发送
		select {
		case sub.Channel <- event:
		default:
			// Channel 已满，跳过
		}
	}
}

// RouteEventWithFilter 带过滤的路由事件
func (b *WALSubscriptionBridge) RouteEventWithFilter(event *RealtimeRecordEvent, viewRule string) {
	subscribers := b.subManager.GetSubscribers(event.Collection)

	for _, sub := range subscribers {
		// 评估 ViewRule
		auth := &AuthContext{
			ID:   sub.UserID,
			Role: sub.Role,
		}

		allowed, err := b.evaluator.Evaluate(viewRule, event.Record, auth)
		if err != nil || !allowed {
			continue
		}

		// 非阻塞发送
		select {
		case sub.Channel <- event:
		default:
		}
	}
}
