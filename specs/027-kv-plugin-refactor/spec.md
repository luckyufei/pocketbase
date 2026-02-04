# Feature Specification: KV Plugin 重构

**Feature Branch**: `027-kv-plugin-refactor`  
**Created**: 2026-02-04  
**Status**: Ready for Dev  
**Depends On**: `006-pocketbase-kv`（原有实现，需要迁移）

## 1. Problem Essence (核心问题)

当前 `006-pocketbase-kv` 的实现存在以下架构问题：

### 1.1 当前问题

1. **内置耦合**: KV 功能直接内置到 `core/` 包中，违背了 PocketBase 的插件化设计原则
2. **默认开启**: KV 功能随 PocketBase 启动自动初始化，对于不需要此功能的用户造成不必要的资源开销
3. **代码位置不当**: 核心业务逻辑（L1 缓存、L2 PostgreSQL 操作）放在 `core/` 中，增加了核心包的复杂度
4. **与其他插件不一致**: `trace`、`jsvm`、`tofauth` 等功能都是插件模式，KV 应该保持一致

### 1.2 目标架构

将 KV 实现为**可插拔插件**，遵循 PocketBase 现有插件模式：

```go
// 显式注册，默认不启用
kv.MustRegister(app, kv.Config{
    L1Enabled:     true,              // 启用 L1 缓存
    L1TTL:         5 * time.Second,   // L1 缓存 TTL
    L1MaxSize:     100 * 1024 * 1024, // L1 最大 100MB
    CleanupInterval: time.Minute,     // 过期清理间隔
})

// 使用 KV 存储
store := kv.GetStore(app)
store.Set("key", "value")
```

**核心理念**: "Opt-in, Not Opt-out" (选择加入，而非选择退出)

> **注意**: 项目未上线，无需考虑向后兼容，直接删除 `core/` 中现有的 KV 实现，在 `plugins/kv/` 中重新实现。

---

## 2. Design Principles (设计原则)

### 2.1 PocketBase 插件规范

| 原则 | 说明 | 本方案合规性 |
|------|------|-------------|
| **显式注册** | 通过 `MustRegister`/`Register` 函数注册 | ✅ |
| **Config 结构体** | 使用 Config 结构体传递配置 | ✅ |
| **零依赖默认** | 不注册则无任何开销 | ✅ |
| **环境变量支持** | 支持从环境变量读取配置 | ✅ |
| **静默降级** | 配置缺失时静默跳过 | ✅ |

### 2.2 性能影响对比

| 场景 | 当前实现 | 重构后 |
|------|---------|--------|
| **不需要 KV** | ~1-2μs/请求（初始化开销） | 0（不注册无开销） |
| **需要 KV** | 自动初始化 | 显式注册后启用 |
| **HTTP API** | 默认注册 | 可配置是否启用 |

---

## 3. User Scenarios & Testing *(mandatory)*

### User Story 1 - 插件注册（默认关闭）(Priority: P1)

作为开发者，我希望 KV 功能默认不启用，只有显式注册后才生效，以便在不需要时避免资源开销。

**Why this priority**: 这是架构重构的核心目标，确保零开销默认行为。

**Independent Test**: 不注册插件时，验证没有任何 KV 相关逻辑执行。

**Acceptance Scenarios**:

1. **Given** 未注册 kv 插件, **When** 调用 `kv.GetStore(app)`, **Then** 返回 nil（或 NoopStore）
2. **Given** 注册 kv 插件, **When** 调用 `kv.GetStore(app)`, **Then** 返回有效 KVStore 实例
3. **Given** 插件已注册, **When** 服务启动, **Then** `_kv` 表自动创建
4. **Given** 插件未注册, **When** 服务启动, **Then** 不创建 `_kv` 表

---

### User Story 2 - 基础键值操作 (Priority: P1)

作为开发者，我希望能够使用简单的 API 进行键值存储操作（Set/Get/Delete），以便在不引入 Redis 的情况下实现缓存和临时数据存储。

**Why this priority**: 这是 KV 存储的核心功能，是所有其他高级特性的基础。

