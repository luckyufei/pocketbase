# CODEBUDDY.md

> **语言要求**: 请使用中文来写文档和代码注释

本文件为 CodeBuddy 提供项目开发指南。

## 项目概述

基于 React 18 + Bun + TypeScript 的现代 Web 应用模板，集成 Jotai 状态管理、shadcn/ui 组件库和 i18next 国际化，支持中英双语。

## 常用命令

### 开发

```bash
bun run dev              # 启动开发服务器 (Bun 热重载)
bun run build            # 生产构建 (Bun 构建)
bun run preview          # 预览生产构建
```

### 测试

```bash
bun test                 # 运行所有测试
bun test --watch         # 监听模式运行测试
bun test --coverage      # 运行测试并生成覆盖率报告
```

运行单个测试文件：

```bash
bun test src/components/Counter.test.tsx
```

### 代码质量

```bash
bun run lint             # 检查 lint
bun run lint:fix         # 自动修复 lint 问题
bun run format           # 使用 Prettier 格式化代码
bun run format:check     # 检查代码格式
```

### 添加 shadcn/ui 组件

```bash
bunx shadcn@latest add [component-name]
```

组件安装到 `src/components/ui/`，通过 `@/components/ui/[component-name]` 导入。

## 架构

### 目录结构

```
src/
├── components/          # 通用 React 组件
│   ├── ui/             # shadcn/ui 组件 (Button, Card, Badge 等)
│   ├── Counter.tsx     # 使用 Jotai 的示例组件
│   └── LanguageSwitcher.tsx  # 语言切换组件
├── features/           # 功能模块 (Feature-based 架构)
│   └── [feature-name]/ # 每个功能模块独立目录
│       ├── index.ts          # 模块入口，统一导出
│       ├── components/       # 模块专属组件
│       ├── services/         # 业务逻辑 (纯函数/类)
│       ├── store/            # Jotai atoms
│       ├── hooks/            # React hooks
│       └── types/            # TypeScript 类型
├── pages/              # 页面组件 (Home, About, NotFound)
├── router/             # React Router 配置
├── store/              # 全局 Jotai atoms 状态管理
├── hooks/              # 全局自定义 React hooks
├── lib/                # 工具函数 (cn() 用于 className 合并)
├── i18n/               # 国际化配置
│   ├── index.ts        # i18next 配置
│   ├── locales/        # 语言文件 (en.json, zh.json)
│   └── i18next.d.ts    # TypeScript 类型定义
├── test/               # 测试配置和工具
└── main.tsx            # 应用入口 (初始化 i18n + router)
```

### 路由架构

- 使用 React Router v7 的 `createBrowserRouter`
- 路由定义在 `src/router/index.tsx`
- App.tsx 作为布局容器，使用 `<Outlet />` 渲染嵌套路由
- 导航栏和页脚在 App.tsx 中，所有页面共享

### Jotai 状态管理

- Atoms 定义在 `src/store/` 目录
- 示例模式 (参见 `src/store/counter.ts`):
  - 基础 atom: `atom(initialValue)`
  - 只写 atom 用于 actions: `atom(null, (get, set) => {...})`
- 组件中使用 `useAtom()` 读写，`useSetAtom()` 只写

### 国际化 (i18n)

- 框架: i18next + react-i18next
- 在 `src/main.tsx` 中初始化 (导入 `./i18n`)
- 语言文件: `src/i18n/locales/en.json` 和 `zh.json`
- 组件中使用: `const { t } = useTranslation()` 然后 `{t('key.path')}`
- 语言选择保存在 localStorage
- 首次访问自动检测浏览器语言

### shadcn/ui 组件系统

- 组件位于 `src/components/ui/`
- 这些是**源代码文件**，不是 npm 包，可以直接修改
- 基于 Radix UI 原语 + Tailwind CSS 样式
- 使用 `@/lib/utils` 中的 `cn()` 工具合并 Tailwind 类名
- 配置文件: 项目根目录的 `components.json`

### 路径别名

- `@/` 映射到 `src/` 目录
- 在 `tsconfig.app.json` 中配置
- 示例: `import { Button } from '@/components/ui/button'`

### 样式

- Tailwind CSS + CSS 变量主题 (定义在 `src/index.css`)
- 内置暗色模式支持，使用 Tailwind 的 dark mode 类
- 使用 `cn()` 工具条件合并 className

### 测试配置

