package reliability

import (
	"context"
	"errors"
	"math"
	"math/rand"
	"time"
)

// ErrNilFunction 空函数错误
var ErrNilFunction = errors.New("执行函数不能为 nil")

// retryer 重试器实现
type retryer struct {
	config RetryConfig
}

// NewRetryer 创建新的重试器
func NewRetryer(config RetryConfig) Retryer {
	// 确保至少尝试一次
	if config.MaxAttempts < 1 {
		config.MaxAttempts = 1
	}
	return &retryer{config: config}
}

// Execute 执行函数，失败时按配置重试
func (r *retryer) Execute(ctx context.Context, fn func() error) error {
	if fn == nil {
		return ErrNilFunction
	}

	var lastErr error

	for attempt := 0; attempt < r.config.MaxAttempts; attempt++ {
		// 检查上下文是否已取消
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// 执行函数
		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// 检查是否为可重试错误
		if r.config.RetryableErrors != nil && !r.config.RetryableErrors(err) {
			return err
		}

		// 如果还有重试机会，等待后重试
		if attempt < r.config.MaxAttempts-1 {
			interval := r.calculateInterval(attempt)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(interval):
				// 继续重试
			}
		}
	}

	return lastErr
}

// ExecuteWithResult 执行带返回值的函数
func (r *retryer) ExecuteWithResult(ctx context.Context, fn func() (any, error)) (any, error) {
	if fn == nil {
		return nil, ErrNilFunction
	}

	var lastErr error
	var result any

	for attempt := 0; attempt < r.config.MaxAttempts; attempt++ {
		// 检查上下文是否已取消
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		// 执行函数
		res, err := fn()
		if err == nil {
			return res, nil
		}

		lastErr = err
		result = res

		// 检查是否为可重试错误
		if r.config.RetryableErrors != nil && !r.config.RetryableErrors(err) {
			return result, err
		}

		// 如果还有重试机会，等待后重试
		if attempt < r.config.MaxAttempts-1 {
			interval := r.calculateInterval(attempt)

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(interval):
				// 继续重试
			}
		}
	}

	return result, lastErr
}

// calculateInterval 计算重试间隔（指数退避 + 抖动）
func (r *retryer) calculateInterval(attempt int) time.Duration {
	// 指数退避: interval = initialInterval * (multiplier ^ attempt)
	interval := float64(r.config.InitialInterval) * math.Pow(r.config.Multiplier, float64(attempt))

	// 应用最大间隔限制
	if interval > float64(r.config.MaxInterval) {
		interval = float64(r.config.MaxInterval)
	}

	// 应用抖动
	if r.config.Jitter > 0 {
		// 抖动范围: [interval * (1 - jitter), interval * (1 + jitter)]
		jitterRange := interval * r.config.Jitter
		interval = interval - jitterRange + (rand.Float64() * 2 * jitterRange)
	}

	// 确保间隔不为负
	if interval < 0 {
		interval = 0
	}

	return time.Duration(interval)
}
