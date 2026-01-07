package core

import (
	"context"
	"sync"
	"testing"
	"time"
)

// ============================================================================
// STORY-5.1: WAL 消费者实现测试
// ============================================================================

// TestReplicationSlot 测试复制槽
func TestReplicationSlot(t *testing.T) {
	t.Run("复制槽配置", func(t *testing.T) {
		config := &ReplicationSlotConfig{
			SlotName:       "pocketbase_realtime",
			OutputPlugin:   "pgoutput",
			PublicationName: "pocketbase_pub",
		}

		if config.SlotName == "" {
			t.Error("槽名称不应为空")
		}
		if config.OutputPlugin == "" {
			t.Error("输出插件不应为空")
		}
	})

	t.Run("创建复制槽 SQL", func(t *testing.T) {
		manager := NewReplicationSlotManager("pocketbase_realtime")

		sql := manager.CreateSlotSQL()
		if sql == "" {
			t.Error("创建复制槽 SQL 不应为空")
		}

		if !containsAll(sql, "pg_create_logical_replication_slot", "pocketbase_realtime", "pgoutput") {
			t.Errorf("创建复制槽 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("删除复制槽 SQL", func(t *testing.T) {
		manager := NewReplicationSlotManager("pocketbase_realtime")

		sql := manager.DropSlotSQL()
		if sql == "" {
			t.Error("删除复制槽 SQL 不应为空")
		}

		if !containsAll(sql, "pg_drop_replication_slot", "pocketbase_realtime") {
			t.Errorf("删除复制槽 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("创建发布 SQL", func(t *testing.T) {
		manager := NewReplicationSlotManager("pocketbase_realtime")

		sql := manager.CreatePublicationSQL("pocketbase_pub", []string{"users", "posts"})
		if sql == "" {
			t.Error("创建发布 SQL 不应为空")
		}

		if !containsAll(sql, "CREATE PUBLICATION", "pocketbase_pub", "FOR TABLE", "users", "posts") {
			t.Errorf("创建发布 SQL 格式不正确: %s", sql)
		}
	})
}

// TestWALMessage 测试 WAL 消息
func TestWALMessage(t *testing.T) {
	t.Run("WAL 消息结构", func(t *testing.T) {
		msg := &WALMessage{
			LSN:       12345,
			Type:      WALMessageInsert,
			TableName: "users",
			Schema:    "public",
			Columns:   []string{"id", "name", "email"},
			OldValues: nil,
			NewValues: map[string]interface{}{
				"id":    "user-1",
				"name":  "Test User",
				"email": "test@example.com",
			},
			Timestamp: time.Now(),
		}

		if msg.LSN == 0 {
			t.Error("LSN 不应为 0")
		}
		if msg.Type != WALMessageInsert {
			t.Error("消息类型应为 INSERT")
		}
		if msg.TableName == "" {
			t.Error("表名不应为空")
		}
	})

	t.Run("WAL 消息类型", func(t *testing.T) {
		types := []WALMessageType{
			WALMessageInsert,
			WALMessageUpdate,
			WALMessageDelete,
			WALMessageBegin,
			WALMessageCommit,
		}

		for _, mt := range types {
			if mt.String() == "" {
				t.Errorf("消息类型 %d 的字符串表示不应为空", mt)
			}
		}
	})
}

// TestWALParser 测试 WAL 解析器
func TestWALParser(t *testing.T) {
	t.Run("创建解析器", func(t *testing.T) {
		parser := NewWALParser()
		if parser == nil {
			t.Fatal("解析器不应为 nil")
		}
	})

	t.Run("解析 INSERT 消息", func(t *testing.T) {
		parser := NewWALParser()

		// 模拟 INSERT 消息数据
		data := &WALRawMessage{
			Type:      'I',
			TableName: "users",
			Columns:   []string{"id", "name"},
			Values:    []interface{}{"user-1", "Test"},
		}

		msg, err := parser.ParseInsert(data)
		if err != nil {
			t.Fatalf("解析 INSERT 失败: %v", err)
		}

		if msg.Type != WALMessageInsert {
			t.Error("消息类型应为 INSERT")
		}
		if msg.TableName != "users" {
			t.Errorf("表名期望 users, 实际 %s", msg.TableName)
		}
	})

	t.Run("解析 UPDATE 消息", func(t *testing.T) {
		parser := NewWALParser()

		data := &WALRawMessage{
			Type:      'U',
			TableName: "users",
			Columns:   []string{"id", "name"},
			OldValues: []interface{}{"user-1", "Old Name"},
			Values:    []interface{}{"user-1", "New Name"},
		}

		msg, err := parser.ParseUpdate(data)
		if err != nil {
			t.Fatalf("解析 UPDATE 失败: %v", err)
		}

		if msg.Type != WALMessageUpdate {
			t.Error("消息类型应为 UPDATE")
		}
		if msg.OldValues == nil {
			t.Error("UPDATE 消息应包含旧值")
		}
	})

	t.Run("解析 DELETE 消息", func(t *testing.T) {
		parser := NewWALParser()

		data := &WALRawMessage{
			Type:      'D',
			TableName: "users",
			Columns:   []string{"id"},
			OldValues: []interface{}{"user-1"},
		}

		msg, err := parser.ParseDelete(data)
		if err != nil {
			t.Fatalf("解析 DELETE 失败: %v", err)
		}

		if msg.Type != WALMessageDelete {
			t.Error("消息类型应为 DELETE")
		}
	})
}

// TestRecordConverter 测试记录转换器
func TestRecordConverter(t *testing.T) {
	t.Run("WAL 消息转换为 Record 事件", func(t *testing.T) {
		converter := NewRecordConverter()

		msg := &WALMessage{
			Type:      WALMessageInsert,
			TableName: "users",
			NewValues: map[string]interface{}{
				"id":    "user-1",
				"name":  "Test User",
				"email": "test@example.com",
			},
		}

		event, err := converter.ToRecordEvent(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		if event.Action != RealtimeRecordActionCreate {
			t.Error("INSERT 应转换为 Create 动作")
		}
		if event.Collection != "users" {
			t.Errorf("集合名期望 users, 实际 %s", event.Collection)
		}
		if event.Record == nil {
			t.Error("Record 不应为 nil")
		}
	})

	t.Run("UPDATE 转换", func(t *testing.T) {
		converter := NewRecordConverter()

		msg := &WALMessage{
			Type:      WALMessageUpdate,
			TableName: "users",
			OldValues: map[string]interface{}{
				"id":   "user-1",
				"name": "Old Name",
			},
			NewValues: map[string]interface{}{
				"id":   "user-1",
				"name": "New Name",
			},
		}

		event, err := converter.ToRecordEvent(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		if event.Action != RealtimeRecordActionUpdate {
			t.Error("UPDATE 应转换为 Update 动作")
		}
	})

	t.Run("DELETE 转换", func(t *testing.T) {
		converter := NewRecordConverter()

		msg := &WALMessage{
			Type:      WALMessageDelete,
			TableName: "users",
			OldValues: map[string]interface{}{
				"id": "user-1",
			},
		}

		event, err := converter.ToRecordEvent(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		if event.Action != RealtimeRecordActionDelete {
			t.Error("DELETE 应转换为 Delete 动作")
		}
	})
}

// ============================================================================
// STORY-5.2: 事件权限过滤测试
// ============================================================================

// TestSubscriptionManager 测试订阅管理器
func TestSubscriptionManager(t *testing.T) {
	t.Run("创建订阅管理器", func(t *testing.T) {
		manager := NewSubscriptionManager()
		if manager == nil {
			t.Fatal("订阅管理器不应为 nil")
		}
	})

	t.Run("添加订阅者", func(t *testing.T) {
		manager := NewSubscriptionManager()

		sub := &Subscriber{
			ID:         "sub-1",
			UserID:     "user-1",
			Collection: "posts",
			Filter:     "",
		}

		manager.Subscribe(sub)

		subs := manager.GetSubscribers("posts")
		if len(subs) != 1 {
			t.Errorf("订阅者数量期望 1, 实际 %d", len(subs))
		}
	})

	t.Run("移除订阅者", func(t *testing.T) {
		manager := NewSubscriptionManager()

		sub := &Subscriber{
			ID:         "sub-1",
			UserID:     "user-1",
			Collection: "posts",
		}

		manager.Subscribe(sub)
		manager.Unsubscribe("sub-1")

		subs := manager.GetSubscribers("posts")
		if len(subs) != 0 {
			t.Errorf("订阅者数量期望 0, 实际 %d", len(subs))
		}
	})

	t.Run("按集合获取订阅者", func(t *testing.T) {
		manager := NewSubscriptionManager()

		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "comments"})

		postsSubs := manager.GetSubscribers("posts")
		if len(postsSubs) != 2 {
			t.Errorf("posts 订阅者数量期望 2, 实际 %d", len(postsSubs))
		}

		commentsSubs := manager.GetSubscribers("comments")
		if len(commentsSubs) != 1 {
			t.Errorf("comments 订阅者数量期望 1, 实际 %d", len(commentsSubs))
		}
	})
}

// TestViewRuleEvaluator 测试 ViewRule 评估器
func TestViewRuleEvaluator(t *testing.T) {
	t.Run("评估空规则 (允许)", func(t *testing.T) {
		evaluator := NewViewRuleEvaluator()

		allowed, err := evaluator.Evaluate("", nil, nil)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("空规则应该允许")
		}
	})

	t.Run("评估 true 规则", func(t *testing.T) {
		evaluator := NewViewRuleEvaluator()

		allowed, err := evaluator.Evaluate("true", nil, nil)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("true 规则应该允许")
		}
	})

	t.Run("评估 false 规则", func(t *testing.T) {
		evaluator := NewViewRuleEvaluator()

		allowed, err := evaluator.Evaluate("false", nil, nil)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if allowed {
			t.Error("false 规则应该拒绝")
		}
	})

	t.Run("评估 auth.id 规则", func(t *testing.T) {
		evaluator := NewViewRuleEvaluator()

		record := map[string]interface{}{
			"id":      "post-1",
			"user_id": "user-1",
		}
		auth := &AuthContext{
			ID:   "user-1",
			Role: "user",
		}

		allowed, err := evaluator.Evaluate("user_id = @request.auth.id", record, auth)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("用户应该能看到自己的记录")
		}

		// 其他用户
		auth.ID = "user-2"
		allowed, err = evaluator.Evaluate("user_id = @request.auth.id", record, auth)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if allowed {
			t.Error("用户不应该能看到其他人的记录")
		}
	})
}

// TestEventBroadcaster 测试事件广播器
func TestEventBroadcaster(t *testing.T) {
	t.Run("静态规则广播", func(t *testing.T) {
		broadcaster := NewEventBroadcaster()

		// 添加订阅者
		var received []string
		var mu sync.Mutex

		broadcaster.AddHandler("posts", func(event *RealtimeRecordEvent, sub *Subscriber) {
			mu.Lock()
			received = append(received, sub.ID)
			mu.Unlock()
		})

		// 广播事件
		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1"},
		}

		subscribers := []*Subscriber{
			{ID: "sub-1", Collection: "posts"},
			{ID: "sub-2", Collection: "posts"},
		}

		broadcaster.Broadcast(event, subscribers)

		// 等待处理
		time.Sleep(10 * time.Millisecond)

		mu.Lock()
		if len(received) != 2 {
			t.Errorf("应该广播给 2 个订阅者, 实际 %d", len(received))
		}
		mu.Unlock()
	})

	t.Run("动态规则精确推送", func(t *testing.T) {
		broadcaster := NewEventBroadcaster()
		evaluator := NewViewRuleEvaluator()

		// 设置规则
		broadcaster.SetViewRule("posts", "user_id = @request.auth.id")

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1", "user_id": "user-1"},
		}

		// 订阅者 1 是作者
		_ = &Subscriber{
			ID:     "sub-1",
			UserID: "user-1",
		}
		auth1 := &AuthContext{ID: "user-1"}

		allowed, _ := evaluator.Evaluate("user_id = @request.auth.id", event.Record, auth1)
		if !allowed {
			t.Error("作者应该能收到事件")
		}

		// 订阅者 2 不是作者
		auth2 := &AuthContext{ID: "user-2"}
		allowed, _ = evaluator.Evaluate("user_id = @request.auth.id", event.Record, auth2)
		if allowed {
			t.Error("非作者不应该收到事件")
		}
	})
}

