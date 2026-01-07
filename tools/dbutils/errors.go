// Package dbutils 提供数据库工具函数
package dbutils

import (
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

// PostgreSQL 错误码常量
// 参考: https://www.postgresql.org/docs/current/errcodes-appendix.html
const (
	// Class 23 — Integrity Constraint Violation
	PGErrUniqueViolation     = "23505"
	PGErrForeignKeyViolation = "23503"
	PGErrNotNullViolation    = "23502"
	PGErrCheckViolation      = "23514"
	PGErrExclusionViolation  = "23P01"

	// Class 42 — Syntax Error or Access Rule Violation
	PGErrUndefinedTable    = "42P01"
	PGErrUndefinedColumn   = "42703"
	PGErrSyntaxError       = "42601"
	PGErrDuplicateTable    = "42P07"
	PGErrDuplicateColumn   = "42701"
	PGErrInsufficientPriv  = "42501"

	// Class 22 — Data Exception
	PGErrInvalidTextRep    = "22P02"
	PGErrNumericValueOOR   = "22003"
	PGErrStringDataTooLong = "22001"
	PGErrDivisionByZero    = "22012"

	// Class 40 — Transaction Rollback
	PGErrDeadlockDetected  = "40P01"
	PGErrSerializationFail = "40001"
)

// GetPGErrorCode 从错误中提取 PostgreSQL 错误码
func GetPGErrorCode(err error) string {
	if err == nil {
		return ""
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// GetPGErrorDetail 从错误中提取 PostgreSQL 错误详情
func GetPGErrorDetail(err error) string {
	if err == nil {
		return ""
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Detail
	}
	return ""
}

// GetPGErrorConstraint 从错误中提取违反的约束名称
func GetPGErrorConstraint(err error) string {
	if err == nil {
		return ""
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}

// IsPGError 检查错误是否为 PostgreSQL 错误
func IsPGError(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr)
}

// IsUniqueViolation 检查错误是否为唯一约束违反
// 支持 SQLite (UNIQUE constraint failed) 和 PostgreSQL (23505)
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrUniqueViolation {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "UNIQUE constraint failed") ||
		strings.Contains(errStr, "duplicate key value")
}

// IsForeignKeyViolation 检查错误是否为外键约束违反
// 支持 SQLite (FOREIGN KEY constraint failed) 和 PostgreSQL (23503)
func IsForeignKeyViolation(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrForeignKeyViolation {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "FOREIGN KEY constraint failed") ||
		strings.Contains(errStr, "violates foreign key constraint")
}

// IsNotNullViolation 检查错误是否为非空约束违反
// 支持 SQLite (NOT NULL constraint failed) 和 PostgreSQL (23502)
func IsNotNullViolation(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrNotNullViolation {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "NOT NULL constraint failed") ||
		strings.Contains(errStr, "null value in column")
}

// IsCheckViolation 检查错误是否为检查约束违反
// 支持 SQLite (CHECK constraint failed) 和 PostgreSQL (23514)
func IsCheckViolation(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrCheckViolation {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "CHECK constraint failed") ||
		strings.Contains(errStr, "violates check constraint")
}

// IsIntegrityConstraintViolation 检查错误是否为任何完整性约束违反
func IsIntegrityConstraintViolation(err error) bool {
	return IsUniqueViolation(err) ||
		IsForeignKeyViolation(err) ||
		IsNotNullViolation(err) ||
		IsCheckViolation(err)
}

// IsDeadlock 检查错误是否为死锁
func IsDeadlock(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrDeadlockDetected {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "database is locked") ||
		strings.Contains(errStr, "deadlock")
}

// IsSerializationFailure 检查错误是否为序列化失败（可重试）
func IsSerializationFailure(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrSerializationFail {
		return true
	}

	return false
}

// IsRetryable 检查错误是否可重试
func IsRetryable(err error) bool {
	return IsDeadlock(err) || IsSerializationFailure(err)
}

// IsTableNotFound 检查错误是否为表不存在
func IsTableNotFound(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrUndefinedTable {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "no such table")
}

// IsColumnNotFound 检查错误是否为列不存在
func IsColumnNotFound(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrUndefinedColumn {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "no such column")
}

// IsSyntaxError 检查错误是否为语法错误
func IsSyntaxError(err error) bool {
	if err == nil {
		return false
	}

	// PostgreSQL
	if code := GetPGErrorCode(err); code == PGErrSyntaxError {
		return true
	}

	// SQLite
	errStr := err.Error()
	return strings.Contains(errStr, "syntax error")
}
