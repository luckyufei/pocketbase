# Feature Specification: PocketBase Unified Observability (`_traces`)

**Feature Branch**: `009-unified-observability`  
**Created**: 2026-01-08  
**Status**: Ready for Dev  
**Input**: Research document: `specs/_research/unified-observability.md`

## 1. Problem Essence (核心问题)

PocketBase 需要适应两种极端的部署场景：

1. **Enterprise (PostgreSQL)**: 高并发写入，数据量大，要求不锁表。
2. **Portable (SQLite)**: 单机部署，文件系统 I/O 敏感，要求不阻塞业务库 (`data.db`)。

观测系统产生的是**高吞吐流式数据**，如果处理不好，在 PostgreSQL 下会产生大量 WAL 日志，在 SQLite 下会产生严重的写锁争用 (database locked)。

**核心理念**: "One Interface, Two Engines." (统一抽象，双引擎实现)

## 2. Database Compatibility (数据库兼容性)

PocketBase 同时支持 **SQLite** 和 **PostgreSQL**，Unified Observability 必须在两种数据库上都能正常工作。

### 2.1 特性差异与兼容策略

| 特性 | PostgreSQL | SQLite | 兼容策略 |
|------|------------|--------|----------|
| 表类型 | `UNLOGGED TABLE` (无 WAL) | 普通表 | PG 使用 UNLOGGED 减少 I/O |
| 批量写入 | `COPY FROM STDIN` | 批量 INSERT | 使用各自最优方案 |
| JSON 存储 | `JSONB` + GIN 索引 | `TEXT` + json_extract | 使用 Go 封装方言差异 |
| 数据隔离 | 同一数据库 | 独立文件 `auxiliary.db` | SQLite 隔离业务 I/O |
| 并发性能 | 高（行级锁） | 中（写锁串行） | SQLite 适合低并发场景 |

### 2.2 SQLite 写入策略

由于 SQLite 写操作串行化，采用 **独立数据库 + 缓冲队列** 策略：

- **数据库隔离**: 观测数据写入独立的 `pb_data/auxiliary.db`，不影响业务主库 `data.db`
- **WAL 模式**: `PRAGMA journal_mode = WAL;` 支持读写并发
- **同步模式**: `PRAGMA synchronous = NORMAL;` 牺牲极端可靠性换取性能
- **缓冲队列**: Ring Buffer 缓冲写入，批量 Flush 减少 I/O 次数

### 2.3 PostgreSQL 写入策略

PostgreSQL 使用 **UNLOGGED TABLE + COPY 协议** 策略：

- **UNLOGGED TABLE**: 不写 WAL 日志，写入速度接近 Redis（崩溃数据可丢）
- **COPY 协议**: 使用 `COPY FROM STDIN` 批量灌入，而非逐条 INSERT
- **JSONB 索引**: 使用 GIN 索引支持 JSON 字段查询

### 2.4 性能预期

| 场景 | PostgreSQL | SQLite |
|------|------------|--------|
| 单 Writer 吞吐量 | ~5000 spans/sec | ~500 spans/sec |
| 批量写入延迟 | < 5ms | < 20ms |
| 推荐使用场景 | 生产环境、高并发 | 开发环境、低并发 |

**SQLite 限制说明**:
- 写入缓冲队列超过 5000 条积压时，**直接丢弃**新来的 Span
- 业务优先，监控次之
- 超过性能上限建议迁移到 PostgreSQL

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trace 数据采集 (Priority: P1)

作为开发者，我希望能够记录 Trace Span 数据，以便追踪请求在系统中的完整链路。

**Why this priority**: 这是 Observability 的核心功能，是所有其他高级特性的基础。

**Independent Test**: 可以通过调用 `trace.RecordSpan()` 验证 Span 成功记录。

**Acceptance Scenarios**:

1. **Given** Trace 已初始化, **When** 调用 `trace.RecordSpan(span)`, **Then** Span 成功写入缓冲区
2. **Given** 缓冲区达到阈值, **When** 触发 Flush, **Then** Span 批量写入数据库
3. **Given** Span 记录, **When** 包含 trace_id/span_id/parent_id, **Then** 可以构建完整调用链
4. **Given** Span 记录, **When** 包含 attributes, **Then** 可以存储自定义元数据
5. **Given** SQLite 模式下缓冲区超过 5000 条, **When** 新 Span 到达, **Then** 新 Span 被丢弃

---

### User Story 2 - Trace 数据查询 (Priority: P1)

