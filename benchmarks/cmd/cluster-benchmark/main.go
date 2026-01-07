// PostgreSQL 集群性能测试工具
// 测试读写分离、负载均衡、故障转移等集群特性

package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
)

// ClusterConfig 集群配置
type ClusterConfig struct {
	PrimaryHost   string `json:"primary_host"`
	PrimaryPort   int    `json:"primary_port"`
	ReplicaHosts  []string `json:"replica_hosts"`
	ReplicaPorts  []int    `json:"replica_ports"`
	HAProxyHost   string `json:"haproxy_host"`
	HAProxyWrite  int    `json:"haproxy_write_port"`
	HAProxyRead   int    `json:"haproxy_read_port"`
	User          string `json:"user"`
	Password      string `json:"password"`
	Database      string `json:"database"`
	Duration      time.Duration `json:"duration"`
	Concurrency   int    `json:"concurrency"`
	ReadRatio     float64 `json:"read_ratio"`
	WarmupSeconds int    `json:"warmup_seconds"`
	Verbose       bool   `json:"verbose"`
}

// ClusterBenchmarkResult 集群测试结果
type ClusterBenchmarkResult struct {
	TestTime          string                  `json:"test_time"`
	ClusterSize       int                     `json:"cluster_size"`
	Duration          float64                 `json:"duration_seconds"`
	Concurrency       int                     `json:"concurrency"`
	
	// 总体性能
	TotalOps          int64                   `json:"total_ops"`
	ReadOps           int64                   `json:"read_ops"`
	WriteOps          int64                   `json:"write_ops"`
	TotalOPS          float64                 `json:"total_ops_per_sec"`
	ReadQPS           float64                 `json:"read_qps"`
	WriteTPS          float64                 `json:"write_tps"`
	
	// 延迟统计
	AvgLatencyMs      float64                 `json:"avg_latency_ms"`
	MinLatencyMs      float64                 `json:"min_latency_ms"`
	MaxLatencyMs      float64                 `json:"max_latency_ms"`
	P50LatencyMs      float64                 `json:"p50_latency_ms"`
	P95LatencyMs      float64                 `json:"p95_latency_ms"`
	P99LatencyMs      float64                 `json:"p99_latency_ms"`
	
	// 成功率
	SuccessOps        int64                   `json:"success_ops"`
	FailedOps         int64                   `json:"failed_ops"`
	SuccessRate       float64                 `json:"success_rate"`
	
	// 节点性能
	PrimaryStats      *NodeStats              `json:"primary_stats"`
	ReplicaStats      []*NodeStats            `json:"replica_stats"`
	
	// 复制延迟
	ReplicationLagMs  []float64               `json:"replication_lag_ms"`
	
	// 扩展性指标
	ReadScalability   float64                 `json:"read_scalability"`  // 读扩展线性度
}

// NodeStats 节点统计
type NodeStats struct {
	Host          string  `json:"host"`
	Port          int     `json:"port"`
	Role          string  `json:"role"`
	Ops           int64   `json:"ops"`
	OPS           float64 `json:"ops_per_sec"`
	AvgLatencyMs  float64 `json:"avg_latency_ms"`
	SuccessRate   float64 `json:"success_rate"`
}

// ClusterBenchmark 集群基准测试器
type ClusterBenchmark struct {
	config      ClusterConfig
	primaryDB   *sql.DB
	replicaDBs  []*sql.DB
	haproxyRead *sql.DB
	haproxyWrite *sql.DB
	
	// 统计
	readCount    int64
	writeCount   int64
	successCount int64
	failedCount  int64
	
	latencies    []time.Duration
	latencyMu    sync.Mutex
	
	// 节点统计
	primaryOps   int64
	replicaOps   []int64
}

