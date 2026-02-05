# Feature Specification: WebUI New Collection 功能 1:1 对齐

**Feature Branch**: `022-webui-new-collection-alignment`  
**Created**: 2026-02-03  
**Status**: Ready for Dev  
**Parent Spec**: `specs/014-ui-svelte-to-react/spec.md`

## 1. Problem Essence (核心问题)

WebUI (React) 版本的 New Collection 功能与 UI (Svelte) 版本进行深度对比分析，识别已对齐功能、差异功能和缺失功能。

**目标**：确保 New Collection 面板的**所有交互**与 UI 版本保持一致。

---

## 1.0 面板交互完整对比

根据截图分析，New Collection 面板包含以下核心交互区域：

### 1.0.1 面板头部

| 交互元素 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| 标题 "New collection" | ✅ | ✅ | ✅ 已对齐 |
| 关闭按钮 (X) | ✅ | ✅ | ✅ 已对齐 |
| Collection 名称输入框 | ✅ `<input name="name">` | ✅ | ✅ 已对齐 |
| Collection 类型下拉 | ✅ "Type: Base/Auth/View" | ✅ | ✅ 已对齐 |

### 1.0.2 Tab 切换区域

| Tab | Base Collection | Auth Collection | View Collection | 状态 |
|-----|-----------------|-----------------|-----------------|------|
| Fields/Query | ✅ Fields | ✅ Fields | ✅ Query | ✅ 已对齐 |
| API Rules | ✅ | ✅ | ✅ | ✅ 已对齐 |
| Options | ❌ 不显示 | ✅ 显示 | ❌ 不显示 | ✅ 已对齐 |

### 1.0.3 字段列表区域 (Fields Tab)

| 交互元素 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| 字段拖拽手柄 (::) | ✅ `.drag-handle-wrapper` | ✅ `useSortable` | ✅ 已对齐 |
| 字段颜色条 | ✅ 类型颜色 | ✅ | ✅ 已对齐 |
| 字段名称输入框 | ✅ 可编辑 | ✅ | ✅ 已对齐 |
| 字段类型徽章 | ✅ 只读显示 | ✅ | ✅ 已对齐 |
| 设置按钮 (⚙️) | ✅ 展开选项 | ✅ | ✅ 已对齐 |
| 删除状态 + 恢复按钮 | ✅ 红色标记 + ↺ 按钮 | ✅ | ✅ 已对齐 |

### 1.0.4 字段选项区域（展开后）

| 选项 | UI (Svelte) | WebUI (React) | 说明 | 状态 |
|------|-------------|---------------|------|------|
| **默认展开状态** | ❌ 默认关闭 (`showOptions = false`) | ❌ **默认展开** (`setExpandedField(name)`) | 新建字段时 | 🔴 **未对齐** |
| **新建字段行为** | ✅ 只选中输入框 (`nameInput?.select()`) | ❌ **展开整个选项面板** | `onMountSelect` vs `isExpanded` | 🔴 **未对齐** |
| **类型特定选项** | ✅ `<slot name="options">` | ✅ `FieldTypeOptions` | 如 Max size, Pattern 等 | ✅ 已对齐 |
| **选项区域布局** | ✅ `.schema-field-options` (紧凑) | ⚠️ 需要验证样式 | 布局和间距 | ⚠️ 待验证 |
| **Nonempty** (text/email/url等) | ✅ checkbox | ✅ checkbox | 必填验证 | ✅ 已对齐 |
| **Nonfalsey** (bool) | ✅ checkbox | ✅ checkbox | 必须为 true | ✅ 已对齐 |
| **Nonzero** (number) | ✅ checkbox | ✅ checkbox | 不能为 0 | ✅ 已对齐 |
| **Hidden** | ✅ checkbox | ✅ checkbox | 隐藏字段 | ✅ 已对齐 |
| **Presentable** | ✅ checkbox (Hidden 时禁用) | ✅ checkbox | 优先展示 | ✅ 已对齐 |
| **更多菜单 (...)** | ✅ Duplicate / Remove | ✅ Duplicate / Remove | 操作菜单 | ✅ 已对齐 |

**样式差异**：
- UI 版本使用 `.grid.grid-sm` + `.col-sm-6` 实现两列布局
- UI 版本使用 `.schema-field-options-footer` 实现底部复选框行布局（`display: flex; gap: var(--baseSpacing)`）
- WebUI 版本需要对齐这些布局样式

### 1.0.5 新建字段区域

| 交互元素 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| "+ New field" 按钮 | ✅ `<NewField>` 组件 | ✅ `DropdownMenu` | ✅ 已对齐 |
| 字段类型选择下拉 | ✅ 14 种类型 | ✅ 14 种类型 | ⚠️ 缺 secret |
| 字段类型图标 | ✅ Remix Icon | ✅ Remix Icon | ✅ 已对齐 |

### 1.0.6 索引区域

| 交互元素 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| 标题 "Indexes" | ✅ | ✅ | ✅ 已对齐 |
| "+ Add Index" 按钮 | ✅ | ✅ | ✅ 已对齐 |
| 索引列表 | ✅ | ✅ | ✅ 已对齐 |
| 索引编辑面板 | ✅ `IndexUpsertPanel.svelte` | ✅ `IndexUpsertPanel.tsx` | ⚠️ 样式差异 |
| "No indexes defined" 提示 | ✅ | ✅ | ✅ 已对齐 |
| 索引计数 "0 indexes" | ✅ | ✅ | ✅ 已对齐 |

### 1.0.6.1 索引编辑面板 (IndexUpsertPanel) 详细对比

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **弹窗标题** | "Create index" / "Update index" (小写 i) | "Create Index" / "Update Index" (大写 I) | 🟡 **文案差异** |
| **Unique 控件** | Toggle 样式 (`form-field-toggle`) | Checkbox 样式 (`Checkbox`) | 🟡 **样式差异** |
| **Index Definition 标签** | ❌ 无标签，直接显示编辑器 | ✅ 有 "Index Definition" 标签 | 🟡 **布局差异** |
| **Presets 布局** | 单行 `inline-flex gap-10`，无换行 | `flex flex-wrap gap-2`，可换行 | 🟡 **布局差异** |
| **Presets 选中样式** | `label link-primary` + `label-info` 类（蓝色背景） | Badge `variant="default"` / `"outline"` | 🟡 **样式差异** |
| **Presets 未选中样式** | `label link-primary` 类（紫色链接） | Badge `variant="outline"` | 🟡 **样式差异** |
| **删除按钮（新建时）** | ✅ 显示（`original != ""`，blankIndex 非空）| ❌ **不显示**（`isEdit = false`）| 🔴 **未对齐** |
| **删除按钮（编辑时）** | ✅ 显示 | ✅ 显示 | ✅ 已对齐 |
| **Cancel/Set 按钮** | 右下角 "Cancel" + "Set index" | 右下角 "Cancel" + "Set Index" | 🟡 **文案差异** |
| **按钮禁用逻辑** | `lowerCasedIndexColumns.length <= 0` | `selectedColumns.length === 0` | ✅ 已对齐 |

**修复方案**：
1. 统一文案：使用小写 "index"（与 UI 版本一致）
2. 移除 "Index Definition" 标签
3. 调整 Presets 布局为单行 + 统一间距
4. 调整 Badge 样式为链接样式
5. **新建索引时也显示删除按钮**（与 UI 版本一致）

### 1.0.7 面板底部

| 交互元素 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| "Cancel" 按钮 | ✅ | ✅ | ✅ 已对齐 |
| "Create" / "Save changes" 按钮 | ✅ | ✅ | ✅ 已对齐 |
| 保存并继续下拉 (编辑时) | ✅ | ⚠️ 需验证 | ⚠️ 待验证 |
| 按钮禁用状态 | ✅ `disabled={!canSave}` | ✅ | ✅ 已对齐 |
| 加载状态 | ✅ `btn-loading` | ✅ | ✅ 已对齐 |

### 1.0.8 View Collection 特殊处理

