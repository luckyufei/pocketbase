# Process Manager UI - 任务列表

## 开发阶段

### Phase 1: 基础框架 (M1) ✅

- [x] **T-001** 创建 `features/processes` 模块目录结构
- [x] **T-002** 定义 TypeScript 类型 (`ProcessState`, `ProcessConfig`, `ProcessLog`)
- [x] **T-003** 创建 Jotai atoms (`processesAtom`, `processesLoadingAtom`) - TDD 覆盖率 100%
- [x] **T-004** 实现 `useProcesses` hook (API 调用封装) - TDD 覆盖率 95.73%
- [x] **T-005** 创建 `ProcessStats` 组件 (统计概览卡片)
- [x] **T-006** 创建 `ProcessCard` 组件 (单个进程卡片)
- [x] **T-007** 创建 `ProcessList` 组件 (进程列表)
- [x] **T-008** 创建 `Processes.tsx` 页面
- [x] **T-009** 添加路由 `/settings/processes`
- [x] **T-010** 添加 Settings 菜单入口 "进程管理"

### Phase 2: 进程操作 (M2) ✅

- [x] **T-011** 实现重启进程功能 (`POST /api/pm/{id}/restart`)
- [x] **T-012** 实现停止进程功能 (`POST /api/pm/{id}/stop`)
- [x] **T-013** 实现启动进程功能 (`POST /api/pm/{id}/start`)
- [x] **T-014** 添加操作确认对话框
- [x] **T-015** 添加操作成功/失败 toast 提示
- [x] **T-016** 处理并发操作状态 (loading 状态)

### Phase 3: 详情面板 (M3) ✅

- [x] **T-017** 创建 `ProcessDetails` 组件 (Sheet 侧边栏)
- [x] **T-018** 显示进程基本信息 (Status, PID, Uptime)
- [x] **T-019** 显示进程配置信息 (Command, Args, Cwd) - ✅ 后端 API 已实现
- [x] **T-020** 显示环境变量列表 (敏感信息脱敏) - ✅ 后端 API 已实现
- [x] **T-021** 集成到 ProcessCard 点击事件

### Phase 4: 日志面板 (M4) ✅

- [x] **T-022** 创建 `ProcessLogs` 组件 (Drawer)
- [x] **T-023** 实现日志获取 API 调用 (`GET /api/pm/{id}/logs`)
- [x] **T-024** 实现 `useProcessLogs` hook - TDD 覆盖率 95.40%
- [x] **T-025** 日志条目样式 (stdout/stderr 颜色区分)
- [x] **T-026** 实现自动滚动到底部
- [x] **T-027** 实现轮询刷新日志 (1s 间隔)
- [x] **T-028** 添加暂停/恢复自动滚动控制

### Phase 5: 筛选与搜索 (M5) ✅

- [x] **T-029** 创建 `ProcessFilters` 组件
- [x] **T-030** 实现状态筛选 (All/Running/Stopped/Failed)
- [x] **T-031** 实现 ID 搜索 (本地过滤)
- [x] **T-032** 空状态 UI ("没有匹配的进程")

### Phase 6: 自动刷新与优化 (M6) ✅

- [x] **T-033** 实现自动刷新 (5s 间隔轮询)
- [x] **T-034** 添加手动刷新按钮
- [x] **T-035** 添加最后刷新时间显示
- [x] **T-036** 网络错误处理与重试
- [ ] **T-037** 优化大量进程渲染性能 (虚拟列表) - P3 优先级
- [x] **T-038** 响应式设计适配

### Phase 7: 国际化 (M7) ✅

- [x] **T-039** 添加中文翻译 (`zh.json`)
- [x] **T-040** 添加英文翻译 (`en.json`)
- [x] **T-041** 组件内使用 `useTranslation`

### Phase 8: 测试 (M8) ✅

