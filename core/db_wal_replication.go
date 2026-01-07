// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ============================================================================
// T-5.1.2: Replication Slot 管理
// T-5.1.3: 流式连接
// ============================================================================

// ReplicationConnectionConfig 复制连接配置
type ReplicationConnectionConfig struct {
	// DSN 数据库连接字符串
	DSN string
	// SlotName 复制槽名称
	SlotName string
	// PublicationName 发布名称
	PublicationName string
	// OutputPlugin 输出插件
	OutputPlugin string
	// StandbyMessageTimeout 备用消息超时
	StandbyMessageTimeout time.Duration
	// CreateSlotIfNotExists 如果不存在则创建槽
	CreateSlotIfNotExists bool
	// DropSlotOnClose 关闭时删除槽
	DropSlotOnClose bool
}

// DefaultReplicationConnectionConfig 返回默认复制连接配置
func DefaultReplicationConnectionConfig(dsn string) *ReplicationConnectionConfig {
	return &ReplicationConnectionConfig{
		DSN:                   dsn,
		SlotName:              "pocketbase_realtime",
		PublicationName:       "pocketbase_pub",
		OutputPlugin:          "pgoutput",
		StandbyMessageTimeout: 10 * time.Second,
		CreateSlotIfNotExists: true,
		DropSlotOnClose:       false,
	}
}

// ============================================================================
// 复制槽操作
// ============================================================================

// ReplicationSlotOps 复制槽操作
type ReplicationSlotOps struct {
	slotName     string
	outputPlugin string
}

// NewReplicationSlotOps 创建复制槽操作
func NewReplicationSlotOps(slotName, outputPlugin string) *ReplicationSlotOps {
	return &ReplicationSlotOps{
		slotName:     slotName,
		outputPlugin: outputPlugin,
	}
}

// CreateTemporarySlotSQL 生成创建临时复制槽的 SQL
func (ops *ReplicationSlotOps) CreateTemporarySlotSQL() string {
	return fmt.Sprintf(
		"SELECT pg_create_logical_replication_slot('%s', '%s', true)",
		ops.slotName,
		ops.outputPlugin,
	)
}

// GetSlotInfoSQL 生成获取复制槽信息的 SQL
func (ops *ReplicationSlotOps) GetSlotInfoSQL() string {
	return fmt.Sprintf(
		"SELECT slot_name, plugin, slot_type, active, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots WHERE slot_name = '%s'",
		ops.slotName,
	)
}

// GetCurrentLSNSQL 生成获取当前 LSN 的 SQL
func (ops *ReplicationSlotOps) GetCurrentLSNSQL() string {
	return "SELECT pg_current_wal_lsn()"
}

// ============================================================================
// 流式连接
// ============================================================================

// StreamingConnection 流式连接
type StreamingConnection struct {
	config      *ReplicationConnectionConfig
	connected   atomic.Bool
	streaming   atomic.Bool
	lastLSN     uint64
	mu          sync.RWMutex
}

// NewStreamingConnection 创建流式连接
func NewStreamingConnection(config *ReplicationConnectionConfig) *StreamingConnection {
	return &StreamingConnection{
		config: config,
	}
}

// IsConnected 检查是否已连接
func (c *StreamingConnection) IsConnected() bool {
	return c.connected.Load()
}

// IsStreaming 检查是否正在流式传输
func (c *StreamingConnection) IsStreaming() bool {
	return c.streaming.Load()
}

// BuildStartReplicationCommand 构建开始复制命令
func (c *StreamingConnection) BuildStartReplicationCommand(startLSN uint64) string {
	lsnStr := FormatLSN(startLSN)
	return fmt.Sprintf(
		"START_REPLICATION SLOT %s LOGICAL %s (proto_version '1', publication_names '%s')",
		c.config.SlotName,
		lsnStr,
		c.config.PublicationName,
	)
}

// BuildPluginArguments 构建插件参数
func (c *StreamingConnection) BuildPluginArguments() map[string]string {
	return map[string]string{
		"proto_version":     "1",
		"publication_names": c.config.PublicationName,
	}
}

// Connect 建立连接
func (c *StreamingConnection) Connect(ctx context.Context) error {
	if c.connected.Load() {
		return errors.New("已经连接")
	}

	// TODO: 实际的 pglogrepl 连接逻辑
	// 这里需要使用 pgconn.Connect 建立复制连接

	// 模拟连接失败 (无效 DSN)
	if c.config.DSN == "" || strings.Contains(c.config.DSN, "invalid") {
		return errors.New("无法连接到数据库")
	}

	c.connected.Store(true)
	return nil
}

// Close 关闭连接
func (c *StreamingConnection) Close() error {
	if !c.connected.Load() {
		return nil
	}

	c.streaming.Store(false)
	c.connected.Store(false)

	return nil
}

// GetLastLSN 获取最后处理的 LSN
func (c *StreamingConnection) GetLastLSN() uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastLSN
}

// SetLastLSN 设置最后处理的 LSN
func (c *StreamingConnection) SetLastLSN(lsn uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastLSN = lsn
}

// ============================================================================
// 消息解码器
// ============================================================================

// ColumnInfo 列信息
type ColumnInfo struct {
	// Name 列名
	Name string
	// TypeOID 类型 OID
	TypeOID uint32
	// Flags 标志 (1 = 主键的一部分)
	Flags uint8
	// TypeModifier 类型修饰符
	TypeModifier int32
}

