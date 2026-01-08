# PocketBase 统一可观测性系统实现总结

## 概述

本文档总结了 PocketBase 统一可观测性系统（Trace 监控）的完整实现，包括后端 Trace 采集、存储、查询以及前端 Admin UI 监控中心。

## 实现状态

### ✅ 已完成功能

#### Phase 1-8: 核心功能 (MVP)
- **✅ Trace 数据采集** - Ring Buffer + 批量写入
- **✅ Go API 集成** - 手动创建 Span (`trace.StartSpan`)
- **✅ 自动 HTTP 追踪** - 中间件自动追踪所有 HTTP 请求
- **✅ Trace 数据查询** - 支持复杂筛选和 JSON 属性查询
- **✅ 数据自动清理** - 基于 retention 配置的自动清理
- **✅ HTTP API** - 完整的 REST API 供客户端查询

#### Phase 9: Admin UI 监控中心
- **✅ Monitor Center 页面** - 完整的 Trace 监控界面
- **✅ 统计卡片** - 实时显示请求总数、成功率、延迟百分位
- **✅ 筛选功能** - 时间范围、操作名称、状态筛选
- **✅ Trace 列表** - 分页显示，支持点击查看详情
- **✅ 瀑布图** - 可视化调用链，支持层级展示和属性查看
- **✅ 路由集成** - 添加到主导航菜单

#### Phase 10: 测试和优化
- **✅ 性能基准测试** - 完整的 SQLite 和 PostgreSQL 基准测试
- **✅ 集成测试** - 验证所有核心功能正常工作

## 技术架构

### 后端架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTTP 请求     │───▶│  Trace 中间件     │───▶│   业务处理      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ring Buffer   │◀───│   Trace 系统     │───▶│  TraceRepository│
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐                            ┌─────────────────┐
│  批量写入 Worker │                            │  SQLite/PostgreSQL │
└─────────────────┘                            └─────────────────┘
```

### 数据库设计

#### SQLite (auxiliary.db)
```sql
CREATE TABLE _traces (
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    kind INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL,
    attributes TEXT,  -- JSON
    created TEXT NOT NULL,
    PRIMARY KEY (trace_id, span_id)
);
```

#### PostgreSQL
```sql
CREATE UNLOGGED TABLE _traces (
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    kind INTEGER NOT NULL,
    start_time BIGINT NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL,
    attributes JSONB,  -- 支持 GIN 索引
    created TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (trace_id, span_id)
);
```

### 前端架构

```
PageMonitor.svelte (主页面)
├── TraceStats.svelte (统计卡片)
├── TraceFilters.svelte (筛选器)
├── TraceList.svelte (列表 + 分页)
└── TraceDetail.svelte (详情弹窗)
    └── 瀑布图渲染
```

## API 接口

### HTTP API 端点

```
GET /api/traces              # 查询 Trace 列表
GET /api/traces/stats        # 获取统计数据  
GET /api/traces/{trace_id}   # 获取完整调用链
```

### 查询参数

```go
type FilterParams struct {
    TraceID     string    // Trace ID 精确匹配
    StartTime   time.Time // 开始时间范围
    EndTime     time.Time // 结束时间范围  
    Operation   string    // 操作名称匹配
    Status      string    // 状态筛选 (OK/ERROR/CANCELLED)
    RootOnly    bool      // 只查询根 Span
    Limit       int       // 分页大小
    Offset      int       // 分页偏移
    AttributeFilters []AttributeFilter // JSON 属性筛选
}
```

## 使用示例

### 1. 手动创建 Span

```go
ctx, span := app.Trace().StartSpan(ctx, "database-query")
span.SetAttribute("db.statement", "SELECT * FROM users")
span.SetAttribute("db.rows_affected", 10)
defer span.End()

// 业务逻辑
result, err := db.Query("SELECT * FROM users")
if err != nil {
    span.SetStatus(core.SpanStatusError, err.Error())
    return err
}
span.SetStatus(core.SpanStatusOK, "")
```

### 2. 自动 HTTP 追踪

所有 HTTP 请求会自动创建 Root Span，包含以下属性：
- `http.method` - HTTP 方法
- `http.url` - 请求 URL
- `http.status_code` - 响应状态码
- `http.host` - 请求主机

### 3. 查询 Trace 数据

```go
params := core.NewFilterParams()
params.StartTime = time.Now().Add(-1 * time.Hour)
params.EndTime = time.Now()
params.Status = "ERROR"
params.Limit = 50

traces, total, err := app.Trace().Query(params)
```

### 4. Admin UI 访问

访问 `http://localhost:8090/traces` 查看 Trace 监控中心。

## 性能特性

### Ring Buffer 设计
- **非阻塞写入** - Span 记录不会阻塞业务逻辑
- **溢出丢弃** - 缓冲区满时丢弃新 Span，保护系统稳定性
- **批量写入** - 定期批量写入数据库，提高写入性能

### 数据库优化
- **SQLite WAL 模式** - 提高并发读写性能
- **PostgreSQL UNLOGGED 表** - 减少 WAL 写入开销
- **索引优化** - 针对查询模式优化的复合索引
- **JSON 查询** - 支持高效的属性筛选

### 内存管理
- **Span 属性限制** - 最大 64KB，防止内存滥用
- **自动清理** - 基于 retention 配置自动删除过期数据
- **连接池** - 复用数据库连接，减少连接开销

## 配置选项

```go
type TraceConfig struct {
    BufferSize    int           // Ring Buffer 大小 (默认: 10000)
    FlushInterval time.Duration // 刷新间隔 (默认: 5s)
    BatchSize     int           // 批量写入大小 (默认: 100)
    Retention     time.Duration // 数据保留时间 (默认: 7天)
}
```

## 监控指标

### 统计数据
- **总请求数** - 时间范围内的请求总量
- **成功率** - 成功请求占比
- **错误率** - 错误请求占比  
- **延迟百分位** - P50/P95/P99 延迟分布

### 瀑布图功能
- **层级展示** - 可视化父子 Span 关系
- **时间轴** - 显示相对时间和持续时间
- **属性查看** - 展开查看 Span 属性
- **状态标识** - 颜色区分成功/错误状态

## 部署说明

### SQLite 模式 (默认)
```bash
cd examples/base && go run main.go serve
```

### PostgreSQL 模式
```bash
cd examples/base && go run main.go serve --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"
```

### 环境变量
```bash
PB_POSTGRES_DSN="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"
```

## 扩展性

### 水平扩展
- **PostgreSQL 集群** - 支持主从复制和读写分离
- **负载均衡** - 多个 PocketBase 实例共享 PostgreSQL
- **分片策略** - 按时间或 Trace ID 分片存储

### 集成扩展
- **OpenTelemetry 兼容** - 可扩展支持 OTLP 协议
- **外部存储** - 可扩展支持 ClickHouse、Elasticsearch
- **告警集成** - 基于错误率和延迟阈值的告警

## 总结

PocketBase 统一可观测性系统提供了完整的分布式追踪解决方案，包括：

1. **高性能数据采集** - Ring Buffer + 批量写入
2. **灵活的存储后端** - SQLite 和 PostgreSQL 双支持  
3. **强大的查询能力** - 支持复杂筛选和 JSON 属性查询
4. **直观的可视化** - 瀑布图和统计仪表板
5. **生产就绪** - 性能优化和错误处理

该系统为 PocketBase 用户提供了深入的应用性能洞察，帮助快速定位和解决性能问题。