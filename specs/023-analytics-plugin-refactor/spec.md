# Feature Specification: Analytics Plugin Refactor

**Feature Branch**: `023-analytics-plugin-refactor`  
**Created**: 2026-02-03  
**Status**: Draft  
**Input**: 现有实现 `core/analytics*.go`, `apis/analytics*.go`, 原始需求 `specs/007-native-analytics/`

## 1. Problem Essence (核心问题)

Analytics 模块当前实现在 `core/` 目录下，与 PocketBase 核心代码耦合。这违背了 PocketBase 的插件化架构原则：

1. **强耦合**: Analytics 代码直接嵌入核心，用户无法选择性禁用
2. **不可插拔**: 即使用户不需要分析功能，二进制文件仍包含全部代码
3. **架构不一致**: 类似功能（trace、gateway）已采用插件模式，analytics 应保持一致

**Goal**: 将 Analytics 重构为可插拔插件，遵循 `plugins/trace/` 的架构模式。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 插件式注册 (Priority: P1)

作为开发者，我希望 Analytics 是一个可选插件，只在需要时才注册启用，而不是强制编译进核心。

**Why this priority**: 这是插件化重构的核心目标，决定了整体架构。

**Independent Test**: 不注册 analytics 插件时，应用正常启动，无 analytics 相关路由。

**Acceptance Scenarios**:

1. **Given** 用户未注册 analytics 插件, **When** 应用启动, **Then** 无 `/api/analytics/*` 路由，二进制体积更小
2. **Given** 用户调用 `analytics.MustRegister(app, config)`, **When** 应用启动, **Then** analytics 功能完整可用
3. **Given** 用户配置 `Config{Mode: analytics.ModeOff}`, **When** 插件注册, **Then** 所有 analytics 操作为 NoOp（零开销）

---

### User Story 2 - API 兼容性 (Priority: P1)

作为现有用户，我希望重构后的 API 端点和数据格式保持不变，无需修改前端代码。

**Why this priority**: 保证向后兼容，用户无感知迁移。

**Independent Test**: 使用相同的 curl 命令调用 API，返回结果格式一致。

**Acceptance Scenarios**:

1. **Given** 重构前的 `POST /api/analytics/events` 请求, **When** 发送到重构后的服务, **Then** 返回相同的响应格式
2. **Given** 重构前的 `GET /api/analytics/stats?range=7d` 请求, **When** 发送到重构后的服务, **Then** 返回相同的 JSON 结构
3. **Given** JS SDK 的 `pb.analytics.track()` 调用, **When** 升级后端版本, **Then** SDK 无需修改即可正常工作

---

### User Story 3 - 配置迁移 (Priority: P2)

作为运维人员，我希望现有的 analytics 配置能够平滑迁移到插件模式，无需重新配置。

**Why this priority**: 降低迁移成本，提升用户体验。

**Independent Test**: 启动时自动读取现有配置，无需手动干预。

**Acceptance Scenarios**:

1. **Given** 数据库中存在 `analyticsEnabled` 设置, **When** 插件初始化, **Then** 自动读取并应用该配置
2. **Given** 环境变量 `PB_ANALYTICS_ENABLED=false`, **When** 插件初始化, **Then** 环境变量覆盖数据库配置
3. **Given** 新增 `PB_ANALYTICS_MODE` 环境变量, **When** 设置为 `off`, **Then** 插件进入 NoOp 模式

---

### User Story 4 - 代码目录重组 (Priority: P1)

作为贡献者，我希望 analytics 代码组织与其他插件保持一致，便于理解和维护。

**Why this priority**: 架构一致性是可维护性的基础。

**Independent Test**: `plugins/analytics/` 目录结构与 `plugins/trace/` 相似。

**Acceptance Scenarios**:

1. **Given** 重构完成, **When** 查看 `plugins/analytics/`, **Then** 包含 `register.go`, `config.go`, `buffer.go` 等标准文件
2. **Given** 重构完成, **When** 查看 `core/` 目录, **Then** 无 `analytics*.go` 文件
3. **Given** 重构完成, **When** 查看 `apis/` 目录, **Then** 无 `analytics*.go` 文件（路由在插件内部注册）

---

### Edge Cases

