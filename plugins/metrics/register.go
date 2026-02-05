package metrics

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// metricsPlugin 插件实例
type metricsPlugin struct {
	app        core.App
	config     Config
	collector  *MetricsCollector
	repository *MetricsRepository
}

// MustRegister 注册 metrics 插件，失败时 panic
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 metrics 插件
func Register(app core.App, config Config) error {
	// 应用环境变量覆盖
	config = applyEnvOverrides(config)

	if config.Disabled {
		return nil
	}

	// 应用默认值
	config = applyDefaults(config)

	p := &metricsPlugin{
		app:    app,
		config: config,
	}

	return p.register()
}

// register 执行插件注册
func (p *metricsPlugin) register() error {
	// 1. OnBootstrap: 初始化 Repository 和 Collector
	p.app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		// 先执行核心 Bootstrap
		if err := e.Next(); err != nil {
			return err
		}

		// 创建 Repository（使用 AuxDB）
		p.repository = NewMetricsRepository(p.app)

		// 创建并启动 Collector
		p.collector = NewMetricsCollector(p.app, p.repository, p.config)
		p.collector.Start()

		// 存储到 app.Store() 供外部访问
		p.app.Store().Set(pluginStoreKey, p)

		p.app.Logger().Info("Metrics plugin initialized",
			"interval", p.config.CollectionInterval,
			"retention_days", p.config.RetentionDays,
		)

		return nil
	})

	// 2. OnServe: 注册路由和中间件
	p.app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// 注册路由
		p.bindRoutes(e)

		// 注册中间件
		if p.config.EnableMiddleware {
			e.Router.BindFunc(p.middlewareFunc())
		}

		return e.Next()
	})

	// 3. OnTerminate: 停止 Collector
	p.app.OnTerminate().Bind(&hook.Handler[*core.TerminateEvent]{
		Id: "__pbMetricsOnTerminate__",
		Func: func(e *core.TerminateEvent) error {
			if p.collector != nil {
				p.collector.Stop()
			}

			// 清理 Store
			p.app.Store().Remove(pluginStoreKey)

			return e.Next()
		},
		Priority: -998, // 在其他清理之前执行
	})

	// 4. 注册 Cron 清理任务
	p.app.Cron().Add("__pbMetricsCleanup__", p.config.CleanupCron, func() {
		if p.repository != nil {
			rowsDeleted, err := p.repository.CleanupOldMetrics(p.config.RetentionDays)
			if err != nil {
				p.app.Logger().Error("Failed to cleanup old metrics", "error", err)
			} else if rowsDeleted > 0 {
				p.app.Logger().Info("Cleaned up old metrics", "rowsDeleted", rowsDeleted)
			}
		}
	})

	return nil
}

// GetCollector 获取指定 App 的 MetricsCollector
// 如果插件未注册，返回 nil
func GetCollector(app core.App) *MetricsCollector {
	if p := getPlugin(app); p != nil {
		return p.collector
	}
	return nil
}

// GetRepository 获取指定 App 的 MetricsRepository
// 如果插件未注册，返回 nil
func GetRepository(app core.App) *MetricsRepository {
	if p := getPlugin(app); p != nil {
		return p.repository
	}
	return nil
}

// getPlugin 从 app.Store() 获取插件实例
func getPlugin(app core.App) *metricsPlugin {
	if v := app.Store().Get(pluginStoreKey); v != nil {
		if p, ok := v.(*metricsPlugin); ok {
			return p
		}
	}
	return nil
}
