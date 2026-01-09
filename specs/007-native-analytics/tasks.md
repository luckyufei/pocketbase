# Tasks: Native Analytics (`_events`)

**Input**: Design documents from `/specs/007-native-analytics/`
**Prerequisites**: plan.md, spec.md

**Tests**: 每个 Phase 完成后应编写对应的单元测试和集成测试，覆盖率目标 80%。

**Organization**: 任务按用户故事分组，支持独立实现和测试。采用 TDD（红灯/绿灯）开发模式。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事 (US1-US7)
- 包含精确文件路径

## Path Conventions

- **Backend (Go)**: `core/`, `apis/`, `migrations/`
- **JS SDK**: `jssdk/src/`
- **Admin UI**: `ui/src/`

---

## Phase 1: Setup (共享基础设施) ✅

**Purpose**: 项目初始化和基本结构创建

- [x] T001 创建 `migrations/1736700000_create_analytics.go`，定义分析表迁移脚本骨架
- [x] T002 [P] 在 `core/analytics_event.go` 中定义 AnalyticsEvent 结构体
- [x] T003 [P] 在 `core/analytics.go` 中创建 Analytics 主入口结构体骨架
- [x] T004 [P] 在 `core/analytics_repository.go` 中定义 AnalyticsRepository 接口

---

## Phase 2: Foundational (阻塞性前置条件) ✅

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

### 数据库 Schema

- [x] T005 在 `migrations/1736700000_create_analytics.go` 中实现 `_analytics_daily` 表创建（SQLite）
- [x] T006 在 `migrations/1736700000_create_analytics.go` 中实现 `_analytics_sources` 表创建（SQLite）
- [x] T007 在 `migrations/1736700000_create_analytics.go` 中实现 `_analytics_devices` 表创建（SQLite）
- [x] T008 [P] 在 `core/analytics_repository_postgres.go` 中实现 PostgreSQL `UNLOGGED` 表创建

### 核心组件

- [x] T009 在 `core/analytics_url.go` 中实现 `NormalizeURL()` URL 清洗函数（去参、去 Hash）
- [x] T010 [P] 在 `core/analytics_ua.go` 中实现 `ParseUserAgent()` UA 解析函数
- [x] T011 [P] 在 `core/analytics_hll.go` 中封装 HyperLogLog 操作（New, Add, Merge, Count, Bytes）
- [x] T012 在 `core/analytics.go` 中实现 Analytics 配置加载（Enabled, Retention, S3Bucket）
- [x] T013 在 `core/base.go` 或 `core/app.go` 中集成 Analytics 到 App 结构体

### 单元测试

- [x] T014 编写 `core/analytics_url_test.go` URL Normalization 测试
- [x] T015 [P] 编写 `core/analytics_ua_test.go` UA 解析测试
- [x] T016 [P] 编写 `core/analytics_hll_test.go` HLL 操作测试

**Checkpoint**: 基础设施就绪 ✅

---

## Phase 3: User Story 1 - 前端自动埋点采集 (Priority: P1) 🎯 MVP ✅

**Goal**: JS SDK 能够自动采集页面浏览和用户行为事件

**Independent Test**: 
- 在前端引入 SDK，验证 `page_view` 事件自动发送
- 调用 `pb.analytics.track('click', {})` 验证事件被缓存并发送

### Backend API

- [x] T017 [US1] 在 `apis/analytics.go` 中注册 `/api/analytics/events` 路由
- [x] T018 [US1] 在 `apis/analytics_events.go` 中实现 `POST /api/analytics/events` 接收事件
- [x] T019 [US1] 在 `apis/analytics_events.go` 中实现批量事件解析和验证
- [x] T020 [US1] 在 `apis/analytics_events.go` 中实现事件入队到 AnalyticsBuffer

### JS SDK

