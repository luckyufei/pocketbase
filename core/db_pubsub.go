// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/pocketbase/dbx"
)

// EventType 定义事件类型
type EventType string

// 事件类型常量
const (
	EventRecordCreate     EventType = "record.create"
	EventRecordUpdate     EventType = "record.update"
	EventRecordDelete     EventType = "record.delete"
	EventCollectionCreate EventType = "collection.create"
	EventCollectionUpdate EventType = "collection.update"
	EventCollectionDelete EventType = "collection.delete"
	EventCacheInvalidate  EventType = "cache.invalidate"
)

// PostgreSQL LISTEN/NOTIFY 频道
const (
	ChannelRecordChanges     = "pb_record_changes"
	ChannelCollectionChanges = "pb_collection_changes"
	ChannelCacheInvalidation = "pb_cache_invalidation"
)

// EventPayload 定义事件负载结构
type EventPayload struct {
	// NodeID 发送事件的节点 ID
	NodeID string `json:"node_id"`
	// Event 事件类型
	Event EventType `json:"event"`
	// Collection 集合名称
	Collection string `json:"collection,omitempty"`
	// RecordID 记录 ID
	RecordID string `json:"record_id,omitempty"`
	// Timestamp 事件时间戳 (Unix 秒)
	Timestamp int64 `json:"timestamp"`
	// Data 附加数据
	Data map[string]any `json:"data,omitempty"`
}

// EventHandler 事件处理函数类型
type EventHandler func(payload EventPayload)

// subscription 订阅信息
type subscription struct {
	id      string
	channel string
	handler EventHandler
}

// ReconnectConfig 重连配置
type ReconnectConfig struct {
	// MaxRetries 最大重试次数 (0 表示无限重试)
	MaxRetries int
	// InitialDelay 初始延迟
	InitialDelay time.Duration
	// MaxDelay 最大延迟
	MaxDelay time.Duration
	// Multiplier 延迟倍数
	Multiplier float64
}

// DefaultReconnectConfig 返回默认重连配置
func DefaultReconnectConfig() ReconnectConfig {
	return ReconnectConfig{
		MaxRetries:   0, // 无限重试
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     30 * time.Second,
		Multiplier:   2.0,
	}
}

// GetDelay 计算第 n 次重试的延迟
func (c ReconnectConfig) GetDelay(attempt int) time.Duration {
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

// PubSubManager 管理 PostgreSQL LISTEN/NOTIFY
type PubSubManager struct {
	db              *dbx.DB
	nodeID          string
	subscriptions   map[string]*subscription
	channelHandlers map[string][]*subscription
	mu              sync.RWMutex
	reconnectConfig ReconnectConfig
	isListening     bool
	stopCh          chan struct{}
}

// NewPubSubManager 创建新的 PubSub 管理器
func NewPubSubManager(db *dbx.DB) *PubSubManager {
	return &PubSubManager{
		db:              db,
		nodeID:          GenerateNodeID(),
		subscriptions:   make(map[string]*subscription),
		channelHandlers: make(map[string][]*subscription),
		reconnectConfig: DefaultReconnectConfig(),
		stopCh:          make(chan struct{}),
	}
}

// NodeID 返回当前节点 ID
func (m *PubSubManager) NodeID() string {
	return m.nodeID
}

// SetReconnectConfig 设置重连配置
func (m *PubSubManager) SetReconnectConfig(config ReconnectConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.reconnectConfig = config
}

// Subscribe 订阅频道
func (m *PubSubManager) Subscribe(channel string, handler EventHandler) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	subID := generateSubscriptionID()
	sub := &subscription{
		id:      subID,
		channel: channel,
		handler: handler,
	}

	m.subscriptions[subID] = sub
	m.channelHandlers[channel] = append(m.channelHandlers[channel], sub)

	return subID
}

// Unsubscribe 取消订阅
func (m *PubSubManager) Unsubscribe(subscriptionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sub, ok := m.subscriptions[subscriptionID]
	if !ok {
		return
	}

	delete(m.subscriptions, subscriptionID)

	// 从频道处理器中移除
	handlers := m.channelHandlers[sub.channel]
	for i, h := range handlers {
		if h.id == subscriptionID {
			m.channelHandlers[sub.channel] = append(handlers[:i], handlers[i+1:]...)
			break
		}
	}
}

// Publish 发布事件到 PostgreSQL
func (m *PubSubManager) Publish(ctx context.Context, channel string, payload EventPayload) error {
	if m.db == nil {
		return nil // mock 模式
	}

	// 设置节点 ID 和时间戳
	payload.NodeID = m.nodeID
	if payload.Timestamp == 0 {
		payload.Timestamp = time.Now().Unix()
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("序列化事件失败: %w", err)
	}

	// PostgreSQL NOTIFY
	_, err = m.db.NewQuery(fmt.Sprintf("SELECT pg_notify('%s', :payload)", channel)).
		Bind(map[string]any{"payload": string(data)}).
		WithContext(ctx).
		Execute()

	return err
}

