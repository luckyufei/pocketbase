//go:build !no_default_driver

package core

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// SQLite TraceRepository 实现
// ============================================================================

// SQLiteTraceRepository 是 SQLite 的 TraceRepository 实现
// 使用独立的 auxiliary.db 文件存储 trace 数据
type SQLiteTraceRepository struct {
	db *sql.DB
}

// NewSQLiteTraceRepository 创建 SQLite TraceRepository
func NewSQLiteTraceRepository(dbPath string) (*SQLiteTraceRepository, error) {
	// 构建 DSN
	dsn := dbPath
	if !strings.Contains(dsn, "?") {
		dsn += "?"
	}

	// 添加 WAL 模式和其他优化参数
	params := []string{
		"_pragma=journal_mode(WAL)",
		"_pragma=synchronous(NORMAL)",
		"_pragma=busy_timeout(10000)",
		"_pragma=cache_size(-64000)",
	}
	dsn += strings.Join(params, "&")

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 连接失败: %w", err)
	}

	// SQLite 使用单连接模式
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	return &SQLiteTraceRepository{db: db}, nil
}

// NewSQLiteTraceRepositoryWithDB 使用现有连接创建 TraceRepository
func NewSQLiteTraceRepositoryWithDB(db *sql.DB) *SQLiteTraceRepository {
	return &SQLiteTraceRepository{db: db}
}

// CreateSchema 创建 _traces 表
func (r *SQLiteTraceRepository) CreateSchema() error {
	// 创建表
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS _traces (
			trace_id   TEXT NOT NULL,
			span_id    TEXT NOT NULL,
			parent_id  TEXT,
			name       TEXT NOT NULL,
			kind       TEXT NOT NULL DEFAULT 'INTERNAL',
			start_time INTEGER NOT NULL,
			duration   INTEGER NOT NULL DEFAULT 0,
			status     TEXT NOT NULL DEFAULT 'UNSET',
			attributes TEXT,
			created    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
			PRIMARY KEY (trace_id, span_id)
		)
	`

	_, err := r.db.Exec(createTableSQL)
	if err != nil {
		return fmt.Errorf("创建 _traces 表失败: %w", err)
	}

	// 创建索引
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_traces_start_time ON _traces (start_time DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_traces_name ON _traces (name)`,
		`CREATE INDEX IF NOT EXISTS idx_traces_status ON _traces (status)`,
		`CREATE INDEX IF NOT EXISTS idx_traces_parent_id ON _traces (parent_id)`,
	}

	for _, idx := range indexes {
		if _, err := r.db.Exec(idx); err != nil {
			return fmt.Errorf("创建索引失败: %w", err)
		}
	}

	return nil
}

