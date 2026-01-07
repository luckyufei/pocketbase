package core

import (
	"strings"
	"sync"
	"sync/atomic"
)

// ============================================================================
// T-5.2.1: 遍历在线订阅者
// ============================================================================

// SubscriberIterator 订阅者迭代器
type SubscriberIterator struct {
	manager *SubscriptionManager
}

// NewSubscriberIterator 创建订阅者迭代器
func NewSubscriberIterator(manager *SubscriptionManager) *SubscriberIterator {
	return &SubscriberIterator{
		manager: manager,
	}
}

// ForEach 遍历指定集合的所有订阅者
// callback 返回 false 时停止遍历
func (it *SubscriberIterator) ForEach(collection string, callback func(*Subscriber) bool) {
	subscribers := it.manager.GetSubscribers(collection)
	for _, sub := range subscribers {
		if !callback(sub) {
			break
		}
	}
}

// ForEachWithFilter 带过滤器遍历订阅者
func (it *SubscriberIterator) ForEachWithFilter(
	collection string,
	filter func(*Subscriber) bool,
	callback func(*Subscriber) bool,
) {
	subscribers := it.manager.GetSubscribers(collection)
	for _, sub := range subscribers {
		if filter(sub) {
			if !callback(sub) {
				break
			}
		}
	}
}

// ============================================================================
// T-5.2.2: 评估 ViewRule
// ============================================================================

// RuleClassifierType 规则分类类型
type RuleClassifierType int

const (
	// RuleTypeStatic 静态规则 (true/false/空)
	RuleTypeStatic RuleClassifierType = iota
	// RuleTypeDynamic 动态规则 (包含 @request.auth 等变量)
	RuleTypeDynamic
)

// RuleClassifier 规则分类器
type RuleClassifier struct{}

// NewRuleClassifier 创建规则分类器
func NewRuleClassifier() *RuleClassifier {
	return &RuleClassifier{}
}

// Classify 分类规则
func (c *RuleClassifier) Classify(rule string) RuleClassifierType {
	rule = strings.TrimSpace(rule)

	// 静态规则
	if rule == "" || rule == "true" || rule == "false" {
		return RuleTypeStatic
	}

	// 包含动态变量的规则
	if strings.Contains(rule, "@request.auth") ||
		strings.Contains(rule, "@request.data") ||
		strings.Contains(rule, "@collection") {
		return RuleTypeDynamic
	}

	// 默认为动态规则
	return RuleTypeDynamic
}

// IsStatic 判断是否为静态规则
func (c *RuleClassifier) IsStatic(rule string) bool {
	return c.Classify(rule) == RuleTypeStatic
}

// ============================================================================
// T-5.2.3: 实现静态规则广播
// ============================================================================

// BroadcastHandler 广播处理器类型
type BroadcastHandler func(*Subscriber, *RealtimeRecordEvent)

// StaticBroadcaster 静态规则广播器
type StaticBroadcaster struct {
	workerPool chan struct{}
}

// NewStaticBroadcaster 创建静态规则广播器
func NewStaticBroadcaster() *StaticBroadcaster {
	return &StaticBroadcaster{
		workerPool: make(chan struct{}, 100), // 限制并发数
	}
}

// Broadcast 广播事件到所有订阅者
func (b *StaticBroadcaster) Broadcast(
	event *RealtimeRecordEvent,
	subscribers []*Subscriber,
	handler BroadcastHandler,
) {
	if len(subscribers) == 0 || handler == nil {
		return
	}

	var wg sync.WaitGroup
	for _, sub := range subscribers {
		wg.Add(1)
		go func(s *Subscriber) {
			defer wg.Done()
			b.workerPool <- struct{}{}
			defer func() { <-b.workerPool }()
			handler(s, event)
		}(sub)
	}
	wg.Wait()
}

// ============================================================================
// T-5.2.4: 实现动态规则精确推送
// ============================================================================

// DynamicBroadcaster 动态规则广播器
type DynamicBroadcaster struct {
	evaluator  *ViewRuleEvaluator
	workerPool chan struct{}
}

