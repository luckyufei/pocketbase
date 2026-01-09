# Implementation Plan: Native Analytics (`_events`)

**Branch**: `007-native-analytics` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-native-analytics/spec.md`

## Summary

为 PocketBase 新增原生用户行为分析引擎，采用 "Fork & Flush" 架构实现高性能事件采集。核心能力包括：JS SDK 自动埋点、流式聚合写入、双模存储适配（SQLite/PostgreSQL）、HyperLogLog UV 去重、Parquet 原始日志归档、Admin UI 仪表盘。

**Core Concept**: "Scientific Analytics" — Raw Data on Filesystem, Insights on Database.

## Technical Context

**Language/Version**: Go 1.24.0, TypeScript (JS SDK), Svelte (Admin UI)  
**Primary Dependencies**: 
- `github.com/parquet-go/parquet-go` (Parquet 文件写入)
- `github.com/axiomhq/hyperloglog` (UV 去重算法)
- `github.com/mssola/user_agent` (UA 解析)
- `github.com/aws/aws-sdk-go-v2` (S3 存储)

**Storage**: 
- 统计数据: SQLite (`pb_data/analytics.db`) / PostgreSQL (`UNLOGGED` 表)
- 原始日志: Parquet 文件 (本地 / S3)

**Testing**: Go test (backend), Vitest (JS SDK), Playwright (Admin UI)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Full Stack (Go Backend + JS SDK + Svelte UI)  
**Performance Goals**: 10,000 events/sec, Dashboard 查询 < 500ms, 业务 API 影响 < 1ms  
**Constraints**: 不存原始日志到 DB, 不做实时流, 不做深度分析  
**Scale/Scope**: 单机部署, 90 天数据保留

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 分析功能编译进主二进制，无外部依赖 |
| Zero External Dependencies | ✅ PASS | 使用 Go 库，不引入 ClickHouse/Kafka |
| Dual-Mode Storage | ✅ PASS | 自动适配 SQLite/PostgreSQL |
| No DB Bloat | ✅ PASS | 原始日志存 Parquet，不写 DB |
| Performance First | ✅ PASS | Fork & Flush 架构，内存聚合后批量写入 |
| Graceful Degradation | ✅ PASS | S3 不可用时仅丢弃 Raw Log，Stats 正常 |

## Project Structure

### Documentation (this feature)

```text
specs/007-native-analytics/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── analytics.go              # Analytics 主入口（配置、生命周期）
├── analytics_event.go        # AnalyticsEvent 结构体定义
├── analytics_buffer.go       # 内存缓冲区（Raw Buffer + Aggregation Map）
├── analytics_flusher.go      # 定时 Flush 逻辑（DB + Parquet）
├── analytics_repository.go   # 统计数据存储接口
├── analytics_repository_sqlite.go   # SQLite 实现
├── analytics_repository_pg.go       # PostgreSQL 实现
├── analytics_parquet.go      # Parquet 文件写入
├── analytics_s3.go           # S3 上传逻辑
├── analytics_hll.go          # HyperLogLog 封装
├── analytics_url.go          # URL Normalization
└── analytics_ua.go           # User-Agent 解析

apis/
├── analytics.go              # API 路由注册
├── analytics_events.go       # POST /api/analytics/events
├── analytics_stats.go        # GET /api/analytics/stats
├── analytics_pages.go        # GET /api/analytics/top-pages
├── analytics_sources.go      # GET /api/analytics/top-sources
├── analytics_devices.go      # GET /api/analytics/devices
└── analytics_download.go     # GET /api/analytics/raw-logs

migrations/
└── 1736400000_create_analytics.go  # 分析表迁移

# Frontend (JS SDK)
jssdk/
├── src/
│   └── analytics.ts          # pb.analytics 模块

# Admin UI (Svelte)
ui/src/
├── components/analytics/
│   ├── Dashboard.svelte      # 仪表盘主页面
│   ├── StatsCard.svelte      # 指标卡片组件
│   ├── TrendChart.svelte     # PV/UV 趋势图
│   ├── TopPages.svelte       # Top Pages 列表
│   ├── TopSources.svelte     # Top Sources 列表
│   ├── DevicePie.svelte      # 设备分布饼图
│   └── DateRangePicker.svelte # 日期选择器
└── routes/analytics/
    └── +page.svelte          # Analytics 路由页面
