// Package benchmarks 提供 PostgreSQL 性能基准测试
package benchmarks

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

// PostgresBenchmarkConfig PostgreSQL 基准测试配置
type PostgresBenchmarkConfig struct {
	// 数据库配置
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	Database string `json:"database"`
	SSLMode  string `json:"ssl_mode"`

	// 测试配置
	Duration       time.Duration `json:"duration"`
	Concurrency    int           `json:"concurrency"`
	ReadRatio      float64       `json:"read_ratio"`       // 读操作比例 (0.0-1.0)
	BatchSize      int           `json:"batch_size"`       // 批量操作大小
	WarmupDuration time.Duration `json:"warmup_duration"`  // 预热时间
	DataScale      string        `json:"data_scale"`       // small, medium, large
	Verbose        bool          `json:"verbose"`
}

// PostgresBenchmarkResult PostgreSQL 基准测试结果
type PostgresBenchmarkResult struct {
	// 基本信息
	DatabaseType    string    `json:"database_type"`
	PostgresVersion string    `json:"postgres_version"`
	TestStartTime   time.Time `json:"test_start_time"`
	TestEndTime     time.Time `json:"test_end_time"`
	TestDuration    float64   `json:"test_duration_seconds"`

	// 操作统计
	TotalOperations int64 `json:"total_operations"`
	ReadOperations  int64 `json:"read_operations"`
	WriteOperations int64 `json:"write_operations"`
	SuccessfulOps   int64 `json:"successful_ops"`
	FailedOps       int64 `json:"failed_ops"`

	// 吞吐量
	ReadQPS  float64 `json:"read_qps"`
	WriteTPS float64 `json:"write_tps"`
	TotalOPS float64 `json:"total_ops"`

	// 延迟统计 (毫秒)
	AvgLatencyMs float64 `json:"avg_latency_ms"`
	MinLatencyMs float64 `json:"min_latency_ms"`
	MaxLatencyMs float64 `json:"max_latency_ms"`
	P50LatencyMs float64 `json:"p50_latency_ms"`
	P95LatencyMs float64 `json:"p95_latency_ms"`
	P99LatencyMs float64 `json:"p99_latency_ms"`

	// 成功率
	SuccessRate float64 `json:"success_rate"`

	// 连接信息
	MaxConnections int `json:"max_connections"`
	Concurrency    int `json:"concurrency"`

	// 详细操作结果
	CRUDResults map[string]*OperationResult `json:"crud_results"`
}

// OperationResult 单项操作结果
type OperationResult struct {
	OperationType string  `json:"operation_type"`
	TotalCount    int64   `json:"total_count"`
	SuccessCount  int64   `json:"success_count"`
	FailedCount   int64   `json:"failed_count"`
	AvgLatencyMs  float64 `json:"avg_latency_ms"`
	MinLatencyMs  float64 `json:"min_latency_ms"`
	MaxLatencyMs  float64 `json:"max_latency_ms"`
	P50LatencyMs  float64 `json:"p50_latency_ms"`
	P95LatencyMs  float64 `json:"p95_latency_ms"`
	P99LatencyMs  float64 `json:"p99_latency_ms"`
	OPS           float64 `json:"ops"`
}

// PostgresBenchmark PostgreSQL 基准测试器
type PostgresBenchmark struct {
	config    PostgresBenchmarkConfig
	db        *sql.DB
	results   PostgresBenchmarkResult
	latencies map[string][]time.Duration
	mu        sync.Mutex

	// 操作计数器
	readCount    int64
	writeCount   int64
	successCount int64
	failedCount  int64
}

// NewPostgresBenchmark 创建新的 PostgreSQL 基准测试器
func NewPostgresBenchmark(config PostgresBenchmarkConfig) *PostgresBenchmark {
	if config.Concurrency <= 0 {
		config.Concurrency = 10
	}
	if config.Duration <= 0 {
		config.Duration = 30 * time.Second
	}
	if config.ReadRatio < 0 || config.ReadRatio > 1 {
		config.ReadRatio = 0.7
	}
	if config.SSLMode == "" {
		config.SSLMode = "disable"
	}
	if config.WarmupDuration <= 0 {
		config.WarmupDuration = 5 * time.Second
	}
	if config.DataScale == "" {
		config.DataScale = "small"
	}

	return &PostgresBenchmark{
		config:    config,
		latencies: make(map[string][]time.Duration),
		results: PostgresBenchmarkResult{
			DatabaseType: "postgres",
			CRUDResults:  make(map[string]*OperationResult),
		},
	}
}

