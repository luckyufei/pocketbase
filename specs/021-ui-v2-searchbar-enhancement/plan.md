# Plan: UI-V2 Searchbar Enhancement

**Feature Branch**: `021-ui-v2-searchbar-enhancement`  
**Created**: 2026-02-02  
**Estimated Effort**: 2-3 days

---

## Problem Statement

ui-v2 版本的搜索栏组件（`FilterAutocompleteInput`）与 ui (Svelte) 版本相比还原度仅约 70%。主要缺失：

1. 输入变化时显示的"Search"按钮
2. CodeMirror 语法高亮
3. Web Worker 缓存优化
4. 完整的自动补全宏列表

## Solution Overview

分阶段还原搜索栏功能：

1. **Phase 1**: 搜索按钮 + 清空按钮增强（核心体验）
2. **Phase 2**: CodeMirror 语法高亮（视觉增强）
3. **Phase 3**: Web Worker 优化（性能优化，可选）

## Key Design Decisions

### 1. 搜索按钮显示逻辑

```typescript
// 显示条件：输入值变化且非空
const showSearchButton = inputValue !== submittedValue && inputValue.length > 0

// 隐藏条件：
// - 输入值与已提交值相同
// - 输入值为空
```

### 2. CodeMirror vs 原生 Input

| 方案 | 优点 | 缺点 |
|------|------|------|
| 原生 Input + 自定义补全 | 轻量、简单 | 无语法高亮 |
| CodeMirror | 完整语法高亮、专业补全 | 包体积大 |

**选择**：CodeMirror（与 ui 版本保持一致）

### 3. 懒加载策略

```tsx
// 已有的懒加载方式
const FilterAutocompleteInput = lazy(() => import('@/components/FilterAutocompleteInput'))

// 保持懒加载，避免首屏加载时间增加
<Suspense fallback={<div className="w-80 h-9 border rounded-md bg-muted/30 animate-pulse" />}>
  <FilterAutocompleteInput ... />
</Suspense>
```

### 4. 向后兼容

组件 API 保持不变：

```typescript
interface FilterAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void  // 已有
  collections: CollectionModel[]
  baseCollection?: CollectionModel | null
  placeholder?: string
  disabled?: boolean
  className?: string
}
```

## Implementation Phases

### Phase 1: Core UX (Day 1)

**目标**：还原搜索按钮和清空按钮体验

1. 添加 `submittedValue` 状态
2. 实现搜索按钮显示/隐藏逻辑
3. 搜索按钮样式（黄色/警告色）
4. 清空按钮改为 "Clear" 文字
5. 占位符文本统一

**验收**：
- 输入后显示搜索按钮
- 点击按钮或按 Enter 执行搜索
- 清空按钮同时清空输入和执行搜索

### Phase 2: Syntax Highlighting (Day 2)

**目标**：使用 CodeMirror 实现语法高亮

1. 创建 PocketBase filter 语法定义
2. 集成 `@uiw/react-codemirror`
3. 配置单行模式和样式
4. 集成自动补全

**验收**：
- 字符串、数字、运算符有颜色区分
- 补全菜单正常工作
- 样式与现有 UI 一致

### Phase 3: Performance (Day 3, Optional)

**目标**：使用 Web Worker 优化性能

1. 创建 Worker 文件
2. 实现字段 keys 缓存
3. 集成到主组件

**验收**：
- 大型集合输入不卡顿
- 补全响应时间 < 100ms

## Risks

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| CodeMirror 样式冲突 | 中 | 低 | 使用 CSS 隔离 |
| 包体积增加 | 低 | 低 | 已有懒加载 |
| Worker 兼容性 | 低 | 低 | 降级方案 |

## Success Criteria

1. ✅ 搜索按钮功能完整还原
2. ✅ 语法高亮正常工作
3. ✅ 测试覆盖率 >= 80%
4. ✅ 无性能回归

## Dependencies

- `@uiw/react-codemirror` (已有依赖)
- `@codemirror/legacy-modes` (可能需要新增)
- `@codemirror/autocomplete` (可能需要新增)

## File Changes

```
ui-v2/src/components/
├── FilterAutocompleteInput.tsx        # 重构
├── FilterAutocompleteInput.test.tsx   # 更新测试
├── filterLanguage.ts                  # 新增
└── filterAutocomplete.worker.ts       # 新增 (Phase 3)

ui-v2/src/lib/
└── filterAutocomplete.ts              # 更新宏列表
```
