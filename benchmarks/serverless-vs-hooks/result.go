package serverlessvshooks

import (
	"time"
)

// BenchmarkResult 单次基准测试结果
type BenchmarkResult struct {
	// 场景名称
	Scenario ScenarioType `json:"scenario"`

	// 运行时类型
	Runtime RuntimeType `json:"runtime"`

	// 测试参数
	Params map[string]interface{} `json:"params"`

	// 性能指标
	Metrics PerformanceMetrics `json:"metrics"`

	// 稳定性指标 (可选)
	Stability *StabilityMetrics `json:"stability,omitempty"`

	// 错误信息
	Errors []ErrorInfo `json:"errors,omitempty"`

	// 测试时间
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}

// PerformanceMetrics 性能指标
type PerformanceMetrics struct {
	// 总请求数
	TotalRequests int64 `json:"total_requests"`

	// 成功请求数
	SuccessRequests int64 `json:"success_requests"`

	// 失败请求数
	FailedRequests int64 `json:"failed_requests"`

	// 每秒请求数
	QPS float64 `json:"qps"`

	// 延迟统计 (毫秒)
	LatencyP50 float64 `json:"latency_p50_ms"`
	LatencyP95 float64 `json:"latency_p95_ms"`
	LatencyP99 float64 `json:"latency_p99_ms"`
	LatencyAvg float64 `json:"latency_avg_ms"`
	LatencyMax float64 `json:"latency_max_ms"`
	LatencyMin float64 `json:"latency_min_ms"`

	// 成功率
	SuccessRate float64 `json:"success_rate"`

	// 测试持续时间
	Duration time.Duration `json:"duration"`
}

// StabilityMetrics 稳定性指标
type StabilityMetrics struct {
	// 内存使用 (MB)
	MemoryStart   float64   `json:"memory_start_mb"`
	MemoryEnd     float64   `json:"memory_end_mb"`
	MemoryPeak    float64   `json:"memory_peak_mb"`
	MemoryGrowth  float64   `json:"memory_growth_percent"`
	MemorySamples []float64 `json:"memory_samples_mb,omitempty"`

	// 错误率趋势
	ErrorRateSamples []float64 `json:"error_rate_samples,omitempty"`

	// 延迟趋势
	LatencyP99Samples []float64 `json:"latency_p99_samples,omitempty"`

	// 是否通过稳定性测试
	Passed bool `json:"passed"`

	// 失败原因
	FailureReason string `json:"failure_reason,omitempty"`
}

// ErrorInfo 错误信息
type ErrorInfo struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Count   int    `json:"count"`
}

// ComparisonResult 对比结果
type ComparisonResult struct {
	// 场景名称
	Scenario ScenarioType `json:"scenario"`

	// jsvm 结果
	JSVM *BenchmarkResult `json:"jsvm"`

	// serverless 结果
	Serverless *BenchmarkResult `json:"serverless"`

	// 对比指标
	Comparison ComparisonMetrics `json:"comparison"`
}

// ComparisonMetrics 对比指标
type ComparisonMetrics struct {
	// QPS 比率 (serverless / jsvm)
	QPSRatio float64 `json:"qps_ratio"`

	// P99 延迟比率
	LatencyP99Ratio float64 `json:"latency_p99_ratio"`

	// 成功率差异
	SuccessRateDiff float64 `json:"success_rate_diff"`

	// 内存增长差异 (稳定性测试)
	MemoryGrowthDiff float64 `json:"memory_growth_diff,omitempty"`

	// 性能胜出者
	PerformanceWinner RuntimeType `json:"performance_winner"`

	// 稳定性胜出者
	StabilityWinner RuntimeType `json:"stability_winner,omitempty"`
}

// FullReport 完整测试报告
type FullReport struct {
	// 元数据
	Meta ReportMeta `json:"meta"`

	// 各场景对比结果
	Scenarios map[ScenarioType]*ComparisonResult `json:"scenarios"`

	// 汇总
	Summary ReportSummary `json:"summary"`
}