| 交互元素 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| Query Tab 组件 | ✅ `CollectionQueryTab.svelte` | ❌ **未使用**（组件存在但未导入）| 🔴 **未对齐** |
| Query Tab 内容 | ✅ 仅 SQL 编辑器 | ❌ 显示字段列表 + 索引 | 🔴 **未对齐** |
| 索引区域隐藏 | ✅ View 使用独立 Tab，无索引 | ❌ 仍显示索引列表 | 🔴 **未对齐** |
| `collection.indexes = []` | ✅ 自动清空 | ❌ **未实现** | 🔴 **未对齐** |
| Create/Update/Delete 规则禁用 | ✅ 强制为 null | ✅ 在 RulesTab 中隐藏 | ✅ 已对齐 |
| Truncate 操作隐藏 | ✅ 不显示 | ✅ `!isViewCollection && ...` | ✅ 已对齐 |

**重大架构差异**：

| 特性 | UI (Svelte) | WebUI (React) | 需要修复 |
|------|-------------|---------------|----------|
| View Tab 内容 | `CollectionQueryTab` (仅 SQL) | `CollectionFieldsTab` (字段+索引) | 🔴 是 |
| Tab 切换逻辑 | `{#if isView} QueryTab {:else} FieldsTab` | 始终用 `CollectionFieldsTab` | 🔴 是 |
| 索引自动清空 | `collection.indexes = []` | 未实现 | 🔴 是 |

**修复方案**：
1. 在 `UpsertPanel.tsx` 中导入 `CollectionQueryTab`
2. View Collection 时切换到 `CollectionQueryTab`，而非 `CollectionFieldsTab`
3. 添加 View Collection 时自动清空 indexes 的逻辑

---

## 1.1 功能对齐总览

### ✅ 已完全对齐的功能

| 功能模块 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| **UpsertPanel 主面板** | `CollectionUpsertPanel.svelte` | `UpsertPanel.tsx` | ✅ 已对齐 |
| **Tab 结构** | Schema/Rules/Options 3个Tab | Schema/Rules/Options 3个Tab | ✅ 已对齐 |
| **字段编辑 Tab** | `CollectionFieldsTab.svelte` | `CollectionFieldsTab.tsx` | ✅ 已对齐 |
| **API 规则 Tab** | `CollectionRulesTab.svelte` | `CollectionRulesTab.tsx` | ✅ 已对齐 |
| **Auth 选项 Tab** | `CollectionAuthOptionsTab.svelte` | `CollectionAuthOptionsTab.tsx` | ✅ 已对齐 |
| **View 查询 Tab** | `CollectionQueryTab.svelte` | `CollectionQueryTab.tsx` | ✅ 已对齐 |
| **字段拖拽排序** | 自定义 `Draggable.svelte` | `@dnd-kit/core + @dnd-kit/sortable` | ✅ 已对齐 |
| **索引管理** | `IndexesList.svelte` + `IndexUpsertPanel.svelte` | `IndexesList.tsx` + `IndexUpsertPanel.tsx` | ✅ 已对齐 |
| **复制 Collection** | `duplicate()` 方法 | `handleDuplicate()` 方法 | ✅ 已对齐 |
| **清空 Collection** | `truncateConfirm()` 方法 | `handleTruncate()` 方法 | ✅ 已对齐 |
| **删除 Collection** | `deleteConfirm()` 方法 | `handleDelete()` 方法 | ✅ 已对齐 |
| **复制 JSON** | `copyJSON()` 方法 | `handleCopyJSON()` 方法 | ✅ 已对齐 |

### ✅ 已对齐的字段类型 (14/15)

| 字段类型 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| text | `SchemaFieldText.svelte` | `TextFieldOptions.tsx` | ✅ 已对齐 |
| number | `SchemaFieldNumber.svelte` | `NumberFieldOptions.tsx` | ✅ 已对齐 |
| bool | `SchemaFieldBool.svelte` | `BoolFieldOptions.tsx` | ✅ 已对齐 |
| email | `SchemaFieldEmail.svelte` | `EmailFieldOptions.tsx` | ✅ 已对齐 |
| url | `SchemaFieldUrl.svelte` | `UrlFieldOptions.tsx` | ✅ 已对齐 |
| editor | `SchemaFieldEditor.svelte` | `EditorFieldOptions.tsx` | ✅ 已对齐 |
| date | `SchemaFieldDate.svelte` | `DateFieldOptions.tsx` | ✅ 已对齐 |
| select | `SchemaFieldSelect.svelte` | `SelectFieldOptions.tsx` | ✅ 已对齐 |
| json | `SchemaFieldJson.svelte` | `JsonFieldOptions.tsx` | ✅ 已对齐 |
| file | `SchemaFieldFile.svelte` | `FileFieldOptions.tsx` | ✅ 已对齐 |
| relation | `SchemaFieldRelation.svelte` | `RelationFieldOptions.tsx` | ✅ 已对齐 |
| password | `SchemaFieldPassword.svelte` | `PasswordFieldOptions.tsx` | ✅ 已对齐 |
| autodate | `SchemaFieldAutodate.svelte` | `AutodateFieldOptions.tsx` | ✅ 已对齐 |
| geoPoint | `SchemaFieldGeoPoint.svelte` | `GeoPointFieldOptions.tsx` | ✅ 已对齐 |
| **secret** | `SchemaFieldSecret.svelte` | ❌ **缺失** | 🔴 **缺失** |

### ✅ 已对齐的 Auth 选项

| 组件 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 密码认证 | `PasswordAuthAccordion.svelte` | `PasswordAuthAccordion.tsx` | ✅ 已对齐 |
| OAuth2 | `OAuth2Accordion.svelte` | `OAuth2Accordion.tsx` | ✅ 已对齐 |
| OTP | `OTPAccordion.svelte` | `OTPAccordion.tsx` | ✅ 已对齐 |
| MFA | `MFAAccordion.svelte` | `MFAAccordion.tsx` | ✅ 已对齐 |
| Token 配置 | `TokenOptionsAccordion.svelte` | `TokenOptionsAccordion.tsx` | ✅ 已对齐 |
| TOF Auth | `TofAuthAccordion.svelte` | `TofAuthAccordion.tsx` | ✅ 已对齐 |

### ✅ 已对齐的 API 规则

| 规则 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| listRule | ✅ | ✅ | ✅ 已对齐 |
| viewRule | ✅ | ✅ | ✅ 已对齐 |
| createRule | ✅ | ✅ | ✅ 已对齐 |
| updateRule | ✅ | ✅ | ✅ 已对齐 |
| deleteRule | ✅ | ✅ | ✅ 已对齐 |
| authRule (Auth) | ✅ | ✅ | ✅ 已对齐 |
| manageRule (Auth) | ✅ | ✅ | ✅ 已对齐 |

---

## 1.2 需要修复的差异

### 🔴 字段选项面板默认状态差异 (High)

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 默认展开状态 | ❌ 默认关闭 (`showOptions = false`) | ❌ **默认展开** (`setExpandedField(name)`) | 🔴 **未对齐** |
| 新建字段行为 | ✅ 只选中输入框名称 (`nameInput?.select()`) | ❌ **展开整个选项面板** | 🔴 **未对齐** |
| 实现机制 | `field.onMountSelect = true` → `nameInput?.select()` | `setExpandedField(newField.name)` → 展开面板 | 机制不同 |

**影响**：用户新建字段时，WebUI 会展开整个选项面板，而 UI 版本只是选中字段名输入框，让用户更快地输入字段名。

**修复方案**：
```typescript
// CollectionFieldsTab.tsx
// 修改 addField 函数
const addField = useCallback(
  (type: string = 'text') => {
    const newField: SchemaField = {
      name: getUniqueName('field'),
      type,
      required: false,
      options: {},
      _focusNameOnMount: true, // 新增：标记需要聚焦名称输入框
    }
    // ...
    onChange({ ...collection, fields: newFields })
    // 移除：setExpandedField(newField.name) // 不自动展开
  },
  [collection, onChange, getUniqueName]
)

// SchemaFieldEditor.tsx
// 添加 onMount 聚焦逻辑
useEffect(() => {
  if (field._focusNameOnMount) {
    nameInputRef.current?.select()
    onUpdate({ _focusNameOnMount: false })
  }
}, [field._focusNameOnMount])
```

