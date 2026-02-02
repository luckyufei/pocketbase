# Feature Specification: Observability Plugin 重构

**Feature Branch**: `019-observability-plugin-refactor`  
**Created**: 2026-02-02  
**Status**: Draft  
**Depends On**: 无（项目未上线，直接替换现有实现）

## 1. Problem Essence (核心问题)

当前 `009-unified-observability` 的实现存在以下架构问题：

### 1.1 当前问题

1. **内置耦合**: Trace 功能直接内置到 `core/` 包中，违背了 PocketBase 的插件化设计原则
2. **默认开启**: 追踪功能默认启用，对于不需要此功能的用户造成不必要的性能开销
3. **配置粒度粗**: 只支持全量开启/关闭，缺少按条件采集的能力（如仅采集异常、慢请求、VIP 用户）
4. **中间件耦合**: HTTP 追踪中间件固定注册，无法灵活控制

### 1.2 目标架构

将 Observability 实现为**可插拔插件**，遵循 PocketBase 现有插件模式（如 `jsvm`、`migratecmd`、`tofauth`）：

```go
// 显式注册，默认不启用
trace.MustRegister(app, trace.Config{
    Mode: trace.ModeConditional,
    Filters: []trace.Filter{
        trace.ErrorOnly(),           // 仅采集错误
        trace.SlowRequest(100*time.Millisecond), // 慢请求
        trace.DyedUser(),            // 染色用户
    },
})
```

**核心理念**: "Opt-in, Not Opt-out" (选择加入，而非选择退出)

> **注意**: 项目未上线，无需考虑向后兼容，直接删除 `core/` 中现有的 trace 实现，重新在 `plugins/trace/` 中实现。

## 2. Design Principles (设计原则)

### 2.1 PocketBase 插件规范

| 原则 | 说明 | 本方案合规性 |
|------|------|-------------|
| **显式注册** | 通过 `MustRegister`/`Register` 函数注册 | ✅ |
| **Config 结构体** | 使用 Config 结构体传递配置 | ✅ |
| **零依赖默认** | 不注册则无任何开销 | ✅ |
| **环境变量支持** | 支持从环境变量读取配置 | ✅ |
| **静默降级** | 配置缺失时静默跳过 | ✅ |

### 2.2 性能影响对比

| 场景 | 当前实现 | 重构后 |
|------|---------|--------|
| **不需要追踪** | ~3-5μs/请求（默认开启） | 0（不注册无开销） |
| **仅采集错误** | 全量采集（浪费资源） | 仅错误请求采集 |
| **VIP 用户追踪** | 不支持 | 按用户条件采集 |

---

## 3. User Scenarios & Testing *(mandatory)*

### User Story 1 - 插件注册（默认关闭）(Priority: P1)

作为开发者，我希望 Observability 默认不启用，只有显式注册后才生效，以便在不需要时避免性能开销。

**Why this priority**: 这是架构重构的核心目标，确保零开销默认行为。

**Independent Test**: 不注册插件时，验证没有任何追踪逻辑执行。

**Acceptance Scenarios**:

1. **Given** 未注册 trace 插件, **When** 发送 HTTP 请求, **Then** 无 Span 记录，无性能开销
2. **Given** 注册 trace 插件, **When** 发送 HTTP 请求, **Then** 自动创建 Span
3. **Given** 插件已注册, **When** 调用 `app.Trace()`, **Then** 返回有效 Trace 实例
4. **Given** 插件未注册, **When** 调用 `app.Trace()`, **Then** 返回 nil 或 NoopTrace

---

### User Story 2 - 三种运行模式 (Priority: P1)

作为管理员，我希望能够选择 Observability 的运行模式，以便根据环境需求灵活配置。

**Why this priority**: 灵活的运行模式是生产环境的核心需求。

**Acceptance Scenarios**:

