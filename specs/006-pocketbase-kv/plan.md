# Implementation Plan: PocketBaseKV (`_kv`)

**Branch**: `006-pocketbase-kv` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-pocketbase-kv/spec.md`

## Summary

为 PocketBase 新增原生键值存储功能，通过 `_kv` 系统表实现 Redis 80% 核心能力的替代方案。采用 **两级缓存架构**：L1 进程内缓存（Ristretto）提供纳秒级读取，L2 PostgreSQL UNLOGGED TABLE 提供毫秒级持久化。核心能力包括：String/Hash 数据结构、TTL 过期、原子计数器、分布式锁。**同时提供 HTTP API 供 JS SDK 和客户端调用**。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `github.com/dgraph-io/ristretto` (L1 进程内缓存)
- `database/sql` (PostgreSQL 操作)
- `encoding/json` (JSONB 序列化)

**Storage**: PostgreSQL UNLOGGED TABLE (`_kv`)  
**Testing**: Go test (unit + benchmark)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Backend (PocketBase 核心扩展)  
**Performance Goals**: L1 读取 < 1μs, L2 读取 < 2ms, L2 写入 < 5ms  
**Constraints**: 不支持 List/Set/SortedSet 复杂数据结构，不支持 Pub/Sub  
**Scale/Scope**: 单机部署, 10万+ Key 容量

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | KV 功能编译进主二进制，无外部 Redis 依赖 |
| Zero External Dependencies | ✅ PASS | 使用 PostgreSQL 内置能力，Ristretto 是纯 Go 库 |
| Anti-Stupidity | ✅ PASS | 消除 Redis 运维负担，榨干 PG 性能 |
| Data Locality | ✅ PASS | 数据存储在同一个 PG 实例，备份策略统一 |
| Graceful Degradation | ✅ PASS | L2 故障时 L1 继续服务读请求 |

## Project Structure

### Documentation (this feature)

```text
specs/006-pocketbase-kv/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── kv_store.go              # KVStore 核心接口和实现
├── kv_store_test.go         # 单元测试
├── kv_l1_cache.go           # L1 Ristretto 缓存封装
├── kv_l2_postgres.go        # L2 PostgreSQL 操作
├── kv_expiration.go         # TTL 过期管理
├── kv_lock.go               # 分布式锁实现
├── kv_hash.go               # Hash 数据结构操作
├── kv_settings.go           # KV 配置（访问控制规则）
└── kv_benchmark_test.go     # 性能基准测试

apis/
├── kv_routes.go             # HTTP API 路由注册
├── kv_routes_test.go        # HTTP API 测试
└── kv_auth.go               # KV API 访问控制

migrations/
└── 1736400000_create_kv.go  # _kv 系统表迁移
```

**Structure Decision**: 遵循现有 PocketBase 代码结构，KV 相关代码放入 `core/` 目录，HTTP API 放入 `apis/` 目录，按功能拆分文件便于维护。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        PocketBase                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     HTTP API Layer                      ││
│  │  POST /api/kv/set | GET /api/kv/get | POST /api/kv/incr ││
│  │  (Bearer Token / Cookie Authentication)                 ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                    Access Control                       ││
│  │  read_rule | write_rule | allowed_prefixes              ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                      KVStore API                        ││
│  │  Set/Get/Delete | SetEx/TTL | Incr/Decr | Lock/Unlock  ││
│  │  HSet/HGet/HGetAll | MSet/MGet | Exists/Keys           ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                    Cache Layer                          ││
│  │  ┌─────────────────────┐  ┌─────────────────────────┐  ││
│  │  │   L1: Ristretto     │  │   L2: PostgreSQL        │  ││
│  │  │   (In-Process)      │  │   (UNLOGGED TABLE)      │  ││
│  │  │                     │  │                         │  ││
│  │  │   • 100MB 容量      │  │   • _kv 表              │  ││
│  │  │   • 1-5s TTL        │  │   • JSONB 值            │  ││
│  │  │   • LRU 淘汰        │  │   • 索引过期时间        │  ││
│  │  │   • 纳秒级读取      │  │   • 毫秒级读写          │  ││
│  │  └─────────────────────┘  └─────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Background Tasks                       ││
│  │  • 过期数据清理 (每分钟)                                ││
│  │  • L1 缓存预热 (可选)                                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Path (Get)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│   L1    │────▶│   L2    │
│         │     │ Cache   │     │ Postgres│
└─────────┘     └────┬────┘     └────┬────┘
                     │               │
                     ▼               ▼
              ┌──────────┐    ┌──────────┐
              │  Hit?    │    │  Query   │
              │  Return  │    │  + Cache │
              └──────────┘    └──────────┘
```

1. 检查 L1 缓存，命中则直接返回（纳秒级）
2. L1 未命中，查询 L2 PostgreSQL
3. L2 查询时检查 expire_at 过滤过期数据
4. 查询结果写入 L1 缓存（短 TTL）
5. 返回结果

