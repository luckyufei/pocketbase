# Feature Specification: UI-V2 同步补全

**Feature Branch**: `016-ui-v2-gap-analysis`  
**Created**: 2026-01-15  
**Status**: Ready for Dev  
**Input**: UI 重构项目中 `ui` (Svelte) 与 `ui-v2` (React) 的功能差异分析

## 背景

PocketBase 正在将 Admin UI 从 Svelte (`ui/`) 迁移到 React (`ui-v2/`)。迁移过程中，原版 `ui` 持续有新功能提交（如 Secret Field），导致两个版本功能不同步。本 Spec 梳理需要补全到 `ui-v2` 的功能。

### 技术栈对比

| 特性 | ui (Svelte) | ui-v2 (React) |
|------|-------------|---------------|
| 框架 | Svelte 4.x | React 18.x |
| 状态管理 | Svelte stores | Jotai |
| UI 组件库 | 自定义 SCSS | shadcn/ui + Tailwind CSS |
| 类型系统 | JavaScript | TypeScript |
| 测试支持 | 无 | Bun test + Testing Library |
| 国际化 | 无 | i18next |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secret Field Schema 配置 (Priority: P0)

作为开发者，我希望在 Admin UI 中为 Collection 添加 `secret` 类型字段，以便安全存储用户的敏感数据（如 API Keys）。

**Why this priority**: Secret Field 是 `ui` 中新增的核心功能，`ui-v2` 完全缺失。

**Independent Test**: 在 Admin UI 中为 `users` Collection 添加 `api_key` 字段（类型为 secret），验证字段创建成功。

**Acceptance Scenarios**:

1. **Given** 编辑 Collection Schema, **When** 选择添加字段类型, **Then** 可以看到 `secret` 类型选项（图标: `ri-shield-keyhole-line`）
2. **Given** 添加 secret 字段, **When** 配置字段属性, **Then** 可以设置 `required`、`hidden`（默认 true）、`maxSize`（默认 4096）选项
3. **Given** Secret 字段配置面板, **When** 查看警告提示, **Then** 显示 "Uses AES-256-GCM encryption with PB_MASTER_KEY" 和 "Cannot be used for filtering/searching"

---

### User Story 2 - Secret Field 记录编辑 (Priority: P0)

作为管理员，我希望在 Admin UI 中安全地编辑包含 secret 字段的记录，以便管理用户数据时防止泄露。

**Why this priority**: 配合 US1，完成 Secret Field 的完整交互闭环。

**Independent Test**: 创建、查看、编辑包含 secret 字段的记录，验证掩码显示和 Reveal 功能。

**Acceptance Scenarios**:

1. **Given** 编辑记录表单, **When** 输入 secret 字段值, **Then** 输入框为密码类型 `type="password"`
2. **Given** 记录已有 secret 值, **When** 在列表页查看, **Then** 显示掩码（前后各3字符，中间用 `•` 填充）
3. **Given** 记录已有 secret 值, **When** 在详情页/编辑页查看, **Then** 显示掩码，提供 "Reveal" 按钮
4. **Given** 点击 Reveal 按钮, **When** 5 秒后, **Then** 自动恢复为掩码显示

---

### User Story 3 - Secret 基础输入组件 (Priority: P0)

作为开发者，我希望有一个可复用的 `SecretInput` 组件，以便在多处统一处理密文输入的 UI 交互。

**Why this priority**: 这是 US1/US2 的基础组件，也被 Secrets 管理页面复用。

**Independent Test**: 使用 `SecretInput` 组件输入密文，验证掩码显示、切换、自动隐藏功能。

**Acceptance Scenarios**:

1. **Given** SecretInput 组件, **When** 值不为空, **Then** 显示掩码（只显示前后各 3 个字符）
2. **Given** SecretInput 组件, **When** 点击眼睛图标, **Then** 切换 password/text 类型
3. **Given** SecretInput 显示明文, **When** 5 秒后, **Then** 自动恢复为 password 类型
4. **Given** SecretInput 组件, **When** 提供 `SecretGeneratorButton`, **Then** 可生成随机密钥

---

### User Story 4 - 记录字段值显示增强 (Priority: P1)

作为管理员，我希望在记录列表中看到各类型字段的友好显示，特别是 secret 字段要显示掩码。

**Why this priority**: 记录列表是核心功能，需要正确显示 secret 类型。

**Independent Test**: 查看包含 secret 字段的记录列表，验证 secret 值以掩码形式显示。

**Acceptance Scenarios**:

1. **Given** 记录列表, **When** 包含 secret 字段, **Then** 显示掩码值 + tooltip "Secret field - hidden"
2. **Given** 记录列表, **When** secret 值为空, **Then** 显示 "N/A"
3. **Given** 记录列表, **When** secret 值长度 ≤8, **Then** 全部用 `•` 掩盖

---

### User Story 5 - Secrets 管理页面同步 (Priority: P1)

作为管理员，我希望 `/settings/secrets` 页面功能与 `ui` 版本保持一致。

**Why this priority**: Secrets 管理是系统级功能，需要完整支持。

