package tests_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tests"
)

// contains 检查字符串是否包含子字符串 (不区分大小写)
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// skipIfNoDockerConcurrent 检查 Docker 是否可用
func skipIfNoDockerConcurrent(t *testing.T) {
	if os.Getenv("SKIP_DOCKER_TESTS") == "1" {
		t.Skip("跳过 Docker 测试 (SKIP_DOCKER_TESTS=1)")
	}
	dockerSockets := []string{
		"/var/run/docker.sock",
		os.Getenv("HOME") + "/.colima/docker.sock",
		os.Getenv("HOME") + "/.colima/default/docker.sock",
		os.Getenv("HOME") + "/.docker/run/docker.sock",
	}
	dockerAvailable := false
	for _, sock := range dockerSockets {
		if _, err := os.Stat(sock); err == nil {
			dockerAvailable = true
			break
		}
	}
	if !dockerAvailable {
		t.Skip("跳过 Docker 测试 (Docker 不可用)")
	}
}

// TestPostgres_ConcurrentUpdate_Basic 测试基本并发更新
func TestPostgres_ConcurrentUpdate_Basic(t *testing.T) {
	skipIfNoDockerConcurrent(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE concurrent_test (
			id TEXT PRIMARY KEY,
			counter INTEGER NOT NULL DEFAULT 0,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		);
		INSERT INTO concurrent_test (id, counter) VALUES ('test1', 0);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 并发更新测试
	t.Run("concurrent_increment", func(t *testing.T) {
		const numGoroutines = 10
		const incrementsPerGoroutine = 100

		var wg sync.WaitGroup
		var successCount int64
		var failCount int64

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for j := 0; j < incrementsPerGoroutine; j++ {
					_, err := container.DB().Exec(`
						UPDATE concurrent_test 
						SET counter = counter + 1, updated_at = NOW() 
						WHERE id = 'test1'
					`)
					if err != nil {
						atomic.AddInt64(&failCount, 1)
					} else {
						atomic.AddInt64(&successCount, 1)
					}
				}
			}()
		}

		wg.Wait()

		// 验证最终计数
		var finalCounter int
		err := container.DB().QueryRow(`SELECT counter FROM concurrent_test WHERE id = 'test1'`).Scan(&finalCounter)
		if err != nil {
			t.Fatalf("查询最终计数失败: %v", err)
		}

		expectedTotal := numGoroutines * incrementsPerGoroutine
		t.Logf("成功: %d, 失败: %d, 最终计数: %d, 期望: %d",
			successCount, failCount, finalCounter, expectedTotal)

		if finalCounter != expectedTotal {
			t.Errorf("计数不一致: 期望 %d, 实际 %d", expectedTotal, finalCounter)
		}
	})
}

// TestPostgres_ConcurrentUpdate_WithTransaction 测试事务中的并发更新
func TestPostgres_ConcurrentUpdate_WithTransaction(t *testing.T) {
	skipIfNoDockerConcurrent(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE tx_concurrent_test (
			id TEXT PRIMARY KEY,
			balance INTEGER NOT NULL DEFAULT 1000
		);
		INSERT INTO tx_concurrent_test (id, balance) VALUES ('account1', 1000);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 并发事务测试 - 模拟银行转账
	t.Run("concurrent_transactions", func(t *testing.T) {
		const numTransactions = 50
		const transferAmount = 10

		var wg sync.WaitGroup
		var successCount int64
		var rollbackCount int64

		for i := 0; i < numTransactions; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				tx, err := container.DB().BeginTx(context.Background(), &sql.TxOptions{
					Isolation: sql.LevelSerializable,
				})
				if err != nil {
					atomic.AddInt64(&rollbackCount, 1)
					return
				}

				// 读取当前余额
				var balance int
				err = tx.QueryRow(`SELECT balance FROM tx_concurrent_test WHERE id = 'account1'`).Scan(&balance)
				if err != nil {
					tx.Rollback()
					atomic.AddInt64(&rollbackCount, 1)
					return
				}

				// 检查余额是否足够
				if balance < transferAmount {
					tx.Rollback()
					atomic.AddInt64(&rollbackCount, 1)
					return
				}

				// 扣减余额
				_, err = tx.Exec(`UPDATE tx_concurrent_test SET balance = balance - $1 WHERE id = 'account1'`, transferAmount)
				if err != nil {
					tx.Rollback()
					atomic.AddInt64(&rollbackCount, 1)
					return
				}

				// 提交事务
				if err := tx.Commit(); err != nil {
					atomic.AddInt64(&rollbackCount, 1)
					return
				}

				atomic.AddInt64(&successCount, 1)
			}()
		}

		wg.Wait()

		// 验证最终余额
		var finalBalance int
		err := container.DB().QueryRow(`SELECT balance FROM tx_concurrent_test WHERE id = 'account1'`).Scan(&finalBalance)
		if err != nil {
			t.Fatalf("查询最终余额失败: %v", err)
		}

		expectedBalance := 1000 - int(successCount)*transferAmount
		t.Logf("成功事务: %d, 回滚事务: %d, 最终余额: %d, 期望余额: %d",
			successCount, rollbackCount, finalBalance, expectedBalance)

		if finalBalance != expectedBalance {
			t.Errorf("余额不一致: 期望 %d, 实际 %d", expectedBalance, finalBalance)
		}

		if finalBalance < 0 {
			t.Error("余额不应该为负数")
		}
	})
}

