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

## Phase 1: Setup (共享基础设施)

**Purpose**: 项目初始化和基本结构创建

- [ ] T001 创建 `migrations/1736400000_create_analytics.go`，定义分析表迁移脚本骨架
- [ ] T002 [P] 在 `core/analytics_event.go` 中定义 AnalyticsEvent 结构体
- [ ] T003 [P] 在 `core/analytics.go` 中创建 Analytics 主入口结构体骨架
- [ ] T004 [P] 在 `core/analytics_repository.go` 中定义 AnalyticsRepository 接口

---

## Phase 2: Foundational (阻塞性前置条件)

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

### 数据库 Schema

- [ ] T005 在 `migrations/1736400000_create_analytics.go` 中实现 `_analytics_daily` 表创建（SQLite）
- [ ] T006 在 `migrations/1736400000_create_analytics.go` 中实现 `_analytics_sources` 表创建（SQLite）
- [ ] T007 在 `migrations/1736400000_create_analytics.go` 中实现 `_analytics_devices` 表创建（SQLite）
- [ ] T008 [P] 在 `core/analytics_repository_pg.go` 中实现 PostgreSQL `UNLOGGED` 表创建

### 核心组件

- [ ] T009 在 `core/analytics_url.go` 中实现 `NormalizeURL()` URL 清洗函数（去参、去 Hash）
- [ ] T010 [P] 在 `core/analytics_ua.go` 中实现 `ParseUserAgent()` UA 解析函数
- [ ] T011 [P] 在 `core/analytics_hll.go` 中封装 HyperLogLog 操作（New, Add, Merge, Count, Bytes）
- [ ] T012 在 `core/analytics.go` 中实现 Analytics 配置加载（Enabled, Retention, S3Bucket）
- [ ] T013 在 `core/base.go` 或 `core/app.go` 中集成 Analytics 到 App 结构体

### 单元测试

- [ ] T014 编写 `core/analytics_url_test.go` URL Normalization 测试
- [ ] T015 [P] 编写 `core/analytics_ua_test.go` UA 解析测试
- [ ] T016 [P] 编写 `core/analytics_hll_test.go` HLL 操作测试

**Checkpoint**: 基础设施就绪

---

## Phase 3: User Story 1 - 前端自动埋点采集 (Priority: P1) 🎯 MVP

**Goal**: JS SDK 能够自动采集页面浏览和用户行为事件

**Independent Test**: 
- 在前端引入 SDK，验证 `page_view` 事件自动发送
- 调用 `pb.analytics.track('click', {})` 验证事件被缓存并发送

### Backend API

- [ ] T017 [US1] 在 `apis/analytics.go` 中注册 `/api/analytics/events` 路由
- [ ] T018 [US1] 在 `apis/analytics_events.go` 中实现 `POST /api/analytics/events` 接收事件
- [ ] T019 [US1] 在 `apis/analytics_events.go` 中实现批量事件解析和验证
- [ ] T020 [US1] 在 `apis/analytics_events.go` 中实现事件入队到 AnalyticsBuffer

### JS SDK

- [ ] T021 [P] [US1] 在 `jssdk/src/analytics.ts` 中创建 Analytics 类骨架
- [ ] T022 [US1] 在 `jssdk/src/analytics.ts` 中实现 `track(event, props)` 方法
- [ ] T023 [US1] 在 `jssdk/src/analytics.ts` 中实现事件批量缓存（5秒或页面卸载）
- [ ] T024 [US1] 在 `jssdk/src/analytics.ts` 中实现 Beacon API 发送
- [ ] T025 [US1] 在 `jssdk/src/analytics.ts` 中实现自动 `page_view` 采集
- [ ] T026 [US1] 在 `jssdk/src/analytics.ts` 中实现 `optOut()` GDPR 合规方法
- [ ] T027 [US1] 在 `jssdk/src/analytics.ts` 中实现 `identify(props)` 用户关联方法
- [ ] T028 [US1] 在 `jssdk/src/analytics.ts` 中实现后端 `analyticsEnabled` 检测

### 测试

