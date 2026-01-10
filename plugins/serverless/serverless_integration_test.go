package serverless

import (
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/metrics"
	"github.com/pocketbase/pocketbase/plugins/serverless/reliability"
)

// TestReliabilityConfigIntegration 测试可靠性配置集成
func TestReliabilityConfigIntegration(t *testing.T) {
	config := DefaultConfig()

	// 验证默认配置包含可靠性选项
	if config.CircuitBreakerConfig.FailureThreshold == 0 {
		t.Error("期望 CircuitBreakerConfig 有默认值")
	}
	if config.RetryConfig.MaxAttempts == 0 {
		t.Error("期望 RetryConfig 有默认值")
	}
}

// TestMetricsConfigIntegration 测试指标配置集成
func TestMetricsConfigIntegration(t *testing.T) {
	config := DefaultConfig()

	// 验证默认配置包含指标选项
	if !config.EnableMetrics {
		t.Error("期望默认启用指标收集")
	}
}

// TestDynamicPoolConfigIntegration 测试动态池配置集成
func TestDynamicPoolConfigIntegration(t *testing.T) {
	config := DefaultConfig()

	// 验证默认配置包含动态池选项
	if config.DynamicPoolConfig.MinSize == 0 {
		t.Error("期望 DynamicPoolConfig.MinSize 有默认值")
	}
	if config.DynamicPoolConfig.MaxSize == 0 {
		t.Error("期望 DynamicPoolConfig.MaxSize 有默认值")
	}
}

// TestCircuitBreakerCreation 测试断路器创建
func TestCircuitBreakerCreation(t *testing.T) {
	cbConfig := reliability.DefaultCircuitBreakerConfig()
	cb := reliability.NewCircuitBreaker(cbConfig)

	if cb == nil {
		t.Fatal("期望创建断路器成功")
	}

	if cb.State() != reliability.StateClosed {
		t.Errorf("期望初始状态为 Closed，实际为 %v", cb.State())
	}
}

// TestRetryerCreation 测试重试器创建
func TestRetryerCreation(t *testing.T) {
	retryConfig := reliability.DefaultRetryConfig()
	retryer := reliability.NewRetryer(retryConfig)

	if retryer == nil {
		t.Fatal("期望创建重试器成功")
	}
}

// TestMetricsCollectorCreation 测试指标收集器创建
func TestMetricsCollectorCreation(t *testing.T) {
	metricsConfig := metrics.DefaultMetricsConfig()
	collector := metrics.NewMetricsCollector(metricsConfig)

	if collector == nil {
		t.Fatal("期望创建指标收集器成功")
	}

	stats := collector.GetStats()
	if stats.TotalRequests != 0 {
		t.Errorf("期望初始请求数为 0，实际为 %d", stats.TotalRequests)
	}
}

// TestDegradationStrategyCreation 测试降级策略创建
func TestDegradationStrategyCreation(t *testing.T) {
	degradeConfig := reliability.DefaultDegradationConfig()
	strategy := reliability.NewDegradationStrategy(degradeConfig)
	defer strategy.Close()

	if strategy == nil {
		t.Fatal("期望创建降级策略成功")
	}

	if strategy.CurrentLevel() != reliability.DegradationNone {
		t.Errorf("期望初始级别为 None，实际为 %v", strategy.CurrentLevel())
	}
}

// TestConfigWithReliability 测试带可靠性配置的完整配置
func TestConfigWithReliability(t *testing.T) {
	config := Config{
		PoolSize:            4,
		MaxMemoryMB:         128,
		TimeoutSeconds:      30,
		FunctionsDir:        "pb_serverless",
		EnableMetrics:       true,
		EnableCircuitBreaker: true,
		EnableRetry:         true,
		CircuitBreakerConfig: reliability.CircuitBreakerConfig{
			FailureThreshold: 5,
			SuccessThreshold: 2,
			Timeout:          30 * time.Second,
		},
		RetryConfig: reliability.RetryConfig{
			MaxAttempts:     3,
			InitialInterval: 100 * time.Millisecond,
			MaxInterval:     10 * time.Second,
			Multiplier:      2.0,
		},
	}

	if config.CircuitBreakerConfig.FailureThreshold != 5 {
		t.Errorf("期望 FailureThreshold 为 5，实际为 %d", config.CircuitBreakerConfig.FailureThreshold)
	}
	if config.RetryConfig.MaxAttempts != 3 {
		t.Errorf("期望 MaxAttempts 为 3，实际为 %d", config.RetryConfig.MaxAttempts)
	}
}
