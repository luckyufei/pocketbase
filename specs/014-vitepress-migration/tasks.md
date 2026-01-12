# Tasks: PocketBase 文档站点迁移到 VitePress

**Feature Branch**: `014-vitepress-migration`  
**Created**: 2026-01-12  
**Status**: Draft  
**Estimated Duration**: 11 天

---

## Phase 0: 环境搭建 (1 天)

### Task 0.1: 初始化 VitePress 项目

**目标**: 创建 VitePress 项目基础结构

**Checklist**:
- [ ] 0.1.1 创建 `site-vitepress/` 目录
- [ ] 0.1.2 初始化 `package.json`
- [ ] 0.1.3 安装 VitePress 及依赖
- [ ] 0.1.4 创建 `.vitepress/config.ts` 基础配置
- [ ] 0.1.5 创建 `docs/index.md` 测试页面
- [ ] 0.1.6 验证 `npm run dev` 正常启动

**验收标准**: 访问 `http://localhost:5173` 显示测试页面

---

### Task 0.2: 配置项目结构

**目标**: 创建完整的目录结构

**Checklist**:
- [ ] 0.2.1 创建 `docs/api/` 目录
- [ ] 0.2.2 创建 `docs/go/` 目录
- [ ] 0.2.3 创建 `docs/js/` 目录
- [ ] 0.2.4 创建 `.vitepress/theme/` 目录
- [ ] 0.2.5 创建 `.vitepress/theme/components/` 目录
- [ ] 0.2.6 创建 `public/images/` 目录
- [ ] 0.2.7 复制静态资源 (images, fonts)

**验收标准**: 目录结构与 plan.md 一致

---

### Task 0.3: 配置主题入口

**目标**: 设置自定义主题

**Checklist**:
- [ ] 0.3.1 创建 `.vitepress/theme/index.ts`
- [ ] 0.3.2 创建 `.vitepress/theme/style.css`
- [ ] 0.3.3 配置主题颜色变量
- [ ] 0.3.4 配置字体

**验收标准**: 自定义样式生效

---

## Phase 1: 核心组件 (2 天)

### Task 1.1: 实现 CodeTabs 组件

**目标**: 支持多语言代码切换

**文件**: `.vitepress/theme/components/CodeTabs.vue`

**Checklist**:
- [ ] 1.1.1 创建组件模板
- [ ] 1.1.2 实现标签切换逻辑
- [ ] 1.1.3 添加样式
- [ ] 1.1.4 支持 Go/JS 双语言
- [ ] 1.1.5 在主题中注册全局组件
- [ ] 1.1.6 编写使用示例

**验收标准**: 在 Markdown 中使用 `<CodeTabs>` 正常切换

---

### Task 1.2: 实现 Accordion 组件

**目标**: 支持折叠面板

**文件**: `.vitepress/theme/components/Accordion.vue`

**Checklist**:
- [ ] 1.2.1 创建组件模板
- [ ] 1.2.2 实现展开/折叠逻辑
- [ ] 1.2.3 添加动画效果
- [ ] 1.2.4 添加样式
- [ ] 1.2.5 在主题中注册全局组件

**验收标准**: 折叠面板交互正常

---

### Task 1.3: 实现 FilterSyntax 组件

**目标**: 展示过滤器语法说明

**文件**: `.vitepress/theme/components/FilterSyntax.vue`

**Checklist**:
- [ ] 1.3.1 分析原 Svelte 组件逻辑
- [ ] 1.3.2 创建 Vue 组件
- [ ] 1.3.3 实现语法高亮
- [ ] 1.3.4 添加样式

**验收标准**: 过滤器语法正确显示

---

### Task 1.4: 配置代码高亮

**目标**: 支持 Go/JS/Bash 等语言高亮

**Checklist**:
- [ ] 1.4.1 配置 Shiki 主题
- [ ] 1.4.2 添加行号显示
- [ ] 1.4.3 添加复制按钮
- [ ] 1.4.4 配置代码块样式

**验收标准**: 代码块正确高亮，复制功能正常

---

## Phase 2: 内容迁移 (5 天)