- [ ] T029 [US1] 编写 `apis/analytics_events_test.go` 事件接收 API 测试
- [ ] T030 [US1] 编写 `jssdk/tests/analytics.test.ts` SDK 测试

**Checkpoint**: User Story 1 完成 - 事件采集就绪

---

## Phase 4: User Story 3 - 流式聚合写入 (Priority: P1) 🎯 MVP

**Goal**: 事件在内存中聚合后批量写入数据库，不影响业务性能

**Independent Test**: 
- 发送 1000 个事件，验证 DB 只有聚合后的记录
- 压力测试验证业务 API 延迟增加 < 1ms

### 内存缓冲区

- [ ] T031 [US3] 在 `core/analytics_buffer.go` 中实现 AnalyticsBuffer 结构体
- [ ] T032 [US3] 在 `core/analytics_buffer.go` 中实现 `Push(event)` 事件入队
- [ ] T033 [US3] 在 `core/analytics_buffer.go` 中实现 Raw Buffer（[]Event）
- [ ] T034 [US3] 在 `core/analytics_buffer.go` 中实现 Aggregation Map（date+path → HLL+PV）
- [ ] T035 [US3] 在 `core/analytics_buffer.go` 中实现并发安全（sync.Mutex）

### DB Flusher

- [ ] T036 [US3] 在 `core/analytics_flusher.go` 中实现 Flusher 结构体
- [ ] T037 [US3] 在 `core/analytics_flusher.go` 中实现 10 秒定时器触发
- [ ] T038 [US3] 在 `core/analytics_flusher.go` 中实现 Read-Merge-Write 事务（HLL 合并）
- [ ] T039 [US3] 在 `core/analytics_flusher.go` 中实现 `_analytics_daily` 表更新
- [ ] T040 [US3] 在 `core/analytics_flusher.go` 中实现 `_analytics_sources` 表更新
- [ ] T041 [US3] 在 `core/analytics_flusher.go` 中实现 `_analytics_devices` 表更新

### Repository 实现

- [ ] T042 [P] [US3] 在 `core/analytics_repository_sqlite.go` 中实现 SQLite Repository
- [ ] T043 [P] [US3] 在 `core/analytics_repository_pg.go` 中实现 PostgreSQL Repository
- [ ] T044 [US3] 在 `core/analytics_repository_sqlite.go` 中实现 `Upsert()` 方法（PV 累加，HLL 合并）
- [ ] T045 [US3] 在 `core/analytics_repository_pg.go` 中实现 `Upsert()` 方法

### 测试

- [ ] T046 [US3] 编写 `core/analytics_buffer_test.go` 缓冲区测试
- [ ] T047 [US3] 编写 `core/analytics_flusher_test.go` Flusher 测试
- [ ] T048 [US3] 编写 `core/analytics_repository_sqlite_test.go` SQLite Repository 测试

**Checkpoint**: User Story 3 完成 - 流式聚合就绪

---

## Phase 5: User Story 4 - 双模存储适配 (Priority: P1) 🎯 MVP

**Goal**: 自动适配 SQLite 和 PostgreSQL 两种部署模式

**Independent Test**: 
- SQLite 模式启动，验证 `pb_data/analytics.db` 创建
- PostgreSQL 模式启动，验证 `UNLOGGED` 表创建

### Parquet 写入

- [ ] T049 [US4] 在 `core/analytics_parquet.go` 中实现 Parquet Writer 结构体
- [ ] T050 [US4] 在 `core/analytics_parquet.go` 中实现 `Write(events)` 批量写入
- [ ] T051 [US4] 在 `core/analytics_parquet.go` 中实现 ZSTD 压缩配置
- [ ] T052 [US4] 在 `core/analytics_parquet.go` 中实现按日期分区文件名

### S3 上传

- [ ] T053 [P] [US4] 在 `core/analytics_s3.go` 中实现 S3 Client 初始化
- [ ] T054 [P] [US4] 在 `core/analytics_s3.go` 中实现 `Upload(filename, data)` 上传方法
- [ ] T055 [US4] 在 `core/analytics_s3.go` 中实现 `GeneratePresignedURL()` 预签名下载

