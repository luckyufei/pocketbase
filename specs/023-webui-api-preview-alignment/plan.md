# Implementation Plan: WebUI API Preview 功能 1:1 对齐

**Feature Branch**: `023-webui-api-preview-alignment`  
**Created**: 2026-02-05  
**Spec**: [spec.md](./spec.md)

---

## 1. Overview

本计划旨在将 WebUI (React) 的 API Preview 功能与 UI (Svelte) 版本进行 1:1 对齐，主要包括：

1. **SDK 选项卡对齐** - 只显示 JavaScript + Dart，添加偏好存储和 SDK 链接
2. **文案英文化** - 将所有中文文案改为英文
3. **Auth Tab 禁用逻辑** - 根据 Auth 配置动态禁用对应 Tab
4. **响应示例 Tab 切换** - 改为 Tab 方式展示不同状态码响应
5. **代码语法高亮** - 集成 Prism.js 实现语法高亮

---

## 2. Implementation Phases

### Phase 1: 基础设施 (Infrastructure)

**目标**: 添加必要的依赖和基础组件

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| P1-T1 | 添加 Prism.js 依赖 | `package.json` | P0 |
| P1-T2 | 重构 CodeBlock 组件支持语法高亮 | `CodeBlock.tsx` | P0 |
| P1-T3 | 创建 ResponseTabs 组件 | `ResponseTabs.tsx` | P1 |

**验收标准**:
- [ ] `npm install` 成功
- [ ] CodeBlock 组件支持 javascript/dart/json 语法高亮
- [ ] ResponseTabs 组件可正常切换状态码

---

### Phase 2: SDK 选项卡对齐 (SDK Tabs Alignment)

**目标**: 将 SdkTabs 组件与 UI 版本对齐

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| P2-T1 | 移除 cURL 选项，只保留 JavaScript + Dart | `SdkTabs.tsx` | P0 |
| P2-T2 | 添加 SDK 偏好存储到 localStorage | `SdkTabs.tsx` | P0 |
| P2-T3 | 添加 SDK 文档链接 | `SdkTabs.tsx` | P0 |
| P2-T4 | 更新所有使用 SdkTabs 的组件移除 curl 参数 | 所有 *Docs.tsx | P0 |

**验收标准**:
- [ ] SdkTabs 只显示 JavaScript 和 Dart
- [ ] 切换 Tab 后刷新页面仍保持选择
- [ ] 底部显示 SDK 文档链接

---

### Phase 3: Auth Tab 禁用逻辑 (Auth Tab Disable Logic)

**目标**: 根据 Auth 配置动态禁用对应 Tab

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| P3-T1 | 修改 Collection 类型定义支持 Auth 配置 | `apiDocsUtils.ts` 或类型文件 | P0 |
| P3-T2 | 修改 getCollectionTabs 支持禁用逻辑 | `apiDocsUtils.ts` | P0 |
| P3-T3 | CollectionDocsPanel 传递完整 collection 对象 | `CollectionDocsPanel.tsx` | P0 |
| P3-T4 | 禁用 Tab 添加 tooltip 提示 | `CollectionDocsPanel.tsx` | P0 |

**验收标准**:
- [ ] passwordAuth 未启用时 "Auth with password" Tab 禁用
- [ ] oauth2 未启用时 "Auth with OAuth2" Tab 禁用
- [ ] otp 未启用时 "Auth with OTP" Tab 禁用
- [ ] 禁用 Tab 悬停显示 tooltip

---

### Phase 4: 文案英文化 (Text Localization)

**目标**: 将所有中文文案改为英文

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| P4-T1 | ListApiDocs 文案英文化 | `ListApiDocs.tsx` | P0 |
| P4-T2 | ViewApiDocs 文案英文化 | `ViewApiDocs.tsx` | P0 |
| P4-T3 | CreateApiDocs 文案英文化 | `CreateApiDocs.tsx` | P0 |
| P4-T4 | UpdateApiDocs 文案英文化 | `UpdateApiDocs.tsx` | P0 |
| P4-T5 | DeleteApiDocs 文案英文化 | `DeleteApiDocs.tsx` | P0 |
| P4-T6 | RealtimeApiDocs 文案英文化 | `RealtimeApiDocs.tsx` | P0 |
| P4-T7 | BatchApiDocs 文案英文化 | `BatchApiDocs.tsx` | P0 |
| P4-T8 | Auth 相关 Docs 文案英文化 (8个文件) | `Auth*Docs.tsx`, `*Docs.tsx` | P0 |
| P4-T9 | FilterSyntax 文案英文化 | `FilterSyntax.tsx` | P0 |
| P4-T10 | FieldsQueryParam 文案英文化 | `FieldsQueryParam.tsx` | P0 |
| P4-T11 | apiDocsUtils FILTER_OPERATORS 英文化 | `apiDocsUtils.ts` | P0 |
| P4-T12 | CollectionDocsPanel 文案英文化 | `CollectionDocsPanel.tsx` | P0 |

