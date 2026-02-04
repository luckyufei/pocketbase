# Implementation Plan: KV Plugin 重构

**Branch**: `027-kv-plugin-refactor` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/027-kv-plugin-refactor/spec.md`

## Summary

将 PocketBase KV 模块从 `core/` 迁移到 `plugins/kv/`，遵循 PocketBase 插件化设计原则。迁移后，KV 功能默认不启用，用户需要显式调用 `kv.MustRegister(app, config)` 来启用。保持所有现有功能不变，仅改变代码组织结构和初始化方式。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `sync.Map` (L1 进程内缓存)
- `database/sql` (数据库操作)
- `encoding/json` (JSONB 序列化)

**Storage**: SQLite / PostgreSQL (`_kv` 表)  
**Testing**: Go test (unit + benchmark)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Backend (PocketBase 插件)  
**Performance Goals**: L1 读取 < 1μs, L2 读取 < 2ms, L2 写入 < 5ms  
**Constraints**: 保持现有功能完整性，无破坏性变更

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | KV 插件可选编译进主二进制 |
| Zero External Dependencies | ✅ PASS | 使用数据库内置能力，无外部依赖 |
| Plugin Pattern | ✅ PASS | 遵循 PocketBase 现有插件模式 |
| Opt-in Design | ✅ PASS | 默认不启用，需显式注册 |
| Backward Compatibility | ✅ PASS | 项目未上线，无需兼容 |

## Project Structure

### Documentation (this feature)

```text
specs/027-kv-plugin-refactor/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (target structure)

```text
plugins/kv/
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

### Migration Map (现有代码 → 目标位置)

| 源文件 | 目标文件 | 说明 |
|--------|----------|------|
| `core/kv_store.go` | `plugins/kv/store.go` + `store_impl.go` | 接口和实现分离 |
| `core/kv_store_test.go` | `plugins/kv/store_test.go` | 测试迁移 |
| `core/kv_l1_cache.go` | `plugins/kv/l1_cache.go` | L1 缓存 |
| `core/kv_l2_postgres.go` | `plugins/kv/l2_postgres.go` + `l2_sqlite.go` | L2 数据库操作 |
| `core/kv_hooks.go` | `plugins/kv/register.go` | 集成到注册逻辑 |
| `core/kv_benchmark_test.go` | `plugins/kv/benchmark_test.go` | 性能测试 |
| `apis/kv_routes.go` | `plugins/kv/routes.go` | HTTP API |
| `apis/kv_routes_test.go` | `plugins/kv/routes_test.go` | HTTP API 测试 |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User Application                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  // 显式注册 KV 插件                                          │
│  kv.MustRegister(app, kv.Config{                            │
│      L1Enabled:   true,                                      │
│      HTTPEnabled: true,                                      │
│  })                                                          │
│                                                              │
│  // 使用 KV 存储                                              │
│  store := kv.GetStore(app)                                   │
│  store.Set("key", "value")                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      plugins/kv/                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     HTTP API Layer                      ││
│  │  POST /api/kv/set | GET /api/kv/get | POST /api/kv/incr ││
│  │  (可配置启用，默认禁用)                                   ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                      KVStore API                        ││
│  │  Set/Get/Delete | SetEx/TTL | Incr/Decr | Lock/Unlock   ││
│  │  HSet/HGet/HGetAll | MSet/MGet | Exists/Keys            ││
│  └──────────────────────────┬──────────────────────────────┘│
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │                    Cache Layer                          ││
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   ││
│  │  │   L1: sync.Map      │  │   L2: Database          │   ││
│  │  │   (In-Process)      │  │   (SQLite/PostgreSQL)   │   ││
│  │  │                     │  │                         │   ││
│  │  │   • 可配置容量      │  │   • _kv 表              │   ││
│  │  │   • 可配置 TTL      │  │   • JSONB 值            │   ││
│  │  │   • LRU 淘汰        │  │   • 索引过期时间        │   ││
│  │  │   • 纳秒级读取      │  │   • 毫秒级读写          │   ││
│  │  └─────────────────────┘  └─────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Background Tasks                       ││
│  │  • 过期数据清理 (可配置间隔)                             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Path (Get)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│   L1    │────▶│   L2    │
│         │     │ Cache   │     │ Database│
└─────────┘     └────┬────┘     └────┬────┘
                     │               │
                     ▼               ▼
              ┌──────────┐    ┌──────────┐
              │  Hit?    │    │  Query   │
              │  Return  │    │  + Cache │
              └──────────┘    └──────────┘
```

