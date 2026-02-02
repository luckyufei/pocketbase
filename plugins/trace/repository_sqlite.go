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
	_ "modernc.org/sqlite"
)

// SQLiteRepository 实现 SQLite 后端的 TraceRepository
type SQLiteRepository struct {
	db *sql.DB
}

// NewSQLiteRepository 创建新的 SQLite 存储实例
func NewSQLiteRepository(dsn string) (*SQLiteRepository, error) {
	if dsn == "" {
		return nil, errors.New("DSN cannot be empty")
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// 设置连接池
	db.SetMaxOpenConns(1) // SQLite 不支持并发写入
	db.SetMaxIdleConns(1)

	repo := &SQLiteRepository{db: db}

	// 初始化表结构
	if err := repo.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}

	return repo, nil
}

// initSchema 创建表结构
func (r *SQLiteRepository) initSchema() error {
	schema := `
		CREATE TABLE IF NOT EXISTS _trace_spans (
			id          TEXT PRIMARY KEY,
			trace_id    TEXT NOT NULL,
			span_id     TEXT NOT NULL,
			parent_id   TEXT,
			name        TEXT NOT NULL,
			kind        TEXT NOT NULL,
			start_time  INTEGER NOT NULL,
			duration    INTEGER NOT NULL,
			status      TEXT NOT NULL,
			attributes  TEXT,
			created     TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_id ON _trace_spans(trace_id);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_span_id ON _trace_spans(span_id);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_start_time ON _trace_spans(start_time);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_status ON _trace_spans(status);
		CREATE INDEX IF NOT EXISTS idx_trace_spans_created ON _trace_spans(created);
	`
	_, err := r.db.Exec(schema)
	return err
}

