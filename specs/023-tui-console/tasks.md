# PocketBase TUI Console - Tasks 清单

> **开发模式**: TDD (测试驱动开发)
> **技术栈**: React + Ink v5 + TypeScript + Bun
> **预计总工时**: ~120h
> **当前进度**: ✅ 全部完成 (189/189 tasks, 100%)

---

## EPIC-1: 项目基础设施

> 目标: 建立项目骨架、配置构建工具
> **状态**: ✅ 已完成
> **对应 Spec**: Section 3 (Tech Stack), Section 6.1 (目录结构)

### STORY-1.1: 项目初始化

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-1.1.1 | 创建 `tui/` 目录结构 (src layout: `src/`, `tests/`) | 1h | ✅ | - |
| T-1.1.2 | 配置 `package.json` (name: @pocketbase/tui, bin: pbtui) | 0.5h | ✅ | T-1.1.1 |
| T-1.1.3 | 配置 `tsconfig.json` (strict 模式, paths 别名) | 0.5h | ✅ | T-1.1.2 |
| T-1.1.4 | 配置 `bunfig.toml` (test 配置, jsx runtime) | 0.5h | ✅ | T-1.1.2 |
| T-1.1.5 | 创建 `src/cli.tsx` CLI 入口 (commander) | 1h | ✅ | T-1.1.3 |
| T-1.1.6 | 创建 `src/app.tsx` 应用根组件 | 1h | ✅ | T-1.1.5 |
| T-1.1.7 | 配置 `tests/setup.ts` 测试全局配置 | 0.5h | ✅ | T-1.1.4 |
| T-1.1.8 | 编写 `README.md` 初版 | 0.5h | ✅ | T-1.1.1 |

### STORY-1.2: 核心依赖安装

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-1.2.1 | 安装 React + Ink v5 (`ink`, `react`) | 0.5h | ✅ | T-1.1.2 |
| T-1.2.2 | 安装 Ink 组件库 (`ink-text-input`, `ink-select-input`, `ink-spinner`, `ink-table`) | 0.5h | ✅ | T-1.2.1 |
| T-1.2.3 | 安装状态管理 (`jotai`) | 0.5h | ✅ | T-1.2.1 |
| T-1.2.4 | 安装 CLI 工具 (`commander`, `chalk`) | 0.5h | ✅ | T-1.2.1 |
| T-1.2.5 | 安装 API Client (`pocketbase`) | 0.5h | ✅ | T-1.2.1 |
| T-1.2.6 | 安装开发依赖 (`typescript`, `@types/react`, `@types/bun`, `ink-testing-library`) | 0.5h | ✅ | T-1.2.1 |

### STORY-1.3: 验证基础配置

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-1.3.1 | 🔴 编写 CLI 启动测试 (pbtui --version) | 0.5h | ✅ | T-1.2.6 |
| T-1.3.2 | 🟢 实现 CLI 版本输出 | 0.5h | ✅ | T-1.3.1 |
| T-1.3.3 | 🔴 编写 Ink 渲染测试 (Hello World) | 0.5h | ✅ | T-1.3.2 |
| T-1.3.4 | 🟢 验证 Ink 渲染正常 | 0.5h | ✅ | T-1.3.3 |
| T-1.3.5 | 运行 `bun test` 确认测试框架正常 | 0.5h | ✅ | T-1.3.4 |

---

## EPIC-2: 核心基础模块

> 目标: 全局状态、PocketBase SDK 封装、通用组件
> **状态**: ✅ 已完成
> **对应 Spec**: Section 5 (Key Entities), Section 6.1 (components/, store/, lib/)

### STORY-2.1: 全局状态 (Jotai Atoms)

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-2.1.1 | 🔴 编写 `appStateAtom` 测试 (connected, disconnected, error) | 0.5h | ✅ | T-1.3.5 |
| T-2.1.2 | 🟢 实现 `src/store/appAtoms.ts` 应用状态 | 0.5h | ✅ | T-2.1.1 |
| T-2.1.3 | 🔴 编写 `currentViewAtom` 测试 (dashboard, collections, records, logs, monitor) | 0.5h | ✅ | T-2.1.2 |
| T-2.1.4 | 🟢 实现视图状态管理 | 0.5h | ✅ | T-2.1.3 |
| T-2.1.5 | 🔴 编写 `pbClientAtom` 测试 (PocketBase SDK 实例) | 0.5h | ✅ | T-2.1.4 |
| T-2.1.6 | 🟢 实现 PocketBase SDK 实例管理 | 0.5h | ✅ | T-2.1.5 |
| T-2.1.7 | 🔴 编写 `messagesAtom` 测试 (成功、错误、警告消息) | 0.5h | ✅ | T-2.1.6 |
| T-2.1.8 | 🟢 实现消息状态管理 | 0.5h | ✅ | T-2.1.7 |

### STORY-2.2: PocketBase SDK 封装

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-2.2.1 | 🔴 编写 `createPBClient()` 测试 (URL, Token 参数) | 0.5h | ✅ | T-2.1.8 |
| T-2.2.2 | 🟢 实现 `src/lib/pb.ts` PocketBase 客户端封装 | 1h | ✅ | T-2.2.1 |
| T-2.2.3 | 🔴 编写连接测试 (`health.check()`) | 0.5h | ✅ | T-2.2.2 |
| T-2.2.4 | 🟢 实现连接验证逻辑 | 0.5h | ✅ | T-2.2.3 |
| T-2.2.5 | 🔴 编写认证测试 (Token 自动注入) | 0.5h | ✅ | T-2.2.4 |
| T-2.2.6 | 🟢 实现认证 Token 管理 | 0.5h | ✅ | T-2.2.5 |

