package core

import (
	"context"
	"sync"
	"testing"
	"time"
)

// ============================================================================
// T-5.1.6: 注入 Realtime 订阅管理器测试
// ============================================================================

// TestWALRealtimeIntegration 测试 WAL 与 Realtime 集成
func TestWALRealtimeIntegration(t *testing.T) {
	t.Run("创建集成引擎", func(t *testing.T) {
		engine := NewWALRealtimeEngine(nil)
		if engine == nil {
			t.Fatal("引擎不应为 nil")
		}
	})

	t.Run("配置 WAL 消费者", func(t *testing.T) {
		config := &WALRealtimeConfig{
			SlotName:        "test_slot",
			PublicationName: "test_pub",
			EnableWAL:       true,
		}
		engine := NewWALRealtimeEngine(config)

		if engine.config.SlotName != "test_slot" {
			t.Errorf("SlotName 期望 test_slot, 实际 %s", engine.config.SlotName)
		}
	})
}

// TestWALEventDispatcher 测试事件分发器
func TestWALEventDispatcher(t *testing.T) {
	t.Run("创建分发器", func(t *testing.T) {
		dispatcher := NewWALEventDispatcher()
		if dispatcher == nil {
			t.Fatal("分发器不应为 nil")
		}
	})

	t.Run("注册事件处理器", func(t *testing.T) {
		dispatcher := NewWALEventDispatcher()

		handlerCalled := false
		dispatcher.OnEvent("users", func(event *RealtimeRecordEvent) {
			handlerCalled = true
		})

		// 分发事件
		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "users",
			Record:     map[string]interface{}{"id": "user-1"},
		}
		dispatcher.Dispatch(event)

		// 等待处理
		time.Sleep(10 * time.Millisecond)

		if !handlerCalled {
			t.Error("处理器应该被调用")
		}
	})

	t.Run("通配符处理器", func(t *testing.T) {
		dispatcher := NewWALEventDispatcher()

		var received []string
		var mu sync.Mutex

		dispatcher.OnEvent("*", func(event *RealtimeRecordEvent) {
			mu.Lock()
			received = append(received, event.Collection)
			mu.Unlock()
		})

		// 分发多个事件
		dispatcher.Dispatch(&RealtimeRecordEvent{Collection: "users"})
		dispatcher.Dispatch(&RealtimeRecordEvent{Collection: "posts"})

		time.Sleep(10 * time.Millisecond)

		mu.Lock()
		if len(received) != 2 {
			t.Errorf("通配符处理器应该接收 2 个事件, 实际 %d", len(received))
		}
		mu.Unlock()
	})

	t.Run("移除处理器", func(t *testing.T) {
		dispatcher := NewWALEventDispatcher()

		handlerID := dispatcher.OnEvent("users", func(event *RealtimeRecordEvent) {
			t.Error("处理器不应该被调用")
		})

		dispatcher.RemoveHandler(handlerID)

		// 分发事件
		dispatcher.Dispatch(&RealtimeRecordEvent{Collection: "users"})

		time.Sleep(10 * time.Millisecond)
	})
}

// TestWALSubscriptionBridge 测试订阅桥接
func TestWALSubscriptionBridge(t *testing.T) {
	t.Run("创建桥接", func(t *testing.T) {
		subManager := NewSubscriptionManager()
		bridge := NewWALSubscriptionBridge(subManager)

		if bridge == nil {
			t.Fatal("桥接不应为 nil")
		}
	})

	t.Run("事件路由到订阅者", func(t *testing.T) {
		subManager := NewSubscriptionManager()
		bridge := NewWALSubscriptionBridge(subManager)

		// 添加订阅者
		eventCh := make(chan *RealtimeRecordEvent, 1)
		sub := &Subscriber{
			ID:         "sub-1",
			UserID:     "user-1",
			Collection: "posts",
			Channel:    eventCh,
		}
		subManager.Subscribe(sub)

		// 路由事件
		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1"},
		}

		bridge.RouteEvent(event)

		// 检查订阅者是否收到事件
		select {
		case received := <-eventCh:
			if received.Collection != "posts" {
				t.Errorf("集合期望 posts, 实际 %s", received.Collection)
			}
		case <-time.After(100 * time.Millisecond):
			t.Error("订阅者应该收到事件")
		}
	})

	t.Run("事件不路由到无关订阅者", func(t *testing.T) {
		subManager := NewSubscriptionManager()
		bridge := NewWALSubscriptionBridge(subManager)

		// 添加订阅 users 的订阅者
		eventCh := make(chan *RealtimeRecordEvent, 1)
		sub := &Subscriber{
			ID:         "sub-1",
			Collection: "users",
			Channel:    eventCh,
		}
		subManager.Subscribe(sub)

		// 路由 posts 事件
		event := &RealtimeRecordEvent{
			Collection: "posts",
		}

		bridge.RouteEvent(event)

		// 订阅者不应收到事件
		select {
		case <-eventCh:
			t.Error("订阅者不应收到无关集合的事件")
		case <-time.After(50 * time.Millisecond):
			// 正确，没有收到事件
		}
	})
}

