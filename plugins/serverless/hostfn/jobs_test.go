// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// Phase 10: US7 Job Queue 测试

func TestJobService(t *testing.T) {
	t.Run("入队任务", func(t *testing.T) {
		js := NewJobService(nil)

		payload := map[string]interface{}{
			"userId": "123",
			"email":  "user@example.com",
		}

		jobID, err := js.Enqueue("send_welcome_email", payload)
		if err != nil {
			t.Fatalf("Enqueue() error = %v", err)
		}

		if jobID == "" {
			t.Error("Enqueue() 应该返回非空 jobID")
		}
	})

	t.Run("获取任务状态", func(t *testing.T) {
		js := NewJobService(nil)

		jobID, _ := js.Enqueue("test_job", map[string]interface{}{"data": "test"})

		status, err := js.GetStatus(jobID)
		if err != nil {
			t.Fatalf("GetStatus() error = %v", err)
		}

		if status != JobStatusPending && status != JobStatusQueued {
			t.Errorf("GetStatus() = %s, want pending or queued", status)
		}
	})

	t.Run("延迟任务", func(t *testing.T) {
		js := NewJobService(nil)

		opts := EnqueueOptions{
			Delay: 60, // 60 秒后执行
		}

		jobID, err := js.EnqueueWithOptions("delayed_job", map[string]interface{}{}, opts)
		if err != nil {
			t.Fatalf("EnqueueWithOptions() error = %v", err)
		}

		if jobID == "" {
			t.Error("EnqueueWithOptions() 应该返回非空 jobID")
		}
	})

	t.Run("优先级任务", func(t *testing.T) {
		js := NewJobService(nil)

		opts := EnqueueOptions{
			Priority: JobPriorityHigh,
		}

		jobID, err := js.EnqueueWithOptions("priority_job", map[string]interface{}{}, opts)
		if err != nil {
			t.Fatalf("EnqueueWithOptions() error = %v", err)
		}

		if jobID == "" {
			t.Error("EnqueueWithOptions() 应该返回非空 jobID")
		}
	})

	t.Run("取消任务", func(t *testing.T) {
		js := NewJobService(nil)

		jobID, _ := js.Enqueue("cancel_job", map[string]interface{}{})

		err := js.Cancel(jobID)
		if err != nil {
			t.Fatalf("Cancel() error = %v", err)
		}

		status, _ := js.GetStatus(jobID)
		if status != JobStatusCancelled {
			t.Errorf("GetStatus() = %s, want cancelled", status)
		}
	})
}

func TestJobServiceHostFunction(t *testing.T) {
	t.Run("Host Function 调用", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		jobID, err := hf.JobEnqueue("test_topic", map[string]interface{}{"key": "value"})
		if err != nil {
			t.Fatalf("JobEnqueue() error = %v", err)
		}

		if jobID == "" {
			t.Error("JobEnqueue() 应该返回非空 jobID")
		}
	})
}

func TestJobStatus(t *testing.T) {
	t.Run("状态常量", func(t *testing.T) {
		if JobStatusPending != "pending" {
			t.Errorf("JobStatusPending = %s, want pending", JobStatusPending)
		}
		if JobStatusQueued != "queued" {
			t.Errorf("JobStatusQueued = %s, want queued", JobStatusQueued)
		}
		if JobStatusRunning != "running" {
			t.Errorf("JobStatusRunning = %s, want running", JobStatusRunning)
		}
		if JobStatusCompleted != "completed" {
			t.Errorf("JobStatusCompleted = %s, want completed", JobStatusCompleted)
		}
		if JobStatusFailed != "failed" {
			t.Errorf("JobStatusFailed = %s, want failed", JobStatusFailed)
		}
		if JobStatusCancelled != "cancelled" {
			t.Errorf("JobStatusCancelled = %s, want cancelled", JobStatusCancelled)
		}
	})
}

func TestJobPriority(t *testing.T) {
	t.Run("优先级常量", func(t *testing.T) {
		if JobPriorityLow != 1 {
			t.Errorf("JobPriorityLow = %d, want 1", JobPriorityLow)
		}
		if JobPriorityNormal != 5 {
			t.Errorf("JobPriorityNormal = %d, want 5", JobPriorityNormal)
		}
		if JobPriorityHigh != 10 {
			t.Errorf("JobPriorityHigh = %d, want 10", JobPriorityHigh)
		}
	})
}

// 新增测试用例覆盖桥接功能