**Independent Test**: 可以通过调用 `store.Set()` 和 `store.Get()` 验证数据的存储和读取。

**Acceptance Scenarios**:

1. **Given** KV 存储已初始化, **When** 调用 `store.Set("user:1", "allen")`, **Then** 数据成功写入
2. **Given** 数据已写入, **When** 调用 `store.Get("user:1")`, **Then** 返回 `"allen"`
3. **Given** 数据已写入, **When** 调用 `store.Delete("user:1")`, **Then** 数据被删除
4. **Given** Key 不存在, **When** 调用 `store.Get("nonexistent")`, **Then** 返回 `nil` 和 `ErrNotFound`
5. **Given** 相同 Key 再次写入, **When** 调用 `store.Set("user:1", "bob")`, **Then** 值被覆盖为 `"bob"`

---

### User Story 3 - TTL 过期机制 (Priority: P1)

作为开发者，我希望能够为键值设置过期时间（TTL），以便实现验证码、Session、限流计数器等场景。

**Why this priority**: TTL 是 KV 存储的核心能力，验证码、Session 等场景强依赖此功能。

**Independent Test**: 可以通过设置短 TTL 后等待过期，验证数据自动失效。

**Acceptance Scenarios**:

1. **Given** 设置 TTL, **When** 调用 `store.SetEx("code:123", "456789", 60*time.Second)`, **Then** 数据 60 秒后过期
2. **Given** 数据已过期, **When** 调用 `store.Get("code:123")`, **Then** 返回 `nil` 和 `ErrNotFound`
3. **Given** 数据未过期, **When** 调用 `store.Get("code:123")`, **Then** 返回有效值
4. **Given** 数据存在, **When** 调用 `store.TTL("code:123")`, **Then** 返回剩余过期时间
5. **Given** 数据存在, **When** 调用 `store.Expire("code:123", 120*time.Second)`, **Then** TTL 被更新为 120 秒

---

### User Story 4 - 原子计数器 (Priority: P1)

作为开发者，我希望能够使用原子递增/递减操作，以便实现 API 限流、计数器等场景。

**Why this priority**: 限流是 API 安全的关键能力，原子操作保证并发安全。

**Independent Test**: 可以通过并发调用 `store.Incr()` 验证计数器的原子性。

**Acceptance Scenarios**:

1. **Given** Key 不存在, **When** 调用 `store.Incr("counter")`, **Then** 返回 `1`（自动初始化）
2. **Given** Key 值为 5, **When** 调用 `store.Incr("counter")`, **Then** 返回 `6`
3. **Given** Key 值为 5, **When** 调用 `store.IncrBy("counter", 10)`, **Then** 返回 `15`
4. **Given** Key 值为 5, **When** 调用 `store.Decr("counter")`, **Then** 返回 `4`
5. **Given** 100 个并发 Incr, **When** 全部完成后, **Then** 计数器值精确等于 100

---

### User Story 5 - Hash 数据结构 (Priority: P2)

作为开发者，我希望能够使用 Hash 数据结构存储对象字段，以便实现购物车、用户 Profile 等场景。

**Why this priority**: Hash 是 Redis 第二常用的数据结构，支持部分更新比全量覆盖更高效。

**Independent Test**: 可以通过 `store.HSet()` 和 `store.HGet()` 验证 Hash 字段的存取。

**Acceptance Scenarios**:

1. **Given** Hash 不存在, **When** 调用 `store.HSet("cart:101", "apple", 5)`, **Then** Hash 创建并设置字段
2. **Given** Hash 存在, **When** 调用 `store.HGet("cart:101", "apple")`, **Then** 返回 `5`
3. **Given** Hash 存在, **When** 调用 `store.HSet("cart:101", "banana", 3)`, **Then** 新字段被添加
4. **Given** Hash 存在, **When** 调用 `store.HGetAll("cart:101")`, **Then** 返回 `{"apple": 5, "banana": 3}`
5. **Given** Hash 存在, **When** 调用 `store.HDel("cart:101", "apple")`, **Then** 字段被删除
6. **Given** Hash 存在, **When** 调用 `store.HIncrBy("cart:101", "apple", 2)`, **Then** 字段值增加 2

