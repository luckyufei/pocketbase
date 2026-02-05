package analytics

import (
	"context"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// analyticsRegistry 存储每个 App 实例的 Analytics
var (
	analyticsRegistry = make(map[core.App]Analytics)
	analyticsMu       sync.RWMutex
)

// cronJobID 是 analytics 清理任务的 Cron ID
const cronJobID = "__pbAnalyticsPrune__"

// MustRegister 注册 analytics 插件，失败时 panic
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 analytics 插件
func Register(app core.App, config Config) error {
	// 应用环境变量覆盖
	config = applyEnvOverrides(config)

	// 应用默认值
	config = applyDefaults(config)

	var analytics Analytics

	// 如果模式为 Off 或未启用，注册 NoopAnalytics
	if config.Mode == ModeOff || !config.Enabled {
		analytics = NewNoopAnalytics()
	} else {
		// 创建真实的 Analytics 实例
		analytics = newAnalyticsImpl(app, &config)

		// 注册数据清理 Cron 任务
		registerPruneCronJob(app, &config)
	}

	// 注册到全局 registry
	analyticsMu.Lock()
	analyticsRegistry[app] = analytics
	analyticsMu.Unlock()

	// 注册 API 路由
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// 绑定 analytics API 路由
		BindRoutes(app, e.Router.Group("/api"))
		return e.Next()
	})

	// 注册清理钩子
	app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		analyticsMu.Lock()
		if a, ok := analyticsRegistry[app]; ok {
			_ = a.Close()
			delete(analyticsRegistry, app)
		}
		analyticsMu.Unlock()
		return e.Next()
	})

	return nil
}

// registerPruneCronJob 注册数据清理 Cron 任务
func registerPruneCronJob(app core.App, config *Config) {
	// 每天凌晨 3 点执行清理
	app.Cron().Add(cronJobID, "0 3 * * *", func() {
		// 计算截止日期
		cutoffDate := time.Now().AddDate(0, 0, -config.Retention)
		dateStr := cutoffDate.Format("2006-01-02")

		// 获取 repository 并执行清理
		analytics := GetAnalytics(app)
		if analytics == nil || !analytics.IsEnabled() {
			return
		}

		repo := analytics.Repository()
		if repo == nil {
			// Repository 尚未实现（Phase 2），静默跳过
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		if err := repo.DeleteBefore(ctx, dateStr); err != nil {
			app.Logger().Warn("Analytics prune failed",
				"error", err,
				"cutoff_date", dateStr,
			)
		} else {
			app.Logger().Info("Analytics prune completed",
				"cutoff_date", dateStr,
				"retention_days", config.Retention,
			)
		}
	})
}

// GetAnalytics 获取指定 App 的 Analytics 实例
// 如果未注册，返回 NoopAnalytics
func GetAnalytics(app core.App) Analytics {
	analyticsMu.RLock()
	defer analyticsMu.RUnlock()
	if a, ok := analyticsRegistry[app]; ok {
		return a
	}
	return NewNoopAnalytics()
}

// analyticsImpl 是 Analytics 接口的实际实现
type analyticsImpl struct {
	app    core.App
	config *Config

	mu      sync.RWMutex
	running bool
}

// newAnalyticsImpl 创建 Analytics 实现
func newAnalyticsImpl(app core.App, config *Config) *analyticsImpl {
	return &analyticsImpl{
		app:    app,
		config: config,
	}
}

func (a *analyticsImpl) Track(event *Event) error {
	if !a.IsEnabled() {
		return ErrDisabled
	}
	// TODO: 实现完整的 Track 逻辑
	return nil
}

func (a *analyticsImpl) Push(event *Event) error {
	return a.Track(event)
}

func (a *analyticsImpl) IsEnabled() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config != nil && a.config.Enabled && a.config.Mode != ModeOff
}

func (a *analyticsImpl) Start(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.running = true
	return nil
}

func (a *analyticsImpl) Stop(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.running = false
	return nil
}

func (a *analyticsImpl) Flush() {
	// TODO: 实现完整的 Flush 逻辑（Phase 2）
}

func (a *analyticsImpl) Close() error {
	return a.Stop(context.Background())
}

func (a *analyticsImpl) Repository() Repository {
	// TODO: 返回 repository（Phase 2）
	return nil
}

func (a *analyticsImpl) Config() *Config {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config
}

// 确保实现了 Analytics 接口
var _ Analytics = (*analyticsImpl)(nil)
