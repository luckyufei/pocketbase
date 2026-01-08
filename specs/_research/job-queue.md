这是为您定制的 **PocketBase Native Job Queue (`_jobs`)** 需求说明书。

它利用 PostgreSQL 极其强悍的并发控制能力，剔除了 Redis/RabbitMQ 等外部依赖，构建了一个 **ACID 级别可靠、零运维成本** 的异步任务系统。

---

# Spec: PocketBase Native Job Queue (`_jobs`)

**Version**: 1.0.0 (Final)
**Type**: Core Infrastructure
**Target**: `v2.2` (Async Processing)
**Core Concept**: "Postgres is the only queue you need." (Up to 10k jobs/sec)

## 1. Problem Essence (核心问题)

AI Agent 场景（如 RAG 索引构建、长文本生成）通常耗时较长（分钟级），直接在 HTTP 请求中同步处理会导致网关超时（Vercel 限制 10s-60s）及用户体验阻塞。引入 Redis/Celery 虽能解决，但破坏了 PocketBase "单体应用" 的架构简洁性，增加了运维负担。

## 2. Efficiency ROI (效能回报)

* **Simplicity**: **No Extra Infra**. 不需要维护 Redis 或 RabbitMQ，数据库即队列。
* **Reliability**: **Transactional**. 任务入队与业务数据写入（如创建 Order）在同一个 DB 事务中。要么一起成功，要么一起失败。绝无“数据写了但消息丢了”的分布式一致性问题。
* **Performance**: **High Concurrency**. 利用 PG `SKIP LOCKED` 特性，支持多 Worker 并发抢占，无锁冲突。

## 3. Spec/Design (系统设计)

### 3.1 Architecture: The Pull Model (拉取模型)

```mermaid
graph TD
    subgraph "Producer (HTTP Request)"
        API[WASM / Go Handler] -->|1. Enqueue (INSERT)| DB[(Postgres _jobs)]
        API -.->|2. NOTIFY (Optional)| DB
    end

    subgraph "Consumer (PocketBase Worker Pool)"
        Worker1[Worker 1]
        Worker2[Worker 2]
        Dispatcher[Go Dispatcher]
    end

    Dispatcher -->|3. LISTEN / Poll| DB
    Dispatcher -->|4. SELECT FOR UPDATE SKIP LOCKED| DB
    Dispatcher -->|5. Distribute| Worker1
    Dispatcher -->|5. Distribute| Worker2
    
    Worker1 -->|6. Execute| WASM[WASM Runtime]
    Worker1 -->|7. Update Status| DB

```

### 3.2 Schema Definition: `_jobs` Collection

系统级表，存储任务状态与元数据。

| Field | Type | Options | Description |
| --- | --- | --- | --- |
| **`id`** | `text` | System | UUID v7 (Sortable) |
| **`topic`** | `text` | Required | 任务类型 (e.g. `pdf_embedding`) |
| **`payload`** | `json` | Required | 参数数据 (e.g. `{"file_id": "..."}`) |
| **`status`** | `text` | Index | `pending`, `processing`, `completed`, `failed` |
| **`run_at`** | `date` | Index | **调度核心**。默认 `NOW()`，未来时间即为延时任务。 |
| **`locked_until`** | `date` | System | 可见性超时 (防止 Worker 崩溃导致任务死锁) |
| **`retries`** | `number` | Default 0 | 当前重试次数 |
| **`max_retries`** | `number` | Default 3 | 最大重试次数 |
| **`last_error`** | `text` | System | 错误堆栈记录 |

### 3.3 The Core Loop: `SKIP LOCKED` (核心机制)

这是 PocketBase Queue 高性能的秘密武器。Go Dispatcher 启动时运行以下 SQL 循环：