func main() {
	// 命令行参数
	duration := flag.Duration("duration", 30*time.Second, "测试持续时间")
	concurrency := flag.Int("concurrency", 20, "并发数")
	readRatio := flag.Float64("read-ratio", 0.8, "读操作比例 (0.0-1.0)")
	primaryHost := flag.String("primary-host", "localhost", "主节点主机")
	primaryPort := flag.Int("primary-port", 5440, "主节点端口")
	replicaHosts := flag.String("replica-hosts", "localhost", "从节点主机 (逗号分隔)")
	replicaPorts := flag.String("replica-ports", "5441", "从节点端口 (逗号分隔)")
	haproxyHost := flag.String("haproxy-host", "localhost", "HAProxy 主机")
	haproxyWrite := flag.Int("haproxy-write", 5450, "HAProxy 写入端口")
	haproxyRead := flag.Int("haproxy-read", 5451, "HAProxy 读取端口")
	user := flag.String("user", "pocketbase", "数据库用户")
	password := flag.String("password", "pocketbase_test_password", "数据库密码")
	database := flag.String("database", "pocketbase_test", "数据库名称")
	outputDir := flag.String("output", "./reports/cluster", "结果输出目录")
	verbose := flag.Bool("verbose", false, "详细输出")
	warmup := flag.Int("warmup", 5, "预热时间 (秒)")
	useHAProxy := flag.Bool("use-haproxy", false, "使用 HAProxy 进行测试")
	
	flag.Parse()
	
	// 解析从节点配置
	var rHosts []string
	var rPorts []int
	if *replicaHosts != "" {
		for _, h := range splitString(*replicaHosts) {
			rHosts = append(rHosts, h)
		}
	}
	if *replicaPorts != "" {
		for _, p := range splitString(*replicaPorts) {
			port := 5441
			fmt.Sscanf(p, "%d", &port)
			rPorts = append(rPorts, port)
		}
	}
	
	config := ClusterConfig{
		PrimaryHost:   *primaryHost,
		PrimaryPort:   *primaryPort,
		ReplicaHosts:  rHosts,
		ReplicaPorts:  rPorts,
		HAProxyHost:   *haproxyHost,
		HAProxyWrite:  *haproxyWrite,
		HAProxyRead:   *haproxyRead,
		User:          *user,
		Password:      *password,
		Database:      *database,
		Duration:      *duration,
		Concurrency:   *concurrency,
		ReadRatio:     *readRatio,
		WarmupSeconds: *warmup,
		Verbose:       *verbose,
	}
	
	fmt.Println("🚀 PocketBase PostgreSQL 集群性能测试")
	fmt.Println("=====================================")
	fmt.Printf("📊 配置: 并发=%d, 持续时间=%v, 读比例=%.2f\n", config.Concurrency, config.Duration, config.ReadRatio)
	fmt.Printf("📊 集群: 主节点=%s:%d, 从节点数=%d\n", config.PrimaryHost, config.PrimaryPort, len(config.ReplicaHosts))
	if *useHAProxy {
		fmt.Printf("📊 HAProxy: 写=%s:%d, 读=%s:%d\n", config.HAProxyHost, config.HAProxyWrite, config.HAProxyHost, config.HAProxyRead)
	}
	fmt.Println()
	
	// 创建基准测试器
	benchmark := NewClusterBenchmark(config)
	
	// 设置
	if err := benchmark.Setup(*useHAProxy); err != nil {
		fmt.Printf("❌ 设置失败: %v\n", err)
		os.Exit(1)
	}
	defer benchmark.Cleanup()
	
	// 运行测试
	result, err := benchmark.Run(*useHAProxy)
	if err != nil {
		fmt.Printf("❌ 测试失败: %v\n", err)
		os.Exit(1)
	}
	
	// 输出结果
	printClusterResults(result, config.Verbose)
	
	// 保存结果
	if err := saveClusterResults(result, *outputDir); err != nil {
		fmt.Printf("⚠️ 保存结果失败: %v\n", err)
	}
}

