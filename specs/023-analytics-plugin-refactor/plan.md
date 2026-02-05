# Implementation Plan: Analytics Plugin Refactor

**Branch**: `023-analytics-plugin-refactor` | **Date**: 2026-02-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-analytics-plugin-refactor/spec.md`

## Summary

将现有的 Analytics 模块从 `core/` 目录重构为可插拔插件，遵循 `plugins/trace/` 的架构模式。这是一个纯代码迁移重构，不新增功能，保持完全的 API 兼容性。

**Core Principle**: "Move, not Rewrite" — 最小化代码修改，保持功能完整性。

## Technical Context

**Language/Version**: Go 1.24.0  
**Reference Implementation**: `plugins/trace/` (插件架构模式参考)

**Current Implementation**:
- `core/analytics*.go` (24 个文件，包括测试)
- `apis/analytics*.go` (6 个文件，包括测试)
- `migrations/1736700000_create_analytics.go`

**Target Implementation**:
- `plugins/analytics/` (所有代码迁移至此)

**Testing**: Go test (单元测试 + 集成测试)  
**Performance Goals**: 维持现有性能指标，零回退  
**Constraints**: 纯重构，API 完全兼容，无功能变更

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 插件模式，编译时可选 |
| Zero External Dependencies | ✅ PASS | 无新增依赖 |
| Dual-Mode Storage | ✅ PASS | 保持 SQLite/PostgreSQL 双模支持 |
| Graceful Degradation | ✅ PASS | 未注册时返回 NoOp |
| Performance First | ✅ PASS | NoOp 零开销 |
| Backward Compatibility | ✅ PASS | API 完全兼容 |

## Project Structure

### Documentation (this feature)

```text
specs/023-analytics-plugin-refactor/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code Changes

```text
# 删除（原位置）
core/
├── analytics.go              # → plugins/analytics/analytics.go
├── analytics_event.go        # → plugins/analytics/event.go
├── analytics_buffer.go       # → plugins/analytics/buffer.go
├── analytics_flusher.go      # → plugins/analytics/flusher.go
├── analytics_repository.go   # → plugins/analytics/repository.go
├── analytics_repository_sqlite.go   # → plugins/analytics/repository_sqlite.go
├── analytics_repository_postgres.go # → plugins/analytics/repository_postgres.go
├── analytics_hll.go          # → plugins/analytics/hll.go
├── analytics_url.go          # → plugins/analytics/url.go
├── analytics_ua.go           # → plugins/analytics/ua.go
├── analytics_hooks.go        # → plugins/analytics/hooks.go
├── analytics_errors.go       # → plugins/analytics/errors.go
└── analytics_*_test.go       # → plugins/analytics/*_test.go

apis/
├── analytics.go              # → plugins/analytics/routes.go
├── analytics_events.go       # → plugins/analytics/handlers_events.go
├── analytics_stats.go        # → plugins/analytics/handlers_stats.go
└── analytics_*_test.go       # → plugins/analytics/*_test.go

# 新增（目标位置）
plugins/analytics/
├── register.go              # 新增：MustRegister/Register/GetAnalytics
├── config.go                # 新增：Config 结构体和环境变量解析
├── mode.go                  # 新增：AnalyticsMode 常量
├── noop.go                  # 新增：NoOp 实现
├── analytics.go             # 来自 core/analytics.go
├── event.go                 # 来自 core/analytics_event.go
├── buffer.go                # 来自 core/analytics_buffer.go
├── flusher.go               # 来自 core/analytics_flusher.go
├── repository.go            # 来自 core/analytics_repository.go
├── repository_sqlite.go     # 来自 core/analytics_repository_sqlite.go
├── repository_postgres.go   # 来自 core/analytics_repository_postgres.go
├── hll.go                   # 来自 core/analytics_hll.go
├── url.go                   # 来自 core/analytics_url.go
├── ua.go                    # 来自 core/analytics_ua.go
├── hooks.go                 # 来自 core/analytics_hooks.go
├── errors.go                # 来自 core/analytics_errors.go
├── routes.go                # 来自 apis/analytics.go
├── handlers_events.go       # 来自 apis/analytics_events.go
├── handlers_stats.go        # 来自 apis/analytics_stats.go
└── *_test.go                # 所有测试文件
```

### Integration Points

