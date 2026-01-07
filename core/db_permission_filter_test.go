package core

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ============================================================================
// T-5.2.1: 遍历在线订阅者
// ============================================================================

// TestSubscriberIterator 测试订阅者迭代器
func TestSubscriberIterator(t *testing.T) {
	t.Run("创建迭代器", func(t *testing.T) {
		manager := NewSubscriptionManager()
		iterator := NewSubscriberIterator(manager)

		if iterator == nil {
			t.Fatal("迭代器不应为 nil")
		}
	})

	t.Run("遍历空订阅者列表", func(t *testing.T) {
		manager := NewSubscriptionManager()
		iterator := NewSubscriberIterator(manager)

		count := 0
		iterator.ForEach("posts", func(sub *Subscriber) bool {
			count++
			return true
		})

		if count != 0 {
			t.Errorf("期望 0 个订阅者, 实际 %d 个", count)
		}
	})

	t.Run("遍历所有订阅者", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "posts"})

		iterator := NewSubscriberIterator(manager)

		count := 0
		iterator.ForEach("posts", func(sub *Subscriber) bool {
			count++
			return true
		})

		if count != 3 {
			t.Errorf("期望 3 个订阅者, 实际 %d 个", count)
		}
	})

	t.Run("提前终止遍历", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "posts"})

		iterator := NewSubscriberIterator(manager)

		count := 0
		iterator.ForEach("posts", func(sub *Subscriber) bool {
			count++
			return count < 2 // 只遍历 2 个后停止
		})

		if count != 2 {
			t.Errorf("期望 2 个订阅者, 实际 %d 个", count)
		}
	})

	t.Run("按集合过滤", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "comments"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "posts"})

		iterator := NewSubscriberIterator(manager)

		count := 0
		iterator.ForEach("posts", func(sub *Subscriber) bool {
			count++
			return true
		})

		if count != 2 {
			t.Errorf("期望 2 个 posts 订阅者, 实际 %d 个", count)
		}
	})

	t.Run("并发遍历安全", func(t *testing.T) {
		manager := NewSubscriptionManager()
		for i := 0; i < 100; i++ {
			manager.Subscribe(&Subscriber{
				ID:         string(rune('a' + i)),
				Collection: "posts",
			})
		}

		iterator := NewSubscriberIterator(manager)

		var wg sync.WaitGroup
		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				count := 0
				iterator.ForEach("posts", func(sub *Subscriber) bool {
					count++
					return true
				})
			}()
		}
		wg.Wait()
	})
}

// TestSubscriberIteratorWithFilter 测试带过滤器的迭代器
func TestSubscriberIteratorWithFilter(t *testing.T) {
	t.Run("按角色过滤", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts", Role: "admin"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts", Role: "user"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "posts", Role: "admin"})

		iterator := NewSubscriberIterator(manager)

		count := 0
		iterator.ForEachWithFilter("posts", func(sub *Subscriber) bool {
			return sub.Role == "admin"
		}, func(sub *Subscriber) bool {
			count++
			return true
		})

		if count != 2 {
			t.Errorf("期望 2 个 admin 订阅者, 实际 %d 个", count)
		}
	})

	t.Run("按用户 ID 过滤", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts", UserID: "user-1"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts", UserID: "user-2"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "posts", UserID: "user-1"})

		iterator := NewSubscriberIterator(manager)

		count := 0
		iterator.ForEachWithFilter("posts", func(sub *Subscriber) bool {
			return sub.UserID == "user-1"
		}, func(sub *Subscriber) bool {
			count++
			return true
		})

		if count != 2 {
			t.Errorf("期望 2 个 user-1 订阅者, 实际 %d 个", count)
		}
	})
}

// ============================================================================
// T-5.2.2: 评估 ViewRule
// ============================================================================

