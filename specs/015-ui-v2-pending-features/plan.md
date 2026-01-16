# Implementation Plan: UI-V2 待实现功能

**Branch**: `015-ui-v2-pending-features` | **Date**: 2026-01-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-ui-v2-pending-features/spec.md`
**Parent**: `specs/014-ui-svelte-to-react/` (UI 迁移项目)

## Summary

完善 UI-V2 中所有标记为"后续实现"或"待实现"的功能模块，与 `ui/` 中的 Svelte 实现对齐。核心任务包括：Collection 字段编辑器、API 规则编辑器、关联选择器、文件上传增强、Auth 选项配置、Settings 页面完善等。

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3  
**Primary Dependencies**: 
- 现有依赖（继承自 014-ui-svelte-to-react）
- `@dnd-kit/core` + `@dnd-kit/sortable` (拖拽排序)
- `@tinymce/tinymce-react` + `tinymce` (富文本编辑器)
- `react-leaflet` + `leaflet` (地图组件)

**Build Tool**: Vite 6.x  
**Target Platform**: 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)  
**Project Type**: SPA (Single Page Application)  
**Constraints**: 功能与 Svelte 版本完全一致，不新增功能  
**Scale/Scope**: ~50 个待实现组件

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Feature Parity | ✅ PASS | 与 Svelte 版本功能对齐 |
| No API Change | ✅ PASS | 后端 API 保持不变 |
| Component Reuse | ✅ PASS | 复用现有 shadcn/ui 组件 |
| i18n Ready | ✅ PASS | 使用 i18next 支持多语言 |

## Project Structure

### Documentation (this feature)

```text
specs/015-ui-v2-pending-features/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (新增文件结构)

```text
ui-v2/src/features/collections/components/
├── CollectionFieldsTab.tsx          # 字段编辑 Tab
├── CollectionRulesTab.tsx           # 规则编辑 Tab
├── CollectionAuthOptionsTab.tsx     # Auth 选项 Tab
├── RuleField.tsx                    # 规则编辑器
├── IndexesList.tsx                  # 索引列表
├── IndexUpsertPanel.tsx             # 索引编辑面板
├── NewFieldButton.tsx               # 新增字段按钮
├── SchemaFieldEditor.tsx            # 字段编辑器容器
├── schema/                          # 字段类型选项组件
│   ├── TextFieldOptions.tsx
│   ├── NumberFieldOptions.tsx
│   ├── BoolFieldOptions.tsx
│   ├── EmailFieldOptions.tsx
│   ├── UrlFieldOptions.tsx
│   ├── EditorFieldOptions.tsx
│   ├── DateFieldOptions.tsx
│   ├── SelectFieldOptions.tsx
│   ├── JsonFieldOptions.tsx
│   ├── FileFieldOptions.tsx
│   ├── RelationFieldOptions.tsx
│   ├── PasswordFieldOptions.tsx
│   ├── AutodateFieldOptions.tsx
│   └── GeoPointFieldOptions.tsx
├── auth/                            # Auth 选项组件
│   ├── PasswordAuthAccordion.tsx
│   ├── OAuth2Accordion.tsx
│   ├── OAuth2ProviderPanel.tsx
│   ├── OTPAccordion.tsx
│   ├── MFAAccordion.tsx
│   ├── TofAuthAccordion.tsx
│   ├── TokenOptionsAccordion.tsx
│   └── EmailTemplateAccordion.tsx

ui-v2/src/features/records/components/
├── RecordsPicker.tsx                # 关联选择器
├── RecordPreviewPanel.tsx           # 记录预览面板
├── RecordFilePicker.tsx             # 文件选择器
├── RecordFileThumb.tsx              # 文件缩略图
├── fields/
│   ├── PasswordField.tsx            # 新增
│   └── GeoPointField.tsx            # 新增

ui-v2/src/pages/settings/
├── Crons.tsx                        # 完善实现
├── Secrets.tsx                      # 完善实现
├── AnalyticsSettings.tsx            # 完善实现
└── Tokens.tsx                       # 完善实现
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UI-V2 待实现功能架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Collection 编辑面板增强                            │   │
│  │                                                                       │   │
│  │  UpsertPanel.tsx (已有)                                               │   │
│  │    ├── CollectionFieldsTab.tsx (新增)                                 │   │
│  │    │     ├── SchemaFieldEditor.tsx                                    │   │
│  │    │     │     └── schema/*FieldOptions.tsx (14个)                    │   │
│  │    │     ├── NewFieldButton.tsx                                       │   │
│  │    │     └── IndexesList.tsx + IndexUpsertPanel.tsx                   │   │
│  │    ├── CollectionRulesTab.tsx (新增)                                  │   │
│  │    │     └── RuleField.tsx                                            │   │
│  │    └── CollectionAuthOptionsTab.tsx (新增)                            │   │
│  │          └── auth/*Accordion.tsx (8个)                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Record 字段组件增强                                 │   │
│  │                                                                       │   │
│  │  UpsertPanel.tsx (已有)                                               │   │
│  │    ├── RelationField.tsx (增强)                                       │   │
│  │    │     └── RecordsPicker.tsx (新增)                                 │   │
│  │    │           └── RecordPreviewPanel.tsx                             │   │
│  │    ├── FileField.tsx (增强)                                           │   │
│  │    │     └── RecordFilePicker.tsx (新增)                              │   │
│  │    │           └── RecordFileThumb.tsx                                │   │
│  │    ├── EditorField.tsx (增强 - TinyMCE)                               │   │
│  │    ├── PasswordField.tsx (新增)                                       │   │
│  │    └── GeoPointField.tsx (新增 - Leaflet)                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Settings 页面完善                                   │   │
│  │                                                                       │   │
│  │  ├── Crons.tsx (完善)                                                 │   │
│  │  ├── Secrets.tsx (完善)                                               │   │
│  │  │     └── SecretUpsertPanel.tsx                                      │   │
│  │  ├── AnalyticsSettings.tsx (完善)                                     │   │
│  │  └── Tokens.tsx (完善)                                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 字段编辑器拖拽排序

使用 `@dnd-kit` 实现字段拖拽排序：
- **@dnd-kit/core**: 核心拖拽功能
- **@dnd-kit/sortable**: 列表排序封装
- 优势：React 原生、TypeScript 友好、无障碍支持

### 2. 富文本编辑器

使用 TinyMCE 保持与 Svelte 版本一致：
- **@tinymce/tinymce-react**: React 封装
- 支持图片上传、代码块、表格
- 支持暗色模式适配

### 3. 地图组件

使用 react-leaflet 保持与 Svelte 版本一致：
- **react-leaflet**: React 封装
- **leaflet**: 地图核心库
- 支持点击选点、坐标输入

### 4. 组件复用策略

- 复用现有 shadcn/ui 组件（Dialog, Input, Select 等）
- 复用现有 OverlayPanel、CodeEditor 等自定义组件
- 新增组件遵循相同的设计模式

## Complexity Tracking

> 无违规项，架构简单清晰。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 字段编辑器复杂度 | Medium | High | 分步实现，先基础后高级 |
| TinyMCE 集成问题 | Low | Medium | 参考 Svelte 版本配置 |
| Leaflet 样式冲突 | Low | Low | 隔离 CSS 作用域 |
| 拖拽排序性能 | Low | Medium | 使用虚拟化列表 |

## Dependencies

### NPM Dependencies (新增)

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.0",
    "@tinymce/tinymce-react": "^4.3.0",
    "tinymce": "^6.8.0",
    "react-leaflet": "^4.2.0",
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.0"
  }
}
```

