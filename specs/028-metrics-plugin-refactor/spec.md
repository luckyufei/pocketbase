# Refactor Specification: 系统监控插件化重构

**Feature Branch**: `028-metrics-plugin-refactor`  
**Created**: 2026-02-05  
**Status**: Draft  
**Priority**: P2  
**Effort**: 1-2 天

## 背景与动机

### 当前问题

001-system-monitoring 需求实现了系统监控功能，但代码分散在 `core/` 和 `apis/` 目录中：

```
core/
├── metrics_model.go           # SystemMetrics 数据模型
├── metrics_collector.go       # MetricsCollector 采集器  
├── metrics_repository.go      # MetricsRepository 数据访问层
├── metrics_*_test.go          # 相关测试文件 (5个)

apis/
├── metrics.go                 # API 路由 + InitMetricsService()

migrations/
├── 1736600000_system_metrics.go  # _metrics 表迁移
```

### 重构理由

1. **遵循已有模式**：
   - `plugins/trace/` - 可观测性追踪
   - `plugins/analytics/` - 用户行为分析
   - `plugins/gateway/` - API 网关
   - `plugins/kv/` - KV 存储
   
   系统监控是**可选的可观测性功能**，符合 plugin 定义。

2. **Opt-in 设计**：
   - 嵌入式使用场景可能不需要系统监控
   - 作为 plugin 可以选择性注册

3. **关注点分离**：
   - `core/` 应该只包含核心功能（Collection、Record、DB 连接等）
   - 监控是**增强功能**，不是核心功能

4. **一致性**：
   - 与 `trace`、`analytics` 等可观测性插件保持一致的组织方式

5. **减少 core 包膨胀**：
   - 当前 `core/` 有 215+ 个 Go 文件

## 目标

### 重构目标

1. 将系统监控相关代码从 `core/` 和 `apis/` 移动到 `plugins/metrics/`
2. 提供 `MustRegister/Register` 标准插件入口
3. 支持配置化（采集间隔、保留天数等）
4. 不破坏现有功能

### 非目标

- 不增加新功能
- 不修改数据模型
- 不修改 API 接口

## 设计

### 目标目录结构

```
plugins/metrics/
├── register.go           # MustRegister/Register 入口
├── config.go             # Config 配置结构 + 环境变量解析
├── constants.go          # 常量定义（表名、默认值等）
├── model.go              # SystemMetrics 模型
├── collector.go          # MetricsCollector 采集器
├── latency_buffer.go     # LatencyBuffer 实现
├── repository.go         # MetricsRepository 数据访问层
├── routes.go             # API 路由注册
├── middleware.go         # MetricsMiddleware 请求追踪中间件
├── README.md             # 文档
└── *_test.go             # 测试文件
```

### 公开 API

```go
package metrics

// Config 插件配置
type Config struct {
    // Disabled 禁用插件
    Disabled bool

    // CollectionInterval 采集间隔（默认 60 秒）
    CollectionInterval time.Duration

    // RetentionDays 数据保留天数（默认 7 天）
    RetentionDays int

    // LatencyBufferSize 延迟 Ring Buffer 大小（默认 1000）
    LatencyBufferSize int

    // EnableMiddleware 是否自动注册请求追踪中间件（默认 true）
    EnableMiddleware bool

    // CleanupCron 清理任务 Cron 表达式（默认 "0 3 * * *"）
    CleanupCron string
}

// MustRegister 注册插件，失败时 panic
func MustRegister(app core.App, config Config)

// Register 注册插件
func Register(app core.App, config Config) error

// GetCollector 获取 MetricsCollector（供外部中间件使用）
func GetCollector(app core.App) *MetricsCollector
```

### 使用示例

```go
import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/metrics"
)

func main() {
    app := pocketbase.New()
    
    // 注册系统监控插件
    metrics.MustRegister(app, metrics.Config{
        CollectionInterval: 60 * time.Second,
        RetentionDays:      7,
        EnableMiddleware:   true,
    })
    
    app.Start()
}
```

