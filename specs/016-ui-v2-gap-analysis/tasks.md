# UI-V2 缺失功能任务清单

**创建日期**: 2026-01-13
**预计总工时**: ~128h

---

## Phase 1: 核心功能完善 (Priority: P0)

**预计工时**: 40h

### 1.1 日志模块完善 (8h) ✅

**Reference**: `ui/src/components/logs/`

- [x] T001 [P0] 创建 `ui-v2/src/features/logs/components/LogsList.tsx`，实现日志列表 (分页、过滤)
- [x] T002 [P0] 创建 `ui-v2/src/features/logs/components/LogViewPanel.tsx`，实现日志详情面板
- [x] T003 [P1] 创建 `ui-v2/src/features/logs/components/LogsSettingsPanel.tsx`，实现日志设置
- [x] T004 [P2] 创建 `ui-v2/src/features/logs/components/LogDate.tsx`，日期格式化组件
- [x] T005 [P2] 创建 `ui-v2/src/features/logs/components/LogLevel.tsx`，日志级别组件

### 1.2 Trace 监控完善 (12h) ✅

**Reference**: `ui/src/components/monitor/`

- [x] T006 [P0] 创建 `ui-v2/src/features/traces/components/TraceList.tsx`，实现 Trace 列表
- [x] T007 [P0] 创建 `ui-v2/src/features/traces/components/TraceDetail.tsx`，实现 Trace 详情面板 (15KB 复杂组件)
- [x] T008 [P1] 增强 `ui-v2/src/features/traces/components/TracesFilter.tsx`，完善过滤功能
- [x] T009 [P1] 增强 `ui-v2/src/features/traces/components/TracesStats.tsx`，完善统计功能

### 1.3 基础组件补充 (12h) ✅

**Reference**: `ui/src/components/base/`

- [x] T010 [P0] 创建 `ui-v2/src/components/Accordion.tsx`，手风琴组件 (或使用 shadcn/ui)
- [x] T011 [P0] 创建 `ui-v2/src/components/AdvancedSelect.tsx`，高级选择器
- [x] T012 [P0] 创建 `ui-v2/src/components/Toggler.tsx`，下拉切换器
- [x] T013 [P0] 创建 `ui-v2/src/components/Draggable.tsx`，可拖拽组件
- [x] T014 [P0] 创建 `ui-v2/src/components/Dragline.tsx`，拖拽线组件
- [x] T015 [P1] 创建 `ui-v2/src/components/CopyIcon.tsx`，复制按钮
- [x] T016 [P1] 创建 `ui-v2/src/components/FormattedDate.tsx`，日期格式化
- [x] T017 [P1] 创建 `ui-v2/src/components/PreviewPopup.tsx`，预览弹窗
- [x] T018 [P1] 创建 `ui-v2/src/components/TimeRangeSelector.tsx`，时间范围选择器

### 1.4 Jobs 任务队列页面 (8h) ✅

**Reference**: `ui/src/components/jobs/`

- [x] T019 [P1] 创建 `ui-v2/src/pages/settings/Jobs.tsx`，任务队列页面
- [x] T020 [P1] 创建 `ui-v2/src/features/jobs/components/JobsList.tsx`，任务列表
- [x] T021 [P1] 创建 `ui-v2/src/features/jobs/components/JobsFilters.tsx`，任务过滤器
- [x] T022 [P1] 创建 `ui-v2/src/features/jobs/components/JobsStats.tsx`，任务统计
- [x] T023 [P1] 创建 `ui-v2/src/features/jobs/hooks/useJobs.ts`，任务 hook
- [x] T024 [P1] 添加 `/settings/jobs` 路由

**Checkpoint**: Phase 1 完成 - 核心功能可用

---

## Phase 2: API 文档面板 (Priority: P1) ✅

**预计工时**: 32h

### 2.1 文档面板容器 (4h) ✅

**Reference**: `ui/src/components/collections/CollectionDocsPanel.svelte`

- [x] T025 [P1] 创建 `ui-v2/src/features/collections/components/docs/CollectionDocsPanel.tsx`，API 文档面板容器
- [x] T026 [P1] 创建 `ui-v2/src/features/collections/components/docs/SdkTabs.tsx`，SDK 标签页

