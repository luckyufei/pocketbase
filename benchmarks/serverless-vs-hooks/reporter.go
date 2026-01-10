package serverlessvshooks

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Reporter 报告生成器
type Reporter struct {
	config Config
}

// NewReporter 创建报告生成器
func NewReporter(cfg Config) *Reporter {
	return &Reporter{config: cfg}
}

// Generate 生成报告
func (r *Reporter) Generate(report *FullReport) error {
	// 确保输出目录存在
	if err := os.MkdirAll(r.config.Output.ReportDir, 0755); err != nil {
		return fmt.Errorf("创建报告目录失败: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02-150405")

	// 生成 JSON 报告
	if r.config.Output.JSON {
		jsonPath := filepath.Join(r.config.Output.ReportDir, fmt.Sprintf("%s-full.json", timestamp))
		if err := r.generateJSON(report, jsonPath); err != nil {
			return fmt.Errorf("生成 JSON 报告失败: %w", err)
		}
		fmt.Printf("JSON 报告已生成: %s\n", jsonPath)
	}

	// 生成 Markdown 报告
	if r.config.Output.Markdown {
		mdPath := filepath.Join(r.config.Output.ReportDir, fmt.Sprintf("%s-summary.md", timestamp))
		if err := r.generateMarkdown(report, mdPath); err != nil {
			return fmt.Errorf("生成 Markdown 报告失败: %w", err)
		}
		fmt.Printf("Markdown 报告已生成: %s\n", mdPath)
	}

	return nil
}

// generateJSON 生成 JSON 报告
func (r *Reporter) generateJSON(report *FullReport, path string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// generateMarkdown 生成 Markdown 报告
func (r *Reporter) generateMarkdown(report *FullReport, path string) error {
	var sb strings.Builder

	// 标题
	sb.WriteString("# Serverless vs Hooks 性能对比报告\n\n")

	// 执行环境
	sb.WriteString("## 执行环境\n\n")
	sb.WriteString(fmt.Sprintf("- **操作系统**: %s\n", report.Meta.Environment.OS))
	sb.WriteString(fmt.Sprintf("- **CPU**: %s (%d 核)\n", report.Meta.Environment.CPU, report.Meta.Environment.CPUCores))
	sb.WriteString(fmt.Sprintf("- **Go 版本**: %s\n", report.Meta.Environment.GoVersion))
	sb.WriteString(fmt.Sprintf("- **测试时间**: %s\n", report.Meta.Timestamp.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("- **总耗时**: %v\n", report.Meta.TotalDuration))
	sb.WriteString("\n")

	// 性能对比表格
	sb.WriteString("## 性能对比\n\n")
	sb.WriteString("| 场景 | jsvm QPS | serverless QPS | 比率 | jsvm P99 | serverless P99 | 胜出 |\n")
	sb.WriteString("|------|----------|----------------|------|----------|----------------|------|\n")

	for scenario, comp := range report.Scenarios {
		if comp.JSVM == nil || comp.Serverless == nil {
			continue
		}

		jsvmQPS := comp.JSVM.Metrics.QPS
		serverlessQPS := comp.Serverless.Metrics.QPS
		ratio := 0.0
		if jsvmQPS > 0 {
			ratio = serverlessQPS / jsvmQPS * 100
		}

		winner := "jsvm"
		if comp.Comparison.PerformanceWinner == RuntimeServerless {
			winner = "serverless"
		}

		sb.WriteString(fmt.Sprintf("| %s | %.1f | %.1f | %.1f%% | %.1fms | %.1fms | %s |\n",
			scenario,
			jsvmQPS,
			serverlessQPS,
			ratio,
			comp.JSVM.Metrics.LatencyP99,
			comp.Serverless.Metrics.LatencyP99,
			winner,
		))
	}
	sb.WriteString("\n")

	// 稳定性对比
	hasStability := false
	for _, comp := range report.Scenarios {
		if comp.JSVM != nil && comp.JSVM.Stability != nil {
			hasStability = true
			break
		}
	}

	if hasStability {
		sb.WriteString("## 稳定性对比\n\n")
		sb.WriteString("| 指标 | jsvm | serverless | 胜出 |\n")
		sb.WriteString("|------|------|------------|------|\n")

		for _, comp := range report.Scenarios {
			if comp.JSVM == nil || comp.JSVM.Stability == nil {
				continue
			}
			if comp.Serverless == nil || comp.Serverless.Stability == nil {
				continue
			}

			winner := "jsvm"
			if comp.Comparison.StabilityWinner == RuntimeServerless {
				winner = "serverless"
			}

			sb.WriteString(fmt.Sprintf("| 内存增长 | %.1f%% | %.1f%% | %s |\n",
				comp.JSVM.Stability.MemoryGrowth,
				comp.Serverless.Stability.MemoryGrowth,
				winner,
			))
		}
		sb.WriteString("\n")
	}

	// 胜出统计
	sb.WriteString("## 胜出统计\n\n")
	sb.WriteString(fmt.Sprintf("- **jsvm 胜出**: %d 个场景\n", report.Summary.WinCount[RuntimeJSVM]))
	sb.WriteString(fmt.Sprintf("- **serverless 胜出**: %d 个场景\n", report.Summary.WinCount[RuntimeServerless]))
	sb.WriteString(fmt.Sprintf("- **总体性能胜出**: %s\n", report.Summary.OverallPerformanceWinner))
	sb.WriteString("\n")

	// 关键发现
	if len(report.Summary.KeyFindings) > 0 {
		sb.WriteString("## 关键发现\n\n")
		for _, finding := range report.Summary.KeyFindings {
			sb.WriteString(fmt.Sprintf("- %s\n", finding))
		}
		sb.WriteString("\n")
	}

	// 使用建议
	if len(report.Summary.Recommendations) > 0 {
		sb.WriteString("## 使用建议\n\n")
		sb.WriteString("| 场景 | 推荐 | 原因 |\n")
		sb.WriteString("|------|------|------|\n")
		for _, rec := range report.Summary.Recommendations {
			sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n",
				rec.Scenario, rec.Recommended, rec.Reason))
		}
		sb.WriteString("\n")
	}

	// 详细数据
	sb.WriteString("## 详细数据\n\n")
	for scenario, comp := range report.Scenarios {
		sb.WriteString(fmt.Sprintf("### %s\n\n", scenario))

		if comp.JSVM != nil {
			sb.WriteString("**jsvm:**\n")
			sb.WriteString(fmt.Sprintf("- 总请求: %d\n", comp.JSVM.Metrics.TotalRequests))
			sb.WriteString(fmt.Sprintf("- 成功率: %.2f%%\n", comp.JSVM.Metrics.SuccessRate))
			sb.WriteString(fmt.Sprintf("- QPS: %.1f\n", comp.JSVM.Metrics.QPS))
			sb.WriteString(fmt.Sprintf("- 延迟 P50/P95/P99: %.1f/%.1f/%.1fms\n",
				comp.JSVM.Metrics.LatencyP50,
				comp.JSVM.Metrics.LatencyP95,
				comp.JSVM.Metrics.LatencyP99))
			sb.WriteString("\n")
		}

		if comp.Serverless != nil {
			sb.WriteString("**serverless:**\n")
			sb.WriteString(fmt.Sprintf("- 总请求: %d\n", comp.Serverless.Metrics.TotalRequests))
			sb.WriteString(fmt.Sprintf("- 成功率: %.2f%%\n", comp.Serverless.Metrics.SuccessRate))
			sb.WriteString(fmt.Sprintf("- QPS: %.1f\n", comp.Serverless.Metrics.QPS))
			sb.WriteString(fmt.Sprintf("- 延迟 P50/P95/P99: %.1f/%.1f/%.1fms\n",
				comp.Serverless.Metrics.LatencyP50,
				comp.Serverless.Metrics.LatencyP95,
				comp.Serverless.Metrics.LatencyP99))
			sb.WriteString("\n")
		}
	}

	return os.WriteFile(path, []byte(sb.String()), 0644)
}

// PrintSummary 打印摘要到控制台
func (r *Reporter) PrintSummary(report *FullReport) {
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("                    测试结果摘要")
	fmt.Println(strings.Repeat("=", 60))

	fmt.Printf("\n测试时间: %s\n", report.Meta.Timestamp.Format("2006-01-02 15:04:05"))
	fmt.Printf("总耗时: %v\n", report.Meta.TotalDuration)

	fmt.Println("\n性能对比:")
	fmt.Println(strings.Repeat("-", 60))
	fmt.Printf("%-20s %10s %12s %8s\n", "场景", "jsvm QPS", "serverless", "比率")
	fmt.Println(strings.Repeat("-", 60))

	for scenario, comp := range report.Scenarios {
		if comp.JSVM == nil || comp.Serverless == nil {
			continue
		}
		ratio := 0.0
		if comp.JSVM.Metrics.QPS > 0 {
			ratio = comp.Serverless.Metrics.QPS / comp.JSVM.Metrics.QPS * 100
		}
		fmt.Printf("%-20s %10.1f %12.1f %7.1f%%\n",
			scenario,
			comp.JSVM.Metrics.QPS,
			comp.Serverless.Metrics.QPS,
			ratio,
		)
	}

	fmt.Println(strings.Repeat("-", 60))
	fmt.Printf("\n胜出统计:\n")
	fmt.Printf("  jsvm: %d 个场景\n", report.Summary.WinCount[RuntimeJSVM])
	fmt.Printf("  serverless: %d 个场景\n", report.Summary.WinCount[RuntimeServerless])
	fmt.Printf("  总体胜出: %s\n", report.Summary.OverallPerformanceWinner)

	if len(report.Summary.KeyFindings) > 0 {
		fmt.Println("\n关键发现:")
		for _, finding := range report.Summary.KeyFindings {
			fmt.Printf("  • %s\n", finding)
		}
	}

	fmt.Println(strings.Repeat("=", 60))
}
