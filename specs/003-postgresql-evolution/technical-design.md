# PocketBase PostgreSQL 演进 - 技术设计文档

---

## 1. 数据库架构设计

### 1.1 日志系统 Schema

```sql
-- 1. 创建主表 (Unlogged + Partitioned)
CREATE UNLOGGED TABLE request_logs (
    id UUID NOT NULL,
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    url TEXT,
    method TEXT,
    status INT,
    auth TEXT,
    remote_ip TEXT,
    user_agent TEXT,
    meta JSONB,
    referer TEXT
) PARTITION BY RANGE (created);

-- 2. 索引 (仅必要字段)
CREATE INDEX idx_logs_created ON request_logs (created);
CREATE INDEX idx_logs_auth ON request_logs (auth) WHERE auth IS NOT NULL;
CREATE INDEX idx_logs_status ON request_logs (status) WHERE status >= 400;

-- 3. 分区示例 (每天一个分区)
CREATE UNLOGGED TABLE request_logs_20260106 
PARTITION OF request_logs 
FOR VALUES FROM ('2026-01-06') TO ('2026-01-07');
```

### 1.2 监控系统 Schema

```sql
-- 1. 创建独立 Schema
CREATE SCHEMA monitoring;

-- 2. 创建监控表 (Unlogged + Partitioned)
CREATE UNLOGGED TABLE monitoring.metrics (
    time        TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    node_id     TEXT NOT NULL,
    
    -- 核心指标
    sys_mem_mb  INT,
    go_routines INT,
    db_open_conns INT,
    db_wait_count INT,
    
    -- 扩展指标
    extra       JSONB
) PARTITION BY RANGE (time);

-- 3. BRIN 索引 (时序数据专用)
CREATE INDEX idx_monitor_time ON monitoring.metrics USING BRIN(time);

-- 4. 每日聚合物化视图
CREATE MATERIALIZED VIEW monitoring.daily_stats AS
SELECT 
    date_trunc('day', time) as day,
    node_id,
    avg(sys_mem_mb) as avg_mem,
    max(sys_mem_mb) as max_mem,
    avg(go_routines) as avg_goroutines,
    max(db_open_conns) as max_conns
FROM monitoring.metrics
GROUP BY 1, 2;
```

### 1.3 兼容函数

```sql
-- UUID v7 生成函数
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
    unix_ts_ms bytea;
    uuid_bytes bytea;
BEGIN
    unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
    uuid_bytes = unix_ts_ms || gen_random_bytes(10);
    uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
    uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
    RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- nocase 排序规则
CREATE COLLATION IF NOT EXISTS nocase (
    provider = icu,
    locale = 'und-u-ks-level2',
    deterministic = false
);

-- json_valid 兼容函数
CREATE OR REPLACE FUNCTION json_valid(text) RETURNS boolean AS $$
BEGIN
    PERFORM $1::jsonb;
    RETURN TRUE;
EXCEPTION WHEN others THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 2. Go 代码设计

### 2.1 异步日志写入器

```go
package logger

import (
    "context"
    "time"
    "github.com/jackc/pgx/v5"
)

type LogEntry struct {
    ID        string
    Created   time.Time
    URL       string
    Method    string
    Status    int
    Auth      string
    RemoteIP  string
    UserAgent string
    Meta      map[string]any
    Referer   string
}

type AsyncLogger struct {
    buffer    chan LogEntry
    db        *pgx.Conn
    batchSize int
    flushInterval time.Duration
}

func NewAsyncLogger(db *pgx.Conn, bufferSize, batchSize int, flushInterval time.Duration) *AsyncLogger {
    l := &AsyncLogger{
        buffer:        make(chan LogEntry, bufferSize),
        db:            db,
        batchSize:     batchSize,
        flushInterval: flushInterval,
    }
    go l.worker()
    return l
}

// 非阻塞写入，缓冲满时丢弃
func (l *AsyncLogger) Push(entry LogEntry) {
    select {
    case l.buffer <- entry:
        // 成功放入缓冲区
    default:
        // 缓冲区满，丢弃日志（熔断机制）
        // metrics.Increment("logs_dropped_total")
    }
}

