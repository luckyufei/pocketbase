// Package serverlessvshooks 提供 serverless 与 jsvm hooks 的性能对比测试
package serverlessvshooks

import (
	"encoding/json"
	"os"
	"time"
)

// Config 测试配置
type Config struct {
	// PocketBase 服务地址
	BaseURL string `json:"base_url"`

	// 测试场景配置
	Scenarios ScenarioConfig `json:"scenarios"`

	// 并发配置
	Concurrency ConcurrencyConfig `json:"concurrency"`

	// 输出配置
	Output OutputConfig `json:"output"`
}

// ScenarioConfig 场景配置
type ScenarioConfig struct {
	// 启用的场景列表
	Enabled []string `json:"enabled"`

	// HTTP Handler 测试配置
	HTTPHandler HTTPHandlerConfig `json:"http_handler"`

	// DB Hook 测试配置
	DBHook DBHookConfig `json:"db_hook"`

	// 计算密集型测试配置
	Compute ComputeConfig `json:"compute"`

	// I/O 密集型测试配置
	IOIntensive IOIntensiveConfig `json:"io_intensive"`

	// 内存压力测试配置
	MemoryPressure MemoryPressureConfig `json:"memory_pressure"`

	// 稳定性测试配置
	Stability StabilityConfig `json:"stability"`

	// 错误恢复测试配置
	ErrorRecovery ErrorRecoveryConfig `json:"error_recovery"`
}

// HTTPHandlerConfig HTTP Handler 测试配置
type HTTPHandlerConfig struct {
	Duration time.Duration `json:"duration"`
	Warmup   int           `json:"warmup"`
}

// DBHookConfig DB Hook 测试配置
type DBHookConfig struct {
	Duration       time.Duration `json:"duration"`
	PreloadRecords int           `json:"preload_records"`
}

// ComputeConfig 计算密集型测试配置
type ComputeConfig struct {
	FibNumbers []int `json:"fib_numbers"`
	Iterations int   `json:"iterations"`
}

// IOIntensiveConfig I/O 密集型测试配置
type IOIntensiveConfig struct {
	QueryCounts []int         `json:"query_counts"`
	Duration    time.Duration `json:"duration"`
}

// MemoryPressureConfig 内存压力测试配置
type MemoryPressureConfig struct {
	SizesMB []int `json:"sizes_mb"`
}

// StabilityConfig 稳定性测试配置
type StabilityConfig struct {
	Duration       time.Duration `json:"duration"`
	SampleInterval time.Duration `json:"sample_interval"`
}

// ErrorRecoveryConfig 错误恢复测试配置
type ErrorRecoveryConfig struct {
	TestCases []string `json:"test_cases"`
}

// ConcurrencyConfig 并发配置
type ConcurrencyConfig struct {
	// 并发级别列表
	Levels []int `json:"levels"`

	// 默认并发数
	Default int `json:"default"`
}

// OutputConfig 输出配置
type OutputConfig struct {
	// 报告输出目录
	ReportDir string `json:"report_dir"`

	// 是否生成 JSON 报告
	JSON bool `json:"json"`

	// 是否生成 Markdown 报告
	Markdown bool `json:"markdown"`

	// 是否输出详细日志
	Verbose bool `json:"verbose"`
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		BaseURL: "http://127.0.0.1:8090",
		Scenarios: ScenarioConfig{
			Enabled: []string{
				"http_handler",
				"db_hook",
				"compute",
				"io_intensive",
				"memory_pressure",
				"error_recovery",
			},
			HTTPHandler: HTTPHandlerConfig{
				Duration: 30 * time.Second,
				Warmup:   100,
			},
			DBHook: DBHookConfig{
				Duration:       60 * time.Second,
				PreloadRecords: 1000,
			},
			Compute: ComputeConfig{
				FibNumbers: []int{20, 25, 30},
				Iterations: 100,
			},
			IOIntensive: IOIntensiveConfig{
				QueryCounts: []int{1, 5, 10, 20},
				Duration:    30 * time.Second,
			},
			MemoryPressure: MemoryPressureConfig{
				SizesMB: []int{1, 5, 10, 50},
			},
			Stability: StabilityConfig{
				Duration:       1 * time.Hour,
				SampleInterval: 1 * time.Minute,
			},
			ErrorRecovery: ErrorRecoveryConfig{
				TestCases: []string{
					"syntax_error",
					"runtime_error",
					"infinite_loop",
					"stack_overflow",
					"memory_overflow",
				},
			},
		},
		Concurrency: ConcurrencyConfig{
			Levels:  []int{10, 50, 100, 200},
			Default: 50,
		},
		Output: OutputConfig{
			ReportDir: "reports/serverless-vs-hooks",
			JSON:      true,
			Markdown:  true,
			Verbose:   false,
		},
	}
}

// LoadConfig 从文件加载配置
func LoadConfig(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return DefaultConfig(), err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return DefaultConfig(), err
	}

	return cfg, nil
}

// SaveConfig 保存配置到文件
func (c Config) SaveConfig(path string) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// RuntimeType 运行时类型
type RuntimeType string

const (
	RuntimeJSVM       RuntimeType = "jsvm"
	RuntimeServerless RuntimeType = "serverless"
)

// ScenarioType 场景类型
type ScenarioType string

const (
	ScenarioHTTPHandler    ScenarioType = "http_handler"
	ScenarioDBHook         ScenarioType = "db_hook"
	ScenarioCompute        ScenarioType = "compute"
	ScenarioIOIntensive    ScenarioType = "io_intensive"
	ScenarioMemoryPressure ScenarioType = "memory_pressure"
	ScenarioStability      ScenarioType = "stability"
	ScenarioErrorRecovery  ScenarioType = "error_recovery"
)