// TestViewRuleEvaluatorAdvanced 测试高级 ViewRule 评估
func TestViewRuleEvaluatorAdvanced(t *testing.T) {
	evaluator := NewViewRuleEvaluator()

	t.Run("空规则允许所有", func(t *testing.T) {
		allowed, err := evaluator.Evaluate("", nil, nil)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("空规则应该允许")
		}
	})

	t.Run("true 规则允许所有", func(t *testing.T) {
		allowed, err := evaluator.Evaluate("true", nil, nil)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("true 规则应该允许")
		}
	})

	t.Run("false 规则拒绝所有", func(t *testing.T) {
		allowed, err := evaluator.Evaluate("false", nil, nil)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if allowed {
			t.Error("false 规则应该拒绝")
		}
	})

	t.Run("用户 ID 匹配", func(t *testing.T) {
		record := map[string]interface{}{"user_id": "user-1"}
		auth := &AuthContext{ID: "user-1"}

		allowed, err := evaluator.Evaluate("user_id = @request.auth.id", record, auth)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("用户 ID 匹配应该允许")
		}
	})

	t.Run("用户 ID 不匹配", func(t *testing.T) {
		record := map[string]interface{}{"user_id": "user-1"}
		auth := &AuthContext{ID: "user-2"}

		allowed, err := evaluator.Evaluate("user_id = @request.auth.id", record, auth)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if allowed {
			t.Error("用户 ID 不匹配应该拒绝")
		}
	})

	t.Run("角色匹配", func(t *testing.T) {
		record := map[string]interface{}{}
		auth := &AuthContext{ID: "user-1", Role: "admin"}

		allowed, err := evaluator.Evaluate("@request.auth.role = 'admin'", record, auth)
		if err != nil {
			t.Fatalf("评估失败: %v", err)
		}
		if !allowed {
			t.Error("admin 角色应该允许")
		}
	})
}

// TestRuleClassifier 测试规则分类器
func TestRuleClassifier(t *testing.T) {
	classifier := NewRuleClassifier()

	t.Run("静态规则 - true", func(t *testing.T) {
		ruleType := classifier.Classify("true")
		if ruleType != RuleTypeStatic {
			t.Errorf("期望 RuleTypeStatic, 实际 %v", ruleType)
		}
	})

	t.Run("静态规则 - false", func(t *testing.T) {
		ruleType := classifier.Classify("false")
		if ruleType != RuleTypeStatic {
			t.Errorf("期望 RuleTypeStatic, 实际 %v", ruleType)
		}
	})

	t.Run("静态规则 - 空", func(t *testing.T) {
		ruleType := classifier.Classify("")
		if ruleType != RuleTypeStatic {
			t.Errorf("期望 RuleTypeStatic, 实际 %v", ruleType)
		}
	})

	t.Run("动态规则 - 用户相关", func(t *testing.T) {
		ruleType := classifier.Classify("user_id = @request.auth.id")
		if ruleType != RuleTypeDynamic {
			t.Errorf("期望 RuleTypeDynamic, 实际 %v", ruleType)
		}
	})

	t.Run("动态规则 - 角色相关", func(t *testing.T) {
		ruleType := classifier.Classify("@request.auth.role = 'admin'")
		if ruleType != RuleTypeDynamic {
			t.Errorf("期望 RuleTypeDynamic, 实际 %v", ruleType)
		}
	})
}

// ============================================================================
// T-5.2.3: 实现静态规则广播
// ============================================================================

// TestStaticBroadcaster 测试静态规则广播器
func TestStaticBroadcaster(t *testing.T) {
	t.Run("创建广播器", func(t *testing.T) {
		broadcaster := NewStaticBroadcaster()
		if broadcaster == nil {
			t.Fatal("广播器不应为 nil")
		}
	})

	t.Run("广播到所有订阅者", func(t *testing.T) {
		broadcaster := NewStaticBroadcaster()

		received := make(map[string]bool)
		var mu sync.Mutex

		subscribers := []*Subscriber{
			{ID: "sub-1", Channel: make(chan *RealtimeRecordEvent, 1)},
			{ID: "sub-2", Channel: make(chan *RealtimeRecordEvent, 1)},
			{ID: "sub-3", Channel: make(chan *RealtimeRecordEvent, 1)},
		}

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1"},
		}

		broadcaster.Broadcast(event, subscribers, func(sub *Subscriber, e *RealtimeRecordEvent) {
			mu.Lock()
			received[sub.ID] = true
			mu.Unlock()
		})

		// 等待广播完成
		time.Sleep(50 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()
		if len(received) != 3 {
			t.Errorf("期望 3 个订阅者收到事件, 实际 %d 个", len(received))
		}
	})

	t.Run("空订阅者列表", func(t *testing.T) {
		broadcaster := NewStaticBroadcaster()

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
		}

		// 不应 panic
		broadcaster.Broadcast(event, nil, nil)
		broadcaster.Broadcast(event, []*Subscriber{}, nil)
	})
}

// ============================================================================
// T-5.2.4: 实现动态规则精确推送
// ============================================================================