1. **Given** `Mode: ModeOff`, **When** 任何请求, **Then** 不采集任何数据
2. **Given** `Mode: ModeConditional`, **When** 请求匹配 Filter, **Then** 仅采集匹配的请求
3. **Given** `Mode: ModeFull`, **When** 任何请求, **Then** 采集所有请求（全量模式）
4. **Given** 未设置 Mode, **When** 插件注册, **Then** 默认为 `ModeConditional`

**运行模式定义**:

```go
const (
    ModeOff         TraceMode = "off"         // 关闭，不采集
    ModeConditional TraceMode = "conditional" // 条件采集（默认）
    ModeFull        TraceMode = "full"        // 全量采集
)
```

---

### User Story 3 - 条件过滤器 (Priority: P1)

作为开发者，我希望能够通过过滤器定义采集条件，以便只采集关心的请求。

**Why this priority**: 条件采集是降低性能开销的关键能力。

**Acceptance Scenarios**:

1. **Given** `ErrorOnly()` 过滤器, **When** 请求返回 4xx/5xx, **Then** 采集该请求
2. **Given** `ErrorOnly()` 过滤器, **When** 请求返回 2xx, **Then** 不采集
3. **Given** `SlowRequest(100ms)` 过滤器, **When** 请求耗时 > 100ms, **Then** 采集
4. **Given** `SlowRequest(100ms)` 过滤器, **When** 请求耗时 < 100ms, **Then** 不采集
5. **Given** `PathPrefix("/api/")` 过滤器, **When** 请求路径以 `/api/` 开头, **Then** 采集
6. **Given** `PathExclude("/_/")` 过滤器, **When** 请求路径包含 `/_/`, **Then** 不采集
7. **Given** 多个过滤器 (OR 逻辑), **When** 任一匹配, **Then** 采集

**内置过滤器**:

| 过滤器 | 说明 | 示例 |
|--------|------|------|
| `ErrorOnly()` | 仅采集错误响应 (4xx/5xx) | `trace.ErrorOnly()` |
| `SlowRequest(d)` | 仅采集慢请求 | `trace.SlowRequest(100*time.Millisecond)` |
| `PathPrefix(p)` | 路径前缀匹配 | `trace.PathPrefix("/api/")` |
| `PathExclude(p)` | 路径排除 | `trace.PathExclude("/_/", "/health")` |
| `SampleRate(r)` | 采样率 | `trace.SampleRate(0.1)` // 10% |
| `VIPUser(field)` | VIP 用户标识 | `trace.VIPUser("is_vip")` |
| `DyedUser()` | 染色用户（优先级最高）| `trace.DyedUser()` |
| `Custom(fn)` | 自定义过滤函数 | `trace.Custom(myFilterFunc)` |

---

### User Story 4 - VIP 用户追踪 (Priority: P2)

作为运维人员，我希望能够针对特定用户（如 VIP 用户）进行追踪，以便优先保障重要用户的体验。

**Why this priority**: VIP 用户追踪是生产环境的高级需求。

**Acceptance Scenarios**:

1. **Given** `VIPUser("is_vip")` 过滤器, **When** 请求用户 `is_vip=true`, **Then** 采集
2. **Given** `VIPUser("is_vip")` 过滤器, **When** 请求用户 `is_vip=false`, **Then** 不采集
3. **Given** `VIPUser("tier")` + 条件 `tier in ["gold","platinum"]`, **When** 用户 tier=gold, **Then** 采集
4. **Given** 未认证请求, **When** VIP 过滤器生效, **Then** 不采集（无用户信息）

---

### User Story 5 - 用户染色追踪 (Priority: P2)

作为开发/运维人员，我希望能够对特定用户进行"染色"标记，使其所有请求自动被追踪，以便进行问题排查或用户行为分析。

**Why this priority**: 用户染色是线上问题排查和定向分析的关键能力，比 VIP 过滤器更加灵活。

**染色 vs VIP 的区别**:

