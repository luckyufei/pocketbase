# Feature Specification: UI Migration (Svelte → React)

**Feature Branch**: `014-ui-svelte-to-react`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: Research document: `specs/_research/migrate-to-react.md`

## 1. Problem Essence (核心问题)

PocketBase Admin UI 当前基于 Svelte 4 构建，存在以下挑战：
- Svelte 生态相对较小，社区组件库选择有限
- 团队 React 技术储备更丰富，维护成本更低
- 需要与现有 React 技术栈的业务系统更好集成

**目标**: 将 `ui/` 目录下的 Svelte 代码完整迁移到 `ui-v2/` 目录的 React 技术栈。

## 2. Tech Stack Mapping (技术栈映射)

| 层级 | Source (Svelte) | Target (React) |
|:---|:---|:---|
| **Framework** | Svelte v4 | React v18.3 |
| **State** | Svelte Stores (`writable`/`derived`) | **Jotai** Atoms (`atom`/`useAtom`) |
| **Styling** | SCSS / Scoped Styles | **Tailwind CSS v3** + shadcn/ui |
| **Routing** | `svelte-spa-router` | `react-router-dom` v7 |
| **Logic** | Reactive Statements (`$:`) | `useMemo` / `useEffect` |
| **Editors** | CodeMirror (Raw) | `@uiw/react-codemirror` |
| **Charts** | Chart.js | `react-chartjs-2` |
| **Maps** | Leaflet | `react-leaflet` |
| **i18n** | 无 | `i18next` + `react-i18next` |
| **API Client** | PocketBase SDK (直接导入) | PocketBase SDK (封装 Hook) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 管理员登录与认证 (Priority: P0)

作为系统管理员，我希望能够通过登录页面进入管理后台，并在认证过期时自动跳转到登录页。

**Why this priority**: 这是所有功能的入口，没有认证就无法访问任何管理功能。

**Independent Test**: 可以通过访问登录页面，输入正确的凭据后验证是否能进入主界面。

**Acceptance Scenarios**:

1. **Given** 用户未登录, **When** 访问任意管理页面, **Then** 自动跳转到登录页面
2. **Given** 用户在登录页面, **When** 输入正确的邮箱和密码并提交, **Then** 成功登录并跳转到 Collections 页面
3. **Given** 用户已登录, **When** Token 过期, **Then** 自动跳转到登录页面并显示提示
4. **Given** 用户已登录, **When** 点击退出按钮, **Then** 清除认证状态并跳转到登录页面

---

### User Story 2 - Collections 管理 (Priority: P0)

作为系统管理员，我希望能够查看、创建、编辑和删除 Collections，这是 PocketBase 的核心功能。

**Why this priority**: Collections 是 PocketBase 的核心概念，是数据管理的基础。

**Independent Test**: 可以通过创建一个新的 Collection，验证是否能在列表中看到并编辑它。

**Acceptance Scenarios**:

1. **Given** 管理员已登录, **When** 点击左侧导航的"Collections"菜单, **Then** 显示 Collections 列表页面
2. **Given** 管理员在 Collections 页面, **When** 点击"New Collection"按钮, **Then** 显示创建 Collection 的面板
3. **Given** 管理员在创建面板, **When** 填写 Collection 名称和字段并保存, **Then** 新 Collection 出现在列表中
4. **Given** 管理员选中一个 Collection, **When** 点击编辑按钮, **Then** 显示编辑面板，可修改字段和规则
5. **Given** 管理员选中一个 Collection, **When** 查看 Records 列表, **Then** 显示该 Collection 的所有记录

---

### User Story 3 - Records CRUD 操作 (Priority: P0)

作为系统管理员，我希望能够对 Collection 中的 Records 进行增删改查操作。

**Why this priority**: Records 是业务数据的载体，CRUD 是最基础的数据操作。

**Independent Test**: 可以通过创建一条记录，验证是否能在列表中看到、编辑和删除它。

**Acceptance Scenarios**:

1. **Given** 管理员在 Records 列表页, **When** 点击"New Record"按钮, **Then** 显示创建 Record 的面板
2. **Given** 管理员在创建面板, **When** 填写字段值并保存, **Then** 新 Record 出现在列表中
3. **Given** 管理员在 Records 列表页, **When** 点击某条记录, **Then** 显示记录详情面板
4. **Given** 管理员在详情面板, **When** 修改字段值并保存, **Then** 列表中显示更新后的数据
5. **Given** 管理员在详情面板, **When** 点击删除按钮并确认, **Then** 记录从列表中移除

