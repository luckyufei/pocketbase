package core_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// ==================== Phase 1: 基础接口测试 ====================

func TestJobStoreInterface(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 验证 Jobs() 方法存在且返回非 nil
	jobs := app.Jobs()
	if jobs == nil {
		t.Fatal("expected Jobs() to return non-nil JobStore")
	}
}

// ==================== Phase 3: US1 任务入队测试 ====================

func TestJobEnqueue(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 测试基本入队
	payload := map[string]any{"user_id": "123", "action": "send_email"}
	job, err := jobs.Enqueue("mail_digest", payload)
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	// 验证返回的 Job 对象
	if job.ID == "" {
		t.Error("expected non-empty job ID")
	}
	if job.Topic != "mail_digest" {
		t.Errorf("expected topic 'mail_digest', got '%s'", job.Topic)
	}
	if job.Status != core.JobStatusPending {
		t.Errorf("expected status 'pending', got '%s'", job.Status)
	}
	if job.Retries != 0 {
		t.Errorf("expected retries 0, got %d", job.Retries)
	}
	if job.MaxRetries != core.JobDefaultMaxRetries {
		t.Errorf("expected max_retries %d, got %d", core.JobDefaultMaxRetries, job.MaxRetries)
	}
}

func TestJobEnqueueAt(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 测试延时入队
	payload := map[string]any{"task": "delayed_task"}
	runAt := time.Now().Add(1 * time.Hour)
	job, err := jobs.EnqueueAt("delayed_topic", payload, runAt)
	if err != nil {
		t.Fatalf("EnqueueAt failed: %v", err)
	}

	// 验证 run_at 时间
	jobRunAt := job.RunAt.Time()
	if jobRunAt.Before(runAt.Add(-time.Second)) || jobRunAt.After(runAt.Add(time.Second)) {
		t.Errorf("expected run_at around %v, got %v", runAt, job.RunAt)
	}
}

func TestJobEnqueueWithOptions(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 测试带选项的入队
	payload := map[string]any{"task": "custom_retries"}
	opts := &core.JobEnqueueOptions{
		MaxRetries: 5,
	}
	job, err := jobs.EnqueueWithOptions("custom_topic", payload, opts)
	if err != nil {
		t.Fatalf("EnqueueWithOptions failed: %v", err)
	}

	if job.MaxRetries != 5 {
		t.Errorf("expected max_retries 5, got %d", job.MaxRetries)
	}
}

func TestJobEnqueuePayloadTooLarge(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 创建超过 1MB 的 payload
	largeData := make([]byte, core.JobMaxPayloadSize+1)
	for i := range largeData {
		largeData[i] = 'x'
	}
	payload := map[string]any{"data": string(largeData)}

	_, err = jobs.Enqueue("large_payload", payload)
	if err != core.ErrJobPayloadTooLarge {
		t.Errorf("expected ErrJobPayloadTooLarge, got %v", err)
	}
}

func TestJobEnqueueEmptyTopic(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 测试空 topic
	_, err = jobs.Enqueue("", map[string]any{})
	if err != core.ErrJobTopicEmpty {
		t.Errorf("expected ErrJobTopicEmpty, got %v", err)
	}
}

// ==================== Phase 4: US2 任务查询测试 ====================

func TestJobGet(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 先入队一个任务
	payload := map[string]any{"key": "value"}
	enqueued, _ := jobs.Enqueue("test_topic", payload)

	// 查询任务
	job, err := jobs.Get(enqueued.ID)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	if job.ID != enqueued.ID {
		t.Errorf("expected ID '%s', got '%s'", enqueued.ID, job.ID)
	}
	if job.Topic != "test_topic" {
		t.Errorf("expected topic 'test_topic', got '%s'", job.Topic)
	}
}

func TestJobGetNotFound(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 查询不存在的任务
	_, err = jobs.Get("nonexistent-id")
	if err != core.ErrJobNotFound {
		t.Errorf("expected ErrJobNotFound, got %v", err)
	}
}