| 特性 | VIP 过滤 | 用户染色 |
|------|---------|---------|
| **判断依据** | Auth Record 的字段值 | 染色列表中是否存在 |
| **管理方式** | 业务字段，需要修改用户数据 | 独立染色列表，动态添加/删除 |
| **典型场景** | 付费用户优先监控 | 临时追踪特定问题用户 |
| **持久性** | 随用户属性变化 | 可设置过期时间 |

**Acceptance Scenarios**:

1. **Given** 用户 ID `user_123` 在染色列表中, **When** 该用户发送请求, **Then** 自动采集所有请求
2. **Given** 用户 ID `user_456` 不在染色列表中, **When** 该用户发送请求, **Then** 按正常过滤规则处理
3. **Given** 染色项设置 TTL=1h, **When** 超过 1 小时, **Then** 自动移除染色标记
4. **Given** 通过 API 添加染色用户, **When** 立即生效, **Then** 该用户下次请求即被采集
5. **Given** 通过 API 删除染色用户, **When** 立即生效, **Then** 该用户恢复正常过滤
6. **Given** 染色用户数量 > 配置上限, **When** 添加新染色用户, **Then** 返回错误（防止滥用）
7. **Given** 用户被染色, **When** Span 记录, **Then** 携带 `trace.dyed=true` 属性标记

**染色管理 API**:

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/_/trace/dyed-users` | 获取染色用户列表 |
| `POST` | `/api/_/trace/dyed-users` | 添加染色用户 |
| `DELETE` | `/api/_/trace/dyed-users/:id` | 删除染色用户 |
| `PUT` | `/api/_/trace/dyed-users/:id/ttl` | 修改染色 TTL |

**染色配置**:

```go
type DyeConfig struct {
    // MaxDyedUsers 最大染色用户数（防止滥用）
    // 默认: 100
    MaxDyedUsers int
    
    // DefaultTTL 默认染色有效期
    // 默认: 24h
    DefaultTTL time.Duration
    
    // StorageType 存储类型 ("memory" | "database")
    // memory: 重启后丢失，适合临时排查
    // database: 持久化到 _dyed_users 表
    // 默认: "memory"
    StorageType string
}
```

**使用示例**:

```go
// 启用用户染色功能
trace.MustRegister(app, trace.Config{
    Mode: trace.ModeConditional,
    Filters: []trace.Filter{
        trace.ErrorOnly(),
        trace.DyedUser(), // 染色用户过滤器
    },
    Dye: trace.DyeConfig{
        MaxDyedUsers: 50,
        DefaultTTL:   2 * time.Hour,
        StorageType:  "memory",
    },
})

// 运行时添加染色用户（程序化调用）
trace.DyeUser(app, "user_123", 1*time.Hour)
trace.UndyeUser(app, "user_123")
```

---

### User Story 6 - 环境变量配置 (Priority: P2)

作为 DevOps，我希望能够通过环境变量配置 Observability，以便在不修改代码的情况下调整配置。

**Why this priority**: 环境变量配置是云原生部署的标准实践。

**Acceptance Scenarios**:

1. **Given** `PB_TRACE_MODE=full`, **When** 插件注册, **Then** 使用全量模式
2. **Given** `PB_TRACE_MODE=off`, **When** 插件注册, **Then** 禁用追踪
3. **Given** `PB_TRACE_SAMPLE_RATE=0.1`, **When** 插件注册, **Then** 10% 采样率
4. **Given** `PB_TRACE_SLOW_THRESHOLD=200`, **When** 插件注册, **Then** 慢请求阈值 200ms
5. **Given** `PB_TRACE_RETENTION_DAYS=14`, **When** 插件注册, **Then** 数据保留 14 天
6. **Given** `PB_TRACE_DYE_USERS=user_1,user_2`, **When** 插件注册, **Then** 预设染色用户

**环境变量清单**:

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PB_TRACE_MODE` | 运行模式 (off/conditional/full) | conditional |
| `PB_TRACE_SAMPLE_RATE` | 采样率 (0.0-1.0) | 1.0 |
| `PB_TRACE_SLOW_THRESHOLD` | 慢请求阈值 (ms) | 0 (禁用) |
| `PB_TRACE_ERROR_ONLY` | 是否仅采集错误 | false |
| `PB_TRACE_PATH_EXCLUDE` | 排除路径 (逗号分隔) | `/_/,/health` |
| `PB_TRACE_RETENTION_DAYS` | 数据保留天数 | 7 |
| `PB_TRACE_BUFFER_SIZE` | Ring Buffer 大小 | 10000 |
| `PB_TRACE_FLUSH_INTERVAL` | 刷新间隔 (秒) | 1 |
| `PB_TRACE_DYE_USERS` | 预设染色用户 (逗号分隔) | - |
| `PB_TRACE_DYE_MAX` | 最大染色用户数 | 100 |
| `PB_TRACE_DYE_TTL` | 默认染色 TTL (分钟) | 1440 (24h) |

