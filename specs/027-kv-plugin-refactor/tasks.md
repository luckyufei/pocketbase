# Implementation Tasks: KV Plugin 重构

**Branch**: `027-kv-plugin-refactor` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: 创建插件框架 + 迁移核心代码

**Purpose**: 创建 `plugins/kv/` 目录结构，迁移核心 KV 功能

**⚠️ CRITICAL**: 此阶段完成后，KV 功能应可通过插件方式使用

### Tasks

- [x] T001 创建 `plugins/kv/` 目录
- [x] T002 创建 `plugins/kv/errors.go` - 迁移错误定义（ErrKVNotFound, ErrKVKeyTooLong, ErrKVValueTooLarge）
- [x] T003 [P] 创建 `plugins/kv/store.go` - 迁移 KVStore 接口定义
- [x] T004 [P] 创建 `plugins/kv/noop.go` - 创建 NoopStore 空实现
- [x] T005 创建 `plugins/kv/config.go` - Config 结构体和默认值
- [x] T006 在 `plugins/kv/config.go` 中实现 `applyEnvOverrides()` 环境变量解析
- [x] T007 创建 `plugins/kv/l1_cache.go` - 迁移 L1 缓存实现（从 `core/kv_l1_cache.go`）
- [x] T008 创建 `plugins/kv/l2_db.go` - 数据库操作（SQLite + PostgreSQL）
- [x] T009 (合并到 T008) 
- [x] T010 创建 `plugins/kv/store_impl.go` - 迁移 KVStore 实现（从 `core/kv_store.go`）
- [x] T011 创建 `plugins/kv/register.go` - 实现 MustRegister/Register/GetStore
- [x] T012 在 `plugins/kv/register.go` 中实现 `_kv` 表自动迁移逻辑

**Checkpoint**: ✅ 此时 KV 功能应可通过 `kv.MustRegister()` 和 `kv.GetStore()` 使用

---

## Phase 2: 迁移 HTTP API

**Purpose**: 将 HTTP API 迁移到插件中，支持可配置启用

### Tasks

- [x] T013 创建 `plugins/kv/routes.go` - 迁移 HTTP API 路由（从 `apis/kv_routes.go`）
- [x] T014 修改路由注册为可配置（基于 `Config.HTTPEnabled`）
- [x] T015 在 `plugins/kv/register.go` 中集成路由注册（OnServe hook）
- [x] T016 实现访问控制逻辑（ReadRule/WriteRule）

**Checkpoint**: ✅ 此时 HTTP API 应可通过配置启用

---

## Phase 3: 迁移测试

**Purpose**: 迁移所有测试文件，确保功能完整性

### Tasks

- [x] T017 [P] 创建 `plugins/kv/store_test.go` - 迁移单元测试（从 `core/kv_store_test.go`）
- [x] T018 [P] 创建 `plugins/kv/l1_cache_test.go` - L1 缓存测试
- [x] T019 [P] 创建 `plugins/kv/l2_db_test.go` - L2 数据库测试
- [x] T020 创建 `plugins/kv/routes_test.go` - HTTP API 测试（基础）
- [x] T021 创建 `plugins/kv/register_test.go` - 插件注册测试（含所有 KV 操作测试）
- [x] T022 创建 `plugins/kv/config_test.go` - 配置解析测试
- [ ] T023 创建 `plugins/kv/benchmark_test.go` - 迁移性能测试（可选）
- [x] T024 运行所有测试，确保通过

**Checkpoint**: ✅ 所有测试应通过

---

## Phase 4: 清理旧代码

**Purpose**: 删除 `core/` 和 `apis/` 中的旧 KV 实现

**⚠️ WARNING**: 此阶段会删除文件，确保 Phase 3 测试全部通过后再执行

### Tasks

- [x] T025 删除 `core/kv_store.go`
- [x] T026 删除 `core/kv_store_test.go`
- [x] T027 删除 `core/kv_l1_cache.go`
- [x] T028 删除 `core/kv_l2_postgres.go`
- [x] T029 删除 `core/kv_hooks.go`
- [x] T030 删除 `core/kv_benchmark_test.go`
- [x] T031 删除 `apis/kv_routes.go`
- [x] T032 删除 `apis/kv_routes_test.go`
- [x] T033 修改 `core/app.go` - 移除 `KV()` 接口方法
- [x] T034 修改 `core/base.go` - 移除 kvStore 字段和初始化逻辑
- [x] T035 删除 KV 相关迁移文件 `migrations/1736400000_create_kv.go`

**Checkpoint**: ✅ `core/` 和 `apis/` 中应无 KV 相关文件

---

## Phase 5: 更新文档和示例

**Purpose**: 更新文档，添加使用示例