func TestJobList(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队多个任务
	jobs.Enqueue("topic_a", map[string]any{"n": 1})
	jobs.Enqueue("topic_a", map[string]any{"n": 2})
	jobs.Enqueue("topic_b", map[string]any{"n": 3})

	// 列表查询（无筛选）
	filter := &core.JobFilter{Limit: 10}
	result, err := jobs.List(filter)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	if len(result.Items) < 3 {
		t.Errorf("expected at least 3 jobs, got %d", len(result.Items))
	}
}

func TestJobListByTopic(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队多个任务
	jobs.Enqueue("filter_topic_a", map[string]any{"n": 1})
	jobs.Enqueue("filter_topic_a", map[string]any{"n": 2})
	jobs.Enqueue("filter_topic_b", map[string]any{"n": 3})

	// 按 topic 筛选
	filter := &core.JobFilter{Topic: "filter_topic_a", Limit: 10}
	result, err := jobs.List(filter)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	if len(result.Items) != 2 {
		t.Errorf("expected 2 jobs with topic 'filter_topic_a', got %d", len(result.Items))
	}
}

func TestJobListByStatus(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队任务
	jobs.Enqueue("status_topic", map[string]any{"n": 1})

	// 按 status 筛选
	filter := &core.JobFilter{Status: core.JobStatusPending, Limit: 10}
	result, err := jobs.List(filter)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	for _, job := range result.Items {
		if job.Status != core.JobStatusPending {
			t.Errorf("expected status 'pending', got '%s'", job.Status)
		}
	}
}

// ==================== Phase 5: US3 任务删除和重新入队测试 ====================

func TestJobDelete(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队任务
	job, _ := jobs.Enqueue("delete_topic", map[string]any{})

	// 删除任务
	err = jobs.Delete(job.ID)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// 验证已删除
	_, err = jobs.Get(job.ID)
	if err != core.ErrJobNotFound {
		t.Errorf("expected ErrJobNotFound after delete, got %v", err)
	}
}

func TestJobRequeue(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队任务并手动设置为 failed 状态（通过直接更新数据库）
	job, _ := jobs.Enqueue("requeue_topic", map[string]any{})

	// 使用内部方法将状态设置为 failed
	_, err = app.DB().NewQuery(`
		UPDATE _jobs SET status = 'failed', last_error = 'test error' WHERE id = {:id}
	`).Bind(map[string]any{"id": job.ID}).Execute()
	if err != nil {
		t.Fatalf("failed to set job status to failed: %v", err)
	}

	// 重新入队
	requeuedJob, err := jobs.Requeue(job.ID)
	if err != nil {
		t.Fatalf("Requeue failed: %v", err)
	}

	if requeuedJob.Status != core.JobStatusPending {
		t.Errorf("expected status 'pending' after requeue, got '%s'", requeuedJob.Status)
	}
	if requeuedJob.Retries != 0 {
		t.Errorf("expected retries 0 after requeue, got %d", requeuedJob.Retries)
	}
	if requeuedJob.LastError != "" {
		t.Errorf("expected empty last_error after requeue, got '%s'", requeuedJob.LastError)
	}
}

// ==================== Phase 6: US4 统计测试 ====================

func TestJobStats(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队一些任务
	jobs.Enqueue("stats_topic", map[string]any{})
	jobs.Enqueue("stats_topic", map[string]any{})

	// 获取统计
	stats, err := jobs.Stats()
	if err != nil {
		t.Fatalf("Stats failed: %v", err)
	}

	if stats.Pending < 2 {
		t.Errorf("expected at least 2 pending jobs, got %d", stats.Pending)
	}
}

// ==================== Phase 7: Job 结构体方法测试 ====================

