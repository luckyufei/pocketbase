这是一个为您量身定制的 `spec.md` 文档。它完全汇总了我们在过去几轮对话中确定的技术决策，遵循 **"Simple, Linear, Deep"** 的架构原则，并采用了标准的 Technical Specification 格式。

你可以直接将此文件保存为 `spec.md` 放入你的项目根目录。

---

# AI Agent Platform - Core Architecture Spec

| Attribute | Details |
| --- | --- |
| **Project** | AI Agent Platform (Pocketbase Pivot) |
| **Author** | Allan Yu (飞将军) |
| **Status** | **Draft** / Approved |
| **Date** | 2025-12-31 |
| **Version** | v1.0 |
| **Stack** | Go, Pocketbase, SQLite, sqlite-vec, React |

---

## 1. Context & Scope (背景与范围)

### 1.1 Context

项目正从传统的 Low-code 平台转型为 **AI Native Agent Platform**。新系统需要支持高性能的 RAG（检索增强生成）能力，同时保持“单机高性能”和“零运维成本”的架构优势。

### 1.2 Scope

本设计文档覆盖系统的核心后端架构改造，具体包括：

1. **向量数据库集成**：嵌入式向量检索方案。
2. **存储引擎优化**：针对数十亿级数据吞吐的 SQLite 调优。
3. **高可靠监控**：基于双数据库隔离的内建监控系统。

### 1.3 Architecture Philosophy

* **Simple**: Single Binary (Go build), Zero External Dependencies (No Docker required for core logic).
* **Linear**: 清晰的数据流向，无复杂的微服务调用链。
* **Deep**: 深入 OS 和 SQLite 内核层级的性能压榨。

---

## 2. Architecture Design (架构设计)

### 2.1 System Topology

系统采用 **"One Binary, Two Databases"** 架构。

```mermaid
graph TD
    User[Client / Agent] -->|HTTP/gRPC| PB[Pocketbase Core]
    
    subgraph "Single Binary Process"
        PB -->|Logic| VectorEngine[Vector Search (sqlite-vec)]
        PB -->|Logic| MonitorAgent[Monitor Agent (Go Routine)]
    end

    subgraph "Storage Layer (Filesystem)"
        VectorEngine -->|Read/Write| DB_Main[data.db (Business + Vectors)]
        MonitorAgent -->|Write (Async)| DB_Metrics[metrics.db (Logs + Stats)]
    end

```

### 2.2 Key Decisions

1. **Vector Engine**: 选用 `sqlite-vec` (CGO集成)。
* *Reason*: 保持单文件架构，100k-500k 向量规模下性能满足需求，Recall 100%。


2. **Monitoring**: 自研 Dual-DB 方案。
* *Reason*: 避免引入 Prometheus/VictoriaMetrics 造成架构臃肿；实现业务 IO 与监控 IO 的物理隔离。


3. **Optimization**: 启用 SQLite WAL + MMAP。
* *Reason*: 利用 OS Page Cache 处理高并发读取。



---

## 3. Vector Search Specification (向量检索)

### 3.1 Technology

* **Library**: `github.com/asg017/sqlite-vec-go-bindings/cgo`
* **Dimension**: 1536 (Compatible with OpenAI `text-embedding-3-small`).
* **Indexing**: Brute Force (Phase 1) -> IVF (Phase 2).

### 3.2 Schema (`data.db`)

在主业务库中通过 Virtual Table 扩展向量能力。

```sql
-- 启用向量扩展
LOAD 'vec0';

-- 创建向量存储表
CREATE VIRTUAL TABLE vec_knowledge USING vec0(
    item_id INTEGER PRIMARY KEY, -- 关联到 knowledge_base 表的主键
    embedding float[1536]        -- 向量数据
);

```

### 3.3 Query Strategy

