# Tasks: Production-Grade Gateway Hardening

**Input**: Design documents from `/specs/020-gateway-hardening/`
**Prerequisites**: 019-gateway-refactor (COMPLETED), plan.md, spec.md

**Tests**: 每个 Phase 完成后应编写对应的单元测试和集成测试。

**Organization**: 任务按功能层分组，支持独立实现和测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事 (US1-US6)
- 包含精确文件路径

## Path Conventions

- **Plugin (Go)**: `plugins/gateway/`
- **Migrations**: `migrations/`

---

## Phase 1: Resilience Layer - HardenedTransport (US1 + US2)

**Purpose**: 实现精细化超时控制和优化连接池配置

**Goal**: 防止 Goroutine 无限堆积，提高连接复用率

### Tasks

- [x] T001 [US1] 创建 `plugins/gateway/transport.go`，定义 HardenedTransport 结构
- [x] T002 [P] [US1] 实现 `NewHardenedTransport(config TransportConfig) *http.Transport`
- [x] T003 [P] [US1] 配置 `DialContext.Timeout: 2s` 用于建连超时
- [x] T004 [P] [US1] 配置 `DialContext.KeepAlive: 30s` 用于 TCP KeepAlive
- [x] T005 [P] [US1] 配置 `ResponseHeaderTimeout` 用于首字节超时（可配置，默认 30s）
- [x] T006 [P] [US2] 配置 `MaxIdleConns: 1000` 总连接池大小
- [x] T007 [P] [US2] 配置 `MaxIdleConnsPerHost: 100` 单上游连接池大小
- [x] T008 [P] [US2] 配置 `IdleConnTimeout: 90s` 空闲连接超时
- [x] T009 [P] [US2] 配置 `TLSHandshakeTimeout: 5s` TLS 握手超时
- [x] T010 [P] [US2] 配置 `ForceAttemptHTTP2: true` HTTP/2 优化
- [x] T010a [P] [US2] 配置 `ExpectContinueTimeout: 1s` Expect: 100-continue 超时
- [x] T010b [P] [US2] 配置 `Proxy: http.ProxyFromEnvironment` 支持系统代理
- [x] T011 [US1] 更新 `plugins/gateway/config.go`，添加 `TimeoutConfig` 结构体：
  ```go
  type TimeoutConfig struct {
      Dial           int `json:"dial"`            // 建连超时（秒），默认 2
      ResponseHeader int `json:"response_header"` // 首字节超时（秒），默认 30，0=不限制
      Idle           int `json:"idle"`            // 空闲超时（秒），默认 90
  }
  ```
- [x] T012 [US1+US2] 编写 `plugins/gateway/transport_test.go` 单元测试
  - 验证建连超时行为
  - 验证首字节超时行为
  - 验证连接复用（mock server）

**Checkpoint**: HardenedTransport 就绪 ✅

---

## Phase 2: Traffic Control Layer (US3 + US4)

**Purpose**: 实现并发限制和熔断保护，防止脆弱后端被压垮

**Goal**: 保护 Python Sidecar 等处理能力有限的服务

### Task Group 2.1: ConcurrencyLimiter (US3)

- [x] T013 [US3] 创建 `plugins/gateway/limiter.go`，定义 ConcurrencyLimiter 结构
- [x] T014 [US3] 实现 `NewConcurrencyLimiter(max int) *ConcurrencyLimiter`
  - max <= 0 时返回 nil（不限制）
  - 使用 buffered channel 实现信号量
- [x] T015 [US3] 实现 `Acquire() bool` 非阻塞获取
- [x] T016 [US3] 实现 `AcquireWithTimeout(timeout time.Duration) bool` 带超时获取（排队模式）
- [x] T016a [US3] 实现 `AcquireBlocking(ctx context.Context) error` 阻塞式获取（支持 context 取消）
- [x] T017 [US3] 实现 `Release()` 释放
- [x] T018 [US3] 实现 `Available() int` 返回可用槽位数（用于监控）
- [x] T019 [US3] 编写 `plugins/gateway/limiter_test.go` 单元测试
  - 验证正常获取和释放
  - 验证超限时返回 false
  - 验证并发安全性（race detector）