func TestJobUnmarshalPayload(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队带 payload 的任务
	payload := map[string]any{
		"user_id": "123",
		"email":   "test@example.com",
		"count":   42.0, // JSON 数字默认解析为 float64
	}
	enqueued, _ := jobs.Enqueue("unmarshal_topic", payload)

	// 查询任务
	job, _ := jobs.Get(enqueued.ID)

	// 解析 payload
	var result struct {
		UserID string  `json:"user_id"`
		Email  string  `json:"email"`
		Count  float64 `json:"count"`
	}
	err = job.UnmarshalPayload(&result)
	if err != nil {
		t.Fatalf("UnmarshalPayload failed: %v", err)
	}

	if result.UserID != "123" {
		t.Errorf("expected user_id '123', got '%s'", result.UserID)
	}
	if result.Email != "test@example.com" {
		t.Errorf("expected email 'test@example.com', got '%s'", result.Email)
	}
	if result.Count != 42.0 {
		t.Errorf("expected count 42, got %f", result.Count)
	}
}

// ==================== Phase 8: Worker 注册和执行测试 ====================

func TestJobRegisterAndExecute(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 用于验证任务执行的通道
	executed := make(chan string, 1)

	// 注册 Worker
	err = jobs.Register("execute_topic", func(job *core.Job) error {
		var payload struct {
			Message string `json:"message"`
		}
		job.UnmarshalPayload(&payload)
		executed <- payload.Message
		return nil
	})
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	// 启动 Dispatcher
	err = jobs.Start()
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	defer jobs.Stop()

	// 入队任务
	jobs.Enqueue("execute_topic", map[string]any{"message": "hello"})

	// 等待执行
	select {
	case msg := <-executed:
		if msg != "hello" {
			t.Errorf("expected message 'hello', got '%s'", msg)
		}
	case <-time.After(5 * time.Second):
		t.Error("timeout waiting for job execution")
	}
}

func TestJobRegisterDuplicateTopic(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 注册第一个 Worker
	jobs.Register("dup_topic", func(job *core.Job) error { return nil })

	// 注册第二个相同 topic 的 Worker（应该失败）
	err = jobs.Register("dup_topic", func(job *core.Job) error { return nil })
	if err != core.ErrJobTopicAlreadyRegistered {
		t.Errorf("expected ErrJobTopicAlreadyRegistered, got %v", err)
	}
}

// ==================== Phase 9: 失败重试测试 ====================

func TestJobRetryOnFailure(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 用于追踪执行
	executed := make(chan bool, 1)

	// 注册一个会失败的 Worker
	jobs.Register("retry_topic", func(job *core.Job) error {
		executed <- true
		return json.Unmarshal([]byte("invalid"), nil) // 故意返回错误
	})

	// 启动 Dispatcher
	jobs.Start()
	defer jobs.Stop()

	// 入队任务
	opts := &core.JobEnqueueOptions{MaxRetries: 3}
	job, _ := jobs.EnqueueWithOptions("retry_topic", map[string]any{}, opts)

	// 等待第一次执行
	select {
	case <-executed:
		// 任务已执行
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for job execution")
	}

	// 等待一小段时间让状态更新
	time.Sleep(100 * time.Millisecond)

	// 验证任务状态：应该是 pending（等待重试）且 retries = 1
	updatedJob, err := jobs.Get(job.ID)
	if err != nil {
		t.Fatalf("failed to get job: %v", err)
	}

	if updatedJob.Status != core.JobStatusPending {
		t.Errorf("expected status 'pending' after failure, got '%s'", updatedJob.Status)
	}
	if updatedJob.Retries != 1 {
		t.Errorf("expected retries 1 after first failure, got %d", updatedJob.Retries)
	}
	if updatedJob.LastError == "" {
		t.Error("expected last_error to be set after failure")
	}
}

// ==================== Phase 10: 崩溃恢复测试 ====================

