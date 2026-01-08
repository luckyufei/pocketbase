package core

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// jobDispatcher 负责任务分发和执行
type jobDispatcher struct {
	store      *jobStore
	workerPool chan struct{}
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
}

// newJobDispatcher 创建 Dispatcher 实例
func newJobDispatcher(store *jobStore) *jobDispatcher {
	return &jobDispatcher{
		store:      store,
		workerPool: make(chan struct{}, JobDefaultWorkerPoolSize),
	}
}

// Start 启动 Dispatcher
func (d *jobDispatcher) Start() {
	d.ctx, d.cancel = context.WithCancel(context.Background())
	d.wg.Add(1)
	go d.pollLoop()
}

// Stop 停止 Dispatcher
func (d *jobDispatcher) Stop() {
	if d.cancel != nil {
		d.cancel()
	}
	d.wg.Wait()
}

// pollLoop 轮询循环
func (d *jobDispatcher) pollLoop() {
	defer d.wg.Done()

	ticker := time.NewTicker(JobDefaultPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			d.fetchAndExecute()
		}
	}
}

// fetchAndExecute 获取并执行任务
func (d *jobDispatcher) fetchAndExecute() {
	// 获取已注册的 topics
	topics := d.store.getRegisteredTopics()
	if len(topics) == 0 {
		return
	}

	// 获取待执行任务
	jobs, err := d.fetchJobs(topics)
	if err != nil {
		d.store.app.Logger().Warn("failed to fetch jobs", "error", err)
		return
	}

	// 分发任务到 Worker
	for _, job := range jobs {
		d.wg.Add(1)
		go d.executeJob(job)
	}
}

// fetchJobs 从数据库获取待执行任务
func (d *jobDispatcher) fetchJobs(topics []string) ([]*Job, error) {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	lockedUntil := now.Add(JobDefaultLockDuration).Format(time.RFC3339)

	if d.store.app.IsPostgres() {
		return d.fetchJobsPostgres(topics, nowStr, lockedUntil)
	}
	return d.fetchJobsSQLite(topics, nowStr, lockedUntil)
}

// fetchJobsPostgres 使用 SKIP LOCKED 获取任务（PostgreSQL）
func (d *jobDispatcher) fetchJobsPostgres(topics []string, nowStr, lockedUntil string) ([]*Job, error) {
	// 构建 topic IN 条件
	topicPlaceholders := ""
	bindings := map[string]any{
		"now":          nowStr,
		"locked_until": lockedUntil,
		"limit":        JobDefaultBatchSize,
	}
	for i, topic := range topics {
		if i > 0 {
			topicPlaceholders += ", "
		}
		key := fmt.Sprintf("topic%d", i)
		topicPlaceholders += "{:" + key + "}"
		bindings[key] = topic
	}

	// 查询条件：
	// 1. pending 状态且 run_at <= now 且 (未锁定或锁已过期)
	// 2. processing 状态且锁已过期（崩溃恢复）
	query := fmt.Sprintf(`
		WITH next_jobs AS (
			SELECT id
			FROM _jobs
			WHERE topic IN (%s)
			  AND (
			      (status = 'pending' AND run_at <= {:now} AND (locked_until IS NULL OR locked_until < {:now}))
			      OR (status = 'processing' AND locked_until < {:now})
			  )
			ORDER BY run_at ASC
			LIMIT {:limit}
			FOR UPDATE SKIP LOCKED
		)
		UPDATE _jobs
		SET status = 'processing',
		    locked_until = {:locked_until},
		    updated = {:now}
		WHERE id IN (SELECT id FROM next_jobs)
		RETURNING id, topic, payload, retries, max_retries
	`, topicPlaceholders)

	var jobs []*Job
	err := d.store.app.DB().NewQuery(query).Bind(bindings).All(&jobs)
	if err != nil {
		return nil, err
	}

	return jobs, nil
}

// fetchJobsSQLite 使用乐观锁 + CAS 获取任务（SQLite）
func (d *jobDispatcher) fetchJobsSQLite(topics []string, nowStr, lockedUntil string) ([]*Job, error) {
	var jobs []*Job

	// SQLite 不支持 SKIP LOCKED，使用乐观锁逐个获取
	for i := 0; i < JobDefaultBatchSize; i++ {
		job, err := d.fetchOneJobSQLite(topics, nowStr, lockedUntil)
		if err != nil {
			break // 没有更多任务
		}
		if job != nil {
			jobs = append(jobs, job)
		}
	}

	return jobs, nil
}

