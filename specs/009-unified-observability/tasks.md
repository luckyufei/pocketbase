# Implementation Tasks: PocketBase Unified Observability (`_traces`)

**Branch**: `009-unified-observability` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Setup (共享基础设施)

**Purpose**: 项目初始化和基本结构创建

- [x] T001 在 `core/trace_span.go` 中定义 Span、SpanKind、SpanStatus 结构体和常量
- [x] T002 [P] 在 `core/trace_repository.go` 中定义 TraceRepository 接口
- [x] T003 [P] 在 `core/trace_repository.go` 中定义 FilterParams、TraceStats 结构体

---

## Phase 2: Foundational (阻塞性前置条件)

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

**✅ COMPLETED**: 此阶段已完成

- [x] T004 在 `core/trace_repository_pg.go` 中实现 PostgreSQL schema 创建
  - [x] T004a 创建 `_traces` UNLOGGED TABLE
  - [x] T004b 创建索引（trace_id, start_time, name, status, GIN）
- [x] T005 在 `core/trace_repository_sqlite.go` 中实现 SQLite schema 创建
  - [x] T005a 创建/打开 `auxiliary.db`
  - [x] T005b 设置 `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`
  - [x] T005c 创建 `_traces` 表和索引
- [x] T006 在 `core/trace_buffer.go` 中实现 Ring Buffer 结构体
- [x] T007 [P] 在 `core/trace_context.go` 中实现 Context 传递工具（SpanFromContext, ContextWithSpan）
- [x] T008 在 `core/base.go` 中集成 Trace 到 App 结构体
- [x] T009 在 `core/app.go` 接口中添加 `Trace()` 方法

**Checkpoint**: 基础设施就绪 - 用户故事实现可以开始

---

## Phase 3: User Story 1 - Trace 数据采集 (Priority: P1) 🎯 MVP

**Goal**: 支持 Span 记录和批量写入

**Independent Test**: 
- 调用 `trace.RecordSpan(span)` 验证 Span 成功记录

### Implementation for User Story 1

- [x] T010 [US1] 在 `core/trace_buffer.go` 中实现 Ring Buffer 的 Push 方法
- [x] T011 [US1] 在 `core/trace_buffer.go` 中实现 Ring Buffer 的 Flush 方法（批量获取）
- [x] T012 [US1] 在 `core/trace_buffer.go` 中实现溢出丢弃策略（SQLite 模式）
- [x] T013 [US1] 在 `core/trace_repository_pg.go` 中实现 `BatchWrite()` - 使用 COPY 协议
- [x] T014 [US1] 在 `core/trace_repository_sqlite.go` 中实现 `BatchWrite()` - 批量 INSERT
- [x] T015 [US1] 在 `core/trace.go` 中实现 Flush Worker goroutine
- [x] T016 [US1] 在 `core/trace.go` 中实现 `RecordSpan()` 方法
- [x] T017 [US1] 实现 Span attributes 大小验证（最大 64KB）
- [x] T018 [US1] 编写 `core/trace_buffer_test.go` Ring Buffer 单元测试
- [x] T019 [US1] 编写 `core/trace_repository_test.go` BatchWrite 单元测试
  - [ ] T019a PostgreSQL 环境测试
  - [x] T019b SQLite 环境测试

**Checkpoint**: 此时 User Story 1 应完全可用，可独立测试

---

## Phase 4: User Story 7 - Go API 集成 (Priority: P1) 🎯 MVP

**Goal**: 支持 Go 代码中手动创建 Span

**Independent Test**: 
- 调用 `trace.StartSpan(ctx, "operation")` 验证 Span 被记录

### Implementation for User Story 7

- [x] T020 [US7] 在 `core/trace_span.go` 中实现 SpanBuilder 接口
- [x] T021 [US7] 在 `core/trace.go` 中实现 `StartSpan()` 方法
- [x] T022 [US7] 在 `core/trace_span.go` 中实现 `SetAttribute()` 方法
- [x] T023 [US7] 在 `core/trace_span.go` 中实现 `SetStatus()` 方法
- [x] T024 [US7] 在 `core/trace_span.go` 中实现 `End()` 方法（计算 duration 并记录）
- [x] T025 [US7] 实现 trace_id 和 span_id 生成（32-char / 16-char Hex）
- [x] T026 [US7] 实现父子 Span 关系（从 Context 继承 trace_id 和 parent_id）
- [x] T027 [US7] 编写 `core/trace_span_test.go` Span 创建单元测试

**Checkpoint**: 此时 User Story 1 & 7 都应独立可用 ✅

