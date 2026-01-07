// Package report 提供性能测试报告生成工具
package report

import (
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"time"
)

// TestResults 测试结果数据结构
type TestResults struct {
	Timestamp     time.Time           `json:"timestamp"`
	TestSuite     string              `json:"test_suite"`
	Environment   EnvironmentInfo     `json:"environment"`
	HTTPResults   HTTPTestResults     `json:"http_results"`
	WSResults     WebSocketResults    `json:"websocket_results"`
	DBResults     DatabaseResults     `json:"database_results"`
	SystemMetrics SystemMetrics       `json:"system_metrics"`
	Summary       TestSummary         `json:"summary"`
}

// EnvironmentInfo 环境信息
type EnvironmentInfo struct {
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	GoVersion    string `json:"go_version"`
	PocketBase   string `json:"pocketbase_version"`
	Database     string `json:"database_type"`
	Hostname     string `json:"hostname"`
	NumCPU       int    `json:"num_cpu"`
}

// HTTPTestResults HTTP 测试结果
type HTTPTestResults struct {
	TotalRequests    int64         `json:"total_requests"`
	SuccessfulReqs   int64         `json:"successful_requests"`
	FailedReqs       int64         `json:"failed_requests"`
	AvgLatency       time.Duration `json:"avg_latency"`
	P50Latency       time.Duration `json:"p50_latency"`
	P95Latency       time.Duration `json:"p95_latency"`
	P99Latency       time.Duration `json:"p99_latency"`
	QPS              float64       `json:"qps"`
	ErrorRate        float64       `json:"error_rate"`
	ThroughputMBps   float64       `json:"throughput_mbps"`
}

// WebSocketResults WebSocket 测试结果
type WebSocketResults struct {
	MaxConnections     int           `json:"max_connections"`
	SuccessfulConns    int           `json:"successful_connections"`
	FailedConns        int           `json:"failed_connections"`
	AvgConnectTime     time.Duration `json:"avg_connect_time"`
	MessagesReceived   int64         `json:"messages_received"`
	MessagesSent       int64         `json:"messages_sent"`
	AvgMessageLatency  time.Duration `json:"avg_message_latency"`
	ConnectionSuccess  float64       `json:"connection_success_rate"`
}

// DatabaseResults 数据库测试结果
type DatabaseResults struct {
	TotalOperations int64         `json:"total_operations"`
	ReadOps         int64         `json:"read_operations"`
	WriteOps        int64         `json:"write_operations"`
	SuccessfulOps   int64         `json:"successful_operations"`
	FailedOps       int64         `json:"failed_operations"`
	AvgLatency      time.Duration `json:"avg_latency"`
	P50Latency      time.Duration `json:"p50_latency"`
	P95Latency      time.Duration `json:"p95_latency"`
	ReadQPS         float64       `json:"read_qps"`
	WriteTPS        float64       `json:"write_tps"`
	SuccessRate     float64       `json:"success_rate"`
}

// SystemMetrics 系统指标
type SystemMetrics struct {
	CPUUsage       float64 `json:"cpu_usage"`
	MemoryUsage    float64 `json:"memory_usage"`
	DiskUsage      float64 `json:"disk_usage"`
	NetworkIn      float64 `json:"network_in_mbps"`
	NetworkOut     float64 `json:"network_out_mbps"`
	LoadAverage    float64 `json:"load_average"`
}

// TestSummary 测试总结
type TestSummary struct {
	OverallScore    float64       `json:"overall_score"`
	Performance     string        `json:"performance_grade"`
	Recommendations []string      `json:"recommendations"`
	KeyFindings     []string      `json:"key_findings"`
	TestDuration    time.Duration `json:"test_duration"`
}

// Generator 报告生成器
type Generator struct {
	results TestResults
}

// NewGenerator 创建新的报告生成器
func NewGenerator(results TestResults) *Generator {
	return &Generator{
		results: results,
	}
}

