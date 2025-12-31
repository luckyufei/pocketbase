# Data Model: System Monitoring

**Feature**: 001-system-monitoring  
**Date**: 2025-12-31

## Entities

### SystemMetrics

系统指标记录，存储在独立的 `metrics.db` 数据库中。

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | TEXT | 唯一标识符 (UUID) | PRIMARY KEY |
| timestamp | DATETIME | 采集时间 | NOT NULL, INDEX |
| cpu_usage_percent | REAL | CPU 使用率 (%) | 0-100 |
| memory_alloc_mb | REAL | 已分配内存 (MB) | >= 0 |
| goroutines_count | INTEGER | Goroutine 数量 | >= 0 |
| sqlite_wal_size_mb | REAL | WAL 文件大小 (MB) | >= 0 |
| sqlite_open_conns | INTEGER | 数据库打开连接数 | >= 0 |
| p95_latency_ms | REAL | P95 请求延迟 (ms) | >= 0 |
| http_5xx_count | INTEGER | 5xx 错误计数 (周期内) | >= 0 |

### Schema (SQL)

```sql
-- metrics.db schema
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cpu_usage_percent REAL DEFAULT 0,
    memory_alloc_mb REAL DEFAULT 0,
    goroutines_count INTEGER DEFAULT 0,
    sqlite_wal_size_mb REAL DEFAULT 0,
    sqlite_open_conns INTEGER DEFAULT 0,
    p95_latency_ms REAL DEFAULT 0,
    http_5xx_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp 
ON system_metrics(timestamp);
```

## Database Configuration

### metrics.db PRAGMA

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = OFF;
PRAGMA temp_store = MEMORY;
PRAGMA busy_timeout = 1000;
```

## Data Lifecycle

### Collection
- **Frequency**: 每 60 秒采集一次
- **Buffer**: 内存 Ring Buffer 暂存，批量写入

### Retention
- **Period**: 7 天
- **Cleanup**: 每天 03:00 执行 `DELETE WHERE timestamp < datetime('now', '-7 days')`

### Volume Estimation
- 每分钟 1 条记录
- 7 天 = 7 × 24 × 60 = 10,080 条记录
- 每条约 200 bytes → 总计约 2 MB

## State Transitions

无状态转换，记录为只读追加模式。

## Relationships

```text
┌─────────────────┐
│  metrics.db     │  (独立数据库)
│  ┌───────────┐  │
│  │ system_   │  │
│  │ metrics   │  │
│  └───────────┘  │
└─────────────────┘
        ↑
        │ 写入 (异步)
        │
┌─────────────────┐
│ MetricsCollector│  (Go Goroutine)
└─────────────────┘
        ↑
        │ 采集
        │
┌─────────────────┐
│ Go Runtime      │  CPU, Memory, Goroutines
│ Filesystem      │  WAL size
│ HTTP Middleware │  Latency, 5xx count
└─────────────────┘
```
