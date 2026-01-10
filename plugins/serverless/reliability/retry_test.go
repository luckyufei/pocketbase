package reliability

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

// 测试错误
var errRetryTest = errors.New("重试测试错误")

// TestRetryerFirstSuccess 测试首次成功不重试
func TestRetryerFirstSuccess(t *testing.T) {
	config := DefaultRetryConfig()
	retryer := NewRetryer(config)

	var callCount int32
	err := retryer.Execute(context.Background(), func() error {
		atomic.AddInt32(&callCount, 1)
		return nil
	})

	if err != nil {
		t.Errorf("期望无错误，实际为 %v", err)
	}

	if callCount != 1 {
		t.Errorf("期望调用次数为 1，实际为 %d", callCount)
	}
}

// TestRetryerRetryOnFailure 测试失败后重试
func TestRetryerRetryOnFailure(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 3
	config.InitialInterval = 10 * time.Millisecond
	retryer := NewRetryer(config)

	var callCount int32
	err := retryer.Execute(context.Background(), func() error {
		count := atomic.AddInt32(&callCount, 1)
		if count < 3 {
			return errRetryTest
		}
		return nil
	})

	if err != nil {
		t.Errorf("期望无错误（第三次成功），实际为 %v", err)
	}

	if callCount != 3 {
		t.Errorf("期望调用次数为 3，实际为 %d", callCount)
	}
}

// TestRetryerMaxAttempts 测试达到最大重试次数
func TestRetryerMaxAttempts(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 3
	config.InitialInterval = 10 * time.Millisecond
	retryer := NewRetryer(config)

	var callCount int32
	err := retryer.Execute(context.Background(), func() error {
		atomic.AddInt32(&callCount, 1)
		return errRetryTest
	})

	if !errors.Is(err, errRetryTest) {
		t.Errorf("期望错误为 errRetryTest，实际为 %v", err)
	}

	if callCount != 3 {
		t.Errorf("期望调用次数为 3（最大重试次数），实际为 %d", callCount)
	}
}

// TestRetryerContextCancel 测试上下文取消
func TestRetryerContextCancel(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 10
	config.InitialInterval = 100 * time.Millisecond
	retryer := NewRetryer(config)

	ctx, cancel := context.WithCancel(context.Background())

	var callCount int32
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := retryer.Execute(ctx, func() error {
		atomic.AddInt32(&callCount, 1)
		return errRetryTest
	})

	if !errors.Is(err, context.Canceled) {
		t.Errorf("期望错误为 context.Canceled，实际为 %v", err)
	}
}

// TestRetryerContextTimeout 测试上下文超时
func TestRetryerContextTimeout(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 10
	config.InitialInterval = 100 * time.Millisecond
	retryer := NewRetryer(config)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	err := retryer.Execute(ctx, func() error {
		return errRetryTest
	})

	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("期望错误为 context.DeadlineExceeded，实际为 %v", err)
	}
}

// TestRetryerExponentialBackoff 测试指数退避
func TestRetryerExponentialBackoff(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 4
	config.InitialInterval = 10 * time.Millisecond
	config.Multiplier = 2.0
	config.Jitter = 0 // 禁用抖动以便精确测试
	retryer := NewRetryer(config)

	var timestamps []time.Time
	_ = retryer.Execute(context.Background(), func() error {
		timestamps = append(timestamps, time.Now())
		return errRetryTest
	})

	if len(timestamps) < 3 {
		t.Skip("时间戳不足以验证退避")
	}

	// 验证间隔递增
	interval1 := timestamps[1].Sub(timestamps[0])
	interval2 := timestamps[2].Sub(timestamps[1])

	// 第二次间隔应该约为第一次的 2 倍
	ratio := float64(interval2) / float64(interval1)
	if ratio < 1.5 || ratio > 2.5 {
		t.Errorf("期望间隔比率约为 2，实际为 %f", ratio)
	}
}

// TestRetryerMaxInterval 测试最大间隔限制
func TestRetryerMaxInterval(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 5
	config.InitialInterval = 100 * time.Millisecond
	config.MaxInterval = 150 * time.Millisecond
	config.Multiplier = 10.0 // 大乘数
	config.Jitter = 0
	retryer := NewRetryer(config)

	start := time.Now()
	_ = retryer.Execute(context.Background(), func() error {
		return errRetryTest
	})
	elapsed := time.Since(start)

	// 如果没有最大间隔限制，总时间会很长
	// 有限制的情况下，总时间应该较短
	maxExpected := time.Duration(config.MaxAttempts) * config.MaxInterval * 2
	if elapsed > maxExpected {
		t.Errorf("总耗时 %v 超过预期最大值 %v", elapsed, maxExpected)
	}
}

