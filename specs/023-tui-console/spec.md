# Feature Specification: PocketBase TUI Console

**Feature Branch**: `023-tui-console`  
**Created**: 2026-02-03  
**Status**: Draft  
**Input**: Research document: `specs/_research/260203-tui.md`  
**Reference**: `webui/` - React Admin UI 功能模块

## 1. Problem Essence (核心问题)

PocketBase 目前只提供 Web Admin UI，缺乏命令行交互界面。对于 Geek 用户、SSH 远程管理、服务器无 GUI 环境等场景，需要一个高效的 TUI (Terminal User Interface) 工具。

**目标**: 构建一个类似 Claude Code 风格的 TUI 控制台，通过 Omni-Bar (全能输入框) 实现 `/command` + `@resource` 的交互模式，为后续 AI 集成铺平道路。

## 2. Feature Mapping (功能映射)

### 2.1 WebUI vs TUI 功能对照

参考 `webui/src/features/` 和 `webui/src/pages/` 的功能模块：

| WebUI 功能模块 | TUI Phase 1 | TUI Phase 2 | 命令 |
|:---|:---:|:---:|:---|
| **collections/** - 集合管理 | ✅ 只读 | ✅ 读写 | `/cols`, `/schema @col` |
| **records/** - 记录管理 | ✅ 只读 | ✅ 读写 | `/view @col`, `/get @col:id` |
| **logs/** - 日志查看 | ✅ | ✅ | `/logs` |
| **monitoring/** - 系统监控 | ✅ | ✅ | `/monitor` |
| **traces/** - 请求追踪 | ⏳ Phase 2 | ✅ | `/traces` |
| **analytics/** - 流量分析 | ⏳ Phase 2 | ✅ | `/analytics` |
| **auth/** - 认证管理 | ❌ CLI 参数 | ⏳ | `--token` |
| **settings/** - 系统设置 | ⏳ Phase 2 | ✅ | `/settings` |
| **jobs/** - 后台任务 | ⏳ Phase 2 | ✅ | `/jobs` |
| **processes/** - 进程管理 | ⏳ Phase 2 | ✅ | `/procs` |
| **gateway/** - 网关管理 | ⏳ Phase 2 | ✅ | `/gateway` |

### 2.2 WebUI Settings 子模块映射

参考 `webui/src/pages/settings/`：

| Settings 页面 | TUI Phase | 命令 |
|:---|:---:|:---|
| Application.tsx | Phase 2 | `/settings app` |
| Mail.tsx | Phase 2 | `/settings mail` |
| Storage.tsx | Phase 2 | `/settings storage` |
| Backups.tsx | Phase 2 | `/backups` |
| Tokens.tsx | Phase 2 | `/settings tokens` |
| Admins.tsx | Phase 2 | `/admins` |
| Secrets.tsx | Phase 2 | `/secrets` |
| Crons.tsx | Phase 2 | `/crons` |
| Jobs.tsx | Phase 2 | `/jobs` |
| Processes.tsx | Phase 2 | `/procs` |
| Import.tsx | Phase 2 | `/import` |
| Export.tsx | Phase 2 | `/export` |
| AnalyticsSettings.tsx | Phase 2 | `/settings analytics` |

## 3. Tech Stack (技术栈)

参考 `webui/` 技术栈和 Claude Code 最佳实践：

| 层级 | 技术选型 | 说明 | WebUI 对应 |
|:---|:---|:---|:---|
| **Framework** | React + Ink v5 | React 渲染器，用于构建 CLI 应用 | React 18 |
| **Layout** | Yoga (Flexbox) | Facebook 的 Flexbox 布局引擎 | Tailwind CSS |
| **Styling** | Chalk | 终端文本颜色和样式 | shadcn/ui |
| **State** | Jotai | 轻量级原子化状态管理 | Jotai |
| **Language** | TypeScript | 类型安全 | TypeScript |
| **API Client** | PocketBase JS SDK | 与 PocketBase 服务端通信 | pocketbase |
| **Runtime/Build** | Bun | 高性能 JS 运行时，内置打包器和测试框架 | Bun + Vite |
| **Package Manager** | Bun | 内置包管理器，兼容 npm | Bun |

### 3.1 核心依赖

```json
{
  "dependencies": {
    "ink": "^5.0.1",
    "ink-text-input": "^6.0.0",
    "ink-select-input": "^6.0.0",
    "ink-spinner": "^5.0.0",
    "ink-table": "^3.1.0",
    "react": "^18.3.1",
    "jotai": "^2.x",
    "chalk": "^5.x",
    "pocketbase": "^0.26.5",
    "commander": "^12.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/bun": "latest",
    "ink-testing-library": "^4.x"
  }
}
```

### 3.2 为什么选择 Bun

| 特性 | Bun | Node.js + pnpm + vitest |
|------|-----|-------------------------|
| 包安装速度 | ~25x 更快 | 基准 |
| 测试运行 | 内置 `bun test` | 需要 vitest |
| TypeScript | 原生支持，无需编译 | 需要 tsc/tsup |
| 打包 | 内置 `bun build` | 需要 tsup/esbuild |
| 启动速度 | ~4x 更快 | 基准 |
| 兼容性 | 兼容 npm 生态 | 原生 |

## 4. User Scenarios & Testing *(mandatory)*

### User Story 1 - Omni-Bar 命令补全 (Priority: P0)

作为开发者，我希望在 Omni-Bar 中输入 `/` 时能看到可用命令列表，并支持 Tab 补全，以便快速执行操作。

**Why this priority**: Omni-Bar 是整个 TUI 的核心交互入口，没有它就无法进行任何操作。

**Independent Test**: 可以通过启动 TUI，输入 `/` 验证是否弹出命令补全菜单。

**Acceptance Scenarios**:

1. **Given** TUI 启动后 OmniBar 处于聚焦状态, **When** 用户输入 `/`, **Then** 显示可用命令列表
2. **Given** 命令列表已显示, **When** 用户输入 `/v`, **Then** 列表过滤为只显示 `/view`
3. **Given** 命令列表已显示, **When** 用户按 Tab 键, **Then** 自动补全选中的命令
4. **Given** 命令已补全, **When** 用户按空格, **Then** 切换到参数输入模式

---

### User Story 2 - 资源选择器 (Priority: P0)

作为开发者，我希望在输入 `@` 时能看到可用的 Collections 列表，以便快速选择操作目标。

**Why this priority**: `@resource` 是指定操作对象的核心机制，与命令同等重要。

**Independent Test**: 可以通过输入 `@` 验证是否从 PocketBase 获取并显示 Collections 列表。

**Acceptance Scenarios**:

1. **Given** 用户在 OmniBar 输入命令后, **When** 输入 `@`, **Then** 从 PocketBase 获取 Collections 列表并显示
2. **Given** Collections 列表已显示, **When** 用户输入 `@u`, **Then** 列表过滤为匹配 `u` 开头的集合
3. **Given** 列表中有选中项, **When** 用户按 Tab, **Then** 自动补全为 `@users` 形式
4. **Given** 网络请求失败, **When** 用户输入 `@`, **Then** 显示错误提示并允许重试

---

### User Story 3 - 浏览 Collections (Priority: P0)

作为开发者，我希望能够通过 `/cols` 命令查看所有 Collections，以便了解数据库结构。

**Why this priority**: 这是了解数据库结构的基础功能，对应 WebUI 的 Collections 侧边栏。

**Independent Test**: 可以通过输入 `/cols` 验证是否显示 Collections 列表。

**Acceptance Scenarios**:

1. **Given** 用户已连接 PocketBase, **When** 输入 `/cols` 并回车, **Then** 显示所有 Collections 的表格视图（名称、类型、记录数）
2. **Given** Collections 列表已显示, **When** 用户按上下方向键, **Then** 可以在列表中导航
3. **Given** Collections 列表已显示, **When** 选中某个 Collection 并按 Enter, **Then** 进入该 Collection 的 Records 视图

---

### User Story 4 - 查看 Records (Priority: P0)

作为开发者，我希望能够通过 `/view @collection` 查看指定 Collection 的记录，以便浏览数据。

**Why this priority**: Records CRUD 是最核心的数据操作功能，对应 WebUI 的 Records 列表页面。

**Independent Test**: 可以通过输入 `/view @users` 验证是否显示 users 表的记录。

**Acceptance Scenarios**:

1. **Given** 用户已连接 PocketBase, **When** 输入 `/view @users` 并回车, **Then** 显示 users Collection 的记录表格
2. **Given** Records 表格已显示, **When** 用户按方向键, **Then** 可以在记录间导航
3. **Given** Records 数量超过一屏, **When** 用户按 Page Down/Up, **Then** 实现分页浏览
4. **Given** 用户选中某条记录, **When** 按 Enter, **Then** 显示记录详情（JSON 格式）

---

### User Story 5 - 查看 Collection Schema (Priority: P0)

作为开发者，我希望能够查看 Collection 的 Schema 定义，以便了解字段结构。

**Why this priority**: 对应 WebUI 的 Collection 编辑面板中的 Fields 标签页。

**Independent Test**: 可以通过 `/schema @users` 查看字段定义。

**Acceptance Scenarios**:

1. **Given** 用户已连接 PocketBase, **When** 输入 `/schema @users`, **Then** 显示 users Collection 的字段列表
2. **Given** Schema 视图已显示, **When** 查看字段, **Then** 显示字段名、类型、必填、唯一等属性
3. **Given** Schema 视图已显示, **When** Collection 有 API Rules, **Then** 可以查看 Rules 定义

---

### User Story 6 - 过滤查询 (Priority: P1)

作为开发者，我希望能够在 `/view` 命令中添加过滤条件，以便精确查找数据。

**Why this priority**: 过滤是数据查询的核心能力，对应 WebUI 的搜索栏过滤功能。

**Independent Test**: 可以通过输入带过滤条件的命令验证是否正确过滤记录。

**Acceptance Scenarios**:

1. **Given** 用户在 OmniBar, **When** 输入 `/view @users filter="verified=true"`, **Then** 只显示已验证的用户
2. **Given** 用户在 OmniBar, **When** 输入 `/view @posts filter="created>'2024-01-01'"`, **Then** 只显示 2024 年后的帖子
3. **Given** 过滤条件语法错误, **When** 执行命令, **Then** 显示错误提示并保持在 OmniBar

---

### User Story 7 - 实时日志流 (Priority: P1)

作为开发者，我希望能够通过 `/logs` 命令查看实时日志流，以便监控系统运行状态。

**Why this priority**: 日志监控是运维的重要功能，对应 WebUI 的 Logs 页面 (`features/logs/`)。

**Independent Test**: 可以通过输入 `/logs` 验证是否显示滚动的日志流。

**Acceptance Scenarios**:

1. **Given** 用户已连接 PocketBase, **When** 输入 `/logs`, **Then** 界面切换到日志流视图
2. **Given** 日志视图已显示, **When** 有新日志产生, **Then** 自动滚动显示最新日志
3. **Given** 日志视图已显示, **When** 用户输入 `/logs level=error`, **Then** 只显示错误级别日志
4. **Given** 日志视图已显示, **When** 用户按 `q` 或 `Esc`, **Then** 返回主界面

---

### User Story 8 - 系统监控 (Priority: P1)

作为开发者，我希望能够查看系统监控指标，以便了解服务运行状态。

**Why this priority**: 对应 WebUI 的 Monitoring 页面 (`features/monitoring/`)。

**Independent Test**: 可以通过 `/monitor` 查看系统指标。

**Acceptance Scenarios**:

1. **Given** 用户已连接 PocketBase, **When** 输入 `/monitor`, **Then** 显示系统监控仪表盘
2. **Given** 监控视图已显示, **When** 查看指标, **Then** 显示 CPU、内存、Goroutine、连接数等
3. **Given** 监控视图已显示, **When** 指标数据更新, **Then** 实时刷新显示

---

### User Story 9 - 连接管理 (Priority: P1)

作为开发者，我希望能够指定 PocketBase 服务器地址进行连接。

**Why this priority**: 这是使用 TUI 的前提条件。

**Independent Test**: 可以通过启动命令指定服务器地址验证连接。

**Acceptance Scenarios**:

1. **Given** 用户启动 TUI, **When** 使用 `pbtui --url http://localhost:8090`, **Then** 连接到指定服务器
2. **Given** 用户启动 TUI, **When** 不指定 URL, **Then** 默认连接 `http://127.0.0.1:8090`
3. **Given** 服务器不可达, **When** 尝试连接, **Then** 显示连接失败错误并允许重试

---

### User Story 10 - 单条记录查询 (Priority: P1)

作为开发者，我希望能够通过 ID 直接获取单条记录详情。

**Why this priority**: 对应 WebUI 点击记录查看详情的功能。

**Independent Test**: 可以通过 `/get @users:record_id` 获取单条记录。

**Acceptance Scenarios**:

1. **Given** 用户知道记录 ID, **When** 输入 `/get @users:abc123`, **Then** 显示该记录的完整 JSON
2. **Given** 记录 ID 不存在, **When** 执行查询, **Then** 显示 "Record not found" 错误

---

### Edge Cases

- OmniBar 输入为空时按 Enter 如何处理？忽略，保持当前状态
- 网络断开时如何处理？显示离线提示，支持重连
- 终端窗口过小时如何处理？显示最小尺寸警告
- 大量 Records 时如何处理？分页加载，显示加载进度
- 特殊字符输入如何处理？正确转义，避免破坏布局
- Token 过期时如何处理？显示认证失败，提示重新启动并传入新 Token

## 5. Requirements *(mandatory)*

### Functional Requirements

#### 核心框架层
- **FR-001**: 系统 MUST 使用 React + Ink v5 作为 TUI 框架
- **FR-002**: 系统 MUST 使用 TypeScript 编写，启用 strict 模式
- **FR-003**: 系统 MUST 采用 feature-based 模块化目录结构（与 webui 一致）
- **FR-004**: 系统 MUST 使用 Jotai 作为状态管理方案（与 webui 一致）
- **FR-005**: 系统 MUST 使用 PocketBase JS SDK 与服务端通信

#### OmniBar 模块
- **FR-010**: OmniBar MUST 支持 `/` 触发命令补全
- **FR-011**: OmniBar MUST 支持 `@` 触发资源选择
- **FR-012**: OmniBar MUST 支持 Tab 键自动补全
- **FR-013**: OmniBar MUST 支持上下方向键在补全列表中导航
- **FR-014**: OmniBar MUST 支持 Esc 键取消当前操作
- **FR-015**: OmniBar MUST 显示当前连接状态和服务器地址

#### Collections 模块（对应 webui/features/collections/）
- **FR-020**: 系统 MUST 实现 `/cols` 命令列出所有集合
- **FR-021**: 系统 MUST 显示 Collection 名称、类型（base/auth/view）、记录数
- **FR-022**: 系统 MUST 实现 `/schema @col` 命令查看 Schema 定义
- **FR-023**: 系统 MUST 显示字段名、类型、必填、唯一等属性
- **FR-024**: 系统 SHOULD 显示 API Rules（listRule, viewRule 等）

#### Records 模块（对应 webui/features/records/）
- **FR-030**: 系统 MUST 实现 `/view @collection` 查看记录列表
- **FR-031**: 系统 MUST 实现 `/get @collection:id` 查看单条记录
- **FR-032**: 系统 MUST 支持 `filter="..."` 参数过滤记录
- **FR-033**: 系统 MUST 支持 `sort="field"` 参数排序
- **FR-034**: 系统 MUST 支持分页参数 `page=N perPage=N`
- **FR-035**: 系统 MUST 以表格形式显示记录列表
- **FR-036**: 系统 MUST 以 JSON 格式显示记录详情

#### Logs 模块（对应 webui/features/logs/）
- **FR-040**: 系统 MUST 实现 `/logs` 命令查看日志
- **FR-041**: 系统 MUST 支持 `level=error|warn|info` 过滤
- **FR-042**: 系统 MUST 支持日志实时滚动显示
- **FR-043**: 系统 MUST 显示时间戳、级别、消息

#### Monitoring 模块（对应 webui/features/monitoring/）
- **FR-050**: 系统 MUST 实现 `/monitor` 命令查看系统状态
- **FR-051**: 系统 MUST 显示 CPU 使用率、内存占用
- **FR-052**: 系统 MUST 显示 Goroutine 数量、连接数
- **FR-053**: 系统 SHOULD 显示 WAL 文件大小

#### 连接模块
- **FR-060**: 系统 MUST 支持通过 `--url` 参数指定服务器地址
- **FR-061**: 系统 MUST 支持通过 `--token` 参数指定认证 Token
- **FR-062**: 系统 MUST 支持通过环境变量 `POCKETBASE_URL` 指定服务器
- **FR-063**: 系统 MUST 支持通过环境变量 `POCKETBASE_TOKEN` 指定 Token
- **FR-064**: 系统 MUST 在连接失败时显示错误并支持重试

#### 通用命令
- **FR-070**: 系统 MUST 实现 `/quit` 或 `/q` 退出命令
- **FR-071**: 系统 MUST 实现 `/help [command]` 帮助命令
- **FR-072**: 系统 MUST 实现 `/clear` 清屏命令
- **FR-073**: 系统 SHOULD 实现 `/health` 健康检查命令

### Non-Functional Requirements

- **NFR-001**: 首次渲染时间 < 500ms
- **NFR-002**: 命令执行响应时间 < 100ms（不含网络）
- **NFR-003**: 内存占用 < 100MB
- **NFR-004**: 支持 Windows Terminal, iTerm2, GNOME Terminal 等主流终端
- **NFR-005**: 最小终端尺寸要求：80 列 × 24 行

### Key Entities (Jotai Atoms)

参考 `webui/src/store/` 的状态设计：

#### 全局状态（对应 webui/src/store/app.ts）
- **appStateAtom**: 应用状态 (connected, disconnected, error)
- **currentViewAtom**: 当前视图 (dashboard, collections, records, logs, monitor)
- **pbClientAtom**: PocketBase SDK 实例

#### OmniBar 状态
- **omnibarQueryAtom**: 当前输入内容
- **omnibarModeAtom**: 输入模式 (input, command, resource)
- **suggestionsAtom**: 补全建议列表

#### Collections 状态（对应 webui/src/store/collections.ts）
- **collectionsAtom**: Collections 列表
- **activeCollectionAtom**: 当前选中的 Collection
- **isCollectionsLoadingAtom**: 加载状态

#### Records 状态
- **recordsAtom**: 当前 Records 列表
- **activeRecordAtom**: 当前选中的 Record
- **recordsFilterAtom**: 过滤条件
- **recordsPaginationAtom**: 分页状态

#### Auth 状态（对应 webui/src/store/auth.ts）
- **superuserAtom**: 当前认证的管理员信息
- **isAuthenticatedAtom**: 是否已认证

#### 消息状态（对应 webui/src/store/toasts.ts）
- **messagesAtom**: 消息列表（成功、错误、警告）

## 6. Architecture Design (架构设计)

### 6.1 目录结构

采用 feature-based 模块化结构，与 `webui/src/` 保持一致：

```
tui/
├── src/
│   ├── app.tsx                 # 应用根组件
│   ├── cli.tsx                 # CLI 入口 (commander)
│   ├── features/               # 功能模块（对应 webui/src/features/）
│   │   ├── omnibar/           # 核心：全能输入框
│   │   │   ├── components/
│   │   │   │   ├── OmniBar.tsx
│   │   │   │   ├── CommandSuggestions.tsx
│   │   │   │   └── ResourceSuggestions.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOmnibar.ts
│   │   │   │   └── useAutocomplete.ts
│   │   │   ├── store/
│   │   │   │   └── omnibarAtoms.ts
│   │   │   └── index.ts
│   │   ├── collections/       # Collections 浏览（对应 webui/src/features/collections/）
│   │   │   ├── components/
│   │   │   │   ├── CollectionsList.tsx
│   │   │   │   └── SchemaView.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useCollections.ts
│   │   │   ├── store/
│   │   │   │   └── collectionsAtoms.ts
│   │   │   └── index.ts
│   │   ├── records/           # Records 浏览（对应 webui/src/features/records/）
│   │   │   ├── components/
│   │   │   │   ├── RecordsTable.tsx
│   │   │   │   └── RecordDetail.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useRecords.ts
│   │   │   ├── store/
│   │   │   │   └── recordsAtoms.ts
│   │   │   └── index.ts
│   │   ├── logs/              # 日志流（对应 webui/src/features/logs/）
│   │   │   ├── components/
│   │   │   │   └── LogStream.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useLogs.ts
│   │   │   ├── store/
│   │   │   │   └── logsAtoms.ts
│   │   │   └── index.ts
│   │   ├── monitoring/        # 系统监控（对应 webui/src/features/monitoring/）
│   │   │   ├── components/
│   │   │   │   └── MonitorDashboard.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useMonitoring.ts
│   │   │   ├── store/
│   │   │   │   └── monitoringAtoms.ts
│   │   │   └── index.ts
│   │   ├── auth/              # 认证管理（对应 webui/src/features/auth/）
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── store/
│   │   │   │   └── authAtoms.ts
│   │   │   └── index.ts
│   │   └── connection/        # 连接管理
│   │       ├── components/
│   │       │   └── ConnectionStatus.tsx
│   │       ├── hooks/
│   │       │   └── useConnection.ts
│   │       └── index.ts
│   ├── components/            # 通用组件（对应 webui/src/components/）
│   │   ├── Layout.tsx         # 主布局
│   │   ├── DataGrid.tsx       # 通用表格
│   │   ├── StatusBar.tsx      # 状态栏
│   │   ├── Spinner.tsx        # 加载指示器
│   │   ├── Message.tsx        # 消息提示
│   │   └── ErrorBoundary.tsx
│   ├── hooks/                 # 全局 Hooks（对应 webui/src/hooks/）
│   │   ├── usePocketbase.ts
│   │   └── useKeyboard.ts
│   ├── lib/                   # 工具函数（对应 webui/src/lib/）
│   │   ├── pb.ts              # PocketBase SDK 封装
│   │   ├── commands.ts        # 命令注册表
│   │   ├── parser.ts          # 命令解析器
│   │   └── utils.ts           # 工具函数
│   ├── store/                 # 全局状态（对应 webui/src/store/）
│   │   ├── appAtoms.ts        # 应用状态
│   │   ├── authAtoms.ts       # 认证状态
│   │   └── index.ts
│   └── types/
│       └── index.ts           # TypeScript 类型定义
├── tests/                     # 测试文件（对应 webui/src/test/）
│   ├── features/
│   │   ├── omnibar.test.tsx
│   │   ├── collections.test.tsx
│   │   ├── records.test.tsx
│   │   └── logs.test.tsx
│   └── setup.ts
├── package.json
├── tsconfig.json
├── bunfig.toml                # Bun 配置文件
└── README.md
```

### 6.2 状态机设计

```
                    ┌─────────────────────────────────────────┐
                    │              DISCONNECTED               │
                    │  (等待连接 / 显示连接配置)               │
                    └────────────────┬────────────────────────┘
                                     │ connect()
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │              CONNECTING                 │
                    │  (显示连接中...)                        │
                    └────────────────┬────────────────────────┘
                                     │ success / fail
                    ┌────────────────┴────────────────────────┐
                    ▼                                         ▼
    ┌───────────────────────────┐         ┌───────────────────────────┐
    │        CONNECTED          │         │         ERROR             │
    │  (正常工作状态)            │         │  (显示错误，支持重试)      │
    └───────────────────────────┘         └───────────────────────────┘
                    │
                    │ /command @resource
                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                        VIEW_MODE                                │
    ├─────────────────────────────────────────────────────────────────┤
    │  DASHBOARD      │ COLLECTION_LIST │ RECORD_LIST │ LOGS │ MONITOR │
    │  (欢迎页)       │ (集合列表)      │ (记录列表)  │(日志)│ (监控)  │
    └─────────────────────────────────────────────────────────────────────┘
```

### 6.3 命令解析流程

```
用户输入: "/view @users filter='verified=true'"
              │
              ▼
        ┌─────────────┐
        │   Parser    │
        └──────┬──────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌────────┐          ┌───────────┐
│Command │          │ Arguments │
│ /view  │          │ @users    │
└────────┘          │ filter=.. │
                    └───────────┘
               │
               ▼
        ┌─────────────┐
        │  Executor   │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │ View Switch │
        │ RECORD_LIST │
        │ collection: │
        │  "users"    │
        └─────────────┘
```

## 7. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户可以在 3 次按键内完成命令输入（Tab 补全）
- **SC-002**: OmniBar 响应时间 < 50ms
- **SC-003**: Collections 列表加载时间 < 1s
- **SC-004**: Records 表格渲染时间 < 500ms (100 条记录)
- **SC-005**: 日志流延迟 < 100ms
- **SC-006**: 代码测试覆盖率 >= 80%
- **SC-007**: TypeScript strict 模式零错误
- **SC-008**: 支持 Bun 1.1+ 运行环境

## 8. Boundaries (边界与约束)

1. **Phase 1 Only**: 本期只实现读操作（浏览），不实现写操作（创建/编辑/删除）
2. **No Auth UI**: 不实现认证 UI，通过 `--token` 参数传入
3. **No AI**: 不实现 AI 功能，为 Phase 2 预留接口
4. **Single Server**: 不支持多服务器切换，一次会话只连接一个服务器
5. **English Only**: Phase 1 不实现 i18n，仅支持英文界面
6. **No Settings Write**: 不实现 Settings 写入（Mail, Storage 等配置）

## 9. Assumptions

- 用户已安装 Bun 1.1+ 运行环境
- 用户已有运行中的 PocketBase 服务
- 用户使用支持 ANSI 转义序列的现代终端
- 用户熟悉基本的命令行操作

## 10. Risks & Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Ink 在某些终端兼容性问题 | 高 | 限定支持的终端列表，提供降级方案 |
| 网络不稳定导致体验差 | 中 | 实现请求重试和离线提示 |
| 大数据量导致性能问题 | 中 | 实现分页和虚拟滚动 |
| 用户对命令语法不熟悉 | 低 | 提供 `/help` 和交互式提示 |

## 11. Phase 2 预留 (AI 集成 + 写操作)

Phase 1 的设计为 Phase 2 AI 集成和写操作铺平道路：

### 11.1 AI 集成预留

1. **Context 结构化**: `@users` 选择资源时，已获取 Schema，可直接喂给 LLM
2. **Action 确定化**: `/view`, `/create` 等命令定义了能力边界，即 MCP Tool Definition
3. **心智模型平滑过渡**: 用户习惯 "Command + Context" 模式后，自然语言只是另一种输入方式

**预留接口**:
```typescript
// 未来 AI 模式入口
interface AIMode {
  // 自然语言解析为命令
  parseNaturalLanguage(input: string): ParsedCommand;
  // 基于 Schema 生成建议
  suggestWithContext(schema: CollectionSchema): Suggestion[];
}
```

### 11.2 Phase 2 命令规划

参考 webui 完整功能，Phase 2 将实现：

| 命令 | 说明 | 对应 WebUI |
|------|------|-----------|
| `/create @col` | 创建记录 | records/RecordUpsertPanel |
| `/update @col:id` | 更新记录 | records/RecordUpsertPanel |
| `/delete @col:id` | 删除记录 | records 删除功能 |
| `/traces` | 查看请求追踪 | features/traces/ |
| `/analytics` | 查看流量分析 | features/analytics/ |
| `/jobs` | 查看后台任务 | features/jobs/ |
| `/procs` | 查看进程管理 | features/processes/ |
| `/gateway` | 查看网关配置 | features/gateway/ |
| `/backups` | 备份管理 | settings/Backups |
| `/secrets` | 密钥管理 | settings/Secrets |
| `/crons` | Cron 任务 | settings/Crons |
| `/admins` | 管理员管理 | settings/Admins |
| `/import` | 导入数据 | settings/Import |
| `/export` | 导出数据 | settings/Export |
| `/settings` | 系统设置 | settings/* |

## 12. Milestones (里程碑)

| 阶段 | 目标 | 交付物 |
|------|------|--------|
| M1 | 项目初始化 | 项目结构、构建配置、基础组件 |
| M2 | OmniBar 核心 | 命令补全、资源选择、Tab 补全 |
| M3 | Collections 模块 | `/cols`, `/schema` 命令实现 |
| M4 | Records 模块 | `/view`, `/get` 命令实现 |
| M5 | Logs + Monitor | `/logs`, `/monitor` 命令实现 |
| M6 | 测试与文档 | 单元测试、集成测试、README |

## 13. CLI Usage (命令行用法)

```bash
# 安装 Bun (如未安装)
curl -fsSL https://bun.sh/install | bash

# 安装 TUI
bun install -g @pocketbase/tui

# 基础用法
pbtui                              # 连接默认地址 http://127.0.0.1:8090
pbtui --url http://localhost:8090  # 指定服务器地址
pbtui --token "admin_token_here"   # 使用 admin token 认证

# 环境变量
export POCKETBASE_URL=http://localhost:8090
export POCKETBASE_TOKEN=your_token
pbtui

# 帮助
pbtui --help

# 开发模式
cd tui
bun install           # 安装依赖
bun run dev           # 开发运行
bun test              # 运行测试
bun run build         # 构建发布
```

## 14. Internal Commands (内部命令)

| 命令 | 语法 | 说明 | WebUI 对应 |
|------|------|------|-----------|
| `/view` | `/view @col [filter="..." sort="..." page=N]` | 查看记录列表 | Records 列表页 |
| `/get` | `/get @col:id` | 查看单条记录 | Record 详情面板 |
| `/cols` | `/cols` | 列出所有集合 | Collections 侧边栏 |
| `/schema` | `/schema @col` | 查看集合 Schema | Collection Fields 标签 |
| `/logs` | `/logs [level=error]` | 查看日志 | Logs 页面 |
| `/monitor` | `/monitor` | 查看系统监控 | Monitoring 页面 |
| `/health` | `/health` | 健康检查 | - |
| `/clear` | `/clear` | 清屏 | - |
| `/help` | `/help [command]` | 显示帮助 | - |
| `/quit` | `/quit` 或 `/q` | 退出 TUI | - |

## 15. Keyboard Shortcuts (快捷键)

| 快捷键 | 作用 |
|--------|------|
| `/` | 进入命令模式 |
| `@` | 进入资源选择模式 |
| `Tab` | 自动补全 |
| `↑/↓` | 导航补全列表 / 表格行 |
| `←/→` | 表格列导航 |
| `Enter` | 确认选择/执行命令 |
| `Esc` | 取消/返回上一级 |
| `Ctrl+C` | 退出程序 |
| `q` | 在视图中返回主界面 |
| `r` | 刷新当前视图 |
| `?` | 显示快捷键帮助 |
| `Page Up/Down` | 分页导航 |
| `Home/End` | 跳转首/末行 |

## 16. Development Guidelines (开发规范)

### 16.1 与 WebUI 代码复用

尽可能复用 `webui/` 中的逻辑代码：

| 类型 | WebUI | TUI | 复用策略 |
|------|-------|-----|---------|
| API 调用 | `lib/ApiClient.ts` | `lib/pb.ts` | 参考实现 |
| 类型定义 | `features/*/types/` | `types/` | 直接复制 |
| 业务逻辑 | `features/*/services/` | `features/*/services/` | 参考实现 |
| 状态管理 | `store/*.ts` | `store/*.ts` | 参考 Atom 设计 |
| UI 组件 | `components/ui/` | `components/` | 重新实现 (Ink) |

### 16.2 测试规范

参考 `webui/CODEBUDDY.md` 中的 TDD 开发流程：

```bash
# 运行单个测试
bun test src/features/omnibar/omnibar.test.tsx

# 运行所有测试
bun test

# 覆盖率报告
bun test --coverage
```

**测试覆盖率要求**：
- 非 UI 逻辑代码行覆盖率 >= 90%
- 分支覆盖率 >= 90%

### 16.3 命名规范

遵循 `webui/` 的命名风格：

- 文件名: `camelCase.ts` / `PascalCase.tsx`
- 组件: `PascalCase`
- Hooks: `useCamelCase`
- Atoms: `camelCaseAtom`
- 类型: `PascalCase`