// Connect 连接到 PostgreSQL 数据库
func (pb *PostgresBenchmark) Connect() error {
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		pb.config.Host, pb.config.Port, pb.config.User, pb.config.Password,
		pb.config.Database, pb.config.SSLMode,
	)

	var err error
	pb.db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}

	// 配置连接池
	pb.db.SetMaxOpenConns(pb.config.Concurrency * 2)
	pb.db.SetMaxIdleConns(pb.config.Concurrency)
	pb.db.SetConnMaxLifetime(5 * time.Minute)

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := pb.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping 数据库失败: %w", err)
	}

	// 获取 PostgreSQL 版本
	var version string
	if err := pb.db.QueryRowContext(ctx, "SELECT version()").Scan(&version); err == nil {
		pb.results.PostgresVersion = version
	}

	if pb.config.Verbose {
		fmt.Printf("✅ 已连接到 PostgreSQL: %s:%d\n", pb.config.Host, pb.config.Port)
		fmt.Printf("📦 PostgreSQL 版本: %s\n", pb.results.PostgresVersion)
	}

	return nil
}

// SetupTestTables 创建测试表
func (pb *PostgresBenchmark) SetupTestTables() error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// 删除旧表
	dropSQL := `DROP TABLE IF EXISTS benchmark_posts CASCADE;
				DROP TABLE IF EXISTS benchmark_users CASCADE;`
	if _, err := pb.db.ExecContext(ctx, dropSQL); err != nil {
		return fmt.Errorf("删除旧表失败: %w", err)
	}

	// 创建用户表
	usersSQL := `
		CREATE TABLE benchmark_users (
			id SERIAL PRIMARY KEY,
			username VARCHAR(100) NOT NULL UNIQUE,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			full_name VARCHAR(200),
			bio TEXT,
			avatar_url VARCHAR(500),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			is_active BOOLEAN DEFAULT true,
			role VARCHAR(50) DEFAULT 'user',
			metadata JSONB DEFAULT '{}'
		);
		CREATE INDEX idx_users_email ON benchmark_users(email);
		CREATE INDEX idx_users_username ON benchmark_users(username);
		CREATE INDEX idx_users_created_at ON benchmark_users(created_at);
		CREATE INDEX idx_users_is_active ON benchmark_users(is_active);
	`
	if _, err := pb.db.ExecContext(ctx, usersSQL); err != nil {
		return fmt.Errorf("创建用户表失败: %w", err)
	}

	// 创建文章表
	postsSQL := `
		CREATE TABLE benchmark_posts (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES benchmark_users(id),
			title VARCHAR(500) NOT NULL,
			slug VARCHAR(500) UNIQUE,
			content TEXT,
			excerpt TEXT,
			status VARCHAR(50) DEFAULT 'draft',
			view_count INTEGER DEFAULT 0,
			like_count INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			published_at TIMESTAMP,
			tags TEXT[],
			metadata JSONB DEFAULT '{}'
		);
		CREATE INDEX idx_posts_user_id ON benchmark_posts(user_id);
		CREATE INDEX idx_posts_status ON benchmark_posts(status);
		CREATE INDEX idx_posts_created_at ON benchmark_posts(created_at);
		CREATE INDEX idx_posts_published_at ON benchmark_posts(published_at);
		CREATE INDEX idx_posts_slug ON benchmark_posts(slug);
	`
	if _, err := pb.db.ExecContext(ctx, postsSQL); err != nil {
		return fmt.Errorf("创建文章表失败: %w", err)
	}

	if pb.config.Verbose {
		fmt.Println("✅ 测试表创建完成")
	}

	return nil
}