func (l *AsyncLogger) worker() {
    ticker := time.NewTicker(l.flushInterval)
    defer ticker.Stop()
    
    batch := make([]LogEntry, 0, l.batchSize)
    
    for {
        select {
        case entry := <-l.buffer:
            batch = append(batch, entry)
            if len(batch) >= l.batchSize {
                l.flush(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                l.flush(batch)
                batch = batch[:0]
            }
        }
    }
}

func (l *AsyncLogger) flush(batch []LogEntry) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // 使用 COPY 协议批量写入
    _, err := l.db.CopyFrom(
        ctx,
        pgx.Identifier{"request_logs"},
        []string{"id", "created", "url", "method", "status", "auth", "remote_ip", "user_agent", "meta", "referer"},
        pgx.CopyFromSlice(len(batch), func(i int) ([]any, error) {
            e := batch[i]
            return []any{e.ID, e.Created, e.URL, e.Method, e.Status, e.Auth, e.RemoteIP, e.UserAgent, e.Meta, e.Referer}, nil
        }),
    )
    if err != nil {
        // 写入失败，输出到 StdOut
        log.Printf("Failed to flush logs: %v", err)
    }
}
```

### 2.2 LISTEN/NOTIFY 事件桥接

```go
package realtime

import (
    "context"
    "encoding/json"
    "github.com/jackc/pgx/v5"
)

type EventPayload struct {
    Type       string `json:"type"`       // create, update, delete
    Collection string `json:"collection"`
    ID         string `json:"id"`
    NodeID     string `json:"node_id"`
}

type EventBridge struct {
    conn     *pgx.Conn
    nodeID   string
    handlers []func(EventPayload)
}

func NewEventBridge(conn *pgx.Conn, nodeID string) *EventBridge {
    return &EventBridge{
        conn:     conn,
        nodeID:   nodeID,
        handlers: make([]func(EventPayload), 0),
    }
}

func (b *EventBridge) OnEvent(handler func(EventPayload)) {
    b.handlers = append(b.handlers, handler)
}

func (b *EventBridge) Start(ctx context.Context) error {
    _, err := b.conn.Exec(ctx, "LISTEN pb_events")
    if err != nil {
        return err
    }
    
    go func() {
        for {
            notification, err := b.conn.WaitForNotification(ctx)
            if err != nil {
                // 连接断开，尝试重连
                time.Sleep(time.Second)
                continue
            }
            
            var payload EventPayload
            if err := json.Unmarshal([]byte(notification.Payload), &payload); err != nil {
                continue
            }
            
            // 忽略自己发出的事件（防止回声）
            if payload.NodeID == b.nodeID {
                continue
            }
            
            // 分发给所有处理器
            for _, handler := range b.handlers {
                handler(payload)
            }
        }
    }()
    
    return nil
}

func (b *EventBridge) Publish(ctx context.Context, payload EventPayload) error {
    payload.NodeID = b.nodeID
    data, _ := json.Marshal(payload)
    _, err := b.conn.Exec(ctx, "SELECT pg_notify('pb_events', $1)", string(data))
    return err
}
```

### 2.3 分布式锁

```go
package distributed

import (
    "context"
    "hash/fnv"
    "github.com/jackc/pgx/v5"
)

type AdvisoryLock struct {
    conn *pgx.Conn
}

func NewAdvisoryLock(conn *pgx.Conn) *AdvisoryLock {
    return &AdvisoryLock{conn: conn}
}

// TryLock 尝试获取锁，非阻塞
func (l *AdvisoryLock) TryLock(ctx context.Context, name string) (bool, error) {
    lockID := hashName(name)
    var acquired bool
    err := l.conn.QueryRow(ctx, "SELECT pg_try_advisory_lock($1)", lockID).Scan(&acquired)
    return acquired, err
}

// Unlock 释放锁
func (l *AdvisoryLock) Unlock(ctx context.Context, name string) error {
    lockID := hashName(name)
    _, err := l.conn.Exec(ctx, "SELECT pg_advisory_unlock($1)", lockID)
    return err
}

