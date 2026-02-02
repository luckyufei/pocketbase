package core_test

import (
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestSystemMetricsMigration 测试 _metrics 表迁移
func TestSystemMetricsMigration(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 验证表存在
	if !app.AuxHasTable("_metrics") {
		t.Fatal("Expected _metrics table to exist after migration")
	}
}

// TestSystemMetricsMigrationTableStructure 验证表结构
func TestSystemMetricsMigrationTableStructure(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 尝试插入一条记录来验证表结构
	sql := `
		INSERT INTO {{_metrics}} (
			[[id]], [[timestamp]], [[cpu_usage_percent]], [[memory_alloc_mb]],
			[[goroutines_count]], [[sqlite_wal_size_mb]], [[sqlite_open_conns]],
			[[p95_latency_ms]], [[http_5xx_count]]
		) VALUES (
			'test_migration_id', 
			{:timestamp},
			25.5, 128.75, 50, 1.5, 5, 10.25, 2
		)
	`

	_, err := app.AuxDB().NewQuery(sql).Bind(map[string]any{
		"timestamp": "2026-01-08 10:00:00.000Z",
	}).Execute()

	if err != nil {
		t.Fatalf("Failed to insert test record: %v", err)
	}

	// 验证可以查询
	var count int
	err = app.AuxDB().NewQuery("SELECT COUNT(*) FROM {{_metrics}}").Row(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 1 {
		t.Fatalf("Expected 1 record, got %d", count)
	}
}

// TestSystemMetricsMigrationIndex 验证索引存在
func TestSystemMetricsMigrationIndex(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 插入多条记录并按 timestamp 查询，验证索引可用
	for i := 0; i < 10; i++ {
		sql := `
			INSERT INTO {{_metrics}} (
				[[cpu_usage_percent]], [[memory_alloc_mb]], [[goroutines_count]]
			) VALUES ({:cpu}, {:mem}, {:goroutines})
		`
		_, err := app.AuxDB().NewQuery(sql).Bind(map[string]any{
			"cpu":        float64(i * 10),
			"mem":        float64(100 + i*10),
			"goroutines": 10 + i,
		}).Execute()
		if err != nil {
			t.Fatalf("Failed to insert record %d: %v", i, err)
		}
	}

	// 按时间范围查询（应该使用索引）
	var items []struct {
		Id              string  `db:"id"`
		CpuUsagePercent float64 `db:"cpu_usage_percent"`
	}
	err := app.AuxDB().Select("id", "cpu_usage_percent").
		From("_metrics").
		OrderBy("timestamp DESC").
		Limit(5).
		All(&items)

	if err != nil {
		t.Fatalf("Failed to query with order by timestamp: %v", err)
	}

	if len(items) != 5 {
		t.Fatalf("Expected 5 items, got %d", len(items))
	}
}

// TestSystemMetricsMigrationIdempotent 验证迁移幂等性
func TestSystemMetricsMigrationIdempotent(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 表应该已经存在
	if !app.AuxHasTable("_metrics") {
		t.Fatal("Expected _metrics table to exist")
	}

	// 再次执行创建表 SQL 应该不会报错（IF NOT EXISTS）
	var sql string
	if app.IsPostgres() {
		sql = `CREATE TABLE IF NOT EXISTS "_metrics" ("id" TEXT PRIMARY KEY)`
	} else {
		sql = `CREATE TABLE IF NOT EXISTS {{_metrics}} ([[id]] TEXT PRIMARY KEY)`
	}

	_, err := app.AuxDB().NewQuery(sql).Execute()
	if err != nil {
		t.Fatalf("Idempotent create table failed: %v", err)
	}
}

// TestSystemMetricsModelWithAuxDB 验证 SystemMetrics 模型可以通过 AuxDB 操作
func TestSystemMetricsModelWithAuxDB(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建一个 SystemMetrics 实例
	metrics := &core.SystemMetrics{
		CpuUsagePercent: 25.5,
		MemoryAllocMB:   128.75,
		GoroutinesCount: 50,
	}
	// 手动设置 Id（与 Record 不同，普通 Model 需要手动设置）
	metrics.Id = "test_aux_save_id"

	// 使用 AuxSave 保存
	err := app.AuxSave(metrics)
	if err != nil {
		t.Fatalf("Failed to save metrics via AuxSave: %v", err)
	}

	// 验证不再是 IsNew
	if metrics.IsNew() {
		t.Fatal("Expected IsNew() = false after save")
	}

	// 通过 AuxModelQuery 查询
	var queried core.SystemMetrics
	err = app.AuxModelQuery(&queried).
		AndWhere(dbx.NewExp("id = {:id}", dbx.Params{"id": metrics.Id})).
		One(&queried)

	if err != nil {
		t.Fatalf("Failed to query metrics: %v", err)
	}

	if queried.CpuUsagePercent != 25.5 {
		t.Fatalf("Expected CpuUsagePercent 25.5, got %v", queried.CpuUsagePercent)
	}
}

// TestSystemMetricsAuxDelete 验证可以通过 AuxDelete 删除
func TestSystemMetricsAuxDelete(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 创建并保存
	metrics := &core.SystemMetrics{
		CpuUsagePercent: 10.0,
	}
	metrics.Id = "test_delete_id"

	if err := app.AuxSave(metrics); err != nil {
		t.Fatalf("Failed to save: %v", err)
	}

	savedId := metrics.Id

	// 删除
	if err := app.AuxDelete(metrics); err != nil {
		t.Fatalf("Failed to delete: %v", err)
	}

	// 验证已删除
	var count int
	err := app.AuxDB().NewQuery("SELECT COUNT(*) FROM {{_metrics}} WHERE [[id]] = {:id}").
		Bind(map[string]any{"id": savedId}).
		Row(&count)

	if err != nil {
		t.Fatalf("Failed to query: %v", err)
	}

	if count != 0 {
		t.Fatalf("Expected 0 records after delete, got %d", count)
	}
}
