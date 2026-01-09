package core

import "errors"

// Analytics 相关错误定义
var (
	// ErrAnalyticsDisabled 表示分析功能已禁用
	ErrAnalyticsDisabled = errors.New("analytics is disabled")

	// ErrAnalyticsEventRequired 表示事件名称为必填
	ErrAnalyticsEventRequired = errors.New("event name is required")

	// ErrAnalyticsPathRequired 表示页面路径为必填
	ErrAnalyticsPathRequired = errors.New("path is required")

	// ErrAnalyticsSessionRequired 表示会话 ID 为必填
	ErrAnalyticsSessionRequired = errors.New("session id is required")

	// ErrAnalyticsS3NotConfigured 表示 S3 未配置（PostgreSQL 模式）
	ErrAnalyticsS3NotConfigured = errors.New("S3 bucket not configured for analytics")
)
