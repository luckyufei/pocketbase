# Job Queue Plugin 迁移指南

本文档帮助你将代码从 core 内置的 Job Queue 迁移到新的 `plugins/jobs` 插件。

## 变更概述

在此次重构中，Job Queue 功能从 `core/` 模块迁移到了 `plugins/jobs/` 插件，遵循 PocketBase 的 Opt-in 插件化架构原则。

**主要变更**：
- `app.Jobs()` 方法已移除
- `core.Job`、`core.JobStore` 等类型已移至 `plugins/jobs` 包
- `_jobs` 表不再自动创建，仅在注册插件后创建
- HTTP API 路由 `/api/jobs/*` 不再自动注册

## 迁移步骤

### 1. 添加插件导入

**Before（旧代码）**：
```go
import (
    "github.com/pocketbase/pocketbase"
)
```

**After（新代码）**：
```go
import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/jobs"
)
```

### 2. 注册插件

**Before（旧代码）**：
```go
app := pocketbase.New()
// Job Queue 自动可用
app.Start()
```

**After（新代码）**：
```go
app := pocketbase.New()

// 注册 jobs 插件
jobs.MustRegister(app, jobs.DefaultConfig())

app.Start()
```

### 3. 获取 JobStore 实例

**Before（旧代码）**：
```go
store := app.Jobs()
```

**After（新代码）**：
```go
store := jobs.GetJobStore(app)
if store == nil {
    // 插件未注册
}
```

### 4. 类型变更

**Before（旧代码）**：
```go
var job *core.Job
var filter *core.JobFilter
var stats *core.JobStats
```

**After（新代码）**：
```go
var job *jobs.Job
var filter *jobs.JobFilter
var stats *jobs.JobStats
```

### 5. 错误类型变更

**Before（旧代码）**：
```go
if err == core.ErrJobNotFound {
    // ...
}
```

**After（新代码）**：
```go
if err == jobs.ErrJobNotFound {
    // ...
}
```

### 6. Handler 注册

**Before（旧代码）**：
```go
app.Jobs().Register("email:send", func(job *core.Job) error {
    // ...
})
```

**After（新代码）**：
```go
store := jobs.GetJobStore(app)
store.Register("email:send", func(job *jobs.Job) error {
    // ...
})
```

### 7. 配置选项

新的插件支持更细粒度的配置：

```go
jobs.MustRegister(app, jobs.Config{
    // 工作线程数（默认: CPU 核心数）
    Workers: 4,
    
    // 轮询间隔（默认: 1s）
    PollInterval: time.Second,
    
    // 任务锁定时长（默认: 30s）
    LockDuration: 30 * time.Second,
    
    // 每次轮询获取的任务数（默认: 10）
    BatchSize: 10,
    
    // 最大重试次数（默认: 3）
    MaxRetries: 3,
    
    // 最大 payload 大小（默认: 1MB）
    MaxPayloadSize: 1 << 20,
    
    // 是否启用 HTTP API（默认: true）
    HTTPEnabled: true,
    
    // 是否自动启动 Dispatcher（默认: true）
    AutoStart: true,
    
    // Topic 白名单（空表示允许所有）
    AllowedTopics: []string{"email:send", "sms:send"},
})
```

### 8. 环境变量