### Task 2.1: 迁移 Introduction 模块 (7 页)

**目标**: 迁移入门文档

**Checklist**:
- [ ] 2.1.1 `/docs` → `/docs/index.md`
- [ ] 2.1.2 `/docs/how-to-use` → `/docs/how-to-use.md`
- [ ] 2.1.3 `/docs/collections` → `/docs/collections.md`
- [ ] 2.1.4 `/docs/api-rules-and-filters` → `/docs/api-rules-and-filters.md`
- [ ] 2.1.5 `/docs/authentication` → `/docs/authentication.md`
- [ ] 2.1.6 `/docs/files-handling` → `/docs/files-handling.md`
- [ ] 2.1.7 `/docs/working-with-relations` → `/docs/working-with-relations.md`
- [ ] 2.1.8 `/docs/use-as-framework` → `/docs/use-as-framework.md`

**验收标准**: 所有 Introduction 页面正确渲染

---

### Task 2.2: 迁移 Web APIs 模块 (9 页)

**目标**: 迁移 API 文档

**Checklist**:
- [ ] 2.2.1 `/docs/api-records` → `/docs/api/records.md`
- [ ] 2.2.2 `/docs/api-realtime` → `/docs/api/realtime.md`
- [ ] 2.2.3 `/docs/api-files` → `/docs/api/files.md`
- [ ] 2.2.4 `/docs/api-collections` → `/docs/api/collections.md`
- [ ] 2.2.5 `/docs/api-settings` → `/docs/api/settings.md`
- [ ] 2.2.6 `/docs/api-logs` → `/docs/api/logs.md`
- [ ] 2.2.7 `/docs/api-crons` → `/docs/api/crons.md`
- [ ] 2.2.8 `/docs/api-backups` → `/docs/api/backups.md`
- [ ] 2.2.9 `/docs/api-health` → `/docs/api/health.md`

**验收标准**: 所有 API 文档页面正确渲染

---

### Task 2.3: 迁移 Go SDK 模块 (17 页)

**目标**: 迁移 Go SDK 文档

**Checklist**:
- [ ] 2.3.1 `/docs/go-overview` → `/docs/go/overview.md`
- [ ] 2.3.2 `/docs/go-event-hooks` → `/docs/go/event-hooks.md`
- [ ] 2.3.3 `/docs/go-routing` → `/docs/go/routing.md`
- [ ] 2.3.4 `/docs/go-database` → `/docs/go/database.md`
- [ ] 2.3.5 `/docs/go-records` → `/docs/go/records.md`
- [ ] 2.3.6 `/docs/go-collections` → `/docs/go/collections.md`
- [ ] 2.3.7 `/docs/go-migrations` → `/docs/go/migrations.md`
- [ ] 2.3.8 `/docs/go-jobs-scheduling` → `/docs/go/jobs-scheduling.md`
- [ ] 2.3.9 `/docs/go-sending-emails` → `/docs/go/sending-emails.md`
- [ ] 2.3.10 `/docs/go-rendering-templates` → `/docs/go/rendering-templates.md`
- [ ] 2.3.11 `/docs/go-console-commands` → `/docs/go/console-commands.md`
- [ ] 2.3.12 `/docs/go-realtime` → `/docs/go/realtime.md`
- [ ] 2.3.13 `/docs/go-filesystem` → `/docs/go/filesystem.md`
- [ ] 2.3.14 `/docs/go-logging` → `/docs/go/logging.md`
- [ ] 2.3.15 `/docs/go-testing` → `/docs/go/testing.md`
- [ ] 2.3.16 `/docs/go-miscellaneous` → `/docs/go/miscellaneous.md`
- [ ] 2.3.17 `/docs/go-record-proxy` → `/docs/go/record-proxy.md`

**验收标准**: 所有 Go SDK 文档页面正确渲染

---

### Task 2.4: 迁移 JS SDK 模块 (15 页)

**目标**: 迁移 JS SDK 文档