func splitString(s string) []string {
	var result []string
	current := ""
	for _, c := range s {
		if c == ',' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

// NewClusterBenchmark 创建集群基准测试器
func NewClusterBenchmark(config ClusterConfig) *ClusterBenchmark {
	return &ClusterBenchmark{
		config:     config,
		latencies:  make([]time.Duration, 0, 100000),
		replicaOps: make([]int64, len(config.ReplicaHosts)),
	}
}

// Setup 设置测试环境
func (cb *ClusterBenchmark) Setup(useHAProxy bool) error {
	var err error
	
	// 连接主节点
	primaryDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cb.config.PrimaryHost, cb.config.PrimaryPort, cb.config.User, cb.config.Password, cb.config.Database)
	cb.primaryDB, err = sql.Open("postgres", primaryDSN)
	if err != nil {
		return fmt.Errorf("连接主节点失败: %w", err)
	}
	cb.primaryDB.SetMaxOpenConns(cb.config.Concurrency)
	cb.primaryDB.SetMaxIdleConns(cb.config.Concurrency / 2)
	
	if err := cb.primaryDB.Ping(); err != nil {
		return fmt.Errorf("主节点 ping 失败: %w", err)
	}
	
	if cb.config.Verbose {
		fmt.Printf("✅ 已连接主节点: %s:%d\n", cb.config.PrimaryHost, cb.config.PrimaryPort)
	}
	
	// 连接从节点
	for i, host := range cb.config.ReplicaHosts {
		port := cb.config.ReplicaPorts[i]
		replicaDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			host, port, cb.config.User, cb.config.Password, cb.config.Database)
		replicaDB, err := sql.Open("postgres", replicaDSN)
		if err != nil {
			fmt.Printf("⚠️ 连接从节点 %s:%d 失败: %v\n", host, port, err)
			continue
		}
		replicaDB.SetMaxOpenConns(cb.config.Concurrency)
		replicaDB.SetMaxIdleConns(cb.config.Concurrency / 2)
		
		if err := replicaDB.Ping(); err != nil {
			fmt.Printf("⚠️ 从节点 %s:%d ping 失败: %v\n", host, port, err)
			replicaDB.Close()
			continue
		}
		
		cb.replicaDBs = append(cb.replicaDBs, replicaDB)
		if cb.config.Verbose {
			fmt.Printf("✅ 已连接从节点: %s:%d\n", host, port)
		}
	}
	
	// 连接 HAProxy
	if useHAProxy {
		writeHADSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			cb.config.HAProxyHost, cb.config.HAProxyWrite, cb.config.User, cb.config.Password, cb.config.Database)
		cb.haproxyWrite, err = sql.Open("postgres", writeHADSN)
		if err != nil {
			return fmt.Errorf("连接 HAProxy 写入端口失败: %w", err)
		}
		
		readHADSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			cb.config.HAProxyHost, cb.config.HAProxyRead, cb.config.User, cb.config.Password, cb.config.Database)
		cb.haproxyRead, err = sql.Open("postgres", readHADSN)
		if err != nil {
			return fmt.Errorf("连接 HAProxy 读取端口失败: %w", err)
		}
		
		if cb.config.Verbose {
			fmt.Printf("✅ 已连接 HAProxy: 写=%d, 读=%d\n", cb.config.HAProxyWrite, cb.config.HAProxyRead)
		}
	}
	
	// 创建测试表
	if err := cb.createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}
	
	// 填充测试数据
	if err := cb.seedData(); err != nil {
		return fmt.Errorf("填充数据失败: %w", err)
	}
	
	// 等待复制同步
	time.Sleep(2 * time.Second)
	
	return nil
}

func (cb *ClusterBenchmark) createTables() error {
	_, err := cb.primaryDB.Exec(`
		CREATE TABLE IF NOT EXISTS cluster_users (
			id SERIAL PRIMARY KEY,
			username VARCHAR(100) NOT NULL UNIQUE,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			full_name VARCHAR(200),
			bio TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			is_active BOOLEAN DEFAULT TRUE
		);
		CREATE INDEX IF NOT EXISTS idx_cluster_users_email ON cluster_users(email);
		CREATE INDEX IF NOT EXISTS idx_cluster_users_username ON cluster_users(username);
		
		CREATE TABLE IF NOT EXISTS cluster_posts (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES cluster_users(id),
			title VARCHAR(500) NOT NULL,
			slug VARCHAR(500) UNIQUE,
			content TEXT,
			status VARCHAR(50) DEFAULT 'draft',
			view_count INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_cluster_posts_user_id ON cluster_posts(user_id);
		CREATE INDEX IF NOT EXISTS idx_cluster_posts_status ON cluster_posts(status);
	`)
	return err
}

