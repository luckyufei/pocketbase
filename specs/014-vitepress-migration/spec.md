# Feature Specification: PocketBase 文档站点迁移到 VitePress

**Feature Branch**: `014-vitepress-migration`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: 将现有 Svelte + SvelteKit 文档站点迁移到 VitePress

## 背景与动机

### 现状分析

当前 `site/` 目录使用 Svelte + SvelteKit 构建文档站点：
- **技术栈**: SvelteKit 2.x + Svelte 4.x + Vite 5.x + SCSS
- **文档格式**: Svelte 组件 (`.svelte` 文件)
- **搜索**: Pagefind 静态搜索
- **API 文档**: TypeDoc 生成 JSVM 类型文档

### 迁移动机

1. **维护成本**: Svelte 组件编写文档效率低，Markdown 更适合文档场景
2. **生态优势**: VitePress 专为文档设计，内置搜索、主题、国际化
3. **开发体验**: Markdown + Vue 组件混合，降低文档贡献门槛
4. **性能**: VitePress 静态生成 + 预加载，首屏加载更快

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 浏览文档 (Priority: P0)

作为开发者，我希望能够快速浏览 PocketBase 文档，了解如何使用各项功能。

**Why this priority**: 文档的核心价值是提供信息，必须首先保证内容完整迁移。

**Acceptance Scenarios**:

1. **Given** 用户访问文档首页, **When** 页面加载完成, **Then** 显示文档导航和介绍内容
2. **Given** 用户点击侧边栏链接, **When** 导航到目标页面, **Then** 正确显示对应文档内容
3. **Given** 用户在移动设备访问, **When** 页面加载完成, **Then** 响应式布局正常显示

---

### User Story 2 - 搜索文档 (Priority: P1)

作为开发者，我希望能够快速搜索文档内容，找到我需要的信息。

**Why this priority**: 搜索是文档站点的核心功能，直接影响用户体验。

**Acceptance Scenarios**:

1. **Given** 用户在搜索框输入关键词, **When** 按下回车, **Then** 显示相关文档列表
2. **Given** 搜索结果显示, **When** 点击结果项, **Then** 跳转到对应文档位置
3. **Given** 搜索无结果, **When** 显示结果, **Then** 提示无匹配内容

---

### User Story 3 - 查看代码示例 (Priority: P1)

作为开发者，我希望能够查看并复制代码示例，快速集成到我的项目中。

**Why this priority**: 代码示例是技术文档的核心，必须支持语法高亮和复制。

**Acceptance Scenarios**:

1. **Given** 文档包含代码块, **When** 页面渲染完成, **Then** 代码正确高亮显示
2. **Given** 代码块显示, **When** 点击复制按钮, **Then** 代码复制到剪贴板
3. **Given** 多语言代码示例, **When** 切换语言标签, **Then** 显示对应语言代码

---

### User Story 4 - 查看 API 参考 (Priority: P1)

作为开发者，我希望能够查看 API 端点详情，了解请求参数和响应格式。

**Why this priority**: API 文档是 PocketBase 文档的重要组成部分。

**Acceptance Scenarios**:

1. **Given** 用户访问 API 文档页面, **When** 页面加载完成, **Then** 显示 API 端点列表
2. **Given** API 端点详情, **When** 查看参数说明, **Then** 显示请求/响应示例
3. **Given** API 文档, **When** 展开/折叠详情, **Then** 交互正常工作

---

### User Story 5 - 切换主题 (Priority: P2)

作为开发者，我希望能够在亮色和暗色主题之间切换，适应不同环境。

**Why this priority**: 主题切换是用户体验优化，非核心功能。

**Acceptance Scenarios**:

1. **Given** 用户在亮色主题, **When** 点击主题切换按钮, **Then** 切换到暗色主题
2. **Given** 用户刷新页面, **When** 页面加载完成, **Then** 保持上次选择的主题

---

### Edge Cases

