# Feature Specification: Job Queue Plugin 重构

**Feature Branch**: `009-job-queue-plugin`  
**Created**: 2026-02-06  
**Status**: Ready for Dev  
**Input**: 原需求文档 `specs/008-job-queue/spec.md`，当前实现位于 `core/` 模块

## 1. Problem Essence (核心问题)

Job Queue 功能当前错误地实现在 `core/` 模块中，违背了 PocketBase 的插件化架构原则：

### 1.1 当前问题

| 问题 | 影响 |
|------|------|
| 耦合在 core 模块 | 无法独立禁用/启用，即使不需要 Job Queue 也会加载相关代码 |
| 违反 Opt-in 设计 | 与 `trace`、`metrics`、`kv` 等插件的设计模式不一致 |
| 增加核心复杂度 | `core.App` 接口膨胀，增加了 `Jobs()` 方法 |
| 迁移脚本耦合 | `migrations/1736500000_create_jobs.go` 强制执行，无法跳过 |

### 1.2 目标架构

```
plugins/jobs/
├── register.go          # MustRegister/Register 入口
├── config.go            # Config 结构体 + 环境变量覆盖
├── plugin.go            # jobsPlugin 插件实例
├── store.go             # JobStore 核心逻辑
├── dispatcher.go        # Dispatcher 任务分发器
├── routes.go            # HTTP API 路由
├── migrations.go        # _jobs 表迁移（内部自动执行）
└── README.md            # 使用文档
```

### 1.3 核心理念

- **Opt-in 设计**: 不注册插件时零开销，不创建 `_jobs` 表
- **模块化**: 遵循 `trace`、`metrics` 等插件的标准模式
- **向后兼容**: 提供迁移指南，现有代码可平滑升级

---

## 2. Database Compatibility (数据库兼容性)

> 此部分与原 `specs/008-job-queue/spec.md` 保持一致

PocketBase 同时支持 **SQLite** 和 **PostgreSQL**，Job Queue 必须在两种数据库上都能正常工作。

### 2.1 特性差异与兼容策略

| 特性 | PostgreSQL | SQLite | 兼容策略 |
|------|------------|--------|----------|
| `FOR UPDATE SKIP LOCKED` | ✅ 原生支持 | ❌ 不支持 | SQLite 使用乐观锁 + 重试 |
| `LISTEN/NOTIFY` | ✅ 原生支持 | ❌ 不支持 | 统一使用轮询 fallback |
| `INTERVAL` 语法 | `NOW() + INTERVAL '5 minutes'` | `datetime('now', '+5 minutes')` | 使用 Go 计算时间后传参 |
| `RETURNING` 子句 | ✅ 原生支持 | ✅ SQLite 3.35+ 支持 | 可统一使用 |
| 并发性能 | 高（行级锁） | 中（写锁串行） | SQLite 适合低并发场景 |

### 2.2 SQLite 任务获取策略

由于 SQLite 不支持 `SKIP LOCKED`，采用 **乐观锁 + CAS 更新** 策略：

```sql
-- SQLite: 原子性 CAS 更新（乐观锁）
UPDATE _jobs
SET status = 'processing',
    locked_until = :locked_until,
    updated = :now
WHERE id = (
    SELECT id FROM _jobs
    WHERE status = 'pending'
      AND run_at <= :now
      AND (locked_until IS NULL OR locked_until < :now)
    ORDER BY run_at ASC
    LIMIT 1
)
AND status = 'pending'  -- 二次确认，防止并发冲突
RETURNING id, topic, payload, retries, max_retries;
```

---

## 3. User Scenarios & Testing *(mandatory)*

### User Story 1 - 插件注册 (Priority: P1)

作为开发者，我希望能够通过 `jobs.MustRegister()` 显式注册 Job Queue 插件，以便按需启用此功能。

**Why this priority**: 这是重构的核心目标，必须先完成插件化改造。

**Independent Test**: 可以验证不注册插件时，`_jobs` 表不存在。

**Acceptance Scenarios**:

1. **Given** 未注册 jobs 插件, **When** 应用启动, **Then** `_jobs` 表不存在，`/api/jobs/*` 路由返回 404
2. **Given** 调用 `jobs.MustRegister(app, config)`, **When** 应用启动, **Then** 自动创建 `_jobs` 表
3. **Given** 插件已注册, **When** 调用 `jobs.GetJobStore(app)`, **Then** 返回 JobStore 实例
4. **Given** 插件未注册, **When** 调用 `jobs.GetJobStore(app)`, **Then** 返回 nil

---

### User Story 2 - 环境变量配置 (Priority: P1)

作为运维人员，我希望能够通过环境变量配置 Job Queue 参数，以便在容器化部署时灵活调整。

