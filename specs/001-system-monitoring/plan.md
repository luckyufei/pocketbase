# Implementation Plan: System Monitoring & High Availability

**Branch**: `001-system-monitoring` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-system-monitoring/spec.md`

## Summary

为 Pocketbase 新增系统监控与高可用功能，采用双数据库隔离架构（`metrics.db` 独立于 `data.db`），实现系统指标采集、存储和可视化。后端使用 Go 原生采集器，前端在现有 Svelte UI 中新增监控仪表盘页面。

## Technical Context

**Language/Version**: Go 1.24.0 (backend), JavaScript/Svelte 4.x (frontend)  
**Primary Dependencies**: 
- Backend: pocketbase/dbx, modernc.org/sqlite, runtime (Go 标准库)
- Frontend: Svelte 4, Chart.js 4.x, svelte-spa-router  
**Storage**: SQLite (metrics.db - 独立监控数据库)  
**Testing**: Go test (backend), 手动测试 (frontend)  
**Target Platform**: Linux/macOS/Windows 服务器, 现代浏览器  
**Project Type**: Web 应用 (Go backend + Svelte frontend)  
**Performance Goals**: 监控数据查询 < 1s, 对业务延迟影响 < 1ms  
**Constraints**: 监控数据库使用 `synchronous=OFF`, 7天数据保留  
**Scale/Scope**: 单机部署, 7天历史数据 (~10080 条记录)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 监控功能编译进主二进制，无外部依赖 |
| Zero External Dependencies | ✅ PASS | 使用 Go 标准库 + 现有 SQLite，不引入 Prometheus 等 |
| Physical DB Isolation | ✅ PASS | metrics.db 与 data.db 完全隔离 |
| Async Non-blocking | ✅ PASS | 使用 goroutine + ring buffer 异步采集 |

## Project Structure

### Documentation (this feature)

```text
specs/001-system-monitoring/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── metrics-api.yaml # OpenAPI spec
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── metrics_db.go           # MetricsDB 初始化和连接管理
├── metrics_collector.go    # 指标采集器 (goroutine + ticker)
└── metrics_model.go        # SystemMetrics 数据模型

apis/
└── metrics.go              # GET /api/system/metrics API

# Frontend (Svelte)
ui/src/
├── routes.js               # 新增 /monitoring 路由
└── components/
    └── monitoring/
        ├── PageMonitoring.svelte      # 监控主页面
        ├── MetricsChart.svelte        # 趋势图组件 (基于 Chart.js)
        ├── MetricsCard.svelte         # 指标卡片组件
        └── TimeRangeSelector.svelte   # 时间范围选择器
```

**Structure Decision**: 遵循现有 pocketbase 代码结构，后端代码放入 `core/` 和 `apis/` 目录，前端代码放入 `ui/src/components/monitoring/` 目录。

## Complexity Tracking

> 无违规项，架构简单符合 Constitution 原则。