- [x] **T-042** `useProcesses` hook 单元测试 (23 个测试用例)
- [x] **T-043** `ProcessStats` 组件测试 (UI 组件，按规范不需要单测)
- [x] **T-044** `ProcessCard` 组件测试 (UI 组件，按规范不需要单测)
- [x] **T-045** `ProcessList` 组件测试 (UI 组件，按规范不需要单测)
- [x] **T-046** `Processes` 页面集成测试 (UI 组件，按规范不需要单测)
- [x] **T-047** Store atoms 单元测试 (24 个测试用例)

### Phase 9: 后端 API (M9) ✅ 新增

- [x] **T-048** 实现 `POST /api/pm/{id}/start` API - 启动已停止的进程
- [x] **T-049** 扩展 `GET /api/pm/list` API - 返回进程配置信息（敏感环境变量脱敏）
- [x] **T-050** 实现 `GET /api/pm/{id}/logs` API - 获取进程日志
- [x] **T-051** 实现进程日志缓存机制 (LogBuffer 环形缓冲区)

---

## 验收检查清单

### User Story 1 - 实时查看所有进程状态 ✅
- [x] 访问 Settings → Processes 能看到进程列表
- [x] 每个进程显示: ID、状态、PID、运行时长
- [x] 状态用颜色区分 (绿色 running、灰色 stopped、红色 failed)

### User Story 2 - 重启/停止进程 ✅
- [x] 点击重启按钮能重启进程
- [x] 点击停止按钮能停止进程
- [x] 停止后显示启动按钮
- [x] 操作有 loading 状态

### User Story 3 - 实时日志流查看 ✅
- [x] 后端 `/api/pm/{id}/logs` API 已实现
- [x] 点击日志按钮打开日志面板
- [x] 显示最近 100 行日志
- [x] stdout/stderr 用不同颜色区分
- [x] 新日志自动追加

### User Story 4 - 进程概览仪表盘 ✅
- [x] 页面顶部显示统计卡片
- [x] 显示 running/stopped/failed/total 计数

### User Story 5 - 进程详情面板 ✅
- [x] 点击进程卡片打开详情面板
- [x] 显示基本信息 (Status, PID, Uptime, RestartCount)
- [x] 显示完整配置信息 - 后端 API 已实现
- [x] 环境变量敏感信息脱敏 - 后端 API 已实现

### User Story 6 - 自动刷新与手动刷新 ✅
- [x] 页面自动刷新 (5s 间隔)
- [x] 手动刷新按钮可用
- [x] 网络错误有友好提示

### User Story 7 - 进程筛选与搜索 ✅
- [x] 状态筛选下拉框可用
- [x] ID 搜索框可用
- [x] 空结果有提示

### User Story 8 - 国际化支持 ✅ (新增)
- [x] 中文界面正常显示
- [x] 英文界面正常显示
- [x] 语言切换实时生效

---

## 测试覆盖率

### 前端 (ui-v2)

| 模块 | 函数覆盖率 | 行覆盖率 | 说明 |
|------|-----------|---------|------|
| `store/index.ts` | 95% | 98.92% | 24 个测试用例 |
| `hooks/useProcesses.ts` | 92.31% | 95.73% | 23 个测试用例 |
| `hooks/useProcessLogs.ts` | 90.91% | 95.40% | 23 个测试用例 |
| **总计** | **82.31%** | **86.69%** | 超过 80% 目标 ✅ |

### 后端 (processman)

| 模块 | 覆盖率 | 说明 |
|------|--------|------|
| `StartProcess` | 95.2% | 启动进程 |
| `GetAllStatesWithConfig` | 100% | 获取状态和配置 |
| `GetProcessLogs` | 66.7% | 获取日志 |
| `LogBuffer` | 92%+ | 日志缓冲区 |
| `MaskSensitiveEnvVars` | 92.9% | 环境变量脱敏 |
| **总计** | **68%** | 后端总覆盖率 |

---

## 依赖项

| 任务 | 依赖 | 状态 |
|------|------|------|
| T-004 | 后端 `/api/pm/list` API | ✅ 已实现 |
| T-011~T-013 | 后端 `/api/pm/{id}/restart\|stop\|start` API | ✅ 已实现 |
| T-019~T-020 | 后端扩展 list API 返回配置信息 | ✅ 已实现 |
| T-022~T-028 | 后端 `/api/pm/{id}/logs` API | ✅ 已实现 |