### 环境变量支持

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_METRICS_DISABLED` | 禁用插件 | `false` |
| `PB_METRICS_INTERVAL` | 采集间隔（秒）| `60` |
| `PB_METRICS_RETENTION_DAYS` | 数据保留天数 | `7` |
| `PB_METRICS_BUFFER_SIZE` | Ring Buffer 大小 | `1000` |
| `PB_METRICS_CLEANUP_CRON` | 清理 Cron 表达式 | `0 3 * * *` |

## 文件迁移清单

### 需要移动的文件

| 源文件 | 目标文件 | 说明 |
|-------|---------|------|
| `core/metrics_model.go` | `plugins/metrics/model.go` | 修改 package |
| `core/metrics_collector.go` | `plugins/metrics/collector.go` + `latency_buffer.go` | 拆分文件 |
| `core/metrics_repository.go` | `plugins/metrics/repository.go` | 修改 package |
| `apis/metrics.go` | `plugins/metrics/routes.go` + `middleware.go` | 拆分并重构 |

### 需要删除的文件

| 文件 | 说明 |
|-----|------|
| `core/metrics_model.go` | 移动后删除 |
| `core/metrics_model_test.go` | 移动后删除 |
| `core/metrics_collector.go` | 移动后删除 |
| `core/metrics_collector_test.go` | 移动后删除 |
| `core/metrics_repository.go` | 移动后删除 |
| `core/metrics_repository_test.go` | 移动后删除 |
| `core/metrics_migration_test.go` | 移动后删除 |
| `apis/metrics.go` | 移动后删除 |

### 需要修改的文件

| 文件 | 修改内容 |
|-----|---------|
| `migrations/1736600000_system_metrics.go` | 保留，迁移逻辑不变 |
| `examples/base/main.go` | 添加 `metrics.MustRegister()` 调用 |
| `CODEBUDDY.md` | 更新文档，添加 metrics 插件说明 |

## 实现任务

### T001: 创建插件骨架 [1h]

- [ ] 创建 `plugins/metrics/` 目录
- [ ] 创建 `register.go` 基本结构
- [ ] 创建 `config.go` 配置结构

### T002: 迁移数据模型 [0.5h]

- [ ] 移动 `metrics_model.go` → `model.go`
- [ ] 添加 `constants.go` 常量定义
- [ ] 迁移相关测试

### T003: 迁移采集器 [1h]

- [ ] 移动 `metrics_collector.go` → `collector.go`
- [ ] 提取 `LatencyBuffer` 到 `latency_buffer.go`
- [ ] 迁移相关测试

### T004: 迁移数据仓库 [0.5h]

- [ ] 移动 `metrics_repository.go` → `repository.go`
- [ ] 迁移相关测试

### T005: 迁移 API 路由 [1h]

- [ ] 从 `apis/metrics.go` 提取路由 → `routes.go`
- [ ] 从 `apis/metrics.go` 提取中间件 → `middleware.go`
- [ ] 实现 `bindRoutes()` 函数

### T006: 实现插件注册 [1h]

- [ ] 完善 `register.go` 中的 `MustRegister/Register`
- [ ] 实现环境变量解析
- [ ] 实现生命周期管理（启动、终止）
- [ ] 注册 Cron 清理任务

### T007: 清理旧代码 [0.5h]

- [ ] 删除 `core/metrics_*.go` 文件
- [ ] 删除 `apis/metrics.go`
- [ ] 更新 `apis/base.go` 移除 metrics 相关绑定

### T008: 集成测试 [1h]

- [ ] 更新 `examples/base/main.go` 添加插件注册
- [ ] 运行完整测试套件
- [ ] 验证 API 功能正常

### T009: 文档更新 [0.5h]

- [ ] 创建 `plugins/metrics/README.md`
- [ ] 更新 `CODEBUDDY.md` 插件列表
- [ ] 更新 001-system-monitoring 相关文档

## 测试计划

### 单元测试

- [ ] `model_test.go` - SystemMetrics 模型测试
- [ ] `collector_test.go` - 采集器测试
- [ ] `latency_buffer_test.go` - Ring Buffer 测试
- [ ] `repository_test.go` - 数据仓库测试
- [ ] `config_test.go` - 配置和环境变量测试

### 集成测试

- [ ] 插件注册/注销测试
- [ ] API 端点测试（`/api/system/metrics`、`/api/system/metrics/current`）
- [ ] 中间件延迟记录测试
- [ ] Cron 清理任务测试

### 验收标准

1. 所有现有测试继续通过
2. API 接口行为不变
3. 监控数据正常采集和存储
4. 代码覆盖率 ≥ 95%

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 迁移过程中遗漏依赖 | 编译失败 | 逐步迁移，每步验证编译 |
| 测试覆盖不全 | 运行时错误 | 迁移前确保所有测试通过 |
| API 路由注册顺序问题 | 路由失效 | 参考其他插件的注册模式 |

## 参考资料

- `plugins/trace/` - Trace 插件实现参考
- `plugins/analytics/` - Analytics 插件实现参考
- `plugins/gateway/` - Gateway 插件实现参考
- `specs/001-system-monitoring/` - 原始需求文档
