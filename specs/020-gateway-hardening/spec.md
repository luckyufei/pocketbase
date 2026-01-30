# Feature Specification: Production-Grade Gateway Hardening

**Feature Branch**: `020-gateway-hardening`  
**Created**: 2026-01-30  
**Status**: Ready for Dev  
**Input**: `specs/019-gateway-refactor/`, `specs/_research/260130-gateway.md`  
**Prerequisites**: 019-gateway-refactor (已完成)

## Background (背景)

### 问题陈述

019-gateway-refactor 已完成 Gateway 的**插件化**和**协议归一化**，实现了 "**能跑 (Functional)**"。但要达到 "**生产级 (Production-Ready)**" 对标 Nginx，还需要解决以下关键问题：

| 维度 | 当前状态 | Nginx 水平 | Gap |
|------|----------|-----------|-----|
| 超时控制 | 无精细化超时 | 多层超时机制 | ❌ 无 DialTimeout, ResponseHeaderTimeout |
| 连接池 | MaxIdleConnsPerHost=2 (默认) | 高度优化 | ❌ 高并发下全是短连接 |
| 流量控制 | 无 | limit_conn, limit_req | ❌ Python Sidecar 易被压垮 |
| 熔断保护 | 无 | 通过 upstream 实现 | ❌ 故障服务持续被攻击 |
| 内存管理 | 每请求分配 32KB | 高效复用 | ❌ GC 压力大 |
| 可观测性 | 基础日志 | access.log + metrics | ❌ 无 Prometheus 指标 |

### 目标

将 PocketBase Gateway 打造成**反脆弱 (Anti-Fragile)** 的生产级网关，在 AI 推理场景下甚至**超越 Nginx**（Goroutine 模型对长连接更友好）。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 精细化超时控制 (Priority: P0)

作为系统管理员，我希望网关能够精细控制各阶段超时，防止 Goroutine 无限堆积导致 OOM。

**Why this priority**: 超时控制是可靠性的基础，无超时的网关在上游故障时会导致级联失败。

**Independent Test**: 使用延迟服务验证各阶段超时行为。

**Acceptance Scenarios**:

1. **Given** 上游服务建连超过 2s, **When** 代理请求, **Then** 返回 `504 Gateway Timeout` 并释放连接
2. **Given** 上游服务响应首字节超过配置阈值, **When** 代理请求, **Then** 返回 `504` 并记录 TTFB 超时
3. **Given** AI 推理场景 (SSE), **When** 首字节延迟 30s, **Then** 正常等待（AI 特殊处理）
4. **Given** 空闲连接超过 90s, **When** 新请求到达, **Then** 自动建立新连接，旧连接被回收

---

### User Story 2 - 连接池优化 (Priority: P0)

作为系统管理员，我希望网关能够复用 TCP 连接，降低延迟并提升吞吐量。

**Why this priority**: 连接池是高性能的基础，Go 默认 `MaxIdleConnsPerHost=2` 在高并发下几乎等于禁用连接复用。

**Independent Test**: 连续发送 100 个请求到同一上游，验证连接复用。

**Acceptance Scenarios**:

1. **Given** 连续多次请求同一上游, **When** 使用优化后的 Transport, **Then** 连接复用率 > 90%
2. **Given** 并发 100 个请求到同一上游, **When** 同时发送, **Then** 最多建立 100 个连接（MaxIdleConnsPerHost）
3. **Given** 并发 200 个请求, **When** 同时发送, **Then** 总连接数不超过 1000（MaxIdleConns）
4. **Given** 连接池达到上限, **When** 新请求到达, **Then** 等待或新建临时连接，不报错

---

### User Story 3 - 并发限制 (Priority: P0)

作为系统管理员，我希望网关能够限制对脆弱后端（如 Python Sidecar）的并发数，防止后端被压垮。

**Why this priority**: Python AI 推理服务处理能力有限，无限制的并发会导致后端 OOM 或超时。

**Independent Test**: 配置并发限制为 10，发送 20 个并发请求，验证限流行为。

**Acceptance Scenarios**:

1. **Given** 配置 `max_concurrent: 10` 的代理, **When** 第 11 个请求到达, **Then** 返回 `429 Too Many Requests`
2. **Given** 配置 `max_concurrent: 10`, **When** 1 个请求完成, **Then** 第 11 个请求立即被处理
3. **Given** 启用排队模式, **When** 超过限制, **Then** 请求排队等待而非立即拒绝
4. **Given** 返回 429, **When** 客户端收到响应, **Then** 包含 `Retry-After` 头和 JSON 错误体

---

### User Story 4 - 熔断保护 (Priority: P1)

作为系统管理员，我希望网关在上游持续失败时自动熔断，给后端恢复时间。

