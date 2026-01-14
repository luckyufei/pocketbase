# Tasks: UI-V2 待实现功能

**Input**: Design documents from `/specs/015-ui-v2-pending-features/`
**Prerequisites**: plan.md, spec.md

**Tests**: 每个 Phase 完成后应编写对应的单元测试，覆盖率目标 80%。

**Organization**: 任务按功能模块分组，支持独立实现和测试。

## Format: `[ID] [P?] [Priority] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Priority]**: P0/P1/P2 优先级
- 包含精确文件路径

## Path Conventions

- **Source (Svelte)**: `ui/src/components/`
- **Target (React)**: `ui-v2/src/features/`

---

## Phase 1: Collection 字段编辑器 (Priority: P0) ✅ COMPLETED

**Purpose**: 实现 Collection 字段管理功能，支持所有 14 种字段类型

**Reference**: `ui/src/components/collections/CollectionFieldsTab.svelte`

### 依赖安装

- [x] T001 [P0] 安装 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### 核心组件

- [x] T002 [P0] 创建 `ui-v2/src/features/collections/components/CollectionFieldsTab.tsx`，实现字段编辑 Tab 容器
- [x] T003 [P0] 创建 `ui-v2/src/features/collections/components/NewFieldButton.tsx`，实现新增字段按钮和类型选择菜单
- [x] T004 [P0] 创建 `ui-v2/src/features/collections/components/SchemaFieldEditor.tsx`，实现字段编辑器容器（支持展开/折叠）

### 字段类型选项组件