---

### User Story 4 - 系统设置管理 (Priority: P1)

作为系统管理员，我希望能够配置应用设置、邮件、存储、备份等系统级选项。

**Why this priority**: 系统设置是运维的核心功能，但优先级低于数据管理。

**Independent Test**: 可以通过修改应用名称设置，验证是否能保存并在页面标题中看到变化。

**Acceptance Scenarios**:

1. **Given** 管理员已登录, **When** 点击左侧导航的"Settings"菜单, **Then** 显示设置页面
2. **Given** 管理员在设置页面, **When** 修改应用名称并保存, **Then** 页面标题更新为新名称
3. **Given** 管理员在邮件设置页, **When** 配置 SMTP 并发送测试邮件, **Then** 收到测试邮件
4. **Given** 管理员在存储设置页, **When** 配置 S3 存储, **Then** 文件上传使用 S3

---

### User Story 5 - 日志查看 (Priority: P1)

作为系统管理员，我希望能够查看系统日志，以便排查问题和监控系统运行状态。

**Why this priority**: 日志是运维排障的重要工具。

**Independent Test**: 可以通过访问日志页面，验证是否能看到最近的日志条目。

**Acceptance Scenarios**:

1. **Given** 管理员已登录, **When** 点击左侧导航的"Logs"菜单, **Then** 显示日志列表页面
2. **Given** 管理员在日志页面, **When** 页面加载完成, **Then** 显示最近的日志条目
3. **Given** 管理员在日志页面, **When** 使用筛选器筛选日志级别, **Then** 只显示符合条件的日志
4. **Given** 管理员在日志页面, **When** 点击某条日志, **Then** 显示日志详情面板

---

### User Story 6 - 系统监控 (Priority: P2)

作为系统管理员，我希望能够查看系统监控指标，包括 CPU、内存、连接数等。

**Why this priority**: 监控是系统健康的晴雨表，但优先级低于核心功能。

**Independent Test**: 可以通过访问监控页面，验证是否能看到系统指标图表。

**Acceptance Scenarios**:

1. **Given** 管理员已登录, **When** 点击左侧导航的"Monitoring"菜单, **Then** 显示监控仪表盘
2. **Given** 管理员在监控页面, **When** 页面加载完成, **Then** 显示 CPU、内存、Goroutine 等指标卡片
3. **Given** 管理员在监控页面, **When** 选择时间范围, **Then** 显示对应时间段的趋势图

---

### User Story 7 - Trace 监控 (Priority: P2)

作为系统管理员，我希望能够查看请求追踪信息，以便分析 API 性能和排查慢请求。

**Why this priority**: Trace 是性能分析的重要工具。

**Independent Test**: 可以通过访问 Trace 页面，验证是否能看到请求追踪列表。

**Acceptance Scenarios**:

1. **Given** 管理员已登录, **When** 点击左侧导航的"Traces"菜单, **Then** 显示 Trace 列表页面
2. **Given** 管理员在 Trace 页面, **When** 页面加载完成, **Then** 显示最近的请求追踪记录
3. **Given** 管理员在 Trace 页面, **When** 点击某条 Trace, **Then** 显示详细的追踪信息

---

### User Story 8 - 流量分析 (Priority: P2)

作为系统管理员，我希望能够查看网站流量分析数据，包括 PV、UV、Top Pages 等。

**Why this priority**: 流量分析是运营决策的重要依据。

**Independent Test**: 可以通过访问 Analytics 页面，验证是否能看到流量统计图表。

**Acceptance Scenarios**:

1. **Given** 管理员已登录, **When** 点击左侧导航的"Analytics"菜单, **Then** 显示分析仪表盘
2. **Given** 管理员在分析页面, **When** 页面加载完成, **Then** 显示 PV、UV、Bounce Rate 等指标
3. **Given** 管理员在分析页面, **When** 选择时间范围, **Then** 显示对应时间段的趋势图

---

### Edge Cases

- 网络断开时，API 请求失败如何处理？显示错误提示，支持重试
- 长时间未操作导致 Token 过期时如何处理？自动跳转登录页
- 大量 Records 时列表如何处理？分页加载，虚拟滚动
- 表单提交失败时如何处理？显示字段级错误提示
- 浏览器不支持某些特性时如何处理？显示兼容性提示

## Requirements *(mandatory)*

### Functional Requirements

