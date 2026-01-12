# Job Queue

## 概述

持久化任务队列，支持延时执行、自动重试、崩溃恢复。

## 接口定义

```go
type JobStore interface {
    // 入队
    Enqueue(topic string, payload any) (*Job, error)
    EnqueueAt(topic string, payload any, runAt time.Time) (*Job, error)
    EnqueueWithOptions(topic string, payload any, opts *JobEnqueueOptions) (*Job, error)
    
    // 查询
    Get(id string) (*Job, error)
    List(filter *JobFilter) (*JobListResult, error)
    Stats() (*JobStats, error)
    
    // 管理
    Delete(id string) error
    Requeue(id string) (*Job, error)
    
    // Worker
    Register(topic string, handler JobHandler) error
    Start() error
    Stop() error
}

type Job struct {
    ID          string
    Topic       string
    Payload     any
    Status      string  // pending/processing/completed/failed
    RunAt       time.Time
    Retries     int
    MaxRetries  int
    LastError   string
}

type JobHandler func(job *Job) error

// 常量
const (
    JobMaxPayloadSize       = 1 << 20  // 1MB
    JobDefaultMaxRetries    = 3
    JobDefaultLockDuration  = 5 * time.Minute
    JobDefaultWorkerPoolSize = 10
)
```

## 使用示例

```go
jobs := app.Jobs()

// 注册处理函数
jobs.Register("email:send", func(job *Job) error {
    var payload EmailPayload
    job.UnmarshalPayload(&payload)
    return sendEmail(payload)
})

// 启动 Dispatcher
jobs.Start()
defer jobs.Stop()

// 入队任务
job, _ := jobs.Enqueue("email:send", EmailPayload{
    To:      "user@example.com",
    Subject: "Hello",
})

// 延时任务
jobs.EnqueueAt("report:generate", payload, time.Now().Add(1*time.Hour))

// 带选项
jobs.EnqueueWithOptions("task", payload, &JobEnqueueOptions{
    MaxRetries: 5,
    RunAt:      time.Now().Add(5*time.Minute),
})

// 查询任务
job, _ := jobs.Get("job_id")
stats, _ := jobs.Stats()
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/jobs/enqueue` | 入队任务 |
| GET | `/api/jobs` | 任务列表 |
| GET | `/api/jobs/stats` | 统计信息 |
| GET | `/api/jobs/{id}` | 获取详情 |
| POST | `/api/jobs/{id}/requeue` | 重新入队 |
| DELETE | `/api/jobs/{id}` | 删除任务 |

## 任务状态

| 状态 | 描述 |
|------|------|
| `pending` | 等待执行 |
| `processing` | 正在执行 |
| `completed` | 执行成功 |
| `failed` | 执行失败（已达最大重试） |