- [x] T005 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/TextFieldOptions.tsx`
- [x] T006 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/NumberFieldOptions.tsx`
- [x] T007 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/BoolFieldOptions.tsx`
- [x] T008 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/EmailFieldOptions.tsx`
- [x] T009 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/UrlFieldOptions.tsx`
- [x] T010 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/EditorFieldOptions.tsx`
- [x] T011 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/DateFieldOptions.tsx`
- [x] T012 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/SelectFieldOptions.tsx`
- [x] T013 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/JsonFieldOptions.tsx`
- [x] T014 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/FileFieldOptions.tsx`
- [x] T015 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/RelationFieldOptions.tsx`
- [x] T016 [P] [P1] 创建 `ui-v2/src/features/collections/components/schema/PasswordFieldOptions.tsx`
- [x] T017 [P] [P0] 创建 `ui-v2/src/features/collections/components/schema/AutodateFieldOptions.tsx`
- [x] T018 [P] [P2] 创建 `ui-v2/src/features/collections/components/schema/GeoPointFieldOptions.tsx`

### 索引管理

- [x] T019 [P0] 创建 `ui-v2/src/features/collections/components/IndexesList.tsx`，实现索引列表
- [x] T020 [P0] 创建 `ui-v2/src/features/collections/components/IndexUpsertPanel.tsx`，实现索引编辑面板

### 集成

- [x] T021 [P0] 在 `UpsertPanel.tsx` 中集成 `CollectionFieldsTab`，替换占位符

### 测试

- [x] T022 [P0] 编写 `CollectionFieldsTab.test.tsx` 组件测试 (13 tests pass)

**Checkpoint**: Phase 1 完成 - 字段编辑器可用 ✅

---

## Phase 2: Collection API 规则编辑器 (Priority: P0) ✅ COMPLETED

**Purpose**: 实现 Collection API 访问规则配置

**Reference**: `ui/src/components/collections/CollectionRulesTab.svelte`

### 核心组件

- [x] T023 [P0] 创建 `ui-v2/src/features/collections/components/CollectionRulesTab.tsx`，实现规则编辑 Tab 容器
- [x] T024 [P0] 创建 `ui-v2/src/features/collections/components/RuleField.tsx`，实现单个规则编辑器（锁定/解锁/自定义）

### 集成

- [x] T025 [P0] 在 `UpsertPanel.tsx` 中集成 `CollectionRulesTab`，替换占位符
- [x] T026 [P0] 集成现有 `FilterAutocompleteInput.tsx` 到 `RuleField.tsx`

### 测试

- [x] T027 [P0] 编写 `CollectionRulesTab.test.tsx` 组件测试 (11 tests pass)

**Checkpoint**: Phase 2 完成 - API 规则编辑器可用 ✅

---

## Phase 3: Record 字段组件增强 (Priority: P0/P1) ✅ COMPLETED

**Purpose**: 完善 Record 编辑面板中的字段组件

### 关联选择器 (P0) ✅

**Reference**: `ui/src/components/records/RecordsPicker.svelte`

- [x] T028 [P0] 创建 `ui-v2/src/features/records/components/RecordsPicker.tsx`，实现关联记录选择器对话框 (17 tests pass)
- [x] T029 [P0] 创建 `ui-v2/src/features/records/components/RecordPreviewPanel.tsx`，实现记录预览面板
- [x] T030 [P0] 在 `RelationField.tsx` 中集成 `RecordsPicker`，替换 TODO 占位符

### 文件上传增强 (P0) ✅

**Reference**: `ui/src/components/records/RecordFilePicker.svelte`

- [x] T031 [P0] 创建 `ui-v2/src/features/records/components/RecordFilePicker.tsx`，实现文件选择器（拖拽上传）- 集成到 FileField
- [x] T032 [P0] 创建 `ui-v2/src/features/records/components/RecordFileThumb.tsx`，实现文件缩略图
- [x] T033 [P0] 增强 `FileField.tsx`，集成 `RecordFilePicker` (6 tests pass)

### 密码字段 (P1) ✅

**Reference**: `ui/src/components/records/fields/PasswordField.svelte`

- [x] T034 [P1] 创建 `ui-v2/src/features/records/components/fields/PasswordField.tsx`，实现密码输入（强度提示、显示/隐藏）(15 tests pass)

### 富文本编辑器 (P1) ✅

**Reference**: `ui/src/components/base/TinyMCE.svelte`

- [x] T035 [P1] 安装 `@tinymce/tinymce-react`, `tinymce`
- [x] T036 [P1] 增强 `EditorField.tsx`，集成 TinyMCE 编辑器 (8 tests pass)

### GeoPoint 字段 (P2) ✅

**Reference**: `ui/src/components/records/fields/GeoPointField.svelte`

- [x] T037 [P2] 安装 `react-leaflet`, `leaflet`, `@types/leaflet`
- [x] T038 [P2] 创建 `ui-v2/src/features/records/components/fields/GeoPointField.tsx`，实现地图选点 (12 tests pass)

### 测试

- [x] T039 [P0] 编写 `RecordsPicker.test.tsx` 组件测试 (17 tests pass)
- [x] T040 [P0] 编写 `FileField.test.tsx` 增强测试 (6 tests pass)

**Checkpoint**: Phase 3 完成 - Record 字段组件增强全部完成 ✅

---

## Phase 4: Collection Auth 选项配置 (Priority: P1) ✅ COMPLETED

**Purpose**: 实现 Auth Collection 的认证选项配置

**Reference**: `ui/src/components/collections/CollectionAuthOptionsTab.svelte`

### 核心组件

- [x] T041 [P1] 创建 `ui-v2/src/features/collections/components/CollectionAuthOptionsTab.tsx`，实现 Auth 选项 Tab 容器

### Auth 配置组件

- [x] T042 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/PasswordAuthAccordion.tsx`
- [x] T043 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/OAuth2Accordion.tsx`
- [x] T044 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/OAuth2ProviderPanel.tsx` - 集成到 OAuth2Accordion
- [x] T045 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/OTPAccordion.tsx`
- [x] T046 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/MFAAccordion.tsx`
- [x] T047 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/TofAuthAccordion.tsx` - 集成到 CollectionAuthOptionsTab
- [x] T048 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/TokenOptionsAccordion.tsx`
- [x] T049 [P] [P1] 创建 `ui-v2/src/features/collections/components/auth/EmailTemplateAccordion.tsx` - 集成到各 Accordion

### 集成

- [x] T050 [P1] 在 `UpsertPanel.tsx` 中集成 `CollectionAuthOptionsTab`，替换占位符

### 测试

- [x] T051 [P1] 编写 `CollectionAuthOptionsTab.test.tsx` 组件测试 (11 tests pass)

**Checkpoint**: Phase 4 完成 - Auth 选项配置可用 ✅

---

## Phase 5: Settings 页面完善 (Priority: P1/P2) ✅ COMPLETED

**Purpose**: 完善 Settings 模块中的待实现页面

### Cron Jobs (P1) ✅

**Reference**: `ui/src/components/settings/PageCrons.svelte`