1. 检查 L1 缓存，命中则直接返回（纳秒级）
2. L1 未命中，查询 L2 数据库
3. L2 查询时检查 expire_at 过滤过期数据
4. 查询结果写入 L1 缓存（短 TTL）
5. 返回结果

### Write Path (Set)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│   L2    │────▶│   L1    │
│         │     │ Database│     │ Invalidate
└─────────┘     └────┬────┘     └────┬────┘
                     │               │
                     ▼               ▼
              ┌──────────┐    ┌──────────┐
              │  UPSERT  │    │  Delete  │
              │  _kv     │    │  Cache   │
              └──────────┘    └──────────┘
```

1. 写入 L2 数据库（UPSERT 语义）
2. 清除 L1 缓存中对应 Key（保证一致性）
3. 返回成功

## Key Design Decisions

### 1. 插件注册模式

**Decision**: 使用 `MustRegister`/`Register` + `GetStore` 模式

**Rationale**:
- 与现有插件（trace、jsvm、tofauth）保持一致
- 支持配置灵活性
- 明确的生命周期管理

**Trade-off**: 需要显式注册，但提供更好的控制

### 2. L1 缓存实现

**Decision**: 保持使用 `sync.Map` + TTL

**Alternatives Considered**:
- `dgraph-io/ristretto`: 功能强大，但增加依赖
- 自定义 LRU: 增加维护成本

**Rationale**:
- sync.Map 已满足当前需求
- 零外部依赖
- 可后续升级到 Ristretto

### 3. HTTP API 默认禁用

**Decision**: HTTP API 默认禁用，需要显式配置启用

**Rationale**:
- 安全考虑：减少攻击面
- 性能考虑：不需要时不加载路由
- 灵活性：可根据需求选择启用

### 4. 迁移文件位置

**Decision**: 将所有 KV 相关文件集中到 `plugins/kv/` 目录

**Rationale**:
- 单一职责：所有 KV 代码在一处
- 易于维护：修改 KV 功能无需跨目录
- 符合插件模式：与其他插件结构一致

## API Design

### Core Interface

```go
// KVStore 接口保持不变
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
    
    // Other
    Keys(pattern string) ([]string, error)
}
```

### Plugin Registration

```go
// 注册 KV 插件
kv.MustRegister(app, kv.Config{
    L1Enabled:       true,
    L1TTL:           5 * time.Second,
    L1MaxSize:       100 * 1024 * 1024,
    CleanupInterval: time.Minute,
    HTTPEnabled:     true,
    ReadRule:        "@request.auth.id != ''",
    WriteRule:       "@request.auth.id != ''",
})

// 获取 KVStore 实例
store := kv.GetStore(app)
if store == nil {
    // 插件未注册
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 迁移遗漏 | Low | Medium | 完整的文件检查清单 |
| 测试失败 | Low | Medium | 迁移所有现有测试 |
| 性能回归 | Low | Low | Benchmark 对比测试 |
| API 不兼容 | N/A | N/A | 项目未上线，无需兼容 |

## Performance Expectations

| Operation | L1 (Cache Hit) | L2 (Database) | 目标 |
|-----------|----------------|---------------|------|
| Get | ~100ns | 0.5-2ms | ✅ 保持 |
| Set | - | 1-3ms | ✅ 保持 |
| Incr | - | 2-5ms | ✅ 保持 |
| HGet | ~100ns | 1-3ms | ✅ 保持 |
| Lock | - | 2-5ms | ✅ 保持 |

**预期**:
- 迁移后性能不应有明显退化
- 未注册时零开销（新增优势）

## Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| 无新增 | - | 复用现有依赖 |

### Internal Dependencies

| Component | Purpose |
|-----------|---------|
| core/base.go | App 结构体（移除 KV 依赖） |
| core/db_connect.go | 数据库连接 |

## Testing Strategy

### Unit Tests

- 迁移所有现有单元测试
- 添加插件注册/获取测试
- 添加配置解析测试

### Integration Tests

- L1 + L2 联动测试
- 过期清理任务测试
- HTTP API 测试

### Benchmark Tests

- 迁移现有 Benchmark
- 添加注册开销 Benchmark
- 对比迁移前后性能

## Estimated Effort

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: 创建插件框架 | 8 | 4h | Partial |
| Phase 2: 迁移 HTTP API | 4 | 2h | No |
| Phase 3: 迁移测试 | 6 | 3h | Yes |
| Phase 4: 清理旧代码 | 5 | 2h | No |
| Phase 5: 更新文档 | 3 | 1h | Yes |
| **Total** | **26** | **~12h** | |

## Rollback Plan

由于项目未上线，无需回滚计划。如果迁移出现问题，可以直接修复。
