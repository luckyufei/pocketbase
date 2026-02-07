# Task List: Job Queue Plugin 重构

**Feature Branch**: `031-job-queue-plugin`  
**Spec**: `specs/031-job-queue-plugin/spec.md`  
**Plan**: `specs/031-job-queue-plugin/plan.md`

---

## Phase 1: 创建 Plugin 骨架

### Task 1.1: 创建目录结构
- [x] 创建 `plugins/jobs/` 目录
- [x] 创建空文件占位

**验证**: `ls plugins/jobs/` 显示目录存在 ✅

---

### Task 1.2: 实现 config.go
- [x] 定义 `Config` 结构体
- [x] 实现 `DefaultConfig()` 函数
- [x] 实现 `applyDefaults()` 函数
- [x] 实现 `applyEnvOverrides()` 函数
- [x] 支持以下环境变量:
  - [x] `PB_JOBS_DISABLED`
  - [x] `PB_JOBS_WORKERS`
  - [x] `PB_JOBS_POLL_INTERVAL`
  - [x] `PB_JOBS_LOCK_DURATION`
  - [x] `PB_JOBS_BATCH_SIZE`
  - [x] `PB_JOBS_HTTP_ENABLED`
  - [x] `PB_JOBS_AUTO_START`

**验证**: `go build ./plugins/jobs/` 编译通过 ✅

---

### Task 1.3: 实现 register.go
- [x] 定义 `pluginRegistry` 全局变量
- [x] 实现 `MustRegister(app, config)` 函数
- [x] 实现 `Register(app, config)` 函数
- [x] 实现 `GetJobStore(app)` 函数
- [x] 处理 `Disabled` 配置（提前返回）

**验证**: 
```go
jobs.Register(app, jobs.Config{Disabled: true}) // 返回 nil，不注册
jobs.GetJobStore(app) // 返回 nil
```
✅

---

### Task 1.4: 编写 config_test.go
- [x] 测试 `DefaultConfig()` 返回正确默认值
- [x] 测试 `applyDefaults()` 填充空值
- [x] 测试 `applyEnvOverrides()` 覆盖配置
- [x] 测试 `PB_JOBS_DISABLED=1` 禁用插件

**验证**: `go test -v ./plugins/jobs/ -run TestConfig` ✅

---

### Task 1.5: 编写 register_test.go
- [x] 测试 `Register()` 正常注册
- [x] 测试 `MustRegister()` panic 行为
- [x] 测试 `GetJobStore()` 未注册返回 nil
- [x] 测试 `GetJobStore()` 已注册返回实例

**验证**: `go test -v ./plugins/jobs/ -run TestRegister` ✅

---

## Phase 2: 迁移 JobStore 核心逻辑

### Task 2.1: 迁移 store.go
- [x] 复制 `core/job_store.go` → `plugins/jobs/store.go`
- [x] 修改 `package core` → `package jobs`
- [x] 移除 `core.App` 嵌入，改为字段引用
- [x] 调整导入路径
- [x] 确保以下方法可用:
  - [x] `Enqueue(topic, payload) (string, error)`
  - [x] `EnqueueAt(topic, payload, runAt) (string, error)`
  - [x] `EnqueueWithOptions(topic, payload, opts) (string, error)`
  - [x] `Get(id) (*Job, error)`
  - [x] `List(filter) ([]*Job, error)`
  - [x] `Delete(id) error`
  - [x] `Requeue(id) error`
  - [x] `Stats() (*JobStats, error)`
  - [x] `Register(topic, handler)`

**验证**: `go build ./plugins/jobs/` 编译通过 ✅

---

### Task 2.2: 实现 plugin.go
- [x] 定义 `jobsPlugin` 结构体
- [x] 实现 `register()` 方法
- [x] 实现 `ensureJobsTable()` 方法（检查表存在）
- [x] 实现 `createJobsTable()` 方法（创建表和索引）
- [x] 注册 `OnBootstrap` 钩子初始化 Store
- [x] 注册 `OnTerminate` 钩子清理资源
- [x] 支持 SQLite 和 PostgreSQL 两种数据库

**验证**: 
```go
jobs.MustRegister(app, jobs.DefaultConfig())
// 启动后 _jobs 表自动创建
```
✅

---

### Task 2.3: 实现 migrations.go
- [x] 实现 `_jobs` 表 DDL（兼容 SQLite 和 PostgreSQL）
- [x] 实现索引创建:
  - [x] `idx_jobs_pending`
  - [x] `idx_jobs_topic`
  - [x] `idx_jobs_status`
  - [x] `idx_jobs_locked`
  - [x] `idx_jobs_created`
- [x] 实现表存在检查（避免重复创建）

**验证**: 
```sql
-- SQLite
SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='_jobs';
-- PostgreSQL
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '_jobs';
```
✅

---

