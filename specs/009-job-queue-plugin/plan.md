# Implementation Plan: Job Queue Plugin 重构

**Feature Branch**: `009-job-queue-plugin`  
**Spec**: `specs/009-job-queue-plugin/spec.md`  
**Status**: Ready for Dev

---

## 1. Implementation Phases

### Phase 1: 创建 Plugin 骨架 (Day 1)

**目标**: 建立插件基础结构，实现 MustRegister/Register 入口

**任务**:
1. 创建 `plugins/jobs/` 目录结构
2. 实现 `config.go` - Config 结构体和环境变量解析
3. 实现 `register.go` - MustRegister/Register 函数
4. 实现 `plugin.go` - jobsPlugin 结构体和生命周期钩子
5. 编写单元测试验证插件注册

**验收标准**:
- `jobs.MustRegister(app, config)` 可正常调用
- 环境变量覆盖功能正常
- 未注册插件时 `jobs.GetJobStore()` 返回 nil

---

### Phase 2: 迁移 JobStore 核心逻辑 (Day 1-2)

**目标**: 将 JobStore 从 core 迁移到 plugin

**任务**:
1. 复制 `core/job_store.go` → `plugins/jobs/store.go`
2. 修改包名和导入路径
3. 调整 JobStore 初始化逻辑，使用 `app.OnBootstrap()` 钩子
4. 实现内部迁移逻辑（自动创建 `_jobs` 表）
5. 迁移测试文件 `core/job_store_test.go` → `plugins/jobs/store_test.go`

**验收标准**:
- JobStore 所有方法功能正常
- 自动创建 `_jobs` 表功能正常
- 原有测试用例全部通过

---

### Phase 3: 迁移 Dispatcher (Day 2)

**目标**: 将 Dispatcher 从 core 迁移到 plugin

**任务**:
1. 复制 `core/job_dispatcher.go` → `plugins/jobs/dispatcher.go`
2. 修改包名和导入路径
3. 调整 Dispatcher 启动逻辑，使用配置控制
4. 实现 `app.OnTerminate()` 钩子停止 Dispatcher
5. 编写 Dispatcher 单元测试

**验收标准**:
- Dispatcher 自动启动和停止功能正常
- Worker 注册和任务分发功能正常
- SQLite 和 PostgreSQL 策略正常工作

---

### Phase 4: 迁移 HTTP Routes (Day 2-3)

**目标**: 将 HTTP API 从 apis 迁移到 plugin

**任务**:
1. 复制 `apis/job_routes.go` → `plugins/jobs/routes.go`
2. 修改包名和导入路径
3. 使用 `app.OnServe()` 钩子注册路由
4. 实现 `HTTPEnabled` 配置项
5. 迁移测试文件 `apis/job_routes_test.go` → `plugins/jobs/routes_test.go`

**验收标准**:
- 所有 HTTP 端点功能正常
- `HTTPEnabled=false` 时路由不注册
- 原有测试用例全部通过

---

### Phase 5: 清理 core 模块 (Day 3)

**目标**: 移除 core 中的 Job Queue 代码

**任务**:
1. 从 `core/app.go` 移除 `Jobs()` 方法声明
2. 从 `core/base.go` 移除 jobStore 字段和初始化
3. 删除 `core/job_store.go`
4. 删除 `core/job_dispatcher.go`
5. 删除 `core/job_hooks.go`
6. 删除 `core/job_store_test.go`
7. 删除 `apis/job_routes.go`
8. 删除 `apis/job_routes_test.go`
9. 删除 `migrations/1736500000_create_jobs.go`
10. 运行全量测试确保无破坏性变更

**验收标准**:
- core.App 接口不包含 Jobs() 方法
- 删除的文件不存在
- 全量测试通过

---

### Phase 6: 更新文档和示例 (Day 3)

**目标**: 更新相关文档和示例代码

**任务**:
1. 创建 `plugins/jobs/README.md` 使用文档
2. 更新 `examples/base/main.go` 添加插件注册示例
3. 更新 `CODEBUDDY.md` 插件列表
4. 创建迁移指南 `docs/MIGRATION_JOBS_PLUGIN.md`

