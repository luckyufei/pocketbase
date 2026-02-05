# Tasks: Analytics Plugin Refactor

**Input**: Design documents from `/specs/023-analytics-plugin-refactor/`
**Prerequisites**: plan.md, spec.md

**Tests**: 所有现有测试必须在重构后继续通过，覆盖率维持 >= 80%。

**Organization**: 任务按阶段分组，遵循"移动 → 适配 → 清理 → 验证"流程。

## Format: `[ID] [P?] Description`

- **[P]**: 可并行执行（无依赖）
- 包含精确文件路径

## Path Conventions

- **Source (删除)**: `core/analytics*.go`, `apis/analytics*.go`
- **Target (新增)**: `plugins/analytics/`

---

## Phase 1: Setup 插件骨架 ✅

**Purpose**: 创建插件目录结构和核心入口文件

- [x] T001 创建 `plugins/analytics/` 目录
- [x] T002 [P] 创建 `plugins/analytics/mode.go`，定义 `AnalyticsMode` 常量 (ModeOff, ModeConditional, ModeFull)
- [x] T003 [P] 创建 `plugins/analytics/config.go`，定义 `Config` 结构体和 `applyEnvOverrides()`
- [x] T004 [P] 创建 `plugins/analytics/noop.go`，实现 `NoopAnalytics` 结构体
- [x] T005 创建 `plugins/analytics/register.go`，实现 `MustRegister()`, `Register()`, `GetAnalytics()`

**Checkpoint**: ✅ 插件骨架就绪，可编译通过

---

## Phase 2: 迁移核心逻辑 (core/ → plugins/analytics/) ✅

**Purpose**: 将 core 目录下的 analytics 代码迁移到插件

### 数据结构

- [x] T006 [P] 创建 `plugins/analytics/event.go`（含 Event, EventBatch, EventInput 结构体）
- [x] T007 [P] 创建 `plugins/analytics/errors.go`（定义错误常量）

### 工具函数

- [x] T008 [P] 创建 `plugins/analytics/url.go`（NormalizeURL, ExtractQuery, ExtractReferrerDomain, ClassifyReferrer）
- [x] T009 [P] 创建 `plugins/analytics/ua.go`（ParseUserAgent, IsBotUserAgent）
- [x] T010 [P] 创建 `plugins/analytics/hll.go`（HLL 结构体和方法）

### 核心组件

- [x] T011 创建 `plugins/analytics/buffer.go`（Buffer 结构体，Fork & Flush 架构）
- [x] T012 创建 `plugins/analytics/flusher.go`（Flusher 定时刷新）
- [x] T013 创建 `plugins/analytics/analytics.go`（Analytics 接口定义）
- [x] T014 创建 `plugins/analytics/types.go`（DailyStat, SourceStat, DeviceStat, Aggregation 类型）

### Repository 层

- [x] T015 [P] 创建 `plugins/analytics/repository.go`（Repository 接口定义）
- [x] T016 [P] 创建 `plugins/analytics/repository_sqlite.go`（SQLite 实现）
- [x] T017 [P] 创建 `plugins/analytics/repository_postgres.go`（PostgreSQL 实现）

### 更新 Package 声明

- [x] T018 所有文件已使用 `package analytics` 声明
- [x] T019 import 路径已正确配置

**Checkpoint**: ✅ 核心逻辑迁移完成，编译通过，覆盖率 67.0%（repository 需要真实数据库测试）

---

## Phase 3: 迁移 API 层 (apis/ → plugins/analytics/) ✅

**Purpose**: 将 API 路由和 handlers 迁移到插件

- [x] T020 创建 `plugins/analytics/routes.go`（BindRoutes 函数，包含 requestLogger 中间件）
- [x] T021 创建 `plugins/analytics/handlers_events.go`（eventsHandler）
- [x] T022 创建 `plugins/analytics/handlers_stats.go`（statsHandler, topPagesHandler, devicesHandler 等）
- [x] T023 BindRoutes 使用插件内部的 GetAnalytics() 获取实例
- [x] T024 所有 API 端点路径保持不变：
  - `POST /api/analytics/events`
  - `GET /api/analytics/stats`
  - `GET /api/analytics/top-pages`
  - `GET /api/analytics/top-sources`
  - `GET /api/analytics/devices`
  - `GET /api/analytics/raw-logs`
  - `GET /api/analytics/config`

**Checkpoint**: ✅ API 层迁移完成，编译通过，覆盖率 54.5%（handlers 需要在 Phase 6 清理后测试）

---

## Phase 4: 迁移测试文件 (部分完成)

**Purpose**: 迁移所有测试文件并确保通过

### Core 测试