// SeedTestData 填充测试数据
func (pb *PostgresBenchmark) SeedTestData() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	var userCount, postCount int
	switch pb.config.DataScale {
	case "small":
		userCount, postCount = 1000, 5000
	case "medium":
		userCount, postCount = 10000, 50000
	case "large":
		userCount, postCount = 100000, 500000
	default:
		userCount, postCount = 1000, 5000
	}

	if pb.config.Verbose {
		fmt.Printf("📊 开始填充测试数据: %d 用户, %d 文章\n", userCount, postCount)
	}

	// 批量插入用户
	batchSize := 1000
	for i := 0; i < userCount; i += batchSize {
		end := i + batchSize
		if end > userCount {
			end = userCount
		}

		tx, err := pb.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}

		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO benchmark_users (username, email, password_hash, full_name, bio, is_active, role)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`)
		if err != nil {
			tx.Rollback()
			return err
		}

		for j := i; j < end; j++ {
			username := fmt.Sprintf("user_%d", j)
			email := fmt.Sprintf("user_%d@example.com", j)
			passwordHash := fmt.Sprintf("hash_%d", rand.Int())
			fullName := fmt.Sprintf("User %d Full Name", j)
			bio := fmt.Sprintf("This is the bio for user %d", j)
			isActive := rand.Float32() > 0.1
			roles := []string{"user", "admin", "moderator"}
			role := roles[rand.Intn(len(roles))]

			if _, err := stmt.ExecContext(ctx, username, email, passwordHash, fullName, bio, isActive, role); err != nil {
				stmt.Close()
				tx.Rollback()
				return err
			}
		}

		stmt.Close()
		if err := tx.Commit(); err != nil {
			return err
		}

		if pb.config.Verbose && (i+batchSize)%10000 == 0 {
			fmt.Printf("  用户进度: %d/%d\n", i+batchSize, userCount)
		}
	}

	// 批量插入文章
	for i := 0; i < postCount; i += batchSize {
		end := i + batchSize
		if end > postCount {
			end = postCount
		}

		tx, err := pb.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}

		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO benchmark_posts (user_id, title, slug, content, excerpt, status, view_count, like_count, tags)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`)
		if err != nil {
			tx.Rollback()
			return err
		}

		for j := i; j < end; j++ {
			userID := rand.Intn(userCount) + 1
			title := fmt.Sprintf("Post Title %d - Lorem Ipsum", j)
			slug := fmt.Sprintf("post-title-%d", j)
			content := fmt.Sprintf("This is the content for post %d. Lorem ipsum dolor sit amet, consectetur adipiscing elit.", j)
			excerpt := fmt.Sprintf("Excerpt for post %d", j)
			statuses := []string{"draft", "published", "archived"}
			status := statuses[rand.Intn(len(statuses))]
			viewCount := rand.Intn(10000)
			likeCount := rand.Intn(1000)
			tags := fmt.Sprintf("{\"tag%d\",\"tag%d\",\"tag%d\"}", rand.Intn(100), rand.Intn(100), rand.Intn(100))

			if _, err := stmt.ExecContext(ctx, userID, title, slug, content, excerpt, status, viewCount, likeCount, tags); err != nil {
				stmt.Close()
				tx.Rollback()
				return err
			}
		}

		stmt.Close()
		if err := tx.Commit(); err != nil {
			return err
		}

		if pb.config.Verbose && (i+batchSize)%10000 == 0 {
			fmt.Printf("  文章进度: %d/%d\n", i+batchSize, postCount)
		}
	}

	if pb.config.Verbose {
		fmt.Println("✅ 测试数据填充完成")
	}

	return nil
}

// recordLatency 记录延迟
func (pb *PostgresBenchmark) recordLatency(opType string, latency time.Duration) {
	pb.mu.Lock()
	pb.latencies[opType] = append(pb.latencies[opType], latency)
	pb.mu.Unlock()
}

// RunCRUDBenchmark 运行 CRUD 基准测试
func (pb *PostgresBenchmark) RunCRUDBenchmark() error {
	if pb.config.Verbose {
		fmt.Printf("\n🚀 开始 PostgreSQL CRUD 基准测试\n")
		fmt.Printf("📊 配置: 并发=%d, 持续时间=%v, 读比例=%.2f\n",
			pb.config.Concurrency, pb.config.Duration, pb.config.ReadRatio)
	}

	// 预热
	if pb.config.WarmupDuration > 0 {
		if pb.config.Verbose {
			fmt.Printf("🔥 预热中 (%v)...\n", pb.config.WarmupDuration)
		}
		pb.runWorkload(pb.config.WarmupDuration, false)
		// 重置计数器
		pb.readCount = 0
		pb.writeCount = 0
		pb.successCount = 0
		pb.failedCount = 0
		pb.latencies = make(map[string][]time.Duration)
	}

	// 正式测试
	pb.results.TestStartTime = time.Now()
	if pb.config.Verbose {
		fmt.Printf("⏱️ 开始正式测试...\n")
	}

	pb.runWorkload(pb.config.Duration, true)

	pb.results.TestEndTime = time.Now()
	pb.results.TestDuration = pb.results.TestEndTime.Sub(pb.results.TestStartTime).Seconds()

	return pb.calculateResults()
}

