# Feature Specification: TUI CRUD Operations

**Feature Branch**: `026-tui-crud`  
**Created**: 2026-02-04  
**Status**: ✅ Completed  
**Input**: `025-tui-e2e-validation` (发现 CRUD 功能缺失)

## 0. Executive Summary

| 指标 | 结果 |
|------|------|
| **新增测试数** | 173 |
| **通过** | 173 (100%) |
| **完整测试套件** | 870 tests |
| **覆盖率** | ≥ 80% |
| **实现进度** | 17/17 tasks (100%) |
| **Spec Epic 覆盖** | 4/4 Epics (100%) |

## 1. Problem Essence (核心问题)

TUI Console 目前只实现了 **Read（查看）** 功能，缺少完整的 CRUD 操作。作为一个数据库管理工具，用户需要能够直接在终端中创建、编辑和删除记录，而不必切换到 Web UI。

### 当前状态

| 操作 | 状态 | 命令 |
|------|------|------|
| **Create** | ❌ 未实现 | - |
| **Read** | ✅ 已实现 | `/view`, `/get`, `/cols`, `/schema` |
| **Update** | ❌ 未实现 | - |
| **Delete** | ❌ 未实现 | - |

### 目标

1. 实现 `/create @col` 命令，支持交互式记录创建
2. 实现 `/edit @col:id` 命令，支持记录编辑
3. 实现 `/delete @col:id` 命令，支持记录删除（带确认）
4. 提供良好的 TUI 表单体验
5. 保持 TDD 开发规范，测试覆盖率 ≥ 80%

## 2. Design Overview (设计概述)

### 2.1 新增命令

| 命令 | 描述 | 参数 |
|------|------|------|
| `/create @col` | 创建新记录 | `@collection` (必填) |
| `/edit @col:id` | 编辑已有记录 | `@collection:recordId` (必填) |
| `/delete @col:id` | 删除记录 | `@collection:recordId` (必填), `-f` (可选，强制删除) |

### 2.2 交互模式

#### Create/Edit 模式

```
┌─────────────────────────────────────────────────────┐
│ Create Record: posts                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  title *      [                               ]     │
│  content      [                               ]     │
│  published    [ ] false                            │
│  author       [@users:_______________]             │
│                                                     │
│  [Ctrl+S] Save   [Esc] Cancel   [Tab] Next field   │
└─────────────────────────────────────────────────────┘
```

**字段类型支持**:

| 字段类型 | 输入方式 |
|---------|---------|
| `text` | 单行输入框 |
| `editor` | 多行输入框 |
| `number` | 数字输入框（验证数字） |
| `bool` | 复选框 `[x]` / `[ ]` |
| `select` | 单选/多选列表 |
| `date` | 日期选择器或直接输入 |
| `relation` | `@collection:id` 选择器 |
| `file` | 文件路径输入 |
| `json` | JSON 编辑器 |

#### Delete 模式

```
┌─────────────────────────────────────────────────────┐
│ Delete Record                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Are you sure you want to delete this record?      │
│                                                     │
│  Collection: posts                                  │
│  Record ID:  abc123xyz                              │
│  Title:      "My First Post"                        │
│                                                     │
│  [y] Yes, delete   [n] No, cancel   [Esc] Cancel   │
└─────────────────────────────────────────────────────┘
```

### 2.3 API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/collections/:col/records` | POST | 创建记录 |
| `/api/collections/:col/records/:id` | PATCH | 更新记录 |
| `/api/collections/:col/records/:id` | DELETE | 删除记录 |

## 3. Technical Design (技术设计)

### 3.1 目录结构

```
tui/src/features/
├── records/
│   ├── components/
│   │   ├── RecordForm.tsx       # 新增：记录表单组件
│   │   ├── FieldInput.tsx       # 新增：字段输入组件
│   │   ├── DeleteConfirm.tsx    # 新增：删除确认组件
│   │   └── ...
│   ├── lib/
│   │   ├── recordsApi.ts        # 扩展：添加 create/update/delete
│   │   ├── fieldValidation.ts   # 新增：字段验证逻辑
│   │   └── ...
│   └── store/
│       └── recordsAtoms.ts      # 扩展：添加编辑状态
```

### 3.2 新增 API 函数

```typescript
// recordsApi.ts 扩展

/**
 * Create a new record
 */
export async function createRecord(
  pb: PocketBase,
  collectionName: string,
  data: Record<string, unknown>
): Promise<RecordData>;

/**
 * Update an existing record
 */
export async function updateRecord(
  pb: PocketBase,
  collectionName: string,
  recordId: string,
  data: Record<string, unknown>
): Promise<RecordData>;

/**
 * Delete a record
 */
export async function deleteRecord(
  pb: PocketBase,
  collectionName: string,
  recordId: string
): Promise<void>;

/**
 * Delete multiple records
 */
export async function deleteRecords(
  pb: PocketBase,
  collectionName: string,
  recordIds: string[]
): Promise<{ success: string[]; failed: string[] }>;
```