**验收标准**:
- README.md 包含完整使用说明
- 示例代码可正常编译运行
- 迁移指南清晰可操作

---

## 2. File Operations Detail

### 2.1 新建文件

```bash
# 创建目录
mkdir -p plugins/jobs

# 新建文件
touch plugins/jobs/register.go
touch plugins/jobs/config.go
touch plugins/jobs/plugin.go
touch plugins/jobs/store.go
touch plugins/jobs/dispatcher.go
touch plugins/jobs/routes.go
touch plugins/jobs/migrations.go
touch plugins/jobs/store_test.go
touch plugins/jobs/routes_test.go
touch plugins/jobs/README.md
touch docs/MIGRATION_JOBS_PLUGIN.md
```

### 2.2 复制并修改

| 源文件 | 目标文件 | 修改内容 |
|-------|---------|---------|
| `core/job_store.go` | `plugins/jobs/store.go` | 包名改为 `jobs`，移除 core 依赖 |
| `core/job_dispatcher.go` | `plugins/jobs/dispatcher.go` | 包名改为 `jobs` |
| `core/job_store_test.go` | `plugins/jobs/store_test.go` | 包名改为 `jobs_test` |
| `apis/job_routes.go` | `plugins/jobs/routes.go` | 包名改为 `jobs`，使用钩子注册 |
| `apis/job_routes_test.go` | `plugins/jobs/routes_test.go` | 包名改为 `jobs_test` |

### 2.3 删除文件

```bash
# Phase 5 删除
rm core/job_store.go
rm core/job_dispatcher.go
rm core/job_hooks.go
rm core/job_store_test.go
rm apis/job_routes.go
rm apis/job_routes_test.go
rm migrations/1736500000_create_jobs.go
```

### 2.4 修改文件

| 文件 | 修改内容 |
|-----|---------|
| `core/app.go` | 移除 `Jobs() JobStore` 方法声明 |
| `core/base.go` | 移除 `jobStore` 字段、`Jobs()` 实现、初始化逻辑 |
| `examples/base/main.go` | 添加 `jobs.MustRegister()` 示例 |
| `CODEBUDDY.md` | 更新 "Using PocketBase as a Library" 章节 |

---

## 3. Code Templates

### 3.1 register.go

```go
package jobs

import (
    "sync"
    
    "github.com/pocketbase/pocketbase/core"
)

var (
    pluginRegistry = make(map[core.App]*jobsPlugin)
    pluginMu       sync.RWMutex
)

// MustRegister 注册 jobs 插件，失败时 panic
func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

// Register 注册 jobs 插件
func Register(app core.App, config Config) error {
    // 应用环境变量覆盖
    config = applyEnvOverrides(config)
    
    // 检查是否禁用
    if config.Disabled {
        return nil
    }
    
    // 应用默认值
    config = applyDefaults(config)
    
    p := &jobsPlugin{
        app:    app,
        config: config,
    }
    
    return p.register()
}

// GetJobStore 获取指定 App 的 JobStore
// 如果插件未注册，返回 nil
func GetJobStore(app core.App) *JobStore {
    pluginMu.RLock()
    defer pluginMu.RUnlock()
    
    if p, ok := pluginRegistry[app]; ok {
        return p.store
    }
    return nil
}
```

### 3.2 config.go