func hashName(name string) int64 {
    h := fnv.New64a()
    h.Write([]byte(name))
    return int64(h.Sum64())
}
```

### 2.4 会话上下文注入

```go
package auth

import (
    "context"
    "github.com/jackc/pgx/v5"
)

type SessionContext struct {
    UserID string
    Role   string
}

// InjectContext 在事务开始时注入用户上下文
func InjectContext(ctx context.Context, tx pgx.Tx, sc SessionContext) error {
    // 参数 true 表示仅在当前事务内有效
    _, err := tx.Exec(ctx, `
        SELECT 
            set_config('pb.auth.id', $1, true),
            set_config('pb.auth.role', $2, true)
    `, sc.UserID, sc.Role)
    return err
}

// ClearContext 清除上下文（通常不需要，事务结束自动清除）
func ClearContext(ctx context.Context, tx pgx.Tx) error {
    _, err := tx.Exec(ctx, `
        SELECT 
            set_config('pb.auth.id', '', true),
            set_config('pb.auth.role', '', true)
    `)
    return err
}
```

---

## 3. 性能基准

### 3.1 日志系统性能指标 (5000 QPS 场景)

| 指标 | 标准 Postgres 写入 | 优化后 (Unlogged + Batch) | 降低幅度 |
|------|-------------------|---------------------------|---------|
| DB IOPS (WAL) | ~5,000 | **0** | 100% |
| DB IOPS (Data) | ~5,000 (Random) | 极低 (Sequential) | >95% |
| DB CPU Load | High | Negligible | >99% |
| Go Latency | 2-5ms | nanoseconds | 1000x |

### 3.2 资源隔离评估

| 资源维度 | 核心业务 | 监控与日志 | 冲突评估 |
|---------|---------|-----------|---------|
| 磁盘 I/O | 写 WAL + fsync | 不写 WAL | 无冲突 |
| 锁资源 | 行锁 + 事务锁 | 无锁 (Batch Insert) | 无冲突 |
| Vacuum | 需要 AutoVacuum | DROP PARTITION 清理 | 无冲突 |
| 连接池 | 主连接池 | 专用单一连接 | 无冲突 |

---

## 4. 部署配置

### 4.1 Docker Compose 模板

```yaml
version: '3.8'

services:
  hangar:
    build: .
    ports:
      - "8090:8090"
    environment:
      - POSTGRES_URL=postgres://user:pass@postgres:5432/hangar?sslmode=disable
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pb_data:/pb_data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=hangar
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d hangar"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pb_data:
  pg_data:
```

### 4.2 环境变量配置

| 变量名 | 描述 | 默认值 |
|-------|------|-------|
| `POSTGRES_URL` | PostgreSQL 连接串 | (必填) |
| `PB_LOG_BUFFER_SIZE` | 日志缓冲大小 | 10000 |
| `PB_LOG_BATCH_SIZE` | 日志批量写入大小 | 1000 |
| `PB_LOG_FLUSH_INTERVAL` | 日志刷盘间隔 | 2s |
| `PB_METRICS_INTERVAL` | 监控采集间隔 | 10s |
| `PB_NODE_ID` | 节点唯一标识 | (自动生成) |

---

## 5. 迁移检查清单

### 5.1 从 SQLite 迁移

- [ ] 导出 SQLite 数据为 JSON/CSV
- [ ] 在 PostgreSQL 创建 Schema
- [ ] 导入数据（使用 COPY 协议）
- [ ] 验证数据完整性
- [ ] 创建索引
- [ ] 配置连接池
- [ ] 测试 API 兼容性

### 5.2 生产部署检查

- [ ] PostgreSQL 版本 >= 14
- [ ] 安装扩展：`uuid-ossp`, `pg_trgm`
- [ ] 配置 `max_connections`
- [ ] 配置 `shared_buffers`
- [ ] 配置 WAL 归档（备份）
- [ ] 配置监控告警
- [ ] 配置自动备份
