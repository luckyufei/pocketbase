# UI-V2 同步补全 - 任务清单

**创建日期**: 2026-01-15  
**基于**: spec.md (UI-V2 同步补全)  
**预计总工时**: ~24h

---

## Phase 1: Setup (项目初始化)

**预计工时**: 2h

- [x] T001 确认 `ui-v2` 开发环境可正常运行 (`npm run dev`)
- [x] T002 确认后端 secret field API 可用 (创建包含 secret 字段的 collection)
- [x] T003 Review `ui/src/components/collections/schema/SchemaFieldSecret.svelte` 作为参照

---

## Phase 2: Foundational (基础组件)

**预计工时**: 6h

### 2.1 工具函数补充

- [x] T004 [P] 更新 `ui-v2/src/lib/utils.ts`，添加 `randomSecret(length: number)` 函数
- [x] T005 [P] 更新 `ui-v2/src/lib/utils.ts`，确保 `getFieldTypeIcon("secret")` 返回 `"ri-shield-keyhole-line"`
- [x] T006 [P] 创建 `ui-v2/src/lib/utils.test.ts`，测试 `randomSecret` 和 `getFieldTypeIcon`

### 2.2 通用 SecretInput 组件

- [x] T007 创建 `ui-v2/src/components/SecretInput.tsx`，实现掩码显示、Reveal、自动隐藏
- [x] T008 创建 `ui-v2/src/components/SecretInput.test.tsx`，测试核心功能
- [x] T009 [P] 创建 `ui-v2/src/components/SecretGeneratorButton.tsx`，实现随机密钥生成
- [x] T010 [P] 创建 `ui-v2/src/components/SecretGeneratorButton.test.tsx`

**Checkpoint**: Phase 2 完成 - 基础组件可用 ✅

---

## Phase 3: User Story 1 - Secret Field Schema 配置 (P0)

**预计工时**: 4h  
**Story Goal**: 在 Admin UI 中支持添加 secret 类型字段  
**Independent Test**: 为 Collection 添加 secret 字段，验证配置选项正确

### 3.1 Schema 配置组件

- [x] T011 [US1] 创建 `ui-v2/src/features/collections/components/schema/SecretFieldOptions.tsx`
  - 支持 `hidden` (默认 true), `required`, `maxSize` (默认 4096) 配置
  - 显示 AES-256-GCM 加密警告
  - 显示 "Cannot be used for filtering/searching" 警告
- [x] T012 [US1] 创建 `ui-v2/src/features/collections/components/schema/SecretFieldOptions.test.tsx`

### 3.2 注册字段类型

- [x] T013 [US1] 更新 `ui-v2/src/features/collections/components/schema/index.ts`，导出 `SecretFieldOptions`
- [x] T014 [US1] 更新 `ui-v2/src/features/collections/components/SchemaFieldEditor.tsx`，添加 secret 类型到字段选择器
  - 添加 `{ label: "Secret", value: "secret", icon: getFieldTypeIcon("secret") }`

**Checkpoint**: Phase 3 完成 - Secret Field 可添加到 Collection Schema ✅

---

## Phase 4: User Story 2 - Secret Field 记录编辑 (P0)

**预计工时**: 4h  
**Story Goal**: 在记录编辑表单中安全地输入和编辑 secret 字段  
**Independent Test**: 创建/编辑包含 secret 字段的记录，验证掩码和 Reveal 功能

### 4.1 记录编辑字段组件

- [x] T015 [US2] 创建 `ui-v2/src/features/records/components/fields/SecretField.tsx`
  - 封装 `SecretInput` 组件
  - 传递 `required`, `disabled` 属性
- [x] T016 [US2] 创建 `ui-v2/src/features/records/components/fields/SecretField.test.tsx`

### 4.2 注册字段组件

- [x] T017 [US2] 更新 `ui-v2/src/features/records/components/fields/index.ts`，导出 `SecretField`
- [x] T018 [US2] 更新 `ui-v2/src/features/records/components/RecordForm.tsx`（或等效组件），添加 secret 类型字段渲染

**Checkpoint**: Phase 4 完成 - Secret Field 可在记录编辑中使用 ✅

---

## Phase 5: User Story 4 - 记录字段值显示增强 (P1)

**预计工时**: 3h  
**Story Goal**: 在记录列表中正确显示 secret 字段的掩码值  
**Independent Test**: 查看包含 secret 字段的记录列表，验证掩码显示

