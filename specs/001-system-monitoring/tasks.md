# Tasks: System Monitoring & High Availability

**Input**: Design documents from `/specs/001-system-monitoring/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 未显式要求测试，本任务列表不包含测试任务。

**Organization**: 任务按用户故事分组，支持独立实现和测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事 (US1, US2, US3, US4)
- 包含精确文件路径

## Path Conventions

- **Backend (Go)**: `core/`, `apis/`
- **Frontend (Svelte)**: `ui/src/`

---

## Phase 1: Setup (共享基础设施)

**Purpose**: 项目初始化和基本结构创建

- [ ] T001 创建监控模块目录结构 `ui/src/components/monitoring/`
- [ ] T002 [P] 在 `core/metrics_model.go` 中定义 SystemMetrics 数据结构
- [ ] T003 [P] 在 `core/metrics_db.go` 中创建 MetricsDB 连接管理器骨架

---

## Phase 2: Foundational (阻塞性前置条件)

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

**⚠️ CRITICAL**: 此阶段完成前，任何用户故事都无法开始

- [ ] T004 在 `core/metrics_db.go` 中实现 metrics.db 初始化逻辑（创建表、设置 PRAGMA）
- [ ] T005 [P] 在 `core/metrics_collector.go` 中实现 Ring Buffer 数据结构
- [ ] T006 [P] 在 `core/metrics_collector.go` 中实现 HTTP 延迟中间件钩子
- [ ] T007 在 `core/base.go` 中集成 MetricsDB 到 BaseApp 结构体
- [ ] T008 在 `apis/base.go` 中注册监控 API 路由组 `/api/system`
- [ ] T009 [P] 在 `ui/src/routes.js` 中添加 `/monitoring` 路由配置

**Checkpoint**: 基础设施就绪 - 用户故事实现可以开始

---

## Phase 3: User Story 1 & 3 - 实时状态查看 + 独立存储 (Priority: P1) 🎯 MVP

**Goal**: 管理员可以在后台查看系统实时状态，监控数据存储在独立数据库中

**Independent Test**: 
- 访问监控页面，验证能看到 CPU、内存、Goroutine 等实时数据
- 检查 `pb_data/metrics.db` 文件存在且独立于 `data.db`

### Implementation for User Story 1 & 3

- [ ] T010 [P] [US1] 在 `core/metrics_collector.go` 中实现 CPU 使用率采集函数
- [ ] T011 [P] [US1] 在 `core/metrics_collector.go` 中实现内存分配采集函数（使用 runtime.MemStats）
- [ ] T012 [P] [US1] 在 `core/metrics_collector.go` 中实现 Goroutine 数量采集函数
- [ ] T013 [P] [US3] 在 `core/metrics_collector.go` 中实现 WAL 文件大小采集函数
- [ ] T014 [P] [US3] 在 `core/metrics_collector.go` 中实现数据库连接数采集函数
- [ ] T015 [US1] 在 `core/metrics_collector.go` 中实现 P95 延迟计算函数
- [ ] T016 [US1] 在 `core/metrics_collector.go` 中实现 5xx 错误计数函数
- [ ] T017 [US1] 在 `core/metrics_collector.go` 中实现指标采集器主循环（1分钟间隔 Ticker）
- [ ] T018 [US3] 在 `core/metrics_db.go` 中实现异步批量写入逻辑
- [ ] T019 [US1] 在 `apis/metrics.go` 中实现 `GET /api/system/metrics/current` 接口
- [ ] T020 [US1] 在 `apis/metrics.go` 中添加 RequireSuperuserAuth 中间件
- [ ] T021 [P] [US1] 创建 `ui/src/components/monitoring/MetricsCard.svelte` 指标卡片组件
- [ ] T022 [P] [US1] 创建 `ui/src/components/monitoring/PageMonitoring.svelte` 监控主页面骨架
- [ ] T023 [US1] 在 `ui/src/components/monitoring/PageMonitoring.svelte` 中实现实时数据获取和展示
- [ ] T024 [US1] 在 `ui/src/components/monitoring/PageMonitoring.svelte` 中实现自动刷新逻辑（30秒间隔）
- [ ] T025 [US1] 在 `ui/src/App.svelte` 中添加"监控"导航菜单入口

**Checkpoint**: 此时 User Story 1 & 3 应完全可用，可独立测试

---

## Phase 4: User Story 2 - 历史趋势图表 (Priority: P2)

**Goal**: 管理员可以查看过去一段时间的系统指标趋势图

**Independent Test**: 选择不同时间范围（1小时/24小时/7天），验证能看到对应的趋势曲线图

### Implementation for User Story 2

- [ ] T026 [US2] 在 `apis/metrics.go` 中实现 `GET /api/system/metrics` 历史数据查询接口
- [ ] T027 [US2] 在 `apis/metrics.go` 中实现 `hours` 和 `limit` 查询参数解析
- [ ] T028 [P] [US2] 创建 `ui/src/components/monitoring/TimeRangeSelector.svelte` 时间范围选择器组件
- [ ] T029 [P] [US2] 创建 `ui/src/components/monitoring/MetricsChart.svelte` 趋势图组件（基于 Chart.js）
- [ ] T030 [US2] 在 `ui/src/components/monitoring/MetricsChart.svelte` 中配置 chartjs-adapter-luxon 时间轴
- [ ] T031 [US2] 在 `ui/src/components/monitoring/MetricsChart.svelte` 中实现缩放和平移功能
- [ ] T032 [US2] 在 `ui/src/components/monitoring/PageMonitoring.svelte` 中集成时间选择器和趋势图
- [ ] T033 [US2] 在 `ui/src/components/monitoring/PageMonitoring.svelte` 中处理数据不完整提示

**Checkpoint**: 此时 User Story 1、2、3 都应独立可用

---

## Phase 5: User Story 4 - 监控数据自动清理 (Priority: P3)

**Goal**: 系统自动清理超过7天的监控数据，避免磁盘空间无限增长

**Independent Test**: 等待超过保留期限后，验证旧数据被自动删除

### Implementation for User Story 4

- [ ] T034 [US4] 在 `core/metrics_db.go` 中实现数据清理函数 `CleanupOldMetrics()`
- [ ] T035 [US4] 在 `core/metrics_collector.go` 中注册 Cron 任务（每天 03:00 执行清理）
- [ ] T036 [US4] 在 `core/metrics_db.go` 中添加清理任务执行日志

**Checkpoint**: 所有用户故事都应独立可用

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的改进

- [ ] T037 [P] 在 `ui/src/components/monitoring/PageMonitoring.svelte` 中添加"暂无数据"空状态提示
- [ ] T038 [P] 在 `core/metrics_db.go` 中添加数据库损坏自动重建逻辑
- [ ] T039 在 `core/metrics_collector.go` 中添加写入失败错误处理和日志
- [ ] T040 [P] 在 `ui/src/components/monitoring/` 中添加加载状态和错误提示 UI
- [ ] T041 运行 quickstart.md 验证所有功能正常

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-5)**: 依赖 Foundational 完成
  - US1 & US3 合并为 Phase 3（核心 MVP）
  - US2 依赖 Phase 3 完成（需要历史数据）
  - US4 可与 US2 并行
- **Polish (Phase 6)**: 依赖所有用户故事完成

### User Story Dependencies

- **User Story 1 & 3 (P1)**: Foundational 完成后可开始 - 无其他故事依赖
- **User Story 2 (P2)**: 依赖 US1 & US3 完成（需要数据存储基础）
- **User Story 4 (P3)**: 依赖 US1 & US3 完成（需要数据库基础）- 可与 US2 并行

### Within Each User Story

- 后端采集函数可并行开发
- API 依赖采集函数完成
- 前端组件可并行开发
- 页面集成依赖组件完成

### Parallel Opportunities

- T002, T003 可并行
- T005, T006, T009 可并行
- T010-T014 所有采集函数可并行
- T021, T022 前端组件可并行
- T028, T029 前端组件可并行
- T037, T038, T040 可并行

---

## Parallel Example: Phase 3 (User Story 1 & 3)

```bash
# 并行启动所有采集函数开发:
Task: "T010 [P] [US1] 在 core/metrics_collector.go 中实现 CPU 使用率采集函数"
Task: "T011 [P] [US1] 在 core/metrics_collector.go 中实现内存分配采集函数"
Task: "T012 [P] [US1] 在 core/metrics_collector.go 中实现 Goroutine 数量采集函数"
Task: "T013 [P] [US3] 在 core/metrics_collector.go 中实现 WAL 文件大小采集函数"
Task: "T014 [P] [US3] 在 core/metrics_collector.go 中实现数据库连接数采集函数"

# 并行启动前端组件开发:
Task: "T021 [P] [US1] 创建 ui/src/components/monitoring/MetricsCard.svelte"
Task: "T022 [P] [US1] 创建 ui/src/components/monitoring/PageMonitoring.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 3 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (关键 - 阻塞所有故事)
3. 完成 Phase 3: User Story 1 & 3
4. **停止并验证**: 独立测试实时监控和数据存储
5. 可部署/演示 MVP

### Incremental Delivery

1. Setup + Foundational → 基础就绪
2. 添加 US1 & US3 → 独立测试 → 部署/演示 (MVP!)
3. 添加 US2 → 独立测试 → 部署/演示
4. 添加 US4 → 独立测试 → 部署/演示
5. 每个故事增加价值而不破坏之前的功能

---

## Notes

- [P] 任务 = 不同文件，无依赖，可并行
- [Story] 标签映射任务到特定用户故事以便追踪
- 每个用户故事应可独立完成和测试
- 每个任务或逻辑组完成后提交
- 在任何检查点停止以独立验证故事
- 避免：模糊任务、同文件冲突、破坏独立性的跨故事依赖
