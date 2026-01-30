package gateway

import (
	"net/http"
)

// 错误消息常量
const (
	ErrUpstreamUnavailable = "Upstream Unavailable"
	ErrGatewayTimeout      = "Gateway Timeout"
	ErrProxyNotFound       = "Proxy Not Found"
	ErrProxyDisabled       = "Proxy Disabled"
	ErrAccessDenied        = "Access Denied"
)

// WriteGatewayError 写入 JSON 格式的错误响应
// 用于统一的错误响应格式
func WriteGatewayError(w http.ResponseWriter, statusCode int, errorMsg string, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	// 简单的 JSON 格式化，避免引入额外依赖
	if details != "" {
		w.Write([]byte(`{"error":"` + escapeJSON(errorMsg) + `","details":"` + escapeJSON(details) + `"}`))
	} else {
		w.Write([]byte(`{"error":"` + escapeJSON(errorMsg) + `"}`))
	}
}

// escapeJSON 简单的 JSON 字符串转义
// 处理双引号和反斜杠
func escapeJSON(s string) string {
	result := ""
	for _, c := range s {
		switch c {
		case '"':
			result += `\"`
		case '\\':
			result += `\\`
		case '\n':
			result += `\n`
		case '\r':
			result += `\r`
		case '\t':
			result += `\t`
		default:
			result += string(c)
		}
	}
	return result
}

// WriteError502 写入 502 Bad Gateway 错误
func WriteError502(w http.ResponseWriter, details string) {
	WriteGatewayError(w, http.StatusBadGateway, ErrUpstreamUnavailable, details)
}

// WriteError504 写入 504 Gateway Timeout 错误
func WriteError504(w http.ResponseWriter, details string) {
	WriteGatewayError(w, http.StatusGatewayTimeout, ErrGatewayTimeout, details)
}

// WriteError404 写入 404 Not Found 错误
func WriteError404(w http.ResponseWriter, details string) {
	WriteGatewayError(w, http.StatusNotFound, ErrProxyNotFound, details)
}