### Task 2.4: 迁移 store_test.go
- [x] 复制 `core/job_store_test.go` → `plugins/jobs/store_test.go`
- [x] 修改 `package core` → `package jobs_test`
- [x] 调整测试初始化逻辑（使用插件注册）
- [x] 确保以下测试通过:
  - [x] `TestEnqueue`
  - [x] `TestEnqueueAt`
  - [x] `TestEnqueueWithOptions`
  - [x] `TestGet`
  - [x] `TestList`
  - [x] `TestDelete`
  - [x] `TestRequeue`
  - [x] `TestStats`
  - [x] `TestPayloadTooLarge`

**验证**: `go test -v ./plugins/jobs/ -run TestStore` ✅

---

## Phase 3: 迁移 Dispatcher

### Task 3.1: 迁移 dispatcher.go
- [x] 复制 `core/job_dispatcher.go` → `plugins/jobs/dispatcher.go`
- [x] 修改 `package core` → `package jobs`
- [x] 调整导入路径
- [x] 确保以下方法可用:
  - [x] `NewDispatcher(app, store, config) *Dispatcher`
  - [x] `Start()`
  - [x] `Stop()`
  - [x] `fetchPendingJobsSQLite()`（乐观锁策略）
  - [x] `fetchPendingJobsPostgres()`（SKIP LOCKED 策略）

**验证**: `go build ./plugins/jobs/` 编译通过 ✅

---

### Task 3.2: 集成 Dispatcher 到 Plugin
- [x] 在 `plugin.go` 中创建 Dispatcher 实例
- [x] 根据 `AutoStart` 配置决定是否启动
- [x] 在 `OnTerminate` 钩子中停止 Dispatcher
- [x] 支持手动启动/停止:
  - [x] `StartDispatcher()`
  - [x] `StopDispatcher()`

**验证**:
```go
jobs.MustRegister(app, jobs.Config{AutoStart: false})
// Dispatcher 不自动启动
jobStore := jobs.GetJobStore(app)
jobStore.StartDispatcher() // 手动启动
```
✅

---

### Task 3.3: 编写 dispatcher_test.go
- [x] 测试 Dispatcher 启动和停止
- [x] 测试 Worker 任务分发
- [x] 测试并发 Worker 任务不重复执行
- [x] 测试 SQLite 乐观锁策略
- [x] 测试 PostgreSQL SKIP LOCKED 策略
- [x] 测试崩溃恢复（locked_until 过期）

**验证**: `go test -v ./plugins/jobs/ -run TestDispatcher` ✅

---

## Phase 4: 迁移 HTTP Routes

### Task 4.1: 迁移 routes.go
- [x] 复制 `apis/job_routes.go` → `plugins/jobs/routes.go`
- [x] 修改 `package apis` → `package jobs`
- [x] 调整导入路径
- [x] 实现 `bindRoutes(e *core.ServeEvent)` 方法
- [x] 注册以下端点:
  - [x] `POST /api/jobs/enqueue`
  - [x] `GET /api/jobs/stats`
  - [x] `GET /api/jobs`
  - [x] `GET /api/jobs/{id}`
  - [x] `POST /api/jobs/{id}/requeue`
  - [x] `DELETE /api/jobs/{id}`

**验证**: `go build ./plugins/jobs/` 编译通过 ✅

---

### Task 4.2: 实现权限控制
- [x] 实现 `EnqueueRule` 权限检查
- [x] 实现 `ManageRule` 权限检查
- [x] 实现 `AllowedTopics` 白名单检查
- [x] Superuser 绕过所有权限检查

**验证**:
```go
jobs.MustRegister(app, jobs.Config{
    EnqueueRule: "@request.auth.id != ''",
    ManageRule:  "", // 仅 Superuser
})
```
✅

---

### Task 4.3: 实现 HTTPEnabled 开关
- [x] 当 `HTTPEnabled=false` 时不注册路由
- [x] 访问 `/api/jobs/*` 返回 404

**验证**:
```bash
PB_JOBS_HTTP_ENABLED=false ./app serve
curl http://localhost:8090/api/jobs/stats # 返回 404
```
✅

---

### Task 4.4: 迁移 routes_test.go
- [x] 创建 `plugins/jobs/routes_test.go`
- [x] 测试所有 handler 功能
- [x] 确保以下测试通过:
  - [x] `TestEnqueueEndpoint`
  - [x] `TestStatsEndpoint`
  - [x] `TestListEndpoint`
  - [x] `TestGetEndpoint`
  - [x] `TestRequeueEndpoint`
  - [x] `TestDeleteEndpoint`
  - [x] `TestUnauthorizedAccess`

**验证**: `go test -v ./plugins/jobs/ -run TestRoutes` ✅

---

## Phase 5: 清理 core 模块

### Task 5.1: 修改 core/app.go
- [x] 移除 `Jobs() JobStore` 方法声明
- [x] 确保接口编译通过

**验证**: `go build ./core/` 编译通过 ✅

