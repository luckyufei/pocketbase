package core

import (
	"context"
	"sync"
	"testing"
	"time"
)

// TestCacheInvalidator 测试缓存失效器
func TestCacheInvalidator(t *testing.T) {
	t.Run("创建缓存失效器", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		if invalidator == nil {
			t.Fatal("缓存失效器不能为 nil")
		}
	})

	t.Run("注册缓存处理器", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		called := false
		invalidator.OnInvalidate("users", func(recordID string) {
			called = true
		})

		// 模拟收到失效事件
		invalidator.handleInvalidation(EventPayload{
			NodeID:     "other-node",
			Event:      EventCacheInvalidate,
			Collection: "users",
			RecordID:   "123",
		})

		time.Sleep(10 * time.Millisecond)

		if !called {
			t.Error("处理器应该被调用")
		}
	})

	t.Run("按集合粒度失效", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		var usersInvalidated, postsInvalidated bool
		var mu sync.Mutex

		invalidator.OnInvalidate("users", func(recordID string) {
			mu.Lock()
			usersInvalidated = true
			mu.Unlock()
		})

		invalidator.OnInvalidate("posts", func(recordID string) {
			mu.Lock()
			postsInvalidated = true
			mu.Unlock()
		})

		// 只失效 users
		invalidator.handleInvalidation(EventPayload{
			NodeID:     "other-node",
			Event:      EventCacheInvalidate,
			Collection: "users",
			RecordID:   "123",
		})

		time.Sleep(10 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()

		if !usersInvalidated {
			t.Error("users 应该被失效")
		}
		if postsInvalidated {
			t.Error("posts 不应该被失效")
		}
	})

	t.Run("全局失效处理器", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		var received []string
		var mu sync.Mutex

		invalidator.OnInvalidateAll(func(collection, recordID string) {
			mu.Lock()
			received = append(received, collection+":"+recordID)
			mu.Unlock()
		})

		// 失效多个集合
		invalidator.handleInvalidation(EventPayload{
			NodeID:     "other-node",
			Event:      EventCacheInvalidate,
			Collection: "users",
			RecordID:   "1",
		})
		invalidator.handleInvalidation(EventPayload{
			NodeID:     "other-node",
			Event:      EventCacheInvalidate,
			Collection: "posts",
			RecordID:   "2",
		})

		time.Sleep(20 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()

		if len(received) != 2 {
			t.Errorf("期望收到 2 个失效事件, 实际 %d", len(received))
		}
	})

	t.Run("忽略本节点事件", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		called := false
		invalidator.OnInvalidate("users", func(recordID string) {
			called = true
		})

		// 发送来自本节点的事件
		invalidator.handleInvalidation(EventPayload{
			NodeID:     pubsub.NodeID(), // 同一节点
			Event:      EventCacheInvalidate,
			Collection: "users",
			RecordID:   "123",
		})

		time.Sleep(10 * time.Millisecond)

		if called {
			t.Error("不应该处理来自本节点的事件")
		}
	})
}

// TestCacheInvalidatorIntegration 测试缓存失效器与 PubSub 集成
func TestCacheInvalidatorIntegration(t *testing.T) {
	t.Run("通过 PubSub 触发失效", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		var received []string
		var mu sync.Mutex

		invalidator.OnInvalidate("users", func(recordID string) {
			mu.Lock()
			received = append(received, recordID)
			mu.Unlock()
		})

		// 启动失效器
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		go invalidator.Start(ctx)
		time.Sleep(10 * time.Millisecond)

		// 模拟从其他节点收到的事件
		pubsub.dispatchLocal(ChannelCacheInvalidation, EventPayload{
			NodeID:     "other-node",
			Event:      EventCacheInvalidate,
			Collection: "users",
			RecordID:   "456",
		})

		time.Sleep(20 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()

		if len(received) != 1 || received[0] != "456" {
			t.Errorf("期望收到 recordID=456, 实际 %v", received)
		}
	})
}

// TestInvalidateOnSave 测试保存时发送失效通知
func TestInvalidateOnSave(t *testing.T) {
	t.Run("保存后发送通知", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		// 模拟保存操作后调用
		err := invalidator.InvalidateRecord(context.Background(), "users", "123")
		if err != nil {
			t.Errorf("发送失效通知失败: %v", err)
		}
	})

	t.Run("删除后发送通知", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		err := invalidator.InvalidateRecord(context.Background(), "users", "123")
		if err != nil {
			t.Errorf("发送失效通知失败: %v", err)
		}
	})

	t.Run("批量失效", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		recordIDs := []string{"1", "2", "3", "4", "5"}
		err := invalidator.InvalidateRecords(context.Background(), "users", recordIDs)
		if err != nil {
			t.Errorf("批量失效失败: %v", err)
		}
	})

	t.Run("失效整个集合", func(t *testing.T) {
		pubsub := NewPubSubManager(nil)
		invalidator := NewCacheInvalidator(pubsub)

		err := invalidator.InvalidateCollection(context.Background(), "users")
		if err != nil {
			t.Errorf("失效集合失败: %v", err)
		}
	})
}
