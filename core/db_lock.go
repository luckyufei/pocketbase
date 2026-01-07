// Package core 提供 PocketBase 核心功能
package core

import (
	"fmt"
	"strings"
)

// LockMode 定义行级锁模式
type LockMode int

const (
	// LockNone 不使用锁
	LockNone LockMode = iota

	// LockForUpdate 排他锁，阻止其他事务读取或修改
	// 适用于：需要更新的记录
	LockForUpdate

	// LockForShare 共享锁，允许其他事务读取但阻止修改
	// 适用于：需要确保数据一致性但不需要修改的场景
	LockForShare

	// LockForUpdateNoWait 排他锁，如果无法立即获取则返回错误
	// 适用于：需要快速失败的场景
	LockForUpdateNoWait

	// LockForUpdateSkipLocked 排他锁，跳过已锁定的行
	// 适用于：作业队列等竞争消费场景
	LockForUpdateSkipLocked
)

// String 返回锁模式的 SQL 表示
func (m LockMode) String() string {
	switch m {
	case LockForUpdate:
		return "FOR UPDATE"
	case LockForShare:
		return "FOR SHARE"
	case LockForUpdateNoWait:
		return "FOR UPDATE NOWAIT"
	case LockForUpdateSkipLocked:
		return "FOR UPDATE SKIP LOCKED"
	default:
		return ""
	}
}

// IsValid 检查锁模式是否有效
func (m LockMode) IsValid() bool {
	return m >= LockNone && m <= LockForUpdateSkipLocked
}

// CriticalOperation 定义需要悲观锁的关键操作
type CriticalOperation struct {
	// Name 操作名称
	Name string

	// Description 操作描述
	Description string

	// RecommendedLock 推荐的锁模式
	RecommendedLock LockMode

	// Tables 涉及的表
	Tables []string

	// Reason 需要锁的原因
	Reason string
}

// criticalOperations 定义所有需要悲观锁的关键操作
var criticalOperations = []CriticalOperation{
	{
		Name:            "counter_update",
		Description:     "计数器更新操作",
		RecommendedLock: LockForUpdate,
		Tables:          []string{"*"},
		Reason:          "防止并发更新导致计数丢失 (lost update)",
	},
	{
		Name:            "inventory_decrement",
		Description:     "库存扣减操作",
		RecommendedLock: LockForUpdate,
		Tables:          []string{"*"},
		Reason:          "防止超卖，确保库存扣减的原子性",
	},
	{
		Name:            "balance_transfer",
		Description:     "余额转账操作",
		RecommendedLock: LockForUpdate,
		Tables:          []string{"*"},
		Reason:          "防止双花，确保余额变更的一致性",
	},
	{
		Name:            "sequence_next",
		Description:     "序列号获取操作",
		RecommendedLock: LockForUpdate,
		Tables:          []string{"*"},
		Reason:          "确保序列号唯一性",
	},
	{
		Name:            "job_claim",
		Description:     "作业队列任务认领",
		RecommendedLock: LockForUpdateSkipLocked,
		Tables:          []string{"*"},
		Reason:          "支持多消费者竞争消费，跳过已被锁定的任务",
	},
	{
		Name:            "distributed_lock",
		Description:     "分布式锁获取",
		RecommendedLock: LockForUpdateNoWait,
		Tables:          []string{"*"},
		Reason:          "快速失败，避免长时间等待",
	},
	{
		Name:            "cascade_delete",
		Description:     "级联删除操作",
		RecommendedLock: LockForUpdate,
		Tables:          []string{"*"},
		Reason:          "确保删除操作的完整性，防止删除过程中数据被修改",
	},
	{
		Name:            "auth_token_refresh",
		Description:     "认证令牌刷新",
		RecommendedLock: LockForUpdate,
		Tables:          []string{"_authOrigins"},
		Reason:          "防止令牌重放攻击",
	},
}

// criticalOperationMap 用于快速查找
var criticalOperationMap map[string]*CriticalOperation

