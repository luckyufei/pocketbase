// Package database 提供数据库直连性能测试工具
package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

// TesterConfig 数据库测试配置
type TesterConfig struct {
	DatabaseType     string        `json:"database_type"`     // "sqlite" or "postgres"
	ConnectionString string        `json:"connection_string"` // 数据库连接字符串
	MaxConnections   int           `json:"max_connections"`   // 最大连接数
	Duration         time.Duration `json:"duration"`          // 测试持续时间
	ReadRatio        float64       `json:"read_ratio"`        // 读操作比例 (0.0-1.0)
	BatchSize        int           `json:"batch_size"`        // 批量操作大小
	TableName        string        `json:"table_name"`        // 测试表名
}

// TestResult 测试结果
type TestResult struct {
	TotalOperations  int64         `json:"total_operations"`
	ReadOperations   int64         `json:"read_operations"`
	WriteOperations  int64         `json:"write_operations"`
	SuccessfulOps    int64         `json:"successful_ops"`
	FailedOps        int64         `json:"failed_ops"`
	AvgLatency       time.Duration `json:"avg_latency"`
	P50Latency       time.Duration `json:"p50_latency"`
	P95Latency       time.Duration `json:"p95_latency"`
	P99Latency       time.Duration `json:"p99_latency"`
	MinLatency       time.Duration `json:"min_latency"`
	MaxLatency       time.Duration `json:"max_latency"`
	QPS              float64       `json:"qps"`
	TPS              float64       `json:"tps"`
	ConnectionErrors int64         `json:"connection_errors"`
	TestDuration     time.Duration `json:"test_duration"`
	SuccessRate      float64       `json:"success_rate"`
}

// Tester 数据库性能测试器
type Tester struct {
	config     TesterConfig
	db         *sql.DB
	results    TestResult
	latencies  []time.Duration
	latencyMux sync.Mutex
}

// NewTester 创建新的数据库测试器
func NewTester(config TesterConfig) *Tester {
	if config.TableName == "" {
		config.TableName = "benchmark_test"
	}
	if config.MaxConnections <= 0 {
		config.MaxConnections = 10
	}
	if config.ReadRatio < 0 || config.ReadRatio > 1 {
		config.ReadRatio = 0.7
	}
	return &Tester{
		config:    config,
		latencies: make([]time.Duration, 0, 10000),
	}
}

// Connect 连接到数据库
func (dt *Tester) Connect() error {
	var err error
	dt.db, err = sql.Open(dt.config.DatabaseType, dt.config.ConnectionString)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	dt.db.SetMaxOpenConns(dt.config.MaxConnections)
	dt.db.SetMaxIdleConns(dt.config.MaxConnections / 2)
	dt.db.SetConnMaxLifetime(5 * time.Minute)

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := dt.db.PingContext(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	return nil
}

// SetupTestTable 创建测试表
func (dt *Tester) SetupTestTable() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var createTableSQL string
	switch dt.config.DatabaseType {
	case "sqlite":
		createTableSQL = fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS %s (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				email TEXT UNIQUE,
				age INTEGER,
				data TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`, dt.config.TableName)
	case "postgres":
		createTableSQL = fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS %s (
				id SERIAL PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				email VARCHAR(255) UNIQUE,
				age INTEGER,
				data TEXT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)`, dt.config.TableName)
	default:
		return fmt.Errorf("unsupported database type: %s", dt.config.DatabaseType)
	}

	if _, err := dt.db.ExecContext(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create test table: %w", err)
	}

	// 创建索引
	indexSQL := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_%s_email ON %s(email)", dt.config.TableName, dt.config.TableName)
	if _, err := dt.db.ExecContext(ctx, indexSQL); err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	return nil
}

// recordLatency 记录延迟
func (dt *Tester) recordLatency(latency time.Duration) {
	dt.latencyMux.Lock()
	dt.latencies = append(dt.latencies, latency)
	dt.latencyMux.Unlock()
}