// SaveBatch 批量保存 Span 数据
func (r *SQLiteRepository) SaveBatch(spans []*Span) (BatchSaveResult, error) {
	result := BatchSaveResult{Total: len(spans)}
	if len(spans) == 0 {
		return result, nil
	}

	tx, err := r.db.Begin()
	if err != nil {
		return result, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT OR REPLACE INTO _trace_spans 
		(id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return result, fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, span := range spans {
		if span == nil {
			continue
		}

		var attrsJSON []byte
		if span.Attributes != nil {
			attrsJSON, _ = json.Marshal(span.Attributes)
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
			string(attrsJSON),
			span.Created.String(),
		)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, err)
		} else {
			result.Success++
		}
	}

	if err := tx.Commit(); err != nil {
		return result, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return result, nil
}

// FindByTraceID 根据 TraceID 查找所有相关 Span
func (r *SQLiteRepository) FindByTraceID(traceID string) ([]*Span, error) {
	rows, err := r.db.Query(`
		SELECT id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _trace_spans
		WHERE trace_id = ?
		ORDER BY start_time ASC
	`, traceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query spans: %w", err)
	}
	defer rows.Close()

	return r.scanSpans(rows)
}

// FindBySpanID 根据 SpanID 查找单个 Span
func (r *SQLiteRepository) FindBySpanID(spanID string) (*Span, error) {
	row := r.db.QueryRow(`
		SELECT id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
		FROM _trace_spans
		WHERE span_id = ?
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
func (r *SQLiteRepository) Query(opts TraceQueryOptions) ([]*Span, error) {
	query, args := r.buildQuery(opts, false)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query spans: %w", err)
	}
	defer rows.Close()

	return r.scanSpans(rows)
}

// Count 统计匹配的 Span 数量
func (r *SQLiteRepository) Count(opts TraceQueryOptions) (int64, error) {
	query, args := r.buildQuery(opts, true)
	var count int64
	err := r.db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count spans: %w", err)
	}
	return count, nil
}

// Prune 清理指定时间之前的 Span 数据
func (r *SQLiteRepository) Prune(before time.Time) (int64, error) {
	result, err := r.db.Exec(`
		DELETE FROM _trace_spans WHERE created < ?
	`, before.UTC().Format(types.DefaultDateLayout))
	if err != nil {
		return 0, fmt.Errorf("failed to prune spans: %w", err)
	}

	affected, _ := result.RowsAffected()
	return affected, nil
}

// DeleteByTraceID 删除指定 TraceID 的所有 Span
func (r *SQLiteRepository) DeleteByTraceID(traceID string) error {
	_, err := r.db.Exec(`DELETE FROM _trace_spans WHERE trace_id = ?`, traceID)
	if err != nil {
		return fmt.Errorf("failed to delete spans: %w", err)
	}
	return nil
}

// Close 关闭数据库连接
func (r *SQLiteRepository) Close() error {
	return r.db.Close()
}

// buildQuery 构建查询语句
func (r *SQLiteRepository) buildQuery(opts TraceQueryOptions, countOnly bool) (string, []any) {
	var sb strings.Builder
	var args []any

	if countOnly {
		sb.WriteString("SELECT COUNT(*) FROM _trace_spans WHERE 1=1")
	} else {
		sb.WriteString("SELECT id, trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created FROM _trace_spans WHERE 1=1")
	}

	if opts.TraceID != "" {
		sb.WriteString(" AND trace_id = ?")
		args = append(args, opts.TraceID)
	}

	if opts.ParentSpanID != "" {
		sb.WriteString(" AND parent_id = ?")
		args = append(args, opts.ParentSpanID)
	}

	if opts.SpanName != "" {
		sb.WriteString(" AND name LIKE ?")
		args = append(args, "%"+opts.SpanName+"%")
	}

	if opts.MinDuration > 0 {
		sb.WriteString(" AND duration >= ?")
		args = append(args, opts.MinDuration.Microseconds())
	}

	if opts.MaxDuration > 0 {
		sb.WriteString(" AND duration <= ?")
		args = append(args, opts.MaxDuration.Microseconds())
	}

	if len(opts.StatusFilter) > 0 {
		placeholders := make([]string, len(opts.StatusFilter))
		for i, status := range opts.StatusFilter {
			placeholders[i] = "?"
			args = append(args, string(status))
		}
		sb.WriteString(" AND status IN (" + strings.Join(placeholders, ",") + ")")
	}

	if len(opts.KindFilter) > 0 {
		placeholders := make([]string, len(opts.KindFilter))
		for i, kind := range opts.KindFilter {
			placeholders[i] = "?"
			args = append(args, string(kind))
		}
		sb.WriteString(" AND kind IN (" + strings.Join(placeholders, ",") + ")")
	}

	if !opts.StartTimeFrom.IsZero() {
		sb.WriteString(" AND start_time >= ?")
		args = append(args, opts.StartTimeFrom.UnixMicro())
	}

	if !opts.StartTimeTo.IsZero() {
		sb.WriteString(" AND start_time <= ?")
		args = append(args, opts.StartTimeTo.UnixMicro())
	}

	// 处理属性过滤（SQLite JSON 查询）
	for key, value := range opts.AttributeFilters {
		// 使用 json_extract 函数查询 JSON 字段
		// 对于包含点的 key（如 http.method），需要使用 $."key" 语法
		jsonPath := fmt.Sprintf(`$."%s"`, key)
		sb.WriteString(fmt.Sprintf(` AND json_extract(attributes, '%s') = ?`, jsonPath))
		args = append(args, value)
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
func (r *SQLiteRepository) scanSpans(rows *sql.Rows) ([]*Span, error) {
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
func (r *SQLiteRepository) scanSpan(row *sql.Row) (*Span, error) {
	var (
		span       Span
		kind       string
		status     string
		attrsJSON  sql.NullString
		createdStr string
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
		&createdStr,
	)
	if err != nil {
		return nil, err
	}

	span.Kind = SpanKind(kind)
	span.Status = SpanStatus(status)

	if attrsJSON.Valid && attrsJSON.String != "" {
		json.Unmarshal([]byte(attrsJSON.String), &span.Attributes)
	}

	span.Created, _ = types.ParseDateTime(createdStr)

	return &span, nil
}

// scanSpanFromRows 从 Rows 扫描单个 Span
func (r *SQLiteRepository) scanSpanFromRows(rows *sql.Rows) (*Span, error) {
	var (
		span       Span
		kind       string
		status     string
		attrsJSON  sql.NullString
		createdStr string
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
		&createdStr,
	)
	if err != nil {
		return nil, err
	}

	span.Kind = SpanKind(kind)
	span.Status = SpanStatus(status)

	if attrsJSON.Valid && attrsJSON.String != "" {
		json.Unmarshal([]byte(attrsJSON.String), &span.Attributes)
	}

	span.Created, _ = types.ParseDateTime(createdStr)

	return &span, nil
}
