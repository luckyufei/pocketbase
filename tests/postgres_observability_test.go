package tests_test

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestPostgres_Observability_RequestLogs 测试请求日志写入
func TestPostgres_Observability_RequestLogs(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("创建 UNLOGGED 分区表", func(t *testing.T) {
		pm := core.NewLogPartitionManager("request_logs")

		// 创建主表
		createTableSQL := pm.CreateTableSQL()
		_, err := db.ExecContext(ctx, createTableSQL)
		if err != nil {
			t.Fatalf("创建主表失败: %v", err)
		}

		// 创建今天的分区
		today := time.Now().UTC()
		createPartitionSQL := pm.CreatePartitionSQL(today)
		_, err = db.ExecContext(ctx, createPartitionSQL)
		if err != nil {
			t.Fatalf("创建分区失败: %v", err)
		}

		// 验证表存在
		var exists bool
		err = db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables 
				WHERE table_name = 'request_logs'
			)
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询表失败: %v", err)
		}
		if !exists {
			t.Error("request_logs 表应该存在")
		}
	})

	t.Run("写入请求日志", func(t *testing.T) {
		pm := core.NewLogPartitionManager("request_logs")

		// 确保表和分区存在
		_, _ = db.ExecContext(ctx, pm.CreateTableSQL())
		_, _ = db.ExecContext(ctx, pm.CreatePartitionSQL(time.Now().UTC()))

		// 写入日志
		log := &core.RequestLog{
			ID:           "test-log-1",
			Timestamp:    time.Now().UTC(),
			Method:       "GET",
			Path:         "/api/collections",
			StatusCode:   200,
			Duration:     100 * time.Millisecond,
			RequestSize:  1024,
			ResponseSize: 2048,
			UserID:       "user-123",
			IP:           "192.168.1.1",
			UserAgent:    "TestAgent/1.0",
			NodeID:       "node-1",
		}

		_, err := db.ExecContext(ctx, `
			INSERT INTO request_logs (
				id, timestamp, method, path, status_code, duration_ms,
				request_size, response_size, user_id, ip, user_agent, node_id
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`,
			log.ID, log.Timestamp, log.Method, log.Path, log.StatusCode,
			log.Duration.Milliseconds(), log.RequestSize, log.ResponseSize,
			log.UserID, log.IP, log.UserAgent, log.NodeID,
		)
		if err != nil {
			t.Fatalf("写入日志失败: %v", err)
		}

		// 验证写入
		var count int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM request_logs WHERE id = $1", log.ID).Scan(&count)
		if err != nil {
			t.Fatalf("查询日志失败: %v", err)
		}
		if count != 1 {
			t.Errorf("日志数量期望 1, 实际 %d", count)
		}
	})

	t.Run("批量写入性能", func(t *testing.T) {
		pm := core.NewLogPartitionManager("request_logs_perf")

		// 创建表
		createSQL := `CREATE UNLOGGED TABLE IF NOT EXISTS request_logs_perf (
			id TEXT NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			status_code INTEGER NOT NULL,
			duration_ms BIGINT NOT NULL,
			request_size BIGINT,
			response_size BIGINT,
			user_id TEXT,
			ip TEXT,
			user_agent TEXT,
			node_id TEXT NOT NULL,
			PRIMARY KEY (timestamp, id)
		) PARTITION BY RANGE (timestamp)`
		_, err := db.ExecContext(ctx, createSQL)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		// 创建分区
		_, _ = db.ExecContext(ctx, pm.CreatePartitionSQL(time.Now().UTC()))

		// 批量写入 1000 条日志
		batchSize := 1000
		start := time.Now()

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			t.Fatalf("开始事务失败: %v", err)
		}

		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO request_logs_perf (
				id, timestamp, method, path, status_code, duration_ms,
				request_size, response_size, user_id, ip, user_agent, node_id
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`)
		if err != nil {
			tx.Rollback()
			t.Fatalf("准备语句失败: %v", err)
		}
		defer stmt.Close()

		for i := 0; i < batchSize; i++ {
			_, err = stmt.ExecContext(ctx,
				fmt.Sprintf("log-%d", i),
				time.Now().UTC(),
				"GET",
				fmt.Sprintf("/api/test/%d", i),
				200,
				int64(100+i%100),
				int64(1024),
				int64(2048),
				"user-1",
				"192.168.1.1",
				"TestAgent/1.0",
				"node-1",
			)
			if err != nil {
				tx.Rollback()
				t.Fatalf("批量写入失败: %v", err)
			}
		}

		err = tx.Commit()
		if err != nil {
			t.Fatalf("提交事务失败: %v", err)
		}

		elapsed := time.Since(start)
		qps := float64(batchSize) / elapsed.Seconds()

		t.Logf("批量写入 %d 条日志耗时: %v, QPS: %.0f", batchSize, elapsed, qps)

		// 验证写入数量
		var count int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM request_logs_perf").Scan(&count)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if count != batchSize {
			t.Errorf("日志数量期望 %d, 实际 %d", batchSize, count)
		}
	})
}

// TestPostgres_Observability_Metrics 测试监控指标存储
func TestPostgres_Observability_Metrics(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("创建 metrics UNLOGGED 分区表", func(t *testing.T) {
		// 创建 monitoring schema
		_, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS monitoring")
		if err != nil {
			t.Fatalf("创建 schema 失败: %v", err)
		}

		// 创建 metrics 表
		createSQL := `CREATE UNLOGGED TABLE IF NOT EXISTS monitoring.metrics (
			id SERIAL,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			value DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL,
			tags JSONB,
			node_id TEXT NOT NULL,
			PRIMARY KEY (timestamp, id)
		) PARTITION BY RANGE (timestamp)`

		_, err = db.ExecContext(ctx, createSQL)
		if err != nil {
			t.Fatalf("创建 metrics 表失败: %v", err)
		}

		// 创建今天的分区
		today := time.Now().UTC()
		partitionName := fmt.Sprintf("monitoring.metrics_%s", today.Format("2006_01_02"))
		start := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
		end := start.AddDate(0, 0, 1)

		createPartitionSQL := fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS %s PARTITION OF monitoring.metrics
			FOR VALUES FROM ('%s') TO ('%s')
		`, partitionName, start.Format("2006-01-02"), end.Format("2006-01-02"))

		_, err = db.ExecContext(ctx, createPartitionSQL)
		if err != nil {
			t.Fatalf("创建分区失败: %v", err)
		}

		// 验证表存在
		var exists bool
		err = db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables 
				WHERE table_schema = 'monitoring' AND table_name = 'metrics'
			)
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询表失败: %v", err)
		}
		if !exists {
			t.Error("monitoring.metrics 表应该存在")
		}
	})

	t.Run("创建 BRIN 索引", func(t *testing.T) {
		// 先确保表存在
		_, _ = db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS monitoring")
		_, _ = db.ExecContext(ctx, `CREATE UNLOGGED TABLE IF NOT EXISTS monitoring.metrics_brin (
			id SERIAL,
			name TEXT NOT NULL,
			value DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL,
			node_id TEXT NOT NULL
		)`)

		// 创建 BRIN 索引
		_, err := db.ExecContext(ctx, `
			CREATE INDEX IF NOT EXISTS idx_metrics_brin_timestamp 
			ON monitoring.metrics_brin USING BRIN (timestamp)
		`)
		if err != nil {
			t.Fatalf("创建 BRIN 索引失败: %v", err)
		}

		// 验证索引存在
		var indexExists bool
		err = db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM pg_indexes 
				WHERE schemaname = 'monitoring' 
				AND tablename = 'metrics_brin' 
				AND indexname = 'idx_metrics_brin_timestamp'
			)
		`).Scan(&indexExists)
		if err != nil {
			t.Fatalf("查询索引失败: %v", err)
		}
		if !indexExists {
			t.Error("BRIN 索引应该存在")
		}
	})

	t.Run("写入监控指标", func(t *testing.T) {
		// 确保表存在
		_, _ = db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS monitoring")
		_, _ = db.ExecContext(ctx, `CREATE UNLOGGED TABLE IF NOT EXISTS monitoring.metrics_test (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			value DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL,
			tags JSONB,
			node_id TEXT NOT NULL
		)`)

		// 写入指标
		point := &core.MetricPoint{
			Name:      "http_requests_total",
			Type:      core.MetricTypeCounter,
			Value:     100.0,
			Timestamp: time.Now().UTC(),
			Tags: map[string]string{
				"method": "GET",
				"path":   "/api",
			},
			NodeID: "node-1",
		}

		_, err := db.ExecContext(ctx, `
			INSERT INTO monitoring.metrics_test (name, type, value, timestamp, tags, node_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, point.Name, point.Type.String(), point.Value, point.Timestamp,
			`{"method": "GET", "path": "/api"}`, point.NodeID)
		if err != nil {
			t.Fatalf("写入指标失败: %v", err)
		}

		// 验证写入
		var count int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM monitoring.metrics_test WHERE name = $1", point.Name).Scan(&count)
		if err != nil {
			t.Fatalf("查询指标失败: %v", err)
		}
		if count != 1 {
			t.Errorf("指标数量期望 1, 实际 %d", count)
		}
	})
}

