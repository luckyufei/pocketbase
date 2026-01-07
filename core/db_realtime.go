package core

import (
	"context"
	"fmt"
	"hash/fnv"
	"math"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ============================================================================
// STORY-5.1: WAL 消费者实现
// ============================================================================

// ReplicationSlotConfig 复制槽配置
type ReplicationSlotConfig struct {
	SlotName        string
	OutputPlugin    string
	PublicationName string
}

// ReplicationSlotManager 复制槽管理器
type ReplicationSlotManager struct {
	slotName string
}

// NewReplicationSlotManager 创建复制槽管理器
func NewReplicationSlotManager(slotName string) *ReplicationSlotManager {
	return &ReplicationSlotManager{
		slotName: slotName,
	}
}

// CreateSlotSQL 生成创建复制槽 SQL
func (m *ReplicationSlotManager) CreateSlotSQL() string {
	return fmt.Sprintf(
		"SELECT pg_create_logical_replication_slot('%s', 'pgoutput')",
		m.slotName,
	)
}

// DropSlotSQL 生成删除复制槽 SQL
func (m *ReplicationSlotManager) DropSlotSQL() string {
	return fmt.Sprintf(
		"SELECT pg_drop_replication_slot('%s')",
		m.slotName,
	)
}

// CreatePublicationSQL 生成创建发布 SQL
func (m *ReplicationSlotManager) CreatePublicationSQL(pubName string, tables []string) string {
	return fmt.Sprintf(
		"CREATE PUBLICATION %s FOR TABLE %s",
		pubName,
		strings.Join(tables, ", "),
	)
}

// DropPublicationSQL 生成删除发布 SQL
func (m *ReplicationSlotManager) DropPublicationSQL(pubName string) string {
	return fmt.Sprintf("DROP PUBLICATION IF EXISTS %s", pubName)
}

// WALMessageType WAL 消息类型
type WALMessageType int

const (
	WALMessageInsert WALMessageType = iota
	WALMessageUpdate
	WALMessageDelete
	WALMessageBegin
	WALMessageCommit
)

// String 返回消息类型字符串
func (t WALMessageType) String() string {
	switch t {
	case WALMessageInsert:
		return "INSERT"
	case WALMessageUpdate:
		return "UPDATE"
	case WALMessageDelete:
		return "DELETE"
	case WALMessageBegin:
		return "BEGIN"
	case WALMessageCommit:
		return "COMMIT"
	default:
		return "UNKNOWN"
	}
}

// WALMessage WAL 消息
type WALMessage struct {
	LSN       uint64
	Type      WALMessageType
	TableName string
	Schema    string
	Columns   []string
	OldValues map[string]interface{}
	NewValues map[string]interface{}
	Timestamp time.Time
}

// WALRawMessage WAL 原始消息
type WALRawMessage struct {
	Type      byte
	TableName string
	Schema    string
	Columns   []string
	OldValues []interface{}
	Values    []interface{}
}

// WALParser WAL 解析器
type WALParser struct{}

// NewWALParser 创建 WAL 解析器
func NewWALParser() *WALParser {
	return &WALParser{}
}

// ParseInsert 解析 INSERT 消息
func (p *WALParser) ParseInsert(raw *WALRawMessage) (*WALMessage, error) {
	values := make(map[string]interface{})
	for i, col := range raw.Columns {
		if i < len(raw.Values) {
			values[col] = raw.Values[i]
		}
	}

	return &WALMessage{
		Type:      WALMessageInsert,
		TableName: raw.TableName,
		Schema:    raw.Schema,
		Columns:   raw.Columns,
		NewValues: values,
		Timestamp: time.Now(),
	}, nil
}

// ParseUpdate 解析 UPDATE 消息
func (p *WALParser) ParseUpdate(raw *WALRawMessage) (*WALMessage, error) {
	oldValues := make(map[string]interface{})
	newValues := make(map[string]interface{})

	for i, col := range raw.Columns {
		if i < len(raw.OldValues) {
			oldValues[col] = raw.OldValues[i]
		}
		if i < len(raw.Values) {
			newValues[col] = raw.Values[i]
		}
	}

	return &WALMessage{
		Type:      WALMessageUpdate,
		TableName: raw.TableName,
		Schema:    raw.Schema,
		Columns:   raw.Columns,
		OldValues: oldValues,
		NewValues: newValues,
		Timestamp: time.Now(),
	}, nil
}

// ParseDelete 解析 DELETE 消息
func (p *WALParser) ParseDelete(raw *WALRawMessage) (*WALMessage, error) {
	oldValues := make(map[string]interface{})
	for i, col := range raw.Columns {
		if i < len(raw.OldValues) {
			oldValues[col] = raw.OldValues[i]
		}
	}

	return &WALMessage{
		Type:      WALMessageDelete,
		TableName: raw.TableName,
		Schema:    raw.Schema,
		Columns:   raw.Columns,
		OldValues: oldValues,
		Timestamp: time.Now(),
	}, nil
}

// RealtimeRecordAction 记录动作
type RealtimeRecordAction int

const (
	RealtimeRecordActionCreate RealtimeRecordAction = iota
	RealtimeRecordActionUpdate
	RealtimeRecordActionDelete
)

// RealtimeRecordEvent 实时记录事件
type RealtimeRecordEvent struct {
	Action     RealtimeRecordAction
	Collection string
	Record     map[string]interface{}
	OldRecord  map[string]interface{}
	Timestamp  time.Time
}

// RecordConverter 记录转换器
type RecordConverter struct{}

// NewRecordConverter 创建记录转换器
func NewRecordConverter() *RecordConverter {
	return &RecordConverter{}
}

// ToRecordEvent 将 WAL 消息转换为记录事件
func (c *RecordConverter) ToRecordEvent(msg *WALMessage) (*RealtimeRecordEvent, error) {
	event := &RealtimeRecordEvent{
		Collection: msg.TableName,
		Timestamp:  msg.Timestamp,
	}

	switch msg.Type {
	case WALMessageInsert:
		event.Action = RealtimeRecordActionCreate
		event.Record = msg.NewValues
	case WALMessageUpdate:
		event.Action = RealtimeRecordActionUpdate
		event.Record = msg.NewValues
		event.OldRecord = msg.OldValues
	case WALMessageDelete:
		event.Action = RealtimeRecordActionDelete
		event.OldRecord = msg.OldValues
	default:
		return nil, fmt.Errorf("不支持的消息类型: %v", msg.Type)
	}

	return event, nil
}

// ============================================================================
// STORY-5.2: 事件权限过滤
// ============================================================================

// Subscriber 订阅者
type Subscriber struct {
	ID         string
	UserID     string
	Role       string
	Collection string
	Filter     string
	Channel    chan *RealtimeRecordEvent
}

// SubscriptionManager 订阅管理器
type SubscriptionManager struct {
	subscribers map[string]*Subscriber          // ID -> Subscriber
	byCollection map[string]map[string]*Subscriber // Collection -> ID -> Subscriber
	mu          sync.RWMutex
}

// NewSubscriptionManager 创建订阅管理器
func NewSubscriptionManager() *SubscriptionManager {
	return &SubscriptionManager{
		subscribers:  make(map[string]*Subscriber),
		byCollection: make(map[string]map[string]*Subscriber),
	}
}

// Subscribe 添加订阅者
func (m *SubscriptionManager) Subscribe(sub *Subscriber) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.subscribers[sub.ID] = sub

	if m.byCollection[sub.Collection] == nil {
		m.byCollection[sub.Collection] = make(map[string]*Subscriber)
	}
	m.byCollection[sub.Collection][sub.ID] = sub
}

