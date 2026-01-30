# Feature Specification: Process Manager UI

**Feature Branch**: `019-process-manager-ui`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: 为 `ui-v2` 提供进程管理的管理页面，对标 PM2 monit + 进程管理命令，提供一站式进程监控和管理能力

## 背景与动机

PocketBase 已集成 `processman` 插件提供后端进程管理能力（参见 [002-process-manager-plugin](../002-process-manager-plugin/spec.md)），但目前缺少可视化管理界面。运维人员需要通过 REST API 或查看日志来了解进程状态，体验不佳。

本需求参考 PM2 monit 的核心功能，在 Admin UI 中提供：

1. **实时进程监控面板** - 类似 `pm2 monit` 的实时状态视图
2. **进程管理操作** - 类似 `pm2 start/stop/restart/delete` 的 UI 操作
3. **日志实时查看** - 类似 `pm2 logs` 的实时日志流
4. **进程详情面板** - 显示进程元数据、环境变量、性能指标

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 实时查看所有进程状态 (Priority: P1)

作为运维工程师，我希望在 Admin UI 中一眼看到所有 Sidecar 进程的运行状态，包括 PID、运行时长、内存占用、重启次数等关键指标。

**Why this priority**: 这是最基础的监控需求，用户需要快速了解系统健康状态。

**Independent Test**: 访问进程管理页面，验证能看到所有配置进程的状态列表。

**Acceptance Scenarios**:

1. **Given** 有 3 个进程配置在 `pb_processes.json`，**When** 访问 Settings → Processes 页面，**Then** 显示 3 个进程卡片，每个包含 ID、状态、PID、运行时长
2. **Given** 某进程状态为 `running`，**When** 页面加载，**Then** 显示绿色状态指示器和实时 uptime 计时
3. **Given** 某进程状态为 `failed`，**When** 页面加载，**Then** 显示红色状态指示器和最后错误信息

---

### User Story 2 - 重启/停止进程 (Priority: P1)

作为运维工程师，我希望通过点击按钮快速重启或停止指定进程，而无需使用命令行或调用 API。

**Why this priority**: 快速响应问题是运维的核心需求，UI 操作比 API 调用更高效。

**Independent Test**: 在进程卡片上点击"重启"按钮，验证进程被重启且页面状态更新。

**Acceptance Scenarios**:

1. **Given** 进程 "ai-agent" 状态为 `running`，**When** 点击重启按钮，**Then** 进程被终止并重新启动，状态经历 `stopping → starting → running`
2. **Given** 进程 "ai-agent" 状态为 `running`，**When** 点击停止按钮，**Then** 进程被终止，状态变为 `stopped`
3. **Given** 进程 "ai-agent" 状态为 `stopped`，**When** 点击启动按钮，**Then** 进程被启动，状态变为 `running`

---

### User Story 3 - 实时日志流查看 (Priority: P1)

作为开发者，我希望在 UI 中实时查看指定进程的 stdout/stderr 输出，用于调试和问题排查。

**Why this priority**: 日志是排查问题的第一手资料，实时日志流大幅提升调试效率。

**Independent Test**: 选择某进程，打开日志面板，验证能看到该进程最近的日志输出。

**Acceptance Scenarios**:

1. **Given** 选中进程 "ai-agent"，**When** 打开日志面板，**Then** 显示该进程最近 100 行日志，stdout 和 stderr 用不同颜色区分
2. **Given** 日志面板已打开，**When** 进程产生新的日志输出，**Then** 新日志实时追加到面板底部（WebSocket/SSE 推送）
3. **Given** 日志内容很长，**When** 滚动到面板顶部，**Then** 自动暂停实时更新，允许用户查看历史日志

---

### User Story 4 - 进程概览仪表盘 (Priority: P2)

作为运维工程师，我希望在页面顶部看到进程总览统计，快速了解有多少进程在运行、有多少失败。

**Why this priority**: 概览信息帮助用户快速判断系统整体健康度。

**Independent Test**: 访问进程管理页面，验证顶部显示进程统计卡片。

**Acceptance Scenarios**:

