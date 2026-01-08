# Implementation Tasks: PocketBaseKV (`_kv`)

**Branch**: `006-pocketbase-kv` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Setup (共享基础设施)

**Purpose**: 项目初始化和基本结构创建

- [ ] T001 创建 `migrations/1736400000_create_kv.go`，定义 `_kv` 系统表迁移脚本
- [ ] T002 [P] 在 `core/kv_store.go` 中定义 KVStore 接口和常量
- [ ] T003 [P] 在 `go.mod` 中添加 `github.com/dgraph-io/ristretto` 依赖

---

## Phase 2: Foundational (阻塞性前置条件)

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

**⚠️ CRITICAL**: 此阶段完成前，任何用户故事都无法开始

- [ ] T004 在 `migrations/1736400000_create_kv.go` 中实现 `_kv` UNLOGGED TABLE 创建逻辑
- [ ] T005 在 `core/kv_l2_postgres.go` 中实现 L2 PostgreSQL 基础操作（Get/Set/Delete）
- [ ] T006 [P] 在 `core/kv_l1_cache.go` 中实现 L1 Ristretto 缓存封装
- [ ] T007 在 `core/kv_store.go` 中实现 KVStore 结构体，整合 L1 + L2
- [ ] T008 在 `core/base.go` 中集成 KVStore 到 App 结构体
- [ ] T009 在 `core/app.go` 接口中添加 `KV()` 方法

**Checkpoint**: 基础设施就绪 - 用户故事实现可以开始

---

## Phase 3: User Story 1 - 基础键值操作 (Priority: P1) 🎯 MVP

**Goal**: 支持 Set/Get/Delete 基础操作

**Independent Test**: 
- 调用 `kv.Set("key", "value")` 和 `kv.Get("key")` 验证存取

### Implementation for User Story 1

- [ ] T010 [US1] 在 `core/kv_l2_postgres.go` 中实现 `Set()` - INSERT ON CONFLICT DO UPDATE
- [ ] T011 [US1] 在 `core/kv_l2_postgres.go` 中实现 `Get()` - SELECT with expire check
- [ ] T012 [US1] 在 `core/kv_l2_postgres.go` 中实现 `Delete()` - DELETE
- [ ] T013 [US1] 在 `core/kv_l2_postgres.go` 中实现 `Exists()` - SELECT 1
- [ ] T014 [US1] 在 `core/kv_store.go` 中实现 L1 + L2 联动的 `Get()` 逻辑
- [ ] T015 [US1] 在 `core/kv_store.go` 中实现 L1 失效的 `Set()` 逻辑
- [ ] T016 [US1] 编写 `core/kv_store_test.go` 基础操作单元测试

**Checkpoint**: 此时 User Story 1 应完全可用，可独立测试

---

## Phase 4: User Story 2 - TTL 过期机制 (Priority: P1)

**Goal**: 支持带 TTL 的写入和过期数据清理

**Independent Test**: 
- 调用 `kv.SetEx("key", "value", 1*time.Second)`，1 秒后 `kv.Get("key")` 返回 nil

### Implementation for User Story 2

- [ ] T017 [US2] 在 `core/kv_l2_postgres.go` 中实现 `SetEx()` - 带 expire_at 的写入
- [ ] T018 [US2] 在 `core/kv_l2_postgres.go` 中实现 `TTL()` - 查询剩余过期时间
- [ ] T019 [US2] 在 `core/kv_l2_postgres.go` 中实现 `Expire()` - 更新 expire_at
- [ ] T020 [US2] 在 `core/kv_expiration.go` 中实现惰性过期检查（Get 时判断）
- [ ] T021 [US2] 在 `core/kv_expiration.go` 中实现定期清理后台任务
- [ ] T022 [US2] 在 `core/base.go` Bootstrap 中启动过期清理任务
- [ ] T023 [US2] 编写 `core/kv_expiration_test.go` 过期机制单元测试

**Checkpoint**: 此时 User Story 1 & 2 都应独立可用

---

## Phase 5: User Story 3 - 原子计数器 (Priority: P1) 🎯 MVP

**Goal**: 支持 Incr/IncrBy/Decr 原子操作

**Independent Test**: 
- 100 个并发 `kv.Incr("counter")`，最终值应为 100

### Implementation for User Story 3