func init() {
	criticalOperationMap = make(map[string]*CriticalOperation)
	for i := range criticalOperations {
		criticalOperationMap[criticalOperations[i].Name] = &criticalOperations[i]
	}
}

// GetCriticalOperations 返回所有关键操作列表
func GetCriticalOperations() []CriticalOperation {
	result := make([]CriticalOperation, len(criticalOperations))
	copy(result, criticalOperations)
	return result
}

// GetCriticalOperation 根据名称获取关键操作
func GetCriticalOperation(name string) (*CriticalOperation, bool) {
	op, ok := criticalOperationMap[name]
	return op, ok
}

// ShouldUsePessimisticLock 判断是否应该使用悲观锁
// 只有 PostgreSQL 支持行级锁，SQLite 不支持
func ShouldUsePessimisticLock(operation string, isPostgres bool) bool {
	// SQLite 不支持行级锁
	if !isPostgres {
		return false
	}

	_, ok := criticalOperationMap[operation]
	return ok
}

// GetRecommendedLockMode 获取操作推荐的锁模式
func GetRecommendedLockMode(operation string) LockMode {
	if op, ok := criticalOperationMap[operation]; ok {
		return op.RecommendedLock
	}
	return LockNone
}

// BuildSelectForUpdateSQL 构建带锁的 SELECT SQL
func BuildSelectForUpdateSQL(tableName string, columns []string, whereClause string, lockMode LockMode) string {
	var sb strings.Builder

	sb.WriteString("SELECT ")
	sb.WriteString(strings.Join(columns, ", "))
	sb.WriteString(" FROM ")
	sb.WriteString(tableName)

	if whereClause != "" {
		sb.WriteString(" WHERE ")
		sb.WriteString(whereClause)
	}

	if lockStr := lockMode.String(); lockStr != "" {
		sb.WriteString(" ")
		sb.WriteString(lockStr)
	}

	return sb.String()
}

// LockOptions 锁选项
type LockOptions struct {
	// Mode 锁模式
	Mode LockMode

	// Tables 要锁定的表（用于 PostgreSQL 的 OF 子句）
	Tables []string

	// Timeout 锁等待超时（毫秒），0 表示无限等待
	// 仅 PostgreSQL 支持
	Timeout int
}

// DefaultLockOptions 返回默认锁选项
func DefaultLockOptions() *LockOptions {
	return &LockOptions{
		Mode:    LockForUpdate,
		Timeout: 0,
	}
}

// WithMode 设置锁模式
func (o *LockOptions) WithMode(mode LockMode) *LockOptions {
	o.Mode = mode
	return o
}

// WithTables 设置要锁定的表
func (o *LockOptions) WithTables(tables ...string) *LockOptions {
	o.Tables = tables
	return o
}

// WithTimeout 设置锁等待超时
func (o *LockOptions) WithTimeout(ms int) *LockOptions {
	o.Timeout = ms
	return o
}

// BuildLockClause 构建锁子句
func (o *LockOptions) BuildLockClause() string {
	if o.Mode == LockNone {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(o.Mode.String())

	// 添加 OF 子句（指定要锁定的表）
	if len(o.Tables) > 0 {
		sb.WriteString(" OF ")
		sb.WriteString(strings.Join(o.Tables, ", "))
	}

	return sb.String()
}

// LockError 锁相关错误
type LockError struct {
	Operation string
	Message   string
	Cause     error
}

func (e *LockError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("lock error [%s]: %s: %v", e.Operation, e.Message, e.Cause)
	}
	return fmt.Sprintf("lock error [%s]: %s", e.Operation, e.Message)
}

func (e *LockError) Unwrap() error {
	return e.Cause
}

// NewLockError 创建锁错误
func NewLockError(operation, message string, cause error) *LockError {
	return &LockError{
		Operation: operation,
		Message:   message,
		Cause:     cause,
	}
}

// IsLockError 检查错误是否为锁错误
func IsLockError(err error) bool {
	_, ok := err.(*LockError)
	return ok
}
