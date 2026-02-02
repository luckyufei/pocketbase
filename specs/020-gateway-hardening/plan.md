# Implementation Plan: Production-Grade Gateway Hardening

**Branch**: `020-gateway-hardening` | **Date**: 2026-01-30 | **Updated**: 2026-02-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-gateway-hardening/spec.md`
**Prerequisites**: 019-gateway-refactor (COMPLETED)

## Summary

在 019-gateway-refactor 的基础上，为 PocketBase Gateway 添加**生产级**能力，对标 Nginx 的高性能和高可靠性。核心改进包括：精细化超时控制、连接池优化、并发限制、熔断保护、内存池优化、Prometheus 指标、**Admin UI 配置界面**。

## Technical Context

**Language/Version**: Go 1.24.0 (backend), TypeScript + React (frontend)  
**Primary Dependencies**: 
- `net/http` (Go 标准库)
- `github.com/pocketbase/pocketbase/plugins/gateway` (019 已完成)
- `sync` (内存池)
- `github.com/prometheus/client_golang` (可选，用于指标)
- React + TypeScript + TailwindCSS (ui-v2)

**Storage**: PostgreSQL / SQLite (`_proxies` 系统表)  
**Testing**: Go test (backend), 压力测试 (vegeta/wrk), Vitest (frontend)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Plugin Enhancement + Admin UI  
**Performance Goals**: 
- 连接复用率 > 90%
- P99 延迟 < 50ms (不含上游)
- GC 暂停 < 10ms

**Constraints**: 
- 保持向后兼容
- 不引入外部依赖（除可选的 prometheus client）
- 不破坏现有 019 功能

**Scale/Scope**: 单机部署, 1000+ 并发连接

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 所有功能编译进主二进制 |
| Zero External Dependencies | ⚠️ SOFT | Prometheus client 为可选依赖 |
| Secure by Default | ✅ PASS | 新配置项都有安全的默认值 |
| Plugin Architecture | ✅ PASS | 增强现有 Gateway Plugin |
| Backward Compatibility | ✅ PASS | 所有新字段有默认值 |

## Project Structure

### Documentation (this feature)

```text
specs/020-gateway-hardening/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# 新增/修改文件 - Backend
plugins/gateway/
├── transport.go         # HardenedTransport 配置 (NEW)
├── transport_test.go    # Transport 测试 (NEW)
├── limiter.go           # ConcurrencyLimiter (NEW)
├── limiter_test.go      # 限流器测试 (NEW)
├── circuit_breaker.go   # CircuitBreaker (NEW)
├── circuit_breaker_test.go # 熔断器测试 (NEW)
├── buffer_pool.go       # BytesPool (NEW)
├── buffer_pool_test.go  # 内存池测试 (NEW)
├── metrics.go           # MetricsCollector (NEW)
├── metrics_test.go      # 指标测试 (NEW)
├── config.go            # 更新，添加新配置字段 (MODIFY)
├── proxy.go             # 更新，集成新组件 (MODIFY)
├── routes.go            # 更新，添加 /metrics 路由 (MODIFY)
└── gateway.go           # 更新，初始化新组件 (MODIFY)

# 新增/修改文件 - Frontend (Admin UI)
ui-v2/src/
├── pages/gateway/
│   ├── index.tsx            # 代理配置列表页 (NEW)
│   ├── ProxyListPage.tsx    # 列表页组件 (NEW)
│   ├── ProxyDetailPage.tsx  # 详情/编辑页组件 (NEW)
│   └── components/
│       ├── ProxyCard.tsx        # 代理卡片组件 (NEW)
│       ├── ProxyForm.tsx        # 代理表单组件 (NEW)
│       ├── CircuitBreakerConfig.tsx  # 熔断配置面板 (NEW)
│       ├── TimeoutConfig.tsx    # 超时配置面板 (NEW)
│       └── AuthConfig.tsx       # 认证配置面板 (NEW)
├── services/
│   └── gateway.ts           # Gateway API 服务 (NEW)
└── hooks/
    └── useProxies.ts        # 代理数据 Hook (NEW)

