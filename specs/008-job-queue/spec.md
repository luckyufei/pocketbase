# Feature Specification: PocketBase Native Job Queue (`_jobs`)

**Feature Branch**: `008-job-queue`  
**Created**: 2026-01-08  
**Status**: Ready for Dev  
**Input**: Research document: `specs/_research/job-queue.md`

## 1. Problem Essence (核心问题)

AI Agent 场景（如 RAG 索引构建、长文本生成）通常耗时较长（分钟级），直接在 HTTP 请求中同步处理会导致网关超时（Vercel 限制 10s-60s）及用户体验阻塞。引入 Redis/Celery 虽能解决，但破坏了 PocketBase "单体应用" 的架构简洁性，增加了运维负担。

**核心理念**: "Database is the only queue you need."

## 2. Database Compatibility (数据库兼容性)

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

**工作原理**:
1. 子查询选择一个待执行任务
2. 外层 UPDATE 使用 `AND status = 'pending'` 作为 CAS 条件
3. 如果另一个 Worker 已经获取该任务，UPDATE 影响 0 行
4. Worker 检测到 0 行更新，立即重试获取下一个任务

### 2.3 性能预期

| 场景 | PostgreSQL | SQLite |
|------|------------|--------|
| 单 Worker 吞吐量 | ~2000 jobs/sec | ~500 jobs/sec |
| 10 Worker 并发 | ~10000 jobs/sec | ~800 jobs/sec（写锁串行） |
| 推荐使用场景 | 生产环境、高并发 | 开发环境、低并发 |

**SQLite 限制说明**:
- SQLite 写操作串行化，多 Worker 并发时存在锁竞争
- 适合每秒 100-500 任务的场景
- 超过此规模建议迁移到 PostgreSQL

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 任务入队 (Priority: P1)

作为开发者，我希望能够将异步任务入队，以便在后台处理耗时操作而不阻塞 HTTP 请求。

**Why this priority**: 这是 Job Queue 的核心功能，是所有其他高级特性的基础。

**Independent Test**: 可以通过调用 `jobs.Enqueue()` 验证任务成功入队。

**Acceptance Scenarios**:

1. **Given** Job Queue 已初始化, **When** 调用 `jobs.Enqueue("mail_digest", {"userId": "123"})`, **Then** 任务成功入队，返回 jobId
2. **Given** 任务已入队, **When** 查询任务状态, **Then** 状态为 `pending`
3. **Given** 任务入队, **When** 指定 `runAt` 为未来时间, **Then** 任务在指定时间后才会被执行
4. **Given** 任务入队, **When** Payload 超过 1MB, **Then** 返回 `ErrPayloadTooLarge`
5. **Given** 业务数据写入与任务入队在同一事务, **When** 事务提交, **Then** 两者原子性保证

---

### User Story 2 - 任务执行 (Priority: P1)

作为开发者，我希望能够注册任务处理器（Worker），以便后台自动执行入队的任务。

**Why this priority**: 任务执行是 Job Queue 的核心能力，与入队同等重要。

**Independent Test**: 可以通过注册 Worker 并入队任务，验证任务被自动执行。

**Acceptance Scenarios**:

1. **Given** Worker 已注册, **When** 任务入队, **Then** Worker 自动获取并执行任务
2. **Given** 任务执行中, **When** 任务状态变更, **Then** 状态为 `processing`
3. **Given** 任务执行成功, **When** 任务完成, **Then** 状态变更为 `completed`
4. **Given** 任务执行失败, **When** 抛出 Error, **Then** 状态变更为 `failed`，记录错误信息
5. **Given** 多个 Worker 并发, **When** 同时拉取任务, **Then** 每个任务只被一个 Worker 执行（SKIP LOCKED）

---

### User Story 3 - 延时任务 (Priority: P1)

作为开发者，我希望能够调度延时任务，以便在指定时间后执行（如 15 分钟后检查支付状态）。

**Why this priority**: 延时任务是常见的业务场景，如订单超时取消、定时提醒等。

**Independent Test**: 可以通过设置 `runAt` 为未来时间，验证任务在指定时间后执行。

**Acceptance Scenarios**:

