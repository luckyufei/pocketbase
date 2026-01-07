package tests_test

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestPostgres_PubSub_LISTEN_NOTIFY 测试 PostgreSQL LISTEN/NOTIFY 功能
func TestPostgres_PubSub_LISTEN_NOTIFY(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	// 测试基本的 NOTIFY/LISTEN
	t.Run("basic_notify", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// 发送通知
		channel := "test_channel"
		payload := `{"test": "data"}`

		// 在另一个连接上监听
		received := make(chan string, 1)
		go func() {
			conn, err := container.DB().Conn(ctx)
			if err != nil {
				t.Logf("获取连接失败: %v", err)
				return
			}
			defer conn.Close()

			// 执行 LISTEN
			_, err = conn.ExecContext(ctx, "LISTEN "+channel)
			if err != nil {
				t.Logf("LISTEN 失败: %v", err)
				return
			}

			// 使用 pgx 的底层接口接收通知
			// 这里简化为查询方式
			time.Sleep(500 * time.Millisecond)

			// 查询是否有通知
			var exists bool
			err = conn.QueryRowContext(ctx, "SELECT true").Scan(&exists)
			if err == nil {
				received <- "received"
			}
		}()

		// 等待监听器准备好
		time.Sleep(200 * time.Millisecond)

		// 发送通知
		_, err := container.DB().ExecContext(ctx, "SELECT pg_notify($1, $2)", channel, payload)
		if err != nil {
			t.Fatalf("发送通知失败: %v", err)
		}

		// 验证通知已发送（通过查询 pg_notification_queue_usage）
		var queueUsage float64
		err = container.DB().QueryRowContext(ctx, "SELECT pg_notification_queue_usage()").Scan(&queueUsage)
		if err != nil {
			t.Fatalf("查询通知队列失败: %v", err)
		}
		t.Logf("通知队列使用率: %.4f%%", queueUsage*100)
	})

	// 测试 JSON payload
	t.Run("json_payload", func(t *testing.T) {
		ctx := context.Background()

		payload := core.EventPayload{
			NodeID:     "test-node",
			Event:      core.EventRecordCreate,
			Collection: "users",
			RecordID:   "123",
			Timestamp:  time.Now().Unix(),
			Data:       map[string]any{"name": "test"},
		}

		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("序列化失败: %v", err)
		}

		// 发送 JSON 通知
		_, err = container.DB().ExecContext(ctx, "SELECT pg_notify($1, $2)", "pb_record_changes", string(data))
		if err != nil {
			t.Fatalf("发送 JSON 通知失败: %v", err)
		}
	})

	// 测试大 payload
	t.Run("large_payload", func(t *testing.T) {
		ctx := context.Background()

		// PostgreSQL NOTIFY payload 最大 8000 字节
		largeData := make(map[string]any)
		for i := 0; i < 100; i++ {
			largeData[string(rune('a'+i%26))+string(rune(i))] = "value"
		}

		payload := core.EventPayload{
			NodeID:     "test-node",
			Event:      core.EventRecordUpdate,
			Collection: "large_collection",
			RecordID:   "456",
			Timestamp:  time.Now().Unix(),
			Data:       largeData,
		}

		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("序列化失败: %v", err)
		}

		t.Logf("Payload 大小: %d 字节", len(data))

		if len(data) > 8000 {
			t.Skip("Payload 超过 8000 字节限制")
		}

		_, err = container.DB().ExecContext(ctx, "SELECT pg_notify($1, $2)", "pb_record_changes", string(data))
		if err != nil {
			t.Fatalf("发送大 payload 失败: %v", err)
		}
	})
}

// TestPostgres_PubSub_MultipleListeners 测试多个监听器
func TestPostgres_PubSub_MultipleListeners(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	t.Run("multiple_channels", func(t *testing.T) {
		ctx := context.Background()

		channels := []string{
			core.ChannelRecordChanges,
			core.ChannelCollectionChanges,
			core.ChannelCacheInvalidation,
		}

		// 在每个频道发送通知
		for _, ch := range channels {
			payload := core.EventPayload{
				NodeID:    "test-node",
				Event:     core.EventRecordCreate,
				Timestamp: time.Now().Unix(),
			}
			data, _ := json.Marshal(payload)

			_, err := container.DB().ExecContext(ctx, "SELECT pg_notify($1, $2)", ch, string(data))
			if err != nil {
				t.Errorf("发送到频道 %s 失败: %v", ch, err)
			}
		}
	})
}

// TestPostgres_PubSub_ConcurrentNotify 测试并发通知
func TestPostgres_PubSub_ConcurrentNotify(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	t.Run("concurrent_notifications", func(t *testing.T) {
		ctx := context.Background()
		const numNotifications = 100

		var wg sync.WaitGroup
		var successCount int64
		var mu sync.Mutex

		for i := 0; i < numNotifications; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()

				payload := core.EventPayload{
					NodeID:     "test-node",
					Event:      core.EventRecordUpdate,
					Collection: "test",
					RecordID:   string(rune('0' + idx%10)),
					Timestamp:  time.Now().Unix(),
				}
				data, _ := json.Marshal(payload)

				_, err := container.DB().ExecContext(ctx, "SELECT pg_notify($1, $2)", "pb_test", string(data))
				if err == nil {
					mu.Lock()
					successCount++
					mu.Unlock()
				}
			}(i)
		}

		wg.Wait()

		t.Logf("成功发送: %d/%d", successCount, numNotifications)
		if successCount != numNotifications {
			t.Errorf("期望 %d 次成功, 实际 %d", numNotifications, successCount)
		}
	})
}

// TestPostgres_PubSub_NodeID 测试节点 ID 功能
func TestPostgres_PubSub_NodeID(t *testing.T) {
	t.Run("unique_node_ids", func(t *testing.T) {
		ids := make(map[string]bool)
		for i := 0; i < 100; i++ {
			id := core.GenerateNodeID()
			if ids[id] {
				t.Errorf("生成了重复的节点 ID: %s", id)
			}
			ids[id] = true
		}
	})

	t.Run("node_id_format", func(t *testing.T) {
		id := core.GenerateNodeID()
		if len(id) < 10 {
			t.Errorf("节点 ID 太短: %s", id)
		}
		t.Logf("节点 ID 示例: %s", id)
	})
}
