# Implementation Plan: PocketBase Unified Observability (`_traces`)

**Branch**: `009-unified-observability` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-unified-observability/spec.md`

## Summary

为 PocketBase 新增统一可观测性功能，通过 `_traces` 系统表实现 **分布式追踪** 能力。**同时支持 SQLite 和 PostgreSQL**：PostgreSQL 使用 `UNLOGGED TABLE` + `COPY` 协议实现高吞吐写入，SQLite 使用独立 `auxiliary.db` + Ring Buffer 策略隔离业务 I/O。支持自动 HTTP 追踪、手动 Span 创建、数据自动清理等能力。**同时提供 HTTP API 和 Admin UI Monitor Center**。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `database/sql` (数据库操作)
- `encoding/json` (Attributes 序列化)
- `sync` (Ring Buffer 并发控制)
- `context` (Span 上下文传递)

**Storage**: 
- SQLite: 独立文件 `pb_data/auxiliary.db`
- PostgreSQL: UNLOGGED TABLE `_traces`

**Testing**: Go test (unit + integration)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Backend (PocketBase 核心扩展)  
**Performance Goals**: 
- PostgreSQL: 写入 > 5000 spans/sec, 查询 < 20ms
- SQLite: 写入 > 500 spans/sec, 查询 < 50ms
**Constraints**: 观测数据可丢失（崩溃后），不支持跨库 JOIN  
**Scale/Scope**: 单机部署

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | Observability 功能编译进主二进制，无外部 Jaeger/Zipkin 依赖 |
| Zero External Dependencies | ✅ PASS | 使用数据库内置能力（UNLOGGED TABLE / WAL 模式） |
| Anti-Stupidity | ✅ PASS | 消除分布式追踪运维负担，零配置开箱即用 |
| Data Locality | ✅ PASS | 观测数据存储在本地，备份策略统一 |
| Graceful Degradation | ✅ PASS | SQLite 缓冲区满时丢弃新 Span，不阻塞业务 |
| **Database Agnostic** | ✅ PASS | **同时支持 SQLite 和 PostgreSQL** |

## Project Structure

### Documentation (this feature)

```text
specs/009-unified-observability/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── trace_repository.go       # TraceRepository 核心接口
├── trace_repository_pg.go    # PostgreSQL 实现
├── trace_repository_sqlite.go# SQLite 实现
├── trace_repository_test.go  # 单元测试
├── trace_buffer.go           # Ring Buffer 实现
├── trace_span.go             # Span 结构体和方法
├── trace_context.go          # Context 传递工具
├── trace_settings.go         # Trace 配置
└── trace_benchmark_test.go   # 性能基准测试

apis/
├── trace_routes.go           # HTTP API 路由注册
├── trace_routes_test.go      # HTTP API 测试
└── trace_middleware.go       # 自动追踪中间件

# Frontend (Svelte)
ui/src/
├── components/monitor/
│   ├── TraceList.svelte      # Trace 列表组件
│   ├── TraceDetail.svelte    # Trace 详情组件（瀑布图）
│   ├── TraceStats.svelte     # 统计组件
│   └── TraceFilters.svelte   # 筛选组件
└── pages/
    └── monitor/
        └── Index.svelte      # Monitor Center 页面
