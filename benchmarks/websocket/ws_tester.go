// Package websocket 提供 WebSocket 实时订阅压测工具
package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// TesterConfig WebSocket 压测配置
type TesterConfig struct {
	BaseURL       string        `json:"base_url"`
	Connections   int           `json:"connections"`
	Duration      time.Duration `json:"duration"`
	MessageRate   int           `json:"message_rate"`   // 每秒发送消息数
	SubscribeRate int           `json:"subscribe_rate"` // 每秒订阅数
	AuthToken     string        `json:"auth_token,omitempty"`
}

// Subscription 订阅定义
type Subscription struct {
	ID         string `json:"id"`
	Collection string `json:"collection"`
	Filter     string `json:"filter,omitempty"`
}

// RealtimeMessage PocketBase 实时消息
type RealtimeMessage struct {
	Action string                 `json:"action"`
	Record map[string]interface{} `json:"record"`
}

// Client WebSocket 客户端
type Client struct {
	url         string
	conn        *websocket.Conn
	messageChan chan []byte
	errorChan   chan error
	closeChan   chan struct{}
	mu          sync.RWMutex
	closed      bool
}

// NewClient 创建新的 WebSocket 客户端
func NewClient(wsURL string) *Client {
	return &Client{
		url:         wsURL,
		messageChan: make(chan []byte, 100),
		errorChan:   make(chan error, 10),
		closeChan:   make(chan struct{}),
	}
}

// Connect 连接到 WebSocket 服务器
func (c *Client) Connect(ctx context.Context) error {
	u, err := url.Parse(c.url)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		return fmt.Errorf("websocket dial failed: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	// 启动消息读取协程
	go c.readMessages()

	return nil
}

// readMessages 读取消息的协程
func (c *Client) readMessages() {
	defer func() {
		c.mu.Lock()
		if c.conn != nil {
			c.conn.Close()
		}
		c.mu.Unlock()
		close(c.messageChan)
		close(c.errorChan)
	}()

	for {
		c.mu.RLock()
		conn := c.conn
		closed := c.closed
		c.mu.RUnlock()

		if closed || conn == nil {
			return
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			select {
			case c.errorChan <- err:
			case <-c.closeChan:
				return
			default:
			}
			return
		}

		select {
		case c.messageChan <- message:
		case <-c.closeChan:
			return
		default:
			// 如果通道满了，丢弃消息
		}
	}
}

// SendMessage 发送消息
func (c *Client) SendMessage(message []byte) error {
	c.mu.RLock()
	conn := c.conn
	closed := c.closed
	c.mu.RUnlock()

	if closed || conn == nil {
		return fmt.Errorf("connection is closed")
	}

	return conn.WriteMessage(websocket.TextMessage, message)
}

// MessageChan 获取消息通道
func (c *Client) MessageChan() <-chan []byte {
	return c.messageChan
}

// ErrorChan 获取错误通道
func (c *Client) ErrorChan() <-chan error {
	return c.errorChan
}

// Close 关闭连接
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return
	}

	c.closed = true
	close(c.closeChan)

	if c.conn != nil {
		c.conn.Close()
	}
}

// SubscriptionManager 订阅管理器
type SubscriptionManager struct {
	subscriptions map[string]*Subscription
	mu            sync.RWMutex
}

// NewSubscriptionManager 创建新的订阅管理器
func NewSubscriptionManager() *SubscriptionManager {
	return &SubscriptionManager{
		subscriptions: make(map[string]*Subscription),
	}
}

// AddSubscription 添加订阅
func (sm *SubscriptionManager) AddSubscription(sub *Subscription) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.subscriptions[sub.ID] = sub
}

// RemoveSubscription 移除订阅
func (sm *SubscriptionManager) RemoveSubscription(id string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.subscriptions, id)
}

// GetSubscriptions 获取所有订阅
func (sm *SubscriptionManager) GetSubscriptions() []*Subscription {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	subs := make([]*Subscription, 0, len(sm.subscriptions))
	for _, sub := range sm.subscriptions {
		subs = append(subs, sub)
	}
	return subs
}

