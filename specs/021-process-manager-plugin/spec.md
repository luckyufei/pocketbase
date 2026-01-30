# Feature Specification: Process Manager Plugin (processman)

**Feature Branch**: `002-process-manager-plugin`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: User description: "为 PocketBase 提供原生进程管理能力，将 PB 打造成 AI 时代的 BaaS + AaaS 平台，支持 Python/Node.js Sidecar 进程的生命周期管理"

## 背景与动机

在 AI 时代，PocketBase 作为后端服务需要与 Python（Agno、LangChain 等框架）或 Node.js（Vercel AI SDK 等）协作。基于 **"Complexity to System, Simplicity to User"** 原则，我们选择 **"Sidecar-less" Sidecar（共生进程模式）** 架构：

- **宿主 (Host)**: PocketBase (Go) 作为主进程
- **寄生 (Guest)**: Python/Node.js 运行时作为 PB 的子进程
- **目标**: 用户只需运行 `./pocketbase serve`，后台自动拉起 AI 引擎

该插件对标 PM2 的核心功能（20/80 原则），提取其 20% 精华功能覆盖 80% 使用场景。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 启动 Python AI Agent 随 PB 自动拉起 (Priority: P1)

作为 AI 应用开发者，我希望在启动 PocketBase 时，我的 Python AI Agent（如 Agno 服务）能够自动启动并保持运行，无需手动管理多个终端窗口。

**Why this priority**: 这是最核心的价值主张 —— 实现 "Single Artifact" 部署体验，用户无需关心进程管理细节。

**Independent Test**: 配置一个简单的 Python HTTP 服务，运行 `./pocketbase serve` 后，该服务应自动启动并能响应请求。

**Acceptance Scenarios**:

1. **Given** 已配置 `pb_processes.json` 包含 Python 进程定义，**When** 运行 `./pocketbase serve`，**Then** Python 进程自动启动且 PID 被记录
2. **Given** Python 进程正在运行，**When** PocketBase 接收到 SIGTERM 信号退出，**Then** Python 进程同步被终止（无孤儿进程）
3. **Given** Python 进程异常崩溃，**When** 进程退出，**Then** 系统自动重启该进程（Keep-Alive）

---

### User Story 2 - 进程崩溃自动恢复与指数退避 (Priority: P1)

作为运维工程师，我希望当 Sidecar 进程崩溃时，系统能自动重启它，但要避免因配置错误导致的无限快速重启（Flapping）。

**Why this priority**: 高可用性是生产环境的基本要求，指数退避机制防止系统资源耗尽。

**Independent Test**: 启动一个会立即退出的脚本，验证系统按指数退避策略重启，且不会导致 CPU 满载。

**Acceptance Scenarios**:

1. **Given** 进程运行超过 10 秒后崩溃，**When** 系统检测到退出，**Then** 立即重启（视为健康运行，重置退避计数器）
2. **Given** 进程启动后 3 秒内崩溃，**When** 连续崩溃 3 次，**Then** 重启延迟按 1s -> 2s -> 4s 指数增长
3. **Given** 退避延迟已达到 30 秒，**When** 进程再次崩溃，**Then** 延迟保持在 30 秒上限不再增长

---

### User Story 3 - Python Venv 自动探测 (Priority: P2)

作为 Python 开发者，我希望系统能自动识别并使用我项目中的虚拟环境（venv/.venv），避免手动配置 interpreter 路径。

**Why this priority**: 降低 Python 开发者的配置负担，解决 PM2 在 Python 场景下的痛点。

**Independent Test**: 在包含 `.venv` 目录的项目中配置进程（不指定 interpreter），验证系统自动使用 venv 中的 Python。

**Acceptance Scenarios**:

1. **Given** 进程工作目录下存在 `.venv/bin/python`，**When** 配置 `interpreter: "auto"` 或未指定 interpreter，**Then** 使用 `.venv/bin/python` 启动
2. **Given** 工作目录下存在 `venv/bin/python`（非 `.venv`），**When** 未指定 interpreter，**Then** 使用 `venv/bin/python` 启动
3. **Given** 工作目录下不存在任何 venv，**When** 未指定 interpreter，**Then** 降级使用系统 `python3` 命令