1. **Given** 有 5 个进程，3 个 running、1 个 stopped、1 个 failed，**When** 页面加载，**Then** 顶部显示 "运行中: 3 | 已停止: 1 | 失败: 1 | 总计: 5"
2. **Given** 所有进程正常运行，**When** 页面加载，**Then** 概览卡片显示绿色健康状态
3. **Given** 有进程处于 failed 状态，**When** 页面加载，**Then** 概览卡片显示红色警告状态

---

### User Story 5 - 进程详情面板 (Priority: P2)

作为开发者，我希望点击进程卡片后能查看详细信息，包括配置、环境变量、启动时间、重启历史等。

**Why this priority**: 详情信息帮助开发者理解进程配置和诊断问题。

**Independent Test**: 点击进程卡片，验证详情面板显示完整的配置信息。

**Acceptance Scenarios**:

1. **Given** 点击进程 "ai-agent" 卡片，**When** 详情面板打开，**Then** 显示: ID、Command、Args、Cwd、Interpreter、MaxRetries
2. **Given** 进程配置了环境变量，**When** 查看详情，**Then** 显示环境变量列表（敏感变量如 API_KEY 显示为 `****`）
3. **Given** 进程有重启历史，**When** 查看详情，**Then** 显示重启次数和最近重启时间

---

### User Story 6 - 自动刷新与手动刷新 (Priority: P2)

作为运维工程师，我希望进程状态能自动刷新，同时也能手动触发刷新。

**Why this priority**: 实时监控需要自动更新，手动刷新用于确认最新状态。

**Independent Test**: 停留在页面 30 秒，验证状态自动更新；点击刷新按钮，验证立即获取最新状态。

**Acceptance Scenarios**:

1. **Given** 页面已加载，**When** 等待 10 秒，**Then** 进程状态自动刷新（通过轮询或 WebSocket）
2. **Given** 点击刷新按钮，**When** API 响应返回，**Then** 页面显示最新状态并显示"刷新成功"提示
3. **Given** 网络断开，**When** 自动刷新失败，**Then** 显示"连接中断"警告，不影响已显示的数据

---

### User Story 7 - 进程筛选与搜索 (Priority: P3)

作为运维工程师，当有很多进程时，我希望能按状态筛选或按名称搜索，快速定位目标进程。

**Why this priority**: 在进程数量较多时提升操作效率。

**Independent Test**: 输入进程 ID 关键字，验证列表只显示匹配的进程。

**Acceptance Scenarios**:

1. **Given** 有 10 个进程，**When** 选择筛选条件 "Running"，**Then** 只显示状态为 running 的进程
2. **Given** 有 10 个进程，**When** 在搜索框输入 "agent"，**Then** 只显示 ID 包含 "agent" 的进程
3. **Given** 筛选结果为空，**When** 页面渲染，**Then** 显示 "没有匹配的进程" 提示

---

### User Story 8 - 批量操作 (Priority: P3)

作为运维工程师，我希望能选中多个进程后批量重启或停止。

**Why this priority**: 在管理多个相似进程时提升效率。

**Independent Test**: 选中多个进程，点击批量重启，验证所有选中进程被重启。

**Acceptance Scenarios**:

1. **Given** 选中 3 个进程，**When** 点击"批量重启"，**Then** 3 个进程依次重启，显示进度反馈
2. **Given** 选中所有进程，**When** 点击"全部停止"，**Then** 弹出确认对话框，确认后停止所有进程
3. **Given** 批量操作进行中，**When** 用户关闭页面，**Then** 后台操作继续执行，不受影响

---

### Edge Cases

- 当 WebSocket 连接断开时，如何优雅降级到轮询？
- 当日志量过大（每秒 1000 行+）时，如何避免浏览器卡顿？
- 当进程状态快速变化时（如连续崩溃重启），如何避免 UI 闪烁？
- 当用户权限不足时（非 superuser），如何显示友好提示？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在 Settings 菜单下提供 "Processes" 入口
- **FR-002**: 系统 MUST 显示所有配置进程的列表，每个进程显示: ID、状态、PID、运行时长
- **FR-003**: 系统 MUST 支持对单个进程执行: 启动、停止、重启操作
- **FR-004**: 系统 MUST 显示进程状态统计概览 (running/stopped/failed 计数)
- **FR-005**: 系统 MUST 支持查看单个进程的详细配置和环境变量
- **FR-006**: 系统 MUST 支持实时查看单个进程的日志流
- **FR-007**: 系统 MUST 支持自动刷新进程状态（默认 5 秒间隔）
- **FR-008**: 系统 MUST 支持手动刷新进程状态
- **FR-009**: 系统 SHOULD 支持按状态筛选进程列表
- **FR-010**: 系统 SHOULD 支持按 ID 搜索进程
- **FR-011**: 系统 SHOULD 支持批量操作（重启/停止）多个进程
- **FR-012**: 系统 MUST 对所有操作要求 superuser 权限