// BatchWrite 批量写入 Span
func (r *SQLiteTraceRepository) BatchWrite(spans []*Span) error {
	if len(spans) == 0 {
		return nil
	}

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}
	defer tx.Rollback()

	// 准备语句
	stmt, err := tx.Prepare(`
		INSERT OR REPLACE INTO _traces 
		(trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("准备语句失败: %w", err)
	}
	defer stmt.Close()

	// 批量插入
	for _, span := range spans {
		attrsJSON, _ := json.Marshal(span.Attributes)
		created := span.Created
		if created.IsZero() {
			created = types.NowDateTime()
		}

		var parentID any
		if span.ParentID != "" {
			parentID = span.ParentID
		}

		_, err := stmt.Exec(
			span.TraceID,
			span.SpanID,
			parentID,
			span.Name,
			string(span.Kind),
			span.StartTime,
			span.Duration,
			string(span.Status),
			string(attrsJSON),
			created.String(),
		)
		if err != nil {
			return fmt.Errorf("插入 Span 失败: %w", err)
		}
	}

	return tx.Commit()
}

// Query 查询 Span 列表
func (r *SQLiteTraceRepository) Query(params *FilterParams) ([]*Span, int64, error) {
	// 构建查询
	query := `
		SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _traces
		WHERE 1=1
	`
	countQuery := `SELECT COUNT(*) FROM _traces WHERE 1=1`
	args := []any{}

	if params.TraceID != "" {
		query += " AND trace_id = ?"
		countQuery += " AND trace_id = ?"
		args = append(args, params.TraceID)
	}
	if params.SpanID != "" {
		query += " AND span_id = ?"
		countQuery += " AND span_id = ?"
		args = append(args, params.SpanID)
	}
	if params.Operation != "" {
		query += " AND name = ?"
		countQuery += " AND name = ?"
		args = append(args, params.Operation)
	}
	if params.Status != "" {
		query += " AND status = ?"
		countQuery += " AND status = ?"
		args = append(args, string(params.Status))
	}
	if params.StartTime > 0 {
		query += " AND start_time >= ?"
		countQuery += " AND start_time >= ?"
		args = append(args, params.StartTime)
	}
	if params.EndTime > 0 {
		query += " AND start_time <= ?"
		countQuery += " AND start_time <= ?"
		args = append(args, params.EndTime)
	}
	if params.RootOnly {
		query += " AND parent_id IS NULL"
		countQuery += " AND parent_id IS NULL"
	}

	// 添加 AttributeFilters 支持（SQLite JSON 查询）
	// 需要为 query 和 countQuery 分别构建参数
	queryArgs := make([]any, len(args))
	copy(queryArgs, args)
	countArgs := make([]any, len(args))
	copy(countArgs, args)
	
	for key, value := range params.AttributeFilters {
		jsonPath := "$." + key
		query += " AND json_extract(attributes, ?) = ?"
		countQuery += " AND json_extract(attributes, ?) = ?"
		queryArgs = append(queryArgs, jsonPath, value)
		countArgs = append(countArgs, jsonPath, value)
	}

	// 获取总数
	var total int64
	if err := r.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("查询总数失败: %w", err)
	}

	// 添加排序和分页
	query += " ORDER BY start_time DESC"
	if params.Limit > 0 {
		query += " LIMIT ?"
		queryArgs = append(queryArgs, params.Limit)
	}
	if params.Offset > 0 {
		query += " OFFSET ?"
		queryArgs = append(queryArgs, params.Offset)
	}

	// 执行查询
	rows, err := r.db.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("查询失败: %w", err)
	}
	defer rows.Close()

	spans := []*Span{}
	for rows.Next() {
		span, err := scanSpanSQLite(rows)
		if err != nil {
			return nil, 0, err
		}
		spans = append(spans, span)
	}

	return spans, total, nil
}

// GetTrace 获取完整调用链
func (r *SQLiteTraceRepository) GetTrace(traceID string) ([]*Span, error) {
	query := `
		SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _traces
		WHERE trace_id = ?
		ORDER BY start_time ASC
	`

	rows, err := r.db.Query(query, traceID)
	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}
	defer rows.Close()

	spans := []*Span{}
	for rows.Next() {
		span, err := scanSpanSQLite(rows)
		if err != nil {
			return nil, err
		}
		spans = append(spans, span)
	}

	return spans, nil
}

// Stats 获取统计数据
func (r *SQLiteTraceRepository) Stats(params *FilterParams) (*TraceStats, error) {
	// 基础统计
	baseQuery := `
		SELECT 
			COUNT(*) as total_requests,
			SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error_count
		FROM _traces
		WHERE parent_id IS NULL
	`
	args := []any{}

	if params != nil && params.StartTime > 0 {
		baseQuery += " AND start_time >= ?"
		args = append(args, params.StartTime)
	}
	if params != nil && params.EndTime > 0 {
		baseQuery += " AND start_time <= ?"
		args = append(args, params.EndTime)
	}

	var stats TraceStats
	err := r.db.QueryRow(baseQuery, args...).Scan(
		&stats.TotalRequests,
		&stats.SuccessCount,
		&stats.ErrorCount,
	)
	if err != nil {
		return nil, fmt.Errorf("查询统计失败: %w", err)
	}

	// SQLite 不支持 percentile_cont，需要在 Go 层计算
	durationQuery := `
		SELECT duration
		FROM _traces
		WHERE parent_id IS NULL
	`
	dArgs := []any{}

	if params != nil && params.StartTime > 0 {
		durationQuery += " AND start_time >= ?"
		dArgs = append(dArgs, params.StartTime)
	}
	if params != nil && params.EndTime > 0 {
		durationQuery += " AND start_time <= ?"
		dArgs = append(dArgs, params.EndTime)
	}
	durationQuery += " ORDER BY duration ASC"

	rows, err := r.db.Query(durationQuery, dArgs...)
	if err != nil {
		return nil, fmt.Errorf("查询延迟失败: %w", err)
	}
	defer rows.Close()

	var durations []int64
	for rows.Next() {
		var d int64
		if err := rows.Scan(&d); err != nil {
			return nil, fmt.Errorf("扫描延迟失败: %w", err)
		}
		durations = append(durations, d)
	}

	// 计算百分位
	stats.P50Latency = calculatePercentileSQLite(durations, 0.50)
	stats.P95Latency = calculatePercentileSQLite(durations, 0.95)
	stats.P99Latency = calculatePercentileSQLite(durations, 0.99)

	return &stats, nil
}

// Prune 清理过期数据
func (r *SQLiteTraceRepository) Prune(before time.Time) (int64, error) {
	result, err := r.db.Exec(`DELETE FROM _traces WHERE start_time < ?`, before.UnixMicro())
	if err != nil {
		return 0, fmt.Errorf("清理失败: %w", err)
	}

	affected, _ := result.RowsAffected()
	return affected, nil
}

// Close 关闭连接
func (r *SQLiteTraceRepository) Close() error {
	return r.db.Close()
}

// IsHealthy 检查 SQLite 数据库是否健康
func (r *SQLiteTraceRepository) IsHealthy() bool {
	if r.db == nil {
		return false
	}
	
	// 简单的 ping 测试
	err := r.db.Ping()
	return err == nil
}

// Recover 恢复 SQLite 数据库（重建 schema）
func (r *SQLiteTraceRepository) Recover() error {
	// 尝试重新创建 schema
	return r.CreateSchema()
}

// ============================================================================
// 辅助函数
// ============================================================================

type sqlScannable interface {
	Scan(dest ...any) error
}

func scanSpanSQLite(row sqlScannable) (*Span, error) {
	var span Span
	var parentID sql.NullString
	var kind, status string
	var attrsJSON sql.NullString
	var created string

	err := row.Scan(
		&span.TraceID,
		&span.SpanID,
		&parentID,
		&span.Name,
		&kind,
		&span.StartTime,
		&span.Duration,
		&status,
		&attrsJSON,
		&created,
	)
	if err != nil {
		return nil, fmt.Errorf("扫描 Span 失败: %w", err)
	}

	if parentID.Valid {
		span.ParentID = parentID.String
	}
	span.Kind = SpanKind(kind)
	span.Status = SpanStatus(status)

	// 解析时间
	span.Created, _ = types.ParseDateTime(created)

	if attrsJSON.Valid && attrsJSON.String != "" {
		_ = json.Unmarshal([]byte(attrsJSON.String), &span.Attributes)
	}

	return &span, nil
}

func calculatePercentileSQLite(durations []int64, p float64) int64 {
	if len(durations) == 0 {
		return 0
	}

	// 确保已排序
	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	idx := int(float64(len(durations)-1) * p)
	if idx >= len(durations) {
		idx = len(durations) - 1
	}
	return durations[idx]
}
