# Feature Specification: Native Analytics (`_events`)

**Feature Branch**: `007-native-analytics`  
**Created**: 2026-01-09  
**Status**: Draft  
**Input**: Research document: `specs/_research/native-analytics.md`

## 1. Problem Essence (核心问题)

商业分析工具（如 GA）无法满足内网/私有化部署需求，而开源替代品（PostHog/Matomo）架构过重，运维成本高昂。
Hangar 需要一个 **单文件交付、双模自适应（SQLite/Postgres）、零运维成本** 的原生用户行为分析引擎。

**Core Concept**: "Scientific Analytics" — Raw Data on Filesystem, Insights on Database.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 前端自动埋点采集 (Priority: P1)

作为前端开发者，我希望 JS SDK 能够自动采集页面浏览和用户行为事件，只需一行代码接入，无需手动配置。

**Why this priority**: 这是分析功能的数据入口，没有数据采集就没有后续的一切分析能力。

**Independent Test**: 可以通过在前端引入 SDK，验证页面浏览事件是否自动发送到后端。

**Acceptance Scenarios**:

1. **Given** 前端已引入 PocketBase SDK, **When** 用户访问页面, **Then** 自动发送 `page_view` 事件到后端
2. **Given** 前端调用 `pb.analytics.track('click_buy', {price: 99})`, **When** 事件触发, **Then** 事件被批量缓存，5秒后或页面卸载时发送
3. **Given** 用户调用 `pb.analytics.optOut()`, **When** 后续访问页面, **Then** 不再发送任何事件（GDPR 合规）
4. **Given** 后端 `analyticsEnabled = false`, **When** SDK 初始化, **Then** 所有 track 方法静默失效，不发送请求

---

### User Story 2 - 查看流量概览仪表盘 (Priority: P1)

作为系统管理员，我希望能够在 Admin UI 中查看网站流量概览，包括 PV、UV、Top Pages、流量来源等核心指标。

**Why this priority**: 这是分析功能的核心价值，管理员需要快速了解网站运营状况。

**Independent Test**: 可以通过访问 Analytics 页面，验证是否能看到 PV/UV 趋势图和 Top Pages 列表。

**Acceptance Scenarios**:

1. **Given** 管理员已登录后台, **When** 点击左侧导航栏"Analytics"菜单, **Then** 显示分析仪表盘页面
2. **Given** 管理员在仪表盘页面, **When** 页面加载完成, **Then** 显示 PV、UV、Bounce Rate 等核心指标卡片
3. **Given** 管理员在仪表盘页面, **When** 选择"Last 7 Days"时间范围, **Then** 显示过去7天的 PV/UV 趋势折线图
4. **Given** 管理员在仪表盘页面, **When** 查看 Top Pages 列表, **Then** 显示按 PV 降序排列的页面路径列表
5. **Given** 管理员在仪表盘页面, **When** 查看 Top Sources 列表, **Then** 显示流量来源（如 Google、Direct）列表

---

### User Story 3 - 流式聚合写入 (Priority: P1)

作为系统架构师，我希望分析数据采用流式聚合写入策略，在内存中聚合后再批量写入数据库，以便在高并发场景下不影响核心业务性能。

**Why this priority**: 这是架构设计的核心原则，分析 IO 不能影响业务 IO，是系统高可用的基础保障。

**Independent Test**: 可以通过压力测试验证，在 1000 QPS 的事件写入下，业务 API 延迟增加不超过 1ms。

**Acceptance Scenarios**:

1. **Given** 事件到达后端, **When** 进入内存, **Then** 立即分流：Fork A 写入 Raw Buffer，Fork B 更新内存聚合 Map
2. **Given** 内存聚合 Map 存在数据, **When** 每 10 秒定时器触发, **Then** 执行 Read-Merge-Write 事务将聚合数据写入 `_analytics_daily` 表
3. **Given** Raw Buffer 累积超过 16MB, **When** Flush 触发, **Then** 将原始日志写入 Parquet 文件（SQLite 模式写本地，PG 模式写 S3）
4. **Given** 高并发事件写入, **When** 查询业务 API, **Then** 业务 API 延迟不受影响

