# Task List: Job Queue Plugin 重构

**Feature Branch**: `009-job-queue-plugin`  
**Spec**: `specs/009-job-queue-plugin/spec.md`  
**Plan**: `specs/009-job-queue-plugin/plan.md`

---

## Phase 1: 创建 Plugin 骨架

### Task 1.1: 创建目录结构
- [ ] 创建 `plugins/jobs/` 目录
- [ ] 创建空文件占位

**验证**: `ls plugins/jobs/` 显示目录存在

---

### Task 1.2: 实现 config.go
- [ ] 定义 `Config` 结构体
- [ ] 实现 `DefaultConfig()` 函数
- [ ] 实现 `applyDefaults()` 函数
- [ ] 实现 `applyEnvOverrides()` 函数
- [ ] 支持以下环境变量:
  - [ ] `PB_JOBS_DISABLED`
  - [ ] `PB_JOBS_WORKERS`
  - [ ] `PB_JOBS_POLL_INTERVAL`
  - [ ] `PB_JOBS_LOCK_DURATION`
  - [ ] `PB_JOBS_BATCH_SIZE`
  - [ ] `PB_JOBS_HTTP_ENABLED`
  - [ ] `PB_JOBS_AUTO_START`

**验证**: `go build ./plugins/jobs/` 编译通过

---

### Task 1.3: 实现 register.go
- [ ] 定义 `pluginRegistry` 全局变量
- [ ] 实现 `MustRegister(app, config)` 函数
- [ ] 实现 `Register(app, config)` 函数
- [ ] 实现 `GetJobStore(app)` 函数
- [ ] 处理 `Disabled` 配置（提前返回）

**验证**: 
```go
jobs.Register(app, jobs.Config{Disabled: true}) // 返回 nil，不注册
jobs.GetJobStore(app) // 返回 nil
```

---

### Task 1.4: 编写 config_test.go
- [ ] 测试 `DefaultConfig()` 返回正确默认值
- [ ] 测试 `applyDefaults()` 填充空值
- [ ] 测试 `applyEnvOverrides()` 覆盖配置
- [ ] 测试 `PB_JOBS_DISABLED=1` 禁用插件

**验证**: `go test -v ./plugins/jobs/ -run TestConfig`

---

### Task 1.5: 编写 register_test.go
- [ ] 测试 `Register()` 正常注册
- [ ] 测试 `MustRegister()` panic 行为
- [ ] 测试 `GetJobStore()` 未注册返回 nil
- [ ] 测试 `GetJobStore()` 已注册返回实例

**验证**: `go test -v ./plugins/jobs/ -run TestRegister`

---

## Phase 2: 迁移 JobStore 核心逻辑

### Task 2.1: 迁移 store.go
- [ ] 复制 `core/job_store.go` → `plugins/jobs/store.go`
- [ ] 修改 `package core` → `package jobs`
- [ ] 移除 `core.App` 嵌入，改为字段引用
- [ ] 调整导入路径
- [ ] 确保以下方法可用:
  - [ ] `Enqueue(topic, payload) (string, error)`
  - [ ] `EnqueueAt(topic, payload, runAt) (string, error)`
  - [ ] `EnqueueWithOptions(topic, payload, opts) (string, error)`
  - [ ] `Get(id) (*Job, error)`
  - [ ] `List(filter) ([]*Job, error)`
  - [ ] `Delete(id) error`
  - [ ] `Requeue(id) error`
  - [ ] `Stats() (*JobStats, error)`
  - [ ] `Register(topic, handler)`

**验证**: `go build ./plugins/jobs/` 编译通过

---

### Task 2.2: 实现 plugin.go
- [ ] 定义 `jobsPlugin` 结构体
- [ ] 实现 `register()` 方法
- [ ] 实现 `ensureJobsTable()` 方法（检查表存在）
- [ ] 实现 `createJobsTable()` 方法（创建表和索引）
- [ ] 注册 `OnBootstrap` 钩子初始化 Store
- [ ] 注册 `OnTerminate` 钩子清理资源
- [ ] 支持 SQLite 和 PostgreSQL 两种数据库

**验证**: 
```go
jobs.MustRegister(app, jobs.DefaultConfig())
// 启动后 _jobs 表自动创建
```

---

### Task 2.3: 实现 migrations.go
- [ ] 实现 `_jobs` 表 DDL（兼容 SQLite 和 PostgreSQL）
- [ ] 实现索引创建:
  - [ ] `idx_jobs_pending`
  - [ ] `idx_jobs_topic`
  - [ ] `idx_jobs_status`
  - [ ] `idx_jobs_locked`
  - [ ] `idx_jobs_created`
- [ ] 实现表存在检查（避免重复创建）

**验证**: 
```sql
-- SQLite
SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='_jobs';
-- PostgreSQL
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '_jobs';
```

---

