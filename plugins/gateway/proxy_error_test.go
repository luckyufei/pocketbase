package gateway

import (
	"bytes"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestModifyResponseInvalidStatus 验证非标准状态码的容错处理
// T031b: 实现上游返回非标准 HTTP 响应时的容错处理
func TestModifyResponseInvalidStatus(t *testing.T) {
	tests := []struct {
		name           string
		statusCode     int
		wantNormalized int
	}{
		{"normal 200", 200, 200},
		{"normal 404", 404, 404},
		{"normal 500", 500, 500},
		{"invalid 0 -> 502", 0, 502},
		{"invalid 999 -> 502", 999, 502}, // 超出标准范围，转为 502
		{"edge 100", 100, 100},           // 最小有效状态码
		{"edge 599", 599, 599},           // 最大有效状态码
		{"invalid 600 -> 502", 600, 502}, // 超出范围
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				StatusCode: tt.statusCode,
				Header:     make(http.Header),
				Body:       io.NopCloser(bytes.NewReader([]byte{})),
			}

			err := normalizeUpstreamResponse(resp)

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if resp.StatusCode != tt.wantNormalized {
				t.Errorf("StatusCode: want %d, got %d", tt.wantNormalized, resp.StatusCode)
			}
		})
	}
}

// TestModifyResponseMissingContentType 验证缺失 Content-Type 的处理
func TestModifyResponseMissingContentType(t *testing.T) {
	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(`{"key":"value"}`))),
	}

	err := normalizeUpstreamResponse(resp)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// 不应该强制设置 Content-Type，保持上游原样
	// 只是记录 warning
}

// TestModifyResponseEmptyBody 验证空 Body 的安全处理
func TestModifyResponseEmptyBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: 204,
		Header:     make(http.Header),
		Body:       nil,
	}

	err := normalizeUpstreamResponse(resp)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// 应该安全处理 nil body - 设置为空 reader
	if resp.Body == nil {
		t.Error("Body should not be nil after normalization")
	}

	// 验证 Body 可以读取（返回 EOF）
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Errorf("Reading normalized body failed: %v", err)
	}
	if len(data) != 0 {
		t.Errorf("Normalized body should be empty, got %d bytes", len(data))
	}
}

// TestNormalizeUpstreamResponseNil 验证 nil 响应处理
func TestNormalizeUpstreamResponseNil(t *testing.T) {
	err := normalizeUpstreamResponse(nil)
	if err != nil {
		t.Errorf("normalizeUpstreamResponse(nil) should return nil, got %v", err)
	}
}

// TestEmptyReader 验证 emptyReader 实现
func TestEmptyReader(t *testing.T) {
	reader := emptyReader{}
	buf := make([]byte, 10)

	n, err := reader.Read(buf)
	if n != 0 {
		t.Errorf("emptyReader.Read should return 0 bytes, got %d", n)
	}
	if err != io.EOF {
		t.Errorf("emptyReader.Read should return io.EOF, got %v", err)
	}
}

// TestErrorHandlerNonStandard 验证 ErrorHandler 处理非标准错误
func TestErrorHandlerNonStandard(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)

	// 模拟各种上游错误
	testCases := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{"connection refused", &mockConnError{msg: "connection refused"}, http.StatusBadGateway},
		{"timeout", &mockConnError{msg: "timeout", timeout: true}, http.StatusGatewayTimeout},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rec = httptest.NewRecorder()
			handleUpstreamError(rec, req, tc.err)

			if rec.Code != tc.wantStatus {
				t.Errorf("Status: want %d, got %d", tc.wantStatus, rec.Code)
			}
		})
	}
}

// TestHandleUpstreamErrorNil 验证 nil 错误处理
func TestHandleUpstreamErrorNil(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)

	handleUpstreamError(rec, req, nil)

	// nil 错误不应该写任何响应
	if rec.Code != http.StatusOK {
		t.Errorf("nil error should not change response code, got %d", rec.Code)
	}
}

// TestHandleUpstreamErrorGeneric 验证通用错误处理
func TestHandleUpstreamErrorGeneric(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)

	// 普通错误应该返回 502
	handleUpstreamError(rec, req, errors.New("some generic error"))

	if rec.Code != http.StatusBadGateway {
		t.Errorf("Generic error should return 502, got %d", rec.Code)
	}
}

// TestIsTimeoutError 验证超时错误检测
func TestIsTimeoutError(t *testing.T) {
	tests := []struct {
		name   string
		err    error
		expect bool
	}{
		{"nil", nil, false},
		{"timeout error", &mockConnError{timeout: true}, true},
		{"non-timeout error", &mockConnError{timeout: false}, false},
		{"wrapped timeout", &wrappedError{inner: &mockConnError{timeout: true}}, true},
		{"wrapped non-timeout", &wrappedError{inner: &mockConnError{timeout: false}}, false},
		{"generic error", errors.New("some error"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isTimeoutError(tt.err)
			if got != tt.expect {
				t.Errorf("isTimeoutError(%v) = %v, want %v", tt.err, got, tt.expect)
			}
		})
	}
}

// TestIsConnectionError 验证连接错误检测
func TestIsConnectionError(t *testing.T) {
	tests := []struct {
		name   string
		err    error
		expect bool
	}{
		{"nil", nil, false},
		{"OpError", &net.OpError{Op: "dial"}, true},
		{"DNSError", &net.DNSError{Name: "example.com"}, true},
		{"wrapped OpError", &wrappedError{inner: &net.OpError{Op: "dial"}}, true},
		{"generic error", errors.New("some error"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isConnectionError(tt.err)
			if got != tt.expect {
				t.Errorf("isConnectionError(%v) = %v, want %v", tt.err, got, tt.expect)
			}
		})
	}
}

// TestCreateModifyResponse 验证 createModifyResponse 函数
func TestCreateModifyResponse(t *testing.T) {
	modifyFn := createModifyResponse()
	if modifyFn == nil {
		t.Fatal("createModifyResponse should not return nil")
	}

	// 测试正常响应
	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte{})),
	}

	err := modifyFn(resp)
	if err != nil {
		t.Errorf("modifyResponse should not return error for valid response, got %v", err)
	}

	// 测试异常状态码
	resp2 := &http.Response{
		StatusCode: 0,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte{})),
	}

	err = modifyFn(resp2)
	if err != nil {
		t.Errorf("modifyResponse should not return error, got %v", err)
	}
	if resp2.StatusCode != http.StatusBadGateway {
		t.Errorf("Status 0 should be normalized to 502, got %d", resp2.StatusCode)
	}
}

// mockConnError 模拟连接错误
type mockConnError struct {
	msg       string
	timeout   bool
	temporary bool
}

func (e *mockConnError) Error() string   { return e.msg }
func (e *mockConnError) Timeout() bool   { return e.timeout }
func (e *mockConnError) Temporary() bool { return e.temporary }

// wrappedError 模拟包装错误
type wrappedError struct {
	inner error
}

func (e *wrappedError) Error() string { return e.inner.Error() }
func (e *wrappedError) Unwrap() error { return e.inner }
