package benchmarks

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	_ "modernc.org/sqlite"
)

// SQLiteBenchmarkConfig SQLite 基准测试配置 (用于独立测试)
type SQLiteBenchmarkConfig struct {
	DatabasePath   string        `json:"database_path"`
	Duration       time.Duration `json:"duration"`
	Concurrency    int           `json:"concurrency"`
	ReadRatio      float64       `json:"read_ratio"`
	WarmupDuration time.Duration `json:"warmup_duration"`
	EnableWAL      bool          `json:"enable_wal"`
	UserCount      int           `json:"user_count"`
	PostCount      int           `json:"post_count"`
	Verbose        bool          `json:"verbose"`
}

// SQLiteBenchmarkResult SQLite 基准测试结果
type SQLiteBenchmarkResult struct {
	Duration    time.Duration `json:"duration"`
	TotalOps    int64         `json:"total_ops"`
	ReadOps     int64         `json:"read_ops"`
	WriteOps    int64         `json:"write_ops"`
	SuccessOps  int64         `json:"success_ops"`
	FailedOps   int64         `json:"failed_ops"`
	OPS         float64       `json:"ops"`
	ReadQPS     float64       `json:"read_qps"`
	WriteTPS    float64       `json:"write_tps"`
	AvgLatency  time.Duration `json:"avg_latency"`
	MinLatency  time.Duration `json:"min_latency"`
	MaxLatency  time.Duration `json:"max_latency"`
	P50Latency  time.Duration `json:"p50_latency"`
	P95Latency  time.Duration `json:"p95_latency"`
	P99Latency  time.Duration `json:"p99_latency"`
	SuccessRate float64       `json:"success_rate"`
}

// SQLiteStandaloneBenchmark 独立 SQLite 基准测试器 (用于对比测试)
type SQLiteStandaloneBenchmark struct {
	config    SQLiteBenchmarkConfig
	db        *sql.DB
	latencies []time.Duration
	mu        sync.Mutex

	readCount    int64
	writeCount   int64
	successCount int64
	failedCount  int64
}

// NewSQLiteBenchmark 创建新的独立 SQLite 基准测试器
func NewSQLiteBenchmark(config SQLiteBenchmarkConfig) *SQLiteStandaloneBenchmark {
	if config.Concurrency <= 0 {
		config.Concurrency = 10
	}
	if config.Duration <= 0 {
		config.Duration = 30 * time.Second
	}
	if config.ReadRatio < 0 || config.ReadRatio > 1 {
		config.ReadRatio = 0.7
	}
	if config.UserCount <= 0 {
		config.UserCount = 1000
	}
	if config.PostCount <= 0 {
		config.PostCount = 5000
	}

	return &SQLiteStandaloneBenchmark{
		config:    config,
		latencies: make([]time.Duration, 0, 10000),
	}
}

