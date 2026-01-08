package hostfn

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"
)

// LogEntry 表示一条日志记录
type LogEntry struct {
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	TraceID   string    `json:"trace_id,omitempty"`
}

// ConsoleConfig Console 配置
type ConsoleConfig struct {
	// Writer 日志输出目标
	Writer io.Writer

	// TraceID 追踪 ID
	TraceID string

	// Collector 日志收集器
	Collector *LogCollector
}

// Console 是 console Host Function 实现
type Console struct {
	config    ConsoleConfig
	writer    io.Writer
	traceID   string
	collector *LogCollector
	mu        sync.Mutex
}

// NewConsole 创建新的 Console 实例
func NewConsole(config ConsoleConfig) *Console {
	writer := config.Writer
	if writer == nil {
		writer = os.Stdout
	}

	return &Console{
		config:    config,
		writer:    writer,
		traceID:   config.TraceID,
		collector: config.Collector,
	}
}

// SetTraceID 设置追踪 ID
func (c *Console) SetTraceID(traceID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.traceID = traceID
}

// Log 输出 log 级别日志
func (c *Console) Log(args ...any) {
	c.output("log", args...)
}

// Warn 输出 warn 级别日志
func (c *Console) Warn(args ...any) {
	c.output("warn", args...)
}

// Error 输出 error 级别日志
func (c *Console) Error(args ...any) {
	c.output("error", args...)
}

// Info 输出 info 级别日志
func (c *Console) Info(args ...any) {
	c.output("info", args...)
}

// Debug 输出 debug 级别日志
func (c *Console) Debug(args ...any) {
	c.output("debug", args...)
}

// output 输出日志
func (c *Console) output(level string, args ...any) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 格式化消息
	message := formatArgs(args...)

	entry := LogEntry{
		Level:     level,
		Message:   message,
		Timestamp: time.Now(),
		TraceID:   c.traceID,
	}

	// 收集日志
	if c.collector != nil {
		c.collector.Add(entry)
	}

	// 输出 JSON
	data, _ := json.Marshal(entry)
	c.writer.Write(data)
}

// formatArgs 格式化参数
func formatArgs(args ...any) string {
	if len(args) == 0 {
		return ""
	}

	parts := make([]string, 0, len(args))
	for _, arg := range args {
		switch v := arg.(type) {
		case string:
			parts = append(parts, v)
		case map[string]any:
			data, _ := json.Marshal(v)
			parts = append(parts, string(data))
		default:
			parts = append(parts, fmt.Sprintf("%v", v))
		}
	}

	return strings.Join(parts, " ")
}

// LogCollector 日志收集器
type LogCollector struct {
	logs []LogEntry
	mu   sync.Mutex
}

// NewLogCollector 创建新的日志收集器
func NewLogCollector() *LogCollector {
	return &LogCollector{
		logs: []LogEntry{},
	}
}

// Add 添加日志
func (c *LogCollector) Add(entry LogEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.logs = append(c.logs, entry)
}

// Logs 获取所有日志
func (c *LogCollector) Logs() []LogEntry {
	c.mu.Lock()
	defer c.mu.Unlock()
	result := make([]LogEntry, len(c.logs))
	copy(result, c.logs)
	return result
}

// Clear 清空日志
func (c *LogCollector) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.logs = []LogEntry{}
}