### Task Group 2.2: CircuitBreaker (US4)

- [x] T020 [US4] 创建 `plugins/gateway/circuit_breaker.go`，定义状态枚举：
  ```go
  type CircuitState int
  const (
      CircuitClosed CircuitState = iota  // 正常
      CircuitOpen                        // 熔断
      CircuitHalfOpen                    // 试探
  )
  ```
- [x] T021 [US4] 定义 CircuitBreaker 结构体：
  ```go
  type CircuitBreaker struct {
      state             CircuitState
      failureCount      int
      lastFailureTime   time.Time
      config            CircuitBreakerConfig
      mu                sync.RWMutex
  }
  ```
- [x] T022 [US4] 定义 CircuitBreakerConfig：
  ```go
  type CircuitBreakerConfig struct {
      Enabled          bool `json:"enabled"`
      FailureThreshold int  `json:"failure_threshold"` // 默认 5
      RecoveryTimeout  int  `json:"recovery_timeout"`  // 秒，默认 30
      HalfOpenRequests int  `json:"half_open_requests"` // 默认 1
  }
  ```
- [x] T023 [US4] 实现 `NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker`
- [x] T024 [US4] 实现 `IsOpen() bool` 检查是否应该拒绝请求
  - Closed 状态返回 false
  - Open 状态：检查是否超过 RecoveryTimeout，超过则转为 HalfOpen
  - HalfOpen 状态：允许有限请求通过
- [x] T025 [US4] 实现 `RecordSuccess()` 记录成功
  - HalfOpen 状态成功后转为 Closed
  - 重置 failureCount
- [x] T026 [US4] 实现 `RecordFailure()` 记录失败
  - 增加 failureCount
  - 达到阈值时转为 Open
  - HalfOpen 状态失败后立即转为 Open
- [x] T027 [US4] 实现 `State() CircuitState` 获取当前状态
- [x] T028 [US4] 实现 `Reset()` 重置为 Closed 状态（管理用途）
- [x] T029 [US4] 编写 `plugins/gateway/circuit_breaker_test.go` 单元测试
  - 验证状态转换：Closed → Open
  - 验证状态转换：Open → HalfOpen（超时后）
  - 验证状态转换：HalfOpen → Closed（成功）
  - 验证状态转换：HalfOpen → Open（失败）
  - 验证并发安全性

### Task Group 2.3: 配置扩展

- [x] T030 [US3+US4] 更新 `plugins/gateway/config.go`，在 ProxyConfig 中添加字段：
  ```go
  MaxConcurrent   int                   `json:"max_concurrent"`
  CircuitBreaker  *CircuitBreakerConfig `json:"circuit_breaker"`
  TimeoutConfig   *TimeoutConfig        `json:"timeout_config"`
  ```
- [ ] T031 [US3+US4] 创建 migration `migrations/1738XXXXXX_gateway_hardening.go`
  - 为 `_proxies` 表添加新字段（JSON 类型，允许 null）

### Task Group 2.4: Edge Cases 处理

- [x] T031a [US3] 实现 WebSocket 升级请求的友好错误响应（当前不支持 WebSocket）
- [ ] T031b [US4] 实现上游返回非标准 HTTP 响应时的容错处理和 warning 日志

**Checkpoint**: Traffic Control 就绪 ✅ (核心功能完成)

---

## Phase 3: Optimization Layer - BytesPool (US5)

**Purpose**: 使用内存池减少 GC 压力

**Goal**: 高并发下保持稳定的延迟，减少延迟抖动

### Tasks