// TestResults WebSocket 测试结果
type TestResults struct {
	TotalConnections      int64             `json:"total_connections"`
	SuccessfulConnections int64             `json:"successful_connections"`
	ConnectionErrors      int64             `json:"connection_errors"`
	TotalMessages         int64             `json:"total_messages"`
	TotalSubscriptions    int64             `json:"total_subscriptions"`
	MessagesReceived      int64             `json:"messages_received"`
	AverageLatency        time.Duration     `json:"average_latency"`
	MaxLatency            time.Duration     `json:"max_latency"`
	MinLatency            time.Duration     `json:"min_latency"`
	Duration              time.Duration     `json:"duration"`
	ConnectionsPerSecond  float64           `json:"connections_per_second"`
	MessagesPerSecond     float64           `json:"messages_per_second"`
	MemoryLeakReport      *MemoryLeakReport `json:"memory_leak_report,omitempty"`
}

// MemoryLeakReport 内存泄漏报告
type MemoryLeakReport struct {
	MaxMemoryUsage   uint64   `json:"max_memory_usage"`
	MemoryGrowthRate float64  `json:"memory_growth_rate"`
	MemorySnapshots  []uint64 `json:"memory_snapshots"`
	SuspectedLeak    bool     `json:"suspected_leak"`
}

// MemoryLeakDetector 内存泄漏检测器
type MemoryLeakDetector struct {
	snapshots []uint64
	mu        sync.RWMutex
}

// NewMemoryLeakDetector 创建新的内存泄漏检测器
func NewMemoryLeakDetector() *MemoryLeakDetector {
	return &MemoryLeakDetector{
		snapshots: make([]uint64, 0),
	}
}

// TakeSnapshot 获取当前内存快照
func (mld *MemoryLeakDetector) TakeSnapshot() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	mld.mu.Lock()
	mld.snapshots = append(mld.snapshots, m.Alloc)
	mld.mu.Unlock()
}

// GenerateReport 生成内存泄漏报告
func (mld *MemoryLeakDetector) GenerateReport() *MemoryLeakReport {
	mld.mu.RLock()
	defer mld.mu.RUnlock()

	if len(mld.snapshots) == 0 {
		return &MemoryLeakReport{}
	}

	var maxUsage uint64
	for _, usage := range mld.snapshots {
		if usage > maxUsage {
			maxUsage = usage
		}
	}

	// 计算内存增长率
	var growthRate float64
	if len(mld.snapshots) > 1 {
		first := float64(mld.snapshots[0])
		last := float64(mld.snapshots[len(mld.snapshots)-1])
		if first > 0 {
			growthRate = (last - first) / first * 100
		}
	}

	// 简单的泄漏检测：如果内存增长超过 50% 且最后几个快照都在增长
	suspectedLeak := false
	if growthRate > 50 && len(mld.snapshots) >= 3 {
		lastThree := mld.snapshots[len(mld.snapshots)-3:]
		increasing := true
		for i := 1; i < len(lastThree); i++ {
			if lastThree[i] <= lastThree[i-1] {
				increasing = false
				break
			}
		}
		suspectedLeak = increasing
	}

	return &MemoryLeakReport{
		MaxMemoryUsage:   maxUsage,
		MemoryGrowthRate: growthRate,
		MemorySnapshots:  append([]uint64(nil), mld.snapshots...),
		SuspectedLeak:    suspectedLeak,
	}
}

// Tester WebSocket 压测器
type Tester struct {
	config          *TesterConfig
	subscriptionMgr *SubscriptionManager
	memoryDetector  *MemoryLeakDetector
	results         *TestResults

	// 统计计数器
	totalConnections      int64
	successfulConnections int64
	connectionErrors      int64
	totalMessages         int64
	totalSubscriptions    int64
	messagesReceived      int64

	// 延迟统计
	latencies []time.Duration
	latencyMu sync.Mutex
}