作为开发者，我希望能够查询 Trace 数据，以便分析请求链路和性能瓶颈。

**Why this priority**: 查询是 Observability 的核心能力，与采集同等重要。

**Independent Test**: 可以通过调用 `trace.Query()` 验证 Trace 数据可查询。

**Acceptance Scenarios**:

1. **Given** Trace 数据已记录, **When** 按 trace_id 查询, **Then** 返回完整调用链
2. **Given** Trace 数据已记录, **When** 按时间范围查询, **Then** 返回指定时间段的 Spans
3. **Given** Trace 数据已记录, **When** 按 operation name 筛选, **Then** 返回匹配的 Spans
4. **Given** Trace 数据已记录, **When** 按 status 筛选, **Then** 可按 OK/ERROR 筛选
5. **Given** PostgreSQL 模式, **When** 按 attributes 字段查询, **Then** 支持 JSONB 索引加速

---

### User Story 3 - 自动 HTTP 请求追踪 (Priority: P1)

作为开发者，我希望 PocketBase 自动追踪所有 HTTP 请求，以便无需手动埋点即可获得请求链路数据。

**Why this priority**: 自动追踪是开箱即用体验的关键，降低使用门槛。

**Independent Test**: 可以通过发送 HTTP 请求，验证自动生成 Trace Span。

**Acceptance Scenarios**:

1. **Given** Trace 已启用, **When** 收到 HTTP 请求, **Then** 自动创建 Root Span
2. **Given** HTTP 请求处理中, **When** 调用数据库操作, **Then** 自动创建 Child Span
3. **Given** HTTP 请求完成, **When** 响应返回, **Then** Span 自动结束并记录 duration
4. **Given** HTTP 请求失败, **When** 返回错误, **Then** Span 状态标记为 ERROR
5. **Given** HTTP 请求头包含 traceparent, **When** 处理请求, **Then** 继承上游 trace_id

---

### User Story 4 - 数据自动清理 (Priority: P1)

作为管理员，我希望 Trace 数据能够自动清理过期数据，以便控制存储空间。

**Why this priority**: 观测数据是临时数据，必须有自动清理机制。

**Independent Test**: 可以通过配置 retention 后，验证过期数据被自动删除。

**Acceptance Scenarios**:

1. **Given** 配置 retention = 7 天, **When** Cron 任务执行, **Then** 7 天前的数据被删除
2. **Given** 数据清理执行, **When** 删除大量数据, **Then** 使用批量删除避免长事务
3. **Given** 清理任务执行, **When** 记录日志, **Then** 显示删除的记录数

---

### User Story 5 - Monitor Center UI (Priority: P1)

作为管理员，我希望能够在 Admin UI 中查看 Trace 数据，以便可视化分析请求链路。

**Why this priority**: 可视化管理是运维的核心需求，便于排查问题和监控系统健康。

**Independent Test**: 可以通过 Admin UI 访问 Monitor Center，查看 Trace 列表和详情。

**Acceptance Scenarios**:

1. **Given** 登录 Admin UI, **When** 访问 Monitor Center, **Then** 显示 Trace 列表（分页）
2. **Given** Monitor Center, **When** 点击 Trace, **Then** 显示完整调用链（瀑布图）
3. **Given** Monitor Center, **When** 筛选时间范围, **Then** 可按时间段筛选
4. **Given** Monitor Center, **When** 筛选 operation, **Then** 可按操作名筛选
5. **Given** Monitor Center, **When** 筛选 status, **Then** 可按 OK/ERROR 筛选
6. **Given** Monitor Center, **When** 查看统计, **Then** 显示请求量、成功率、P99 延迟

---@mi

### User Story 6 - HTTP API 查询 (Priority: P1)

作为开发者，我希望能够通过 HTTP API 查询 Trace 数据，以便在第三方工具中使用。

**Why this priority**: HTTP API 是 Observability 对外暴露的核心接口。

**Independent Test**: 可以通过 curl 调用 HTTP 端点验证功能。

**Acceptance Scenarios**:

1. **Given** 已认证用户, **When** `GET '/api/traces?trace_id=xxx`, **Then** 返回完整调用链
2. **Given** 已认证用户, **When** `GET '/api/traces?start=xxx&end=xxx`, **Then** 返回时间范围内的 Traces
3. **Given** 已认证用户, **When** `GET '/api/traces/stats`, **Then** 返回统计数据
4. **Given** 未认证用户, **When** 调用任意 Trace API, **Then** 返回 `401 Unauthorized`
5. **Given** 非 Superuser, **When** 调用 Trace API, **Then** 返回 `403 Forbidden`