### Task 2.4: 迁移 store_test.go
- [ ] 复制 `core/job_store_test.go` → `plugins/jobs/store_test.go`
- [ ] 修改 `package core` → `package jobs_test`
- [ ] 调整测试初始化逻辑（使用插件注册）
- [ ] 确保以下测试通过:
  - [ ] `TestEnqueue`
  - [ ] `TestEnqueueAt`
  - [ ] `TestEnqueueWithOptions`
  - [ ] `TestGet`
  - [ ] `TestList`
  - [ ] `TestDelete`
  - [ ] `TestRequeue`
  - [ ] `TestStats`
  - [ ] `TestPayloadTooLarge`

**验证**: `go test -v ./plugins/jobs/ -run TestStore`

---

## Phase 3: 迁移 Dispatcher

### Task 3.1: 迁移 dispatcher.go
- [ ] 复制 `core/job_dispatcher.go` → `plugins/jobs/dispatcher.go`
- [ ] 修改 `package core` → `package jobs`
- [ ] 调整导入路径
- [ ] 确保以下方法可用:
  - [ ] `NewDispatcher(app, store, config) *Dispatcher`
  - [ ] `Start()`
  - [ ] `Stop()`
  - [ ] `fetchPendingJobsSQLite()`（乐观锁策略）
  - [ ] `fetchPendingJobsPostgres()`（SKIP LOCKED 策略）

**验证**: `go build ./plugins/jobs/` 编译通过

---

### Task 3.2: 集成 Dispatcher 到 Plugin
- [ ] 在 `plugin.go` 中创建 Dispatcher 实例
- [ ] 根据 `AutoStart` 配置决定是否启动
- [ ] 在 `OnTerminate` 钩子中停止 Dispatcher
- [ ] 支持手动启动/停止:
  - [ ] `StartDispatcher()`
  - [ ] `StopDispatcher()`

**验证**:
```go
jobs.MustRegister(app, jobs.Config{AutoStart: false})
// Dispatcher 不自动启动
jobStore := jobs.GetJobStore(app)
jobStore.StartDispatcher() // 手动启动
```

---

### Task 3.3: 编写 dispatcher_test.go
- [ ] 测试 Dispatcher 启动和停止
- [ ] 测试 Worker 任务分发
- [ ] 测试并发 Worker 任务不重复执行
- [ ] 测试 SQLite 乐观锁策略
- [ ] 测试 PostgreSQL SKIP LOCKED 策略
- [ ] 测试崩溃恢复（locked_until 过期）

**验证**: `go test -v ./plugins/jobs/ -run TestDispatcher`

---

## Phase 4: 迁移 HTTP Routes

### Task 4.1: 迁移 routes.go
- [ ] 复制 `apis/job_routes.go` → `plugins/jobs/routes.go`
- [ ] 修改 `package apis` → `package jobs`
- [ ] 调整导入路径
- [ ] 实现 `bindRoutes(e *core.ServeEvent)` 方法
- [ ] 注册以下端点:
  - [ ] `POST /api/jobs/enqueue`
  - [ ] `GET /api/jobs/stats`
  - [ ] `GET /api/jobs`
  - [ ] `GET /api/jobs/{id}`
  - [ ] `POST /api/jobs/{id}/requeue`
  - [ ] `DELETE /api/jobs/{id}`

**验证**: `go build ./plugins/jobs/` 编译通过

---

### Task 4.2: 实现权限控制
- [ ] 实现 `EnqueueRule` 权限检查
- [ ] 实现 `ManageRule` 权限检查
- [ ] 实现 `AllowedTopics` 白名单检查
- [ ] Superuser 绕过所有权限检查

**验证**:
```go
jobs.MustRegister(app, jobs.Config{
    EnqueueRule: "@request.auth.id != ''",
    ManageRule:  "", // 仅 Superuser
})
```

---

### Task 4.3: 实现 HTTPEnabled 开关
- [ ] 当 `HTTPEnabled=false` 时不注册路由
- [ ] 访问 `/api/jobs/*` 返回 404

**验证**:
```bash
PB_JOBS_HTTP_ENABLED=false ./app serve
curl http://localhost:8090/api/jobs/stats # 返回 404
```

---

### Task 4.4: 迁移 routes_test.go
- [ ] 复制 `apis/job_routes_test.go` → `plugins/jobs/routes_test.go`
- [ ] 修改 `package apis` → `package jobs_test`
- [ ] 调整测试初始化逻辑
- [ ] 确保以下测试通过:
  - [ ] `TestEnqueueEndpoint`
  - [ ] `TestStatsEndpoint`
  - [ ] `TestListEndpoint`
  - [ ] `TestGetEndpoint`
  - [ ] `TestRequeueEndpoint`
  - [ ] `TestDeleteEndpoint`
  - [ ] `TestUnauthorizedAccess`