### 2.2 CRUD API 文档 (10h) ✅

**Reference**: `ui/src/components/collections/docs/`

- [x] T027 [P1] 创建 `docs/ListApiDocs.tsx`，列表 API 文档
- [x] T028 [P1] 创建 `docs/ViewApiDocs.tsx`，详情 API 文档
- [x] T029 [P1] 创建 `docs/CreateApiDocs.tsx`，创建 API 文档
- [x] T030 [P1] 创建 `docs/UpdateApiDocs.tsx`，更新 API 文档
- [x] T031 [P1] 创建 `docs/DeleteApiDocs.tsx`，删除 API 文档

### 2.3 Auth API 文档 (12h) ✅

- [x] T032 [P1] 创建 `docs/AuthWithPasswordDocs.tsx`，密码认证文档
- [x] T033 [P1] 创建 `docs/AuthWithOAuth2Docs.tsx`，OAuth2 认证文档
- [x] T034 [P1] 创建 `docs/AuthWithOtpDocs.tsx`，OTP 认证文档
- [x] T035 [P1] 创建 `docs/AuthMethodsDocs.tsx`，认证方法文档
- [x] T036 [P1] 创建 `docs/AuthRefreshDocs.tsx`，Token 刷新文档
- [x] T037 [P1] 创建 `docs/PasswordResetDocs.tsx`，密码重置文档
- [x] T038 [P1] 创建 `docs/EmailChangeDocs.tsx`，邮箱变更文档
- [x] T039 [P1] 创建 `docs/VerificationDocs.tsx`，邮箱验证文档

### 2.4 其他 API 文档 (6h) ✅

- [x] T040 [P1] 创建 `docs/RealtimeApiDocs.tsx`，实时 API 文档
- [x] T041 [P1] 创建 `docs/BatchApiDocs.tsx`，批量 API 文档
- [x] T042 [P1] 创建 `docs/FilterSyntax.tsx`，过滤语法文档
- [x] T043 [P1] 创建 `docs/FieldsQueryParam.tsx`，字段查询参数文档

**Checkpoint**: Phase 2 完成 - API 文档面板可用

---

## Phase 3: OAuth2 增强 (Priority: P1) ✅

**预计工时**: 16h

### 3.1 OAuth2 面板 (4h) ✅

**Reference**: `ui/src/components/collections/OAuth2*.svelte`

- [x] T044 [P1] 创建 `ui-v2/src/features/collections/components/auth/OAuth2ProvidersListPanel.tsx`，提供商列表面板
- [x] T045 [P1] 创建 `ui-v2/src/features/collections/components/auth/OAuth2ProviderPanel.tsx`，提供商配置面板

### 3.2 Provider 配置组件 (12h)

**Reference**: `ui/src/components/collections/providers/`

- [x] T046 [P1] 创建 `providers/AppleOptions.tsx`，Apple 登录配置
- [x] T047 [P1] 创建 `providers/AppleSecretPopup.tsx`，Apple Secret 生成弹窗
- [x] T048 [P1] 创建 `providers/LarkOptions.tsx`，飞书登录配置
- [x] T049 [P1] 创建 `providers/MicrosoftOptions.tsx`，Microsoft 登录配置
- [x] T050 [P1] 创建 `providers/OIDCOptions.tsx`，OIDC 通用配置
- [x] T051 [P1] 创建 `providers/SelfHostedOptions.tsx`，自托管配置
- [x] T052 [P1] 创建 `ui-v2/src/lib/providers.ts`，OAuth2 提供商配置列表

**Checkpoint**: Phase 3 完成 - OAuth2 配置完整

---

## Phase 4: 认证页面 (Priority: P1) ✅

**预计工时**: 16h

### 4.1 超级用户密码重置 (4h) ✅

**Reference**: `ui/src/components/superusers/`

- [x] T053 [P1] 创建 `ui-v2/src/pages/RequestPasswordReset.tsx`，请求密码重置页面
- [x] T054 [P1] 创建 `ui-v2/src/pages/ConfirmPasswordReset.tsx`，确认密码重置页面
- [x] T055 [P1] 添加 `/request-password-reset` 和 `/confirm-password-reset/:token` 路由

