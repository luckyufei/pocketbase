package core_test

import (
	"encoding/json"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================
// Task 1: Model 接口实现测试 (TDD Red-Green)
// ============================================================

// TestSystemMetricsImplementsModel 验证 SystemMetrics 实现 Model 接口
func TestSystemMetricsImplementsModel(t *testing.T) {
	t.Parallel()

	// 编译时检查：如果 SystemMetrics 没有实现 Model 接口，这行会编译失败
	var _ core.Model = (*core.SystemMetrics)(nil)
}

// TestSystemMetricsTableName 验证表名为 _metrics
func TestSystemMetricsTableName(t *testing.T) {
	t.Parallel()

	m := &core.SystemMetrics{}
	expected := "_metrics"
	if tableName := m.TableName(); tableName != expected {
		t.Fatalf("Expected table name '%s', got '%s'", expected, tableName)
	}
}

// TestSystemMetricsPrimaryKey 验证 PK 方法返回 Id
func TestSystemMetricsPrimaryKey(t *testing.T) {
	t.Parallel()

	m := &core.SystemMetrics{}
	m.Id = "test_pk_123"

	pk := m.PK()
	if pk != "test_pk_123" {
		t.Fatalf("Expected PK 'test_pk_123', got '%v'", pk)
	}
}

// TestSystemMetricsIsNew 验证 IsNew 判断逻辑
func TestSystemMetricsIsNew(t *testing.T) {
	t.Parallel()

	m := &core.SystemMetrics{}
	m.Id = "test123"

	// 新创建的模型应该是 IsNew
	if !m.IsNew() {
		t.Fatal("Expected new model to return IsNew() = true")
	}

	// 标记为非新后
	m.MarkAsNotNew()
	if m.IsNew() {
		t.Fatal("Expected model after MarkAsNotNew() to return IsNew() = false")
	}

	// 重新标记为新
	m.MarkAsNew()
	if !m.IsNew() {
		t.Fatal("Expected model after MarkAsNew() to return IsNew() = true")
	}
}

// TestSystemMetricsLastSavedPK 验证 LastSavedPK 方法
func TestSystemMetricsLastSavedPK(t *testing.T) {
	t.Parallel()

	m := &core.SystemMetrics{}
	m.Id = "test456"

	// 初始状态 LastSavedPK 应为空
	if m.LastSavedPK() != "" {
		t.Fatalf("Expected empty LastSavedPK, got '%v'", m.LastSavedPK())
	}

	// MarkAsNotNew 后 LastSavedPK 应等于 Id
	m.MarkAsNotNew()
	if m.LastSavedPK() != "test456" {
		t.Fatalf("Expected LastSavedPK 'test456', got '%v'", m.LastSavedPK())
	}
}

// TestSystemMetricsPostScan 验证 PostScan 方法（dbx.PostScanner 接口）
func TestSystemMetricsPostScan(t *testing.T) {
	t.Parallel()

	m := &core.SystemMetrics{}
	m.Id = "scanned_id"

	// PostScan 前应该是 IsNew
	if !m.IsNew() {
		t.Fatal("Expected IsNew() = true before PostScan")
	}

	// 执行 PostScan
	if err := m.PostScan(); err != nil {
		t.Fatalf("PostScan failed: %v", err)
	}

	// PostScan 后应该不是 IsNew
	if m.IsNew() {
		t.Fatal("Expected IsNew() = false after PostScan")
	}
}

// ============================================================
// JSON 序列化测试
// ============================================================

func TestSystemMetricsJSONSerialization(t *testing.T) {
	t.Parallel()

	now := types.NowDateTime()

	metrics := &core.SystemMetrics{
		Timestamp:       now,
		CpuUsagePercent: 25.5,
		MemoryAllocMB:   128.75,
		GoroutinesCount: 50,
		SqliteWalSizeMB: 1.5,
		SqliteOpenConns: 5,
		P95LatencyMs:    10.25,
		Http5xxCount:    2,
	}
	metrics.Id = "test123"

	// Serialize to JSON
	data, err := json.Marshal(metrics)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	// Deserialize from JSON
	var decoded core.SystemMetrics
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// Verify fields
	if decoded.Id != metrics.Id {
		t.Errorf("Id mismatch: expected %s, got %s", metrics.Id, decoded.Id)
	}
	if decoded.CpuUsagePercent != metrics.CpuUsagePercent {
		t.Errorf("CpuUsagePercent mismatch: expected %v, got %v", metrics.CpuUsagePercent, decoded.CpuUsagePercent)
	}
	if decoded.MemoryAllocMB != metrics.MemoryAllocMB {
		t.Errorf("MemoryAllocMB mismatch: expected %v, got %v", metrics.MemoryAllocMB, decoded.MemoryAllocMB)
	}
	if decoded.GoroutinesCount != metrics.GoroutinesCount {
		t.Errorf("GoroutinesCount mismatch: expected %v, got %v", metrics.GoroutinesCount, decoded.GoroutinesCount)
	}
	if decoded.SqliteWalSizeMB != metrics.SqliteWalSizeMB {
		t.Errorf("SqliteWalSizeMB mismatch: expected %v, got %v", metrics.SqliteWalSizeMB, decoded.SqliteWalSizeMB)
	}
	if decoded.SqliteOpenConns != metrics.SqliteOpenConns {
		t.Errorf("SqliteOpenConns mismatch: expected %v, got %v", metrics.SqliteOpenConns, decoded.SqliteOpenConns)
	}
	if decoded.P95LatencyMs != metrics.P95LatencyMs {
		t.Errorf("P95LatencyMs mismatch: expected %v, got %v", metrics.P95LatencyMs, decoded.P95LatencyMs)
	}
	if decoded.Http5xxCount != metrics.Http5xxCount {
		t.Errorf("Http5xxCount mismatch: expected %v, got %v", metrics.Http5xxCount, decoded.Http5xxCount)
	}
}

func TestSystemMetricsJSONFieldNames(t *testing.T) {
	t.Parallel()

	metrics := &core.SystemMetrics{
		Timestamp:       types.NowDateTime(),
		CpuUsagePercent: 25.5,
		MemoryAllocMB:   128.75,
		GoroutinesCount: 50,
		SqliteWalSizeMB: 1.5,
		SqliteOpenConns: 5,
		P95LatencyMs:    10.25,
		Http5xxCount:    2,
	}
	metrics.Id = "test123"

	data, err := json.Marshal(metrics)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("Failed to unmarshal to map: %v", err)
	}

	expectedFields := []string{
		"id",
		"timestamp",
		"cpu_usage_percent",
		"memory_alloc_mb",
		"goroutines_count",
		"sqlite_wal_size_mb",
		"sqlite_open_conns",
		"p95_latency_ms",
		"http_5xx_count",
	}

	for _, field := range expectedFields {
		if _, ok := raw[field]; !ok {
			t.Errorf("Expected JSON field '%s' not found", field)
		}
	}
}

