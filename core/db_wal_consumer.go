// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ============================================================================
// T-5.1.1: WAL 消费者配置和类型定义
// ============================================================================

// WALChangeType WAL 变更类型
type WALChangeType int

const (
	// WALChangeInsert INSERT 操作
	WALChangeInsert WALChangeType = iota
	// WALChangeUpdate UPDATE 操作
	WALChangeUpdate
	// WALChangeDelete DELETE 操作
	WALChangeDelete
	// WALChangeBegin 事务开始
	WALChangeBegin
	// WALChangeCommit 事务提交
	WALChangeCommit
	// WALChangeTruncate TRUNCATE 操作
	WALChangeTruncate
)

// String 返回变更类型的字符串表示
func (t WALChangeType) String() string {
	switch t {
	case WALChangeInsert:
		return "INSERT"
	case WALChangeUpdate:
		return "UPDATE"
	case WALChangeDelete:
		return "DELETE"
	case WALChangeBegin:
		return "BEGIN"
	case WALChangeCommit:
		return "COMMIT"
	case WALChangeTruncate:
		return "TRUNCATE"
	default:
		return "UNKNOWN"
	}
}

// WALChangeMessage WAL 变更消息
type WALChangeMessage struct {
	// Type 变更类型
	Type WALChangeType
	// Schema 模式名
	Schema string
	// Table 表名
	Table string
	// LSN 日志序列号
	LSN uint64
	// CommitTime 提交时间
	CommitTime time.Time
	// OldTuple 旧记录 (UPDATE/DELETE)
	OldTuple map[string]interface{}
	// NewTuple 新记录 (INSERT/UPDATE)
	NewTuple map[string]interface{}
	// RelationID 关系 ID
	RelationID uint32
}

// IsInsert 是否是 INSERT 操作
func (m *WALChangeMessage) IsInsert() bool {
	return m.Type == WALChangeInsert
}

// IsUpdate 是否是 UPDATE 操作
func (m *WALChangeMessage) IsUpdate() bool {
	return m.Type == WALChangeUpdate
}

// IsDelete 是否是 DELETE 操作
func (m *WALChangeMessage) IsDelete() bool {
	return m.Type == WALChangeDelete
}

// FullTableName 返回完整表名 (schema.table)
func (m *WALChangeMessage) FullTableName() string {
	if m.Schema == "" || m.Schema == "public" {
		return m.Table
	}
	return fmt.Sprintf("%s.%s", m.Schema, m.Table)
}

// WALConsumerConfig WAL 消费者配置
type WALConsumerConfig struct {
	// SlotName 复制槽名称
	SlotName string
	// PublicationName 发布名称
	PublicationName string
	// OutputPlugin 输出插件 (默认 pgoutput)
	OutputPlugin string
	// StandbyTimeout 备用超时时间
	StandbyTimeout time.Duration
	// HeartbeatInterval 心跳间隔
	HeartbeatInterval time.Duration
	// MaxReconnectAttempts 最大重连次数
	MaxReconnectAttempts int
	// ReconnectDelay 重连延迟
	ReconnectDelay time.Duration
}

// DefaultWALConsumerConfig 返回默认配置
func DefaultWALConsumerConfig() *WALConsumerConfig {
	return &WALConsumerConfig{
		SlotName:             "pocketbase_realtime",
		PublicationName:      "pocketbase_pub",
		OutputPlugin:         "pgoutput",
		StandbyTimeout:       10 * time.Second,
		HeartbeatInterval:    10 * time.Second,
		MaxReconnectAttempts: 5,
		ReconnectDelay:       5 * time.Second,
	}
}

// WALConsumerMetrics WAL 消费者指标
type WALConsumerMetrics struct {
	// MessagesReceived 接收的消息数
	MessagesReceived int64
	// MessagesProcessed 处理的消息数
	MessagesProcessed int64
	// MessagesSkipped 跳过的消息数
	MessagesSkipped int64
	// Errors 错误数
	Errors int64
	// LastMessageTime 最后消息时间
	LastMessageTime time.Time
	// LastLSN 最后 LSN
	LastLSN uint64
	// ReconnectCount 重连次数
	ReconnectCount int64
}

// WALConsumer WAL 消费者
type WALConsumer struct {
	config         *WALConsumerConfig
	messageHandler func(*WALChangeMessage) error
	errorHandler   func(error)
	metrics        *WALConsumerMetrics
	tableFilters   map[string]struct{}
	running        atomic.Bool
	stopCh         chan struct{}
	mu             sync.RWMutex
}

// NewWALConsumer 创建新的 WAL 消费者
func NewWALConsumer(config *WALConsumerConfig) *WALConsumer {
	if config == nil {
		config = DefaultWALConsumerConfig()
	}

	return &WALConsumer{
		config:       config,
		metrics:      &WALConsumerMetrics{},
		tableFilters: make(map[string]struct{}),
		stopCh:       make(chan struct{}),
	}
}

// ============================================================================
// T-5.1.2: 复制槽管理
// ============================================================================

// CreateSlotSQL 生成创建复制槽的 SQL
func (c *WALConsumer) CreateSlotSQL() string {
	return fmt.Sprintf(
		"SELECT pg_create_logical_replication_slot('%s', '%s')",
		c.config.SlotName,
		c.config.OutputPlugin,
	)
}

// DropSlotSQL 生成删除复制槽的 SQL
func (c *WALConsumer) DropSlotSQL() string {
	return fmt.Sprintf(
		"SELECT pg_drop_replication_slot('%s')",
		c.config.SlotName,
	)
}