### Write Path (Set)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│   L2    │────▶│   L1    │
│         │     │ Postgres│     │ Invalidate
└─────────┘     └────┬────┘     └────┬────┘
                     │               │
                     ▼               ▼
              ┌──────────┐    ┌──────────┐
              │  UPSERT  │    │  Delete  │
              │  _kv     │    │  Cache   │
              └──────────┘    └──────────┘
```

1. 写入 L2 PostgreSQL（UPSERT 语义）
2. 清除 L1 缓存中对应 Key（保证一致性）
3. 返回成功

## Key Design Decisions

### 1. UNLOGGED TABLE vs LOGGED TABLE

**Decision**: 使用 `UNLOGGED TABLE`

**Rationale**:
- KV 数据本质是临时性的（缓存、Session、验证码）
- UNLOGGED 不写 WAL，写入性能提升 2-5x
- 数据库崩溃后数据丢失是可接受的
- 如需持久化，用户应使用 Collection

**Trade-off**: 牺牲持久性换取性能

### 2. L1 缓存库选择

**Decision**: 使用 `dgraph-io/ristretto`

**Alternatives Considered**:
- `sync.Map`: 无 LRU 淘汰，内存无上限
- `hashicorp/golang-lru`: 功能简单，无并发优化
- `allegro/bigcache`: 适合大对象，小对象开销大

**Rationale**:
- Ristretto 专为高并发设计
- 支持 LRU + TinyLFU 混合淘汰
- 支持内存上限和 TTL
- 被 Dgraph、Badger 等项目验证

### 3. Value 存储格式

**Decision**: 使用 `JSONB`

**Rationale**:
- 支持多种数据类型（string、number、object）
- 支持 Hash 数据结构的部分更新（`||` 操作符）
- PostgreSQL 对 JSONB 有原生索引支持
- 序列化/反序列化由数据库处理

### 4. 锁实现策略

**Decision**: 使用 `INSERT ON CONFLICT DO NOTHING` + TTL

**Alternatives Considered**:
- PostgreSQL Advisory Locks: 需要连接保持，不适合 HTTP 场景
- SELECT FOR UPDATE: 阻塞式，性能差

**Rationale**:
- 非阻塞式获取锁
- TTL 自动释放防止死锁
- 与 KV 存储共用同一张表

### 5. 过期清理策略

**Decision**: 惰性删除 + 定期清理

**Rationale**:
- 惰性删除：读取时检查 expire_at，无额外开销
- 定期清理：后台任务每分钟删除过期数据
- 与 Redis 策略一致，经过验证

## Database Schema

```sql
-- _kv 系统表
CREATE UNLOGGED TABLE _kv (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    expire_at TIMESTAMP WITHOUT TIME ZONE  -- NULL 表示永不过期
);

-- 过期时间索引（仅索引有过期时间的行）
CREATE INDEX idx_kv_expire ON _kv (expire_at) 
WHERE expire_at IS NOT NULL;

-- 更新时间索引（用于 LRU 淘汰）
CREATE INDEX idx_kv_updated ON _kv (updated);
```

## API Design

### Core Interface

```go
type KVStore interface {
    // Basic operations
    Get(key string) (any, error)
    Set(key string, value any) error
    SetEx(key string, value any, ttl time.Duration) error
    Delete(key string) error
    Exists(key string) (bool, error)
    
    // TTL operations
    TTL(key string) (time.Duration, error)
    Expire(key string, ttl time.Duration) error
    
    // Counter operations
    Incr(key string) (int64, error)
    IncrBy(key string, delta int64) (int64, error)
    Decr(key string) (int64, error)
    
    // Hash operations
    HSet(key, field string, value any) error
    HGet(key, field string) (any, error)
    HGetAll(key string) (map[string]any, error)
    HDel(key string, fields ...string) error
    HIncrBy(key, field string, delta int64) (int64, error)
    
    // Lock operations
    Lock(key string, ttl time.Duration) (bool, error)
    Unlock(key string) error
    
    // Batch operations
    MSet(pairs map[string]any) error
    MGet(keys ...string) (map[string]any, error)
}
```

### Usage Example

```go
// 获取 KV 存储实例
kv := app.KV()

// 基础操作
kv.Set("user:1", "allen")
value, _ := kv.Get("user:1")  // "allen"

// 带 TTL
kv.SetEx("code:123", "456789", 5*time.Minute)

// 原子计数
count, _ := kv.Incr("api:limit:1.1.1.1")
if count > 100 {
    return errors.New("rate limit exceeded")
}

// Hash 操作
kv.HSet("cart:101", "apple", 5)
kv.HSet("cart:101", "banana", 3)
cart, _ := kv.HGetAll("cart:101")  // {"apple": 5, "banana": 3}