### Tasks

- [x] T036 [P] 创建 `plugins/kv/README.md` - 插件使用文档
- [x] T037 [P] 更新 `examples/base/main.go` - 添加 KV 插件注册示例
- [x] T038 更新 `CODEBUDDY.md` 和 `README.md` - 更新 KV 相关说明
- [x] T039 运行完整集成测试，验证所有功能正常

**Checkpoint**: ✅ 文档更新完成，项目可正常运行

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (创建插件框架)
    │
    ▼
Phase 2 (迁移 HTTP API)
    │
    ▼
Phase 3 (迁移测试)
    │
    ▼
Phase 4 (清理旧代码) ← 必须等待 Phase 3 测试全部通过
    │
    ▼
Phase 5 (更新文档)
```

### Task Dependencies

```
Phase 1:
T001 ──▶ T002, T003, T004 (并行)
    │
    ▼
T005, T006 (配置)
    │
    ▼
T007, T008, T009 (L1, L2 实现)
    │
    ▼
T010 (KVStore 实现)
    │
    ▼
T011, T012 (注册逻辑)

Phase 2:
T013 ──▶ T014 ──▶ T015 ──▶ T016

Phase 3:
T017, T018, T019 (并行) ──▶ T020 ──▶ T021, T022 (并行) ──▶ T023 ──▶ T024

Phase 4:
T025-T035 (顺序删除)

Phase 5:
T036, T037 (并行) ──▶ T038 ──▶ T039
```

---

## File Checklist

### 新建文件 (plugins/kv/)

| 文件 | 任务 | 状态 |
|------|------|------|
| `plugins/kv/errors.go` | T002 | [ ] |
| `plugins/kv/store.go` | T003 | [ ] |
| `plugins/kv/noop.go` | T004 | [ ] |
| `plugins/kv/config.go` | T005, T006 | [ ] |
| `plugins/kv/l1_cache.go` | T007 | [ ] |
| `plugins/kv/l2_postgres.go` | T008 | [ ] |
| `plugins/kv/l2_sqlite.go` | T009 | [ ] |
| `plugins/kv/store_impl.go` | T010 | [ ] |
| `plugins/kv/register.go` | T011, T012 | [ ] |
| `plugins/kv/routes.go` | T013-T016 | [ ] |
| `plugins/kv/store_test.go` | T017 | [ ] |
| `plugins/kv/l1_cache_test.go` | T018 | [ ] |
| `plugins/kv/l2_test.go` | T019 | [ ] |
| `plugins/kv/routes_test.go` | T020 | [ ] |
| `plugins/kv/register_test.go` | T021 | [ ] |
| `plugins/kv/config_test.go` | T022 | [ ] |
| `plugins/kv/benchmark_test.go` | T023 | [ ] |
| `plugins/kv/README.md` | T036 | [ ] |

### 删除文件 (core/, apis/)

| 文件 | 任务 | 状态 |
|------|------|------|
| `core/kv_store.go` | T025 | [ ] |
| `core/kv_store_test.go` | T026 | [ ] |
| `core/kv_l1_cache.go` | T027 | [ ] |
| `core/kv_l2_postgres.go` | T028 | [ ] |
| `core/kv_hooks.go` | T029 | [ ] |
| `core/kv_benchmark_test.go` | T030 | [ ] |
| `apis/kv_routes.go` | T031 | [ ] |
| `apis/kv_routes_test.go` | T032 | [ ] |

### 修改文件

| 文件 | 任务 | 修改内容 |
|------|------|---------|
| `core/app.go` | T033 | 移除 KV() 方法（如果存在） |
| `core/base.go` | T034 | 移除 kvStore 相关代码（如果存在） |
| `examples/base/main.go` | T037 | 添加 KV 插件注册示例 |
| `CODEBUDDY.md` | T038 | 更新 KV 相关说明 |

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Status |
|-------|-------|------------|--------|
| Phase 1: 创建插件框架 | 12 | 4h | [ ] |
| Phase 2: 迁移 HTTP API | 4 | 2h | [ ] |
| Phase 3: 迁移测试 | 8 | 3h | [ ] |
| Phase 4: 清理旧代码 | 11 | 2h | [ ] |
| Phase 5: 更新文档 | 4 | 1h | [ ] |
| **Total** | **39** | **~12h** | |

---

## Verification Commands

### Phase 1 验证

```bash
# 编译检查
go build ./plugins/kv/...

# 基础功能测试
go test ./plugins/kv/... -run TestKVStore
```

### Phase 2 验证

```bash
# HTTP API 测试
go test ./plugins/kv/... -run TestKVRoutes
```

### Phase 3 验证

```bash
# 运行所有测试
go test ./plugins/kv/... -v