// Setup 设置测试环境
func (sb *SQLiteStandaloneBenchmark) Setup() error {
	var err error
	sb.db, err = sql.Open("sqlite", sb.config.DatabasePath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	// 配置连接池
	sb.db.SetMaxOpenConns(sb.config.Concurrency)
	sb.db.SetMaxIdleConns(sb.config.Concurrency / 2)

	// 启用 WAL 模式
	if sb.config.EnableWAL {
		if _, err := sb.db.Exec("PRAGMA journal_mode=WAL"); err != nil {
			return fmt.Errorf("启用 WAL 失败: %w", err)
		}
	}

	// 创建测试表
	if err := sb.createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	// 填充测试数据
	if err := sb.seedData(); err != nil {
		return fmt.Errorf("填充数据失败: %w", err)
	}

	if sb.config.Verbose {
		fmt.Printf("✅ SQLite 测试环境准备完成: %s\n", sb.config.DatabasePath)
	}

	return nil
}

func (sb *SQLiteStandaloneBenchmark) createTables() error {
	_, err := sb.db.Exec(`
		CREATE TABLE IF NOT EXISTS benchmark_users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT,
			bio TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			is_active INTEGER DEFAULT 1
		);
		CREATE INDEX IF NOT EXISTS idx_users_email ON benchmark_users(email);
		CREATE INDEX IF NOT EXISTS idx_users_username ON benchmark_users(username);
		
		CREATE TABLE IF NOT EXISTS benchmark_posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER REFERENCES benchmark_users(id),
			title TEXT NOT NULL,
			slug TEXT UNIQUE,
			content TEXT,
			status TEXT DEFAULT 'draft',
			view_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_posts_user_id ON benchmark_posts(user_id);
		CREATE INDEX IF NOT EXISTS idx_posts_status ON benchmark_posts(status);
	`)
	return err
}

func (sb *SQLiteStandaloneBenchmark) seedData() error {
	if sb.config.Verbose {
		fmt.Printf("📊 填充测试数据: %d 用户, %d 文章\n", sb.config.UserCount, sb.config.PostCount)
	}

	tx, err := sb.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 插入用户
	userStmt, err := tx.Prepare(`INSERT INTO benchmark_users (username, email, password_hash, full_name, bio, is_active) VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer userStmt.Close()

	for i := 0; i < sb.config.UserCount; i++ {
		username := fmt.Sprintf("user_%d", i)
		email := fmt.Sprintf("user_%d@example.com", i)
		_, err := userStmt.Exec(username, email, "hash", fmt.Sprintf("User %d", i), "Bio", 1)
		if err != nil {
			return err
		}
	}

	// 插入文章
	postStmt, err := tx.Prepare(`INSERT INTO benchmark_posts (user_id, title, slug, content, status, view_count) VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer postStmt.Close()

	statuses := []string{"draft", "published", "archived"}
	for i := 0; i < sb.config.PostCount; i++ {
		userID := rand.Intn(sb.config.UserCount) + 1
		title := fmt.Sprintf("Post Title %d", i)
		slug := fmt.Sprintf("post-%d", i)
		content := fmt.Sprintf("Content for post %d", i)
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
func (sb *SQLiteStandaloneBenchmark) Run() (*SQLiteBenchmarkResult, error) {
	if sb.config.Verbose {
		fmt.Printf("🚀 开始 SQLite 基准测试\n")
		fmt.Printf("📊 配置: 并发=%d, 持续时间=%v, 读比例=%.2f\n",
			sb.config.Concurrency, sb.config.Duration, sb.config.ReadRatio)
	}

	// 预热
	if sb.config.WarmupDuration > 0 {
		if sb.config.Verbose {
			fmt.Printf("🔥 预热中 (%v)...\n", sb.config.WarmupDuration)
		}
		sb.runWorkload(sb.config.WarmupDuration, false)
		sb.readCount = 0
		sb.writeCount = 0
		sb.successCount = 0
		sb.failedCount = 0
		sb.latencies = make([]time.Duration, 0, 10000)
	}

	// 正式测试
	startTime := time.Now()
	sb.runWorkload(sb.config.Duration, true)
	duration := time.Since(startTime)

	return sb.calculateResults(duration)
}

func (sb *SQLiteStandaloneBenchmark) runWorkload(duration time.Duration, recordStats bool) {
	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	var wg sync.WaitGroup
	for i := 0; i < sb.config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sb.worker(ctx, recordStats)
		}()
	}
	wg.Wait()
}

func (sb *SQLiteStandaloneBenchmark) worker(ctx context.Context, recordStats bool) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			start := time.Now()
			var err error

			if rand.Float64() < sb.config.ReadRatio {
				err = sb.performRead(ctx)
				if recordStats {
					atomic.AddInt64(&sb.readCount, 1)
				}
			} else {
				err = sb.performWrite(ctx)
				if recordStats {
					atomic.AddInt64(&sb.writeCount, 1)
				}
			}

			if recordStats {
				latency := time.Since(start)
				sb.mu.Lock()
				sb.latencies = append(sb.latencies, latency)
				sb.mu.Unlock()

				if err != nil {
					atomic.AddInt64(&sb.failedCount, 1)
				} else {
					atomic.AddInt64(&sb.successCount, 1)
				}
			}
		}
	}
}