// Unsubscribe 移除订阅者
func (m *SubscriptionManager) Unsubscribe(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sub, ok := m.subscribers[id]
	if !ok {
		return
	}

	delete(m.subscribers, id)
	if m.byCollection[sub.Collection] != nil {
		delete(m.byCollection[sub.Collection], id)
	}
}

// GetSubscribers 获取集合的所有订阅者
func (m *SubscriptionManager) GetSubscribers(collection string) []*Subscriber {
	m.mu.RLock()
	defer m.mu.RUnlock()

	subs := make([]*Subscriber, 0)
	if m.byCollection[collection] != nil {
		for _, sub := range m.byCollection[collection] {
			subs = append(subs, sub)
		}
	}
	return subs
}

// GetSubscribersByRole 按角色分组获取订阅者
func (m *SubscriptionManager) GetSubscribersByRole(collection string) map[string][]*Subscriber {
	m.mu.RLock()
	defer m.mu.RUnlock()

	groups := make(map[string][]*Subscriber)
	if m.byCollection[collection] != nil {
		for _, sub := range m.byCollection[collection] {
			role := sub.Role
			if role == "" {
				role = "anonymous"
			}
			groups[role] = append(groups[role], sub)
		}
	}
	return groups
}

// AuthContext 认证上下文
type AuthContext struct {
	ID   string
	Role string
}