```go
package jobs

import (
    "os"
    "strconv"
    "time"
)

// Config 定义 jobs 插件配置
type Config struct {
    Disabled       bool
    Workers        int
    PollInterval   time.Duration
    LockDuration   time.Duration
    BatchSize      int
    MaxRetries     int
    MaxPayloadSize int64
    HTTPEnabled    bool
    EnqueueRule    string
    ManageRule     string
    AllowedTopics  []string
    AutoStart      bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
    return Config{
        Workers:        10,
        PollInterval:   time.Second,
        LockDuration:   5 * time.Minute,
        BatchSize:      10,
        MaxRetries:     3,
        MaxPayloadSize: 1 << 20,
        HTTPEnabled:    true,
        AutoStart:      true,
    }
}

func applyDefaults(c Config) Config {
    if c.Workers <= 0 {
        c.Workers = 10
    }
    if c.PollInterval <= 0 {
        c.PollInterval = time.Second
    }
    if c.LockDuration <= 0 {
        c.LockDuration = 5 * time.Minute
    }
    if c.BatchSize <= 0 {
        c.BatchSize = 10
    }
    if c.MaxRetries <= 0 {
        c.MaxRetries = 3
    }
    if c.MaxPayloadSize <= 0 {
        c.MaxPayloadSize = 1 << 20
    }
    return c
}

func applyEnvOverrides(c Config) Config {
    if v := os.Getenv("PB_JOBS_DISABLED"); v == "1" || v == "true" {
        c.Disabled = true
    }
    if v := os.Getenv("PB_JOBS_WORKERS"); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            c.Workers = n
        }
    }
    if v := os.Getenv("PB_JOBS_POLL_INTERVAL"); v != "" {
        if d, err := time.ParseDuration(v); err == nil {
            c.PollInterval = d
        }
    }
    if v := os.Getenv("PB_JOBS_LOCK_DURATION"); v != "" {
        if d, err := time.ParseDuration(v); err == nil {
            c.LockDuration = d
        }
    }
    if v := os.Getenv("PB_JOBS_BATCH_SIZE"); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            c.BatchSize = n
        }
    }
    if v := os.Getenv("PB_JOBS_HTTP_ENABLED"); v == "0" || v == "false" {
        c.HTTPEnabled = false
    }
    if v := os.Getenv("PB_JOBS_AUTO_START"); v == "0" || v == "false" {
        c.AutoStart = false
    }
    return c
}
```

### 3.3 plugin.go

```go
package jobs

import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/hook"
)

type jobsPlugin struct {
    app        core.App
    config     Config
    store      *JobStore
    dispatcher *Dispatcher
}

func (p *jobsPlugin) register() error {
    // 1. OnBootstrap: 初始化 Store 和 Dispatcher
    p.app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }
        
        // 确保 _jobs 表存在
        if err := p.ensureJobsTable(); err != nil {
            return err
        }
        
        // 创建 JobStore
        p.store = NewJobStore(p.app, p.config)
        
        // 创建 Dispatcher
        if p.config.AutoStart {
            p.dispatcher = NewDispatcher(p.app, p.store, p.config)
            p.dispatcher.Start()
        }
        
        // 注册到全局 registry
        pluginMu.Lock()
        pluginRegistry[p.app] = p
        pluginMu.Unlock()
        
        p.app.Logger().Info("Jobs plugin initialized",
            "workers", p.config.Workers,
            "poll_interval", p.config.PollInterval,
        )
        
        return nil
    })
    
    // 2. OnServe: 注册路由
    if p.config.HTTPEnabled {
        p.app.OnServe().BindFunc(func(e *core.ServeEvent) error {
            p.bindRoutes(e)
            return e.Next()
        })
    }
    
    // 3. OnTerminate: 停止 Dispatcher
    p.app.OnTerminate().Bind(&hook.Handler[*core.TerminateEvent]{
        Id: "__pbJobsOnTerminate__",
        Func: func(e *core.TerminateEvent) error {
            if p.dispatcher != nil {
                p.dispatcher.Stop()
            }
            
            pluginMu.Lock()
            delete(pluginRegistry, p.app)
            pluginMu.Unlock()
            
            return e.Next()
        },
        Priority: -999,
    })
    
    return nil
}

func (p *jobsPlugin) ensureJobsTable() error {
    // 检查表是否存在
    var count int
    err := p.app.DB().NewQuery(`
        SELECT COUNT(*) FROM sqlite_master 
        WHERE type='table' AND name='_jobs'
    `).Row(&count)
    
    // PostgreSQL 使用不同的查询
    if err != nil || p.app.IsPostgres() {
        err = p.app.DB().NewQuery(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = '_jobs'
        `).Row(&count)
    }
    
    if err != nil {
        return err
    }
    
    if count > 0 {
        return nil // 表已存在
    }
    
    // 创建表
    return p.createJobsTable()
}