func (cb *ClusterBenchmark) seedData() error {
	// 检查是否已有数据
	var count int
	cb.primaryDB.QueryRow("SELECT COUNT(*) FROM cluster_users").Scan(&count)
	if count > 0 {
		if cb.config.Verbose {
			fmt.Printf("📊 已有测试数据: %d 用户\n", count)
		}
		return nil
	}
	
	if cb.config.Verbose {
		fmt.Println("📊 填充测试数据...")
	}
	
	tx, err := cb.primaryDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	// 插入用户
	userStmt, err := tx.Prepare(`INSERT INTO cluster_users (username, email, password_hash, full_name, bio, is_active) VALUES ($1, $2, $3, $4, $5, $6)`)
	if err != nil {
		return err
	}
	defer userStmt.Close()
	
	for i := 0; i < 1000; i++ {
		username := fmt.Sprintf("cluster_user_%d", i)
		email := fmt.Sprintf("cluster_user_%d@example.com", i)
		_, err := userStmt.Exec(username, email, "hash", fmt.Sprintf("User %d", i), "Bio", true)
		if err != nil {
			return err
		}
	}
	
	// 插入文章
	postStmt, err := tx.Prepare(`INSERT INTO cluster_posts (user_id, title, slug, content, status, view_count) VALUES ($1, $2, $3, $4, $5, $6)`)
	if err != nil {
		return err
	}
	defer postStmt.Close()
	
	statuses := []string{"draft", "published", "archived"}
	for i := 0; i < 5000; i++ {
		userID := rand.Intn(1000) + 1
		title := fmt.Sprintf("Cluster Post Title %d", i)
		slug := fmt.Sprintf("cluster-post-%d", i)
		content := fmt.Sprintf("Content for cluster post %d", i)
		status := statuses[rand.Intn(len(statuses))]
		viewCount := rand.Intn(10000)
		_, err := postStmt.Exec(userID, title, slug, content, status, viewCount)
		if err != nil {
			return err
		}
	}
	
	return tx.Commit()
}

// Run 运行基准测试
func (cb *ClusterBenchmark) Run(useHAProxy bool) (*ClusterBenchmarkResult, error) {
	// 预热
	if cb.config.WarmupSeconds > 0 {
		if cb.config.Verbose {
			fmt.Printf("🔥 预热中 (%d 秒)...\n", cb.config.WarmupSeconds)
		}
		cb.runWorkload(time.Duration(cb.config.WarmupSeconds)*time.Second, useHAProxy, false)
		cb.resetStats()
	}
	
	if cb.config.Verbose {
		fmt.Printf("🚀 开始测试 (%v)...\n", cb.config.Duration)
	}
	
	// 正式测试
	startTime := time.Now()
	cb.runWorkload(cb.config.Duration, useHAProxy, true)
	duration := time.Since(startTime)
	
	// 计算结果
	return cb.calculateResults(duration)
}

func (cb *ClusterBenchmark) resetStats() {
	cb.readCount = 0
	cb.writeCount = 0
	cb.successCount = 0
	cb.failedCount = 0
	cb.primaryOps = 0
	for i := range cb.replicaOps {
		cb.replicaOps[i] = 0
	}
	cb.latencyMu.Lock()
	cb.latencies = make([]time.Duration, 0, 100000)
	cb.latencyMu.Unlock()
}

func (cb *ClusterBenchmark) runWorkload(duration time.Duration, useHAProxy bool, recordStats bool) {
	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()
	
	var wg sync.WaitGroup
	for i := 0; i < cb.config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cb.worker(ctx, useHAProxy, recordStats)
		}()
	}
	wg.Wait()
}

func (cb *ClusterBenchmark) worker(ctx context.Context, useHAProxy bool, recordStats bool) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			start := time.Now()
			var err error
			
			if rand.Float64() < cb.config.ReadRatio {
				// 读操作 - 从从节点或 HAProxy 读取
				err = cb.performRead(ctx, useHAProxy)
				if recordStats {
					atomic.AddInt64(&cb.readCount, 1)
				}
			} else {
				// 写操作 - 写入主节点或 HAProxy
				err = cb.performWrite(ctx, useHAProxy)
				if recordStats {
					atomic.AddInt64(&cb.writeCount, 1)
				}
			}
			
			if recordStats {
				latency := time.Since(start)
				cb.latencyMu.Lock()
				cb.latencies = append(cb.latencies, latency)
				cb.latencyMu.Unlock()
				
				if err != nil {
					atomic.AddInt64(&cb.failedCount, 1)
				} else {
					atomic.AddInt64(&cb.successCount, 1)
				}
			}
		}
	}
}

