// Package hostfn 提供 Host Functions 实现
package hostfn

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// FetchConfig Fetch 配置
type FetchConfig struct {
	// Timeout 请求超时时间
	Timeout time.Duration

	// Whitelist 域名白名单（空表示允许所有）
	Whitelist []string

	// MaxResponseSize 最大响应体大小
	MaxResponseSize int64
}

// FetchRequest 表示 fetch 请求
type FetchRequest struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// FetchResponse 表示 fetch 响应
type FetchResponse struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// JSON 将响应体解析为 JSON
func (r *FetchResponse) JSON(v any) error {
	return json.Unmarshal([]byte(r.Body), v)
}

// Text 返回响应体文本
func (r *FetchResponse) Text() string {
	return r.Body
}

// StreamResponse 表示流式响应
type StreamResponse struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`

	reader   *bufio.Reader
	response *http.Response
	closed   bool
	mu       sync.Mutex
}

// Read 读取下一个数据块
func (s *StreamResponse) Read() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return "", io.EOF
	}

	if s.reader == nil {
		return "", io.EOF
	}

	// 读取一行（SSE 格式）
	line, err := s.reader.ReadString('\n')
	if err != nil {
		if err == io.EOF {
			s.closed = true
		}
		return "", err
	}

	return line, nil
}

// ReadChunk 读取指定大小的数据块
func (s *StreamResponse) ReadChunk(size int) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return nil, io.EOF
	}

	if s.reader == nil {
		return nil, io.EOF
	}

	buf := make([]byte, size)
	n, err := s.reader.Read(buf)
	if err != nil {
		if err == io.EOF {
			s.closed = true
		}
		return nil, err
	}

	return buf[:n], nil
}

// Close 关闭流
func (s *StreamResponse) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return nil
	}

	s.closed = true
	if s.response != nil && s.response.Body != nil {
		return s.response.Body.Close()
	}
	return nil
}

// IsClosed 检查流是否已关闭
func (s *StreamResponse) IsClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closed
}

// Fetch 是 fetch Host Function 实现
type Fetch struct {
	config FetchConfig
	client *http.Client
}

// NewFetch 创建新的 Fetch 实例
func NewFetch(config FetchConfig) *Fetch {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.MaxResponseSize == 0 {
		config.MaxResponseSize = 10 * 1024 * 1024 // 10MB
	}

	return &Fetch{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// IsAllowed 检查 URL 是否在白名单中
func (f *Fetch) IsAllowed(rawURL string) bool {
	// 空白名单允许所有
	if len(f.config.Whitelist) == 0 {
		return true
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	host := parsed.Host
	// 移除端口号
	if idx := strings.LastIndex(host, ":"); idx > 0 {
		host = host[:idx]
	}

	for _, allowed := range f.config.Whitelist {
		if host == allowed || strings.HasSuffix(host, "."+allowed) {
			return true
		}
	}

	return false
}

// Do 执行 fetch 请求
func (f *Fetch) Do(ctx context.Context, req FetchRequest) (*FetchResponse, error) {
	// 检查白名单
	if !f.IsAllowed(req.URL) {
		return nil, errors.New("URL not in whitelist: " + req.URL)
	}

	// 默认方法
	if req.Method == "" {
		req.Method = "GET"
	}

	// 构建请求
	var bodyReader io.Reader
	if req.Body != "" {
		bodyReader = bytes.NewReader([]byte(req.Body))
	}

	httpReq, err := http.NewRequestWithContext(ctx, req.Method, req.URL, bodyReader)
	if err != nil {
		return nil, err
	}

	// 设置 Headers
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	// 发送请求
	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 读取响应体
	body, err := io.ReadAll(io.LimitReader(resp.Body, f.config.MaxResponseSize))
	if err != nil {
		return nil, err
	}

	// 转换 Headers
	headers := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	return &FetchResponse{
		Status:  resp.StatusCode,
		Headers: headers,
		Body:    string(body),
	}, nil
}

// DoStream 执行流式 fetch 请求
func (f *Fetch) DoStream(ctx context.Context, req FetchRequest) (*StreamResponse, error) {
	// 检查白名单
	if !f.IsAllowed(req.URL) {
		return nil, errors.New("URL not in whitelist: " + req.URL)
	}

	// 默认方法
	if req.Method == "" {
		req.Method = "GET"
	}

	// 构建请求
	var bodyReader io.Reader
	if req.Body != "" {
		bodyReader = bytes.NewReader([]byte(req.Body))
	}

	httpReq, err := http.NewRequestWithContext(ctx, req.Method, req.URL, bodyReader)
	if err != nil {
		return nil, err
	}

	// 设置 Headers
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	// 发送请求（不使用超时客户端，因为流可能持续很长时间）
	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}

	// 转换 Headers
	headers := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	return &StreamResponse{
		Status:   resp.StatusCode,
		Headers:  headers,
		reader:   bufio.NewReader(resp.Body),
		response: resp,
	}, nil
}