---

### User Story 4 - 双模存储适配 (Priority: P1)

作为运维工程师，我希望分析功能能够自动适配 SQLite 和 PostgreSQL 两种部署模式，无需额外配置。

**Why this priority**: 统一逻辑、自适应存储是 Hangar 的核心架构原则。

**Independent Test**: 可以通过分别在 SQLite 和 PostgreSQL 模式下启动服务，验证分析功能正常工作。

**Acceptance Scenarios**:

1. **Given** SQLite 模式启动, **When** 事件写入, **Then** 原始日志存入 `pb_data/analytics/YYYY-MM-DD.parquet`，统计数据存入 `pb_data/analytics.db`
2. **Given** PostgreSQL 模式且已配置 S3, **When** 事件写入, **Then** 原始日志存入 S3 Bucket，统计数据存入 PG 的 `UNLOGGED` 表
3. **Given** PostgreSQL 模式但未配置 S3, **When** 事件写入, **Then** 仅存储统计数据，原始日志被丢弃，Dashboard 正常可用

---

### User Story 5 - UV 去重统计 (Priority: P2)

作为数据分析师，我希望 UV 统计能够正确去重，即使跨天查询也能得到准确的独立访客数。

**Why this priority**: UV 是核心指标之一，准确性直接影响分析结论的可信度。

**Independent Test**: 可以通过同一用户多次访问后查询 UV，验证 UV 值为 1 而非访问次数。

**Acceptance Scenarios**:

1. **Given** 同一用户在同一天访问 5 次, **When** 查询当天 UV, **Then** UV = 1
2. **Given** 同一用户跨天访问, **When** 查询多天合并 UV, **Then** 使用 HyperLogLog 合并算法得到准确的去重 UV
3. **Given** 内存中有新的 UV 数据, **When** Flush 到数据库, **Then** 执行 Read-Merge-Write：读取 DB 中的 HLL Sketch，合并内存 HLL，写回 DB

---

### User Story 6 - 下载原始日志 (Priority: P3)

作为数据分析师，我希望能够下载原始事件日志（Parquet 格式），以便使用 DuckDB/Python 进行深度分析。

**Why this priority**: 这是高级分析功能，在核心 Dashboard 完成后再实现。

**Independent Test**: 可以通过点击"Download Raw Logs"按钮，验证能够下载指定日期的 Parquet 文件。

**Acceptance Scenarios**:

1. **Given** 管理员在仪表盘页面, **When** 点击"Download Raw Logs"下拉菜单, **Then** 显示可下载的日期列表
2. **Given** SQLite 模式, **When** 点击下载某日期的日志, **Then** 直接下载本地 `.parquet` 文件
3. **Given** PostgreSQL 模式, **When** 点击下载某日期的日志, **Then** 后端生成 S3 Presigned URL 并重定向下载

---

### User Story 7 - 数据自动清理 (Priority: P3)

作为系统管理员，我希望系统能够自动清理过期的分析数据，避免数据无限增长占用存储空间。

**Why this priority**: 数据清理是运维便利性功能，在基础功能完成后再实现。

**Independent Test**: 可以通过等待超过保留期限后，验证旧数据是否被自动删除。

**Acceptance Scenarios**:

1. **Given** `analyticsRetention = 90`, **When** Cron 任务执行, **Then** 90 天前的统计数据和原始日志被自动删除
2. **Given** 数据被清理后, **When** 查看历史趋势, **Then** 只显示保留期内的数据

---

### Edge Cases

- 后端 `analyticsEnabled = false` 时，API 返回 404，SDK 静默失效
- 事件 URL 包含查询参数时，自动去参存储（`/home?ref=twitter` → `/home`）
- 事件 URL 包含 Hash 时，自动去除（`/home#top` → `/home`）
- Parquet 写入失败时，记录错误日志，不影响统计数据写入
- HLL 合并失败时，降级为简单累加（可能导致 UV 偏高）

## Requirements *(mandatory)*