### 🟡 索引编辑面板样式差异 (Medium)

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 弹窗标题 | "Create index" / "Update index" | "Create Index" / "Update Index" | 🟡 **文案差异** |
| Unique 控件 | Toggle 样式 | Checkbox 样式 | 🟡 **样式差异** |
| Index Definition 标签 | ❌ 无标签 | ✅ 有标签 | 🟡 **布局差异** |
| Presets 布局 | 单行 `inline-flex gap-10` | `flex-wrap gap-2` 可换行 | 🟡 **布局差异** |
| Presets 选中样式 | `label-info` 蓝色背景 | Badge `variant="default"` | 🟡 **样式差异** |
| 按钮文案 | "Set index" (小写) | "Set Index" (大写) | 🟡 **文案差异** |

**影响**：索引编辑弹窗的视觉外观与 UI 版本有细微差异。

**修复方案**：
```typescript
// IndexUpsertPanel.tsx
// 1. 修改 DialogTitle
<DialogTitle>{isEdit ? 'Update' : 'Create'} index</DialogTitle>

// 2. 移除 Index Definition 标签
// 3. 修改 Presets 布局
<div className="inline-flex gap-10">
  <span className="text-muted-foreground text-sm">Presets</span>
  {presetColumns.map((column) => (
    <button
      key={column}
      type="button"
      className={cn(
        "text-sm text-primary hover:underline",
        selectedColumns.includes(column.toLowerCase()) && "bg-blue-100 px-2 py-0.5 rounded"
      )}
      onClick={() => toggleColumn(column)}
    >
      {column}
    </button>
  ))}
</div>

// 4. 修改按钮文案
<Button>Set index</Button>
```

### 🔴 View Collection Tab 架构差异 (Critical)

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| Query Tab 组件使用 | ✅ `CollectionQueryTab.svelte` | ❌ 未使用（组件存在但未导入） | 🔴 **未对齐** |
| Tab 切换逻辑 | ✅ `{#if isView} QueryTab {:else} FieldsTab` | ❌ 始终使用 `CollectionFieldsTab` | 🔴 **未对齐** |
| View Tab 内容 | ✅ 仅 SQL 编辑器 | ❌ 显示字段列表 + 索引 | 🔴 **未对齐** |
| 索引自动清空 | ✅ `collection.indexes = []` | ❌ 未实现 | 🔴 **未对齐** |

**影响**：View Collection 的用户体验与 UI 版本不一致，显示了不应该出现的字段列表和索引管理。

**修复方案**：
```typescript
// UpsertPanel.tsx
import { CollectionQueryTab } from './CollectionQueryTab'

// Tab 内容切换
{activeTab === TAB_SCHEMA && (
  isViewCollection ? (
    <CollectionQueryTab
      collection={formData}
      onChange={(viewQuery) => setFormData(prev => ({ ...prev, viewQuery }))}
      errors={errors}
    />
  ) : (
    <CollectionFieldsTab ... />
  )
)}

// View Collection 时自动清空索引和规则
useEffect(() => {
  if (formData.type === 'view') {
    setFormData(prev => ({
      ...prev,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      indexes: [],
    }))
  }
}, [formData.type])
```

### 🟡 入口差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 入口位置 | 侧边栏**底部**独立按钮 | 侧边栏**顶部**图标按钮 | ⚠️ 不同 |
| 按钮样式 | `btn btn-block btn-outline` 带文字 | `Button variant="ghost" size="icon"` 仅图标 | ⚠️ 不同 |
| 按钮文案 | `+ New collection` | 无（仅 + 图标） | ⚠️ 不同 |

### 🔴 缺失的字段类型

| 字段类型 | UI (Svelte) | WebUI (React) | 状态 |
|----------|-------------|---------------|------|
| Secret | ✅ `SchemaFieldSecret.svelte` | ❌ 缺失 | 🔴 **缺失** |

**Secret 字段功能说明**:
- 最大存储大小配置 (maxSize，默认 4096 bytes)
- AES-256-GCM 加密存储
- API 响应中自动掩码显示（如 `sk-••••••••••345`）
- 用于存储 API Keys、Tokens 等敏感数据

### 🔴 Scaffolds API 和 Auth 默认字段 (Critical)

这是一个 **架构级差异**。UI 版本通过后端 API 获取各类型 Collection 的默认模板（scaffolds），而 WebUI 版本使用前端硬编码的默认值。

#### 数据来源对比

| 对比项 | UI (Svelte) | WebUI (React) | 状态 |
|-------|-------------|---------------|------|
| **数据来源** | 后端 API `getScaffolds()` | 前端硬编码 `defaultCollection` | 🔴 **架构差异** |
| **创建时 fields** | 从 scaffold 加载（含系统字段） | `fields: []` **空数组** | 🔴 **缺失** |
| **Auth 系统字段** | ✅ 自动包含 6 个系统字段 | ❌ **完全缺失** | 🔴 **缺失** |
| **类型切换字段合并** | ✅ 合并 scaffold + 保留非系统字段 | ❌ 仅更新 `type` 属性 | 🔴 **缺失** |
| **索引合并** | ✅ 合并 scaffold 索引 | ❌ 不处理 | 🔴 **缺失** |

#### UI (Svelte) 版本实现

**1. 从后端获取 scaffolds** (`stores/collections.js`):
```javascript
// 加载 Collections 时同时获取 scaffolds
const [resultScaffolds, resultCollections] = await Promise.all([
  ApiClient.collections.getScaffolds(),  // ← 获取所有类型的默认模板
  ApiClient.collections.getFullList()
]);
scaffolds.set(resultScaffolds);
```

**2. 新建时使用 scaffold** (`CollectionUpsertPanel.svelte`):
```javascript
// 新建 Collection 时从 scaffold 初始化
collection = structuredClone($scaffolds["base"]);
```

**3. 类型切换时合并字段** (`CollectionFieldsTab.svelte`):
```javascript
function onTypeCanged() {
    const newScaffold = structuredClone($scaffolds[collection.type]);
    
    // 1. 保存非系统字段
    const nonSystemFields = oldFields.filter((f) => !f.system);
    
    // 2. 使用新 scaffold 的字段
    collection.fields = newScaffold.fields;
    
    // 3. 合并已有系统字段的配置
    for (const oldField of oldFields) {
        if (oldField.system) {
            const idx = collection.fields.findIndex((f) => f.name == oldField.name);
            if (idx >= 0) {
                collection.fields[idx] = Object.assign(collection.fields[idx], oldField);
            }
        }
    }
    
    // 4. 追加非系统字段
    for (const field of nonSystemFields) {
        collection.fields.push(field);
    }
    
    // 5. 合并索引
    CommonHelper.mergeUnique(collection.indexes, newScaffold.indexes);
}
```

#### Auth 类型默认字段（来自后端 scaffold）

| 字段名 | 类型 | Required | Hidden | System | 说明 |
|-------|------|----------|--------|--------|------|
| `id` | text | ✅ | - | ✅ | 主键，min=15, max=15, autogenerate |
| `password` | password | ✅ | ✅ | ✅ | 密码，min=8 |
| `tokenKey` | text | ✅ | ✅ | ✅ | Token 密钥，min=30, max=60, autogenerate |
| `email` | email | ✅ | - | ✅ | 邮箱 |
| `emailVisibility` | bool | - | - | ✅ | 邮箱可见性 |
| `verified` | bool | - | - | ✅ | 验证状态 |
| `created` | autodate | - | - | - | 创建时间（用户字段，UI 自动添加）|
| `updated` | autodate | - | - | - | 更新时间（用户字段，UI 自动添加）|

**Auth 类型默认索引**:
- `CREATE UNIQUE INDEX idx_tokenKey ON ... (tokenKey)`
- `CREATE UNIQUE INDEX idx_email ON ... (email) WHERE email != ''`

#### WebUI (React) 当前问题

**文件**: `UpsertPanel.tsx`

```typescript
const defaultCollection = {
  name: '',
  type: 'base',
  fields: [],   // ❌ 空数组！缺少所有系统字段
  indexes: [],  // ❌ 空数组！缺少默认索引
  // ...
}
```

**问题**:
1. 创建 Auth 类型 Collection 时，字段列表为空，缺少 id/password/tokenKey/email/emailVisibility/verified
2. 切换类型时不会加载对应类型的系统字段
3. 缺少默认索引（tokenKey 和 email 的唯一索引）

---

### 🟡 默认 autodate 字段行为差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 新建时自动添加 created/updated | ✅ 自动添加 | ❌ **未实现** | 🔴 **缺失** |