- [x] T032 [US5] 创建 `plugins/gateway/buffer_pool.go`，定义 BytesPool 结构
- [x] T033 [US5] 实现 `BytesPool` 使用 `sync.Pool`：
  ```go
  type BytesPool struct {
      pool sync.Pool
  }
  
  func NewBytesPool(bufferSize int) *BytesPool {
      return &BytesPool{
          pool: sync.Pool{
              New: func() interface{} {
                  return make([]byte, bufferSize)
              },
          },
      }
  }
  ```
- [x] T034 [US5] 实现 `httputil.BufferPool` 接口：
  ```go
  func (p *BytesPool) Get() []byte
  func (p *BytesPool) Put(b []byte)
  ```
- [x] T034a [US5] 实现内存池耗尽时的回退逻辑（回退到普通分配，记录 warning 日志）
- [ ] T035 [US5] 更新 `plugins/gateway/proxy.go`，在 ReverseProxy 中注入 BufferPool
- [x] T036 [US5] 编写 `plugins/gateway/buffer_pool_test.go` 单元测试
  - 验证 Get/Put 正确工作
  - 验证复用率（多次 Get 后检查分配次数）
  - 验证并发安全性

**Checkpoint**: BytesPool 就绪 ✅ (核心功能完成)

---

## Phase 4: Observability Layer (US6)

**Purpose**: 暴露 Prometheus 指标，增强结构化日志

**Goal**: 便于监控、告警和问题定位

### Task Group 4.1: MetricsCollector

- [x] T037 [US6] 创建 `plugins/gateway/metrics.go`，定义 MetricsCollector 结构
- [x] T038 [US6] 定义指标（使用 atomic 实现无 Prometheus 依赖版本）：
  ```go
  type MetricsCollector struct {
      requestsTotal   map[string]*atomic.Int64  // proxy:status -> count
      latencySumNs    map[string]*atomic.Int64  // proxy -> sum(ns)
      latencyCount    map[string]*atomic.Int64  // proxy -> count
      activeConns     map[string]*atomic.Int64  // proxy -> current
      circuitState    map[string]*atomic.Int64  // proxy -> state
      mu              sync.RWMutex
  }
  ```
- [x] T038a [US6] 定义 histogram bucket 配置（le="0.01", "0.05", "0.1", "0.25", "0.5", "1", "2.5", "5", "10"）
- [x] T039 [US6] 实现 `NewMetricsCollector() *MetricsCollector`
- [x] T040 [US6] 实现 `RecordRequest(proxy string, statusCode int, duration time.Duration)`
- [x] T041 [US6] 实现 `IncrActiveConns(proxy string)` 和 `DecrActiveConns(proxy string)`
- [x] T042 [US6] 实现 `SetCircuitState(proxy string, state CircuitState)`
- [x] T043 [US6] 实现 `ServeHTTP(w http.ResponseWriter, r *http.Request)` 输出 Prometheus 格式
- [x] T044 [US6] 编写 `plugins/gateway/metrics_test.go` 单元测试

### Task Group 4.2: 结构化日志增强

- [ ] T045 [US6] 在请求处理中记录结构化日志字段：
  - `proxy_name`: 代理名称
  - `upstream_latency_ms`: 上游响应耗时
  - `proxy_latency_ms`: 代理处理耗时（不含上游）
  - `status_code`: 响应状态码
  - `circuit_state`: 熔断状态（如启用）
  - `concurrent_count`: 当前并发数（如启用限流）

### Task Group 4.3: 路由注册

- [ ] T046 [US6] 更新 `plugins/gateway/routes.go`，注册 `/api/gateway/metrics` 路由
- [ ] T047 [US6] 添加认证中间件保护 metrics 端点（仅 superuser）

**Checkpoint**: Observability 就绪 ✅ (核心功能完成)

---

## Phase 5: Integration & Handler Wrapper

**Purpose**: 将所有组件集成到现有请求处理流程