```

**Structure Decision**: 遵循现有 PocketBase 代码结构，Trace 相关代码放入 `core/` 目录，HTTP API 放入 `apis/` 目录，Admin UI 放入 `ui/src/` 目录。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            PocketBase                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Admin UI Layer                              │ │
│  │  Monitor Center: Trace List | Trace Detail | Stats                  │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                        HTTP API Layer                               │ │
│  │  GET '/api/traces | GET '/api/traces/:id | GET '/api/traces/stats  │ │
│  │  (Bearer Token / Cookie Authentication - Superuser Only)            │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                      Trace API Layer                              │ │
│  │  StartSpan | RecordSpan | Query | Prune | Stats                     │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                      Data Pipeline                                  │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │ │
│  │  │   Ring Buffer           │  │   Flush Worker                  │  │ │
│  │  │   (Lock-Free Queue)     │  │   (Goroutine)                   │  │ │
│  │  │                         │  │                                 │  │ │
│  │  │   • Capacity: 10000     │  │   • Batch Size: 100             │  │ │
│  │  │   • Overflow: Drop      │  │   • Flush Interval: 1s          │  │ │
│  │  │   • Thread-Safe         │  │   • Retry on Failure            │  │ │
│  │  └─────────────────────────┘  └─────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                    TraceRepository Interface                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │                    Engine Selection (Boot Time)               │  │ │
│  │  │                                                               │  │ │
│  │  │  ┌─────────────────────┐    ┌─────────────────────────────┐  │  │ │
│  │  │  │  PostgreSQL Engine  │    │     SQLite Engine           │  │  │ │
│  │  │  │                     │    │                             │  │  │ │
│  │  │  │  • UNLOGGED TABLE   │    │  • auxiliary.db             │  │  │ │
│  │  │  │  • COPY FROM STDIN  │    │  • WAL Mode                 │  │  │ │
│  │  │  │  • JSONB + GIN      │    │  • TEXT + json_extract      │  │  │ │
│  │  │  └─────────────────────┘    └─────────────────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────────┐ │
│  │                       Physical Storage                              │ │
│  │                                                                      │ │
│  │  PostgreSQL:                     SQLite:                             │ │
│  │  ┌──────────────────────┐       ┌──────────────────────────────┐   │ │
│  │  │   _traces (UNLOGGED) │       │   pb_data/auxiliary.db       │   │ │
│  │  │   No WAL, Fast Write │       │   Isolated from data.db      │   │ │
│  │  └──────────────────────┘       └──────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Record Path (记录)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ HTTP Request│────▶│  Middleware │────▶│  StartSpan  │
│             │     │  (Auto)     │     │             │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    ┌──────────┐        ┌──────────┐
                    │  Create  │        │  Context │
                    │  Span    │        │  Inject  │
                    └──────────┘        └──────────┘
                           │                   │
                           ▼                   ▼
                    ┌──────────┐        ┌──────────┐
                    │  span.End│        │  Record  │
                    │  ()      │        │  Span    │
                    └──────────┘        └──────────┘
                                               │
                                               ▼
                                        ┌──────────┐
                                        │  Ring    │
                                        │  Buffer  │
                                        └──────┬───┘
                                               │
                                               ▼
                                        ┌──────────┐
                                        │  Flush   │
                                        │  Worker  │
                                        └──────┬───┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           ▼                                       ▼
                    ┌──────────────┐                        ┌──────────────┐
                    │  PostgreSQL  │                        │    SQLite    │
                    │  COPY FROM   │                        │  Batch INSERT│
                    └──────────────┘                        └──────────────┘
```

1. HTTP 请求到达，中间件自动创建 Root Span
2. Span 注入到 Context 中，传递给下游
3. 请求处理完成，Span 结束并记录 duration
4. Span 写入 Ring Buffer（非阻塞）
5. Flush Worker 定期批量写入数据库
6. 根据数据库类型选择最优写入策略

### Query Path (查询)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin UI  │────▶│  HTTP API   │────▶│  Repository │
│   / Client  │     │  /trace   │     │  Query()    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    ┌──────────┐        ┌──────────┐
                    │  Auth    │        │  SQL     │
                    │  Check   │        │  Dialect │
                    └──────────┘        └──────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           ▼                                       ▼
                    ┌──────────────┐                        ┌──────────────┐
                    │  PostgreSQL  │                        │    SQLite    │
                    │  attrs->>'x' │                        │ json_extract │
                    └──────────────┘                        └──────────────┘
