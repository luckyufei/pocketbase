package analytics

import (
	"context"
)

// Analytics 定义分析功能的主接口
type Analytics interface {
	// Track 记录一个分析事件
	Track(event *Event) error

	// Push 将事件推入缓冲区（Track 的别名，保持 API 兼容性）
	Push(event *Event) error

	// IsEnabled 返回分析功能是否启用
	IsEnabled() bool

	// Start 启动分析服务
	Start(ctx context.Context) error

	// Stop 停止分析服务
	Stop(ctx context.Context) error

	// Flush 立即刷新所有缓冲区
	Flush()

	// Close 关闭分析服务并释放资源
	Close() error

	// Repository 返回当前的存储实例
	Repository() Repository

	// Config 返回当前配置
	Config() *Config
}