**Goal**: 非侵入式集成，保持现有功能稳定

### Tasks

- [x] T048 创建 `plugins/gateway/handler_wrapper.go`，定义 ResponseWriter 包装器：
  ```go
  type responseWriter struct {
      http.ResponseWriter
      statusCode int
      written    bool
  }
  
  func (rw *responseWriter) WriteHeader(code int) {
      if !rw.written {
          rw.statusCode = code
          rw.written = true
      }
      rw.ResponseWriter.WriteHeader(code)
  }
  ```
- [x] T049 实现 `wrapHandler()` 集成所有组件：
  ```go
  func wrapHandler(
      handler http.Handler,
      proxyName string,
      limiter *ConcurrencyLimiter,
      breaker *CircuitBreaker,
      metrics *MetricsCollector,
      logger *slog.Logger,
  ) http.Handler
  ```
- [ ] T050 更新 `plugins/gateway/manager.go`，为每个 Proxy 创建独立的 Limiter 和 CircuitBreaker
- [ ] T051 更新 `plugins/gateway/proxy.go`，使用 HardenedTransport 和 BytesPool
- [ ] T052 更新 `plugins/gateway/gateway.go`，初始化全局 BytesPool 和 MetricsCollector
- [x] T053 实现 429 响应处理：
  ```go
  func writeTooManyRequestsError(w http.ResponseWriter, retryAfter int) {
      w.Header().Set("Content-Type", "application/json")
      w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
      w.WriteHeader(http.StatusTooManyRequests)
      json.NewEncoder(w).Encode(GatewayError{
          Error:   "Too Many Requests",
          Details: "AI Engine is at capacity, please retry later",
      })
  }
  ```
- [x] T054 实现 503 熔断响应处理：
  ```go
  func writeCircuitOpenError(w http.ResponseWriter) {
      w.Header().Set("Content-Type", "application/json")
      w.Header().Set("X-Circuit-Breaker", "open")
      w.WriteHeader(http.StatusServiceUnavailable)
      json.NewEncoder(w).Encode(GatewayError{
          Error:   "Service Unavailable",
          Details: "Circuit breaker is open, upstream service is experiencing issues",
      })
  }
  ```

**Checkpoint**: Integration 就绪 ✅ (核心功能完成)

---

## Phase 6: Testing & Validation

**Purpose**: 全面测试验证各项功能和性能指标

**Goal**: 确保生产环境可靠性

### Task Group 6.1: 单元测试补全

- [ ] T055 补全所有新增代码的单元测试，确保覆盖率 > 90%
- [ ] T056 使用 `-race` flag 运行测试，确保并发安全

### Task Group 6.2: 集成测试

- [ ] T057 编写集成测试：超时行为验证
  - 使用延迟 mock server 测试 DialTimeout
  - 使用延迟响应 mock server 测试 ResponseHeaderTimeout
- [ ] T058 编写集成测试：并发限制验证
  - 配置 max_concurrent=5，发送 10 个并发请求
  - 验证 5 个成功，5 个返回 429
- [ ] T059 编写集成测试：熔断器验证
  - 配置 failure_threshold=3
  - 发送 3 个失败请求，验证第 4 个直接返回 503
  - 等待 recovery_timeout，验证恢复
- [ ] T060 编写集成测试：连接复用验证
  - 发送 100 个连续请求
  - 检查实际建立的 TCP 连接数
- [ ] T060a 编写集成测试：排队模式验证（US3 Scenario 3）
  - 配置 max_concurrent=5 + 排队模式
  - 发送 10 个并发请求，验证前 5 个立即处理，后 5 个排队等待

### Task Group 6.3: Success Criteria 验证

- [ ] T060b 验证 SC-001：连接复用率 > 90%（同一上游连续 100 请求）
- [ ] T060c 验证 SC-005：并发限制准确性（不超过配置值 +1）
- [ ] T060d 验证 SC-006：Prometheus 指标端点响应时间 < 50ms