- [x] T052 [P1] 完善 `ui-v2/src/pages/settings/Crons.tsx`，实现 Cron 任务列表
- [x] T053 [P1] 创建 `ui-v2/src/features/settings/components/CronUpsertPanel.tsx`，实现 Cron 任务编辑 - 集成到 Crons.tsx

### Secrets (P1) ✅

**Reference**: `ui/src/components/secrets/PageSecrets.svelte`

- [x] T054 [P1] 完善 `ui-v2/src/pages/settings/Secrets.tsx`，实现 Secrets 列表
- [x] T055 [P1] 创建 `ui-v2/src/features/settings/components/SecretUpsertPanel.tsx`，实现 Secret 编辑 - 集成到 Secrets.tsx

### Analytics Settings (P2) ✅

**Reference**: `ui/src/components/settings/PageAnalyticsSettings.svelte`

- [x] T056 [P2] 完善 `ui-v2/src/pages/settings/Analytics.tsx`，实现 Analytics 配置

### Tokens (P2) ✅

- [x] T057 [P2] 完善 `ui-v2/src/pages/settings/Tokens.tsx`，实现 Token 管理

### 测试

- [x] T058 [P1] 编写 Settings 页面测试 (19 tests pass)

**Checkpoint**: Phase 5 完成 - Settings 页面完善 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (字段编辑器) ────┐
                        │
Phase 2 (规则编辑器) ────┼──▶ Collection 编辑面板完整
                        │
Phase 4 (Auth 选项) ────┘

Phase 3 (Record 字段增强) ──▶ Record 编辑面板完整

Phase 5 (Settings 完善) ──▶ Settings 模块完整
```

### Parallel Opportunities

- T005-T018 (字段选项组件) 可并行
- T042-T049 (Auth 配置组件) 可并行
- Phase 3 与 Phase 1/2/4 可并行
- Phase 5 与其他 Phase 可并行

---

## Implementation Strategy

### Priority Order

1. **P0 First**: Phase 1 (字段编辑器) + Phase 2 (规则编辑器) + Phase 3 关联选择器/文件上传
2. **P1 Second**: Phase 4 (Auth 选项) + Phase 3 密码/富文本 + Phase 5 Crons/Secrets
3. **P2 Last**: Phase 3 GeoPoint + Phase 5 Analytics/Tokens

### MVP Milestones

1. **Milestone 1**: Collection 字段编辑器可用（T001-T022）
2. **Milestone 2**: API 规则编辑器可用（T023-T027）
3. **Milestone 3**: 关联选择器可用（T028-T030）
4. **Milestone 4**: 文件上传增强完成（T031-T033）
5. **Milestone 5**: Auth 选项配置完成（T041-T051）
6. **Milestone 6**: Settings 页面完善（T052-T058） ✅

---

## Estimated Effort

| Phase | Tasks | Priority | Estimated Hours | Status |
|-------|-------|----------|-----------------|--------|
| Phase 1: 字段编辑器 | 22 | P0 | 32h | ✅ COMPLETED |
| Phase 2: 规则编辑器 | 5 | P0 | 8h | ✅ COMPLETED |
| Phase 3: Record 字段增强 | 13 | P0/P1/P2 | 24h | ✅ COMPLETED |
| Phase 4: Auth 选项 | 11 | P1 | 16h | ✅ COMPLETED |
| Phase 5: Settings 完善 | 7 | P1/P2 | 12h | ✅ COMPLETED |
| **Total** | **58** | - | **~92h** | **✅ ALL DONE** |

---

## Test Summary

| Component | Tests | Status |
|-----------|-------|--------|
| RecordsPicker | 17 | ✅ Pass |
| FileField | 6 | ✅ Pass |
| PasswordField | 15 | ✅ Pass |
| EditorField | 8 | ✅ Pass |
| GeoPointField | 12 | ✅ Pass |
| CollectionAuthOptionsTab | 11 | ✅ Pass |
| Settings Pages | 19 | ✅ Pass |
| **Total** | **88** | **✅ All Pass** |

---

## Notes

- [P] 任务 = 不同文件，无依赖，可并行
- [Priority] 标签表示功能优先级 (P0 > P1 > P2)
- 所有组件以 Svelte 版本为参照实现
- 复用现有 shadcn/ui 组件和样式
- 每个 Checkpoint 后进行独立测试验证
- **功能一致性优先**: 所有实现以 Svelte 版本为参照
- **TDD 流程**: 红灯 → 绿灯 → 重构