func TestJobCrashRecovery(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 用于验证任务被恢复执行
	recovered := make(chan bool, 1)

	// 先注册 Worker（这样 Dispatcher 才会获取这个 topic 的任务）
	jobs.Register("crash_topic", func(job *core.Job) error {
		recovered <- true
		return nil
	})

	// 入队任务
	job, _ := jobs.Enqueue("crash_topic", map[string]any{})

	// 模拟 Worker 崩溃：将任务设置为 processing 状态，但 locked_until 已过期
	// 使用与 dispatcher 相同的时间格式
	pastTime := time.Now().Add(-10 * time.Minute).UTC().Format(time.RFC3339)
	_, err = app.DB().NewQuery(`
		UPDATE _jobs SET status = 'processing', locked_until = {:locked_until} WHERE id = {:id}
	`).Bind(map[string]any{
		"id":           job.ID,
		"locked_until": pastTime,
	}).Execute()
	if err != nil {
		t.Fatalf("failed to simulate crash: %v", err)
	}

	// 验证更新成功
	var status, lockedUntil string
	app.DB().NewQuery(`SELECT status, locked_until FROM _jobs WHERE id = {:id}`).
		Bind(map[string]any{"id": job.ID}).Row(&status, &lockedUntil)
	if status != "processing" {
		t.Fatalf("expected status 'processing', got '%s'", status)
	}

	// 启动 Dispatcher
	jobs.Start()
	defer jobs.Stop()

	// 等待恢复执行
	select {
	case <-recovered:
		// 成功恢复
	case <-time.After(5 * time.Second):
		// 获取当前任务状态用于调试
		var debugStatus, debugLocked string
		app.DB().NewQuery(`SELECT status, locked_until FROM _jobs WHERE id = {:id}`).
			Bind(map[string]any{"id": job.ID}).Row(&debugStatus, &debugLocked)
		t.Errorf("timeout waiting for crash recovery. Job status: %s, locked_until: %s, pastTime: %s", 
			debugStatus, debugLocked, pastTime)
	}
}

// ==================== Phase 11: 延时任务测试 ====================

func TestJobDelayedExecution(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 用于验证执行时间
	executedAt := make(chan time.Time, 1)

	// 注册 Worker
	jobs.Register("delayed_exec_topic", func(job *core.Job) error {
		executedAt <- time.Now()
		return nil
	})

	// 启动 Dispatcher
	jobs.Start()
	defer jobs.Stop()

	// 入队延时任务（2 秒后执行）
	runAt := time.Now().Add(2 * time.Second)
	jobs.EnqueueAt("delayed_exec_topic", map[string]any{}, runAt)

	// 等待执行
	select {
	case execTime := <-executedAt:
		// 验证执行时间在 runAt 之后
		if execTime.Before(runAt.Add(-500 * time.Millisecond)) {
			t.Errorf("job executed too early: expected after %v, got %v", runAt, execTime)
		}
	case <-time.After(10 * time.Second):
		t.Error("timeout waiting for delayed job execution")
	}
}

// ==================== Phase 12: 并发安全测试 ====================

func TestJobConcurrentEnqueue(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 并发入队 100 个任务
	const concurrency = 100
	done := make(chan bool, concurrency)
	errors := make(chan error, concurrency)

	for i := 0; i < concurrency; i++ {
		go func(n int) {
			_, err := jobs.Enqueue("concurrent_topic", map[string]any{"n": n})
			if err != nil {
				errors <- err
			}
			done <- true
		}(i)
	}

	// 等待所有完成
	for i := 0; i < concurrency; i++ {
		<-done
	}

	// 检查错误
	close(errors)
	for err := range errors {
		t.Errorf("concurrent enqueue error: %v", err)
	}

	// 验证入队数量
	filter := &core.JobFilter{Topic: "concurrent_topic", Limit: 200}
	result, _ := jobs.List(filter)
	if len(result.Items) != concurrency {
		t.Errorf("expected %d jobs, got %d", concurrency, len(result.Items))
	}
}

// ==================== Phase 13: 事务入队测试 ====================

func TestJobEnqueueTx(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 在事务中入队任务
	err = app.RunInTransaction(func(txApp core.App) error {
		txJobs := txApp.Jobs()
		_, err := txJobs.Enqueue("tx_topic", map[string]any{"tx": true})
		if err != nil {
			return err
		}
		// 事务成功提交
		return nil
	})
	if err != nil {
		t.Fatalf("transaction failed: %v", err)
	}

	// 验证任务已入队
	filter := &core.JobFilter{Topic: "tx_topic", Limit: 10}
	result, _ := jobs.List(filter)
	if len(result.Items) != 1 {
		t.Errorf("expected 1 job in tx_topic, got %d", len(result.Items))
	}
}

