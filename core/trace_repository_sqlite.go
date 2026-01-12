//go:build !no_default_driver

package core

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// SQLite TraceRepository 实现
// ============================================================================

// SQLiteTraceRepository 是 SQLite 的 TraceRepository 实现
// 使用 auxiliary.db 存储 trace 数据，与 Logs、Metrics、Analytics 共享数据库
type SQLiteTraceRepository struct {
	db dbx.Builder
}

// NewSQLiteTraceRepository 创建 SQLite TraceRepository
// 使用 dbx.Builder 以便与 PocketBase 的 AuxDB 集成
func NewSQLiteTraceRepository(db dbx.Builder) *SQLiteTraceRepository {
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

	_, err := r.db.NewQuery(createTableSQL).Execute()
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
		if _, err := r.db.NewQuery(idx).Execute(); err != nil {
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

	// 使用 dbx 的事务支持
	// 注意：dbx.Builder 不直接支持事务，需要逐条插入
	// 对于高性能场景，可以考虑使用批量 INSERT
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

		// 使用 INSERT OR REPLACE 语法
		_, err := r.db.NewQuery(`
			INSERT OR REPLACE INTO _traces 
			(trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created)
			VALUES ({:trace_id}, {:span_id}, {:parent_id}, {:name}, {:kind}, {:start_time}, {:duration}, {:status}, {:attributes}, {:created})
		`).Bind(dbx.Params{
			"trace_id":   span.TraceID,
			"span_id":    span.SpanID,
			"parent_id":  parentID,
			"name":       span.Name,
			"kind":       string(span.Kind),
			"start_time": span.StartTime,
			"duration":   span.Duration,
			"status":     string(span.Status),
			"attributes": string(attrsJSON),
			"created":    created.String(),
		}).Execute()

		if err != nil {
			return fmt.Errorf("插入 Span 失败: %w", err)
		}
	}

	return nil
}

// Query 查询 Span 列表
func (r *SQLiteTraceRepository) Query(params *FilterParams) ([]*Span, int64, error) {
	// 构建查询
	query := r.db.Select("trace_id", "span_id", "parent_id", "name", "kind", "start_time", "duration", "status", "attributes", "created").
		From("_traces")

	countQuery := r.db.Select("COUNT(*)").From("_traces")

	// 构建条件
	var conditions []dbx.Expression

	if params.TraceID != "" {
		conditions = append(conditions, dbx.HashExp{"trace_id": params.TraceID})
	}
	if params.SpanID != "" {
		conditions = append(conditions, dbx.HashExp{"span_id": params.SpanID})
	}
	if params.Operation != "" {
		conditions = append(conditions, dbx.HashExp{"name": params.Operation})
	}
	if params.Status != "" {
		conditions = append(conditions, dbx.HashExp{"status": string(params.Status)})
	}
	if params.StartTime > 0 {
		conditions = append(conditions, dbx.NewExp("start_time >= {:start_time}", dbx.Params{"start_time": params.StartTime}))
	}
	if params.EndTime > 0 {
		conditions = append(conditions, dbx.NewExp("start_time <= {:end_time}", dbx.Params{"end_time": params.EndTime}))
	}
	if params.RootOnly {
		conditions = append(conditions, dbx.NewExp("parent_id IS NULL"))
	}

	// 添加 AttributeFilters 支持（SQLite JSON 查询）
	attrIdx := 0
	for key, value := range params.AttributeFilters {
		// 使用 $."key" 语法来支持包含点号的键名
		jsonPath := fmt.Sprintf(`$."%s"`, key)
		paramName := fmt.Sprintf("attr_%d", attrIdx)
		conditions = append(conditions, dbx.NewExp(
			fmt.Sprintf("json_extract(attributes, '%s') = {:%s}", jsonPath, paramName),
			dbx.Params{paramName: value},
		))
		attrIdx++
	}

	// 应用条件
	if len(conditions) > 0 {
		query = query.Where(dbx.And(conditions...))
		countQuery = countQuery.Where(dbx.And(conditions...))
	}

	// 获取总数
	var total int64
	if err := countQuery.Row(&total); err != nil {
		return nil, 0, fmt.Errorf("查询总数失败: %w", err)
	}

	// 添加排序和分页
	query = query.OrderBy("start_time DESC")
	if params.Limit > 0 {
		query = query.Limit(int64(params.Limit))
	}
	if params.Offset > 0 {
		query = query.Offset(int64(params.Offset))
	}

	// 执行查询
	var results []struct {
		TraceID    string  `db:"trace_id"`
		SpanID     string  `db:"span_id"`
		ParentID   *string `db:"parent_id"`
		Name       string  `db:"name"`
		Kind       string  `db:"kind"`
		StartTime  int64   `db:"start_time"`
		Duration   int64   `db:"duration"`
		Status     string  `db:"status"`
		Attributes *string `db:"attributes"`
		Created    string  `db:"created"`
	}

	if err := query.All(&results); err != nil {
		return nil, 0, fmt.Errorf("查询失败: %w", err)
	}

	spans := make([]*Span, 0, len(results))
	for _, row := range results {
		span := &Span{
			TraceID:   row.TraceID,
			SpanID:    row.SpanID,
			Name:      row.Name,
			Kind:      SpanKind(row.Kind),
			StartTime: row.StartTime,
			Duration:  row.Duration,
			Status:    SpanStatus(row.Status),
		}

		if row.ParentID != nil {
			span.ParentID = *row.ParentID
		}

		span.Created, _ = types.ParseDateTime(row.Created)

		if row.Attributes != nil && *row.Attributes != "" {
			_ = json.Unmarshal([]byte(*row.Attributes), &span.Attributes)
		}

		spans = append(spans, span)
	}

	return spans, total, nil
}

