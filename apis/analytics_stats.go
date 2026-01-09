package apis

import (
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// analyticsStatsHandler 处理统计数据查询请求。
// GET /api/analytics/stats?range=7d
func analyticsStatsHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		repo := analytics.Repository()
		if repo == nil {
			return e.InternalServerError("Analytics repository not initialized", nil)
		}

		// 解析日期范围
		startDate, endDate := parseDateRange(e.Request.URL.Query().Get("range"))

		// 查询每日统计
		stats, err := repo.GetDailyStats(e.Request.Context(), startDate, endDate)
		if err != nil {
			return e.InternalServerError("Failed to query stats", err)
		}

		// 计算汇总数据
		var totalPV int64
		dailyData := make([]map[string]any, 0, len(stats))

		// 按日期聚合
		dateMap := make(map[string]*struct {
			PV int64
			UV int64
		})

		for _, stat := range stats {
			if _, ok := dateMap[stat.Date]; !ok {
				dateMap[stat.Date] = &struct {
					PV int64
					UV int64
				}{}
			}
			dateMap[stat.Date].PV += stat.TotalPV
			dateMap[stat.Date].UV += stat.Visitors
			totalPV += stat.TotalPV
		}

		// 转换为数组
		for date, data := range dateMap {
			dailyData = append(dailyData, map[string]any{
				"date": date,
				"pv":   data.PV,
				"uv":   data.UV,
			})
		}

		// 使用 HLL 合并计算准确的跨天 UV
		var totalUV uint64
		sketches, err := repo.GetDailyHLLSketches(e.Request.Context(), startDate, endDate)
		if err == nil && len(sketches) > 0 {
			_, totalUV, _ = core.MergeHLLBytes(sketches...)
		} else {
			// 降级：如果 HLL 合并失败，使用简单累加
			for _, data := range dateMap {
				totalUV += uint64(data.UV)
			}
		}

		return e.JSON(http.StatusOK, map[string]any{
			"summary": map[string]any{
				"totalPV":    totalPV,
				"totalUV":    totalUV,
				"bounceRate": 0, // TODO: 计算跳出率
				"avgDur":     0, // TODO: 计算平均停留时长
			},
			"daily":     dailyData,
			"startDate": startDate,
			"endDate":   endDate,
		})
	}
}

// analyticsTopPagesHandler 处理 Top Pages 查询请求。
// GET /api/analytics/top-pages?range=7d&limit=10
func analyticsTopPagesHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		repo := analytics.Repository()
		if repo == nil {
			return e.InternalServerError("Analytics repository not initialized", nil)
		}

		startDate, endDate := parseDateRange(e.Request.URL.Query().Get("range"))
		limit := parseLimit(e.Request.URL.Query().Get("limit"), 10)

		pages, err := repo.GetTopPages(e.Request.Context(), startDate, endDate, limit)
		if err != nil {
			return e.InternalServerError("Failed to query top pages", err)
		}

		result := make([]map[string]any, 0, len(pages))
		for _, page := range pages {
			result = append(result, map[string]any{
				"path":     page.Path,
				"pv":       page.TotalPV,
				"visitors": page.Visitors,
			})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"pages":     result,
			"startDate": startDate,
			"endDate":   endDate,
		})
	}
}

// analyticsTopSourcesHandler 处理 Top Sources 查询请求。
// GET /api/analytics/top-sources?range=7d&limit=10
func analyticsTopSourcesHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		repo := analytics.Repository()
		if repo == nil {
			return e.InternalServerError("Analytics repository not initialized", nil)
		}

		startDate, endDate := parseDateRange(e.Request.URL.Query().Get("range"))
		limit := parseLimit(e.Request.URL.Query().Get("limit"), 10)

		sources, err := repo.GetTopSources(e.Request.Context(), startDate, endDate, limit)
		if err != nil {
			return e.InternalServerError("Failed to query top sources", err)
		}

		result := make([]map[string]any, 0, len(sources))
		for _, source := range sources {
			result = append(result, map[string]any{
				"source":   source.Source,
				"visitors": source.Visitors,
			})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"sources":   result,
			"startDate": startDate,
			"endDate":   endDate,
		})
	}
}

