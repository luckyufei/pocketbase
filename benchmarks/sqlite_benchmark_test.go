package benchmarks

import (
	"os"
	"path/filepath"
	"testing"
)

func setupTestDB(t *testing.T) (*SQLiteDB, func()) {
	t.Helper()
	
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")
	
	db := NewSQLiteDB(dbPath, true)
	if err := db.Open(); err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	if err := db.Setup(); err != nil {
		t.Fatalf("failed to setup database: %v", err)
	}

	// 生成少量测试数据
	scaleConfig := ScaleConfig{
		Users:    100,
		Articles: 500,
		Comments: 1000,
		Files:    100,
	}
	generator := NewDataGenerator(db, scaleConfig, 42)
	if err := generator.Generate(false); err != nil {
		t.Fatalf("failed to generate test data: %v", err)
	}

	cleanup := func() {
		db.Close()
		os.RemoveAll(tmpDir)
	}

	return db, cleanup
}

func TestSQLiteBenchmarkSelectByID(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 100
	cfg.WarmupIterations = 10
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkSelectByID()

	if err != nil {
		t.Fatalf("BenchmarkSelectByID() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
	if result.SuccessCount == 0 {
		t.Error("SuccessCount should not be zero")
	}
	if result.QPS <= 0 {
		t.Error("QPS should be positive")
	}
}

func TestSQLiteBenchmarkSelectByIndex(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 100
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkSelectByIndex()

	if err != nil {
		t.Fatalf("BenchmarkSelectByIndex() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkInsert(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkInsert()

	if err != nil {
		t.Fatalf("BenchmarkInsert() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
	if result.SuccessCount == 0 {
		t.Error("SuccessCount should not be zero")
	}
}

func TestSQLiteBenchmarkUpdate(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkUpdate()

	if err != nil {
		t.Fatalf("BenchmarkUpdate() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkDelete(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkDelete()

	if err != nil {
		t.Fatalf("BenchmarkDelete() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkMixedReadWrite(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 100
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)

	tests := []struct {
		name      string
		readRatio float64
	}{
		{"80/20", 0.8},
		{"50/50", 0.5},
		{"20/80", 0.2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := benchmark.BenchmarkMixedReadWrite(tt.readRatio)
			if err != nil {
				t.Fatalf("BenchmarkMixedReadWrite() error = %v", err)
			}
			if result.ReadRatio != tt.readRatio {
				t.Errorf("ReadRatio = %f, want %f", result.ReadRatio, tt.readRatio)
			}
		})
	}
}

func TestSQLiteBenchmarkConcurrentRead(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 100
	cfg.DataSize = 100
	cfg.DurationSeconds = 5

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkConcurrentRead(10)

	if err != nil {
		t.Fatalf("BenchmarkConcurrentRead() error = %v", err)
	}
	if result.Concurrency != 10 {
		t.Errorf("Concurrency = %d, want 10", result.Concurrency)
	}
	if result.TotalOperations == 0 {
		t.Error("TotalOperations should not be zero")
	}
}

func TestSQLiteBenchmarkTwoTableJoin(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkTwoTableJoin()

	if err != nil {
		t.Fatalf("BenchmarkTwoTableJoin() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkThreeTableJoin(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkThreeTableJoin()

	if err != nil {
		t.Fatalf("BenchmarkThreeTableJoin() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkCount(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkCount()

	if err != nil {
		t.Fatalf("BenchmarkCount() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkGroupBy(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 50
	cfg.DataSize = 100

	benchmark := NewSQLiteBenchmark(db, cfg)
	result, err := benchmark.BenchmarkGroupBy()

	if err != nil {
		t.Fatalf("BenchmarkGroupBy() error = %v", err)
	}
	if result.TotalOperations != cfg.Iterations {
		t.Errorf("TotalOperations = %d, want %d", result.TotalOperations, cfg.Iterations)
	}
}

func TestSQLiteBenchmarkRunAll(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	cfg := DefaultConfig()
	cfg.Iterations = 20
	cfg.WarmupIterations = 5
	cfg.DataSize = 100
	cfg.ConcurrencyLevels = []int{1, 5}
	cfg.DurationSeconds = 5

	benchmark := NewSQLiteBenchmark(db, cfg)
	report := NewReport(cfg)

	if err := benchmark.RunAll(report); err != nil {
		t.Fatalf("RunAll() error = %v", err)
	}

	// 应该有 12 个基础测试 + 2 个并发测试 = 14 个结果
	expectedResults := 12 + len(cfg.ConcurrencyLevels)
	if len(report.Results) != expectedResults {
		t.Errorf("expected %d results, got %d", expectedResults, len(report.Results))
	}

	// 验证所有结果都有名称
	for _, result := range report.Results {
		if result.Name == "" {
			t.Error("result name should not be empty")
		}
		if result.Category == "" {
			t.Error("result category should not be empty")
		}
	}
}