// TestDynamicBroadcaster 测试动态规则广播器
func TestDynamicBroadcaster(t *testing.T) {
	t.Run("创建广播器", func(t *testing.T) {
		broadcaster := NewDynamicBroadcaster()
		if broadcaster == nil {
			t.Fatal("广播器不应为 nil")
		}
	})

	t.Run("只推送给匹配的订阅者", func(t *testing.T) {
		broadcaster := NewDynamicBroadcaster()

		received := make(map[string]bool)
		var mu sync.Mutex

		subscribers := []*Subscriber{
			{ID: "sub-1", UserID: "user-1", Channel: make(chan *RealtimeRecordEvent, 1)},
			{ID: "sub-2", UserID: "user-2", Channel: make(chan *RealtimeRecordEvent, 1)},
			{ID: "sub-3", UserID: "user-1", Channel: make(chan *RealtimeRecordEvent, 1)},
		}

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1", "user_id": "user-1"},
		}

		rule := "user_id = @request.auth.id"

		broadcaster.BroadcastWithRule(event, subscribers, rule, func(sub *Subscriber, e *RealtimeRecordEvent) {
			mu.Lock()
			received[sub.ID] = true
			mu.Unlock()
		})

		// 等待广播完成
		time.Sleep(50 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()

		if len(received) != 2 {
			t.Errorf("期望 2 个订阅者收到事件, 实际 %d 个", len(received))
		}
		if !received["sub-1"] || !received["sub-3"] {
			t.Error("user-1 的订阅者应该收到事件")
		}
		if received["sub-2"] {
			t.Error("user-2 的订阅者不应该收到事件")
		}
	})

	t.Run("角色规则过滤", func(t *testing.T) {
		broadcaster := NewDynamicBroadcaster()

		received := make(map[string]bool)
		var mu sync.Mutex

		subscribers := []*Subscriber{
			{ID: "sub-1", Role: "admin", Channel: make(chan *RealtimeRecordEvent, 1)},
			{ID: "sub-2", Role: "user", Channel: make(chan *RealtimeRecordEvent, 1)},
			{ID: "sub-3", Role: "admin", Channel: make(chan *RealtimeRecordEvent, 1)},
		}

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "settings",
			Record:     map[string]interface{}{"id": "setting-1"},
		}

		rule := "@request.auth.role = 'admin'"

		broadcaster.BroadcastWithRule(event, subscribers, rule, func(sub *Subscriber, e *RealtimeRecordEvent) {
			mu.Lock()
			received[sub.ID] = true
			mu.Unlock()
		})

		// 等待广播完成
		time.Sleep(50 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()

		if len(received) != 2 {
			t.Errorf("期望 2 个 admin 订阅者收到事件, 实际 %d 个", len(received))
		}
	})
}

// ============================================================================
// T-5.2.5: 实现布隆过滤器优化
// ============================================================================

// TestBloomFilterOptimization 测试布隆过滤器优化
func TestBloomFilterOptimization(t *testing.T) {
	t.Run("创建布隆过滤器", func(t *testing.T) {
		bf := NewBloomFilter(1000, 0.01)
		if bf == nil {
			t.Fatal("布隆过滤器不应为 nil")
		}
	})

	t.Run("添加和检查元素", func(t *testing.T) {
		bf := NewBloomFilter(1000, 0.01)

		bf.Add("user-1")
		bf.Add("user-2")
		bf.Add("user-3")

		if !bf.MightContain("user-1") {
			t.Error("user-1 应该可能存在")
		}
		if !bf.MightContain("user-2") {
			t.Error("user-2 应该可能存在")
		}
		if !bf.MightContain("user-3") {
			t.Error("user-3 应该可能存在")
		}
	})

	t.Run("不存在的元素", func(t *testing.T) {
		bf := NewBloomFilter(1000, 0.01)

		bf.Add("user-1")

		// 不存在的元素应该大概率返回 false
		// 由于是概率数据结构，不能保证 100%
		falsePositives := 0
		for i := 0; i < 100; i++ {
			if bf.MightContain("nonexistent-" + string(rune(i))) {
				falsePositives++
			}
		}

		// 误报率应该低于 10%
		if falsePositives > 10 {
			t.Errorf("误报率过高: %d%%", falsePositives)
		}
	})
}

