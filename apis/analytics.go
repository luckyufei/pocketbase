package apis

import (
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindAnalyticsApi 注册分析 API 路由。
func bindAnalyticsApi(app core.App, rg *router.RouterGroup[*core.RequestEvent]) {
	subGroup := rg.Group("/analytics")

	// 公开端点：接收事件（无需认证）
	// 使用日志中间件包装，但不记录敏感数据
	subGroup.POST("/events", analyticsEventsHandler(app)).Bind(analyticsRequestLogger(app, "events"))

	// 管理员端点：查询统计数据
	subGroup.GET("/stats", analyticsStatsHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "stats"))
	subGroup.GET("/top-pages", analyticsTopPagesHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "top-pages"))
	subGroup.GET("/top-sources", analyticsTopSourcesHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "top-sources"))
	subGroup.GET("/devices", analyticsDevicesHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "devices"))
	subGroup.GET("/raw-logs", analyticsRawLogsHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "raw-logs"))
	subGroup.GET("/raw-logs/{date}", analyticsRawLogDownloadHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "raw-log-download"))
	subGroup.GET("/config", analyticsConfigHandler(app)).Bind(RequireSuperuserAuth(), analyticsRequestLogger(app, "config"))
}

// analyticsRequestLogger 返回一个请求日志中间件。
// 记录请求信息但不打印敏感数据（如 IP 地址、完整 User-Agent、请求体内容）。
func analyticsRequestLogger(app core.App, endpoint string) *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id: "pbAnalyticsRequestLogger_" + endpoint,
		Func: func(e *core.RequestEvent) error {
			start := time.Now()

			// 继续处理请求
			err := e.Next()

			// 计算请求耗时
			duration := time.Since(start)

			// 获取状态码
			status := e.Status()

			// 构建日志字段（不包含敏感数据）
			logFields := []any{
				"endpoint", endpoint,
				"method", e.Request.Method,
				"path", e.Request.URL.Path,
				"status", status,
				"duration_ms", duration.Milliseconds(),
			}

			// 添加查询参数（仅记录参数名，不记录值，避免泄露敏感信息）
			if queryParams := e.Request.URL.Query(); len(queryParams) > 0 {
				paramNames := make([]string, 0, len(queryParams))
				for name := range queryParams {
					paramNames = append(paramNames, name)
				}
				logFields = append(logFields, "query_params", paramNames)
			}

			// 对于事件端点，记录事件数量（不记录具体内容）
			if endpoint == "events" {
				if eventsCount := e.Get("analytics_events_count"); eventsCount != nil {
					logFields = append(logFields, "events_count", eventsCount)
				}
				if acceptedCount := e.Get("analytics_accepted_count"); acceptedCount != nil {
					logFields = append(logFields, "accepted_count", acceptedCount)
				}
			}

			// 根据状态码选择日志级别
			if status >= 500 {
				app.Logger().Error("[Analytics API] Request failed", logFields...)
			} else if status >= 400 {
				app.Logger().Warn("[Analytics API] Request error", logFields...)
			} else {
				app.Logger().Debug("[Analytics API] Request completed", logFields...)
			}

			return err
		},
	}
}