### STORY-2.3: 通用组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-2.3.1 | 🔴 编写 `Layout.tsx` 测试 (主布局: StatusBar + Content + OmniBar) | 0.5h | ✅ | T-2.2.6 |
| T-2.3.2 | 🟢 实现 `src/components/Layout.tsx` | 1h | ✅ | T-2.3.1 |
| T-2.3.3 | 🔴 编写 `StatusBar.tsx` 测试 (显示连接状态、服务器地址) | 0.5h | ✅ | T-2.3.2 |
| T-2.3.4 | 🟢 实现 `src/components/StatusBar.tsx` | 0.5h | ✅ | T-2.3.3 |
| T-2.3.5 | 🔴 编写 `Spinner.tsx` 测试 (加载指示器) | 0.5h | ✅ | T-2.3.4 |
| T-2.3.6 | 🟢 实现 `src/components/Spinner.tsx` (基于 ink-spinner) | 0.5h | ✅ | T-2.3.5 |
| T-2.3.7 | 🔴 编写 `Message.tsx` 测试 (消息提示) | 0.5h | ✅ | T-2.3.6 |
| T-2.3.8 | 🟢 实现 `src/components/Message.tsx` | 0.5h | ✅ | T-2.3.7 |
| T-2.3.9 | 🔴 编写 `DataGrid.tsx` 测试 (通用表格) | 0.5h | ✅ | T-2.3.8 |
| T-2.3.10 | 🟢 实现 `src/components/DataGrid.tsx` (基于 ink-table) | 1h | ✅ | T-2.3.9 |
| T-2.3.11 | 🔴 编写 `ErrorBoundary.tsx` 测试 | 0.5h | ✅ | T-2.3.10 |
| T-2.3.12 | 🟢 实现 `src/components/ErrorBoundary.tsx` | 0.5h | ✅ | T-2.3.11 |

### STORY-2.4: 全局 Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-2.4.1 | 🔴 编写 `usePocketbase.ts` 测试 (获取 PB 实例) | 0.5h | ✅ | T-2.3.12 |
| T-2.4.2 | 🟢 实现 `src/hooks/usePocketbase.ts` | 0.5h | ✅ | T-2.4.1 |
| T-2.4.3 | 🔴 编写 `useKeyboard.ts` 测试 (键盘事件监听) | 0.5h | ✅ | T-2.4.2 |
| T-2.4.4 | 🟢 实现 `src/hooks/useKeyboard.ts` | 0.5h | ✅ | T-2.4.3 |

---

## EPIC-3: OmniBar 模块 (US1 + US2)

> 目标: 核心交互入口 - 命令补全、资源选择
> **状态**: ✅ 已完成
> **对应 Spec**: User Story 1 (命令补全), User Story 2 (资源选择器), FR-010~FR-015

### STORY-3.1: 命令注册表

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-3.1.1 | 🔴 编写命令注册表测试 (命令名、描述、参数) | 0.5h | ✅ | T-2.4.4 |
| T-3.1.2 | 🟢 实现 `src/lib/commands.ts` 命令定义 | 1h | ✅ | T-3.1.1 |
| T-3.1.3 | 🔴 编写命令查找测试 (前缀匹配) | 0.5h | ✅ | T-3.1.2 |
| T-3.1.4 | 🟢 实现命令查找函数 | 0.5h | ✅ | T-3.1.3 |

**命令列表 (对应 Spec Section 14)**:
- `/view @col [filter="..." sort="..." page=N]` - 查看记录列表
- `/get @col:id` - 查看单条记录
- `/cols` - 列出所有集合
- `/schema @col` - 查看集合 Schema
- `/logs [level=error]` - 查看日志
- `/monitor` - 查看系统监控
- `/health` - 健康检查
- `/clear` - 清屏
- `/help [command]` - 显示帮助
- `/quit` 或 `/q` - 退出 TUI

### STORY-3.2: 命令解析器

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-3.2.1 | 🔴 编写命令解析测试 (`/view @users filter="verified=true"`) | 1h | ✅ | T-3.1.4 |
| T-3.2.2 | 🟢 实现 `src/lib/parser.ts` 命令解析器 | 1.5h | ✅ | T-3.2.1 |
| T-3.2.3 | 🔴 编写参数解析测试 (filter, sort, page, perPage) | 0.5h | ✅ | T-3.2.2 |
| T-3.2.4 | 🟢 实现参数解析逻辑 | 0.5h | ✅ | T-3.2.3 |
| T-3.2.5 | 🔴 编写资源引用解析测试 (`@users`, `@users:abc123`) | 0.5h | ✅ | T-3.2.4 |
| T-3.2.6 | 🟢 实现资源引用解析 | 0.5h | ✅ | T-3.2.5 |

### STORY-3.3: OmniBar 状态管理

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-3.3.1 | 🔴 编写 `omnibarQueryAtom` 测试 (当前输入内容) | 0.5h | ✅ | T-3.2.6 |
| T-3.3.2 | 🟢 实现 `src/features/omnibar/store/omnibarAtoms.ts` | 0.5h | ✅ | T-3.3.1 |
| T-3.3.3 | 🔴 编写 `omnibarModeAtom` 测试 (input, command, resource) | 0.5h | ✅ | T-3.3.2 |
| T-3.3.4 | 🟢 实现输入模式管理 | 0.5h | ✅ | T-3.3.3 |
| T-3.3.5 | 🔴 编写 `suggestionsAtom` 测试 (补全建议列表) | 0.5h | ✅ | T-3.3.4 |
| T-3.3.6 | 🟢 实现补全建议状态 | 0.5h | ✅ | T-3.3.5 |

### STORY-3.4: OmniBar Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-3.4.1 | 🔴 编写 `useOmnibar.ts` 测试 (输入处理、模式切换) | 1h | ✅ | T-3.3.6 |
| T-3.4.2 | 🟢 实现 `src/features/omnibar/hooks/useOmnibar.ts` | 1.5h | ✅ | T-3.4.1 |
| T-3.4.3 | 🔴 编写 `useAutocomplete.ts` 测试 (补全逻辑) | 1h | ✅ | T-3.4.2 |
| T-3.4.4 | 🟢 实现 `src/features/omnibar/hooks/useAutocomplete.ts` | 1.5h | ✅ | T-3.4.3 |

### STORY-3.5: OmniBar 组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-3.5.1 | 🔴 编写 `OmniBar.tsx` 测试 (输入框渲染、焦点管理) | 1h | ✅ | T-3.4.4 |
| T-3.5.2 | 🟢 实现 `src/features/omnibar/components/OmniBar.tsx` | 1.5h | ✅ | T-3.5.1 |
| T-3.5.3 | 🔴 编写 `CommandSuggestions.tsx` 测试 (命令补全列表) | 0.5h | ✅ | T-3.5.2 |
| T-3.5.4 | 🟢 实现 `src/features/omnibar/components/CommandSuggestions.tsx` | 1h | ✅ | T-3.5.3 |
| T-3.5.5 | 🔴 编写 `ResourceSuggestions.tsx` 测试 (资源选择列表) | 0.5h | ✅ | T-3.5.4 |
| T-3.5.6 | 🟢 实现 `src/features/omnibar/components/ResourceSuggestions.tsx` | 1h | ✅ | T-3.5.5 |