**Why this priority**: 熔断是系统反脆弱性的核心，防止故障后端被持续攻击。

**Independent Test**: 模拟上游连续失败 5 次，验证熔断触发和恢复。

**Acceptance Scenarios**:

1. **Given** 上游连续 5 次返回 5xx, **When** 第 6 次请求, **Then** 直接返回 `503 Service Unavailable`，不发送实际请求
2. **Given** 熔断状态下, **When** 等待 30s 后, **Then** 允许一个探测请求通过（半开状态）
3. **Given** 半开状态探测成功, **When** 后续请求, **Then** 恢复正常转发
4. **Given** 熔断触发, **When** 返回 503, **Then** 响应头包含 `X-Circuit-Breaker: open`

---

### User Story 5 - 内存池优化 (Priority: P1)

作为系统管理员，我希望网关使用内存池减少 GC 压力，在高并发下保持稳定的延迟。

**Why this priority**: 每请求分配 32KB 在高并发下会产生大量 GC，导致延迟抖动。

**Independent Test**: 压测 1000 QPS，监控 GC 频率和 P99 延迟。

**Acceptance Scenarios**:

1. **Given** 使用 BufferPool, **When** 1000 QPS 压测, **Then** GC 暂停时间 < 10ms
2. **Given** 压测期间, **When** 监控 P99 延迟, **Then** 延迟抖动 < 20%
3. **Given** 使用 sync.Pool, **When** 检查内存分配, **Then** 缓冲区复用率 > 80%

---

### User Story 6 - 可观测性增强 (Priority: P2)

作为运维人员，我希望网关暴露 Prometheus 指标，便于监控和告警。

**Why this priority**: 生产环境需要完善的监控才能快速定位问题。

**Independent Test**: 请求 `/metrics` 接口，验证指标格式和内容。

**Acceptance Scenarios**:

1. **Given** 网关启动, **When** 请求 `/api/gateway/metrics`, **Then** 返回 Prometheus 格式指标
2. **Given** 代理 10 个请求, **When** 查看指标, **Then** `gateway_requests_total` 计数正确
3. **Given** 上游延迟 500ms, **When** 查看指标, **Then** `gateway_upstream_latency_seconds` 直方图正确
4. **Given** 发生 5xx 错误, **When** 查看指标, **Then** `gateway_errors_total{type="5xx"}` 计数正确

---

### Edge Cases

- **AI 推理超长等待**: 配置特殊的 `ResponseHeaderTimeout` 或使用 `0` 表示无限
- **大文件传输**: 使用流式传输，不缓冲完整响应体
- **WebSocket 升级**: 当前明确不支持，返回友好错误提示
- **上游返回非标准 HTTP**: 尽量容错，记录 warning 日志
- **内存池耗尽**: 回退到普通分配，记录 warning 日志

---

## Requirements *(mandatory)*

### Functional Requirements

**超时控制 (Resilience)**
- **FR-001**: Transport MUST 配置 `DialContext.Timeout: 2s` 用于建连超时
- **FR-002**: Transport MUST 配置 `ResponseHeaderTimeout` 用于首字节超时（可配置，默认 30s）
- **FR-003**: Transport MUST 配置 `IdleConnTimeout: 90s` 用于空闲连接回收
- **FR-004**: 对于 AI 推理路径，SHOULD 支持禁用 `ResponseHeaderTimeout`（设为 0）

**连接池 (Pooling)**
- **FR-005**: Transport MUST 配置 `MaxIdleConns: 1000` 总连接池大小
- **FR-006**: Transport MUST 配置 `MaxIdleConnsPerHost: 100` 单上游连接池大小
- **FR-007**: Transport SHOULD 启用 `ForceAttemptHTTP2: true` 优化 HTTPS 连接

**并发限制 (Concurrency)**
- **FR-008**: `_proxies` 表 MUST 新增 `max_concurrent` 字段（int, 默认 0 表示不限制）
- **FR-009**: 并发超限时 MUST 返回 `429 Too Many Requests` 和 JSON 错误体
- **FR-010**: 并发限制 MUST 使用 buffered channel 或 semaphore 实现
- **FR-011**: 429 响应 SHOULD 包含 `Retry-After` 头

**熔断保护 (Circuit Breaker)**
- **FR-012**: `_proxies` 表 SHOULD 新增 `circuit_breaker` JSON 字段（配置阈值）
- **FR-013**: 熔断状态 MUST 区分 `closed`, `open`, `half-open` 三种状态
- **FR-014**: 熔断触发条件 SHOULD 可配置（连续失败次数、失败率）
- **FR-015**: 熔断状态响应 MUST 包含 `X-Circuit-Breaker` 头

**内存池 (Memory)**
- **FR-016**: ReverseProxy MUST 实现 `BufferPool` 接口使用 `sync.Pool`
- **FR-017**: BufferPool MUST 使用 32KB 固定大小缓冲区