# 覆盖率检查
go test ./plugins/kv/... -cover
```

### Phase 4 验证

```bash
# 确保旧文件已删除
ls core/kv*.go 2>/dev/null && echo "ERROR: Old KV files still exist" || echo "OK: Old KV files deleted"
ls apis/kv*.go 2>/dev/null && echo "ERROR: Old KV routes still exist" || echo "OK: Old KV routes deleted"

# 编译整个项目
go build ./...
```

### Phase 5 验证

```bash
# 运行完整测试
go test ./...

# 运行 Benchmark
go test ./plugins/kv/... -bench=. -benchmem
```

---

## Code Templates

### register.go 模板

```go
package kv

import (
    "sync"
    "github.com/pocketbase/pocketbase/core"
)

var (
    storeRegistry = make(map[core.App]KVStore)
    storeMu       sync.RWMutex
)

// MustRegister 注册 kv 插件，失败时 panic
func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

// Register 注册 kv 插件
func Register(app core.App, config Config) error {
    // 应用环境变量覆盖
    config = applyEnvOverrides(config)
    
    // 应用默认值
    config = applyDefaults(config)
    
    // 创建 KVStore 实例
    store := newKVStore(app, config)
    
    // 注册到全局 registry
    storeMu.Lock()
    storeRegistry[app] = store
    storeMu.Unlock()
    
    // 注册数据库迁移
    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := createKVTable(app); err != nil {
            return err
        }
        
        // 启动过期清理任务
        startCleanupTask(app, config.CleanupInterval)
        
        return e.Next()
    })
    
    // 注册 HTTP 路由（如果启用）
    if config.HTTPEnabled {
        app.OnServe().BindFunc(func(se *core.ServeEvent) error {
            registerRoutes(se.Router, app, config)
            return se.Next()
        })
    }
    
    // 注册清理钩子
    app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
        storeMu.Lock()
        delete(storeRegistry, app)
        storeMu.Unlock()
        return e.Next()
    })
    
    return nil
}

// GetStore 获取指定 App 的 KVStore
// 如果未注册，返回 nil
func GetStore(app core.App) KVStore {
    storeMu.RLock()
    defer storeMu.RUnlock()
    return storeRegistry[app]
}
```

### config.go 模板

```go
package kv

import (
    "os"
    "strconv"
    "time"
)

// Config 定义 kv 插件的配置选项
type Config struct {
    L1Enabled       bool
    L1TTL           time.Duration
    L1MaxSize       int64
    CleanupInterval time.Duration
    MaxKeyLength    int
    MaxValueSize    int64
    HTTPEnabled     bool
    ReadRule        string
    WriteRule       string
    AllowedPrefixes []string
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
    return Config{
        L1Enabled:       true,
        L1TTL:           5 * time.Second,
        L1MaxSize:       100 * 1024 * 1024, // 100MB
        CleanupInterval: time.Minute,
        MaxKeyLength:    256,
        MaxValueSize:    1 << 20, // 1MB
        HTTPEnabled:     false,
        ReadRule:        "",
        WriteRule:       "",
    }
}

// applyDefaults 应用默认值
func applyDefaults(c Config) Config {
    d := DefaultConfig()
    if c.L1TTL <= 0 {
        c.L1TTL = d.L1TTL
    }
    if c.L1MaxSize <= 0 {
        c.L1MaxSize = d.L1MaxSize
    }
    if c.CleanupInterval <= 0 {
        c.CleanupInterval = d.CleanupInterval
    }
    if c.MaxKeyLength <= 0 {
        c.MaxKeyLength = d.MaxKeyLength
    }
    if c.MaxValueSize <= 0 {
        c.MaxValueSize = d.MaxValueSize
    }
    return c
}

// applyEnvOverrides 应用环境变量覆盖
func applyEnvOverrides(c Config) Config {
    if v := os.Getenv("PB_KV_L1_ENABLED"); v != "" {
        c.L1Enabled = v == "true" || v == "1"
    }
    if v := os.Getenv("PB_KV_L1_TTL"); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            c.L1TTL = time.Duration(n) * time.Second
        }
    }
    if v := os.Getenv("PB_KV_L1_MAX_SIZE"); v != "" {
        if n, err := strconv.ParseInt(v, 10, 64); err == nil {
            c.L1MaxSize = n * 1024 * 1024 // MB to bytes
        }
    }
    if v := os.Getenv("PB_KV_CLEANUP_INTERVAL"); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            c.CleanupInterval = time.Duration(n) * time.Second
        }
    }
    if v := os.Getenv("PB_KV_HTTP_ENABLED"); v != "" {
        c.HTTPEnabled = v == "true" || v == "1"
    }
    return c
}
```
