package core

import (
	"database/sql"
	"errors"
	"strings"
)

// TxOptions 事务选项
type TxOptions struct {
	// Isolation 事务隔离级别
	Isolation sql.IsolationLevel

	// ReadOnly 是否为只读事务
	ReadOnly bool
}

// DefaultTxOptions 返回默认事务选项
func DefaultTxOptions() *TxOptions {
	return &TxOptions{
		Isolation: sql.LevelDefault,
		ReadOnly:  false,
	}
}

// WithIsolation 设置隔离级别
func (o *TxOptions) WithIsolation(level sql.IsolationLevel) *TxOptions {
	o.Isolation = level
	return o
}

// WithReadOnly 设置只读模式
func (o *TxOptions) WithReadOnly(readOnly bool) *TxOptions {
	o.ReadOnly = readOnly
	return o
}

// ToSqlTxOptions 转换为 sql.TxOptions
func (o *TxOptions) ToSqlTxOptions() *sql.TxOptions {
	return &sql.TxOptions{
		Isolation: o.Isolation,
		ReadOnly:  o.ReadOnly,
	}
}

// IsolationLevelToString 将隔离级别转换为字符串
func IsolationLevelToString(level sql.IsolationLevel) string {
	switch level {
	case sql.LevelDefault:
		return "DEFAULT"
	case sql.LevelReadUncommitted:
		return "READ UNCOMMITTED"
	case sql.LevelReadCommitted:
		return "READ COMMITTED"
	case sql.LevelRepeatableRead:
		return "REPEATABLE READ"
	case sql.LevelSerializable:
		return "SERIALIZABLE"
	default:
		return "UNKNOWN"
	}
}

// ParseIsolationLevel 从字符串解析隔离级别
func ParseIsolationLevel(s string) (sql.IsolationLevel, error) {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "DEFAULT":
		return sql.LevelDefault, nil
	case "READ UNCOMMITTED":
		return sql.LevelReadUncommitted, nil
	case "READ COMMITTED":
		return sql.LevelReadCommitted, nil
	case "REPEATABLE READ":
		return sql.LevelRepeatableRead, nil
	case "SERIALIZABLE":
		return sql.LevelSerializable, nil
	default:
		return sql.LevelDefault, errors.New("unknown isolation level: " + s)
	}
}

// IsolationLevelRecommendation 隔离级别推荐
type IsolationLevelRecommendation struct {
	// Operation 操作类型
	Operation string

	// Level 推荐的隔离级别
	Level sql.IsolationLevel

	// Reason 推荐原因
	Reason string
}

// isolationRecommendations 隔离级别推荐列表
var isolationRecommendations = []IsolationLevelRecommendation{
	{
		Operation: "financial_transfer",
		Level:     sql.LevelSerializable,
		Reason:    "金融转账需要最高隔离级别，防止任何并发异常",
	},
	{
		Operation: "inventory_update",
		Level:     sql.LevelRepeatableRead,
		Reason:    "库存更新需要防止不可重复读，确保读取的数据在事务期间不变",
	},
	{
		Operation: "read_report",
		Level:     sql.LevelReadCommitted,
		Reason:    "报表读取只需要读已提交的数据，不需要更高隔离级别",
	},
	{
		Operation: "batch_insert",
		Level:     sql.LevelReadCommitted,
		Reason:    "批量插入使用默认隔离级别即可，避免不必要的锁开销",
	},
	{
		Operation: "counter_increment",
		Level:     sql.LevelRepeatableRead,
		Reason:    "计数器递增需要防止丢失更新",
	},
}

// isolationRecommendationMap 用于快速查找
var isolationRecommendationMap map[string]*IsolationLevelRecommendation

func init() {
	isolationRecommendationMap = make(map[string]*IsolationLevelRecommendation)
	for i := range isolationRecommendations {
		isolationRecommendationMap[isolationRecommendations[i].Operation] = &isolationRecommendations[i]
	}
}

// GetRecommendedIsolationLevel 获取操作推荐的隔离级别
func GetRecommendedIsolationLevel(operation string) sql.IsolationLevel {
	if rec, ok := isolationRecommendationMap[operation]; ok {
		return rec.Level
	}
	return sql.LevelDefault
}

// GetIsolationRecommendations 获取所有隔离级别推荐
func GetIsolationRecommendations() []IsolationLevelRecommendation {
	result := make([]IsolationLevelRecommendation, len(isolationRecommendations))
	copy(result, isolationRecommendations)
	return result
}

// PostgreSQL 隔离级别说明:
//
// READ UNCOMMITTED (PostgreSQL 中等同于 READ COMMITTED):
//   - PostgreSQL 不支持脏读，即使设置为 READ UNCOMMITTED 也会表现为 READ COMMITTED
//
// READ COMMITTED (默认):
//   - 只能看到已提交的数据
//   - 同一事务中多次读取可能看到不同结果（不可重复读）
//   - 适用于大多数 OLTP 场景
//
// REPEATABLE READ:
//   - 事务开始时创建快照，整个事务期间看到一致的数据
//   - 防止不可重复读和幻读
//   - 可能遇到序列化失败，需要重试
//
// SERIALIZABLE:
//   - 最高隔离级别，完全串行化执行效果
//   - 防止所有并发异常
//   - 性能开销最大，可能频繁遇到序列化失败
//
// SQLite 隔离级别说明:
//
// SQLite 使用不同的并发模型:
//   - WAL 模式: 读写可并发，写写串行
//   - 默认模式: 数据库级别锁
//   - 不支持标准 SQL 隔离级别设置
