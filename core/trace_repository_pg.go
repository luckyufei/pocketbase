//go:build !no_default_driver

package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// PostgreSQL TraceRepository 实现
// ============================================================================

// PgTraceRepository 是 PostgreSQL 的 TraceRepository 实现
type PgTraceRepository struct {
	pool *pgxpool.Pool
}

// NewPgTraceRepository 创建 PostgreSQL TraceRepository
func NewPgTraceRepository(dsn string) (*PgTraceRepository, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("解析 PostgreSQL 配置失败: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("创建 PostgreSQL 连接池失败: %w", err)
	}

	return &PgTraceRepository{pool: pool}, nil
}

// NewPgTraceRepositoryWithPool 使用现有连接池创建 TraceRepository
func NewPgTraceRepositoryWithPool(pool *pgxpool.Pool) *PgTraceRepository {
	return &PgTraceRepository{pool: pool}
}

// CreateSchema 创建 _traces 表（UNLOGGED TABLE）
func (r *PgTraceRepository) CreateSchema() error {
	ctx := context.Background()

	// 创建 UNLOGGED TABLE（不写 WAL，性能更高）
	createTableSQL := `
		CREATE UNLOGGED TABLE IF NOT EXISTS _traces (
			trace_id   VARCHAR(32) NOT NULL,
			span_id    VARCHAR(16) NOT NULL,
			parent_id  VARCHAR(16),
			name       VARCHAR(512) NOT NULL,
			kind       VARCHAR(16) NOT NULL DEFAULT 'INTERNAL',
			start_time BIGINT NOT NULL,
			duration   BIGINT NOT NULL DEFAULT 0,
			status     VARCHAR(16) NOT NULL DEFAULT 'UNSET',
			attributes JSONB,
			created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (trace_id, span_id)
		)
	`

	_, err := r.pool.Exec(ctx, createTableSQL)
	if err != nil {
		return fmt.Errorf("创建 _traces 表失败: %w", err)
	}

	// 创建索引
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_traces_start_time ON _traces (start_time DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_traces_name ON _traces (name)`,
		`CREATE INDEX IF NOT EXISTS idx_traces_status ON _traces (status)`,
		`CREATE INDEX IF NOT EXISTS idx_traces_parent_id ON _traces (parent_id) WHERE parent_id IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_traces_attrs ON _traces USING GIN (attributes)`,
	}

	for _, idx := range indexes {
		if _, err := r.pool.Exec(ctx, idx); err != nil {
			return fmt.Errorf("创建索引失败: %w", err)
		}
	}

	return nil
}

// BatchWrite 使用 COPY 协议批量写入 Span
func (r *PgTraceRepository) BatchWrite(spans []*Span) error {
	if len(spans) == 0 {
		return nil
	}

	ctx := context.Background()

	// 准备数据
	rows := make([][]any, len(spans))
	for i, span := range spans {
		attrsJSON, _ := json.Marshal(span.Attributes)
		created := span.Created
		if created.IsZero() {
			created = types.NowDateTime()
		}
		rows[i] = []any{
			span.TraceID,
			span.SpanID,
			nullableString(span.ParentID),
			span.Name,
			string(span.Kind),
			span.StartTime,
			span.Duration,
			string(span.Status),
			attrsJSON,
			created.Time(),
		}
	}

	// 使用 COPY 协议
	_, err := r.pool.CopyFrom(
		ctx,
		pgx.Identifier{"_traces"},
		[]string{"trace_id", "span_id", "parent_id", "name", "kind", "start_time", "duration", "status", "attributes", "created"},
		pgx.CopyFromRows(rows),
	)

	if err != nil {
		return fmt.Errorf("COPY 写入失败: %w", err)
	}

	return nil
}

// Query 查询 Span 列表
func (r *PgTraceRepository) Query(params *FilterParams) ([]*Span, int64, error) {
	ctx := context.Background()

	// 构建查询
	query := `
		SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _traces
		WHERE 1=1
	`
	countQuery := `SELECT COUNT(*) FROM _traces WHERE 1=1`
	args := []any{}
	argIdx := 1

	if params.TraceID != "" {
		query += fmt.Sprintf(" AND trace_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND trace_id = $%d", argIdx)
		args = append(args, params.TraceID)
		argIdx++
	}
	if params.SpanID != "" {
		query += fmt.Sprintf(" AND span_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND span_id = $%d", argIdx)
		args = append(args, params.SpanID)
		argIdx++
	}
	if params.Operation != "" {
		query += fmt.Sprintf(" AND name = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND name = $%d", argIdx)
		args = append(args, params.Operation)
		argIdx++
	}
	if params.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, string(params.Status))
		argIdx++
	}
	if params.StartTime > 0 {
		query += fmt.Sprintf(" AND start_time >= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND start_time >= $%d", argIdx)
		args = append(args, params.StartTime)
		argIdx++
	}
	if params.EndTime > 0 {
		query += fmt.Sprintf(" AND start_time <= $%d", argIdx)
		countQuery += fmt.Sprintf(" AND start_time <= $%d", argIdx)
		args = append(args, params.EndTime)
		argIdx++
	}
	if params.RootOnly {
		query += " AND parent_id IS NULL"
		countQuery += " AND parent_id IS NULL"
	}

	// 获取总数
	var total int64
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("查询总数失败: %w", err)
	}

	// 添加排序和分页
	query += " ORDER BY start_time DESC"
	if params.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, params.Limit)
		argIdx++
	}
	if params.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, params.Offset)
	}

	// 执行查询
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("查询失败: %w", err)
	}
	defer rows.Close()

	spans := []*Span{}
	for rows.Next() {
		span, err := scanSpan(rows)
		if err != nil {
			return nil, 0, err
		}
		spans = append(spans, span)
	}

	return spans, total, nil
}

// GetTrace 获取完整调用链
func (r *PgTraceRepository) GetTrace(traceID string) ([]*Span, error) {
	ctx := context.Background()

	query := `
		SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _traces
		WHERE trace_id = $1
		ORDER BY start_time ASC
	`

	rows, err := r.pool.Query(ctx, query, traceID)
	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}
	defer rows.Close()

	spans := []*Span{}
	for rows.Next() {
		span, err := scanSpan(rows)
		if err != nil {
			return nil, err
		}
		spans = append(spans, span)
	}

	return spans, nil
}

// Stats 获取统计数据
func (r *PgTraceRepository) Stats(params *FilterParams) (*TraceStats, error) {
	ctx := context.Background()

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
	argIdx := 1

	if params != nil && params.StartTime > 0 {
		baseQuery += fmt.Sprintf(" AND start_time >= $%d", argIdx)
		args = append(args, params.StartTime)
		argIdx++
	}
	if params != nil && params.EndTime > 0 {
		baseQuery += fmt.Sprintf(" AND start_time <= $%d", argIdx)
		args = append(args, params.EndTime)
	}

	var stats TraceStats
	err := r.pool.QueryRow(ctx, baseQuery, args...).Scan(
		&stats.TotalRequests,
		&stats.SuccessCount,
		&stats.ErrorCount,
	)
	if err != nil {
		return nil, fmt.Errorf("查询统计失败: %w", err)
	}

	// 延迟百分位（PostgreSQL 原生支持）
	percentileQuery := `
		SELECT 
			COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY duration), 0) as p50,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration), 0) as p95,
			COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY duration), 0) as p99
		FROM _traces
		WHERE parent_id IS NULL
	`
	pArgs := []any{}
	pArgIdx := 1

	if params != nil && params.StartTime > 0 {
		percentileQuery += fmt.Sprintf(" AND start_time >= $%d", pArgIdx)
		pArgs = append(pArgs, params.StartTime)
		pArgIdx++
	}
	if params != nil && params.EndTime > 0 {
		percentileQuery += fmt.Sprintf(" AND start_time <= $%d", pArgIdx)
		pArgs = append(pArgs, params.EndTime)
	}

	var p50, p95, p99 float64
	err = r.pool.QueryRow(ctx, percentileQuery, pArgs...).Scan(&p50, &p95, &p99)
	if err != nil {
		return nil, fmt.Errorf("查询百分位失败: %w", err)
	}

	stats.P50Latency = int64(p50)
	stats.P95Latency = int64(p95)
	stats.P99Latency = int64(p99)

	return &stats, nil
}

// Prune 清理过期数据
func (r *PgTraceRepository) Prune(before time.Time) (int64, error) {
	ctx := context.Background()

	result, err := r.pool.Exec(ctx, `DELETE FROM _traces WHERE start_time < $1`, before.UnixMicro())
	if err != nil {
		return 0, fmt.Errorf("清理失败: %w", err)
	}

	return result.RowsAffected(), nil
}

// Close 关闭连接池
func (r *PgTraceRepository) Close() error {
	r.pool.Close()
	return nil
}

// ============================================================================
// 辅助函数
// ============================================================================

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

type scannable interface {
	Scan(dest ...any) error
}

func scanSpan(row scannable) (*Span, error) {
	var span Span
	var parentID *string
	var kind, status string
	var attrsJSON []byte
	var created time.Time

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

	if parentID != nil {
		span.ParentID = *parentID
	}
	span.Kind = SpanKind(kind)
	span.Status = SpanStatus(status)
	span.Created, _ = types.ParseDateTime(created)

	if len(attrsJSON) > 0 {
		_ = json.Unmarshal(attrsJSON, &span.Attributes)
	}

	return &span, nil
}

// calculatePercentile 计算百分位（用于 SQLite 兼容）
func calculatePercentile(durations []int64, p float64) int64 {
	if len(durations) == 0 {
		return 0
	}

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	idx := int(float64(len(durations)-1) * p)
	return durations[idx]
}