### 模式适配

- [ ] T056 [US4] 在 `core/analytics_flusher.go` 中实现 Raw Buffer > 16MB 触发 Parquet 写入
- [ ] T057 [US4] 在 `core/analytics_flusher.go` 中实现 SQLite 模式写本地文件
- [ ] T058 [US4] 在 `core/analytics_flusher.go` 中实现 PostgreSQL 模式写 S3
- [ ] T059 [US4] 在 `core/analytics_flusher.go` 中实现 PostgreSQL 无 S3 时降级（丢弃 Raw Log）

### 测试

- [ ] T060 [US4] 编写 `core/analytics_parquet_test.go` Parquet 写入测试
- [ ] T061 [US4] 编写 `core/analytics_s3_test.go` S3 上传测试（Mock）

**Checkpoint**: MVP 完成 (User Story 1, 3, 4) - 数据采集和存储就绪

---

## Phase 6: User Story 2 - 查看流量概览仪表盘 (Priority: P1)

**Goal**: Admin UI 展示 PV/UV 趋势图和 Top Pages 列表

**Independent Test**: 
- 访问 Analytics 页面，验证 PV/UV 卡片显示
- 选择 Last 7 Days，验证趋势图正确渲染

### Query API

- [ ] T062 [US2] 在 `apis/analytics_stats.go` 中实现 `GET /api/analytics/stats` 统计查询
- [ ] T063 [US2] 在 `apis/analytics_pages.go` 中实现 `GET /api/analytics/top-pages` Top Pages 查询
- [ ] T064 [US2] 在 `apis/analytics_sources.go` 中实现 `GET /api/analytics/top-sources` 来源查询
- [ ] T065 [US2] 在 `apis/analytics_devices.go` 中实现 `GET /api/analytics/devices` 设备查询
- [ ] T066 [US2] 在 `apis/analytics.go` 中实现日期范围参数解析（today, 7d, 30d）
- [ ] T067 [US2] 在 `apis/analytics.go` 中实现管理员权限验证

### Admin UI

- [ ] T068 [P] [US2] 在 `ui/src/components/analytics/StatsCard.svelte` 中实现指标卡片组件
- [ ] T069 [P] [US2] 在 `ui/src/components/analytics/TrendChart.svelte` 中实现 PV/UV 趋势图
- [ ] T070 [P] [US2] 在 `ui/src/components/analytics/TopPages.svelte` 中实现 Top Pages 列表
- [ ] T071 [P] [US2] 在 `ui/src/components/analytics/TopSources.svelte` 中实现 Top Sources 列表
- [ ] T072 [P] [US2] 在 `ui/src/components/analytics/DevicePie.svelte` 中实现设备分布饼图
- [ ] T073 [US2] 在 `ui/src/components/analytics/DateRangePicker.svelte` 中实现日期选择器
- [ ] T074 [US2] 在 `ui/src/components/analytics/Dashboard.svelte` 中组装仪表盘主页面
- [ ] T075 [US2] 在 `ui/src/routes/analytics/+page.svelte` 中创建 Analytics 路由页面
- [ ] T076 [US2] 在 `ui/src/` 左侧导航栏中添加 "Analytics" 菜单入口
- [ ] T077 [US2] 在 `ui/src/components/analytics/Dashboard.svelte` 中实现 60 秒自动轮询

### 测试

- [ ] T078 [US2] 编写 `apis/analytics_stats_test.go` 统计 API 测试
- [ ] T079 [US2] 编写 `apis/analytics_pages_test.go` Top Pages API 测试

**Checkpoint**: User Story 2 完成 - Dashboard 可用

---

## Phase 7: User Story 5 - UV 去重统计 (Priority: P2)

**Goal**: UV 统计正确去重，跨天查询使用 HLL 合并

**Independent Test**: 
- 同一用户访问 5 次，验证 UV = 1
- 跨天查询，验证 HLL 合并结果正确

### HLL 合并