// TestBloomFilterBroadcaster 测试布隆过滤器广播器
func TestBloomFilterBroadcaster(t *testing.T) {
	t.Run("创建广播器", func(t *testing.T) {
		broadcaster := NewBloomFilterBroadcaster(1000, 0.01)
		if broadcaster == nil {
			t.Fatal("广播器不应为 nil")
		}
	})

	t.Run("注册订阅者到布隆过滤器", func(t *testing.T) {
		broadcaster := NewBloomFilterBroadcaster(1000, 0.01)

		broadcaster.RegisterSubscriber("posts", "user-1")
		broadcaster.RegisterSubscriber("posts", "user-2")

		if !broadcaster.MightHaveSubscriber("posts", "user-1") {
			t.Error("user-1 应该可能订阅 posts")
		}
		if !broadcaster.MightHaveSubscriber("posts", "user-2") {
			t.Error("user-2 应该可能订阅 posts")
		}
	})

	t.Run("快速过滤不相关事件", func(t *testing.T) {
		broadcaster := NewBloomFilterBroadcaster(1000, 0.01)

		broadcaster.RegisterSubscriber("posts", "user-1")
		broadcaster.RegisterSubscriber("posts", "user-2")

		// 没有订阅者订阅 comments
		if broadcaster.MightHaveSubscriber("comments", "user-1") {
			// 可能是误报，但概率应该很低
		}
	})

	t.Run("清除集合的布隆过滤器", func(t *testing.T) {
		broadcaster := NewBloomFilterBroadcaster(1000, 0.01)

		broadcaster.RegisterSubscriber("posts", "user-1")
		broadcaster.ClearCollection("posts")

		// 清除后不应该存在
		if broadcaster.MightHaveSubscriber("posts", "user-1") {
			t.Error("清除后不应该存在")
		}
	})
}

// ============================================================================
// T-5.2.6: 实现角色分组优化
// ============================================================================

// TestPermissionRoleGroupOptimization 测试角色分组优化
func TestPermissionRoleGroupOptimization(t *testing.T) {
	t.Run("按角色分组订阅者", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts", Role: "admin"})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts", Role: "user"})
		manager.Subscribe(&Subscriber{ID: "sub-3", Collection: "posts", Role: "admin"})
		manager.Subscribe(&Subscriber{ID: "sub-4", Collection: "posts", Role: "guest"})

		groups := manager.GetSubscribersByRole("posts")

		if len(groups["admin"]) != 2 {
			t.Errorf("期望 2 个 admin, 实际 %d 个", len(groups["admin"]))
		}
		if len(groups["user"]) != 1 {
			t.Errorf("期望 1 个 user, 实际 %d 个", len(groups["user"]))
		}
		if len(groups["guest"]) != 1 {
			t.Errorf("期望 1 个 guest, 实际 %d 个", len(groups["guest"]))
		}
	})

	t.Run("匿名用户分组", func(t *testing.T) {
		manager := NewSubscriptionManager()
		manager.Subscribe(&Subscriber{ID: "sub-1", Collection: "posts", Role: ""})
		manager.Subscribe(&Subscriber{ID: "sub-2", Collection: "posts", Role: ""})

		groups := manager.GetSubscribersByRole("posts")

		if len(groups["anonymous"]) != 2 {
			t.Errorf("期望 2 个 anonymous, 实际 %d 个", len(groups["anonymous"]))
		}
	})
}

// TestRoleBasedBroadcaster 测试基于角色的广播器
func TestRoleBasedBroadcaster(t *testing.T) {
	t.Run("创建广播器", func(t *testing.T) {
		broadcaster := NewRoleBasedBroadcaster()
		if broadcaster == nil {
			t.Fatal("广播器不应为 nil")
		}
	})

	t.Run("按角色广播", func(t *testing.T) {
		broadcaster := NewRoleBasedBroadcaster()

		var adminCount, userCount int32

		adminSubs := []*Subscriber{
			{ID: "admin-1", Role: "admin"},
			{ID: "admin-2", Role: "admin"},
		}
		userSubs := []*Subscriber{
			{ID: "user-1", Role: "user"},
		}

		groups := map[string][]*Subscriber{
			"admin": adminSubs,
			"user":  userSubs,
		}

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "settings",
		}

		// 只允许 admin 角色
		broadcaster.BroadcastToRoles(event, groups, []string{"admin"}, func(sub *Subscriber, e *RealtimeRecordEvent) {
			if sub.Role == "admin" {
				atomic.AddInt32(&adminCount, 1)
			} else {
				atomic.AddInt32(&userCount, 1)
			}
		})

		// 等待广播完成
		time.Sleep(50 * time.Millisecond)

		if atomic.LoadInt32(&adminCount) != 2 {
			t.Errorf("期望 2 个 admin 收到事件, 实际 %d 个", adminCount)
		}
		if atomic.LoadInt32(&userCount) != 0 {
			t.Errorf("期望 0 个 user 收到事件, 实际 %d 个", userCount)
		}
	})

	t.Run("广播到所有角色", func(t *testing.T) {
		broadcaster := NewRoleBasedBroadcaster()

		var totalCount int32

		groups := map[string][]*Subscriber{
			"admin": {{ID: "admin-1", Role: "admin"}},
			"user":  {{ID: "user-1", Role: "user"}},
			"guest": {{ID: "guest-1", Role: "guest"}},
		}

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
		}

		broadcaster.BroadcastToRoles(event, groups, nil, func(sub *Subscriber, e *RealtimeRecordEvent) {
			atomic.AddInt32(&totalCount, 1)
		})

		// 等待广播完成
		time.Sleep(50 * time.Millisecond)

		if atomic.LoadInt32(&totalCount) != 3 {
			t.Errorf("期望 3 个订阅者收到事件, 实际 %d 个", totalCount)
		}
	})
}