// fetchOneJobSQLite 使用 CAS 获取单个任务
func (d *jobDispatcher) fetchOneJobSQLite(topics []string, nowStr, lockedUntil string) (*Job, error) {
	// 构建 topic IN 条件
	topicPlaceholders := ""
	bindings := map[string]any{
		"now":          nowStr,
		"locked_until": lockedUntil,
	}
	for i, topic := range topics {
		if i > 0 {
			topicPlaceholders += ", "
		}
		key := fmt.Sprintf("topic%d", i)
		topicPlaceholders += "{:" + key + "}"
		bindings[key] = topic
	}

	// 使用 CAS 更新
	// 查询条件：
	// 1. pending 状态且 run_at <= now 且 (未锁定或锁已过期)
	// 2. processing 状态且锁已过期（崩溃恢复）
	query := fmt.Sprintf(`
		UPDATE _jobs
		SET status = 'processing',
		    locked_until = {:locked_until},
		    updated = {:now}
		WHERE id = (
			SELECT id FROM _jobs
			WHERE topic IN (%s)
			  AND (
			      (status = 'pending' AND run_at <= {:now} AND (locked_until IS NULL OR locked_until < {:now}))
			      OR (status = 'processing' AND locked_until < {:now})
			  )
			ORDER BY run_at ASC
			LIMIT 1
		)
		AND (status = 'pending' OR (status = 'processing' AND locked_until < {:now}))
		RETURNING id, topic, payload, retries, max_retries
	`, topicPlaceholders)

	var job Job
	err := d.store.app.DB().NewQuery(query).Bind(bindings).One(&job)
	if err != nil {
		return nil, err
	}

	return &job, nil
}

// executeJob 执行单个任务
func (d *jobDispatcher) executeJob(job *Job) {
	defer d.wg.Done()

	// 获取 Worker 槽位
	select {
	case d.workerPool <- struct{}{}:
		defer func() { <-d.workerPool }()
	case <-d.ctx.Done():
		return
	}

	// 获取处理函数
	handler, ok := d.store.getHandler(job.Topic)
	if !ok {
		d.store.app.Logger().Warn("no handler for topic", "topic", job.Topic)
		return
	}

	// 执行任务
	err := d.safeExecute(handler, job)

	// 更新任务状态
	if err != nil {
		d.handleFailure(job, err)
	} else {
		d.handleSuccess(job)
	}
}

// safeExecute 安全执行任务（捕获 panic）
func (d *jobDispatcher) safeExecute(handler JobHandler, job *Job) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v", r)
		}
	}()
	return handler(job)
}

// handleSuccess 处理任务成功
func (d *jobDispatcher) handleSuccess(job *Job) {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `
		UPDATE _jobs
		SET status = 'completed',
		    locked_until = NULL,
		    updated = {:now}
		WHERE id = {:id}
	`
	_, err := d.store.app.DB().NewQuery(query).Bind(map[string]any{
		"id":  job.ID,
		"now": now,
	}).Execute()
	if err != nil {
		d.store.app.Logger().Warn("failed to mark job as completed", "id", job.ID, "error", err)
	}
}

// handleFailure 处理任务失败
func (d *jobDispatcher) handleFailure(job *Job, jobErr error) {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	errorMsg := jobErr.Error()

	// 检查是否还有重试次数
	if job.Retries+1 < job.MaxRetries {
		// 计算下次重试时间（指数退避）
		retryCount := job.Retries + 1
		backoff := time.Duration(retryCount*retryCount) * time.Minute
		nextRunAt := now.Add(backoff).Format(time.RFC3339)

		query := `
			UPDATE _jobs
			SET status = 'pending',
			    retries = retries + 1,
			    run_at = {:next_run_at},
			    locked_until = NULL,
			    last_error = {:error},
			    updated = {:now}
			WHERE id = {:id}
		`
		_, err := d.store.app.DB().NewQuery(query).Bind(map[string]any{
			"id":          job.ID,
			"next_run_at": nextRunAt,
			"error":       errorMsg,
			"now":         nowStr,
		}).Execute()
		if err != nil {
			d.store.app.Logger().Warn("failed to schedule retry", "id", job.ID, "error", err)
		}
	} else {
		// 标记为失败（死信）
		query := `
			UPDATE _jobs
			SET status = 'failed',
			    locked_until = NULL,
			    last_error = {:error},
			    updated = {:now}
			WHERE id = {:id}
		`
		_, err := d.store.app.DB().NewQuery(query).Bind(map[string]any{
			"id":    job.ID,
			"error": errorMsg,
			"now":   nowStr,
		}).Execute()
		if err != nil {
			d.store.app.Logger().Warn("failed to mark job as failed", "id", job.ID, "error", err)
		}
	}
}
