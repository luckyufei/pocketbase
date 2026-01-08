# Feature Specification: PocketBaseKV (`_kv`)

**Feature Branch**: `006-pocketbase-kv`  
**Created**: 2026-01-08  
**Status**: Ready for Dev  
**Input**: Research document: `specs/_research/kv.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 基础键值操作 (Priority: P1)

作为开发者，我希望能够使用简单的 API 进行键值存储操作（Set/Get/Delete），以便在不引入 Redis 的情况下实现缓存和临时数据存储。

**Why this priority**: 这是 KV 存储的核心功能，是所有其他高级特性的基础。

**Independent Test**: 可以通过调用 `kv.Set()` 和 `kv.Get()` 验证数据的存储和读取。

**Acceptance Scenarios**:

1. **Given** KV 存储已初始化, **When** 调用 `kv.Set("user:1", "allen")`, **Then** 数据成功写入
2. **Given** 数据已写入, **When** 调用 `kv.Get("user:1")`, **Then** 返回 `"allen"`
3. **Given** 数据已写入, **When** 调用 `kv.Delete("user:1")`, **Then** 数据被删除
4. **Given** Key 不存在, **When** 调用 `kv.Get("nonexistent")`, **Then** 返回 `nil` 和 `ErrNotFound`
5. **Given** 相同 Key 再次写入, **When** 调用 `kv.Set("user:1", "bob")`, **Then** 值被覆盖为 `"bob"`

---

### User Story 2 - TTL 过期机制 (Priority: P1)

作为开发者，我希望能够为键值设置过期时间（TTL），以便实现验证码、Session、限流计数器等场景。

**Why this priority**: TTL 是 KV 存储的核心能力，验证码、Session 等场景强依赖此功能。

**Independent Test**: 可以通过设置短 TTL 后等待过期，验证数据自动失效。

**Acceptance Scenarios**:

1. **Given** 设置 TTL, **When** 调用 `kv.SetEx("code:123", "456789", 60*time.Second)`, **Then** 数据 60 秒后过期
2. **Given** 数据已过期, **When** 调用 `kv.Get("code:123")`, **Then** 返回 `nil` 和 `ErrNotFound`
3. **Given** 数据未过期, **When** 调用 `kv.Get("code:123")`, **Then** 返回有效值
4. **Given** 数据存在, **When** 调用 `kv.TTL("code:123")`, **Then** 返回剩余过期时间
5. **Given** 数据存在, **When** 调用 `kv.Expire("code:123", 120*time.Second)`, **Then** TTL 被更新为 120 秒

---

### User Story 3 - 原子计数器 (Priority: P1)

作为开发者，我希望能够使用原子递增/递减操作，以便实现 API 限流、计数器等场景。

**Why this priority**: 限流是 API 安全的关键能力，原子操作保证并发安全。

**Independent Test**: 可以通过并发调用 `kv.Incr()` 验证计数器的原子性。

**Acceptance Scenarios**:

1. **Given** Key 不存在, **When** 调用 `kv.Incr("counter")`, **Then** 返回 `1`（自动初始化）
2. **Given** Key 值为 5, **When** 调用 `kv.Incr("counter")`, **Then** 返回 `6`
3. **Given** Key 值为 5, **When** 调用 `kv.IncrBy("counter", 10)`, **Then** 返回 `15`
4. **Given** Key 值为 5, **When** 调用 `kv.Decr("counter")`, **Then** 返回 `4`
5. **Given** 100 个并发 Incr, **When** 全部完成后, **Then** 计数器值精确等于 100

---

### User Story 4 - Hash 数据结构 (Priority: P2)

作为开发者，我希望能够使用 Hash 数据结构存储对象字段，以便实现购物车、用户 Profile 等场景。

**Why this priority**: Hash 是 Redis 第二常用的数据结构，支持部分更新比全量覆盖更高效。

**Independent Test**: 可以通过 `kv.HSet()` 和 `kv.HGet()` 验证 Hash 字段的存取。

**Acceptance Scenarios**:

1. **Given** Hash 不存在, **When** 调用 `kv.HSet("cart:101", "apple", 5)`, **Then** Hash 创建并设置字段
2. **Given** Hash 存在, **When** 调用 `kv.HGet("cart:101", "apple")`, **Then** 返回 `5`
3. **Given** Hash 存在, **When** 调用 `kv.HSet("cart:101", "banana", 3)`, **Then** 新字段被添加
4. **Given** Hash 存在, **When** 调用 `kv.HGetAll("cart:101")`, **Then** 返回 `{"apple": 5, "banana": 3}`
5. **Given** Hash 存在, **When** 调用 `kv.HDel("cart:101", "apple")`, **Then** 字段被删除
6. **Given** Hash 存在, **When** 调用 `kv.HIncrBy("cart:101", "apple", 2)`, **Then** 字段值增加 2

---

### User Story 5 - 分布式锁 (Priority: P2)

作为开发者，我希望能够使用分布式锁保护临界区，以便在并发场景下保证数据一致性。

**Why this priority**: 分布式锁是 Redis 最常用的高级特性之一，对于订单处理、库存扣减等场景至关重要。

**Independent Test**: 可以通过并发获取锁验证互斥性。

**Acceptance Scenarios**:

1. **Given** 锁不存在, **When** 调用 `kv.Lock("resource:A", 10*time.Second)`, **Then** 返回 `true`（加锁成功）
2. **Given** 锁已被持有, **When** 另一个进程调用 `kv.Lock("resource:A", 10*time.Second)`, **Then** 返回 `false`（加锁失败）
3. **Given** 锁已被持有, **When** 持有者调用 `kv.Unlock("resource:A")`, **Then** 锁被释放
4. **Given** 锁 TTL 过期, **When** 新进程调用 `kv.Lock("resource:A", 10*time.Second)`, **Then** 返回 `true`（自动释放后可重新获取）
5. **Given** 锁已被持有, **When** 非持有者调用 `kv.Unlock("resource:A")`, **Then** 操作被拒绝（防止误解锁）

---

### User Story 6 - L1 内存缓存 (Priority: P2)

作为开发者，我希望热点数据能够被缓存在进程内存中，以便获得超越 Redis 的读取性能。

**Why this priority**: L1 缓存是 PocketBaseKV 相比 Redis 的核心优势，可实现纳秒级读取。

**Independent Test**: 可以通过对比 L1 命中和 L2 查询的延迟验证缓存效果。

**Acceptance Scenarios**:

1. **Given** 数据首次读取, **When** 调用 `kv.Get("hot:key")`, **Then** 从 L2 (Postgres) 读取并缓存到 L1
2. **Given** 数据已在 L1, **When** 再次调用 `kv.Get("hot:key")`, **Then** 直接从 L1 返回（纳秒级）
3. **Given** L1 缓存过期（默认 1-5s）, **When** 调用 `kv.Get("hot:key")`, **Then** 重新从 L2 读取
4. **Given** 数据被更新, **When** 调用 `kv.Set("hot:key", newValue)`, **Then** L1 缓存被清除
5. **Given** L1 缓存容量达到上限, **When** 新数据写入, **Then** LRU 策略淘汰旧数据

---

### User Story 7 - 批量操作 (Priority: P3)

作为开发者，我希望能够批量读写数据，以便减少数据库往返次数，提升性能。

**Why this priority**: 批量操作是性能优化功能，在核心功能完成后实现。

**Independent Test**: 可以通过 `kv.MSet()` 和 `kv.MGet()` 验证批量操作。

**Acceptance Scenarios**:

1. **Given** 多个键值对, **When** 调用 `kv.MSet({"a": 1, "b": 2, "c": 3})`, **Then** 所有数据一次性写入
2. **Given** 多个 Key, **When** 调用 `kv.MGet("a", "b", "c")`, **Then** 返回所有值的 Map
3. **Given** 部分 Key 不存在, **When** 调用 `kv.MGet("a", "nonexistent")`, **Then** 不存在的 Key 返回 `nil`

---

### User Story 8 - HTTP API (Priority: P1)

作为前端/客户端开发者，我希望能够通过 HTTP API 操作 KV 存储，以便在 JS SDK、移动端或第三方服务中使用 KV 功能。

**Why this priority**: HTTP API 是 KV 功能对外暴露的核心接口，JS SDK 依赖此能力。与 Go API 同等重要。

**Independent Test**: 可以通过 curl 或 JS SDK 调用 HTTP 端点验证功能。

**Acceptance Scenarios**:

1. **Given** 已认证用户, **When** `POST /api/kv/set` with `{"key": "user:1", "value": "allen"}`, **Then** 返回 `{"success": true}`
2. **Given** 数据已写入, **When** `GET /api/kv/get?key=user:1`, **Then** 返回 `{"key": "user:1", "value": "allen"}`
3. **Given** 数据已写入, **When** `DELETE /api/kv/delete?key=user:1`, **Then** 返回 `{"success": true}`
4. **Given** 设置 TTL, **When** `POST /api/kv/set` with `{"key": "code:123", "value": "456", "ttl": 60}`, **Then** 数据 60 秒后过期
5. **Given** 原子计数, **When** `POST /api/kv/incr` with `{"key": "counter", "delta": 1}`, **Then** 返回 `{"key": "counter", "value": 1}`
6. **Given** 未认证用户, **When** 调用任意 KV API, **Then** 返回 `401 Unauthorized`
7. **Given** 非 Superuser, **When** 调用 KV API, **Then** 根据 `access_rule` 判断权限

**HTTP API 端点设计**:

```
# 基础操作
POST   /api/kv/set       - Set/SetEx (body: {key, value, ttl?})
GET    /api/kv/get       - Get (query: key)
DELETE /api/kv/delete    - Delete (query: key)
GET    /api/kv/exists    - Exists (query: key)
GET    /api/kv/ttl       - TTL (query: key)
POST   /api/kv/expire    - Expire (body: {key, ttl})