* **Write**: 事务性写入。当 `knowledge_base` 表插入新记录时，同步写入 `vec_knowledge`。
* **Read**: 使用 SQL 进行距离计算。
```sql
SELECT item_id, distance
FROM vec_knowledge
WHERE embedding MATCH :query_vector
ORDER BY distance
LIMIT :top_k;

```



---

## 4. Storage Engine Optimization (存储调优)

为应对潜在的 6.7B 级别数据读取和高并发写入，在 `main.go` 启动时强制注入以下 Pragma 配置。

| Pragma | Value | Purpose |
| --- | --- | --- |
| `journal_mode` | `WAL` | 启用写前日志，支持并发读写。 |
| `synchronous` | `NORMAL` | 减少 `fsync` 调用，牺牲极低概率的断电安全性换取 3-10倍 写入性能。 |
| `mmap_size` | `30GB` | 允许 OS 将最大 30GB 的 DB 文件映射到内存，实现 Zero-Copy 读取。 |
| `temp_store` | `MEMORY` | 临时表完全在内存中操作。 |
| `busy_timeout` | `5000` | 锁等待时间 5秒，减少 "Database Locked" 错误。 |

---

## 5. Reliability & Monitoring (监控与高可用)

### 5.1 Dual-DB Isolation

监控数据不得污染业务数据库 WAL，必须物理隔离。

* **Primary DB**: `pb_data/data.db` (Business Critical, Sync=NORMAL).
* **Metrics DB**: `pb_data/metrics.db` (Ephemeral, Sync=OFF).

### 5.2 Metrics Collection (In-Process)

* **Mechanism**: Go `time.Ticker` (1 minute interval).
* **Buffer**: In-memory Ring Buffer (防止高频 IO).
* **Retention**: Rolling delete (Keep last 7 days).

### 5.3 Schema (`metrics.db`)

```sql
CREATE TABLE system_metrics (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_usage_percent REAL,
    memory_alloc_mb REAL,
    goroutines_count INTEGER,
    sqlite_wal_size_mb REAL,     -- 核心健康指标
    sqlite_open_conns INTEGER,   -- 连接池负载
    p95_latency_ms REAL,         -- 接口响应速度
    http_5xx_count INTEGER       -- 错误计数
);
CREATE INDEX idx_ts ON system_metrics(timestamp);

```

---

## 6. API Specifications (接口定义)

### 6.1 Vector Search API

* **Endpoint**: `POST /api/ai/search`
* **Auth**: User/Admin
* **Body**:
```json
{
  "collection": "knowledge_base",
  "query_text": "什么是 First Principles?",
  "top_k": 5
}

```


* **Response**: Returns list of records with `similarity_score`.

### 6.2 System Metrics API

* **Endpoint**: `GET /api/system/metrics`
* **Auth**: **Admin Only**
* **Params**: `?hours=24`
* **Response**:
```json
[
  {
    "timestamp": "2025-12-31 10:00:00",
    "cpu": 12.5,
    "memory": 256.0,
    "wal_size": 4.2,
    "latency": 45
  },
  ...
]

```



---

## 7. Implementation Roadmap (实施路线图)

### Phase 1: Foundation (Week 1)

* [ ] 初始化 `main.go`，集成 Turbo Mode 配置。
* [ ] 实现 `metrics.db` 初始化逻辑及 `metricsDB` 全局连接实例。
* [ ] 实现 Go Native Collector，完成 CPU/RAM/WAL 指标采集与写入。

### Phase 2: Vector Core (Week 2)

* [ ] 引入 `sqlite-vec` CGO 依赖。
* [ ] 编写 Migration 脚本创建 Virtual Table。
* [ ] 实现 "Text -> OpenAI Embedding -> SQLite Insert" 的 helper function。

### Phase 3: Visualization (Week 3)

* [ ] 在 React 前端实现 System Dashboard 页面。
* [ ] 对接 `/api/system/metrics` 接口，使用 Recharts 绘制趋势图。
* [ ] 设置 Uptime Robot 外部心跳检测。

---

**End of Spec**