// NewTester 创建新的 WebSocket 压测器
func NewTester(config *TesterConfig) *Tester {
	return &Tester{
		config:          config,
		subscriptionMgr: NewSubscriptionManager(),
		memoryDetector:  NewMemoryLeakDetector(),
		results:         &TestResults{},
		latencies:       make([]time.Duration, 0),
	}
}

// AddSubscription 添加订阅
func (wst *Tester) AddSubscription(sub *Subscription) {
	wst.subscriptionMgr.AddSubscription(sub)
}

// Run 执行 WebSocket 压测
func (wst *Tester) Run(ctx context.Context) (*TestResults, error) {
	startTime := time.Now()

	// 启动内存监控
	go wst.monitorMemory(ctx)

	// 创建工作协程池
	var wg sync.WaitGroup

	// 启动连接工作协程
	for i := 0; i < wst.config.Connections; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			wst.connectionWorker(ctx, id)
		}(i)
	}

	// 等待测试完成
	testCtx, cancel := context.WithTimeout(ctx, wst.config.Duration)
	defer cancel()

	<-testCtx.Done()

	// 等待所有工作协程完成
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		// 强制超时
	}

	// 计算结果
	duration := time.Since(startTime)
	wst.calculateResults(duration)

	return wst.results, nil
}

// connectionWorker 连接工作协程
func (wst *Tester) connectionWorker(ctx context.Context, id int) {
	atomic.AddInt64(&wst.totalConnections, 1)

	client := NewClient(wst.config.BaseURL)
	defer client.Close()

	// 尝试连接
	connectStart := time.Now()
	if err := client.Connect(ctx); err != nil {
		atomic.AddInt64(&wst.connectionErrors, 1)
		return
	}
	connectLatency := time.Since(connectStart)

	wst.recordLatency(connectLatency)
	atomic.AddInt64(&wst.successfulConnections, 1)

	// 启动消息处理协程
	go wst.messageHandler(client)

	// 发送订阅消息
	subscriptions := wst.subscriptionMgr.GetSubscriptions()
	for _, sub := range subscriptions {
		subscribeMsg := map[string]interface{}{
			"clientId": fmt.Sprintf("client_%d", id),
			"subscriptions": []map[string]interface{}{
				{
					"topic": fmt.Sprintf("%s/*", sub.Collection),
				},
			},
		}

		msgBytes, _ := json.Marshal(subscribeMsg)
		if err := client.SendMessage(msgBytes); err == nil {
			atomic.AddInt64(&wst.totalSubscriptions, 1)
		}
	}

	// 定期发送消息
	if wst.config.MessageRate > 0 {
		ticker := time.NewTicker(time.Second / time.Duration(wst.config.MessageRate))
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				testMsg := map[string]interface{}{
					"type": "ping",
					"data": map[string]interface{}{
						"timestamp": time.Now().Unix(),
						"clientId":  id,
					},
				}

				msgBytes, _ := json.Marshal(testMsg)
				if err := client.SendMessage(msgBytes); err == nil {
					atomic.AddInt64(&wst.totalMessages, 1)
				}
			}
		}
	} else {
		// 如果没有设置消息速率，就等待上下文结束
		<-ctx.Done()
	}
}

// messageHandler 消息处理协程
func (wst *Tester) messageHandler(client *Client) {
	for {
		select {
		case message := <-client.MessageChan():
			if message != nil {
				atomic.AddInt64(&wst.messagesReceived, 1)
			}
		case err := <-client.ErrorChan():
			if err != nil {
				atomic.AddInt64(&wst.connectionErrors, 1)
				return
			}
		}
	}
}

// recordLatency 记录延迟
func (wst *Tester) recordLatency(latency time.Duration) {
	wst.latencyMu.Lock()
	defer wst.latencyMu.Unlock()
	wst.latencies = append(wst.latencies, latency)
}