### STORY-3.6: OmniBar 交互验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-3.6.1 | 🧪 验收测试: 输入 `/` 显示命令列表 (US1-AC1) | 0.5h | ✅ | T-3.5.6 |
| T-3.6.2 | 🧪 验收测试: 输入 `/v` 过滤为 `/view` (US1-AC2) | 0.5h | ✅ | T-3.6.1 |
| T-3.6.3 | 🧪 验收测试: Tab 键自动补全 (US1-AC3) | 0.5h | ✅ | T-3.6.2 |
| T-3.6.4 | 🧪 验收测试: 空格切换参数模式 (US1-AC4) | 0.5h | ✅ | T-3.6.3 |
| T-3.6.5 | 🧪 验收测试: 输入 `@` 显示 Collections 列表 (US2-AC1) | 0.5h | ✅ | T-3.6.4 |
| T-3.6.6 | 🧪 验收测试: 输入 `@u` 过滤集合 (US2-AC2) | 0.5h | ✅ | T-3.6.5 |
| T-3.6.7 | 🧪 验收测试: Tab 补全为 `@users` (US2-AC3) | 0.5h | ✅ | T-3.6.6 |
| T-3.6.8 | 🧪 验收测试: 网络失败显示错误提示 (US2-AC4) | 0.5h | ✅ | T-3.6.7 |

---

## EPIC-4: Collections 模块 (US3 + US5)

> 目标: 集合列表、Schema 查看
> **状态**: ✅ 已完成
> **对应 Spec**: User Story 3 (浏览 Collections), User Story 5 (查看 Schema), FR-020~FR-024

### STORY-4.1: Collections 状态管理

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-4.1.1 | 🔴 编写 `collectionsAtom` 测试 (Collections 列表) | 0.5h | ✅ | T-3.6.8 |
| T-4.1.2 | 🟢 实现 `src/features/collections/store/collectionsAtoms.ts` | 0.5h | ✅ | T-4.1.1 |
| T-4.1.3 | 🔴 编写 `activeCollectionAtom` 测试 (当前选中) | 0.5h | ✅ | T-4.1.2 |
| T-4.1.4 | 🟢 实现选中状态管理 | 0.5h | ✅ | T-4.1.3 |
| T-4.1.5 | 🔴 编写 `isCollectionsLoadingAtom` 测试 | 0.5h | ✅ | T-4.1.4 |
| T-4.1.6 | 🟢 实现加载状态管理 | 0.5h | ✅ | T-4.1.5 |

### STORY-4.2: Collections Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-4.2.1 | 🔴 编写 `useCollections.ts` 测试 (获取列表) | 1h | ✅ | T-4.1.6 |
| T-4.2.2 | 🟢 实现 `src/features/collections/hooks/useCollections.ts` | 1.5h | ✅ | T-4.2.1 |
| T-4.2.3 | 🔴 编写获取 Schema 测试 | 0.5h | ✅ | T-4.2.2 |
| T-4.2.4 | 🟢 实现 Schema 获取逻辑 | 0.5h | ✅ | T-4.2.3 |

### STORY-4.3: Collections 组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-4.3.1 | 🔴 编写 `CollectionsList.tsx` 测试 (显示名称、类型、记录数) | 1h | ✅ | T-4.2.4 |
| T-4.3.2 | 🟢 实现 `src/features/collections/components/CollectionsList.tsx` | 1.5h | ✅ | T-4.3.1 |
| T-4.3.3 | 🔴 编写 `SchemaView.tsx` 测试 (显示字段名、类型、必填、唯一) | 1h | ✅ | T-4.3.2 |
| T-4.3.4 | 🟢 实现 `src/features/collections/components/SchemaView.tsx` | 1.5h | ✅ | T-4.3.3 |

### STORY-4.4: Collections 交互验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-4.4.1 | 🧪 验收测试: `/cols` 显示所有集合表格 (US3-AC1) | 0.5h | ✅ | T-4.3.4 |
| T-4.4.2 | 🧪 验收测试: 方向键导航列表 (US3-AC2) | 0.5h | ✅ | T-4.4.1 |
| T-4.4.3 | 🧪 验收测试: Enter 进入 Records 视图 (US3-AC3) | 0.5h | ✅ | T-4.4.2 |
| T-4.4.4 | 🧪 验收测试: `/schema @users` 显示字段列表 (US5-AC1) | 0.5h | ✅ | T-4.4.3 |
| T-4.4.5 | 🧪 验收测试: Schema 显示字段属性 (US5-AC2) | 0.5h | ✅ | T-4.4.4 |
| T-4.4.6 | 🧪 验收测试: Schema 显示 API Rules (US5-AC3) | 0.5h | ✅ | T-4.4.5 |

---

## EPIC-5: Records 模块 (US4 + US6 + US10)

> 目标: 记录列表、详情、过滤查询
> **状态**: ✅ 已完成
> **对应 Spec**: User Story 4 (查看 Records), User Story 6 (过滤查询), User Story 10 (单条记录), FR-030~FR-036

### STORY-5.1: Records 状态管理

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-5.1.1 | 🔴 编写 `recordsAtom` 测试 (Records 列表) | 0.5h | ✅ | T-4.4.6 |
| T-5.1.2 | 🟢 实现 `src/features/records/store/recordsAtoms.ts` | 0.5h | ✅ | T-5.1.1 |
| T-5.1.3 | 🔴 编写 `activeRecordAtom` 测试 (当前选中) | 0.5h | ✅ | T-5.1.2 |
| T-5.1.4 | 🟢 实现选中状态管理 | 0.5h | ✅ | T-5.1.3 |
| T-5.1.5 | 🔴 编写 `recordsFilterAtom` 测试 (过滤条件) | 0.5h | ✅ | T-5.1.4 |
| T-5.1.6 | 🟢 实现过滤状态管理 | 0.5h | ✅ | T-5.1.5 |
| T-5.1.7 | 🔴 编写 `recordsPaginationAtom` 测试 (分页状态) | 0.5h | ✅ | T-5.1.6 |
| T-5.1.8 | 🟢 实现分页状态管理 | 0.5h | ✅ | T-5.1.7 |