func TestJobService_Get(t *testing.T) {
	js := NewJobService(nil)

	// 创建任务
	jobID, err := js.Enqueue("test_topic", map[string]interface{}{"key": "value"})
	if err != nil {
		t.Fatalf("Enqueue() error = %v", err)
	}

	// 获取任务
	job, err := js.Get(jobID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if job.ID != jobID {
		t.Errorf("Get().ID = %s, want %s", job.ID, jobID)
	}
	if job.Topic != "test_topic" {
		t.Errorf("Get().Topic = %s, want test_topic", job.Topic)
	}

	// 获取不存在的任务
	_, err = js.Get("nonexistent")
	if err == nil {
		t.Error("Get() should return error for nonexistent job")
	}
}

func TestJobService_Delete(t *testing.T) {
	js := NewJobService(nil)

	// 创建任务
	jobID, _ := js.Enqueue("delete_test", map[string]interface{}{})

	// 删除任务
	err := js.Delete(jobID)
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	// 验证任务已删除
	_, err = js.Get(jobID)
	if err == nil {
		t.Error("Get() should return error after Delete")
	}
}

func TestJobService_Requeue(t *testing.T) {
	js := NewJobService(nil)

	// 创建任务
	jobID, _ := js.Enqueue("requeue_test", map[string]interface{}{})

	// 模拟失败
	js.mutex.Lock()
	if entry, exists := js.fallback[jobID]; exists {
		entry.Status = JobStatusFailed
	}
	js.mutex.Unlock()

	// 重新入队
	job, err := js.Requeue(jobID)
	if err != nil {
		t.Fatalf("Requeue() error = %v", err)
	}

	if job.Status != JobStatusPending {
		t.Errorf("Requeue().Status = %s, want pending", job.Status)
	}
}

func TestJobService_List(t *testing.T) {
	js := NewJobService(nil)

	// 创建多个任务
	js.Enqueue("topic_a", map[string]interface{}{})
	js.Enqueue("topic_a", map[string]interface{}{})
	js.Enqueue("topic_b", map[string]interface{}{})

	// 列出所有任务
	result, err := js.List(nil)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if result.Total != 3 {
		t.Errorf("List().Total = %d, want 3", result.Total)
	}

	// 按 topic 过滤
	result, err = js.List(&core.JobFilter{Topic: "topic_a"})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if result.Total != 2 {
		t.Errorf("List().Total = %d, want 2", result.Total)
	}
}

func TestJobService_Stats(t *testing.T) {
	js := NewJobService(nil)

	// 创建多个任务
	js.Enqueue("stats_test", map[string]interface{}{})
	js.Enqueue("stats_test", map[string]interface{}{})

	// 获取统计
	stats, err := js.Stats()
	if err != nil {
		t.Fatalf("Stats() error = %v", err)
	}

	if stats.Total != 2 {
		t.Errorf("Stats().Total = %d, want 2", stats.Total)
	}
	if stats.Pending != 2 {
		t.Errorf("Stats().Pending = %d, want 2", stats.Pending)
	}
}

func TestJobServiceHostFunction_Extended(t *testing.T) {
	hf := NewHostFunctions(nil)

	t.Run("JobEnqueueWithOptions", func(t *testing.T) {
		opts := EnqueueOptions{
			Priority:   JobPriorityHigh,
			MaxRetries: 5,
		}
		jobID, err := hf.JobEnqueueWithOptions("test_topic", map[string]interface{}{}, opts)
		if err != nil {
			t.Fatalf("JobEnqueueWithOptions() error = %v", err)
		}
		if jobID == "" {
			t.Error("JobEnqueueWithOptions() should return non-empty jobID")
		}
	})

	t.Run("JobGet", func(t *testing.T) {
		jobID, _ := hf.JobEnqueue("get_test", map[string]interface{}{})
		job, err := hf.JobGet(jobID)
		if err != nil {
			t.Fatalf("JobGet() error = %v", err)
		}
		if job.Topic != "get_test" {
			t.Errorf("JobGet().Topic = %s, want get_test", job.Topic)
		}
	})

	t.Run("JobGetStatus", func(t *testing.T) {
		jobID, _ := hf.JobEnqueue("status_test", map[string]interface{}{})
		status, err := hf.JobGetStatus(jobID)
		if err != nil {
			t.Fatalf("JobGetStatus() error = %v", err)
		}
		if status != JobStatusPending {
			t.Errorf("JobGetStatus() = %s, want pending", status)
		}
	})

	t.Run("JobCancel", func(t *testing.T) {
		jobID, _ := hf.JobEnqueue("cancel_test", map[string]interface{}{})
		err := hf.JobCancel(jobID)
		if err != nil {
			t.Fatalf("JobCancel() error = %v", err)
		}
	})

	t.Run("JobDelete", func(t *testing.T) {
		jobID, _ := hf.JobEnqueue("delete_test", map[string]interface{}{})
		err := hf.JobDelete(jobID)
		if err != nil {
			t.Fatalf("JobDelete() error = %v", err)
		}
	})

	t.Run("JobList", func(t *testing.T) {
		hf.JobEnqueue("list_test", map[string]interface{}{})
		result, err := hf.JobList(nil)
		if err != nil {
			t.Fatalf("JobList() error = %v", err)
		}
		if result.Total == 0 {
			t.Error("JobList().Total should be > 0")
		}
	})

	t.Run("JobStats", func(t *testing.T) {
		stats, err := hf.JobStats()
		if err != nil {
			t.Fatalf("JobStats() error = %v", err)
		}
		if stats.Total == 0 {
			t.Error("JobStats().Total should be > 0")
		}
	})
}