- Bun 内置测试运行器
- 使用 happy-dom 作为 DOM 环境
- 使用 Testing Library 测试 React 组件
- 配置文件: `bunfig.toml` 和 `src/test/setup.ts`
- 测试文件使用 `import { describe, it, expect } from 'bun:test'`

## 重要配置文件

- `bunfig.toml` - Bun 配置 (测试预加载等)
- `components.json` - shadcn/ui 配置 (定义组件安装路径)
- `tsconfig.app.json` - TypeScript 配置，启用严格模式
- `tailwind.config.js` - Tailwind CSS 配置
- `src/i18n/index.ts` - i18next 初始化和语言配置

## 翻译更新

添加新 UI 文本时：

1. 在 `src/i18n/locales/en.json` 和 `zh.json` 中添加翻译键
2. 使用嵌套对象组织 (如 `page.section.key`)
3. 组件中导入 `useTranslation` 并使用 `t('key.path')`
4. TypeScript 会为翻译键提供自动补全

## 日期工具

使用 `dayjs` 处理日期和时间

## AI 交互

使用 Vercel 的 `ai-sdk` 进行 AI 交互：

- 官方文档: https://ai-sdk.dev
- 安装核心包: `bun add ai`
- 安装 Provider (按需选择):
  - OpenAI: `bun add @ai-sdk/openai`
  - Anthropic: `bun add @ai-sdk/anthropic`
  - Google: `bun add @ai-sdk/google`

### 基本用法

```typescript
import { generateText, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

// 生成文本
const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: '你好',
})

// 流式生成
const result = streamText({
  model: openai('gpt-4o'),
  prompt: '写一首诗',
})

for await (const chunk of result.textStream) {
  console.log(chunk)
}
```

### React Hooks

```typescript
import { useChat, useCompletion } from 'ai/react'

// 对话式交互
const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
})

// 补全式交互
const { completion, input, handleInputChange, handleSubmit } = useCompletion({
  api: '/api/completion',
})
```

## 开发规范

### 测试驱动开发 (TDD)

- 采用测试驱动开发流程，先编写测试再实现功能
- 非界面逻辑的代码行覆盖率必须达到 90% 以上
- 非界面逻辑的分支覆盖率必须达到 90% 以上
- 每个公开 API 必须有对应的单元测试
- 每个用户故事必须有对应的集成测试

### "丰田式"追求

- 优先选择免费或低成本的依赖和工具
- 代码必须高可靠性，关键路径需有错误恢复机制
- 模块设计遵循"即插即用"原则，最小化配置需求
- 避免过度工程，只实现明确需要的功能

### 认知负荷优先 (COGNITIVE First)

- 代码应该易于理解，优先选择简单直接的实现
- 避免使用过于复杂的设计模式或抽象
- 函数和方法应保持单一职责，长度不超过 50 行
- 命名必须清晰表达意图，避免缩写和隐晦命名
- 复杂逻辑必须有清晰的注释说明

### 核心原则

**"丰田式"追求** - 极低成本（甚至免费）、高可靠性、即插即用

**认知负荷优先** - 代码应该易于理解，而非展示技巧

```typescript
// ❌ 过度抽象
class AbstractDataProcessorFactory {
  createProcessor(): IDataProcessor { ... }
}

// ✅ 直接清晰
function parseCSV(content: string): Row[] { ... }
```

```typescript
// ❌ 隐式行为
const data = useData() // 内部做了 10 件事

// ✅ 显式可预测
const { data, loading, error } = useQuery(tableName)
```

### Feature 模块结构

使用 Feature-based 模块化的目录结构，每个 feature 模块遵循统一结构：

```
feature-name/
├── index.ts          # 模块入口，统一导出
├── components/       # React 组件
├── services/         # 业务逻辑 (纯函数/类)
├── store/            # Jotai atoms
├── hooks/            # React hooks
└── types/            # TypeScript 类型
```

## TDD 开发流程

**适用范围**: services, utils, hooks (非 UI 逻辑)

**测试文件位置**: 与源文件同目录

```
src/features/core/services/
├── example.ts
├── example.test.ts        # ← 测试文件
```

**开发流程**:

1. **Red** - 先写失败的测试
2. **Green** - 实现代码使测试通过
3. **Refactor** - 重构优化

```bash
# 运行单个测试
bun test src/features/core/services/example.test.ts
```

## 注意事项
