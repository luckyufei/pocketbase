package metrics

import (
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// middlewareFunc 创建用于记录请求延迟和错误的中间件
func (p *metricsPlugin) middlewareFunc() func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		if p.collector == nil {
			return e.Next()
		}

		start := time.Now()
		err := e.Next()

		// 记录延迟
		latencyMs := float64(time.Since(start).Microseconds()) / 1000.0
		p.collector.RecordLatency(latencyMs)

		// 记录 5xx 错误
		// 策略：同时检查 error 返回值和 response status code
		statusCode := getResponseStatus(e.Response)

		// 1. 优先通过 error 判断（ApiError 包含精确的 status）
		if err != nil {
			if apiErr, ok := err.(*router.ApiError); ok && apiErr.Status >= 500 {
				p.collector.RecordError(apiErr.Status)
				return err
			}
		}

		// 2. 通过 response status 判断（捕获直接写入 5xx 但没返回 error 的情况）
		if statusCode >= 500 && statusCode < 600 {
			p.collector.RecordError(statusCode)
		}

		return err
	}
}

// Middleware 返回一个可以手动绑定的中间件
// 用于不使用 EnableMiddleware 配置但仍需要手动注册中间件的场景
func Middleware(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		collector := GetCollector(app)
		if collector == nil {
			return e.Next()
		}

		start := time.Now()
		err := e.Next()

		// 记录延迟
		latencyMs := float64(time.Since(start).Microseconds()) / 1000.0
		collector.RecordLatency(latencyMs)

		// 记录 5xx 错误
		statusCode := getResponseStatus(e.Response)

		// 1. 优先通过 error 判断
		if err != nil {
			if apiErr, ok := err.(*router.ApiError); ok && apiErr.Status >= 500 {
				collector.RecordError(apiErr.Status)
				return err
			}
		}

		// 2. 通过 response status 判断
		if statusCode >= 500 && statusCode < 600 {
			collector.RecordError(statusCode)
		}

		return err
	}
}

// getResponseStatus 从 http.ResponseWriter 获取响应状态码
// 如果无法获取，返回 0
func getResponseStatus(rw http.ResponseWriter) int {
	// 尝试使用 StatusTracker 接口获取状态码
	for {
		switch w := rw.(type) {
		case router.StatusTracker:
			return w.Status()
		case router.RWUnwrapper:
			rw = w.Unwrap()
		default:
			return 0
		}
	}
}
