package analytics

import (
	"context"
)

// noopAnalytics 是 Analytics 接口的 NoOp 实现
// 用于在插件未注册或禁用时提供零开销的空操作
type noopAnalytics struct {
	config *Config
}

// NewNoopAnalytics 创建一个 NoOp Analytics 实例
func NewNoopAnalytics() Analytics {
	return &noopAnalytics{
		config: &Config{
			Mode:    ModeOff,
			Enabled: false,
		},
	}
}

// Track 记录事件（NoOp 实现）
func (n *noopAnalytics) Track(event *Event) error {
	return nil
}

// Push 将事件推入缓冲区（NoOp 实现，Track 的别名）
func (n *noopAnalytics) Push(event *Event) error {
	return nil
}

// IsEnabled 返回 false（NoOp 始终禁用）
func (n *noopAnalytics) IsEnabled() bool {
	return false
}

// Start 启动服务（NoOp 实现）
func (n *noopAnalytics) Start(ctx context.Context) error {
	return nil
}

// Stop 停止服务（NoOp 实现）
func (n *noopAnalytics) Stop(ctx context.Context) error {
	return nil
}

// Flush 刷新缓冲区（NoOp 实现）
func (n *noopAnalytics) Flush() {
	// NoOp - 什么都不做
}

// Close 关闭服务（NoOp 实现）
func (n *noopAnalytics) Close() error {
	return nil
}

// Repository 返回存储实例（NoOp 返回 nil）
func (n *noopAnalytics) Repository() Repository {
	return nil
}

// Config 返回配置
func (n *noopAnalytics) Config() *Config {
	return n.config
}

// 确保实现了 Analytics 接口
var _ Analytics = (*noopAnalytics)(nil)
