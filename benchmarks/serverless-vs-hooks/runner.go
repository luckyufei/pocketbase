package serverlessvshooks

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// Runner 测试运行器
type Runner struct {
	config  Config
	client  *http.Client
	report  *FullReport
	verbose bool
}

// NewRunner 创建新的测试运行器
func NewRunner(cfg Config) *Runner {
	return &Runner{
		config: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        1000,
				MaxIdleConnsPerHost: 1000,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		report:  NewFullReport(cfg, getEnvironmentInfo()),
		verbose: cfg.Output.Verbose,
	}
}

// Run 运行所有测试
func (r *Runner) Run(ctx context.Context) (*FullReport, error) {
	r.log("开始 Serverless vs Hooks 性能对比测试")
	r.log("测试配置: %+v", r.config)

	// 运行各场景测试
	for _, scenario := range r.config.Scenarios.Enabled {
		if err := ctx.Err(); err != nil {
			return r.report, err
		}

		r.log("\n========== 场景: %s ==========", scenario)

		switch ScenarioType(scenario) {
		case ScenarioHTTPHandler:
			r.runHTTPHandlerBenchmark(ctx)
		case ScenarioDBHook:
			r.runDBHookBenchmark(ctx)
		case ScenarioCompute:
			r.runComputeBenchmark(ctx)
		case ScenarioIOIntensive:
			r.runIOIntensiveBenchmark(ctx)
		case ScenarioMemoryPressure:
			r.runMemoryPressureBenchmark(ctx)
		case ScenarioStability:
			r.runStabilityBenchmark(ctx)
		case ScenarioErrorRecovery:
			r.runErrorRecoveryBenchmark(ctx)
		default:
			r.log("未知场景: %s", scenario)
		}
	}

	// 完成报告
	r.report.Finalize()
	r.log("\n测试完成，总耗时: %v", r.report.Meta.TotalDuration)

	return r.report, nil
}

// runHTTPHandlerBenchmark 运行 HTTP Handler 性能测试
func (r *Runner) runHTTPHandlerBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.HTTPHandler

	for _, concurrency := range r.config.Concurrency.Levels {
		r.log("并发数: %d", concurrency)

		// 测试 jsvm
		jsvmResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeJSVM,
			Scenario:    ScenarioHTTPHandler,
			URL:         fmt.Sprintf("%s/api/benchmark/jsvm/hello", r.config.BaseURL),
			Method:      "GET",
			Concurrency: concurrency,
			Duration:    cfg.Duration,
			Warmup:      cfg.Warmup,
		})
		r.report.AddResult(jsvmResult)

		// 测试 serverless
		serverlessResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeServerless,
			Scenario:    ScenarioHTTPHandler,
			URL:         fmt.Sprintf("%s/api/benchmark/serverless/hello", r.config.BaseURL),
			Method:      "GET",
			Concurrency: concurrency,
			Duration:    cfg.Duration,
			Warmup:      cfg.Warmup,
		})
		r.report.AddResult(serverlessResult)

		r.printComparison(jsvmResult, serverlessResult)
	}
}

// runDBHookBenchmark 运行 DB Hook 性能测试
func (r *Runner) runDBHookBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.DBHook
	concurrency := r.config.Concurrency.Default

	// 测试 jsvm
	jsvmResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
		Runtime:     RuntimeJSVM,
		Scenario:    ScenarioDBHook,
		URL:         fmt.Sprintf("%s/api/collections/benchmark_jsvm/records", r.config.BaseURL),
		Method:      "POST",
		Body:        `{"name": "test", "value": 123}`,
		Concurrency: concurrency,
		Duration:    cfg.Duration,
	})
	r.report.AddResult(jsvmResult)

	// 测试 serverless
	serverlessResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
		Runtime:     RuntimeServerless,
		Scenario:    ScenarioDBHook,
		URL:         fmt.Sprintf("%s/api/collections/benchmark_serverless/records", r.config.BaseURL),
		Method:      "POST",
		Body:        `{"name": "test", "value": 123}`,
		Concurrency: concurrency,
		Duration:    cfg.Duration,
	})
	r.report.AddResult(serverlessResult)

	r.printComparison(jsvmResult, serverlessResult)
}

// runComputeBenchmark 运行计算密集型测试
func (r *Runner) runComputeBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.Compute
	concurrency := 10

	for _, n := range cfg.FibNumbers {
		r.log("斐波那契 n=%d", n)

		// 测试 jsvm
		jsvmResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeJSVM,
			Scenario:    ScenarioCompute,
			URL:         fmt.Sprintf("%s/api/benchmark/jsvm/fib?n=%d", r.config.BaseURL, n),
			Method:      "GET",
			Concurrency: concurrency,
			Iterations:  cfg.Iterations,
			Params:      map[string]interface{}{"n": n},
		})
		r.report.AddResult(jsvmResult)

		// 测试 serverless
		serverlessResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeServerless,
			Scenario:    ScenarioCompute,
			URL:         fmt.Sprintf("%s/api/benchmark/serverless/fib?n=%d", r.config.BaseURL, n),
			Method:      "GET",
			Concurrency: concurrency,
			Iterations:  cfg.Iterations,
			Params:      map[string]interface{}{"n": n},
		})
		r.report.AddResult(serverlessResult)

		r.printComparison(jsvmResult, serverlessResult)
	}
}

