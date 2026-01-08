飞将军，非常抱歉。之前的 Spec 在“存储策略”一节中确实倾向于 Postgres，而忽略了 PocketBase 作为 PocketBase 的超集，**必须继承其“单文件交付 (SQLite)”的便携性基因**。

要同时支持这两种数据库，我们不能简单的写两套代码。我们需要一个 **"Storage Abstraction Layer" (存储抽象层)**，并针对两种数据库的物理特性（PG 的并发优势 vs SQLite 的单文件优势）制定不同的写入策略。

以下是修正后的 **PocketBase Unified Observability (Dual-Engine Edition)** 最终版规格说明书。

---

# Spec: PocketBase Unified Observability (Dual-Engine)

**Version**: 2.1.0 (Polyglot Storage)
**Type**: Core System Module
**Target**: `v2.0`
**Core Concept**: "One Interface, Two Engines." (Unified Abstraction over PG & SQLite)

## 1. Problem Essence (核心问题)

PocketBase 需要适应两种极端的部署场景：

1. **Enterprise (Postgres)**: 高并发写入，数据量大，要求不锁表。
2. **Portable (SQLite)**: 单机部署，文件系统 I/O 敏感，要求不阻塞业务库 (`data.db`)。
观测系统产生的是**高吞吐流式数据**，如果处理不好，在 PG 下会产生大量 WAL 日志，在 SQLite 下会产生严重的写锁争用 (database locked)。

## 2. Efficiency ROI (效能回报)

* **Portability**: **100%**. 同一份 PocketBase 二进制文件，既能像 PocketBase 原版一样单文件运行（存 SQLite），也能通过改个 Config 瞬间切换到 PG 集群模式。
* **Write Performance**:
* **PG**: 使用 `UNLOGGED` 表，写入速度接近 Redis。
* **SQLite**: 复用Logs里的 **独立数据库文件** (`auxiliary.db`) + `WAL` 模式，彻底隔离业务 I/O。



## 3. Architecture: The Engine Switch (引擎切换)

### 3.1 Data Pipeline

```mermaid
graph TD
    %% Source
    Spans[Trace Spans] -->|Batch| Buffer[Ring Buffer (Go)]
    
    %% Abstraction Layer
    Buffer -->|Flush| Interface[TraceRepository Interface]
    
    %% Engine Selection (Boot Time)
    Interface -->|Config: PG| EnginePG[Postgres Engine]
    Interface -->|Config: SQLite| EngineLite[SQLite Engine]
    
    %% Physical Storage
    EnginePG -->|UNLOGGED COPY| PG_Table[_traces]
    EngineLite -->|Batch Insert| Lite_File[pb_data/auxiliary.db]

```

### 3.2 Storage Strategy (Engine Specifics)

#### Engine A: PostgreSQL (Enterprise Mode)

* **Strategy**: 极致吞吐。
* **Table Type**: `UNLOGGED TABLE`. (崩溃数据可丢，不写 WAL，减少 I/O 放大)。
* **Insertion**: 使用 `COPY FROM STDIN` 协议进行批量灌入，而非逐条 `INSERT`。
* **Schema**: 使用原生 `JSONB` 存储 Attributes 和 Events，支持 GIN 索引查询。

#### Engine B: SQLite (Portable Mode)

* **Strategy**: 隔离与减负。
* **Isolation**: **绝不**将监控数据写入主库 `data.db`。必须创建独立的 `pb_data/auxiliary.db`。
* **Journal Mode**: `PRAGMA journal_mode = WAL;` (支持读写并发)。
* **Sync Mode**: `PRAGMA synchronous = NORMAL;` (牺牲极端可靠性换取性能)。
* **Schema**: 使用 `TEXT` 存储 JSON 内容，查询时使用 SQLite 的 `json_extract` 函数（PocketBase 需封装方言差异）。

## 4. UI Spec (Monitor Center) - Unchanged

前端 UI **完全感知不到**底层的差异。

* **API Layer**: `/api/traces` 接口负责将前端的查询参数（Time Range, Filters）翻译成对应的 SQL 方言（PG SQL 或 SQLite SQL）。

