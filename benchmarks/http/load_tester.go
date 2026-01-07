// Package http 提供 HTTP API 负载测试工具
package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// LoadTesterConfig 负载测试配置
type LoadTesterConfig struct {
	BaseURL      string        `json:"base_url"`
	Concurrency  int           `json:"concurrency"`
	Duration     time.Duration `json:"duration"`
	RequestRate  int           `json:"request_rate"` // 每秒请求数，0 表示无限制
	AuthEmail    string        `json:"auth_email,omitempty"`
	AuthPassword string        `json:"auth_password,omitempty"`
	Timeout      time.Duration `json:"timeout"`
}

// TestScenario 测试场景定义
type TestScenario struct {
	Name   string                 `json:"name"`
	Method string                 `json:"method"`
	Path   string                 `json:"path"`
	Body   map[string]interface{} `json:"body,omitempty"`
	Weight int                    `json:"weight"` // 权重，用于控制请求分布
}

// HTTPClient PocketBase HTTP 客户端
type HTTPClient struct {
	baseURL   string
	client    *http.Client
	authToken string
	mu        sync.RWMutex
}

// NewHTTPClient 创建新的 HTTP 客户端
func NewHTTPClient(baseURL string, timeout time.Duration) *HTTPClient {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	return &HTTPClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// Authenticate 进行管理员认证
func (c *HTTPClient) Authenticate(email, password string) error {
	authData := map[string]interface{}{
		"identity": email,
		"password": password,
	}

	resp, err := c.Post(context.Background(), "/api/admins/auth-with-password", authData)
	if err != nil {
		return fmt.Errorf("authentication request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("authentication failed with status: %d", resp.StatusCode)
	}

	var authResp struct {
		Token string `json:"token"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return fmt.Errorf("failed to decode auth response: %w", err)
	}

	c.mu.Lock()
	c.authToken = authResp.Token
	c.mu.Unlock()

	return nil
}

// Get 执行 GET 请求
func (c *HTTPClient) Get(ctx context.Context, path string) (*http.Response, error) {
	return c.makeRequest(ctx, "GET", path, nil)
}

// Post 执行 POST 请求
func (c *HTTPClient) Post(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	return c.makeRequest(ctx, "POST", path, body)
}

// Put 执行 PUT 请求
func (c *HTTPClient) Put(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	return c.makeRequest(ctx, "PUT", path, body)
}

// Patch 执行 PATCH 请求
func (c *HTTPClient) Patch(ctx context.Context, path string, body interface{}) (*http.Response, error) {
	return c.makeRequest(ctx, "PATCH", path, body)
}

// Delete 执行 DELETE 请求
func (c *HTTPClient) Delete(ctx context.Context, path string) (*http.Response, error) {
	return c.makeRequest(ctx, "DELETE", path, nil)
}

// makeRequest 创建并执行 HTTP 请求
func (c *HTTPClient) makeRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	url := c.baseURL + path

	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "PocketBase-Benchmark/1.0")

	c.mu.RLock()
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}
	c.mu.RUnlock()

	return c.client.Do(req)
}

// LoadTestResults 负载测试结果
type LoadTestResults struct {
	TotalRequests       int64           `json:"total_requests"`
	SuccessfulRequests  int64           `json:"successful_requests"`
	ErrorRequests       int64           `json:"error_requests"`
	AverageResponseTime time.Duration   `json:"average_response_time"`
	P50ResponseTime     time.Duration   `json:"p50_response_time"`
	P95ResponseTime     time.Duration   `json:"p95_response_time"`
	P99ResponseTime     time.Duration   `json:"p99_response_time"`
	MinResponseTime     time.Duration   `json:"min_response_time"`
	MaxResponseTime     time.Duration   `json:"max_response_time"`
	RequestsPerSecond   float64         `json:"requests_per_second"`
	Duration            time.Duration   `json:"duration"`
	ErrorRate           float64         `json:"error_rate"`
	StatusCodes         map[int]int64   `json:"status_codes"`
	ResponseTimes       []time.Duration `json:"-"`
}

// MetricsCollector 指标收集器
type MetricsCollector struct {
	mu            sync.RWMutex
	responseTimes []time.Duration
	statusCodes   map[int]int64
	totalRequests int64
	startTime     time.Time
}

// NewMetricsCollector 创建新的指标收集器
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		statusCodes:   make(map[int]int64),
		responseTimes: make([]time.Duration, 0, 10000),
		startTime:     time.Now(),
	}
}

// RecordRequest 记录请求指标
func (m *MetricsCollector) RecordRequest(statusCode int, responseTime time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.responseTimes = append(m.responseTimes, responseTime)
	m.statusCodes[statusCode]++
	m.totalRequests++
}

// GetMetrics 获取收集的指标
func (m *MetricsCollector) GetMetrics() *LoadTestResults {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.totalRequests == 0 {
		return &LoadTestResults{StatusCodes: make(map[int]int64)}
	}

	// 计算成功和错误请求数
	var successfulRequests, errorRequests int64
	for code, count := range m.statusCodes {
		if code >= 200 && code < 400 {
			successfulRequests += count
		} else {
			errorRequests += count
		}
	}

	// 计算响应时间统计
	responseTimesCopy := make([]time.Duration, len(m.responseTimes))
	copy(responseTimesCopy, m.responseTimes)
	sort.Slice(responseTimesCopy, func(i, j int) bool {
		return responseTimesCopy[i] < responseTimesCopy[j]
	})

	var totalResponseTime time.Duration
	minRT := responseTimesCopy[0]
	maxRT := responseTimesCopy[0]
	for _, rt := range responseTimesCopy {
		totalResponseTime += rt
		if rt < minRT {
			minRT = rt
		}
		if rt > maxRT {
			maxRT = rt
		}
	}

	avgResponseTime := totalResponseTime / time.Duration(len(responseTimesCopy))

	// 计算百分位数
	p50 := responseTimesCopy[len(responseTimesCopy)*50/100]
	p95 := responseTimesCopy[len(responseTimesCopy)*95/100]
	p99Idx := len(responseTimesCopy) * 99 / 100
	if p99Idx >= len(responseTimesCopy) {
		p99Idx = len(responseTimesCopy) - 1
	}
	p99 := responseTimesCopy[p99Idx]

	// 计算 QPS
	duration := time.Since(m.startTime)
	qps := float64(m.totalRequests) / duration.Seconds()

	// 计算错误率
	errorRate := float64(errorRequests) / float64(m.totalRequests) * 100

	// 复制状态码
	statusCodesCopy := make(map[int]int64)
	for k, v := range m.statusCodes {
		statusCodesCopy[k] = v
	}

	return &LoadTestResults{
		TotalRequests:       m.totalRequests,
		SuccessfulRequests:  successfulRequests,
		ErrorRequests:       errorRequests,
		AverageResponseTime: avgResponseTime,
		P50ResponseTime:     p50,
		P95ResponseTime:     p95,
		P99ResponseTime:     p99,
		MinResponseTime:     minRT,
		MaxResponseTime:     maxRT,
		RequestsPerSecond:   qps,
		Duration:            duration,
		ErrorRate:           errorRate,
		StatusCodes:         statusCodesCopy,
		ResponseTimes:       responseTimesCopy,
	}
}

// LoadTester 负载测试器
type LoadTester struct {
	config    *LoadTesterConfig
	scenarios map[string]*TestScenario
	client    *HTTPClient
	collector *MetricsCollector
	running   int32
}

// NewLoadTester 创建新的负载测试器
func NewLoadTester(config *LoadTesterConfig) *LoadTester {
	return &LoadTester{
		config:    config,
		scenarios: make(map[string]*TestScenario),
		client:    NewHTTPClient(config.BaseURL, config.Timeout),
		collector: NewMetricsCollector(),
	}
}

// AddScenario 添加测试场景
func (lt *LoadTester) AddScenario(name string, scenario *TestScenario) {
	lt.scenarios[name] = scenario
}

// Run 执行负载测试
func (lt *LoadTester) Run(ctx context.Context) (*LoadTestResults, error) {
	// 如果配置了认证信息，先进行认证
	if lt.config.AuthEmail != "" && lt.config.AuthPassword != "" {
		if err := lt.client.Authenticate(lt.config.AuthEmail, lt.config.AuthPassword); err != nil {
			return nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	// 创建权重表用于场景选择
	weightTable := lt.buildWeightTable()
	if len(weightTable) == 0 {
		return nil, fmt.Errorf("no test scenarios configured")
	}

	atomic.StoreInt32(&lt.running, 1)

	// 创建工作协程池
	var wg sync.WaitGroup
	requestChan := make(chan struct{}, lt.config.Concurrency*2)

	// 启动速率控制器
	go lt.rateController(ctx, requestChan)

	// 启动工作协程
	for i := 0; i < lt.config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			lt.worker(ctx, requestChan, weightTable)
		}()
	}

	// 等待测试完成
	testCtx, cancel := context.WithTimeout(ctx, lt.config.Duration)
	defer cancel()

	<-testCtx.Done()
	atomic.StoreInt32(&lt.running, 0)
	close(requestChan)
	wg.Wait()

	return lt.collector.GetMetrics(), nil
}

// rateController 控制请求速率
func (lt *LoadTester) rateController(ctx context.Context, requestChan chan<- struct{}) {
	if lt.config.RequestRate <= 0 {
		// 如果没有设置速率限制，直接发送
		for atomic.LoadInt32(&lt.running) == 1 {
			select {
			case <-ctx.Done():
				return
			case requestChan <- struct{}{}:
			}
		}
		return
	}

	ticker := time.NewTicker(time.Second / time.Duration(lt.config.RequestRate))
	defer ticker.Stop()

	for atomic.LoadInt32(&lt.running) == 1 {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			select {
			case requestChan <- struct{}{}:
			case <-ctx.Done():
				return
			default:
			}
		}
	}
}

// worker 工作协程
func (lt *LoadTester) worker(ctx context.Context, requestChan <-chan struct{}, weightTable []string) {
	for {
		select {
		case <-ctx.Done():
			return
		case _, ok := <-requestChan:
			if !ok {
				return
			}
			lt.executeRequest(ctx, weightTable)
		}
	}
}

// executeRequest 执行单个请求
func (lt *LoadTester) executeRequest(ctx context.Context, weightTable []string) {
	// 随机选择测试场景
	scenarioName := weightTable[rand.Intn(len(weightTable))]
	scenario := lt.scenarios[scenarioName]

	startTime := time.Now()
	var resp *http.Response
	var err error

	// 根据方法执行请求
	switch scenario.Method {
	case "GET":
		resp, err = lt.client.Get(ctx, scenario.Path)
	case "POST":
		resp, err = lt.client.Post(ctx, scenario.Path, scenario.Body)
	case "PUT":
		resp, err = lt.client.Put(ctx, scenario.Path, scenario.Body)
	case "PATCH":
		resp, err = lt.client.Patch(ctx, scenario.Path, scenario.Body)
	case "DELETE":
		resp, err = lt.client.Delete(ctx, scenario.Path)
	default:
		err = fmt.Errorf("unsupported method: %s", scenario.Method)
	}

	responseTime := time.Since(startTime)
	statusCode := 0

	if err != nil {
		statusCode = 0 // 网络错误
	} else {
		statusCode = resp.StatusCode
		resp.Body.Close()
	}

	// 记录指标
	lt.collector.RecordRequest(statusCode, responseTime)
}

// buildWeightTable 构建权重表用于随机选择
func (lt *LoadTester) buildWeightTable() []string {
	var table []string
	for name, scenario := range lt.scenarios {
		weight := scenario.Weight
		if weight <= 0 {
			weight = 1
		}
		for i := 0; i < weight; i++ {
			table = append(table, name)
		}
	}
	return table
}

// PrintResults 打印测试结果
func (results *LoadTestResults) PrintResults() {
	fmt.Printf("\n🎯 HTTP 负载测试结果报告\n")
	fmt.Printf("==========================================\n")
	fmt.Printf("测试持续时间: %v\n", results.Duration)
	fmt.Printf("总请求数: %d\n", results.TotalRequests)
	fmt.Printf("成功请求数: %d\n", results.SuccessfulRequests)
	fmt.Printf("失败请求数: %d\n", results.ErrorRequests)
	fmt.Printf("错误率: %.2f%%\n", results.ErrorRate)
	fmt.Printf("平均 QPS: %.2f\n", results.RequestsPerSecond)
	fmt.Printf("\n📊 响应时间统计:\n")
	fmt.Printf("最小响应时间: %v\n", results.MinResponseTime)
	fmt.Printf("最大响应时间: %v\n", results.MaxResponseTime)
	fmt.Printf("平均响应时间: %v\n", results.AverageResponseTime)
	fmt.Printf("P50 响应时间: %v\n", results.P50ResponseTime)
	fmt.Printf("P95 响应时间: %v\n", results.P95ResponseTime)
	fmt.Printf("P99 响应时间: %v\n", results.P99ResponseTime)
	fmt.Printf("\n📈 状态码分布:\n")
	for code, count := range results.StatusCodes {
		fmt.Printf("  %d: %d\n", code, count)
	}
	fmt.Printf("==========================================\n")
}
