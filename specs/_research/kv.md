飞将军，这又是一次对 **"Anti-Stupidity"** (反愚蠢/反冗余) 的伟大实践。

在当今的架构设计中，**"无脑上 Redis"** 已经成为一种政治正确。但对于 PocketBase 这样追求极致单体交付的系统来说，引入 Redis 意味着：多一个守护进程、多一份配置、多一种网络协议、多一个备份策略。**这不优雅，也不 Simple。**

PostgreSQL 在现代硬件和优化下，完全有能力吞下 Redis 80% 的场景。特别是配合 Go 语言的内存能力，我们可以设计一个 **"Hybrid KV Engine" (混合键值引擎)**。

我们要设计的这个组件，暂名为 **PocketBaseKV**。

---

# Spec: PocketBaseKV (Postgres-Native Redis Replacement)

## 1. 核心理念 (Core Philosophy)

**"SQL as NoSQL, Memory as Cache."**
利用 PostgreSQL 的 `UNLOGGED TABLE` 获得接近 Redis 的持久化写入性能，利用 Go 进程内内存（In-Process Memory）获得超越 Redis 的读取性能。

## 2. 架构设计：两级缓存体系 (L1 + L2)

Redis 是网络级内存缓存。PocketBaseKV 是 **进程级内存 (L1) + 数据库级非日志表 (L2)**。

* **L1: Local Hot Cache (Go Ristretto)**
* **介质**: Go 进程堆内存。
* **TTL**: 极短 (例如 1-5秒) 或 用于不可变数据。
* **速度**: **纳秒级** (无网络开销，无序列化开销)。比 Redis 快 10-100 倍。
* **场景**: 瞬间热点 (Thundering Herd)，如秒杀时的商品库存读取。


* **L2: Shared Persistent KV (Postgres Unlogged)**
* **介质**: Postgres `UNLOGGED TABLE` (不写 WAL，奔溃可丢)。
* **TTL**: 业务逻辑决定 (分钟/小时/天)。
* **速度**: **毫秒级** (0.5ms - 2ms)。与 Redis 处于同一数量级 (Redis 约 0.2ms，瓶颈通常在网络 RTT)。
* **场景**: Session共享、验证码、配置开关、分布式锁。



## 3. Schema Design (数据库层)

创建一个专用的 `_kv` 表，利用 JSONB 的灵活性来模拟 Redis 的多种数据结构。

```sql
CREATE UNLOGGED TABLE _kv (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    expire_at TIMESTAMP WITHOUT TIME ZONE -- NULL 表示永不过期
);

-- 只需要一个索引，极致简单
CREATE INDEX idx_kv_expire ON _kv (expire_at) WHERE expire_at IS NOT NULL;

```

## 4. Redis 核心 80% 能力映射 (Capability Mapping)

我们要实现的不仅是 Key-Value，而是 Redis 的数据结构能力。

### 4.1 String (SET / GET / SETEX)

* **Redis**: `SET user:1 "allen" EX 60`
* **PocketBaseKV**:
```sql
INSERT INTO _kv (key, value, expire_at)
VALUES ('user:1', '"allen"', NOW() + INTERVAL '60 seconds')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, expire_at = EXCLUDED.expire_at;

```


* **Go SDK**: `kv.Set("user:1", "allen", 60*time.Second)`

### 4.2 Hash (HSET / HGET / HGETALL)

* **Redis**: `HSET cart:101 apple 5 banana 3`
* **PocketBaseKV**: 利用 Postgres 强大的 JSONB 操作。
```sql
-- HSET (Upsert partial json)
INSERT INTO _kv (key, value) VALUES ('cart:101', '{"apple": 5}')
ON CONFLICT (key) DO UPDATE
SET value = _kv.value || EXCLUDED.value; -- JSONB Merge

```


* **Go SDK**: `kv.HSet("cart:101", "apple", 5)`

### 4.3 Counter / Rate Limit (INCR / INCRBY)

* **Redis**: `INCR api_limit:1.1.1.1`
* **PocketBaseKV**:
```sql
INSERT INTO _kv (key, value) VALUES ('limit:ip', '1')
ON CONFLICT (key) DO UPDATE
SET value = to_jsonb(CAST(value#>>'{}' AS INTEGER) + 1)
RETURNING value;

```


*注：Postgres 的行锁机制保证了原子性，完全等同于 Redis 的原子操作。*

### 4.4 List / Queue (LPUSH / RPOP)