---

### User Story 7 - 清理旧实现并在 plugins 中实现 (Priority: P1)

作为代码维护者，我希望删除 `core/` 中的旧 Trace 实现，并在 `plugins/trace/` 中重新实现，以保持代码结构一致性。

**Why this priority**: 架构一致性是长期可维护性的基础。

> **简化说明**: 项目未上线，无需迁移，直接删除旧代码并重新实现。

**Acceptance Scenarios**:

1. **Given** 实现完成, **When** 查看 `core/` 目录, **Then** 无 `trace_*.go` 文件（仅保留接口定义）
2. **Given** 实现完成, **When** 查看 `plugins/trace/` 目录, **Then** 包含完整实现
3. **Given** 实现完成, **When** 不注册插件, **Then** 编译后二进制不包含追踪代码

---

### Edge Cases

- 多个过滤器同时配置时如何处理？**OR 逻辑**：任一匹配即采集
- 过滤器与采样率同时配置？**先过滤后采样**：先判断是否匹配过滤器，匹配后再按采样率决定
- VIP 用户过滤但请求未认证？**跳过**：无用户信息时不采集
- 环境变量与代码配置冲突？**环境变量优先**：环境变量覆盖代码配置
- 插件注册后动态修改配置？**支持热更新**：通过 `trace.UpdateConfig()` 修改
- 染色用户与 VIP 用户同时存在？**优先级**：染色用户 > VIP 用户 > 其他过滤器
- 染色列表存储在内存中时服务重启？**丢失**：需要重新添加染色用户（可通过环境变量预设）
- 染色用户过期？**自动移除**：TTL 到期后自动从染色列表删除

---

### Assumptions

1. 插件模式遵循 PocketBase 现有约定（`MustRegister`/`Register`）
2. 环境变量前缀统一为 `PB_TRACE_`
3. 过滤器使用 OR 逻辑组合
4. VIP 用户判断依赖 Auth Record 的字段
5. 默认排除健康检查等内部路径 (`/_/`, `/health`)
6. **项目未上线，直接删除旧实现，无需保留兼容性**
7. 染色用户优先级最高，一旦命中直接采集
8. 染色列表默认存储在内存中，可选持久化到数据库

---