### Functional Requirements

#### 数据采集层
- **FR-001**: JS SDK MUST 自动采集 `page_view` 事件，包含 `path`, `referrer`, `title` 等字段
- **FR-002**: JS SDK MUST 提供 `pb.analytics.track(event, props)` 方法供手动埋点
- **FR-003**: JS SDK MUST 支持事件批量缓存，5秒或页面卸载时使用 Beacon API 发送
- **FR-004**: JS SDK MUST 提供 `pb.analytics.optOut()` 方法支持 GDPR 合规
- **FR-005**: JS SDK MUST 提供 `pb.analytics.identify(props)` 方法关联登录用户

#### 数据处理层
- **FR-006**: 系统 MUST 实现 Fork & Flush 架构：事件进入内存后分流到 Raw Buffer 和 Aggregation Map
- **FR-007**: 系统 MUST 每 10 秒将内存聚合数据 Flush 到数据库
- **FR-008**: 系统 MUST 在 Raw Buffer 累积超过 16MB 时 Flush 到 Parquet 文件
- **FR-009**: 系统 MUST 在事件入库前执行 URL Normalization（去参、去 Hash）
- **FR-010**: 系统 MUST 使用 HyperLogLog 算法实现 UV 去重统计
- **FR-011**: 系统 MUST 在 Flush 时执行 Read-Merge-Write 事务合并 HLL Sketch

#### 存储层
- **FR-012**: SQLite 模式 MUST 将原始日志存入 `pb_data/analytics/YYYY-MM-DD.parquet`
- **FR-013**: SQLite 模式 MUST 将统计数据存入独立的 `pb_data/analytics.db`
- **FR-014**: PostgreSQL 模式 MUST 将原始日志存入配置的 S3 Bucket
- **FR-015**: PostgreSQL 模式 MUST 将统计数据存入 `UNLOGGED` 表
- **FR-016**: PostgreSQL 模式未配置 S3 时 MUST 降级为仅存储统计数据

#### API 层
- **FR-017**: 系统 MUST 提供 `POST /api/analytics/events` 接收事件数据
- **FR-018**: 系统 MUST 提供 `GET /api/analytics/stats` 查询统计数据
- **FR-019**: 系统 MUST 提供 `GET /api/analytics/top-pages` 查询 Top Pages
- **FR-020**: 系统 MUST 提供 `GET /api/analytics/top-sources` 查询流量来源
- **FR-021**: 系统 MUST 提供 `GET /api/analytics/devices` 查询设备分布
- **FR-022**: 系统 MUST 提供 `GET /api/analytics/raw-logs` 下载原始日志
- **FR-023**: 分析 API MUST 仅管理员可访问

#### Admin UI
- **FR-024**: 前端 MUST 在左侧导航栏新增"Analytics"菜单入口
- **FR-025**: 前端 MUST 展示 PV、UV、Bounce Rate 等核心指标卡片
- **FR-026**: 前端 MUST 展示 PV/UV 双轴折线趋势图
- **FR-027**: 前端 MUST 展示 Top Pages、Top Sources、Device 分布
- **FR-028**: 前端 MUST 支持日期范围选择（Today / Last 7 Days / Last 30 Days）
- **FR-029**: 前端 MUST 每 60 秒自动轮询更新数据
- **FR-030**: 前端 MUST 提供"Download Raw Logs"下拉菜单

#### 配置与清理
- **FR-031**: 系统 MUST 在 Settings 中提供 `analyticsEnabled` 开关（默认 true）
- **FR-032**: 系统 MUST 在 Settings 中提供 `analyticsS3Bucket` 配置项（PG 模式必填）
- **FR-033**: 系统 MUST 在 Settings 中提供 `analyticsRetention` 配置项（默认 90 天）
- **FR-034**: 系统 MUST 通过 Cron 任务自动清理过期数据

### Key Entities

#### Database Tables

