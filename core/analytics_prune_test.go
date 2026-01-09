package core

import (
	"context"
	"testing"
	"time"
)

// TestAnalytics_Prune 测试数据清理功能。
func TestAnalytics_Prune(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:   true,
		Retention: 7, // 保留 7 天
	}

	analytics := NewAnalytics(nil, config)
	repo := newMockAnalyticsRepository()
	analytics.SetRepository(repo)

	ctx := context.Background()

	// 执行清理
	err := analytics.Prune(ctx)
	if err != nil {
		t.Fatalf("Prune failed: %v", err)
	}

	// 验证 DeleteBefore 被调用
	if !repo.deleteBeforeCalled {
		t.Error("Expected DeleteBefore to be called")
	}

	// 验证清理日期正确（7 天前）
	expectedDate := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	if repo.deleteBeforeDate != expectedDate {
		t.Errorf("Expected delete before date %s, got %s", expectedDate, repo.deleteBeforeDate)
	}
}

// TestAnalytics_Prune_Disabled 测试 Analytics 禁用时不执行清理。
func TestAnalytics_Prune_Disabled(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:   false,
		Retention: 7,
	}

	analytics := NewAnalytics(nil, config)
	repo := newMockAnalyticsRepository()
	analytics.SetRepository(repo)

	ctx := context.Background()

	err := analytics.Prune(ctx)
	if err != nil {
		t.Fatalf("Prune failed: %v", err)
	}

	// 禁用时不应调用 DeleteBefore
	if repo.deleteBeforeCalled {
		t.Error("Expected DeleteBefore NOT to be called when disabled")
	}
}

// TestAnalytics_Prune_NoRepository 测试无 Repository 时不报错。
func TestAnalytics_Prune_NoRepository(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:   true,
		Retention: 7,
	}

	analytics := NewAnalytics(nil, config)
	// 不设置 Repository

	ctx := context.Background()

	err := analytics.Prune(ctx)
	if err != nil {
		t.Fatalf("Prune without repository should not error, got: %v", err)
	}
}

// TestAnalytics_Prune_ZeroRetention 测试 Retention 为 0 时使用默认值。
func TestAnalytics_Prune_ZeroRetention(t *testing.T) {
	config := &AnalyticsConfig{
		Enabled:   true,
		Retention: 0, // 应使用默认值 90 天
	}

	analytics := NewAnalytics(nil, config)
	repo := newMockAnalyticsRepository()
	analytics.SetRepository(repo)

	ctx := context.Background()

	err := analytics.Prune(ctx)
	if err != nil {
		t.Fatalf("Prune failed: %v", err)
	}

	// 验证使用默认 90 天
	expectedDate := time.Now().AddDate(0, 0, -90).Format("2006-01-02")
	if repo.deleteBeforeDate != expectedDate {
		t.Errorf("Expected delete before date %s (90 days default), got %s", expectedDate, repo.deleteBeforeDate)
	}
}