- 旧 URL 路径如何处理？配置重定向规则
- JSVM 类型文档如何处理？保持 TypeDoc 生成，独立托管
- 自定义组件如何迁移？转换为 Vue 组件或 Markdown 扩展

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 保持所有现有文档内容完整迁移
- **FR-002**: 系统 MUST 保持现有 URL 结构或提供重定向
- **FR-003**: 系统 MUST 支持全文搜索功能
- **FR-004**: 系统 MUST 支持代码块语法高亮和复制
- **FR-005**: 系统 MUST 支持亮色/暗色主题切换
- **FR-006**: 系统 MUST 支持响应式布局（桌面/平板/手机）
- **FR-007**: 系统 MUST 支持侧边栏导航和目录
- **FR-008**: 系统 MUST 支持多语言代码示例切换（Go/JS）
- **FR-009**: 系统 MUST 保持 JSVM 类型文档可访问
- **FR-010**: 系统 MUST 支持静态站点生成和部署

### Non-Functional Requirements

- **NFR-001**: 首页加载时间 < 2s (3G 网络)
- **NFR-002**: 文档页面切换 < 100ms (预加载)
- **NFR-003**: 搜索响应时间 < 200ms
- **NFR-004**: Lighthouse 性能评分 > 90

### Key Entities

- **文档页面**: Markdown 文件，包含文档内容
- **导航配置**: 侧边栏和顶部导航结构
- **主题配置**: VitePress 主题定制
- **自定义组件**: Vue 组件，用于特殊交互

## 内容迁移清单

### Introduction 模块 (7 页)

| 原路径 | 目标路径 | 状态 |
|--------|----------|------|
| `/docs` | `/docs/index.md` | 待迁移 |
| `/docs/how-to-use` | `/docs/how-to-use.md` | 待迁移 |
| `/docs/collections` | `/docs/collections.md` | 待迁移 |
| `/docs/api-rules-and-filters` | `/docs/api-rules-and-filters.md` | 待迁移 |
| `/docs/authentication` | `/docs/authentication.md` | 待迁移 |
| `/docs/files-handling` | `/docs/files-handling.md` | 待迁移 |
| `/docs/working-with-relations` | `/docs/working-with-relations.md` | 待迁移 |
| `/docs/use-as-framework` | `/docs/use-as-framework.md` | 待迁移 |

### Web APIs 模块 (9 页)

| 原路径 | 目标路径 | 状态 |
|--------|----------|------|
| `/docs/api-records` | `/docs/api/records.md` | 待迁移 |
| `/docs/api-realtime` | `/docs/api/realtime.md` | 待迁移 |
| `/docs/api-files` | `/docs/api/files.md` | 待迁移 |
| `/docs/api-collections` | `/docs/api/collections.md` | 待迁移 |
| `/docs/api-settings` | `/docs/api/settings.md` | 待迁移 |
| `/docs/api-logs` | `/docs/api/logs.md` | 待迁移 |
| `/docs/api-crons` | `/docs/api/crons.md` | 待迁移 |
| `/docs/api-backups` | `/docs/api/backups.md` | 待迁移 |
| `/docs/api-health` | `/docs/api/health.md` | 待迁移 |

### Go SDK 模块 (17 页)

| 原路径 | 目标路径 | 状态 |
|--------|----------|------|
| `/docs/go-overview` | `/docs/go/overview.md` | 待迁移 |
| `/docs/go-event-hooks` | `/docs/go/event-hooks.md` | 待迁移 |
| `/docs/go-routing` | `/docs/go/routing.md` | 待迁移 |
| `/docs/go-database` | `/docs/go/database.md` | 待迁移 |
| `/docs/go-records` | `/docs/go/records.md` | 待迁移 |
| `/docs/go-collections` | `/docs/go/collections.md` | 待迁移 |
| `/docs/go-migrations` | `/docs/go/migrations.md` | 待迁移 |
| `/docs/go-jobs-scheduling` | `/docs/go/jobs-scheduling.md` | 待迁移 |
| `/docs/go-sending-emails` | `/docs/go/sending-emails.md` | 待迁移 |
| `/docs/go-rendering-templates` | `/docs/go/rendering-templates.md` | 待迁移 |
| `/docs/go-console-commands` | `/docs/go/console-commands.md` | 待迁移 |
| `/docs/go-realtime` | `/docs/go/realtime.md` | 待迁移 |
| `/docs/go-filesystem` | `/docs/go/filesystem.md` | 待迁移 |
| `/docs/go-logging` | `/docs/go/logging.md` | 待迁移 |
| `/docs/go-testing` | `/docs/go/testing.md` | 待迁移 |
| `/docs/go-miscellaneous` | `/docs/go/miscellaneous.md` | 待迁移 |
| `/docs/go-record-proxy` | `/docs/go/record-proxy.md` | 待迁移 |

