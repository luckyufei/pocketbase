// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// Job 状态常量
const (
	JobStatusPending   = "pending"
	JobStatusQueued    = "queued"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
	JobStatusCancelled = "cancelled"
)

// Job 优先级常量
const (
	JobPriorityLow    = 1
	JobPriorityNormal = 5
	JobPriorityHigh   = 10
)

// EnqueueOptions 入队选项
type EnqueueOptions struct {
	Delay      int       // 延迟执行（秒）
	Priority   int       // 优先级
	MaxRetries int       // 最大重试次数
	RunAt      time.Time // 调度时间
}

// jobEntry 任务条目（用于 fallback 内存存储）
type jobEntry struct {
	ID       string
	Topic    string
	Payload  interface{}
	Status   string
	Priority int
}

// JobService 任务队列服务
// 优先使用 core.JobStore，如果不可用则回退到内存存储
type JobService struct {
	app      core.App
	coreJobs core.JobStore // 桥接到 core.JobStore
	fallback map[string]*jobEntry
	mutex    sync.RWMutex
}

// NewJobService 创建任务队列服务
func NewJobService(app core.App) *JobService {
	js := &JobService{
		app:      app,
		fallback: make(map[string]*jobEntry),
	}

	// 尝试获取 core.JobStore
	if app != nil {
		js.coreJobs = app.Jobs()
	}

	return js
}

// useCoreJobs 检查是否应该使用 core.JobStore
func (js *JobService) useCoreJobs() bool {
	return js.coreJobs != nil
}

// Enqueue 入队任务
func (js *JobService) Enqueue(topic string, payload interface{}) (string, error) {
	return js.EnqueueWithOptions(topic, payload, EnqueueOptions{Priority: JobPriorityNormal})
}

// EnqueueWithOptions 使用选项入队任务
func (js *JobService) EnqueueWithOptions(topic string, payload interface{}, opts EnqueueOptions) (string, error) {
	if js.useCoreJobs() {
		coreOpts := &core.JobEnqueueOptions{
			MaxRetries: opts.MaxRetries,
		}

		// 处理延迟执行
		if opts.Delay > 0 {
			coreOpts.RunAt = time.Now().Add(time.Duration(opts.Delay) * time.Second)
		} else if !opts.RunAt.IsZero() {
			coreOpts.RunAt = opts.RunAt
		}

		job, err := js.coreJobs.EnqueueWithOptions(topic, payload, coreOpts)
		if err != nil {
			return "", err
		}
		return job.ID, nil
	}

	// Fallback 到内存存储
	js.mutex.Lock()
	defer js.mutex.Unlock()

	jobID := security.RandomString(15)
	priority := opts.Priority
	if priority == 0 {
		priority = JobPriorityNormal
	}

	js.fallback[jobID] = &jobEntry{
		ID:       jobID,
		Topic:    topic,
		Payload:  payload,
		Status:   JobStatusPending,
		Priority: priority,
	}

	return jobID, nil
}

// EnqueueAt 入队延时任务
func (js *JobService) EnqueueAt(topic string, payload interface{}, runAt time.Time) (string, error) {
	return js.EnqueueWithOptions(topic, payload, EnqueueOptions{RunAt: runAt})
}

// Get 获取任务详情
func (js *JobService) Get(id string) (*core.Job, error) {
	if js.useCoreJobs() {
		return js.coreJobs.Get(id)
	}

	// Fallback 到内存存储
	js.mutex.RLock()
	defer js.mutex.RUnlock()

	entry, exists := js.fallback[id]
	if !exists {
		return nil, core.ErrJobNotFound
	}

	return &core.Job{
		ID:      entry.ID,
		Topic:   entry.Topic,
		Payload: entry.Payload,
		Status:  entry.Status,
	}, nil
}

// GetStatus 获取任务状态
func (js *JobService) GetStatus(jobID string) (string, error) {
	if js.useCoreJobs() {
		job, err := js.coreJobs.Get(jobID)
		if err != nil {
			return "", err
		}
		return job.Status, nil
	}

	// Fallback 到内存存储
	js.mutex.RLock()
	defer js.mutex.RUnlock()

	job, exists := js.fallback[jobID]
	if !exists {
		return "", nil
	}

	return job.Status, nil
}