// TestPostgres_ConcurrentUpdate_SelectForUpdate 测试 SELECT FOR UPDATE 锁定
func TestPostgres_ConcurrentUpdate_SelectForUpdate(t *testing.T) {
	skipIfNoDockerConcurrent(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE forUpdate_test (
			id TEXT PRIMARY KEY,
			value INTEGER NOT NULL DEFAULT 0
		);
		INSERT INTO forUpdate_test (id, value) VALUES ('row1', 0);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 使用 SELECT FOR UPDATE 的并发更新
	t.Run("select_for_update", func(t *testing.T) {
		const numGoroutines = 20
		const incrementsPerGoroutine = 50

		var wg sync.WaitGroup
		var successCount int64

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for j := 0; j < incrementsPerGoroutine; j++ {
					tx, err := container.DB().Begin()
					if err != nil {
						continue
					}

					// 使用 SELECT FOR UPDATE 锁定行
					var value int
					err = tx.QueryRow(`SELECT value FROM forUpdate_test WHERE id = 'row1' FOR UPDATE`).Scan(&value)
					if err != nil {
						tx.Rollback()
						continue
					}

					// 更新值
					_, err = tx.Exec(`UPDATE forUpdate_test SET value = $1 WHERE id = 'row1'`, value+1)
					if err != nil {
						tx.Rollback()
						continue
					}

					if err := tx.Commit(); err != nil {
						continue
					}

					atomic.AddInt64(&successCount, 1)
				}
			}()
		}

		wg.Wait()

		// 验证最终值
		var finalValue int
		err := container.DB().QueryRow(`SELECT value FROM forUpdate_test WHERE id = 'row1'`).Scan(&finalValue)
		if err != nil {
			t.Fatalf("查询最终值失败: %v", err)
		}

		t.Logf("成功更新: %d, 最终值: %d", successCount, finalValue)

		if int64(finalValue) != successCount {
			t.Errorf("值不一致: 期望 %d, 实际 %d", successCount, finalValue)
		}
	})
}

// TestPostgres_ConcurrentInsert_UniqueConstraint 测试并发插入时的唯一约束
func TestPostgres_ConcurrentInsert_UniqueConstraint(t *testing.T) {
	skipIfNoDockerConcurrent(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE unique_test (
			id SERIAL PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 并发插入相同邮箱
	t.Run("concurrent_insert_same_email", func(t *testing.T) {
		const numGoroutines = 10
		email := "test@example.com"

		var wg sync.WaitGroup
		var successCount int64
		var duplicateCount int64
		var otherErrors int64

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, err := container.DB().Exec(`INSERT INTO unique_test (email) VALUES ($1)`, email)
				if err != nil {
					errStr := err.Error()
					// 检查是否为唯一约束违反
					if tests.IsUniqueViolation(err) ||
						contains(errStr, "duplicate") ||
						contains(errStr, "unique") ||
						contains(errStr, "23505") {
						atomic.AddInt64(&duplicateCount, 1)
					} else {
						atomic.AddInt64(&otherErrors, 1)
						t.Logf("其他错误: %v", err)
					}
				} else {
					atomic.AddInt64(&successCount, 1)
				}
			}()
		}

		wg.Wait()

		t.Logf("成功插入: %d, 重复错误: %d, 其他错误: %d", successCount, duplicateCount, otherErrors)

		// 应该只有一个成功插入
		if successCount != 1 {
			t.Errorf("期望 1 次成功插入, 实际 %d 次", successCount)
		}

		// 验证数据库中只有一条记录
		var count int
		err := container.DB().QueryRow(`SELECT COUNT(*) FROM unique_test WHERE email = $1`, email).Scan(&count)
		if err != nil {
			t.Fatalf("查询记录数失败: %v", err)
		}
		if count != 1 {
			t.Errorf("期望数据库中有 1 条记录, 实际 %d 条", count)
		}
	})
}

