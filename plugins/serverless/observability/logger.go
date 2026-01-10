// Package observability 提供 Serverless 函数的可观测性功能
package observability

import (
	"encoding/json"
	"io"
	"strings"
	"sync"
	"time"
)

// LogField 日志字段
type LogField struct {
	Key   string
	Value interface{}
}

// StructuredLogger 结构化日志记录器
type StructuredLogger struct {
	writer    io.Writer
	level     LogLevel
	fields    []LogField
	mu        sync.Mutex
}

// NewStructuredLogger 创建新的结构化日志记录器
func NewStructuredLogger(writer io.Writer, level LogLevel) *StructuredLogger {
	return &StructuredLogger{
		writer: writer,
		level:  level,
		fields: nil,
	}
}

// WithFields 创建带有预设字段的新 logger
func (l *StructuredLogger) WithFields(fields ...LogField) *StructuredLogger {
	newFields := make([]LogField, len(l.fields)+len(fields))
	copy(newFields, l.fields)
	copy(newFields[len(l.fields):], fields)

	return &StructuredLogger{
		writer: l.writer,
		level:  l.level,
		fields: newFields,
	}
}

// Debug 记录调试级别日志
func (l *StructuredLogger) Debug(msg string, fields ...LogField) {
	l.log(LogLevelDebug, msg, fields...)
}

// Info 记录信息级别日志
func (l *StructuredLogger) Info(msg string, fields ...LogField) {
	l.log(LogLevelInfo, msg, fields...)
}

// Warn 记录警告级别日志
func (l *StructuredLogger) Warn(msg string, fields ...LogField) {
	l.log(LogLevelWarn, msg, fields...)
}

// Error 记录错误级别日志
func (l *StructuredLogger) Error(msg string, fields ...LogField) {
	l.log(LogLevelError, msg, fields...)
}

// log 内部日志记录方法
func (l *StructuredLogger) log(level LogLevel, msg string, fields ...LogField) {
	// 级别过滤
	if level < l.level {
		return
	}

	// 空 writer 检查
	if l.writer == nil {
		return
	}

	// 构建日志条目
	entry := make(map[string]interface{})
	entry["timestamp"] = time.Now().Format(time.RFC3339Nano)
	entry["level"] = strings.ToUpper(level.String()) // 转换为大写
	entry["message"] = msg

	// 添加预设字段
	for _, f := range l.fields {
		entry[f.Key] = f.Value
	}

	// 添加额外字段
	for _, f := range fields {
		entry[f.Key] = f.Value
	}

	// 序列化为 JSON
	data, err := json.Marshal(entry)
	if err != nil {
		return
	}

	// 写入（线程安全）
	l.mu.Lock()
	defer l.mu.Unlock()
	l.writer.Write(data)
	l.writer.Write([]byte("\n"))
}

// SetLevel 设置日志级别
func (l *StructuredLogger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// GetLevel 获取当前日志级别
func (l *StructuredLogger) GetLevel() LogLevel {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.level
}