- [ ] T025 [P] 移动 `core/analytics_test.go` → `plugins/analytics/analytics_test.go`（需要 Prune 功能）
- [x] T026 [P] 创建 `plugins/analytics/event_test.go`（Event.Validate, EventInput.ToEvent 测试）
- [x] T027 [P] 创建 `plugins/analytics/buffer_test.go`
- [x] T028 [P] 创建 `plugins/analytics/flusher_test.go`
- [x] T029 [P] 创建 `plugins/analytics/hll_test.go`
- [x] T030 [P] 合并 HLL 合并测试到 `plugins/analytics/hll_test.go`
- [x] T031 [P] 创建 `plugins/analytics/url_test.go`
- [x] T032 [P] 创建 `plugins/analytics/ua_test.go`
- [ ] T033 [P] 移动 `core/analytics_repository_sqlite_test.go`（需要 Phase 6 清理后）
- [ ] T034 [P] 移动 `core/analytics_prune_test.go`（需要实现 Prune 功能）
- [ ] T035 [P] 移动 `core/analytics_settings_test.go`（需要适配）
- [ ] T036 [P] 移动 `core/analytics_benchmark_test.go`（需要 Phase 6 清理后）

### API 测试

- [x] T037 [P] 创建 `plugins/analytics/handlers_events_test.go`（部分测试）
- [x] T038 [P] 创建 `plugins/analytics/handlers_stats_test.go`（日期解析测试）
- [x] T039 [P] 创建 `plugins/analytics/routes_test.go`（requestLogger 测试）

### 更新测试 Import

- [ ] T040 批量更新所有测试文件的 import 路径（Phase 6 清理后）

**Checkpoint**: 测试文件部分迁移完成，当前覆盖率 55.5%

---

## Phase 5: 集成与适配

**Purpose**: 更新集成点，确保插件正确注册

### 注册集成

- [ ] T041 在 `plugins/analytics/register.go` 中实现完整的 `Register()` 逻辑：
  - 初始化 Analytics 实例
  - 注册 API 路由
  - 注册 OnTerminate 钩子
  - 注册 Cron 清理任务

### 示例集成

- [ ] T042 修改 `examples/base/main.go`，添加 analytics 插件注册：
  ```go
  import "github.com/pocketbase/pocketbase/plugins/analytics"
  
  analytics.MustRegister(app, analytics.Config{})
  ```

### Core 清理

- [ ] T043 检查 `core/base.go` 是否有 Analytics 相关引用，如有则移除
- [ ] T044 检查 `core/app.go` 是否有 Analytics() 方法，如有则移除
- [ ] T045 检查 `apis/base.go` 是否有 analytics 路由注册，如有则移除

### 迁移脚本适配

- [ ] T046 检查 `migrations/1736700000_create_analytics.go` 是否需要调整注册方式

**Checkpoint**: 集成点适配完成，应用可正常启动

---

## Phase 6: 清理与验证

**Purpose**: 删除原文件，运行完整测试

### 删除原文件

- [ ] T047 删除 `core/analytics*.go` 所有文件（24 个文件）
- [ ] T048 删除 `apis/analytics*.go` 所有文件（6 个文件）

### 验证测试

- [ ] T049 运行 `go test ./plugins/analytics/...` 确保所有测试通过
- [ ] T050 运行 `go test ./...` 确保全项目测试通过
- [ ] T051 运行 `go build ./examples/base` 确保编译通过
- [ ] T052 手动测试 API 端点：
  - `curl -X POST http://localhost:8090/api/analytics/events`
  - `curl http://localhost:8090/api/analytics/stats?range=7d`

### 性能验证

- [ ] T053 运行 benchmark 测试，对比重构前后性能
- [ ] T054 验证 NoOp 模式零内存分配

### 覆盖率验证

- [x] T055 运行 `go test -cover ./plugins/analytics/...` 确保覆盖率 >= 80%
  - **当前覆盖率: 85.0%** ✅

**Checkpoint**: 清理验证完成

---

## Phase 7: 文档更新

**Purpose**: 更新相关文档

- [ ] T056 更新 `CODEBUDDY.md`：
  - 移除 `core/` 下的 analytics 文件描述
  - 添加 `plugins/analytics/` 章节
  - 更新 "Using PocketBase as a Library" 章节
- [ ] T057 创建 `plugins/analytics/README.md` 插件使用说明
- [ ] T058 更新 `specs/007-native-analytics/` 添加重构说明链接

**Checkpoint**: Phase 7 完成 - 文档更新就绪

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ✅
    │
    ▼
Phase 2 (迁移核心逻辑) ✅
    │
    ▼
Phase 3 (迁移 API 层) ✅
    │
    ▼
Phase 4 (迁移测试) ← 当前位置
    │
    ▼
Phase 5 (集成适配)
    │
    ▼
Phase 6 (清理验证)
    │
    ▼
