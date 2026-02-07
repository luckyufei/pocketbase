# Jobs 任务队列

PocketBase 提供了一个轻量级的任务队列插件，支持延时任务、自动重试、并发处理等功能。同时兼容 SQLite 和 PostgreSQL。

::: tip 插件化设计
从最新版本开始，Jobs 功能已迁移到 `plugins/jobs` 插件，遵循 Opt-in 原则。需要显式注册插件才能使用此功能。
:::

## 功能特性

- **延时执行** - 支持定时调度任务
- **自动重试** - 失败任务自动重试，可配置最大重试次数
- **并发处理** - Worker 池并发执行任务
- **持久化存储** - 任务存储在数据库中，服务重启不丢失
- **崩溃恢复** - Worker 崩溃后任务自动被其他 Worker 接管
- **管理 API** - 提供 RESTful API 进行任务管理
- **双数据库兼容** - 同时支持 SQLite 和 PostgreSQL

## 快速开始

### 1. 注册插件和任务处理器

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/plugins/jobs"
)

func main() {
    app := pocketbase.New()

    // 注册 jobs 插件
    jobs.MustRegister(app, jobs.DefaultConfig())

    // 在应用启动后注册任务处理器
    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // 获取 JobStore 实例
        store := jobs.GetJobStore(app)
        if store == nil {
            return nil // 插件未注册
        }

        // 注册 "send_email" 主题的处理器
        store.Register("send_email", func(job *jobs.Job) error {
            // 解析 Payload
            var payload struct {
                To      string `json:"to"`
                Subject string `json:"subject"`
                Body    string `json:"body"`
            }
            if err := job.UnmarshalPayload(&payload); err != nil {
                return err
            }

            // 执行任务逻辑
            log.Printf("发送邮件到 %s: %s", payload.To, payload.Subject)
            // ... 实际发送邮件的代码

            return nil
        })

        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 2. 入队任务

```go
import "github.com/pocketbase/pocketbase/plugins/jobs"

// 获取 JobStore
store := jobs.GetJobStore(app)

// 立即执行
job, err := store.Enqueue("send_email", map[string]any{
    "to":      "user@example.com",
    "subject": "欢迎注册",
    "body":    "感谢您的注册！",
})

// 延时执行（10 分钟后）
job, err := store.EnqueueAt("send_email", payload, time.Now().Add(10*time.Minute))

// 带选项入队
job, err := store.EnqueueWithOptions("send_email", payload, &jobs.JobEnqueueOptions{
    RunAt:      time.Now().Add(1*time.Hour),  // 1 小时后执行
    MaxRetries: 5,                            // 最多重试 5 次
})
```

## 配置

```go
jobs.MustRegister(app, jobs.Config{
    // 禁用插件（环境变量: PB_JOBS_DISABLED）
    Disabled: false,

    // Worker 池大小（环境变量: PB_JOBS_WORKERS，默认: 10）
    Workers: 10,

    // 轮询间隔（环境变量: PB_JOBS_POLL_INTERVAL，默认: 1s）
    PollInterval: time.Second,

    // 任务锁定时长（环境变量: PB_JOBS_LOCK_DURATION，默认: 5m）
    LockDuration: 5 * time.Minute,

    // 批量获取任务数（环境变量: PB_JOBS_BATCH_SIZE，默认: 10）
    BatchSize: 10,

    // 默认最大重试次数（默认: 3）
    MaxRetries: 3,

    // 最大 Payload 大小（默认: 1MB）
    MaxPayloadSize: 1 << 20,

    // 是否启用 HTTP API（环境变量: PB_JOBS_HTTP_ENABLED，默认: true）
    HTTPEnabled: true,

    // 入队权限规则（默认: "" 仅 Superuser）
    EnqueueRule: "",

    // 管理权限规则（默认: "" 仅 Superuser）
    ManageRule: "",

    // Topic 白名单（可选，空表示允许所有）
    AllowedTopics: []string{},

    // 是否自动启动 Dispatcher（环境变量: PB_JOBS_AUTO_START，默认: true）
    AutoStart: true,
})
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

## 任务状态

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `processing` | 正在执行 |
| `completed` | 执行成功 |
| `failed` | 执行失败（已达最大重试次数） |

## API 接口

::: warning 注意
所有 Jobs API 默认需要超级用户 (Superuser) 权限。可通过 `EnqueueRule` 和 `ManageRule` 配置自定义权限规则。
:::

### 入队任务

```http
POST /api/jobs/enqueue
Content-Type: application/json

{
    "topic": "send_email",
    "payload": {
        "to": "user@example.com",
        "subject": "Hello"
    },
    "run_at": "2025-01-08T12:00:00Z",  // 可选，延时执行
    "max_retries": 5                    // 可选，最大重试次数
}
```

**响应:**
```json
{
    "id": "01234567-89ab-cdef-0123-456789abcdef",
    "topic": "send_email",
    "payload": {"to": "user@example.com", "subject": "Hello"},
    "status": "pending",
    "run_at": "2025-01-08T12:00:00Z",
    "retries": 0,
    "max_retries": 5,
    "created": "2025-01-08T10:00:00Z",
    "updated": "2025-01-08T10:00:00Z"
}
```

### 获取任务列表

```http
GET /api/jobs?topic=send_email&status=pending&limit=20&offset=0
```

**查询参数:**
- `topic` - 按主题筛选
- `status` - 按状态筛选 (`pending`, `processing`, `completed`, `failed`)
- `limit` - 返回数量（默认 20）
- `offset` - 偏移量

**响应:**
```json
{
    "items": [...],
    "total": 100,
    "limit": 20,
    "offset": 0
}
```

### 获取单个任务

```http
GET /api/jobs/{id}
```

### 获取统计信息

```http
GET /api/jobs/stats
```

**响应:**
```json
{
    "pending": 10,
    "processing": 2,
    "completed": 100,
    "failed": 5,
    "total": 117,
    "success_rate": 0.952
}
```

### 重新入队失败任务

```http
POST /api/jobs/{id}/requeue
```

::: info 提示
仅 `failed` 状态的任务可以重新入队。
:::

### 删除任务

```http
DELETE /api/jobs/{id}
```

::: info 提示
仅 `pending` 或 `failed` 状态的任务可以删除。
:::

## Go API

### 查询任务

```go
store := jobs.GetJobStore(app)

// 获取单个任务
job, err := store.Get("job-id")

// 列表查询
result, err := store.List(&jobs.JobFilter{
    Topic:  "send_email",
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

### 手动控制 Dispatcher

```go
// 如果配置 AutoStart: false，需要手动启动
store.Start()

// 停止 Dispatcher
store.Stop()
```

## 错误处理

任务处理器返回错误时，系统会自动重试：

```go
store.Register("risky_task", func(job *jobs.Job) error {
    if err := doSomethingRisky(); err != nil {
        // 返回错误会触发重试
        return err
    }
    return nil
})
```

- 每次重试会增加 `retries` 计数
- 达到 `max_retries` 后，任务状态变为 `failed`
- 失败任务可通过 API 或 UI 手动重新入队

## 重试策略

失败的任务会按照指数退避策略重试：

- 第 1 次重试：1 分钟后
- 第 2 次重试：4 分钟后
- 第 3 次重试：9 分钟后
- ...

## 崩溃恢复

当 Worker 崩溃或超时时，任务会在 `locked_until` 过期后被其他 Worker 自动接管。默认锁定时长为 5 分钟。

## UI 管理

在 PocketBase Admin UI 中，访问 **Settings → Jobs** 可以：

- 查看任务列表和状态
- 按主题/状态筛选
- 查看任务详情和 Payload
- 重新入队失败任务
- 删除任务
- 查看统计信息

## 最佳实践

### 1. 幂等性设计

任务可能因重试而多次执行，确保处理器具有幂等性：

```go
store.Register("process_order", func(job *jobs.Job) error {
    var payload struct {
        OrderID string `json:"order_id"`
    }
    job.UnmarshalPayload(&payload)

    // 先检查订单是否已处理
    if isOrderProcessed(payload.OrderID) {
        return nil // 已处理，直接返回成功
    }

    return processOrder(payload.OrderID)
})
```

### 2. 合理设置重试次数

```go
// 对于网络请求类任务，可以设置较多重试
store.EnqueueWithOptions("call_webhook", payload, &jobs.JobEnqueueOptions{
    MaxRetries: 10,
})

// 对于不可恢复的错误，可以设置较少重试
store.EnqueueWithOptions("send_sms", payload, &jobs.JobEnqueueOptions{
    MaxRetries: 2,
})
```

### 3. Payload 大小控制

Payload 最大 1MB，对于大数据量，建议存储引用而非数据本身：

```go
// 推荐：存储文件 ID
store.Enqueue("process_file", map[string]any{
    "file_id": "abc123",
})

// 不推荐：存储文件内容
// store.Enqueue("process_file", map[string]any{
//     "content": largeFileContent,  // 可能超过 1MB
// })
```

### 4. Topic 白名单

通过配置 `AllowedTopics` 限制可入队的 Topic：

```go
jobs.MustRegister(app, jobs.Config{
    AllowedTopics: []string{"email:send", "sms:send", "webhook:call"},
})
```

## 数据库兼容性

Jobs 插件完全兼容 SQLite 和 PostgreSQL：

| 功能 | SQLite | PostgreSQL |
|------|--------|------------|
| 表结构 | TEXT 存储 JSON | JSONB 类型 |
| 索引 | 普通索引 | 部分索引 (WHERE) |
| 任务获取 | 乐观锁 + CAS | FOR UPDATE SKIP LOCKED |
| 时间类型 | TEXT | TIMESTAMP |
| 并发性能 | 中等 | 高 |

无需修改代码，系统会自动适配不同数据库。

## 注意事项

1. **Topic 必须先注册**：只有注册了 handler 的 topic 才会被 Dispatcher 拉取执行
2. **Payload 大小限制**：默认最大 1MB
3. **幂等性**：Worker 应该设计为幂等的，因为任务可能被重复执行
4. **事务支持**：在事务中入队的任务会在事务提交后才可见
5. **Opt-in 设计**：不注册插件时 `_jobs` 表不会创建，零开销

## 迁移指南

如果你从旧版本迁移（使用 `app.Jobs()` API），请参考 [迁移指南](/docs/MIGRATION_JOBS_PLUGIN.md)。

主要变更：
- `app.Jobs()` → `jobs.GetJobStore(app)`
- `core.Job` → `jobs.Job`
- `core.JobFilter` → `jobs.JobFilter`
- 需要显式注册插件：`jobs.MustRegister(app, jobs.DefaultConfig())`
