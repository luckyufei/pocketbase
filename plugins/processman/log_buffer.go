// Package processman 提供 PocketBase 的进程管理插件
package processman

import (
	"errors"
	"strings"
	"sync"
	"time"
)

// LogEntry 日志条目
// 映射 spec.md Key Entities: ProcessLog
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	ProcessID string    `json:"processId"`
	Stream    string    `json:"stream"` // stdout | stderr
	Content   string    `json:"content"`
}

// LogBuffer 环形日志缓冲区（线程安全）
// 实现固定容量的日志存储，超出容量时自动淘汰最旧的日志
type LogBuffer struct {
	mu       sync.RWMutex
	entries  []LogEntry
	capacity int
	head     int  // 写入位置
	count    int  // 当前条目数
	wrapped  bool // 是否已经循环过
}

// NewLogBuffer 创建指定容量的日志缓冲区
func NewLogBuffer(capacity int) *LogBuffer {
	if capacity <= 0 {
		capacity = 1000 // 默认 1000 条
	}
	return &LogBuffer{
		entries:  make([]LogEntry, capacity),
		capacity: capacity,
	}
}

// Add 添加日志条目
func (b *LogBuffer) Add(entry LogEntry) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.entries[b.head] = entry
	b.head = (b.head + 1) % b.capacity

	if b.count < b.capacity {
		b.count++
	} else {
		b.wrapped = true
	}
}

// GetLast 获取最近 n 条日志（按时间顺序，最旧在前）
func (b *LogBuffer) GetLast(n int) []LogEntry {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.count == 0 {
		return []LogEntry{}
	}

	// 限制返回数量
	if n <= 0 || n > b.count {
		n = b.count
	}

	result := make([]LogEntry, n)

	// 计算起始位置
	// head 指向下一个写入位置，所以最新的数据在 head-1
	// 最旧的 n 条数据从 head-n 开始
	start := b.head - n
	if start < 0 {
		start += b.capacity
	}

	for i := 0; i < n; i++ {
		idx := (start + i) % b.capacity
		result[i] = b.entries[idx]
	}

	return result
}

// Count 返回当前日志条目数
func (b *LogBuffer) Count() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.count
}

// Clear 清空缓冲区
func (b *LogBuffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.head = 0
	b.count = 0
	b.wrapped = false
}

// sensitiveKeywords 敏感环境变量关键词
var sensitiveKeywords = []string{
	"KEY",
	"SECRET",
	"PASSWORD",
	"PASS",
	"TOKEN",
	"CREDENTIAL",
	"AUTH",
}

// MaskSensitiveEnvVars 对敏感环境变量进行脱敏
// 包含 KEY、SECRET、PASSWORD、TOKEN 等关键词的变量会被替换为 "****"
func MaskSensitiveEnvVars(env map[string]string) map[string]string {
	if env == nil {
		return nil
	}

	masked := make(map[string]string, len(env))
	for k, v := range env {
		isSensitive := false
		upperKey := strings.ToUpper(k)

		for _, keyword := range sensitiveKeywords {
			if strings.Contains(upperKey, keyword) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			masked[k] = "****"
		} else {
			masked[k] = v
		}
	}

	return masked
}

// ErrProcessNotFound 进程不存在错误
var ErrProcessNotFound = errors.New("process not found")

// ErrProcessAlreadyRunning 进程已在运行错误
var ErrProcessAlreadyRunning = errors.New("process is already running")