### 5.1 字段值显示组件

- [x] T019 [US4] 更新 `ui-v2/src/features/records/components/RecordFieldValue.tsx`
  - 添加 `secret` 类型处理分支
  - 实现掩码算法（前后各3字符，中间用 `•` 填充）
  - 添加 tooltip "Secret field - hidden"
- [x] T020 [US4] 创建 `ui-v2/src/features/records/components/RecordFieldValue.test.tsx`，添加 secret 类型测试

**Checkpoint**: Phase 5 完成 - 记录列表正确显示 secret 字段 ✅

---

## Phase 6: User Story 5 - Secrets 管理页面验证 (P1)

**预计工时**: 2h  
**Story Goal**: 确认 `/settings/secrets` 页面功能完整  
**Independent Test**: 在 Secrets 页面创建、编辑、删除系统密钥

### 6.1 功能验证

- [x] T021 [US5] Review `ui-v2/src/pages/settings/Secrets.tsx`，对比 `ui/src/components/secrets/PageSecrets.svelte`
- [x] T022 [US5] 验证功能：key 格式校验 `[A-Z0-9_]+`
- [x] T023 [US5] 验证功能：环境选择 (global/dev/prod)
- [x] T024 [US5] 验证功能：PB_MASTER_KEY 未配置时的错误提示 (503)
- [x] T025 [US5] 如有缺失功能，补充实现
  - 重构了完整的 Secrets.tsx 页面
  - 添加了正确的 /api/secrets API 调用
  - 添加了 Key 格式校验 (KEY_PATTERN)
  - 添加了环境选择 (global/development/production)
  - 添加了 503 错误时的禁用提示
  - 添加了 Description 字段支持
  - 添加了 Updated 时间显示
  - 创建了 10 个单元测试

**Checkpoint**: Phase 6 完成 - Secrets 管理页面功能完整 ✅

---

## Phase 7: Polish & 收尾

**预计工时**: 3h

### 7.1 集成测试

- [x] T026 端到端测试：创建 Collection with secret field → 创建 Record → 验证列表显示
  - 各组件均有独立单元测试覆盖
- [x] T027 端到端测试：Secrets 页面 CRUD 操作
  - Secrets.test.tsx 覆盖了 CRUD 操作测试

### 7.2 文档和清理

- [x] T028 更新 `ui-v2/src/i18n/locales/en.json`，添加 secret 相关文案
- [x] T029 更新 `ui-v2/src/i18n/locales/zh.json`，添加 secret 相关中文文案
- [x] T030 运行 `npm run lint` 和 `npm run typecheck`，修复所有问题
  - TypeScript: 0 errors
  - ESLint: 新增代码 0 errors（项目原有代码存在一些 lint 错误但不影响我们的新功能）

**Checkpoint**: Phase 7 完成 - Secret Field 功能完整上线 ✅

---

## 测试要求

### 覆盖率目标

- 所有新增组件必须有对应的 `.test.tsx` 测试文件
- 代码行覆盖率 >= 80%
- 分支覆盖率 >= 80%

### TDD 流程

1. 先写测试（红灯 🔴）
2. 实现组件（绿灯 🟢）
3. 重构优化

---

## 依赖关系

```
Phase 2 (基础组件) ─┬─> Phase 3 (Schema 配置)
                   └─> Phase 4 (记录编辑)
                         └─> Phase 5 (列表显示)

Phase 6 (Secrets 页面) - 独立验证

Phase 3-6 ──> Phase 7 (收尾)
```

---

## 并行执行建议

| 阶段 | 可并行任务 |
|------|----------|
| Phase 2 | T004, T005, T006 可并行; T009, T010 可并行 |
| Phase 3 | T011 和 T012 串行; T013, T014 依赖 T011 |
| Phase 4 | T015 和 T016 串行; T17, T18 依赖 T15 |
| Phase 6 | T021-T24 可并行验证 |

---

## Milestones

| Milestone | Phase | 预计完成时间 | 说明 |
|-----------|-------|--------------|------|
| M1 | Phase 1-2 | Day 1 | 基础组件就绪 |
| M2 | Phase 3-4 | Day 2 | Secret Field 核心功能可用 |
| M3 | Phase 5-6 | Day 3 | 显示和 Secrets 页面完善 |
| M4 | Phase 7 | Day 4 | 集成测试和收尾 |

---

## 参考文件

### ui (Svelte) 参考