// ViewRuleEvaluator ViewRule 评估器
type ViewRuleEvaluator struct {
	parser   *RuleParser
	compiler *RuleCompiler
}

// NewViewRuleEvaluator 创建 ViewRule 评估器
func NewViewRuleEvaluator() *ViewRuleEvaluator {
	return &ViewRuleEvaluator{
		parser:   NewRuleParser(),
		compiler: NewRuleCompiler(),
	}
}

// Evaluate 评估规则
func (e *ViewRuleEvaluator) Evaluate(rule string, record map[string]interface{}, auth *AuthContext) (bool, error) {
	rule = strings.TrimSpace(rule)

	// 空规则 = 允许
	if rule == "" || rule == "true" {
		return true, nil
	}

	// false = 拒绝
	if rule == "false" {
		return false, nil
	}

	// 解析规则
	ast, err := e.parser.Parse(rule)
	if err != nil {
		return false, err
	}

	// 简单规则评估
	return e.evaluateAST(ast, record, auth)
}

func (e *ViewRuleEvaluator) evaluateAST(ast *RuleAST, record map[string]interface{}, auth *AuthContext) (bool, error) {
	switch ast.Type {
	case RuleTypeAllow:
		return true, nil
	case RuleTypeDeny:
		return false, nil
	case RuleTypeCondition:
		return e.evaluateCondition(ast, record, auth)
	default:
		return false, fmt.Errorf("未知的规则类型")
	}
}

func (e *ViewRuleEvaluator) evaluateCondition(ast *RuleAST, record map[string]interface{}, auth *AuthContext) (bool, error) {
	expr := ast.Expression

	// 替换 @request.auth.id
	if auth != nil {
		expr = strings.ReplaceAll(expr, "@request.auth.id", fmt.Sprintf("'%s'", auth.ID))
		expr = strings.ReplaceAll(expr, "@request.auth.role", fmt.Sprintf("'%s'", auth.Role))
	}

	// 简单的等式评估
	if strings.Contains(expr, "=") && !strings.Contains(expr, "!=") && !strings.Contains(expr, "<>") {
		parts := strings.SplitN(expr, "=", 2)
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])

			// 获取左侧值
			var leftVal string
			leftIsQuoted := strings.HasPrefix(left, "'") && strings.HasSuffix(left, "'")
			if leftIsQuoted {
				// 已经是引号包裹的值 (如替换后的 @request.auth.role)
				leftVal = strings.Trim(left, "'\"")
			} else if record != nil {
				// 从 record 中获取字段值
				if v, ok := record[left]; ok {
					leftVal = fmt.Sprintf("%v", v)
				}
			}

			// 获取右侧值 (去掉引号)
			rightVal := strings.Trim(right, "'\"")

			return leftVal == rightVal, nil
		}
	}

	// 不等式评估
	if strings.Contains(expr, "!=") || strings.Contains(expr, "<>") {
		sep := "!="
		if strings.Contains(expr, "<>") {
			sep = "<>"
		}
		parts := strings.SplitN(expr, sep, 2)
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])

			leftVal := strings.Trim(left, "'\"")
			rightVal := strings.Trim(right, "'\"")

			return leftVal != rightVal, nil
		}
	}

	// 默认允许
	return true, nil
}

// EventBroadcaster 事件广播器
type EventBroadcaster struct {
	handlers  map[string]func(*RealtimeRecordEvent, *Subscriber)
	viewRules map[string]string
	mu        sync.RWMutex
}

// NewEventBroadcaster 创建事件广播器
func NewEventBroadcaster() *EventBroadcaster {
	return &EventBroadcaster{
		handlers:  make(map[string]func(*RealtimeRecordEvent, *Subscriber)),
		viewRules: make(map[string]string),
	}
}

// AddHandler 添加事件处理器
func (b *EventBroadcaster) AddHandler(collection string, handler func(*RealtimeRecordEvent, *Subscriber)) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[collection] = handler
}

// SetViewRule 设置 ViewRule
func (b *EventBroadcaster) SetViewRule(collection, rule string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.viewRules[collection] = rule
}

