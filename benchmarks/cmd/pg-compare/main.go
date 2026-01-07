// Package main 提供 PostgreSQL vs SQLite 性能对比测试工具
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/pocketbase/pocketbase/benchmarks"
)

// ComparisonResult 对比结果
type ComparisonResult struct {
	TestTime        string                                          `json:"test_time"`
	TestDuration    string                                          `json:"test_duration"`
	Concurrency     int                                             `json:"concurrency"`
	DataScale       string                                          `json:"data_scale"`
	SQLiteResults   *benchmarks.PostgresBenchmarkResult             `json:"sqlite_results,omitempty"`
	PostgresResults map[string]*benchmarks.PostgresBenchmarkResult  `json:"postgres_results"`
	Comparison      map[string]*VersionComparison                   `json:"comparison"`
}

// VersionComparison 版本对比
type VersionComparison struct {
	Version         string  `json:"version"`
	ReadQPSRatio    float64 `json:"read_qps_ratio"`    // PostgreSQL / SQLite
	WriteTRSRatio   float64 `json:"write_tps_ratio"`
	AvgLatencyRatio float64 `json:"avg_latency_ratio"`
	P95LatencyRatio float64 `json:"p95_latency_ratio"`
	P99LatencyRatio float64 `json:"p99_latency_ratio"`
	SuccessRateDiff float64 `json:"success_rate_diff"`
}

func main() {
	// 命令行参数
	duration := flag.Duration("duration", 30*time.Second, "测试持续时间")
	concurrency := flag.Int("concurrency", 10, "并发数")
	dataScale := flag.String("scale", "small", "数据规模: small, medium, large")
	pgVersions := flag.String("pg-versions", "15,16,17,18", "PostgreSQL 版本 (逗号分隔)")
	pgHost := flag.String("pg-host", "localhost", "PostgreSQL 主机")
	pgUser := flag.String("pg-user", "pocketbase", "PostgreSQL 用户")
	pgPassword := flag.String("pg-password", "pocketbase", "PostgreSQL 密码")
	pgDatabase := flag.String("pg-database", "pocketbase_test", "PostgreSQL 数据库")
	outputDir := flag.String("output", "./reports/comparison", "结果输出目录")
	verbose := flag.Bool("verbose", false, "详细输出")
	skipSQLite := flag.Bool("skip-sqlite", false, "跳过 SQLite 测试")

	flag.Parse()

	fmt.Println("🚀 PocketBase 性能对比测试: PostgreSQL vs SQLite")
	fmt.Println("================================================")
	fmt.Printf("📊 配置: 并发=%d, 持续时间=%v, 数据规模=%s\n", *concurrency, *duration, *dataScale)
	fmt.Println()

	result := &ComparisonResult{
		TestTime:        time.Now().Format(time.RFC3339),
		TestDuration:    duration.String(),
		Concurrency:     *concurrency,
		DataScale:       *dataScale,
		PostgresResults: make(map[string]*benchmarks.PostgresBenchmarkResult),
		Comparison:      make(map[string]*VersionComparison),
	}

	// PostgreSQL 版本和端口映射
	pgPorts := map[string]int{
		"15": 5432,
		"16": 5433,
		"17": 5434,
		"18": 5435,
	}

	// 解析版本列表
	versions := parseVersions(*pgVersions)

	// 测试每个 PostgreSQL 版本
	for _, version := range versions {
		port, ok := pgPorts[version]
		if !ok {
			fmt.Printf("⚠️ 未知的 PostgreSQL 版本: %s, 跳过\n", version)
			continue
		}

		fmt.Printf("\n📦 测试 PostgreSQL %s (端口 %d)\n", version, port)
		fmt.Println("----------------------------------------")

		pgResult, err := runPostgresBenchmark(
			*pgHost, port, *pgUser, *pgPassword, *pgDatabase,
			*duration, *concurrency, *dataScale, *verbose,
		)
		if err != nil {
			fmt.Printf("❌ PostgreSQL %s 测试失败: %v\n", version, err)
			continue
		}

		result.PostgresResults[version] = pgResult
		fmt.Printf("✅ PostgreSQL %s 测试完成\n", version)
	}

	// 运行 SQLite 测试 (可选)
	if !*skipSQLite {
		fmt.Println("\n📦 测试 SQLite")
		fmt.Println("----------------------------------------")

		sqliteResult, err := runSQLiteBenchmark(*duration, *concurrency, *dataScale, *verbose)
		if err != nil {
			fmt.Printf("❌ SQLite 测试失败: %v\n", err)
		} else {
			result.SQLiteResults = sqliteResult
			fmt.Println("✅ SQLite 测试完成")
		}
	}

	// 计算对比结果
	if result.SQLiteResults != nil {
		for version, pgResult := range result.PostgresResults {
			comparison := &VersionComparison{
				Version: version,
			}

			if result.SQLiteResults.ReadQPS > 0 {
				comparison.ReadQPSRatio = pgResult.ReadQPS / result.SQLiteResults.ReadQPS
			}
			if result.SQLiteResults.WriteTPS > 0 {
				comparison.WriteTRSRatio = pgResult.WriteTPS / result.SQLiteResults.WriteTPS
			}
			if result.SQLiteResults.AvgLatencyMs > 0 {
				comparison.AvgLatencyRatio = pgResult.AvgLatencyMs / result.SQLiteResults.AvgLatencyMs
			}
			if result.SQLiteResults.P95LatencyMs > 0 {
				comparison.P95LatencyRatio = pgResult.P95LatencyMs / result.SQLiteResults.P95LatencyMs
			}
			if result.SQLiteResults.P99LatencyMs > 0 {
				comparison.P99LatencyRatio = pgResult.P99LatencyMs / result.SQLiteResults.P99LatencyMs
			}
			comparison.SuccessRateDiff = pgResult.SuccessRate - result.SQLiteResults.SuccessRate

			result.Comparison[version] = comparison
		}
	}

	// 打印对比结果
	printComparisonResults(result)

	// 保存结果
	if err := saveResults(result, *outputDir); err != nil {
		fmt.Printf("❌ 保存结果失败: %v\n", err)
	}

	fmt.Println("\n✅ 对比测试完成!")
}