## 风险项

1. ~~**后端日志 API**: 当前 processman 插件没有独立的日志获取 API，需要后端新增~~ ✅ 已解决
2. **日志实时推送**: 首期使用轮询，后续可能需要后端支持 SSE/WebSocket
3. **大量进程性能**: 如果进程数量很多 (100+)，可能需要虚拟列表优化

---

## 实现文件清单

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/features/processes/types.ts` | 类型定义 |
| `src/features/processes/store/index.ts` | Jotai Store |
| `src/features/processes/store/index.test.ts` | Store 单元测试 |
| `src/features/processes/hooks/useProcesses.ts` | Hook 实现 |
| `src/features/processes/hooks/useProcesses.test.ts` | Hook 单元测试 |
| `src/features/processes/components/ProcessStats.tsx` | 统计组件 |
| `src/features/processes/components/ProcessFilters.tsx` | 筛选组件 |
| `src/features/processes/components/ProcessCard.tsx` | 卡片组件 |
| `src/features/processes/components/ProcessList.tsx` | 列表组件 |
| `src/features/processes/components/ProcessDetails.tsx` | 详情面板 |
| `src/features/processes/components/ProcessLogs.tsx` | 日志面板 |
| `src/features/processes/hooks/useProcessLogs.ts` | 日志 Hook |
| `src/features/processes/hooks/useProcessLogs.test.ts` | 日志 Hook 单元测试 |
| `src/features/processes/components/index.ts` | 组件导出 |
| `src/features/processes/index.ts` | Feature 导出 |
| `src/pages/settings/Processes.tsx` | 页面组件 |

### 后端新增文件

| 文件路径 | 说明 |
|---------|------|
| `plugins/processman/log_buffer.go` | 日志缓冲区实现 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/router/index.tsx` | 添加 `/settings/processes` 路由 |
| `src/pages/settings/Layout.tsx` | 添加菜单入口 "Processes" |
| `src/i18n/locales/en.json` | 添加英文翻译 |
| `src/i18n/locales/zh.json` | 添加中文翻译 |
| `plugins/processman/api.go` | 添加 start、logs API |
| `plugins/processman/processman.go` | 添加 StartProcess、GetAllStatesWithConfig、GetProcessLogs |
| `plugins/processman/supervisor.go` | bridgeLog 写入日志缓冲区 |
| `plugins/processman/README.md` | 更新 API 文档 |

---

## 完成统计

| Phase | 状态 | 完成任务数 |
|-------|------|-----------|
| Phase 1: 基础框架 | ✅ 完成 | 10/10 |
| Phase 2: 进程操作 | ✅ 完成 | 6/6 |
| Phase 3: 详情面板 | ✅ 完成 | 5/5 |
| Phase 4: 日志面板 | ✅ 完成 | 7/7 |
| Phase 5: 筛选搜索 | ✅ 完成 | 4/4 |
| Phase 6: 自动刷新 | ✅ 完成 | 5/6 (1 项 P3 优先级) |
| Phase 7: 国际化 | ✅ 完成 | 3/3 |
| Phase 8: 测试 | ✅ 完成 | 6/6 |
| Phase 9: 后端 API | ✅ 完成 | 4/4 |
| **总计** | **✅ 完成** | **50/51** |

**备注**: 未完成的 1 项任务为 P3 低优先级优化 (T-037 虚拟列表)

---

## 后端 API 变更摘要

### 新增 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/pm/{id}/start` | POST | 启动已停止的进程 |
| `/api/pm/{id}/logs` | GET | 获取进程日志（支持 `?lines=N` 参数） |

### 扩展 API

| 端点 | 变更 |
|------|------|
| `/api/pm/list` | 返回数据新增 `config` 字段，包含进程配置信息，敏感环境变量自动脱敏为 `****` |

---

## 完成日期

2026-01-30
