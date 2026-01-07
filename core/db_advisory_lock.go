// Package core 提供 PocketBase 核心功能
package core

import (
	"context"
	"fmt"
	"hash/fnv"
	"sync"
	"time"

	"github.com/pocketbase/dbx"
)

// GenerateLockKey 根据名称生成 Advisory Lock Key
// PostgreSQL Advisory Lock 使用 bigint 作为 key
func GenerateLockKey(name string) int64 {
	h := fnv.New64a()
	h.Write([]byte(name))
	return int64(h.Sum64())
}

// AdvisoryLockManager PostgreSQL Advisory Lock 管理器
type AdvisoryLockManager struct {
	db         *dbx.DB
	localLocks map[int64]bool // 本地锁状态（用于 mock 模式）
	mu         sync.Mutex
}

// NewAdvisoryLockManager 创建新的 Advisory Lock 管理器
func NewAdvisoryLockManager(db *dbx.DB) *AdvisoryLockManager {
	return &AdvisoryLockManager{
		db:         db,
		localLocks: make(map[int64]bool),
	}
}

// TryLock 尝试获取锁（非阻塞）
// 返回 true 表示成功获取锁，false 表示锁已被占用
func (m *AdvisoryLockManager) TryLock(ctx context.Context, name string) (bool, error) {
	key := GenerateLockKey(name)

	// mock 模式
	if m.db == nil {
		m.mu.Lock()
		defer m.mu.Unlock()

		if m.localLocks[key] {
			return false, nil
		}
		m.localLocks[key] = true
		return true, nil
	}

	// PostgreSQL pg_try_advisory_lock
	var acquired bool
	err := m.db.NewQuery("SELECT pg_try_advisory_lock(:key)").
		Bind(map[string]any{"key": key}).
		WithContext(ctx).
		Row(&acquired)

	if err != nil {
		return false, fmt.Errorf("获取 Advisory Lock 失败: %w", err)
	}

	return acquired, nil
}

// Lock 获取锁（阻塞）
func (m *AdvisoryLockManager) Lock(ctx context.Context, name string) error {
	key := GenerateLockKey(name)

	// mock 模式
	if m.db == nil {
		for {
			m.mu.Lock()
			if !m.localLocks[key] {
				m.localLocks[key] = true
				m.mu.Unlock()
				return nil
			}
			m.mu.Unlock()

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(10 * time.Millisecond):
				// 继续等待
			}
		}
	}

	// PostgreSQL pg_advisory_lock
	_, err := m.db.NewQuery("SELECT pg_advisory_lock(:key)").
		Bind(map[string]any{"key": key}).
		WithContext(ctx).
		Execute()

	if err != nil {
		return fmt.Errorf("获取 Advisory Lock 失败: %w", err)
	}

	return nil
}

// Unlock 释放锁
func (m *AdvisoryLockManager) Unlock(ctx context.Context, name string) error {
	key := GenerateLockKey(name)

	// mock 模式
	if m.db == nil {
		m.mu.Lock()
		defer m.mu.Unlock()
		delete(m.localLocks, key)
		return nil
	}

	// PostgreSQL pg_advisory_unlock
	_, err := m.db.NewQuery("SELECT pg_advisory_unlock(:key)").
		Bind(map[string]any{"key": key}).
		WithContext(ctx).
		Execute()

	if err != nil {
		return fmt.Errorf("释放 Advisory Lock 失败: %w", err)
	}

	return nil
}

// ForceUnlock 强制释放锁（管理用途）
func (m *AdvisoryLockManager) ForceUnlock(ctx context.Context, name string) error {
	return m.Unlock(ctx, name)
}

// IsLocked 检查锁是否被占用
func (m *AdvisoryLockManager) IsLocked(ctx context.Context, name string) (bool, error) {
	key := GenerateLockKey(name)

	// mock 模式
	if m.db == nil {
		m.mu.Lock()
		defer m.mu.Unlock()
		return m.localLocks[key], nil
	}

	// 尝试获取锁来检查状态
	acquired, err := m.TryLock(ctx, name)
	if err != nil {
		return false, err
	}

	if acquired {
		// 如果获取成功，立即释放
		m.Unlock(ctx, name)
		return false, nil
	}

	return true, nil
}

