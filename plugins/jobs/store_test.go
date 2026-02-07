package jobs_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/jobs"
	"github.com/pocketbase/pocketbase/tests"
)

// ==================== Phase 1: 基础接口测试 ====================

func TestJobStoreInterface(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 注册 jobs 插件
		err := jobs.Register(app, jobs.DefaultConfig())
		if err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		// 验证 GetJobStore() 返回非 nil
		store := jobs.GetJobStore(app)
		if store == nil {
			t.Fatal("expected GetJobStore() to return non-nil Store")
		}
	})
}

// ==================== Phase 3: US1 任务入队测试 ====================

func TestJobEnqueue(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 测试基本入队
		payload := map[string]any{"user_id": "123", "action": "send_email"}
		job, err := store.Enqueue("mail_digest", payload)
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
		if job.Status != jobs.JobStatusPending {
			t.Errorf("expected status 'pending', got '%s'", job.Status)
		}
		if job.Retries != 0 {
			t.Errorf("expected retries 0, got %d", job.Retries)
		}
		if job.MaxRetries != jobs.JobDefaultMaxRetries {
			t.Errorf("expected max_retries %d, got %d", jobs.JobDefaultMaxRetries, job.MaxRetries)
		}
	})
}

func TestJobEnqueueAt(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 测试延时入队
		payload := map[string]any{"task": "delayed_task"}
		runAt := time.Now().Add(1 * time.Hour)
		job, err := store.EnqueueAt("delayed_topic", payload, runAt)
		if err != nil {
			t.Fatalf("EnqueueAt failed: %v", err)
		}

		// 验证 run_at 时间
		jobRunAt := job.RunAt.Time()
		if jobRunAt.Before(runAt.Add(-time.Second)) || jobRunAt.After(runAt.Add(time.Second)) {
			t.Errorf("expected run_at around %v, got %v", runAt, job.RunAt)
		}
	})
}

func TestJobEnqueueWithOptions(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 测试带选项的入队
		payload := map[string]any{"task": "custom_retries"}
		opts := &jobs.JobEnqueueOptions{
			MaxRetries: 5,
		}
		job, err := store.EnqueueWithOptions("custom_topic", payload, opts)
		if err != nil {
			t.Fatalf("EnqueueWithOptions failed: %v", err)
		}

		if job.MaxRetries != 5 {
			t.Errorf("expected max_retries 5, got %d", job.MaxRetries)
		}
	})
}

func TestJobEnqueuePayloadTooLarge(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 创建超过 1MB 的 payload
		largeData := make([]byte, jobs.JobMaxPayloadSize+1)
		for i := range largeData {
			largeData[i] = 'x'
		}
		payload := map[string]any{"data": string(largeData)}

		_, err := store.Enqueue("large_payload", payload)
		if err != jobs.ErrJobPayloadTooLarge {
			t.Errorf("expected ErrJobPayloadTooLarge, got %v", err)
		}
	})
}

func TestJobEnqueueEmptyTopic(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 测试空 topic
		_, err := store.Enqueue("", map[string]any{})
		if err != jobs.ErrJobTopicEmpty {
			t.Errorf("expected ErrJobTopicEmpty, got %v", err)
		}
	})
}

// ==================== Phase 4: US2 任务查询测试 ====================

func TestJobGet(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 先入队一个任务
		payload := map[string]any{"key": "value"}
		enqueued, _ := store.Enqueue("test_topic", payload)

		// 查询任务
		job, err := store.Get(enqueued.ID)
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}

		if job.ID != enqueued.ID {
			t.Errorf("expected ID '%s', got '%s'", enqueued.ID, job.ID)
		}
		if job.Topic != "test_topic" {
			t.Errorf("expected topic 'test_topic', got '%s'", job.Topic)
		}
	})
}

func TestJobGetNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 查询不存在的任务
		_, err := store.Get("nonexistent-id")
		if err != jobs.ErrJobNotFound {
			t.Errorf("expected ErrJobNotFound, got %v", err)
		}
	})
}

func TestJobList(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队多个任务
		store.Enqueue("topic_a", map[string]any{"n": 1})
		store.Enqueue("topic_a", map[string]any{"n": 2})
		store.Enqueue("topic_b", map[string]any{"n": 3})

		// 列表查询（无筛选）
		filter := &jobs.JobFilter{Limit: 10}
		result, err := store.List(filter)
		if err != nil {
			t.Fatalf("List failed: %v", err)
		}

		if len(result.Items) < 3 {
			t.Errorf("expected at least 3 jobs, got %d", len(result.Items))
		}
	})
}