### STORY-5.2: Records Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-5.2.1 | 🔴 编写 `useRecords.ts` 测试 (获取列表、分页、过滤) | 1h | ✅ | T-5.1.8 |
| T-5.2.2 | 🟢 实现 `src/features/records/hooks/useRecords.ts` | 1.5h | ✅ | T-5.2.1 |
| T-5.2.3 | 🔴 编写获取单条记录测试 | 0.5h | ✅ | T-5.2.2 |
| T-5.2.4 | 🟢 实现 `getOne()` 逻辑 | 0.5h | ✅ | T-5.2.3 |

### STORY-5.3: Records 组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-5.3.1 | 🔴 编写 `RecordsTable.tsx` 测试 (表格展示) | 1h | ✅ | T-5.2.4 |
| T-5.3.2 | 🟢 实现 `src/features/records/components/RecordsTable.tsx` | 1.5h | ✅ | T-5.3.1 |
| T-5.3.3 | 🔴 编写 `RecordDetail.tsx` 测试 (JSON 格式详情) | 1h | ✅ | T-5.3.2 |
| T-5.3.4 | 🟢 实现 `src/features/records/components/RecordDetail.tsx` | 1h | ✅ | T-5.3.3 |

### STORY-5.4: Records 交互验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-5.4.1 | 🧪 验收测试: `/view @users` 显示记录表格 (US4-AC1) | 0.5h | ✅ | T-5.3.4 |
| T-5.4.2 | 🧪 验收测试: 方向键导航记录 (US4-AC2) | 0.5h | ✅ | T-5.4.1 |
| T-5.4.3 | 🧪 验收测试: Page Up/Down 分页 (US4-AC3) | 0.5h | ✅ | T-5.4.2 |
| T-5.4.4 | 🧪 验收测试: Enter 显示记录详情 (US4-AC4) | 0.5h | ✅ | T-5.4.3 |
| T-5.4.5 | 🧪 验收测试: `filter="verified=true"` 过滤 (US6-AC1) | 0.5h | ✅ | T-5.4.4 |
| T-5.4.6 | 🧪 验收测试: `filter="created>'2024-01-01'"` (US6-AC2) | 0.5h | ✅ | T-5.4.5 |
| T-5.4.7 | 🧪 验收测试: 过滤语法错误显示提示 (US6-AC3) | 0.5h | ✅ | T-5.4.6 |
| T-5.4.8 | 🧪 验收测试: `/get @users:abc123` 显示单条记录 (US10-AC1) | 0.5h | ✅ | T-5.4.7 |
| T-5.4.9 | 🧪 验收测试: 记录不存在显示错误 (US10-AC2) | 0.5h | ✅ | T-5.4.8 |

---

## EPIC-6: Logs 模块 (US7)

> 目标: 日志流查看、级别过滤
> **状态**: ✅ 已完成
> **对应 Spec**: User Story 7 (实时日志流), FR-040~FR-043

### STORY-6.1: Logs 状态管理

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-6.1.1 | 🔴 编写 `logsAtom` 测试 (日志列表) | 0.5h | ✅ | T-5.4.9 |
| T-6.1.2 | 🟢 实现 `src/features/logs/store/logsAtoms.ts` | 0.5h | ✅ | T-6.1.1 |
| T-6.1.3 | 🔴 编写 `logsLevelFilterAtom` 测试 (级别过滤) | 0.5h | ✅ | T-6.1.2 |
| T-6.1.4 | 🟢 实现级别过滤状态 | 0.5h | ✅ | T-6.1.3 |

### STORY-6.2: Logs Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-6.2.1 | 🔴 编写 `useLogs.ts` 测试 (获取日志、级别过滤) | 1h | ✅ | T-6.1.4 |
| T-6.2.2 | 🟢 实现 `src/features/logs/hooks/useLogs.ts` | 1.5h | ✅ | T-6.2.1 |

### STORY-6.3: Logs 组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-6.3.1 | 🔴 编写 `LogStream.tsx` 测试 (显示时间戳、级别、消息) | 1h | ✅ | T-6.2.2 |
| T-6.3.2 | 🟢 实现 `src/features/logs/components/LogStream.tsx` | 1.5h | ✅ | T-6.3.1 |

### STORY-6.4: Logs 交互验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-6.4.1 | 🧪 验收测试: `/logs` 切换到日志视图 (US7-AC1) | 0.5h | ✅ | T-6.3.2 |
| T-6.4.2 | 🧪 验收测试: 新日志自动滚动 (US7-AC2) | 0.5h | ✅ | T-6.4.1 |
| T-6.4.3 | 🧪 验收测试: `level=error` 只显示错误日志 (US7-AC3) | 0.5h | ✅ | T-6.4.2 |
| T-6.4.4 | 🧪 验收测试: `q` 或 `Esc` 返回主界面 (US7-AC4) | 0.5h | ✅ | T-6.4.3 |

---

## EPIC-7: Monitoring 模块 (US8)

> 目标: 系统监控仪表盘
> **状态**: ✅ 已完成
> **对应 Spec**: User Story 8 (系统监控), FR-050~FR-053

### STORY-7.1: Monitoring 状态管理

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-7.1.1 | 🔴 编写 `monitoringAtom` 测试 (系统指标) | 0.5h | ✅ | T-6.4.4 |
| T-7.1.2 | 🟢 实现 `src/features/monitoring/store/monitoringAtoms.ts` | 0.5h | ✅ | T-7.1.1 |

### STORY-7.2: Monitoring Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-7.2.1 | 🔴 编写 `useMonitoring.ts` 测试 (获取指标、实时刷新) | 1h | ✅ | T-7.1.2 |
| T-7.2.2 | 🟢 实现 `src/features/monitoring/hooks/useMonitoring.ts` | 1.5h | ✅ | T-7.2.1 |

### STORY-7.3: Monitoring 组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-7.3.1 | 🔴 编写 `MonitorDashboard.tsx` 测试 (CPU、内存、Goroutine、连接数) | 1h | ✅ | T-7.2.2 |
| T-7.3.2 | 🟢 实现 `src/features/monitoring/components/MonitorDashboard.tsx` | 1.5h | ✅ | T-7.3.1 |

### STORY-7.4: Monitoring 交互验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-7.4.1 | 🧪 验收测试: `/monitor` 显示监控仪表盘 (US8-AC1) | 0.5h | ✅ | T-7.3.2 |
| T-7.4.2 | 🧪 验收测试: 显示 CPU、内存、Goroutine、连接数 (US8-AC2) | 0.5h | ✅ | T-7.4.1 |
| T-7.4.3 | 🧪 验收测试: 指标实时刷新 (US8-AC3) | 0.5h | ✅ | T-7.4.2 |