## 4. Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 实现 `plugins/trace` 包，提供 `MustRegister`/`Register` | P1 | US1 |
| FR-002 | 实现三种运行模式 (Off/Conditional/Full) | P1 | US2 |
| FR-003 | 实现 `ErrorOnly()` 过滤器 | P1 | US3 |
| FR-004 | 实现 `SlowRequest()` 过滤器 | P1 | US3 |
| FR-005 | 实现 `PathPrefix()` 过滤器 | P1 | US3 |
| FR-006 | 实现 `PathExclude()` 过滤器 | P1 | US3 |
| FR-007 | 实现 `SampleRate()` 过滤器 | P1 | US3 |
| FR-008 | 实现 `VIPUser()` 过滤器 | P2 | US4 |
| FR-009 | 实现 `Custom()` 自定义过滤器 | P2 | US3 |
| FR-010 | 支持环境变量配置 | P2 | US6 |
| FR-011 | 删除 `core/` 旧代码，在 `plugins/trace/` 实现 | P1 | US7 |
| FR-012 | 保持 `core.App.Trace()` 接口兼容 | P1 | US1 |
| FR-013 | 实现 NoopTrace（未注册时的空实现）| P1 | US1 |
| FR-014 | 支持配置热更新 | P2 | US2 |
| FR-015 | 优化 Ring Buffer 锁粒度 | P2 | - |
| FR-016 | 实现 `DyedUser()` 染色用户过滤器 | P2 | US5 |
| FR-017 | 实现染色用户内存存储 | P2 | US5 |
| FR-018 | 实现染色用户数据库持久化存储（可选） | P3 | US5 |
| FR-019 | 实现染色用户管理 API | P2 | US5 |
| FR-020 | 支持染色 TTL 自动过期 | P2 | US5 |
| FR-021 | Span 携带染色标记属性 `trace.dyed` | P2 | US5 |
| FR-022 | 支持环境变量预设染色用户 | P3 | US5, US6 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | 未注册时零性能开销 | 0μs/请求 |
| NFR-002 | 注册但不匹配过滤器时开销 | < 1μs/请求 |
| NFR-003 | 完整采集时开销 | < 5μs/请求 |
| NFR-004 | 测试覆盖率 | > 85% |
| NFR-005 | 向后兼容性 | 现有 API 100% 兼容 |

---

## 6. Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 未注册时无开销 | 0 allocation | Benchmark |
| SC-002 | 条件过滤性能 | < 1μs/check | Benchmark |
| SC-003 | 现有测试通过率 | 100% | `go test ./...` |
| SC-004 | 新增测试覆盖率 | > 85% | `go test -cover` |
| SC-005 | 代码迁移完整性 | 100% | 代码审查 |

---

## 7. API Design

### 7.1 Plugin Registration

```go
package trace

// Config 定义 trace 插件的配置选项
type Config struct {
    // Mode 运行模式
    // 可选值: ModeOff, ModeConditional, ModeFull
    // 默认: ModeConditional
    Mode TraceMode

    // Filters 过滤器列表（ModeConditional 模式下生效）
    // 多个过滤器之间为 OR 关系
    Filters []Filter

    // BufferSize Ring Buffer 大小
    // 默认: 10000
    BufferSize int

    // FlushInterval 刷新间隔
    // 默认: 1s
    FlushInterval time.Duration

    // BatchSize 批量写入大小
    // 默认: 100
    BatchSize int

    // RetentionDays 数据保留天数
    // 默认: 7
    RetentionDays int

    // Dye 用户染色配置
    Dye DyeConfig

    // DebugLevel 启用 Debug 日志
    // 默认: false
    DebugLevel bool
}

// DyeConfig 用户染色配置
type DyeConfig struct {
    // Enabled 是否启用染色功能
    // 默认: false（需要显式启用）
    Enabled bool

    // MaxDyedUsers 最大染色用户数（防止滥用）
    // 默认: 100
    MaxDyedUsers int

    // DefaultTTL 默认染色有效期
    // 默认: 24h
    DefaultTTL time.Duration

    // StorageType 存储类型
    // "memory": 内存存储（重启后丢失）
    // "database": 数据库持久化
    // 默认: "memory"
    StorageType string

    // PresetUsers 预设染色用户列表
    // 可通过环境变量 PB_TRACE_DYE_USERS 设置
    PresetUsers []string
}

// MustRegister 注册 trace 插件，失败时 panic
func MustRegister(app core.App, config Config)

// Register 注册 trace 插件
func Register(app core.App, config Config) error
```

### 7.2 Filter Interface