// runIOIntensiveBenchmark 运行 I/O 密集型测试
func (r *Runner) runIOIntensiveBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.IOIntensive
	concurrency := r.config.Concurrency.Default

	for _, count := range cfg.QueryCounts {
		r.log("查询次数: %d", count)

		// 测试 jsvm
		jsvmResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeJSVM,
			Scenario:    ScenarioIOIntensive,
			URL:         fmt.Sprintf("%s/api/benchmark/jsvm/query?count=%d", r.config.BaseURL, count),
			Method:      "GET",
			Concurrency: concurrency,
			Duration:    cfg.Duration,
			Params:      map[string]interface{}{"count": count},
		})
		r.report.AddResult(jsvmResult)

		// 测试 serverless
		serverlessResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeServerless,
			Scenario:    ScenarioIOIntensive,
			URL:         fmt.Sprintf("%s/api/benchmark/serverless/query?count=%d", r.config.BaseURL, count),
			Method:      "GET",
			Concurrency: concurrency,
			Duration:    cfg.Duration,
			Params:      map[string]interface{}{"count": count},
		})
		r.report.AddResult(serverlessResult)

		r.printComparison(jsvmResult, serverlessResult)
	}
}

// runMemoryPressureBenchmark 运行内存压力测试
func (r *Runner) runMemoryPressureBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.MemoryPressure
	concurrency := 10

	for _, sizeMB := range cfg.SizesMB {
		r.log("内存分配: %d MB", sizeMB)

		// 测试 jsvm (可能无限制)
		jsvmResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeJSVM,
			Scenario:    ScenarioMemoryPressure,
			URL:         fmt.Sprintf("%s/api/benchmark/jsvm/memory?size=%d", r.config.BaseURL, sizeMB),
			Method:      "GET",
			Concurrency: concurrency,
			Iterations:  10,
			Params:      map[string]interface{}{"size_mb": sizeMB},
		})
		r.report.AddResult(jsvmResult)

		// 测试 serverless (应有内存限制)
		serverlessResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeServerless,
			Scenario:    ScenarioMemoryPressure,
			URL:         fmt.Sprintf("%s/api/benchmark/serverless/memory?size=%d", r.config.BaseURL, sizeMB),
			Method:      "GET",
			Concurrency: concurrency,
			Iterations:  10,
			Params:      map[string]interface{}{"size_mb": sizeMB},
		})
		r.report.AddResult(serverlessResult)

		r.printComparison(jsvmResult, serverlessResult)
	}
}

// runStabilityBenchmark 运行稳定性测试
func (r *Runner) runStabilityBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.Stability
	r.log("稳定性测试，持续时间: %v", cfg.Duration)

	// 此测试需要长时间运行，收集内存和性能趋势
	// 简化版：运行混合负载并采样
	r.log("稳定性测试需要较长时间，建议单独运行")
}

// runErrorRecoveryBenchmark 运行错误恢复测试
func (r *Runner) runErrorRecoveryBenchmark(ctx context.Context) {
	cfg := r.config.Scenarios.ErrorRecovery

	for _, testCase := range cfg.TestCases {
		r.log("错误类型: %s", testCase)

		// 测试 jsvm
		jsvmResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeJSVM,
			Scenario:    ScenarioErrorRecovery,
			URL:         fmt.Sprintf("%s/api/benchmark/jsvm/error?type=%s", r.config.BaseURL, testCase),
			Method:      "GET",
			Concurrency: 1,
			Iterations:  10,
			Params:      map[string]interface{}{"error_type": testCase},
		})
		r.report.AddResult(jsvmResult)

		// 测试 serverless
		serverlessResult := r.benchmarkEndpoint(ctx, BenchmarkParams{
			Runtime:     RuntimeServerless,
			Scenario:    ScenarioErrorRecovery,
			URL:         fmt.Sprintf("%s/api/benchmark/serverless/error?type=%s", r.config.BaseURL, testCase),
			Method:      "GET",
			Concurrency: 1,
			Iterations:  10,
			Params:      map[string]interface{}{"error_type": testCase},
		})
		r.report.AddResult(serverlessResult)

		r.printComparison(jsvmResult, serverlessResult)
	}
}

// BenchmarkParams 基准测试参数
type BenchmarkParams struct {
	Runtime     RuntimeType
	Scenario    ScenarioType
	URL         string
	Method      string
	Body        string
	Headers     map[string]string
	Concurrency int
	Duration    time.Duration
	Iterations  int
	Warmup      int
	Params      map[string]interface{}
}

