# Research: System Monitoring & High Availability

**Feature**: 001-system-monitoring  
**Date**: 2025-12-31

## 1. Go 系统指标采集

### Decision
使用 Go 标准库 `runtime` 包采集内存和 Goroutine 指标，使用 `/proc` 文件系统（Linux）或 `syscall` 包采集 CPU 指标。

### Rationale
- Go 标准库已提供足够的运行时指标
- 无需引入第三方依赖（如 gopsutil）
- 保持单二进制、零依赖的架构原则

### Implementation Details

```go
import "runtime"

// 内存指标
var m runtime.MemStats
runtime.ReadMemStats(&m)
memoryAllocMB := float64(m.Alloc) / 1024 / 1024

// Goroutine 数量
goroutines := runtime.NumGoroutine()
```

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| gopsutil | 引入外部依赖，增加二进制大小 |
| Prometheus client | 架构过重，违反零依赖原则 |

---

## 2. SQLite WAL 文件大小监控

### Decision
通过 `os.Stat()` 直接读取 WAL 文件大小。

### Rationale
- WAL 文件路径固定为 `{db_path}-wal`
- 文件系统操作开销极低
- 无需额外 SQL 查询

### Implementation Details

```go
walPath := dbPath + "-wal"
info, err := os.Stat(walPath)
if err == nil {
    walSizeMB := float64(info.Size()) / 1024 / 1024
}
```

---

## 3. HTTP P95 延迟采集

### Decision
使用中间件拦截所有请求，记录响应时间到 Ring Buffer，定期计算 P95。

### Rationale
- Pocketbase 使用 hook 机制，可以方便地注入中间件
- Ring Buffer 避免内存无限增长
- 本地计算 P95 无需外部服务

### Implementation Details

```go
// Ring Buffer 存储最近 1000 个请求延迟
type LatencyBuffer struct {
    data  []float64
    index int
    mu    sync.Mutex
}

// 计算 P95
func (b *LatencyBuffer) P95() float64 {
    // 排序后取第 95 百分位
}
```

---

## 4. 独立监控数据库配置

### Decision
使用 `synchronous=OFF` + `journal_mode=WAL` 配置监控数据库。

### Rationale
- 监控数据可容忍少量丢失（断电场景）
- 最大化写入性能，避免影响业务
- WAL 模式支持并发读写

### Implementation Details

```go
// metrics.db PRAGMA 配置
pragmas := []string{
    "PRAGMA journal_mode=WAL",
    "PRAGMA synchronous=OFF",
    "PRAGMA temp_store=MEMORY",
    "PRAGMA busy_timeout=1000",
}
```

---

## 5. 前端图表库选型

### Decision
使用现有的 Chart.js 4.x（已在 package.json 中）。

### Rationale
- 项目已有 Chart.js 依赖（用于 LogsChart）
- 支持时间序列图表
- 与 Svelte 集成良好

### Implementation Details
- 复用 `LogsChart.svelte` 的模式
- 使用 `chartjs-adapter-luxon` 处理时间轴
- 支持缩放和平移（已有 `chartjs-plugin-zoom`）

---

## 6. 数据自动清理策略

### Decision
使用 Pocketbase 内置的 Cron 机制，每天凌晨执行清理任务。

### Rationale
- Pocketbase 已有 `tools/cron` 包
- 避免引入外部调度器
- 与现有架构一致

### Implementation Details

```go
app.Cron().Add("metrics_cleanup", "0 3 * * *", func() {
    // DELETE FROM system_metrics WHERE timestamp < datetime('now', '-7 days')
})
```

---

## 7. API 权限控制

### Decision
使用 `RequireSuperuserAuth()` 中间件限制访问。

### Rationale
- 与现有 Pocketbase API 权限模式一致
- 监控数据属于敏感运维信息
- 复用现有认证机制

### Implementation Details

```go
subGroup := rg.Group("/system")
subGroup.Bind(RequireSuperuserAuth())
subGroup.GET("/metrics", metricsHandler)
```
