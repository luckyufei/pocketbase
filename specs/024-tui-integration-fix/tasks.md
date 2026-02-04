# TUI Integration Fix - Tasks

**Spec**: [spec.md](./spec.md)  
**Progress**: 28/28 (100%) ✅ Complete

---

## Epic 1: API 端点修复 (6/6) ✅

### STORY-1.1: 修复 logsApi 端点 (2/2) ✅

**目标**: 修复 `logsApi.ts` 使用正确的 `/api/logs` 端点

- [x] **T-1.1.1**: 修改 `fetchLogs` 函数使用 `pb.send("/api/logs", ...)` 而非 `pb.collection("_logs")`
- [x] **T-1.1.2**: 更新返回数据的转换逻辑以匹配 `/api/logs` 响应格式

### STORY-1.2: 修复 monitoringApi 端点 (2/2) ✅

**目标**: 修复 `monitoringApi.ts` 使用正确的 `/api/system/metrics` 端点

- [x] **T-1.2.1**: 修改 `fetchMetrics` 函数使用 `pb.send("/api/system/metrics", ...)` 而非 `/api/stats`
- [x] **T-1.2.2**: 更新返回数据的转换逻辑以匹配实际响应格式

### STORY-1.3: 更新 API 测试 (2/2) ✅

**目标**: 确保测试覆盖修复后的 API

- [x] **T-1.3.1**: 更新 `logs.test.ts` 测试正确的端点调用
- [x] **T-1.3.2**: 更新 `monitoring.test.ts` 测试正确的端点调用

---

## Epic 2: 命令路由实现 (6/6) ✅

### STORY-2.1: 创建命令路由 Hook (3/3) ✅

**目标**: 实现 `useCommandRouter` hook 处理命令分发

- [x] **T-2.1.1**: 创建 `src/features/commands/hooks/useCommandRouter.ts`
- [x] **T-2.1.2**: 实现 `executeCommand` 函数，根据命令调用相应处理
- [x] **T-2.1.3**: 集成视图切换和数据获取逻辑

### STORY-2.2: 命令处理函数 (3/3) ✅

**目标**: 实现各命令的处理逻辑

- [x] **T-2.2.1**: 实现 `/cols` - 获取 collections 并切换视图
- [x] **T-2.2.2**: 实现 `/view`, `/schema`, `/get` - 记录相关命令
- [x] **T-2.2.3**: 实现 `/logs`, `/monitor`, `/health`, `/help`, `/clear`, `/quit`

---

## Epic 3: App 组件集成 (10/10) ✅

### STORY-3.1: 重写 App 组件 (4/4) ✅

**目标**: 集成所有功能组件到 `app.tsx`

- [x] **T-3.1.1**: 添加 Jotai Provider 包装
- [x] **T-3.1.2**: 初始化 PocketBase 客户端并存入 state
- [x] **T-3.1.3**: 连接时检查健康状态
- [x] **T-3.1.4**: 集成 OmniBar 和 ViewRenderer

### STORY-3.2: ViewRenderer 组件 (3/3) ✅

**目标**: 创建视图渲染器根据状态显示不同视图

- [x] **T-3.2.1**: 创建 `src/components/ViewRenderer.tsx`
- [x] **T-3.2.2**: 根据 `currentViewAtom` 渲染对应组件
- [x] **T-3.2.3**: 传递必要的 props（collections, records, logs, metrics）

### STORY-3.3: 命令执行连接 (3/3) ✅

**目标**: 连接 OmniBar 和命令路由

- [x] **T-3.3.1**: OmniBar `onExecute` 调用 `useCommandRouter`
- [x] **T-3.3.2**: 命令执行后清空输入并更新视图
- [x] **T-3.3.3**: 错误处理和消息显示

---

## Epic 4: 端到端测试 (6/6) ✅

### STORY-4.1: 手动功能验证 (3/3) ✅

**目标**: 验证所有功能正常工作

- [x] **T-4.1.1**: 验证 `/cols` 显示集合列表
- [x] **T-4.1.2**: 验证 `/view @users`, `/schema @users` 显示记录和 schema
- [x] **T-4.1.3**: 验证 `/logs`, `/monitor`, `/health`, `/help`, `/quit`

### STORY-4.2: 快捷键验证 (2/2) ✅

**目标**: 验证快捷键正常工作

- [x] **T-4.2.1**: 验证 `Esc` 返回、`?` 帮助
- [x] **T-4.2.2**: 验证 `Ctrl+C` 退出

### STORY-4.3: 文档更新 (1/1) ✅

**目标**: 更新相关文档

- [x] **T-4.3.1**: 更新 spec.md 说明运行方式和测试状态

---

## 验收标准

| 标准 | 状态 |
|------|------|
| TUI 启动显示 OmniBar | ✅ |
| `/cols` 正确显示集合 | ✅ |
| `/view @collection` 显示记录 | ✅ |
| `/logs` 显示日志 | ✅ |
| `/monitor` 显示监控 | ✅ |
| `/health` 显示状态 | ✅ |
| `/quit` 正确退出 | ✅ |
| 快捷键工作 | ✅ |
| 测试通过 | ✅ (600 pass, 0 fail) |
| TypeScript 类型检查 | ✅ |

---

## 执行记录

### 2026-02-04 (完成)

**发现的问题** (已修复):
1. ✅ `app.tsx` 只是静态展示，未集成任何功能组件
2. ✅ `logsApi.ts` 使用 `pb.collection("_logs")` 但实际端点是 `/api/logs`
3. ✅ `monitoringApi.ts` 使用 `/api/stats` 但实际端点是 `/api/system/metrics`
4. ✅ 命令执行流程未连通
5. ✅ Ink v5 不支持 `backgroundColor` prop
6. ✅ `ShortcutConfig.key` 应该是可选的
7. ✅ `ViewRenderer` 导入了不存在的 `currentCollectionAtom`

**额外修复**:
1. ✅ 修复 `LogStream` 组件的 `getLevelBadge` 函数类型错误
2. ✅ 修复 `keyboard.acceptance.test.ts` 类型错误
3. ✅ 添加 token 指示器显示到 App 组件

**API 端点验证**:
- ✅ `/api/health` - 正常响应
- ✅ `/api/collections` - 需要 token，返回集合列表
- ✅ `/api/logs` - 返回日志条目 (759 items)
- ✅ `/api/system/metrics` - 返回监控指标 (15 items)

**测试结果**:
- CLI 参数: ✅
- 命令解析: ✅
- PocketBase SDK: ✅
- Health API: ✅
- Collections API: ✅ (需 token)
- Logs API: ✅ (`/api/logs`)
- Metrics API: ✅ (`/api/system/metrics`)
- 单元测试: ✅ (600 pass, 0 fail)
- TypeScript: ✅ (0 errors)
