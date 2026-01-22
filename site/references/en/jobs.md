# Jobs 任务队列

PocketBase 内置了一个轻量级的任务队列系统，支持延时任务、自动重试、并发处理等功能。同时兼容 SQLite 和 PostgreSQL。

## 功能特性

- **延时执行** - 支持定时调度任务
- **自动重试** - 失败任务自动重试，可配置最大重试次数
- **并发处理** - Worker 池并发执行任务
- **持久化存储** - 任务存储在数据库中，服务重启不丢失
- **管理 API** - 提供 RESTful API 进行任务管理
- **双数据库兼容** - 同时支持 SQLite 和 PostgreSQL

## 快速开始

### 1. 注册任务处理器

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 在应用启动后注册任务处理器
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // 注册 "send_email" 主题的处理器
        app.Jobs().Register("send_email", func(job *core.Job) error {
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

        // 启动任务调度器
        app.Jobs().Start()

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 2. 入队任务

```go
// 立即执行
job, err := app.Jobs().Enqueue("send_email", map[string]any{
    "to":      "user@example.com",
    "subject": "欢迎注册",
    "body":    "感谢您的注册！",
})

// 延时执行（10 分钟后）
job, err := app.Jobs().EnqueueAt("send_email", payload, time.Now().Add(10*time.Minute))

// 带选项入队
job, err := app.Jobs().EnqueueWithOptions("send_email", payload, &core.JobEnqueueOptions{
    RunAt:      time.Now().Add(1*time.Hour),  // 1 小时后执行
    MaxRetries: 5,                            // 最多重试 5 次
})
```

## 任务状态

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `processing` | 正在执行 |
| `completed` | 执行成功 |
| `failed` | 执行失败（已达最大重试次数） |

## API 接口

::: warning 注意
所有 Jobs API 都需要超级用户 (Superuser) 权限。
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

## 配置参数

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `JobMaxPayloadSize` | 1 MB | Payload 最大大小 |
| `JobDefaultMaxRetries` | 3 | 默认最大重试次数 |
| `JobDefaultLockDuration` | 5 分钟 | 任务锁定时长（执行超时时间） |
| `JobDefaultPollInterval` | 1 秒 | 轮询间隔 |
| `JobDefaultWorkerPoolSize` | 10 | Worker 池大小 |
| `JobDefaultBatchSize` | 10 | 批量获取任务数量 |

## 错误处理

任务处理器返回错误时，系统会自动重试：

```go
app.Jobs().Register("risky_task", func(job *core.Job) error {
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
app.Jobs().Register("process_order", func(job *core.Job) error {
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
app.Jobs().EnqueueWithOptions("call_webhook", payload, &core.JobEnqueueOptions{
    MaxRetries: 10,
})

// 对于不可恢复的错误，可以设置较少重试
app.Jobs().EnqueueWithOptions("send_sms", payload, &core.JobEnqueueOptions{
    MaxRetries: 2,
})
```

### 3. Payload 大小控制

Payload 最大 1MB，对于大数据量，建议存储引用而非数据本身：

```go
// 推荐：存储文件 ID
app.Jobs().Enqueue("process_file", map[string]any{
    "file_id": "abc123",
})

// 不推荐：存储文件内容
// app.Jobs().Enqueue("process_file", map[string]any{
//     "content": largeFileContent,  // 可能超过 1MB
// })
```

## 数据库兼容性

Jobs 模块完全兼容 SQLite 和 PostgreSQL：

| 功能 | SQLite | PostgreSQL |
|------|--------|------------|
| 表结构 | TEXT 存储 JSON | JSONB 类型 |
| 索引 | 普通索引 | 部分索引 (WHERE) |
| 任务获取 | 乐观锁 + CAS | FOR UPDATE SKIP LOCKED |
| 时间类型 | TEXT | TIMESTAMP |

无需修改代码，系统会自动适配不同数据库。