// ReportMeta 报告元数据
type ReportMeta struct {
	// 报告生成时间
	Timestamp time.Time `json:"timestamp"`

	// 测试总时长
	TotalDuration time.Duration `json:"total_duration"`

	// 环境信息
	Environment EnvironmentInfo `json:"environment"`

	// 配置信息
	Config Config `json:"config"`
}

// EnvironmentInfo 环境信息
type EnvironmentInfo struct {
	// 操作系统
	OS string `json:"os"`

	// CPU 信息
	CPU string `json:"cpu"`

	// CPU 核心数
	CPUCores int `json:"cpu_cores"`

	// 内存大小 (GB)
	MemoryGB float64 `json:"memory_gb"`

	// Go 版本
	GoVersion string `json:"go_version"`

	// PocketBase 版本
	PBVersion string `json:"pb_version"`
}

// ReportSummary 报告汇总
type ReportSummary struct {
	// 总体性能胜出者
	OverallPerformanceWinner RuntimeType `json:"overall_performance_winner"`

	// 总体稳定性胜出者
	OverallStabilityWinner RuntimeType `json:"overall_stability_winner"`

	// 各场景胜出统计
	WinCount map[RuntimeType]int `json:"win_count"`

	// 推荐使用场景
	Recommendations []Recommendation `json:"recommendations"`

	// 关键发现
	KeyFindings []string `json:"key_findings"`
}

// Recommendation 使用建议
type Recommendation struct {
	Scenario    string      `json:"scenario"`
	Recommended RuntimeType `json:"recommended"`
	Reason      string      `json:"reason"`
}

// NewFullReport 创建新的完整报告
func NewFullReport(cfg Config, env EnvironmentInfo) *FullReport {
	return &FullReport{
		Meta: ReportMeta{
			Timestamp:   time.Now(),
			Environment: env,
			Config:      cfg,
		},
		Scenarios: make(map[ScenarioType]*ComparisonResult),
		Summary: ReportSummary{
			WinCount:        make(map[RuntimeType]int),
			Recommendations: []Recommendation{},
			KeyFindings:     []string{},
		},
	}
}

// AddResult 添加测试结果
func (r *FullReport) AddResult(result *BenchmarkResult) {
	if r.Scenarios[result.Scenario] == nil {
		r.Scenarios[result.Scenario] = &ComparisonResult{
			Scenario: result.Scenario,
		}
	}

	switch result.Runtime {
	case RuntimeJSVM:
		r.Scenarios[result.Scenario].JSVM = result
	case RuntimeServerless:
		r.Scenarios[result.Scenario].Serverless = result
	}

	// 如果两个运行时都有结果，计算对比指标
	comp := r.Scenarios[result.Scenario]
	if comp.JSVM != nil && comp.Serverless != nil {
		r.calculateComparison(comp)
	}
}

// calculateComparison 计算对比指标
func (r *FullReport) calculateComparison(comp *ComparisonResult) {
	jsvm := comp.JSVM.Metrics
	serverless := comp.Serverless.Metrics

	comp.Comparison = ComparisonMetrics{}

	// QPS 比率
	if jsvm.QPS > 0 {
		comp.Comparison.QPSRatio = serverless.QPS / jsvm.QPS
	}

	// P99 延迟比率
	if jsvm.LatencyP99 > 0 {
		comp.Comparison.LatencyP99Ratio = serverless.LatencyP99 / jsvm.LatencyP99
	}

	// 成功率差异
	comp.Comparison.SuccessRateDiff = serverless.SuccessRate - jsvm.SuccessRate

	// 判断胜出者
	if comp.Comparison.QPSRatio >= 1.0 {
		comp.Comparison.PerformanceWinner = RuntimeServerless
	} else {
		comp.Comparison.PerformanceWinner = RuntimeJSVM
	}

	// 稳定性对比
	if comp.JSVM.Stability != nil && comp.Serverless.Stability != nil {
		jsvmStab := comp.JSVM.Stability
		serverlessStab := comp.Serverless.Stability

		comp.Comparison.MemoryGrowthDiff = serverlessStab.MemoryGrowth - jsvmStab.MemoryGrowth

		if serverlessStab.Passed && !jsvmStab.Passed {
			comp.Comparison.StabilityWinner = RuntimeServerless
		} else if !serverlessStab.Passed && jsvmStab.Passed {
			comp.Comparison.StabilityWinner = RuntimeJSVM
		} else if serverlessStab.MemoryGrowth < jsvmStab.MemoryGrowth {
			comp.Comparison.StabilityWinner = RuntimeServerless
		} else {
			comp.Comparison.StabilityWinner = RuntimeJSVM
		}
	}

	// 更新胜出统计
	r.Summary.WinCount[comp.Comparison.PerformanceWinner]++
}