func TestSystemMetricsResponseJSONSerialization(t *testing.T) {
	t.Parallel()

	now := types.NowDateTime()

	item1 := &core.SystemMetrics{
		Timestamp:       now,
		CpuUsagePercent: 10.0,
	}
	item1.Id = "item1"

	item2 := &core.SystemMetrics{
		Timestamp:       now,
		CpuUsagePercent: 20.0,
	}
	item2.Id = "item2"

	response := &core.SystemMetricsResponse{
		Items:      []*core.SystemMetrics{item1, item2},
		TotalItems: 2,
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var decoded core.SystemMetricsResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if len(decoded.Items) != 2 {
		t.Fatalf("Expected 2 items, got %d", len(decoded.Items))
	}

	if decoded.TotalItems != 2 {
		t.Fatalf("Expected TotalItems 2, got %d", decoded.TotalItems)
	}

	if decoded.Items[0].Id != "item1" {
		t.Errorf("Expected first item Id 'item1', got '%s'", decoded.Items[0].Id)
	}

	if decoded.Items[1].Id != "item2" {
		t.Errorf("Expected second item Id 'item2', got '%s'", decoded.Items[1].Id)
	}
}

func TestSystemMetricsResponseEmptyItems(t *testing.T) {
	t.Parallel()

	response := &core.SystemMetricsResponse{
		Items:      []*core.SystemMetrics{},
		TotalItems: 0,
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var decoded core.SystemMetricsResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if decoded.Items == nil {
		t.Fatal("Expected non-nil Items slice")
	}

	if len(decoded.Items) != 0 {
		t.Fatalf("Expected 0 items, got %d", len(decoded.Items))
	}

	if decoded.TotalItems != 0 {
		t.Fatalf("Expected TotalItems 0, got %d", decoded.TotalItems)
	}
}

func TestSystemMetricsZeroValues(t *testing.T) {
	t.Parallel()

	metrics := &core.SystemMetrics{}

	data, err := json.Marshal(metrics)
	if err != nil {
		t.Fatalf("Failed to marshal zero value: %v", err)
	}

	var decoded core.SystemMetrics
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal zero value: %v", err)
	}

	if decoded.Id != "" {
		t.Errorf("Expected empty Id, got '%s'", decoded.Id)
	}
	if decoded.CpuUsagePercent != 0 {
		t.Errorf("Expected CpuUsagePercent 0, got %v", decoded.CpuUsagePercent)
	}
	if decoded.MemoryAllocMB != 0 {
		t.Errorf("Expected MemoryAllocMB 0, got %v", decoded.MemoryAllocMB)
	}
	if decoded.GoroutinesCount != 0 {
		t.Errorf("Expected GoroutinesCount 0, got %v", decoded.GoroutinesCount)
	}
}