**UI 版本逻辑** (`CollectionUpsertPanel.svelte` 第 129-140 行):
```javascript
// 新建 Collection 时自动添加默认时间戳字段
collection.fields.push({
    type: "autodate",
    name: "created",
    onCreate: true,
});
collection.fields.push({
    type: "autodate",
    name: "updated",
    onCreate: true,
    onUpdate: true,
});
```

**WebUI 现状**: `UpsertPanel.tsx` 的 `defaultCollection` 对象 `fields` 为空数组，未自动添加默认字段。

### 🟡 变更确认面板差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 组件存在 | ✅ `CollectionUpdateConfirm.svelte` | ✅ `CollectionUpdateConfirm.tsx` | ✅ 存在 |
| 字段删除检测 | ✅ | ✅ | ✅ 已对齐 |
| 字段重命名检测 | ✅ | ❓ 需验证 | ⚠️ 待验证 |
| 多选转单选检测 | ✅ | ❓ 需验证 | ⚠️ 待验证 |
| OIDC 主机变更检测 | ✅ | ❓ 需验证 | ⚠️ 待验证 |
| API 规则变更检测 | ✅ (仅 HTTPS) | ❓ 需验证 | ⚠️ 待验证 |
| Collection 重命名检测 | ✅ | ❓ 需验证 | ⚠️ 待验证 |

**UI 版本检测的变更类型**:
1. Collection 重命名
2. 字段重命名 (`field._originalName != field.name`)
3. 字段删除 (`field._toDelete`)
4. 多选转单选 (`old.maxSelect != 1 && field.maxSelect == 1`)
5. OIDC 主机变更 (oidc/oidc2/oidc3 的 authURL 主机变化)
6. API 规则变更 (仅 HTTPS 环境)

### 🟡 邮件模板编辑

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| 邮件模板组件 | ✅ `EmailTemplateAccordion.svelte` 完整编辑 | ⚠️ 简化提示 + 跳转设置 | 🟡 功能简化 |

**UI 版本**: 可在 Collection 编辑面板直接编辑邮件模板
**WebUI 版本**: 显示提示信息，引导用户到设置页面配置

---

### 🔴 表单验证系统 (Critical)

WebUI 版本缺乏完整的表单验证错误显示系统，这是一个 **架构级差异**。

#### 验证功能对比

| 验证功能 | UI (Svelte) | WebUI (React) | 状态 |
|----------|:-----------:|:-------------:|:----:|
| **全局错误 store** | ✅ `errors.js` 完整实现 | ❌ 仅简单字符串 | 🔴 **缺失** |
| **嵌套错误路径支持** | ✅ `fields.0.name` | ❌ 无 | 🔴 **缺失** |
| **API 错误自动映射** | ✅ `setErrors(responseData.data)` | ❌ 仅捕获消息 | 🔴 **缺失** |
| **Field 组件错误显示** | ✅ `<Field>` 自动显示 | ❌ 无等效组件 | 🔴 **缺失** |
| **Tab 错误指示器** | ✅ Tab 上显示红点 | ❌ 无 | 🔴 **缺失** |

#### Collection 名称验证

| 验证点 | UI (Svelte) | WebUI (React) | 状态 |
|--------|:-----------:|:-------------:|:----:|
| HTML required 属性 | ✅ | ✅ | ✅ 已对齐 |
| 名称格式化 (slugify) | ✅ `CommonHelper.slugify()` | ✅ 正则替换 | ✅ 已对齐 |
| **错误消息显示** (如 "Cannot be blank.") | ✅ `<Field>` 组件 | ❌ 不显示 | 🔴 **缺失** |

#### 字段名称验证

| 验证点 | UI (Svelte) | WebUI (React) | 状态 |
|--------|:-----------:|:-------------:|:----:|
| HTML required 属性 | ✅ | ❌ 无 | 🔴 **缺失** |
| 名称格式化 | ✅ | ✅ | ✅ 已对齐 |
| 重复字段名检测 | ✅ `hasFieldWithName()` | ✅ | ✅ 已对齐 |
| 系统字段禁止编辑 | ✅ | ✅ | ✅ 已对齐 |
| **字段错误显示** | ✅ `$errors.fields.${key}` | ❌ 不显示 | 🔴 **缺失** |

#### 索引验证

| 验证点 | UI (Svelte) | WebUI (React) | 状态 |
|--------|:-----------:|:-------------:|:----:|
| 必须选择至少一列 | ✅ 按钮禁用 | ✅ 按钮禁用 | ✅ 已对齐 |
| **索引错误显示** | ✅ `$errors.indexes.[i].message` | ❌ 不显示 | 🔴 **缺失** |

#### API 规则验证

| 验证点 | UI (Svelte) | WebUI (React) | 状态 |
|--------|:-----------:|:-------------:|:----:|
| 系统集合禁止修改 | ✅ | ✅ | ✅ 已对齐 |
| **规则语法错误显示** | ✅ 后端验证 + 显示 | ❌ 不显示 | 🔴 **缺失** |

#### UI (Svelte) 版本错误处理架构

```javascript
// ui/src/stores/errors.js
import { writable } from 'svelte/store'
export const errors = writable({})

export function setErrors(errs) {
    errors.set(errs || {})
}

// 支持嵌套路径如 "fields.0.name"
export function getNestedVal(data, path) {
    return path.split('.').reduce((obj, key) => obj?.[key], data)
}
```

```svelte
<!-- ui/src/components/base/Field.svelte -->
<div class="form-field" class:error={fieldError}>
  <label>{label}</label>
  <slot />
  {#if fieldError}
    <div class="form-field-error">{fieldError.message}</div>
  {/if}
</div>
```

#### WebUI (React) 需要实现

1. **全局表单错误 atom** (`formErrorsAtom`)
2. **嵌套错误路径解析** (`getNestedError()`)
3. **FormField 组件** (带错误显示)
4. **API 错误映射** (catch 块中解析 `err.data.data`)
5. **Tab 错误指示器** (Fields/API Rules Tab 上显示红点)

---

### 🔴 未保存警告系统 (Critical)

| 功能 | UI (Svelte) | WebUI (React) | 状态 |
|------|:-----------:|:-------------:|:----:|
| **关闭面板未保存检测** | ✅ `beforeHide` + `hasChanges` | ❌ 直接关闭 | 🔴 **缺失** |
| **复制时未保存检测** | ✅ `duplicateConfirm()` | ❌ 直接复制 | 🔴 **缺失** |
| **点击遮罩关闭** | ✅ 触发未保存检测 | ❌ 直接关闭 | 🔴 **缺失** |
| **hasChanges 计算** | ✅ JSON.stringify 比较 | ❌ 无实现 | 🔴 **缺失** |

#### UI (Svelte) 版本实现

```svelte
<!-- CollectionUpsertPanel.svelte -->
<OverlayPanel
    beforeHide={() => {
        if (hasChanges && confirmClose) {
            confirm("You have unsaved changes. Do you really want to close the panel?", () => {
                confirmClose = false;
                hide();
            });
            return false;  // 阻止关闭
        }
        return true;
    }}
>
```

#### WebUI (React) 需要实现

1. **hasChanges 计算** - 比较原始数据和当前表单数据
2. **beforeClose 钩子** - OverlayPanel 关闭前的拦截
3. **关闭确认弹窗** - "You have unsaved changes..."
4. **复制前检测** - handleDuplicate 中检查 hasChanges

---

### 🔴 更新确认弹窗差异 (High)

| 检测项 | UI (Svelte) | WebUI (React) | 状态 |
|--------|:-----------:|:-------------:|:----:|
| **字段删除检测** | ✅ | ✅ | ✅ 已对齐 |
| **删除警告显示** | ✅ 红色列表 | ✅ Alert 组件 | ✅ 已对齐 |
| **集合重命名检测** | ✅ `Renamed collection {old} → {new}` | ❌ 缺失 | 🔴 **缺失** |
| **字段重命名检测** | ✅ `Renamed field {old} → {new}` | ❌ 缺失 | 🔴 **缺失** |
| **多值→单值警告** | ✅ `Multiple to single value conversion` | ❌ 缺失 | 🔴 **缺失** |
| **API 规则变更显示** | ✅ Old/New 对比表 | ❌ 缺失 | 🔴 **缺失** |
| **OIDC Host 变更警告** | ✅ 账户关联错误警告 | ❌ 缺失 | 🔴 **缺失** |

#### UI (Svelte) 版本警告内容