**HTTP API 端点设计**:

```
# Trace 查询
GET    '/api/traces              - 列表查询 (query: trace_id?, start?, end?, operation?, status?, limit?, offset?)
GET    '/api/traces/:trace_id    - 获取完整调用链

# 统计信息
GET    '/api/traces/stats        - 获取统计 (请求量、成功率、P99 延迟)
```

---

### User Story 7 - Go API 集成 (Priority: P1)

作为后端开发者，我希望能够在 Go 代码中手动创建 Span，以便追踪自定义业务逻辑。

**Why this priority**: Go API 是服务端扩展 Trace 的核心方式。

**Independent Test**: 可以通过调用 `trace.StartSpan()` 验证 Span 被记录。

**Acceptance Scenarios**:

1. **Given** Go 应用运行, **When** 调用 `trace.StartSpan(ctx, "operation")`, **Then** 创建新 Span
2. **Given** Span 已创建, **When** 调用 `span.End()`, **Then** Span 结束并记录 duration
3. **Given** Span 已创建, **When** 调用 `span.SetAttribute("key", "value")`, **Then** 属性被记录
4. **Given** Span 已创建, **When** 调用 `span.SetStatus(ERROR, "msg")`, **Then** 状态被记录
5. **Given** 父 Span 存在, **When** 创建子 Span, **Then** 自动继承 trace_id 和 parent_id

---

### Edge Cases

- 缓冲区满时如何处理？SQLite 模式下丢弃新 Span，PostgreSQL 模式下扩容或阻塞
- 数据库连接失败时如何处理？缓冲区暂存，重连后重试 Flush
- 超大 attributes 如何处理？限制单个 Span 的 attributes 大小（最大 64KB）
- 高并发写入如何处理？Ring Buffer + 批量写入，PostgreSQL 使用 COPY 协议
- 跨库查询如何处理？不支持跨库 JOIN，UI 层分别查询后补全
- SQLite 模式下 auxiliary.db 损坏如何处理？自动重建，观测数据可丢失

---

### Assumptions

1. 观测数据是临时数据，崩溃后可丢失（不影响业务）
2. 单机部署场景，多 Writer 通过 Goroutine 实现
3. trace_id 使用 32 字符 Hex，span_id 使用 16 字符 Hex
4. attributes 支持 JSON 对象，最大 64KB
5. 默认 retention 为 7 天，可通过配置调整
6. HTTP API 默认仅 Superuser 可访问
7. Admin UI 的 Monitor Center 作为系统级功能，仅 Superuser 可访问
8. **同时支持 SQLite 和 PostgreSQL 数据库**
9. SQLite 使用独立 auxiliary.db，PostgreSQL 使用 UNLOGGED TABLE
10. 观测系统**不参与**标准 Migration 流程，启动时自行检查并创建

---

## Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 支持 Trace Span 记录（RecordSpan）| P1 | US1 |
| FR-002 | 支持 Ring Buffer 缓冲写入 | P1 | US1 |
| FR-003 | 支持批量 Flush 到数据库 | P1 | US1 |
| FR-004 | 支持 Trace 数据查询（按 trace_id/时间/operation/status）| P1 | US2 |
| FR-005 | 支持自动 HTTP 请求追踪 | P1 | US3 |
| FR-006 | 支持自动数据库操作追踪 | P2 | US3 |
| FR-007 | 支持 traceparent 头解析（W3C Trace Context）| P2 | US3 |
| FR-008 | 支持数据自动清理（Prune）| P1 | US4 |
| FR-009 | 支持 Admin UI Monitor Center | P1 | US5 |
| FR-010 | 支持 Trace 列表查看和筛选 | P1 | US5 |
| FR-011 | 支持 Trace 瀑布图展示 | P2 | US5 |
| FR-012 | 支持统计数据展示（请求量、成功率、P99）| P2 | US5, US6 |
| FR-013 | 支持 HTTP API 端点 ('/api/traces/*) | P1 | US6 |
| FR-014 | 支持 HTTP API 认证（Bearer Token / Cookie）| P1 | US6 |
| FR-015 | 支持 Go API 手动创建 Span | P1 | US7 |
| FR-016 | 支持 Span attributes 设置 | P1 | US7 |
| FR-017 | 支持 Span status 设置 | P1 | US7 |
| FR-018 | 支持 SQLite 独立 auxiliary.db | P1 | US1 |
| FR-019 | 支持 PostgreSQL UNLOGGED TABLE | P1 | US1 |
| FR-020 | 支持 SQLite 缓冲区溢出丢弃策略 | P1 | US1 |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | Span 记录延迟（缓冲区写入）| < 1ms | Benchmark 测试 |
| SC-002 | 批量 Flush 延迟（100 Spans）| < 10ms (PG) / < 50ms (SQLite) | Benchmark 测试 |
| SC-003 | 写入吞吐量 | > 5000 spans/sec (PG) / > 500 spans/sec (SQLite) | 压力测试 |
| SC-004 | 查询延迟（按 trace_id）| < 20ms | Benchmark 测试 |
| SC-005 | 数据清理正确性 | 100% | 验证过期数据被删除 |
| SC-006 | HTTP API 响应延迟 | < 50ms (P99) | Benchmark 测试 |
| SC-007 | 测试覆盖率 | > 80% | go test -cover |
| SC-008 | SQLite 业务库无影响 | 0 写锁冲突 | 并发测试 |

---

## Data Model Preview

### `_traces` Collection (逻辑定义)

| Field | Type | Description |
|-------|------|-------------|
| `trace_id` | `string` | 32-char Hex, 追踪 ID |
| `span_id` | `string` | 16-char Hex, Span ID |
| `parent_id` | `string` | Nullable, 父 Span ID |
| `name` | `string` | Operation Name |
| `kind` | `string` | Span Kind (SERVER/CLIENT/INTERNAL) |
| `start` | `int64` | Unix Microseconds, 开始时间 |
| `dur` | `int` | Microseconds, 持续时间 |
| `status` | `string` | OK/ERROR |
| `attrs` | `json` | Attributes (JSONB in PG, TEXT in SQLite) |
| `created` | `datetime` | 创建时间 |

---

## Go API Preview

```go
// 获取 Trace 实例
trace := app.Trace()

// 自动追踪（中间件自动处理）
// HTTP 请求自动创建 Root Span

// 手动创建 Span
ctx, span := trace.StartSpan(ctx, "process-order")
defer span.End()

// 设置属性
span.SetAttribute("order_id", "123")
span.SetAttribute("user_id", "456")

// 设置状态
span.SetStatus(trace.StatusOK, "")
// 或
span.SetStatus(trace.StatusError, "payment failed")

// 创建子 Span
ctx, childSpan := trace.StartSpan(ctx, "validate-payment")
defer childSpan.End()

// 查询 Trace
traces, err := trace.Query(trace.FilterParams{
    TraceID:   "abc123...",
    StartTime: time.Now().Add(-1 * time.Hour),
    EndTime:   time.Now(),
    Operation: "process-order",
    Status:    "ERROR",
    Limit:     100,
})

// 清理过期数据
err := trace.Prune(7 * 24 * time.Hour)
```

---

## Admin UI Monitor Center Preview

### Trace 列表视图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Monitor Center                                          [Refresh] [▼]  │
├─────────────────────────────────────────────────────────────────────────┤
│  Time Range: [Last 1 hour ▼]  Operation: [All ▼]  Status: [All ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Stats                                                           │   │
│  │ Requests: 1,234  Success Rate: 99.2%  P99 Latency: 45ms        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  Trace ID     │ Operation    │ Status │ Duration │ Time              │
├─────────────────────────────────────────────────────────────────────────┤
│  abc123...    │ GET /api/... │ ● OK   │ 45ms     │ 2026-01-08 10:00  │
│  def456...    │ POST /api/...│ ● ERROR│ 120ms    │ 2026-01-08 09:59  │
│  ghi789...    │ GET /api/... │ ● OK   │ 23ms     │ 2026-01-08 09:58  │
├─────────────────────────────────────────────────────────────────────────┤
│  [< Prev]  Page 1 of 10  [Next >]                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Trace 详情视图（瀑布图）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Trace: abc123...                                              [Back]   │
├─────────────────────────────────────────────────────────────────────────┤
│  Total Duration: 45ms  Spans: 5  Status: OK                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ├─ GET /api/users/123                                    [45ms]        │
│  │  └─ db.query: SELECT * FROM users                      [12ms]        │
│  │  └─ db.query: SELECT * FROM orders                     [8ms]         │
│  │  └─ process-order                                      [15ms]        │
│  │     └─ validate-payment                                [5ms]         │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Selected Span: GET /api/users/123                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Attributes:                                                      │   │
│  │   http.method: GET                                               │   │
│  │   http.url: /api/users/123                                       │   │
│  │   http.status_code: 200                                          │   │
│  │   user_id: 123                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```