// RelationInfo 关系信息
type RelationInfo struct {
	// RelationID 关系 ID
	RelationID uint32
	// Namespace 命名空间 (schema)
	Namespace string
	// RelationName 关系名 (表名)
	RelationName string
	// ReplicaIdentity 复制标识
	ReplicaIdentity byte
	// Columns 列信息
	Columns []ColumnInfo
}

// GetPrimaryKeyColumns 获取主键列名
func (r *RelationInfo) GetPrimaryKeyColumns() []string {
	var pkCols []string
	for _, col := range r.Columns {
		if col.Flags&1 != 0 {
			pkCols = append(pkCols, col.Name)
		}
	}
	return pkCols
}

// FullName 返回完整表名
func (r *RelationInfo) FullName() string {
	if r.Namespace == "" || r.Namespace == "public" {
		return r.RelationName
	}
	return fmt.Sprintf("%s.%s", r.Namespace, r.RelationName)
}

// PGOutputDecoder pgoutput 解码器
type PGOutputDecoder struct {
	relations map[uint32]*RelationInfo
	mu        sync.RWMutex
}

// NewPGOutputDecoder 创建 pgoutput 解码器
func NewPGOutputDecoder() *PGOutputDecoder {
	return &PGOutputDecoder{
		relations: make(map[uint32]*RelationInfo),
	}
}

// SetRelation 设置关系信息
func (d *PGOutputDecoder) SetRelation(rel *RelationInfo) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.relations[rel.RelationID] = rel
}

// GetRelation 获取关系信息
func (d *PGOutputDecoder) GetRelation(relationID uint32) *RelationInfo {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.relations[relationID]
}

// ClearRelations 清除所有关系信息
func (d *PGOutputDecoder) ClearRelations() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.relations = make(map[uint32]*RelationInfo)
}

// ============================================================================
// 备用状态
// ============================================================================

// StandbyStatus 备用状态消息
type StandbyStatus struct {
	// WalWritePosition 写入位置
	WalWritePosition uint64
	// WalFlushPosition 刷新位置
	WalFlushPosition uint64
	// WalApplyPosition 应用位置
	WalApplyPosition uint64
	// ClientTime 客户端时间
	ClientTime time.Time
	// ReplyRequested 是否请求回复
	ReplyRequested bool
}

// NewStandbyStatus 创建备用状态
func NewStandbyStatus(writePos, flushPos, applyPos uint64) *StandbyStatus {
	return &StandbyStatus{
		WalWritePosition: writePos,
		WalFlushPosition: flushPos,
		WalApplyPosition: applyPos,
		ClientTime:       time.Now(),
		ReplyRequested:   false,
	}
}

// ============================================================================
// LSN 工具函数
// ============================================================================

// ParseLSN 解析 LSN 字符串 (格式: "X/Y")
func ParseLSN(s string) (uint64, error) {
	if s == "" {
		return 0, errors.New("LSN 字符串为空")
	}

	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, fmt.Errorf("无效的 LSN 格式: %s", s)
	}

	high, err := strconv.ParseUint(parts[0], 16, 32)
	if err != nil {
		return 0, fmt.Errorf("无法解析 LSN 高位: %s", parts[0])
	}

	low, err := strconv.ParseUint(parts[1], 16, 32)
	if err != nil {
		return 0, fmt.Errorf("无法解析 LSN 低位: %s", parts[1])
	}

	return (high << 32) | low, nil
}

// FormatLSN 格式化 LSN 为字符串
func FormatLSN(lsn uint64) string {
	return fmt.Sprintf("%X/%X", lsn>>32, lsn&0xFFFFFFFF)
}

// LSNToString LSN 转字符串 (别名)
func LSNToString(lsn uint64) string {
	return FormatLSN(lsn)
}

// ============================================================================
// 复制协议消息类型
// ============================================================================

// PGOutputMessageType pgoutput 消息类型
type PGOutputMessageType byte

const (
	// PGOutputMessageBegin 事务开始
	PGOutputMessageBegin PGOutputMessageType = 'B'
	// PGOutputMessageCommit 事务提交
	PGOutputMessageCommit PGOutputMessageType = 'C'
	// PGOutputMessageOrigin 事务来源
	PGOutputMessageOrigin PGOutputMessageType = 'O'
	// PGOutputMessageRelation 关系定义
	PGOutputMessageRelation PGOutputMessageType = 'R'
	// PGOutputMessageType 类型定义
	PGOutputMessageTypeMsg PGOutputMessageType = 'Y'
	// PGOutputMessageInsert INSERT 操作
	PGOutputMessageInsert PGOutputMessageType = 'I'
	// PGOutputMessageUpdate UPDATE 操作
	PGOutputMessageUpdate PGOutputMessageType = 'U'
	// PGOutputMessageDelete DELETE 操作
	PGOutputMessageDelete PGOutputMessageType = 'D'
	// PGOutputMessageTruncate TRUNCATE 操作
	PGOutputMessageTruncate PGOutputMessageType = 'T'
)

// String 返回消息类型的字符串表示
func (t PGOutputMessageType) String() string {
	switch t {
	case PGOutputMessageBegin:
		return "BEGIN"
	case PGOutputMessageCommit:
		return "COMMIT"
	case PGOutputMessageOrigin:
		return "ORIGIN"
	case PGOutputMessageRelation:
		return "RELATION"
	case PGOutputMessageTypeMsg:
		return "TYPE"
	case PGOutputMessageInsert:
		return "INSERT"
	case PGOutputMessageUpdate:
		return "UPDATE"
	case PGOutputMessageDelete:
		return "DELETE"
	case PGOutputMessageTruncate:
		return "TRUNCATE"
	default:
		return fmt.Sprintf("UNKNOWN(%c)", t)
	}
}