**Why this priority**: 环境变量配置是生产环境的标准实践。

**Independent Test**: 可以通过设置环境变量验证配置生效。

**Acceptance Scenarios**:

1. **Given** 设置 `PB_JOBS_WORKERS=20`, **When** 插件启动, **Then** Worker 池大小为 20
2. **Given** 设置 `PB_JOBS_POLL_INTERVAL=2s`, **When** 插件启动, **Then** 轮询间隔为 2 秒
3. **Given** 设置 `PB_JOBS_DISABLED=1`, **When** 调用 Register, **Then** 插件不启动，返回 nil
4. **Given** 同时设置环境变量和代码 Config, **When** 插件启动, **Then** 环境变量优先

---

### User Story 3 - 移除 core.App 接口依赖 (Priority: P1)

作为代码维护者，我希望 `core.App` 接口不包含 `Jobs()` 方法，以保持核心接口的精简。

**Why this priority**: 接口精简是重构的核心目标之一。

**Independent Test**: 可以验证 `core.App` 接口不包含 `Jobs()` 方法。

**Acceptance Scenarios**:

1. **Given** 重构完成, **When** 查看 `core/app.go`, **Then** `App` 接口不包含 `Jobs()` 方法
2. **Given** 重构完成, **When** 查看 `core/base.go`, **Then** `BaseApp` 结构体不包含 jobStore 字段
3. **Given** 需要使用 JobStore, **When** 调用 `jobs.GetJobStore(app)`, **Then** 返回 JobStore 实例

---

### User Story 4 - 现有功能保持不变 (Priority: P1)

作为开发者，我希望重构后 Job Queue 的功能与原实现完全一致，包括入队、执行、重试、崩溃恢复等。

**Why this priority**: 向后兼容是重构的基本要求。

**Independent Test**: 原有测试用例全部通过。

**Acceptance Scenarios**:

1. **Given** 插件已注册, **When** 调用 `Enqueue()`, **Then** 任务成功入队
2. **Given** 任务已入队, **When** Worker 执行, **Then** 任务状态变更为 completed
3. **Given** 任务执行失败, **When** retries < max_retries, **Then** 任务按指数退避重试
4. **Given** Worker 崩溃, **When** locked_until 过期, **Then** 任务被其他 Worker 接管
5. **Given** 多 Worker 并发, **When** 同时拉取任务, **Then** 每个任务只被执行一次

---

### User Story 5 - 迁移脚本内部化 (Priority: P1)

作为开发者，我希望 `_jobs` 表的迁移脚本在插件内部执行，不依赖全局迁移目录。

**Why this priority**: 插件自包含是模块化设计的关键。

**Independent Test**: 可以验证 `migrations/` 目录不包含 jobs 相关文件。

**Acceptance Scenarios**:

1. **Given** 插件注册时, **When** `_jobs` 表不存在, **Then** 插件自动创建表
2. **Given** 插件注册时, **When** `_jobs` 表已存在, **Then** 插件跳过创建
3. **Given** 删除 `migrations/1736500000_create_jobs.go`, **When** 应用启动, **Then** 不报错

---

### User Story 6 - HTTP API 路由注册 (Priority: P1)

作为开发者，我希望 `/api/jobs/*` 路由仅在插件注册后可用。

**Why this priority**: 路由按需注册是插件化的基本特征。

**Independent Test**: 可以验证未注册插件时路由返回 404。

**Acceptance Scenarios**:

1. **Given** 插件已注册, **When** 访问 `POST /api/jobs/enqueue`, **Then** 返回正常响应
2. **Given** 插件已注册, **When** 访问 `GET /api/jobs/stats`, **Then** 返回统计信息
3. **Given** 插件未注册, **When** 访问任意 `/api/jobs/*`, **Then** 返回 404
4. **Given** 设置 `HTTPEnabled=false`, **When** 访问 `/api/jobs/*`, **Then** 返回 404

---

### User Story 7 - 代码迁移指南 (Priority: P2)

作为现有用户，我希望有清晰的迁移指南，帮助我从 core 实现迁移到 plugin 实现。

**Why this priority**: 迁移文档是用户体验的重要组成部分。

**Independent Test**: 可以按照迁移指南完成升级。

**Acceptance Scenarios**:

1. **Given** 用户使用旧版 `app.Jobs()`, **When** 阅读迁移指南, **Then** 知道如何改用 `jobs.GetJobStore(app)`
2. **Given** 用户有自定义 Worker, **When** 阅读迁移指南, **Then** 知道如何在新 API 中注册 Worker
3. **Given** 迁移指南, **When** 用户按步骤操作, **Then** 10 分钟内完成迁移