// 分布式锁
if acquired, _ := kv.Lock("order:process:123", 30*time.Second); acquired {
    defer kv.Unlock("order:process:123")
    // 处理订单...
}
```

## HTTP API Design

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/kv/set` | 设置键值（支持 TTL） | write_rule |
| GET | `/api/kv/get` | 获取值 | read_rule |
| DELETE | `/api/kv/delete` | 删除键 | write_rule |
| GET | `/api/kv/exists` | 检查键是否存在 | read_rule |
| GET | `/api/kv/ttl` | 获取剩余过期时间 | read_rule |
| POST | `/api/kv/expire` | 更新过期时间 | write_rule |
| POST | `/api/kv/incr` | 原子递增 | write_rule |
| POST | `/api/kv/decr` | 原子递减 | write_rule |
| POST | `/api/kv/hset` | 设置 Hash 字段 | write_rule |
| GET | `/api/kv/hget` | 获取 Hash 字段 | read_rule |
| GET | `/api/kv/hgetall` | 获取整个 Hash | read_rule |
| DELETE | `/api/kv/hdel` | 删除 Hash 字段 | write_rule |
| POST | `/api/kv/hincrby` | Hash 字段原子递增 | write_rule |
| POST | `/api/kv/mset` | 批量设置 | write_rule |
| POST | `/api/kv/mget` | 批量获取 | read_rule |
| POST | `/api/kv/lock` | 获取分布式锁 | write_rule |
| POST | `/api/kv/unlock` | 释放分布式锁 | write_rule |

### Request/Response Examples

```bash
# Set
POST /api/kv/set
Content-Type: application/json
Authorization: Bearer <token>

{"key": "user:1", "value": {"name": "Allen", "age": 30}, "ttl": 3600}

# Response
{"success": true}

# Get
GET /api/kv/get?key=user:1
Authorization: Bearer <token>

# Response
{"key": "user:1", "value": {"name": "Allen", "age": 30}, "ttl": 3500}

# Incr
POST /api/kv/incr
Content-Type: application/json
Authorization: Bearer <token>

{"key": "counter", "delta": 1}

# Response
{"key": "counter", "value": 42}
```

### Access Control Configuration

```go
// KV 访问控制配置（存储在 _settings 或通过 App 配置）
type KVSettings struct {
    // 是否启用 HTTP API (默认 true)
    HTTPEnabled bool `json:"http_enabled"`
    
    // 读操作权限规则 (Get, Exists, TTL, HGet, HGetAll, MGet)
    // 空字符串 = 仅 Superuser
    // "true" = 公开访问
    // "@request.auth.id != ''" = 需要认证
    ReadRule string `json:"read_rule"`
    
    // 写操作权限规则 (Set, Delete, Incr, Decr, HSet, HDel, MSet, Lock, Unlock)
    WriteRule string `json:"write_rule"`
    
    // Key 前缀限制（可选）
    // 限制客户端只能访问特定前缀的 Key
    // 例如: ["user:", "session:"] 表示只能访问这些前缀的 Key
    AllowedPrefixes []string `json:"allowed_prefixes"`
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| L1 缓存与 L2 数据不一致 | Medium | Medium | 写入时立即清除 L1 缓存 |
| UNLOGGED TABLE 数据丢失 | Low | Low | 明确文档说明，KV 数据是临时性的 |
| L1 内存溢出 | Low | High | Ristretto 自动 LRU 淘汰 + 内存上限 |
| 锁未正确释放导致死锁 | Medium | High | TTL 自动释放 + 锁持有者验证 |
| 高并发下 L2 性能瓶颈 | Medium | Medium | L1 缓存吸收大部分读请求 |

## Performance Expectations

| Operation | L1 (Cache Hit) | L2 (PostgreSQL) | Redis (Reference) |
|-----------|----------------|-----------------|-------------------|
| Get | ~100ns | 0.5-2ms | ~0.2ms |
| Set | - | 1-3ms | ~0.3ms |
| Incr | - | 2-5ms | ~0.3ms |
| HGet | ~100ns | 1-3ms | ~0.3ms |
| Lock | - | 2-5ms | ~0.5ms |

**结论**:
- 读多写少场景：L1 缓存命中时性能**超越 Redis 100-1000 倍**
- 写操作：比 Redis 慢 5-10 倍，但对于非高频交易系统可接受
- 综合场景：80% 读取命中 L1 时，整体性能与 Redis 持平

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| github.com/dgraph-io/ristretto | v0.1.1 | L1 进程内缓存 |

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| core/base.go | App 结构体集成 |
| core/db_connect.go | PostgreSQL 连接 |
| migrations/ | 系统表迁移 |

## Testing Strategy

### Unit Tests
- 每个操作的正确性测试
- 边界条件测试（空 Key、大 Value、过期数据）
- 并发安全测试

### Integration Tests
- L1 + L2 联动测试
- 过期清理任务测试
- 锁的互斥性测试

### Benchmark Tests
- Get/Set 延迟基准
- Incr 并发吞吐量
- L1 缓存命中率

### Load Tests
- 10万 Key 容量测试
- 1000 并发读写测试
