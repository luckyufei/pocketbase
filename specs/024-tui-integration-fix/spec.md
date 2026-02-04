# Feature Specification: TUI Console Integration Fix

**Feature Branch**: `024-tui-integration-fix`  
**Created**: 2026-02-04  
**Status**: Completed ✅  
**Input**: Testing findings from `023-tui-console`

## 1. Problem Essence (核心问题)

在 023-tui-console 实现后，功能测试发现以下问题：

1. **`app.tsx` 未集成功能组件** - 主应用组件只是静态展示，未集成 OmniBar、命令处理、视图切换
2. **API 端点错误** - 部分 API 调用使用了错误的端点
3. **命令执行流程未连通** - 解析器和组件存在但未连接

**目标**: 修复以上问题，使 TUI 能够正常运行和使用。

## 2. Testing Findings (测试发现)

### 2.1 验证通过的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| CLI 参数解析 | ✅ | `--url`, `--token`, `--help` 正常工作 |
| 命令解析器 | ✅ | `parseCommand`, `parseResource` 正确解析 |
| 命令注册表 | ✅ | 所有命令定义正确 |
| PocketBase SDK | ✅ | 客户端创建和 token 认证正常 |
| Health API | ✅ | `/api/health` 正常响应 |
| Collections API | ✅ | 使用 token 后正常获取 |
| Logs API | ✅ | `/api/logs` 端点正常 |
| Metrics API | ✅ | `/api/system/metrics` 正常响应 |
| 单元测试 | ✅ | 600 tests pass, 0 fail |

### 2.2 发现并修复的问题

#### ✅ P0 - 核心功能缺失 (已修复)

1. **`app.tsx` 集成功能组件**
   - ✅ 集成 `OmniBar` 组件
   - ✅ 集成 `ViewRenderer` 视图切换
   - ✅ 连接 PocketBase 客户端
   - ✅ 全局键盘快捷键支持

2. **命令执行流程连通**
   - ✅ `useCommandRouter` hook 实现命令路由
   - ✅ 根据命令切换视图
   - ✅ 调用相应的 API

#### ✅ P1 - API 端点错误 (已修复)

3. **`logsApi.ts` 使用正确端点**
   - ✅ 修改为: `pb.send("/api/logs", { query: {...} })`

4. **`monitoringApi.ts` 使用正确端点**
   - ✅ 修改为: `pb.send("/api/system/metrics", {})`

#### ✅ P2 - TypeScript/Ink v5 兼容性问题 (已修复)

5. **Ink v5 不支持 `backgroundColor` prop**
   - ✅ 改用 `inverse` prop + 颜色变化实现高亮

6. **ShortcutConfig 类型定义**
   - ✅ 将 `key` 改为可选属性 (`key?`)

7. **ViewRenderer 导入缺失的 atom**
   - ✅ 移除不存在的 `currentCollectionAtom` 导入

## 3. Requirements (修复要求)

### FR-001: App 组件集成
- App 组件 MUST 集成 OmniBar 组件
- App 组件 MUST 集成 Layout 组件
- App 组件 MUST 基于 currentViewAtom 渲染不同视图
- App 组件 MUST 连接 PocketBase 客户端

### FR-002: 命令执行流程
- OmniBar MUST 在执行命令后触发视图切换
- `/cols` 命令 MUST 切换到 CollectionsList 视图
- `/view @collection` 命令 MUST 切换到 RecordsTable 视图
- `/schema @collection` 命令 MUST 切换到 SchemaView 视图
- `/logs` 命令 MUST 切换到 LogStream 视图
- `/monitor` 命令 MUST 切换到 MonitorDashboard 视图
- `/health` 命令 MUST 显示健康状态消息
- `/help` 命令 MUST 显示帮助信息
- `/clear` 命令 MUST 清空消息区域
- `/quit` 命令 MUST 退出应用

### FR-003: API 端点修复
- `logsApi.fetchLogs` MUST 使用 `/api/logs` 端点
- `monitoringApi.fetchMetrics` MUST 使用 `/api/system/metrics` 端点

### FR-004: 状态管理集成
- MUST 使用 Jotai Provider 包装 App
- MUST 正确初始化 pbClientAtom
- MUST 正确处理连接状态变化

## 4. Architecture Design (架构设计)

### 4.1 应用数据流

```
┌──────────────────────────────────────────────────────────────┐
│                          App.tsx                             │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐│
│  │                     Layout.tsx                           ││
│  │  ┌────────────────────────────────────────────────────┐  ││
│  │  │                   StatusBar                        │  ││
│  │  │  Server: http://127.0.0.1:8090  | Connected ●      │  ││
│  │  └────────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │  ┌────────────────────────────────────────────────────┐  ││
│  │  │                  Content Area                      │  ││
│  │  │  ┌──────────────────────────────────────────────┐  │  ││
│  │  │  │  View (based on currentViewAtom)            │  │  ││
│  │  │  │  - dashboard: Welcome message               │  │  ││
│  │  │  │  - collections: CollectionsList             │  │  ││
│  │  │  │  - records: RecordsTable                    │  │  ││
│  │  │  │  - logs: LogStream                          │  │  ││
│  │  │  │  - monitor: MonitorDashboard                │  │  ││
│  │  │  │  - schema: SchemaView                       │  │  ││
│  │  │  │  - help: HelpView                           │  │  ││
│  │  │  └──────────────────────────────────────────────┘  │  ││
│  │  └────────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │  ┌────────────────────────────────────────────────────┐  ││
│  │  │                    OmniBar                         │  ││
│  │  │  ❯ /cols                                           │  ││
│  │  └────────────────────────────────────────────────────┘  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 4.2 命令执行流程

```
用户输入 "/cols" + Enter
        │
        ▼
  ┌─────────────┐
  │  OmniBar    │ onExecute(query)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │parseCommand │ {command: "/cols", ...}
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │CommandRouter│ match("/cols")
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────┐
  │ setCurrentView("cols")  │
  │ fetchCollections(pb)    │
  └─────────────────────────┘
         │
         ▼
  ┌─────────────────────────┐
  │ Re-render with          │
  │ CollectionsList         │
  └─────────────────────────┘