### Non-Functional Requirements

- **NFR-001**: 页面首次加载时间 < 2 秒
- **NFR-002**: 进程状态更新延迟 < 5 秒
- **NFR-003**: 日志流延迟 < 1 秒
- **NFR-004**: 支持同时显示 50+ 进程不卡顿
- **NFR-005**: 日志面板支持缓存最近 1000 行日志

### Key Entities

- **ProcessState**: 进程运行时状态
  - ID、PID、Status、StartTime、Uptime、RestartCount、LastError

- **ProcessConfig**: 进程配置信息
  - ID、Command/Script、Args、Cwd、Env、Interpreter、MaxRetries、Backoff、DevMode

- **ProcessLog**: 日志条目
  - Timestamp、ProcessID、Stream (stdout/stderr)、Content

## UI/UX 设计

### 页面布局

```
┌────────────────────────────────────────────────────────────────────┐
│  Settings → Processes                                    [Refresh] │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ Running  │ │ Stopped  │ │  Failed  │ │  Total   │               │
│  │    3     │ │    1     │ │    1     │ │    5     │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
├────────────────────────────────────────────────────────────────────┤
│  [Filter: All ▼]  [Search: ________________]                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ● ai-agent                          Running    PID: 4021    │   │
│  │   python3 agent.py                  Uptime: 2h 30m         │   │
│  │                                      Restarts: 3           │   │
│  │                            [Logs] [Details] [Restart] [Stop]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ○ pdf-parser                        Stopped    PID: -       │   │
│  │   node worker.js                    Uptime: -              │   │
│  │                                      Restarts: 0           │   │
│  │                            [Logs] [Details] [Start]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✕ email-worker                      Failed     PID: -       │   │
│  │   python3 worker.py                 Uptime: -              │   │
│  │   Error: Connection refused         Restarts: 10           │   │
│  │                            [Logs] [Details] [Restart]      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 日志面板 (Drawer/Modal)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Logs: ai-agent                                    [Auto-scroll ✓] [X]│
├───────────────────────────────────────────────────────────────────────┤
│  10:00:01 [INFO]  Starting server on port 8001...                    │
│  10:00:02 [INFO]  Connected to database                              │
│  10:00:03 [INFO]  Loading model gpt-4...                             │
│  10:00:15 [INFO]  Model loaded successfully                          │
│  10:00:15 [INFO]  Server ready, listening on 0.0.0.0:8001            │
│  10:01:23 [ERROR] Request timeout for /api/chat                      │
│  10:01:24 [WARN]  Retrying request...                                │
│  ...                                                                 │
│  ▼ (新日志实时追加)                                                    │
└───────────────────────────────────────────────────────────────────────┘
```

### 详情面板 (Sheet)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Process Details: ai-agent                                        [X]│
├───────────────────────────────────────────────────────────────────────┤
│  Status          ● Running                                           │
│  PID             4021                                                │
│  Uptime          2h 30m 15s                                          │
│  Started At      2026-01-30 10:00:00                                 │
│  Restart Count   3                                                   │
│                                                                       │
│  ─────────────── Configuration ───────────────                        │
│  Command         python3                                             │
│  Script          agent.py                                            │
│  Args            ["--model", "gpt-4"]                                │
│  Working Dir     /app/agents                                         │
│  Interpreter     /app/agents/.venv/bin/python                        │
│  Max Retries     10                                                  │
│  Backoff         2s                                                  │
│  Dev Mode        true                                                │
│  Watch Paths     ["./src", "./config"]                               │
│                                                                       │
│  ─────────────── Environment Variables ───────────────                │
│  OPENAI_API_KEY  sk-****                                             │
│  PB_PORT         8090                                                │
│  PB_DATA_DIR     /app/pb_data                                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 状态颜色编码