// TestPostgres_Observability_MaterializedView 测试物化视图
func TestPostgres_Observability_MaterializedView(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("创建和刷新物化视图", func(t *testing.T) {
		// 创建源表
		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS metrics_source (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				value DOUBLE PRECISION NOT NULL,
				timestamp TIMESTAMPTZ NOT NULL,
				node_id TEXT NOT NULL
			)
		`)
		if err != nil {
			t.Fatalf("创建源表失败: %v", err)
		}

		// 插入测试数据
		for i := 0; i < 100; i++ {
			_, err = db.ExecContext(ctx, `
				INSERT INTO metrics_source (name, value, timestamp, node_id)
				VALUES ($1, $2, $3, $4)
			`, "test_metric", float64(i), time.Now().UTC().Add(-time.Duration(i)*time.Hour), "node-1")
			if err != nil {
				t.Fatalf("插入数据失败: %v", err)
			}
		}

		// 创建物化视图
		mvm := core.NewMaterializedViewManager("metrics_daily_test")
		createSQL := `CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily_test AS
			SELECT
				date_trunc('day', timestamp) AS day,
				name,
				node_id,
				COUNT(*) AS count,
				AVG(value) AS avg_value,
				MIN(value) AS min_value,
				MAX(value) AS max_value,
				SUM(value) AS sum_value
			FROM metrics_source
			GROUP BY date_trunc('day', timestamp), name, node_id`

		_, err = db.ExecContext(ctx, createSQL)
		if err != nil {
			t.Fatalf("创建物化视图失败: %v", err)
		}

		// 验证物化视图存在
		var exists bool
		err = db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM pg_matviews WHERE matviewname = 'metrics_daily_test'
			)
		`).Scan(&exists)
		if err != nil {
			t.Fatalf("查询物化视图失败: %v", err)
		}
		if !exists {
			t.Error("物化视图应该存在")
		}

		// 刷新物化视图
		refreshSQL := mvm.RefreshViewSQL(false)
		_, err = db.ExecContext(ctx, refreshSQL)
		if err != nil {
			t.Fatalf("刷新物化视图失败: %v", err)
		}

		// 查询物化视图数据
		var count int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM metrics_daily_test").Scan(&count)
		if err != nil {
			t.Fatalf("查询物化视图数据失败: %v", err)
		}
		if count == 0 {
			t.Error("物化视图应该有数据")
		}

		t.Logf("物化视图包含 %d 条聚合记录", count)
	})
}