---

### User Story 4 - 开发模式热重载 (Priority: P2)

作为开发者，我希望在开发阶段修改 Python/Node.js 代码后，Sidecar 进程能自动重启，无需手动停止和启动。

**Why this priority**: 开发体验是 PM2 流行的关键因素，热重载显著提升开发效率。

**Independent Test**: 启动带有 `watch: true` 配置的进程，修改监听目录下的文件，验证进程自动重启。

**Acceptance Scenarios**:

1. **Given** 进程配置 `devMode: true` 和 `watchPaths: ["./agent"]`，**When** 修改 `./agent/main.py` 文件，**Then** 进程在 500ms 防抖后自动重启
2. **Given** 连续快速修改多个文件（500ms 内），**When** 防抖计时器触发，**Then** 只执行一次重启（避免重复重启）
3. **Given** 生产环境配置 `devMode: false`，**When** 文件发生变化，**Then** 不触发任何重启行为

---

### User Story 5 - 声明式配置文件 (Priority: P2)

作为 DevOps 工程师，我希望通过配置文件（`pb_processes.json`）管理 Sidecar 进程，而不是在代码中硬编码配置。

**Why this priority**: 配置与代码分离，支持运行时修改配置无需重新编译。

**Independent Test**: 创建 `pb_processes.json` 配置文件，启动 PB 后验证所有配置的进程按预期启动。

**Acceptance Scenarios**:

1. **Given** 工作目录下存在 `pb_processes.json`，**When** PocketBase 启动，**Then** 自动加载并启动配置的所有进程
2. **Given** 配置文件不存在，**When** PocketBase 启动，**Then** 正常启动但不启动任何 Sidecar 进程
3. **Given** 配置文件格式错误（JSON 语法错误），**When** PocketBase 启动，**Then** 记录错误日志但 PB 正常启动

---

### User Story 6 - REST API 控制面板 (Priority: P3)

作为运维工程师，我希望通过 REST API 查看和控制 Sidecar 进程状态，便于集成到现有监控系统或未来的 Admin UI。

**Why this priority**: 提供 API 而非 CLI 是符合 PocketBase 设计哲学的交互方式。

**Independent Test**: 启动进程后，通过 `GET /api/pm/list` 获取进程列表，通过 `POST /api/pm/:id/restart` 重启指定进程。

**Acceptance Scenarios**:

1. **Given** 已启动 Sidecar 进程，**When** 调用 `GET /api/pm/list`，**Then** 返回所有进程的 ID、PID、状态、运行时长
2. **Given** 进程 ID 为 "ai-agent"，**When** 调用 `POST /api/pm/ai-agent/restart`，**Then** 进程被终止并重新启动
3. **Given** 进程 ID 不存在，**When** 调用 `POST /api/pm/unknown/restart`，**Then** 返回 404 错误

---

### User Story 7 - 日志桥接到 PB Logger (Priority: P3)

作为开发者，我希望 Sidecar 进程的 stdout/stderr 输出能够统一显示在 PocketBase 的日志中，便于集中查看和排查问题。

**Why this priority**: 统一日志是 "Single Artifact" 体验的重要组成部分。

**Independent Test**: 启动会输出日志的 Python 脚本，验证输出内容带有进程标识前缀出现在 PB 日志中。

**Acceptance Scenarios**:

1. **Given** Python 进程向 stdout 输出 "Hello World"，**When** 日志被捕获，**Then** PB 日志显示 `[ai-agent][STDOUT] Hello World`
2. **Given** Python 进程向 stderr 输出错误信息，**When** 日志被捕获，**Then** PB 日志显示 `[ai-agent][STDERR] ...` 并标记为 Error 级别
3. **Given** 进程输出大量日志，**When** 系统处理日志，**Then** 不阻塞进程执行（异步处理）

---

### Edge Cases