```go
// Filter 过滤器接口
type Filter interface {
    // Name 返回过滤器名称（用于日志和调试）
    Name() string

    // ShouldTrace 判断是否应该追踪该请求
    // 参数:
    //   - ctx: 请求上下文
    //   - req: HTTP 请求
    //   - resp: HTTP 响应（可能为 nil，用于 ErrorOnly 等后置过滤）
    //   - duration: 请求耗时（可能为 0，用于 SlowRequest 等后置过滤）
    ShouldTrace(ctx context.Context, req *http.Request, resp *Response, duration time.Duration) bool
}

// Response 简化的响应信息
type Response struct {
    StatusCode int
    Size       int64
}
```

### 7.3 Built-in Filters

```go
// ErrorOnly 仅采集错误响应 (4xx/5xx)
func ErrorOnly() Filter

// SlowRequest 仅采集慢请求
func SlowRequest(threshold time.Duration) Filter

// PathPrefix 路径前缀匹配
func PathPrefix(prefixes ...string) Filter

// PathExclude 路径排除
func PathExclude(patterns ...string) Filter

// SampleRate 采样率
func SampleRate(rate float64) Filter

// VIPUser VIP 用户过滤
// field: Auth Record 中表示 VIP 状态的字段名
// values: 匹配的值列表（可选，为空时字段非空即匹配）
func VIPUser(field string, values ...any) Filter

// DyedUser 染色用户过滤器
// 匹配在染色列表中的用户，优先级最高
func DyedUser() Filter

// Custom 自定义过滤器
func Custom(name string, fn FilterFunc) Filter

// FilterFunc 自定义过滤函数类型
type FilterFunc func(ctx context.Context, req *http.Request, resp *Response, duration time.Duration) bool
```

### 7.4 Dye Management API

```go
// DyeUser 添加染色用户
// userID: 用户 ID（Auth Record ID）
// ttl: 染色有效期（0 表示使用默认 TTL）
func DyeUser(app core.App, userID string, ttl time.Duration) error

// UndyeUser 移除染色用户
func UndyeUser(app core.App, userID string) error

// IsDyed 检查用户是否被染色
func IsDyed(app core.App, userID string) bool

// ListDyedUsers 获取所有染色用户
func ListDyedUsers(app core.App) []DyedUser

// DyedUser 染色用户信息
type DyedUser struct {
    UserID    string        `json:"userId"`
    AddedAt   time.Time     `json:"addedAt"`
    ExpiresAt time.Time     `json:"expiresAt"`
    TTL       time.Duration `json:"ttl"`
    AddedBy   string        `json:"addedBy,omitempty"` // 操作者（API 调用时）
    Reason    string        `json:"reason,omitempty"`  // 染色原因
}
```

### 7.5 HTTP API for Dye Management

| Method | Path | 说明 | Request Body |
|--------|------|------|--------------|
| `GET` | `/api/_/trace/dyed-users` | 获取染色用户列表 | - |
| `POST` | `/api/_/trace/dyed-users` | 添加染色用户 | `{"userId":"xxx","ttl":3600,"reason":"debug"}` |
| `DELETE` | `/api/_/trace/dyed-users/:id` | 删除染色用户 | - |
| `PUT` | `/api/_/trace/dyed-users/:id/ttl` | 修改染色 TTL | `{"ttl":7200}` |

**Response Examples**:

```json
// GET /api/_/trace/dyed-users
{
  "items": [
    {
      "userId": "user_123",
      "addedAt": "2026-02-02T10:00:00Z",
      "expiresAt": "2026-02-03T10:00:00Z",
      "ttl": 86400,
      "addedBy": "admin_001",
      "reason": "investigating slow response issue"
    }
  ],
  "totalItems": 1
}

// POST /api/_/trace/dyed-users
// Request: {"userId":"user_456","ttl":3600,"reason":"testing new feature"}
// Response:
{
  "userId": "user_456",
  "addedAt": "2026-02-02T12:00:00Z",
  "expiresAt": "2026-02-02T13:00:00Z",
  "ttl": 3600
}
```

### 7.6 Usage Examples

