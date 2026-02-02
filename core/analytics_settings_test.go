package core_test

import (
	"encoding/json"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestAnalyticsSettingsConfigDefaults 测试 AnalyticsSettingsConfig 默认值
func TestAnalyticsSettingsConfigDefaults(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		settings := app.Settings()

		// 验证默认值
		if !settings.Analytics.Enabled {
			t.Error("Expected Analytics.Enabled to be true by default")
		}

		if settings.Analytics.Retention != 90 {
			t.Errorf("Expected Analytics.Retention to be 90, got %d", settings.Analytics.Retention)
		}

		if settings.Analytics.S3Bucket != "" {
			t.Errorf("Expected Analytics.S3Bucket to be empty by default, got %q", settings.Analytics.S3Bucket)
		}
	})
}

// TestAnalyticsSettingsConfigValidation 测试 AnalyticsSettingsConfig 验证
func TestAnalyticsSettingsConfigValidation(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name        string
		config      core.AnalyticsSettingsConfig
		expectError bool
	}{
		{
			name: "valid default config",
			config: core.AnalyticsSettingsConfig{
				Enabled:   true,
				Retention: 90,
			},
			expectError: false,
		},
		{
			name: "valid disabled config",
			config: core.AnalyticsSettingsConfig{
				Enabled:   false,
				Retention: 0,
			},
			expectError: false,
		},
		{
			name: "valid with S3 bucket",
			config: core.AnalyticsSettingsConfig{
				Enabled:   true,
				Retention: 30,
				S3Bucket:  "my-analytics-bucket",
			},
			expectError: false,
		},
		{
			name: "invalid negative retention when enabled",
			config: core.AnalyticsSettingsConfig{
				Enabled:   true,
				Retention: -1,
			},
			expectError: true,
		},
		{
			name: "invalid zero retention when enabled",
			config: core.AnalyticsSettingsConfig{
				Enabled:   true,
				Retention: 0,
			},
			expectError: true,
		},
		{
			name: "valid minimum retention",
			config: core.AnalyticsSettingsConfig{
				Enabled:   true,
				Retention: 1,
			},
			expectError: false,
		},
		{
			name: "valid disabled with negative retention",
			config: core.AnalyticsSettingsConfig{
				Enabled:   false,
				Retention: -1,
			},
			expectError: true, // 即使禁用，负数也不允许
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.config.Validate()
			if tc.expectError && err == nil {
				t.Error("Expected validation error but got nil")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Expected no validation error but got: %v", err)
			}
		})
	}
}

// TestAnalyticsSettingsConfigJSON 测试 AnalyticsSettingsConfig JSON 序列化
func TestAnalyticsSettingsConfigJSON(t *testing.T) {
	t.Parallel()

	config := core.AnalyticsSettingsConfig{
		Enabled:   true,
		Retention: 60,
		S3Bucket:  "test-bucket",
	}

	// 序列化
	data, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}

	// 反序列化
	var decoded core.AnalyticsSettingsConfig
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal config: %v", err)
	}

	// 验证
	if decoded.Enabled != config.Enabled {
		t.Errorf("Enabled mismatch: expected %v, got %v", config.Enabled, decoded.Enabled)
	}
	if decoded.Retention != config.Retention {
		t.Errorf("Retention mismatch: expected %d, got %d", config.Retention, decoded.Retention)
	}
	if decoded.S3Bucket != config.S3Bucket {
		t.Errorf("S3Bucket mismatch: expected %q, got %q", config.S3Bucket, decoded.S3Bucket)
	}
}

// TestSettingsIncludesAnalytics 测试 Settings 结构体包含 Analytics 字段
func TestSettingsIncludesAnalytics(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		settings := app.Settings()

		// 验证默认 Analytics 设置
		if !settings.Analytics.Enabled {
			t.Error("Expected Analytics.Enabled to be true by default")
		}

		if settings.Analytics.Retention != 90 {
			t.Errorf("Expected Analytics.Retention to be 90, got %d", settings.Analytics.Retention)
		}
	})
}
