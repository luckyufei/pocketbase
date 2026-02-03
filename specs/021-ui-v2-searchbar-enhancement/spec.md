# Feature Specification: UI-V2 Searchbar Enhancement

**Feature Branch**: `021-ui-v2-searchbar-enhancement`  
**Created**: 2026-02-02  
**Status**: Ready for Dev  
**Input**: 用户反馈 - ui-v2 搜索栏功能与 ui 版本有差距，还原度约 70%

## 背景

当前 ui-v2 版本的搜索栏组件（`FilterAutocompleteInput`）相比 ui (Svelte) 版本存在以下差距：

1. **缺少搜索按钮**：用户输入后没有视觉提示需要提交
2. **无语法高亮**：ui 版本使用 CodeMirror，支持 PocketBase filter 语法高亮
3. **无 Web Worker 缓存**：自动补全在主线程计算，可能影响性能
4. **占位符文本不一致**：与 ui 版本的文案不同

### 当前实现对比

| 特性 | ui (Svelte) | ui-v2 (React) | 状态 |
|------|-------------|---------------|------|
| 搜索图标 | ✅ | ✅ | 已还原 |
| 搜索按钮（输入变化时显示） | ✅ 黄色 "Search" | ❌ 缺失 | 🔴 |
| 清空按钮 | ✅ "Clear" 文字 | ✅ X 图标 | ⚠️ 样式不同 |
| CodeMirror 语法高亮 | ✅ | ❌ 普通 input | 🔴 |
| Web Worker 缓存 | ✅ | ❌ 主线程计算 | 🔴 |
| 自动补全宏列表 | ✅ 完整 | ⚠️ 部分 | ⚠️ |
| 占位符文本 | `Search term or filter like created > "2022-01-01"...` | `Filter records, e.g. created > @now` | ⚠️ |

## 设计目标

1. **完整还原**：与 ui 版本的功能和体验保持一致
2. **性能优化**：使用 Web Worker 缓存自动补全 keys
3. **现代技术栈**：使用 `@uiw/react-codemirror` 实现语法高亮
4. **向后兼容**：保持现有 API 不变

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 搜索按钮显示 (Priority: P0)

作为用户，我希望输入筛选条件后能看到明显的搜索按钮，知道需要点击或按回车才能执行查询。

**Why this priority**: 核心用户体验问题，影响所有用户。

**Independent Test**: 输入筛选条件，验证搜索按钮出现。

**Acceptance Scenarios**:

1. **Given** 搜索栏为空, **When** 用户输入 `created > @now`, **Then** 显示黄色 "Search" 按钮
2. **Given** 已显示搜索按钮, **When** 用户点击按钮, **Then** 执行搜索并隐藏按钮
3. **Given** 已显示搜索按钮, **When** 用户按 Enter, **Then** 执行搜索并隐藏按钮
4. **Given** 输入值与已提交值相同, **When** 比较两者, **Then** 不显示搜索按钮
5. **Given** 搜索栏为空且从未提交, **When** 查看界面, **Then** 不显示搜索按钮

---

### User Story 2 - 清空按钮增强 (Priority: P1)

作为用户，我希望清空按钮更明显，点击后同时清空输入和执行搜索。

**Why this priority**: 提升操作效率。

**Independent Test**: 输入内容后点击清空按钮。

**Acceptance Scenarios**:

1. **Given** 搜索栏有内容, **When** 用户点击清空按钮, **Then** 清空输入并执行搜索
2. **Given** 搜索栏为空, **When** 查看界面, **Then** 不显示清空按钮
3. **Given** 清空按钮点击后, **When** 动画完成, **Then** 搜索框获得焦点

---

### User Story 3 - 语法高亮 (Priority: P1)

作为用户，我希望筛选语法有颜色区分，便于理解和编写。

**Why this priority**: 提升可读性和编辑体验。

**Independent Test**: 输入包含字符串、数字、运算符的筛选条件。

**Acceptance Scenarios**:

