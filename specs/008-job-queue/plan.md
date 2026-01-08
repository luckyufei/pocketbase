# Implementation Plan: PocketBase Native Job Queue (`_jobs`)

**Branch**: `008-job-queue` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-job-queue/spec.md`

## Summary

为 PocketBase 新增原生任务队列功能，通过 `_jobs` 系统表实现 **ACID 级别可靠、零运维成本** 的异步任务系统。**同时支持 SQLite 和 PostgreSQL**：PostgreSQL 使用 `SKIP LOCKED` 特性实现高并发任务获取，SQLite 使用乐观锁 + CAS 策略。支持延时任务、失败重试、崩溃恢复等企业级能力。**同时提供 HTTP API、JS SDK 和 Admin UI 管理界面**。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `database/sql` (数据库操作)
- `encoding/json` (Payload 序列化)
- `github.com/google/uuid` (UUID v7 生成)

**Storage**: SQLite / PostgreSQL TABLE (`_jobs`)  
**Testing**: Go test (unit + integration)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Backend (PocketBase 核心扩展)  
**Performance Goals**: 
- PostgreSQL: 入队 < 5ms, 获取 < 10ms, 吞吐量 > 1000 jobs/sec
- SQLite: 入队 < 10ms, 获取 < 20ms, 吞吐量 > 100 jobs/sec
**Constraints**: 不支持任务链（Workflow），不支持优先级队列  
**Scale/Scope**: 单机部署

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | Job Queue 功能编译进主二进制，无外部 Redis/RabbitMQ 依赖 |
| Zero External Dependencies | ✅ PASS | 使用数据库内置能力（PostgreSQL SKIP LOCKED / SQLite CAS） |
| Anti-Stupidity | ✅ PASS | 消除消息队列运维负担，事务性保证 |
| Data Locality | ✅ PASS | 任务数据存储在同一个数据库实例，备份策略统一 |
| Graceful Degradation | ✅ PASS | Worker 崩溃后任务自动被其他 Worker 接管 |
| **Database Agnostic** | ✅ PASS | **同时支持 SQLite 和 PostgreSQL** |

## Project Structure

### Documentation (this feature)

```text
specs/008-job-queue/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── job_store.go              # JobStore 核心接口和实现
├── job_store_test.go         # 单元测试
├── job_dispatcher.go         # Dispatcher 任务分发器
├── job_worker.go             # Worker 池管理
├── job_retry.go              # 重试策略（指数退避）
├── job_settings.go           # Jobs 配置（访问控制规则）
└── job_benchmark_test.go     # 性能基准测试

apis/
├── job_routes.go             # HTTP API 路由注册
├── job_routes_test.go        # HTTP API 测试
└── job_auth.go               # Jobs API 访问控制

migrations/
└── 1736500000_create_jobs.go # _jobs 系统表迁移

# Frontend (Svelte)
ui/src/
├── components/jobs/
│   ├── JobsList.svelte       # 任务列表组件
│   ├── JobsDetail.svelte     # 任务详情组件
│   ├── JobsStats.svelte      # 统计组件
│   └── JobsFilters.svelte    # 筛选组件
└── pages/
    └── jobs/
        └── Index.svelte      # Jobs 面板页面