```go
package main

import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/trace"
)

func main() {
    app := pocketbase.New()

    // 示例 1: 全量采集（开发环境）
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeFull,
    })

    // 示例 2: 仅采集错误和慢请求（生产环境）
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeConditional,
        Filters: []trace.Filter{
            trace.ErrorOnly(),
            trace.SlowRequest(100 * time.Millisecond),
        },
    })

    // 示例 3: 排除健康检查，10% 采样
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeConditional,
        Filters: []trace.Filter{
            trace.PathExclude("/_/", "/health", "/api/_/"),
            trace.SampleRate(0.1),
        },
    })

    // 示例 4: VIP 用户全量 + 普通用户错误采集
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeConditional,
        Filters: []trace.Filter{
            trace.VIPUser("is_vip", true),
            trace.ErrorOnly(),
        },
    })

    // 示例 5: 启用用户染色 + 错误采集（线上排障场景）
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeConditional,
        Filters: []trace.Filter{
            trace.DyedUser(),     // 染色用户优先（优先级最高）
            trace.ErrorOnly(),    // 其他用户仅采集错误
        },
        Dye: trace.DyeConfig{
            Enabled:      true,
            MaxDyedUsers: 50,
            DefaultTTL:   2 * time.Hour,
            StorageType:  "memory",
        },
    })

    // 示例 6: 染色用户持久化 + 预设用户
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeConditional,
        Filters: []trace.Filter{
            trace.DyedUser(),
            trace.SlowRequest(200 * time.Millisecond),
        },
        Dye: trace.DyeConfig{
            Enabled:      true,
            MaxDyedUsers: 100,
            DefaultTTL:   24 * time.Hour,
            StorageType:  "database",           // 持久化到数据库
            PresetUsers:  []string{"vip_001", "test_user"}, // 预设染色
        },
    })

    // 示例 7: 自定义过滤器 + 染色
    trace.MustRegister(app, trace.Config{
        Mode: trace.ModeConditional,
        Filters: []trace.Filter{
            trace.DyedUser(),
            trace.Custom("internal-api", func(ctx context.Context, req *http.Request, resp *trace.Response, duration time.Duration) bool {
                return strings.HasPrefix(req.URL.Path, "/internal/")
            }),
        },
        Dye: trace.DyeConfig{
            Enabled: true,
        },
    })

    // 运行时动态添加/移除染色用户
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // 添加染色用户（持续 1 小时）
        trace.DyeUser(app, "problem_user_123", 1*time.Hour)
        
        // 检查用户是否被染色
        if trace.IsDyed(app, "problem_user_123") {
            // ...
        }
        
        // 移除染色
        trace.UndyeUser(app, "problem_user_123")
        
        return se.Next()
    })

    app.Start()
}
```

---

## 8. Project Structure

### 8.1 目录结构

```text
plugins/
└── trace/
    ├── trace.go              # 主入口，MustRegister/Register
    ├── config.go             # Config 结构体和环境变量解析
    ├── mode.go               # TraceMode 定义
    ├── filter.go             # Filter 接口定义
    ├── filters/
    │   ├── error_only.go     # ErrorOnly 过滤器
    │   ├── slow_request.go   # SlowRequest 过滤器
    │   ├── path.go           # PathPrefix/PathExclude 过滤器
    │   ├── sample.go         # SampleRate 过滤器
    │   ├── vip_user.go       # VIPUser 过滤器
    │   ├── dyed_user.go      # DyedUser 染色用户过滤器
    │   └── custom.go         # Custom 过滤器
    ├── dye/
    │   ├── dye.go            # 染色管理主逻辑
    │   ├── store.go          # DyeStore 接口
    │   ├── store_memory.go   # 内存存储实现
    │   ├── store_db.go       # 数据库存储实现
    │   └── routes.go         # 染色管理 HTTP API
    ├── middleware.go         # HTTP 追踪中间件
    ├── span.go               # Span 结构体和方法
    ├── buffer.go             # Ring Buffer 实现
    ├── repository.go         # TraceRepository 接口
    ├── repository_pg.go      # PostgreSQL 实现
    ├── repository_sqlite.go  # SQLite 实现
    ├── routes.go             # HTTP API 路由（含染色路由注册）
    ├── noop.go               # NoopTrace 空实现
    └── trace_test.go         # 测试文件
```

