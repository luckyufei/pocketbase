package metrics

import (
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cast"
)

// bindRoutes 注册监控 API 路由
func (p *metricsPlugin) bindRoutes(e *core.ServeEvent) {
	subGroup := e.Router.Group("/api/system")

	// 仅管理员可访问
	subGroup.Bind(apis.RequireSuperuserAuth())

	// GET /api/system/metrics - 获取历史监控数据
	subGroup.GET("/metrics", func(re *core.RequestEvent) error {
		if p.repository == nil {
			return re.JSON(http.StatusServiceUnavailable, map[string]any{
				"message": "Metrics service is not available",
			})
		}

		// 解析查询参数
		hours := cast.ToInt(re.Request.URL.Query().Get("hours"))
		if hours <= 0 {
			hours = 24
		}
		if hours > 168 { // 最多 7 天
			hours = 168
		}

		limit := cast.ToInt(re.Request.URL.Query().Get("limit"))
		if limit <= 0 {
			limit = 1000
		}
		if limit > 10000 {
			limit = 10000
		}

		// 查询数据
		items, totalItems, err := p.repository.GetByTimeRange(hours, limit)
		if err != nil {
			return re.JSON(http.StatusInternalServerError, map[string]any{
				"message": "Failed to query metrics",
				"error":   err.Error(),
			})
		}

		return re.JSON(http.StatusOK, &SystemMetricsResponse{
			Items:      items,
			TotalItems: totalItems,
		})
	})

	// GET /api/system/metrics/current - 获取当前系统状态
	subGroup.GET("/metrics/current", func(re *core.RequestEvent) error {
		if p.repository == nil {
			return re.JSON(http.StatusServiceUnavailable, map[string]any{
				"message": "Metrics service is not available",
			})
		}

		m, err := p.repository.GetLatest()
		if err != nil {
			return re.JSON(http.StatusInternalServerError, map[string]any{
				"message": "Failed to query current metrics",
				"error":   err.Error(),
			})
		}

		if m == nil {
			return re.JSON(http.StatusNotFound, map[string]any{
				"message": "No metrics data available yet",
			})
		}

		return re.JSON(http.StatusOK, m)
	})

	// GET /api/system/metrics/database - 获取数据库统计信息
	subGroup.GET("/metrics/database", databaseStats)
}