1. **Given** 任务入队时设置 `runAt = NOW() + 15min`, **When** 当前时间 < runAt, **Then** 任务不会被执行
2. **Given** 任务入队时设置 `runAt = NOW() + 15min`, **When** 当前时间 >= runAt, **Then** 任务被 Worker 拉取执行
3. **Given** 延时任务已入队, **When** 查询任务状态, **Then** 可以看到预计执行时间

---

### User Story 4 - 失败重试 (Priority: P1)

作为开发者，我希望失败的任务能够自动重试，以便处理临时性故障（如网络抖动）。

**Why this priority**: 重试机制是可靠队列的核心能力，保证任务最终执行。

**Independent Test**: 可以通过模拟任务失败，验证任务按指数退避策略重试。

**Acceptance Scenarios**:

1. **Given** 任务执行失败, **When** retries < max_retries, **Then** 任务按指数退避重新调度
2. **Given** 任务第 1 次失败, **When** 重新调度, **Then** `run_at = NOW() + 1min`
3. **Given** 任务第 2 次失败, **When** 重新调度, **Then** `run_at = NOW() + 4min`
4. **Given** 任务第 3 次失败, **When** retries >= max_retries, **Then** 状态变更为 `failed`（死信）
5. **Given** 任务失败, **When** 记录错误, **Then** `last_error` 字段保存错误堆栈

---

### User Story 5 - 崩溃恢复 (Priority: P1)

作为开发者，我希望 Worker 崩溃后任务能够被其他 Worker 接管，以便保证任务不丢失。

**Why this priority**: 崩溃恢复是生产环境的必备能力，保证系统韧性。

**Independent Test**: 可以通过模拟 Worker 崩溃，验证任务被其他 Worker 接管。

**Acceptance Scenarios**:

1. **Given** Worker 正在处理任务, **When** Worker 进程崩溃, **Then** 任务状态仍为 `processing`
2. **Given** 任务 `locked_until` 已过期, **When** 其他 Worker 拉取任务, **Then** 任务被接管执行
3. **Given** 默认 `locked_until = NOW() + 5min`, **When** 任务处理超时, **Then** 5 分钟后任务可被重新获取
4. **Given** 任务被接管, **When** 执行成功, **Then** 状态正常变更为 `completed`

---

### User Story 6 - 管理后台查看 (Priority: P1)

作为管理员，我希望能够在 Admin UI 中查看任务队列状态，以便监控和管理异步任务。

**Why this priority**: 可视化管理是运维的核心需求，便于排查问题和监控系统健康。

**Independent Test**: 可以通过 Admin UI 访问 Jobs 面板，查看任务列表和状态统计。

**Acceptance Scenarios**:

1. **Given** 登录 Admin UI, **When** 访问 Jobs 面板, **Then** 显示任务列表（分页）
2. **Given** Jobs 面板, **When** 查看任务, **Then** 显示 topic、status、run_at、retries、last_error 等字段
3. **Given** Jobs 面板, **When** 筛选状态, **Then** 可按 pending/processing/completed/failed 筛选
4. **Given** Jobs 面板, **When** 查看失败任务, **Then** 可以看到错误详情
5. **Given** 失败任务, **When** 点击 "Re-queue", **Then** 任务重新入队（status=pending, retries=0）
6. **Given** Jobs 面板, **When** 查看统计, **Then** 显示各状态任务数量、成功率、平均执行时间

---

### User Story 7 - HTTP API 操作 (Priority: P1)

作为开发者，我希望能够通过 HTTP API 操作任务队列，以便在前端或第三方服务中使用 Job Queue 功能。

**Why this priority**: HTTP API 是 Job Queue 对外暴露的核心接口，JS SDK 依赖此能力。

**Independent Test**: 可以通过 curl 或 JS SDK 调用 HTTP 端点验证功能。

**Acceptance Scenarios**:

1. **Given** 已认证用户, **When** `POST /api/jobs/enqueue` with `{"topic": "mail_digest", "payload": {...}}`, **Then** 返回 `{"id": "...", "status": "pending"}`
2. **Given** 任务已入队, **When** `GET /api/jobs/:id`, **Then** 返回任务详情（status、run_at、retries 等）
3. **Given** 任务已入队, **When** `GET /api/jobs?topic=mail_digest&status=pending`, **Then** 返回任务列表
4. **Given** 失败任务, **When** `POST /api/jobs/:id/requeue`, **Then** 任务重新入队
5. **Given** 任务, **When** `DELETE /api/jobs/:id`, **Then** 任务被删除（仅限 pending/failed 状态）
6. **Given** 未认证用户, **When** 调用任意 Jobs API, **Then** 返回 `401 Unauthorized`
7. **Given** 非 Superuser, **When** 调用 Jobs API, **Then** 根据 `access_rule` 判断权限