---

## Phase 5: User Story 3 - 自动 HTTP 请求追踪 (Priority: P1) 🎯 MVP

**Goal**: 自动追踪所有 HTTP 请求

**Independent Test**: 
- 发送 HTTP 请求，验证自动生成 Trace Span

### Implementation for User Story 3

**✅ COMPLETED**: 此阶段已完成

- [x] T028 [US3] 在 `apis/middlewares_trace.go` 中实现自动追踪中间件
- [x] T029 [US3] 在中间件中自动创建 Root Span
- [x] T030 [US3] 在中间件中自动记录 HTTP 属性（method, url, status_code）
- [x] T031 [US3] 在中间件中自动设置 Span 状态（根据响应码）
- [x] T032 [US3] 实现 traceparent 头解析（W3C Trace Context）
- [x] T033 [US3] 在 `apis/serve.go` 中注册追踪中间件
- [x] T034 [US3] 编写 `apis/middlewares_trace_test.go` 中间件测试

**Checkpoint**: 此时 User Story 1, 3, 7 都应独立可用 ✅

---

## Phase 6: User Story 2 - Trace 数据查询 (Priority: P1) 🎯 MVP

**Goal**: 支持 Trace 数据查询

**Independent Test**: 
- 调用 `trace.Query()` 验证 Trace 数据可查询

### Implementation for User Story 2

**✅ COMPLETED**: 此阶段已完成

- [x] T035 [US2] 在 `core/trace_repository_pg.go` 中实现 `Query()` - PostgreSQL 方言
- [x] T036 [US2] 在 `core/trace_repository_sqlite.go` 中实现 `Query()` - SQLite 方言
- [x] T037 [US2] 在 `core/trace_repository_pg.go` 中实现 `GetTrace()` - 获取完整调用链
- [x] T038 [US2] 在 `core/trace_repository_sqlite.go` 中实现 `GetTrace()` - 获取完整调用链
- [x] T039 [US2] 实现 JSONB 查询（PostgreSQL: `attrs->>'key'`）
- [x] T040 [US2] 实现 JSON 查询（SQLite: `json_extract(attrs, '$.key')`）
- [x] T041 [US2] 编写 Query 单元测试
  - [ ] T041a PostgreSQL 环境测试
  - [x] T041b SQLite 环境测试

**Checkpoint**: 此时 User Story 1, 2, 3, 7 都应独立可用 ✅

---

## Phase 7: User Story 4 - 数据自动清理 (Priority: P1)

**Goal**: 支持自动清理过期数据

**Independent Test**: 
- 配置 retention 后，验证过期数据被自动删除

### Implementation for User Story 4

- [x] T042 [US4] 在 `core/trace_repository_pg.go` 中实现 `Prune()` - 批量删除
- [x] T043 [US4] 在 `core/trace_repository_sqlite.go` 中实现 `Prune()` - 批量删除
- [x] T044 [US4] 在 `core/trace.go` 中定义 TraceConfig（retention 配置）
- [x] T045 [US4] 在 `core/trace.go` 中实现 Prune 方法
- [x] T046 [US4] 编写 Prune 单元测试

**Checkpoint**: MVP 后端完成 (User Story 1-4, 7) ✅

---

## Phase 8: User Story 6 - HTTP API 查询 (Priority: P1)

**Goal**: 提供 HTTP API 供客户端查询

**Independent Test**: 
- 使用 curl 调用 `GET '/api/traces` 验证

### Implementation for User Story 6

**✅ COMPLETED**: 此阶段已完成

- [x] T047 [US6] 在 `apis/trace_routes.go` 中创建 Trace API 路由组 `'/api/traces/*`
- [x] T048 [US6] 实现 `GET '/api/traces` 端点（列表查询）
- [x] T049 [US6] 实现 `GET '/api/traces/:trace_id` 端点（获取完整调用链）
- [x] T050 [US6] 实现 `GET '/api/traces/stats` 端点（统计数据）
- [x] T051 [US6] 在 `core/trace_repository_pg.go` 中实现 `Stats()` - PostgreSQL
- [x] T052 [US6] 在 `core/trace_repository_sqlite.go` 中实现 `Stats()` - SQLite
- [x] T053 [US6] 实现 Superuser 权限检查
- [x] T054 [US6] 编写 `apis/trace_routes_test.go` HTTP API 测试

**Checkpoint**: HTTP API 可用 ✅

---

## Phase 9: User Story 5 - Monitor Center UI (Priority: P1)