### 3.3 命令注册

```typescript
// commands.ts 扩展

{
  name: "/create",
  description: "Create a new record in a collection",
  args: [
    {
      name: "collection",
      type: "resource",
      required: true,
      description: "Collection name (use @collection)",
    },
  ],
  examples: ["/create @posts", "/create @users"],
},
{
  name: "/edit",
  description: "Edit an existing record",
  args: [
    {
      name: "resource",
      type: "resource",
      required: true,
      description: "Collection:ID (use @collection:id)",
    },
  ],
  examples: ["/edit @posts:abc123"],
},
{
  name: "/delete",
  description: "Delete a record",
  args: [
    {
      name: "resource",
      type: "resource",
      required: true,
      description: "Collection:ID (use @collection:id)",
    },
    {
      name: "-f",
      type: "boolean",
      required: false,
      description: "Force delete without confirmation",
    },
  ],
  examples: ["/delete @posts:abc123", "/delete @posts:abc123 -f"],
},
```

### 3.4 状态管理

```typescript
// recordsAtoms.ts 扩展

/** 编辑模式 */
export type EditMode = "create" | "edit" | null;

/** 表单状态 */
export interface FormState {
  mode: EditMode;
  collection: string | null;
  recordId: string | null;
  originalData: Record<string, unknown> | null;
  currentData: Record<string, unknown>;
  errors: Record<string, string>;
  isDirty: boolean;
}

export const formStateAtom = atom<FormState>({
  mode: null,
  collection: null,
  recordId: null,
  originalData: null,
  currentData: {},
  errors: {},
  isDirty: false,
});

/** 删除确认状态 */
export interface DeleteConfirmState {
  isOpen: boolean;
  collection: string | null;
  recordIds: string[];
  recordInfo: Record<string, unknown> | null;
}

export const deleteConfirmAtom = atom<DeleteConfirmState>({
  isOpen: false,
  collection: null,
  recordIds: [],
  recordInfo: null,
});
```

## 4. Test Scenarios (测试场景)

### Epic 1: Create Record (创建记录)

#### STORY-1.1: 基础创建流程

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-1.1.1 进入创建模式 | `/create @posts` | 显示空表单，标题显示 "Create: posts" | P0 |
| S-1.1.2 表单字段显示 | 查看表单 | 显示所有非系统字段，必填字段标 `*` | P0 |
| S-1.1.3 填写文本字段 | 在 title 字段输入 | 光标在输入框，可输入文本 | P0 |
| S-1.1.4 Tab 切换字段 | 按 Tab | 光标移动到下一字段 | P0 |
| S-1.1.5 保存记录 | Ctrl+S | 调用 API，成功后显示新记录 ID | P0 |
| S-1.1.6 取消创建 | 按 Esc | 返回上一视图，无数据变更 | P0 |

#### STORY-1.2: 字段类型支持

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-1.2.1 Bool 字段 | 空格切换 | 在 `[x]` 和 `[ ]` 之间切换 | P0 |
| S-1.2.2 Number 字段 | 输入非数字 | 显示验证错误 | P1 |
| S-1.2.3 Select 字段 | 上下选择 | 显示选项列表，可选择 | P1 |
| S-1.2.4 Relation 字段 | 输入 `@` | 显示关联集合的记录列表 | P1 |
| S-1.2.5 Date 字段 | 输入日期 | 验证日期格式 | P1 |
| S-1.2.6 JSON 字段 | 输入 JSON | 验证 JSON 格式 | P2 |

#### STORY-1.3: 验证与错误处理

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-1.3.1 必填字段为空 | 不填 title 直接保存 | 显示 "title is required" | P0 |
| S-1.3.2 唯一约束冲突 | 创建重复的 unique 字段 | 显示 "field must be unique" | P0 |
| S-1.3.3 格式验证失败 | email 字段输入非邮箱 | 显示 "invalid email format" | P1 |
| S-1.3.4 网络错误 | 断网后保存 | 显示连接错误，保留表单数据 | P1 |
| S-1.3.5 权限错误 | 无创建权限 | 显示 401/403 错误信息 | P1 |

---

### Epic 2: Edit Record (编辑记录)

#### STORY-2.1: 基础编辑流程

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-2.1.1 进入编辑模式 | `/edit @posts:<id>` | 显示表单，预填当前值 | P0 |
| S-2.1.2 查看当前值 | 查看表单 | 所有字段显示当前记录的值 | P0 |
| S-2.1.3 修改字段 | 修改 title 值 | 字段值更新，表单标记为 dirty | P0 |
| S-2.1.4 保存修改 | Ctrl+S | 调用 PATCH API，显示成功 | P0 |
| S-2.1.5 取消修改 | 按 Esc | 提示 "Discard changes?"，确认后返回 | P0 |
| S-2.1.6 记录不存在 | `/edit @posts:invalid` | 显示 "Record not found" | P0 |