// TestBloomFilter 测试布隆过滤器优化
func TestBloomFilter(t *testing.T) {
	t.Run("创建布隆过滤器", func(t *testing.T) {
		bf := NewBloomFilter(1000, 0.01)
		if bf == nil {
			t.Fatal("布隆过滤器不应为 nil")
		}
	})

	t.Run("添加和查询", func(t *testing.T) {
		bf := NewBloomFilter(1000, 0.01)

		bf.Add("user-1")
		bf.Add("user-2")

		if !bf.MightContain("user-1") {
			t.Error("user-1 应该存在")
		}
		if !bf.MightContain("user-2") {
			t.Error("user-2 应该存在")
		}
	})

	t.Run("假阳性率", func(t *testing.T) {
		bf := NewBloomFilter(1000, 0.01)

		// 添加 100 个元素
		for i := 0; i < 100; i++ {
			bf.Add(string(rune('a' + i)))
		}

		// 测试不存在的元素
		falsePositives := 0
		for i := 100; i < 200; i++ {
			if bf.MightContain(string(rune('a' + i))) {
				falsePositives++
			}
		}

		// 假阳性率应该低于 5%
		rate := float64(falsePositives) / 100
		if rate > 0.05 {
			t.Errorf("假阳性率过高: %.2f%%", rate*100)
		}
	})
}

