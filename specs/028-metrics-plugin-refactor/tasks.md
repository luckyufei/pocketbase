# Tasks: 系统监控插件化重构

**Feature**: 028-metrics-plugin-refactor  
**Date**: 2026-02-05  
**Status**: ✅ 完成

## 任务概览

| ID | 任务 | 预估 | 状态 |
|----|------|------|------|
| T001 | 创建插件骨架 | 1h | ✅ |
| T002 | 迁移数据模型 | 0.5h | ✅ |
| T003 | 迁移采集器 | 1h | ✅ |
| T004 | 迁移数据仓库 | 0.5h | ✅ |
| T005 | 迁移 API 路由 | 1h | ✅ |
| T006 | 实现插件注册 | 1h | ✅ |
| T007 | 清理旧代码 | 0.5h | ✅ |
| T008 | 集成测试 | 1h | ✅ |
| T009 | 文档更新 | 0.5h | ✅ |

**总预估**: 7h (约 1 天)  
**实际完成**: 2026-02-05

---

## T001: 创建插件骨架 [1h]

### 目标
创建 `plugins/metrics/` 目录结构和基础文件。

### 子任务

- [ ] T001.1: 创建目录 `plugins/metrics/`
- [ ] T001.2: 创建 `register.go` 基本结构
  ```go
  package metrics
  
  func MustRegister(app core.App, config Config) { ... }
  func Register(app core.App, config Config) error { ... }
  func GetCollector(app core.App) *MetricsCollector { ... }
  ```
- [ ] T001.3: 创建 `config.go` 配置结构
  ```go
  type Config struct {
      Disabled           bool
      CollectionInterval time.Duration
      RetentionDays      int
      LatencyBufferSize  int
      EnableMiddleware   bool
      CleanupCron        string
  }
  ```
- [ ] T001.4: 创建 `constants.go`
  ```go
  const (
      SystemMetricsTableName    = "_metrics"
      DefaultCollectionInterval = 60 * time.Second
      DefaultRetentionDays      = 7
      DefaultLatencyBufferSize  = 1000
      DefaultCleanupCron        = "0 3 * * *"
  )
  ```

### 验收标准
- [ ] `go build ./plugins/metrics/...` 编译通过

---

## T002: 迁移数据模型 [0.5h]

### 目标
将 `SystemMetrics` 模型从 `core/` 移动到 `plugins/metrics/`。

### 源文件
- `core/metrics_model.go`
- `core/metrics_model_test.go`

### 子任务

- [ ] T002.1: 创建 `plugins/metrics/model.go`
  - 复制 `SystemMetrics` 结构体
  - 复制 `SystemMetricsResponse` 结构体
  - 修改 package 声明
  - 移除对 `core.BaseModel` 的嵌入，改为自定义 BaseModel 或直接定义字段

- [ ] T002.2: 创建 `plugins/metrics/model_test.go`
  - 迁移相关测试

### 注意事项
- `SystemMetrics` 实现了 `core.Model` 接口
- 需要在 `model.go` 中定义 `TableName()` 方法

### 验收标准
- [ ] 测试通过: `go test ./plugins/metrics/... -run TestModel`

---

## T003: 迁移采集器 [1h]

### 目标
将 `MetricsCollector` 和 `LatencyBuffer` 从 `core/` 移动到 `plugins/metrics/`。

### 源文件
- `core/metrics_collector.go`
- `core/metrics_collector_test.go`

### 子任务

- [ ] T003.1: 创建 `plugins/metrics/latency_buffer.go`
  - 提取 `LatencyBuffer` 结构体
  - 提取 `NewLatencyBuffer()`、`Add()`、`P95()`、`Reset()` 方法

- [ ] T003.2: 创建 `plugins/metrics/latency_buffer_test.go`
  - 迁移 LatencyBuffer 相关测试

- [ ] T003.3: 创建 `plugins/metrics/collector.go`
  - 移动 `MetricsCollector` 结构体
  - 更新导入路径

- [ ] T003.4: 创建 `plugins/metrics/collector_test.go`
  - 迁移采集器测试

### 验收标准
- [ ] 测试通过: `go test ./plugins/metrics/... -run TestLatency`
- [ ] 测试通过: `go test ./plugins/metrics/... -run TestCollector`

---

## T004: 迁移数据仓库 [0.5h]

### 目标
将 `MetricsRepository` 从 `core/` 移动到 `plugins/metrics/`。

### 源文件
- `core/metrics_repository.go`
- `core/metrics_repository_test.go`
- `core/metrics_migration_test.go`

### 子任务

- [ ] T004.1: 创建 `plugins/metrics/repository.go`
  - 移动 `MetricsRepository` 结构体
  - 移动 `NewMetricsRepository()`
  - 移动 `Insert()`、`InsertBatch()`、`GetLatest()`、`GetByTimeRange()`、`CleanupOldMetrics()` 方法

- [ ] T004.2: 创建 `plugins/metrics/repository_test.go`
  - 迁移仓库测试

- [ ] T004.3: 迁移 migration 测试到 `plugins/metrics/migration_test.go`

### 验收标准
- [ ] 测试通过: `go test ./plugins/metrics/... -run TestRepository`

---

## T005: 迁移 API 路由 [1h]