// Cancel 取消任务
func (js *JobService) Cancel(jobID string) error {
	if js.useCoreJobs() {
		// core.JobStore 不直接支持 Cancel，使用 Delete
		return js.coreJobs.Delete(jobID)
	}

	// Fallback 到内存存储
	js.mutex.Lock()
	defer js.mutex.Unlock()

	job, exists := js.fallback[jobID]
	if !exists {
		return nil
	}

	job.Status = JobStatusCancelled
	return nil
}

// Delete 删除任务
func (js *JobService) Delete(id string) error {
	if js.useCoreJobs() {
		return js.coreJobs.Delete(id)
	}

	// Fallback 到内存存储
	js.mutex.Lock()
	defer js.mutex.Unlock()

	delete(js.fallback, id)
	return nil
}

// Requeue 重新入队任务
func (js *JobService) Requeue(id string) (*core.Job, error) {
	if js.useCoreJobs() {
		return js.coreJobs.Requeue(id)
	}

	// Fallback 到内存存储
	js.mutex.Lock()
	defer js.mutex.Unlock()

	entry, exists := js.fallback[id]
	if !exists {
		return nil, core.ErrJobNotFound
	}

	entry.Status = JobStatusPending
	return &core.Job{
		ID:      entry.ID,
		Topic:   entry.Topic,
		Payload: entry.Payload,
		Status:  entry.Status,
	}, nil
}

// List 列表查询
func (js *JobService) List(filter *core.JobFilter) (*core.JobListResult, error) {
	if js.useCoreJobs() {
		return js.coreJobs.List(filter)
	}

	// Fallback 到内存存储
	js.mutex.RLock()
	defer js.mutex.RUnlock()

	items := make([]*core.Job, 0)
	for _, entry := range js.fallback {
		// 应用过滤条件
		if filter != nil {
			if filter.Topic != "" && entry.Topic != filter.Topic {
				continue
			}
			if filter.Status != "" && entry.Status != filter.Status {
				continue
			}
		}

		items = append(items, &core.Job{
			ID:      entry.ID,
			Topic:   entry.Topic,
			Payload: entry.Payload,
			Status:  entry.Status,
		})
	}

	return &core.JobListResult{
		Items: items,
		Total: len(items),
	}, nil
}

// Stats 获取统计信息
func (js *JobService) Stats() (*core.JobStats, error) {
	if js.useCoreJobs() {
		return js.coreJobs.Stats()
	}

	// Fallback 到内存存储
	js.mutex.RLock()
	defer js.mutex.RUnlock()

	stats := &core.JobStats{}
	for _, entry := range js.fallback {
		switch entry.Status {
		case JobStatusPending:
			stats.Pending++
		case JobStatusCompleted:
			stats.Completed++
		case JobStatusFailed:
			stats.Failed++
		}
		stats.Total++
	}

	if stats.Total > 0 {
		stats.SuccessRate = float64(stats.Completed) / float64(stats.Total)
	}

	return stats, nil
}

// HostFunctions 任务方法扩展

// JobEnqueue 入队任务
func (hf *HostFunctions) JobEnqueue(topic string, payload interface{}) (string, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.Enqueue(topic, payload)
}

// JobEnqueueWithOptions 使用选项入队任务
func (hf *HostFunctions) JobEnqueueWithOptions(topic string, payload interface{}, opts EnqueueOptions) (string, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.EnqueueWithOptions(topic, payload, opts)
}

// JobEnqueueAt 入队延时任务
func (hf *HostFunctions) JobEnqueueAt(topic string, payload interface{}, runAt time.Time) (string, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.EnqueueAt(topic, payload, runAt)
}

// JobGet 获取任务详情
func (hf *HostFunctions) JobGet(id string) (*core.Job, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.Get(id)
}

// JobGetStatus 获取任务状态
func (hf *HostFunctions) JobGetStatus(jobID string) (string, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.GetStatus(jobID)
}

// JobCancel 取消任务
func (hf *HostFunctions) JobCancel(jobID string) error {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.Cancel(jobID)
}

// JobDelete 删除任务
func (hf *HostFunctions) JobDelete(id string) error {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.Delete(id)
}

// JobRequeue 重新入队任务
func (hf *HostFunctions) JobRequeue(id string) (*core.Job, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.Requeue(id)
}

// JobList 列表查询
func (hf *HostFunctions) JobList(filter *core.JobFilter) (*core.JobListResult, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.List(filter)
}

// JobStats 获取统计信息
func (hf *HostFunctions) JobStats() (*core.JobStats, error) {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs.Stats()
}