func (sb *SQLiteStandaloneBenchmark) performRead(ctx context.Context) error {
	readType := rand.Intn(3)
	switch readType {
	case 0:
		// 按 ID 读取
		id := rand.Intn(sb.config.UserCount) + 1
		var username, email string
		return sb.db.QueryRowContext(ctx, "SELECT username, email FROM benchmark_users WHERE id = ?", id).Scan(&username, &email)
	case 1:
		// 按索引读取
		email := fmt.Sprintf("user_%d@example.com", rand.Intn(sb.config.UserCount))
		var id int
		var username string
		err := sb.db.QueryRowContext(ctx, "SELECT id, username FROM benchmark_users WHERE email = ?", email).Scan(&id, &username)
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	case 2:
		// 范围查询
		rows, err := sb.db.QueryContext(ctx, "SELECT id, title FROM benchmark_posts WHERE status = 'published' LIMIT 20")
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

func (sb *SQLiteStandaloneBenchmark) performWrite(ctx context.Context) error {
	writeType := rand.Intn(2)
	switch writeType {
	case 0:
		// 更新
		id := rand.Intn(sb.config.PostCount) + 1
		viewCount := rand.Intn(10000)
		_, err := sb.db.ExecContext(ctx, "UPDATE benchmark_posts SET view_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", viewCount, id)
		return err
	case 1:
		// 插入
		userID := rand.Intn(sb.config.UserCount) + 1
		title := fmt.Sprintf("New Post %d", time.Now().UnixNano())
		slug := fmt.Sprintf("new-post-%d", time.Now().UnixNano())
		_, err := sb.db.ExecContext(ctx, "INSERT INTO benchmark_posts (user_id, title, slug, content, status) VALUES (?, ?, ?, ?, ?)",
			userID, title, slug, "Content", "draft")
		return err
	}
	return nil
}

func (sb *SQLiteStandaloneBenchmark) calculateResults(duration time.Duration) (*SQLiteBenchmarkResult, error) {
	sb.mu.Lock()
	defer sb.mu.Unlock()

	result := &SQLiteBenchmarkResult{
		Duration:   duration,
		TotalOps:   sb.readCount + sb.writeCount,
		ReadOps:    sb.readCount,
		WriteOps:   sb.writeCount,
		SuccessOps: sb.successCount,
		FailedOps:  sb.failedCount,
	}

	if duration.Seconds() > 0 {
		result.OPS = float64(result.TotalOps) / duration.Seconds()
		result.ReadQPS = float64(sb.readCount) / duration.Seconds()
		result.WriteTPS = float64(sb.writeCount) / duration.Seconds()
	}

	if result.TotalOps > 0 {
		result.SuccessRate = float64(sb.successCount) / float64(result.TotalOps) * 100
	}

	if len(sb.latencies) > 0 {
		sort.Slice(sb.latencies, func(i, j int) bool {
			return sb.latencies[i] < sb.latencies[j]
		})

		var total time.Duration
		for _, l := range sb.latencies {
			total += l
		}

		result.AvgLatency = total / time.Duration(len(sb.latencies))
		result.MinLatency = sb.latencies[0]
		result.MaxLatency = sb.latencies[len(sb.latencies)-1]
		result.P50Latency = sb.latencies[len(sb.latencies)*50/100]
		result.P95Latency = sb.latencies[len(sb.latencies)*95/100]

		p99Index := len(sb.latencies) * 99 / 100
		if p99Index >= len(sb.latencies) {
			p99Index = len(sb.latencies) - 1
		}
		result.P99Latency = sb.latencies[p99Index]
	}

	return result, nil
}

// Cleanup 清理测试环境
func (sb *SQLiteStandaloneBenchmark) Cleanup() error {
	if sb.db != nil {
		sb.db.Close()
	}
	os.Remove(sb.config.DatabasePath)
	os.Remove(sb.config.DatabasePath + "-wal")
	os.Remove(sb.config.DatabasePath + "-shm")
	return nil
}

// ========== 原有的 SQLiteBenchmark (使用 Config) ==========

// SQLiteBenchmark SQLite 基准测试
type SQLiteBenchmark struct {
	db     *SQLiteDB
	config *Config
}

// NewSQLiteBenchmarkWithConfig 创建 SQLite 基准测试 (使用 Config)
func NewSQLiteBenchmarkWithConfig(db *SQLiteDB, config *Config) *SQLiteBenchmark {
	return &SQLiteBenchmark{
		db:     db,
		config: config,
	}
}

// Name 返回测试名称
func (b *SQLiteBenchmark) Name() string {
	return "SQLite Benchmark"
}

// Run 运行基准测试
func (b *SQLiteBenchmark) Run() (*BenchmarkResult, error) {
	// 准备测试数据
	if err := b.prepareData(); err != nil {
		return nil, fmt.Errorf("failed to prepare data: %w", err)
	}

	// 运行混合读写测试
	return b.runMixedWorkload()
}

// prepareData 准备测试数据
func (b *SQLiteBenchmark) prepareData() error {
	scaleConfig := b.config.GetScaleConfig()

	// 插入用户数据
	tx, err := b.db.DB().Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT INTO users (id, email, username, password, name, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().Format(time.RFC3339)
	for i := 0; i < scaleConfig.Users; i++ {
		id := fmt.Sprintf("user_%d", i)
		email := fmt.Sprintf("user%d@example.com", i)
		username := fmt.Sprintf("user%d", i)
		_, err := stmt.Exec(id, email, username, "password123", fmt.Sprintf("User %d", i), now, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// runMixedWorkload 运行混合读写负载测试
func (b *SQLiteBenchmark) runMixedWorkload() (*BenchmarkResult, error) {
	duration := time.Duration(b.config.DurationSeconds) * time.Second
	concurrency := b.config.ConcurrencyLevels[0]

	var (
		operations int64
		errors     int64
		latencies  []time.Duration
		latencyMu  sync.Mutex
	)

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	var wg sync.WaitGroup

	startTime := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			for {
				select {
				case <-ctx.Done():
					return
				default:
					start := time.Now()
					var err error

					// 70% 读，30% 写
					if rand.Float64() < 0.7 {
						err = b.performRead(ctx)
					} else {
						err = b.performWrite(ctx)
					}

					latency := time.Since(start)

					atomic.AddInt64(&operations, 1)
					if err != nil {
						atomic.AddInt64(&errors, 1)
					}

					latencyMu.Lock()
					latencies = append(latencies, latency)
					latencyMu.Unlock()

					time.Sleep(time.Millisecond) // 避免过度压力
				}
			}
		}()
	}

	wg.Wait()
	totalDuration := time.Since(startTime)

	// 计算统计数据
	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	avg, min, max, _, _, _ := CalculateStats(latencies)

	successRate := float64(operations-errors) / float64(operations) * 100

	return &BenchmarkResult{
		Name:         "SQLite Mixed Workload",
		Operations:   operations,
		Duration:     totalDuration,
		OpsPerSecond: float64(operations) / totalDuration.Seconds(),
		AvgLatency:   avg,
		MinLatency:   min,
		MaxLatency:   max,
		P50Latency:   CalculatePercentile(latencies, 50),
		P95Latency:   CalculatePercentile(latencies, 95),
		P99Latency:   CalculatePercentile(latencies, 99),
		Errors:       errors,
		SuccessRate:  successRate,
		Metadata: map[string]interface{}{
			"concurrency": concurrency,
			"read_ratio":  0.7,
			"scale":       b.config.Scale,
		},
	}, nil
}

// performRead 执行读操作
func (b *SQLiteBenchmark) performRead(ctx context.Context) error {
	scaleConfig := b.config.GetScaleConfig()
	id := fmt.Sprintf("user_%d", rand.Intn(scaleConfig.Users))

	var email, username, name string
	err := b.db.DB().QueryRowContext(ctx,
		"SELECT email, username, name FROM users WHERE id = ?", id).Scan(&email, &username, &name)

	if err != nil && err != sql.ErrNoRows {
		return err
	}
	return nil
}

// performWrite 执行写操作
func (b *SQLiteBenchmark) performWrite(ctx context.Context) error {
	scaleConfig := b.config.GetScaleConfig()
	id := fmt.Sprintf("user_%d", rand.Intn(scaleConfig.Users))
	now := time.Now().Format(time.RFC3339)

	_, err := b.db.DB().ExecContext(ctx,
		"UPDATE users SET updated_at = ? WHERE id = ?", now, id)
	return err
}

// RunSelectByID 运行按 ID 查询测试
func (b *SQLiteBenchmark) RunSelectByID() (*BenchmarkResult, error) {
	iterations := b.config.Iterations
	warmup := b.config.WarmupIterations

	// 预热
	for i := 0; i < warmup; i++ {
		b.performRead(context.Background())
	}

	var latencies []time.Duration
	var errors int64

	startTime := time.Now()

	for i := 0; i < iterations; i++ {
		start := time.Now()
		err := b.performRead(context.Background())
		latency := time.Since(start)

		latencies = append(latencies, latency)
		if err != nil {
			errors++
		}
	}

	totalDuration := time.Since(startTime)

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	avg, min, max, _, _, _ := CalculateStats(latencies)

	return &BenchmarkResult{
		Name:         "SQLite Select By ID",
		Operations:   int64(iterations),
		Duration:     totalDuration,
		OpsPerSecond: float64(iterations) / totalDuration.Seconds(),
		AvgLatency:   avg,
		MinLatency:   min,
		MaxLatency:   max,
		P50Latency:   CalculatePercentile(latencies, 50),
		P95Latency:   CalculatePercentile(latencies, 95),
		P99Latency:   CalculatePercentile(latencies, 99),
		Errors:       errors,
		SuccessRate:  float64(iterations-int(errors)) / float64(iterations) * 100,
	}, nil
}

// RunInsert 运行插入测试
func (b *SQLiteBenchmark) RunInsert() (*BenchmarkResult, error) {
	iterations := b.config.Iterations

	var latencies []time.Duration
	var errors int64

	startTime := time.Now()

	for i := 0; i < iterations; i++ {
		start := time.Now()

		id := fmt.Sprintf("insert_test_%d_%d", time.Now().UnixNano(), i)
		email := fmt.Sprintf("insert%d@example.com", i)
		username := fmt.Sprintf("insert_user_%d", i)
		now := time.Now().Format(time.RFC3339)

		_, err := b.db.DB().Exec(`INSERT INTO users (id, email, username, password, name, created_at, updated_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, email, username, "password123", fmt.Sprintf("Insert User %d", i), now, now)

		latency := time.Since(start)
		latencies = append(latencies, latency)

		if err != nil {
			errors++
		}
	}

	totalDuration := time.Since(startTime)

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	avg, min, max, _, _, _ := CalculateStats(latencies)

	return &BenchmarkResult{
		Name:         "SQLite Insert",
		Operations:   int64(iterations),
		Duration:     totalDuration,
		OpsPerSecond: float64(iterations) / totalDuration.Seconds(),
		AvgLatency:   avg,
		MinLatency:   min,
		MaxLatency:   max,
		P50Latency:   CalculatePercentile(latencies, 50),
		P95Latency:   CalculatePercentile(latencies, 95),
		P99Latency:   CalculatePercentile(latencies, 99),
		Errors:       errors,
		SuccessRate:  float64(iterations-int(errors)) / float64(iterations) * 100,
	}, nil
}