### 目标
将 API 路由和中间件从 `apis/metrics.go` 移动到 `plugins/metrics/`。

### 源文件
- `apis/metrics.go`

### 子任务

- [ ] T005.1: 创建 `plugins/metrics/routes.go`
  ```go
  func bindRoutes(app core.App, rg *router.RouterGroup[*core.RequestEvent]) {
      subGroup := rg.Group("/system")
      subGroup.Bind(apis.RequireSuperuserAuth())
      
      // GET /api/system/metrics
      subGroup.GET("/metrics", handleGetMetrics)
      
      // GET /api/system/metrics/current
      subGroup.GET("/metrics/current", handleGetCurrentMetrics)
  }
  ```

- [ ] T005.2: 创建 `plugins/metrics/middleware.go`
  ```go
  func Middleware() func(*core.RequestEvent) error {
      return func(e *core.RequestEvent) error {
          // 记录延迟和错误
      }
  }
  ```

- [ ] T005.3: 创建 `plugins/metrics/routes_test.go`

### 验收标准
- [ ] API 测试通过

---

## T006: 实现插件注册 [1h]

### 目标
完善插件的注册逻辑，包括生命周期管理。

### 子任务

- [ ] T006.1: 完善 `register.go` 的 `Register()` 函数
  ```go
  func Register(app core.App, config Config) error {
      if config.Disabled {
          return nil
      }
      
      // 应用环境变量覆盖
      config = applyEnvOverrides(config)
      
      // 应用默认值
      config = applyDefaults(config)
      
      p := &metricsPlugin{
          app:    app,
          config: config,
      }
      
      return p.register()
  }
  ```

- [ ] T006.2: 实现 `applyEnvOverrides()` 环境变量解析

- [ ] T006.3: 实现 `metricsPlugin.register()` 注册逻辑
  - OnBootstrap: 初始化 Repository 和 Collector
  - OnServe: 注册路由和中间件
  - OnTerminate: 停止 Collector
  - Cron: 注册清理任务

- [ ] T006.4: 创建 `plugins/metrics/register_test.go`

### 验收标准
- [ ] 插件注册后监控正常工作
- [ ] 终止时 Collector 正确停止
- [ ] 环境变量覆盖生效

---

## T007: 清理旧代码 [0.5h]

### 目标
删除 `core/` 和 `apis/` 中的旧代码。

### 子任务

- [ ] T007.1: 删除 `core/metrics_model.go`
- [ ] T007.2: 删除 `core/metrics_model_test.go`
- [ ] T007.3: 删除 `core/metrics_collector.go`
- [ ] T007.4: 删除 `core/metrics_collector_test.go`
- [ ] T007.5: 删除 `core/metrics_repository.go`
- [ ] T007.6: 删除 `core/metrics_repository_test.go`
- [ ] T007.7: 删除 `core/metrics_migration_test.go`
- [ ] T007.8: 删除 `apis/metrics.go`
- [ ] T007.9: 更新 `apis/base.go` 移除 metrics 相关绑定（如有）

### 验收标准
- [ ] `go build ./...` 编译通过
- [ ] 无遗留的 metrics 相关 import

---

## T008: 集成测试 [1h]

### 目标
确保重构后功能完整。

### 子任务

- [ ] T008.1: 更新 `examples/base/main.go`
  ```go
  import "github.com/pocketbase/pocketbase/plugins/metrics"
  
  func main() {
      app := pocketbase.New()
      
      metrics.MustRegister(app, metrics.Config{})
      
      app.Start()
  }
  ```

- [ ] T008.2: 运行完整测试套件
  ```bash
  go test ./... -v
  ```

- [ ] T008.3: 手动验证 API
  - `GET /api/system/metrics` - 返回历史数据
  - `GET /api/system/metrics/current` - 返回当前指标

- [ ] T008.4: 验证 Cron 清理任务注册成功

### 验收标准
- [ ] 所有测试通过
- [ ] API 响应正确
- [ ] 监控数据正常采集

---

## T009: 文档更新 [0.5h]

### 目标
更新相关文档。

### 子任务

- [ ] T009.1: 创建 `plugins/metrics/README.md`
  - 功能介绍
  - 快速开始
  - 配置说明
  - API 文档
  - 环境变量

- [ ] T009.2: 更新 `CODEBUDDY.md`
  - 在 Plugins Package 部分添加 metrics 说明
  - 更新 "Using PocketBase as a Library" 示例

- [ ] T009.3: 更新 `specs/001-system-monitoring/` 文档
  - 添加重构说明
  - 更新代码位置引用

### 验收标准
- [ ] README 完整清晰
- [ ] CODEBUDDY.md 包含 metrics 插件信息

---

## 执行顺序

```
T001 (骨架) 
    ↓
T002 (模型) → T003 (采集器) → T004 (仓库)
                    ↓
               T005 (路由)
                    ↓
               T006 (注册)
                    ↓
               T007 (清理)
                    ↓
               T008 (测试)
                    ↓
               T009 (文档)
```

## 完成检查清单

- [ ] 所有任务完成
- [ ] `go test ./plugins/metrics/...` 全部通过
- [ ] `go test ./...` 全部通过
- [ ] 代码覆盖率 ≥ 95%
- [ ] API 功能验证通过
- [ ] 文档更新完成