**可观测性 (Observability)**
- **FR-018**: Gateway MUST 暴露 `/api/gateway/metrics` Prometheus 指标端点
- **FR-019**: 指标 MUST 包含：`requests_total`, `errors_total`, `upstream_latency_seconds`
- **FR-020**: 指标 SHOULD 包含：`active_connections`, `circuit_breaker_state`
- **FR-021**: 结构化日志 MUST 包含 `upstream_latency` vs `proxy_latency` 区分

### Non-Functional Requirements

- **NFR-001**: 代理延迟开销不超过 5ms（不含上游响应时间）
- **NFR-002**: 连接复用率 > 90%（同一上游连续请求）
- **NFR-003**: 支持至少 1000 个并发代理连接
- **NFR-004**: GC 暂停时间 < 10ms（高并发下）
- **NFR-005**: P99 延迟抖动 < 20%（使用 BufferPool 后）
- **NFR-006**: 熔断恢复时间可配置，默认 30s

### Key Entities

- **HardenedTransport**: 优化后的共享 Transport，包含精细化超时和连接池配置
- **ConcurrencyLimiter**: 基于 semaphore 的并发限制器
- **CircuitBreaker**: 熔断器，管理三态转换
- **BytesPool**: 基于 sync.Pool 的缓冲区池
- **MetricsCollector**: Prometheus 指标收集器

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 连接复用率 > 90%（同一上游连续 100 请求）
- **SC-002**: 1000 QPS 压测下 P99 延迟 < 50ms（不含上游）
- **SC-003**: 1000 QPS 压测下 GC 暂停 < 10ms
- **SC-004**: 熔断触发后 30s 内自动恢复（上游恢复正常时）
- **SC-005**: 并发限制准确生效（不超过配置值 +1）
- **SC-006**: Prometheus 指标端点响应时间 < 50ms

---

## Technical Design

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PocketBase Gateway (Hardened)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Resilience Layer                              │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │  │
│  │  │ HardenedTransport│  │ ConcurrencyLimiter│ │ CircuitBreaker │   │  │
│  │  │ - DialTimeout:2s │  │ - Semaphore      │  │ - Closed       │   │  │
│  │  │ - TTFB:30s      │  │ - MaxConcurrent  │  │ - Open         │   │  │
│  │  │ - Idle:90s      │  │ - Blocking/429   │  │ - HalfOpen     │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Optimization Layer                            │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                      BytesPool (sync.Pool)                  │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │  │
│  │  │  │ [32KB]   │  │ [32KB]   │  │ [32KB]   │  │ [32KB]   │    │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Observability Layer                           │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐        │  │
│  │  │    MetricsCollector     │  │   Structured Logger     │        │  │
│  │  │ - requests_total       │  │ - upstream_latency      │        │  │
│  │  │ - errors_total         │  │ - proxy_latency         │        │  │
│  │  │ - latency_histogram    │  │ - circuit_state         │        │  │
│  │  │ - active_connections   │  │ - request_id            │        │  │
│  │  └─────────────────────────┘  └─────────────────────────┘        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Protocol Normalizer (from 019)                │  │
│  │  - StripGzip, RewriteHost, CleanHopByHop, FlushInterval          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │   Upstream Services       │
                    │  - Python Sidecar (Agno)  │
                    │  - OpenAI API             │
                    │  - Claude API             │
                    └───────────────────────────┘
```

### HardenedTransport 配置

```go
// 生产级 Transport 配置
var hardenedTransport = &http.Transport{
    Proxy: http.ProxyFromEnvironment,
    DialContext: (&net.Dialer{
        Timeout:   2 * time.Second,   // 建连超时：内网要快
        KeepAlive: 30 * time.Second,  // TCP KeepAlive
    }).DialContext,
    ForceAttemptHTTP2:     true,
    MaxIdleConns:          1000,              // 总连接池
    MaxIdleConnsPerHost:   100,               // 关键：单上游连接池大小
    IdleConnTimeout:       90 * time.Second,  // 空闲回收
    TLSHandshakeTimeout:   5 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
    // ResponseHeaderTimeout: 0,  // AI 场景流式响应首字可能很慢
}
```

### ConcurrencyLimiter 实现

```go
type ConcurrencyLimiter struct {
    sem chan struct{}
}

func NewConcurrencyLimiter(max int) *ConcurrencyLimiter {
    if max <= 0 {
        return nil // 不限制
    }
    return &ConcurrencyLimiter{sem: make(chan struct{}, max)}
}

func (l *ConcurrencyLimiter) Acquire() bool {
    if l == nil {
        return true
    }
    select {
    case l.sem <- struct{}{}:
        return true
    default:
        return false // 超过限制
    }
}

