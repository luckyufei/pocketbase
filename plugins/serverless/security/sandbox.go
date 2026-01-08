// Package security 提供 Serverless 函数的安全隔离和资源限制
package security

import (
	"errors"
	"strings"
	"sync"
	"sync/atomic"
)

// SandboxPolicy 定义沙箱安全策略
type SandboxPolicy struct {
	MaxMemoryMB     int64 // 最大内存限制 (MB)
	MaxCPUTimeMS    int64 // 最大 CPU 时间 (毫秒)
	MaxInstructions int64 // 最大指令数
	AllowNetwork    bool  // 是否允许网络访问
	AllowFileRead   bool  // 是否允许文件读取
	AllowFileWrite  bool  // 是否允许文件写入
}

// Validate 验证策略配置
func (p *SandboxPolicy) Validate() error {
	if p.MaxMemoryMB <= 0 {
		return errors.New("MaxMemoryMB must be positive")
	}
	if p.MaxMemoryMB > 512 {
		return errors.New("MaxMemoryMB cannot exceed 512MB")
	}
	if p.MaxCPUTimeMS > 600000 { // 10 分钟
		return errors.New("MaxCPUTimeMS cannot exceed 10 minutes")
	}
	return nil
}

// SandboxStats 沙箱运行统计
type SandboxStats struct {
	InstructionsExecuted int64
	MemoryUsedBytes      int64
	NetworkCalls         int64
	FileReads            int64
	FileWrites           int64
}

// Sandbox 沙箱实例
type Sandbox struct {
	policy *SandboxPolicy
	stats  *SandboxStats
	mu     sync.RWMutex

	instructionCount int64
}

// NewSandbox 创建新的沙箱实例
func NewSandbox(policy *SandboxPolicy) *Sandbox {
	return &Sandbox{
		policy: policy,
		stats:  &SandboxStats{},
	}
}

// CheckMemory 检查内存使用是否超限
func (s *Sandbox) CheckMemory(usedBytes int64) error {
	maxBytes := s.policy.MaxMemoryMB * 1024 * 1024
	if usedBytes > maxBytes {
		return errors.New("memory limit exceeded")
	}
	atomic.StoreInt64(&s.stats.MemoryUsedBytes, usedBytes)
	return nil
}

// IncrementInstructions 增加指令计数
func (s *Sandbox) IncrementInstructions(count int64) error {
	newCount := atomic.AddInt64(&s.instructionCount, count)
	if newCount > s.policy.MaxInstructions {
		return errors.New("instruction limit exceeded")
	}
	atomic.StoreInt64(&s.stats.InstructionsExecuted, newCount)
	return nil
}

// CheckNetwork 检查网络访问权限
func (s *Sandbox) CheckNetwork(host string) error {
	if !s.policy.AllowNetwork {
		return errors.New("network access not allowed")
	}
	atomic.AddInt64(&s.stats.NetworkCalls, 1)
	return nil
}

// CheckFileAccess 检查文件访问权限
func (s *Sandbox) CheckFileAccess(path string, write bool) error {
	// 检查敏感路径
	sensitivePatterns := []string{
		"/etc/",
		"/var/",
		"/usr/",
		"/bin/",
		"/sbin/",
		"/root/",
		"/home/",
		"/..",
	}

	for _, pattern := range sensitivePatterns {
		if strings.Contains(path, pattern) {
			return errors.New("access to sensitive path not allowed")
		}
	}

	if write {
		if !s.policy.AllowFileWrite {
			return errors.New("file write not allowed")
		}
		atomic.AddInt64(&s.stats.FileWrites, 1)
	} else {
		if !s.policy.AllowFileRead {
			return errors.New("file read not allowed")
		}
		atomic.AddInt64(&s.stats.FileReads, 1)
	}

	return nil
}

// GetStats 获取运行统计
func (s *Sandbox) GetStats() *SandboxStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &SandboxStats{
		InstructionsExecuted: atomic.LoadInt64(&s.stats.InstructionsExecuted),
		MemoryUsedBytes:      atomic.LoadInt64(&s.stats.MemoryUsedBytes),
		NetworkCalls:         atomic.LoadInt64(&s.stats.NetworkCalls),
		FileReads:            atomic.LoadInt64(&s.stats.FileReads),
		FileWrites:           atomic.LoadInt64(&s.stats.FileWrites),
	}
}

// Reset 重置沙箱状态
func (s *Sandbox) Reset() {
	atomic.StoreInt64(&s.instructionCount, 0)
	atomic.StoreInt64(&s.stats.InstructionsExecuted, 0)
	atomic.StoreInt64(&s.stats.MemoryUsedBytes, 0)
	atomic.StoreInt64(&s.stats.NetworkCalls, 0)
	atomic.StoreInt64(&s.stats.FileReads, 0)
	atomic.StoreInt64(&s.stats.FileWrites, 0)
}

// DefaultPolicy 返回默认沙箱策略
func DefaultPolicy() *SandboxPolicy {
	return &SandboxPolicy{
		MaxMemoryMB:     128,
		MaxCPUTimeMS:    30000,
		MaxInstructions: 100_000_000,
		AllowNetwork:    true,
		AllowFileRead:   true,
		AllowFileWrite:  false,
	}
}
