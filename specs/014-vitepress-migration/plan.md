# Implementation Plan: PocketBase 文档站点迁移到 VitePress

**Branch**: `014-vitepress-migration` | **Date**: 2026-01-12 | **Spec**: [spec.md](./spec.md)

## Summary

将 PocketBase 文档站点从 Svelte + SvelteKit 迁移到 VitePress，实现 Markdown 优先的文档编写体验，同时保持现有功能和 URL 结构。

## Technical Context

**目标框架**: VitePress 1.x (基于 Vue 3 + Vite)  
**源框架**: SvelteKit 2.x + Svelte 4.x  
**文档格式**: Svelte 组件 → Markdown + Vue 组件  
**搜索方案**: Pagefind → VitePress 内置搜索 (MiniSearch)  
**样式方案**: SCSS → CSS Variables + 主题定制  
**部署目标**: 静态站点生成  
**输出目录**: `site-vitepress/`

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| 内容完整性 | ✅ PASS | 所有文档内容 1:1 迁移 |
| URL 兼容性 | ✅ PASS | 配置重定向规则 |
| 功能对等 | ✅ PASS | 搜索、主题、代码高亮等功能保持 |
| 性能提升 | ✅ PASS | VitePress 静态生成更快 |

## Project Structure

### 目标目录结构

```text
site-vitepress/
├── .vitepress/
│   ├── config.ts           # VitePress 配置
│   ├── theme/
│   │   ├── index.ts        # 主题入口
│   │   ├── style.css       # 自定义样式
│   │   └── components/     # 自定义 Vue 组件
│   │       ├── CodeTabs.vue
│   │       ├── Accordion.vue
│   │       └── FilterSyntax.vue
│   └── redirects.ts        # URL 重定向配置
├── docs/
│   ├── index.md            # 文档首页
│   ├── how-to-use.md
│   ├── collections.md
│   ├── authentication.md
│   ├── files-handling.md
│   ├── working-with-relations.md
│   ├── use-as-framework.md
│   ├── api-rules-and-filters.md
│   ├── going-to-production.md
│   ├── faq.md
│   ├── api/                # API 文档
│   │   ├── records.md
│   │   ├── realtime.md
│   │   ├── files.md
│   │   ├── collections.md
│   │   ├── settings.md
│   │   ├── logs.md
│   │   ├── crons.md
│   │   ├── backups.md
│   │   └── health.md
│   ├── go/                 # Go SDK 文档
│   │   ├── overview.md
│   │   ├── event-hooks.md
│   │   ├── routing.md
│   │   ├── database.md
│   │   ├── records.md
│   │   ├── collections.md
│   │   ├── migrations.md
│   │   ├── jobs-scheduling.md
│   │   ├── sending-emails.md
│   │   ├── rendering-templates.md
│   │   ├── console-commands.md
│   │   ├── realtime.md
│   │   ├── filesystem.md
│   │   ├── logging.md
│   │   ├── testing.md
│   │   ├── miscellaneous.md
│   │   └── record-proxy.md
│   └── js/                 # JS SDK 文档
│       ├── overview.md
│       ├── event-hooks.md
│       ├── routing.md
│       ├── database.md
│       ├── records.md
│       ├── collections.md
│       ├── migrations.md
│       ├── jobs-scheduling.md
│       ├── sending-emails.md
│       ├── rendering-templates.md
│       ├── console-commands.md
│       ├── sending-http-requests.md
│       ├── realtime.md
│       ├── filesystem.md
│       └── logging.md
├── public/
│   ├── images/             # 静态图片
│   ├── fonts/              # 字体文件
│   └── jsvm/               # TypeDoc 生成的 JSVM 文档
├── index.md                # 站点首页 (Landing Page)
├── package.json
└── tsconfig.json
```

## 技术方案

### 1. VitePress 配置

```typescript
// .vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PocketBase',
  description: 'Open Source backend in 1 file',
  
  themeConfig: {
    logo: '/images/logo.svg',
    
    nav: [
      { text: 'Docs', link: '/docs/' },
      { text: 'FAQ', link: '/docs/faq' },
      { text: 'JS SDK', link: 'https://github.com/pocketbase/js-sdk' }
    ],
    
    sidebar: {
      '/docs/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/docs/' },
            { text: 'How to use', link: '/docs/how-to-use' },
            { text: 'Collections', link: '/docs/collections' },
            // ...
          ]
        },
        {
          text: 'Web APIs',
          items: [
            { text: 'Records', link: '/docs/api/records' },
            // ...
          ]
        },
        {
          text: 'Go SDK',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/docs/go/overview' },
            // ...
          ]
        },
        {
          text: 'JS SDK',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/docs/js/overview' },
            // ...
          ]
        }
      ]
    },
    
    search: {
      provider: 'local'
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/pocketbase/pocketbase' }
    ]
  }
})
```

### 2. 自定义组件

#### CodeTabs 组件 (多语言代码切换)

