# Metrics Plugin

系统监控插件，采集 CPU、内存、Goroutine、数据库连接、HTTP 延迟等系统指标。

## 快速开始

```go
import (
    "time"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/metrics"
)

func main() {
    app := pocketbase.New()
    
    // 注册 metrics 插件
    metrics.MustRegister(app, metrics.Config{
        CollectionInterval: 60 * time.Second, // 采集间隔
        RetentionDays:      7,                // 数据保留天数
        EnableMiddleware:   true,             // 自动注册请求追踪中间件
    })
    
    app.Start()
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `Disabled` | bool | false | 禁用插件 |
| `CollectionInterval` | time.Duration | 60s | 采集间隔 |
| `RetentionDays` | int | 7 | 数据保留天数 |
| `LatencyBufferSize` | int | 1000 | 延迟 Ring Buffer 大小 |
| `EnableMiddleware` | bool | true | 自动注册请求追踪中间件 |
| `CleanupCron` | string | "0 3 * * *" | 清理任务 Cron 表达式 |
| `ResetLatencyBufferOnCollect` | bool | false | 采集后是否重置延迟 Buffer |

## 环境变量

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `PB_METRICS_DISABLED` | 禁用插件 | `true` |
| `PB_METRICS_INTERVAL` | 采集间隔（秒）| `60` |
| `PB_METRICS_RETENTION_DAYS` | 数据保留天数 | `7` |
| `PB_METRICS_BUFFER_SIZE` | Ring Buffer 大小 | `1000` |
| `PB_METRICS_MIDDLEWARE` | 启用中间件 | `true` |
| `PB_METRICS_CLEANUP_CRON` | 清理 Cron 表达式 | `0 3 * * *` |
| `PB_METRICS_RESET_LATENCY_BUFFER` | 采集后重置延迟 Buffer | `true` |

## API 端点

### GET /api/system/metrics

获取历史监控数据。

**权限**: 仅 Superuser

**查询参数**:
- `hours` (int): 查询时间范围，单位小时，默认 24，最大 168
- `limit` (int): 返回记录数限制，默认 1000，最大 10000

**响应示例**:

```json
{
  "items": [
    {
      "id": "abc123",
      "timestamp": "2026-02-05T10:00:00Z",
      "cpu_usage_percent": 2.5,
      "memory_alloc_mb": 128.5,
      "goroutines_count": 50,
      "sqlite_wal_size_mb": 1.2,
      "sqlite_open_conns": 5,
      "p95_latency_ms": 15.3,
      "http_5xx_count": 0
    }
  ],
  "totalItems": 1
}
```

### GET /api/system/metrics/current

获取当前系统状态。

**权限**: 仅 Superuser

**响应示例**:

```json
{
  "id": "abc123",
  "timestamp": "2026-02-05T10:00:00Z",
  "cpu_usage_percent": 2.5,
  "memory_alloc_mb": 128.5,
  "goroutines_count": 50,
  "sqlite_wal_size_mb": 1.2,
  "sqlite_open_conns": 5,
  "p95_latency_ms": 15.3,
  "http_5xx_count": 0
}
```

## 采集指标

| 指标 | 字段名 | 说明 |
|-----|--------|------|
| CPU 使用率 | `cpu_usage_percent` | 进程 CPU 使用率（纯 Go 实现，支持 Linux/macOS）|
| 内存分配 | `memory_alloc_mb` | 当前内存分配大小 (MB) |
| Goroutine 数量 | `goroutines_count` | 当前 Goroutine 数量 |
| WAL 文件大小 | `sqlite_wal_size_mb` | SQLite WAL 文件总大小 (MB) |
| 数据库连接数 | `sqlite_open_conns` | 当前打开的数据库连接数 |
| P95 延迟 | `p95_latency_ms` | 最近请求的 P95 延迟 (ms) |
| 5xx 错误数 | `http_5xx_count` | 采集周期内的 5xx 错误计数 |

## 数据存储

监控数据存储在 `auxiliary.db` 数据库的 `_metrics` 表中，与业务数据物理隔离。

## Programmatic API

```go
// 获取 Collector（用于手动记录延迟）
collector := metrics.GetCollector(app)
if collector != nil {
    collector.RecordLatency(15.5)  // 记录 15.5ms 延迟
    collector.RecordError(500)     // 记录 5xx 错误
}

// 获取 Repository（用于手动查询数据）
repo := metrics.GetRepository(app)
if repo != nil {
    latest, _ := repo.GetLatest()
    items, total, _ := repo.GetByTimeRange(24, 1000)
}
```

## 中间件

如果 `EnableMiddleware` 设为 `false`，可以手动注册中间件：

```go
app.OnServe().BindFunc(func(e *core.ServeEvent) error {
    e.Router.BindFunc(metrics.Middleware(app))
    return e.Next()
})
```
