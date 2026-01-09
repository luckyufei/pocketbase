package core

import (
	"context"
	"time"
)

// Analytics returns the app Analytics instance.
func (app *BaseApp) Analytics() *Analytics {
	return app.analytics
}

// initAnalytics 初始化 Analytics 实例。
func (app *BaseApp) initAnalytics() error {
	// 创建默认配置
	config := DefaultAnalyticsConfig()

	// TODO: 从 Settings 加载配置
	// if app.settings != nil && app.settings.Analytics != nil {
	//     config = app.settings.Analytics
	// }

	app.analytics = NewAnalytics(app, config)

	// 根据数据库类型初始化 Repository
	var repo AnalyticsRepository
	if app.IsPostgres() {
		// PostgreSQL 模式：使用主数据库
		if app.concurrentDB != nil {
			repo = NewAnalyticsRepositoryPostgres(app.DB())
		}
	} else {
		// SQLite 模式：使用辅助数据库
		if app.auxConcurrentDB != nil {
			repo = NewAnalyticsRepositorySQLite(app.AuxDB())
		}
	}

	if repo != nil {
		app.analytics.SetRepository(repo)
	}

	return nil
}

// startAnalytics 启动 Analytics 服务。
func (app *BaseApp) startAnalytics() error {
	if app.analytics == nil {
		return nil
	}

	if !app.analytics.IsEnabled() {
		return nil
	}

	return app.analytics.Start(context.Background())
}

// stopAnalytics 停止 Analytics 服务。
func (app *BaseApp) stopAnalytics() error {
	if app.analytics == nil {
		return nil
	}

	return app.analytics.Stop(context.Background())
}

// registerAnalyticsPruneJob 注册 Analytics 数据清理定时任务。
func (app *BaseApp) registerAnalyticsPruneJob() {
	if app.analytics == nil || !app.analytics.IsEnabled() {
		return
	}

	config := app.analytics.Config()
	if config.Retention <= 0 {
		return
	}

	// 每天凌晨 3 点执行清理
	app.Cron().Add("__analytics_prune__", "0 3 * * *", func() {
		if app.analytics == nil {
			return
		}

		repo := app.analytics.Repository()
		if repo == nil {
			return
		}

		// 计算过期日期
		retentionDays := config.Retention
		cutoffDate := time.Now().AddDate(0, 0, -retentionDays).Format("2006-01-02")

		// 执行清理
		if err := repo.DeleteBefore(context.Background(), cutoffDate); err != nil {
			app.Logger().Error("Failed to prune analytics data", "error", err)
		} else {
			app.Logger().Info("Analytics data pruned", "cutoffDate", cutoffDate)
		}
	})
}