**Checklist**:
- [ ] 2.4.1 `/docs/js-overview` → `/docs/js/overview.md`
- [ ] 2.4.2 `/docs/js-event-hooks` → `/docs/js/event-hooks.md`
- [ ] 2.4.3 `/docs/js-routing` → `/docs/js/routing.md`
- [ ] 2.4.4 `/docs/js-database` → `/docs/js/database.md`
- [ ] 2.4.5 `/docs/js-records` → `/docs/js/records.md`
- [ ] 2.4.6 `/docs/js-collections` → `/docs/js/collections.md`
- [ ] 2.4.7 `/docs/js-migrations` → `/docs/js/migrations.md`
- [ ] 2.4.8 `/docs/js-jobs-scheduling` → `/docs/js/jobs-scheduling.md`
- [ ] 2.4.9 `/docs/js-sending-emails` → `/docs/js/sending-emails.md`
- [ ] 2.4.10 `/docs/js-rendering-templates` → `/docs/js/rendering-templates.md`
- [ ] 2.4.11 `/docs/js-console-commands` → `/docs/js/console-commands.md`
- [ ] 2.4.12 `/docs/js-sending-http-requests` → `/docs/js/sending-http-requests.md`
- [ ] 2.4.13 `/docs/js-realtime` → `/docs/js/realtime.md`
- [ ] 2.4.14 `/docs/js-filesystem` → `/docs/js/filesystem.md`
- [ ] 2.4.15 `/docs/js-logging` → `/docs/js/logging.md`

**验收标准**: 所有 JS SDK 文档页面正确渲染

---

### Task 2.5: 迁移其他页面 (3 页)

**目标**: 迁移剩余页面

**Checklist**:
- [ ] 2.5.1 `/docs/going-to-production` → `/docs/going-to-production.md`
- [ ] 2.5.2 `/faq` → `/docs/faq.md`
- [ ] 2.5.3 Landing Page → `/index.md`

**验收标准**: 所有页面正确渲染

---

## Phase 3: 样式与优化 (2 天)

### Task 3.1: 主题样式定制

**目标**: 匹配原站点视觉风格

**Checklist**:
- [ ] 3.1.1 配置品牌颜色
- [ ] 3.1.2 配置字体
- [ ] 3.1.3 定制 Header 样式
- [ ] 3.1.4 定制 Sidebar 样式
- [ ] 3.1.5 定制代码块样式
- [ ] 3.1.6 配置暗色主题

**验收标准**: 视觉风格与原站点一致

---

### Task 3.2: 响应式布局

**目标**: 适配移动端

**Checklist**:
- [ ] 3.2.1 测试桌面端布局
- [ ] 3.2.2 测试平板端布局
- [ ] 3.2.3 测试手机端布局
- [ ] 3.2.4 修复布局问题

**验收标准**: 所有设备正常显示

---

### Task 3.3: 搜索功能配置

**目标**: 配置全文搜索

**Checklist**:
- [ ] 3.3.1 启用 VitePress 本地搜索
- [ ] 3.3.2 配置搜索选项
- [ ] 3.3.3 测试搜索功能
- [ ] 3.3.4 优化搜索结果展示

**验收标准**: 搜索功能正常工作

---

### Task 3.4: 性能优化

**目标**: 提升加载性能

**Checklist**:
- [ ] 3.4.1 图片优化
- [ ] 3.4.2 字体优化
- [ ] 3.4.3 代码分割
- [ ] 3.4.4 预加载配置
- [ ] 3.4.5 运行 Lighthouse 测试

**验收标准**: Lighthouse 评分 > 90

---

## Phase 4: 测试与部署 (1 天)

### Task 4.1: 功能测试

**目标**: 验证所有功能正常

**Checklist**:
- [ ] 4.1.1 测试所有页面链接
- [ ] 4.1.2 测试代码块复制
- [ ] 4.1.3 测试 CodeTabs 切换
- [ ] 4.1.4 测试 Accordion 折叠
- [ ] 4.1.5 测试主题切换
- [ ] 4.1.6 测试搜索功能

**验收标准**: 所有功能正常工作

---

### Task 4.2: 链接检查

**目标**: 确保无死链