1. **Given** 输入 `created > "2022-01-01"`, **When** 渲染完成, **Then** 字符串 `"2022-01-01"` 显示为绿色
2. **Given** 输入 `age >= 18`, **When** 渲染完成, **Then** 数字 `18` 显示为蓝色
3. **Given** 输入 `status = "active" && verified = true`, **When** 渲染完成, **Then** 运算符 `&&` 和 `=` 有区分颜色
4. **Given** 输入 `@now`, **When** 渲染完成, **Then** 宏关键字显示为特殊颜色

---

### User Story 4 - 自动补全增强 (Priority: P1)

作为用户，我希望自动补全快速响应且包含所有可用选项。

**Why this priority**: 提升输入效率。

**Independent Test**: 输入 `@` 触发自动补全。

**Acceptance Scenarios**:

1. **Given** 输入 `@`, **When** 补全菜单打开, **Then** 显示所有时间宏（@now, @today, @yesterday 等）
2. **Given** 输入 `@r`, **When** 补全菜单打开, **Then** 显示 @request.* 相关选项
3. **Given** 输入 `@c`, **When** 补全菜单打开, **Then** 显示 @collection.* 相关选项
4. **Given** 输入字段名前缀, **When** 补全菜单打开, **Then** 显示匹配的集合字段
5. **Given** 补全计算需要时间, **When** 用户快速输入, **Then** 使用防抖避免频繁计算

---

### User Story 5 - Web Worker 性能优化 (Priority: P2)

作为开发者，我希望自动补全计算在后台线程执行，不阻塞主线程。

**Why this priority**: 大型集合可能有很多字段，需要优化性能。

**Independent Test**: 使用有 100+ 字段的集合，验证输入响应流畅。

**Acceptance Scenarios**:

1. **Given** 集合有大量字段, **When** 触发自动补全, **Then** 输入框不卡顿
2. **Given** Worker 正在计算, **When** 用户继续输入, **Then** 取消旧计算，启动新计算
3. **Given** Worker 计算完成, **When** 缓存结果, **Then** 下次输入直接使用缓存

---

### User Story 6 - 占位符文本统一 (Priority: P2)

作为用户，我希望看到与 ui 版本一致的占位符提示。

**Why this priority**: 保持一致性。

**Independent Test**: 查看空搜索栏的占位符文本。

**Acceptance Scenarios**:

1. **Given** 搜索栏为空, **When** 查看占位符, **Then** 显示 `Search term or filter like created > "2022-01-01"...`

---

## Technical Design

### 组件结构

```
ui-v2/src/components/
├── FilterAutocompleteInput.tsx    # 主组件（重构）
├── FilterAutocompleteInput.test.tsx
├── filterAutocomplete.worker.ts   # Web Worker（新增）
└── filterLanguage.ts              # CodeMirror 语法定义（新增）
```

### 技术选型

| 功能 | 方案 | 理由 |
|------|------|------|
| 语法高亮 | `@uiw/react-codemirror` | 项目已有依赖，无需新增 |
| Web Worker | `comlink` 或原生 Worker | 简化 Worker 通信 |
| 自动补全 | CodeMirror autocomplete | 原生集成，体验更好 |

### 自动补全宏列表

完整的宏列表应包含：