// runWorkload 运行工作负载
func (pb *PostgresBenchmark) runWorkload(duration time.Duration, recordStats bool) {
	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	var wg sync.WaitGroup

	for i := 0; i < pb.config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pb.worker(ctx, recordStats)
		}()
	}

	wg.Wait()
}

// worker 工作协程
func (pb *PostgresBenchmark) worker(ctx context.Context, recordStats bool) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			var err error
			_ = "" // opType 用于调试

			r := rand.Float64()
			if r < pb.config.ReadRatio {
				// 读操作
				readType := rand.Intn(4)
				switch readType {
				case 0:
					err = pb.readByID(ctx)
				case 1:
					err = pb.readByIndex(ctx)
				case 2:
					err = pb.readRange(ctx)
				case 3:
					err = pb.readJoin(ctx)
				}
				if recordStats {
					atomic.AddInt64(&pb.readCount, 1)
				}
			} else {
				// 写操作
				writeType := rand.Intn(3)
				switch writeType {
				case 0:
					err = pb.insertRecord(ctx)
				case 1:
					err = pb.updateRecord(ctx)
				case 2:
					err = pb.deleteRecord(ctx)
				}
				if recordStats {
					atomic.AddInt64(&pb.writeCount, 1)
				}
			}

			if recordStats {
				if err != nil {
					atomic.AddInt64(&pb.failedCount, 1)
				} else {
					atomic.AddInt64(&pb.successCount, 1)
				}
			}
		}
	}
}

// readByID 按 ID 读取
func (pb *PostgresBenchmark) readByID(ctx context.Context) error {
	start := time.Now()
	id := rand.Intn(1000) + 1

	var user struct {
		ID       int
		Username string
		Email    string
		FullName sql.NullString
	}

	err := pb.db.QueryRowContext(ctx,
		"SELECT id, username, email, full_name FROM benchmark_users WHERE id = $1",
		id,
	).Scan(&user.ID, &user.Username, &user.Email, &user.FullName)

	pb.recordLatency("read_by_id", time.Since(start))

	if err == sql.ErrNoRows {
		return nil
	}
	return err
}

// readByIndex 按索引读取
func (pb *PostgresBenchmark) readByIndex(ctx context.Context) error {
	start := time.Now()
	email := fmt.Sprintf("user_%d@example.com", rand.Intn(1000))

	var user struct {
		ID       int
		Username string
		Email    string
	}

	err := pb.db.QueryRowContext(ctx,
		"SELECT id, username, email FROM benchmark_users WHERE email = $1",
		email,
	).Scan(&user.ID, &user.Username, &user.Email)

	pb.recordLatency("read_by_index", time.Since(start))

	if err == sql.ErrNoRows {
		return nil
	}
	return err
}

// readRange 范围查询
func (pb *PostgresBenchmark) readRange(ctx context.Context) error {
	start := time.Now()
	offset := rand.Intn(100)
	limit := 20

	rows, err := pb.db.QueryContext(ctx,
		"SELECT id, title, status, view_count FROM benchmark_posts WHERE status = 'published' ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		limit, offset,
	)
	if err != nil {
		pb.recordLatency("read_range", time.Since(start))
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var post struct {
			ID        int
			Title     string
			Status    string
			ViewCount int
		}
		if err := rows.Scan(&post.ID, &post.Title, &post.Status, &post.ViewCount); err != nil {
			pb.recordLatency("read_range", time.Since(start))
			return err
		}
	}

	pb.recordLatency("read_range", time.Since(start))
	return rows.Err()
}

// readJoin JOIN 查询
func (pb *PostgresBenchmark) readJoin(ctx context.Context) error {
	start := time.Now()
	userID := rand.Intn(1000) + 1

	rows, err := pb.db.QueryContext(ctx, `
		SELECT p.id, p.title, u.username, u.email 
		FROM benchmark_posts p 
		JOIN benchmark_users u ON p.user_id = u.id 
		WHERE u.id = $1 
		LIMIT 10
	`, userID)
	if err != nil {
		pb.recordLatency("read_join", time.Since(start))
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var result struct {
			PostID   int
			Title    string
			Username string
			Email    string
		}
		if err := rows.Scan(&result.PostID, &result.Title, &result.Username, &result.Email); err != nil {
			pb.recordLatency("read_join", time.Since(start))
			return err
		}
	}

	pb.recordLatency("read_join", time.Since(start))
	return rows.Err()
}