---

### User Story 6 - 分布式锁 (Priority: P2)

作为开发者，我希望能够使用分布式锁保护临界区，以便在并发场景下保证数据一致性。

**Why this priority**: 分布式锁是 Redis 最常用的高级特性之一，对于订单处理、库存扣减等场景至关重要。

**Independent Test**: 可以通过并发获取锁验证互斥性。

**Acceptance Scenarios**:

1. **Given** 锁不存在, **When** 调用 `store.Lock("resource:A", 10*time.Second)`, **Then** 返回 `true`（加锁成功）
2. **Given** 锁已被持有, **When** 另一个进程调用 `store.Lock("resource:A", 10*time.Second)`, **Then** 返回 `false`（加锁失败）
3. **Given** 锁已被持有, **When** 持有者调用 `store.Unlock("resource:A")`, **Then** 锁被释放
4. **Given** 锁 TTL 过期, **When** 新进程调用 `store.Lock("resource:A", 10*time.Second)`, **Then** 返回 `true`（自动释放后可重新获取）
5. **Given** 锁已被持有, **When** 非持有者调用 `store.Unlock("resource:A")`, **Then** 操作被拒绝（防止误解锁）

---

### User Story 7 - L1 内存缓存 (Priority: P2)

作为开发者，我希望热点数据能够被缓存在进程内存中，以便获得超越 Redis 的读取性能。

**Why this priority**: L1 缓存是 PocketBaseKV 相比 Redis 的核心优势，可实现纳秒级读取。

**Independent Test**: 可以通过对比 L1 命中和 L2 查询的延迟验证缓存效果。

**Acceptance Scenarios**:

1. **Given** 数据首次读取, **When** 调用 `store.Get("hot:key")`, **Then** 从 L2 (数据库) 读取并缓存到 L1
2. **Given** 数据已在 L1, **When** 再次调用 `store.Get("hot:key")`, **Then** 直接从 L1 返回（纳秒级）
3. **Given** L1 缓存过期（默认 1-5s）, **When** 调用 `store.Get("hot:key")`, **Then** 重新从 L2 读取
4. **Given** 数据被更新, **When** 调用 `store.Set("hot:key", newValue)`, **Then** L1 缓存被清除
5. **Given** L1 缓存容量达到上限, **When** 新数据写入, **Then** LRU 策略淘汰旧数据

---

### User Story 8 - 批量操作 (Priority: P3)

作为开发者，我希望能够批量读写数据，以便减少数据库往返次数，提升性能。

**Why this priority**: 批量操作是性能优化功能，在核心功能完成后实现。

**Independent Test**: 可以通过 `store.MSet()` 和 `store.MGet()` 验证批量操作。

**Acceptance Scenarios**:

1. **Given** 多个键值对, **When** 调用 `store.MSet({"a": 1, "b": 2, "c": 3})`, **Then** 所有数据一次性写入
2. **Given** 多个 Key, **When** 调用 `store.MGet("a", "b", "c")`, **Then** 返回所有值的 Map
3. **Given** 部分 Key 不存在, **When** 调用 `store.MGet("a", "nonexistent")`, **Then** 不存在的 Key 返回 `nil`

---

### User Story 9 - HTTP API (Priority: P2)

作为前端/客户端开发者，我希望能够通过 HTTP API 操作 KV 存储，以便在 JS SDK、移动端或第三方服务中使用 KV 功能。

**Why this priority**: HTTP API 是 KV 功能对外暴露的接口，JS SDK 依赖此能力。可通过配置选择是否启用。

**Independent Test**: 可以通过 curl 或 JS SDK 调用 HTTP 端点验证功能。

**Acceptance Scenarios**:

1. **Given** HTTP API 已启用 + 已认证用户, **When** `POST /api/kv/set` with `{"key": "user:1", "value": "allen"}`, **Then** 返回 `{"success": true}`
2. **Given** HTTP API 已启用 + 数据已写入, **When** `GET /api/kv/get?key=user:1`, **Then** 返回 `{"key": "user:1", "value": "allen"}`
3. **Given** HTTP API 已启用 + 数据已写入, **When** `DELETE /api/kv/delete?key=user:1`, **Then** 返回 `{"success": true}`
4. **Given** HTTP API 未启用, **When** 调用任意 KV API, **Then** 返回 `404 Not Found`
5. **Given** 未认证用户, **When** 调用 KV API, **Then** 返回 `401 Unauthorized`