func TestJobListByTopic(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队多个任务
		store.Enqueue("filter_topic_a", map[string]any{"n": 1})
		store.Enqueue("filter_topic_a", map[string]any{"n": 2})
		store.Enqueue("filter_topic_b", map[string]any{"n": 3})

		// 按 topic 筛选
		filter := &jobs.JobFilter{Topic: "filter_topic_a", Limit: 10}
		result, err := store.List(filter)
		if err != nil {
			t.Fatalf("List failed: %v", err)
		}

		if len(result.Items) != 2 {
			t.Errorf("expected 2 jobs with topic 'filter_topic_a', got %d", len(result.Items))
		}
	})
}

func TestJobListByStatus(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队任务
		store.Enqueue("status_topic", map[string]any{"n": 1})

		// 按 status 筛选
		filter := &jobs.JobFilter{Status: jobs.JobStatusPending, Limit: 10}
		result, err := store.List(filter)
		if err != nil {
			t.Fatalf("List failed: %v", err)
		}

		for _, job := range result.Items {
			if job.Status != jobs.JobStatusPending {
				t.Errorf("expected status 'pending', got '%s'", job.Status)
			}
		}
	})
}

// ==================== Phase 5: US3 任务删除和重新入队测试 ====================

func TestJobDelete(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队任务
		job, _ := store.Enqueue("delete_topic", map[string]any{})

		// 删除任务
		err := store.Delete(job.ID)
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		// 验证已删除
		_, err = store.Get(job.ID)
		if err != jobs.ErrJobNotFound {
			t.Errorf("expected ErrJobNotFound after delete, got %v", err)
		}
	})
}

func TestJobRequeue(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队任务并手动设置为 failed 状态（通过直接更新数据库）
		job, _ := store.Enqueue("requeue_topic", map[string]any{})

		// 使用内部方法将状态设置为 failed
		_, err := app.DB().NewQuery(`
			UPDATE _jobs SET status = 'failed', last_error = 'test error' WHERE id = {:id}
		`).Bind(map[string]any{"id": job.ID}).Execute()
		if err != nil {
			t.Fatalf("failed to set job status to failed: %v", err)
		}

		// 重新入队
		requeuedJob, err := store.Requeue(job.ID)
		if err != nil {
			t.Fatalf("Requeue failed: %v", err)
		}

		if requeuedJob.Status != jobs.JobStatusPending {
			t.Errorf("expected status 'pending' after requeue, got '%s'", requeuedJob.Status)
		}
		if requeuedJob.Retries != 0 {
			t.Errorf("expected retries 0 after requeue, got %d", requeuedJob.Retries)
		}
		if requeuedJob.LastError != "" {
			t.Errorf("expected empty last_error after requeue, got '%s'", requeuedJob.LastError)
		}
	})
}

// ==================== Phase 6: US4 统计测试 ====================

func TestJobStats(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队一些任务
		store.Enqueue("stats_topic", map[string]any{})
		store.Enqueue("stats_topic", map[string]any{})

		// 获取统计
		stats, err := store.Stats()
		if err != nil {
			t.Fatalf("Stats failed: %v", err)
		}

		if stats.Pending < 2 {
			t.Errorf("expected at least 2 pending jobs, got %d", stats.Pending)
		}
	})
}

// ==================== Phase 7: Job 结构体方法测试 ====================

func TestJobUnmarshalPayload(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队带 payload 的任务
		payload := map[string]any{
			"user_id": "123",
			"email":   "test@example.com",
			"count":   42.0, // JSON 数字默认解析为 float64
		}
		enqueued, _ := store.Enqueue("unmarshal_topic", payload)

		// 查询任务
		job, _ := store.Get(enqueued.ID)

		// 解析 payload
		var result struct {
			UserID string  `json:"user_id"`
			Email  string  `json:"email"`
			Count  float64 `json:"count"`
		}
		err := job.UnmarshalPayload(&result)
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
	})
}

// ==================== Phase 8: Worker 注册和执行测试 ====================

func TestJobRegisterAndExecute(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.Config{AutoStart: false})
		store := jobs.GetJobStore(app)

		// 用于验证任务执行的通道
		executed := make(chan string, 1)

		// 注册 Worker
		err := store.Register("execute_topic", func(job *jobs.Job) error {
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
		err = store.Start()
		if err != nil {
			t.Fatalf("Start failed: %v", err)
		}
		defer store.Stop()

		// 入队任务
		store.Enqueue("execute_topic", map[string]any{"message": "hello"})

		// 等待执行
		select {
		case msg := <-executed:
			if msg != "hello" {
				t.Errorf("expected message 'hello', got '%s'", msg)
			}
		case <-time.After(5 * time.Second):
			t.Error("timeout waiting for job execution")
		}
	})
}

func TestJobRegisterDuplicateTopic(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 注册第一个 Worker
		store.Register("dup_topic", func(job *jobs.Job) error { return nil })

		// 注册第二个相同 topic 的 Worker（应该失败）
		err := store.Register("dup_topic", func(job *jobs.Job) error { return nil })
		if err != jobs.ErrJobTopicAlreadyRegistered {
			t.Errorf("expected ErrJobTopicAlreadyRegistered, got %v", err)
		}
	})
}