#### 核心框架层
- **FR-001**: 系统 MUST 使用 React v18.3 作为 UI 框架
- **FR-002**: 系统 MUST 使用 Jotai 作为全局状态管理方案
- **FR-003**: 系统 MUST 使用 react-router-dom v7 作为路由方案
- **FR-004**: 系统 MUST 使用 Tailwind CSS v3 作为样式方案
- **FR-005**: 系统 MUST 使用 shadcn/ui 作为基础组件库
- **FR-006**: 系统 MUST 使用 i18next 支持中英双语

#### 认证模块
- **FR-010**: 系统 MUST 实现登录页面，支持邮箱密码登录
- **FR-011**: 系统 MUST 实现 Token 自动刷新机制
- **FR-012**: 系统 MUST 实现未认证时自动跳转登录页
- **FR-013**: 系统 MUST 实现退出登录功能

#### Collections 模块
- **FR-020**: 系统 MUST 实现 Collections 列表展示
- **FR-021**: 系统 MUST 实现 Collection 创建/编辑/删除
- **FR-022**: 系统 MUST 实现 Schema Fields 编辑器
- **FR-023**: 系统 MUST 实现 Collection Rules 编辑器
- **FR-024**: 系统 MUST 实现 Indexes 管理
- **FR-025**: 系统 MUST 实现 Auth Options 配置（OAuth2、OTP、MFA 等）

#### Records 模块
- **FR-030**: 系统 MUST 实现 Records 列表展示（分页、排序、筛选）
- **FR-031**: 系统 MUST 实现 Record 创建/编辑/删除
- **FR-032**: 系统 MUST 实现各类型字段的表单组件
- **FR-033**: 系统 MUST 实现文件上传和预览
- **FR-034**: 系统 MUST 实现关联字段选择器

#### Settings 模块
- **FR-040**: 系统 MUST 实现应用设置页面
- **FR-041**: 系统 MUST 实现邮件设置页面
- **FR-042**: 系统 MUST 实现存储设置页面
- **FR-043**: 系统 MUST 实现备份管理页面
- **FR-044**: 系统 MUST 实现 Cron 任务管理页面
- **FR-045**: 系统 MUST 实现 Secrets 管理页面
- **FR-046**: 系统 MUST 实现 Analytics 设置页面

#### Logs 模块
- **FR-050**: 系统 MUST 实现日志列表展示
- **FR-051**: 系统 MUST 实现日志筛选和搜索
- **FR-052**: 系统 MUST 实现日志详情查看
- **FR-053**: 系统 MUST 实现日志图表展示

#### Monitoring 模块
- **FR-060**: 系统 MUST 实现系统监控仪表盘
- **FR-061**: 系统 MUST 实现指标卡片展示
- **FR-062**: 系统 MUST 实现趋势图表展示
- **FR-063**: 系统 MUST 实现时间范围选择

#### Trace 模块
- **FR-070**: 系统 MUST 实现 Trace 列表展示
- **FR-071**: 系统 MUST 实现 Trace 筛选
- **FR-072**: 系统 MUST 实现 Trace 详情查看
- **FR-073**: 系统 MUST 实现 Trace 统计展示

#### Analytics 模块
- **FR-080**: 系统 MUST 实现流量分析仪表盘
- **FR-081**: 系统 MUST 实现 PV/UV 趋势图
- **FR-082**: 系统 MUST 实现 Top Pages 列表
- **FR-083**: 系统 MUST 实现 Top Sources 列表
- **FR-084**: 系统 MUST 实现设备分布展示

#### 通用组件
- **FR-090**: 系统 MUST 实现 Toast 通知组件
- **FR-091**: 系统 MUST 实现 Confirmation 对话框组件
- **FR-092**: 系统 MUST 实现 OverlayPanel 侧边面板组件
- **FR-093**: 系统 MUST 实现 CodeEditor 代码编辑器组件
- **FR-094**: 系统 MUST 实现 FilterAutocompleteInput 筛选输入组件
- **FR-095**: 系统 MUST 实现 Select 下拉选择组件
- **FR-096**: 系统 MUST 实现 Tooltip 提示组件
- **FR-097**: 系统 MUST 实现 Accordion 折叠面板组件

### Key Entities (Jotai Atoms)

#### 全局状态
- **appAtom**: 应用配置（appName, hideControls）
- **pageTitleAtom**: 当前页面标题
- **superuserAtom**: 当前登录的超级管理员信息
- **toastsAtom**: Toast 通知列表
- **confirmationAtom**: 确认对话框状态

