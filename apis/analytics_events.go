package apis

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase/core"
)

// analyticsEventsHandler 处理事件采集请求。
// POST /api/analytics/events
func analyticsEventsHandler(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		// 检查分析功能是否启用
		analytics := app.Analytics()
		if analytics == nil || !analytics.IsEnabled() {
			return e.NotFoundError("Analytics is disabled", nil)
		}

		// 解析请求体
		var input struct {
			Events []core.AnalyticsEventInput `json:"events"`
		}

		if err := e.BindBody(&input); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if len(input.Events) == 0 {
			return e.BadRequestError("No events provided", nil)
		}

		// 获取客户端信息
		ip := e.RealIP()
		ua := e.Request.Header.Get("User-Agent")

		// 过滤爬虫流量
		if core.IsBotUserAgent(ua) {
			// 静默丢弃爬虫流量
			return e.JSON(http.StatusAccepted, map[string]any{
				"accepted": 0,
				"message":  "bot traffic ignored",
			})
		}

		// 解析 User-Agent
		uaInfo := core.ParseUserAgent(ua)

		// 处理每个事件
		accepted := 0
		for _, eventInput := range input.Events {
			// 规范化 URL
			normalizedPath := core.NormalizeURL(eventInput.Path)
			eventInput.Path = normalizedPath

			// 生成事件 ID
			eventID := uuid.New().String()

			// 转换为内部事件结构
			event := eventInput.ToEvent(
				eventID,
				ip,
				ua,
				uaInfo.Browser,
				uaInfo.OS,
				uaInfo.Device,
			)

			// 验证事件
			if err := event.Validate(); err != nil {
				// 跳过无效事件，继续处理其他事件
				continue
			}

			// 推入缓冲区
			if err := analytics.Push(&event); err != nil {
				// 记录错误但继续处理
				app.Logger().Warn("Failed to push analytics event",
					"error", err,
					"event", event.Event,
					"path", event.Path,
				)
				continue
			}

			accepted++
		}

		return e.JSON(http.StatusAccepted, map[string]any{
			"accepted": accepted,
			"total":    len(input.Events),
		})
	}
}