// ==================== Phase 9: 失败重试测试 ====================

func TestJobRetryOnFailure(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.Config{AutoStart: false})
		store := jobs.GetJobStore(app)

		// 用于追踪执行
		executed := make(chan bool, 1)

		// 注册一个会失败的 Worker
		store.Register("retry_topic", func(job *jobs.Job) error {
			executed <- true
			return json.Unmarshal([]byte("invalid"), nil) // 故意返回错误
		})

		// 启动 Dispatcher
		store.Start()
		defer store.Stop()

		// 入队任务
		opts := &jobs.JobEnqueueOptions{MaxRetries: 3}
		job, _ := store.EnqueueWithOptions("retry_topic", map[string]any{}, opts)

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
		updatedJob, err := store.Get(job.ID)
		if err != nil {
			t.Fatalf("failed to get job: %v", err)
		}

		if updatedJob.Status != jobs.JobStatusPending {
			t.Errorf("expected status 'pending' after failure, got '%s'", updatedJob.Status)
		}
		if updatedJob.Retries != 1 {
			t.Errorf("expected retries 1 after first failure, got %d", updatedJob.Retries)
		}
		if updatedJob.LastError == "" {
			t.Error("expected last_error to be set after failure")
		}
	})
}

// ==================== 额外覆盖率测试 ====================

func TestJobDeleteNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 删除不存在的任务
		err := store.Delete("nonexistent-id")
		if err != jobs.ErrJobNotFound {
			t.Errorf("expected ErrJobNotFound, got %v", err)
		}
	})
}

func TestJobDeleteProcessingFails(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队任务
		job, _ := store.Enqueue("delete_processing_topic", map[string]any{})

		// 将状态设置为 processing（不允许删除）
		_, err := app.DB().NewQuery(`
			UPDATE _jobs SET status = 'processing' WHERE id = {:id}
		`).Bind(map[string]any{"id": job.ID}).Execute()
		if err != nil {
			t.Fatalf("failed to update job status: %v", err)
		}

		// 尝试删除（应该失败）
		err = store.Delete(job.ID)
		if err != jobs.ErrJobCannotDelete {
			t.Errorf("expected ErrJobCannotDelete, got %v", err)
		}
	})
}

func TestJobRequeueNotFound(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 重新入队不存在的任务
		_, err := store.Requeue("nonexistent-id")
		if err != jobs.ErrJobNotFound {
			t.Errorf("expected ErrJobNotFound, got %v", err)
		}
	})
}

func TestJobRequeuePendingFails(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队任务（状态为 pending）
		job, _ := store.Enqueue("requeue_pending_topic", map[string]any{})

		// 尝试重新入队（应该失败，因为不是 failed 状态）
		_, err := store.Requeue(job.ID)
		if err != jobs.ErrJobCannotRequeue {
			t.Errorf("expected ErrJobCannotRequeue, got %v", err)
		}
	})
}

func TestJobUnmarshalPayloadFromString(t *testing.T) {
	t.Parallel()

	// 测试从字符串类型的 Payload 解析（这个测试不需要数据库访问）
	job := &jobs.Job{
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

	// 测试从 map 类型的 Payload 解析（这个测试不需要数据库访问）
	job := &jobs.Job{
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

func TestJobStartStop(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.Config{AutoStart: false})
		store := jobs.GetJobStore(app)

		// 多次启动应该是幂等的
		err := store.Start()
		if err != nil {
			t.Fatalf("first Start failed: %v", err)
		}

		err = store.Start()
		if err != nil {
			t.Fatalf("second Start failed: %v", err)
		}

		// 多次停止也应该是幂等的
		err = store.Stop()
		if err != nil {
			t.Fatalf("first Stop failed: %v", err)
		}

		err = store.Stop()
		if err != nil {
			t.Fatalf("second Stop failed: %v", err)
		}
	})
}

func TestJobDeleteFailedJob(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		jobs.MustRegister(app, jobs.DefaultConfig())
		store := jobs.GetJobStore(app)

		// 入队任务
		job, _ := store.Enqueue("delete_failed_topic", map[string]any{})

		// 将状态设置为 failed
		_, err := app.DB().NewQuery(`
			UPDATE _jobs SET status = 'failed', last_error = 'test error' WHERE id = {:id}
		`).Bind(map[string]any{"id": job.ID}).Execute()
		if err != nil {
			t.Fatalf("failed to update job status: %v", err)
		}

		// 删除 failed 状态的任务（应该成功）
		err = store.Delete(job.ID)
		if err != nil {
			t.Errorf("expected Delete to succeed for failed job, got %v", err)
		}

		// 验证已删除
		_, err = store.Get(job.ID)
		if err != jobs.ErrJobNotFound {
			t.Errorf("expected ErrJobNotFound after delete, got %v", err)
		}
	})
}