// monitorMemory 监控内存使用
func (wst *Tester) monitorMemory(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			wst.memoryDetector.TakeSnapshot()
		}
	}
}

// calculateResults 计算测试结果
func (wst *Tester) calculateResults(duration time.Duration) {
	wst.results.TotalConnections = atomic.LoadInt64(&wst.totalConnections)
	wst.results.SuccessfulConnections = atomic.LoadInt64(&wst.successfulConnections)
	wst.results.ConnectionErrors = atomic.LoadInt64(&wst.connectionErrors)
	wst.results.TotalMessages = atomic.LoadInt64(&wst.totalMessages)
	wst.results.TotalSubscriptions = atomic.LoadInt64(&wst.totalSubscriptions)
	wst.results.MessagesReceived = atomic.LoadInt64(&wst.messagesReceived)
	wst.results.Duration = duration

	// 计算速率
	seconds := duration.Seconds()
	wst.results.ConnectionsPerSecond = float64(wst.results.SuccessfulConnections) / seconds
	wst.results.MessagesPerSecond = float64(wst.results.TotalMessages) / seconds

	// 计算延迟统计
	wst.latencyMu.Lock()
	if len(wst.latencies) > 0 {
		var total time.Duration
		min := wst.latencies[0]
		max := wst.latencies[0]

		for _, latency := range wst.latencies {
			total += latency
			if latency < min {
				min = latency
			}
			if latency > max {
				max = latency
			}
		}

		wst.results.AverageLatency = total / time.Duration(len(wst.latencies))
		wst.results.MinLatency = min
		wst.results.MaxLatency = max
	}
	wst.latencyMu.Unlock()

	// 生成内存泄漏报告
	wst.results.MemoryLeakReport = wst.memoryDetector.GenerateReport()
}

// PrintResults 打印测试结果
func (results *TestResults) PrintResults() {
	fmt.Printf("\n🔌 WebSocket 压测结果报告\n")
	fmt.Printf("==========================================\n")
	fmt.Printf("测试持续时间: %v\n", results.Duration)
	fmt.Printf("总连接数: %d\n", results.TotalConnections)
	fmt.Printf("成功连接数: %d\n", results.SuccessfulConnections)
	fmt.Printf("连接错误数: %d\n", results.ConnectionErrors)
	if results.TotalConnections > 0 {
		fmt.Printf("连接成功率: %.2f%%\n", float64(results.SuccessfulConnections)/float64(results.TotalConnections)*100)
	}
	fmt.Printf("平均连接速率: %.2f 连接/秒\n", results.ConnectionsPerSecond)

	fmt.Printf("\n📨 消息统计:\n")
	fmt.Printf("发送消息数: %d\n", results.TotalMessages)
	fmt.Printf("接收消息数: %d\n", results.MessagesReceived)
	fmt.Printf("订阅数: %d\n", results.TotalSubscriptions)
	fmt.Printf("消息发送速率: %.2f 消息/秒\n", results.MessagesPerSecond)

	fmt.Printf("\n⏱️ 延迟统计:\n")
	fmt.Printf("平均延迟: %v\n", results.AverageLatency)
	fmt.Printf("最小延迟: %v\n", results.MinLatency)
	fmt.Printf("最大延迟: %v\n", results.MaxLatency)

	if results.MemoryLeakReport != nil {
		fmt.Printf("\n🧠 内存使用报告:\n")
		fmt.Printf("最大内存使用: %.2f MB\n", float64(results.MemoryLeakReport.MaxMemoryUsage)/1024/1024)
		fmt.Printf("内存增长率: %.2f%%\n", results.MemoryLeakReport.MemoryGrowthRate)
		if results.MemoryLeakReport.SuspectedLeak {
			fmt.Printf("⚠️  检测到可能的内存泄漏\n")
		} else {
			fmt.Printf("✅ 未检测到明显内存泄漏\n")
		}
	}

	fmt.Printf("==========================================\n")
}
