// 性能对比测试命令行工具
//
// 使用方法:
//
//	go run ./benchmarks/serverless-vs-hooks/cmd/benchmark
//	go run ./benchmarks/serverless-vs-hooks/cmd/benchmark -config config.json
//	go run ./benchmarks/serverless-vs-hooks/cmd/benchmark -scenario http_handler -concurrency 100
package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	benchmark "github.com/pocketbase/pocketbase/benchmarks/serverless-vs-hooks"
)

func main() {
	// 命令行参数
	configPath := flag.String("config", "", "配置文件路径")
	baseURL := flag.String("url", "http://127.0.0.1:8090", "PocketBase 服务地址")
	scenarios := flag.String("scenario", "", "指定测试场景 (逗号分隔)")
	concurrency := flag.Int("concurrency", 0, "并发数")
	duration := flag.Duration("duration", 0, "测试持续时间")
	verbose := flag.Bool("verbose", true, "详细输出")
	outputDir := flag.String("output", "reports/serverless-vs-hooks", "报告输出目录")

	flag.Parse()

	// 加载配置
	var cfg benchmark.Config
	var err error

	if *configPath != "" {
		cfg, err = benchmark.LoadConfig(*configPath)
		if err != nil {
			fmt.Printf("警告: 加载配置文件失败: %v，使用默认配置\n", err)
			cfg = benchmark.DefaultConfig()
		}
	} else {
		cfg = benchmark.DefaultConfig()
	}

	// 应用命令行参数覆盖
	if *baseURL != "" {
		cfg.BaseURL = *baseURL
	}
	if *scenarios != "" {
		cfg.Scenarios.Enabled = strings.Split(*scenarios, ",")
	}
	if *concurrency > 0 {
		cfg.Concurrency.Default = *concurrency
		cfg.Concurrency.Levels = []int{*concurrency}
	}
	if *duration > 0 {
		cfg.Scenarios.HTTPHandler.Duration = *duration
		cfg.Scenarios.DBHook.Duration = *duration
		cfg.Scenarios.IOIntensive.Duration = *duration
	}
	cfg.Output.Verbose = *verbose
	cfg.Output.ReportDir = *outputDir

	// 打印配置
	fmt.Println("=== Serverless vs Hooks 性能对比测试 ===")
	fmt.Printf("服务地址: %s\n", cfg.BaseURL)
	fmt.Printf("测试场景: %v\n", cfg.Scenarios.Enabled)
	fmt.Printf("并发级别: %v\n", cfg.Concurrency.Levels)
	fmt.Printf("报告目录: %s\n", cfg.Output.ReportDir)
	fmt.Println()

	// 创建上下文
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 处理中断信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Println("\n收到中断信号，正在停止测试...")
		cancel()
	}()

	// 检查服务是否可用
	fmt.Println("检查 PocketBase 服务...")
	if err := checkService(cfg.BaseURL); err != nil {
		fmt.Printf("错误: PocketBase 服务不可用: %v\n", err)
		fmt.Println("请确保 PocketBase 已启动并配置了测试端点")
		os.Exit(1)
	}
	fmt.Println("服务可用")
	fmt.Println()

	// 创建运行器
	runner := benchmark.NewRunner(cfg)

	// 运行测试
	startTime := time.Now()
	report, err := runner.Run(ctx)
	if err != nil && ctx.Err() == nil {
		fmt.Printf("测试运行失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n测试完成，耗时: %v\n", time.Since(startTime))

	// 生成报告
	reporter := benchmark.NewReporter(cfg)
	reporter.PrintSummary(report)

	if err := reporter.Generate(report); err != nil {
		fmt.Printf("生成报告失败: %v\n", err)
		os.Exit(1)
	}
}

// checkService 检查服务是否可用
func checkService(baseURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/api/health", nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return nil
}
