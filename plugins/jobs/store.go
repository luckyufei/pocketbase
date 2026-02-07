package jobs

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Job 相关错误
var (
	// ErrJobNotFound 表示任务不存在
	ErrJobNotFound = errors.New("job not found")

	// ErrJobPayloadTooLarge 表示 Payload 大小超过限制
	ErrJobPayloadTooLarge = errors.New("payload too large (max 1MB)")

	// ErrJobTopicEmpty 表示 Topic 为空
	ErrJobTopicEmpty = errors.New("topic cannot be empty")

	// ErrJobTopicAlreadyRegistered 表示 Topic 已被注册
	ErrJobTopicAlreadyRegistered = errors.New("topic already registered")

	// ErrJobCannotDelete 表示任务无法删除（状态不允许）
	ErrJobCannotDelete = errors.New("cannot delete job (only pending or failed jobs can be deleted)")

	// ErrJobCannotRequeue 表示任务无法重新入队（状态不允许）
	ErrJobCannotRequeue = errors.New("cannot requeue job (only failed jobs can be requeued)")
)

// Job 相关常量
const (
	// JobMaxPayloadSize Payload 最大大小 (1MB)
	JobMaxPayloadSize = 1 << 20

	// JobDefaultMaxRetries 默认最大重试次数
	JobDefaultMaxRetries = 3

	// JobDefaultLockDuration 默认锁定时长（Worker 执行超时时间）
	JobDefaultLockDuration = 5 * time.Minute

	// JobDefaultPollInterval 默认轮询间隔
	JobDefaultPollInterval = 1 * time.Second

	// JobDefaultWorkerPoolSize 默认 Worker 池大小
	JobDefaultWorkerPoolSize = 10

	// JobDefaultBatchSize 默认批量获取任务数量
	JobDefaultBatchSize = 10
)

// Job 状态常量
const (
	JobStatusPending    = "pending"
	JobStatusProcessing = "processing"
	JobStatusCompleted  = "completed"
	JobStatusFailed     = "failed"
)

// Job 表示一个任务
type Job struct {
	ID          string         `db:"id" json:"id"`
	Topic       string         `db:"topic" json:"topic"`
	Payload     any            `db:"payload" json:"payload"`
	Status      string         `db:"status" json:"status"`
	RunAt       types.DateTime `db:"run_at" json:"run_at"`
	LockedUntil types.DateTime `db:"locked_until" json:"locked_until,omitempty"`
	Retries     int            `db:"retries" json:"retries"`
	MaxRetries  int            `db:"max_retries" json:"max_retries"`
	LastError   string         `db:"last_error" json:"last_error,omitempty"`
	Created     types.DateTime `db:"created" json:"created"`
	Updated     types.DateTime `db:"updated" json:"updated"`
}

// UnmarshalPayload 将 Payload 解析到目标结构体
func (j *Job) UnmarshalPayload(target any) error {
	// 处理从数据库读取的情况：Payload 可能是字符串（JSON 字符串）
	if str, ok := j.Payload.(string); ok {
		return json.Unmarshal([]byte(str), target)
	}

	// 如果 Payload 已经是 map 或其他类型，先序列化再反序列化
	data, err := json.Marshal(j.Payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

// JobEnqueueOptions 入队选项
type JobEnqueueOptions struct {
	RunAt      time.Time // 调度时间（延时执行）
	MaxRetries int       // 最大重试次数
}

// JobFilter 任务列表筛选条件
type JobFilter struct {
	Topic  string // 按 topic 筛选
	Status string // 按状态筛选
	Limit  int    // 返回数量限制
	Offset int    // 偏移量
}

// JobListResult 任务列表结果
type JobListResult struct {
	Items  []*Job `json:"items"`
	Total  int    `json:"total"`
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
}

// JobStats 任务统计
type JobStats struct {
	Pending     int     `json:"pending"`
	Processing  int     `json:"processing"`
	Completed   int     `json:"completed"`
	Failed      int     `json:"failed"`
	Total       int     `json:"total"`
	SuccessRate float64 `json:"success_rate"`
}

// JobHandler 任务处理函数
type JobHandler func(job *Job) error

// Store 定义任务队列接口
type Store interface {
	// ==================== 入队操作 ====================

	// Enqueue 入队任务（立即执行）
	Enqueue(topic string, payload any) (*Job, error)

	// EnqueueAt 入队延时任务
	EnqueueAt(topic string, payload any, runAt time.Time) (*Job, error)

	// EnqueueWithOptions 带选项入队任务
	EnqueueWithOptions(topic string, payload any, opts *JobEnqueueOptions) (*Job, error)

	// ==================== 查询操作 ====================

	// Get 获取任务详情
	Get(id string) (*Job, error)

	// List 列表查询
	List(filter *JobFilter) (*JobListResult, error)

	// Stats 获取统计信息
	Stats() (*JobStats, error)

	// ==================== 管理操作 ====================

	// Delete 删除任务（仅 pending/failed 状态可删除）
	Delete(id string) error

	// Requeue 重新入队（仅 failed 状态可重新入队）
	Requeue(id string) (*Job, error)

	// ==================== Worker 操作 ====================

	// Register 注册 Worker 处理函数
	Register(topic string, handler JobHandler) error

	// Start 启动 Dispatcher
	Start() error

	// Stop 停止 Dispatcher
	Stop() error
}

// JobStore 是 Store 接口的实现
type JobStore struct {
	app        core.App
	config     Config
	handlers   map[string]JobHandler
	handlersMu sync.RWMutex
	dispatcher *Dispatcher
	running    bool
	runningMu  sync.Mutex
}

// newJobStore 创建 JobStore 实例
func newJobStore(app core.App, config Config) *JobStore {
	return &JobStore{
		app:      app,
		config:   config,
		handlers: make(map[string]JobHandler),
	}
}

// generateJobID 生成 UUID v7（时间有序）
func generateJobID() string {
	// 使用 UUID v7 保证时间有序性
	id, err := uuid.NewV7()
	if err != nil {
		// fallback 到 UUID v4
		return uuid.New().String()
	}
	return id.String()
}

// validatePayloadSize 验证 payload 大小
func validatePayloadSize(payload any, maxSize int64) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil // 序列化失败时不阻止，让后续操作处理
	}
	if int64(len(data)) > maxSize {
		return ErrJobPayloadTooLarge
	}
	return nil
}

