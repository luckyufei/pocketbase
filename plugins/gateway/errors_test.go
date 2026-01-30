package gateway

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// GatewayError JSON 错误响应结构
type GatewayError struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// TestGatewayError 测试 GatewayError 结构
func TestGatewayError(t *testing.T) {
	err := GatewayError{
		Error:   "AI Gateway Error",
		Details: "connection refused",
	}

	if err.Error != "AI Gateway Error" {
		t.Errorf("Error = %q, want %q", err.Error, "AI Gateway Error")
	}
	if err.Details != "connection refused" {
		t.Errorf("Details = %q, want %q", err.Details, "connection refused")
	}
}

// TestWriteGatewayError502 测试 502 Bad Gateway 错误
func TestWriteGatewayError502(t *testing.T) {
	w := httptest.NewRecorder()
	WriteGatewayError(w, http.StatusBadGateway, "Upstream Unavailable", "connection refused")

	if w.Code != http.StatusBadGateway {
		t.Errorf("status code = %d, want %d", w.Code, http.StatusBadGateway)
	}

	if w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type = %q, want %q", w.Header().Get("Content-Type"), "application/json")
	}

	want := `{"error":"Upstream Unavailable","details":"connection refused"}`
	if w.Body.String() != want {
		t.Errorf("body = %q, want %q", w.Body.String(), want)
	}
}

// TestWriteGatewayError504 测试 504 Gateway Timeout 错误
func TestWriteGatewayError504(t *testing.T) {
	w := httptest.NewRecorder()
	WriteGatewayError(w, http.StatusGatewayTimeout, "Gateway Timeout", "upstream request timeout")

	if w.Code != http.StatusGatewayTimeout {
		t.Errorf("status code = %d, want %d", w.Code, http.StatusGatewayTimeout)
	}
}

// TestWriteGatewayError404 测试 404 Not Found 错误
func TestWriteGatewayError404(t *testing.T) {
	w := httptest.NewRecorder()
	WriteGatewayError(w, http.StatusNotFound, "Proxy Not Found", "")

	if w.Code != http.StatusNotFound {
		t.Errorf("status code = %d, want %d", w.Code, http.StatusNotFound)
	}

	// 没有 details 时不应包含 details 字段
	want := `{"error":"Proxy Not Found"}`
	if w.Body.String() != want {
		t.Errorf("body = %q, want %q", w.Body.String(), want)
	}
}

// TestErrorMessages 测试错误消息常量
func TestErrorMessages(t *testing.T) {
	tests := []struct {
		name     string
		errConst string
		want     string
	}{
		{"ErrUpstreamUnavailable", ErrUpstreamUnavailable, "Upstream Unavailable"},
		{"ErrGatewayTimeout", ErrGatewayTimeout, "Gateway Timeout"},
		{"ErrProxyNotFound", ErrProxyNotFound, "Proxy Not Found"},
		{"ErrProxyDisabled", ErrProxyDisabled, "Proxy Disabled"},
		{"ErrAccessDenied", ErrAccessDenied, "Access Denied"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.errConst != tt.want {
				t.Errorf("%s = %q, want %q", tt.name, tt.errConst, tt.want)
			}
		})
	}
}

// TestWriteError502 测试 WriteError502 便捷函数
func TestWriteError502(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError502(w, "connection refused")

	if w.Code != http.StatusBadGateway {
		t.Errorf("status code = %d, want %d", w.Code, http.StatusBadGateway)
	}

	want := `{"error":"Upstream Unavailable","details":"connection refused"}`
	if w.Body.String() != want {
		t.Errorf("body = %q, want %q", w.Body.String(), want)
	}
}

// TestWriteError504 测试 WriteError504 便捷函数
func TestWriteError504(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError504(w, "timeout after 30s")

	if w.Code != http.StatusGatewayTimeout {
		t.Errorf("status code = %d, want %d", w.Code, http.StatusGatewayTimeout)
	}

	want := `{"error":"Gateway Timeout","details":"timeout after 30s"}`
	if w.Body.String() != want {
		t.Errorf("body = %q, want %q", w.Body.String(), want)
	}
}

// TestWriteError404 测试 WriteError404 便捷函数
func TestWriteError404(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError404(w, "no matching proxy")

	if w.Code != http.StatusNotFound {
		t.Errorf("status code = %d, want %d", w.Code, http.StatusNotFound)
	}

	want := `{"error":"Proxy Not Found","details":"no matching proxy"}`
	if w.Body.String() != want {
		t.Errorf("body = %q, want %q", w.Body.String(), want)
	}
}

// TestEscapeJSON 测试 JSON 转义
func TestEscapeJSON(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"simple", "simple"},
		{`with "quotes"`, `with \"quotes\"`},
		{"with\nnewline", `with\nnewline`},
		{"with\ttab", `with\ttab`},
		{`back\slash`, `back\\slash`},
		{"with\rreturn", `with\rreturn`},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := escapeJSON(tt.input)
			if got != tt.want {
				t.Errorf("escapeJSON(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