// TestRoleGroupOptimization 测试角色分组优化
func TestRoleGroupOptimization(t *testing.T) {
	t.Run("按角色分组订阅者", func(t *testing.T) {
		manager := NewSubscriptionManager()

		manager.Subscribe(&Subscriber{ID: "sub-1", UserID: "user-1", Role: "admin", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-2", UserID: "user-2", Role: "user", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-3", UserID: "user-3", Role: "admin", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-4", UserID: "user-4", Role: "user", Collection: "posts"})

		groups := manager.GetSubscribersByRole("posts")

		if len(groups["admin"]) != 2 {
			t.Errorf("admin 组应该有 2 个订阅者, 实际 %d", len(groups["admin"]))
		}
		if len(groups["user"]) != 2 {
			t.Errorf("user 组应该有 2 个订阅者, 实际 %d", len(groups["user"]))
		}
	})

	t.Run("角色规则匹配", func(t *testing.T) {
		evaluator := NewViewRuleEvaluator()

		// admin 可以看所有
		auth := &AuthContext{ID: "admin-1", Role: "admin"}
		allowed, _ := evaluator.Evaluate("@request.auth.role = 'admin'", nil, auth)
		if !allowed {
			t.Error("admin 应该被允许")
		}

		// user 不能看
		auth.Role = "user"
		allowed, _ = evaluator.Evaluate("@request.auth.role = 'admin'", nil, auth)
		if allowed {
			t.Error("user 不应该被允许")
		}
	})
}

// TestRealtimeEngine 测试 Realtime 引擎
func TestRealtimeEngine(t *testing.T) {
	t.Run("创建引擎", func(t *testing.T) {
		engine := NewRealtimeEngine()
		if engine == nil {
			t.Fatal("引擎不应为 nil")
		}
	})

	t.Run("引擎生命周期", func(t *testing.T) {
		engine := NewRealtimeEngine()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// 启动引擎 (模拟)
		err := engine.Start(ctx)
		if err != nil {
			t.Fatalf("启动引擎失败: %v", err)
		}

		// 停止引擎
		err = engine.Stop()
		if err != nil {
			t.Fatalf("停止引擎失败: %v", err)
		}
	})
}