// Finalize 完成报告生成
func (r *FullReport) Finalize() {
	// 计算总体胜出者
	if r.Summary.WinCount[RuntimeServerless] > r.Summary.WinCount[RuntimeJSVM] {
		r.Summary.OverallPerformanceWinner = RuntimeServerless
	} else {
		r.Summary.OverallPerformanceWinner = RuntimeJSVM
	}

	// 生成建议
	r.generateRecommendations()

	// 生成关键发现
	r.generateKeyFindings()

	// 记录总时长
	r.Meta.TotalDuration = time.Since(r.Meta.Timestamp)
}

// generateRecommendations 生成使用建议
func (r *FullReport) generateRecommendations() {
	for scenario, comp := range r.Scenarios {
		if comp.JSVM == nil || comp.Serverless == nil {
			continue
		}

		rec := Recommendation{
			Scenario: string(scenario),
		}

		switch scenario {
		case ScenarioHTTPHandler, ScenarioDBHook:
			if comp.Comparison.QPSRatio >= 0.8 {
				rec.Recommended = RuntimeServerless
				rec.Reason = "性能差距小于 20%，serverless 提供更好的隔离性和安全性"
			} else {
				rec.Recommended = RuntimeJSVM
				rec.Reason = "jsvm 性能显著更高，适合对延迟敏感的场景"
			}

		case ScenarioCompute:
			if comp.Comparison.QPSRatio >= 1.0 {
				rec.Recommended = RuntimeServerless
				rec.Reason = "QuickJS 在计算密集型任务上表现更好"
			} else {
				rec.Recommended = RuntimeJSVM
				rec.Reason = "Goja 在此场景下性能更优"
			}

		case ScenarioMemoryPressure, ScenarioErrorRecovery:
			rec.Recommended = RuntimeServerless
			rec.Reason = "serverless 提供内存限制和错误隔离，更适合不可信代码"

		case ScenarioStability:
			if comp.Comparison.StabilityWinner == RuntimeServerless {
				rec.Recommended = RuntimeServerless
				rec.Reason = "serverless 内存管理更稳定，适合长时间运行"
			} else {
				rec.Recommended = RuntimeJSVM
				rec.Reason = "jsvm 在此测试中表现更稳定"
			}
		}

		r.Summary.Recommendations = append(r.Summary.Recommendations, rec)
	}
}

// generateKeyFindings 生成关键发现
func (r *FullReport) generateKeyFindings() {
	findings := []string{}

	// 性能对比
	jsvmWins := r.Summary.WinCount[RuntimeJSVM]
	serverlessWins := r.Summary.WinCount[RuntimeServerless]

	if jsvmWins > serverlessWins {
		findings = append(findings,
			"jsvm 在大多数性能测试中胜出，适合对延迟敏感的应用")
	} else if serverlessWins > jsvmWins {
		findings = append(findings,
			"serverless 在多数场景下性能表现更优")
	} else {
		findings = append(findings,
			"两种运行时在性能上表现相当，选择应基于其他因素")
	}

	// 稳定性对比
	if comp, ok := r.Scenarios[ScenarioStability]; ok && comp.Comparison.StabilityWinner != "" {
		if comp.Comparison.StabilityWinner == RuntimeServerless {
			findings = append(findings,
				"serverless 在长时间运行测试中内存管理更优")
		}
	}

	// 错误隔离
	if comp, ok := r.Scenarios[ScenarioErrorRecovery]; ok {
		if comp.Serverless != nil && comp.Serverless.Metrics.SuccessRate == 100 {
			findings = append(findings,
				"serverless 完全隔离 JS 错误，不影响主进程稳定性")
		}
	}

	r.Summary.KeyFindings = findings
}