// insertRecord 插入记录
func (pb *PostgresBenchmark) insertRecord(ctx context.Context) error {
	start := time.Now()

	userID := rand.Intn(1000) + 1
	title := fmt.Sprintf("New Post %d", time.Now().UnixNano())
	slug := fmt.Sprintf("new-post-%d", time.Now().UnixNano())
	content := "This is new content for the benchmark test."
	status := "draft"

	_, err := pb.db.ExecContext(ctx, `
		INSERT INTO benchmark_posts (user_id, title, slug, content, status)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, title, slug, content, status)

	pb.recordLatency("insert", time.Since(start))
	return err
}

// updateRecord 更新记录
func (pb *PostgresBenchmark) updateRecord(ctx context.Context) error {
	start := time.Now()

	id := rand.Intn(5000) + 1
	viewCount := rand.Intn(10000)

	_, err := pb.db.ExecContext(ctx, `
		UPDATE benchmark_posts SET view_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
	`, viewCount, id)

	pb.recordLatency("update", time.Since(start))
	return err
}

// deleteRecord 删除记录
func (pb *PostgresBenchmark) deleteRecord(ctx context.Context) error {
	start := time.Now()

	// 删除最新插入的记录 (避免删除种子数据)
	_, err := pb.db.ExecContext(ctx, `
		DELETE FROM benchmark_posts WHERE id IN (
			SELECT id FROM benchmark_posts WHERE status = 'draft' ORDER BY id DESC LIMIT 1
		)
	`)

	pb.recordLatency("delete", time.Since(start))
	return err
}

// calculateResults 计算测试结果
func (pb *PostgresBenchmark) calculateResults() error {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	pb.results.ReadOperations = pb.readCount
	pb.results.WriteOperations = pb.writeCount
	pb.results.TotalOperations = pb.readCount + pb.writeCount
	pb.results.SuccessfulOps = pb.successCount
	pb.results.FailedOps = pb.failedCount
	pb.results.Concurrency = pb.config.Concurrency
	pb.results.MaxConnections = pb.config.Concurrency * 2

	// 计算吞吐量
	if pb.results.TestDuration > 0 {
		pb.results.ReadQPS = float64(pb.readCount) / pb.results.TestDuration
		pb.results.WriteTPS = float64(pb.writeCount) / pb.results.TestDuration
		pb.results.TotalOPS = float64(pb.results.TotalOperations) / pb.results.TestDuration
	}

	// 计算成功率
	if pb.results.TotalOperations > 0 {
		pb.results.SuccessRate = float64(pb.successCount) / float64(pb.results.TotalOperations) * 100
	}

	// 合并所有延迟数据
	var allLatencies []time.Duration
	for opType, latencies := range pb.latencies {
		allLatencies = append(allLatencies, latencies...)

		// 计算每种操作的统计
		if len(latencies) > 0 {
			opResult := pb.calculateOperationStats(opType, latencies)
			pb.results.CRUDResults[opType] = opResult
		}
	}

	// 计算总体延迟统计
	if len(allLatencies) > 0 {
		sort.Slice(allLatencies, func(i, j int) bool {
			return allLatencies[i] < allLatencies[j]
		})

		var total time.Duration
		for _, l := range allLatencies {
			total += l
		}

		pb.results.AvgLatencyMs = float64(total.Milliseconds()) / float64(len(allLatencies))
		pb.results.MinLatencyMs = float64(allLatencies[0].Microseconds()) / 1000.0
		pb.results.MaxLatencyMs = float64(allLatencies[len(allLatencies)-1].Microseconds()) / 1000.0
		pb.results.P50LatencyMs = float64(allLatencies[len(allLatencies)*50/100].Microseconds()) / 1000.0
		pb.results.P95LatencyMs = float64(allLatencies[len(allLatencies)*95/100].Microseconds()) / 1000.0
		pb.results.P99LatencyMs = float64(allLatencies[len(allLatencies)*99/100].Microseconds()) / 1000.0
	}

	return nil
}

// calculateOperationStats 计算单项操作统计
func (pb *PostgresBenchmark) calculateOperationStats(opType string, latencies []time.Duration) *OperationResult {
	result := &OperationResult{
		OperationType: opType,
		TotalCount:    int64(len(latencies)),
		SuccessCount:  int64(len(latencies)),
	}

	if len(latencies) == 0 {
		return result
	}

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	var total time.Duration
	for _, l := range latencies {
		total += l
	}

	result.AvgLatencyMs = float64(total.Milliseconds()) / float64(len(latencies))
	result.MinLatencyMs = float64(latencies[0].Microseconds()) / 1000.0
	result.MaxLatencyMs = float64(latencies[len(latencies)-1].Microseconds()) / 1000.0
	result.P50LatencyMs = float64(latencies[len(latencies)*50/100].Microseconds()) / 1000.0
	result.P95LatencyMs = float64(latencies[len(latencies)*95/100].Microseconds()) / 1000.0

	p99Index := len(latencies) * 99 / 100
	if p99Index >= len(latencies) {
		p99Index = len(latencies) - 1
	}
	result.P99LatencyMs = float64(latencies[p99Index].Microseconds()) / 1000.0

	if pb.results.TestDuration > 0 {
		result.OPS = float64(len(latencies)) / pb.results.TestDuration
	}

	return result
}

// GetResults 获取测试结果
func (pb *PostgresBenchmark) GetResults() PostgresBenchmarkResult {
	return pb.results
}

// PrintResults 打印测试结果
func (pb *PostgresBenchmark) PrintResults() {
	fmt.Printf("\n📈 PostgreSQL 性能测试结果\n")
	fmt.Printf("==========================================\n")
	fmt.Printf("数据库类型:   %s\n", pb.results.DatabaseType)
	fmt.Printf("PostgreSQL:   %s\n", pb.results.PostgresVersion)
	fmt.Printf("测试时长:     %.2f 秒\n", pb.results.TestDuration)
	fmt.Printf("并发数:       %d\n", pb.results.Concurrency)
	fmt.Printf("\n📊 操作统计:\n")
	fmt.Printf("总操作数:     %d\n", pb.results.TotalOperations)
	fmt.Printf("读操作数:     %d\n", pb.results.ReadOperations)
	fmt.Printf("写操作数:     %d\n", pb.results.WriteOperations)
	fmt.Printf("成功操作:     %d\n", pb.results.SuccessfulOps)
	fmt.Printf("失败操作:     %d\n", pb.results.FailedOps)
	fmt.Printf("成功率:       %.2f%%\n", pb.results.SuccessRate)
	fmt.Printf("\n📈 吞吐量:\n")
	fmt.Printf("读 QPS:       %.2f\n", pb.results.ReadQPS)
	fmt.Printf("写 TPS:       %.2f\n", pb.results.WriteTPS)
	fmt.Printf("总 OPS:       %.2f\n", pb.results.TotalOPS)
	fmt.Printf("\n⏱️ 延迟统计:\n")
	fmt.Printf("平均延迟:     %.3f ms\n", pb.results.AvgLatencyMs)
	fmt.Printf("最小延迟:     %.3f ms\n", pb.results.MinLatencyMs)
	fmt.Printf("最大延迟:     %.3f ms\n", pb.results.MaxLatencyMs)
	fmt.Printf("P50 延迟:     %.3f ms\n", pb.results.P50LatencyMs)
	fmt.Printf("P95 延迟:     %.3f ms\n", pb.results.P95LatencyMs)
	fmt.Printf("P99 延迟:     %.3f ms\n", pb.results.P99LatencyMs)

	if len(pb.results.CRUDResults) > 0 {
		fmt.Printf("\n📋 详细操作统计:\n")
		for opType, result := range pb.results.CRUDResults {
			fmt.Printf("  %s: 次数=%d, 平均=%.3fms, P95=%.3fms, OPS=%.2f\n",
				opType, result.TotalCount, result.AvgLatencyMs, result.P95LatencyMs, result.OPS)
		}
	}

	fmt.Printf("==========================================\n")
}

// Close 关闭数据库连接
func (pb *PostgresBenchmark) Close() error {
	if pb.db != nil {
		return pb.db.Close()
	}
	return nil
}

// Cleanup 清理测试数据
func (pb *PostgresBenchmark) Cleanup() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err := pb.db.ExecContext(ctx, `
		DROP TABLE IF EXISTS benchmark_posts CASCADE;
		DROP TABLE IF EXISTS benchmark_users CASCADE;
	`)
	return err
}
