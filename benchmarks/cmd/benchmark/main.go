// Package main 提供性能基准测试的命令行入口
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/pocketbase/pocketbase/benchmarks"
	"github.com/pocketbase/pocketbase/benchmarks/database"
	httpbench "github.com/pocketbase/pocketbase/benchmarks/http"
	"github.com/pocketbase/pocketbase/benchmarks/report"
	"github.com/pocketbase/pocketbase/benchmarks/websocket"
)

func main() {
	// 命令行参数
	configFile := flag.String("config", "", "配置文件路径")
	dbType := flag.String("db", "sqlite", "数据库类型: sqlite, postgresql")
	scale := flag.String("scale", "small", "测试规模: small, medium, large")
	env := flag.String("env", "local", "测试环境: local, docker, production")
	duration := flag.Duration("duration", 30*time.Second, "测试持续时间")
	concurrency := flag.Int("concurrency", 10, "并发数")
	verbose := flag.Bool("verbose", false, "详细输出")
	outputDir := flag.String("output", "./results", "结果输出目录")
	testType := flag.String("test", "all", "测试类型: all, http, websocket, database, sqlite")
	baseURL := flag.String("url", "http://localhost:8090", "PocketBase 服务器地址")

	flag.Parse()

	// 加载或创建配置
	var cfg *benchmarks.Config
	var err error

	if *configFile != "" {
		cfg, err = benchmarks.LoadConfig(*configFile)
		if err != nil {
			fmt.Printf("❌ 加载配置文件失败: %v\n", err)
			os.Exit(1)
		}
	} else {
		cfg = benchmarks.DefaultConfig()
		cfg.Database = benchmarks.DatabaseType(*dbType)
		cfg.Scale = benchmarks.Scale(*scale)
		cfg.Environment = benchmarks.Environment(*env)
		cfg.DurationSeconds = int(duration.Seconds())
		cfg.ConcurrencyLevels = []int{*concurrency}
		cfg.Verbose = *verbose
		cfg.OutputDir = *outputDir
	}

	if err := cfg.Validate(); err != nil {
		fmt.Printf("❌ 配置验证失败: %v\n", err)
		os.Exit(1)
	}

	// 创建输出目录
	if err := os.MkdirAll(cfg.OutputDir, 0755); err != nil {
		fmt.Printf("❌ 创建输出目录失败: %v\n", err)
		os.Exit(1)
	}

	// 打印测试信息
	printHeader(cfg)

	// 根据测试类型执行
	switch *testType {
	case "all":
		runAllTests(cfg, *baseURL)
	case "http":
		runHTTPTest(cfg, *baseURL)
	case "websocket":
		runWebSocketTest(cfg, *baseURL)
	case "database":
		runDatabaseTest(cfg)
	case "sqlite":
		runSQLiteTest(cfg)
	default:
		fmt.Printf("❌ 未知的测试类型: %s\n", *testType)
		os.Exit(1)
	}
}

func printHeader(cfg *benchmarks.Config) {
	sysInfo := benchmarks.GetSystemInfo()
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║           PocketBase 性能基准测试套件                         ║")
	fmt.Println("╠══════════════════════════════════════════════════════════════╣")
	fmt.Printf("║ 环境: %-10s  数据库: %-10s  规模: %-10s    ║\n", cfg.Environment, cfg.Database, cfg.Scale)
	fmt.Printf("║ 系统: %-10s  架构: %-10s  CPU: %-2d 核          ║\n", sysInfo.OS, sysInfo.Arch, sysInfo.NumCPU)
	fmt.Printf("║ Go 版本: %-20s                             ║\n", sysInfo.GoVersion)
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()
}