---

### Task 5.2: 修改 core/base.go
- [x] 移除 `jobStore *JobStore` 字段
- [x] 移除 `Jobs() *JobStore` 方法实现
- [x] 移除 jobStore 初始化逻辑
- [x] 确保 BaseApp 编译通过

**验证**: `go build ./core/` 编译通过 ✅

---

### Task 5.3: 删除 core job 文件
- [x] 删除 `core/job_store.go`
- [x] 删除 `core/job_dispatcher.go`
- [x] 删除 `core/job_hooks.go`
- [x] 删除 `core/job_store_test.go`

**验证**: `ls core/job*.go` 无结果 ✅

---

### Task 5.4: 删除 apis job 文件
- [x] 删除 `apis/job_routes.go`
- [x] 删除 `apis/job_routes_test.go`

**验证**: `ls apis/job*.go` 无结果 ✅

---

### Task 5.5: 删除 migrations 文件
- [x] 删除 `migrations/1736500000_create_jobs.go`

**验证**: `ls migrations/*jobs*.go` 无结果 ✅

---

### Task 5.6: 全量测试
- [x] 运行 `go test ./...` 确保无破坏性变更
- [x] 修复任何编译错误
- [x] 修复任何测试失败

**验证**: `go test ./...` 全部通过 ✅

---

### Task 5.7: 搜索残留引用
- [x] 搜索 `app.Jobs()` 残留引用
- [x] 搜索 `jobStore` 残留引用
- [x] 搜索 `core.Job` 残留引用
- [x] 清理所有残留

**验证**: 
```bash
grep -r "app\.Jobs()" --include="*.go" . # 无结果
grep -r "jobStore" --include="*.go" core/ # 无结果
```
✅

---

## Phase 6: 更新文档和示例

### Task 6.1: 创建 README.md
- [x] 编写插件简介
- [x] 编写快速开始示例
- [x] 编写配置说明
- [x] 编写环境变量说明
- [x] 编写 Go API 示例
- [x] 编写 HTTP API 示例

**验证**: `cat plugins/jobs/README.md` 内容完整 ✅

---

### Task 6.2: 更新 examples/base/main.go
- [x] 添加 `jobs.MustRegister()` 导入
- [x] 添加插件注册示例代码
- [x] 添加 Worker 注册示例

**验证**: `go run examples/base/main.go serve` 正常启动 ✅

---

### Task 6.3: 更新 CODEBUDDY.md
- [x] 在 "Using PocketBase as a Library" 章节添加 jobs 插件
- [x] 在 "Plugin Descriptions" 表格添加 jobs 行
- [x] 在 "Troubleshooting Missing Features" 添加 jobs 条目
- [x] 更新目录结构说明

**验证**: 文档内容完整准确 ✅

---

### Task 6.4: 创建迁移指南
- [x] 创建 `docs/MIGRATION_JOBS_PLUGIN.md`
- [x] 编写 Before/After 代码对比
- [x] 编写迁移步骤清单
- [x] 编写常见问题解答

**验证**: 按照指南可完成迁移 ✅

---

## Verification Checklist

### 功能验证
- [x] 未注册插件时 `_jobs` 表不存在
- [x] 注册插件后 `_jobs` 表自动创建
- [x] `jobs.GetJobStore(app)` 返回正确实例
- [x] 环境变量配置生效
- [x] HTTP API 端点正常工作
- [x] Worker 任务分发正常
- [x] 失败重试机制正常
- [x] 崩溃恢复机制正常

### 代码质量
- [x] `go build ./...` 无错误
- [x] `go test ./...` 全部通过
- [x] `go test -cover ./plugins/jobs/...` 覆盖率 > 80% (实际: 82.4%)
- [ ] `golangci-lint run ./plugins/jobs/...` 无 lint 错误

### 文档完整性
- [x] `plugins/jobs/README.md` 完整
- [x] `docs/MIGRATION_JOBS_PLUGIN.md` 完整
- [x] `CODEBUDDY.md` 已更新
- [x] `examples/base/main.go` 示例可运行

---

## Progress Summary

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: 插件骨架 | ✅ 完成 | 5/5 |
| Phase 2: 迁移 JobStore | ✅ 完成 | 4/4 |
| Phase 3: 迁移 Dispatcher | ✅ 完成 | 3/3 |
| Phase 4: 迁移 HTTP Routes | ✅ 完成 | 4/4 |
| Phase 5: 清理 core | ✅ 完成 | 7/7 |
| Phase 6: 文档更新 | ✅ 完成 | 4/4 |
| **总计** | **✅ 完成** | **27/27** |

## 测试覆盖率报告

```
$ go test -cover ./plugins/jobs/...
ok      github.com/pocketbase/pocketbase/plugins/jobs   4.484s  coverage: 82.4% of statements
```

目标覆盖率: 80%
实际覆盖率: 82.4% ✅
