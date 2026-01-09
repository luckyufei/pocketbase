package core

import (
	"context"
	"sync"
	"time"
)

// AnalyticsConfig 定义分析功能的配置。
type AnalyticsConfig struct {
	// Enabled 是否启用分析功能（默认 true）
	Enabled bool `json:"enabled"`

	// Retention 数据保留天数（默认 90 天）
	Retention int `json:"retention"`

	// S3Bucket S3 存储桶名称（PostgreSQL 模式必填）
	S3Bucket string `json:"s3Bucket,omitempty"`

	// S3Endpoint S3 端点（可选，用于兼容 S3 服务）
	S3Endpoint string `json:"s3Endpoint,omitempty"`

	// S3Region S3 区域
	S3Region string `json:"s3Region,omitempty"`

	// S3AccessKey S3 访问密钥
	S3AccessKey string `json:"s3AccessKey,omitempty"`

	// S3SecretKey S3 密钥
	S3SecretKey string `json:"s3SecretKey,omitempty"`

	// FlushInterval 聚合数据刷新间隔（秒，默认 10）
	FlushInterval int `json:"flushInterval"`

	// RawBufferSize 原始日志缓冲区大小（字节，默认 16MB）
	RawBufferSize int `json:"rawBufferSize"`
}

// DefaultAnalyticsConfig 返回默认配置。
func DefaultAnalyticsConfig() *AnalyticsConfig {
	return &AnalyticsConfig{
		Enabled:       true,
		Retention:     90,
		FlushInterval: 10,
		RawBufferSize: 16 * 1024 * 1024, // 16MB
	}
}

// Analytics 是分析功能的主入口结构体。
// 它管理事件采集、聚合和存储的完整生命周期。
type Analytics struct {
	app    App
	config *AnalyticsConfig

	buffer     *AnalyticsBuffer
	flusher    *AnalyticsFlusher
	repository AnalyticsRepository

	mu      sync.RWMutex
	running bool
}

// NewAnalytics 创建一个新的 Analytics 实例。
func NewAnalytics(app App, config *AnalyticsConfig) *Analytics {
	if config == nil {
		config = DefaultAnalyticsConfig()
	}

	return &Analytics{
		app:    app,
		config: config,
	}
}

// Config 返回当前配置。
func (a *Analytics) Config() *AnalyticsConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config
}

// IsEnabled 返回分析功能是否启用。
func (a *Analytics) IsEnabled() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config != nil && a.config.Enabled
}

// Start 启动分析服务（缓冲区、定时刷新等）。
func (a *Analytics) Start(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.config.Enabled {
		return ErrAnalyticsDisabled
	}

	if a.running {
		return nil
	}

	// 初始化缓冲区
	a.buffer = NewAnalyticsBuffer(a.config.RawBufferSize)

	// 初始化 Flusher（后续 Phase 实现）
	// a.flusher = NewAnalyticsFlusher(a.app, a.buffer, a.repository, a.config)
	// a.flusher.Start(ctx)

	a.running = true
	return nil
}

// Stop 停止分析服务，刷新所有缓冲区。
func (a *Analytics) Stop(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.running {
		return nil
	}

	// 停止 Flusher 并刷新缓冲区
	if a.flusher != nil {
		if err := a.flusher.Stop(ctx); err != nil {
			return err
		}
	}

	a.running = false
	return nil
}

// Push 将事件推入缓冲区。
func (a *Analytics) Push(event *AnalyticsEvent) error {
	if !a.IsEnabled() {
		return ErrAnalyticsDisabled
	}

	a.mu.RLock()
	buffer := a.buffer
	a.mu.RUnlock()

	if buffer == nil {
		return ErrAnalyticsDisabled
	}

	return buffer.Push(event)
}

// Repository 返回当前的存储实例。
func (a *Analytics) Repository() AnalyticsRepository {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.repository
}

// SetRepository 设置存储实例。
func (a *Analytics) SetRepository(repo AnalyticsRepository) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.repository = repo
}

// Prune 清理过期的分析数据。
// 根据 Retention 配置删除指定天数之前的数据。
func (a *Analytics) Prune(ctx context.Context) error {
	if !a.IsEnabled() {
		return nil
	}

	a.mu.RLock()
	repo := a.repository
	retention := a.config.Retention
	a.mu.RUnlock()

	if repo == nil {
		return nil
	}

	// 使用默认值 90 天
	if retention <= 0 {
		retention = 90
	}

	// 计算清理日期
	cutoffDate := time.Now().AddDate(0, 0, -retention).Format("2006-01-02")

	return repo.DeleteBefore(ctx, cutoffDate)
}