#### STORY-2.2: 编辑冲突处理

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-2.2.1 并发修改 | 其他用户同时修改 | 保存时显示冲突警告 | P2 |
| S-2.2.2 强制覆盖 | 选择覆盖 | 使用当前值覆盖 | P2 |
| S-2.2.3 刷新获取最新 | 选择刷新 | 重新加载最新数据 | P2 |

---

### Epic 3: Delete Record (删除记录)

#### STORY-3.1: 单条删除

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-3.1.1 删除确认弹窗 | `/delete @posts:<id>` | 显示确认对话框，显示记录信息 | P0 |
| S-3.1.2 确认删除 | 按 `y` 或 Enter | 删除记录，显示成功消息 | P0 |
| S-3.1.3 取消删除 | 按 `n` 或 Esc | 取消操作，返回上一视图 | P0 |
| S-3.1.4 强制删除 | `/delete @posts:<id> -f` | 直接删除，无确认提示 | P0 |
| S-3.1.5 删除不存在的记录 | `/delete @posts:invalid` | 显示 "Record not found" | P0 |

#### STORY-3.2: 批量删除

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-3.2.1 批量删除语法 | `/delete @posts:<id1>,<id2>,<id3>` | 显示批量确认 "Delete 3 records?" | P1 |
| S-3.2.2 确认批量删除 | 按 `y` | 依次删除，显示成功/失败统计 | P1 |
| S-3.2.3 部分失败 | 批量删除含无效 ID | 显示 "2 deleted, 1 failed" | P1 |

#### STORY-3.3: 快捷键删除

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-3.3.1 在记录详情按 `d` | `/get @posts:<id>` 后按 `d` | 弹出删除确认 | P1 |
| S-3.3.2 在列表选中后按 `d` | `/view @posts` 选中后按 `d` | 弹出删除确认 | P1 |

---

### Epic 4: 表单 UX (Form User Experience)

#### STORY-4.1: 表单导航

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-4.1.1 Tab 向下 | 按 Tab | 移动到下一字段 | P0 |
| S-4.1.2 Shift+Tab 向上 | 按 Shift+Tab | 移动到上一字段 | P0 |
| S-4.1.3 上下箭头 | 在多行字段中 | 在字段内导航 | P1 |
| S-4.1.4 Enter 换行 | 在多行字段中 | 插入换行 | P1 |

#### STORY-4.2: 表单状态指示

| 场景 | 步骤 | 预期结果 | 优先级 |
|------|------|---------|--------|
| S-4.2.1 必填标记 | 查看必填字段 | 字段名后显示 `*` | P0 |
| S-4.2.2 Dirty 指示 | 修改字段后 | 标题栏显示 `[Modified]` | P1 |
| S-4.2.3 错误高亮 | 验证失败的字段 | 字段边框变红，显示错误信息 | P0 |
| S-4.2.4 保存中状态 | 保存时 | 显示 "Saving..." 指示 | P1 |

## 5. Implementation Plan (实施计划)

### Phase 1: Core API (Week 1)

- [ ] recordsApi.ts: `createRecord`, `updateRecord`, `deleteRecord`
- [ ] commands.ts: 注册 `/create`, `/edit`, `/delete`
- [ ] 单元测试覆盖

### Phase 2: Delete Flow (Week 1)

- [ ] DeleteConfirm.tsx 组件
- [ ] 删除确认流程
- [ ] 强制删除 `-f` 选项
- [ ] 批量删除支持

### Phase 3: Form Components (Week 2)

- [ ] RecordForm.tsx 主表单组件
- [ ] FieldInput.tsx 字段输入组件
- [ ] 基础字段类型：text, number, bool
- [ ] 表单导航：Tab, Shift+Tab

### Phase 4: Advanced Fields (Week 2)

- [ ] Select 字段（单选/多选）
- [ ] Relation 字段（带补全）
- [ ] Date 字段
- [ ] JSON 字段

### Phase 5: Validation & Polish (Week 3)

- [ ] 字段验证逻辑
- [ ] 错误提示 UI
- [ ] Dirty 状态检测
- [ ] 退出确认

## 6. Success Criteria (成功标准)

| 标准 | 要求 |
|------|------|
| **测试覆盖率** | ≥ 80% (非 UI 逻辑) |
| **P0 场景通过率** | 100% |
| **P1 场景通过率** | ≥ 95% |
| **命令响应时间** | < 200ms |
| **表单字段类型支持** | ≥ 6 种 |

## 7. Dependencies (依赖)

- `025-tui-e2e-validation` (已完成，发现此需求)
- `023-tui-console` (基础 TUI 实现)
- `024-tui-integration-fix` (集成修复)

## 8. Risks (风险)

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 复杂字段类型实现 | 高 | 分阶段实现，先支持基础类型 |
| 表单 UX 在终端限制 | 中 | 参考 lazygit 等成熟 TUI 的表单设计 |
| Relation 字段补全性能 | 中 | 添加搜索过滤，限制显示数量 |