# JS SDK
jssdk/src/
├── services/JobsService.ts   # Jobs 服务封装
└── types/Job.ts              # Job 类型定义
```

**Structure Decision**: 遵循现有 PocketBase 代码结构，Jobs 相关代码放入 `core/` 目录，HTTP API 放入 `apis/` 目录，Admin UI 放入 `ui/src/` 目录。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            PocketBase                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Admin UI Layer                              │ │
│  │  Jobs Panel: List | Detail | Stats | Requeue | Delete              │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                        HTTP API Layer                               │ │
│  │  POST /api/jobs/enqueue | GET /api/jobs/:id | GET /api/jobs/stats  │ │
│  │  (Bearer Token / Cookie Authentication)                             │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                       Access Control                                │ │
│  │  enqueue_rule | manage_rule | allowed_topics                        │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                        JobStore API                                 │ │
│  │  Enqueue | EnqueueAt | Get | List | Requeue | Delete | Stats       │ │
│  │  Register (Worker) | Start | Stop                                   │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                      Dispatcher Layer                               │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │ │
│  │  │   Go Dispatcher         │  │   Worker Pool                   │  │ │
│  │  │   (Goroutine)           │  │   (10 Workers Default)          │  │ │
│  │  │                         │  │                                 │  │ │
│  │  │   • LISTEN/NOTIFY       │  │   • Worker 1                    │  │ │
│  │  │   • Poll Interval       │  │   • Worker 2                    │  │ │
│  │  │   • SKIP LOCKED         │  │   • ...                         │  │ │
│  │  │   • Batch Fetch         │  │   • Worker N                    │  │ │
│  │  └─────────────────────────┘  └─────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                       PostgreSQL Layer                              │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │   _jobs Table                                                 │  │ │
│  │  │                                                               │  │ │
│  │  │   • id (UUID v7)        • status (pending/processing/...)    │  │ │
│  │  │   • topic               • payload (JSONB)                    │  │ │
│  │  │   • run_at              • locked_until                       │  │ │
│  │  │   • retries             • max_retries                        │  │ │
│  │  │   • last_error          • created/updated                    │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Enqueue Path (入队)

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│  HTTP API   │────▶│  JobStore   │
│ (SDK)   │     │  /enqueue   │     │  Enqueue()  │
└─────────┘     └──────┬──────┘     └──────┬──────┘
                       │                   │
                       ▼                   ▼
                ┌──────────┐        ┌──────────┐
                │  Auth    │        │  INSERT  │
                │  Check   │        │  _jobs   │
                └──────────┘        └──────┬───┘
                                           │
                                           ▼
                                    ┌──────────┐
                                    │  NOTIFY  │
                                    │  (可选)   │
                                    └──────────┘
```

1. 客户端调用 HTTP API 或 Go API 入队任务
2. 权限检查（enqueue_rule）
3. 插入 `_jobs` 表，状态为 `pending`
4. 可选：发送 NOTIFY 通知 Dispatcher

### Execute Path (执行)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Dispatcher  │────▶│  PostgreSQL │────▶│   Worker    │
│ (Goroutine) │     │  SKIP LOCKED│     │   Pool      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌──────────┐        ┌──────────┐        ┌──────────┐
│  LISTEN  │        │  UPDATE  │        │  Execute │
│  / Poll  │        │  status  │        │  Handler │
└──────────┘        └──────────┘        └──────────┘
       │                   │                   │
       │                   │                   ▼
       │                   │            ┌──────────┐
       │                   │            │ Success? │
       │                   │            └────┬─────┘
       │                   │                 │
       │                   │    ┌────────────┴────────────┐
       │                   │    ▼                         ▼
       │                   │ ┌──────────┐          ┌──────────┐
       │                   │ │ completed│          │  Retry?  │
       │                   │ └──────────┘          └────┬─────┘
       │                   │                            │
       │                   │              ┌─────────────┴─────────────┐
       │                   │              ▼                           ▼
       │                   │       ┌──────────┐                ┌──────────┐
       │                   │       │ Reschedule│                │  failed  │
       │                   │       │ (退避)    │                │ (死信)   │
       │                   │       └──────────┘                └──────────┘