**HTTP API 端点设计**:

```
# 任务操作
POST   /api/jobs/enqueue     - 入队任务 (body: {topic, payload, runAt?, maxRetries?})
GET    /api/jobs/:id         - 获取任务详情
GET    /api/jobs             - 列表查询 (query: topic?, status?, limit?, offset?)
POST   /api/jobs/:id/requeue - 重新入队失败任务
DELETE /api/jobs/:id         - 删除任务

# 统计信息
GET    /api/jobs/stats       - 获取队列统计 (各状态数量、成功率等)
```

---

### User Story 8 - JS SDK 集成 (Priority: P1)

作为前端开发者，我希望能够通过 JS SDK 操作任务队列，以便在客户端应用中使用 Job Queue 功能。

**Why this priority**: JS SDK 是前端开发者的主要接口，提供类型安全和便捷的 API。

**Independent Test**: 可以通过 JS SDK 调用 `pb.jobs.enqueue()` 验证功能。

**Acceptance Scenarios**:

1. **Given** JS SDK 已初始化, **When** 调用 `pb.jobs.enqueue("mail_digest", {userId: "123"})`, **Then** 返回 jobId
2. **Given** 任务已入队, **When** 调用 `pb.jobs.get(jobId)`, **Then** 返回任务详情
3. **Given** 任务列表, **When** 调用 `pb.jobs.list({topic: "mail_digest", status: "pending"})`, **Then** 返回任务列表
4. **Given** 失败任务, **When** 调用 `pb.jobs.requeue(jobId)`, **Then** 任务重新入队
5. **Given** 延时任务, **When** 调用 `pb.jobs.enqueue("check_payment", {orderId: "456"}, {runAt: new Date(...)})`, **Then** 任务在指定时间后执行

---

### User Story 9 - 访问控制 (Priority: P1)

作为管理员，我希望能够配置 Jobs API 的访问权限，以便控制哪些用户可以操作任务队列。

**Why this priority**: 安全是核心需求，任务队列可能包含敏感业务数据。

**Independent Test**: 可以通过配置不同的 access_rule 验证权限控制。

**Acceptance Scenarios**:

1. **Given** `access_rule = ""`, **When** 任意用户调用 Jobs API, **Then** 仅 Superuser 可访问
2. **Given** `access_rule = "true"`, **When** 任意用户调用 Jobs API, **Then** 公开访问（无需认证）
3. **Given** `access_rule = "@request.auth.id != ''"`, **When** 已认证用户调用, **Then** 允许访问
4. **Given** 不同操作类型, **When** 配置 `enqueue_rule` 和 `manage_rule`, **Then** 入队和管理权限分开控制

**访问控制配置**:

```go
// 在 _settings 或 App 配置中
type JobsSettings struct {
    // 入队权限规则 (enqueue)
    EnqueueRule string `json:"enqueue_rule"`
    
    // 管理权限规则 (get, list, requeue, delete, stats)
    ManageRule string `json:"manage_rule"`
    
    // 是否启用 HTTP API (默认 true)
    HTTPEnabled bool `json:"http_enabled"`
    
    // Topic 白名单 (可选，限制客户端只能入队特定 Topic)
    AllowedTopics []string `json:"allowed_topics"`
}
```

---

### User Story 10 - Go Worker 注册 (Priority: P1)

作为后端开发者，我希望能够在 Go 代码中注册 Worker 处理器，以便处理异步任务。

**Why this priority**: Go Worker 是服务端处理任务的核心方式。

**Independent Test**: 可以通过注册 Worker 并入队任务，验证任务被执行。

**Acceptance Scenarios**:

1. **Given** Go 应用启动, **When** 注册 Worker `app.Jobs().Register("mail_digest", handler)`, **Then** Worker 开始监听任务
2. **Given** Worker 已注册, **When** 任务入队, **Then** handler 函数被调用
3. **Given** handler 返回 nil, **When** 任务完成, **Then** 状态变更为 `completed`
4. **Given** handler 返回 error, **When** 任务失败, **Then** 状态变更为 `failed`，触发重试
5. **Given** 多个 Worker 注册同一 Topic, **When** 任务入队, **Then** 任务被负载均衡到不同 Worker