// performRead 执行读操作
func (dt *Tester) performRead(ctx context.Context) error {
	start := time.Now()
	defer func() {
		dt.recordLatency(time.Since(start))
	}()

	id := rand.Intn(1000) + 1
	query := fmt.Sprintf("SELECT id, name, email, age FROM %s WHERE id = $1", dt.config.TableName)

	if dt.config.DatabaseType == "sqlite" {
		query = fmt.Sprintf("SELECT id, name, email, age FROM %s WHERE id = ?", dt.config.TableName)
	}

	var resultID int
	var name, email string
	var age int

	err := dt.db.QueryRowContext(ctx, query, id).Scan(&resultID, &name, &email, &age)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	atomic.AddInt64(&dt.results.ReadOperations, 1)
	return nil
}

// performWrite 执行写操作
func (dt *Tester) performWrite(ctx context.Context) error {
	start := time.Now()
	defer func() {
		dt.recordLatency(time.Since(start))
	}()

	name := fmt.Sprintf("User_%d", rand.Intn(100000))
	email := fmt.Sprintf("user_%d_%d@example.com", rand.Intn(100000), time.Now().UnixNano())
	age := rand.Intn(80) + 18
	data := fmt.Sprintf(`{"random": %d, "timestamp": "%s"}`, rand.Intn(1000), time.Now().Format(time.RFC3339))

	query := fmt.Sprintf("INSERT INTO %s (name, email, age, data) VALUES ($1, $2, $3, $4)", dt.config.TableName)
	if dt.config.DatabaseType == "sqlite" {
		query = fmt.Sprintf("INSERT INTO %s (name, email, age, data) VALUES (?, ?, ?, ?)", dt.config.TableName)
	}

	_, err := dt.db.ExecContext(ctx, query, name, email, age, data)
	if err != nil {
		return err
	}

	atomic.AddInt64(&dt.results.WriteOperations, 1)
	return nil
}

// RunTest 运行性能测试
func (dt *Tester) RunTest() error {
	fmt.Printf("🚀 开始数据库性能测试 (%s)...\n", dt.config.DatabaseType)
	fmt.Printf("📊 配置: 连接数=%d, 持续时间=%v, 读比例=%.2f\n",
		dt.config.MaxConnections, dt.config.Duration, dt.config.ReadRatio)

	startTime := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), dt.config.Duration)
	defer cancel()

	var wg sync.WaitGroup

	// 启动工作协程
	for i := 0; i < dt.config.MaxConnections; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			dt.worker(ctx)
		}()
	}

	wg.Wait()
	dt.results.TestDuration = time.Since(startTime)

	return dt.calculateResults()
}

// worker 工作协程
func (dt *Tester) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			var err error
			if rand.Float64() < dt.config.ReadRatio {
				err = dt.performRead(ctx)
			} else {
				err = dt.performWrite(ctx)
			}

			atomic.AddInt64(&dt.results.TotalOperations, 1)
			if err != nil {
				atomic.AddInt64(&dt.results.FailedOps, 1)
			} else {
				atomic.AddInt64(&dt.results.SuccessfulOps, 1)
			}

			// 短暂休息避免过度压力
			time.Sleep(time.Millisecond)
		}
	}
}