// TaskHandler Cron 任务处理函数
type TaskHandler func(ctx context.Context) error

// TaskStatus 任务状态
type TaskStatus struct {
	Name     string
	Schedule string
	Running  bool
	LastRun  time.Time
	LastErr  error
	NextRun  time.Time
}

// cronTask Cron 任务
type cronTask struct {
	name     string
	schedule string
	handler  TaskHandler
	running  bool
	lastRun  time.Time
	lastErr  error
	mu       sync.Mutex
}

// DistributedCronScheduler 分布式 Cron 调度器
type DistributedCronScheduler struct {
	lockManager *AdvisoryLockManager
	tasks       map[string]*cronTask
	mu          sync.RWMutex
	stopCh      chan struct{}
}

// NewDistributedCronScheduler 创建新的分布式 Cron 调度器
func NewDistributedCronScheduler(lockManager *AdvisoryLockManager) *DistributedCronScheduler {
	return &DistributedCronScheduler{
		lockManager: lockManager,
		tasks:       make(map[string]*cronTask),
		stopCh:      make(chan struct{}),
	}
}

// RegisterTask 注册 Cron 任务
func (s *DistributedCronScheduler) RegisterTask(name, schedule string, handler TaskHandler) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.tasks[name] = &cronTask{
		name:     name,
		schedule: schedule,
		handler:  handler,
	}

	return nil
}

// UnregisterTask 取消注册任务
func (s *DistributedCronScheduler) UnregisterTask(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tasks, name)
}

// TriggerTask 手动触发任务
func (s *DistributedCronScheduler) TriggerTask(ctx context.Context, name string) error {
	s.mu.RLock()
	task, ok := s.tasks[name]
	s.mu.RUnlock()

	if !ok {
		return fmt.Errorf("任务不存在: %s", name)
	}

	return s.executeTask(ctx, task)
}

// executeTask 执行任务（带分布式锁）
func (s *DistributedCronScheduler) executeTask(ctx context.Context, task *cronTask) error {
	lockName := fmt.Sprintf("cron:%s", task.name)

	// 尝试获取分布式锁
	acquired, err := s.lockManager.TryLock(ctx, lockName)
	if err != nil {
		return fmt.Errorf("获取锁失败: %w", err)
	}

	if !acquired {
		// 其他节点正在执行
		return nil
	}

	// 确保释放锁
	defer s.lockManager.Unlock(ctx, lockName)

	// 标记任务运行中
	task.mu.Lock()
	if task.running {
		task.mu.Unlock()
		return nil // 本地已在运行
	}
	task.running = true
	task.mu.Unlock()

	defer func() {
		task.mu.Lock()
		task.running = false
		task.lastRun = time.Now()
		task.mu.Unlock()
	}()

	// 执行任务
	err = task.handler(ctx)
	if err != nil {
		task.mu.Lock()
		task.lastErr = err
		task.mu.Unlock()
		return err
	}

	return nil
}

// GetTaskStatus 获取任务状态
func (s *DistributedCronScheduler) GetTaskStatus(name string) *TaskStatus {
	s.mu.RLock()
	task, ok := s.tasks[name]
	s.mu.RUnlock()

	if !ok {
		return nil
	}

	task.mu.Lock()
	defer task.mu.Unlock()

	return &TaskStatus{
		Name:     task.name,
		Schedule: task.schedule,
		Running:  task.running,
		LastRun:  task.lastRun,
		LastErr:  task.lastErr,
	}
}

// ListTasks 列出所有任务
func (s *DistributedCronScheduler) ListTasks() []*TaskStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*TaskStatus, 0, len(s.tasks))
	for _, task := range s.tasks {
		task.mu.Lock()
		result = append(result, &TaskStatus{
			Name:     task.name,
			Schedule: task.schedule,
			Running:  task.running,
			LastRun:  task.lastRun,
			LastErr:  task.lastErr,
		})
		task.mu.Unlock()
	}

	return result
}

// Start 启动调度器
func (s *DistributedCronScheduler) Start(ctx context.Context) error {
	// 简化实现：这里只提供手动触发功能
	// 实际的 Cron 调度需要集成 cron 库
	<-ctx.Done()
	return ctx.Err()
}

// Stop 停止调度器
func (s *DistributedCronScheduler) Stop() {
	close(s.stopCh)
}
