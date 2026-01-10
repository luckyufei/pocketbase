package reliability

import (
	"sync"
	"sync/atomic"
	"time"
)

// TriggerType 触发器类型
type TriggerType int

const (
	TriggerCPU TriggerType = iota
	TriggerMemory
	TriggerErrorRate
	TriggerQueueLength
)

// DegradationTrigger 降级触发器
type DegradationTrigger struct {
	Type      TriggerType      // 触发器类型
	Threshold float64          // 阈值
	Level     DegradationLevel // 触发后的降级级别
}

// DegradationMetrics 降级指标
type DegradationMetrics struct {
	CPUUsage    float64 // CPU 使用率 (0-1)
	MemoryUsage float64 // 内存使用率 (0-1)
	QueueLength int     // 队列长度
	ErrorRate   float64 // 错误率 (0-1)
}

// DegradationConfig 降级配置
type DegradationConfig struct {
	Triggers          []DegradationTrigger                       // 触发器列表
	CriticalFunctions []string                                   // 关键函数列表（Severe 级别仍可执行）
	CheckInterval     time.Duration                              // 检查间隔
	RecoveryDelay     time.Duration                              // 恢复延迟
	OnLevelChange     func(old, new DegradationLevel)            // 级别变更回调
}

// DefaultDegradationConfig 返回默认配置
func DefaultDegradationConfig() DegradationConfig {
	return DegradationConfig{
		Triggers: []DegradationTrigger{
			{Type: TriggerCPU, Threshold: 0.8, Level: DegradationPartial},
			{Type: TriggerMemory, Threshold: 0.85, Level: DegradationPartial},
			{Type: TriggerErrorRate, Threshold: 0.1, Level: DegradationSevere},
			{Type: TriggerQueueLength, Threshold: 1000, Level: DegradationSevere},
		},
		CriticalFunctions: []string{},
		CheckInterval:     5 * time.Second,
		RecoveryDelay:     30 * time.Second,
	}
}

// DegradationStats 降级统计
type DegradationStats struct {
	TotalChecks      int64 // 总检查次数
	RejectedRequests int64 // 拒绝的请求数
	CurrentLevel     DegradationLevel
	LastLevelChange  time.Time
}

// DegradationStrategy 降级策略
type DegradationStrategy struct {
	config           DegradationConfig
	level            DegradationLevel
	metrics          DegradationMetrics
	criticalSet      map[string]bool
	mu               sync.RWMutex
	totalChecks      int64
	rejectedRequests int64
	lastLevelChange  time.Time
	lastTriggerTime  time.Time
	stopCh           chan struct{}
	closed           bool
}

// NewDegradationStrategy 创建新的降级策略
func NewDegradationStrategy(config DegradationConfig) *DegradationStrategy {
	criticalSet := make(map[string]bool)
	for _, fn := range config.CriticalFunctions {
		criticalSet[fn] = true
	}

	s := &DegradationStrategy{
		config:          config,
		level:           DegradationNone,
		criticalSet:     criticalSet,
		lastLevelChange: time.Now(),
		stopCh:          make(chan struct{}),
	}

	// 启动后台检查
	if config.CheckInterval > 0 {
		go s.checkLoop()
	}

	return s
}

// CurrentLevel 获取当前降级级别
func (s *DegradationStrategy) CurrentLevel() DegradationLevel {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.level
}

// SetLevel 手动设置降级级别
func (s *DegradationStrategy) SetLevel(level DegradationLevel) {
	s.mu.Lock()
	oldLevel := s.level
	s.level = level
	s.lastLevelChange = time.Now()
	callback := s.config.OnLevelChange
	s.mu.Unlock()

	if callback != nil && oldLevel != level {
		callback(oldLevel, level)
	}
}

// ShouldExecute 判断是否应该执行函数
func (s *DegradationStrategy) ShouldExecute(functionName string) bool {
	atomic.AddInt64(&s.totalChecks, 1)

	s.mu.RLock()
	level := s.level
	isCritical := s.criticalSet[functionName]
	s.mu.RUnlock()

	var allowed bool
	switch level {
	case DegradationNone, DegradationPartial:
		// None 和 Partial 允许所有请求
		allowed = true
	case DegradationSevere:
		// Severe 只允许关键函数
		allowed = isCritical
	case DegradationFull:
		// Full 拒绝所有请求
		allowed = false
	default:
		allowed = true
	}

	if !allowed {
		atomic.AddInt64(&s.rejectedRequests, 1)
	}

	return allowed
}

// UpdateMetrics 更新指标
func (s *DegradationStrategy) UpdateMetrics(metrics DegradationMetrics) {
	s.mu.Lock()
	s.metrics = metrics
	s.mu.Unlock()
}

// Stats 获取统计信息
func (s *DegradationStrategy) Stats() DegradationStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return DegradationStats{
		TotalChecks:      atomic.LoadInt64(&s.totalChecks),
		RejectedRequests: atomic.LoadInt64(&s.rejectedRequests),
		CurrentLevel:     s.level,
		LastLevelChange:  s.lastLevelChange,
	}
}

// Reset 重置策略
func (s *DegradationStrategy) Reset() {
	s.mu.Lock()
	s.level = DegradationNone
	s.lastLevelChange = time.Now()
	s.lastTriggerTime = time.Time{}
	s.mu.Unlock()

	atomic.StoreInt64(&s.totalChecks, 0)
	atomic.StoreInt64(&s.rejectedRequests, 0)
}

// Close 关闭策略
func (s *DegradationStrategy) Close() {
	s.mu.Lock()
	if !s.closed {
		s.closed = true
		close(s.stopCh)
	}
	s.mu.Unlock()
}

// checkLoop 后台检查循环
func (s *DegradationStrategy) checkLoop() {
	ticker := time.NewTicker(s.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.checkAndAdjust()
		}
	}
}

// checkAndAdjust 检查并调整降级级别
func (s *DegradationStrategy) checkAndAdjust() {
	s.mu.Lock()
	metrics := s.metrics
	currentLevel := s.level
	lastTrigger := s.lastTriggerTime
	triggers := s.config.Triggers
	recoveryDelay := s.config.RecoveryDelay
	s.mu.Unlock()

	// 计算应该的级别
	targetLevel := DegradationNone
	for _, trigger := range triggers {
		var value float64
		switch trigger.Type {
		case TriggerCPU:
			value = metrics.CPUUsage
		case TriggerMemory:
			value = metrics.MemoryUsage
		case TriggerErrorRate:
			value = metrics.ErrorRate
		case TriggerQueueLength:
			value = float64(metrics.QueueLength)
		}

		if value >= trigger.Threshold && trigger.Level > targetLevel {
			targetLevel = trigger.Level
		}
	}

	// 级别调整逻辑
	if targetLevel > currentLevel {
		// 升级（立即）
		s.SetLevel(targetLevel)
		s.mu.Lock()
		s.lastTriggerTime = time.Now()
		s.mu.Unlock()
	} else if targetLevel < currentLevel {
		// 降级（需要等待恢复延迟）
		if time.Since(lastTrigger) >= recoveryDelay {
			s.SetLevel(targetLevel)
		}
	}
}