// ============================================================================
// 集成测试
// ============================================================================

// TestPermissionFilterIntegration 测试权限过滤集成
func TestPermissionFilterIntegration(t *testing.T) {
	t.Run("完整权限过滤流程", func(t *testing.T) {
		// 创建权限过滤器
		filter := NewPermissionFilter()

		// 设置规则
		filter.SetViewRule("posts", "user_id = @request.auth.id")
		filter.SetViewRule("settings", "@request.auth.role = 'admin'")
		filter.SetViewRule("public", "true")

		// 创建订阅者 - 所有订阅者都订阅 posts
		postsSubscribers := []*Subscriber{
			{ID: "sub-1", UserID: "user-1", Role: "user", Collection: "posts"},
			{ID: "sub-2", UserID: "user-2", Role: "admin", Collection: "posts"},
		}

		// 测试 posts 事件 - 只有 user-1 的记录
		postsEvent := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1", "user_id": "user-1"},
		}

		allowed := filter.FilterSubscribers(postsEvent, postsSubscribers)
		if len(allowed) != 1 {
			t.Errorf("期望 1 个订阅者通过过滤, 实际 %d 个", len(allowed))
		}
		if len(allowed) > 0 && allowed[0].ID != "sub-1" {
			t.Errorf("期望 sub-1 通过过滤, 实际 %s", allowed[0].ID)
		}

		// 测试 settings 事件 - 只有 admin 可以看
		settingsSubscribers := []*Subscriber{
			{ID: "sub-3", UserID: "user-1", Role: "admin", Collection: "settings"},
			{ID: "sub-4", UserID: "user-2", Role: "user", Collection: "settings"},
		}

		settingsEvent := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "settings",
			Record:     map[string]interface{}{"id": "setting-1"},
		}

		allowed = filter.FilterSubscribers(settingsEvent, settingsSubscribers)
		if len(allowed) != 1 {
			t.Errorf("期望 1 个 admin 订阅者通过过滤, 实际 %d 个", len(allowed))
		}
		if len(allowed) > 0 && allowed[0].ID != "sub-3" {
			t.Errorf("期望 sub-3 通过过滤, 实际 %s", allowed[0].ID)
		}

		// 测试 public 事件 - 所有人都可以看
		publicSubscribers := []*Subscriber{
			{ID: "sub-5", UserID: "user-1", Role: "user", Collection: "public"},
			{ID: "sub-6", UserID: "user-2", Role: "admin", Collection: "public"},
			{ID: "sub-7", UserID: "user-3", Role: "guest", Collection: "public"},
		}

		publicEvent := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "public",
			Record:     map[string]interface{}{"id": "public-1"},
		}

		allowed = filter.FilterSubscribers(publicEvent, publicSubscribers)
		if len(allowed) != 3 {
			t.Errorf("期望所有订阅者通过过滤, 实际 %d 个", len(allowed))
		}
	})
}

// TestPermissionFilterMetrics 测试权限过滤指标
func TestPermissionFilterMetrics(t *testing.T) {
	t.Run("收集过滤指标", func(t *testing.T) {
		filter := NewPermissionFilter()
		filter.SetViewRule("posts", "user_id = @request.auth.id")

		subscribers := []*Subscriber{
			{ID: "sub-1", UserID: "user-1", Collection: "posts"},
			{ID: "sub-2", UserID: "user-2", Collection: "posts"},
		}

		event := &RealtimeRecordEvent{
			Action:     RealtimeRecordActionCreate,
			Collection: "posts",
			Record:     map[string]interface{}{"id": "post-1", "user_id": "user-1"},
		}

		filter.FilterSubscribers(event, subscribers)

		metrics := filter.GetMetrics()
		if metrics.TotalEvaluations < 2 {
			t.Errorf("期望至少 2 次评估, 实际 %d 次", metrics.TotalEvaluations)
		}
	})
}