### 4.2 用户邮箱确认页面 (8h) ✅

**Reference**: `ui/src/components/records/PageRecord*.svelte`

- [x] T056 [P1] 创建 `ui-v2/src/pages/auth/ConfirmPasswordReset.tsx`，用户密码重置确认
- [x] T057 [P1] 创建 `ui-v2/src/pages/auth/ConfirmVerification.tsx`，用户邮箱验证确认
- [x] T058 [P1] 创建 `ui-v2/src/pages/auth/ConfirmEmailChange.tsx`，用户邮箱变更确认
- [x] T059 [P1] 添加 `/auth/confirm-*` 路由

### 4.3 OAuth2 重定向页面 (4h) ✅

**Reference**: `ui/src/components/records/PageOAuth2*.svelte`

- [x] T060 [P2] 创建 `ui-v2/src/pages/auth/OAuth2RedirectSuccess.tsx`，OAuth2 成功跳转
- [x] T061 [P2] 创建 `ui-v2/src/pages/auth/OAuth2RedirectFailure.tsx`，OAuth2 失败跳转
- [x] T062 [P2] 添加 `/auth/oauth2-redirect-*` 路由

**Checkpoint**: Phase 4 完成 - 认证流程完整

---

## Phase 5: 设置组件增强 (Priority: P1) ✅

**预计工时**: 16h

### 5.1 备份增强 (4h) ✅

**Reference**: `ui/src/components/settings/Backup*.svelte`

- [x] T063 [P1] 创建 `ui-v2/src/features/settings/components/BackupRestorePanel.tsx`，备份恢复面板
- [x] T064 [P2] 创建 `ui-v2/src/features/settings/components/BackupUploadButton.tsx`，备份上传按钮

### 5.2 邮件增强 (4h) ✅

**Reference**: `ui/src/components/settings/EmailTestPopup.svelte`

- [x] T065 [P1] 创建 `ui-v2/src/features/settings/components/EmailTestPopup.tsx`，邮件测试弹窗

### 5.3 应用设置增强 (8h) ✅

**Reference**: `ui/src/components/settings/`

- [x] T066 [P1] 创建 `ui-v2/src/features/settings/components/RateLimitAccordion.tsx`，速率限制配置
- [x] T067 [P2] 创建 `ui-v2/src/features/settings/components/TrustedProxyAccordion.tsx`，可信代理配置
- [x] T068 [P2] 创建 `ui-v2/src/features/settings/components/BatchAccordion.tsx`，批量操作配置

**Checkpoint**: Phase 5 完成 - 设置功能完整

---

## Phase 6: 记录组件增强 (Priority: P1) ✅

**预计工时**: 16h

### 6.1 记录展示组件 (8h) ✅

**Reference**: `ui/src/components/records/`

- [x] T069 [P1] 创建 `ui-v2/src/features/records/components/RecordInfo.tsx`，记录信息展示
- [x] T070 [P1] 创建 `ui-v2/src/features/records/components/RecordFieldValue.tsx`，字段值展示
- [x] T071 [P1] 创建 `ui-v2/src/features/records/components/RecordsCount.tsx`，记录计数

### 6.2 认证相关组件 (8h) ✅

**Reference**: `ui/src/components/records/`

- [x] T072 [P1] 创建 `ui-v2/src/features/records/components/ExternalAuthsList.tsx`，外部认证列表
- [x] T073 [P1] 创建 `ui-v2/src/features/records/components/ImpersonatePopup.tsx`，模拟登录弹窗
- [x] T074 [P1] 创建 `ui-v2/src/features/records/components/fields/AuthFields.tsx`，认证字段组
- [x] T075 [P1] 创建 `ui-v2/src/features/records/components/fields/FieldLabel.tsx`，字段标签

**Checkpoint**: Phase 6 完成 - 记录管理完整

---

## Phase 7: 集合组件增强 (Priority: P1) ✅

**预计工时**: 12h

### 7.1 集合管理增强 (8h) ✅

**Reference**: `ui/src/components/collections/`