# Migration
migrations/
└── 20250201045320_gateway_hardening.go  # _proxies 表扩展字段 (NEW)
```

**Structure Decision**: 
- Backend: 在现有 `plugins/gateway/` 目录中添加新文件，保持模块化
- Frontend: 在 `ui-v2/src/pages/gateway/` 创建专门的 Gateway 管理模块

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Request Flow (Hardened Gateway)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Incoming Request                                                       │
│        │                                                                │
│        ▼                                                                │
│  ┌─────────────────┐                                                    │
│  │ 1. Auth Check   │  ← 来自 019 (不变)                                  │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 2. Circuit Check│  ← 熔断检查 (NEW)                                   │
│  │    is Open?     │                                                    │
│  └────────┬────────┘                                                    │
│           │ No (Closed/HalfOpen)                                        │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 3. Concurrency  │  ← 并发限制 (NEW)                                   │
│  │    Limiter      │                                                    │
│  │    Acquire()    │                                                    │
│  └────────┬────────┘                                                    │
│           │ Acquired                                                    │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 4. Metrics Start│  ← 开始计时 (NEW)                                   │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 5. ReverseProxy │  ← 使用 HardenedTransport + BufferPool             │
│  │    ServeHTTP()  │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 6. Metrics End  │  ← 记录延迟和状态 (NEW)                             │
│  │    Circuit Update│ ← 更新熔断状态                                     │
│  │    Limiter Release│← 释放并发槽                                       │
│  └─────────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 分层架构 (Layered Architecture)

将增强功能分为五个独立层，每层可单独开关和测试：

| 层 | 组件 | 职责 | 默认状态 |
|---|------|------|---------|
| Resilience | HardenedTransport | 超时、连接池 | 启用 |
| Traffic Control | Limiter + CircuitBreaker | 保护后端 | 可选 |
| Optimization | BytesPool | 减少 GC | 启用 |
| Observability | Metrics + Logger | 监控 | 启用 |
| Admin Interface | ProxyListPage + ProxyDetailPage | 配置管理 | 启用 |

### 2. 零配置默认值

所有新功能都有合理的默认值，用户不修改任何配置也能获得改进：

```go
// 默认值
const (
    DefaultDialTimeout           = 2 * time.Second
    DefaultResponseHeaderTimeout = 30 * time.Second  // AI 场景需要
    DefaultIdleConnTimeout       = 90 * time.Second
    DefaultMaxIdleConns          = 1000
    DefaultMaxIdleConnsPerHost   = 100
    
    DefaultMaxConcurrent         = 0   // 0 = 不限制
    
    DefaultCircuitBreakerEnabled = false  // 需要显式启用
    DefaultFailureThreshold      = 5
    DefaultRecoveryTimeout       = 30 * time.Second
)
```

### 3. 向后兼容的配置扩展

`_proxies` 表新增字段使用 JSON 格式，方便扩展且不破坏现有记录：

```json
{
  // 现有字段保持不变
  "name": "openai",
  "target_url": "https://api.openai.com",
  
  // 新增字段（可选，有默认值）
  "max_concurrent": 0,
  "circuit_breaker": null,
  "timeout_config": null
}
```

### 4. 非侵入式集成

新组件通过**组合**而非**继承**集成到现有代码：

```go
// 在现有 ProxyHandler 外包装一层
func (p *gatewayPlugin) wrapHandler(
    handler http.Handler,
    limiter *ConcurrencyLimiter,
    breaker *CircuitBreaker,
    metrics *MetricsCollector,
) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. Circuit Breaker Check
        if breaker != nil && breaker.IsOpen() {
            writeCircuitOpenError(w)
            return
        }
        
        // 2. Concurrency Limit
        if limiter != nil && !limiter.Acquire() {
            writeTooManyRequestsError(w)
            return
        }
        defer func() {
            if limiter != nil {
                limiter.Release()
            }
        }()
        
        // 3. Metrics & Timing
        start := time.Now()
        rw := &responseWriter{ResponseWriter: w}
        
        // 4. Forward to original handler
        handler.ServeHTTP(rw, r)
        
        // 5. Update metrics & circuit breaker
        duration := time.Since(start)
        if metrics != nil {
            metrics.RecordRequest(rw.statusCode, duration)
        }
        if breaker != nil {
            breaker.RecordResult(rw.statusCode >= 500)
        }
    })
}
```

### 5. Prometheus 指标设计

使用标准 Prometheus 格式，支持 Grafana 开箱即用：

```go
type MetricsCollector struct {
    requestsTotal    *prometheus.CounterVec   // 总请求数
    errorsTotal      *prometheus.CounterVec   // 错误数（按类型）
    latencyHistogram *prometheus.HistogramVec // 延迟分布
    activeConns      *prometheus.GaugeVec     // 活跃连接数
    circuitState     *prometheus.GaugeVec     // 熔断状态
}
```

## Complexity Tracking

| 组件 | 复杂度 | 说明 |
|------|--------|------|
| HardenedTransport | Low | 纯配置，无逻辑 |
| ConcurrencyLimiter | Low | 简单 channel/semaphore |
| CircuitBreaker | Medium | 状态机，需要并发安全 |
| BytesPool | Low | 标准 sync.Pool 用法 |
| MetricsCollector | Medium | Prometheus 集成 |
| Handler 包装 | Medium | 集成所有组件 |
| ProxyListPage | Medium | 列表展示 + 状态显示 |
| ProxyDetailPage | High | 复杂表单 + 折叠面板 + 校验 |

> 总体复杂度可控，无架构违规。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 熔断误触发 | Medium | High | 保守默认值，需显式启用 |
| 并发限制过严 | Medium | Medium | 默认不限制，文档说明 |
| Prometheus 依赖问题 | Low | Low | 设为可选，提供无依赖版本 |
| 配置迁移兼容性 | Low | Medium | JSON 字段，nil 表示默认 |
| 性能测试不充分 | Medium | Medium | 专项压测阶段 |
| UI 配置错误导致故障 | Medium | High | 前端校验 + 后端校验双重保障 |
| 多管理员并发编辑冲突 | Low | Low | 乐观锁（updated 字段），冲突提示刷新 |

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Resilience (Transport) | 4 | 3h |
| Phase 2: Traffic Control | 8 | 6h |
| Phase 3: Optimization (BufferPool) | 3 | 2h |
| Phase 4: Observability | 6 | 4h |
| Phase 5: Admin UI | 10 | 8h |
| Phase 6: Integration & Testing | 7 | 6h |
| **Total** | **38** | **~29h** |

## Dependencies Graph

```
Phase 1 (Transport)
    │
    ├──▶ Phase 3 (BufferPool)  [可并行]
    │
    ▼
Phase 2 (Traffic Control)
    │
    ▼
Phase 4 (Observability)
    │
    ├──▶ Phase 5 (Admin UI)  [依赖 metrics API]
    │
    ▼
Phase 6 (Integration)
```

## Notes

- HardenedTransport 应在 Plugin 初始化时创建，全局共享
- CircuitBreaker 每个 Proxy 配置一个实例（不共享）
- ConcurrencyLimiter 每个 Proxy 配置一个实例（不共享）
- BytesPool 全局共享一个实例
- Metrics 路由应受认证保护（仅 admin 可访问）或配置允许公开
- 所有新增配置项都应有 `_test.go` 覆盖
- 压测阶段需要使用 `vegeta` 或 `wrk` 进行实际验证
- Admin UI 遵循项目苹果式黑白灰审美规范（参见 CODEBUDDY.md）
- UI 表单校验使用 zod 或类似库进行类型安全校验