**HTTP API 配置**:

```go
kv.MustRegister(app, kv.Config{
    HTTPEnabled: true,  // 是否启用 HTTP API（默认 false）
    ReadRule:    "@request.auth.id != ''",  // 读权限
    WriteRule:   "@request.auth.id != ''",  // 写权限
})
```

---

### User Story 10 - 环境变量配置 (Priority: P2)

作为 DevOps，我希望能够通过环境变量配置 KV 插件，以便在不修改代码的情况下调整配置。

**Why this priority**: 环境变量配置是云原生部署的标准实践。

**Acceptance Scenarios**:

1. **Given** `PB_KV_L1_ENABLED=true`, **When** 插件注册, **Then** 启用 L1 缓存
2. **Given** `PB_KV_L1_TTL=10`, **When** 插件注册, **Then** L1 TTL 设置为 10 秒
3. **Given** `PB_KV_HTTP_ENABLED=true`, **When** 插件注册, **Then** 启用 HTTP API
4. **Given** `PB_KV_CLEANUP_INTERVAL=120`, **When** 插件注册, **Then** 清理间隔为 120 秒

**环境变量清单**:

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_KV_L1_ENABLED` | 是否启用 L1 缓存 | `true` |
| `PB_KV_L1_TTL` | L1 缓存 TTL（秒） | `5` |
| `PB_KV_L1_MAX_SIZE` | L1 缓存最大大小（MB） | `100` |
| `PB_KV_CLEANUP_INTERVAL` | 过期清理间隔（秒） | `60` |
| `PB_KV_HTTP_ENABLED` | 是否启用 HTTP API | `false` |
| `PB_KV_MAX_KEY_LENGTH` | Key 最大长度 | `256` |
| `PB_KV_MAX_VALUE_SIZE` | Value 最大大小（MB） | `1` |

---

### Edge Cases

- Key 长度超过限制（256 字符）如何处理？返回 `ErrKeyTooLong` / HTTP 400
- Value 大小超过限制（1MB）如何处理？返回 `ErrValueTooLarge` / HTTP 400
- 数据库连接失败时如何处理？L1 缓存继续服务读请求，写请求返回错误 / HTTP 503
- UNLOGGED TABLE 在数据库崩溃后数据丢失如何处理？这是预期行为，KV 数据本就是临时性的
- 并发写入相同 Key 如何处理？最后写入者胜出（Last Write Wins）
- HTTP API 请求频率过高如何处理？可配置 Rate Limit，默认不限制
- Key 包含特殊字符如何处理？URL 编码，支持 UTF-8
- 插件未注册时调用 `kv.GetStore(app)` 如何处理？返回 nil 或 NoopStore

---

### Assumptions

1. KV 数据是临时性的，可接受数据库崩溃后丢失
2. 单机部署场景，不需要跨节点同步 L1 缓存
3. Key 命名遵循 Redis 风格（如 `user:1:profile`）
4. Value 支持 string、number、bool、JSON 对象
5. L1 缓存容量默认 100MB，可通过配置调整
6. HTTP API 默认禁用，需要显式启用
7. HTTP API 遵循 PocketBase 现有的认证机制（Bearer Token / Cookie）
8. **项目未上线，直接删除旧实现，无需保留兼容性**

---

## 4. Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 实现 `plugins/kv` 包，提供 `MustRegister`/`Register` | P1 | US1 |
| FR-002 | 实现 NoopStore（未注册时的空实现） | P1 | US1 |
| FR-003 | 支持 Set/Get/Delete 基础操作 | P1 | US2 |
| FR-004 | 支持 SetEx 带 TTL 的写入 | P1 | US3 |
| FR-005 | 支持惰性过期检查（读取时判断） | P1 | US3 |
| FR-006 | 支持定期清理过期数据（后台任务） | P1 | US3 |
| FR-007 | 支持 Incr/IncrBy/Decr 原子计数 | P1 | US4 |
| FR-008 | 支持 HSet/HGet/HGetAll/HDel Hash 操作 | P2 | US5 |
| FR-009 | 支持 HIncrBy Hash 字段原子递增 | P2 | US5 |
| FR-010 | 支持 Lock/Unlock 分布式锁 | P2 | US6 |
| FR-011 | 支持锁的 TTL 自动释放 | P2 | US6 |
| FR-012 | 支持 L1 进程内缓存（可配置） | P2 | US7 |
| FR-013 | 支持 L1 缓存失效策略（写入/TTL） | P2 | US7 |
| FR-014 | 支持 MSet/MGet 批量操作 | P3 | US8 |
| FR-015 | 支持 TTL/Expire 查询和更新 | P1 | US3 |
| FR-016 | 支持 Exists 判断 Key 是否存在 | P1 | US2 |
| FR-017 | 支持 Keys 模式匹配查询 | P3 | - |
| FR-018 | 支持 HTTP API 端点（可配置启用） | P2 | US9 |
| FR-019 | 支持 HTTP API 认证（Bearer Token / Cookie） | P2 | US9 |
| FR-020 | 支持 HTTP API 读写权限分离 | P2 | US9 |
| FR-021 | 支持环境变量配置 | P2 | US10 |
| FR-022 | 删除 `core/` 旧代码，在 `plugins/kv/` 实现 | P1 | US1 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | 未注册时零性能开销 | 0 allocation |
| NFR-002 | L1 缓存命中读取延迟 | < 1μs |
| NFR-003 | L2 (数据库) 读取延迟 | < 2ms |
| NFR-004 | L2 写入延迟 | < 5ms |
| NFR-005 | 原子计数器并发正确性 | 100% |
| NFR-006 | 测试覆盖率 | > 80% |

---

## 6. Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 未注册时无开销 | 0 allocation | Benchmark |
| SC-002 | L1 缓存命中延迟 | < 1μs | Benchmark |
| SC-003 | 现有测试通过率 | 100% | `go test ./...` |
| SC-004 | 新增测试覆盖率 | > 80% | `go test -cover` |
| SC-005 | 代码迁移完整性 | 100% | 代码审查 |
| SC-006 | HTTP API 响应延迟 | < 10ms (P99) | Benchmark |

---

## 7. API Design

### 7.1 Plugin Registration

```go
package kv