func TestJobEnqueueTxRollback(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 在事务中入队任务，但回滚
	err = app.RunInTransaction(func(txApp core.App) error {
		txJobs := txApp.Jobs()
		_, err := txJobs.Enqueue("tx_rollback_topic", map[string]any{"tx": true})
		if err != nil {
			return err
		}
		// 返回错误触发回滚
		return json.Unmarshal([]byte("invalid"), nil)
	})
	// 事务应该失败
	if err == nil {
		t.Fatal("expected transaction to fail")
	}

	// 验证任务未入队（已回滚）
	filter := &core.JobFilter{Topic: "tx_rollback_topic", Limit: 10}
	result, _ := jobs.List(filter)
	if len(result.Items) != 0 {
		t.Errorf("expected 0 jobs after rollback, got %d", len(result.Items))
	}
}

// ==================== 额外覆盖率测试 ====================

func TestJobDeleteNotFound(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 删除不存在的任务
	err = jobs.Delete("nonexistent-id")
	if err != core.ErrJobNotFound {
		t.Errorf("expected ErrJobNotFound, got %v", err)
	}
}

func TestJobDeleteProcessingFails(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队任务
	job, _ := jobs.Enqueue("delete_processing_topic", map[string]any{})

	// 将状态设置为 processing（不允许删除）
	_, err = app.DB().NewQuery(`
		UPDATE _jobs SET status = 'processing' WHERE id = {:id}
	`).Bind(map[string]any{"id": job.ID}).Execute()
	if err != nil {
		t.Fatalf("failed to update job status: %v", err)
	}

	// 尝试删除（应该失败）
	err = jobs.Delete(job.ID)
	if err != core.ErrJobCannotDelete {
		t.Errorf("expected ErrJobCannotDelete, got %v", err)
	}
}

func TestJobRequeueNotFound(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 重新入队不存在的任务
	_, err = jobs.Requeue("nonexistent-id")
	if err != core.ErrJobNotFound {
		t.Errorf("expected ErrJobNotFound, got %v", err)
	}
}

func TestJobRequeuePendingFails(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队任务（状态为 pending）
	job, _ := jobs.Enqueue("requeue_pending_topic", map[string]any{})

	// 尝试重新入队（应该失败，因为不是 failed 状态）
	_, err = jobs.Requeue(job.ID)
	if err != core.ErrJobCannotRequeue {
		t.Errorf("expected ErrJobCannotRequeue, got %v", err)
	}
}

func TestJobUnmarshalPayloadFromString(t *testing.T) {
	t.Parallel()

	// 测试从字符串类型的 Payload 解析
	job := &core.Job{
		Payload: `{"user_id":"456","email":"str@example.com"}`,
	}

	var result struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
	}
	err := job.UnmarshalPayload(&result)
	if err != nil {
		t.Fatalf("UnmarshalPayload from string failed: %v", err)
	}

	if result.UserID != "456" {
		t.Errorf("expected user_id '456', got '%s'", result.UserID)
	}
	if result.Email != "str@example.com" {
		t.Errorf("expected email 'str@example.com', got '%s'", result.Email)
	}
}

func TestJobUnmarshalPayloadFromMap(t *testing.T) {
	t.Parallel()

	// 测试从 map 类型的 Payload 解析
	job := &core.Job{
		Payload: map[string]any{"user_id": "789", "count": 10.0},
	}

	var result struct {
		UserID string  `json:"user_id"`
		Count  float64 `json:"count"`
	}
	err := job.UnmarshalPayload(&result)
	if err != nil {
		t.Fatalf("UnmarshalPayload from map failed: %v", err)
	}

	if result.UserID != "789" {
		t.Errorf("expected user_id '789', got '%s'", result.UserID)
	}
	if result.Count != 10.0 {
		t.Errorf("expected count 10, got %f", result.Count)
	}
}