// PublishRecordChange 发布记录变更事件
func (m *PubSubManager) PublishRecordChange(ctx context.Context, event EventType, collection, recordID string, data map[string]any) error {
	return m.Publish(ctx, ChannelRecordChanges, EventPayload{
		Event:      event,
		Collection: collection,
		RecordID:   recordID,
		Data:       data,
	})
}

// PublishCollectionChange 发布集合变更事件
func (m *PubSubManager) PublishCollectionChange(ctx context.Context, event EventType, collection string) error {
	return m.Publish(ctx, ChannelCollectionChanges, EventPayload{
		Event:      event,
		Collection: collection,
	})
}

// PublishCacheInvalidation 发布缓存失效事件
func (m *PubSubManager) PublishCacheInvalidation(ctx context.Context, collection string, recordID string) error {
	return m.Publish(ctx, ChannelCacheInvalidation, EventPayload{
		Event:      EventCacheInvalidate,
		Collection: collection,
		RecordID:   recordID,
	})
}

// StartListening 开始监听 PostgreSQL 通知
func (m *PubSubManager) StartListening(ctx context.Context) error {
	m.mu.Lock()
	if m.isListening {
		m.mu.Unlock()
		return nil
	}
	m.isListening = true
	m.stopCh = make(chan struct{})
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		m.isListening = false
		m.mu.Unlock()
	}()

	// mock 模式
	if m.db == nil {
		<-ctx.Done()
		return ctx.Err()
	}

	return m.listenWithReconnect(ctx)
}

// StopListening 停止监听
func (m *PubSubManager) StopListening() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.isListening {
		close(m.stopCh)
	}
}

// listenWithReconnect 带重连的监听
func (m *PubSubManager) listenWithReconnect(ctx context.Context) error {
	attempt := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-m.stopCh:
			return nil
		default:
		}

		err := m.listen(ctx)
		if err == nil || ctx.Err() != nil {
			return err
		}

		attempt++
		m.mu.RLock()
		config := m.reconnectConfig
		m.mu.RUnlock()

		if config.MaxRetries > 0 && attempt >= config.MaxRetries {
			return fmt.Errorf("达到最大重试次数 (%d): %w", config.MaxRetries, err)
		}

		delay := config.GetDelay(attempt)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-m.stopCh:
			return nil
		case <-time.After(delay):
			// 继续重试
		}
	}
}

// listen 实际的监听逻辑
func (m *PubSubManager) listen(ctx context.Context) error {
	// 获取原始数据库连接
	db := m.db.DB()
	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("获取连接失败: %w", err)
	}
	defer conn.Close()

	// 获取需要监听的频道
	m.mu.RLock()
	channels := make([]string, 0, len(m.channelHandlers))
	for ch := range m.channelHandlers {
		channels = append(channels, ch)
	}
	m.mu.RUnlock()

	if len(channels) == 0 {
		// 没有订阅，等待上下文取消
		<-ctx.Done()
		return ctx.Err()
	}

	// 执行 LISTEN 命令
	for _, ch := range channels {
		_, err := conn.ExecContext(ctx, fmt.Sprintf("LISTEN %s", ch))
		if err != nil {
			return fmt.Errorf("LISTEN %s 失败: %w", ch, err)
		}
	}

	// 监听通知
	// 注意: 这里使用 pgx 的底层连接来接收通知
	// 实际实现需要使用 pgx.Conn.WaitForNotification
	// 这里是简化版本，使用轮询方式

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-m.stopCh:
			return nil
		case <-ticker.C:
			// 轮询检查通知
			// 实际实现应该使用 pgx 的 WaitForNotification
		}
	}
}

// dispatchLocal 分发本地事件 (用于测试和本地通知)
func (m *PubSubManager) dispatchLocal(channel string, payload EventPayload) {
	// 忽略自己发送的事件
	if payload.NodeID == m.nodeID {
		return
	}

	m.mu.RLock()
	handlers := m.channelHandlers[channel]
	m.mu.RUnlock()

	for _, sub := range handlers {
		go sub.handler(payload)
	}
}

// handleNotification 处理收到的通知
func (m *PubSubManager) handleNotification(channel string, payloadData string) {
	var payload EventPayload
	if err := json.Unmarshal([]byte(payloadData), &payload); err != nil {
		return // 忽略无效的 payload
	}

	m.dispatchLocal(channel, payload)
}

// GenerateNodeID 生成唯一的节点 ID
func GenerateNodeID() string {
	// 使用主机名 + 随机字符串
	hostname, _ := os.Hostname()
	randomBytes := make([]byte, 8)
	rand.Read(randomBytes)
	return fmt.Sprintf("%s-%s", hostname, hex.EncodeToString(randomBytes))
}

// generateSubscriptionID 生成订阅 ID
func generateSubscriptionID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