// Config 定义 kv 插件的配置选项
type Config struct {
    // L1 缓存配置
    // L1Enabled 是否启用 L1 进程内缓存
    // 默认: true
    L1Enabled bool

    // L1TTL L1 缓存 TTL
    // 默认: 5s
    L1TTL time.Duration

    // L1MaxSize L1 缓存最大大小（字节）
    // 默认: 100MB
    L1MaxSize int64

    // 过期清理配置
    // CleanupInterval 过期数据清理间隔
    // 默认: 1min
    CleanupInterval time.Duration

    // Key/Value 限制
    // MaxKeyLength Key 最大长度
    // 默认: 256
    MaxKeyLength int

    // MaxValueSize Value 最大大小（字节）
    // 默认: 1MB
    MaxValueSize int64

    // HTTP API 配置
    // HTTPEnabled 是否启用 HTTP API
    // 默认: false
    HTTPEnabled bool

    // ReadRule 读操作权限规则
    // 空字符串 = 仅 Superuser
    // "true" = 公开访问
    // "@request.auth.id != ''" = 需要认证
    // 默认: ""（仅 Superuser）
    ReadRule string

    // WriteRule 写操作权限规则
    // 默认: ""（仅 Superuser）
    WriteRule string

    // AllowedPrefixes Key 前缀限制（HTTP API）
    // 限制客户端只能访问特定前缀的 Key
    AllowedPrefixes []string
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config

// MustRegister 注册 kv 插件，失败时 panic
func MustRegister(app core.App, config Config)

// Register 注册 kv 插件
func Register(app core.App, config Config) error

// GetStore 获取指定 App 的 KVStore
// 如果未注册，返回 nil
func GetStore(app core.App) KVStore
```

### 7.2 KVStore Interface

```go
// KVStore 定义键值存储接口
type KVStore interface {
    // 基础操作
    Get(key string) (any, error)
    Set(key string, value any) error
    SetEx(key string, value any, ttl time.Duration) error
    Delete(key string) error
    Exists(key string) (bool, error)

    // TTL 操作
    TTL(key string) (time.Duration, error)
    Expire(key string, ttl time.Duration) error

    // 计数器操作
    Incr(key string) (int64, error)
    IncrBy(key string, delta int64) (int64, error)
    Decr(key string) (int64, error)

    // Hash 操作
    HSet(key, field string, value any) error
    HGet(key, field string) (any, error)
    HGetAll(key string) (map[string]any, error)
    HDel(key string, fields ...string) error
    HIncrBy(key, field string, delta int64) (int64, error)

    // 分布式锁
    Lock(key string, ttl time.Duration) (bool, error)
    Unlock(key string) error

    // 批量操作
    MSet(pairs map[string]any) error
    MGet(keys ...string) (map[string]any, error)

    // 其他
    Keys(pattern string) ([]string, error)
}
```

### 7.3 HTTP API Endpoints

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

### 7.4 Usage Examples

```go
package main

import (
    "time"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/kv"
)

func main() {
    app := pocketbase.New()

    // 示例 1: 最小配置（仅启用 KV 存储）
    kv.MustRegister(app, kv.Config{})

    // 示例 2: 启用 L1 缓存 + HTTP API
    kv.MustRegister(app, kv.Config{
        L1Enabled:   true,
        L1TTL:       10 * time.Second,
        L1MaxSize:   50 * 1024 * 1024, // 50MB
        HTTPEnabled: true,
        ReadRule:    "@request.auth.id != ''",
        WriteRule:   "@request.auth.id != ''",
    })

    // 示例 3: 生产环境配置
    kv.MustRegister(app, kv.Config{
        L1Enabled:       true,
        L1TTL:           5 * time.Second,
        L1MaxSize:       100 * 1024 * 1024,
        CleanupInterval: time.Minute,
        HTTPEnabled:     true,
        ReadRule:        "@request.auth.id != ''",
        WriteRule:       "@request.auth.verified = true",
        AllowedPrefixes: []string{"user:", "session:", "cache:"},
    })

    // 使用 KV 存储
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        store := kv.GetStore(app)
        if store == nil {
            return se.Next() // 插件未注册
        }

        // 基础操作
        store.Set("user:1", map[string]any{"name": "Allen", "age": 30})
        value, _ := store.Get("user:1")

        // 带 TTL
        store.SetEx("session:abc", "token123", time.Hour)

        // 原子计数（限流）
        count, _ := store.Incr("api:limit:1.1.1.1")
        if count > 100 {
            // 限流处理
        }

        // 分布式锁
        if acquired, _ := store.Lock("order:process:123", 30*time.Second); acquired {
            defer store.Unlock("order:process:123")
            // 处理订单...
        }

        return se.Next()
    })

    app.Start()
}
```

---

## 8. Project Structure

### 8.1 目录结构

```text
plugins/
└── kv/
    ├── register.go           # MustRegister/Register 函数
    ├── register_test.go      # 注册测试
    ├── config.go             # Config 结构体和环境变量解析
    ├── config_test.go        # 配置测试
    ├── store.go              # KVStore 接口定义
    ├── store_impl.go         # KVStore 实现（整合 L1 + L2）
    ├── store_test.go         # Store 单元测试
    ├── l1_cache.go           # L1 进程内缓存
    ├── l1_cache_test.go      # L1 缓存测试
    ├── l2_postgres.go        # L2 PostgreSQL 操作
    ├── l2_sqlite.go          # L2 SQLite 操作
    ├── l2_test.go            # L2 测试
    ├── routes.go             # HTTP API 路由
    ├── routes_test.go        # HTTP API 测试
    ├── noop.go               # NoopStore 空实现
    ├── errors.go             # 错误定义
    ├── benchmark_test.go     # 性能基准测试
    └── README.md             # 使用文档