// TestWALRealtimeEngineLifecycle 测试引擎生命周期
func TestWALRealtimeEngineLifecycle(t *testing.T) {
	t.Run("启动和停止", func(t *testing.T) {
		config := &WALRealtimeConfig{
			EnableWAL: false, // 禁用 WAL 以便测试
		}
		engine := NewWALRealtimeEngine(config)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// 启动引擎
		err := engine.Start(ctx)
		if err != nil {
			t.Fatalf("启动引擎失败: %v", err)
		}

		if !engine.IsRunning() {
			t.Error("引擎应该正在运行")
		}

		// 停止引擎
		err = engine.Stop()
		if err != nil {
			t.Fatalf("停止引擎失败: %v", err)
		}

		if engine.IsRunning() {
			t.Error("引擎应该已停止")
		}
	})

	t.Run("订阅和取消订阅", func(t *testing.T) {
		engine := NewWALRealtimeEngine(nil)

		sub := &Subscriber{
			ID:         "sub-1",
			Collection: "posts",
			Channel:    make(chan *RealtimeRecordEvent, 1),
		}

		engine.Subscribe(sub)

		subs := engine.GetSubscribers("posts")
		if len(subs) != 1 {
			t.Errorf("订阅者数量期望 1, 实际 %d", len(subs))
		}

		engine.Unsubscribe("sub-1")

		subs = engine.GetSubscribers("posts")
		if len(subs) != 0 {
			t.Errorf("取消订阅后订阅者数量期望 0, 实际 %d", len(subs))
		}
	})
}

// TestWALRealtimeMetrics 测试引擎指标
func TestWALRealtimeMetrics(t *testing.T) {
	t.Run("获取指标", func(t *testing.T) {
		engine := NewWALRealtimeEngine(nil)

		metrics := engine.Metrics()
		if metrics == nil {
			t.Fatal("指标不应为 nil")
		}
	})

	t.Run("事件计数", func(t *testing.T) {
		engine := NewWALRealtimeEngine(nil)

		// 模拟处理事件
		engine.incrementEventsReceived()
		engine.incrementEventsDispatched()

		metrics := engine.Metrics()
		if metrics.EventsReceived != 1 {
			t.Errorf("EventsReceived 期望 1, 实际 %d", metrics.EventsReceived)
		}
		if metrics.EventsDispatched != 1 {
			t.Errorf("EventsDispatched 期望 1, 实际 %d", metrics.EventsDispatched)
		}
	})
}

// TestWALRealtimeFiltering 测试事件过滤
func TestWALRealtimeFiltering(t *testing.T) {
	t.Run("按集合过滤", func(t *testing.T) {
		engine := NewWALRealtimeEngine(nil)

		// 只监听 posts 和 comments
		engine.AddCollectionFilter("posts")
		engine.AddCollectionFilter("comments")

		if !engine.ShouldProcessCollection("posts") {
			t.Error("posts 应该被处理")
		}
		if !engine.ShouldProcessCollection("comments") {
			t.Error("comments 应该被处理")
		}
		if engine.ShouldProcessCollection("users") {
			t.Error("users 不应该被处理")
		}
	})

	t.Run("清空过滤器后处理所有", func(t *testing.T) {
		engine := NewWALRealtimeEngine(nil)

		engine.AddCollectionFilter("posts")
		engine.ClearCollectionFilters()

		if !engine.ShouldProcessCollection("any_collection") {
			t.Error("清空过滤器后应该处理所有集合")
		}
	})
}

// TestWALMessagePipeline 测试消息处理管道
func TestWALMessagePipeline(t *testing.T) {
	t.Run("完整管道测试", func(t *testing.T) {
		// 创建各组件
		decoder := NewWALMessageDecoder()
		converter := NewWALToRecordConverter()
		dispatcher := NewWALEventDispatcher()

		// 添加关系信息
		decoder.SetRelation(&RelationInfo{
			RelationID:   12345,
			Namespace:    "public",
			RelationName: "posts",
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},
				{Name: "title", TypeOID: 25, Flags: 0},
			},
		})

		// 注册处理器
		var receivedEvent *RealtimeRecordEvent
		var mu sync.Mutex
		dispatcher.OnEvent("posts", func(event *RealtimeRecordEvent) {
			mu.Lock()
			receivedEvent = event
			mu.Unlock()
		})

		// 构建 INSERT 消息
		data := buildInsertMessage(12345, map[string]string{
			"id":    "post-1",
			"title": "Test Post",
		})

		// 解码
		walMsg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码失败: %v", err)
		}

		// 转换
		event, err := converter.Convert(walMsg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		// 分发
		dispatcher.Dispatch(event)

		// 等待处理
		time.Sleep(10 * time.Millisecond)

		mu.Lock()
		if receivedEvent == nil {
			t.Error("应该收到事件")
		} else if receivedEvent.Collection != "posts" {
			t.Errorf("集合期望 posts, 实际 %s", receivedEvent.Collection)
		}
		mu.Unlock()
	})
}