---

### Edge Cases

- Payload 超过 1MB 如何处理？返回 `ErrPayloadTooLarge` / HTTP 400
- 任务执行超过 10 分钟如何处理？Worker 应拆分为子任务，或使用专门的 Batch Compute
- Topic 不存在对应 Worker 如何处理？任务保持 `pending` 状态，等待 Worker 注册
- 数据库连接失败时如何处理？Dispatcher 重试连接，任务不丢失
- 高并发入队如何处理？PostgreSQL `SKIP LOCKED` 支持高并发，无锁冲突
- 任务 ID 冲突如何处理？使用 UUID v7（时间有序），几乎不可能冲突
- 删除正在执行的任务如何处理？仅允许删除 pending/failed 状态的任务

---

### Assumptions

1. 任务队列数据持久化，数据库崩溃后不丢失
2. 单机部署场景，多 Worker 通过 Goroutine 实现
3. Topic 命名遵循小写下划线风格（如 `mail_digest`）
4. Payload 支持 JSON 对象，最大 1MB
5. 默认 Worker 池大小为 10，可通过配置调整
6. HTTP API 默认启用，可通过配置禁用
7. HTTP API 遵循 PocketBase 现有的认证机制（Bearer Token / Cookie）
8. Admin UI 的 Jobs 面板作为系统级功能，仅 Superuser 可访问
9. **同时支持 SQLite 和 PostgreSQL 数据库**
10. SQLite 使用乐观锁策略，PostgreSQL 使用 `SKIP LOCKED` 策略

---

## Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 支持任务入队（Enqueue）| P1 | US1 |
| FR-002 | 支持延时任务（runAt 调度）| P1 | US3 |
| FR-003 | 支持任务状态管理（pending/processing/completed/failed）| P1 | US2 |
| FR-004 | 支持 Worker 注册和任务分发 | P1 | US2, US10 |
| FR-005 | 支持 SKIP LOCKED 并发任务获取 | P1 | US2 |
| FR-006 | 支持失败重试（指数退避）| P1 | US4 |
| FR-007 | 支持死信处理（max_retries 后标记 failed）| P1 | US4 |
| FR-008 | 支持崩溃恢复（locked_until 超时后重新获取）| P1 | US5 |
| FR-009 | 支持 Admin UI Jobs 面板 | P1 | US6 |
| FR-010 | 支持任务列表查看和筛选 | P1 | US6 |
| FR-011 | 支持失败任务重新入队（Re-queue）| P1 | US6, US7 |
| FR-012 | 支持队列统计（各状态数量、成功率）| P2 | US6, US7 |
| FR-013 | 支持 HTTP API 端点 (/api/jobs/*) | P1 | US7 |
| FR-014 | 支持 HTTP API 认证（Bearer Token / Cookie）| P1 | US7 |
| FR-015 | 支持 HTTP API 权限控制（enqueue_rule / manage_rule）| P1 | US9 |
| FR-016 | 支持 JS SDK 集成 | P1 | US8 |
| FR-017 | 支持 Go Worker 注册 | P1 | US10 |
| FR-018 | 支持 Payload 大小限制（1MB）| P2 | US1 |
| FR-019 | 支持任务执行时间限制（默认 10 分钟）| P2 | US2 |
| FR-020 | 支持 LISTEN/NOTIFY 实时通知（减少轮询延迟）| P3 | US2 |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 任务入队延迟 | < 5ms | Benchmark 测试 |
| SC-002 | 任务获取延迟（SKIP LOCKED）| < 10ms | Benchmark 测试 |
| SC-003 | 并发 Worker 任务分发正确性 | 100% | 100 并发 Worker 测试 |
| SC-004 | 崩溃恢复成功率 | 100% | 模拟 Worker 崩溃测试 |
| SC-005 | 重试机制正确性 | 100% | 指数退避验证测试 |
| SC-006 | HTTP API 响应延迟 | < 20ms (P99) | Benchmark 测试 |
| SC-007 | 队列吞吐量 | > 1000 jobs/sec | 压力测试 |
| SC-008 | 测试覆盖率 | > 80% | go test -cover |

---

## JS SDK API 设计预览

```javascript
// 初始化
const pb = new PocketBase('http://localhost:8090');
await pb.authWithPassword('user@example.com', 'password');

// 入队任务
const job = await pb.jobs.enqueue('mail_digest', { userId: '123' });
console.log(job.id);  // "1234567890123456789"

// 延时任务
const job = await pb.jobs.enqueue('check_payment', { orderId: '456' }, {
    runAt: new Date(Date.now() + 15 * 60 * 1000)  // 15分钟后执行
});

// 获取任务详情
const job = await pb.jobs.get('1234567890123456789');
console.log(job.status);  // "pending" | "processing" | "completed" | "failed"

// 列表查询
const jobs = await pb.jobs.list({
    topic: 'mail_digest',
    status: 'failed',
    limit: 20,
    offset: 0
});

// 重新入队
await pb.jobs.requeue('1234567890123456789');

// 删除任务
await pb.jobs.delete('1234567890123456789');

// 获取统计
const stats = await pb.jobs.stats();
console.log(stats);
// {
//   pending: 100,
//   processing: 5,
//   completed: 1000,
//   failed: 10,
//   successRate: 0.99,
//   avgExecutionTime: 1500  // ms
// }
```

---

## Go Worker API 设计预览

```go
// 获取 Jobs 实例
jobs := app.Jobs()

// 注册 Worker
jobs.Register("mail_digest", func(job *core.Job) error {
    var payload struct {
        UserID string `json:"userId"`
    }
    if err := job.Unmarshal(&payload); err != nil {
        return err
    }
    
    // 业务逻辑
    log.Printf("Processing job %s for user %s", job.ID, payload.UserID)
    
    // 返回 nil 表示成功
    return nil
})

// 入队任务
jobID, err := jobs.Enqueue("mail_digest", map[string]any{
    "userId": "123",
})

// 延时任务
jobID, err := jobs.EnqueueAt("check_payment", map[string]any{
    "orderId": "456",
}, time.Now().Add(15*time.Minute))

// 在事务中入队（保证原子性）
app.RunInTransaction(func(txApp core.App) error {
    // 创建订单
    order := &Order{...}
    if err := txApp.Save(order); err != nil {
        return err
    }
    
    // 入队任务（与订单创建在同一事务）
    _, err := txApp.Jobs().Enqueue("check_payment", map[string]any{
        "orderId": order.ID,
    })
    return err
})
```

---

## Admin UI Jobs 面板设计

### 任务列表视图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Jobs                                                    [Refresh] [▼]  │
├─────────────────────────────────────────────────────────────────────────┤
│  Status: [All ▼]  Topic: [All ▼]  Search: [________________] [Search]  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Stats                                                           │   │
│  │ Pending: 100  Processing: 5  Completed: 1000  Failed: 10       │   │
│  │ Success Rate: 99%  Avg Execution: 1.5s                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ID          │ Topic        │ Status     │ Run At      │ Actions       │
├─────────────────────────────────────────────────────────────────────────┤
│  ...5678901  │ mail_digest  │ ● pending  │ 2026-01-08  │ [View] [Del]  │
│  ...5678902  │ check_pay    │ ● process  │ 2026-01-08  │ [View]        │
│  ...5678903  │ pdf_embed    │ ● failed   │ 2026-01-08  │ [View] [Retry]│
│  ...5678904  │ mail_digest  │ ○ complete │ 2026-01-08  │ [View] [Del]  │
├─────────────────────────────────────────────────────────────────────────┤
│  [< Prev]  Page 1 of 10  [Next >]                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 任务详情视图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Job: 1234567890123456789                                [Back] [Retry] │
├─────────────────────────────────────────────────────────────────────────┤
│  Topic:       mail_digest                                               │
│  Status:      ● failed                                                  │
│  Created:     2026-01-08 10:00:00                                       │
│  Run At:      2026-01-08 10:00:00                                       │
│  Retries:     3 / 3                                                     │
│  Locked Until: 2026-01-08 10:05:00                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Payload:                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ {                                                               │   │
│  │   "userId": "123",                                              │   │
│  │   "email": "user@example.com"                                   │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  Last Error:                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Error: SMTP connection failed                                   │   │
│  │   at sendMail (mail.go:42)                                      │   │
│  │   at mailDigestWorker (workers.go:15)                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```