## Component Mapping

### Svelte → React 组件映射

| Svelte 组件 | React 组件 | 状态 |
|-------------|------------|------|
| `CollectionFieldsTab.svelte` | `CollectionFieldsTab.tsx` | 待实现 |
| `CollectionRulesTab.svelte` | `CollectionRulesTab.tsx` | 待实现 |
| `CollectionAuthOptionsTab.svelte` | `CollectionAuthOptionsTab.tsx` | 待实现 |
| `SchemaField.svelte` | `SchemaFieldEditor.tsx` | 待实现 |
| `NewField.svelte` | `NewFieldButton.tsx` | 待实现 |
| `IndexesList.svelte` | `IndexesList.tsx` | 待实现 |
| `RuleField.svelte` | `RuleField.tsx` | 待实现 |
| `RecordsPicker.svelte` | `RecordsPicker.tsx` | 待实现 |
| `RecordFilePicker.svelte` | `RecordFilePicker.tsx` | 待实现 |
| `PasswordField.svelte` | `PasswordField.tsx` | 待实现 |
| `GeoPointField.svelte` | `GeoPointField.tsx` | 待实现 |
| `TinyMCE.svelte` | 使用 `@tinymce/tinymce-react` | 待实现 |
| `Leaflet.svelte` | 使用 `react-leaflet` | 待实现 |
| `PageCrons.svelte` | `Crons.tsx` | 待完善 |
| `PageSecrets.svelte` | `Secrets.tsx` | 待完善 |
| `SecretUpsertPanel.svelte` | `SecretUpsertPanel.tsx` | 待实现 |

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Collection 字段编辑器 | 18 | 32h |
| Phase 2: Collection API 规则编辑器 | 4 | 8h |
| Phase 3: Record 字段增强 | 12 | 24h |
| Phase 4: Collection Auth 选项 | 10 | 16h |
| Phase 5: Settings 页面完善 | 8 | 12h |
| **Total** | **52** | **~92h (~2.5 weeks)** |

## Notes

- 所有组件以 Svelte 版本为参照实现
- 优先实现 P0 级别功能（字段编辑器、规则编辑器、关联选择器）
- 复用现有组件和样式，保持 UI 一致性
- 每个 Phase 完成后进行独立测试验证