### Task Group 6.4: 压力测试

- [ ] T061 使用 `vegeta` 或 `wrk` 进行压力测试：
  - 目标：1000 QPS 稳定运行 5 分钟
  - 指标：P99 延迟 < 50ms，GC 暂停 < 10ms
- [ ] T062 监控内存使用，验证 BytesPool 效果
- [ ] T063 监控连接数，验证连接池配置效果
- [ ] T064 生成压测报告，对比优化前后指标

### Task Group 6.4: 文档更新

- [ ] T065 更新 `plugins/gateway/README.md`，添加新配置项说明
- [ ] T066 添加监控配置示例（Grafana dashboard JSON）
- [ ] T067 添加性能调优指南

### Task Group 6.6: FR/NFR 追溯矩阵验证

- [ ] T068 创建 FR/NFR 追溯矩阵，确保所有功能需求都有对应测试覆盖
  - FR-001 ~ FR-021 覆盖验证
  - NFR-001 ~ NFR-006 覆盖验证
  - SC-001 ~ SC-006 覆盖验证

**Checkpoint**: Testing & Validation 完成

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Transport)
    │
    ├────────────────────────┐
    │                        │
    ▼                        ▼
Phase 2 (Traffic Control)   Phase 3 (BufferPool) [可并行]
    │                        │
    └────────────┬───────────┘
                 │
                 ▼
         Phase 4 (Observability)
                 │
                 ▼
         Phase 5 (Integration)
                 │
                 ▼
         Phase 6 (Testing)