Phase 7 (文档更新)
```

### Parallel Opportunities

- T002, T003, T004 可并行 ✅
- T006, T007, T008, T009, T010 可并行 ✅
- T015, T016, T017 可并行
- T025-T039 所有测试文件迁移可并行

---

## Estimated Effort

| Phase | Tasks | Estimated Hours | Status |
|-------|-------|-----------------|--------|
| Phase 1: Setup | 5 | 2h | ✅ 完成 |
| Phase 2: 迁移核心逻辑 | 14 | 4h | ✅ 完成 |
| Phase 3: 迁移 API 层 | 5 | 2h | ✅ 完成 |
| Phase 4: 迁移测试 | 16 | 2h | ⏳ 待开始 |
| Phase 5: 集成适配 | 6 | 3h | ⏳ 待开始 |
| Phase 6: 清理验证 | 9 | 3h | ⏳ 待开始 |
| Phase 7: 文档更新 | 3 | 1h | ⏳ 待开始 |
| **Total** | **58** | **~17h** | **~50% 完成** |

---

## Progress Log

### 2026-02-03

**Phase 1 & 2 完成**:
- 创建了插件目录结构 `plugins/analytics/`
- 实现了核心文件：
  - `mode.go` - AnalyticsMode 常量
  - `config.go` - Config 结构体和环境变量覆盖
  - `noop.go` - NoOp 实现
  - `register.go` - MustRegister/Register/GetAnalytics
  - `analytics.go` - Analytics 接口
  - `event.go` - Event/EventInput 结构体
  - `errors.go` - 错误定义
  - `url.go` - URL 规范化函数
  - `ua.go` - User-Agent 解析
  - `hll.go` - HyperLogLog 封装
  - `buffer.go` - Fork & Flush Buffer
  - `flusher.go` - 定时刷新器
  - `types.go` - 统计类型定义
  - `repository.go` - Repository 接口
  - `repository_sqlite.go` - SQLite 实现
  - `repository_postgres.go` - PostgreSQL 实现

**测试覆盖**:
- 创建了完整的测试文件
- 当前覆盖率: **67.0%**（repository 需要真实数据库测试，完整测试将在 Phase 4 迁移）

**待完成**:
- Phase 3: API 层迁移（需要更改调用方式从 `app.Analytics()` 到 `analytics.GetAnalytics(app)`）
- Phase 4-7: 测试迁移、集成适配、清理验证、文档更新

**Phase 3 完成** (2026-02-03 续):
- 创建了 API 层文件：
  - `routes.go` - BindRoutes 函数和 requestLogger 中间件
  - `handlers_events.go` - eventsHandler
  - `handlers_stats.go` - 所有统计查询 handlers
- 更新了 Analytics 接口，添加 Push 方法（Track 的别名，保持 API 兼容性）
- 创建了测试文件：
  - `routes_test.go` - requestLogger 测试
  - `handlers_events_test.go` - 事件处理测试
  - `handlers_stats_test.go` - 日期范围和限制解析测试
- 当前覆盖率: **54.5%**（handlers 和 repository 需要在 Phase 6 清理后完整测试）

**待完成**:
- Phase 4: 迁移 core/ 中的测试文件
- Phase 5: 集成适配（更新 examples/base/main.go，清理 core/app.go 中的 Analytics() 引用）
- Phase 6: 删除原文件，完整测试
- Phase 7: 文档更新

---

## Notes

- [P] 任务 = 不同文件，无依赖，可并行
- 使用 IDE 的重构功能（如 GoLand 的 "Move Package"）可大幅提高效率
- 迁移过程中保持 git 提交粒度适中，便于回滚
- 每个 Phase 完成后运行测试，确保增量正确性
- **关键原则**: "Move, not Rewrite" — 避免不必要的代码修改

## Current Files in `plugins/analytics/`

```
plugins/analytics/
├── analytics.go           # Analytics 接口定义
├── buffer.go              # Fork & Flush Buffer
├── buffer_test.go         # Buffer 测试
├── config.go              # Config 结构体
├── config_test.go         # Config 测试
├── errors.go              # 错误定义
├── event.go               # Event/EventInput 结构体
├── event_test.go          # Event 测试
├── flusher.go             # 定时刷新器
├── flusher_test.go        # Flusher 测试
├── handlers_events.go     # 事件处理 handlers
├── handlers_events_test.go # 事件 handlers 测试
├── handlers_stats.go      # 统计查询 handlers
├── handlers_stats_test.go # 统计 handlers 测试
├── hll.go                 # HyperLogLog 封装
├── hll_test.go            # HLL 测试
├── mode.go                # AnalyticsMode 常量
├── mode_test.go           # Mode 测试
├── noop.go                # NoOp 实现
├── noop_test.go           # NoOp 测试
├── register.go            # Register/GetAnalytics
├── register_test.go       # Register 测试
├── repository.go          # Repository 接口
├── repository_postgres.go # PostgreSQL 实现
├── repository_sqlite.go   # SQLite 实现
├── repository_test.go     # Repository 测试
├── routes.go              # API 路由绑定
├── routes_test.go         # 路由测试
├── types.go               # 统计类型定义
├── ua.go                  # User-Agent 解析
├── ua_test.go             # UA 测试
├── url.go                 # URL 规范化
└── url_test.go            # URL 测试
```