// ==================== 入队操作实现 ====================

func (js *JobStore) Enqueue(topic string, payload any) (*Job, error) {
	return js.EnqueueWithOptions(topic, payload, nil)
}

func (js *JobStore) EnqueueAt(topic string, payload any, runAt time.Time) (*Job, error) {
	opts := &JobEnqueueOptions{RunAt: runAt}
	return js.EnqueueWithOptions(topic, payload, opts)
}

func (js *JobStore) EnqueueWithOptions(topic string, payload any, opts *JobEnqueueOptions) (*Job, error) {
	// 验证 topic
	if topic == "" {
		return nil, ErrJobTopicEmpty
	}

	// 验证 payload 大小
	if err := validatePayloadSize(payload, js.config.MaxPayloadSize); err != nil {
		return nil, err
	}

	// 设置默认值
	now := time.Now().UTC()
	runAt := now
	maxRetries := js.config.MaxRetries

	if opts != nil {
		if !opts.RunAt.IsZero() {
			runAt = opts.RunAt.UTC()
		}
		if opts.MaxRetries > 0 {
			maxRetries = opts.MaxRetries
		}
	}

	// 生成 ID
	id := generateJobID()

	// 序列化 payload
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	// 插入数据库
	var insertSQL string
	if js.app.IsPostgres() {
		insertSQL = `
			INSERT INTO _jobs (id, topic, payload, status, run_at, max_retries, created, updated)
			VALUES ({:id}, {:topic}, {:payload}::jsonb, 'pending', {:run_at}, {:max_retries}, {:now}, {:now})
		`
	} else {
		insertSQL = `
			INSERT INTO _jobs (id, topic, payload, status, run_at, max_retries, created, updated)
			VALUES ({:id}, {:topic}, {:payload}, 'pending', {:run_at}, {:max_retries}, {:now}, {:now})
		`
	}

	_, err = js.app.DB().NewQuery(insertSQL).Bind(map[string]any{
		"id":          id,
		"topic":       topic,
		"payload":     string(payloadJSON),
		"run_at":      runAt.Format(time.RFC3339),
		"max_retries": maxRetries,
		"now":         now.Format(time.RFC3339),
	}).Execute()
	if err != nil {
		return nil, err
	}

	// 返回 Job 对象
	nowDT, _ := types.ParseDateTime(now)
	runAtDT, _ := types.ParseDateTime(runAt)
	return &Job{
		ID:         id,
		Topic:      topic,
		Payload:    payload,
		Status:     JobStatusPending,
		RunAt:      runAtDT,
		Retries:    0,
		MaxRetries: maxRetries,
		Created:    nowDT,
		Updated:    nowDT,
	}, nil
}

// ==================== 查询操作实现 ====================

func (js *JobStore) Get(id string) (*Job, error) {
	// 直接选择字段，types.DateTime 可以处理 NULL 值
	query := `
		SELECT id, topic, payload, status, run_at, 
		       locked_until, 
		       retries, max_retries, 
		       COALESCE(last_error, '') as last_error, 
		       created, updated
		FROM _jobs
		WHERE id = {:id}
	`

	var job Job
	err := js.app.DB().NewQuery(query).Bind(map[string]any{"id": id}).One(&job)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, ErrJobNotFound
		}
		return nil, err
	}

	return &job, nil
}