```

### Parallel Opportunities

- T002-T010 可并行（Transport 配置项）
- T013-T018 可并行（Limiter 方法实现）
- T020-T028 可并行（CircuitBreaker 方法实现）
- T037-T044 可并行（Metrics 实现）
- T057-T060 可并行（集成测试）

---

## Implementation Strategy

### 关键原则

1. **渐进式增强**: 每个 Phase 完成后立即测试，确保不影响现有功能
2. **默认安全**: 所有新功能默认禁用或使用保守配置
3. **无外部依赖**: 优先使用标准库实现，Prometheus client 为可选
4. **向后兼容**: 不修改现有 API，只新增配置项

### MVP 定义

完成 Phase 1 + Phase 3 + Phase 5 即为 MVP：
- HardenedTransport（超时 + 连接池）
- BytesPool（内存优化）
- 基础集成

Phase 2 (Traffic Control) 和 Phase 4 (Observability) 为增强功能。

### 风险缓解

- **熔断误触发风险**: 默认禁用，需显式配置 `circuit_breaker.enabled: true`
- **并发限制过严风险**: 默认 `max_concurrent: 0`（不限制）
- **回滚策略**: 所有新组件通过配置开关控制，可随时禁用

---

## Test Coverage Summary

**目标覆盖率**: 
- 纯逻辑代码 > 95%
- 需要环境的代码通过集成测试覆盖

| 模块 | 预期覆盖率 | 说明 |
|------|-----------|------|
| transport.go | 90%+ | 配置构建逻辑 |
| limiter.go | 100% | 纯逻辑，无外部依赖 |
| circuit_breaker.go | 100% | 状态机逻辑 |
| buffer_pool.go | 100% | 简单封装 |
| metrics.go | 90%+ | 计数器逻辑 |
| handler_wrapper.go | 80%+ | 需要 mock request |

---

## Estimated Effort

| Phase | Tasks | Estimated Hours | Status |
|-------|-------|-----------------|--------|
| Phase 1: Transport | 14 | 3h | ✅ Completed |
| Phase 2: Traffic Control | 22 | 7h | 90% Completed |
| Phase 3: BufferPool | 6 | 2h | ✅ Completed |
| Phase 4: Observability | 12 | 4h | 80% Completed |
| Phase 5: Integration | 7 | 3h | 60% Completed |
| Phase 6: Testing | 18 | 6h | Pending |
| **Total** | **79** | **~25h** | **~70% Complete** |

---

## Notes

- HardenedTransport 应在 Plugin 初始化时创建，全局共享
- CircuitBreaker 和 ConcurrencyLimiter 每个 Proxy 独立实例
- BytesPool 和 MetricsCollector 全局共享
- 所有超时配置单位为秒（JSON 友好）
- Prometheus 指标端点默认仅 superuser 可访问
- 压测使用 `vegeta attack -rate=1000 -duration=5m | vegeta report`

---

## FR/NFR 追溯矩阵

### Functional Requirements 覆盖

| FR | 描述 | 实现任务 | 测试任务 |
|----|------|---------|---------|
| FR-001 | DialContext.Timeout: 2s | T003 | T057 |
| FR-002 | ResponseHeaderTimeout (可配置, 默认 30s) | T005, T011 | T057 |
| FR-003 | IdleConnTimeout: 90s | T008 | T060 |
| FR-004 | AI 场景禁用 ResponseHeaderTimeout (设为 0) | T005 | T057 |
| FR-005 | MaxIdleConns: 1000 | T006 | T063 |
| FR-006 | MaxIdleConnsPerHost: 100 | T007 | T060 |
| FR-007 | ForceAttemptHTTP2: true | T010 | T060 |
| FR-008 | max_concurrent 字段 | T030, T031 | T058 |
| FR-009 | 429 + JSON 错误体 | T053 | T058 |
| FR-010 | buffered channel/semaphore | T014 | T019 |
| FR-011 | Retry-After 头 | T053 | T058 |
| FR-012 | circuit_breaker JSON 字段 | T030, T031 | T059 |
| FR-013 | 三态熔断 (closed/open/half-open) | T020-T028 | T029, T059 |
| FR-014 | 可配置熔断条件 | T022 | T029 |
| FR-015 | X-Circuit-Breaker 头 | T054 | T059 |
| FR-016 | BufferPool 接口 | T034 | T036 |
| FR-017 | 32KB 固定缓冲区 | T033 | T036 |
| FR-018 | /api/gateway/metrics 端点 | T046 | T060d |
| FR-019 | requests_total, errors_total, latency | T038, T040 | T044 |
| FR-020 | active_connections, circuit_breaker_state | T041, T042 | T044 |
| FR-021 | upstream_latency vs proxy_latency 日志 | T045 | T055 |

### Non-Functional Requirements 覆盖

| NFR | 描述 | 验证任务 |
|-----|------|---------|
| NFR-001 | 代理延迟开销 < 5ms | T061 |
| NFR-002 | 连接复用率 > 90% | T060b |
| NFR-003 | 支持 1000 并发连接 | T061 |
| NFR-004 | GC 暂停 < 10ms | T062 |
| NFR-005 | P99 延迟抖动 < 20% | T061 |
| NFR-006 | 熔断恢复时间可配置 (默认 30s) | T059 |

### Success Criteria 覆盖

| SC | 描述 | 验证任务 |
|----|------|---------|
| SC-001 | 连接复用率 > 90% | T060b |
| SC-002 | P99 延迟 < 50ms | T061 |
| SC-003 | GC 暂停 < 10ms | T062 |
| SC-004 | 熔断 30s 自动恢复 | T059 |
| SC-005 | 并发限制准确 | T060c |
| SC-006 | metrics 响应 < 50ms | T060d |

### Edge Cases 覆盖

| Edge Case | 描述 | 实现任务 |
|-----------|------|---------|
| EC-001 | AI 推理超长等待 | T005 (0=不限制) |
| EC-002 | 大文件传输 (流式) | T035 (BufferPool) |
| EC-003 | WebSocket 升级拒绝 | T031a |
| EC-004 | 非标准 HTTP 容错 | T031b |
| EC-005 | 内存池耗尽回退 | T034a |