- [x] T021 [P] [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中创建 Analytics 类骨架
- [x] T022 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现 `track(event, props)` 方法
- [x] T023 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现事件批量缓存（5秒或页面卸载）
- [x] T024 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现 Beacon API 发送
- [x] T025 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现自动 `page_view` 采集
- [x] T026 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现 `optOut()` GDPR 合规方法
- [x] T027 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现 `identify(props)` 用户关联方法
- [x] T028 [US1] 在 `jssdk/src/services/AnalyticsService.ts` 中实现后端 `analyticsEnabled` 检测

### 测试

- [x] T029 [US1] 编写 `apis/analytics_events_test.go` 事件接收 API 测试
- [x] T030 [US1] 编写 `jssdk/tests/services/AnalyticsService.spec.ts` SDK 测试

**Checkpoint**: User Story 1 完成 - 事件采集就绪 ✅

---

## Phase 4: User Story 3 - 流式聚合写入 (Priority: P1) 🎯 MVP ✅

**Goal**: 事件在内存中聚合后批量写入数据库，不影响业务性能

**Independent Test**: 
- 发送 1000 个事件，验证 DB 只有聚合后的记录
- 压力测试验证业务 API 延迟增加 < 1ms

### 内存缓冲区

- [x] T031 [US3] 在 `core/analytics_buffer.go` 中实现 AnalyticsBuffer 结构体
- [x] T032 [US3] 在 `core/analytics_buffer.go` 中实现 `Push(event)` 事件入队
- [x] T033 [US3] 在 `core/analytics_buffer.go` 中实现 Raw Buffer（[]Event）
- [x] T034 [US3] 在 `core/analytics_buffer.go` 中实现 Aggregation Map（date+path → HLL+PV）
- [x] T035 [US3] 在 `core/analytics_buffer.go` 中实现并发安全（sync.Mutex）

### DB Flusher

- [x] T036 [US3] 在 `core/analytics_flusher.go` 中实现 Flusher 结构体
- [x] T037 [US3] 在 `core/analytics_flusher.go` 中实现 10 秒定时器触发
- [x] T038 [US3] 在 `core/analytics_flusher.go` 中实现 Read-Merge-Write 事务（HLL 合并）
- [x] T039 [US3] 在 `core/analytics_flusher.go` 中实现 `_analytics_daily` 表更新
- [x] T040 [US3] 在 `core/analytics_flusher.go` 中实现 `_analytics_sources` 表更新
- [x] T041 [US3] 在 `core/analytics_flusher.go` 中实现 `_analytics_devices` 表更新

### Repository 实现

- [x] T042 [P] [US3] 在 `core/analytics_repository_sqlite.go` 中实现 SQLite Repository
- [x] T043 [P] [US3] 在 `core/analytics_repository_postgres.go` 中实现 PostgreSQL Repository
- [x] T044 [US3] 在 `core/analytics_repository_sqlite.go` 中实现 `Upsert()` 方法（PV 累加，HLL 合并）
- [x] T045 [US3] 在 `core/analytics_repository_postgres.go` 中实现 `Upsert()` 方法

### 测试

- [x] T046 [US3] 编写 `core/analytics_buffer_test.go` 缓冲区测试
- [x] T047 [US3] 编写 `core/analytics_flusher_test.go` Flusher 测试
- [x] T048 [US3] 编写 `core/analytics_repository_sqlite_test.go` SQLite Repository 测试

**Checkpoint**: User Story 3 完成 - 流式聚合就绪 ✅

---

## Phase 5: User Story 4 - 双模存储适配 (Priority: P1) 🎯 MVP ✅

**Goal**: 自动适配 SQLite 和 PostgreSQL 两种部署模式

**Independent Test**: 
- SQLite 模式启动，验证 `pb_data/analytics.db` 创建
- PostgreSQL 模式启动，验证 `UNLOGGED` 表创建

### Parquet 写入（暂缓 - 后续迭代）

- [ ] T049 [US4] 在 `core/analytics_parquet.go` 中实现 Parquet Writer 结构体
- [ ] T050 [US4] 在 `core/analytics_parquet.go` 中实现 `Write(events)` 批量写入
- [ ] T051 [US4] 在 `core/analytics_parquet.go` 中实现 ZSTD 压缩配置
- [ ] T052 [US4] 在 `core/analytics_parquet.go` 中实现按日期分区文件名

### S3 上传（暂缓 - 后续迭代）

- [ ] T053 [P] [US4] 在 `core/analytics_s3.go` 中实现 S3 Client 初始化
- [ ] T054 [P] [US4] 在 `core/analytics_s3.go` 中实现 `Upload(filename, data)` 上传方法
- [ ] T055 [US4] 在 `core/analytics_s3.go` 中实现 `GeneratePresignedURL()` 预签名下载

### 模式适配

- [x] T056 [US4] 在 `core/analytics_hooks.go` 中实现双模 Repository 选择
- [x] T057 [US4] 在 `migrations/1736700000_create_analytics.go` 中实现 SQLite/PostgreSQL 双模迁移
- [ ] T058 [US4] 在 `core/analytics_flusher.go` 中实现 PostgreSQL 模式写 S3
- [ ] T059 [US4] 在 `core/analytics_flusher.go` 中实现 PostgreSQL 无 S3 时降级（丢弃 Raw Log）

### 测试

- [ ] T060 [US4] 编写 `core/analytics_parquet_test.go` Parquet 写入测试
- [ ] T061 [US4] 编写 `core/analytics_s3_test.go` S3 上传测试（Mock）

**Checkpoint**: MVP 完成 (User Story 1, 3, 4) - 数据采集和存储就绪 ✅

---

## Phase 6: User Story 2 - 查看流量概览仪表盘 (Priority: P1) ✅

**Goal**: Admin UI 展示 PV/UV 趋势图和 Top Pages 列表

**Independent Test**: 
- 访问 Analytics 页面，验证 PV/UV 卡片显示
- 选择 Last 7 Days，验证趋势图正确渲染

### Query API

- [x] T062 [US2] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/stats` 统计查询
- [x] T063 [US2] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/top-pages` Top Pages 查询
- [x] T064 [US2] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/top-sources` 来源查询
- [x] T065 [US2] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/devices` 设备查询
- [x] T066 [US2] 在 `apis/analytics.go` 中实现日期范围参数解析（today, 7d, 30d）
- [x] T067 [US2] 在 `apis/analytics.go` 中实现管理员权限验证

### Admin UI

- [x] T068 [P] [US2] 在 `ui/src/components/analytics/AnalyticsCard.svelte` 中实现指标卡片组件
- [x] T069 [P] [US2] 在 `ui/src/components/analytics/AnalyticsChart.svelte` 中实现 PV/UV 趋势图
- [x] T070 [P] [US2] 在 `ui/src/components/analytics/TopList.svelte` 中实现 Top Pages 列表
- [x] T071 [P] [US2] 在 `ui/src/components/analytics/TopList.svelte` 中实现 Top Sources 列表
- [x] T072 [P] [US2] 在 `ui/src/components/analytics/PageAnalytics.svelte` 中实现设备分布
- [x] T073 [US2] 在 `ui/src/components/analytics/PageAnalytics.svelte` 中实现日期选择器
- [x] T074 [US2] 在 `ui/src/components/analytics/PageAnalytics.svelte` 中组装仪表盘主页面
- [x] T075 [US2] 在 `ui/src/routes.js` 中创建 Analytics 路由
- [x] T076 [US2] 在 `ui/src/App.svelte` 左侧导航栏中添加 "Analytics" 菜单入口
- [x] T077 [US2] 在 `ui/src/components/analytics/PageAnalytics.svelte` 中实现 60 秒自动轮询

### 测试

- [x] T078 [US2] 编写 `apis/analytics_stats_test.go` 统计 API 测试
- [x] T079 [US2] 编写 `apis/analytics_pages_test.go` Top Pages API 测试

**Checkpoint**: User Story 2 完成 - Dashboard 可用 ✅

---

## Phase 7: User Story 5 - UV 去重统计 (Priority: P2) ✅

**Goal**: UV 统计正确去重，跨天查询使用 HLL 合并

**Independent Test**: 
- 同一用户访问 5 次，验证 UV = 1
- 跨天查询，验证 HLL 合并结果正确

### HLL 合并

- [x] T080 [US5] 在 `core/analytics_repository_sqlite.go` 中实现跨天 HLL 合并查询
- [x] T081 [US5] 在 `core/analytics_repository_postgres.go` 中实现跨天 HLL 合并查询
- [x] T082 [US5] 在 `apis/analytics_stats.go` 中实现多天 UV 合并计算

### 测试

- [x] T083 [US5] 编写 HLL 跨天合并集成测试 (`core/analytics_hll_merge_test.go`)

**Checkpoint**: User Story 5 完成 - UV 去重准确 ✅

---

## Phase 8: User Story 6 - 下载原始日志 (Priority: P3) ⏸️ 暂缓

**Goal**: 管理员可以下载 Parquet 格式的原始日志

**Status**: 暂缓 - 依赖 Parquet/S3 功能（Phase 5 暂缓部分）

**Independent Test**: 
- 点击下载按钮，验证能下载 Parquet 文件
- PostgreSQL 模式，验证 S3 Presigned URL 生成

### Download API

- [x] T084 [US6] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/raw-logs` 列出可下载日期（框架）
- [x] T085 [US6] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/raw-logs/:date` 下载指定日期（框架）
- [ ] T086 [US6] 在 `apis/analytics_download.go` 中实现 SQLite 模式直接返回本地文件（暂缓）
- [ ] T087 [US6] 在 `apis/analytics_download.go` 中实现 PostgreSQL 模式返回 S3 Presigned URL（暂缓）

### Admin UI

- [ ] T088 [US6] 在 `ui/src/components/analytics/Dashboard.svelte` 中添加 "Download Raw Logs" 下拉菜单（暂缓）
- [ ] T089 [US6] 在 `ui/src/components/analytics/Dashboard.svelte` 中实现日期列表加载和下载触发（暂缓）

### 测试

- [ ] T090 [US6] 编写 `apis/analytics_download_test.go` 下载 API 测试（暂缓）

**Checkpoint**: User Story 6 暂缓 - 待 Parquet/S3 功能实现

---

## Phase 9: User Story 7 - 数据自动清理 (Priority: P3) ✅

**Goal**: 系统自动清理过期的分析数据

**Independent Test**: 
- 设置 `analyticsRetention = 1`，验证 1 天前的数据被清理

### Cron 清理

- [x] T091 [US7] 在 `core/analytics.go` 中实现 `Prune()` 清理方法
- [x] T092 [US7] 在 `core/analytics_repository_sqlite.go` 中实现 `DeleteBefore(date)` 统计数据清理
- [x] T093 [US7] 在 `core/analytics_repository_postgres.go` 中实现 `DeleteBefore(date)` 统计数据清理
- [ ] T094 [US7] 在 `core/analytics_parquet.go` 中实现本地 Parquet 文件清理（暂缓）
- [ ] T095 [US7] 在 `core/analytics_s3.go` 中实现 S3 对象清理（暂缓）
- [x] T096 [US7] 在 `core/analytics_hooks.go` 中注册 Cron 定时任务（每天凌晨 3 点执行）

### 配置

- [x] T097 [US7] 在 Admin UI Settings 中添加 `analyticsEnabled` 开关
- [x] T098 [US7] 在 Admin UI Settings 中添加 `analyticsS3Bucket` 配置项
- [x] T099 [US7] 在 Admin UI Settings 中添加 `analyticsRetention` 配置项

### 测试

- [x] T100 [US7] 编写 `core/analytics_prune_test.go` 清理逻辑测试

**Checkpoint**: User Story 7 完成 - 自动清理和配置就绪 ✅

---

## Phase 10: Polish & Cross-Cutting Concerns ✅

**Purpose**: 影响多个用户故事的改进

- [x] T101 [P] 在 `core/analytics_buffer.go` 中添加 Ring Buffer 溢出丢弃策略（已实现 maxRawSize）
- [x] T102 [P] 在 `core/analytics.go` 中添加优雅关闭（Flush 所有缓冲区）
- [x] T103 [P] 在 `apis/analytics.go` 中添加请求日志（不打印敏感数据）
- [x] T104 在 `core/analytics_flusher.go` 中添加 Flush 失败重试逻辑
- [x] T105 在 `core/analytics_hll.go` 中添加 HLL 合并失败降级逻辑（已实现于 Repository 层）
- [x] T106 运行完整集成测试，验证所有功能正常
- [x] T107 运行性能测试，验证 10,000 events/sec 吞吐量（实测: **2,074,331 events/sec** ✅）
- [x] T108 验证覆盖率 >= 80%（核心模块覆盖率: **82.86%** ✅）

**Checkpoint**: Phase 10 完成 - 所有核心功能就绪 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-9)**: 依赖 Foundational 完成
  - US1 (Phase 3): 事件采集
  - US3 (Phase 4): 流式聚合 - 依赖 US1
  - US4 (Phase 5): 双模存储 - 依赖 US3
  - US2 (Phase 6): Dashboard - 依赖 US3, US4
  - US5 (Phase 7): UV 去重 - 依赖 US3
  - US6 (Phase 8): 下载日志 - 依赖 US4
  - US7 (Phase 9): 自动清理 - 依赖 US4