```svelte
<!-- CollectionUpdateConfirm.svelte -->
<div class="alert alert-warning">
    <p>If any of the collection changes is part of another collection rule, filter or view query,
       you'll have to update it manually!</p>
    {#if deletedFields.length}
        <p>All data associated with the removed fields will be permanently deleted!</p>
    {/if}
</div>
```

---

### 🟡 键盘快捷键差异 (Medium)

| 快捷键 | UI (Svelte) | WebUI (React) | 状态 |
|--------|:-----------:|:-------------:|:----:|
| **Ctrl+S / Cmd+S 保存** | ✅ RecordUpsertPanel | ❌ 缺失 | 🔴 **缺失** |
| **Escape 关闭面板** | ✅ 带输入框保护 | ⚠️ 无输入框保护 | 🟡 **部分对齐** |
| **Escape 层级检测** | ✅ 仅最顶层响应 | ❌ 缺失 | 🔴 **缺失** |
| **Shift+Enter 换行** | ✅ AutoExpandTextarea | ❌ 缺失 | 🟡 **缺失** |
| **Ctrl+A 全选** | ✅ 导出页面 | ❌ 缺失 | 🟢 **低优先** |
| **Tab 列表导航** | ✅ | ✅ | ✅ 已对齐 |
| **Arrow 键导航** | ✅ | ✅ | ✅ 已对齐 |

#### UI (Svelte) 版本实现

```javascript
// RecordUpsertPanel.svelte
function handleFormKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.code == "KeyS") {
        e.preventDefault();
        e.stopPropagation();
        save(false);  // 保存但不关闭
    }
}

// OverlayPanel.svelte - Escape 保护
if (
    active &&
    escClose &&
    e.code == "Escape" &&
    !CommonHelper.isInput(e.target) &&  // 输入框中不触发
    wrapper.style.zIndex == highestZIndex()  // 仅最顶层面板
) {
    hide();
}
```

---

### 🟡 OAuth2 配置差异 (Medium)

| 功能 | UI (Svelte) | WebUI (React) | 状态 |
|------|:-----------:|:-------------:|:----:|
| **提供商列表显示** | ✅ | ✅ | ✅ 已对齐 |
| **配置表单** | ✅ | ✅ | ✅ 已对齐 |
| **删除确认** | ✅ confirm() | ✅ AlertDialog | ✅ 已对齐 |
| **字段映射配置** | ✅ mappedFields UI | ❌ 缺失 | 🔴 **缺失** |
| **提供商 Logo 图片** | ✅ SVG Logo | ❌ 仅首字母 | 🟡 **差异** |
| **提供商数量** | ✅ 35 个 | ⚠️ 24 个 | 🟡 **缺少 11 个** |
| **错误状态显示** | ✅ 卡片红色边框 | ❌ 缺失 | 🟡 **缺失** |

#### 缺少的提供商

Instagram, Gitee, Gitea, Linear, Notion, Monday, Box, Trakt, WakaTime, Planning Center, Mailcow

---

### 🔴 View Collection SQL 编辑器差异 (High)

| 功能 | UI (Svelte) | WebUI (React) | 状态 |
|------|:-----------:|:-------------:|:----:|
| **SQL 语言支持** | ✅ sql-select 方言 | ❌ 仅 JSON/JS/TS | 🔴 **缺失** |
| **SQL 关键字高亮** | ✅ SELECT/FROM/WHERE 等 | ❌ 无高亮 | 🔴 **缺失** |
| **表/字段自动补全** | ✅ 基于 collections schema | ❌ 缺失 | 🔴 **缺失** |
| **SQL 函数提示** | ✅ count/avg/sum/json_extract 等 | ❌ 缺失 | 🔴 **缺失** |
| **帮助提示** | ✅ 4 条规则说明 | ✅ 中文翻译 | ✅ 已对齐 |
| **错误处理** | ✅ | ✅ | ✅ 已对齐 |

#### UI (Svelte) 版本 SQL 关键字

```javascript
// CodeEditor.svelte - sql-select 模式
atoms: "select|distinct|from|where|having|group|by|order|limit|offset|join|left|right|inner|with|like|not|in|match|asc|desc|and|or|null",
builtIn: "count|avg|sum|min|max|cast|as|int|real|text|bool|date|time|datetime|unixepoch|strftime|coalesce|lower|upper|substr|json_extract|json_each|json_tree|json_array_length|json_valid|case|when|then|iif|if|else",
```

---

### 🟡 空状态 UI 差异 (Low)

| 功能 | UI (Svelte) | WebUI (React) | 状态 |
|------|:-----------:|:-------------:|:----:|
| **字段列表空状态** | 无提示 | 无提示 | ✅ 一致（都缺失） |
| **索引列表空状态** | 无提示 | "No indexes defined" | ✅ WebUI 更好 |
| **OAuth2 列表空状态** | 无提示 | "No OAuth2 providers configured." | ✅ WebUI 更好 |
| **Collection 列表空状态** | 无提示 | "暂无 Collection" | ✅ WebUI 更好 |
| **规则 placeholder** | "Leave empty to grant everyone access..." | "Leave empty to grant everyone access..." | ✅ 一致 |
| **侧边栏分组** | Pinned/Others/System | User/System | ⚠️ **缺少 Pin 功能** |

#### 语言一致性问题

WebUI 版本混用了中英文，以下需统一为英文：

| 组件 | 当前文案 | 建议统一为 |
|------|---------|-----------:|
| Sidebar 搜索 | "搜索..." | "Search collections..." |
| Sidebar 空结果 | "没有找到匹配的 Collection" | "No collections found." |
| Sidebar 空列表 | "暂无 Collection" | "No collections yet." |
| OAuth2 面板标题 | "OAuth2 提供商" | "Add OAuth2 provider" |
| Query placeholder | "例如: SELECT..." | "eg. SELECT..." |

---

### 🟡 长文本和 Tooltip 差异 (Low)

| 功能 | UI (Svelte) | WebUI (React) | 状态 |
|------|:-----------:|:-------------:|:----:|
| **Collection 名称截断** | `.txt` CSS 类 + `title` 属性 | `truncate` 类（无 title） | 🟡 **缺少 title** |
| **索引列表截断** | `overflow: hidden` + `min-width: 50px` | 无截断处理 | 🔴 **缺失** |
| **字段类型 Tooltip** | `use:tooltip={field.type}` | 原生 `title` 属性 | 🟡 **效果较弱** |
| **错误 Tooltip** | `use:tooltip={$errors...}` | 无 | 🔴 **缺失** |
| **OAuth2 警告图标** | 有（OAuth2 配置错误时显示） | 无 | 🔴 **缺失** |
| **Pin/Unpin Tooltip** | 有 | 无（无 Pin 功能） | ⚠️ **功能缺失** |
| **响应式断点** | 基础 | 使用 `sm:`, `md:` 断点 | ✅ WebUI 更好 |

---

### 🟡 加载状态和动画差异 (Medium)

| 功能 | UI (Svelte) | WebUI (React) | 状态 |
|------|:-----------:|:-------------:|:----:|
| **保存按钮动画** | `btn-loading` 旋转边框 | 文本 "Saving..." | 🟡 **缺少动画** |
| **面板滑入动画** | `fly` transition (从右侧) | 无动画 | 🔴 **缺失** |
| **面板淡入背景** | `fade` transition | 简单 CSS | 🟡 **效果较弱** |
| **字段展开动画** | `slide` transition | Collapsible（无显式动画） | 🔴 **缺失** |
| **字段新增/删除动画** | `slide` transition | 无 | 🔴 **缺失** |
| **错误图标动画** | `scale` transition (弹出) | 无 | 🔴 **缺失** |
| **侧边栏淡出效果** | `class:fade` | 无 | 🔴 **缺失** |
| **代码编辑器加载** | `isCodeEditorComponentLoading` + placeholder | 无 | 🔴 **缺失** |
| **拖拽排序动画** | 自定义 drag | `@dnd-kit` | ✅ 功能等效 |

#### UI (Svelte) 版本动画示例

```svelte
<!-- 面板动画 - OverlayPanel.svelte -->
<div class="overlay-panel-container"
    in:fly={{ duration: transitionSpeed, x: 50 }}
    out:fade={{ duration: transitionSpeed }}>
    ...
</div>

<!-- 字段展开动画 - SchemaField.svelte -->
{#if expanded}
    <div transition:slide={{ duration: 150 }}>
        <!-- 字段选项 -->
    </div>
{/if}

<!-- 错误图标动画 -->
<i transition:scale={{ duration: 150, start: 0.7 }} class="ri-error-warning-fill" />
```