### JS SDK 模块 (15 页)

| 原路径 | 目标路径 | 状态 |
|--------|----------|------|
| `/docs/js-overview` | `/docs/js/overview.md` | 待迁移 |
| `/docs/js-event-hooks` | `/docs/js/event-hooks.md` | 待迁移 |
| `/docs/js-routing` | `/docs/js/routing.md` | 待迁移 |
| `/docs/js-database` | `/docs/js/database.md` | 待迁移 |
| `/docs/js-records` | `/docs/js/records.md` | 待迁移 |
| `/docs/js-collections` | `/docs/js/collections.md` | 待迁移 |
| `/docs/js-migrations` | `/docs/js/migrations.md` | 待迁移 |
| `/docs/js-jobs-scheduling` | `/docs/js/jobs-scheduling.md` | 待迁移 |
| `/docs/js-sending-emails` | `/docs/js/sending-emails.md` | 待迁移 |
| `/docs/js-rendering-templates` | `/docs/js/rendering-templates.md` | 待迁移 |
| `/docs/js-console-commands` | `/docs/js/console-commands.md` | 待迁移 |
| `/docs/js-sending-http-requests` | `/docs/js/sending-http-requests.md` | 待迁移 |
| `/docs/js-realtime` | `/docs/js/realtime.md` | 待迁移 |
| `/docs/js-filesystem` | `/docs/js/filesystem.md` | 待迁移 |
| `/docs/js-logging` | `/docs/js/logging.md` | 待迁移 |

### 其他页面 (3 页)

| 原路径 | 目标路径 | 状态 |
|--------|----------|------|
| `/docs/going-to-production` | `/docs/going-to-production.md` | 待迁移 |
| `/faq` | `/docs/faq.md` | 待迁移 |
| `/` (Landing) | `/index.md` | 待迁移 |

**总计**: 约 52 个页面需要迁移

## 自定义组件迁移

### 需要转换为 Vue 组件

| Svelte 组件 | Vue 组件 | 用途 |
|-------------|----------|------|
| `CodeBlock.svelte` | `CodeBlock.vue` | 代码块展示 |
| `CodeTabs.svelte` | `CodeTabs.vue` | 多语言代码切换 |
| `Accordion.svelte` | `Accordion.vue` | 折叠面板 |
| `FilterSyntax.svelte` | `FilterSyntax.vue` | 过滤器语法说明 |
| `FieldsQueryParam.svelte` | 内联 Markdown | 字段参数说明 |
| `ExpandQueryParam.svelte` | 内联 Markdown | 展开参数说明 |

### 可使用 VitePress 内置功能替代

| Svelte 组件 | VitePress 替代方案 |
|-------------|-------------------|
| `Toc.svelte` | 内置目录 (outline) |
| `Searchbar.svelte` | 内置搜索 |
| `PageHeader.svelte` | 主题 header |
| `PageFooter.svelte` | 主题 footer |
| `ScrollToTop.svelte` | 主题内置 |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有 52 个文档页面成功迁移
- **SC-002**: 所有代码示例正确高亮显示
- **SC-003**: 搜索功能覆盖所有文档内容
- **SC-004**: 主题切换正常工作
- **SC-005**: 移动端响应式布局正常
- **SC-006**: Lighthouse 性能评分 > 90
- **SC-007**: 构建时间 < 60s
- **SC-008**: 旧 URL 正确重定向到新 URL

## Assumptions

- VitePress 1.x 稳定版本可用
- 不需要保留 Svelte 组件的复杂交互逻辑
- JSVM 类型文档继续使用 TypeDoc 生成
- 部署目标为静态站点托管（如 GitHub Pages、Netlify）
- 暂不考虑国际化（i18n）需求