# 原子计数
POST   /api/kv/incr      - Incr/IncrBy (body: {key, delta?})
POST   /api/kv/decr      - Decr (body: {key, delta?})

# Hash 操作
POST   /api/kv/hset      - HSet (body: {key, field, value})
GET    /api/kv/hget      - HGet (query: key, field)
GET    /api/kv/hgetall   - HGetAll (query: key)
DELETE /api/kv/hdel      - HDel (query: key, field)
POST   /api/kv/hincrby   - HIncrBy (body: {key, field, delta})

# 批量操作
POST   /api/kv/mset      - MSet (body: {items: [{key, value, ttl?}]})
POST   /api/kv/mget      - MGet (body: {keys: [...]})

# 分布式锁
POST   /api/kv/lock      - Lock (body: {key, ttl})
POST   /api/kv/unlock    - Unlock (body: {key})
```

---

### User Story 9 - 访问控制 (Priority: P1)

作为管理员，我希望能够配置 KV API 的访问权限，以便控制哪些用户可以读写 KV 数据。

**Why this priority**: 安全是核心需求，KV 数据可能包含敏感信息。

**Independent Test**: 可以通过配置不同的 access_rule 验证权限控制。

**Acceptance Scenarios**:

1. **Given** `access_rule = ""`, **When** 任意用户调用 KV API, **Then** 仅 Superuser 可访问
2. **Given** `access_rule = "true"`, **When** 任意用户调用 KV API, **Then** 公开访问（无需认证）
3. **Given** `access_rule = "@request.auth.id != ''"`, **When** 已认证用户调用, **Then** 允许访问
4. **Given** `access_rule = "@request.auth.verified = true"`, **When** 未验证用户调用, **Then** 拒绝访问
5. **Given** 不同操作类型, **When** 配置 `read_rule` 和 `write_rule`, **Then** 读写权限分开控制

**访问控制配置**:

```go
// 在 _settings 或 App 配置中
type KVSettings struct {
    // 读操作权限规则 (Get, Exists, TTL, HGet, HGetAll, MGet)
    ReadRule string `json:"read_rule"`
    
    // 写操作权限规则 (Set, Delete, Incr, Decr, HSet, HDel, MSet, Lock, Unlock)
    WriteRule string `json:"write_rule"`
    
    // 是否启用 HTTP API (默认 true)
    HTTPEnabled bool `json:"http_enabled"`
    
    // Key 前缀限制 (可选，限制客户端只能访问特定前缀的 Key)
    AllowedPrefixes []string `json:"allowed_prefixes"`
}
```

---

### Edge Cases

- Key 长度超过限制（256 字符）如何处理？返回 `ErrKeyTooLong` / HTTP 400
- Value 大小超过限制（1MB）如何处理？返回 `ErrValueTooLarge` / HTTP 400
- 数据库连接失败时如何处理？L1 缓存继续服务读请求，写请求返回错误 / HTTP 503
- UNLOGGED TABLE 在数据库崩溃后数据丢失如何处理？这是预期行为，KV 数据本就是临时性的
- 并发写入相同 Key 如何处理？最后写入者胜出（Last Write Wins）
- HTTP API 请求频率过高如何处理？可配置 Rate Limit，默认不限制
- Key 包含特殊字符如何处理？URL 编码，支持 UTF-8
- 客户端尝试访问受限前缀如何处理？返回 HTTP 403

---

### Assumptions

1. KV 数据是临时性的，可接受数据库崩溃后丢失
2. 单机部署场景，不需要跨节点同步 L1 缓存
3. Key 命名遵循 Redis 风格（如 `user:1:profile`）
4. Value 支持 string、number、bool、JSON 对象
5. L1 缓存容量默认 100MB，可通过配置调整
6. HTTP API 默认启用，可通过配置禁用
7. HTTP API 遵循 PocketBase 现有的认证机制（Bearer Token / Cookie）
8. JS SDK 将封装 HTTP API，提供类 Redis 的调用体验

---

## Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 支持 Set/Get/Delete 基础操作 | P1 | US1 |
| FR-002 | 支持 SetEx 带 TTL 的写入 | P1 | US2 |
| FR-003 | 支持惰性过期检查（读取时判断） | P1 | US2 |
| FR-004 | 支持定期清理过期数据（后台任务） | P1 | US2 |
| FR-005 | 支持 Incr/IncrBy/Decr 原子计数 | P1 | US3 |
| FR-006 | 支持 HSet/HGet/HGetAll/HDel Hash 操作 | P2 | US4 |
| FR-007 | 支持 HIncrBy Hash 字段原子递增 | P2 | US4 |
| FR-008 | 支持 Lock/Unlock 分布式锁 | P2 | US5 |
| FR-009 | 支持锁的 TTL 自动释放 | P2 | US5 |
| FR-010 | 支持 L1 进程内缓存（Ristretto） | P2 | US6 |
| FR-011 | 支持 L1 缓存失效策略（写入/TTL） | P2 | US6 |
| FR-012 | 支持 MSet/MGet 批量操作 | P3 | US7 |
| FR-013 | 支持 TTL/Expire 查询和更新 | P2 | US2 |
| FR-014 | 支持 Exists 判断 Key 是否存在 | P1 | US1 |
| FR-015 | 支持 Keys 模式匹配查询 | P3 | - |
| FR-016 | 支持 HTTP API 端点 (/api/kv/*) | P1 | US8 |
| FR-017 | 支持 HTTP API 认证（Bearer Token / Cookie） | P1 | US8 |
| FR-018 | 支持 HTTP API 读写权限分离 (read_rule / write_rule) | P1 | US9 |
| FR-019 | 支持 HTTP API Key 前缀限制 (allowed_prefixes) | P2 | US9 |
| FR-020 | 支持 HTTP API Rate Limit（可选） | P3 | US9 |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | L1 缓存命中读取延迟 | < 1μs | Benchmark 测试 |
| SC-002 | L2 (Postgres) 读取延迟 | < 2ms | Benchmark 测试 |
| SC-003 | L2 写入延迟 | < 5ms | Benchmark 测试 |
| SC-004 | 原子计数器并发正确性 | 100% | 1000 并发 Incr 测试 |
| SC-005 | 分布式锁互斥性 | 100% | 并发锁竞争测试 |
| SC-006 | 过期数据清理延迟 | < 1min | 定时任务间隔 |
| SC-007 | L1 缓存内存占用 | < 100MB | 默认配置 |
| SC-008 | 测试覆盖率 | > 80% | go test -cover |
| SC-009 | HTTP API 响应延迟 | < 10ms (P99) | Benchmark 测试 |
| SC-010 | HTTP API 并发处理 | > 1000 QPS | 压力测试 |

---

## JS SDK API 设计预览

```javascript
// 初始化
const pb = new PocketBase('http://localhost:8090');
await pb.authWithPassword('user@example.com', 'password');

// 基础操作
await pb.kv.set('user:1', { name: 'Allen', age: 30 });
const user = await pb.kv.get('user:1');  // { name: 'Allen', age: 30 }
await pb.kv.delete('user:1');

// TTL
await pb.kv.set('session:abc', token, { ttl: 3600 });  // 1小时过期
const remaining = await pb.kv.ttl('session:abc');  // 返回剩余秒数

// 原子计数
const count = await pb.kv.incr('page:views');
const newCount = await pb.kv.incrBy('page:views', 10);

// Hash
await pb.kv.hset('cart:101', 'apple', 5);
const qty = await pb.kv.hget('cart:101', 'apple');
const cart = await pb.kv.hgetall('cart:101');

// 批量操作
await pb.kv.mset([
  { key: 'a', value: 1 },
  { key: 'b', value: 2, ttl: 60 }
]);
const values = await pb.kv.mget(['a', 'b', 'c']);

// 分布式锁
const acquired = await pb.kv.lock('resource:A', { ttl: 10 });
if (acquired) {
  try {
    // 临界区操作
  } finally {
    await pb.kv.unlock('resource:A');
  }
}
```