**验证**: `go test -v ./plugins/jobs/ -run TestRoutes`

---

## Phase 5: 清理 core 模块

### Task 5.1: 修改 core/app.go
- [ ] 移除 `Jobs() JobStore` 方法声明
- [ ] 确保接口编译通过

**验证**: `go build ./core/` 编译通过

---

### Task 5.2: 修改 core/base.go
- [ ] 移除 `jobStore *JobStore` 字段
- [ ] 移除 `Jobs() *JobStore` 方法实现
- [ ] 移除 jobStore 初始化逻辑
- [ ] 确保 BaseApp 编译通过

**验证**: `go build ./core/` 编译通过

---

### Task 5.3: 删除 core job 文件
- [ ] 删除 `core/job_store.go`
- [ ] 删除 `core/job_dispatcher.go`
- [ ] 删除 `core/job_hooks.go`
- [ ] 删除 `core/job_store_test.go`

**验证**: `ls core/job*.go` 无结果

---

### Task 5.4: 删除 apis job 文件
- [ ] 删除 `apis/job_routes.go`
- [ ] 删除 `apis/job_routes_test.go`

**验证**: `ls apis/job*.go` 无结果

---

### Task 5.5: 删除 migrations 文件
- [ ] 删除 `migrations/1736500000_create_jobs.go`

**验证**: `ls migrations/*jobs*.go` 无结果

---

### Task 5.6: 全量测试
- [ ] 运行 `go test ./...` 确保无破坏性变更
- [ ] 修复任何编译错误
- [ ] 修复任何测试失败

**验证**: `go test ./...` 全部通过

---

### Task 5.7: 搜索残留引用
- [ ] 搜索 `app.Jobs()` 残留引用
- [ ] 搜索 `jobStore` 残留引用
- [ ] 搜索 `core.Job` 残留引用
- [ ] 清理所有残留

**验证**: 
```bash
grep -r "app\.Jobs()" --include="*.go" . # 无结果
grep -r "jobStore" --include="*.go" core/ # 无结果
```

---

## Phase 6: 更新文档和示例

### Task 6.1: 创建 README.md
- [ ] 编写插件简介
- [ ] 编写快速开始示例
- [ ] 编写配置说明
- [ ] 编写环境变量说明
- [ ] 编写 Go API 示例
- [ ] 编写 HTTP API 示例

**验证**: `cat plugins/jobs/README.md` 内容完整

---

### Task 6.2: 更新 examples/base/main.go
- [ ] 添加 `jobs.MustRegister()` 导入
- [ ] 添加插件注册示例代码
- [ ] 添加 Worker 注册示例

**验证**: `go run examples/base/main.go serve` 正常启动

---

### Task 6.3: 更新 CODEBUDDY.md
- [ ] 在 "Using PocketBase as a Library" 章节添加 jobs 插件
- [ ] 在 "Plugin Descriptions" 表格添加 jobs 行
- [ ] 在 "Troubleshooting Missing Features" 添加 jobs 条目
- [ ] 更新目录结构说明

**验证**: 文档内容完整准确

---

### Task 6.4: 创建迁移指南
- [ ] 创建 `docs/MIGRATION_JOBS_PLUGIN.md`
- [ ] 编写 Before/After 代码对比
- [ ] 编写迁移步骤清单
- [ ] 编写常见问题解答

**验证**: 按照指南可完成迁移

---

## Verification Checklist

### 功能验证
- [ ] 未注册插件时 `_jobs` 表不存在
- [ ] 注册插件后 `_jobs` 表自动创建
- [ ] `jobs.GetJobStore(app)` 返回正确实例
- [ ] 环境变量配置生效
- [ ] HTTP API 端点正常工作
- [ ] Worker 任务分发正常
- [ ] 失败重试机制正常
- [ ] 崩溃恢复机制正常

### 代码质量
- [ ] `go build ./...` 无错误
- [ ] `go test ./...` 全部通过
- [ ] `go test -cover ./plugins/jobs/...` 覆盖率 > 80%
- [ ] `golangci-lint run ./plugins/jobs/...` 无 lint 错误

### 文档完整性
- [ ] `plugins/jobs/README.md` 完整
- [ ] `docs/MIGRATION_JOBS_PLUGIN.md` 完整
- [ ] `CODEBUDDY.md` 已更新
- [ ] `examples/base/main.go` 示例可运行

---

## Progress Summary

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: 插件骨架 | 待开始 | 0/5 |
| Phase 2: 迁移 JobStore | 待开始 | 0/4 |
| Phase 3: 迁移 Dispatcher | 待开始 | 0/3 |
| Phase 4: 迁移 HTTP Routes | 待开始 | 0/4 |
| Phase 5: 清理 core | 待开始 | 0/7 |
| Phase 6: 文档更新 | 待开始 | 0/4 |
| **总计** | **待开始** | **0/27** |