- [x] T076 [P1] 创建 `ui-v2/src/features/collections/components/CollectionQueryTab.tsx`，查询标签页
- [x] T077 [P1] 创建 `ui-v2/src/features/collections/components/CollectionsDiffTable.tsx`，集合差异对比表
- [x] T078 [P1] 创建 `ui-v2/src/features/collections/components/CollectionUpdateConfirm.tsx`，更新确认对话框

### 7.2 Auth 配置增强 (4h) ✅

- [x] T079 [P1] 创建 `ui-v2/src/features/collections/components/auth/EmailTemplateAccordion.tsx`，邮件模板配置
- [x] T080 [P1] 创建 `ui-v2/src/features/collections/components/auth/TofAuthAccordion.tsx`，TOF 认证配置
- [x] T081 [P1] 创建 `ui-v2/src/features/collections/components/TokenField.tsx`，Token 字段

**Checkpoint**: Phase 7 完成 - 集合管理完整

---

## Phase 8: 监控增强 (Priority: P2) ✅

**预计工时**: 8h

### 8.1 系统监控增强 (4h) ✅

**Reference**: `ui/src/components/monitoring/`

- [x] T082 [P1] 创建 `ui-v2/src/features/monitoring/components/MetricsCard.tsx`，指标卡片
- [x] T083 [P2] 创建 `ui-v2/src/features/monitoring/components/ServerlessMetrics.tsx`，Serverless 指标

### 8.2 Analytics 增强 (4h) ✅

**Reference**: `ui/src/components/analytics/`

- [x] T084 [P1] 创建 `ui-v2/src/features/analytics/components/AnalyticsCard.tsx`，分析卡片
- [x] T085 [P1] 创建 `ui-v2/src/features/analytics/components/TopList.tsx`，Top 列表

**Checkpoint**: Phase 8 完成 - 监控分析完整

---

## Phase 9: 工具函数迁移 (Priority: P2) ✅

**预计工时**: 8h

### 9.1 工具函数 (4h) ✅

**Reference**: `ui/src/utils/`, `ui/src/`

- [x] T086 [P1] 增强 `ui-v2/src/lib/utils.ts`，迁移 CommonHelper 常用函数
- [x] T087 [P1] 创建 `ui-v2/src/lib/mimes.ts`，MIME 类型定义
- [x] T088 [P1] 创建 `ui-v2/src/lib/providers.ts`，OAuth2 提供商配置

### 9.2 Hooks 增强 (4h)

- [x] T089 [P1] 创建 `ui-v2/src/hooks/useScrollEnd.ts`，滚动到底部检测
- [x] T090 [P2] 创建 `ui-v2/src/hooks/useAutocomplete.ts`，自动补全 hook

**Checkpoint**: Phase 9 完成 - 工具函数完整

---

## Phase 10: 安装引导 (Priority: P2) ✅

**预计工时**: 4h

**Reference**: `ui/src/components/base/PageInstaller.svelte`

- [x] T091 [P2] 创建 `ui-v2/src/pages/Installer.tsx`，安装引导页面
- [x] T092 [P2] 添加 `/pbinstall/:token` 路由

**Checkpoint**: Phase 10 完成 - 安装流程完整

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

## Milestones

| Milestone | Phase | 预计完成时间 | 说明 |
|-----------|-------|--------------|------|
| M1 | Phase 1 | Week 1 | 核心功能可用 |
| M2 | Phase 2-3 | Week 2 | API 文档 + OAuth2 |
| M3 | Phase 4-5 | Week 3 | 认证 + 设置 |
| M4 | Phase 6-10 | Week 4 | 完善 + 收尾 |

---

## 依赖关系

```
Phase 1 (核心) ─┬─> Phase 2 (API 文档)
               ├─> Phase 6 (记录增强)
               └─> Phase 8 (监控增强)

Phase 3 (OAuth2) ──> Phase 4 (认证页面)

Phase 5 (设置) ──> Phase 7 (集合增强)

Phase 9 (工具) ──> Phase 10 (安装)
```

---

## Notes

- 所有组件以 Svelte 版本为参照实现
- 复用现有 shadcn/ui 组件和样式
- 优先实现 P0/P1 任务
- P2 任务可根据需求延后
