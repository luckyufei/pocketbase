// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"net/http"
	"strconv"
	"strings"
	"time"
)

// responseWriter 包装 http.ResponseWriter 以捕获状态码
//
// T048: ResponseWriter 包装器
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

// newResponseWriter 创建 ResponseWriter 包装器
func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{
		ResponseWriter: w,
		statusCode:     0,
		written:        false,
	}
}

// WriteHeader 记录状态码并传递给底层 ResponseWriter
func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
	}
	rw.ResponseWriter.WriteHeader(code)
}

// Write 写入数据，如果尚未写入头则默认使用 200
func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.statusCode = http.StatusOK
		rw.written = true
	}
	return rw.ResponseWriter.Write(b)
}

// StatusCode 返回记录的状态码
func (rw *responseWriter) StatusCode() int {
	return rw.statusCode
}

// writeTooManyRequestsError 写入 429 响应
//
// T053: 实现 429 响应处理
// FR-009: 429 + JSON 错误体
// FR-011: Retry-After 头
func writeTooManyRequestsError(w http.ResponseWriter, retryAfter int) {
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	WriteGatewayError(w, http.StatusTooManyRequests, "Too Many Requests", "AI Engine is at capacity, please retry later")
}

// writeCircuitOpenError 写入 503 熔断响应
//
// T054: 实现 503 熔断响应处理
// FR-015: X-Circuit-Breaker 头
func writeCircuitOpenError(w http.ResponseWriter) {
	w.Header().Set("X-Circuit-Breaker", "open")
	WriteGatewayError(w, http.StatusServiceUnavailable, "Service Unavailable", "Circuit breaker is open, upstream service is experiencing issues")
}

// writeWebSocketUpgradeError 写入 WebSocket 升级拒绝响应
//
// T031a: WebSocket 升级请求的友好错误响应
func writeWebSocketUpgradeError(w http.ResponseWriter) {
	WriteGatewayError(w, http.StatusNotImplemented, "WebSocket Not Supported", "This gateway does not support WebSocket connections")
}

// isWebSocketUpgrade 检测是否是 WebSocket 升级请求
func isWebSocketUpgrade(r *http.Request) bool {
	connection := r.Header.Get("Connection")
	upgrade := r.Header.Get("Upgrade")

	return strings.EqualFold(connection, "upgrade") &&
		strings.EqualFold(upgrade, "websocket")
}

// wrapHandler 包装 HTTP handler，集成所有控制组件
//
// T049: 实现 wrapHandler
func wrapHandler(
	handler http.Handler,
	proxyName string,
	limiter *ConcurrencyLimiter,
	breaker *CircuitBreaker,
	metrics *MetricsCollector,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. WebSocket 检测 (T031a)
		if isWebSocketUpgrade(r) {
			writeWebSocketUpgradeError(w)
			return
		}

		// 2. 熔断检查
		if breaker != nil && breaker.IsOpen() {
			// 更新指标
			if metrics != nil {
				metrics.SetCircuitState(proxyName, breaker.State())
			}
			writeCircuitOpenError(w)
			return
		}

		// 3. 并发限制检查
		if limiter != nil {
			if !limiter.Acquire() {
				// 429 响应，建议重试时间 30 秒
				writeTooManyRequestsError(w, 30)
				return
			}
			defer limiter.Release()
		}

		// 4. 指标：增加活跃连接
		if metrics != nil {
			metrics.IncrActiveConns(proxyName)
			defer metrics.DecrActiveConns(proxyName)
		}

		// 5. 包装 ResponseWriter 以捕获状态码
		rw := newResponseWriter(w)

		// 6. 记录开始时间
		start := time.Now()

		// 7. 执行实际 handler
		handler.ServeHTTP(rw, r)

		// 8. 记录指标
		duration := time.Since(start)
		statusCode := rw.StatusCode()

		if metrics != nil {
			metrics.RecordRequest(proxyName, statusCode, duration)
		}

		// 9. 更新熔断器状态
		if breaker != nil {
			if statusCode >= 500 {
				breaker.RecordFailure()
			} else {
				breaker.RecordSuccess()
			}

			// 更新熔断状态指标
			if metrics != nil {
				metrics.SetCircuitState(proxyName, breaker.State())
			}
		}
	})
}