func runAllTests(cfg *benchmarks.Config, baseURL string) {
	fmt.Println("🚀 运行完整测试套件...")
	fmt.Println()

	results := &report.TestResults{
		Timestamp: time.Now(),
		TestSuite: "PocketBase 完整性能测试",
		Environment: report.EnvironmentInfo{
			OS:           runtime.GOOS,
			Architecture: runtime.GOARCH,
			GoVersion:    runtime.Version(),
			PocketBase:   "0.23.0",
			Database:     string(cfg.Database),
			Hostname:     getHostname(),
			NumCPU:       runtime.NumCPU(),
		},
	}

	startTime := time.Now()

	// 1. 数据库测试
	fmt.Println("📊 [1/3] 数据库性能测试...")
	dbResults := runDatabaseTestInternal(cfg)
	results.DBResults = report.DatabaseResults{
		TotalOperations: dbResults.TotalOperations,
		ReadOps:         dbResults.ReadOperations,
		WriteOps:        dbResults.WriteOperations,
		SuccessfulOps:   dbResults.SuccessfulOps,
		FailedOps:       dbResults.FailedOps,
		AvgLatency:      dbResults.AvgLatency,
		P50Latency:      dbResults.P50Latency,
		P95Latency:      dbResults.P95Latency,
		ReadQPS:         dbResults.QPS,
		WriteTPS:        dbResults.TPS,
		SuccessRate:     dbResults.SuccessRate,
	}

	// 2. HTTP 测试 (如果服务器可用)
	fmt.Println("🌐 [2/3] HTTP API 性能测试...")
	httpResults := runHTTPTestInternal(cfg, baseURL)
	if httpResults != nil {
		results.HTTPResults = report.HTTPTestResults{
			TotalRequests:  httpResults.TotalRequests,
			SuccessfulReqs: httpResults.SuccessfulRequests,
			FailedReqs:     httpResults.ErrorRequests,
			AvgLatency:     httpResults.AverageResponseTime,
			P50Latency:     httpResults.P50ResponseTime,
			P95Latency:     httpResults.P95ResponseTime,
			P99Latency:     httpResults.P99ResponseTime,
			QPS:            httpResults.RequestsPerSecond,
			ErrorRate:      httpResults.ErrorRate,
		}
	}

	// 3. WebSocket 测试 (如果服务器可用)
	fmt.Println("🔌 [3/3] WebSocket 性能测试...")
	wsResults := runWebSocketTestInternal(cfg, baseURL)
	if wsResults != nil {
		results.WSResults = report.WebSocketResults{
			MaxConnections:    int(wsResults.TotalConnections),
			SuccessfulConns:   int(wsResults.SuccessfulConnections),
			FailedConns:       int(wsResults.ConnectionErrors),
			AvgConnectTime:    wsResults.AverageLatency,
			MessagesReceived:  wsResults.MessagesReceived,
			MessagesSent:      wsResults.TotalMessages,
			AvgMessageLatency: wsResults.AverageLatency,
		}
		if wsResults.TotalConnections > 0 {
			results.WSResults.ConnectionSuccess = float64(wsResults.SuccessfulConnections) / float64(wsResults.TotalConnections) * 100
		}
	}

	// 计算总结
	results.Summary = calculateSummary(results, time.Since(startTime))

	// 生成报告
	generateReports(cfg, results)
}

func runHTTPTest(cfg *benchmarks.Config, baseURL string) {
	fmt.Println("🌐 运行 HTTP API 性能测试...")
	results := runHTTPTestInternal(cfg, baseURL)
	if results != nil {
		results.PrintResults()
	}
}

func runHTTPTestInternal(cfg *benchmarks.Config, baseURL string) *httpbench.LoadTestResults {
	config := &httpbench.LoadTesterConfig{
		BaseURL:     baseURL,
		Concurrency: cfg.ConcurrencyLevels[0],
		Duration:    time.Duration(cfg.DurationSeconds) * time.Second,
		RequestRate: 0, // 无限制
		Timeout:     30 * time.Second,
	}

	tester := httpbench.NewLoadTester(config)

	// 添加测试场景
	tester.AddScenario("health_check", &httpbench.TestScenario{
		Name:   "Health Check",
		Method: "GET",
		Path:   "/api/health",
		Weight: 20,
	})

	tester.AddScenario("list_collections", &httpbench.TestScenario{
		Name:   "List Collections",
		Method: "GET",
		Path:   "/api/collections",
		Weight: 40,
	})

	tester.AddScenario("settings", &httpbench.TestScenario{
		Name:   "Get Settings",
		Method: "GET",
		Path:   "/api/settings",
		Weight: 40,
	})

	ctx := context.Background()
	results, err := tester.Run(ctx)
	if err != nil {
		fmt.Printf("⚠️  HTTP 测试失败: %v\n", err)
		return nil
	}

	return results
}

func runWebSocketTest(cfg *benchmarks.Config, baseURL string) {
	fmt.Println("🔌 运行 WebSocket 性能测试...")
	results := runWebSocketTestInternal(cfg, baseURL)
	if results != nil {
		results.PrintResults()
	}
}

