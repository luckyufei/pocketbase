// Package trace 提供可插拔的分布式追踪功能
package trace

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/tools/types"
	_ "github.com/lib/pq"
)

// PostgresRepository 实现 PostgreSQL 后端的 TraceRepository
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository 创建新的 PostgreSQL 存储实例
func NewPostgresRepository(dsn string) (*PostgresRepository, error) {
	if dsn == "" {
		return nil, errors.New("DSN cannot be empty")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// 设置连接池
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	// 测试连接
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	repo := &PostgresRepository{db: db}

	// 初始化表结构
	if err := repo.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}

	return repo, nil
}

// initSchema 创建表结构
func (r *PostgresRepository) initSchema() error {
	schema := `
		CREATE TABLE IF NOT EXISTS _trace_spans (
			id          TEXT PRIMARY KEY,
			trace_id    TEXT NOT NULL,
			span_id     TEXT NOT NULL,
			parent_id   TEXT,
			name        TEXT NOT NULL,
			kind        TEXT NOT NULL,
			start_time  BIGINT NOT NULL,
			duration    BIGINT NOT NULL,
			status      TEXT NOT NULL,
			attributes  JSONB,
			created     TIMESTAMP WITH TIME ZONE NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_id ON _trace_spans(trace_id);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_span_id ON _trace_spans(span_id);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_start_time ON _trace_spans(start_time);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_status ON _trace_spans(status);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_created ON _trace_spans(created);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_attributes ON _trace_spans USING GIN (attributes);
	`
	_, err := r.db.Exec(schema)
	return err
}

// SaveBatch 批量保存 Span 数据
func (r *PostgresRepository) SaveBatch(spans []*Span) (BatchSaveResult, error) {
	result := BatchSaveResult{Total: len(spans)}
	if len(spans) == 0 {
		return result, nil
	}

	// 使用单独的语句进行批量插入，避免事务中单条失败影响全部
	// PostgreSQL 支持 ON CONFLICT，可以安全处理冲突
	stmt, err := r.db.Prepare(`
		INSERT INTO _trace_spans 
		(id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			trace_id = EXCLUDED.trace_id,
			span_id = EXCLUDED.span_id,
			parent_id = EXCLUDED.parent_id,
			name = EXCLUDED.name,
			kind = EXCLUDED.kind,
			start_time = EXCLUDED.start_time,
			duration = EXCLUDED.duration,
			status = EXCLUDED.status,
			attributes = EXCLUDED.attributes,
			created = EXCLUDED.created
	`)
	if err != nil {
		return result, fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, span := range spans {
		if span == nil {
			continue
		}

		// 处理 attributes - PostgreSQL JSONB 需要有效的 JSON 或 NULL
		var attrsJSON any
		if len(span.Attributes) > 0 {
			jsonBytes, _ := json.Marshal(span.Attributes)
			attrsJSON = jsonBytes
		}

		_, err := stmt.Exec(
			span.ID,
			span.TraceID,
			span.SpanID,
			span.ParentID,
			span.Name,
			string(span.Kind),
			span.StartTime,
			span.Duration,
			string(span.Status),
			attrsJSON,
			span.Created.Time().UTC(),
		)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, err)
		} else {
			result.Success++
		}
	}

	return result, nil
}

// FindByTraceID 根据 TraceID 查找所有相关 Span
func (r *PostgresRepository) FindByTraceID(traceID string) ([]*Span, error) {
	rows, err := r.db.Query(`
		SELECT id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _trace_spans
		WHERE trace_id = $1
		ORDER BY start_time ASC
	`, traceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query spans: %w", err)
	}
	defer rows.Close()

	return r.scanSpans(rows)
}

// FindBySpanID 根据 SpanID 查找单个 Span
func (r *PostgresRepository) FindBySpanID(spanID string) (*Span, error) {
	row := r.db.QueryRow(`
		SELECT id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _trace_spans
		WHERE span_id = $1
		LIMIT 1
	`, spanID)

	span, err := r.scanSpan(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query span: %w", err)
	}

	return span, nil
}

// Query 根据查询选项查询 Span 列表
func (r *PostgresRepository) Query(opts TraceQueryOptions) ([]*Span, error) {
	query, args := r.buildQuery(opts, false)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query spans: %w", err)
	}
	defer rows.Close()

	return r.scanSpans(rows)
}

// Count 统计匹配的 Span 数量
func (r *PostgresRepository) Count(opts TraceQueryOptions) (int64, error) {
	query, args := r.buildQuery(opts, true)
	var count int64
	err := r.db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count spans: %w", err)
	}
	return count, nil
}

// Prune 清理指定时间之前的 Span 数据
func (r *PostgresRepository) Prune(before time.Time) (int64, error) {
	result, err := r.db.Exec(`DELETE FROM _trace_spans WHERE created < $1`, before.UTC())
	if err != nil {
		return 0, fmt.Errorf("failed to prune spans: %w", err)
	}

	affected, _ := result.RowsAffected()
	return affected, nil
}

// DeleteByTraceID 删除指定 TraceID 的所有 Span
func (r *PostgresRepository) DeleteByTraceID(traceID string) error {
	_, err := r.db.Exec(`DELETE FROM _trace_spans WHERE trace_id = $1`, traceID)
	if err != nil {
		return fmt.Errorf("failed to delete spans: %w", err)
	}
	return nil
}

// Close 关闭数据库连接
func (r *PostgresRepository) Close() error {
	return r.db.Close()
}

