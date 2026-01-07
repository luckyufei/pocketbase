package benchmarks

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// Result 基准测试结果
type Result struct {
	Name            string        `json:"name"`
	Category        string        `json:"category"`
	TotalOperations int           `json:"total_operations"`
	SuccessCount    int           `json:"success_count"`
	ErrorCount      int           `json:"error_count"`
	TotalDuration   time.Duration `json:"total_duration_ns"`
	AvgLatency      time.Duration `json:"avg_latency_ns"`
	P50Latency      time.Duration `json:"p50_latency_ns"`
	P95Latency      time.Duration `json:"p95_latency_ns"`
	P99Latency      time.Duration `json:"p99_latency_ns"`
	MinLatency      time.Duration `json:"min_latency_ns"`
	MaxLatency      time.Duration `json:"max_latency_ns"`
	QPS             float64       `json:"qps"`
	TPS             float64       `json:"tps"`
	Concurrency     int           `json:"concurrency,omitempty"`
	ReadRatio       float64       `json:"read_ratio,omitempty"`
	Errors          []string      `json:"errors,omitempty"`
}

// Report 完整测试报告
type Report struct {
	ID          string       `json:"id"`
	Timestamp   time.Time    `json:"timestamp"`
	Config      *Config      `json:"config"`
	SystemInfo  SystemInfo   `json:"system_info"`
	Results     []Result     `json:"results"`
	Summary     Summary      `json:"summary"`
	Duration    time.Duration `json:"duration_ns"`
}

// Summary 测试摘要
type Summary struct {
	TotalTests     int     `json:"total_tests"`
	PassedTests    int     `json:"passed_tests"`
	FailedTests    int     `json:"failed_tests"`
	AvgQPS         float64 `json:"avg_qps"`
	MaxQPS         float64 `json:"max_qps"`
	AvgP95Latency  float64 `json:"avg_p95_latency_ms"`
	MaxP95Latency  float64 `json:"max_p95_latency_ms"`
}

// NewReport 创建新报告
func NewReport(cfg *Config) *Report {
	return &Report{
		ID:         fmt.Sprintf("benchmark-%d", time.Now().UnixNano()),
		Timestamp:  time.Now(),
		Config:     cfg,
		SystemInfo: GetSystemInfo(),
		Results:    make([]Result, 0),
	}
}

// AddResult 添加测试结果
func (r *Report) AddResult(result Result) {
	r.Results = append(r.Results, result)
}

// Finalize 完成报告
func (r *Report) Finalize() {
	r.Duration = time.Since(r.Timestamp)
	r.Summary = r.calculateSummary()
}

func (r *Report) calculateSummary() Summary {
	s := Summary{
		TotalTests: len(r.Results),
	}

	if len(r.Results) == 0 {
		return s
	}

	var totalQPS, totalP95 float64
	for _, result := range r.Results {
		if result.ErrorCount == 0 {
			s.PassedTests++
		} else {
			s.FailedTests++
		}
		totalQPS += result.QPS
		if result.QPS > s.MaxQPS {
			s.MaxQPS = result.QPS
		}
		p95Ms := float64(result.P95Latency) / float64(time.Millisecond)
		totalP95 += p95Ms
		if p95Ms > s.MaxP95Latency {
			s.MaxP95Latency = p95Ms
		}
	}

	s.AvgQPS = totalQPS / float64(len(r.Results))
	s.AvgP95Latency = totalP95 / float64(len(r.Results))

	return s
}

// Save 保存报告
func (r *Report) Save(outputDir string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output dir: %w", err)
	}

	filename := fmt.Sprintf("report-%s-%s.json",
		r.Config.Database,
		r.Timestamp.Format("20060102-150405"))
	path := filepath.Join(outputDir, filename)

	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal report: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write report: %w", err)
	}

	return nil
}

// CalculatePercentile 计算百分位数
func CalculatePercentile(latencies []time.Duration, percentile float64) time.Duration {
	if len(latencies) == 0 {
		return 0
	}

	sorted := make([]time.Duration, len(latencies))
	copy(sorted, latencies)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})

	index := int(float64(len(sorted)-1) * percentile / 100)
	return sorted[index]
}

// CalculateStats 计算统计信息
func CalculateStats(latencies []time.Duration) (avg, min, max, p50, p95, p99 time.Duration) {
	if len(latencies) == 0 {
		return
	}

	var total time.Duration
	min = latencies[0]
	max = latencies[0]

	for _, l := range latencies {
		total += l
		if l < min {
			min = l
		}
		if l > max {
			max = l
		}
	}

	avg = total / time.Duration(len(latencies))
	p50 = CalculatePercentile(latencies, 50)
	p95 = CalculatePercentile(latencies, 95)
	p99 = CalculatePercentile(latencies, 99)

	return
}