// NewDynamicBroadcaster 创建动态规则广播器
func NewDynamicBroadcaster() *DynamicBroadcaster {
	return &DynamicBroadcaster{
		evaluator:  NewViewRuleEvaluator(),
		workerPool: make(chan struct{}, 100),
	}
}

// BroadcastWithRule 根据规则广播事件
func (b *DynamicBroadcaster) BroadcastWithRule(
	event *RealtimeRecordEvent,
	subscribers []*Subscriber,
	rule string,
	handler BroadcastHandler,
) {
	if len(subscribers) == 0 || handler == nil {
		return
	}

	var wg sync.WaitGroup
	for _, sub := range subscribers {
		wg.Add(1)
		go func(s *Subscriber) {
			defer wg.Done()
			b.workerPool <- struct{}{}
			defer func() { <-b.workerPool }()

			// 评估规则
			auth := &AuthContext{
				ID:   s.UserID,
				Role: s.Role,
			}

			allowed, err := b.evaluator.Evaluate(rule, event.Record, auth)
			if err != nil || !allowed {
				return
			}

			handler(s, event)
		}(sub)
	}
	wg.Wait()
}

// ============================================================================
// T-5.2.5: 实现布隆过滤器优化
// ============================================================================

// BloomFilterBroadcaster 布隆过滤器广播器
type BloomFilterBroadcaster struct {
	filters map[string]*BloomFilter
	mu      sync.RWMutex

	expectedItems     int
	falsePositiveRate float64
}

// NewBloomFilterBroadcaster 创建布隆过滤器广播器
func NewBloomFilterBroadcaster(expectedItems int, falsePositiveRate float64) *BloomFilterBroadcaster {
	return &BloomFilterBroadcaster{
		filters:           make(map[string]*BloomFilter),
		expectedItems:     expectedItems,
		falsePositiveRate: falsePositiveRate,
	}
}

// RegisterSubscriber 注册订阅者到布隆过滤器
func (b *BloomFilterBroadcaster) RegisterSubscriber(collection, userID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.filters[collection] == nil {
		b.filters[collection] = NewBloomFilter(b.expectedItems, b.falsePositiveRate)
	}

	b.filters[collection].Add(userID)
}

// MightHaveSubscriber 检查集合是否可能有该用户的订阅者
func (b *BloomFilterBroadcaster) MightHaveSubscriber(collection, userID string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()

	filter := b.filters[collection]
	if filter == nil {
		return false
	}

	return filter.MightContain(userID)
}

// ClearCollection 清除集合的布隆过滤器
func (b *BloomFilterBroadcaster) ClearCollection(collection string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	delete(b.filters, collection)
}

// ============================================================================
// T-5.2.6: 实现角色分组优化
// ============================================================================

// RoleBasedBroadcaster 基于角色的广播器
type RoleBasedBroadcaster struct {
	workerPool chan struct{}
}

// NewRoleBasedBroadcaster 创建基于角色的广播器
func NewRoleBasedBroadcaster() *RoleBasedBroadcaster {
	return &RoleBasedBroadcaster{
		workerPool: make(chan struct{}, 100),
	}
}

// BroadcastToRoles 广播到指定角色
// allowedRoles 为 nil 时广播到所有角色
func (b *RoleBasedBroadcaster) BroadcastToRoles(
	event *RealtimeRecordEvent,
	groups map[string][]*Subscriber,
	allowedRoles []string,
	handler BroadcastHandler,
) {
	if len(groups) == 0 || handler == nil {
		return
	}

	var wg sync.WaitGroup

	// 确定要广播的角色
	targetRoles := allowedRoles
	if targetRoles == nil {
		targetRoles = make([]string, 0, len(groups))
		for role := range groups {
			targetRoles = append(targetRoles, role)
		}
	}

	for _, role := range targetRoles {
		subscribers := groups[role]
		for _, sub := range subscribers {
			wg.Add(1)
			go func(s *Subscriber) {
				defer wg.Done()
				b.workerPool <- struct{}{}
				defer func() { <-b.workerPool }()
				handler(s, event)
			}(sub)
		}
	}

	wg.Wait()
}