---

### Edge Cases

- 从旧版本升级时，`_jobs` 表已存在如何处理？插件检测到表存在则跳过创建
- 用户同时使用旧 `migrations/` 和新插件如何处理？文档提示删除旧迁移文件
- 插件注册但 Dispatcher 未启动如何处理？任务保持 pending 状态
- 多实例部署时如何协调？依赖数据库锁机制，与原实现一致

---

### Assumptions

1. 原 `core/job_*.go` 和 `apis/job_routes.go` 代码逻辑不变，仅移动位置
2. 原有测试用例全部迁移到 `plugins/jobs/` 目录
3. 环境变量命名遵循 `PB_JOBS_*` 前缀
4. 迁移脚本使用 `app.OnBootstrap()` 钩子自动执行
5. HTTP 路由使用 `app.OnServe()` 钩子注册
6. Dispatcher 在 Bootstrap 后自动启动（可通过配置禁用）

---

## 4. Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 提供 `jobs.MustRegister(app, config)` 入口 | P1 | US1 |
| FR-002 | 提供 `jobs.Register(app, config)` 入口（返回 error）| P1 | US1 |
| FR-003 | 提供 `jobs.GetJobStore(app)` 获取 JobStore | P1 | US1, US3 |
| FR-004 | 支持环境变量 `PB_JOBS_WORKERS` 配置 Worker 数量 | P1 | US2 |
| FR-005 | 支持环境变量 `PB_JOBS_POLL_INTERVAL` 配置轮询间隔 | P1 | US2 |
| FR-006 | 支持环境变量 `PB_JOBS_DISABLED` 禁用插件 | P1 | US2 |
| FR-007 | 移除 `core.App.Jobs()` 方法 | P1 | US3 |
| FR-008 | 移除 `core.BaseApp.jobStore` 字段 | P1 | US3 |
| FR-009 | 移除 `core/job_*.go` 文件 | P1 | US3 |
| FR-010 | 移除 `apis/job_routes.go` 文件 | P1 | US6 |
| FR-011 | 移除 `migrations/1736500000_create_jobs.go` 文件 | P1 | US5 |
| FR-012 | 插件内部实现 `_jobs` 表自动创建 | P1 | US5 |
| FR-013 | 插件内部注册 `/api/jobs/*` 路由 | P1 | US6 |
| FR-014 | 保持原有 Enqueue/EnqueueAt 功能 | P1 | US4 |
| FR-015 | 保持原有 Worker 注册功能 | P1 | US4 |
| FR-016 | 保持原有失败重试机制 | P1 | US4 |
| FR-017 | 保持原有崩溃恢复机制 | P1 | US4 |
| FR-018 | 提供迁移指南文档 | P2 | US7 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-001 | 不注册插件时零内存开销 | 0 bytes |
| NFR-002 | 不注册插件时零 Goroutine 开销 | 0 goroutines |
| NFR-003 | 插件代码与 core 模块解耦 | 无循环依赖 |
| NFR-004 | 测试覆盖率保持 80% 以上 | > 80% |

---

## 6. Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | core.App 接口不包含 Jobs 方法 | 100% | 代码审查 |
| SC-002 | 原有测试用例全部通过 | 100% | go test |
| SC-003 | 未注册插件时 _jobs 表不存在 | 100% | 集成测试 |
| SC-004 | 环境变量配置生效 | 100% | 单元测试 |
| SC-005 | 迁移指南可操作性 | < 10min | 用户验证 |

---

## 7. API 设计预览

### 7.1 Go API