func parseVersions(versionsStr string) []string {
	var versions []string
	current := ""
	for _, c := range versionsStr {
		if c == ',' {
			if current != "" {
				versions = append(versions, current)
				current = ""
			}
		} else if c != ' ' {
			current += string(c)
		}
	}
	if current != "" {
		versions = append(versions, current)
	}
	return versions
}

func runPostgresBenchmark(host string, port int, user, password, database string,
	duration time.Duration, concurrency int, dataScale string, verbose bool) (*benchmarks.PostgresBenchmarkResult, error) {

	config := benchmarks.PostgresBenchmarkConfig{
		Host:           host,
		Port:           port,
		User:           user,
		Password:       password,
		Database:       database,
		SSLMode:        "disable",
		Duration:       duration,
		Concurrency:    concurrency,
		ReadRatio:      0.7,
		WarmupDuration: 5 * time.Second,
		DataScale:      dataScale,
		Verbose:        verbose,
	}

	benchmark := benchmarks.NewPostgresBenchmark(config)

	// 连接数据库
	if err := benchmark.Connect(); err != nil {
		return nil, fmt.Errorf("连接失败: %w", err)
	}
	defer benchmark.Close()

	// 设置测试表
	if err := benchmark.SetupTestTables(); err != nil {
		return nil, fmt.Errorf("创建表失败: %w", err)
	}

	// 填充测试数据
	if err := benchmark.SeedTestData(); err != nil {
		return nil, fmt.Errorf("填充数据失败: %w", err)
	}

	// 运行基准测试
	if err := benchmark.RunCRUDBenchmark(); err != nil {
		return nil, fmt.Errorf("测试失败: %w", err)
	}

	// 打印结果
	if verbose {
		benchmark.PrintResults()
	}

	// 清理
	if err := benchmark.Cleanup(); err != nil {
		fmt.Printf("⚠️ 清理失败: %v\n", err)
	}

	result := benchmark.GetResults()
	return &result, nil
}