func runWebSocketTestInternal(cfg *benchmarks.Config, baseURL string) *websocket.TestResults {
	// 将 http:// 转换为 ws://
	wsURL := "ws" + baseURL[4:] + "/api/realtime"

	config := &websocket.TesterConfig{
		BaseURL:     wsURL,
		Connections: cfg.ConcurrencyLevels[0],
		Duration:    time.Duration(cfg.DurationSeconds) * time.Second,
		MessageRate: 5,
	}

	tester := websocket.NewTester(config)

	// 添加订阅
	tester.AddSubscription(&websocket.Subscription{
		ID:         "test_sub",
		Collection: "users",
	})

	ctx := context.Background()
	results, err := tester.Run(ctx)
	if err != nil {
		fmt.Printf("⚠️  WebSocket 测试失败: %v\n", err)
		return nil
	}

	return results
}

func runDatabaseTest(cfg *benchmarks.Config) {
	fmt.Println("📊 运行数据库性能测试...")
	results := runDatabaseTestInternal(cfg)
	printDatabaseResults(&results)
}

func runDatabaseTestInternal(cfg *benchmarks.Config) database.TestResult {
	var connStr string
	var dbType string

	switch cfg.Database {
	case benchmarks.DBSQLite:
		connStr = cfg.SQLitePath
		dbType = "sqlite"
	case benchmarks.DBPostgreSQL:
		connStr = cfg.GetPostgresDSN()
		dbType = "postgres"
	}

	config := database.TesterConfig{
		DatabaseType:     dbType,
		ConnectionString: connStr,
		MaxConnections:   cfg.ConcurrencyLevels[0],
		Duration:         time.Duration(cfg.DurationSeconds) * time.Second,
		ReadRatio:        0.7,
		TableName:        "benchmark_test",
	}

	tester := database.NewTester(config)

	if err := tester.Connect(); err != nil {
		fmt.Printf("⚠️  数据库连接失败: %v\n", err)
		return database.TestResult{}
	}
	defer tester.Close()

	if err := tester.SetupTestTable(); err != nil {
		fmt.Printf("⚠️  创建测试表失败: %v\n", err)
		return database.TestResult{}
	}
	defer tester.CleanupTestTable()

	if err := tester.RunTest(); err != nil {
		fmt.Printf("⚠️  数据库测试失败: %v\n", err)
		return database.TestResult{}
	}

	return tester.GetResults()
}