func TestJobDeadLetterAfterMaxRetries(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 用于追踪执行次数
	execCount := 0
	executed := make(chan bool, 5)

	// 注册一个总是失败的 Worker
	jobs.Register("deadletter_topic", func(job *core.Job) error {
		execCount++
		executed <- true
		return json.Unmarshal([]byte("invalid"), nil) // 故意返回错误
	})

	// 启动 Dispatcher
	jobs.Start()
	defer jobs.Stop()

	// 入队任务，最大重试 1 次（即执行 2 次后变成 failed）
	opts := &core.JobEnqueueOptions{MaxRetries: 1}
	job, _ := jobs.EnqueueWithOptions("deadletter_topic", map[string]any{}, opts)

	// 等待第一次执行
	select {
	case <-executed:
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for first execution")
	}

	// 等待状态更新
	time.Sleep(200 * time.Millisecond)

	// 验证任务状态：应该是 failed（死信）
	updatedJob, err := jobs.Get(job.ID)
	if err != nil {
		t.Fatalf("failed to get job: %v", err)
	}

	// 第一次失败后 retries=1，达到 max_retries=1，应该变成 failed
	if updatedJob.Status != core.JobStatusFailed {
		t.Errorf("expected status 'failed' after max retries, got '%s'", updatedJob.Status)
	}
	if updatedJob.LastError == "" {
		t.Error("expected last_error to be set")
	}
}

func TestJobHandlerPanicRecovery(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 用于追踪执行
	executed := make(chan bool, 1)

	// 注册一个会 panic 的 Worker
	jobs.Register("panic_topic", func(job *core.Job) error {
		executed <- true
		panic("intentional panic for testing")
	})

	// 启动 Dispatcher
	jobs.Start()
	defer jobs.Stop()

	// 入队任务
	opts := &core.JobEnqueueOptions{MaxRetries: 3}
	job, _ := jobs.EnqueueWithOptions("panic_topic", map[string]any{}, opts)

	// 等待执行
	select {
	case <-executed:
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for job execution")
	}

	// 等待状态更新
	time.Sleep(200 * time.Millisecond)

	// 验证任务状态：应该是 pending（等待重试）且 last_error 包含 panic 信息
	updatedJob, err := jobs.Get(job.ID)
	if err != nil {
		t.Fatalf("failed to get job: %v", err)
	}

	if updatedJob.Status != core.JobStatusPending {
		t.Errorf("expected status 'pending' after panic, got '%s'", updatedJob.Status)
	}
	if updatedJob.LastError == "" {
		t.Error("expected last_error to be set after panic")
	}
	if updatedJob.Retries != 1 {
		t.Errorf("expected retries 1 after panic, got %d", updatedJob.Retries)
	}
}

func TestJobStartStop(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 多次启动应该是幂等的
	err = jobs.Start()
	if err != nil {
		t.Fatalf("first Start failed: %v", err)
	}

	err = jobs.Start()
	if err != nil {
		t.Fatalf("second Start failed: %v", err)
	}

	// 多次停止也应该是幂等的
	err = jobs.Stop()
	if err != nil {
		t.Fatalf("first Stop failed: %v", err)
	}

	err = jobs.Stop()
	if err != nil {
		t.Fatalf("second Stop failed: %v", err)
	}
}

func TestJobDeleteFailedJob(t *testing.T) {
	t.Parallel()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("failed to create test app: %v", err)
	}
	defer app.Cleanup()

	jobs := app.Jobs()
	if jobs == nil {
		t.Skip("JobStore not available")
	}

	// 入队任务
	job, _ := jobs.Enqueue("delete_failed_topic", map[string]any{})

	// 将状态设置为 failed
	_, err = app.DB().NewQuery(`
		UPDATE _jobs SET status = 'failed', last_error = 'test error' WHERE id = {:id}
	`).Bind(map[string]any{"id": job.ID}).Execute()
	if err != nil {
		t.Fatalf("failed to update job status: %v", err)
	}

	// 删除 failed 状态的任务（应该成功）
	err = jobs.Delete(job.ID)
	if err != nil {
		t.Errorf("expected Delete to succeed for failed job, got %v", err)
	}

	// 验证已删除
	_, err = jobs.Get(job.ID)
	if err != core.ErrJobNotFound {
		t.Errorf("expected ErrJobNotFound after delete, got %v", err)
	}
}