func (p *jobsPlugin) createJobsTable() error {
    // 与原 migrations/1736500000_create_jobs.go 逻辑一致
    _, err := p.app.DB().NewQuery(`
        CREATE TABLE IF NOT EXISTS _jobs (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            payload TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            run_at TEXT NOT NULL,
            locked_until TEXT,
            retries INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            last_error TEXT,
            created TEXT NOT NULL DEFAULT '',
            updated TEXT NOT NULL DEFAULT ''
        )
    `).Execute()
    
    if err != nil {
        return err
    }
    
    // 创建索引
    indexes := []string{
        `CREATE INDEX IF NOT EXISTS idx_jobs_pending ON _jobs(status, run_at) WHERE status = 'pending'`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_topic ON _jobs(topic)`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_status ON _jobs(status)`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_locked ON _jobs(locked_until) WHERE status = 'processing'`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_created ON _jobs(created)`,
    }
    
    for _, idx := range indexes {
        if _, err := p.app.DB().NewQuery(idx).Execute(); err != nil {
            return err
        }
    }
    
    return nil
}
```

---

## 4. Testing Strategy

### 4.1 单元测试

| 测试文件 | 测试内容 |
|---------|---------|
| `config_test.go` | 环境变量解析、默认值应用 |
| `register_test.go` | 插件注册、GetJobStore |
| `store_test.go` | Enqueue、Get、List、Delete、Requeue |
| `dispatcher_test.go` | Worker 分发、并发控制 |
| `routes_test.go` | HTTP 端点功能 |

### 4.2 集成测试

| 测试场景 | 验证点 |
|---------|-------|
| 未注册插件 | _jobs 表不存在，API 返回 404 |
| 注册插件 | _jobs 表自动创建 |
| SQLite 策略 | 乐观锁 + CAS 正确工作 |
| PostgreSQL 策略 | SKIP LOCKED 正确工作 |
| 崩溃恢复 | locked_until 过期后任务被接管 |

### 4.3 测试命令

```bash
# 运行插件测试
go test -v ./plugins/jobs/...

# 运行全量测试（确保无破坏性变更）
go test ./...

# 运行覆盖率测试
go test -cover ./plugins/jobs/...
```

---

## 5. Risk Mitigation

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 迁移遗漏导致功能缺失 | 中 | 高 | 逐文件对比，确保所有功能迁移 |
| 测试用例未完全迁移 | 中 | 中 | 保留原测试文件直到新测试通过 |
| core 清理不彻底 | 低 | 中 | 使用 grep 搜索残留引用 |
| 向后兼容性问题 | 中 | 高 | 提供详细迁移指南 |

---

## 6. Timeline

| 阶段 | 预计时长 | 负责人 |
|-----|---------|-------|
| Phase 1: 插件骨架 | 4h | - |
| Phase 2: 迁移 JobStore | 4h | - |
| Phase 3: 迁移 Dispatcher | 3h | - |
| Phase 4: 迁移 HTTP Routes | 3h | - |
| Phase 5: 清理 core | 2h | - |
| Phase 6: 文档更新 | 2h | - |
| **总计** | **18h (约 3 天)** | - |

---

## 7. Dependencies

### 7.1 内部依赖

- `core.App` 接口（只读访问）
- `core.BootstrapEvent`、`core.ServeEvent`、`core.TerminateEvent`
- `tools/hook` 钩子系统

### 7.2 外部依赖

无新增外部依赖

---

## 8. Rollback Plan

如果重构出现严重问题，回滚步骤：

1. 恢复 `core/job_*.go` 文件
2. 恢复 `apis/job_routes.go` 文件
3. 恢复 `migrations/1736500000_create_jobs.go` 文件
4. 恢复 `core/app.go` 和 `core/base.go` 的 Jobs() 方法
5. 删除 `plugins/jobs/` 目录

**Git 命令**:
```bash
git checkout HEAD~1 -- core/job_store.go core/job_dispatcher.go core/job_hooks.go
git checkout HEAD~1 -- core/job_store_test.go
git checkout HEAD~1 -- apis/job_routes.go apis/job_routes_test.go
git checkout HEAD~1 -- migrations/1736500000_create_jobs.go
git checkout HEAD~1 -- core/app.go core/base.go
rm -rf plugins/jobs/
```