```

### 4.3 新文件列表

```
tui/src/
├── app.tsx                    # 需要重写
├── features/
│   ├── commands/
│   │   └── hooks/
│   │       └── useCommandRouter.ts  # 新增：命令路由 hook
│   └── ...
└── components/
    └── ViewRenderer.tsx       # 新增：视图渲染器
```

## 5. Implementation Plan (实现计划)

### Epic 1: API 端点修复
| Task | 描述 | 预计时间 |
|------|------|---------|
| T-1.1 | 修复 `logsApi.ts` 使用正确端点 | 15min |
| T-1.2 | 修复 `monitoringApi.ts` 使用正确端点 | 15min |
| T-1.3 | 更新相关测试 | 30min |

### Epic 2: 命令路由实现
| Task | 描述 | 预计时间 |
|------|------|---------|
| T-2.1 | 创建 `useCommandRouter` hook | 30min |
| T-2.2 | 实现各命令处理函数 | 45min |
| T-2.3 | 编写单元测试 | 30min |

### Epic 3: App 组件集成
| Task | 描述 | 预计时间 |
|------|------|---------|
| T-3.1 | 重写 `app.tsx` 集成所有组件 | 60min |
| T-3.2 | 创建 `ViewRenderer` 组件 | 30min |
| T-3.3 | 集成 Jotai Provider | 15min |
| T-3.4 | 编写集成测试 | 30min |

### Epic 4: 端到端测试
| Task | 描述 | 预计时间 |
|------|------|---------|
| T-4.1 | 手动测试所有命令 | 30min |
| T-4.2 | 修复发现的问题 | Variable |
| T-4.3 | 更新文档 | 15min |

## 6. Success Criteria (成功标准)

| 标准 | 状态 | 验证日期 |
|------|------|---------|
| 启动 TUI 后可以看到 OmniBar 输入框 | ✅ | 2026-02-04 |
| `/health` 显示健康状态 | ✅ | 2026-02-04 |
| 快捷键（Esc, ?, Ctrl+C）正常工作 | ✅ | 2026-02-04 |
| 所有测试通过 | ✅ | 2026-02-04 (600 pass, 0 fail) |
| API 端点正确调用 | ✅ | 2026-02-04 |
| TypeScript 类型检查通过 | ✅ | 2026-02-04 |

## 7. Changes Made (完成的修改)

### 7.1 API 端点修复

| 文件 | 修改内容 |
|------|---------|
| `src/features/logs/lib/logsApi.ts` | `pb.collection("_logs")` → `pb.send("/api/logs")` |
| `src/features/monitoring/lib/monitoringApi.ts` | `/api/stats` → `/api/system/metrics` |

### 7.2 新增文件

| 文件 | 描述 |
|------|------|
| `src/features/commands/hooks/useCommandRouter.ts` | 命令路由 hook，解析并执行命令 |
| `src/components/ViewRenderer.tsx` | 视图渲染器，根据 currentViewAtom 渲染不同视图 |

### 7.3 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/app.tsx` | 完全重写，集成 OmniBar、ViewRenderer、键盘快捷键、连接管理 |
| `src/features/keyboard/lib/keyboardShortcuts.ts` | `key` 改为可选属性 |
| `src/features/collections/components/CollectionsList.tsx` | 移除 `backgroundColor`，使用 `inverse` |
| `src/features/records/components/RecordsTable.tsx` | 移除 `backgroundColor`，使用 `inverse` |
| `src/features/logs/components/LogStream.tsx` | 移除 `backgroundColor`，使用 `inverse` |

### 7.4 测试更新

| 文件 | 修改内容 |
|------|---------|
| `tests/features/logs/logsApi.test.ts` | 更新 mock 使用 `pb.send()` |
| `tests/features/logs/logs.acceptance.test.ts` | 更新 mock 格式 |
| `tests/features/monitoring/monitoringApi.test.ts` | 更新 mock 使用新端点 |
| `tests/features/monitoring/monitoring.acceptance.test.ts` | 更新期望值 |
| `tests/features/keyboard/keyboard.acceptance.test.ts` | 修复类型错误 |

## 8. Risks & Mitigations (风险与缓解)

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Ink 渲染复杂度 | 中 | 逐步集成，每步验证 |
| 状态管理复杂 | 中 | 使用 Jotai 简化，分步测试 |
| API 响应格式变化 | 低 | 参考 WebUI 实现，验证端点 |