**Goal**: 提供 Admin UI Monitor Center

**Independent Test**: 
- 在 Admin UI 中访问 Monitor Center，查看 Trace 列表

### Implementation for User Story 5

- [x] T055 [US5] 在 `ui/src/components/monitor/PageMonitor.svelte` 中实现 Monitor Center 页面
- [x] T056 [US5] 在 `ui/src/components/monitor/TraceStats.svelte` 中实现统计组件
- [x] T057 [US5] 在 `ui/src/components/monitor/TraceFilters.svelte` 中实现筛选组件
- [x] T058 [US5] 在 `ui/src/components/monitor/TraceList.svelte` 中实现 Trace 列表组件
- [x] T059 [US5] 在 `ui/src/components/monitor/TraceDetail.svelte` 中实现 Trace 详情组件（瀑布图）
- [x] T060 [US5] 在 `ui/src/routes.js` 中添加 Monitor 路由
- [x] T061 [US5] 在 `ui/src/components/settings/SettingsSidebar.svelte` 中添加 Monitor 菜单入口
- [x] T062 [US5] 实现时间范围筛选
- [x] T063 [US5] 实现 operation 筛选
- [x] T064 [US5] 实现 status 筛选
- [x] T065 [US5] 实现分页功能
- [x] T066 [US5] 实现瀑布图渲染（Span 层级展示）

**✅ COMPLETED**: 此阶段已完成

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的改进

- [ ] T067 [P] 实现数据库操作自动追踪（可选，P2）
- [ ] T068 [P] 添加 Trace 配置热更新
- [ ] T069 [P] 添加操作日志（Debug 级别）
- [x] T070 编写 `core/trace_benchmark_test.go` 性能基准测试
  - [x] T070a PostgreSQL 基准测试
  - [x] T070b SQLite 基准测试
- [x] T071 运行完整集成测试，验证所有功能正常
  - [x] T071a PostgreSQL 集成测试
  - [x] T071b SQLite 集成测试
- [ ] T072 [P] 实现 auxiliary.db 自动重建（损坏时）
- [ ] T073 [P] 添加 Trace 启用/禁用开关

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-9)**: 依赖 Foundational 完成
  - US1 (Phase 3): 核心数据采集功能
  - US7 (Phase 4): 依赖 US1 完成
  - US3 (Phase 5): 依赖 US7 完成
  - US2 (Phase 6): 依赖 US1 完成
  - US4 (Phase 7): 依赖 US1 完成
  - **US6 (Phase 8): 依赖 US2 完成（HTTP API 封装查询功能）**
  - **US5 (Phase 9): 依赖 US6 完成（Admin UI 依赖 HTTP API）**
- **Polish (Phase 10)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ▼
Phase 3 (US1: 数据采集) ─────────────────────────────────────┐
    │                                                         │
    ├──────────────┬──────────────┬──────────────────────────┤
    ▼              ▼              ▼                          │
Phase 4        Phase 6        Phase 7                        │
(US7: Go API)  (US2: 查询)    (US4: 清理)                    │
    │              │              │                          │
    ▼              │              │                          │
Phase 5            │              │                          │
(US3: 自动追踪)    │              │                          │
    │              │              │                          │
    └──────────────┴──────────────┘                          │
                   │                                          │
                   ▼                                          │
             Phase 8                                          │
             (US6: HTTP API)                                  │
                   │                                          │
                   ▼                                          │
             Phase 9                                          │
             (US5: Admin UI)                                  │
                   │                                          │
                   ▼                                          │
             Phase 10                                         │
             (Polish)                                         │