func (js *JobStore) List(filter *JobFilter) (*JobListResult, error) {
	if filter == nil {
		filter = &JobFilter{}
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	// 构建查询，types.DateTime 可以处理 NULL 值
	query := `SELECT id, topic, payload, status, run_at, 
	          locked_until, 
	          retries, max_retries, 
	          COALESCE(last_error, '') as last_error, 
	          created, updated 
	          FROM _jobs WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM _jobs WHERE 1=1`
	bindings := map[string]any{}

	if filter.Topic != "" {
		query += ` AND topic = {:topic}`
		countQuery += ` AND topic = {:topic}`
		bindings["topic"] = filter.Topic
	}
	if filter.Status != "" {
		query += ` AND status = {:status}`
		countQuery += ` AND status = {:status}`
		bindings["status"] = filter.Status
	}

	query += ` ORDER BY created DESC LIMIT {:limit} OFFSET {:offset}`
	bindings["limit"] = filter.Limit
	bindings["offset"] = filter.Offset

	// 执行查询
	var jobs []*Job
	err := js.app.DB().NewQuery(query).Bind(bindings).All(&jobs)
	if err != nil {
		return nil, err
	}

	// 获取总数
	var total int
	err = js.app.DB().NewQuery(countQuery).Bind(bindings).Row(&total)
	if err != nil {
		return nil, err
	}

	return &JobListResult{
		Items:  jobs,
		Total:  total,
		Limit:  filter.Limit,
		Offset: filter.Offset,
	}, nil
}

func (js *JobStore) Stats() (*JobStats, error) {
	stats := &JobStats{}

	// 查询各状态数量
	query := `
		SELECT status, COUNT(*) as count
		FROM _jobs
		GROUP BY status
	`

	type statusCount struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	var counts []statusCount
	err := js.app.DB().NewQuery(query).All(&counts)
	if err != nil {
		return nil, err
	}

	for _, c := range counts {
		switch c.Status {
		case JobStatusPending:
			stats.Pending = c.Count
		case JobStatusProcessing:
			stats.Processing = c.Count
		case JobStatusCompleted:
			stats.Completed = c.Count
		case JobStatusFailed:
			stats.Failed = c.Count
		}
	}

	stats.Total = stats.Pending + stats.Processing + stats.Completed + stats.Failed

	// 计算成功率
	finished := stats.Completed + stats.Failed
	if finished > 0 {
		stats.SuccessRate = float64(stats.Completed) / float64(finished)
	}

	return stats, nil
}

// ==================== 管理操作实现 ====================

func (js *JobStore) Delete(id string) error {
	query := `DELETE FROM _jobs WHERE id = {:id} AND status IN ('pending', 'failed')`
	result, err := js.app.DB().NewQuery(query).Bind(map[string]any{"id": id}).Execute()
	if err != nil {
		return err
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		// 检查任务是否存在
		_, err := js.Get(id)
		if err == ErrJobNotFound {
			return ErrJobNotFound
		}
		return ErrJobCannotDelete
	}

	return nil
}

func (js *JobStore) Requeue(id string) (*Job, error) {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)

	query := `
		UPDATE _jobs
		SET status = 'pending',
		    retries = 0,
		    run_at = {:now},
		    locked_until = NULL,
		    last_error = NULL,
		    updated = {:now}
		WHERE id = {:id} AND status = 'failed'
	`

	result, err := js.app.DB().NewQuery(query).Bind(map[string]any{
		"id":  id,
		"now": nowStr,
	}).Execute()
	if err != nil {
		return nil, err
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		// 检查任务是否存在
		_, err := js.Get(id)
		if err == ErrJobNotFound {
			return nil, ErrJobNotFound
		}
		return nil, ErrJobCannotRequeue
	}

	return js.Get(id)
}

// ==================== Worker 操作实现 ====================

func (js *JobStore) Register(topic string, handler JobHandler) error {
	js.handlersMu.Lock()
	defer js.handlersMu.Unlock()

	if _, exists := js.handlers[topic]; exists {
		return ErrJobTopicAlreadyRegistered
	}

	js.handlers[topic] = handler
	return nil
}

func (js *JobStore) Start() error {
	js.runningMu.Lock()
	defer js.runningMu.Unlock()

	if js.running {
		return nil
	}

	js.dispatcher = newDispatcher(js, js.config)
	js.dispatcher.Start()
	js.running = true

	return nil
}

func (js *JobStore) Stop() error {
	js.runningMu.Lock()
	defer js.runningMu.Unlock()

	if !js.running {
		return nil
	}

	if js.dispatcher != nil {
		js.dispatcher.Stop()
	}
	js.running = false

	return nil
}

// getHandler 获取 topic 对应的处理函数
func (js *JobStore) getHandler(topic string) (JobHandler, bool) {
	js.handlersMu.RLock()
	defer js.handlersMu.RUnlock()
	handler, ok := js.handlers[topic]
	return handler, ok
}

// getRegisteredTopics 获取所有已注册的 topic
func (js *JobStore) getRegisteredTopics() []string {
	js.handlersMu.RLock()
	defer js.handlersMu.RUnlock()
	topics := make([]string, 0, len(js.handlers))
	for topic := range js.handlers {
		topics = append(topics, topic)
	}
	return topics
}