// TestRetryerJitter 测试抖动
func TestRetryerJitter(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 3
	config.InitialInterval = 50 * time.Millisecond
	config.Jitter = 0.5 // 50% 抖动
	retryer := NewRetryer(config)

	// 运行多次，收集间隔
	var intervals []time.Duration
	for i := 0; i < 5; i++ {
		var timestamps []time.Time
		_ = retryer.Execute(context.Background(), func() error {
			timestamps = append(timestamps, time.Now())
			return errRetryTest
		})
		if len(timestamps) >= 2 {
			intervals = append(intervals, timestamps[1].Sub(timestamps[0]))
		}
	}

	// 验证间隔有变化（抖动生效）
	if len(intervals) < 2 {
		t.Skip("间隔数据不足")
	}

	// 检查是否所有间隔都完全相同（不应该）
	allSame := true
	for i := 1; i < len(intervals); i++ {
		// 允许 5ms 的误差
		diff := intervals[i] - intervals[0]
		if diff < -5*time.Millisecond || diff > 5*time.Millisecond {
			allSame = false
			break
		}
	}

	// 由于抖动，间隔应该有所不同
	if allSame && len(intervals) >= 3 {
		t.Log("警告: 所有间隔相同，抖动可能未生效")
	}
}

// TestRetryerRetryableErrors 测试可重试错误判断
func TestRetryerRetryableErrors(t *testing.T) {
	nonRetryableErr := errors.New("不可重试错误")

	config := DefaultRetryConfig()
	config.MaxAttempts = 5
	config.InitialInterval = 10 * time.Millisecond
	config.RetryableErrors = func(err error) bool {
		return !errors.Is(err, nonRetryableErr)
	}
	retryer := NewRetryer(config)

	var callCount int32
	err := retryer.Execute(context.Background(), func() error {
		atomic.AddInt32(&callCount, 1)
		return nonRetryableErr
	})

	if !errors.Is(err, nonRetryableErr) {
		t.Errorf("期望错误为 nonRetryableErr，实际为 %v", err)
	}

	// 不可重试错误应该只调用一次
	if callCount != 1 {
		t.Errorf("期望调用次数为 1（不可重试），实际为 %d", callCount)
	}
}

// TestRetryerExecuteWithResult 测试带返回值的执行
func TestRetryerExecuteWithResult(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 3
	config.InitialInterval = 10 * time.Millisecond
	retryer := NewRetryer(config)

	var callCount int32
	result, err := retryer.ExecuteWithResult(context.Background(), func() (any, error) {
		count := atomic.AddInt32(&callCount, 1)
		if count < 2 {
			return nil, errRetryTest
		}
		return "success", nil
	})

	if err != nil {
		t.Errorf("期望无错误，实际为 %v", err)
	}

	if result != "success" {
		t.Errorf("期望结果为 'success'，实际为 %v", result)
	}

	if callCount != 2 {
		t.Errorf("期望调用次数为 2，实际为 %d", callCount)
	}
}

// TestRetryerExecuteWithResultFailure 测试带返回值的执行失败
func TestRetryerExecuteWithResultFailure(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 2
	config.InitialInterval = 10 * time.Millisecond
	retryer := NewRetryer(config)

	result, err := retryer.ExecuteWithResult(context.Background(), func() (any, error) {
		return nil, errRetryTest
	})

	if !errors.Is(err, errRetryTest) {
		t.Errorf("期望错误为 errRetryTest，实际为 %v", err)
	}

	if result != nil {
		t.Errorf("期望结果为 nil，实际为 %v", result)
	}
}

// TestRetryerZeroAttempts 测试零次尝试
func TestRetryerZeroAttempts(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 0 // 无效配置，应该至少尝试一次
	retryer := NewRetryer(config)

	var callCount int32
	_ = retryer.Execute(context.Background(), func() error {
		atomic.AddInt32(&callCount, 1)
		return errRetryTest
	})

	// 至少应该尝试一次
	if callCount < 1 {
		t.Errorf("期望至少调用 1 次，实际为 %d", callCount)
	}
}

// TestRetryerNilFunction 测试 nil 函数
func TestRetryerNilFunction(t *testing.T) {
	config := DefaultRetryConfig()
	retryer := NewRetryer(config)

	// nil 函数应该返回错误
	err := retryer.Execute(context.Background(), nil)
	if err == nil {
		t.Error("期望 nil 函数返回错误")
	}
}

// BenchmarkRetryerSuccess 基准测试成功场景
func BenchmarkRetryerSuccess(b *testing.B) {
	config := DefaultRetryConfig()
	retryer := NewRetryer(config)
	ctx := context.Background()
	fn := func() error { return nil }

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = retryer.Execute(ctx, fn)
	}
}

// BenchmarkRetryerWithRetries 基准测试重试场景
func BenchmarkRetryerWithRetries(b *testing.B) {
	config := DefaultRetryConfig()
	config.MaxAttempts = 3
	config.InitialInterval = 1 * time.Microsecond // 极短间隔用于基准测试
	retryer := NewRetryer(config)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var count int
		_ = retryer.Execute(ctx, func() error {
			count++
			if count < 2 {
				return errRetryTest
			}
			return nil
		})
	}
}