```

### Parallelization Opportunities

**Phase 2 内部并行**:
- T007 (Context 工具) 可与其他任务并行开发

**Phase 3-7 部分并行**:
- US2, US4, US7 可在 US1 完成后并行开发
- US3 依赖 US7，需等待 US7 完成

**Phase 8-9 顺序执行**:
- US5 依赖 US6，必须顺序执行

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Setup | 3 | 1h | Yes |
| Phase 2: Foundational | 6 | 4h | Partial |
| Phase 3: US1 数据采集 | 10 | 6h | No |
| Phase 4: US7 Go API | 8 | 4h | No |
| Phase 5: US3 自动追踪 | 7 | 4h | No |
| Phase 6: US2 查询 | 7 | 4h | Partial |
| Phase 7: US4 清理 | 5 | 2h | No |
| Phase 8: US6 HTTP API | 8 | 5h | Partial |
| Phase 9: US5 Admin UI | 12 | 10h | Partial |
| Phase 10: Polish | 7 | 4h | Yes |
| **Total** | **73** | **~44h** | |

---

## MVP Definition

**最小可行产品 (MVP)** = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 6 + Phase 7 + Phase 8

完成 MVP 后，系统具备：
- ✅ Trace Span 记录（Ring Buffer + 批量写入）
- ✅ Go API 手动创建 Span
- ✅ 自动 HTTP 请求追踪
- ✅ Trace 数据查询
- ✅ 数据自动清理
- ✅ **HTTP API（供客户端查询）**

**MVP 预估工时**: ~30h

---

## SQL Reference

### 基础操作（通用）

```sql
-- Query (列表查询) - PostgreSQL
SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
FROM _traces
WHERE (:trace_id = '' OR trace_id = :trace_id)
  AND (:start_time = 0 OR start_time >= :start_time)
  AND (:end_time = 0 OR start_time <= :end_time)
  AND (:operation = '' OR name = :operation)
  AND (:status = '' OR status = :status)
ORDER BY start_time DESC
LIMIT :limit OFFSET :offset;

-- Query (列表查询) - SQLite
SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
FROM _traces
WHERE (:trace_id = '' OR trace_id = :trace_id)
  AND (:start_time = 0 OR start_time >= :start_time)
  AND (:end_time = 0 OR start_time <= :end_time)
  AND (:operation = '' OR name = :operation)
  AND (:status = '' OR status = :status)
ORDER BY start_time DESC
LIMIT :limit OFFSET :offset;

-- GetTrace (获取完整调用链) - 通用
SELECT trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created
FROM _traces
WHERE trace_id = :trace_id
ORDER BY start_time ASC;

-- Prune (清理过期数据) - 通用
DELETE FROM _traces
WHERE start_time < :cutoff_time;
```

### BatchWrite 操作

```sql
-- PostgreSQL: COPY 协议 (使用 pgx.CopyFrom)
COPY _traces (trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created)
FROM STDIN;

-- SQLite: 批量 INSERT
INSERT INTO _traces (trace_id, span_id, parent_id, name, kind, start_time, duration, status, attributes, created)
VALUES 
    (:trace_id_1, :span_id_1, :parent_id_1, :name_1, :kind_1, :start_time_1, :duration_1, :status_1, :attributes_1, :created_1),
    (:trace_id_2, :span_id_2, :parent_id_2, :name_2, :kind_2, :start_time_2, :duration_2, :status_2, :attributes_2, :created_2),
    ...;
```

### 统计查询

```sql
-- 基础统计 - 通用
SELECT 
    COUNT(*) as total_requests,
    SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error_count
FROM _traces
WHERE parent_id IS NULL  -- 只统计 Root Span
  AND start_time >= :start_time
  AND start_time <= :end_time;

-- 延迟百分位 - PostgreSQL
SELECT 
    percentile_cont(0.50) WITHIN GROUP (ORDER BY duration) as p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration) as p95,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY duration) as p99
FROM _traces
WHERE parent_id IS NULL
  AND start_time >= :start_time
  AND start_time <= :end_time;

-- 延迟百分位 - SQLite (近似计算)
-- SQLite 不支持 percentile_cont，需要在 Go 层计算
SELECT duration
FROM _traces
WHERE parent_id IS NULL
  AND start_time >= :start_time
  AND start_time <= :end_time
ORDER BY duration ASC;
```

### JSONB 查询

```sql
-- PostgreSQL: 按 attributes 字段查询
SELECT *
FROM _traces
WHERE attributes->>'http.method' = 'POST'
  AND (attributes->>'http.status_code')::int >= 500;

-- SQLite: 按 attributes 字段查询
SELECT *
FROM _traces
WHERE json_extract(attributes, '$.http.method') = 'POST'
  AND CAST(json_extract(attributes, '$.http.status_code') AS INTEGER) >= 500;
```

---

## Admin UI 组件结构

```
ui/src/
├── components/
│   └── monitor/
│       ├── TraceList.svelte       # Trace 列表
│       │   ├── 表格展示
│       │   ├── 分页控制
│       │   └── 行点击跳转详情
│       │
│       ├── TraceDetail.svelte     # Trace 详情（瀑布图）
│       │   ├── 调用链可视化
│       │   ├── Span 层级缩进
│       │   ├── Duration 条形图
│       │   └── Attributes 展示
│       │
│       ├── TraceStats.svelte      # 统计卡片
│       │   ├── 请求总量
│       │   ├── 成功率
│       │   └── P99 延迟
│       │
│       └── TraceFilters.svelte    # 筛选控件
│           ├── 时间范围选择器
│           ├── Operation 下拉
│           ├── Status 下拉
│           └── 搜索框
│
└── pages/
    └── monitor/
        └── Index.svelte           # Monitor Center 主页
            ├── TraceStats
            ├── TraceFilters
            └── TraceList
