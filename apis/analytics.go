package apis

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindAnalyticsApi 注册分析 API 路由。
func bindAnalyticsApi(app core.App, rg *router.RouterGroup[*core.RequestEvent]) {
	subGroup := rg.Group("/analytics")

	// 公开端点：接收事件（无需认证）
	subGroup.POST("/events", analyticsEventsHandler(app))

	// 管理员端点：查询统计数据
	subGroup.GET("/stats", analyticsStatsHandler(app)).Bind(RequireSuperuserAuth())
	subGroup.GET("/top-pages", analyticsTopPagesHandler(app)).Bind(RequireSuperuserAuth())
	subGroup.GET("/top-sources", analyticsTopSourcesHandler(app)).Bind(RequireSuperuserAuth())
	subGroup.GET("/devices", analyticsDevicesHandler(app)).Bind(RequireSuperuserAuth())
	subGroup.GET("/raw-logs", analyticsRawLogsHandler(app)).Bind(RequireSuperuserAuth())
	subGroup.GET("/raw-logs/{date}", analyticsRawLogDownloadHandler(app)).Bind(RequireSuperuserAuth())
	subGroup.GET("/config", analyticsConfigHandler(app)).Bind(RequireSuperuserAuth())
}