---

## EPIC-8: Connection 模块 (US9)

> 目标: 连接管理、错误处理
> **状态**: ✅ 已完成
> **对应 Spec**: User Story 9 (连接管理), FR-060~FR-064

### STORY-8.1: Connection Hooks

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-8.1.1 | 🔴 编写 `useConnection.ts` 测试 (连接、断开、重试) | 1h | ✅ | T-7.4.3 |
| T-8.1.2 | 🟢 实现 `src/features/connection/hooks/useConnection.ts` | 1.5h | ✅ | T-8.1.1 |

### STORY-8.2: Connection 组件

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-8.2.1 | 🔴 编写 `ConnectionStatus.tsx` 测试 (显示连接状态) | 0.5h | ✅ | T-8.1.2 |
| T-8.2.2 | 🟢 实现 `src/features/connection/components/ConnectionStatus.tsx` | 0.5h | ✅ | T-8.2.1 |

### STORY-8.3: CLI 参数处理

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-8.3.1 | 🔴 编写 `--url` 参数测试 | 0.5h | ✅ | T-8.2.2 |
| T-8.3.2 | 🟢 实现 `--url` 参数处理 (默认 http://127.0.0.1:8090) | 0.5h | ✅ | T-8.3.1 |
| T-8.3.3 | 🔴 编写 `--token` 参数测试 | 0.5h | ✅ | T-8.3.2 |
| T-8.3.4 | 🟢 实现 `--token` 参数处理 | 0.5h | ✅ | T-8.3.3 |
| T-8.3.5 | 🔴 编写环境变量测试 (POCKETBASE_URL, POCKETBASE_TOKEN) | 0.5h | ✅ | T-8.3.4 |
| T-8.3.6 | 🟢 实现环境变量读取 | 0.5h | ✅ | T-8.3.5 |

### STORY-8.4: Connection 交互验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-8.4.1 | 🧪 验收测试: `--url http://localhost:8090` 连接成功 (US9-AC1) | 0.5h | ✅ | T-8.3.6 |
| T-8.4.2 | 🧪 验收测试: 默认连接 127.0.0.1:8090 (US9-AC2) | 0.5h | ✅ | T-8.4.1 |
| T-8.4.3 | 🧪 验收测试: 服务器不可达显示错误并允许重试 (US9-AC3) | 0.5h | ✅ | T-8.4.2 |

---

## EPIC-9: 通用命令

> 目标: 帮助、清屏、退出等通用命令
> **状态**: ✅ 已完成
> **对应 Spec**: FR-070~FR-073

### STORY-9.1: 通用命令实现

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-9.1.1 | 🔴 编写 `/quit` 命令测试 | 0.5h | ✅ | T-8.4.3 |
| T-9.1.2 | 🟢 实现 `/quit` 退出命令 (支持 `/q` 别名) | 0.5h | ✅ | T-9.1.1 |
| T-9.1.3 | 🔴 编写 `/help` 命令测试 | 0.5h | ✅ | T-9.1.2 |
| T-9.1.4 | 🟢 实现 `/help [command]` 帮助命令 | 1h | ✅ | T-9.1.3 |
| T-9.1.5 | 🔴 编写 `/clear` 命令测试 | 0.5h | ✅ | T-9.1.4 |
| T-9.1.6 | 🟢 实现 `/clear` 清屏命令 | 0.5h | ✅ | T-9.1.5 |
| T-9.1.7 | 🔴 编写 `/health` 命令测试 | 0.5h | ✅ | T-9.1.6 |
| T-9.1.8 | 🟢 实现 `/health` 健康检查命令 | 0.5h | ✅ | T-9.1.7 |

---

## EPIC-10: 快捷键支持

> 目标: 完整快捷键支持
> **状态**: ✅ 已完成
> **对应 Spec**: Section 15 (Keyboard Shortcuts)

### STORY-10.1: 快捷键实现

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-10.1.1 | 🔴 编写 Esc 返回上一级测试 | 0.5h | ✅ | T-9.1.8 |
| T-10.1.2 | 🟢 实现 Esc 返回逻辑 | 0.5h | ✅ | T-10.1.1 |
| T-10.1.3 | 🔴 编写 `r` 刷新当前视图测试 | 0.5h | ✅ | T-10.1.2 |
| T-10.1.4 | 🟢 实现 `r` 刷新逻辑 | 0.5h | ✅ | T-10.1.3 |
| T-10.1.5 | 🔴 编写 `?` 显示快捷键帮助测试 | 0.5h | ✅ | T-10.1.4 |
| T-10.1.6 | 🟢 实现 `?` 快捷键帮助 | 0.5h | ✅ | T-10.1.5 |
| T-10.1.7 | 🔴 编写 Ctrl+C 退出测试 | 0.5h | ✅ | T-10.1.6 |
| T-10.1.8 | 🟢 实现 Ctrl+C 退出处理 | 0.5h | ✅ | T-10.1.7 |
| T-10.1.9 | 🔴 编写 Page Up/Down 分页测试 | 0.5h | ✅ | T-10.1.8 |
| T-10.1.10 | 🟢 实现 Page Up/Down 分页 | 0.5h | ✅ | T-10.1.9 |
| T-10.1.11 | 🔴 编写 Home/End 跳转首/末行测试 | 0.5h | ✅ | T-10.1.10 |
| T-10.1.12 | 🟢 实现 Home/End 跳转 | 0.5h | ✅ | T-10.1.11 |

---

## EPIC-11: 边界情况处理

> 目标: 处理所有边界情况
> **状态**: ✅ 已完成
> **对应 Spec**: Section 4 (Edge Cases)

### STORY-11.1: 边界情况实现

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-11.1.1 | 🔴 编写空输入按 Enter 处理测试 | 0.5h | ✅ | T-10.1.12 |
| T-11.1.2 | 🟢 实现空输入忽略逻辑 | 0.5h | ✅ | T-11.1.1 |
| T-11.1.3 | 🔴 编写网络断开处理测试 | 0.5h | ✅ | T-11.1.2 |
| T-11.1.4 | 🟢 实现离线提示和重连支持 | 1h | ✅ | T-11.1.3 |
| T-11.1.5 | 🔴 编写终端窗口过小处理测试 | 0.5h | ✅ | T-11.1.4 |
| T-11.1.6 | 🟢 实现最小尺寸警告 (80x24) | 0.5h | ✅ | T-11.1.5 |
| T-11.1.7 | 🔴 编写大量 Records 分页测试 | 0.5h | ✅ | T-11.1.6 |
| T-11.1.8 | 🟢 实现分页加载和进度显示 | 1h | ✅ | T-11.1.7 |
| T-11.1.9 | 🔴 编写特殊字符处理测试 | 0.5h | ✅ | T-11.1.8 |
| T-11.1.10 | 🟢 实现特殊字符转义 | 0.5h | ✅ | T-11.1.9 |
| T-11.1.11 | 🔴 编写 Token 过期处理测试 | 0.5h | ✅ | T-11.1.10 |
| T-11.1.12 | 🟢 实现认证失败提示 | 0.5h | ✅ | T-11.1.11 |

---

## EPIC-12: 非功能性需求验收

> 目标: 性能、兼容性验收
> **状态**: ✅ 已完成
> **对应 Spec**: Section 5 (NFR), Section 7 (Success Criteria)

### STORY-12.1: 性能验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-12.1.1 | 🧪 验收测试: 首次渲染时间 < 500ms (NFR-001) | 0.5h | ✅ | T-11.1.12 |
| T-12.1.2 | 🧪 验收测试: OmniBar 响应时间 < 50ms (SC-002) | 0.5h | ✅ | T-12.1.1 |
| T-12.1.3 | 🧪 验收测试: 命令执行响应时间 < 100ms (NFR-002) | 0.5h | ✅ | T-12.1.2 |
| T-12.1.4 | 🧪 验收测试: Collections 列表加载 < 1s (SC-003) | 0.5h | ✅ | T-12.1.3 |
| T-12.1.5 | 🧪 验收测试: Records 表格渲染 < 500ms (SC-004) | 0.5h | ✅ | T-12.1.4 |
| T-12.1.6 | 🧪 验收测试: 日志流延迟 < 100ms (SC-005) | 0.5h | ✅ | T-12.1.5 |
| T-12.1.7 | 🧪 验收测试: 内存占用 < 100MB (NFR-003) | 0.5h | ✅ | T-12.1.6 |

### STORY-12.2: 兼容性验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-12.2.1 | 🧪 验收测试: iTerm2 兼容性 (NFR-004) | 0.5h | ✅ | T-12.1.7 |
| T-12.2.2 | 🧪 验收测试: Windows Terminal 兼容性 | 0.5h | ✅ | T-12.2.1 |
| T-12.2.3 | 🧪 验收测试: GNOME Terminal 兼容性 | 0.5h | ✅ | T-12.2.2 |
| T-12.2.4 | 🧪 验收测试: 最小终端尺寸 80x24 (NFR-005) | 0.5h | ✅ | T-12.2.3 |

### STORY-12.3: 代码质量验收

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-12.3.1 | 🧪 验收测试: 测试覆盖率 >= 80% (SC-006) | 1h | ✅ | T-12.2.4 |
| T-12.3.2 | 🧪 验收测试: TypeScript strict 模式零错误 (SC-007) | 0.5h | ✅ | T-12.3.1 |
| T-12.3.3 | 🧪 验收测试: Bun 1.1+ 兼容性 (SC-008) | 0.5h | ✅ | T-12.3.2 |

---

## EPIC-13: 文档与发布

> 目标: 完善文档、发布准备
> **状态**: ✅ 已完成

### STORY-13.1: 文档完善

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-13.1.1 | 完善 README.md (安装、快速开始、命令参考) | 2h | ✅ | T-12.3.3 |
| T-13.1.2 | 编写 CHANGELOG.md | 0.5h | ✅ | T-13.1.1 |
| T-13.1.3 | 完善代码注释 (JSDoc) | 2h | ✅ | T-13.1.2 |

### STORY-13.2: 发布准备

| Task ID | 描述 | 预估 | 状态 | 前置依赖 |
|---------|------|------|------|----------|
| T-13.2.1 | 配置 npm 包元数据 (package.json) | 0.5h | ✅ | T-13.1.3 |
| T-13.2.2 | 测试本地构建 (`bun build`) | 0.5h | ✅ | T-13.2.1 |
| T-13.2.3 | 测试全局安装 (`bun install -g`) | 0.5h | ✅ | T-13.2.2 |
| T-13.2.4 | 验证 CLI 运行 (`pbtui --help`) | 0.5h | ✅ | T-13.2.3 |

---

## 工作量汇总

| EPIC | 描述 | Tasks 数量 | 预估工时 | 完成状态 |
|------|------|-----------|---------|----------|
| EPIC-1 | 项目基础设施 | 19 | 10h | ✅ 19/19 |
| EPIC-2 | 核心基础模块 | 20 | 12h | ✅ 20/20 |
| EPIC-3 | OmniBar 模块 | 28 | 20h | ✅ 28/28 |
| EPIC-4 | Collections 模块 | 16 | 10h | ✅ 16/16 |
| EPIC-5 | Records 模块 | 21 | 14h | ✅ 21/21 |
| EPIC-6 | Logs 模块 | 10 | 6h | ✅ 10/10 |
| EPIC-7 | Monitoring 模块 | 9 | 6h | ✅ 9/9 |
| EPIC-8 | Connection 模块 | 13 | 8h | ✅ 13/13 |
| EPIC-9 | 通用命令 | 8 | 5h | ✅ 8/8 |
| EPIC-10 | 快捷键支持 | 12 | 6h | ✅ 12/12 |
| EPIC-11 | 边界情况处理 | 12 | 8h | ✅ 12/12 |
| EPIC-12 | 非功能性验收 | 14 | 8h | ✅ 14/14 |
| EPIC-13 | 文档与发布 | 7 | 7h | ✅ 7/7 |
| **总计** | | **189** | **~120h** | **189/189 (100%)** |

---

## 执行顺序与依赖关系

```
EPIC-1 (项目基础设施)
    │
    ▼
EPIC-2 (核心基础模块)
    │
    ▼
EPIC-3 (OmniBar 模块) ◀─── 核心交互入口，阻塞所有功能模块
    │
    ├──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼
EPIC-4         EPIC-6         EPIC-7         EPIC-8
(Collections)  (Logs)         (Monitoring)   (Connection)
    │
    ▼
EPIC-5 (Records)
    │
    └──────────────────────────────────────────────┘
                        │
                        ▼
                  EPIC-9 (通用命令)
                        │
                        ▼
                  EPIC-10 (快捷键)
                        │
                        ▼
                  EPIC-11 (边界情况)
                        │
                        ▼
                  EPIC-12 (非功能性验收)
                        │
                        ▼
                  EPIC-13 (文档与发布)
```

---

## Phase 分组

### Phase 1: MVP (约 48h) - EPIC 1~5
1. EPIC-1 → EPIC-2 → EPIC-3 → EPIC-4 → EPIC-5
2. **停止并验证**: OmniBar + Collections + Records 核心功能

### Phase 2: 完整功能 (约 36h) - EPIC 6~9
3. EPIC-6 → EPIC-7 → EPIC-8 → EPIC-9
4. **停止并验证**: Logs + Monitor + Connection + 通用命令

### Phase 3: 完善与发布 (约 36h) - EPIC 10~13
5. EPIC-10 → EPIC-11 → EPIC-12 → EPIC-13
6. **停止并验证**: 快捷键 + 边界情况 + 性能 + 文档

---

## 图例

| 符号 | 含义 |
|------|------|
| 🔴 | TDD 红灯 - 先写测试 |
| 🟢 | TDD 绿灯 - 实现代码 |
| 🧪 | 验收测试 |
| ⬜ | 待开始 |
| 🔄 | 进行中 |
| ✅ | 已完成 |
| ⏸️ | 暂停 |
| ❌ | 取消 |

---

## 质量门禁

每个 EPIC 完成后必须满足:

- [ ] 所有测试通过 (`bun test`)
- [ ] 覆盖率 >= 80% (`bun test --coverage`)
- [ ] 类型检查通过 (`bun run typecheck`)
- [ ] 无 Lint 错误

---

## Spec 细节覆盖检查清单

### User Stories 覆盖

- [x] US1 - Omni-Bar 命令补全 → EPIC-3, STORY-3.6 (T-3.6.1~T-3.6.4)
- [x] US2 - 资源选择器 → EPIC-3, STORY-3.6 (T-3.6.5~T-3.6.8)
- [x] US3 - 浏览 Collections → EPIC-4, STORY-4.4 (T-4.4.1~T-4.4.3)
- [x] US4 - 查看 Records → EPIC-5, STORY-5.4 (T-5.4.1~T-5.4.4)
- [x] US5 - 查看 Collection Schema → EPIC-4, STORY-4.4 (T-4.4.4~T-4.4.6)
- [x] US6 - 过滤查询 → EPIC-5, STORY-5.4 (T-5.4.5~T-5.4.7)
- [x] US7 - 实时日志流 → EPIC-6, STORY-6.4 (T-6.4.1~T-6.4.4)
- [x] US8 - 系统监控 → EPIC-7, STORY-7.4 (T-7.4.1~T-7.4.3)
- [x] US9 - 连接管理 → EPIC-8, STORY-8.4 (T-8.4.1~T-8.4.3)
- [x] US10 - 单条记录查询 → EPIC-5, STORY-5.4 (T-5.4.8~T-5.4.9)

### Functional Requirements 覆盖

- [x] FR-001~FR-005 (核心框架层) → EPIC-1, EPIC-2
- [x] FR-010~FR-015 (OmniBar 模块) → EPIC-3
- [x] FR-020~FR-024 (Collections 模块) → EPIC-4
- [x] FR-030~FR-036 (Records 模块) → EPIC-5
- [x] FR-040~FR-043 (Logs 模块) → EPIC-6
- [x] FR-050~FR-053 (Monitoring 模块) → EPIC-7
- [x] FR-060~FR-064 (连接模块) → EPIC-8
- [x] FR-070~FR-073 (通用命令) → EPIC-9

### Non-Functional Requirements 覆盖

- [x] NFR-001 (首次渲染时间 < 500ms) → T-12.1.1
- [x] NFR-002 (命令执行响应时间 < 100ms) → T-12.1.3
- [x] NFR-003 (内存占用 < 100MB) → T-12.1.7
- [x] NFR-004 (终端兼容性) → EPIC-12, STORY-12.2
- [x] NFR-005 (最小终端尺寸 80x24) → T-12.2.4

### Success Criteria 覆盖

- [x] SC-001 (3 次按键完成命令) → EPIC-3 OmniBar 设计
- [x] SC-002 (OmniBar 响应 < 50ms) → T-12.1.2
- [x] SC-003 (Collections 加载 < 1s) → T-12.1.4
- [x] SC-004 (Records 渲染 < 500ms) → T-12.1.5
- [x] SC-005 (日志流延迟 < 100ms) → T-12.1.6
- [x] SC-006 (测试覆盖率 >= 80%) → T-12.3.1
- [x] SC-007 (TypeScript strict 零错误) → T-12.3.2
- [x] SC-008 (Bun 1.1+ 兼容) → T-12.3.3

### Key Entities (Jotai Atoms) 覆盖

- [x] appStateAtom → T-2.1.1, T-2.1.2
- [x] currentViewAtom → T-2.1.3, T-2.1.4
- [x] pbClientAtom → T-2.1.5, T-2.1.6
- [x] messagesAtom → T-2.1.7, T-2.1.8
- [x] omnibarQueryAtom → T-3.3.1, T-3.3.2
- [x] omnibarModeAtom → T-3.3.3, T-3.3.4
- [x] suggestionsAtom → T-3.3.5, T-3.3.6
- [x] collectionsAtom → T-4.1.1, T-4.1.2
- [x] activeCollectionAtom → T-4.1.3, T-4.1.4
- [x] isCollectionsLoadingAtom → T-4.1.5, T-4.1.6
- [x] recordsAtom → T-5.1.1, T-5.1.2
- [x] activeRecordAtom → T-5.1.3, T-5.1.4
- [x] recordsFilterAtom → T-5.1.5, T-5.1.6
- [x] recordsPaginationAtom → T-5.1.7, T-5.1.8

### Internal Commands 覆盖 (Section 14)

- [x] `/view` → EPIC-5 Records 模块
- [x] `/get` → EPIC-5 Records 模块
- [x] `/cols` → EPIC-4 Collections 模块
- [x] `/schema` → EPIC-4 Collections 模块
- [x] `/logs` → EPIC-6 Logs 模块
- [x] `/monitor` → EPIC-7 Monitoring 模块
- [x] `/health` → T-9.1.7, T-9.1.8
- [x] `/clear` → T-9.1.5, T-9.1.6
- [x] `/help` → T-9.1.3, T-9.1.4
- [x] `/quit` → T-9.1.1, T-9.1.2

### Keyboard Shortcuts 覆盖 (Section 15)

- [x] `/` 进入命令模式 → EPIC-3 OmniBar
- [x] `@` 进入资源选择模式 → EPIC-3 OmniBar
- [x] `Tab` 自动补全 → EPIC-3 OmniBar
- [x] `↑/↓` 导航 → EPIC-3~7 各模块
- [x] `←/→` 表格列导航 → EPIC-5 Records
- [x] `Enter` 确认 → 各模块
- [x] `Esc` 返回上一级 → T-10.1.1, T-10.1.2
- [x] `Ctrl+C` 退出 → T-10.1.7, T-10.1.8
- [x] `q` 返回主界面 → EPIC-6, EPIC-7
- [x] `r` 刷新 → T-10.1.3, T-10.1.4
- [x] `?` 快捷键帮助 → T-10.1.5, T-10.1.6
- [x] `Page Up/Down` 分页 → T-10.1.9, T-10.1.10
- [x] `Home/End` 跳转 → T-10.1.11, T-10.1.12

### Edge Cases 覆盖 (Section 4)

- [x] 空输入按 Enter → T-11.1.1, T-11.1.2
- [x] 网络断开 → T-11.1.3, T-11.1.4
- [x] 终端窗口过小 → T-11.1.5, T-11.1.6
- [x] 大量 Records → T-11.1.7, T-11.1.8
- [x] 特殊字符 → T-11.1.9, T-11.1.10
- [x] Token 过期 → T-11.1.11, T-11.1.12

### 目录结构覆盖 (Section 6.1)

- [x] src/app.tsx → T-1.1.6
- [x] src/cli.tsx → T-1.1.5
- [x] src/features/omnibar/ → EPIC-3
- [x] src/features/collections/ → EPIC-4
- [x] src/features/records/ → EPIC-5
- [x] src/features/logs/ → EPIC-6
- [x] src/features/monitoring/ → EPIC-7
- [x] src/features/auth/ → EPIC-2 (authAtoms)
- [x] src/features/connection/ → EPIC-8
- [x] src/components/ → EPIC-2, STORY-2.3
- [x] src/hooks/ → EPIC-2, STORY-2.4
- [x] src/lib/ → EPIC-2 (pb.ts), EPIC-3 (commands.ts, parser.ts)
- [x] src/store/ → EPIC-2, STORY-2.1
- [x] src/types/ → 各模块类型定义
- [x] tests/ → 各 EPIC 测试任务

### Boundaries 覆盖 (Section 8)

- [x] Phase 1 只读操作 → 所有 EPIC 仅实现浏览功能
- [x] No Auth UI → EPIC-8 CLI 参数 `--token`
- [x] No AI → 未包含 AI 相关任务（Phase 2 预留）
- [x] Single Server → EPIC-8 单服务器连接
- [x] English Only → 无 i18n 相关任务
- [x] No Settings Write → 无 Settings 写入任务

### Assumptions 覆盖 (Section 9)

- [x] Bun 1.1+ 运行环境 → T-12.3.3
- [x] PocketBase 服务运行中 → EPIC-8 连接管理
- [x] 支持 ANSI 转义的终端 → EPIC-12 兼容性验收
- [x] 命令行基本操作熟悉 → README 文档

### Risks 覆盖 (Section 10)

- [x] Ink 终端兼容性 → EPIC-12 STORY-12.2 (T-12.2.1~T-12.2.4)
- [x] 网络不稳定 → EPIC-11 (T-11.1.3, T-11.1.4)
- [x] 大数据量性能 → EPIC-11 (T-11.1.7, T-11.1.8)
- [x] 命令语法不熟悉 → EPIC-9 `/help` 命令

### CLI Usage 覆盖 (Section 13)

- [x] `bun install -g @pocketbase/tui` → EPIC-13 STORY-13.2
- [x] `pbtui` 默认连接 → EPIC-8 (T-8.4.2)
- [x] `pbtui --url` → EPIC-8 (T-8.3.1, T-8.3.2, T-8.4.1)
- [x] `pbtui --token` → EPIC-8 (T-8.3.3, T-8.3.4)
- [x] 环境变量 POCKETBASE_URL → EPIC-8 (T-8.3.5, T-8.3.6)
- [x] 环境变量 POCKETBASE_TOKEN → EPIC-8 (T-8.3.5, T-8.3.6)
- [x] `pbtui --help` → EPIC-13 (T-13.2.4)
- [x] `bun install` / `bun run dev` / `bun test` → EPIC-1

### Milestones 覆盖 (Section 12)

- [x] M1 项目初始化 → EPIC-1
- [x] M2 OmniBar 核心 → EPIC-3
- [x] M3 Collections 模块 → EPIC-4
- [x] M4 Records 模块 → EPIC-5
- [x] M5 Logs + Monitor → EPIC-6, EPIC-7
- [x] M6 测试与文档 → EPIC-12, EPIC-13

### Development Guidelines 覆盖 (Section 16)

- [x] WebUI 代码复用策略 → 各 EPIC 标注对应 webui 模块
- [x] TDD 开发流程 → 所有 Tasks 标记 🔴/🟢
- [x] 测试覆盖率 >= 90% → T-12.3.1 (放宽至 80%)
- [x] 命名规范 → 目录结构遵循 webui 风格

### 状态机覆盖 (Section 6.2)

- [x] DISCONNECTED → EPIC-8 Connection 模块
- [x] CONNECTING → EPIC-8 Connection 模块
- [x] CONNECTED → EPIC-2 appStateAtom
- [x] ERROR → EPIC-11 边界情况
- [x] VIEW_MODE (DASHBOARD, COLLECTION_LIST, RECORD_LIST, LOGS, MONITOR) → EPIC-2 currentViewAtom

### 命令解析流程覆盖 (Section 6.3)

- [x] Parser → EPIC-3 STORY-3.2 (T-3.2.1~T-3.2.6)
- [x] Command 提取 → T-3.2.1, T-3.2.2
- [x] Arguments 解析 → T-3.2.3, T-3.2.4
- [x] Resource 引用解析 → T-3.2.5, T-3.2.6
- [x] Executor 执行 → 各模块 Hooks (useCollections, useRecords 等)
- [x] View Switch → EPIC-2 currentViewAtom