---

## 1.3 总结

| 类别 | 数量 | 说明 |
|------|------|------|
| ✅ 完全对齐 | ~60% | 主要功能、Tab 结构、14种字段类型、Auth 选项、API 规则 |
| 🔴 架构差异 | 5项 | **View Collection Tab 架构**、**字段选项面板默认状态**、**表单验证系统**、**未保存警告系统**、**SQL 编辑器** |
| 🟡 交互差异 | 6项 | **更新确认详情**、**键盘快捷键**、**OAuth2 字段映射**、**提供商数量**、**加载状态动画**、**Pin 功能** |
| 🟡 样式差异 | 4项 | **索引编辑面板**、**OAuth2 Logo 图片**、**长文本截断/Tooltip**、**语言一致性** |
| 🟡 差异需修复 | 4项 | 侧边栏入口、默认字段、变更确认细节、邮件模板 |
| 🔴 缺失需新增 | 1项 | Secret 字段类型 |

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 0 - View Collection Tab 对齐 (Priority: P0 Critical)

作为管理员，我希望 View Collection 的 Query Tab 只显示 SQL 编辑器，与 UI 版本保持一致。

**Why this priority**: 这是架构级别的差异，直接影响用户体验。

**Independent Test**: 创建 View Collection，验证 Query Tab 只显示 SQL 编辑器。

**Acceptance Scenarios**:

1. **Given** 创建 View Collection, **When** 选择类型为 "View", **Then** Tab 名称显示 "Query"
2. **Given** View Collection, **When** 进入 Query Tab, **Then** 只显示 SQL 编辑器（无字段列表）
3. **Given** View Collection, **When** 进入 Query Tab, **Then** 不显示索引管理区域
4. **Given** 切换到 View 类型, **When** 类型切换完成, **Then** 自动清空 indexes
5. **Given** 切换到 View 类型, **When** 类型切换完成, **Then** 自动清空 createRule/updateRule/deleteRule
6. **Given** View SQL 编辑器, **When** 查看帮助提示, **Then** 显示 4 条规则说明

---

### User Story 1 - 侧边栏新建入口 (Priority: P0)

作为管理员，我希望在 Collections 侧边栏底部看到明显的 "+ New collection" 按钮，以便快速创建新集合。

**Why this priority**: 入口是用户首次接触的功能点，必须与原版一致以保证用户体验连贯性。

**Independent Test**: 打开 Collections 页面，验证侧边栏底部有 "+ New collection" 按钮。

**Acceptance Scenarios**:

1. **Given** 用户在 Collections 页面, **When** 查看侧边栏, **Then** 底部显示 "+ New collection" 按钮
2. **Given** 侧边栏有 Collections 列表, **When** 滚动列表, **Then** 底部按钮始终固定可见
3. **Given** 用户点击 "+ New collection" 按钮, **When** 按钮被点击, **Then** 打开 Collection 创建面板
4. **Given** 按钮样式, **When** 查看按钮, **Then** 显示为白色背景 + 边框 + "+ New collection" 文字
5. **Given** 搜索框有值, **When** 点击 "+ New collection", **Then** 面板正常打开（不受搜索状态影响）

---

### User Story 2 - Secret 字段类型支持 (Priority: P0)

作为开发者，我希望能在 Collection Schema 中添加 `secret` 类型字段，以便安全存储用户的 API Keys。

**Why this priority**: Secret 字段是 UI 版本支持的字段类型，缺失会导致功能不完整。

**Independent Test**: 在 Collection 编辑面板中添加 secret 类型字段。

**Acceptance Scenarios**:

1. **Given** 编辑 Collection Schema, **When** 点击 "New field" 下拉, **Then** 可以看到 "Secret" 类型选项
2. **Given** 添加 secret 字段, **When** 展开字段配置, **Then** 显示 maxSize 配置选项（默认 4096）
3. **Given** secret 字段已添加, **When** 在记录编辑表单中, **Then** 字段显示为密码输入框（掩码）
4. **Given** 记录列表页, **When** 查看 secret 字段值, **Then** 显示掩码格式 `sk-••••••••••345`
5. **Given** 编辑 secret 字段值, **When** 输入新值, **Then** 值被加密存储

---

### User Story 3 - 默认时间戳字段 (Priority: P1)

作为开发者，我希望创建新 Collection 时自动添加 `created` 和 `updated` 时间戳字段，以便自动记录数据变更时间。

**Why this priority**: 这是 UI 版本的默认行为，用户期望一致的体验。

**Independent Test**: 创建新 Collection，验证自动添加了 created/updated 字段。

**Acceptance Scenarios**:

1. **Given** 创建新 Collection, **When** 打开面板, **Then** 自动添加 `created` autodate 字段 (onCreate: true)
2. **Given** 创建新 Collection, **When** 打开面板, **Then** 自动添加 `updated` autodate 字段 (onCreate: true, onUpdate: true)
3. **Given** 默认字段已添加, **When** 用户不修改, **Then** 保存后 Collection 包含这两个字段
4. **Given** 默认字段已添加, **When** 用户删除默认字段, **Then** 可以正常删除

---

### User Story 4 - 变更确认面板完善 (Priority: P1)

作为管理员，我希望在保存 Collection 修改时看到完整的变更摘要确认，包括字段重命名、多选转单选、OIDC 变更等。

**Why this priority**: 防止误操作，特别是删除字段等破坏性操作。

**Independent Test**: 修改已有 Collection 的字段后保存，验证显示变更确认面板。

**Acceptance Scenarios**:

1. **Given** 编辑已有 Collection, **When** 修改字段后点击保存, **Then** 显示变更确认面板
2. **Given** 变更确认面板, **When** 删除了字段, **Then** 显示 "Removed fields" 列表（红色警告）
3. **Given** 变更确认面板, **When** 重命名了字段, **Then** 显示 "Renamed fields" 列表（旧名 → 新名）
4. **Given** 变更确认面板, **When** 重命名了 Collection, **Then** 显示 Collection 重命名变更
5. **Given** 变更确认面板, **When** 字段从多选变单选, **Then** 显示 "Multiple to single" 警告
6. **Given** Auth Collection OIDC 配置, **When** 变更了 OIDC 主机, **Then** 显示 OIDC 主机变更警告
7. **Given** HTTPS 环境, **When** API 规则发生变更, **Then** 显示 API 规则变更对比
8. **Given** 变更确认面板, **When** 点击确认, **Then** 执行保存操作
9. **Given** 变更确认面板, **When** 点击取消, **Then** 返回编辑面板

---

### User Story 5 - 索引重命名自动更新 (Priority: P2)

作为开发者，我希望重命名 Collection 时索引中的表名自动更新，以便保持索引定义的一致性。

**Why this priority**: 边缘场景，但有助于数据一致性。

**Independent Test**: 重命名 Collection，验证索引中的表名同步更新。

**Acceptance Scenarios**:

1. **Given** Collection `posts` 有索引 `CREATE INDEX idx_posts_title ON posts(title)`, **When** 重命名为 `articles`, **Then** 索引更新为 `CREATE INDEX idx_posts_title ON articles(title)`

---

### User Story 6 - 已有功能验证 (Priority: P1)

作为 QA，我需要验证 WebUI 已实现的功能与 UI 版本完全对齐。

**Why this priority**: 确保现有功能的正确性。

**Independent Test**: 逐一验证已实现功能的对齐情况。

**Acceptance Scenarios**:

1. **Given** Collection 类型切换, **When** 选择 base/auth/view 类型, **Then** Tab 和字段正确切换
2. **Given** 14 种字段类型, **When** 逐一添加每种类型, **Then** 选项配置与 UI 版本一致
3. **Given** Auth Collection, **When** 配置 Password/OAuth2/OTP/MFA/TOF Auth, **Then** 功能与 UI 版本一致
4. **Given** API 规则配置, **When** 编辑 7 种规则, **Then** 功能与 UI 版本一致
5. **Given** 索引管理, **When** 添加/编辑/删除索引, **Then** 功能与 UI 版本一致
6. **Given** 字段拖拽排序, **When** 拖动字段, **Then** 排序功能正常
7. **Given** 复制/清空/删除 Collection, **When** 执行操作, **Then** 功能与 UI 版本一致