* **Redis**: `LPUSH jobs 123`
* **PocketBaseKV**:
```sql
-- LPUSH (Prepend to array)
UPDATE _kv SET value = jsonb_insert(value, '{0}', '123') WHERE key = 'jobs';

```


*(注：对于高吞吐队列，建议使用我们在 v2.1 定义的 `_jobs` 专用表，而非 KV 里的 JSON 数组，性能更好。)*

## 5. TTL 淘汰策略 (The Expiration Strategy)

Redis 使用“惰性删除 + 定期随机删除”。我们复刻这个逻辑，但利用 SQL 的优势。

### 5.1 惰性删除 (Passive Expiration)

在 `Get()` 操作时检查。

```sql
SELECT value FROM _kv
WHERE key = $1
  AND (expire_at IS NULL OR expire_at > NOW()); -- 数据库层过滤

```

如果查不到，Go 层视为 Key 不存在。

### 5.2 定期清理 (Active Cleanup)

在 Go 中启动一个 `time.Ticker` (比如每分钟)。

```go
go func() {
    for range time.Tick(1 * time.Minute) {
        // DELETE 也是 WAL-free 的，因为表是 UNLOGGED
        db.Exec("DELETE FROM _kv WHERE expire_at < NOW()")
    }
}()

```

## 6. 高级特性：分布式锁 (The Missing 10%)

Redis 最常用的场景之一是分布式锁 (`SETNX`). PocketBaseKV 可以通过 Postgres 的 `ADVISORY LOCKS` 或 `INSERT ON CONFLICT` 实现更可靠的锁。

**实现 `Lock(key, ttl)**`:

```sql
-- 尝试获取锁
INSERT INTO _kv (key, value, expire_at)
VALUES ('lock:resource_A', '1', NOW() + INTERVAL '10 seconds')
ON CONFLICT DO NOTHING;
-- 如果 Affected Rows = 1，加锁成功。
-- 如果 = 0，加锁失败。

```

## 7. 性能压测预估 (Benchmarking Theory)

假设服务器：8 Core, 16GB RAM, NVMe SSD.

| 操作 | Redis (Network) | PocketBaseKV (L2 Postgres) | PocketBaseKV (L1 Go Memory) |
| --- | --- | --- | --- |
| **Get** | 0.2 ms | 0.5 ~ 1.0 ms | **0.0001 ms (100ns)** |
| **Set** | 0.3 ms | 1.0 ~ 2.0 ms | 0.0002 ms |
| **Incr** | 0.3 ms | 2.0 ms (Row Lock) | - |

**结论**：

1. 对于**读多写少**的场景（如配置、Session、Token），PocketBaseKV 配合 L1 缓存，性能**完胜 Redis**。
2. 对于**高频计数器**（如全局 QPS 限流），PG 稍慢，但在单机 5000 TPS 级别完全够用。
3. 对于**写操作**，虽然比 Redis 慢几倍（毫秒级 vs 微秒级），但对于非高频交易系统，人类无法感知差异。

## 8. Implementation (Go SDK)

我们需要封装一个干净的 `kv` 包，让开发者感觉不到 Postgres 的存在。

```go
package kv

type Store struct {
    l1 *ristretto.Cache // 或者是 sync.Map
    dao *pocketbase.Dao
}

func (s *Store) Get(key string) (any, error) {
    // 1. Check L1
    if val, found := s.l1.Get(key); found {
        return val, nil
    }

    // 2. Check L2 (DB)
    var record KVRecord
    err := s.dao.DB().NewQuery("SELECT value FROM _kv WHERE key={:key} AND (expire_at > NOW() OR expire_at IS NULL)").
        Bind(dbx.Params{"key": key}).
        One(&record)
    
    if err != nil {
        return nil, err
    }

    // 3. Populate L1 (Short TTL, e.g. 1s)
    s.l1.SetWithTTL(key, record.Value, 1*time.Second)
    
    return record.Value, nil
}

```

---

这套方案完美去除了 Redis 依赖，同时保留了 KV 存储最核心的价值。

* **审美上**：`data.db` (SQLite/PG) 依然是唯一的持久化文件。
* **运维上**：不需要配置 Redis 密码、不需要管 Redis 内存溢出、不需要管 AOF/RDB 备份（PG 的备份机制覆盖了 `_kv` 表结构，数据丢了也无所谓）。
* **性能上**：通过 L1 进程内缓存，在“读”场景下实现了对 Redis 的降维打击。

这就是 **"Anti-Stupidity"**：与其维护一个昂贵的外部缓存系统，不如榨干现有数据库的每一滴性能。