func (cb *ClusterBenchmark) performRead(ctx context.Context, useHAProxy bool) error {
	var db *sql.DB
	var replicaIdx int = -1
	
	if useHAProxy && cb.haproxyRead != nil {
		db = cb.haproxyRead
	} else if len(cb.replicaDBs) > 0 {
		// 轮询从节点
		replicaIdx = rand.Intn(len(cb.replicaDBs))
		db = cb.replicaDBs[replicaIdx]
		atomic.AddInt64(&cb.replicaOps[replicaIdx], 1)
	} else {
		db = cb.primaryDB
		atomic.AddInt64(&cb.primaryOps, 1)
	}
	
	readType := rand.Intn(3)
	switch readType {
	case 0:
		// 按 ID 读取
		id := rand.Intn(1000) + 1
		var username, email string
		return db.QueryRowContext(ctx, "SELECT username, email FROM cluster_users WHERE id = $1", id).Scan(&username, &email)
	case 1:
		// 按索引读取
		email := fmt.Sprintf("cluster_user_%d@example.com", rand.Intn(1000))
		var id int
		var username string
		err := db.QueryRowContext(ctx, "SELECT id, username FROM cluster_users WHERE email = $1", email).Scan(&id, &username)
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	case 2:
		// 范围查询
		rows, err := db.QueryContext(ctx, "SELECT id, title FROM cluster_posts WHERE status = 'published' LIMIT 20")
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int
			var title string
			if err := rows.Scan(&id, &title); err != nil {
				return err
			}
		}
		return rows.Err()
	}
	return nil
}

func (cb *ClusterBenchmark) performWrite(ctx context.Context, useHAProxy bool) error {
	var db *sql.DB
	
	if useHAProxy && cb.haproxyWrite != nil {
		db = cb.haproxyWrite
	} else {
		db = cb.primaryDB
		atomic.AddInt64(&cb.primaryOps, 1)
	}
	
	writeType := rand.Intn(2)
	switch writeType {
	case 0:
		// 更新
		id := rand.Intn(5000) + 1
		viewCount := rand.Intn(10000)
		_, err := db.ExecContext(ctx, "UPDATE cluster_posts SET view_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", viewCount, id)
		return err
	case 1:
		// 插入
		userID := rand.Intn(1000) + 1
		title := fmt.Sprintf("New Cluster Post %d", time.Now().UnixNano())
		slug := fmt.Sprintf("new-cluster-post-%d", time.Now().UnixNano())
		_, err := db.ExecContext(ctx, "INSERT INTO cluster_posts (user_id, title, slug, content, status) VALUES ($1, $2, $3, $4, $5)",
			userID, title, slug, "Content", "draft")
		return err
	}
	return nil
}

func (cb *ClusterBenchmark) calculateResults(duration time.Duration) (*ClusterBenchmarkResult, error) {
	cb.latencyMu.Lock()
	defer cb.latencyMu.Unlock()
	
	result := &ClusterBenchmarkResult{
		TestTime:    time.Now().Format(time.RFC3339),
		ClusterSize: 1 + len(cb.replicaDBs),
		Duration:    duration.Seconds(),
		Concurrency: cb.config.Concurrency,
		TotalOps:    cb.readCount + cb.writeCount,
		ReadOps:     cb.readCount,
		WriteOps:    cb.writeCount,
		SuccessOps:  cb.successCount,
		FailedOps:   cb.failedCount,
	}
	
	if duration.Seconds() > 0 {
		result.TotalOPS = float64(result.TotalOps) / duration.Seconds()
		result.ReadQPS = float64(cb.readCount) / duration.Seconds()
		result.WriteTPS = float64(cb.writeCount) / duration.Seconds()
	}
	
	if result.TotalOps > 0 {
		result.SuccessRate = float64(cb.successCount) / float64(result.TotalOps) * 100
	}
	
	if len(cb.latencies) > 0 {
		sort.Slice(cb.latencies, func(i, j int) bool {
			return cb.latencies[i] < cb.latencies[j]
		})
		
		var total time.Duration
		for _, l := range cb.latencies {
			total += l
		}
		
		result.AvgLatencyMs = float64(total.Microseconds()) / float64(len(cb.latencies)) / 1000
		result.MinLatencyMs = float64(cb.latencies[0].Microseconds()) / 1000
		result.MaxLatencyMs = float64(cb.latencies[len(cb.latencies)-1].Microseconds()) / 1000
		result.P50LatencyMs = float64(cb.latencies[len(cb.latencies)*50/100].Microseconds()) / 1000
		result.P95LatencyMs = float64(cb.latencies[len(cb.latencies)*95/100].Microseconds()) / 1000
		
		p99Index := len(cb.latencies) * 99 / 100
		if p99Index >= len(cb.latencies) {
			p99Index = len(cb.latencies) - 1
		}
		result.P99LatencyMs = float64(cb.latencies[p99Index].Microseconds()) / 1000
	}
	
	// 节点统计
	result.PrimaryStats = &NodeStats{
		Host: cb.config.PrimaryHost,
		Port: cb.config.PrimaryPort,
		Role: "primary",
		Ops:  cb.primaryOps,
		OPS:  float64(cb.primaryOps) / duration.Seconds(),
	}
	
	for i, db := range cb.replicaDBs {
		if db != nil {
			stats := &NodeStats{
				Host: cb.config.ReplicaHosts[i],
				Port: cb.config.ReplicaPorts[i],
				Role: "replica",
				Ops:  cb.replicaOps[i],
				OPS:  float64(cb.replicaOps[i]) / duration.Seconds(),
			}
			result.ReplicaStats = append(result.ReplicaStats, stats)
		}
	}
	
	return result, nil
}