---

## 3. Functional Requirements

### 3.0 View Collection Tab 架构 (Critical)

| ID | Requirement | Priority | User Story | 状态 |
|----|-------------|----------|------------|------|
| FR-VIEW-001 | View Collection 时显示 `CollectionQueryTab` 组件 | **P0 Critical** | US0 | 🔴 **待修复** |
| FR-VIEW-002 | View Collection Query Tab 只显示 SQL 编辑器 | **P0 Critical** | US0 | 🔴 **待修复** |
| FR-VIEW-003 | View Collection Query Tab 不显示字段列表 | **P0 Critical** | US0 | 🔴 **待修复** |
| FR-VIEW-004 | View Collection Query Tab 不显示索引管理 | **P0 Critical** | US0 | 🔴 **待修复** |
| FR-VIEW-005 | 切换到 View 类型时自动清空 indexes | **P0 Critical** | US0 | 🔴 **待修复** |
| FR-VIEW-006 | 切换到 View 类型时自动清空 create/update/delete 规则 | **P0 Critical** | US0 | 🔴 **待修复** |

### 3.1 需要新增/修复的功能

| ID | Requirement | Priority | User Story | 状态 |
|----|-------------|----------|------------|------|
| FR-001 | 侧边栏底部显示 "+ New collection" 按钮 | P0 | US1 | 🟡 待修改 |
| FR-002 | 按钮样式：白底 + 边框 + 图标 + 文字 | P0 | US1 | 🟡 待修改 |
| FR-003 | 按钮始终固定在侧边栏底部 | P0 | US1 | 🟡 待修改 |
| FR-004 | 字段类型选择器包含 "Secret" 选项 | P0 | US2 | 🔴 待新增 |
| FR-005 | SecretFieldOptions 组件支持 maxSize 配置 | P0 | US2 | 🔴 待新增 |
| FR-006 | Secret 字段在记录表单中显示为密码输入框 | P0 | US2 | 🔴 待新增 |
| FR-007 | Secret 字段在列表中显示掩码 | P0 | US2 | 🔴 待新增 |
| FR-008 | 新建 Collection 自动添加 created/updated 字段 | P1 | US3 | 🔴 待新增 |
| FR-009 | 变更确认面板检测字段重命名 | P1 | US4 | 🟡 待验证/补充 |
| FR-010 | 变更确认面板检测多选转单选 | P1 | US4 | 🟡 待验证/补充 |
| FR-011 | 变更确认面板检测 OIDC 主机变更 | P1 | US4 | 🟡 待验证/补充 |
| FR-012 | 变更确认面板检测 API 规则变更 (HTTPS) | P1 | US4 | 🟡 待验证/补充 |
| FR-013 | 变更确认面板检测 Collection 重命名 | P1 | US4 | 🟡 待验证/补充 |
| FR-014 | Collection 重命名时自动更新索引中的表名 | P2 | US5 | 🟡 待验证 |

### 3.2 已对齐的功能（需要验证）

| ID | Requirement | User Story | 状态 |
|----|-------------|------------|------|
| FR-V01 | UpsertPanel 面板 3 个 Tab 正确显示 | US7 | ✅ 已实现 |
| FR-V02 | Collection 类型 (base/auth/view) 切换正常 | US7 | ✅ 已实现 |
| FR-V03 | 14 种字段类型选项配置正确 | US7 | ✅ 已实现 |
| FR-V04 | 字段拖拽排序功能正常 | US7 | ✅ 已实现 |
| FR-V05 | Auth 选项 (Password/OAuth2/OTP/MFA/TOF) 配置正确 | US7 | ✅ 已实现 |
| FR-V06 | API 规则 (7种) 配置正确 | US7 | ✅ 已实现 |
| FR-V07 | 索引管理 (添加/编辑/删除) 功能正确 | US7 | ✅ 已实现 |
| FR-V08 | 复制/清空/删除 Collection 功能正确 | US7 | ✅ 已实现 |
| FR-V09 | 复制 JSON 功能正确 | US7 | ✅ 已实现 |
| FR-V10 | View Collection SQL 编辑器配置正确 | US7 | ✅ 已实现 |

---

## 4. Technical Analysis

### 4.1 侧边栏入口改动

**当前实现** (`webui/src/features/collections/components/Sidebar.tsx`):
- 新建按钮在头部搜索框旁边
- 仅显示 `+` 图标

```tsx
// 当前实现 - 顶部图标按钮
<Button variant="ghost" size="icon" onClick={handleNew}>
  <Plus className="h-4 w-4" />
</Button>
```

**目标实现** (参考 `ui/src/components/collections/CollectionsSidebar.svelte`):
```tsx
// 底部固定按钮
<footer className="sidebar-footer px-3 py-2 border-t border-slate-200">
  <Button
    variant="outline"
    className="w-full justify-center gap-2"
    onClick={handleNew}
  >
    <Plus className="h-4 w-4" />
    <span>New collection</span>
  </Button>
</footer>
```

### 4.2 Secret 字段类型实现

**需要新增文件**:
- `webui/src/features/collections/components/schema/SecretFieldOptions.tsx`
- `webui/src/features/records/components/fields/SecretField.tsx`

**参考实现** (`ui/src/components/collections/schema/SchemaFieldSecret.svelte`):
```svelte
<!-- 选项配置 -->
<Field class="form-field" name="options.maxSize">
  <label>Max size</label>
  <input type="number" bind:value={field.maxSize} />
  <div class="help-block">Default to ~4KB</div>
</Field>
```

**字段类型注册** (`CollectionFieldsTab.tsx` FIELD_TYPES 数组):
```typescript
// 添加到 FIELD_TYPES 数组
{ value: 'secret', label: 'Secret', icon: 'ri-key-line' }
```

**组件映射注册** (`schema/index.ts`):
```typescript
// 添加导出
export { SecretFieldOptions, type SecretField } from './SecretFieldOptions'

// 添加到 FIELD_TYPE_OPTIONS
secret: require('./SecretFieldOptions').SecretFieldOptions,
```

### 4.3 默认字段添加逻辑

**当前实现分析** (`UpsertPanel.tsx`):
```typescript
// 当前 defaultCollection 对象 - fields 为空数组
const defaultCollection = {
  name: '',
  type: 'base',
  schema: [],
  fields: [],  // ❌ 空数组，没有默认字段
  indexes: [],
  // ...
}
```

**目标实现** (参考 `ui/src/components/collections/CollectionUpsertPanel.svelte` 第 129-140 行):
```typescript
// 新建时自动添加默认时间戳字段
const defaultCollection = {
  name: '',
  type: 'base',
  fields: [
    {
      type: 'autodate',
      name: 'created',
      onCreate: true,
    },
    {
      type: 'autodate',
      name: 'updated',
      onCreate: true,
      onUpdate: true,
    },
  ],
  // ...
}
```

### 4.4 变更确认面板完善

**当前实现** (`CollectionUpdateConfirm.tsx`):
- ✅ 基本对话框结构
- ✅ 字段删除检测
- ✅ 使用 `CollectionsDiffTable` 显示变更

**需要补充的检测逻辑** (参考 `ui/src/components/collections/CollectionUpdateConfirm.svelte`):

```typescript
// 1. Collection 重命名检测
const isCollectionRenamed = oldCollection?.name !== newCollection?.name

// 2. 字段重命名检测
const renamedFields = newCollection?.fields?.filter(
  (field) => field.id && !field._toDelete && field._originalName !== field.name
) || []

// 3. 多选转单选检测
const multipleToSingleFields = newCollection?.fields?.filter((field) => {
  const old = oldCollection?.fields?.find((f) => f.id === field.id)
  return old && old.maxSelect !== 1 && field.maxSelect === 1
}) || []

// 4. OIDC 主机变更检测
async function detectConflictingOIDCs() {
  const oidcProviders = ['oidc', 'oidc2', 'oidc3']
  for (const name of oidcProviders) {
    const oldProvider = oldCollection?.oauth2?.providers?.find((p) => p.name === name)
    const newProvider = newCollection?.oauth2?.providers?.find((p) => p.name === name)
    if (oldProvider && newProvider) {
      const oldHost = new URL(oldProvider.authURL).host
      const newHost = new URL(newProvider.authURL).host
      if (oldHost !== newHost) {
        // 检查是否有现有 externalAuths
        // ...
      }
    }
  }
}

// 5. API 规则变更检测 (仅 HTTPS)
function detectRulesChange() {
  if (window.location.protocol !== 'https:') return

  const ruleProps = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']
  if (isAuthCollection) {
    ruleProps.push('manageRule', 'authRule')
  }
  
  for (const prop of ruleProps) {
    if (oldCollection?.[prop] !== newCollection?.[prop]) {
      changedRules.push({ prop, oldRule: oldCollection?.[prop], newRule: newCollection?.[prop] })
    }
  }
}
```