// ============================================================================
// 权限过滤器 (集成)
// ============================================================================

// PermissionFilterMetrics 权限过滤指标
type PermissionFilterMetrics struct {
	TotalEvaluations   int64
	AllowedCount       int64
	DeniedCount        int64
	ErrorCount         int64
	AvgEvaluationTimeNs int64
}

// PermissionFilter 权限过滤器
type PermissionFilter struct {
	viewRules         map[string]string
	evaluator         *ViewRuleEvaluator
	classifier        *RuleClassifier
	staticBroadcaster *StaticBroadcaster
	dynamicBroadcaster *DynamicBroadcaster
	bloomBroadcaster  *BloomFilterBroadcaster
	roleBroadcaster   *RoleBasedBroadcaster

	// 指标
	totalEvaluations int64
	allowedCount     int64
	deniedCount      int64
	errorCount       int64

	mu sync.RWMutex
}

// NewPermissionFilter 创建权限过滤器
func NewPermissionFilter() *PermissionFilter {
	return &PermissionFilter{
		viewRules:          make(map[string]string),
		evaluator:          NewViewRuleEvaluator(),
		classifier:         NewRuleClassifier(),
		staticBroadcaster:  NewStaticBroadcaster(),
		dynamicBroadcaster: NewDynamicBroadcaster(),
		bloomBroadcaster:   NewBloomFilterBroadcaster(10000, 0.01),
		roleBroadcaster:    NewRoleBasedBroadcaster(),
	}
}

// SetViewRule 设置集合的 ViewRule
func (f *PermissionFilter) SetViewRule(collection, rule string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.viewRules[collection] = rule
}

// GetViewRule 获取集合的 ViewRule
func (f *PermissionFilter) GetViewRule(collection string) string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.viewRules[collection]
}

// FilterSubscribers 过滤订阅者
func (f *PermissionFilter) FilterSubscribers(
	event *RealtimeRecordEvent,
	subscribers []*Subscriber,
) []*Subscriber {
	f.mu.RLock()
	rule := f.viewRules[event.Collection]
	f.mu.RUnlock()

	// 空规则 = 允许所有
	if rule == "" || rule == "true" {
		atomic.AddInt64(&f.totalEvaluations, int64(len(subscribers)))
		atomic.AddInt64(&f.allowedCount, int64(len(subscribers)))
		return subscribers
	}

	// false = 拒绝所有
	if rule == "false" {
		atomic.AddInt64(&f.totalEvaluations, int64(len(subscribers)))
		atomic.AddInt64(&f.deniedCount, int64(len(subscribers)))
		return nil
	}

	// 动态规则评估
	allowed := make([]*Subscriber, 0, len(subscribers))
	for _, sub := range subscribers {
		atomic.AddInt64(&f.totalEvaluations, 1)

		auth := &AuthContext{
			ID:   sub.UserID,
			Role: sub.Role,
		}

		ok, err := f.evaluator.Evaluate(rule, event.Record, auth)
		if err != nil {
			atomic.AddInt64(&f.errorCount, 1)
			continue
		}

		if ok {
			atomic.AddInt64(&f.allowedCount, 1)
			allowed = append(allowed, sub)
		} else {
			atomic.AddInt64(&f.deniedCount, 1)
		}
	}

	return allowed
}

// GetMetrics 获取指标
func (f *PermissionFilter) GetMetrics() PermissionFilterMetrics {
	return PermissionFilterMetrics{
		TotalEvaluations: atomic.LoadInt64(&f.totalEvaluations),
		AllowedCount:     atomic.LoadInt64(&f.allowedCount),
		DeniedCount:      atomic.LoadInt64(&f.deniedCount),
		ErrorCount:       atomic.LoadInt64(&f.errorCount),
	}
}

// ResetMetrics 重置指标
func (f *PermissionFilter) ResetMetrics() {
	atomic.StoreInt64(&f.totalEvaluations, 0)
	atomic.StoreInt64(&f.allowedCount, 0)
	atomic.StoreInt64(&f.deniedCount, 0)
	atomic.StoreInt64(&f.errorCount, 0)
}