- 当 Python 脚本依赖的外部服务（如 Redis）不可用时，如何处理启动失败？（应触发退避重试）
- 当 `pb_processes.json` 在运行时被修改，是否支持热加载？（v1 不支持，需重启 PB）
- 当进程组内子进程启动了 GPU 进程，Kill 时是否能清理干净？（使用 `Setpgid` 确保诛九族）
- 当 Windows 用户使用该功能，如何处理信号差异？（使用 `os/exec` 抽象 + Windows 特定路径）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 支持通过 `pb_processes.json` 配置文件定义 Sidecar 进程
- **FR-002**: 系统 MUST 在 PocketBase 启动时自动启动所有配置的 Sidecar 进程
- **FR-003**: 系统 MUST 在 PocketBase 退出时终止所有 Sidecar 进程（含子进程组）
- **FR-004**: 系统 MUST 实现进程崩溃后的自动重启（Keep-Alive）
- **FR-005**: 系统 MUST 实现指数退避策略防止 Flapping（上限 30 秒）
- **FR-006**: 系统 MUST 将 Sidecar 进程的 stdout/stderr 桥接到 PB Logger
- **FR-007**: 系统 MUST 支持 Python 虚拟环境自动探测（venv/.venv）
- **FR-008**: 系统 MUST 支持开发模式下的文件监听热重载（可配置开关）
- **FR-009**: 系统 MUST 提供 REST API 查询进程状态（ID、PID、运行时长、状态）
- **FR-010**: 系统 MUST 提供 REST API 重启/停止指定进程
- **FR-011**: 系统 MUST 支持向子进程注入环境变量（包括 PB_PORT、DB_DSN 等）

### Key Entities

- **ProcessConfig**: 单个 Sidecar 进程的配置定义
  - ID（唯一标识）、Command（命令）、Args（参数）、Cwd（工作目录）
  - Env（环境变量）、Interpreter（解释器，支持 "auto"）
  - MaxRetries、Backoff（韧性配置）
  - DevMode、WatchPaths（热重载配置）

- **ProcessState**: 运行时进程状态
  - ID、PID、Status（running/stopped/crashed）、StartTime、Uptime
  - RestartCount、LastError

- **ProcessManager**: 插件核心管理器
  - 管理多个 ProcessConfig 的生命周期
  - 与 PocketBase 生命周期钩子集成

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能在 5 分钟内完成首个 Python Sidecar 配置并成功启动
- **SC-002**: 进程崩溃后系统能在配置的退避时间内自动恢复，无需人工干预
- **SC-003**: 开发模式下代码修改到进程重启完成的延迟 < 2 秒
- **SC-004**: 插件代码量控制在 1000 行 Go 代码以内（PM2 核心功能的 5% 代码量实现 80% 功能）
- **SC-005**: REST API 响应时间 < 100ms
- **SC-006**: 通过集成测试覆盖所有 User Story 的 Acceptance Scenarios

---

## 技术实现指引

### 目录结构

```text
/plugins
  /processman
    - manager.go      // 插件入口，生命周期挂载
    - supervisor.go   // 单进程守护逻辑 (Resurrector)
    - watcher.go      // 文件监听 (Hot Reloader)
    - logger.go       // 日志桥接
    - interpreter.go  // 解释器自动探测
    - api.go          // REST API 路由
    - config.go       // 配置文件加载
```

### 配置文件示例 (`pb_processes.json`)

```json
[
  {
    "id": "ai-agent",
    "script": "./agent/main.py",
    "cwd": "./agent",
    "env": {
      "PORT": "8001",
      "OPENAI_API_KEY": "${OPENAI_API_KEY}"
    },
    "interpreter": "auto",
    "maxRetries": 5,
    "backoff": "1s",
    "devMode": true,
    "watchPaths": ["./agent"]
  },
  {
    "id": "pdf-parser",
    "command": "npm",
    "args": ["run", "start"],
    "cwd": "./parser-service",
    "devMode": false
  }
]
```

### 用户集成示例

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/processman"
)

func main() {
    app := pocketbase.New()

    // 方式一：自动加载 pb_processes.json
    processman.MustRegister(app, processman.Config{
        ConfigFile: "pb_processes.json", // 可选，默认值
    })

    // 方式二：代码配置（适合编译期确定的场景）
    // pm := processman.New(app)
    // pm.Register(processman.ProcessConfig{...})
    // pm.StartPlugin()

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

---

## 参考资料

- [PM2 官方文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [研究文档: 260130-pm.md](./specs/_research/%20260130-pm.md)