- **Polish (Phase 10)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ▼
Phase 3 (US1: 事件采集) ─────────────────────────────────┐
    │                                                     │
    ▼                                                     │
Phase 4 (US3: 流式聚合) ──────────────────────────┐       │
    │                                              │       │
    ▼                                              │       │
Phase 5 (US4: 双模存储) ──────────────────┐        │       │
    │                                      │        │       │
    ├──────────────┬──────────────┐        │        │       │
    ▼              ▼              ▼        │        │       │
Phase 6        Phase 8        Phase 9      │        │       │
(US2: UI)      (US6: 下载)    (US7: 清理)  │        │       │
    │              │              │        │        │       │
    └──────────────┴──────────────┘        │        │       │
                   │                       │        │       │
                   │          ┌────────────┘        │       │
                   │          ▼                     │       │
                   │     Phase 7 (US5: UV 去重) ◄───┘       │
                   │          │                             │
                   └──────────┴─────────────────────────────┘
                              │
                              ▼
                      Phase 10 (Polish)
```

### Parallel Opportunities

- T002, T003, T004 可并行
- T010, T011 可并行
- T014, T015, T016 可并行
- T042, T043 可并行
- T053, T054 可并行
- T068, T069, T070, T071, T072 可并行
- T101, T102, T103 可并行

---

## Implementation Strategy

### MVP First (User Story 1, 3, 4)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (关键 - 阻塞所有故事)
3. 完成 Phase 3: User Story 1 (事件采集)
4. 完成 Phase 4: User Story 3 (流式聚合)
5. 完成 Phase 5: User Story 4 (双模存储)
6. **停止并验证**: 独立测试事件采集、聚合、存储
7. 可部署/演示 MVP（后端数据管道就绪）

### Incremental Delivery

1. Setup + Foundational → 基础就绪
2. 添加 US1 → 独立测试 → 事件采集可用
3. 添加 US3 + US4 → 独立测试 → 数据管道完整 (**MVP!**)
4. 添加 US2 → 独立测试 → Dashboard 可用
5. 添加 US5 → 独立测试 → UV 准确
6. 添加 US6 + US7 → 独立测试 → 完整功能
7. 每个故事增加价值而不破坏之前的功能

---

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Setup | 4 | 2h |
| Phase 2: Foundational | 12 | 10h |
| Phase 3: US1 (事件采集) | 14 | 16h |
| Phase 4: US3 (流式聚合) | 18 | 20h |
| Phase 5: US4 (双模存储) | 13 | 16h |
| Phase 6: US2 (Dashboard) | 18 | 24h |
| Phase 7: US5 (UV 去重) | 4 | 4h |
| Phase 8: US6 (下载日志) | 7 | 8h |
| Phase 9: US7 (自动清理) | 10 | 10h |
| Phase 10: Polish | 8 | 8h |
| **Total** | **108** | **~118h** |

---

## Notes

- [P] 任务 = 不同文件，无依赖，可并行
- [Story] 标签映射任务到特定用户故事以便追踪
- 每个用户故事应可独立完成和测试
- 每个任务或逻辑组完成后提交
- 在任何检查点停止以独立验证故事
- 避免：模糊任务、同文件冲突、破坏独立性的跨故事依赖
- **性能优先**: 所有设计决策以不影响业务 API 性能为前提
- **TDD 模式**: 先写测试（红灯），再实现功能（绿灯），覆盖率目标 80%