// buildQuery 构建查询语句
func (r *PostgresRepository) buildQuery(opts TraceQueryOptions, countOnly bool) (string, []any) {
	var sb strings.Builder
	var args []any
	argIndex := 1

	if countOnly {
		sb.WriteString("SELECT COUNT(*) FROM _trace_spans WHERE 1=1")
	} else {
		sb.WriteString("SELECT id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created FROM _trace_spans WHERE 1=1")
	}

	if opts.TraceID != "" {
		sb.WriteString(fmt.Sprintf(" AND trace_id = $%d", argIndex))
		args = append(args, opts.TraceID)
		argIndex++
	}

	if opts.ParentSpanID != "" {
		sb.WriteString(fmt.Sprintf(" AND parent_id = $%d", argIndex))
		args = append(args, opts.ParentSpanID)
		argIndex++
	}

	if opts.SpanName != "" {
		sb.WriteString(fmt.Sprintf(" AND name ILIKE $%d", argIndex))
		args = append(args, "%"+opts.SpanName+"%")
		argIndex++
	}

	if opts.MinDuration > 0 {
		sb.WriteString(fmt.Sprintf(" AND duration >= $%d", argIndex))
		args = append(args, opts.MinDuration.Microseconds())
		argIndex++
	}

	if opts.MaxDuration > 0 {
		sb.WriteString(fmt.Sprintf(" AND duration <= $%d", argIndex))
		args = append(args, opts.MaxDuration.Microseconds())
		argIndex++
	}

	if len(opts.StatusFilter) > 0 {
		placeholders := make([]string, len(opts.StatusFilter))
		for i, status := range opts.StatusFilter {
			placeholders[i] = fmt.Sprintf("$%d", argIndex)
			args = append(args, string(status))
			argIndex++
		}
		sb.WriteString(" AND status IN (" + strings.Join(placeholders, ",") + ")")
	}

	if len(opts.KindFilter) > 0 {
		placeholders := make([]string, len(opts.KindFilter))
		for i, kind := range opts.KindFilter {
			placeholders[i] = fmt.Sprintf("$%d", argIndex)
			args = append(args, string(kind))
			argIndex++
		}
		sb.WriteString(" AND kind IN (" + strings.Join(placeholders, ",") + ")")
	}

	if !opts.StartTimeFrom.IsZero() {
		sb.WriteString(fmt.Sprintf(" AND start_time >= $%d", argIndex))
		args = append(args, opts.StartTimeFrom.UnixMicro())
		argIndex++
	}

	if !opts.StartTimeTo.IsZero() {
		sb.WriteString(fmt.Sprintf(" AND start_time <= $%d", argIndex))
		args = append(args, opts.StartTimeTo.UnixMicro())
		argIndex++
	}

	// 支持 JSONB 属性过滤
	for key, value := range opts.AttributeFilters {
		sb.WriteString(fmt.Sprintf(" AND attributes->>'%s' = $%d", key, argIndex))
		args = append(args, fmt.Sprintf("%v", value))
		argIndex++
	}

	if !countOnly {
		// 排序
		orderBy := "start_time"
		if opts.OrderBy != "" {
			orderBy = opts.OrderBy
		}
		orderDir := "DESC"
		if !opts.OrderDesc && opts.OrderBy != "" {
			orderDir = "ASC"
		}
		sb.WriteString(fmt.Sprintf(" ORDER BY %s %s", orderBy, orderDir))

		// 分页
		limit := opts.Limit
		if limit <= 0 {
			limit = 100 // 默认限制
		}
		sb.WriteString(fmt.Sprintf(" LIMIT %d", limit))

		if opts.Offset > 0 {
			sb.WriteString(fmt.Sprintf(" OFFSET %d", opts.Offset))
		}
	}

	return sb.String(), args
}

// scanSpans 扫描多行结果
func (r *PostgresRepository) scanSpans(rows *sql.Rows) ([]*Span, error) {
	var spans []*Span
	for rows.Next() {
		span, err := r.scanSpanFromRows(rows)
		if err != nil {
			return nil, err
		}
		spans = append(spans, span)
	}
	return spans, rows.Err()
}

// scanSpan 扫描单行结果
func (r *PostgresRepository) scanSpan(row *sql.Row) (*Span, error) {
	var (
		span      Span
		kind      string
		status    string
		attrsJSON []byte
		created   time.Time
	)

	err := row.Scan(
		&span.ID,
		&span.TraceID,
		&span.SpanID,
		&span.ParentID,
		&span.Name,
		&kind,
		&span.StartTime,
		&span.Duration,
		&status,
		&attrsJSON,
		&created,
	)
	if err != nil {
		return nil, err
	}

	span.Kind = SpanKind(kind)
	span.Status = SpanStatus(status)

	if len(attrsJSON) > 0 {
		json.Unmarshal(attrsJSON, &span.Attributes)
	}

	span.Created, _ = types.ParseDateTime(created)

	return &span, nil
}

// scanSpanFromRows 从 Rows 扫描单个 Span
func (r *PostgresRepository) scanSpanFromRows(rows *sql.Rows) (*Span, error) {
	var (
		span      Span
		kind      string
		status    string
		attrsJSON []byte
		created   time.Time
	)

	err := rows.Scan(
		&span.ID,
		&span.TraceID,
		&span.SpanID,
		&span.ParentID,
		&span.Name,
		&kind,
		&span.StartTime,
		&span.Duration,
		&status,
		&attrsJSON,
		&created,
	)
	if err != nil {
		return nil, err
	}

	span.Kind = SpanKind(kind)
	span.Status = SpanStatus(status)

	if len(attrsJSON) > 0 {
		json.Unmarshal(attrsJSON, &span.Attributes)
	}

	span.Created, _ = types.ParseDateTime(created)

	return &span, nil
}