```

**Structure Decision**: 遵循现有 PocketBase 代码结构，核心逻辑放入 `core/` 目录，API 路由放入 `apis/` 目录。JS SDK 扩展现有 `jssdk/` 目录，Admin UI 在 `ui/` 中新增 analytics 组件。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PocketBase                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Ingestion Layer                               │   │
│  │  ┌─────────────┐                                                      │   │
│  │  │ JS SDK      │──── Beacon API ────▶ POST /api/analytics/events     │   │
│  │  │ (Browser)   │                                                      │   │
│  │  └─────────────┘                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Processing Layer (Memory)                        │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    AnalyticsBuffer                               │ │   │
│  │  │  ┌─────────────────┐        ┌─────────────────┐                 │ │   │
│  │  │  │   Raw Buffer    │        │  Aggregation    │                 │ │   │
│  │  │  │   ([]Event)     │        │  Map (HLL+PV)   │                 │ │   │
│  │  │  └────────┬────────┘        └────────┬────────┘                 │ │   │
│  │  │           │                          │                           │ │   │
│  │  │           │ > 16MB                   │ every 10s                 │ │   │
│  │  │           ▼                          ▼                           │ │   │
│  │  │  ┌─────────────────┐        ┌─────────────────┐                 │ │   │
│  │  │  │ Parquet Writer  │        │   DB Flusher    │                 │ │   │
│  │  │  │ (Fork A)        │        │   (Fork B)      │                 │ │   │
│  │  │  └────────┬────────┘        └────────┬────────┘                 │ │   │
│  │  └───────────┼──────────────────────────┼──────────────────────────┘ │   │
│  └──────────────┼──────────────────────────┼────────────────────────────┘   │
│                 │                          │                                 │
│                 ▼                          ▼                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │     Storage Layer        │  │     Storage Layer         │                 │
│  │                          │  │                           │                 │
│  │  ┌────────────────────┐  │  │  ┌─────────────────────┐  │                 │
│  │  │ SQLite Mode        │  │  │  │ _analytics_daily    │  │                 │
│  │  │ pb_data/analytics/ │  │  │  │ _analytics_sources  │  │                 │
│  │  │ *.parquet          │  │  │  │ _analytics_devices  │  │                 │
│  │  └────────────────────┘  │  │  └─────────────────────┘  │                 │
│  │  ┌────────────────────┐  │  │                           │                 │
│  │  │ PG Mode            │  │  │  (SQLite: analytics.db)   │                 │
│  │  │ S3 Bucket          │  │  │  (PG: UNLOGGED tables)    │                 │
│  │  └────────────────────┘  │  │                           │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Query Layer                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │ /stats      │  │ /top-pages  │  │ /devices    │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  │                          │                                            │   │
│  │                          ▼                                            │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Admin UI Dashboard                         │    │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │    │   │
│  │  │  │ PV/UV    │  │ Trend    │  │ Top      │  │ Device   │      │    │   │
│  │  │  │ Cards    │  │ Chart    │  │ Pages    │  │ Pie      │      │    │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Fork & Flush 架构

事件进入内存后立即分流：
- **Fork A (Raw Buffer)**: 累积原始事件，超过 16MB 时写入 Parquet
- **Fork B (Aggregation Map)**: 实时聚合 PV/UV，每 10 秒 Flush 到 DB

### 2. HyperLogLog UV 去重

- 使用 `axiomhq/hyperloglog` 库实现概率性去重
- 每个 (date, path) 维护一个 HLL Sketch
- Flush 时执行 Read-Merge-Write：读取 DB 中的 HLL，合并内存 HLL，写回 DB
- 误差率 < 2%

### 3. URL Normalization

在 Ingestion 阶段清洗 URL：
- Strip Query: `/home?ref=twitter` → `/home`
- Strip Hash: `/home#top` → `/home`
- 保证 `_analytics_daily` 表的行数可控

### 4. Parquet Schema 设计

遵循 "Flat is better than Nested" 原则：
- 高频查询字段（`event`, `path`, `browser`）平铺为独立列
- 使用 Dictionary Encoding 压缩低基数字段
- 业务自定义属性存入 `props` JSON 字段

### 5. 双模存储适配

| 模式 | 原始日志 | 统计数据 |
|------|----------|----------|
| SQLite | `pb_data/analytics/*.parquet` | `pb_data/analytics.db` |
| PostgreSQL + S3 | S3 Bucket | `UNLOGGED` 表 |
| PostgreSQL (无 S3) | 丢弃 | `UNLOGGED` 表 |

## Complexity Tracking

> 无违规项，架构简单符合 Constitution 原则。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Parquet 写入失败 | Low | Medium | 记录错误日志，不影响 Stats 写入 |
| HLL 合并失败 | Low | Low | 降级为简单累加 |
| S3 不可用 | Medium | Low | 仅丢弃 Raw Log，Stats 正常 |
| 高并发事件冲击 | Medium | Medium | Ring Buffer 溢出丢弃策略 |
| 磁盘空间不足 | Low | Medium | Cron 自动清理过期数据 |

## Dependencies

### Go Dependencies (新增)

```go
require (
    github.com/parquet-go/parquet-go v0.23.0
    github.com/axiomhq/hyperloglog v0.0.0-20230201085229-3ddf4bad03dc
    github.com/mssola/user_agent v0.6.0
    github.com/aws/aws-sdk-go-v2 v1.25.0
    github.com/aws/aws-sdk-go-v2/service/s3 v1.50.0
)
```

### JS Dependencies (无新增)

使用现有 `pocketbase-js-sdk` 扩展 `pb.analytics` 模块。

### UI Dependencies (无新增)

使用现有 Svelte 技术栈，可能引入 Chart.js 或 ECharts 用于趋势图。