### 4.5 索引重命名自动更新

**当前实现** (`CollectionFieldsTab.tsx` 的 `handleFieldRename`):
```typescript
// 已实现字段重命名时更新索引列名
const newIndexes = collection.indexes.map((idx) =>
  idx.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName)
)
```

**需要补充**: Collection 重命名时更新索引中的表名
```typescript
// UpsertPanel.tsx 中监听 Collection 名称变更
useEffect(() => {
  if (originalName && formData.name && originalName !== formData.name) {
    const newIndexes = formData.indexes.map((idx) =>
      idx.replace(new RegExp(`\\bON\\s+${originalName}\\b`, 'gi'), `ON ${formData.name}`)
    )
    setFormData((prev) => ({ ...prev, indexes: newIndexes }))
  }
}, [formData.name, originalName])
```

---

## 5. UI Reference

### 5.1 侧边栏布局对比

```
┌─────────────────────────────────────────────────────────────────┐
│           UI (Svelte)                    WebUI (React)          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐                 ┌──────────────────┐      │
│  │ 🔍 Search...     │                 │ 🔍 Search...  [+]│ ← 顶部│
│  ├──────────────────┤                 ├──────────────────┤      │
│  │ 📁 users         │                 │ 📁 users         │      │
│  │ 📁 base          │                 │ 📁 base          │      │
│  │ 📁 posts_base    │                 │ 📁 posts_base    │      │
│  │ 📁 view          │                 │ 📁 view          │      │
│  │                  │                 │ ▶ System (n)     │      │
│  │ ▼ System         │                 │                  │      │
│  │   ...            │                 └──────────────────┘      │
│  ├──────────────────┤                                           │
│  │ + New collection │ ← 底部                                    │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Secret 字段选项面板

```
┌──────────────────────────────────────────────────────────────┐
│  Secret Field Options                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Max size                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 4096                                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│  Default to ~4KB                                             │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  ☐ Nonempty    ☐ Hidden    ☐ Presentable                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 变更确认面板

```
┌──────────────────────────────────────────────────────────────┐
│  Confirm collection changes                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  The following changes will be applied to "posts":            │
│                                                              │
│  ✅ New fields (2)                                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ • content (text)                                      │    │
│  │ • views (number)                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ⚠️ Removed fields (1)                                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ • old_field (text) - ALL DATA WILL BE DELETED        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  📝 Modified fields (1)                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ • title: max 100 → 200                               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Cancel]                               [Confirm and save]   │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 入口位置与 UI 版本一致 | 100% | 视觉对比 |
| SC-002 | Secret 字段功能完整 | 100% | 功能测试 |
| SC-003 | 默认字段自动添加 | 100% | 功能测试 |
| SC-004 | 变更确认面板正常 | 100% | 功能测试 |
| SC-005 | 测试覆盖率 | ≥ 80% | Jest coverage |

---

## 7. File Structure

### 新增文件

```
webui/src/features/collections/components/
├── schema/
│   └── SecretFieldOptions.tsx        # Secret 字段选项组件 (FR-005)

webui/src/features/records/components/fields/
└── SecretField.tsx                   # Secret 字段记录编辑组件 (FR-006, FR-007)
```

### 修改文件

```
webui/src/features/collections/components/
├── Sidebar.tsx                       # 添加底部新建按钮 (FR-001, FR-002, FR-003)
├── CollectionFieldsTab.tsx           # 注册 secret 字段类型 (FR-004)
├── SchemaFieldEditor.tsx             # 添加 secret 字段渲染
├── UpsertPanel.tsx                   # 添加默认字段逻辑 (FR-008)、索引重命名 (FR-014)
├── CollectionUpdateConfirm.tsx       # 完善变更检测逻辑 (FR-009~FR-013)
├── schema/index.ts                   # 导出 SecretFieldOptions
```

### 已存在且对齐的文件（无需修改）

```
webui/src/features/collections/components/
├── CollectionRulesTab.tsx            # ✅ API 规则 Tab
├── CollectionAuthOptionsTab.tsx      # ✅ Auth 选项 Tab
├── CollectionQueryTab.tsx            # ✅ View 查询 Tab
├── IndexesList.tsx                   # ✅ 索引列表
├── IndexUpsertPanel.tsx              # ✅ 索引编辑面板
├── RuleField.tsx                     # ✅ 规则编辑字段
├── CollectionsDiffTable.tsx          # ✅ 变更对比表格
├── auth/
│   ├── PasswordAuthAccordion.tsx     # ✅ 密码认证
│   ├── OAuth2Accordion.tsx           # ✅ OAuth2 配置
│   ├── OTPAccordion.tsx              # ✅ OTP 配置
│   ├── MFAAccordion.tsx              # ✅ MFA 配置
│   ├── TokenOptionsAccordion.tsx     # ✅ Token 配置
│   └── TofAuthAccordion.tsx          # ✅ TOF 认证
├── schema/
│   ├── TextFieldOptions.tsx          # ✅ 文本字段
│   ├── NumberFieldOptions.tsx        # ✅ 数字字段
│   ├── BoolFieldOptions.tsx          # ✅ 布尔字段
│   ├── EmailFieldOptions.tsx         # ✅ 邮箱字段
│   ├── UrlFieldOptions.tsx           # ✅ URL 字段
│   ├── EditorFieldOptions.tsx        # ✅ 富文本字段
│   ├── DateFieldOptions.tsx          # ✅ 日期字段
│   ├── SelectFieldOptions.tsx        # ✅ 选择字段
│   ├── JsonFieldOptions.tsx          # ✅ JSON 字段
│   ├── FileFieldOptions.tsx          # ✅ 文件字段
│   ├── RelationFieldOptions.tsx      # ✅ 关联字段
│   ├── PasswordFieldOptions.tsx      # ✅ 密码字段
│   ├── AutodateFieldOptions.tsx      # ✅ 自动日期字段
│   └── GeoPointFieldOptions.tsx      # ✅ 地理坐标字段
```

---

## 8. Dependencies

### 内部依赖

| 组件 | 用途 | 状态 |
|------|------|------|
| `core/field_secret.go` | Secret 字段类型后端实现 | ✅ 已存在 |
| `ui/src/components/collections/schema/SchemaFieldSecret.svelte` | Secret 字段参考实现 | ✅ 参考 |
| `ui/src/components/collections/CollectionUpdateConfirm.svelte` | 变更确认参考实现 | ✅ 参考 |
| `webui/src/features/collections/components/CollectionUpdateConfirm.tsx` | WebUI 变更确认组件 | ✅ 已存在 |
| `webui/src/features/collections/components/CollectionsDiffTable.tsx` | 变更对比组件 | ✅ 已存在 |

### 外部依赖

| 依赖 | 用途 | 版本 | 状态 |
|------|------|------|------|
| `lucide-react` | 图标 (KeyRound, Plus, Lock) | 已有 | ✅ |
| `@dnd-kit/core` | 拖拽排序 | 已有 | ✅ |
| `@dnd-kit/sortable` | 可排序列表 | 已有 | ✅ |
| `shadcn/ui` | UI 组件库 | 已有 | ✅ |

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Secret 字段后端未完成 | Low | High | 验证 `core/field_secret.go` 存在 |
| 变更确认逻辑复杂 | Medium | Medium | 参考 Svelte 实现逐步迁移 |
| 样式不一致 | Low | Low | 遵循现有 Tailwind 规范 |

---

## 10. Assumptions

1. `core/field_secret.go` 已实现并正常工作
2. WebUI 使用的 shadcn/ui 组件库可满足 UI 需求
3. 现有的 `UpsertPanel.tsx` 结构可扩展支持新功能
4. API 响应格式与 UI 版本一致