// analyticsDevicesHandler 处理设备分布查询请求。
// GET /api/analytics/devices?range=7d
func analyticsDevicesHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		repo := analytics.Repository()
		if repo == nil {
			return e.InternalServerError("Analytics repository not initialized", nil)
		}

		startDate, endDate := parseDateRange(e.Request.URL.Query().Get("range"))

		devices, err := repo.GetDeviceStats(e.Request.Context(), startDate, endDate)
		if err != nil {
			return e.InternalServerError("Failed to query devices", err)
		}

		// 按浏览器和操作系统分组
		browserMap := make(map[string]int64)
		osMap := make(map[string]int64)

		for _, device := range devices {
			browserMap[device.Browser] += device.Visitors
			osMap[device.OS] += device.Visitors
		}

		browsers := make([]map[string]any, 0, len(browserMap))
		for name, count := range browserMap {
			browsers = append(browsers, map[string]any{
				"name":     name,
				"visitors": count,
			})
		}

		oses := make([]map[string]any, 0, len(osMap))
		for name, count := range osMap {
			oses = append(oses, map[string]any{
				"name":     name,
				"visitors": count,
			})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"browsers":  browsers,
			"os":        oses,
			"startDate": startDate,
			"endDate":   endDate,
		})
	}
}

// analyticsRawLogsHandler 列出可下载的原始日志日期。
// GET /api/analytics/raw-logs
func analyticsRawLogsHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		// TODO: 实现列出可下载日期的逻辑
		return e.JSON(http.StatusOK, map[string]any{
			"dates": []string{},
		})
	}
}

// analyticsRawLogDownloadHandler 下载指定日期的原始日志。
// GET /api/analytics/raw-logs/{date}
func analyticsRawLogDownloadHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		// date := e.Request.PathValue("date")

		// TODO: 实现下载逻辑
		// - SQLite 模式：返回本地 Parquet 文件
		// - PostgreSQL 模式：生成 S3 Presigned URL 并重定向

		return e.NotFoundError("Raw logs download not implemented yet", nil)
	}
}

// analyticsConfigHandler 返回分析配置。
// GET /api/analytics/config
func analyticsConfigHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		analytics := app.Analytics()
		if analytics == nil {
			return e.JSON(http.StatusOK, map[string]any{
				"enabled": false,
			})
		}

		config := analytics.Config()
		return e.JSON(http.StatusOK, map[string]any{
			"enabled":       config.Enabled,
			"retention":     config.Retention,
			"flushInterval": config.FlushInterval,
			"hasS3":         config.S3Bucket != "",
		})
	}
}

// parseDateRange 解析日期范围参数。
func parseDateRange(rangeStr string) (startDate, endDate string) {
	now := time.Now()
	endDate = now.Format("2006-01-02")

	switch rangeStr {
	case "today":
		startDate = endDate
	case "30d":
		startDate = now.AddDate(0, 0, -30).Format("2006-01-02")
	case "90d":
		startDate = now.AddDate(0, 0, -90).Format("2006-01-02")
	default: // 默认 7 天
		startDate = now.AddDate(0, 0, -7).Format("2006-01-02")
	}

	return startDate, endDate
}

// parseLimit 解析 limit 参数。
func parseLimit(limitStr string, defaultLimit int) int {
	if limitStr == "" {
		return defaultLimit
	}

	var limit int
	if _, err := parseIntFromString(limitStr, &limit); err != nil || limit <= 0 {
		return defaultLimit
	}

	if limit > 100 {
		return 100
	}

	return limit
}

// parseIntFromString 从字符串解析整数。
func parseIntFromString(s string, result *int) (bool, error) {
	if s == "" {
		return false, nil
	}

	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		n = n*10 + int(c-'0')
	}

	*result = n
	return true, nil
}