| 状态 | 颜色 | 图标 |
|------|------|------|
| Running | 绿色 `green-500` | ● (实心圆) |
| Stopped | 灰色 `slate-400` | ○ (空心圆) |
| Failed | 红色 `red-500` | ✕ (叉号) |
| Starting | 蓝色 `blue-500` | ◐ (半圆/加载) |

## 技术实现

### 目录结构

```
ui-v2/src/
├── features/
│   └── processes/                    # 新增 feature 模块
│       ├── index.ts                  # 模块入口
│       ├── components/
│       │   ├── ProcessStats.tsx      # 统计概览卡片
│       │   ├── ProcessList.tsx       # 进程列表
│       │   ├── ProcessCard.tsx       # 单个进程卡片
│       │   ├── ProcessFilters.tsx    # 筛选器
│       │   ├── ProcessDetails.tsx    # 详情面板
│       │   └── ProcessLogs.tsx       # 日志面板
│       ├── hooks/
│       │   ├── useProcesses.ts       # 进程状态管理
│       │   └── useProcessLogs.ts     # 日志流管理
│       ├── store/
│       │   └── processesAtom.ts      # Jotai atoms
│       └── types/
│           └── index.ts              # TypeScript 类型
├── pages/
│   └── settings/
│       └── Processes.tsx             # 进程管理页面
└── router/
    └── index.tsx                     # 添加 /settings/processes 路由
```

### API 集成

使用现有的 REST API：

| 操作 | 方法 | 端点 |
|------|------|------|
| 获取进程列表 | GET | `/api/pm/list` |
| 重启进程 | POST | `/api/pm/{id}/restart` |
| 停止进程 | POST | `/api/pm/{id}/stop` |
| 启动进程 | POST | `/api/pm/{id}/start` |
| 获取日志 | GET | `/api/pm/{id}/logs?lines=100` |

### 日志实时流

方案对比：

| 方案 | 优点 | 缺点 |
|------|------|------|
| WebSocket | 真实实时 | 需要后端支持 |
| SSE | 简单实现 | 单向通信 |
| 轮询 (1s) | 最简单 | 延迟高、浪费带宽 |

**建议**: 首期使用轮询（1s 间隔），后续升级到 SSE。

### 状态管理

```typescript
// store/processesAtom.ts
import { atom } from 'jotai'

export interface ProcessState {
  id: string
  pid: number
  status: 'running' | 'stopped' | 'failed' | 'starting'
  startTime: string
  uptime: string
  restartCount: number
  lastError: string
}

export const processesAtom = atom<ProcessState[]>([])
export const processesLoadingAtom = atom(false)
export const selectedProcessAtom = atom<string | null>(null)
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能在 3 秒内定位到目标进程的状态
- **SC-002**: 重启/停止操作响应时间 < 500ms
- **SC-003**: 日志面板首次加载时间 < 1 秒
- **SC-004**: 页面支持同时显示 50 个进程不卡顿
- **SC-005**: 通过集成测试覆盖所有 User Story 的 Acceptance Scenarios
- **SC-006**: 代码遵循 ui-v2 的架构规范 (Feature-based 模块化)

## 依赖关系

- **后端依赖**: `processman` 插件 REST API (已完成)
- **UI 依赖**: shadcn/ui 组件库 (已集成)
- **架构依赖**: ui-v2 Feature-based 模块结构

## 开发里程碑

| 里程碑 | 内容 | 预估工作量 |
|--------|------|-----------|
| M1 | 进程列表 + 统计概览 | 1 天 |
| M2 | 启动/停止/重启操作 | 0.5 天 |
| M3 | 详情面板 | 0.5 天 |
| M4 | 日志面板 (轮询) | 1 天 |
| M5 | 筛选/搜索 | 0.5 天 |
| M6 | 自动刷新 + 优化 | 0.5 天 |

**总计**: 约 4 天

## 参考资料

- [PM2 Monit 文档](https://pm2.keymetrics.io/docs/usage/monitoring/)
- [processman 插件 spec](../002-process-manager-plugin/spec.md)
- [processman README](../../plugins/processman/README.md)
- [ui-v2 架构指南](../../ui-v2/CODEBUDDY.md)