```text
# 需要修改
examples/base/main.go        # 添加 analytics 插件注册
core/base.go                 # 移除 Analytics 字段引用（如有）
core/app.go                  # 移除 Analytics() 方法（如有）

# 保持不变
jssdk/src/services/AnalyticsService.ts  # API 不变，无需修改
ui/src/components/analytics/*            # API 不变，无需修改
migrations/1736700000_create_analytics.go  # 保留，但改为可选注册
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PocketBase                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    core/ (保持精简)                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ App 接口    │  │ Collection  │  │ Record      │                  │   │
│  │  │ (无 Analytics│  │ Model       │  │ Model       │                  │   │
│  │  │  依赖)      │  │             │  │             │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    plugins/ (可插拔模块)                              │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    analytics/ (NEW)                              │ │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │ │   │
│  │  │  │ register.go │  │ config.go   │  │ noop.go     │              │ │   │
│  │  │  │ MustRegister│  │ Config{}    │  │ NoOp impl   │              │ │   │
│  │  │  │ GetAnalytics│  │ Env parse   │  │             │              │ │   │
│  │  │  └──────┬──────┘  └─────────────┘  └─────────────┘              │ │   │
│  │  │         │                                                        │ │   │
│  │  │         ▼                                                        │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │ │   │
│  │  │  │              Analytics Core                               │   │ │   │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │ │   │
│  │  │  │  │ buffer   │  │ flusher  │  │ hll      │  │ url/ua   │  │   │ │   │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │ │   │
│  │  │  └──────────────────────────────────────────────────────────┘   │ │   │
│  │  │                                                                  │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │ │   │
│  │  │  │              Repository Layer                             │   │ │   │
│  │  │  │  ┌───────────────┐        ┌───────────────┐              │   │ │   │
│  │  │  │  │ SQLite impl   │        │ PostgreSQL impl│              │   │ │   │
│  │  │  │  └───────────────┘        └───────────────┘              │   │ │   │
│  │  │  └──────────────────────────────────────────────────────────┘   │ │   │
│  │  │                                                                  │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │ │   │
│  │  │  │              HTTP Layer                                   │   │ │   │
│  │  │  │  ┌───────────────┐  ┌───────────────┐                    │   │ │   │
│  │  │  │  │ routes.go     │  │ handlers.go   │                    │   │ │   │
│  │  │  │  │ POST /events  │  │ GET /stats    │                    │   │ │   │
│  │  │  │  │ GET /top-*    │  │ GET /devices  │                    │   │ │   │
│  │  │  │  └───────────────┘  └───────────────┘                    │   │ │   │
│  │  │  └──────────────────────────────────────────────────────────┘   │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │ trace/          │  │ gateway/        │  │ jsvm/           │       │   │
│  │  │ (现有插件)       │  │ (现有插件)       │  │ (现有插件)       │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 遵循 trace 插件模式

参考 `plugins/trace/` 的实现：

```go
// plugins/analytics/register.go
package analytics

var (
    analyticsRegistry = make(map[core.App]Analytics)
    analyticsMu       sync.RWMutex
)

func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

func Register(app core.App, config Config) error {
    config = applyEnvOverrides(config)
    config = applyDefaults(config)
    
    var analytics Analytics
    if config.Mode == ModeOff {
        analytics = NewNoopAnalytics()
    } else {
        analytics = newAnalytics(app, config)
    }
    
    analyticsMu.Lock()
    analyticsRegistry[app] = analytics
    analyticsMu.Unlock()
    
    // 注册路由
    registerRoutes(app, analytics)
    
    // 注册清理钩子
    app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
        analytics.Close()
        return e.Next()
    })
    
    return nil
}

func GetAnalytics(app core.App) Analytics {
    analyticsMu.RLock()
    defer analyticsMu.RUnlock()
    if a, ok := analyticsRegistry[app]; ok {
        return a
    }
    return NewNoopAnalytics()
}
```

### 2. NoOp 模式实现零开销

```go
// plugins/analytics/noop.go
package analytics

type noopAnalytics struct{}

func NewNoopAnalytics() Analytics {
    return &noopAnalytics{}
}

func (n *noopAnalytics) Track(event *Event) error { return nil }
func (n *noopAnalytics) Flush()                   {}
func (n *noopAnalytics) Close() error             { return nil }
func (n *noopAnalytics) IsEnabled() bool          { return false }
```

### 3. 环境变量命名规范

遵循现有 trace 插件的命名模式：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_ANALYTICS_MODE` | 运行模式 | `conditional` |
| `PB_ANALYTICS_ENABLED` | 是否启用（向后兼容） | `true` |
| `PB_ANALYTICS_RETENTION` | 数据保留天数 | `90` |
| `PB_ANALYTICS_S3_BUCKET` | S3 桶名称 | `""` |
| `PB_ANALYTICS_FLUSH_INTERVAL` | 刷新间隔（秒） | `10` |
| `PB_ANALYTICS_MAX_RAW_SIZE` | Raw Buffer 最大容量 | `16777216` |

### 4. 迁移策略

采用"移动 + 重命名"策略，最小化代码修改：

1. **Step 1**: 创建 `plugins/analytics/` 目录
2. **Step 2**: 移动所有 `core/analytics*.go` 文件
3. **Step 3**: 移动所有 `apis/analytics*.go` 文件
4. **Step 4**: 更新 package 声明和 import 路径
5. **Step 5**: 添加 `register.go`, `config.go`, `mode.go`, `noop.go`
6. **Step 6**: 修改 `examples/base/main.go` 集成
7. **Step 7**: 删除 `core/` 和 `apis/` 中的原文件
8. **Step 8**: 更新 `CODEBUDDY.md` 文档

## Complexity Tracking

> 无违规项，纯重构操作，不引入新的复杂度。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Import 路径修改遗漏 | Medium | Medium | 使用 IDE 重构工具，运行完整测试 |
| API 端点路径变化 | Low | High | 严格测试所有 API 端点 |
| 性能回退 | Low | Medium | 运行 benchmark 对比 |
| 文档不同步 | Low | Low | 同步更新 CODEBUDDY.md |

## Dependencies

### 无新增依赖

本次重构不引入任何新的外部依赖，所有现有依赖保持不变：

- `github.com/parquet-go/parquet-go`
- `github.com/axiomhq/hyperloglog`
- `github.com/mssola/user_agent`