// Cleanup 清理
func (cb *ClusterBenchmark) Cleanup() {
	if cb.primaryDB != nil {
		cb.primaryDB.Close()
	}
	for _, db := range cb.replicaDBs {
		if db != nil {
			db.Close()
		}
	}
	if cb.haproxyRead != nil {
		cb.haproxyRead.Close()
	}
	if cb.haproxyWrite != nil {
		cb.haproxyWrite.Close()
	}
}

func printClusterResults(result *ClusterBenchmarkResult, verbose bool) {
	fmt.Println()
	fmt.Println("📊 集群测试结果")
	fmt.Println("================")
	fmt.Printf("集群规模: %d 节点\n", result.ClusterSize)
	fmt.Printf("测试时间: %.2f 秒\n", result.Duration)
	fmt.Printf("并发数: %d\n", result.Concurrency)
	fmt.Println()
	
	fmt.Println("📈 吞吐量:")
	fmt.Printf("  总 OPS: %.2f\n", result.TotalOPS)
	fmt.Printf("  读 QPS: %.2f\n", result.ReadQPS)
	fmt.Printf("  写 TPS: %.2f\n", result.WriteTPS)
	fmt.Println()
	
	fmt.Println("⏱️ 延迟:")
	fmt.Printf("  平均: %.3f ms\n", result.AvgLatencyMs)
	fmt.Printf("  P50: %.3f ms\n", result.P50LatencyMs)
	fmt.Printf("  P95: %.3f ms\n", result.P95LatencyMs)
	fmt.Printf("  P99: %.3f ms\n", result.P99LatencyMs)
	fmt.Println()
	
	fmt.Println("✅ 成功率:")
	fmt.Printf("  成功: %d, 失败: %d\n", result.SuccessOps, result.FailedOps)
	fmt.Printf("  成功率: %.2f%%\n", result.SuccessRate)
	
	if verbose && len(result.ReplicaStats) > 0 {
		fmt.Println()
		fmt.Println("📊 节点统计:")
		fmt.Printf("  主节点 (%s:%d): %.2f OPS\n", result.PrimaryStats.Host, result.PrimaryStats.Port, result.PrimaryStats.OPS)
		for _, stats := range result.ReplicaStats {
			fmt.Printf("  从节点 (%s:%d): %.2f OPS\n", stats.Host, stats.Port, stats.OPS)
		}
	}
}

func saveClusterResults(result *ClusterBenchmarkResult, outputDir string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}
	
	filename := filepath.Join(outputDir,
		fmt.Sprintf("cluster-benchmark-%dnode-%s.json", result.ClusterSize, time.Now().Format("20060102-150405")))
	
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return err
	}
	
	fmt.Printf("\n📁 结果已保存到: %s\n", filename)
	return nil
}