```

---

## Ring Buffer 实现参考

```go
// core/trace_buffer.go

type RingBuffer struct {
    buffer   []*Span
    capacity int
    head     int64  // 写入位置
    tail     int64  // 读取位置
    mu       sync.Mutex
    overflow int64  // 溢出计数
}

func NewRingBuffer(capacity int) *RingBuffer {
    return &RingBuffer{
        buffer:   make([]*Span, capacity),
        capacity: capacity,
    }
}

// Push 写入 Span（非阻塞）
func (rb *RingBuffer) Push(span *Span) bool {
    rb.mu.Lock()
    defer rb.mu.Unlock()
    
    // 检查是否溢出
    if rb.head-rb.tail >= int64(rb.capacity) {
        rb.overflow++
        return false  // 丢弃
    }
    
    rb.buffer[rb.head%int64(rb.capacity)] = span
    rb.head++
    return true
}

// Flush 批量获取 Span
func (rb *RingBuffer) Flush(batchSize int) []*Span {
    rb.mu.Lock()
    defer rb.mu.Unlock()
    
    count := rb.head - rb.tail
    if count == 0 {
        return nil
    }
    
    if count > int64(batchSize) {
        count = int64(batchSize)
    }
    
    result := make([]*Span, count)
    for i := int64(0); i < count; i++ {
        result[i] = rb.buffer[(rb.tail+i)%int64(rb.capacity)]
    }
    rb.tail += count
    
    return result
}
```

---

## Span 创建参考

```go
// core/trace_span.go

type spanImpl struct {
    trace   *Trace
    span      *Span
    startTime time.Time
}

func (s *spanImpl) SetAttribute(key string, value any) SpanBuilder {
    if s.span.Attributes == nil {
        s.span.Attributes = make(map[string]any)
    }
    s.span.Attributes[key] = value
    return s
}

func (s *spanImpl) SetStatus(status SpanStatus, message string) SpanBuilder {
    s.span.Status = status
    if message != "" {
        s.SetAttribute("error.message", message)
    }
    return s
}

func (s *spanImpl) End() {
    s.span.Duration = int(time.Since(s.startTime).Microseconds())
    s.trace.RecordSpan(s.span)
}

// 生成 trace_id (32-char Hex)
func generateTraceID() string {
    b := make([]byte, 16)
    rand.Read(b)
    return hex.EncodeToString(b)
}

// 生成 span_id (16-char Hex)
func generateSpanID() string {
    b := make([]byte, 8)
    rand.Read(b)
    return hex.EncodeToString(b)
}
```

---

## 自动追踪中间件参考

```go
// apis/trace_middleware.go

func TraceMiddleware(trace core.Trace) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            req := c.Request()
            
            // 解析 traceparent 头
            ctx := req.Context()
            if tp := req.Header.Get("traceparent"); tp != "" {
                ctx = parseTraceparent(ctx, tp)
            }
            
            // 创建 Root Span
            ctx, span := trace.StartSpan(ctx, fmt.Sprintf("%s %s", req.Method, req.URL.Path))
            defer span.End()
            
            // 设置 HTTP 属性
            span.SetAttribute("http.method", req.Method)
            span.SetAttribute("http.url", req.URL.String())
            span.SetAttribute("http.host", req.Host)
            
            // 注入 Context
            c.SetRequest(req.WithContext(ctx))
            
            // 执行请求
            err := next(c)
            
            // 设置响应属性
            span.SetAttribute("http.status_code", c.Response().Status)
            
            if err != nil || c.Response().Status >= 400 {
                span.SetStatus(core.StatusError, "")
            } else {
                span.SetStatus(core.StatusOK, "")
            }
            
            return err
        }
    }
}

// 解析 W3C Trace Context
func parseTraceparent(ctx context.Context, tp string) context.Context {
    // Format: 00-{trace_id}-{parent_id}-{flags}
    parts := strings.Split(tp, "-")
    if len(parts) != 4 {
        return ctx
    }
    
    traceID := parts[1]
    parentID := parts[2]
    
    return context.WithValue(ctx, traceContextKey, &traceContext{
        TraceID:  traceID,
        ParentID: parentID,
    })
}
```