```sql
-- 原子性地“抢占”一批任务
WITH next_jobs AS (
    SELECT id
    FROM _jobs
    WHERE status = 'pending'
      AND run_at <= NOW()
      AND (locked_until IS NULL OR locked_until < NOW())
    ORDER BY run_at ASC
    LIMIT 10 -- 批量获取
    FOR UPDATE SKIP LOCKED -- 关键：跳过被其他 Worker 锁住的行，互不阻塞
)
UPDATE _jobs
SET status = 'processing',
    locked_until = NOW() + INTERVAL '5 minutes', -- 租约机制
    updated = NOW()
WHERE id IN (SELECT id FROM next_jobs)
RETURNING id, topic, payload;

```

### 3.4 API Design (SDK)

在 Serverless (JS/TS) 环境中提供极简 API。

```typescript
// Enqueue (Producer)
// 1. 即时任务
const jobId = await pb.jobs.enqueue('mail_digest', { userId: '123' });

// 2. 延时任务 (Schedule)
const jobId = await pb.jobs.enqueue('check_payment', { orderId: '456' }, { 
    runAt: new Date(Date.now() + 15 * 60 * 1000) // 15分钟后执行
});

// 3. 任务链 (Workflow) - 高级
// 当 job1 完成后自动触发 job2 (由 PocketBase 内置逻辑保障)
// await pb.jobs.chain(job1, job2);

```

### 3.5 Worker Definition (Consumer)

在 `pb_serverless/src/workers.ts` 中定义处理逻辑。

```typescript
// 必须导出一个名为 `workers` 的对象或注册函数
export const workers = {
    // Topic: Handler
    async mail_digest(job) {
        console.log(`Processing job ${job.id}`);
        // 业务逻辑...
        // 如果抛出 Error，PocketBase 会自动捕获并增加 retry 计数
        if (Math.random() > 0.5) throw new Error("Network fluke");
    },
    
    async check_payment(job) {
        // ...
    }
};

```

## 4. Resilience Strategy (韧性策略)

1. **Exponential Backoff (指数退避)**:
* 任务失败重试时，`run_at` 不会设为立即，而是：`NOW() + (retries^2 * 1 minute)`。
* 防止故障服务被重试流量打死。


2. **Dead Letter (死信处理)**:
* 当 `retries >= max_retries` 时，状态变更为 `failed`。
* 不会删除记录。Admin 可以在后台查看错误日志，修复 Bug 后点击 "Re-queue" 手动重跑。


3. **Crash Recovery (崩溃恢复)**:
* 如果 Worker 进程在处理中途 `kill -9` 挂了，任务状态仍为 `processing`。
* 但 `locked_until` 会过期。
* Dispatcher 的 SQL 包含 `locked_until < NOW()`，这意味着 5 分钟后，其他 Worker 会自动接管这个“僵尸任务”。



## 5. Boundaries & Anti-Stupidity (边界与防愚蠢)

1. **Payload Size Limit**:
* **限制**: 1MB。
* **原则**: 队列只传“引用”，不传“实体”。不要把 PDF 文件 Base64 塞进去，传 `file_id`。


2. **Execution Time Limit**:
* **限制**: 默认 10 分钟。
* **原则**: 如果任务需要跑 1 小时，请拆分成多个子任务，或者使用专门的 Batch Compute 基础设施。


3. **No High-Frequency FIFO**:
* 虽然 `SKIP LOCKED` 很快，但不要把它当 Kafka 用（每秒 10万+）。PocketBase Queue 适合业务级异步任务（每秒 100-2000）。



## 6. Implementation Plan (实施计划)

1. **Schema**: 创建 `_jobs` 表及相关索引。
2. **Go Runtime**:
* 实现 `JobDispatcher` (Goroutine)。
* 集成 `LISTEN/NOTIFY` 机制（减少轮询延迟，实现毫秒级响应）。


3. **WASM Bridge**:
* 扩展 Host Function，允许 Go 调用 JS 的特定 Worker 函数。


4. **UI**:
* Admin UI 增加 "Jobs" 面板：查看队列积压、重试失败任务、可视化成功率。



---

**飞将军的备注**：
这是 PocketBase 向 **"Self-Contained System" (自包含系统)** 迈出的关键一步。有了它，PocketBase 不再仅仅是一个 API Server，它拥有了处理**长时序业务**的心脏。