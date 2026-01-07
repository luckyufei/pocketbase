package benchmarks

import (
	"fmt"
	"time"
)

// Benchmark 基准测试接口
type Benchmark interface {
	Name() string
	Run() (*BenchmarkResult, error)
}

// BenchmarkRunner 基准测试运行器
type BenchmarkRunner struct {
	config     *Config
	benchmarks []Benchmark
}

// NewBenchmarkRunner 创建新的基准测试运行器
func NewBenchmarkRunner(config *Config) *BenchmarkRunner {
	return &BenchmarkRunner{
		config:     config,
		benchmarks: make([]Benchmark, 0),
	}
}

// AddBenchmark 添加基准测试
func (r *BenchmarkRunner) AddBenchmark(b Benchmark) {
	r.benchmarks = append(r.benchmarks, b)
}

// Run 运行所有基准测试
func (r *BenchmarkRunner) Run(benchmarks ...Benchmark) ([]*BenchmarkResult, error) {
	var results []*BenchmarkResult

	for _, b := range benchmarks {
		if r.config.Verbose {
			fmt.Printf("🔄 运行测试: %s\n", b.Name())
		}

		result, err := b.Run()
		if err != nil {
			return nil, fmt.Errorf("benchmark %s failed: %w", b.Name(), err)
		}

		results = append(results, result)
	}

	return results, nil
}

// BenchmarkResult 基准测试结果
type BenchmarkResult struct {
	Name            string        `json:"name"`
	Operations      int64         `json:"operations"`
	Duration        time.Duration `json:"duration"`
	OpsPerSecond    float64       `json:"ops_per_second"`
	AvgLatency      time.Duration `json:"avg_latency"`
	MinLatency      time.Duration `json:"min_latency"`
	MaxLatency      time.Duration `json:"max_latency"`
	P50Latency      time.Duration `json:"p50_latency"`
	P95Latency      time.Duration `json:"p95_latency"`
	P99Latency      time.Duration `json:"p99_latency"`
	Errors          int64         `json:"errors"`
	SuccessRate     float64       `json:"success_rate"`
	BytesRead       int64         `json:"bytes_read,omitempty"`
	BytesWritten    int64         `json:"bytes_written,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// Print 打印基准测试结果
func (r *BenchmarkResult) Print() {
	fmt.Printf("\n📊 基准测试结果: %s\n", r.Name)
	fmt.Printf("==========================================\n")
	fmt.Printf("操作数:       %d\n", r.Operations)
	fmt.Printf("持续时间:     %v\n", r.Duration)
	fmt.Printf("吞吐量:       %.2f ops/s\n", r.OpsPerSecond)
	fmt.Printf("错误数:       %d\n", r.Errors)
	fmt.Printf("成功率:       %.2f%%\n", r.SuccessRate)
	fmt.Printf("\n⏱️ 延迟统计:\n")
	fmt.Printf("最小延迟:     %v\n", r.MinLatency)
	fmt.Printf("最大延迟:     %v\n", r.MaxLatency)
	fmt.Printf("平均延迟:     %v\n", r.AvgLatency)
	fmt.Printf("P50 延迟:     %v\n", r.P50Latency)
	fmt.Printf("P95 延迟:     %v\n", r.P95Latency)
	fmt.Printf("P99 延迟:     %v\n", r.P99Latency)
	if r.BytesRead > 0 || r.BytesWritten > 0 {
		fmt.Printf("\n📦 数据传输:\n")
		if r.BytesRead > 0 {
			fmt.Printf("读取字节:     %d (%.2f MB)\n", r.BytesRead, float64(r.BytesRead)/1024/1024)
		}
		if r.BytesWritten > 0 {
			fmt.Printf("写入字节:     %d (%.2f MB)\n", r.BytesWritten, float64(r.BytesWritten)/1024/1024)
		}
	}
	fmt.Printf("==========================================\n")
}