**Independent Test**: 在 Secrets 管理页面创建、编辑、删除系统密钥，验证功能完整。

**Acceptance Scenarios**:

1. **Given** Secrets 页面, **When** PB_MASTER_KEY 未配置, **Then** 显示功能未启用提示
2. **Given** Secrets 页面, **When** 创建新密钥, **Then** 支持 key 格式校验 `[A-Z0-9_]+`
3. **Given** Secrets 页面, **When** 编辑密钥, **Then** 不回显原值，需重新输入
4. **Given** Secrets 页面, **When** 选择环境, **Then** 支持 global/dev/prod 三种环境

---

### User Story 6 - 字段类型图标和工具函数 (Priority: P1)

作为开发者，我希望 secret 字段有正确的图标和工具函数支持。

**Why this priority**: 支持 US1-US5 的基础设施。

**Independent Test**: 验证 `getFieldTypeIcon("secret")` 返回正确图标。

**Acceptance Scenarios**:

1. **Given** 字段类型选择器, **When** 显示 secret 类型, **Then** 图标为 `ri-shield-keyhole-line`
2. **Given** 工具函数, **When** 调用 `randomSecret(15)`, **Then** 返回 15 位随机密钥

---

### Edge Cases

- Secret 字段值为空字符串时的显示处理
- Secret 字段值包含 Unicode/特殊字符时的掩码显示
- 快速多次点击 Reveal 按钮时的状态管理
- 网络错误时的错误提示和恢复

---

### Assumptions

1. `ui-v2` 已有 Secrets 管理页面基础框架（`/settings/secrets`）
2. `ui-v2` 使用 shadcn/ui 组件库，需要适配其组件规范
3. Secret Field 的后端 API 已完成（`/api/collections` schema 支持 secret 类型）
4. 测试覆盖率目标 ≥80%

---

## Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 新增 `SecretFieldOptions.tsx` 组件支持 secret 字段 Schema 配置 | P0 | US1 |
| FR-002 | 新增 `SecretField.tsx` 组件支持记录编辑中的 secret 字段 | P0 | US2 |
| FR-003 | 新增 `SecretInput.tsx` 通用组件，支持掩码显示、Reveal、自动隐藏 | P0 | US3 |
| FR-004 | 新增 `SecretGeneratorButton.tsx` 随机密钥生成器 | P0 | US3 |
| FR-005 | 更新 `RecordFieldValue.tsx` 支持 secret 字段的掩码显示 | P1 | US4 |
| FR-006 | 确认 Secrets 管理页面功能完整 | P1 | US5 |
| FR-007 | 更新工具函数添加 `getFieldTypeIcon("secret")` 和 `randomSecret()` | P1 | US6 |
| FR-008 | 在字段类型选择器中注册 secret 类型 | P0 | US1 |
| FR-009 | 所有新增组件必须有对应的测试文件 | P1 | - |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | Secret Field 功能完整性 | 100% | 与 ui 版本功能对比 |
| SC-002 | 组件测试覆盖率 | ≥80% | bun test --coverage |
| SC-003 | 掩码显示正确性 | 100% | UI 测试 |
| SC-004 | Reveal 自动隐藏 | 5 秒 ±0.5 秒 | 功能测试 |
| SC-005 | TypeScript 类型完整 | 0 any | ESLint 检查 |

---

## 组件设计

### SecretInput 组件 API

```typescript
interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  revealDuration?: number; // 默认 5000ms
  showGenerator?: boolean; // 是否显示生成器按钮
  generatorLength?: number; // 生成器密钥长度，默认 15
}
```

### SecretFieldOptions 组件 API

```typescript
interface SecretFieldOptionsProps {
  field: SecretFieldDefinition;
  onChange: (field: SecretFieldDefinition) => void;
}

interface SecretFieldDefinition {
  name: string;
  type: "secret";
  hidden: boolean; // 默认 true
  required: boolean;
  maxSize: number; // 默认 4096
}
```

### 掩码算法

```typescript
function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) {
    return "•".repeat(value.length);
  }
  const prefix = value.slice(0, 3);
  const suffix = value.slice(-3);
  const middle = "•".repeat(Math.min(value.length - 6, 10));
  return `${prefix}${middle}${suffix}`;
}
```

---

## 与 ui 版本对照

| ui 组件 | ui-v2 对应组件 | 状态 |
|---------|---------------|------|
| `SchemaFieldSecret.svelte` | `SecretFieldOptions.tsx` | ❌ 待创建 |
| `SecretField.svelte` | `SecretField.tsx` | ❌ 待创建 |
| `SecretInput.svelte` | `SecretInput.tsx` | ❌ 待创建 |
| `SecretGeneratorButton.svelte` | `SecretGeneratorButton.tsx` | ❌ 待创建 |
| `PageSecrets.svelte` | `Secrets.tsx` | ✅ 已存在 |
| `SecretUpsertPanel.svelte` | (集成到 Secrets.tsx) | ✅ 已存在 |
| `RecordFieldValue.svelte` (secret 部分) | `RecordFieldValue.tsx` | ❌ 待更新 |