func (l *ConcurrencyLimiter) Release() {
    if l != nil {
        <-l.sem
    }
}
```

### CircuitBreaker 状态机

```
        ┌──────────────────────────────────────────────┐
        │                                              │
        ▼                                              │
    ┌────────┐    连续 N 次失败    ┌────────┐          │
    │ Closed │ ─────────────────▶ │  Open  │          │
    │(正常)   │                    │(熔断)   │          │
    └────────┘                    └────────┘          │
        ▲                              │              │
        │                              │ 等待 T 秒     │
        │                              ▼              │
        │                        ┌─────────┐         │
        │    探测成功              │Half-Open│         │
        └────────────────────────│ (试探)   │─────────┘
                                 └─────────┘   探测失败
```

### `_proxies` 表扩展字段

```json
{
  "max_concurrent": 20,          // 最大并发数，0 表示不限制
  "circuit_breaker": {
    "enabled": true,
    "failure_threshold": 5,      // 连续失败次数触发熔断
    "recovery_timeout": 30,      // 熔断恢复时间（秒）
    "half_open_requests": 1      // 半开状态允许的探测请求数
  },
  "timeout": {
    "dial": 2,                   // 建连超时（秒）
    "response_header": 30,       // 首字节超时（秒），0 表示不限制
    "idle": 90                   // 空闲连接超时（秒）
  }
}
```

### Prometheus 指标定义

```prometheus
# HELP gateway_requests_total Total number of proxy requests
# TYPE gateway_requests_total counter
gateway_requests_total{proxy="openai",status="2xx"} 1234
gateway_requests_total{proxy="openai",status="5xx"} 5

# HELP gateway_upstream_latency_seconds Upstream response latency
# TYPE gateway_upstream_latency_seconds histogram
gateway_upstream_latency_seconds_bucket{proxy="openai",le="0.1"} 100
gateway_upstream_latency_seconds_bucket{proxy="openai",le="0.5"} 500

# HELP gateway_active_connections Current active connections per proxy
# TYPE gateway_active_connections gauge
gateway_active_connections{proxy="openai"} 42

# HELP gateway_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)
# TYPE gateway_circuit_breaker_state gauge
gateway_circuit_breaker_state{proxy="sidecar"} 0
```

---

## Migration Plan

### Phase 1: Resilience Layer (超时 + 连接池)

1. 创建 `plugins/gateway/transport.go`，实现 HardenedTransport
2. 更新 `plugins/gateway/proxy.go`，使用新 Transport
3. 添加超时相关配置字段解析
4. 编写单元测试验证超时行为

### Phase 2: Traffic Control (并发限制 + 熔断)

1. 创建 `plugins/gateway/limiter.go`，实现 ConcurrencyLimiter
2. 创建 `plugins/gateway/circuit_breaker.go`，实现 CircuitBreaker
3. 扩展 `_proxies` 表字段（通过 migration）
4. 编写单元测试验证限流和熔断行为

### Phase 3: Optimization Layer (内存池)

1. 创建 `plugins/gateway/buffer_pool.go`，实现 BytesPool
2. 更新 ReverseProxy 配置使用 BufferPool
3. 压测验证 GC 改善效果

### Phase 4: Observability Layer (指标)

1. 创建 `plugins/gateway/metrics.go`，实现 MetricsCollector
2. 注册 `/api/gateway/metrics` 路由
3. 更新请求处理流程记录指标
4. 增强结构化日志

### Phase 5: 集成测试

1. 压测验证各项性能指标
2. 故障注入测试熔断行为
3. 长时间稳定性测试

---

## Assumptions

- 019-gateway-refactor 已完成并稳定
- `_proxies` 表可以安全扩展新字段
- Prometheus 格式是监控系统的标准
- Python Sidecar 的合理并发上限约为 10-50

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 熔断阈值配置不当导致误触发 | Medium | High | 提供保守的默认值，文档说明调优方法 |
| 并发限制导致正常请求被拒绝 | Medium | Medium | 默认不限制，需显式配置 |
| 内存池在极端情况下不释放 | Low | Low | sync.Pool 自带 GC 回收机制 |
| Prometheus 指标采集影响性能 | Low | Low | 使用 atomic 计数器，采样直方图 |
| 新增配置字段的向后兼容 | Low | Medium | 所有新字段都有默认值 |

---

## References

- Original Spec: `specs/019-gateway-refactor/`
- Research: `specs/_research/260130-gateway.md`
- Go httputil.ReverseProxy: https://pkg.go.dev/net/http/httputil#ReverseProxy
- Netflix Hystrix (Circuit Breaker Pattern): https://github.com/Netflix/Hystrix
- Prometheus Go Client: https://github.com/prometheus/client_golang
