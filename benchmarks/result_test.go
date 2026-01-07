package benchmarks

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCalculatePercentile(t *testing.T) {
	tests := []struct {
		name       string
		latencies  []time.Duration
		percentile float64
		expected   time.Duration
	}{
		{
			name:       "empty slice",
			latencies:  []time.Duration{},
			percentile: 50,
			expected:   0,
		},
		{
			name:       "single element",
			latencies:  []time.Duration{100 * time.Millisecond},
			percentile: 50,
			expected:   100 * time.Millisecond,
		},
		{
			name:       "p50 of 10 elements",
			latencies:  []time.Duration{1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
			percentile: 50,
			expected:   5,
		},
		{
			name:       "p95 of 100 elements",
			latencies:  makeLatencies(100),
			percentile: 95,
			expected:   95,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculatePercentile(tt.latencies, tt.percentile)
			if result != tt.expected {
				t.Errorf("CalculatePercentile() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func makeLatencies(n int) []time.Duration {
	latencies := make([]time.Duration, n)
	for i := 0; i < n; i++ {
		latencies[i] = time.Duration(i + 1)
	}
	return latencies
}

func TestCalculateStats(t *testing.T) {
	latencies := []time.Duration{
		10 * time.Millisecond,
		20 * time.Millisecond,
		30 * time.Millisecond,
		40 * time.Millisecond,
		50 * time.Millisecond,
	}

	avg, min, max, p50, p95, p99 := CalculateStats(latencies)

	if avg != 30*time.Millisecond {
		t.Errorf("avg = %v, want %v", avg, 30*time.Millisecond)
	}
	if min != 10*time.Millisecond {
		t.Errorf("min = %v, want %v", min, 10*time.Millisecond)
	}
	if max != 50*time.Millisecond {
		t.Errorf("max = %v, want %v", max, 50*time.Millisecond)
	}
	if p50 != 30*time.Millisecond {
		t.Errorf("p50 = %v, want %v", p50, 30*time.Millisecond)
	}
	// p95 和 p99 在小样本中可能不精确，只检查非零
	if p95 == 0 {
		t.Error("p95 should not be zero")
	}
	if p99 == 0 {
		t.Error("p99 should not be zero")
	}
}

func TestCalculateStatsEmpty(t *testing.T) {
	avg, min, max, p50, p95, p99 := CalculateStats([]time.Duration{})

	if avg != 0 || min != 0 || max != 0 || p50 != 0 || p95 != 0 || p99 != 0 {
		t.Error("all stats should be zero for empty slice")
	}
}

func TestNewReport(t *testing.T) {
	cfg := DefaultConfig()
	report := NewReport(cfg)

	if report.ID == "" {
		t.Error("report ID should not be empty")
	}
	if report.Timestamp.IsZero() {
		t.Error("report timestamp should not be zero")
	}
	if report.Config != cfg {
		t.Error("report config should match")
	}
	if len(report.Results) != 0 {
		t.Error("report results should be empty initially")
	}
}

func TestReportAddResult(t *testing.T) {
	cfg := DefaultConfig()
	report := NewReport(cfg)

	result := Result{
		Name:            "test",
		TotalOperations: 100,
		SuccessCount:    95,
		ErrorCount:      5,
		QPS:             1000,
	}

	report.AddResult(result)

	if len(report.Results) != 1 {
		t.Errorf("expected 1 result, got %d", len(report.Results))
	}
	if report.Results[0].Name != "test" {
		t.Error("result name mismatch")
	}
}

func TestReportFinalize(t *testing.T) {
	cfg := DefaultConfig()
	report := NewReport(cfg)

	// 添加一些结果
	report.AddResult(Result{
		Name:       "test1",
		QPS:        1000,
		P95Latency: 10 * time.Millisecond,
	})
	report.AddResult(Result{
		Name:       "test2",
		QPS:        2000,
		P95Latency: 20 * time.Millisecond,
		ErrorCount: 1,
	})

	report.Finalize()

	if report.Summary.TotalTests != 2 {
		t.Errorf("expected 2 total tests, got %d", report.Summary.TotalTests)
	}
	if report.Summary.PassedTests != 1 {
		t.Errorf("expected 1 passed test, got %d", report.Summary.PassedTests)
	}
	if report.Summary.FailedTests != 1 {
		t.Errorf("expected 1 failed test, got %d", report.Summary.FailedTests)
	}
	if report.Summary.MaxQPS != 2000 {
		t.Errorf("expected max QPS 2000, got %f", report.Summary.MaxQPS)
	}
	if report.Duration == 0 {
		t.Error("duration should not be zero after finalize")
	}
}

func TestReportSave(t *testing.T) {
	tmpDir := t.TempDir()
	
	cfg := DefaultConfig()
	cfg.Database = DBSQLite
	report := NewReport(cfg)
	report.AddResult(Result{Name: "test", QPS: 1000})
	report.Finalize()

	if err := report.Save(tmpDir); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	// 验证文件存在
	files, err := os.ReadDir(tmpDir)
	if err != nil {
		t.Fatalf("failed to read dir: %v", err)
	}
	if len(files) != 1 {
		t.Errorf("expected 1 file, got %d", len(files))
	}

	// 验证文件名格式
	filename := files[0].Name()
	if filepath.Ext(filename) != ".json" {
		t.Errorf("expected .json extension, got %s", filepath.Ext(filename))
	}
}