### 8.2 core 包保留内容

```text
core/
├── trace_interface.go        # Trace 接口定义（供 App.Trace() 使用）
└── trace_noop.go             # NoopTrace 默认实现
```

### 8.3 待删除文件（旧实现）

> **项目未上线，直接删除以下文件，无需保留兼容性**

```text
# 删除 core/ 中的旧实现
core/trace.go
core/trace_buffer.go
core/trace_context.go
core/trace_span.go
core/trace_repository.go
core/trace_repository_pg.go
core/trace_repository_sqlite.go
core/trace_benchmark_test.go

# 删除 apis/ 中的旧实现
apis/middlewares_trace.go
apis/trace_routes.go (如果存在)
```

---

## 9. Implementation Path (实现路径)

> **简化说明**: 项目未上线，无需迁移，直接删除旧代码并重新实现。

### Phase 1: 清理旧代码 + 创建插件框架

1. 删除 `core/trace*.go` 中的实现文件（保留接口定义）
2. 删除 `apis/middlewares_trace.go`
3. 创建 `plugins/trace/` 目录结构
4. 实现 `MustRegister`/`Register` 函数
5. 实现 `Config` 和环境变量解析
6. 在 `core/` 中定义 `Trace` 接口和 `NoopTrace`

### Phase 2: 核心功能实现

1. 实现 Span、Buffer、Context
2. 实现 Repository（SQLite + PostgreSQL）
3. 实现 HTTP 中间件
4. 实现 HTTP API 路由

### Phase 3: 过滤器实现

1. 实现内置过滤器
2. 修改中间件支持条件采集
3. 添加后置过滤逻辑（ErrorOnly, SlowRequest）

### Phase 4: 实现用户染色功能

1. 实现 `DyeStore` 接口及内存存储
2. 实现 `DyedUser()` 过滤器
3. 实现染色管理 HTTP API
4. 实现 TTL 自动过期机制
5. （可选）实现数据库持久化存储
6. 添加环境变量预设染色支持

### Phase 5: 更新示例和文档

1. 更新 `examples/base/main.go` 添加插件注册示例
2. 更新文档说明新的使用方式
3. 添加迁移指南
4. 添加染色功能使用文档

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 破坏现有 API | Medium | High | 保留 `core.App.Trace()` 接口，返回 NoopTrace |
| 过滤器逻辑复杂 | Low | Medium | 后置过滤使用延迟决策模式 |
| 性能回归 | Low | Medium | Benchmark 对比测试 |
| 迁移遗漏 | Low | Low | 完整的集成测试覆盖 |

---

## 11. Open Questions

1. **过滤器组合逻辑**: 是否需要支持 AND 逻辑？当前设计为 OR。
2. **动态配置**: 是否需要支持运行时通过 API 修改配置？
3. **导出格式**: 是否需要支持导出到外部 Trace 系统（如 Jaeger、Zipkin）？
4. **UI 集成**: Monitor Center UI 是否也移到插件中？
5. **染色用户权限**: 谁可以添加/删除染色用户？是否需要权限控制？
6. **染色审计**: 是否需要记录染色操作日志（谁在什么时候染了谁）？
7. **批量染色**: 是否需要支持批量添加/删除染色用户的 API？
8. **染色标签**: 是否需要支持对染色用户添加标签/分组（如按问题类型分类）？

---

## 12. References

- `specs/009-unified-observability/spec.md` - 原始 Observability 设计
- `plugins/jsvm/jsvm.go` - PocketBase 插件参考实现
- `plugins/tofauth/tofauth.go` - 环境变量配置参考
- `plugins/migratecmd/migratecmd.go` - 插件注册模式参考