#### Collections 状态
- **collectionsAtom**: Collections 列表
- **activeCollectionAtom**: 当前选中的 Collection
- **isCollectionsLoadingAtom**: 加载状态
- **scaffoldsAtom**: Collection 模板

#### Records 状态
- **recordsAtom**: 当前 Collection 的 Records 列表
- **activeRecordAtom**: 当前选中的 Record
- **recordsFilterAtom**: Records 筛选条件

## Migration Strategy (迁移策略)

### Phase 1: 基础框架 (Week 1)
1. 搭建 React 项目基础结构
2. 配置路由系统
3. 实现认证模块
4. 实现布局组件（App Shell, Sidebar）

### Phase 2: 核心功能 (Week 2-3)
1. 迁移 Collections 模块
2. 迁移 Records 模块
3. 迁移 Settings 模块

### Phase 3: 监控功能 (Week 4)
1. 迁移 Logs 模块
2. 迁移 Monitoring 模块
3. 迁移 Trace 模块
4. 迁移 Analytics 模块

### Phase 4: 优化收尾 (Week 5)
1. 性能优化
2. 测试覆盖
3. 文档完善

## Component Migration Mapping (组件迁移映射)

### Svelte Stores → Jotai Atoms

| Svelte Store | Jotai Atom | 说明 |
|:---|:---|:---|
| `stores/app.js` → `pageTitle` | `store/app.ts` → `pageTitleAtom` | 页面标题 |
| `stores/app.js` → `appName` | `store/app.ts` → `appNameAtom` | 应用名称 |
| `stores/app.js` → `hideControls` | `store/app.ts` → `hideControlsAtom` | 隐藏控制 |
| `stores/superuser.js` → `superuser` | `store/auth.ts` → `superuserAtom` | 当前用户 |
| `stores/collections.js` → `collections` | `store/collections.ts` → `collectionsAtom` | Collections 列表 |
| `stores/collections.js` → `activeCollection` | `store/collections.ts` → `activeCollectionAtom` | 当前 Collection |
| `stores/toasts.js` → `toasts` | `store/toasts.ts` → `toastsAtom` | Toast 列表 |
| `stores/confirmation.js` | `store/confirmation.ts` → `confirmationAtom` | 确认对话框 |
| `stores/errors.js` | `store/errors.ts` → `errorsAtom` | 表单错误 |

### Svelte Components → React Components

| Svelte Component | React Component | 说明 |
|:---|:---|:---|
| `App.svelte` | `App.tsx` | 应用根组件 |
| `routes.js` | `router/index.tsx` | 路由配置 |
| `base/Toasts.svelte` | `components/Toasts.tsx` | Toast 通知 |
| `base/Confirmation.svelte` | `components/Confirmation.tsx` | 确认对话框 |
| `base/OverlayPanel.svelte` | `components/OverlayPanel.tsx` | 侧边面板 |
| `base/Select.svelte` | `components/ui/select.tsx` | 下拉选择 (shadcn) |
| `base/Accordion.svelte` | `components/ui/accordion.tsx` | 折叠面板 (shadcn) |
| `base/CodeEditor.svelte` | `components/CodeEditor.tsx` | 代码编辑器 |
| `base/Searchbar.svelte` | `components/Searchbar.tsx` | 搜索栏 |
| `superusers/PageSuperuserLogin.svelte` | `pages/Login.tsx` | 登录页 |
| `collections/CollectionsSidebar.svelte` | `features/collections/Sidebar.tsx` | Collections 侧边栏 |
| `collections/CollectionUpsertPanel.svelte` | `features/collections/UpsertPanel.tsx` | Collection 编辑面板 |
| `records/PageRecords.svelte` | `pages/Records.tsx` | Records 页面 |
| `records/RecordsList.svelte` | `features/records/RecordsList.tsx` | Records 列表 |
| `records/RecordUpsertPanel.svelte` | `features/records/UpsertPanel.tsx` | Record 编辑面板 |
| `settings/PageApplication.svelte` | `pages/settings/Application.tsx` | 应用设置 |
| `logs/PageLogs.svelte` | `pages/Logs.tsx` | 日志页面 |
| `monitoring/PageMonitoring.svelte` | `pages/Monitoring.tsx` | 监控页面 |
| `monitor/PageMonitor.svelte` | `pages/Traces.tsx` | Trace 页面 |
| `analytics/PageAnalytics.svelte` | `pages/Analytics.tsx` | 分析页面 |

### SCSS → Tailwind 映射