```typescript
const FILTER_MACROS = [
  // 布尔值
  { label: 'true', type: 'atom' },
  { label: 'false', type: 'atom' },
  
  // 时间宏
  { label: '@now', type: 'keyword', info: '当前时间' },
  { label: '@second', type: 'keyword', info: '当前秒' },
  { label: '@minute', type: 'keyword', info: '当前分钟' },
  { label: '@hour', type: 'keyword', info: '当前小时' },
  { label: '@day', type: 'keyword', info: '当前日' },
  { label: '@month', type: 'keyword', info: '当前月' },
  { label: '@year', type: 'keyword', info: '当前年' },
  { label: '@weekday', type: 'keyword', info: '当前星期几' },
  { label: '@yesterday', type: 'keyword', info: '昨天' },
  { label: '@tomorrow', type: 'keyword', info: '明天' },
  { label: '@todayStart', type: 'keyword', info: '今天开始' },
  { label: '@todayEnd', type: 'keyword', info: '今天结束' },
  { label: '@monthStart', type: 'keyword', info: '本月开始' },
  { label: '@monthEnd', type: 'keyword', info: '本月结束' },
  { label: '@yearStart', type: 'keyword', info: '本年开始' },
  { label: '@yearEnd', type: 'keyword', info: '本年结束' },
  
  // 跨集合查询
  { label: '@collection.*', type: 'keyword', info: '跨集合查询' },
]
```

### CodeMirror 语法高亮规则

```typescript
// PocketBase filter 语法高亮
const filterLanguage = StreamLanguage.define(simpleMode({
  start: [
    // 布尔值
    { regex: /true|false|null/, token: 'atom' },
    // 注释
    { regex: /\/\/.*/, token: 'comment' },
    // 字符串
    { regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: 'string' },
    { regex: /'(?:[^\\]|\\.)*?(?:'|$)/, token: 'string' },
    // 数字
    { regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i, token: 'number' },
    // 运算符
    { regex: /\&\&|\|\||\=|\!\=|\~|\!\~|\>|\<|\>\=|\<\=/, token: 'operator' },
    // 括号
    { regex: /[\{\[\(]/, indent: true },
    { regex: /[\}\]\)]/, dedent: true },
    // 关键字
    { regex: /@\w+/, token: 'keyword' },
  ],
}))
```

### 状态管理

```typescript
interface SearchbarState {
  inputValue: string      // 当前输入值
  submittedValue: string  // 已提交的值
  isOpen: boolean         // 补全菜单是否打开
  selectedIndex: number   // 选中的补全项索引
}

// 显示搜索按钮的条件
const showSearchButton = inputValue !== submittedValue && inputValue.length > 0
```

---

## Implementation Checklist

### Phase 1: 搜索按钮还原 (Day 1)

- [ ] 1.1 添加 `submittedValue` 状态追踪已提交的值
- [ ] 1.2 实现搜索按钮显示逻辑
- [ ] 1.3 添加搜索按钮点击处理
- [ ] 1.4 添加按钮动画效果（fly transition）
- [ ] 1.5 统一占位符文本

### Phase 2: 清空按钮增强 (Day 1)

- [ ] 2.1 修改清空按钮为文字按钮 "Clear"
- [ ] 2.2 清空时同时执行搜索
- [ ] 2.3 清空后聚焦输入框

### Phase 3: 语法高亮 (Day 2)

- [ ] 3.1 创建 `filterLanguage.ts` 定义语法规则
- [ ] 3.2 集成 `@uiw/react-codemirror`
- [ ] 3.3 配置单行模式
- [ ] 3.4 样式适配（与现有 UI 风格一致）

### Phase 4: 自动补全增强 (Day 2)

- [ ] 4.1 补全宏列表完善
- [ ] 4.2 集成 CodeMirror 自动补全
- [ ] 4.3 实现字段补全逻辑
- [ ] 4.4 添加 @request.* 和 @collection.* 补全

### Phase 5: Web Worker 优化 (Day 3) - Optional

- [ ] 5.1 创建 `filterAutocomplete.worker.ts`
- [ ] 5.2 实现字段 keys 缓存计算
- [ ] 5.3 集成到主组件
- [ ] 5.4 性能测试

---

## Risks & Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CodeMirror 包体积增大 | 中 | 懒加载组件 |
| Worker 兼容性 | 低 | 降级到主线程计算 |
| 样式冲突 | 低 | 使用 scoped CSS |

---

## Success Metrics

1. 还原度达到 95% 以上
2. 输入响应时间 < 16ms（60fps）
3. 测试覆盖率 >= 80%
4. 无新增 lint 错误