新插件支持以下环境变量：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_JOBS_DISABLED` | 禁用插件 | `false` |
| `PB_JOBS_WORKERS` | 工作线程数 | CPU 核心数 |
| `PB_JOBS_POLL_INTERVAL` | 轮询间隔 | `1s` |
| `PB_JOBS_LOCK_DURATION` | 锁定时长 | `30s` |
| `PB_JOBS_BATCH_SIZE` | 批量大小 | `10` |
| `PB_JOBS_MAX_RETRIES` | 最大重试次数 | `3` |
| `PB_JOBS_HTTP_ENABLED` | 启用 HTTP API | `true` |
| `PB_JOBS_AUTO_START` | 自动启动 | `true` |

## 完整迁移示例

### Before（旧代码）

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()
    
    // 注册 job handler（应用启动后）
    app.OnAfterBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        app.Jobs().Register("email:send", func(job *core.Job) error {
            var payload struct {
                To      string `json:"to"`
                Subject string `json:"subject"`
                Body    string `json:"body"`
            }
            if err := job.UnmarshalPayload(&payload); err != nil {
                return err
            }
            // 发送邮件...
            return nil
        })
        return nil
    })
    
    // 在某处入队任务
    app.OnRecordCreate("users").BindFunc(func(e *core.RecordEvent) error {
        if err := e.Next(); err != nil {
            return err
        }
        
        _, err := app.Jobs().Enqueue("email:send", map[string]any{
            "to":      e.Record.GetString("email"),
            "subject": "Welcome!",
            "body":    "Thanks for joining...",
        })
        return err
    })
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### After（新代码）

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
    
    // 注册 job handler（应用启动后）
    app.OnAfterBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        store := jobs.GetJobStore(e.App)
        if store == nil {
            return nil // 插件未注册
        }
        
        store.Register("email:send", func(job *jobs.Job) error {
            var payload struct {
                To      string `json:"to"`
                Subject string `json:"subject"`
                Body    string `json:"body"`
            }
            if err := job.UnmarshalPayload(&payload); err != nil {
                return err
            }
            // 发送邮件...
            return nil
        })
        return nil
    })
    
    // 在某处入队任务
    app.OnRecordCreate("users").BindFunc(func(e *core.RecordEvent) error {
        if err := e.Next(); err != nil {
            return err
        }
        
        store := jobs.GetJobStore(e.App)
        if store == nil {
            return nil // 插件未注册
        }
        
        _, err := store.Enqueue("email:send", map[string]any{
            "to":      e.Record.GetString("email"),
            "subject": "Welcome!",
            "body":    "Thanks for joining...",
        })
        return err
    })
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 常见问题

### Q: 为什么 `app.Jobs()` 返回 nil？

A: 这可能是因为：
1. 你没有注册 jobs 插件
2. 你使用 `Config{Disabled: true}` 禁用了插件
3. 你在插件注册之前调用了这个方法

**解决方案**：确保在 `app.Start()` 之前调用 `jobs.MustRegister(app, jobs.DefaultConfig())`。

### Q: 为什么 `_jobs` 表不存在？

A: 新插件遵循 Opt-in 原则，`_jobs` 表只在注册插件后才会创建。如果你使用 `Config{Disabled: true}` 或设置了 `PB_JOBS_DISABLED=1`，表也不会创建。

### Q: HTTP API 返回 404？

A: 检查以下几点：
1. 确保已注册 jobs 插件
2. 确保 `HTTPEnabled` 配置为 `true`（默认值）
3. 确保没有设置 `PB_JOBS_HTTP_ENABLED=false`

### Q: 如何关闭 HTTP API 但保留 Go API？

A: 使用以下配置：

```go
jobs.MustRegister(app, jobs.Config{
    HTTPEnabled: false,
})
```

或设置环境变量 `PB_JOBS_HTTP_ENABLED=false`。

### Q: 如何完全禁用 Job Queue？

A: 使用以下配置：

```go
jobs.MustRegister(app, jobs.Config{
    Disabled: true,
})
```

或设置环境变量 `PB_JOBS_DISABLED=1`。

### Q: 现有的 `_jobs` 表数据会丢失吗？

A: 不会。迁移到新插件后，现有的 `_jobs` 表和数据将保持不变。新插件使用相同的表结构。

## 相关资源

- [Jobs Plugin README](../plugins/jobs/README.md)
- [PocketBase 文档](https://pocketbase.io/docs/)
- [CODEBUDDY.md - Plugin 章节](../CODEBUDDY.md)