```go
package main

import (
    "log"
    
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/jobs"
)

func main() {
    app := pocketbase.New()
    
    // 注册 jobs 插件
    jobs.MustRegister(app, jobs.Config{
        Workers:       10,
        PollInterval:  time.Second,
        LockDuration:  5 * time.Minute,
        MaxRetries:    3,
        HTTPEnabled:   true,
    })
    
    // 获取 JobStore
    jobStore := jobs.GetJobStore(app)
    
    // 注册 Worker（在 OnBootstrap 之后）
    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }
        
        // 注册 Worker
        jobs.GetJobStore(app).Register("mail_digest", func(job *jobs.Job) error {
            // 处理任务
            return nil
        })
        
        return nil
    })
    
    // 入队任务
    app.OnServe().BindFunc(func(e *core.ServeEvent) error {
        e.Router.POST("/send-digest", func(re *core.RequestEvent) error {
            jobID, err := jobs.GetJobStore(re.App).Enqueue("mail_digest", map[string]any{
                "userId": "123",
            })
            if err != nil {
                return err
            }
            return re.JSON(200, map[string]any{"jobId": jobID})
        })
        return e.Next()
    })
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 7.2 Config 结构体

```go
// Config 定义 jobs 插件配置
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
    
    // HTTPEnabled 是否启用 HTTP API（默认: true）
    HTTPEnabled bool
    
    // EnqueueRule 入队权限规则（默认: "" 仅 Superuser）
    EnqueueRule string
    
    // ManageRule 管理权限规则（默认: "" 仅 Superuser）
    ManageRule string
    
    // AllowedTopics Topic 白名单（可选）
    AllowedTopics []string
    
    // AutoStart 是否自动启动 Dispatcher（默认: true）
    AutoStart bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
    return Config{
        Workers:        10,
        PollInterval:   time.Second,
        LockDuration:   5 * time.Minute,
        BatchSize:      10,
        MaxRetries:     3,
        MaxPayloadSize: 1 << 20, // 1MB
        HTTPEnabled:    true,
        AutoStart:      true,
    }
}
```

### 7.3 环境变量

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_JOBS_DISABLED` | 禁用插件 | `false` |
| `PB_JOBS_WORKERS` | Worker 数量 | `10` |
| `PB_JOBS_POLL_INTERVAL` | 轮询间隔 | `1s` |
| `PB_JOBS_LOCK_DURATION` | 锁定时长 | `5m` |
| `PB_JOBS_BATCH_SIZE` | 批量获取数 | `10` |
| `PB_JOBS_HTTP_ENABLED` | 启用 HTTP API | `true` |
| `PB_JOBS_AUTO_START` | 自动启动 Dispatcher | `true` |

---

## 8. 迁移指南预览

### 8.1 从 core 实现迁移到 plugin

**Before (旧代码)**:
```go
// 使用 app.Jobs() 直接访问
jobStore := app.Jobs()
jobStore.Register("mail_digest", handler)
jobID, _ := app.Jobs().Enqueue("mail_digest", payload)
```

**After (新代码)**:
```go
import "github.com/pocketbase/pocketbase/plugins/jobs"

// 1. 注册插件
jobs.MustRegister(app, jobs.DefaultConfig())

// 2. 使用 jobs.GetJobStore() 获取
jobStore := jobs.GetJobStore(app)
jobStore.Register("mail_digest", handler)
jobID, _ := jobs.GetJobStore(app).Enqueue("mail_digest", payload)
```

### 8.2 迁移步骤

1. **添加插件导入**:
   ```go
   import "github.com/pocketbase/pocketbase/plugins/jobs"
   ```

2. **注册插件**:
   ```go
   jobs.MustRegister(app, jobs.DefaultConfig())
   ```

3. **替换 `app.Jobs()` 调用**:
   - `app.Jobs()` → `jobs.GetJobStore(app)`

4. **删除旧迁移文件**（如果存在）:
   ```bash
   rm migrations/1736500000_create_jobs.go
   ```

5. **验证**:
   ```bash
   go test ./...
   ```

---

## 9. 文件变更清单

### 9.1 新增文件

| 文件路径 | 说明 |
|---------|------|
| `plugins/jobs/register.go` | 插件注册入口 |
| `plugins/jobs/config.go` | 配置结构体 + 环境变量 |
| `plugins/jobs/plugin.go` | 插件实例 |
| `plugins/jobs/store.go` | JobStore 实现（从 core 迁移）|
| `plugins/jobs/dispatcher.go` | Dispatcher 实现（从 core 迁移）|
| `plugins/jobs/routes.go` | HTTP 路由（从 apis 迁移）|
| `plugins/jobs/migrations.go` | 内部迁移逻辑 |
| `plugins/jobs/store_test.go` | 测试（从 core 迁移）|
| `plugins/jobs/routes_test.go` | 测试（从 apis 迁移）|
| `plugins/jobs/README.md` | 使用文档 |

### 9.2 删除文件

| 文件路径 | 说明 |
|---------|------|
| `core/job_store.go` | 迁移到 plugins/jobs/ |
| `core/job_dispatcher.go` | 迁移到 plugins/jobs/ |
| `core/job_hooks.go` | 移除 |
| `core/job_store_test.go` | 迁移到 plugins/jobs/ |
| `apis/job_routes.go` | 迁移到 plugins/jobs/ |
| `apis/job_routes_test.go` | 迁移到 plugins/jobs/ |
| `migrations/1736500000_create_jobs.go` | 内部化到插件 |

### 9.3 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `core/app.go` | 移除 `Jobs()` 方法声明 |
| `core/base.go` | 移除 jobStore 字段和初始化逻辑 |
| `examples/base/main.go` | 添加 `jobs.MustRegister()` 示例 |
| `CODEBUDDY.md` | 更新插件列表和使用说明 |