```

1. 客户端调用 HTTP API 查询 Trace
2. 权限检查（仅 Superuser）
3. Repository 根据数据库类型生成对应 SQL 方言
4. 返回查询结果

## Key Design Decisions

### 1. Storage Abstraction Layer (存储抽象层)

**Decision**: 定义 `TraceRepository` 接口，PostgreSQL 和 SQLite 分别实现

**Interface**:
```go
type TraceRepository interface {
    // 批量写入 (Fire & Forget)
    BatchWrite(spans []*Span) error
    
    // 查询 (供 UI 使用)
    Query(filter FilterParams) ([]*Span, error)
    
    // 清理 (Cron)
    Prune(retention time.Duration) error
    
    // 统计
    Stats() (*TraceStats, error)
}
```

**Rationale**:
- 统一接口，上层代码无需感知底层差异
- 各引擎可针对自身特性优化
- 易于测试和扩展

### 2. SQLite 数据隔离

**Decision**: 观测数据写入独立的 `pb_data/auxiliary.db`

**Rationale**:
- 避免与业务主库 `data.db` 产生写锁竞争
- 观测数据高频写入，不应影响业务性能
- 独立文件便于单独备份或清理

**Configuration**:
```go
// SQLite 模式初始化
db, _ := sql.Open("sqlite", filepath.Join(app.DataDir(), "auxiliary.db"))
db.Exec("PRAGMA journal_mode = WAL;")
db.Exec("PRAGMA synchronous = NORMAL;")
```

### 3. PostgreSQL UNLOGGED TABLE

**Decision**: 使用 `UNLOGGED TABLE` 存储观测数据

**Rationale**:
- 不写 WAL 日志，写入速度提升 2-3 倍
- 观测数据可丢失（崩溃后），不需要持久化保证
- 减少磁盘 I/O，降低对业务的影响

**DDL**:
```sql
CREATE UNLOGGED TABLE _traces (
    trace_id TEXT NOT NULL,
    span_id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    start_time BIGINT NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL,
    attributes JSONB,
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 4. Ring Buffer 缓冲策略

**Decision**: 使用 Ring Buffer 缓冲写入，定期批量 Flush

**Configuration**:
- Capacity: 10000 Spans
- Batch Size: 100 Spans
- Flush Interval: 1 second
- Overflow Policy: Drop (SQLite) / Block (PostgreSQL)

**Rationale**:
- 解耦采集和写入，避免写入延迟影响请求处理
- 批量写入减少数据库 I/O 次数
- SQLite 模式下丢弃策略保护业务性能

### 5. 自动追踪中间件

**Decision**: 通过 HTTP 中间件自动追踪所有请求

**Rationale**:
- 零配置开箱即用
- 自动捕获 HTTP 请求的关键信息
- 支持 W3C Trace Context 标准（traceparent 头）

**Captured Attributes**:
- `http.method`: 请求方法
- `http.url`: 请求 URL
- `http.status_code`: 响应状态码
- `http.request_content_length`: 请求体大小
- `http.response_content_length`: 响应体大小

### 6. 数据自动清理

**Decision**: 通过 Cron 任务自动清理过期数据

**Default Retention**: 7 days

**Rationale**:
- 观测数据是临时数据，无需永久保存
- 自动清理避免存储空间无限增长
- 批量删除避免长事务

## Database Schema

### PostgreSQL

```sql
-- _traces 系统表 (UNLOGGED)
CREATE UNLOGGED TABLE _traces (
    trace_id TEXT NOT NULL,              -- 32-char Hex
    span_id TEXT PRIMARY KEY,            -- 16-char Hex
    parent_id TEXT,                      -- Nullable, 父 Span ID
    name TEXT NOT NULL,                  -- Operation Name
    kind TEXT NOT NULL,                  -- SERVER/CLIENT/INTERNAL
    start_time BIGINT NOT NULL,          -- Unix Microseconds
    duration INTEGER NOT NULL,           -- Microseconds
    status TEXT NOT NULL,                -- OK/ERROR
    attributes JSONB,                    -- 自定义属性
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引：按 trace_id 查询完整调用链
CREATE INDEX idx_traces_trace_id ON _traces (trace_id);

-- 索引：按时间范围查询
CREATE INDEX idx_traces_start_time ON _traces (start_time DESC);

-- 索引：按 operation name 查询
CREATE INDEX idx_traces_name ON _traces (name);

-- 索引：按 status 查询
CREATE INDEX idx_traces_status ON _traces (status);

-- 索引：GIN 索引支持 JSONB 查询
CREATE INDEX idx_traces_attrs ON _traces USING GIN (attributes);
```

### SQLite

```sql
-- _traces 系统表 (存储在 auxiliary.db)
CREATE TABLE _traces (
    trace_id TEXT NOT NULL,              -- 32-char Hex
    span_id TEXT PRIMARY KEY,            -- 16-char Hex
    parent_id TEXT,                      -- Nullable, 父 Span ID
    name TEXT NOT NULL,                  -- Operation Name
    kind TEXT NOT NULL,                  -- SERVER/CLIENT/INTERNAL
    start_time INTEGER NOT NULL,         -- Unix Microseconds
    duration INTEGER NOT NULL,           -- Microseconds
    status TEXT NOT NULL,                -- OK/ERROR
    attributes TEXT,                     -- JSON 字符串
    created TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引：按 trace_id 查询完整调用链
CREATE INDEX idx_traces_trace_id ON _traces (trace_id);

-- 索引：按时间范围查询
CREATE INDEX idx_traces_start_time ON _traces (start_time DESC);

-- 索引：按 operation name 查询
CREATE INDEX idx_traces_name ON _traces (name);

-- 索引：按 status 查询
CREATE INDEX idx_traces_status ON _traces (status);
```

### Schema 差异说明

| 字段 | PostgreSQL | SQLite | 说明 |
|------|------------|--------|------|
| attributes | `JSONB` | `TEXT` | SQLite 无原生 JSON 类型 |
| start_time | `BIGINT` | `INTEGER` | SQLite INTEGER 支持 64 位 |
| created | `TIMESTAMP` | `TEXT` | SQLite 使用 ISO 8601 字符串 |
| GIN 索引 | ✅ 支持 | ❌ 不支持 | SQLite 无 GIN 索引 |
| 表类型 | `UNLOGGED` | 普通表 | SQLite 无 UNLOGGED 概念 |

## API Design

### Core Interface

```go
// TraceRepository 存储抽象层接口
type TraceRepository interface {
    // 批量写入
    BatchWrite(spans []*Span) error
    
    // 查询
    Query(filter FilterParams) ([]*Span, int, error)
    
    // 获取完整调用链
    GetTrace(traceID string) ([]*Span, error)
    
    // 清理过期数据
    Prune(retention time.Duration) (int64, error)
    
    // 统计
    Stats(filter StatsFilter) (*TraceStats, error)
    
    // 关闭
    Close() error
}

// Span 结构体
type Span struct {
    TraceID    string         `json:"trace_id"`
    SpanID     string         `json:"span_id"`
    ParentID   string         `json:"parent_id,omitempty"`
    Name       string         `json:"name"`
    Kind       SpanKind       `json:"kind"`
    StartTime  int64          `json:"start_time"`  // Unix Microseconds
    Duration   int            `json:"duration"`    // Microseconds
    Status     SpanStatus     `json:"status"`
    Attributes map[string]any `json:"attributes,omitempty"`
    Created    time.Time      `json:"created"`
}

type SpanKind string
const (
    SpanKindServer   SpanKind = "SERVER"
    SpanKindClient   SpanKind = "CLIENT"
    SpanKindInternal SpanKind = "INTERNAL"
)

type SpanStatus string
const (
    StatusOK    SpanStatus = "OK"
    StatusError SpanStatus = "ERROR"
)

// FilterParams 查询参数
type FilterParams struct {
    TraceID   string
    StartTime time.Time
    EndTime   time.Time
    Operation string
    Status    string
    Limit     int
    Offset    int
}

// TraceStats 统计数据
type TraceStats struct {
    TotalRequests int64   `json:"total_requests"`
    SuccessCount  int64   `json:"success_count"`
    ErrorCount    int64   `json:"error_count"`
    SuccessRate   float64 `json:"success_rate"`
    P50Latency    int64   `json:"p50_latency"`  // Microseconds
    P95Latency    int64   `json:"p95_latency"`
    P99Latency    int64   `json:"p99_latency"`
}
```

### Trace API

```go
// Trace 主接口
type Trace interface {
    // 创建 Span
    StartSpan(ctx context.Context, name string, opts ...SpanOption) (context.Context, Span)
    
    // 记录 Span（内部使用）
    RecordSpan(span *Span)
    
    // 查询
    Query(filter FilterParams) ([]*Span, int, error)
    GetTrace(traceID string) ([]*Span, error)
    
    // 统计
    Stats(filter StatsFilter) (*TraceStats, error)
    
    // 清理
    Prune(retention time.Duration) (int64, error)
    
    // 生命周期
    Start() error
    Stop() error
}

// SpanBuilder 用于构建 Span
type SpanBuilder interface {
    SetAttribute(key string, value any) SpanBuilder
    SetStatus(status SpanStatus, message string) SpanBuilder
    End()
}
```

### Usage Example

```go
// 获取 Trace 实例
trace := app.Trace()

// 中间件自动追踪 HTTP 请求
// 无需手动代码

// 手动创建 Span
func processOrder(ctx context.Context, orderID string) error {
    ctx, span := trace.StartSpan(ctx, "process-order")
    defer span.End()
    
    span.SetAttribute("order_id", orderID)
    
    // 创建子 Span
    ctx, validateSpan := trace.StartSpan(ctx, "validate-payment")
    err := validatePayment(ctx, orderID)
    if err != nil {
        validateSpan.SetStatus(StatusError, err.Error())
    }
    validateSpan.End()
    
    if err != nil {
        span.SetStatus(StatusError, "payment validation failed")
        return err
    }
    
    span.SetStatus(StatusOK, "")
    return nil
}

// 查询 Trace
traces, total, err := trace.Query(FilterParams{
    StartTime: time.Now().Add(-1 * time.Hour),
    EndTime:   time.Now(),
    Status:    "ERROR",
    Limit:     100,
})

// 获取完整调用链
spans, err := trace.GetTrace("abc123...")

// 清理过期数据
deleted, err := trace.Prune(7 * 24 * time.Hour)
```

## HTTP API Design

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `'/api/traces` | 列表查询 | Superuser |
| GET | `'/api/traces/:trace_id` | 获取完整调用链 | Superuser |
| GET | `'/api/traces/stats` | 获取统计数据 | Superuser |

### Request/Response Examples

```bash
# List Traces
GET '/api/traces?start=2026-01-08T00:00:00Z&end=2026-01-08T23:59:59Z&status=ERROR&limit=20
Authorization: Bearer <token>

# Response
{
    "items": [
        {
            "trace_id": "abc123...",
            "span_id": "def456...",
            "name": "GET /api/users",
            "kind": "SERVER",
            "start_time": 1736323200000000,
            "duration": 45000,
            "status": "ERROR",
            "attributes": {
                "http.method": "GET",
                "http.status_code": 500
            },
            "created": "2026-01-08T10:00:00Z"
        }
    ],
    "total": 100,
    "limit": 20,
    "offset": 0
}

# Get Trace
GET '/api/traces/abc123...
Authorization: Bearer <token>

# Response
{
    "trace_id": "abc123...",
    "spans": [
        {
            "span_id": "def456...",
            "parent_id": null,
            "name": "GET /api/users",
            "kind": "SERVER",
            "start_time": 1736323200000000,
            "duration": 45000,
            "status": "OK"
        },
        {
            "span_id": "ghi789...",
            "parent_id": "def456...",
            "name": "db.query",
            "kind": "CLIENT",
            "start_time": 1736323200005000,
            "duration": 12000,
            "status": "OK"
        }
    ],
    "total_duration": 45000,
    "span_count": 2
}

# Stats
GET '/api/traces/stats?start=2026-01-08T00:00:00Z&end=2026-01-08T23:59:59Z
Authorization: Bearer <token>

# Response
{
    "total_requests": 1234,
    "success_count": 1224,
    "error_count": 10,
    "success_rate": 0.992,
    "p50_latency": 23000,
    "p95_latency": 89000,
    "p99_latency": 150000
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite 写锁影响业务 | Medium | High | 独立 auxiliary.db 隔离 |
| 缓冲区溢出丢失数据 | Medium | Low | 观测数据可丢失，不影响业务 |
| PostgreSQL WAL 压力 | Medium | Medium | UNLOGGED TABLE 不写 WAL |
| 高并发写入性能瓶颈 | Low | Medium | Ring Buffer + 批量写入 |
| 查询大量数据超时 | Low | Medium | 分页 + 时间范围限制 |
| auxiliary.db 损坏 | Low | Low | 自动重建，数据可丢失 |

## Performance Expectations

### PostgreSQL

| Operation | Latency | Throughput |
|-----------|---------|------------|
| RecordSpan (Buffer) | < 1ms | > 50000/sec |
| BatchWrite (100 spans) | < 10ms | > 5000/sec |
| Query (by trace_id) | < 20ms | - |
| Query (time range) | < 50ms | - |
| Stats | < 100ms | - |
| Prune | < 1s | - |

### SQLite

| Operation | Latency | Throughput |
|-----------|---------|------------|
| RecordSpan (Buffer) | < 1ms | > 10000/sec |
| BatchWrite (100 spans) | < 50ms | > 500/sec |
| Query (by trace_id) | < 50ms | - |
| Query (time range) | < 100ms | - |
| Stats | < 200ms | - |
| Prune | < 2s | - |

**结论**:
- PostgreSQL 适合生产环境和高并发场景
- SQLite 适合开发环境和低并发场景
- 两者都通过 Ring Buffer 解耦采集和写入

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| (无新增) | - | 使用标准库 |

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| core/base.go | App 结构体集成 |
| core/db_connect.go | 数据库连接 |
| apis/ | HTTP API 路由 |
| ui/ | Admin UI 组件 |

## Testing Strategy

### Unit Tests
- Ring Buffer 并发读写测试
- Span 创建和记录测试
- 各引擎 BatchWrite 测试
- Query 条件组合测试

### Integration Tests
- 自动追踪中间件测试
- 完整调用链构建测试
- 数据清理测试
- HTTP API 端到端测试

### Benchmark Tests
- RecordSpan 吞吐量基准
- BatchWrite 延迟基准
- Query 延迟基准
- 并发写入压力测试

### Load Tests
- 10000 Spans 写入测试
- 100 并发请求追踪测试
- 长时间运行稳定性测试