## 5. Schema Definition (Polyglot)

### 5.1 Abstract Schema (逻辑定义)

Schema Definition: `_traces` Collection

无论底层是谁，逻辑字段一致。

| Field | Type | Description |
| --- | --- | --- |
| `trace_id` | `string` | 32-char Hex |
| `span_id` | `string` | 16-char Hex |
| `parent_id` | `string` | Nullable |
| `name` | `string` | Operation Name |
| `kind` | `string` | Span Kind |
| `start` | `int64` | Unix Microseconds |
| `dur` | `int` | Microseconds |
| `status` | `string` | OK/ERROR |
| `attrs` | `json` | Attributes (JSONB in PG, TEXT in SQLite) |

### 5.2 DDL Implementation (物理定义)

**PostgreSQL**:

```sql
CREATE UNLOGGED TABLE _traces (
    -- ... 同前
    attributes JSONB
);
-- 针对 JSON 字段建索引
CREATE INDEX idx_traces_attrs ON _traces USING GIN (attributes);

```

**SQLite**:

```sql
CREATE TABLE _traces (
    -- ...
    attributes TEXT -- 存 JSON 字符串
);
-- SQLite 索引只能对提取后的值建，或者只建标准字段索引
CREATE INDEX idx_traces_dur ON _traces (duration);

```

## 6. Implementation Plan (实施计划)

### Step 1: Interface Definition (Go)

在 `core/tracing` 包中定义接口：

```go
type TraceRepository interface {
    // 批量写入 (Fire & Forget)
    BatchWrite(spans []*Span) error
    
    // 查询 (供 UI 使用)
    Query(filter FilterParams) ([]*Span, error)
    
    // 清理 (Cron)
    Prune(retention time.Duration) error
}

```

### Step 2: Engine Implementation

* **`pg_repo.go`**: 实现 PG 版逻辑。
* 使用 `pgx.CopyFrom` 接口实现极速写入。
* 查询使用 `dbx` + PG 方言 (`attrs->>'user_id'`).


* **`sqlite_repo.go`**: 实现 SQLite 版逻辑。
* 初始化时自动创建/挂载 `auxiliary.db`。
* 查询使用 `dbx` + SQLite 方言 (`json_extract(attrs, '$.user_id')`).



### Step 3: Boot Loader

在 `app.go` 启动时：

```go
if app.IsPgMode() {
    tracingRepo = NewPgRepo(app.DB())
} else {
    // 自动在 pb_data 下创建独立库
    tracingRepo = NewSqliteRepo(filepath.Join(app.DataDir(), "auxiliary.db"))
}

```

## 7. Boundaries & Anti-Stupidity (防愚蠢)

1. **SQLite Concurrency Cap**:
* **限制**: 在 SQLite 模式下，如果写入缓冲队列（RingBuffer）超过 5000 条积压，**直接丢弃**新来的 Span。
* **理由**: 避免监控系统为了写日志把磁盘 I/O 占满，导致业务主库 `data.db` 变慢。**业务优先，监控次之。**


2. **Cross-DB Query (Not Supported)**:
* 监控数据只能查自己的库。不要试图做 `JOIN _traces ON users.id` 这种跨库操作（特别是在 SQLite 模式下，物理文件都不同）。
* UI 层如果需要补充用户信息，应该先查 Trace，拿到 `user_id` 后再单独查 Users 表补全。


3. **Migration-Free**:
* `_traces` 表（及 `_metrics` 表）**不参与** PocketBase 的标准 Migration 流程。
* 它们由观测模块在启动时自行检查并创建。因为它们是“临时数据”，不需要像业务数据那样严谨的版本管理。



---

**飞将军的总结**：
修正后的 Spec 更加健壮。
它让 PocketBase 保持了“变色龙”般的特性：

* 在你的 MacBook 上开发时，它是轻巧的单文件系统 (`auxiliary.db`)。
* 部署到 AWS 生产环境时，它是强悍的企业级系统 (`UNLOGGED TABLE`)。
这才是真正的 **PocketBase** —— 既能停在自家后院，也能飞向万米高空。