- [ ] T024 [US3] 在 `core/kv_l2_postgres.go` 中实现 `Incr()` - 原子递增
- [ ] T025 [US3] 在 `core/kv_l2_postgres.go` 中实现 `IncrBy()` - 原子递增指定值
- [ ] T026 [US3] 在 `core/kv_l2_postgres.go` 中实现 `Decr()` - 原子递减
- [ ] T027 [US3] 处理 Key 不存在时自动初始化为 0
- [ ] T028 [US3] 编写 `core/kv_counter_test.go` 原子计数器单元测试
- [ ] T029 [US3] 编写并发安全测试（1000 goroutine 并发 Incr）

**Checkpoint**: MVP 完成 ✅ (User Story 1, 2, 3)

---

## Phase 6: User Story 4 - Hash 数据结构 (Priority: P2)

**Goal**: 支持 HSet/HGet/HGetAll/HDel/HIncrBy 操作

**Independent Test**: 
- 调用 `kv.HSet("cart", "apple", 5)` 和 `kv.HGet("cart", "apple")` 验证

### Implementation for User Story 4

- [ ] T030 [US4] 在 `core/kv_hash.go` 中实现 `HSet()` - JSONB 合并更新
- [ ] T031 [US4] 在 `core/kv_hash.go` 中实现 `HGet()` - JSONB 字段提取
- [ ] T032 [US4] 在 `core/kv_hash.go` 中实现 `HGetAll()` - 返回完整 Hash
- [ ] T033 [US4] 在 `core/kv_hash.go` 中实现 `HDel()` - JSONB 字段删除
- [ ] T034 [US4] 在 `core/kv_hash.go` 中实现 `HIncrBy()` - JSONB 字段原子递增
- [ ] T035 [US4] 编写 `core/kv_hash_test.go` Hash 操作单元测试

**Checkpoint**: 此时 User Story 1, 2, 3, 4 都应独立可用

---

## Phase 7: User Story 5 - 分布式锁 (Priority: P2)

**Goal**: 支持 Lock/Unlock 操作

**Independent Test**: 
- 两个 goroutine 同时 `kv.Lock("resource")`，只有一个成功

### Implementation for User Story 5

- [ ] T036 [US5] 在 `core/kv_lock.go` 中实现 `Lock()` - INSERT ON CONFLICT DO NOTHING
- [ ] T037 [US5] 在 `core/kv_lock.go` 中实现 `Unlock()` - 验证持有者后删除
- [ ] T038 [US5] 实现锁持有者标识（使用 UUID）
- [ ] T039 [US5] 实现锁 TTL 自动过期（复用过期清理机制）
- [ ] T040 [US5] 编写 `core/kv_lock_test.go` 分布式锁单元测试
- [ ] T041 [US5] 编写锁互斥性并发测试

**Checkpoint**: 此时 User Story 1, 2, 3, 4, 5 都应独立可用

---

## Phase 8: User Story 6 - L1 内存缓存 (Priority: P2)

**Goal**: 优化读取性能，热点数据缓存在进程内存

**Independent Test**: 
- 第二次 `kv.Get()` 延迟应比第一次低 1000 倍

### Implementation for User Story 6

- [ ] T042 [US6] 在 `core/kv_l1_cache.go` 中配置 Ristretto 参数（100MB, LRU）
- [ ] T043 [US6] 在 `core/kv_l1_cache.go` 中实现 `Get()` 缓存查询
- [ ] T044 [US6] 在 `core/kv_l1_cache.go` 中实现 `Set()` 缓存写入（短 TTL）
- [ ] T045 [US6] 在 `core/kv_l1_cache.go` 中实现 `Invalidate()` 缓存失效
- [ ] T046 [US6] 在 `core/kv_store.go` 中集成 L1 缓存到读写路径
- [ ] T047 [US6] 编写 `core/kv_l1_cache_test.go` L1 缓存单元测试

**Checkpoint**: 此时 User Story 1-6 都应独立可用

---

## Phase 9: User Story 7 - 批量操作 (Priority: P3)

**Goal**: 支持 MSet/MGet 批量操作

**Independent Test**: 
- 调用 `kv.MSet({"a": 1, "b": 2})` 和 `kv.MGet("a", "b")` 验证

### Implementation for User Story 7

- [ ] T048 [US7] 在 `core/kv_l2_postgres.go` 中实现 `MSet()` - 批量 UPSERT
- [ ] T049 [US7] 在 `core/kv_l2_postgres.go` 中实现 `MGet()` - 批量 SELECT
- [ ] T050 [US7] 在 `core/kv_store.go` 中实现批量操作的 L1 缓存处理
- [ ] T051 [US7] 编写批量操作单元测试