```

### 8.2 待迁移文件（现有实现）

```text
# 从 core/ 迁移到 plugins/kv/
core/kv_store.go          → plugins/kv/store.go + store_impl.go
core/kv_store_test.go     → plugins/kv/store_test.go
core/kv_l1_cache.go       → plugins/kv/l1_cache.go
core/kv_l2_postgres.go    → plugins/kv/l2_postgres.go + l2_sqlite.go
core/kv_hooks.go          → plugins/kv/register.go (集成到注册逻辑)
core/kv_benchmark_test.go → plugins/kv/benchmark_test.go

# 从 apis/ 迁移到 plugins/kv/
apis/kv_routes.go         → plugins/kv/routes.go
apis/kv_routes_test.go    → plugins/kv/routes_test.go
```

### 8.3 待删除文件

```text
# 删除 core/ 中的旧实现
core/kv_store.go
core/kv_store_test.go
core/kv_l1_cache.go
core/kv_l2_postgres.go
core/kv_hooks.go
core/kv_benchmark_test.go

# 删除 apis/ 中的旧实现
apis/kv_routes.go
apis/kv_routes_test.go

# 删除 migrations/ 中的 KV 相关迁移
migrations/1736400000_create_kv.go
```

### 8.4 需要修改的文件

```text
# 移除 core.App 中的 KV() 方法
core/app.go          # 删除 KV() 接口方法
core/base.go         # 删除 kvStore 字段和初始化逻辑
```

---

## 9. Implementation Path (实现路径)

### Phase 1: 创建插件框架 + 迁移核心代码

1. 创建 `plugins/kv/` 目录结构
2. 迁移 `core/kv_store.go` → `plugins/kv/store.go` + `store_impl.go`
3. 迁移 `core/kv_l1_cache.go` → `plugins/kv/l1_cache.go`
4. 迁移 `core/kv_l2_postgres.go` → `plugins/kv/l2_postgres.go` + `l2_sqlite.go`
5. 实现 `register.go`（MustRegister/Register）
6. 实现 `config.go`（Config 结构体 + 环境变量解析）
7. 实现 `noop.go`（NoopStore）

### Phase 2: 迁移 HTTP API

1. 迁移 `apis/kv_routes.go` → `plugins/kv/routes.go`
2. 修改路由注册为可配置（HTTPEnabled）
3. 集成到插件注册逻辑

### Phase 3: 迁移测试

1. 迁移所有测试文件到 `plugins/kv/`
2. 更新测试以使用插件注册模式
3. 确保所有测试通过

### Phase 4: 清理旧代码

1. 删除 `core/kv_*.go` 文件
2. 删除 `apis/kv_routes*.go` 文件
3. 修改 `core/app.go` 和 `core/base.go` 移除 KV 相关代码
4. 删除 KV 相关迁移文件

### Phase 5: 更新文档和示例

1. 更新 `examples/base/main.go` 添加 KV 插件注册示例
2. 更新 `CODEBUDDY.md` 文档
3. 创建 `plugins/kv/README.md` 使用文档

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 破坏现有 API | Medium | High | 项目未上线，直接重构 |
| 测试遗漏 | Low | Medium | 迁移所有现有测试 |
| 性能回归 | Low | Medium | Benchmark 对比测试 |
| 迁移遗漏 | Low | Low | 完整的文件检查清单 |

---

## 11. Open Questions

1. **是否保留 `core.App.KV()` 方法？** 建议删除，改用 `kv.GetStore(app)`
2. **是否需要支持其他存储后端？** 当前仅支持 SQLite + PostgreSQL
3. **L1 缓存是否使用 Ristretto？** 当前使用 sync.Map + TTL，可后续升级
4. **是否需要 KV 数据持久化选项？** 当前使用 UNLOGGED TABLE，数据库崩溃后丢失

---

## 12. References

- `specs/006-pocketbase-kv/spec.md` - 原始 KV 设计
- `specs/019-observability-plugin-refactor/spec.md` - 插件重构参考
- `plugins/trace/register.go` - 插件注册模式参考
- `plugins/jsvm/jsvm.go` - 插件参考实现
