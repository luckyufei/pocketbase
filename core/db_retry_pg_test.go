package core

import (
	"errors"
	"testing"
)

// TestIsRetryableError 测试可重试错误检测
func TestIsRetryableError(t *testing.T) {
	testCases := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		// SQLite 错误
		{"SQLite database locked", "database is locked", true},
		{"SQLite table locked", "table is locked", true},

		// PostgreSQL 死锁
		{"PostgreSQL deadlock 40P01", "ERROR: deadlock detected (SQLSTATE 40P01)", true},
		{"PostgreSQL deadlock text", "deadlock detected", true},

		// PostgreSQL 序列化失败
		{"PostgreSQL serialization 40001", "ERROR: could not serialize access (SQLSTATE 40001)", true},
		{"PostgreSQL serialization text", "could not serialize access", true},

		// PostgreSQL 锁等待超时
		{"PostgreSQL lock timeout 55P03", "ERROR: lock timeout (SQLSTATE 55P03)", true},
		{"PostgreSQL lock timeout text", "lock timeout", true},
		{"PostgreSQL lock not available", "lock not available", true},

		// PostgreSQL 连接问题 (可能需要重试)
		{"PostgreSQL connection reset", "connection reset by peer", true},
		{"PostgreSQL connection closed", "connection is closed", true},

		// 不可重试的错误
		{"unique violation", "ERROR: duplicate key value violates unique constraint (SQLSTATE 23505)", false},
		{"foreign key violation", "ERROR: violates foreign key constraint (SQLSTATE 23503)", false},
		{"syntax error", "ERROR: syntax error at or near (SQLSTATE 42601)", false},
		{"generic error", "some random error", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := IsRetryableError(err)
			if result != tc.expected {
				t.Errorf("IsRetryableError(%q) = %v, expected %v", tc.errMsg, result, tc.expected)
			}
		})
	}

	t.Run("nil error", func(t *testing.T) {
		if IsRetryableError(nil) {
			t.Error("IsRetryableError(nil) should return false")
		}
	})
}

// TestIsDeadlockError 测试死锁错误检测
func TestIsDeadlockError(t *testing.T) {
	testCases := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"PostgreSQL deadlock 40P01", "ERROR: deadlock detected (SQLSTATE 40P01)", true},
		{"PostgreSQL deadlock text", "deadlock detected", true},
		{"Not deadlock", "some other error", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := IsDeadlockError(err)
			if result != tc.expected {
				t.Errorf("IsDeadlockError(%q) = %v, expected %v", tc.errMsg, result, tc.expected)
			}
		})
	}
}

// TestIsSerializationError 测试序列化失败错误检测
func TestIsSerializationError(t *testing.T) {
	testCases := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"PostgreSQL serialization 40001", "ERROR: could not serialize access (SQLSTATE 40001)", true},
		{"PostgreSQL serialization text", "could not serialize access", true},
		{"Not serialization", "some other error", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := IsSerializationError(err)
			if result != tc.expected {
				t.Errorf("IsSerializationError(%q) = %v, expected %v", tc.errMsg, result, tc.expected)
			}
		})
	}
}

// TestRetryConfig 测试重试配置
func TestRetryConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		cfg := DefaultRetryConfig()
		if cfg.MaxRetries != defaultMaxLockRetries {
			t.Errorf("expected MaxRetries=%d, got %d", defaultMaxLockRetries, cfg.MaxRetries)
		}
		if cfg.InitialBackoff <= 0 {
			t.Error("InitialBackoff should be positive")
		}
		if cfg.MaxBackoff <= 0 {
			t.Error("MaxBackoff should be positive")
		}
		if cfg.BackoffMultiplier <= 0 {
			t.Error("BackoffMultiplier should be positive")
		}
	})

	t.Run("计算退避时间", func(t *testing.T) {
		cfg := DefaultRetryConfig()

		// 第一次重试
		backoff1 := cfg.GetBackoff(1)
		if backoff1 != cfg.InitialBackoff {
			t.Errorf("first backoff should be InitialBackoff, got %v", backoff1)
		}

		// 后续重试应该增加
		backoff2 := cfg.GetBackoff(2)
		if backoff2 <= backoff1 {
			t.Error("backoff should increase with attempts")
		}

		// 不应超过最大值
		backoffMax := cfg.GetBackoff(100)
		if backoffMax > cfg.MaxBackoff {
			t.Errorf("backoff should not exceed MaxBackoff, got %v", backoffMax)
		}
	})
}

// TestRetryWithBackoff 测试带退避的重试
func TestRetryWithBackoff(t *testing.T) {
	t.Run("成功不重试", func(t *testing.T) {
		attempts := 0
		err := RetryWithBackoff(DefaultRetryConfig(), func(attempt int) error {
			attempts++
			return nil
		})
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if attempts != 1 {
			t.Errorf("expected 1 attempt, got %d", attempts)
		}
	})

	t.Run("不可重试错误立即返回", func(t *testing.T) {
		attempts := 0
		expectedErr := errors.New("unique constraint violation")
		err := RetryWithBackoff(DefaultRetryConfig(), func(attempt int) error {
			attempts++
			return expectedErr
		})
		if err != expectedErr {
			t.Errorf("expected %v, got %v", expectedErr, err)
		}
		if attempts != 1 {
			t.Errorf("expected 1 attempt, got %d", attempts)
		}
	})

	t.Run("可重试错误重试后成功", func(t *testing.T) {
		attempts := 0
		err := RetryWithBackoff(&RetryConfig{
			MaxRetries:        3,
			InitialBackoff:    1, // 1ms for fast test
			MaxBackoff:        10,
			BackoffMultiplier: 2,
		}, func(attempt int) error {
			attempts++
			if attempts < 3 {
				return errors.New("deadlock detected")
			}
			return nil
		})
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if attempts != 3 {
			t.Errorf("expected 3 attempts, got %d", attempts)
		}
	})

	t.Run("超过最大重试次数", func(t *testing.T) {
		attempts := 0
		cfg := &RetryConfig{
			MaxRetries:        3,
			InitialBackoff:    1,
			MaxBackoff:        10,
			BackoffMultiplier: 2,
		}
		err := RetryWithBackoff(cfg, func(attempt int) error {
			attempts++
			return errors.New("deadlock detected")
		})
		if err == nil {
			t.Error("expected error after max retries")
		}
		if attempts != cfg.MaxRetries+1 {
			t.Errorf("expected %d attempts, got %d", cfg.MaxRetries+1, attempts)
		}
	})
}