**Checkpoint**: 所有 Go API 用户故事都应独立可用

---

## Phase 10: User Story 8 - HTTP API (Priority: P1) 🎯 MVP

**Goal**: 提供 HTTP API 供 JS SDK 和客户端调用

**Independent Test**: 
- 使用 curl 调用 `POST /api/kv/set` 和 `GET /api/kv/get` 验证

### Implementation for User Story 8

- [ ] T052 [US8] 在 `apis/kv_routes.go` 中创建 KV API 路由组 `/api/kv/*`
- [ ] T053 [US8] 实现 `POST /api/kv/set` 端点（支持 TTL）
- [ ] T054 [US8] 实现 `GET /api/kv/get` 端点
- [ ] T055 [US8] 实现 `DELETE /api/kv/delete` 端点
- [ ] T056 [US8] 实现 `GET /api/kv/exists` 端点
- [ ] T057 [US8] 实现 `GET /api/kv/ttl` 和 `POST /api/kv/expire` 端点
- [ ] T058 [US8] 实现 `POST /api/kv/incr` 和 `POST /api/kv/decr` 端点
- [ ] T059 [US8] 实现 Hash 操作端点（hset/hget/hgetall/hdel/hincrby）
- [ ] T060 [US8] 实现批量操作端点（mset/mget）
- [ ] T061 [US8] 实现分布式锁端点（lock/unlock）
- [ ] T062 [US8] 编写 `apis/kv_routes_test.go` HTTP API 测试

**Checkpoint**: HTTP API 可用，JS SDK 可以开始集成

---

## Phase 11: User Story 9 - 访问控制 (Priority: P1) 🎯 MVP

**Goal**: 实现 KV API 的权限控制

**Independent Test**: 
- 配置 `read_rule = "@request.auth.id != ''"` 后，未认证请求返回 401

### Implementation for User Story 9

- [ ] T063 [US9] 在 `core/kv_settings.go` 中定义 KVSettings 结构体
- [ ] T064 [US9] 在 `apis/kv_auth.go` 中实现读写权限检查
- [ ] T065 [US9] 在 `apis/kv_auth.go` 中实现 Key 前缀验证（allowed_prefixes）
- [ ] T066 [US9] 在 `apis/kv_routes.go` 中集成权限检查中间件
- [ ] T067 [US9] 支持 Rule Engine 表达式（复用 proxy 的实现）
- [ ] T068 [US9] 编写 `apis/kv_auth_test.go` 访问控制测试

**Checkpoint**: HTTP API 权限控制完成

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的改进

- [ ] T069 [P] 在 `core/kv_store.go` 中添加 `Keys()` 模式匹配查询
- [ ] T070 [P] 添加 Key 长度验证（最大 256 字符）
- [ ] T071 [P] 添加 Value 大小验证（最大 1MB）
- [ ] T072 [P] 添加操作日志（Debug 级别）
- [ ] T073 编写 `core/kv_benchmark_test.go` 性能基准测试
- [ ] T074 运行完整集成测试，验证所有功能正常

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-11)**: 依赖 Foundational 完成
  - US1 (Phase 3): 核心存取功能
  - US2 (Phase 4): 依赖 US1 完成
  - US3 (Phase 5): 依赖 US1 完成
  - US4 (Phase 6): 依赖 US1 完成
  - US5 (Phase 7): 依赖 US1, US2 完成（锁需要 TTL）
  - US6 (Phase 8): 依赖 US1 完成
  - US7 (Phase 9): 依赖 US1 完成
  - **US8 (Phase 10): 依赖 US1-US7 完成（HTTP API 封装所有功能）**
  - **US9 (Phase 11): 依赖 US8 完成（访问控制依赖 HTTP API）**
- **Polish (Phase 12)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ▼
Phase 3 (US1: 基础操作) ──────────────────────┐
    │                                          │
    ├──────────────┬──────────────┬───────────┼───────────┐
    ▼              ▼              ▼           ▼           ▼
Phase 4        Phase 5        Phase 6      Phase 8     Phase 9
(US2: TTL)     (US3: 计数器)  (US4: Hash)  (US6: L1)   (US7: 批量)
    │              │                                      │
    └──────────────┼──────────────────────────────────────┤
                   ▼                                      │
              Phase 7                                     │
              (US5: 分布式锁)                             │
                   │                                      │
                   └──────────────────────────────────────┤
                                                          ▼
                                                    Phase 10
                                                    (US8: HTTP API)
                                                          │
                                                          ▼
                                                    Phase 11
                                                    (US9: 访问控制)
                                                          │
                                                          ▼
                                                    Phase 12
                                                    (Polish)