**`_analytics_daily`** (核心指标表)
| Field | Type | Description |
|-------|------|-------------|
| `id` | text | PK, Hash(`date` + `path`) |
| `date` | text | `2026-01-09` |
| `path` | text | `/pricing` (已去参) |
| `total_pv` | number | 浏览量 (累加) |
| `total_uv` | blob | HLL Sketch (二进制) |
| `visitors` | number | 估算的 UV 值 (UI 直读) |
| `avg_dur` | number | 平均停留时长 (ms) |

**`_analytics_sources`** (来源表)
| Field | Type | Description |
|-------|------|-------------|
| `id` | text | PK, Hash(`date` + `source`) |
| `date` | text | 日期 |
| `source` | text | `google.com` |
| `visitors` | number | 访客数 |

**`_analytics_devices`** (设备表)
| Field | Type | Description |
|-------|------|-------------|
| `id` | text | PK, Hash(`date` + `browser` + `os`) |
| `date` | text | 日期 |
| `browser` | text | `Chrome` |
| `os` | text | `MacOS` |
| `visitors` | number | 访客数 |

#### Parquet Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UTF8 | UUID v7 (Sortable) |
| `ts` | TIMESTAMP(MILLIS) | 事件时间戳 |
| `event` | UTF8 (dict) | 事件名 |
| `uid` | UTF8 | Hangar User ID |
| `sid` | UTF8 | Session ID |
| `path` | UTF8 (dict) | 页面路径 |
| `query` | UTF8 | URL 参数 |
| `referrer` | UTF8 | 来源 URL |
| `title` | UTF8 | 页面标题 |
| `ip` | UTF8 | 客户端 IP |
| `ua` | UTF8 | User-Agent |
| `browser` | UTF8 (dict) | 浏览器名 |
| `os` | UTF8 (dict) | 操作系统 |
| `device` | UTF8 (dict) | 设备类型 |
| `lang` | UTF8 (dict) | 浏览器语言 |
| `props` | JSON | 业务自定义属性 |
| `perf_ms` | INT32 | 页面加载耗时 |

#### Go Structs

- **AnalyticsEvent**: 原始事件结构，对应 Parquet Schema
- **AnalyticsBuffer**: 内存缓冲区，包含 Raw Buffer 和 Aggregation Map
- **AnalyticsFlusher**: 负责定时 Flush 到 DB 和 Parquet
- **AnalyticsRepository**: 统计数据存储接口（SQLite/PostgreSQL 实现）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 事件采集延迟不超过 100ms（从 SDK 发送到后端确认）
- **SC-002**: 事件处理吞吐量 >= 10,000 events/sec（单节点）
- **SC-003**: 分析功能对业务 API 延迟影响不超过 1ms
- **SC-004**: Dashboard 查询响应时间不超过 500ms（30 天数据量）
- **SC-005**: HLL UV 估算误差不超过 2%
- **SC-006**: Parquet 文件压缩率 >= 10:1（相对原始 JSON）
- **SC-007**: 统计数据库大小在 90 天数据量下不超过 100MB
- **SC-008**: 系统可以持续运行 90 天以上，自动清理正常工作

## Boundaries (边界与约束)

1. **No `_events` Table in DB**: 绝对禁止将原始日志写入数据库表，这是系统崩溃的根源
2. **No Real-time Streaming**: UI 展示 T+10s 的数据是完全可接受的，不引入 WebSocket
3. **Graceful Degradation**: PG 模式下 S3 不可用时，仅丢弃 Raw Log，保留 Stats DB
4. **No Deep Analysis in Core**: Core 只提供 GA 核心 20% 能力，深度分析请下载 Parquet 离线处理

## Assumptions

- 系统已有管理员认证机制可复用
- 前端使用现有的 Svelte 技术栈
- Go 使用 `github.com/parquet-go/parquet-go` 库写入 Parquet
- HyperLogLog 使用 `github.com/axiomhq/hyperloglog` 库
- User-Agent 解析使用 `github.com/mssola/user_agent` 库
- **S3 操作复用内置轻量客户端** `tools/filesystem/internal/s3blob/s3`（已支持 Upload/Get/Delete/List，需新增 ~50 行 PresignedURL 方法）