**验收标准**:
- [ ] 所有文档组件无中文
- [ ] 文案与 UI 版本一致

---

### Phase 5: 响应示例优化 (Response Examples)

**目标**: 改进响应示例展示方式

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| P5-T1 | 创建 ResponseTabs 组件 (如 Phase 1 未完成) | `ResponseTabs.tsx` | P1 |
| P5-T2 | ListApiDocs 使用 ResponseTabs | `ListApiDocs.tsx` | P1 |
| P5-T3 | 其他 Docs 组件使用 ResponseTabs | 所有 *Docs.tsx | P1 |

**验收标准**:
- [ ] 响应示例使用 Tab 切换
- [ ] 默认显示 200 响应

---

### Phase 6: 字段列表显示 (Field List Display)

**目标**: 在 sort/filter 参数说明中显示支持的字段列表

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| P6-T1 | ListApiDocs sort 参数添加字段列表 | `ListApiDocs.tsx` | P1 |
| P6-T2 | FilterSyntax 添加字段列表 | `FilterSyntax.tsx` | P1 |
| P6-T3 | 创建 getAllCollectionIdentifiers 工具函数 | `apiDocsUtils.ts` | P1 |

**验收标准**:
- [ ] sort 参数显示 @random, @rowid 及所有字段
- [ ] FilterSyntax 显示 @collection.*, @request.* 及所有字段

---

### Phase 7: 测试 (Testing)

**目标**: 确保功能正确性和测试覆盖率

| Task | Description | Files | Priority |
|------|-------------|-------|---------|
| P7-T1 | apiDocsUtils 单元测试 | `apiDocsUtils.test.ts` | P0 |
| P7-T2 | SdkTabs 单元测试 | `SdkTabs.test.tsx` | P0 |
| P7-T3 | 验证无中文文案 | grep 验证 | P0 |

> **注意**: ResponseTabs 为简单 UI 组件，不需要单测
**验收标准**:
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 所有测试通过

---

## 3. Dependencies Graph

```
Phase 1 (基础设施)
    │
    ├──→ Phase 2 (SDK 选项卡)
    │
    ├──→ Phase 3 (Auth Tab 禁用)
    │
    └──→ Phase 5 (响应示例)
    
Phase 4 (文案英文化) ──→ 可并行执行

Phase 6 (字段列表) ──→ 依赖 Phase 4

Phase 7 (测试) ──→ 依赖 Phase 1-6
```

---

## 4. Estimated Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 3 tasks | 2 hours |
| Phase 2 | 4 tasks | 1.5 hours |
| Phase 3 | 4 tasks | 2 hours |
| Phase 4 | 12 tasks | 4 hours |
| Phase 5 | 3 tasks | 1.5 hours |
| Phase 6 | 3 tasks | 1 hour |
| Phase 7 | 3 tasks | 1.5 hours |
| **Total** | **32 tasks** | **~13.5 hours** |

---

## 5. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Prism.js 包体积大 | 按需导入语言包，使用 dynamic import |
| 文案修改遗漏 | 使用 `grep -r "[\u4e00-\u9fa5]"` 检查中文 |
| 测试覆盖不足 | 优先测试核心逻辑（SDK 偏好、Tab 禁用） |

---

## 6. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| SDK 选项对齐 | 100% | 视觉对比 |
| 文案英文化 | 100% | grep 中文字符 = 0 |
| Auth Tab 禁用 | 100% | 功能测试 |
| 测试覆盖率 | ≥ 80% | Jest coverage report |
| 无回归 | 0 bugs | E2E 测试通过 |