// TestPostgres_DeadlockDetection 测试死锁检测
func TestPostgres_DeadlockDetection(t *testing.T) {
	skipIfNoDockerConcurrent(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE deadlock_test (
			id TEXT PRIMARY KEY,
			value INTEGER NOT NULL DEFAULT 0
		);
		INSERT INTO deadlock_test (id, value) VALUES ('row1', 1), ('row2', 2);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 尝试创建死锁场景
	t.Run("deadlock_scenario", func(t *testing.T) {
		var wg sync.WaitGroup
		var deadlockDetected int64

		// 事务 1: 先锁 row1，再锁 row2
		wg.Add(1)
		go func() {
			defer wg.Done()
			tx, err := container.DB().Begin()
			if err != nil {
				return
			}
			defer tx.Rollback()

			// 锁定 row1
			_, err = tx.Exec(`UPDATE deadlock_test SET value = value + 1 WHERE id = 'row1'`)
			if err != nil {
				return
			}

			// 等待一会儿让另一个事务锁定 row2
			time.Sleep(100 * time.Millisecond)

			// 尝试锁定 row2
			_, err = tx.Exec(`UPDATE deadlock_test SET value = value + 1 WHERE id = 'row2'`)
			if err != nil {
				if tests.IsDeadlock(err) {
					atomic.AddInt64(&deadlockDetected, 1)
				}
				return
			}

			tx.Commit()
		}()

		// 事务 2: 先锁 row2，再锁 row1 (相反顺序)
		wg.Add(1)
		go func() {
			defer wg.Done()
			tx, err := container.DB().Begin()
			if err != nil {
				return
			}
			defer tx.Rollback()

			// 锁定 row2
			_, err = tx.Exec(`UPDATE deadlock_test SET value = value + 1 WHERE id = 'row2'`)
			if err != nil {
				return
			}

			// 等待一会儿让另一个事务锁定 row1
			time.Sleep(100 * time.Millisecond)

			// 尝试锁定 row1
			_, err = tx.Exec(`UPDATE deadlock_test SET value = value + 1 WHERE id = 'row1'`)
			if err != nil {
				if tests.IsDeadlock(err) {
					atomic.AddInt64(&deadlockDetected, 1)
				}
				return
			}

			tx.Commit()
		}()

		wg.Wait()

		t.Logf("死锁检测次数: %d", deadlockDetected)

		// PostgreSQL 应该检测到死锁并回滚其中一个事务
		// 注意: 死锁不一定每次都发生，取决于时序
		if deadlockDetected > 0 {
			t.Log("PostgreSQL 正确检测到死锁")
		}
	})
}

// TestPostgres_ConcurrentStressTest 压力测试
func TestPostgres_ConcurrentStressTest(t *testing.T) {
	skipIfNoDockerConcurrent(t)

	if testing.Short() {
		t.Skip("跳过压力测试 (短测试模式)")
	}

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("启动 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE stress_test (
			id TEXT PRIMARY KEY,
			data JSONB NOT NULL DEFAULT '{}'::jsonb,
			counter INTEGER NOT NULL DEFAULT 0,
			updated_at TIMESTAMPTZ DEFAULT NOW()
		);
		CREATE INDEX idx_stress_test_data_gin ON stress_test USING GIN (data);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 预先插入一些数据
	for i := 0; i < 100; i++ {
		_, err := container.DB().Exec(`
			INSERT INTO stress_test (id, data, counter) 
			VALUES ($1, $2, 0)
		`, fmt.Sprintf("row_%d", i), fmt.Sprintf(`{"index": %d, "status": "active"}`, i))
		if err != nil {
			t.Fatalf("插入初始数据失败: %v", err)
		}
	}

	// 压力测试
	t.Run("stress_test", func(t *testing.T) {
		const numGoroutines = 50
		const operationsPerGoroutine = 100
		const testDuration = 10 * time.Second

		ctx, cancel := context.WithTimeout(context.Background(), testDuration)
		defer cancel()

		var wg sync.WaitGroup
		var totalOps int64
		var errors int64

		startTime := time.Now()

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()

				for j := 0; j < operationsPerGoroutine; j++ {
					select {
					case <-ctx.Done():
						return
					default:
					}

					rowID := fmt.Sprintf("row_%d", (workerID*operationsPerGoroutine+j)%100)

					// 随机执行读或写操作
					if j%3 == 0 {
						// 读操作
						var counter int
						err := container.DB().QueryRow(`
							SELECT counter FROM stress_test WHERE id = $1
						`, rowID).Scan(&counter)
						if err != nil {
							atomic.AddInt64(&errors, 1)
						} else {
							atomic.AddInt64(&totalOps, 1)
						}
					} else if j%3 == 1 {
						// 更新操作
						_, err := container.DB().Exec(`
							UPDATE stress_test 
							SET counter = counter + 1, updated_at = NOW() 
							WHERE id = $1
						`, rowID)
						if err != nil {
							atomic.AddInt64(&errors, 1)
						} else {
							atomic.AddInt64(&totalOps, 1)
						}
					} else {
						// JSON 查询操作
						var count int
						err := container.DB().QueryRow(`
							SELECT COUNT(*) FROM stress_test 
							WHERE data @> '{"status": "active"}'
						`).Scan(&count)
						if err != nil {
							atomic.AddInt64(&errors, 1)
						} else {
							atomic.AddInt64(&totalOps, 1)
						}
					}
				}
			}(i)
		}

		wg.Wait()

		duration := time.Since(startTime)
		opsPerSecond := float64(totalOps) / duration.Seconds()

		t.Logf("压力测试结果:")
		t.Logf("  总操作数: %d", totalOps)
		t.Logf("  错误数: %d", errors)
		t.Logf("  持续时间: %v", duration)
		t.Logf("  OPS: %.2f", opsPerSecond)

		// 错误率应该很低
		errorRate := float64(errors) / float64(totalOps+errors) * 100
		if errorRate > 1 {
			t.Errorf("错误率过高: %.2f%%", errorRate)
		}
	})
}
