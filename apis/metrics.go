package apis

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/spf13/cast"
)

const (
	// metricsDBStoreKey 在 app.Store() 中存储 MetricsDB 的键
	metricsDBStoreKey = "__pbMetricsDB__"

	// metricsCollectorStoreKey 在 app.Store() 中存储 MetricsCollector 的键
	metricsCollectorStoreKey = "__pbMetricsCollector__"
)

// bindMetricsApi 注册监控 API 路由
func bindMetricsApi(app core.App, rg *router.RouterGroup[*core.RequestEvent]) {
	subGroup := rg.Group("/system")

	// 仅管理员可访问
	subGroup.Bind(RequireSuperuserAuth())

	// GET /api/system/metrics - 获取历史监控数据
	subGroup.GET("/metrics", func(e *core.RequestEvent) error {
		metricsDB := getMetricsDB(e.App)
		if metricsDB == nil {
			return e.JSON(http.StatusServiceUnavailable, map[string]any{
				"message": "Metrics service is not available",
			})
		}

		// 解析查询参数
		hours := cast.ToInt(e.Request.URL.Query().Get("hours"))
		if hours <= 0 {
			hours = 24
		}
		if hours > 168 { // 最多 7 天
			hours = 168
		}

		limit := cast.ToInt(e.Request.URL.Query().Get("limit"))
		if limit <= 0 {
			limit = 1000
		}
		if limit > 10000 {
			limit = 10000
		}

		// 查询数据
		items, totalItems, err := metricsDB.GetByTimeRange(hours, limit)
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"message": "Failed to query metrics",
				"error":   err.Error(),
			})
		}

		return e.JSON(http.StatusOK, &core.SystemMetricsResponse{
			Items:      items,
			TotalItems: totalItems,
		})
	})

	// GET /api/system/metrics/current - 获取当前系统状态
	subGroup.GET("/metrics/current", func(e *core.RequestEvent) error {
		metricsDB := getMetricsDB(e.App)
		if metricsDB == nil {
			return e.JSON(http.StatusServiceUnavailable, map[string]any{
				"message": "Metrics service is not available",
			})
		}

		metrics, err := metricsDB.GetLatest()
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"message": "Failed to query current metrics",
				"error":   err.Error(),
			})
		}

		if metrics == nil {
			return e.JSON(http.StatusNotFound, map[string]any{
				"message": "No metrics data available yet",
			})
		}

		return e.JSON(http.StatusOK, metrics)
	})
}

// InitMetricsService 初始化监控服务
// 应在 app.OnServe() 中调用
func InitMetricsService(app core.App) error {
	// 创建 MetricsDB
	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		app.Logger().Error("Failed to initialize metrics database", slog.String("error", err.Error()))
		return err
	}

	// 存储到 app.Store()
	app.Store().Set(metricsDBStoreKey, metricsDB)

	// 创建并启动 MetricsCollector
	collector := core.NewMetricsCollector(app, metricsDB)
	app.Store().Set(metricsCollectorStoreKey, collector)
	collector.Start()

	// 注册清理任务（每天 03:00 执行）
	app.Cron().Add("__pbMetricsCleanup__", "0 3 * * *", func() {
		rowsDeleted, err := metricsDB.CleanupOldMetrics()
		if err != nil {
			app.Logger().Error("Failed to cleanup old metrics", slog.String("error", err.Error()))
		} else if rowsDeleted > 0 {
			app.Logger().Info("Cleaned up old metrics", slog.Int64("rowsDeleted", rowsDeleted))
		}
	})

	// 注册终止钩子
	app.OnTerminate().Bind(&hook.Handler[*core.TerminateEvent]{
		Id: "__pbMetricsOnTerminate__",
		Func: func(e *core.TerminateEvent) error {
			// 停止采集器
			if c := getMetricsCollector(e.App); c != nil {
				c.Stop()
			}

			// 关闭数据库
			if db := getMetricsDB(e.App); db != nil {
				db.Close()
			}

			return e.Next()
		},
		Priority: -998,
	})

	app.Logger().Info("Metrics service initialized")
	return nil
}

// getMetricsDB 从 app.Store() 获取 MetricsDB
func getMetricsDB(app core.App) *core.MetricsDB {
	if v := app.Store().Get(metricsDBStoreKey); v != nil {
		if db, ok := v.(*core.MetricsDB); ok {
			return db
		}
	}
	return nil
}

// getMetricsCollector 从 app.Store() 获取 MetricsCollector
func getMetricsCollector(app core.App) *core.MetricsCollector {
	if v := app.Store().Get(metricsCollectorStoreKey); v != nil {
		if c, ok := v.(*core.MetricsCollector); ok {
			return c
		}
	}
	return nil
}

// GetMetricsCollector 公开方法，用于中间件注入延迟数据
func GetMetricsCollector(app core.App) *core.MetricsCollector {
	return getMetricsCollector(app)
}

// MetricsMiddleware 创建用于记录请求延迟和错误的中间件
func MetricsMiddleware() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		collector := getMetricsCollector(e.App)
		if collector == nil {
			return e.Next()
		}

		start := time.Now()
		err := e.Next()

		// 记录延迟
		latencyMs := float64(time.Since(start).Microseconds()) / 1000.0
		collector.RecordLatency(latencyMs)

		// 通过 ApiError 判断状态码，只记录真正的 5xx 错误
		if err != nil {
			if apiErr, ok := err.(*router.ApiError); ok && apiErr.Status >= 500 {
				collector.RecordError(apiErr.Status)
			}
		}

		return err
	}
}
