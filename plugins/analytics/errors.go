package analytics

import "errors"

// Analytics 相关错误定义
var (
	// ErrDisabled 表示分析功能已禁用
	ErrDisabled = errors.New("analytics is disabled")

	// ErrEventRequired 表示事件名称为必填
	ErrEventRequired = errors.New("event name is required")

	// ErrPathRequired 表示页面路径为必填
	ErrPathRequired = errors.New("path is required")

	// ErrSessionRequired 表示会话 ID 为必填
	ErrSessionRequired = errors.New("session id is required")

	// ErrS3NotConfigured 表示 S3 未配置（PostgreSQL 模式）
	ErrS3NotConfigured = errors.New("S3 bucket not configured for analytics")
)