// CheckSlotExistsSQL 生成检查复制槽是否存在的 SQL
func (c *WALConsumer) CheckSlotExistsSQL() string {
	return fmt.Sprintf(
		"SELECT EXISTS(SELECT 1 FROM pg_replication_slots WHERE slot_name = '%s')",
		c.config.SlotName,
	)
}

// ============================================================================
// 发布管理
// ============================================================================

// CreatePublicationSQL 生成创建发布的 SQL
// 如果 tables 为空，则创建 FOR ALL TABLES 的发布
func (c *WALConsumer) CreatePublicationSQL(tables []string) string {
	if len(tables) == 0 {
		return fmt.Sprintf(
			"CREATE PUBLICATION %s FOR ALL TABLES",
			c.config.PublicationName,
		)
	}

	return fmt.Sprintf(
		"CREATE PUBLICATION %s FOR TABLE %s",
		c.config.PublicationName,
		strings.Join(tables, ", "),
	)
}

// DropPublicationSQL 生成删除发布的 SQL
func (c *WALConsumer) DropPublicationSQL() string {
	return fmt.Sprintf(
		"DROP PUBLICATION IF EXISTS %s",
		c.config.PublicationName,
	)
}

// AddTableToPublicationSQL 生成添加表到发布的 SQL
func (c *WALConsumer) AddTableToPublicationSQL(table string) string {
	return fmt.Sprintf(
		"ALTER PUBLICATION %s ADD TABLE %s",
		c.config.PublicationName,
		table,
	)
}

// RemoveTableFromPublicationSQL 生成从发布移除表的 SQL
func (c *WALConsumer) RemoveTableFromPublicationSQL(table string) string {
	return fmt.Sprintf(
		"ALTER PUBLICATION %s DROP TABLE %s",
		c.config.PublicationName,
		table,
	)
}

// ============================================================================
// 复制连接
// ============================================================================

// BuildReplicationDSN 构建复制连接字符串
func (c *WALConsumer) BuildReplicationDSN(baseDSN string) string {
	if baseDSN == "" {
		return ""
	}

	// 检查是否已有参数
	if strings.Contains(baseDSN, "?") {
		return baseDSN + "&replication=database"
	}
	return baseDSN + "?replication=database"
}

// ============================================================================
// 消息处理
// ============================================================================

// OnMessage 设置消息处理器
func (c *WALConsumer) OnMessage(handler func(*WALChangeMessage) error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.messageHandler = handler
}

// OnError 设置错误处理器
func (c *WALConsumer) OnError(handler func(error)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.errorHandler = handler
}

// ============================================================================
// 表过滤
// ============================================================================

// AddTableFilter 添加表过滤器
func (c *WALConsumer) AddTableFilter(table string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tableFilters[table] = struct{}{}
}

// RemoveTableFilter 移除表过滤器
func (c *WALConsumer) RemoveTableFilter(table string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.tableFilters, table)
}

// ClearTableFilters 清空表过滤器
func (c *WALConsumer) ClearTableFilters() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tableFilters = make(map[string]struct{})
}

// ShouldProcessTable 检查是否应该处理该表
func (c *WALConsumer) ShouldProcessTable(table string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// 如果没有过滤器，处理所有表
	if len(c.tableFilters) == 0 {
		return true
	}

	_, ok := c.tableFilters[table]
	return ok
}

// ============================================================================
// 生命周期管理
// ============================================================================

// Start 启动 WAL 消费者
func (c *WALConsumer) Start(ctx context.Context, dsn string) error {
	if dsn == "" {
		return errors.New("DSN 不能为空")
	}

	if c.running.Load() {
		return errors.New("消费者已在运行")
	}

	// 构建复制连接字符串
	replDSN := c.BuildReplicationDSN(dsn)
	if replDSN == "" {
		return errors.New("无法构建复制连接字符串")
	}

	c.running.Store(true)
	c.stopCh = make(chan struct{})

	// TODO: 实际的 pglogrepl 连接逻辑将在后续任务中实现
	// 这里只是框架代码

	return nil
}

// Stop 停止 WAL 消费者
func (c *WALConsumer) Stop() error {
	if !c.running.Load() {
		return nil
	}

	c.running.Store(false)
	close(c.stopCh)

	return nil
}

// IsRunning 检查消费者是否正在运行
func (c *WALConsumer) IsRunning() bool {
	return c.running.Load()
}

// ============================================================================
// 指标
// ============================================================================

// Metrics 获取指标副本
func (c *WALConsumer) Metrics() *WALConsumerMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return &WALConsumerMetrics{
		MessagesReceived:  c.metrics.MessagesReceived,
		MessagesProcessed: c.metrics.MessagesProcessed,
		MessagesSkipped:   c.metrics.MessagesSkipped,
		Errors:            c.metrics.Errors,
		LastMessageTime:   c.metrics.LastMessageTime,
		LastLSN:           c.metrics.LastLSN,
		ReconnectCount:    c.metrics.ReconnectCount,
	}
}

// ResetMetrics 重置指标
func (c *WALConsumer) ResetMetrics() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.metrics = &WALConsumerMetrics{}
}

// incrementMessagesReceived 增加接收消息计数
func (c *WALConsumer) incrementMessagesReceived() {
	atomic.AddInt64(&c.metrics.MessagesReceived, 1)
}

// incrementMessagesProcessed 增加处理消息计数
func (c *WALConsumer) incrementMessagesProcessed() {
	atomic.AddInt64(&c.metrics.MessagesProcessed, 1)
}

// incrementMessagesSkipped 增加跳过消息计数
func (c *WALConsumer) incrementMessagesSkipped() {
	atomic.AddInt64(&c.metrics.MessagesSkipped, 1)
}

// incrementErrors 增加错误计数
func (c *WALConsumer) incrementErrors() {
	atomic.AddInt64(&c.metrics.Errors, 1)
}