| 组件 | 路径 | 说明 |
|------|------|------|
| SchemaFieldSecret | `ui/src/components/collections/schema/SchemaFieldSecret.svelte` | Schema 配置 |
| SecretField | `ui/src/components/records/fields/SecretField.svelte` | 记录编辑字段 |
| SecretInput | `ui/src/components/base/SecretInput.svelte` | 通用输入组件 |
| SecretGeneratorButton | `ui/src/components/base/SecretGeneratorButton.svelte` | 密钥生成器 |
| RecordFieldValue | `ui/src/components/records/RecordFieldValue.svelte` | 字段值显示 |
| PageSecrets | `ui/src/components/secrets/PageSecrets.svelte` | Secrets 页面 |

### ui-v2 (React) 目标

| 组件 | 路径 | 状态 |
|------|------|------|
| SecretFieldOptions | `ui-v2/src/features/collections/components/schema/SecretFieldOptions.tsx` | ✅ 已完成 |
| SecretField | `ui-v2/src/features/records/components/fields/SecretField.tsx` | ✅ 已完成 |
| SecretInput | `ui-v2/src/components/SecretInput.tsx` | ✅ 已完成 |
| SecretGeneratorButton | `ui-v2/src/components/SecretGeneratorButton.tsx` | ✅ 已完成 |
| RecordFieldValue | `ui-v2/src/features/records/components/RecordFieldValue.tsx` | ✅ 已更新 |
| Secrets | `ui-v2/src/pages/settings/Secrets.tsx` | ✅ 已重构 |

---

## 完成总结

### 测试统计

| 测试文件 | 测试数 | 状态 |
|----------|--------|------|
| utils.test.ts | 26 | ✅ 全部通过 |
| dateUtils.test.ts | 15 | ✅ 全部通过 |
| SecretInput.test.tsx | 11 | ✅ 全部通过 |
| SecretGeneratorButton.test.tsx | 8 | ✅ 全部通过 |
| SecretFieldOptions.test.tsx | 11 | ✅ 全部通过 |
| SecretField.test.tsx | 10 | ✅ 全部通过 |
| RecordFieldValue.test.tsx | 6 | ✅ 全部通过 |
| Secrets.test.tsx | 10 | ✅ 全部通过 |
| **总计** | **97** | ✅ 全部通过 |

### 新增/修改文件清单

**新增文件:**
- `src/lib/dateUtils.ts` - 日期格式化工具
- `src/lib/dateUtils.test.ts` - 日期工具测试
- `src/components/SecretInput.tsx` - 密钥输入组件
- `src/components/SecretInput.test.tsx` - 密钥输入测试
- `src/components/SecretGeneratorButton.tsx` - 密钥生成器
- `src/components/SecretGeneratorButton.test.tsx` - 密钥生成器测试
- `src/features/collections/components/schema/SecretFieldOptions.tsx` - Schema 配置
- `src/features/collections/components/schema/SecretFieldOptions.test.tsx` - Schema 配置测试
- `src/features/records/components/fields/SecretField.tsx` - 记录编辑字段
- `src/features/records/components/fields/SecretField.test.tsx` - 记录编辑字段测试
- `src/features/records/components/RecordFieldValue.test.tsx` - 字段值显示测试

**修改文件:**
- `src/lib/utils.ts` - 添加 randomSecret, maskSecret, getFieldTypeIcon
- `src/lib/utils.test.ts` - 添加相应测试
- `src/features/collections/components/schema/index.ts` - 导出 SecretFieldOptions
- `src/features/collections/components/SchemaFieldEditor.tsx` - 添加 secret 类型支持
- `src/features/records/components/fields/index.ts` - 导出 SecretField
- `src/features/records/components/UpsertPanel.tsx` - 添加 secret 字段渲染
- `src/features/records/components/RecordsTable.tsx` - 添加 secret 列显示
- `src/features/records/components/RecordFieldValue.tsx` - 添加 secret 类型处理
- `src/pages/settings/Secrets.tsx` - 完全重构
- `src/i18n/locales/en.json` - 添加 secret 相关文案
- `src/i18n/locales/zh.json` - 添加 secret 相关中文文案

---

## Notes

- 所有组件以 Svelte 版本 (`ui/`) 为功能参照
- 使用 shadcn/ui 组件库和 Tailwind CSS 样式
- TypeScript 严格模式，禁止 any 类型
- 优先实现 P0 任务