- 用户同时设置数据库配置和环境变量时，环境变量优先
- 未注册插件时调用 `analytics.GetAnalytics(app)` 返回 NoOp 实例
- 迁移期间数据文件位置保持不变（`pb_data/analytics.db`）
- 插件卸载后，数据文件保留，重新注册后可继续使用

## Requirements *(mandatory)*

### Functional Requirements

#### 插件注册
- **FR-001**: 插件 MUST 提供 `MustRegister(app, config)` 和 `Register(app, config)` 方法
- **FR-002**: 插件 MUST 在未注册时返回 NoOp 实例（零开销）
- **FR-003**: 插件 MUST 支持 `ModeOff`, `ModeConditional`, `ModeFull` 三种运行模式

#### API 路由
- **FR-004**: 插件 MUST 在 `Register` 时自动注册所有 analytics API 路由
- **FR-005**: 插件 MUST 保持与现有 API 端点完全兼容
- **FR-006**: 插件 MUST 在 App 终止时正确清理资源（Flush 缓冲区）

#### 配置管理
- **FR-007**: 插件 MUST 支持从 `Config` 结构体读取配置
- **FR-008**: 插件 MUST 支持环境变量覆盖配置
- **FR-009**: 插件 SHOULD 支持从数据库 Settings 读取配置（向后兼容）

#### 代码组织
- **FR-010**: 所有 analytics 代码 MUST 移动到 `plugins/analytics/` 目录
- **FR-011**: `core/` 目录 MUST 删除所有 `analytics*.go` 文件
- **FR-012**: `apis/` 目录 MUST 删除所有 `analytics*.go` 文件
- **FR-013**: 插件 SHOULD 提供 `analytics.GetAnalytics(app)` 获取实例

### Key Entities

#### Config 结构体

```go
type Config struct {
    // Mode 运行模式 (off/conditional/full)
    Mode AnalyticsMode
    // Enabled 是否启用（向后兼容 analyticsEnabled）
    Enabled bool
    // Retention 数据保留天数
    Retention int
    // S3Bucket S3 存储桶名称（PG 模式）
    S3Bucket string
    // FlushInterval 聚合数据刷新间隔
    FlushInterval time.Duration
    // MaxRawSize Raw Buffer 最大容量
    MaxRawSize int64
}
```

#### 目录结构

```text
plugins/analytics/
├── register.go              # MustRegister/Register/GetAnalytics
├── config.go                # Config 结构体和环境变量解析
├── mode.go                  # AnalyticsMode 常量定义
├── noop.go                  # NoOp 实现
├── analytics.go             # Analytics 主接口
├── event.go                 # AnalyticsEvent 结构体
├── buffer.go                # 内存缓冲区
├── flusher.go               # 定时 Flush 逻辑
├── repository.go            # Repository 接口
├── repository_sqlite.go     # SQLite 实现
├── repository_postgres.go   # PostgreSQL 实现
├── hll.go                   # HyperLogLog 封装
├── url.go                   # URL Normalization
├── ua.go                    # User-Agent 解析
├── routes.go                # API 路由注册
├── handlers.go              # HTTP handlers
└── *_test.go                # 测试文件
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有现有 analytics API 测试通过（100% 兼容）
- **SC-002**: 代码覆盖率维持 >= 80%
- **SC-003**: 未注册插件时，`/api/analytics/*` 返回 404
- **SC-004**: NoOp 模式下内存分配为 0（benchmark 验证）
- **SC-005**: 性能指标无回退（10,000 events/sec 吞吐量）
- **SC-006**: `core/` 和 `apis/` 目录无 analytics 相关文件

## Boundaries (边界与约束)

1. **仅重构，不新增功能**: 本次只做代码迁移，不添加新的分析能力
2. **保持数据兼容**: `pb_data/analytics.db` 格式不变
3. **保持 API 兼容**: 所有端点路径、请求/响应格式保持不变
4. **JS SDK 不变**: `jssdk/src/services/AnalyticsService.ts` 无需修改
5. **Admin UI 不变**: `ui/src/components/analytics/` 无需修改

## Assumptions

- 参考 `plugins/trace/` 的架构模式
- 重用现有的数据库迁移逻辑
- 保持与 `examples/base/main.go` 的集成方式一致