```

### Parallelization Opportunities

**Phase 2 内部并行**:
- T005 (L2 PostgreSQL) 和 T006 (L1 Ristretto) 可并行开发

**Phase 3-9 部分并行**:
- US3, US4, US6, US7 可在 US1 完成后并行开发
- US5 需等待 US2 (TTL) 完成

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Setup | 3 | 1h | Yes |
| Phase 2: Foundational | 6 | 4h | Partial |
| Phase 3: US1 基础操作 | 7 | 4h | No |
| Phase 4: US2 TTL | 7 | 4h | No |
| Phase 5: US3 计数器 | 6 | 3h | Yes |
| Phase 6: US4 Hash | 6 | 4h | Yes |
| Phase 7: US5 分布式锁 | 6 | 4h | No |
| Phase 8: US6 L1 缓存 | 6 | 4h | Yes |
| Phase 9: US7 批量操作 | 4 | 2h | Yes |
| Phase 10: US8 HTTP API | 11 | 6h | Partial |
| Phase 11: US9 访问控制 | 6 | 4h | No |
| Phase 12: Polish | 6 | 4h | Yes |
| **Total** | **74** | **~44h** | |

---

## MVP Definition

**最小可行产品 (MVP)** = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 10 + Phase 11

完成 MVP 后，系统具备：
- ✅ Set/Get/Delete 基础操作
- ✅ TTL 过期机制
- ✅ 原子计数器（限流场景）
- ✅ L2 PostgreSQL 持久化
- ✅ **HTTP API（供 JS SDK 调用）**
- ✅ **访问控制（权限管理）**

**MVP 预估工时**: ~26h

---

## SQL Reference

### 基础操作

```sql
-- Set (UPSERT)
INSERT INTO _kv (key, value, updated)
VALUES ($1, $2, NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated = NOW();

-- SetEx (带 TTL)
INSERT INTO _kv (key, value, updated, expire_at)
VALUES ($1, $2, NOW(), NOW() + $3 * INTERVAL '1 second')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated = NOW(), expire_at = EXCLUDED.expire_at;

-- Get (带过期检查)
SELECT value FROM _kv
WHERE key = $1
  AND (expire_at IS NULL OR expire_at > NOW());

-- Delete
DELETE FROM _kv WHERE key = $1;

-- Exists
SELECT 1 FROM _kv
WHERE key = $1
  AND (expire_at IS NULL OR expire_at > NOW());
```

### 原子计数器

```sql
-- Incr
INSERT INTO _kv (key, value, updated)
VALUES ($1, '1', NOW())
ON CONFLICT (key) DO UPDATE
SET value = to_jsonb(COALESCE((_kv.value)::text::bigint, 0) + 1),
    updated = NOW()
RETURNING (value)::text::bigint;

-- IncrBy
INSERT INTO _kv (key, value, updated)
VALUES ($1, $2::text::jsonb, NOW())
ON CONFLICT (key) DO UPDATE
SET value = to_jsonb(COALESCE((_kv.value)::text::bigint, 0) + $2),
    updated = NOW()
RETURNING (value)::text::bigint;
```

### Hash 操作

```sql
-- HSet (JSONB 合并)
INSERT INTO _kv (key, value, updated)
VALUES ($1, jsonb_build_object($2, $3), NOW())
ON CONFLICT (key) DO UPDATE
SET value = _kv.value || jsonb_build_object($2, $3),
    updated = NOW();

-- HGet (字段提取)
SELECT value->$2 FROM _kv
WHERE key = $1
  AND (expire_at IS NULL OR expire_at > NOW());

-- HGetAll
SELECT value FROM _kv
WHERE key = $1
  AND (expire_at IS NULL OR expire_at > NOW());

-- HDel (字段删除)
UPDATE _kv
SET value = value - $2,
    updated = NOW()
WHERE key = $1;
```

### 分布式锁

```sql
-- Lock (尝试获取)
INSERT INTO _kv (key, value, expire_at)
VALUES ($1, $2, NOW() + $3 * INTERVAL '1 second')
ON CONFLICT DO NOTHING;
-- 检查 affected rows: 1 = 成功, 0 = 失败

-- Unlock (验证持有者后释放)
DELETE FROM _kv
WHERE key = $1 AND value = $2;
```

### 过期清理

```sql
-- 定期清理（每分钟执行）
DELETE FROM _kv WHERE expire_at < NOW();
```