**Checklist**:
- [ ] 4.2.1 运行链接检查工具
- [ ] 4.2.2 修复内部死链
- [ ] 4.2.3 验证外部链接
- [ ] 4.2.4 验证锚点链接

**验收标准**: 无死链

---

### Task 4.3: 构建部署

**目标**: 生产构建和部署

**Checklist**:
- [ ] 4.3.1 运行 `npm run build`
- [ ] 4.3.2 验证构建产物
- [ ] 4.3.3 本地预览 (`npm run preview`)
- [ ] 4.3.4 部署到测试环境
- [ ] 4.3.5 验证部署结果

**验收标准**: 构建成功，部署正常

---

### Task 4.4: URL 重定向配置

**目标**: 配置旧 URL 重定向

**Checklist**:
- [ ] 4.4.1 创建重定向规则文件
- [ ] 4.4.2 配置服务器重定向 (nginx/netlify)
- [ ] 4.4.3 测试重定向规则
- [ ] 4.4.4 验证 SEO 友好性

**验收标准**: 旧 URL 正确重定向

---

### Task 4.5: JSVM 文档集成

**目标**: 集成 TypeDoc 生成的 JSVM 文档

**Checklist**:
- [ ] 4.5.1 复制 JSVM 文档到 `public/jsvm/`
- [ ] 4.5.2 配置导航链接
- [ ] 4.5.3 验证文档可访问

**验收标准**: JSVM 类型文档正常访问

---

## 进度跟踪

| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| 0 | 0.1 初始化项目 | ⬜ 待开始 | |
| 0 | 0.2 配置项目结构 | ⬜ 待开始 | |
| 0 | 0.3 配置主题入口 | ⬜ 待开始 | |
| 1 | 1.1 CodeTabs 组件 | ⬜ 待开始 | |
| 1 | 1.2 Accordion 组件 | ⬜ 待开始 | |
| 1 | 1.3 FilterSyntax 组件 | ⬜ 待开始 | |
| 1 | 1.4 代码高亮配置 | ⬜ 待开始 | |
| 2 | 2.1 Introduction 模块 | ⬜ 待开始 | 7 页 |
| 2 | 2.2 Web APIs 模块 | ⬜ 待开始 | 9 页 |
| 2 | 2.3 Go SDK 模块 | ⬜ 待开始 | 17 页 |
| 2 | 2.4 JS SDK 模块 | ⬜ 待开始 | 15 页 |
| 2 | 2.5 其他页面 | ⬜ 待开始 | 3 页 |
| 3 | 3.1 主题样式 | ⬜ 待开始 | |
| 3 | 3.2 响应式布局 | ⬜ 待开始 | |
| 3 | 3.3 搜索功能 | ⬜ 待开始 | |
| 3 | 3.4 性能优化 | ⬜ 待开始 | |
| 4 | 4.1 功能测试 | ⬜ 待开始 | |
| 4 | 4.2 链接检查 | ⬜ 待开始 | |
| 4 | 4.3 构建部署 | ⬜ 待开始 | |
| 4 | 4.4 URL 重定向 | ⬜ 待开始 | |
| 4 | 4.5 JSVM 文档 | ⬜ 待开始 | |

---

## 迁移脚本 (可选)

为加速内容迁移，可编写自动化脚本：

```bash
#!/bin/bash
# scripts/migrate-svelte-to-md.sh

# 提取 Svelte 组件中的内容并转换为 Markdown
# 需要手动处理复杂组件

for file in site/src/routes/\(app\)/docs/**/+page.svelte; do
  # 提取文件路径
  dir=$(dirname "$file")
  name=$(basename "$dir")
  
  echo "Processing: $name"
  # 实际转换逻辑需要根据具体内容实现
done
```

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 复杂 Svelte 组件难以转换 | 中 | 高 | 手动重写为 Vue 组件 |
| 代码示例格式不一致 | 高 | 中 | 编写格式化脚本 |
| 构建时间过长 | 低 | 低 | 优化构建配置 |
| 搜索质量不如 Pagefind | 中 | 中 | 备选 Algolia DocSearch |
