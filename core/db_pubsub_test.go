package core

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// TestPubSubEventPayload 测试事件 Payload 结构
func TestPubSubEventPayload(t *testing.T) {
	t.Run("序列化和反序列化", func(t *testing.T) {
		payload := EventPayload{
			NodeID:     "node-123",
			Event:      EventRecordCreate,
			Collection: "users",
			RecordID:   "record-456",
			Timestamp:  time.Now().Unix(),
			Data:       map[string]any{"name": "test"},
		}

		// 序列化
		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("序列化失败: %v", err)
		}

		// 反序列化
		var decoded EventPayload
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("反序列化失败: %v", err)
		}

		if decoded.NodeID != payload.NodeID {
			t.Errorf("NodeID 不匹配: expected %s, got %s", payload.NodeID, decoded.NodeID)
		}
		if decoded.Event != payload.Event {
			t.Errorf("Event 不匹配: expected %s, got %s", payload.Event, decoded.Event)
		}
		if decoded.Collection != payload.Collection {
			t.Errorf("Collection 不匹配: expected %s, got %s", payload.Collection, decoded.Collection)
		}
		if decoded.RecordID != payload.RecordID {
			t.Errorf("RecordID 不匹配: expected %s, got %s", payload.RecordID, decoded.RecordID)
		}
	})

	t.Run("事件类型常量", func(t *testing.T) {
		events := []EventType{
			EventRecordCreate,
			EventRecordUpdate,
			EventRecordDelete,
			EventCollectionCreate,
			EventCollectionUpdate,
			EventCollectionDelete,
			EventCacheInvalidate,
		}

		for _, e := range events {
			if e == "" {
				t.Error("事件类型不能为空")
			}
		}
	})
}

// TestNodeIDGeneration 测试节点 ID 生成
func TestNodeIDGeneration(t *testing.T) {
	t.Run("生成唯一节点 ID", func(t *testing.T) {
		id1 := GenerateNodeID()
		id2 := GenerateNodeID()

		if id1 == "" {
			t.Error("节点 ID 不能为空")
		}
		if id1 == id2 {
			t.Error("两次生成的节点 ID 应该不同")
		}
	})

	t.Run("节点 ID 格式", func(t *testing.T) {
		id := GenerateNodeID()
		// 节点 ID 应该有合理的长度
		if len(id) < 8 || len(id) > 64 {
			t.Errorf("节点 ID 长度异常: %d", len(id))
		}
	})
}

// TestPubSubChannels 测试频道常量
func TestPubSubChannels(t *testing.T) {
	channels := []string{
		ChannelRecordChanges,
		ChannelCollectionChanges,
		ChannelCacheInvalidation,
	}

	for _, ch := range channels {
		if ch == "" {
			t.Error("频道名称不能为空")
		}
		// PostgreSQL 频道名称不能超过 63 字节
		if len(ch) > 63 {
			t.Errorf("频道名称过长: %s (%d bytes)", ch, len(ch))
		}
	}
}

// TestPubSubManager 测试 PubSub 管理器
func TestPubSubManager(t *testing.T) {
	t.Run("创建管理器", func(t *testing.T) {
		manager := NewPubSubManager(nil) // nil 表示使用 mock
		if manager == nil {
			t.Fatal("管理器不能为 nil")
		}
		if manager.NodeID() == "" {
			t.Error("管理器应该有节点 ID")
		}
	})

	t.Run("订阅和取消订阅", func(t *testing.T) {
		manager := NewPubSubManager(nil)

		// 订阅
		handler := func(payload EventPayload) {}
		subID := manager.Subscribe(ChannelRecordChanges, handler)
		if subID == "" {
			t.Error("订阅 ID 不能为空")
		}

		// 取消订阅
		manager.Unsubscribe(subID)
	})

	t.Run("本地事件分发", func(t *testing.T) {
		manager := NewPubSubManager(nil)

		var received []EventPayload
		var mu sync.Mutex

		// 订阅
		manager.Subscribe(ChannelRecordChanges, func(payload EventPayload) {
			mu.Lock()
			received = append(received, payload)
			mu.Unlock()
		})

		// 发布本地事件
		payload := EventPayload{
			NodeID:     "other-node", // 不同节点
			Event:      EventRecordCreate,
			Collection: "users",
			RecordID:   "123",
			Timestamp:  time.Now().Unix(),
		}

		manager.dispatchLocal(ChannelRecordChanges, payload)

		// 等待处理
		time.Sleep(10 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()
		if len(received) != 1 {
			t.Errorf("期望收到 1 个事件, 实际 %d", len(received))
		}
	})

	t.Run("忽略自己发送的事件", func(t *testing.T) {
		manager := NewPubSubManager(nil)

		var received []EventPayload
		var mu sync.Mutex

		manager.Subscribe(ChannelRecordChanges, func(payload EventPayload) {
			mu.Lock()
			received = append(received, payload)
			mu.Unlock()
		})

		// 发布来自本节点的事件
		payload := EventPayload{
			NodeID:     manager.NodeID(), // 同一节点
			Event:      EventRecordCreate,
			Collection: "users",
			RecordID:   "123",
			Timestamp:  time.Now().Unix(),
		}

		manager.dispatchLocal(ChannelRecordChanges, payload)

		// 等待处理
		time.Sleep(10 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()
		if len(received) != 0 {
			t.Errorf("不应该收到自己发送的事件, 实际收到 %d", len(received))
		}
	})
}

// TestPubSubReconnect 测试重连逻辑
func TestPubSubReconnect(t *testing.T) {
	t.Run("重连配置", func(t *testing.T) {
		config := DefaultReconnectConfig()

		// MaxRetries = 0 表示无限重试
		if config.MaxRetries < 0 {
			t.Error("最大重试次数不应该为负数")
		}
		if config.InitialDelay <= 0 {
			t.Error("初始延迟应该大于 0")
		}
		if config.MaxDelay <= config.InitialDelay {
			t.Error("最大延迟应该大于初始延迟")
		}
	})

	t.Run("指数退避计算", func(t *testing.T) {
		config := ReconnectConfig{
			InitialDelay: 100 * time.Millisecond,
			MaxDelay:     10 * time.Second,
			Multiplier:   2.0,
		}

		delay1 := config.GetDelay(1)
		delay2 := config.GetDelay(2)
		delay3 := config.GetDelay(3)

		if delay2 <= delay1 {
			t.Error("第二次延迟应该大于第一次")
		}
		if delay3 <= delay2 {
			t.Error("第三次延迟应该大于第二次")
		}

		// 验证不超过最大延迟
		delayMax := config.GetDelay(100)
		if delayMax > config.MaxDelay {
			t.Errorf("延迟不应超过最大值: %v > %v", delayMax, config.MaxDelay)
		}
	})
}

// TestPubSubContext 测试上下文取消
func TestPubSubContext(t *testing.T) {
	t.Run("上下文取消停止监听", func(t *testing.T) {
		manager := NewPubSubManager(nil)

		ctx, cancel := context.WithCancel(context.Background())

		// 启动监听 (mock 模式)
		done := make(chan struct{})
		go func() {
			manager.StartListening(ctx)
			close(done)
		}()

		// 取消上下文
		cancel()

		// 等待监听停止
		select {
		case <-done:
			// 成功
		case <-time.After(time.Second):
			t.Error("监听应该在上下文取消后停止")
		}
	})
}