func runSQLiteBenchmark(duration time.Duration, concurrency int, dataScale string, verbose bool) (*benchmarks.PostgresBenchmarkResult, error) {
	// 使用 PostgresBenchmark 结构但配置为 SQLite 模式进行对比
	// 这里我们直接使用 SQLite 基准测试并转换结果

	config := benchmarks.SQLiteBenchmarkConfig{
		DatabasePath:   "./benchmark_compare.db",
		Duration:       duration,
		Concurrency:    concurrency,
		ReadRatio:      0.7,
		WarmupDuration: 5 * time.Second,
		EnableWAL:      true,
		Verbose:        verbose,
	}

	// 设置数据规模
	switch dataScale {
	case "small":
		config.UserCount = 1000
		config.PostCount = 5000
	case "medium":
		config.UserCount = 10000
		config.PostCount = 50000
	case "large":
		config.UserCount = 100000
		config.PostCount = 500000
	default:
		config.UserCount = 1000
		config.PostCount = 5000
	}

	benchmark := benchmarks.NewSQLiteBenchmark(config)

	// 运行测试
	if err := benchmark.Setup(); err != nil {
		return nil, fmt.Errorf("设置失败: %w", err)
	}
	defer benchmark.Cleanup()

	result, err := benchmark.Run()
	if err != nil {
		return nil, fmt.Errorf("测试失败: %w", err)
	}

	// 转换为 PostgresBenchmarkResult 格式以便对比
	pgResult := &benchmarks.PostgresBenchmarkResult{
		DatabaseType:    "sqlite",
		TestDuration:    result.Duration.Seconds(),
		TotalOperations: result.TotalOps,
		ReadOperations:  result.ReadOps,
		WriteOperations: result.WriteOps,
		SuccessfulOps:   result.SuccessOps,
		FailedOps:       result.FailedOps,
		ReadQPS:         result.ReadQPS,
		WriteTPS:        result.WriteTPS,
		TotalOPS:        result.OPS,
		AvgLatencyMs:    float64(result.AvgLatency.Microseconds()) / 1000.0,
		MinLatencyMs:    float64(result.MinLatency.Microseconds()) / 1000.0,
		MaxLatencyMs:    float64(result.MaxLatency.Microseconds()) / 1000.0,
		P50LatencyMs:    float64(result.P50Latency.Microseconds()) / 1000.0,
		P95LatencyMs:    float64(result.P95Latency.Microseconds()) / 1000.0,
		P99LatencyMs:    float64(result.P99Latency.Microseconds()) / 1000.0,
		SuccessRate:     result.SuccessRate,
		Concurrency:     concurrency,
	}

	if verbose {
		fmt.Printf("\n📈 SQLite 性能测试结果\n")
		fmt.Printf("==========================================\n")
		fmt.Printf("测试时长:     %.2f 秒\n", pgResult.TestDuration)
		fmt.Printf("总操作数:     %d\n", pgResult.TotalOperations)
		fmt.Printf("读 QPS:       %.2f\n", pgResult.ReadQPS)
		fmt.Printf("写 TPS:       %.2f\n", pgResult.WriteTPS)
		fmt.Printf("平均延迟:     %.3f ms\n", pgResult.AvgLatencyMs)
		fmt.Printf("P95 延迟:     %.3f ms\n", pgResult.P95LatencyMs)
		fmt.Printf("成功率:       %.2f%%\n", pgResult.SuccessRate)
		fmt.Printf("==========================================\n")
	}

	return pgResult, nil
}

func printComparisonResults(result *ComparisonResult) {
	fmt.Println("\n📊 性能对比结果")
	fmt.Println("================================================")

	// 打印 SQLite 结果
	if result.SQLiteResults != nil {
		fmt.Println("\n📦 SQLite 基准:")
		fmt.Printf("  读 QPS:     %.2f\n", result.SQLiteResults.ReadQPS)
		fmt.Printf("  写 TPS:     %.2f\n", result.SQLiteResults.WriteTPS)
		fmt.Printf("  总 OPS:     %.2f\n", result.SQLiteResults.TotalOPS)
		fmt.Printf("  平均延迟:   %.3f ms\n", result.SQLiteResults.AvgLatencyMs)
		fmt.Printf("  P95 延迟:   %.3f ms\n", result.SQLiteResults.P95LatencyMs)
		fmt.Printf("  成功率:     %.2f%%\n", result.SQLiteResults.SuccessRate)
	}

	// 打印 PostgreSQL 结果
	for version, pgResult := range result.PostgresResults {
		fmt.Printf("\n📦 PostgreSQL %s:\n", version)
		fmt.Printf("  读 QPS:     %.2f\n", pgResult.ReadQPS)
		fmt.Printf("  写 TPS:     %.2f\n", pgResult.WriteTPS)
		fmt.Printf("  总 OPS:     %.2f\n", pgResult.TotalOPS)
		fmt.Printf("  平均延迟:   %.3f ms\n", pgResult.AvgLatencyMs)
		fmt.Printf("  P95 延迟:   %.3f ms\n", pgResult.P95LatencyMs)
		fmt.Printf("  成功率:     %.2f%%\n", pgResult.SuccessRate)
	}

	// 打印对比
	if len(result.Comparison) > 0 {
		fmt.Println("\n📈 PostgreSQL vs SQLite 对比 (比值 > 1 表示 PostgreSQL 更高):")
		fmt.Println("----------------------------------------")
		fmt.Printf("%-10s | %-12s | %-12s | %-12s | %-12s\n",
			"版本", "读QPS比", "写TPS比", "平均延迟比", "P95延迟比")
		fmt.Println("----------------------------------------")

		for version, comp := range result.Comparison {
			fmt.Printf("PG %-7s | %-12.2f | %-12.2f | %-12.2f | %-12.2f\n",
				version, comp.ReadQPSRatio, comp.WriteTRSRatio,
				comp.AvgLatencyRatio, comp.P95LatencyRatio)
		}
		fmt.Println("----------------------------------------")
		fmt.Println("注: 吞吐量比值 > 1 表示 PostgreSQL 更快; 延迟比值 < 1 表示 PostgreSQL 更快")
	}
}

func saveResults(result *ComparisonResult, outputDir string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	filename := filepath.Join(outputDir,
		fmt.Sprintf("pg-sqlite-comparison-%s.json", time.Now().Format("20060102-150405")))

	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return err
	}

	fmt.Printf("\n📁 结果已保存到: %s\n", filename)
	return nil
}