// calculateResults 计算测试结果
func (dt *Tester) calculateResults() error {
	dt.latencyMux.Lock()
	defer dt.latencyMux.Unlock()

	if len(dt.latencies) == 0 {
		return fmt.Errorf("no latency data collected")
	}

	// 计算平均延迟
	var totalLatency time.Duration
	minLat := dt.latencies[0]
	maxLat := dt.latencies[0]
	for _, latency := range dt.latencies {
		totalLatency += latency
		if latency < minLat {
			minLat = latency
		}
		if latency > maxLat {
			maxLat = latency
		}
	}
	dt.results.AvgLatency = totalLatency / time.Duration(len(dt.latencies))
	dt.results.MinLatency = minLat
	dt.results.MaxLatency = maxLat

	// 计算百分位数
	sortedLatencies := make([]time.Duration, len(dt.latencies))
	copy(sortedLatencies, dt.latencies)
	sort.Slice(sortedLatencies, func(i, j int) bool {
		return sortedLatencies[i] < sortedLatencies[j]
	})

	p50Index := len(sortedLatencies) * 50 / 100
	p95Index := len(sortedLatencies) * 95 / 100
	p99Index := len(sortedLatencies) * 99 / 100

	if p50Index >= len(sortedLatencies) {
		p50Index = len(sortedLatencies) - 1
	}
	if p95Index >= len(sortedLatencies) {
		p95Index = len(sortedLatencies) - 1
	}
	if p99Index >= len(sortedLatencies) {
		p99Index = len(sortedLatencies) - 1
	}

	dt.results.P50Latency = sortedLatencies[p50Index]
	dt.results.P95Latency = sortedLatencies[p95Index]
	dt.results.P99Latency = sortedLatencies[p99Index]

	// 计算 QPS 和 TPS
	seconds := dt.results.TestDuration.Seconds()
	dt.results.QPS = float64(dt.results.ReadOperations) / seconds
	dt.results.TPS = float64(dt.results.WriteOperations) / seconds

	// 计算成功率
	if dt.results.TotalOperations > 0 {
		dt.results.SuccessRate = float64(dt.results.SuccessfulOps) / float64(dt.results.TotalOperations) * 100
	}

	return nil
}

// PrintResults 打印测试结果
func (dt *Tester) PrintResults() {
	fmt.Printf("\n📈 数据库性能测试结果 (%s)\n", dt.config.DatabaseType)
	fmt.Printf("==========================================\n")
	fmt.Printf("总操作数:     %d\n", dt.results.TotalOperations)
	fmt.Printf("读操作数:     %d\n", dt.results.ReadOperations)
	fmt.Printf("写操作数:     %d\n", dt.results.WriteOperations)
	fmt.Printf("成功操作:     %d\n", dt.results.SuccessfulOps)
	fmt.Printf("失败操作:     %d\n", dt.results.FailedOps)
	fmt.Printf("成功率:       %.2f%%\n", dt.results.SuccessRate)
	fmt.Printf("\n⏱️ 延迟统计:\n")
	fmt.Printf("最小延迟:     %v\n", dt.results.MinLatency)
	fmt.Printf("最大延迟:     %v\n", dt.results.MaxLatency)
	fmt.Printf("平均延迟:     %v\n", dt.results.AvgLatency)
	fmt.Printf("P50 延迟:     %v\n", dt.results.P50Latency)
	fmt.Printf("P95 延迟:     %v\n", dt.results.P95Latency)
	fmt.Printf("P99 延迟:     %v\n", dt.results.P99Latency)
	fmt.Printf("\n📊 吞吐量:\n")
	fmt.Printf("读 QPS:       %.2f\n", dt.results.QPS)
	fmt.Printf("写 TPS:       %.2f\n", dt.results.TPS)
	fmt.Printf("测试时长:     %v\n", dt.results.TestDuration)
	fmt.Printf("==========================================\n")
}

// GetResults 获取测试结果
func (dt *Tester) GetResults() TestResult {
	return dt.results
}

// Close 关闭数据库连接
func (dt *Tester) Close() error {
	if dt.db != nil {
		return dt.db.Close()
	}
	return nil
}

// CleanupTestTable 清理测试表
func (dt *Tester) CleanupTestTable() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	dropSQL := fmt.Sprintf("DROP TABLE IF EXISTS %s", dt.config.TableName)
	if dt.config.DatabaseType == "postgres" {
		dropSQL = fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE", dt.config.TableName)
	}

	_, err := dt.db.ExecContext(ctx, dropSQL)
	return err
}

// LoadConfig 从文件加载配置
func LoadConfig(filename string) (TesterConfig, error) {
	var config TesterConfig

	data, err := os.ReadFile(filename)
	if err != nil {
		return config, err
	}

	err = json.Unmarshal(data, &config)
	return config, err
}
