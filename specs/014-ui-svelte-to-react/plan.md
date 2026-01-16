# Implementation Plan: UI Migration (Svelte → React)

**Branch**: `014-ui-svelte-to-react` | **Date**: 2026-01-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-ui-svelte-to-react/spec.md`

## Summary

将 PocketBase Admin UI 从 Svelte 4 迁移到 React 18 技术栈。采用渐进式迁移策略，按功能模块分阶段完成。核心技术栈：React 18 + Jotai + react-router-dom v7 + Tailwind CSS + shadcn/ui。

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3  
**Primary Dependencies**: 
- `react` / `react-dom` v18.3
- `jotai` v2.x (状态管理)
- `react-router-dom` v7 (路由)
- `tailwindcss` v3 (样式)
- `@radix-ui/*` + `shadcn/ui` (组件库)
- `@uiw/react-codemirror` (代码编辑器)
- `react-chartjs-2` + `chart.js` (图表)
- `i18next` + `react-i18next` (国际化)

**Build Tool**: Vite 6.x  
**Testing**: Vitest + React Testing Library  
**Target Platform**: 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)  
**Project Type**: SPA (Single Page Application)  
**Performance Goals**: 首屏加载 < 3s, Lighthouse Performance >= 80  
**Constraints**: 功能与 Svelte 版本完全一致，不新增功能  
**Scale/Scope**: ~200 个 Svelte 组件迁移

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Feature Parity | ✅ PASS | 所有 Svelte 功能在 React 中实现 |
| No API Change | ✅ PASS | 后端 API 保持不变 |
| Progressive Migration | ✅ PASS | 分模块迁移，可并行运行 |
| Embed Support | ✅ PASS | 支持 Go embed 打包 |
| i18n Ready | ✅ PASS | 使用 i18next 支持多语言 |

## Project Structure

### Documentation (this feature)

```text
specs/014-ui-svelte-to-react/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Source (Svelte)
ui/
├── src/
│   ├── components/      # Svelte 组件
│   ├── stores/          # Svelte Stores
│   ├── utils/           # 工具函数
│   ├── routes.js        # 路由配置
│   └── App.svelte       # 根组件

# Target (React)
ui-v2/
├── src/
│   ├── components/      # 通用组件
│   │   └── ui/          # shadcn/ui 组件
│   ├── features/        # 功能模块
│   │   ├── auth/        # 认证模块
│   │   ├── collections/ # Collections 模块
│   │   ├── records/     # Records 模块
│   │   ├── settings/    # Settings 模块
│   │   ├── logs/        # Logs 模块
│   │   ├── monitoring/  # Monitoring 模块
│   │   ├── traces/      # Traces 模块
│   │   └── analytics/   # Analytics 模块
│   ├── hooks/           # 全局 Hooks
│   ├── lib/             # 工具函数
│   ├── pages/           # 页面组件
│   ├── router/          # 路由配置
│   ├── store/           # Jotai Atoms
│   ├── i18n/            # 国际化
│   ├── App.tsx          # 根组件
│   └── main.tsx         # 入口文件
```

**Structure Decision**: 采用 Feature-Based 目录结构，每个功能模块包含 components、hooks、store 子目录，便于模块化开发和维护。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              React Admin UI                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Routing Layer                                 │   │
│  │  ┌─────────────┐                                                      │   │
│  │  │ react-router│──── BrowserRouter ────▶ Route Components            │   │
│  │  │ -dom v7     │                                                      │   │
│  │  └─────────────┘                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      State Management (Jotai)                         │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Global Atoms                                  │ │   │
│  │  │  ┌─────────────────┐        ┌─────────────────┐                 │ │   │
│  │  │  │   appAtom       │        │  superuserAtom  │                 │ │   │
│  │  │  │   (config)      │        │  (auth state)   │                 │ │   │
│  │  │  └─────────────────┘        └─────────────────┘                 │ │   │
│  │  │  ┌─────────────────┐        ┌─────────────────┐                 │ │   │
│  │  │  │ collectionsAtom │        │   toastsAtom    │                 │ │   │
│  │  │  │ (data cache)    │        │ (notifications) │                 │ │   │
│  │  │  └─────────────────┘        └─────────────────┘                 │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         UI Layer                                      │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Component Hierarchy                           │ │   │
│  │  │                                                                  │ │   │
│  │  │  App.tsx                                                         │ │   │
│  │  │    ├── Layout (Sidebar + Header)                                 │ │   │
│  │  │    │     ├── CollectionsSidebar                                  │ │   │
│  │  │    │     └── PageWrapper                                         │ │   │
│  │  │    └── Routes                                                    │ │   │
│  │  │          ├── /login → Login.tsx                                  │ │   │
│  │  │          ├── /collections/:id → Records.tsx                      │ │   │
│  │  │          ├── /logs → Logs.tsx                                    │ │   │
│  │  │          ├── /settings/* → Settings/*.tsx                        │ │   │
│  │  │          ├── /monitoring → Monitoring.tsx                        │ │   │
│  │  │          ├── /traces → Traces.tsx                                │ │   │
│  │  │          └── /analytics → Analytics.tsx                          │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │ PocketBase  │  │ usePB Hook  │  │ API Hooks   │                   │   │
│  │  │ SDK         │  │ (singleton) │  │ (per feat)  │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Jotai 状态管理

选择 Jotai 而非 Redux/Zustand 的原因：
- **原子化**: 与 Svelte Stores 概念相似，迁移成本低
- **轻量**: 无 boilerplate，代码简洁
- **React 原生**: 基于 React Context，无额外依赖
- **TypeScript 友好**: 类型推断优秀

### 2. Feature-Based 目录结构

每个功能模块自包含：
```
features/collections/
├── components/       # 模块专用组件
├── hooks/            # 模块专用 Hooks
├── store/            # 模块专用 Atoms
└── index.ts          # 模块导出
```

优势：
- 高内聚低耦合
- 便于并行开发
- 易于测试和维护

### 3. shadcn/ui 组件策略

- 基础组件 (Button, Input, Select) 使用 shadcn/ui
- 复杂业务组件 (OverlayPanel, CodeEditor) 自行实现
- 保持与 Svelte 版本视觉一致性

### 4. 渐进式迁移

- 两套 UI 可并行运行
- 通过 URL 前缀区分 (`/_/` vs `/_v2/`)
- 逐模块迁移，降低风险

## Complexity Tracking

> 无违规项，架构简单清晰。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 组件迁移遗漏功能 | Medium | High | 对照 Svelte 代码逐行检查 |
| 样式不一致 | Medium | Medium | 使用 Tailwind 变量映射 SCSS 变量 |
| 状态管理复杂度 | Low | Medium | Jotai 原子化设计，按需拆分 |
| 性能退化 | Low | High | 使用 React.memo, useMemo 优化 |
| 国际化遗漏 | Medium | Low | 统一使用 t() 函数，CI 检查 |

## Dependencies

### NPM Dependencies (新增/更新)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.0.0",
    "jotai": "^2.10.0",
    "pocketbase": "^0.26.5",
    "@uiw/react-codemirror": "^4.23.0",
    "@codemirror/lang-javascript": "^6.2.0",
    "@codemirror/lang-json": "^6.0.0",
    "@codemirror/lang-sql": "^6.8.0",
    "react-chartjs-2": "^5.2.0",
    "chart.js": "^4.4.0",
    "react-leaflet": "^4.2.0",
    "leaflet": "^1.9.4",
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-accordion": "^1.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

## Migration Mapping

### Svelte → React 语法对照

| Svelte | React |
|--------|-------|
| `export let prop` | `props.prop` / 解构 |
| `$: derived = ...` | `useMemo(() => ..., [deps])` |
| `$: { sideEffect }` | `useEffect(() => { sideEffect }, [deps])` |
| `{#if}...{/if}` | `{condition && ...}` / 三元 |
| `{#each}...{/each}` | `{array.map(...)}` |
| `on:click={handler}` | `onClick={handler}` |
| `bind:value` | `value + onChange` |
| `createEventDispatcher()` | 回调 props / Context |
| `onMount()` | `useEffect(() => {}, [])` |
| `onDestroy()` | `useEffect(() => () => cleanup, [])` |
| `$store` (subscribe) | `useAtom(atom)` |
| `store.set(value)` | `setAtom(value)` |
| `<slot>` | `children` prop |
| `<slot name="x">` | `slots.x` prop |
| `use:action` | `ref` + `useEffect` |
| `transition:fade` | CSS Transition / Framer Motion |

### Store → Atom 映射

| Svelte Store | Jotai Atom | 文件 |
|--------------|------------|------|
| `pageTitle` | `pageTitleAtom` | `store/app.ts` |
| `appName` | `appNameAtom` | `store/app.ts` |
| `hideControls` | `hideControlsAtom` | `store/app.ts` |
| `superuser` | `superuserAtom` | `store/auth.ts` |
| `collections` | `collectionsAtom` | `store/collections.ts` |
| `activeCollection` | `activeCollectionAtom` | `store/collections.ts` |
| `toasts` | `toastsAtom` | `store/toasts.ts` |
| `confirmation` | `confirmationAtom` | `store/confirmation.ts` |
| `errors` | `errorsAtom` | `store/errors.ts` |