// GetTrace 获取完整调用链
func (r *SQLiteTraceRepository) GetTrace(traceID string) ([]*Span, error) {
	var results []struct {
		TraceID    string  `db:"trace_id"`
		SpanID     string  `db:"span_id"`
		ParentID   *string `db:"parent_id"`
		Name       string  `db:"name"`
		Kind       string  `db:"kind"`
		StartTime  int64   `db:"start_time"`
		Duration   int64   `db:"duration"`
		Status     string  `db:"status"`
		Attributes *string `db:"attributes"`
		Created    string  `db:"created"`
	}

	err := r.db.Select("trace_id", "span_id", "parent_id", "name", "kind", "start_time", "duration", "status", "attributes", "created").
		From("_traces").
		Where(dbx.HashExp{"trace_id": traceID}).
		OrderBy("start_time ASC").
		All(&results)

	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}

	spans := make([]*Span, 0, len(results))
	for _, row := range results {
		span := &Span{
			TraceID:   row.TraceID,
			SpanID:    row.SpanID,
			Name:      row.Name,
			Kind:      SpanKind(row.Kind),
			StartTime: row.StartTime,
			Duration:  row.Duration,
			Status:    SpanStatus(row.Status),
		}

		if row.ParentID != nil {
			span.ParentID = *row.ParentID
		}

		span.Created, _ = types.ParseDateTime(row.Created)

		if row.Attributes != nil && *row.Attributes != "" {
			_ = json.Unmarshal([]byte(*row.Attributes), &span.Attributes)
		}

		spans = append(spans, span)
	}

	return spans, nil
}

// Stats 获取统计数据
func (r *SQLiteTraceRepository) Stats(params *FilterParams) (*TraceStats, error) {
	// 基础统计查询
	baseQuery := `
		SELECT 
			COUNT(*) as total_requests,
			SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error_count
		FROM _traces
		WHERE parent_id IS NULL
	`
	bindings := dbx.Params{}

	if params != nil && params.StartTime > 0 {
		baseQuery += " AND start_time >= {:start_time}"
		bindings["start_time"] = params.StartTime
	}
	if params != nil && params.EndTime > 0 {
		baseQuery += " AND start_time <= {:end_time}"
		bindings["end_time"] = params.EndTime
	}

	var stats TraceStats
	err := r.db.NewQuery(baseQuery).Bind(bindings).Row(
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
	dBindings := dbx.Params{}

	if params != nil && params.StartTime > 0 {
		durationQuery += " AND start_time >= {:start_time}"
		dBindings["start_time"] = params.StartTime
	}
	if params != nil && params.EndTime > 0 {
		durationQuery += " AND start_time <= {:end_time}"
		dBindings["end_time"] = params.EndTime
	}
	durationQuery += " ORDER BY duration ASC"

	var durations []int64
	rows := []struct {
		Duration int64 `db:"duration"`
	}{}

	if err := r.db.NewQuery(durationQuery).Bind(dBindings).All(&rows); err != nil {
		return nil, fmt.Errorf("查询延迟失败: %w", err)
	}

	for _, row := range rows {
		durations = append(durations, row.Duration)
	}

	// 计算百分位
	stats.P50Latency = calculatePercentileSQLite(durations, 0.50)
	stats.P95Latency = calculatePercentileSQLite(durations, 0.95)
	stats.P99Latency = calculatePercentileSQLite(durations, 0.99)

	return &stats, nil
}

// Prune 清理过期数据
func (r *SQLiteTraceRepository) Prune(before time.Time) (int64, error) {
	result, err := r.db.NewQuery(`DELETE FROM _traces WHERE start_time < {:before}`).
		Bind(dbx.Params{"before": before.UnixMicro()}).
		Execute()
	if err != nil {
		return 0, fmt.Errorf("清理失败: %w", err)
	}

	affected, _ := result.RowsAffected()
	return affected, nil
}

// Close 关闭连接
func (r *SQLiteTraceRepository) Close() error {
	// 使用 AuxDB 共享连接，不需要单独关闭
	return nil
}

// IsHealthy 检查数据库是否健康
func (r *SQLiteTraceRepository) IsHealthy() bool {
	if r.db == nil {
		return false
	}

	// 简单的查询测试
	var result int
	err := r.db.NewQuery("SELECT 1").Row(&result)
	return err == nil
}

// Recover 恢复数据库（重建 schema）
func (r *SQLiteTraceRepository) Recover() error {
	// 尝试重新创建 schema
	return r.CreateSchema()
}

// ============================================================================
// 辅助函数
// ============================================================================

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