// benchmarkEndpoint 对单个端点进行基准测试
func (r *Runner) benchmarkEndpoint(ctx context.Context, params BenchmarkParams) *BenchmarkResult {
	result := &BenchmarkResult{
		Scenario:  params.Scenario,
		Runtime:   params.Runtime,
		Params:    params.Params,
		StartTime: time.Now(),
	}

	// 预热
	if params.Warmup > 0 {
		r.log("预热 %d 次请求...", params.Warmup)
		for i := 0; i < params.Warmup; i++ {
			r.doRequest(ctx, params.URL, params.Method, params.Body)
		}
	}

	// 收集延迟数据
	var latencies []time.Duration
	var mu sync.Mutex
	var totalRequests, successRequests, failedRequests int64

	// 确定测试方式
	var wg sync.WaitGroup
	startTime := time.Now()

	if params.Duration > 0 {
		// 基于时间的测试
		deadline := time.Now().Add(params.Duration)
		for i := 0; i < params.Concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for time.Now().Before(deadline) {
					if ctx.Err() != nil {
						return
					}
					start := time.Now()
					err := r.doRequest(ctx, params.URL, params.Method, params.Body)
					elapsed := time.Since(start)

					atomic.AddInt64(&totalRequests, 1)
					if err == nil {
						atomic.AddInt64(&successRequests, 1)
					} else {
						atomic.AddInt64(&failedRequests, 1)
					}

					mu.Lock()
					latencies = append(latencies, elapsed)
					mu.Unlock()
				}
			}()
		}
	} else if params.Iterations > 0 {
		// 基于次数的测试
		iterPerWorker := params.Iterations / params.Concurrency
		for i := 0; i < params.Concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for j := 0; j < iterPerWorker; j++ {
					if ctx.Err() != nil {
						return
					}
					start := time.Now()
					err := r.doRequest(ctx, params.URL, params.Method, params.Body)
					elapsed := time.Since(start)

					atomic.AddInt64(&totalRequests, 1)
					if err == nil {
						atomic.AddInt64(&successRequests, 1)
					} else {
						atomic.AddInt64(&failedRequests, 1)
					}

					mu.Lock()
					latencies = append(latencies, elapsed)
					mu.Unlock()
				}
			}()
		}
	}

	wg.Wait()
	duration := time.Since(startTime)

	// 计算统计数据
	result.EndTime = time.Now()
	result.Metrics = r.calculateMetrics(latencies, totalRequests, successRequests, failedRequests, duration)

	return result
}

// doRequest 执行单次请求
func (r *Runner) doRequest(ctx context.Context, url, method, body string) error {
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return err
	}

	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 读取响应体
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return nil
}

// calculateMetrics 计算性能指标
func (r *Runner) calculateMetrics(latencies []time.Duration, total, success, failed int64, duration time.Duration) PerformanceMetrics {
	metrics := PerformanceMetrics{
		TotalRequests:   total,
		SuccessRequests: success,
		FailedRequests:  failed,
		Duration:        duration,
	}

	if total > 0 {
		metrics.SuccessRate = float64(success) / float64(total) * 100
		metrics.QPS = float64(total) / duration.Seconds()
	}

	if len(latencies) > 0 {
		// 排序计算百分位
		sort.Slice(latencies, func(i, j int) bool {
			return latencies[i] < latencies[j]
		})

		var sum time.Duration
		for _, l := range latencies {
			sum += l
		}

		metrics.LatencyAvg = float64(sum.Milliseconds()) / float64(len(latencies))
		metrics.LatencyMin = float64(latencies[0].Milliseconds())
		metrics.LatencyMax = float64(latencies[len(latencies)-1].Milliseconds())
		metrics.LatencyP50 = float64(latencies[len(latencies)*50/100].Milliseconds())
		metrics.LatencyP95 = float64(latencies[len(latencies)*95/100].Milliseconds())
		metrics.LatencyP99 = float64(latencies[len(latencies)*99/100].Milliseconds())
	}

	return metrics
}

// printComparison 打印对比结果
func (r *Runner) printComparison(jsvm, serverless *BenchmarkResult) {
	r.log("  jsvm:       QPS=%.1f, P99=%.1fms, 成功率=%.1f%%",
		jsvm.Metrics.QPS, jsvm.Metrics.LatencyP99, jsvm.Metrics.SuccessRate)
	r.log("  serverless: QPS=%.1f, P99=%.1fms, 成功率=%.1f%%",
		serverless.Metrics.QPS, serverless.Metrics.LatencyP99, serverless.Metrics.SuccessRate)

	if jsvm.Metrics.QPS > 0 {
		ratio := serverless.Metrics.QPS / jsvm.Metrics.QPS * 100
		r.log("  比率: serverless = %.1f%% of jsvm", ratio)
	}
}

// log 输出日志
func (r *Runner) log(format string, args ...interface{}) {
	if r.verbose {
		fmt.Printf("[BENCHMARK] "+format+"\n", args...)
	}
}

// getEnvironmentInfo 获取环境信息
func getEnvironmentInfo() EnvironmentInfo {
	return EnvironmentInfo{
		OS:        runtime.GOOS,
		CPU:       runtime.GOARCH,
		CPUCores:  runtime.NumCPU(),
		GoVersion: runtime.Version(),
	}
}