- [ ] T080 [US5] 在 `core/analytics_repository_sqlite.go` 中实现跨天 HLL 合并查询
- [ ] T081 [US5] 在 `core/analytics_repository_pg.go` 中实现跨天 HLL 合并查询
- [ ] T082 [US5] 在 `apis/analytics_stats.go` 中实现多天 UV 合并计算

### 测试

- [ ] T083 [US5] 编写 HLL 跨天合并集成测试

**Checkpoint**: User Story 5 完成 - UV 去重准确

---

## Phase 8: User Story 6 - 下载原始日志 (Priority: P3)

**Goal**: 管理员可以下载 Parquet 格式的原始日志

**Independent Test**: 
- 点击下载按钮，验证能下载 Parquet 文件
- PostgreSQL 模式，验证 S3 Presigned URL 生成

### Download API

- [ ] T084 [US6] 在 `apis/analytics_download.go` 中实现 `GET /api/analytics/raw-logs` 列出可下载日期
- [ ] T085 [US6] 在 `apis/analytics_download.go` 中实现 `GET /api/analytics/raw-logs/:date` 下载指定日期
- [ ] T086 [US6] 在 `apis/analytics_download.go` 中实现 SQLite 模式直接返回本地文件
- [ ] T087 [US6] 在 `apis/analytics_download.go` 中实现 PostgreSQL 模式返回 S3 Presigned URL

### Admin UI

- [ ] T088 [US6] 在 `ui/src/components/analytics/Dashboard.svelte` 中添加 "Download Raw Logs" 下拉菜单
- [ ] T089 [US6] 在 `ui/src/components/analytics/Dashboard.svelte` 中实现日期列表加载和下载触发

### 测试

- [ ] T090 [US6] 编写 `apis/analytics_download_test.go` 下载 API 测试

**Checkpoint**: User Story 6 完成 - 原始日志可下载

---

## Phase 9: User Story 7 - 数据自动清理 (Priority: P3)

**Goal**: 系统自动清理过期的分析数据

**Independent Test**: 
- 设置 `analyticsRetention = 1`，验证 1 天前的数据被清理

### Cron 清理

- [ ] T091 [US7] 在 `core/analytics.go` 中实现 `Prune()` 清理方法
- [ ] T092 [US7] 在 `core/analytics_repository_sqlite.go` 中实现 `DeleteBefore(date)` 统计数据清理
- [ ] T093 [US7] 在 `core/analytics_repository_pg.go` 中实现 `DeleteBefore(date)` 统计数据清理
- [ ] T094 [US7] 在 `core/analytics_parquet.go` 中实现本地 Parquet 文件清理
- [ ] T095 [US7] 在 `core/analytics_s3.go` 中实现 S3 对象清理
- [ ] T096 [US7] 在 `core/analytics.go` 中注册 Cron 定时任务（每天凌晨执行）

### 配置

- [ ] T097 [US7] 在 Admin UI Settings 中添加 `analyticsEnabled` 开关
- [ ] T098 [US7] 在 Admin UI Settings 中添加 `analyticsS3Bucket` 配置项
- [ ] T099 [US7] 在 Admin UI Settings 中添加 `analyticsRetention` 配置项

### 测试

- [ ] T100 [US7] 编写 `core/analytics_prune_test.go` 清理逻辑测试

**Checkpoint**: User Story 7 完成 - 自动清理就绪

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的改进

- [ ] T101 [P] 在 `core/analytics_buffer.go` 中添加 Ring Buffer 溢出丢弃策略
- [ ] T102 [P] 在 `core/analytics.go` 中添加优雅关闭（Flush 所有缓冲区）
- [ ] T103 [P] 在 `apis/analytics.go` 中添加请求日志（不打印敏感数据）
- [ ] T104 在 `core/analytics_flusher.go` 中添加 Flush 失败重试逻辑
- [ ] T105 在 `core/analytics_hll.go` 中添加 HLL 合并失败降级逻辑
- [ ] T106 运行完整集成测试，验证所有功能正常
- [ ] T107 运行性能测试，验证 10,000 events/sec 吞吐量
- [ ] T108 验证覆盖率 >= 80%

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