```

1. Dispatcher 通过 LISTEN 或轮询获取任务通知
2. 使用 `SELECT FOR UPDATE SKIP LOCKED` 批量获取任务
3. 更新任务状态为 `processing`，设置 `locked_until`
4. 分发任务到 Worker Pool
5. Worker 执行 Handler 函数
6. 成功：状态变更为 `completed`
7. 失败：根据重试策略决定重新调度或标记为 `failed`

## Key Design Decisions

### 1. SKIP LOCKED vs 乐观锁 (SQLite 兼容)

**Decision**: PostgreSQL 使用 `SKIP LOCKED`，SQLite 使用乐观锁 + CAS

**PostgreSQL 策略**:
```sql
SELECT ... FOR UPDATE SKIP LOCKED
```
- 非阻塞式任务获取，多 Worker 并发无锁冲突
- 与 Redis 的 BRPOP 类似的语义

**SQLite 策略**:
```sql
UPDATE _jobs SET status = 'processing' ...
WHERE id = (SELECT id FROM _jobs WHERE status = 'pending' ... LIMIT 1)
AND status = 'pending'  -- CAS 条件
RETURNING ...
```
- 使用子查询 + CAS 条件实现原子获取
- 如果并发冲突（影响 0 行），Worker 立即重试
- 利用 SQLite 的写锁串行化保证正确性

**Trade-off**: SQLite 在高并发场景下性能较低，但保证正确性

### 2. 时间计算兼容性

**Decision**: 使用 Go 计算时间后传参，避免数据库语法差异

**Rationale**:
- PostgreSQL: `NOW() + INTERVAL '5 minutes'`
- SQLite: `datetime('now', '+5 minutes')`
- 统一方案: Go 计算 `time.Now().Add(5*time.Minute)` 后作为参数传入

### 3. 任务状态设计

**Decision**: 四状态模型 `pending -> processing -> completed/failed`

**Rationale**:
- 简单清晰，覆盖任务完整生命周期
- `processing` 状态配合 `locked_until` 实现崩溃恢复
- `failed` 状态保留任务记录，支持手动重试

### 3. 重试策略

**Decision**: 指数退避（Exponential Backoff）

**Formula**: `run_at = NOW() + (retries^2 * 1 minute)`

| Retry | Delay |
|-------|-------|
| 1 | 1 min |
| 2 | 4 min |
| 3 | 9 min |

**Rationale**:
- 防止故障服务被重试流量打死
- 给予系统恢复时间
- 业界标准实践

### 4. Worker 池设计

**Decision**: 固定大小 Goroutine 池

**Default**: 10 Workers

**Rationale**:
- 控制并发度，避免资源耗尽
- Goroutine 轻量，10 个 Worker 开销极小
- 可通过配置调整

### 5. 通知机制

**Decision**: 轮询为主，PostgreSQL 可选 LISTEN/NOTIFY 优化

**Rationale**:
- SQLite 不支持 LISTEN/NOTIFY，必须使用轮询
- 统一使用轮询作为默认策略，保证两种数据库行为一致
- PostgreSQL 环境可通过配置启用 LISTEN/NOTIFY 优化（可选）
- 默认轮询间隔 1 秒

### 6. Admin UI 集成

**Decision**: 作为系统级功能，仅 Superuser 可访问

**Rationale**:
- 任务队列是基础设施，非业务数据
- 避免普通用户误操作
- 与 Settings、Logs 等系统功能保持一致

## Database Schema

### PostgreSQL

```sql
-- _jobs 系统表
CREATE TABLE _jobs (
    id TEXT PRIMARY KEY,                    -- UUID v7 (时间有序)
    topic TEXT NOT NULL,                    -- 任务类型 (e.g. 'mail_digest')
    payload JSONB NOT NULL DEFAULT '{}',    -- 参数数据
    status TEXT NOT NULL DEFAULT 'pending', -- pending/processing/completed/failed
    run_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(), -- 调度时间
    locked_until TIMESTAMP WITHOUT TIME ZONE, -- 可见性超时
    retries INTEGER NOT NULL DEFAULT 0,     -- 当前重试次数
    max_retries INTEGER NOT NULL DEFAULT 3, -- 最大重试次数
    last_error TEXT,                        -- 错误堆栈
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引：按状态和调度时间查询待执行任务
CREATE INDEX idx_jobs_pending ON _jobs (status, run_at) 
WHERE status = 'pending';

-- 索引：按 topic 查询
CREATE INDEX idx_jobs_topic ON _jobs (topic);

-- 索引：按状态查询
CREATE INDEX idx_jobs_status ON _jobs (status);

-- 索引：过期锁查询（崩溃恢复）
CREATE INDEX idx_jobs_locked ON _jobs (locked_until) 
WHERE status = 'processing';
```

### SQLite

```sql
-- _jobs 系统表
CREATE TABLE _jobs (
    id TEXT PRIMARY KEY,                    -- UUID v7 (时间有序)
    topic TEXT NOT NULL,                    -- 任务类型 (e.g. 'mail_digest')
    payload TEXT NOT NULL DEFAULT '{}',     -- 参数数据 (JSON 字符串)
    status TEXT NOT NULL DEFAULT 'pending', -- pending/processing/completed/failed
    run_at TEXT NOT NULL DEFAULT (datetime('now')), -- 调度时间 (ISO 8601)
    locked_until TEXT,                      -- 可见性超时 (ISO 8601)
    retries INTEGER NOT NULL DEFAULT 0,     -- 当前重试次数
    max_retries INTEGER NOT NULL DEFAULT 3, -- 最大重试次数
    last_error TEXT,                        -- 错误堆栈
    created TEXT NOT NULL DEFAULT (datetime('now')),
    updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引：按状态和调度时间查询待执行任务
CREATE INDEX idx_jobs_pending ON _jobs (status, run_at);

-- 索引：按 topic 查询
CREATE INDEX idx_jobs_topic ON _jobs (topic);

-- 索引：按状态查询
CREATE INDEX idx_jobs_status ON _jobs (status);

-- 索引：过期锁查询（崩溃恢复）
CREATE INDEX idx_jobs_locked ON _jobs (status, locked_until);
```

### Schema 差异说明

| 字段 | PostgreSQL | SQLite | 说明 |
|------|------------|--------|------|
| payload | `JSONB` | `TEXT` | SQLite 无原生 JSON 类型，使用 TEXT 存储 |
| 时间字段 | `TIMESTAMP` | `TEXT` | SQLite 使用 ISO 8601 字符串 |
| 部分索引 | `WHERE status = 'pending'` | 不支持 | SQLite 使用普通索引 |

## API Design

### Core Interface

```go
type JobStore interface {
    // 入队操作
    Enqueue(topic string, payload any) (string, error)
    EnqueueAt(topic string, payload any, runAt time.Time) (string, error)
    EnqueueTx(tx *sql.Tx, topic string, payload any) (string, error)  // 事务入队
    
    // 查询操作
    Get(id string) (*Job, error)
    List(filter JobFilter) ([]*Job, int, error)
    Stats() (*JobStats, error)
    
    // 管理操作
    Requeue(id string) error
    Delete(id string) error
    
    // Worker 操作
    Register(topic string, handler JobHandler) error
    Start() error
    Stop() error
}

type Job struct {
    ID          string         `json:"id"`
    Topic       string         `json:"topic"`
    Payload     map[string]any `json:"payload"`
    Status      string         `json:"status"`
    RunAt       time.Time      `json:"run_at"`
    LockedUntil *time.Time     `json:"locked_until,omitempty"`
    Retries     int            `json:"retries"`
    MaxRetries  int            `json:"max_retries"`
    LastError   string         `json:"last_error,omitempty"`
    Created     time.Time      `json:"created"`
    Updated     time.Time      `json:"updated"`
}

type JobHandler func(job *Job) error

type JobFilter struct {
    Topic  string
    Status string
    Limit  int
    Offset int
}

type JobStats struct {
    Pending          int     `json:"pending"`
    Processing       int     `json:"processing"`
    Completed        int     `json:"completed"`
    Failed           int     `json:"failed"`
    SuccessRate      float64 `json:"success_rate"`
    AvgExecutionTime int64   `json:"avg_execution_time"` // ms
}
```

### Usage Example

```go
// 获取 Jobs 实例
jobs := app.Jobs()

// 注册 Worker
jobs.Register("mail_digest", func(job *core.Job) error {
    var payload struct {
        UserID string `json:"userId"`
    }
    if err := json.Unmarshal(job.Payload, &payload); err != nil {
        return err
    }
    
    // 发送邮件摘要
    return sendMailDigest(payload.UserID)
})

// 入队任务
jobID, _ := jobs.Enqueue("mail_digest", map[string]any{
    "userId": "123",
})

// 延时任务
jobID, _ := jobs.EnqueueAt("check_payment", map[string]any{
    "orderId": "456",
}, time.Now().Add(15*time.Minute))

// 事务入队
app.RunInTransaction(func(txApp core.App) error {
    order := &Order{...}
    if err := txApp.Save(order); err != nil {
        return err
    }
    _, err := txApp.Jobs().EnqueueTx(tx, "check_payment", map[string]any{
        "orderId": order.ID,
    })
    return err
})
```

## HTTP API Design

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/jobs/enqueue` | 入队任务 | enqueue_rule |
| GET | `/api/jobs/:id` | 获取任务详情 | manage_rule |
| GET | `/api/jobs` | 列表查询 | manage_rule |
| POST | `/api/jobs/:id/requeue` | 重新入队 | manage_rule |
| DELETE | `/api/jobs/:id` | 删除任务 | manage_rule |
| GET | `/api/jobs/stats` | 获取统计 | manage_rule |

### Request/Response Examples

```bash
# Enqueue
POST /api/jobs/enqueue
Content-Type: application/json
Authorization: Bearer <token>

{
    "topic": "mail_digest",
    "payload": {"userId": "123"},
    "runAt": "2026-01-08T12:00:00Z",  // 可选
    "maxRetries": 5                    // 可选，默认 3
}

# Response
{
    "id": "01HQXYZ1234567890",
    "topic": "mail_digest",
    "status": "pending",
    "run_at": "2026-01-08T12:00:00Z",
    "created": "2026-01-08T10:00:00Z"
}

# Get
GET /api/jobs/01HQXYZ1234567890
Authorization: Bearer <token>

# Response
{
    "id": "01HQXYZ1234567890",
    "topic": "mail_digest",
    "payload": {"userId": "123"},
    "status": "completed",
    "run_at": "2026-01-08T12:00:00Z",
    "retries": 0,
    "max_retries": 3,
    "created": "2026-01-08T10:00:00Z",
    "updated": "2026-01-08T12:00:05Z"
}

# List
GET /api/jobs?topic=mail_digest&status=pending&limit=20&offset=0
Authorization: Bearer <token>

# Response
{
    "items": [...],
    "total": 100,
    "limit": 20,
    "offset": 0
}

# Stats
GET /api/jobs/stats
Authorization: Bearer <token>

# Response
{
    "pending": 100,
    "processing": 5,
    "completed": 1000,
    "failed": 10,
    "success_rate": 0.99,
    "avg_execution_time": 1500
}
```

### Access Control Configuration

```go
// Jobs 访问控制配置
type JobsSettings struct {
    // 是否启用 HTTP API (默认 true)
    HTTPEnabled bool `json:"http_enabled"`
    
    // 入队权限规则
    // 空字符串 = 仅 Superuser
    // "true" = 公开访问
    // "@request.auth.id != ''" = 需要认证
    EnqueueRule string `json:"enqueue_rule"`
    
    // 管理权限规则 (get, list, requeue, delete, stats)
    ManageRule string `json:"manage_rule"`
    
    // Topic 白名单（可选）
    // 限制客户端只能入队特定 Topic
    AllowedTopics []string `json:"allowed_topics"`
    
    // Worker 配置
    WorkerPoolSize int           `json:"worker_pool_size"` // 默认 10
    PollInterval   time.Duration `json:"poll_interval"`    // 默认 1s
    LockDuration   time.Duration `json:"lock_duration"`    // 默认 5min
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 任务执行超时导致重复执行 | Medium | High | locked_until 机制 + 幂等性设计建议 |
| Worker 崩溃任务丢失 | Low | High | locked_until 过期后自动重新获取 |
| 高并发入队导致数据库压力 | Medium | Medium | SKIP LOCKED 无锁冲突 + 批量获取 |
| 重试风暴 | Low | High | 指数退避 + max_retries 限制 |
| Admin UI 误删任务 | Low | Medium | 仅允许删除 pending/failed 状态 |

## Performance Expectations

### PostgreSQL

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Enqueue | < 5ms | > 2000/sec |
| Fetch (SKIP LOCKED) | < 10ms | > 1000/sec |
| Execute (overhead) | < 1ms | - |
| List | < 50ms | - |
| Stats | < 100ms | - |

### SQLite

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Enqueue | < 10ms | > 500/sec |
| Fetch (CAS) | < 20ms | > 200/sec |
| Execute (overhead) | < 1ms | - |
| List | < 100ms | - |
| Stats | < 200ms | - |

**结论**:
- PostgreSQL 适合生产环境和高并发场景
- SQLite 适合开发环境和低并发场景（每秒 100-500 任务）
- 超过 SQLite 性能上限时，建议迁移到 PostgreSQL

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| github.com/google/uuid | v1.6.0 | UUID v7 生成 |

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| core/base.go | App 结构体集成 |
| core/db_connect.go | PostgreSQL 连接 |
| migrations/ | 系统表迁移 |
| apis/ | HTTP API 路由 |
| ui/ | Admin UI 组件 |

## Testing Strategy

### Unit Tests
- 每个操作的正确性测试
- 边界条件测试（空 Payload、超大 Payload、无效 Topic）
- 重试策略测试

### Integration Tests
- Dispatcher + Worker 联动测试
- 崩溃恢复测试
- HTTP API 端到端测试

### Benchmark Tests
- Enqueue 吞吐量基准
- SKIP LOCKED 并发获取基准
- 10 Worker 并发执行基准

### Load Tests
- 10000 任务入队测试
- 100 并发 Worker 测试