// TestPostgres_Observability_HighQPS 测试高 QPS 写入
func TestPostgres_Observability_HighQPS(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("高 QPS 写入测试", func(t *testing.T) {
		// 创建表
		_, err := db.ExecContext(ctx, `
			CREATE UNLOGGED TABLE IF NOT EXISTS high_qps_logs (
				id TEXT NOT NULL,
				timestamp TIMESTAMPTZ NOT NULL,
				data TEXT,
				PRIMARY KEY (id)
			)
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		// 使用缓冲区和批量写入
		buffer := core.NewLogBuffer(core.LogBufferConfig{
			BufferSize:    10000,
			FlushInterval: 100 * time.Millisecond,
			MaxBatchSize:  500,
			DropWhenFull:  true,
		})

		var writtenCount int64
		var mu sync.Mutex

		buffer.SetFlushHandler(func(logs []*core.RequestLog) error {
			tx, err := db.BeginTx(ctx, nil)
			if err != nil {
				return err
			}

			stmt, err := tx.PrepareContext(ctx, `
				INSERT INTO high_qps_logs (id, timestamp, data)
				VALUES ($1, $2, $3)
				ON CONFLICT (id) DO NOTHING
			`)
			if err != nil {
				tx.Rollback()
				return err
			}
			defer stmt.Close()

			for _, log := range logs {
				_, err = stmt.ExecContext(ctx, log.ID, log.Timestamp, log.Path)
				if err != nil {
					tx.Rollback()
					return err
				}
			}

			err = tx.Commit()
			if err != nil {
				return err
			}

			mu.Lock()
			writtenCount += int64(len(logs))
			mu.Unlock()

			return nil
		})

		// 模拟高 QPS 写入
		targetCount := 2000
		start := time.Now()

		for i := 0; i < targetCount; i++ {
			log := &core.RequestLog{
				ID:        fmt.Sprintf("log-%d", i),
				Timestamp: time.Now().UTC(),
				Path:      fmt.Sprintf("/api/test/%d", i),
			}
			_ = buffer.Write(log)
		}

		// 刷新剩余数据
		buffer.Flush()

		elapsed := time.Since(start)
		qps := float64(targetCount) / elapsed.Seconds()

		t.Logf("发送 %d 条日志, 耗时 %v, QPS: %.0f", targetCount, elapsed, qps)
		t.Logf("写入数据库 %d 条, 丢弃 %d 条", writtenCount, buffer.DroppedCount())

		// 验证写入
		var dbCount int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM high_qps_logs").Scan(&dbCount)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}

		t.Logf("数据库实际记录数: %d", dbCount)
	})
}

// TestPostgres_Observability_CircuitBreaker 测试熔断器
func TestPostgres_Observability_CircuitBreaker(t *testing.T) {
	t.Run("熔断器保护数据库", func(t *testing.T) {
		cb := core.NewCircuitBreaker(core.CircuitBreakerConfig{
			FailureThreshold: 3,
			ResetTimeout:     100 * time.Millisecond,
		})

		// 模拟连续失败
		for i := 0; i < 3; i++ {
			if cb.Allow() {
				// 模拟写入失败
				cb.RecordFailure()
			}
		}

		// 熔断后应该拒绝请求
		rejectedCount := 0
		for i := 0; i < 10; i++ {
			if !cb.Allow() {
				rejectedCount++
			}
		}

		if rejectedCount != 10 {
			t.Errorf("熔断后应该拒绝所有请求, 实际拒绝 %d", rejectedCount)
		}

		// 等待恢复
		time.Sleep(150 * time.Millisecond)

		// 恢复后应该允许请求
		if !cb.Allow() {
			t.Error("恢复后应该允许请求")
		}

		// 成功后完全恢复
		cb.RecordSuccess()
		if cb.State() != core.CircuitClosed {
			t.Error("成功后状态应该是 Closed")
		}
	})
}
