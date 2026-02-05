# File Migration Plan: 系统监控插件化重构

**Feature**: 028-metrics-plugin-refactor  
**Date**: 2026-02-05

## 文件迁移映射表

### 从 core/ 迁移

| 源文件 | 目标文件 | 变更说明 |
|-------|---------|---------|
| `core/metrics_model.go` | `plugins/metrics/model.go` | 修改 package；保留 Model 接口实现 |
| `core/metrics_model_test.go` | `plugins/metrics/model_test.go` | 更新 import |
| `core/metrics_collector.go` | `plugins/metrics/collector.go` | 拆分 LatencyBuffer |
| `core/metrics_collector.go` (部分) | `plugins/metrics/latency_buffer.go` | 提取 LatencyBuffer |
| `core/metrics_collector_test.go` | `plugins/metrics/collector_test.go` | 更新 import |
| `core/metrics_collector_test.go` (部分) | `plugins/metrics/latency_buffer_test.go` | 拆分测试 |
| `core/metrics_repository.go` | `plugins/metrics/repository.go` | 修改 package |
| `core/metrics_repository_test.go` | `plugins/metrics/repository_test.go` | 更新 import |
| `core/metrics_migration_test.go` | `plugins/metrics/migration_test.go` | 更新 import |

### 从 apis/ 迁移

| 源文件 | 目标文件 | 变更说明 |
|-------|---------|---------|
| `apis/metrics.go` (路由部分) | `plugins/metrics/routes.go` | 提取路由处理器 |
| `apis/metrics.go` (中间件部分) | `plugins/metrics/middleware.go` | 提取 MetricsMiddleware |
| `apis/metrics.go` (初始化部分) | `plugins/metrics/register.go` | 合并到插件注册逻辑 |

### 新增文件

| 文件 | 说明 |
|-----|------|
| `plugins/metrics/register.go` | 插件注册入口 |
| `plugins/metrics/config.go` | 配置结构和环境变量解析 |
| `plugins/metrics/constants.go` | 常量定义 |
| `plugins/metrics/README.md` | 插件文档 |

### 保持不变

| 文件 | 说明 |
|-----|------|
| `migrations/1736600000_system_metrics.go` | 迁移脚本保留在 migrations/ |

### 需要修改

| 文件 | 修改内容 |
|-----|---------|
| `apis/base.go` | 移除 `bindMetricsApi` 调用（如有） |
| `apis/serve.go` | 移除 `InitMetricsService` 调用（如有） |
| `examples/base/main.go` | 添加 `metrics.MustRegister()` |
| `CODEBUDDY.md` | 更新插件列表 |

### 删除文件

| 文件 |
|-----|
| `core/metrics_model.go` |
| `core/metrics_model_test.go` |
| `core/metrics_collector.go` |
| `core/metrics_collector_test.go` |
| `core/metrics_repository.go` |
| `core/metrics_repository_test.go` |
| `core/metrics_migration_test.go` |
| `apis/metrics.go` |

## 代码变更详情

### model.go 变更

```go
// 原: core/metrics_model.go
package core

import "github.com/pocketbase/pocketbase/tools/types"

var _ Model = (*SystemMetrics)(nil)

const SystemMetricsTableName = "_metrics"

type SystemMetrics struct {
    BaseModel
    // ...
}

// 新: plugins/metrics/model.go
package metrics

import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

var _ core.Model = (*SystemMetrics)(nil)

type SystemMetrics struct {
    core.BaseModel
    Timestamp       types.DateTime `db:"timestamp" json:"timestamp"`
    // ... 其他字段
}

func (m *SystemMetrics) TableName() string {
    return SystemMetricsTableName
}
```

### register.go 核心逻辑

```go
package metrics

import (
    "os"
    "strconv"
    "time"

    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/hook"
)

var (
    pluginRegistry = make(map[core.App]*metricsPlugin)
    pluginMu       sync.RWMutex
)

type metricsPlugin struct {
    app        core.App
    config     Config
    collector  *MetricsCollector
    repository *MetricsRepository
}

func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

func Register(app core.App, config Config) error {
    if config.Disabled {
        return nil
    }

    config = applyEnvOverrides(config)
    config = applyDefaults(config)

    p := &metricsPlugin{
        app:    app,
        config: config,
    }

    return p.register()
}

func (p *metricsPlugin) register() error {
    // OnBootstrap: 初始化
    p.app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }
        
        p.repository = NewMetricsRepository(p.app)
        p.collector = NewMetricsCollector(p.app, p.repository, p.config)
        p.collector.Start()
        
        // 注册到全局
        pluginMu.Lock()
        pluginRegistry[p.app] = p
        pluginMu.Unlock()
        
        return nil
    })

    // OnServe: 注册路由
    p.app.OnServe().BindFunc(func(e *core.ServeEvent) error {
        p.bindRoutes(e)
        
        if p.config.EnableMiddleware {
            e.Router.Bind(p.Middleware())
        }
        
        return e.Next()
    })

    // OnTerminate: 清理
    p.app.OnTerminate().Bind(&hook.Handler[*core.TerminateEvent]{
        Id: "__pbMetricsOnTerminate__",
        Func: func(e *core.TerminateEvent) error {
            if p.collector != nil {
                p.collector.Stop()
            }
            
            pluginMu.Lock()
            delete(pluginRegistry, p.app)
            pluginMu.Unlock()
            
            return e.Next()
        },
        Priority: -998,
    })

    // Cron: 清理任务
    p.app.Cron().Add("__pbMetricsCleanup__", p.config.CleanupCron, func() {
        if p.repository != nil {
            rowsDeleted, err := p.repository.CleanupOldMetrics()
            if err != nil {
                p.app.Logger().Error("Failed to cleanup old metrics", "error", err)
            } else if rowsDeleted > 0 {
                p.app.Logger().Info("Cleaned up old metrics", "rowsDeleted", rowsDeleted)
            }
        }
    })

    return nil
}

func GetCollector(app core.App) *MetricsCollector {
    pluginMu.RLock()
    defer pluginMu.RUnlock()
    if p, ok := pluginRegistry[app]; ok {
        return p.collector
    }
    return nil
}
```

## Import 变更参考

### 迁移前

```go
// 在其他文件中使用 metrics
import "github.com/pocketbase/pocketbase/core"

collector := core.NewMetricsCollector(app)
```

### 迁移后

```go
// 在其他文件中使用 metrics
import "github.com/pocketbase/pocketbase/plugins/metrics"

// 插件注册后，通过 GetCollector 获取
collector := metrics.GetCollector(app)
```

## 验证命令

```bash
# 1. 迁移后验证编译
go build ./plugins/metrics/...

# 2. 运行 metrics 包测试
go test ./plugins/metrics/... -v

# 3. 检查无遗留引用
grep -r "core\.MetricsCollector\|core\.MetricsRepository\|core\.SystemMetrics" --include="*.go" .

# 4. 运行完整测试
go test ./... -v

# 5. 代码覆盖率
go test ./plugins/metrics/... -coverprofile=coverage.out
go tool cover -func=coverage.out
```