func runSQLiteTest(cfg *benchmarks.Config) {
	fmt.Println("📊 运行 SQLite 基准测试...")

	// 使用现有的 SQLite 基准测试
	runner := benchmarks.NewBenchmarkRunner(cfg)

	db := benchmarks.NewSQLiteDB(cfg.SQLitePath, cfg.EnableWAL)
	if err := db.Open(); err != nil {
		fmt.Printf("❌ 打开数据库失败: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Setup(); err != nil {
		fmt.Printf("❌ 设置数据库失败: %v\n", err)
		os.Exit(1)
	}
	defer db.Cleanup()

	// 运行基准测试
	benchmark := benchmarks.NewSQLiteBenchmarkWithConfig(db, cfg)
	results, err := runner.Run(benchmark)
	if err != nil {
		fmt.Printf("❌ 运行测试失败: %v\n", err)
		os.Exit(1)
	}

	// 打印结果
	for _, result := range results {
		result.Print()
	}

	// 保存结果
	saveResults(cfg.OutputDir, results)
}

func printDatabaseResults(results *database.TestResult) {
	fmt.Printf("\n📈 数据库性能测试结果\n")
	fmt.Printf("==========================================\n")
	fmt.Printf("总操作数:     %d\n", results.TotalOperations)
	fmt.Printf("读操作数:     %d\n", results.ReadOperations)
	fmt.Printf("写操作数:     %d\n", results.WriteOperations)
	fmt.Printf("成功操作:     %d\n", results.SuccessfulOps)
	fmt.Printf("失败操作:     %d\n", results.FailedOps)
	fmt.Printf("成功率:       %.2f%%\n", results.SuccessRate)
	fmt.Printf("\n⏱️ 延迟统计:\n")
	fmt.Printf("平均延迟:     %v\n", results.AvgLatency)
	fmt.Printf("P50 延迟:     %v\n", results.P50Latency)
	fmt.Printf("P95 延迟:     %v\n", results.P95Latency)
	fmt.Printf("P99 延迟:     %v\n", results.P99Latency)
	fmt.Printf("\n📊 吞吐量:\n")
	fmt.Printf("读 QPS:       %.2f\n", results.QPS)
	fmt.Printf("写 TPS:       %.2f\n", results.TPS)
	fmt.Printf("测试时长:     %v\n", results.TestDuration)
	fmt.Printf("==========================================\n")
}

func calculateSummary(results *report.TestResults, duration time.Duration) report.TestSummary {
	summary := report.TestSummary{
		TestDuration:    duration,
		Recommendations: []string{},
		KeyFindings:     []string{},
	}

	// 计算总体评分
	var score float64 = 100

	// 根据数据库性能评分
	if results.DBResults.SuccessRate < 99 {
		score -= 10
		summary.Recommendations = append(summary.Recommendations, "数据库成功率低于 99%，建议检查连接池配置")
	}

	if results.DBResults.P95Latency > 100*time.Millisecond {
		score -= 10
		summary.Recommendations = append(summary.Recommendations, "数据库 P95 延迟较高，建议优化查询或增加索引")
	}

	// 根据 HTTP 性能评分
	if results.HTTPResults.ErrorRate > 1 {
		score -= 15
		summary.Recommendations = append(summary.Recommendations, "HTTP 错误率较高，建议检查服务器负载和配置")
	}

	if results.HTTPResults.P95Latency > 200*time.Millisecond {
		score -= 10
		summary.Recommendations = append(summary.Recommendations, "HTTP P95 延迟较高，建议优化 API 性能")
	}

	// 根据 WebSocket 性能评分
	if results.WSResults.ConnectionSuccess < 95 {
		score -= 10
		summary.Recommendations = append(summary.Recommendations, "WebSocket 连接成功率较低，建议检查服务器连接限制")
	}

	// 确保评分在 0-100 之间
	if score < 0 {
		score = 0
	}

	summary.OverallScore = score

	// 设置性能等级
	switch {
	case score >= 90:
		summary.Performance = "优秀"
	case score >= 80:
		summary.Performance = "良好"
	case score >= 60:
		summary.Performance = "一般"
	default:
		summary.Performance = "需改进"
	}

	// 添加关键发现
	if results.DBResults.ReadQPS > 1000 {
		summary.KeyFindings = append(summary.KeyFindings, fmt.Sprintf("数据库读取性能优秀，QPS 达到 %.0f", results.DBResults.ReadQPS))
	}
	if results.HTTPResults.QPS > 500 {
		summary.KeyFindings = append(summary.KeyFindings, fmt.Sprintf("HTTP API 性能良好，QPS 达到 %.0f", results.HTTPResults.QPS))
	}
	if results.WSResults.ConnectionSuccess >= 99 {
		summary.KeyFindings = append(summary.KeyFindings, "WebSocket 连接稳定性优秀")
	}

	return summary
}

func generateReports(cfg *benchmarks.Config, results *report.TestResults) {
	timestamp := time.Now().Format("20060102-150405")

	generator := report.NewGenerator(*results)

	// 生成 HTML 报告
	htmlPath := fmt.Sprintf("%s/report-%s.html", cfg.OutputDir, timestamp)
	if err := generator.GenerateHTMLReport(htmlPath); err != nil {
		fmt.Printf("⚠️  生成 HTML 报告失败: %v\n", err)
	}

	// 生成 JSON 报告
	jsonPath := fmt.Sprintf("%s/report-%s.json", cfg.OutputDir, timestamp)
	if err := generator.GenerateJSONReport(jsonPath); err != nil {
		fmt.Printf("⚠️  生成 JSON 报告失败: %v\n", err)
	}

	fmt.Println()
	fmt.Println("✅ 测试完成！报告已生成到:", cfg.OutputDir)
}

func saveResults(outputDir string, results []*benchmarks.BenchmarkResult) {
	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("%s/sqlite-benchmark-%s.json", outputDir, timestamp)

	data, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		fmt.Printf("⚠️  序列化结果失败: %v\n", err)
		return
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		fmt.Printf("⚠️  保存结果失败: %v\n", err)
		return
	}

	fmt.Printf("📄 结果已保存到: %s\n", filename)
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}
