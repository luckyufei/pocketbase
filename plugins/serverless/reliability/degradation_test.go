package reliability

import (
	"sync"
	"testing"
	"time"
)

// TestDegradationStrategyBasic 测试基本降级功能
func TestDegradationStrategyBasic(t *testing.T) {
	config := DefaultDegradationConfig()
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 初始状态应该是 None
	if strategy.CurrentLevel() != DegradationNone {
		t.Errorf("期望初始级别为 None，实际为 %v", strategy.CurrentLevel())
	}

	// 应该允许执行
	if !strategy.ShouldExecute("test_function") {
		t.Error("期望 DegradationNone 允许执行")
	}
}

// TestDegradationLevelProgression 测试降级级别递进
func TestDegradationLevelProgression(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 手动设置级别
	strategy.SetLevel(DegradationPartial)
	if strategy.CurrentLevel() != DegradationPartial {
		t.Errorf("期望级别为 Partial，实际为 %v", strategy.CurrentLevel())
	}

	strategy.SetLevel(DegradationSevere)
	if strategy.CurrentLevel() != DegradationSevere {
		t.Errorf("期望级别为 Severe，实际为 %v", strategy.CurrentLevel())
	}

	strategy.SetLevel(DegradationFull)
	if strategy.CurrentLevel() != DegradationFull {
		t.Errorf("期望级别为 Full，实际为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationTriggerCPU 测试 CPU 触发器
func TestDegradationTriggerCPU(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	config.Triggers = []DegradationTrigger{
		{
			Type:      TriggerCPU,
			Threshold: 0.8, // 80% CPU
			Level:     DegradationPartial,
		},
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 模拟高 CPU
	strategy.UpdateMetrics(DegradationMetrics{
		CPUUsage:    0.9, // 90%
		MemoryUsage: 0.5,
		QueueLength: 10,
		ErrorRate:   0.01,
	})

	// 等待检查
	time.Sleep(150 * time.Millisecond)

	if strategy.CurrentLevel() != DegradationPartial {
		t.Errorf("期望高 CPU 触发 Partial 降级，实际级别为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationTriggerMemory 测试内存触发器
func TestDegradationTriggerMemory(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	config.Triggers = []DegradationTrigger{
		{
			Type:      TriggerMemory,
			Threshold: 0.85,
			Level:     DegradationSevere,
		},
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 模拟高内存
	strategy.UpdateMetrics(DegradationMetrics{
		CPUUsage:    0.5,
		MemoryUsage: 0.9, // 90%
		QueueLength: 10,
		ErrorRate:   0.01,
	})

	time.Sleep(150 * time.Millisecond)

	if strategy.CurrentLevel() != DegradationSevere {
		t.Errorf("期望高内存触发 Severe 降级，实际级别为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationTriggerErrorRate 测试错误率触发器
func TestDegradationTriggerErrorRate(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	config.Triggers = []DegradationTrigger{
		{
			Type:      TriggerErrorRate,
			Threshold: 0.1, // 10% 错误率
			Level:     DegradationPartial,
		},
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 模拟高错误率
	strategy.UpdateMetrics(DegradationMetrics{
		CPUUsage:    0.5,
		MemoryUsage: 0.5,
		QueueLength: 10,
		ErrorRate:   0.15, // 15%
	})

	time.Sleep(150 * time.Millisecond)

	if strategy.CurrentLevel() != DegradationPartial {
		t.Errorf("期望高错误率触发 Partial 降级，实际级别为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationTriggerQueueLength 测试队列长度触发器
func TestDegradationTriggerQueueLength(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	config.Triggers = []DegradationTrigger{
		{
			Type:      TriggerQueueLength,
			Threshold: 100,
			Level:     DegradationSevere,
		},
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 模拟长队列
	strategy.UpdateMetrics(DegradationMetrics{
		CPUUsage:    0.5,
		MemoryUsage: 0.5,
		QueueLength: 150,
		ErrorRate:   0.01,
	})

	time.Sleep(150 * time.Millisecond)

	if strategy.CurrentLevel() != DegradationSevere {
		t.Errorf("期望长队列触发 Severe 降级，实际级别为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationRecovery 测试降级恢复
func TestDegradationRecovery(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	config.RecoveryDelay = 100 * time.Millisecond
	config.Triggers = []DegradationTrigger{
		{
			Type:      TriggerCPU,
			Threshold: 0.8,
			Level:     DegradationPartial,
		},
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 触发降级
	strategy.UpdateMetrics(DegradationMetrics{CPUUsage: 0.9})
	time.Sleep(100 * time.Millisecond)

	if strategy.CurrentLevel() != DegradationPartial {
		t.Errorf("期望触发 Partial 降级，实际级别为 %v", strategy.CurrentLevel())
	}

	// 恢复正常
	strategy.UpdateMetrics(DegradationMetrics{CPUUsage: 0.3})
	time.Sleep(200 * time.Millisecond)

	if strategy.CurrentLevel() != DegradationNone {
		t.Errorf("期望恢复到 None，实际级别为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationShouldExecuteByLevel 测试不同级别的执行决策
func TestDegradationShouldExecuteByLevel(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CriticalFunctions = []string{"payment", "auth"}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// None 级别 - 所有函数都可执行
	strategy.SetLevel(DegradationNone)
	if !strategy.ShouldExecute("any_function") {
		t.Error("DegradationNone 应该允许所有函数执行")
	}

	// Partial 级别 - 所有函数仍可执行（只是性能降低）
	strategy.SetLevel(DegradationPartial)
	if !strategy.ShouldExecute("any_function") {
		t.Error("DegradationPartial 应该允许所有函数执行")
	}

	// Severe 级别 - 只允许关键函数
	strategy.SetLevel(DegradationSevere)
	if !strategy.ShouldExecute("payment") {
		t.Error("DegradationSevere 应该允许关键函数 payment 执行")
	}
	if !strategy.ShouldExecute("auth") {
		t.Error("DegradationSevere 应该允许关键函数 auth 执行")
	}
	if strategy.ShouldExecute("non_critical") {
		t.Error("DegradationSevere 不应该允许非关键函数执行")
	}

	// Full 级别 - 拒绝所有请求
	strategy.SetLevel(DegradationFull)
	if strategy.ShouldExecute("payment") {
		t.Error("DegradationFull 不应该允许任何函数执行")
	}
}

// TestDegradationCallback 测试降级回调
func TestDegradationCallback(t *testing.T) {
	var callbackCalled bool
	var oldLevel, newLevel DegradationLevel

	config := DefaultDegradationConfig()
	config.OnLevelChange = func(old, new DegradationLevel) {
		callbackCalled = true
		oldLevel = old
		newLevel = new
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	strategy.SetLevel(DegradationPartial)

	if !callbackCalled {
		t.Error("期望回调被调用")
	}
	if oldLevel != DegradationNone {
		t.Errorf("期望旧级别为 None，实际为 %v", oldLevel)
	}
	if newLevel != DegradationPartial {
		t.Errorf("期望新级别为 Partial，实际为 %v", newLevel)
	}
}

// TestDegradationConcurrency 测试并发安全
func TestDegradationConcurrency(t *testing.T) {
	config := DefaultDegradationConfig()
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	var wg sync.WaitGroup
	numGoroutines := 10
	numOperations := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				// 随机操作
				switch j % 4 {
				case 0:
					strategy.SetLevel(DegradationLevel(j % 4))
				case 1:
					strategy.CurrentLevel()
				case 2:
					strategy.ShouldExecute("test")
				case 3:
					strategy.UpdateMetrics(DegradationMetrics{
						CPUUsage: float64(j%100) / 100,
					})
				}
			}
		}(i)
	}

	wg.Wait()
	// 验证没有 panic
}

// TestDegradationStats 测试统计信息
func TestDegradationStats(t *testing.T) {
	config := DefaultDegradationConfig()
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 执行一些操作
	strategy.ShouldExecute("func1")
	strategy.ShouldExecute("func2")
	strategy.SetLevel(DegradationFull)
	strategy.ShouldExecute("func3") // 被拒绝

	stats := strategy.Stats()
	if stats.TotalChecks != 3 {
		t.Errorf("期望检查次数为 3，实际为 %d", stats.TotalChecks)
	}
	if stats.RejectedRequests != 1 {
		t.Errorf("期望拒绝次数为 1，实际为 %d", stats.RejectedRequests)
	}
}

// TestDegradationMultipleTriggers 测试多个触发器
func TestDegradationMultipleTriggers(t *testing.T) {
	config := DefaultDegradationConfig()
	config.CheckInterval = 50 * time.Millisecond
	config.Triggers = []DegradationTrigger{
		{Type: TriggerCPU, Threshold: 0.8, Level: DegradationPartial},
		{Type: TriggerMemory, Threshold: 0.9, Level: DegradationSevere},
		{Type: TriggerErrorRate, Threshold: 0.2, Level: DegradationFull},
	}
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	// 触发最高级别
	strategy.UpdateMetrics(DegradationMetrics{
		CPUUsage:    0.85,
		MemoryUsage: 0.95,
		ErrorRate:   0.25,
	})

	time.Sleep(150 * time.Millisecond)

	// 应该使用最高级别
	if strategy.CurrentLevel() != DegradationFull {
		t.Errorf("期望最高级别 Full，实际为 %v", strategy.CurrentLevel())
	}
}

// TestDegradationDefaultConfig 测试默认配置
func TestDegradationDefaultConfig(t *testing.T) {
	config := DefaultDegradationConfig()

	if config.CheckInterval != 5*time.Second {
		t.Errorf("期望默认 CheckInterval 为 5s，实际为 %v", config.CheckInterval)
	}
	if config.RecoveryDelay != 30*time.Second {
		t.Errorf("期望默认 RecoveryDelay 为 30s，实际为 %v", config.RecoveryDelay)
	}
	if len(config.Triggers) != 4 {
		t.Errorf("期望默认有 4 个触发器，实际为 %d", len(config.Triggers))
	}
}

// TestDegradationReset 测试重置
func TestDegradationReset(t *testing.T) {
	config := DefaultDegradationConfig()
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	strategy.SetLevel(DegradationSevere)
	strategy.ShouldExecute("test")

	strategy.Reset()

	if strategy.CurrentLevel() != DegradationNone {
		t.Errorf("期望重置后级别为 None，实际为 %v", strategy.CurrentLevel())
	}

	stats := strategy.Stats()
	if stats.TotalChecks != 0 {
		t.Errorf("期望重置后检查次数为 0，实际为 %d", stats.TotalChecks)
	}
}

// BenchmarkDegradationShouldExecute 基准测试执行决策
func BenchmarkDegradationShouldExecute(b *testing.B) {
	config := DefaultDegradationConfig()
	strategy := NewDegradationStrategy(config)
	defer strategy.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		strategy.ShouldExecute("test_function")
	}
}