// Broadcast 广播事件
func (b *EventBroadcaster) Broadcast(event *RealtimeRecordEvent, subscribers []*Subscriber) {
	b.mu.RLock()
	handler := b.handlers[event.Collection]
	b.mu.RUnlock()

	if handler == nil {
		return
	}

	for _, sub := range subscribers {
		go handler(event, sub)
	}
}

// ============================================================================
// 布隆过滤器
// ============================================================================

// BloomFilter 布隆过滤器
type BloomFilter struct {
	bits     []uint64
	size     uint64
	hashCount uint
	mu       sync.RWMutex
}

// NewBloomFilter 创建布隆过滤器
func NewBloomFilter(expectedItems int, falsePositiveRate float64) *BloomFilter {
	// 计算最优大小
	m := -float64(expectedItems) * math.Log(falsePositiveRate) / (math.Log(2) * math.Log(2))
	k := (m / float64(expectedItems)) * math.Log(2)

	size := uint64(math.Ceil(m))
	hashCount := uint(math.Ceil(k))

	return &BloomFilter{
		bits:      make([]uint64, (size+63)/64),
		size:      size,
		hashCount: hashCount,
	}
}

// Add 添加元素
func (bf *BloomFilter) Add(item string) {
	bf.mu.Lock()
	defer bf.mu.Unlock()

	for i := uint(0); i < bf.hashCount; i++ {
		hash := bf.hash(item, i)
		idx := hash % bf.size
		bf.bits[idx/64] |= 1 << (idx % 64)
	}
}

// MightContain 检查元素是否可能存在
func (bf *BloomFilter) MightContain(item string) bool {
	bf.mu.RLock()
	defer bf.mu.RUnlock()

	for i := uint(0); i < bf.hashCount; i++ {
		hash := bf.hash(item, i)
		idx := hash % bf.size
		if bf.bits[idx/64]&(1<<(idx%64)) == 0 {
			return false
		}
	}
	return true
}

func (bf *BloomFilter) hash(item string, seed uint) uint64 {
	h := fnv.New64a()
	h.Write([]byte(item))
	h.Write([]byte{byte(seed)})
	return h.Sum64()
}

// ============================================================================
// Realtime 引擎
// ============================================================================

// RealtimeEngine Realtime 引擎
type RealtimeEngine struct {
	slotManager  *ReplicationSlotManager
	parser       *WALParser
	converter    *RecordConverter
	subManager   *SubscriptionManager
	broadcaster  *EventBroadcaster
	evaluator    *ViewRuleEvaluator
	running      atomic.Bool
	mu           sync.RWMutex
}

// NewRealtimeEngine 创建 Realtime 引擎
func NewRealtimeEngine() *RealtimeEngine {
	return &RealtimeEngine{
		slotManager:  NewReplicationSlotManager("pocketbase_realtime"),
		parser:       NewWALParser(),
		converter:    NewRecordConverter(),
		subManager:   NewSubscriptionManager(),
		broadcaster:  NewEventBroadcaster(),
		evaluator:    NewViewRuleEvaluator(),
	}
}

// Start 启动引擎
func (e *RealtimeEngine) Start(ctx context.Context) error {
	if e.running.Load() {
		return nil
	}

	e.running.Store(true)

	// TODO: 实际实现需要:
	// 1. 创建复制槽
	// 2. 建立流式连接
	// 3. 启动 WAL 消费循环

	return nil
}

// Stop 停止引擎
func (e *RealtimeEngine) Stop() error {
	e.running.Store(false)
	return nil
}

// Subscribe 订阅集合
func (e *RealtimeEngine) Subscribe(sub *Subscriber) {
	e.subManager.Subscribe(sub)
}

// Unsubscribe 取消订阅
func (e *RealtimeEngine) Unsubscribe(id string) {
	e.subManager.Unsubscribe(id)
}

// ProcessWALMessage 处理 WAL 消息
func (e *RealtimeEngine) ProcessWALMessage(msg *WALMessage) error {
	// 转换为记录事件
	event, err := e.converter.ToRecordEvent(msg)
	if err != nil {
		return err
	}

	// 获取订阅者
	subscribers := e.subManager.GetSubscribers(event.Collection)

	// 广播事件
	e.broadcaster.Broadcast(event, subscribers)

	return nil
}

// SetViewRule 设置集合的 ViewRule
func (e *RealtimeEngine) SetViewRule(collection, rule string) {
	e.broadcaster.SetViewRule(collection, rule)
}