| SCSS 变量/类 | Tailwind 等价 |
|:---|:---|
| `var(--baseSpacing)` | `p-4` / `gap-4` |
| `var(--smSpacing)` | `p-2` / `gap-2` |
| `var(--baseRadius)` | `rounded-md` |
| `var(--primaryColor)` | `bg-primary` / `text-primary` |
| `var(--txtPrimaryColor)` | `text-foreground` |
| `var(--txtHintColor)` | `text-muted-foreground` |
| `var(--baseAlt1Color)` | `bg-muted` |
| `var(--dangerColor)` | `bg-destructive` / `text-destructive` |
| `.btn` | `<Button>` (shadcn) |
| `.btn-primary` | `<Button variant="default">` |
| `.btn-secondary` | `<Button variant="secondary">` |
| `.btn-danger` | `<Button variant="destructive">` |
| `.alert` | `<Alert>` (shadcn) |
| `.table` | `<Table>` (shadcn) |
| `.dropdown` | `<DropdownMenu>` (shadcn) |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有 Svelte 组件成功迁移到 React，功能完全一致
- **SC-002**: 页面首次加载时间 < 3s (Production Build)
- **SC-003**: Lighthouse Performance Score >= 80
- **SC-004**: 核心功能测试覆盖率 >= 80%
- **SC-005**: 无 TypeScript 类型错误
- **SC-006**: 无 ESLint 错误
- **SC-007**: 支持中英双语切换
- **SC-008**: 支持暗色模式

## Boundaries (边界与约束)

1. **No Feature Addition**: 迁移过程中不新增功能，保持功能一致性
2. **No API Change**: 后端 API 保持不变，只迁移前端
3. **Progressive Migration**: 可以分模块逐步迁移，两套 UI 可并行运行
4. **Keep Embed**: 迁移完成后需要支持 Go embed 打包

## Assumptions

- 开发团队熟悉 React 和 TypeScript
- 可以参考现有 Svelte 代码理解业务逻辑
- PocketBase SDK 可直接在 React 中使用
- shadcn/ui 组件可满足大部分 UI 需求
- 项目使用 pnpm 作为包管理器

## Dependencies (依赖)

### 需要新增的依赖

```json
{
  "dependencies": {
    "pocketbase": "^0.26.5",
    "@uiw/react-codemirror": "^4.x",
    "@codemirror/lang-javascript": "^6.x",
    "@codemirror/lang-json": "^6.x",
    "@codemirror/lang-sql": "^6.x",
    "react-chartjs-2": "^5.x",
    "chart.js": "^4.x",
    "react-leaflet": "^4.x",
    "leaflet": "^1.9.x",
    "@tinymce/tinymce-react": "^4.x",
    "flatpickr": "^4.x"
  }
}
```

## File Structure (目录结构)

```
ui-v2/src/
├── components/           # 通用组件
│   ├── ui/              # shadcn/ui 组件
│   ├── CodeEditor.tsx   # 代码编辑器
│   ├── Confirmation.tsx # 确认对话框
│   ├── OverlayPanel.tsx # 侧边面板
│   ├── Searchbar.tsx    # 搜索栏
│   └── Toasts.tsx       # Toast 通知
├── features/            # 功能模块
│   ├── auth/           # 认证模块
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── index.ts
│   ├── collections/    # Collections 模块
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── index.ts
│   ├── records/        # Records 模块
│   ├── settings/       # Settings 模块
│   ├── logs/           # Logs 模块
│   ├── monitoring/     # Monitoring 模块
│   ├── traces/         # Traces 模块
│   └── analytics/      # Analytics 模块
├── hooks/              # 全局 Hooks
│   ├── usePocketbase.ts
│   └── useDebounce.ts
├── lib/                # 工具函数
│   ├── utils.ts
│   ├── ApiClient.ts
│   └── CommonHelper.ts
├── pages/              # 页面组件
│   ├── Login.tsx
│   ├── Collections.tsx
│   ├── Records.tsx
│   ├── Logs.tsx
│   ├── Monitoring.tsx
│   ├── Traces.tsx
│   ├── Analytics.tsx
│   └── settings/
├── router/             # 路由配置
│   └── index.tsx
├── store/              # 全局状态
│   ├── app.ts
│   ├── auth.ts
│   ├── collections.ts
│   ├── toasts.ts
│   └── confirmation.ts
├── i18n/               # 国际化
│   ├── index.ts
│   └── locales/
├── App.tsx             # 应用根组件
├── main.tsx            # 入口文件
└── index.css           # 全局样式
```
