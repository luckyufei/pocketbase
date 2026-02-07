# Jobs Plugin

Job Queue 插件为 PocketBase 提供可靠的后台任务处理能力，支持延迟任务、失败重试、崩溃恢复等特性。

## 快速开始

```go
package main

import (
    "log"
    "time"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/plugins/jobs"
)

func main() {
    app := pocketbase.New()

    // 注册 jobs 插件
    jobs.MustRegister(app, jobs.DefaultConfig())

    // 注册 Worker（在 Bootstrap 之后）
    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // 注册 Worker
        store := jobs.GetJobStore(app)
        store.Register("mail_digest", func(job *jobs.Job) error {
            var payload struct {
                UserID string `json:"user_id"`
            }
            job.UnmarshalPayload(&payload)

            // 处理任务...
            log.Printf("Processing mail digest for user: %s", payload.UserID)
            return nil
        })

        return nil
    })

    // 入队任务示例
    app.OnServe().BindFunc(func(e *core.ServeEvent) error {
        e.Router.POST("/send-digest", func(re *core.RequestEvent) error {
            store := jobs.GetJobStore(re.App)
            job, err := store.Enqueue("mail_digest", map[string]any{
                "user_id": "123",
            })
            if err != nil {
                return err
            }
            return re.JSON(200, map[string]any{"job_id": job.ID})
        })
        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 配置

```go
type Config struct {
    // Disabled 是否禁用插件（环境变量: PB_JOBS_DISABLED）
    Disabled bool

    // Workers Worker 池大小（环境变量: PB_JOBS_WORKERS，默认: 10）
    Workers int

    // PollInterval 轮询间隔（环境变量: PB_JOBS_POLL_INTERVAL，默认: 1s）
    PollInterval time.Duration

    // LockDuration 任务锁定时长（环境变量: PB_JOBS_LOCK_DURATION，默认: 5m）
    LockDuration time.Duration

    // BatchSize 批量获取任务数（环境变量: PB_JOBS_BATCH_SIZE，默认: 10）
    BatchSize int

    // MaxRetries 默认最大重试次数（默认: 3）
    MaxRetries int

    // MaxPayloadSize 最大 Payload 大小（默认: 1MB）
    MaxPayloadSize int64

    // HTTPEnabled 是否启用 HTTP API（环境变量: PB_JOBS_HTTP_ENABLED，默认: true）
    HTTPEnabled bool

    // EnqueueRule 入队权限规则（默认: "" 仅 Superuser）
    EnqueueRule string

    // ManageRule 管理权限规则（默认: "" 仅 Superuser）
    ManageRule string

    // AllowedTopics Topic 白名单（可选）
    AllowedTopics []string

    // AutoStart 是否自动启动 Dispatcher（环境变量: PB_JOBS_AUTO_START，默认: true）
    AutoStart bool
}
```

## 环境变量

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_JOBS_DISABLED` | 禁用插件 | `false` |
| `PB_JOBS_WORKERS` | Worker 数量 | `10` |
| `PB_JOBS_POLL_INTERVAL` | 轮询间隔 | `1s` |
| `PB_JOBS_LOCK_DURATION` | 锁定时长 | `5m` |
| `PB_JOBS_BATCH_SIZE` | 批量获取数 | `10` |
| `PB_JOBS_HTTP_ENABLED` | 启用 HTTP API | `true` |
| `PB_JOBS_AUTO_START` | 自动启动 Dispatcher | `true` |

## Go API

### 入队任务

```go
store := jobs.GetJobStore(app)

// 立即执行
job, err := store.Enqueue("topic", map[string]any{"key": "value"})

// 延迟执行
job, err := store.EnqueueAt("topic", payload, time.Now().Add(time.Hour))

// 带选项入队
job, err := store.EnqueueWithOptions("topic", payload, &jobs.JobEnqueueOptions{
    RunAt:      time.Now().Add(time.Hour),
    MaxRetries: 5,
})
```

### 查询任务

```go
// 获取单个任务
job, err := store.Get("job-id")

// 列表查询
result, err := store.List(&jobs.JobFilter{
    Topic:  "mail_digest",
    Status: "pending",
    Limit:  20,
    Offset: 0,
})

// 获取统计
stats, err := store.Stats()
```

### 管理任务

```go
// 删除任务（仅 pending/failed 状态）
err := store.Delete("job-id")

// 重新入队（仅 failed 状态）
job, err := store.Requeue("job-id")
```

### Worker 注册

```go
store.Register("topic", func(job *jobs.Job) error {
    // 解析 payload
    var payload MyPayload
    job.UnmarshalPayload(&payload)

    // 处理任务
    // 返回 error 会触发重试
    return nil
})

// 手动启动/停止 Dispatcher
store.Start()
store.Stop()
```

## HTTP API

需要 Superuser 权限。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/jobs/enqueue` | 入队任务 |
| GET | `/api/jobs/stats` | 获取统计 |
| GET | `/api/jobs` | 列表查询 |
| GET | `/api/jobs/{id}` | 获取任务 |
| POST | `/api/jobs/{id}/requeue` | 重新入队 |
| DELETE | `/api/jobs/{id}` | 删除任务 |

### 入队请求示例

```bash
curl -X POST http://localhost:8090/api/jobs/enqueue \
  -H "Authorization: Superuser-Token" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "mail_digest",
    "payload": {"user_id": "123"},
    "max_retries": 5
  }'
```

## 数据库兼容性

插件同时支持 SQLite 和 PostgreSQL：

| 特性 | PostgreSQL | SQLite |
|------|------------|--------|
| 并发获取任务 | `SKIP LOCKED` | 乐观锁 + CAS |
| 性能 | 高并发 | 中等并发 |

## 任务状态

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `processing` | 执行中 |
| `completed` | 执行成功 |
| `failed` | 执行失败（达到最大重试次数）|

## 重试策略

失败的任务会按照指数退避策略重试：

- 第 1 次重试：1 分钟后
- 第 2 次重试：4 分钟后
- 第 3 次重试：9 分钟后
- ...

## 崩溃恢复

当 Worker 崩溃或超时时，任务会在 `locked_until` 过期后被其他 Worker 自动接管。默认锁定时长为 5 分钟。

## 注意事项

1. **Topic 必须先注册**：只有注册了 handler 的 topic 才会被 Dispatcher 拉取执行
2. **Payload 大小限制**：默认最大 1MB
3. **幂等性**：Worker 应该设计为幂等的，因为任务可能被重复执行
4. **事务支持**：在事务中入队的任务会在事务提交后才可见
