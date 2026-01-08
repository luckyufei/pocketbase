// Package triggers 提供 Serverless 触发器实现
package triggers

import (
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/tools/cron"
)

// DefaultCronTimeout 默认 Cron 超时时间
const DefaultCronTimeout = 15 * time.Minute

// ErrCronAlreadyRunning Cron 任务正在运行错误
var ErrCronAlreadyRunning = errors.New("cron job is already running")

// CronHandler Cron 处理函数
type CronHandler func() error

// CronTrigger Cron 触发器
type CronTrigger struct {
	Name     string
	Schedule string
	Timeout  time.Duration
	Handler  CronHandler

	running bool
	mutex   sync.Mutex
}

// NewCronTrigger 创建新的 Cron 触发器
func NewCronTrigger(name, schedule string) *CronTrigger {
	return &CronTrigger{
		Name:     name,
		Schedule: schedule,
		Timeout:  DefaultCronTimeout,
	}
}

// SetTimeout 设置超时时间
func (ct *CronTrigger) SetTimeout(timeout time.Duration) {
	ct.Timeout = timeout
}

// Validate 验证 Cron 表达式
func (ct *CronTrigger) Validate() error {
	if ct.Schedule == "" {
		return errors.New("cron schedule cannot be empty")
	}

	// 检查字段数量（标准 cron 有 5 个字段）
	fields := strings.Fields(ct.Schedule)
	if len(fields) != 5 {
		return errors.New("invalid cron expression: expected 5 fields")
	}

	// 尝试解析
	_, err := cron.NewSchedule(ct.Schedule)
	return err
}

// Execute 执行 Cron 任务
func (ct *CronTrigger) Execute() error {
	ct.mutex.Lock()
	if ct.running {
		ct.mutex.Unlock()
		return ErrCronAlreadyRunning
	}
	ct.running = true
	ct.mutex.Unlock()

	defer func() {
		ct.mutex.Lock()
		ct.running = false
		ct.mutex.Unlock()
	}()

	if ct.Handler != nil {
		return ct.Handler()
	}
	return nil
}

// NextRun 计算下次运行时间
func (ct *CronTrigger) NextRun() (time.Time, error) {
	schedule, err := cron.NewSchedule(ct.Schedule)
	if err != nil {
		return time.Time{}, err
	}

	// 从当前时间开始，逐分钟检查
	now := time.Now()
	for i := 0; i < 60*24*366; i++ { // 最多检查一年
		next := now.Add(time.Duration(i+1) * time.Minute)
		moment := cron.NewMoment(next)
		if schedule.IsDue(moment) {
			return next, nil
		}
	}

	return time.Time{}, errors.New("no next run time found within a year")
}

// IsRunning 检查是否正在运行
func (ct *CronTrigger) IsRunning() bool {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	return ct.running
}

// CronJob Cron 任务
type CronJob struct {
	Name     string
	Schedule string
	Handler  CronHandler
}

// CronRegistry Cron 任务注册表
type CronRegistry struct {
	jobs  map[string]*CronJob
	mutex sync.RWMutex
}

// NewCronRegistry 创建新的 Cron 注册表
func NewCronRegistry() *CronRegistry {
	return &CronRegistry{
		jobs: make(map[string]*CronJob),
	}
}

// Register 注册 Cron 任务
func (cr *CronRegistry) Register(name, schedule string, handler CronHandler) error {
	cr.mutex.Lock()
	defer cr.mutex.Unlock()

	if _, exists := cr.jobs[name]; exists {
		return errors.New("cron job already registered: " + name)
	}

	cr.jobs[name] = &CronJob{
		Name:     name,
		Schedule: schedule,
		Handler:  handler,
	}

	return nil
}

// Unregister 取消注册 Cron 任务
func (cr *CronRegistry) Unregister(name string) {
	cr.mutex.Lock()
	defer cr.mutex.Unlock()
	delete(cr.jobs, name)
}

// List 列出所有 Cron 任务
func (cr *CronRegistry) List() []*CronJob {
	cr.mutex.RLock()
	defer cr.mutex.RUnlock()

	jobs := make([]*CronJob, 0, len(cr.jobs))
	for _, job := range cr.jobs {
		jobs = append(jobs, job)
	}
	return jobs
}

// Get 获取 Cron 任务
func (cr *CronRegistry) Get(name string) *CronJob {
	cr.mutex.RLock()
	defer cr.mutex.RUnlock()
	return cr.jobs[name]
}
