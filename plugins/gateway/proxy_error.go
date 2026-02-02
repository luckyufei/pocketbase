// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"io"
	"net"
	"net/http"
)

// normalizeUpstreamResponse 规范化上游响应
// T031b: 实现上游返回非标准 HTTP 响应时的容错处理
//
// 处理场景:
// - 无效状态码 (0) -> 502 Bad Gateway
// - nil Body -> 安全处理
// - 缺失 Content-Type -> 保持原样（记录 warning）
func normalizeUpstreamResponse(resp *http.Response) error {
	if resp == nil {
		return nil
	}

	// 处理无效状态码
	// HTTP 状态码应该在 100-599 范围内
	if resp.StatusCode < 100 || resp.StatusCode > 599 {
		resp.StatusCode = http.StatusBadGateway
	}

	// 特殊处理状态码 0（某些代理库可能返回）
	if resp.StatusCode == 0 {
		resp.StatusCode = http.StatusBadGateway
	}

	// 安全处理 nil Body
	// 注意：某些上游可能返回 nil body（非标准行为）
	if resp.Body == nil {
		resp.Body = io.NopCloser(emptyReader{})
	}

	return nil
}

// emptyReader 空读取器
type emptyReader struct{}

func (emptyReader) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

// handleUpstreamError 处理上游错误
// T031b: 增强错误处理，区分超时和连接错误
//
// 错误类型映射:
// - 超时错误 -> 504 Gateway Timeout
// - 连接错误 -> 502 Bad Gateway
// - 其他错误 -> 502 Bad Gateway
func handleUpstreamError(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}

	// 检查是否是超时错误
	if isTimeoutError(err) {
		WriteGatewayError(w, http.StatusGatewayTimeout, "Gateway Timeout", "upstream request timed out: "+err.Error())
		return
	}

	// 检查是否是连接错误
	if isConnectionError(err) {
		WriteGatewayError(w, http.StatusBadGateway, ErrUpstreamUnavailable, "connection error: "+err.Error())
		return
	}

	// 默认 502 Bad Gateway
	WriteGatewayError(w, http.StatusBadGateway, ErrUpstreamUnavailable, err.Error())
}

// isTimeoutError 检查是否是超时错误
func isTimeoutError(err error) bool {
	if err == nil {
		return false
	}

	// 检查 net.Error 接口
	if netErr, ok := err.(net.Error); ok {
		return netErr.Timeout()
	}

	// 检查嵌套错误
	if unwrapper, ok := err.(interface{ Unwrap() error }); ok {
		return isTimeoutError(unwrapper.Unwrap())
	}

	return false
}

// isConnectionError 检查是否是连接错误
func isConnectionError(err error) bool {
	if err == nil {
		return false
	}

	// 检查 net.OpError
	if _, ok := err.(*net.OpError); ok {
		return true
	}

	// 检查 net.DNSError
	if _, ok := err.(*net.DNSError); ok {
		return true
	}

	// 检查嵌套错误
	if unwrapper, ok := err.(interface{ Unwrap() error }); ok {
		return isConnectionError(unwrapper.Unwrap())
	}

	return false
}

// createModifyResponse 创建响应修改函数
// 用于 httputil.ReverseProxy.ModifyResponse
func createModifyResponse() func(*http.Response) error {
	return func(resp *http.Response) error {
		return normalizeUpstreamResponse(resp)
	}
}