```vue
<!-- .vitepress/theme/components/CodeTabs.vue -->
<template>
  <div class="code-tabs">
    <div class="tabs-header">
      <button 
        v-for="tab in tabs" 
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>
    <div class="tabs-content">
      <slot :name="activeTab" />
    </div>
  </div>
</template>
```

#### Accordion 组件 (折叠面板)

```vue
<!-- .vitepress/theme/components/Accordion.vue -->
<template>
  <details class="accordion">
    <summary>{{ title }}</summary>
    <div class="content">
      <slot />
    </div>
  </details>
</template>
```

### 3. 内容迁移策略

#### Svelte → Markdown 转换规则

| Svelte 语法 | Markdown/Vue 语法 |
|-------------|-------------------|
| `{@html content}` | `v-html` 或直接 HTML |
| `{#if condition}` | `v-if` 或条件渲染 |
| `{#each items}` | `v-for` 或静态列表 |
| `<CodeBlock>` | ` ```lang ` 代码块 |
| `<CodeTabs>` | `<CodeTabs>` Vue 组件 |
| `<Accordion>` | `<details>` 或组件 |
| `<slot>` | Vue `<slot>` |

#### 示例转换

**Before (Svelte)**:
```svelte
<CodeTabs>
  <div slot="go">
    <CodeBlock language="go" content={`
app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
    return e.Next()
})
    `} />
  </div>
  <div slot="js">
    <CodeBlock language="javascript" content={`
onRecordCreate((e) => {
    e.next()
}, "posts")
    `} />
  </div>
</CodeTabs>
```

**After (Markdown + Vue)**:
```markdown
<CodeTabs>
<template #go>

```go
app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
    return e.Next()
})
```

</template>
<template #js>

```javascript
onRecordCreate((e) => {
    e.next()
}, "posts")
```

</template>
</CodeTabs>
```

### 4. URL 重定向

```typescript
// .vitepress/redirects.ts
export const redirects = {
  // API 文档重定向
  '/docs/api-records': '/docs/api/records',
  '/docs/api-realtime': '/docs/api/realtime',
  '/docs/api-files': '/docs/api/files',
  '/docs/api-collections': '/docs/api/collections',
  '/docs/api-settings': '/docs/api/settings',
  '/docs/api-logs': '/docs/api/logs',
  '/docs/api-crons': '/docs/api/crons',
  '/docs/api-backups': '/docs/api/backups',
  '/docs/api-health': '/docs/api/health',
  
  // Go SDK 重定向
  '/docs/go-overview': '/docs/go/overview',
  '/docs/go-event-hooks': '/docs/go/event-hooks',
  // ... 其他 Go 页面
  
  // JS SDK 重定向
  '/docs/js-overview': '/docs/js/overview',
  '/docs/js-event-hooks': '/docs/js/event-hooks',
  // ... 其他 JS 页面
}
```

### 5. 样式迁移

VitePress 使用 CSS Variables 进行主题定制：

```css
/* .vitepress/theme/style.css */
:root {
  --vp-c-brand-1: #16a394;
  --vp-c-brand-2: #1db9a6;
  --vp-c-brand-3: #24d4bf;
  
  --vp-font-family-base: 'Inter', sans-serif;
  --vp-font-family-mono: 'JetBrains Mono', monospace;
}

.dark {
  --vp-c-bg: #1a1a1a;
  --vp-c-bg-soft: #242424;
}
```

## 迁移阶段

### Phase 0: 环境搭建 (1 天)

- 初始化 VitePress 项目
- 配置基础主题
- 设置开发环境

### Phase 1: 核心组件 (2 天)

- 实现 CodeTabs 组件
- 实现 Accordion 组件
- 实现 FilterSyntax 组件
- 配置代码高亮

### Phase 2: 内容迁移 (5 天)

- Introduction 模块 (7 页)
- Web APIs 模块 (9 页)
- Go SDK 模块 (17 页)
- JS SDK 模块 (15 页)
- 其他页面 (3 页)

### Phase 3: 样式与优化 (2 天)

- 主题样式定制
- 响应式布局调整
- 搜索功能配置
- 性能优化

### Phase 4: 测试与部署 (1 天)

- 功能测试
- 链接检查
- 构建部署
- URL 重定向验证

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 复杂交互组件难以迁移 | 使用 Vue 组件重新实现 |
| 代码示例格式不一致 | 编写转换脚本批量处理 |
| URL 变更影响 SEO | 配置 301 重定向 |
| 搜索质量下降 | 使用 Algolia DocSearch 作为备选 |

## 工具与依赖

```json
{
  "devDependencies": {
    "vitepress": "^1.0.0",
    "vue": "^3.4.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

## 验收标准

- [ ] 所有文档页面成功迁移
- [ ] 开发服务器正常运行 (`npm run dev`)
- [ ] 生产构建成功 (`npm run build`)
- [ ] 搜索功能正常工作
- [ ] 主题切换正常工作
- [ ] 代码高亮正常显示
- [ ] 移动端响应式正常
- [ ] Lighthouse 评分 > 90