// GenerateHTMLReport 生成 HTML 报告
func (g *Generator) GenerateHTMLReport(outputPath string) error {
	tmpl := `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PocketBase 性能测试报告</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .header h1 { color: #2c3e50; margin: 0; font-size: 2.5em; }
        .header .subtitle { color: #7f8c8d; margin-top: 10px; font-size: 1.2em; }
        .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; }
        .summary h2 { margin: 0 0 15px 0; font-size: 1.8em; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
        .summary-item { text-align: center; }
        .summary-item .value { font-size: 2em; font-weight: bold; display: block; }
        .summary-item .label { font-size: 0.9em; opacity: 0.9; }
        .section { margin-bottom: 40px; }
        .section h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
        .metric-card h3 { margin: 0 0 15px 0; color: #2c3e50; }
        .metric-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .metric-label { font-weight: 500; color: #555; }
        .metric-value { font-weight: bold; color: #2c3e50; }
        .performance-grade { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; color: white; }
        .grade-a { background-color: #27ae60; }
        .grade-b { background-color: #f39c12; }
        .grade-c { background-color: #e74c3c; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
        .findings { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; }
        .findings ul { margin: 0; padding-left: 20px; }
        .findings li { margin-bottom: 8px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 PocketBase 性能测试报告</h1>
            <div class="subtitle">测试时间: {{.Timestamp.Format "2006-01-02 15:04:05"}}</div>
            <div class="subtitle">测试套件: {{.TestSuite}}</div>
        </div>

        <div class="summary">
            <h2>📊 测试总结</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="value">{{printf "%.1f" .Summary.OverallScore}}</span>
                    <span class="label">总体评分</span>
                </div>
                <div class="summary-item">
                    <span class="value performance-grade grade-{{if gt .Summary.OverallScore 80.0}}a{{else if gt .Summary.OverallScore 60.0}}b{{else}}c{{end}}">{{.Summary.Performance}}</span>
                    <span class="label">性能等级</span>
                </div>
                <div class="summary-item">
                    <span class="value">{{.Summary.TestDuration}}</span>
                    <span class="label">测试时长</span>
                </div>
                <div class="summary-item">
                    <span class="value">{{.Environment.Database}}</span>
                    <span class="label">数据库类型</span>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🖥️ 测试环境</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>系统信息</h3>
                    <div class="metric-row">
                        <span class="metric-label">操作系统:</span>
                        <span class="metric-value">{{.Environment.OS}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">架构:</span>
                        <span class="metric-value">{{.Environment.Architecture}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">CPU 核心数:</span>
                        <span class="metric-value">{{.Environment.NumCPU}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">主机名:</span>
                        <span class="metric-value">{{.Environment.Hostname}}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>软件版本</h3>
                    <div class="metric-row">
                        <span class="metric-label">Go 版本:</span>
                        <span class="metric-value">{{.Environment.GoVersion}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">PocketBase:</span>
                        <span class="metric-value">{{.Environment.PocketBase}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">数据库:</span>
                        <span class="metric-value">{{.Environment.Database}}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🌐 HTTP API 性能</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>请求统计</h3>
                    <div class="metric-row">
                        <span class="metric-label">总请求数:</span>
                        <span class="metric-value">{{.HTTPResults.TotalRequests}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">成功请求:</span>
                        <span class="metric-value">{{.HTTPResults.SuccessfulReqs}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">失败请求:</span>
                        <span class="metric-value">{{.HTTPResults.FailedReqs}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">错误率:</span>
                        <span class="metric-value">{{printf "%.2f%%" .HTTPResults.ErrorRate}}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>性能指标</h3>
                    <div class="metric-row">
                        <span class="metric-label">QPS:</span>
                        <span class="metric-value">{{printf "%.2f" .HTTPResults.QPS}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">平均延迟:</span>
                        <span class="metric-value">{{.HTTPResults.AvgLatency}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">P95 延迟:</span>
                        <span class="metric-value">{{.HTTPResults.P95Latency}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">P99 延迟:</span>
                        <span class="metric-value">{{.HTTPResults.P99Latency}}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔌 WebSocket 性能</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>连接统计</h3>
                    <div class="metric-row">
                        <span class="metric-label">最大连接数:</span>
                        <span class="metric-value">{{.WSResults.MaxConnections}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">成功连接:</span>
                        <span class="metric-value">{{.WSResults.SuccessfulConns}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">连接成功率:</span>
                        <span class="metric-value">{{printf "%.2f%%" .WSResults.ConnectionSuccess}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">平均连接时间:</span>
                        <span class="metric-value">{{.WSResults.AvgConnectTime}}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>消息统计</h3>
                    <div class="metric-row">
                        <span class="metric-label">发送消息:</span>
                        <span class="metric-value">{{.WSResults.MessagesSent}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">接收消息:</span>
                        <span class="metric-value">{{.WSResults.MessagesReceived}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">平均消息延迟:</span>
                        <span class="metric-value">{{.WSResults.AvgMessageLatency}}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🗄️ 数据库性能</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>操作统计</h3>
                    <div class="metric-row">
                        <span class="metric-label">总操作数:</span>
                        <span class="metric-value">{{.DBResults.TotalOperations}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">读操作:</span>
                        <span class="metric-value">{{.DBResults.ReadOps}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">写操作:</span>
                        <span class="metric-value">{{.DBResults.WriteOps}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">成功率:</span>
                        <span class="metric-value">{{printf "%.2f%%" .DBResults.SuccessRate}}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>性能指标</h3>
                    <div class="metric-row">
                        <span class="metric-label">读 QPS:</span>
                        <span class="metric-value">{{printf "%.2f" .DBResults.ReadQPS}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">写 TPS:</span>
                        <span class="metric-value">{{printf "%.2f" .DBResults.WriteTPS}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">平均延迟:</span>
                        <span class="metric-value">{{.DBResults.AvgLatency}}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">P95 延迟:</span>
                        <span class="metric-value">{{.DBResults.P95Latency}}</span>
                    </div>
                </div>
            </div>
        </div>

        {{if .Summary.Recommendations}}
        <div class="section">
            <h2>💡 优化建议</h2>
            <div class="recommendations">
                <ul>
                    {{range .Summary.Recommendations}}
                    <li>{{.}}</li>
                    {{end}}
                </ul>
            </div>
        </div>
        {{end}}

        {{if .Summary.KeyFindings}}
        <div class="section">
            <h2>🔍 关键发现</h2>
            <div class="findings">
                <ul>
                    {{range .Summary.KeyFindings}}
                    <li>{{.}}</li>
                    {{end}}
                </ul>
            </div>
        </div>
        {{end}}

        <div class="footer">
            <p>📄 报告生成时间: {{.Timestamp.Format "2006-01-02 15:04:05"}} | 🛠️ 生成工具: PocketBase Benchmark Suite</p>
        </div>
    </div>
</body>
</html>`

	t, err := template.New("report").Parse(tmpl)
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}

	// 确保目录存在
	dir := filepath.Dir(outputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer file.Close()

	if err := t.Execute(file, g.results); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	fmt.Printf("📄 HTML 报告已生成: %s\n", outputPath)
	return nil
}

// GenerateJSONReport 生成 JSON 报告
func (g *Generator) GenerateJSONReport(outputPath string) error {
	// 确保目录存在
	dir := filepath.Dir(outputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	data, err := json.MarshalIndent(g.results, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write JSON report: %w", err)
	}

	fmt.Printf("📄 JSON 报告已生成: %s\n", outputPath)
	return nil
}

// LoadTestResults 从文件加载测试结果
func LoadTestResults(filename string) (TestResults, error) {
	var results TestResults

	data, err := os.ReadFile(filename)
	if err != nil {
		return results, err
	}

	err = json.Unmarshal(data, &results)
	return results, err
}
