# UI-V2 功能差异分析报告

**生成日期**: 2026-01-13
**对比版本**: `ui` (Svelte) vs `ui-v2` (React)

---

## 概述

本文档详细对比 PocketBase 原版 Svelte UI (`ui/`) 与新版 React UI (`ui-v2/`) 的功能差异，列出 `ui-v2` 中尚未实现的功能模块。

### 统计摘要

| 类别 | ui (Svelte) | ui-v2 (React) | 缺失数量 |
|------|-------------|---------------|----------|
| 页面/路由 | 22 | 15 | **7** |
| 基础组件 | 40+ | 17 | **23+** |
| 集合管理组件 | 45+ | 45 | **~0** (基本完成) |
| 记录管理组件 | 20+ | 15+ | **5+** |
| 设置页面 | 10 | 10 | **0** (已完成) |
| 日志组件 | 8 | 3 | **5** |
| 监控组件 | 10 | 3 | **7** |
| API 文档组件 | 25 | 0 | **25** |
| OAuth2 Provider 组件 | 6 | 0 | **6** |
| 工具/辅助 | 5+ | 3 | **2+** |

---

## 一、缺失的页面/路由

### 1.1 认证相关页面 (P0)

| 页面 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| 请求密码重置 | `superusers/PageSuperuserRequestPasswordReset.svelte` | 超级用户忘记密码 | P0 |
| 确认密码重置 | `superusers/PageSuperuserConfirmPasswordReset.svelte` | 超级用户密码重置确认 | P0 |
| 安装页面 | `base/PageInstaller.svelte` | 首次安装引导 | P1 |

### 1.2 Records 邮件确认页面 (P1)

| 页面 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| 确认密码重置 | `records/PageRecordConfirmPasswordReset.svelte` | 用户密码重置确认 | P1 |
| 确认邮箱验证 | `records/PageRecordConfirmVerification.svelte` | 用户邮箱验证确认 | P1 |
| 确认邮箱变更 | `records/PageRecordConfirmEmailChange.svelte` | 用户邮箱变更确认 | P1 |
| OAuth2 成功 | `records/PageOAuth2RedirectSuccess.svelte` | OAuth2 登录成功跳转 | P2 |
| OAuth2 失败 | `records/PageOAuth2RedirectFailure.svelte` | OAuth2 登录失败跳转 | P2 |

### 1.3 Settings 子页面 (P1)

| 页面 | ui 路径 | ui-v2 状态 | 说明 |
|------|---------|------------|------|
| Jobs | `jobs/PageJobs.svelte` | ❌ 缺失 | 任务队列管理 |

---

## 二、缺失的基础组件 (components/base/)

### 2.1 核心 UI 组件 (P0)

| 组件 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| Accordion | `base/Accordion.svelte` | 手风琴/折叠面板 | P0 |
| Select | `base/Select.svelte` | 高级选择器 (10.6KB) | P0 |
| Toggler | `base/Toggler.svelte` | 下拉切换器 | P0 |
| Draggable | `base/Draggable.svelte` | 可拖拽组件 | P0 |
| Dragline | `base/Dragline.svelte` | 拖拽线 | P0 |

### 2.2 表单组件 (P1)

| 组件 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| Field | `base/Field.svelte` | 表单字段包装器 | P1 |
| AutoExpandTextarea | `base/AutoExpandTextarea.svelte` | 自动扩展文本域 | P1 |
| DynamicOptionsSelect | `base/DynamicOptionsSelect.svelte` | 动态选项选择器 | P1 |
| ObjectSelect | `base/ObjectSelect.svelte` | 对象选择器 | P1 |
| RedactedPasswordInput | `base/RedactedPasswordInput.svelte` | 遮罩密码输入 | P1 |
| SecretGeneratorButton | `base/SecretGeneratorButton.svelte` | 密钥生成按钮 | P1 |
| MultipleValueInput | `base/MultipleValueInput.svelte` | 多值输入 | P1 |

### 2.3 展示组件 (P1)

| 组件 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| CodeBlock | `base/CodeBlock.svelte` | 代码块展示 | P1 |
| CopyIcon | `base/CopyIcon.svelte` | 复制图标按钮 | P1 |
| FormattedDate | `base/FormattedDate.svelte` | 格式化日期 | P1 |
| InitialsAvatar | `base/InitialsAvatar.svelte` | 首字母头像 | P1 |
| DatabaseTypeIndicator | `base/DatabaseTypeIndicator.svelte` | 数据库类型指示器 | P2 |
| PreviewPopup | `base/PreviewPopup.svelte` | 预览弹窗 | P1 |
| UploadedFilePreview | `base/UploadedFilePreview.svelte` | 上传文件预览 | P1 |

### 2.4 布局组件 (P2)

| 组件 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| FullPage | `base/FullPage.svelte` | 全页布局 | P2 |
| PageSidebar | `base/PageSidebar.svelte` | 页面侧边栏 | P2 |
| Scroller | `base/Scroller.svelte` | 滚动容器 | P2 |
| RefreshButton | `base/RefreshButton.svelte` | 刷新按钮 | P2 |
| SortHeader | `base/SortHeader.svelte` | 排序表头 | P2 |
| TimeRangeSelector | `base/TimeRangeSelector.svelte` | 时间范围选择器 | P1 |

### 2.5 其他组件 (P2)

| 组件 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| SdkTabs | `base/SdkTabs.svelte` | SDK 标签页 | P2 |
| AutocompleteInput | `base/AutocompleteInput.svelte` | 自动补全输入框 | P2 |

---

## 三、缺失的集合管理组件 (collections/)

### 3.1 API 文档组件 (P1) - 25 个

`ui-v2` 完全缺失 API 文档面板功能。

| 组件 | 说明 |
|------|------|
| `CollectionDocsPanel.svelte` | API 文档面板容器 |
| `docs/ListApiDocs.svelte` | 列表 API 文档 |
| `docs/ViewApiDocs.svelte` | 详情 API 文档 |
| `docs/CreateApiDocs.svelte` | 创建 API 文档 |
| `docs/UpdateApiDocs.svelte` | 更新 API 文档 |
| `docs/DeleteApiDocs.svelte` | 删除 API 文档 |
| `docs/AuthWithPasswordDocs.svelte` | 密码认证文档 |
| `docs/AuthWithOAuth2Docs.svelte` | OAuth2 认证文档 |
| `docs/AuthWithOtpDocs.svelte` | OTP 认证文档 |
| `docs/AuthWithOtpApiRequestDocs.svelte` | OTP 请求文档 |
| `docs/AuthWithOtpApiAuthDocs.svelte` | OTP 验证文档 |
| `docs/AuthMethodsDocs.svelte` | 认证方法文档 |
| `docs/AuthRefreshDocs.svelte` | Token 刷新文档 |
| `docs/PasswordResetDocs.svelte` | 密码重置文档 |
| `docs/PasswordResetApiRequestDocs.svelte` | 密码重置请求文档 |
| `docs/PasswordResetApiConfirmDocs.svelte` | 密码重置确认文档 |
| `docs/EmailChangeDocs.svelte` | 邮箱变更文档 |
| `docs/EmailChangeApiRequestDocs.svelte` | 邮箱变更请求文档 |
| `docs/EmailChangeApiConfirmDocs.svelte` | 邮箱变更确认文档 |
| `docs/VerificationDocs.svelte` | 邮箱验证文档 |
| `docs/VerificationApiRequestDocs.svelte` | 验证请求文档 |
| `docs/VerificationApiConfirmDocs.svelte` | 验证确认文档 |
| `docs/RealtimeApiDocs.svelte` | 实时 API 文档 |
| `docs/BatchApiDocs.svelte` | 批量 API 文档 |
| `docs/FilterSyntax.svelte` | 过滤语法文档 |
| `docs/FieldsQueryParam.svelte` | 字段查询参数文档 |

### 3.2 OAuth2 Provider 组件 (P1) - 6 个

| 组件 | 说明 |
|------|------|
| `providers/AppleOptions.svelte` | Apple 登录配置 |
| `providers/AppleSecretPopup.svelte` | Apple Secret 生成弹窗 |
| `providers/LarkOptions.svelte` | 飞书登录配置 |
| `providers/MicrosoftOptions.svelte` | Microsoft 登录配置 |
| `providers/OIDCOptions.svelte` | OIDC 通用配置 |
| `providers/SelfHostedOptions.svelte` | 自托管配置 |

### 3.3 其他集合组件 (P1)

| 组件 | ui 路径 | 说明 | ui-v2 状态 |
|------|---------|------|------------|
| CollectionQueryTab | `CollectionQueryTab.svelte` | 查询标签页 | ❌ 缺失 |
| CollectionsDiffTable | `CollectionsDiffTable.svelte` | 集合差异对比表 | ❌ 缺失 |
| CollectionUpdateConfirm | `CollectionUpdateConfirm.svelte` | 更新确认对话框 | ❌ 缺失 |
| OAuth2ProvidersListPanel | `OAuth2ProvidersListPanel.svelte` | OAuth2 提供商列表面板 | ❌ 缺失 |
| OAuth2ProviderPanel | `OAuth2ProviderPanel.svelte` | OAuth2 提供商配置面板 | ❌ 缺失 |
| EmailTemplateAccordion | `EmailTemplateAccordion.svelte` | 邮件模板配置 | ❌ 缺失 |
| TofAuthAccordion | `TofAuthAccordion.svelte` | TOF 认证配置 | ❌ 缺失 |
| TokenField | `TokenField.svelte` | Token 字段 | ❌ 缺失 |

---

## 四、缺失的记录管理组件 (records/)

### 4.1 核心组件 (P0)

| 组件 | ui 路径 | 说明 | ui-v2 状态 |
|------|---------|------|------------|
| RecordsList | `RecordsList.svelte` | 记录列表 (带分页) | ⚠️ 部分实现 (RecordsTable) |
| RecordInfo | `RecordInfo.svelte` | 记录信息展示 | ❌ 缺失 |
| RecordInfoContent | `RecordInfoContent.svelte` | 记录信息内容 | ❌ 缺失 |
| RecordFieldValue | `RecordFieldValue.svelte` | 字段值展示 | ❌ 缺失 |
| RecordFilePicker | `RecordFilePicker.svelte` | 文件选择器 | ⚠️ 集成到 FileField |
| RecordsCount | `RecordsCount.svelte` | 记录计数 | ❌ 缺失 |

### 4.2 认证相关组件 (P1)

| 组件 | ui 路径 | 说明 | ui-v2 状态 |
|------|---------|------|------------|
| ExternalAuthsList | `ExternalAuthsList.svelte` | 外部认证列表 | ❌ 缺失 |
| ImpersonatePopup | `ImpersonatePopup.svelte` | 模拟登录弹窗 | ❌ 缺失 |
| AuthFields | `fields/AuthFields.svelte` | 认证字段组 | ❌ 缺失 |
| FieldLabel | `fields/FieldLabel.svelte` | 字段标签 | ❌ 缺失 |

### 4.3 其他组件 (P2)

| 组件 | ui 路径 | 说明 | ui-v2 状态 |
|------|---------|------|------------|
| AutodateIcon | `AutodateIcon.svelte` | 自动日期图标 | ❌ 缺失 |

---

## 五、缺失的日志组件 (logs/)

| 组件 | ui 路径 | 说明 | ui-v2 状态 | 优先级 |
|------|---------|------|------------|--------|
| LogsList | `LogsList.svelte` | 日志列表 (13.5KB) | ❌ 缺失 | P0 |
| LogViewPanel | `LogViewPanel.svelte` | 日志详情面板 | ❌ 缺失 | P0 |
| LogsSettingsPanel | `LogsSettingsPanel.svelte` | 日志设置面板 | ❌ 缺失 | P1 |
| LogDate | `LogDate.svelte` | 日志日期 | ❌ 缺失 | P2 |
| LogLevel | `LogLevel.svelte` | 日志级别 | ❌ 缺失 | P2 |
| LogsLevelsInfo | `LogsLevelsInfo.svelte` | 日志级别信息 | ❌ 缺失 | P2 |

---

## 六、缺失的监控组件 (monitor/ + monitoring/)

### 6.1 Trace 监控 (monitor/)

| 组件 | ui 路径 | 说明 | ui-v2 状态 | 优先级 |
|------|---------|------|------------|--------|
| TraceList | `TraceList.svelte` | Trace 列表 | ❌ 缺失 | P0 |
| TraceDetail | `TraceDetail.svelte` | Trace 详情 (15.3KB) | ❌ 缺失 | P0 |
| TraceFilters | `TraceFilters.svelte` | Trace 过滤器 | ⚠️ 部分实现 | P1 |
| TraceStats | `TraceStats.svelte` | Trace 统计 | ⚠️ 部分实现 | P1 |

### 6.2 系统监控 (monitoring/)

| 组件 | ui 路径 | 说明 | ui-v2 状态 | 优先级 |
|------|---------|------|------------|--------|
| MetricsCard | `MetricsCard.svelte` | 指标卡片 | ❌ 缺失 | P1 |
| ServerlessMetrics | `ServerlessMetrics.svelte` | Serverless 指标 (13.3KB) | ❌ 缺失 | P2 |
| TimeRangeSelector | `TimeRangeSelector.svelte` | 时间范围选择器 | ❌ 缺失 | P1 |

---

## 七、缺失的 Jobs 模块 (jobs/)

| 组件 | ui 路径 | 说明 | 优先级 |
|------|---------|------|--------|
| PageJobs | `PageJobs.svelte` | 任务队列页面 (10.9KB) | P1 |
| JobsFilters | `JobsFilters.svelte` | 任务过滤器 | P1 |
| JobsStats | `JobsStats.svelte` | 任务统计 | P1 |

---

## 八、缺失的 Analytics 组件 (analytics/)

| 组件 | ui 路径 | 说明 | ui-v2 状态 | 优先级 |
|------|---------|------|------------|--------|
| AnalyticsCard | `AnalyticsCard.svelte` | 分析卡片 | ❌ 缺失 | P1 |
| TopList | `TopList.svelte` | Top 列表 | ❌ 缺失 | P1 |

---

## 九、缺失的设置组件 (settings/)

| 组件 | ui 路径 | 说明 | ui-v2 状态 | 优先级 |
|------|---------|------|------------|--------|
| SettingsSidebar | `SettingsSidebar.svelte` | 设置侧边栏 | ⚠️ 集成到 Layout | - |
| BackupsList | `BackupsList.svelte` | 备份列表 | ⚠️ 集成到 Backups | - |
| BackupCreatePanel | `BackupCreatePanel.svelte` | 备份创建面板 | ⚠️ 集成到 Backups | - |
| BackupRestorePanel | `BackupRestorePanel.svelte` | 备份恢复面板 | ❌ 缺失 | P1 |
| BackupUploadButton | `BackupUploadButton.svelte` | 备份上传按钮 | ❌ 缺失 | P2 |
| S3Fields | `S3Fields.svelte` | S3 配置字段 | ⚠️ 集成到 Storage | - |
| EmailTestPopup | `EmailTestPopup.svelte` | 邮件测试弹窗 | ❌ 缺失 | P1 |
| ImportPopup | `ImportPopup.svelte` | 导入弹窗 | ⚠️ 集成到 Import | - |
| RateLimitAccordion | `RateLimitAccordion.svelte` | 速率限制配置 | ❌ 缺失 | P1 |
| TrustedProxyAccordion | `TrustedProxyAccordion.svelte` | 可信代理配置 | ❌ 缺失 | P2 |
| BatchAccordion | `BatchAccordion.svelte` | 批量操作配置 | ❌ 缺失 | P2 |

---

## 十、缺失的工具/辅助模块

### 10.1 Actions (Svelte 特有)

| 文件 | 说明 | React 替代方案 |
|------|------|----------------|
| `actions/tooltip.js` | Tooltip action | 使用 Radix Tooltip |
| `actions/scrollend.js` | 滚动到底部检测 | 需要自定义 hook |

### 10.2 工具函数

| 文件 | ui 路径 | 说明 | ui-v2 状态 |
|------|---------|------|------------|
| CommonHelper | `utils/CommonHelper.js` | 通用工具函数 (66KB) | ⚠️ 部分实现 |
| providers | `providers.js` | OAuth2 提供商配置 | ❌ 缺失 |
| mimes | `mimes.js` | MIME 类型定义 | ❌ 缺失 |
| autocomplete.worker | `autocomplete.worker.js` | 自动补全 Worker | ❌ 缺失 |

---

## 十一、路由差异

### ui 路由 (完整)

```
/pbinstal/:token          - 安装页面
/login                    - 登录
/request-password-reset   - 请求密码重置
/confirm-password-reset/:token - 确认密码重置
/collections              - 集合/记录管理
/logs                     - 日志
/monitoring               - 系统监控
/traces                   - Trace 监控
/analytics                - 流量分析
/settings                 - 应用设置
/settings/mail            - 邮件设置
/settings/storage         - 存储设置
/settings/backups         - 备份管理
/settings/crons           - 定时任务
/settings/jobs            - 任务队列
/settings/secrets         - 密钥管理
/settings/analytics       - 分析设置
/settings/export-collections - 导出集合
/settings/import-collections - 导入集合
/auth/confirm-password-reset/:token - 用户密码重置确认
/auth/confirm-verification/:token   - 用户邮箱验证确认
/auth/confirm-email-change/:token   - 用户邮箱变更确认
/auth/oauth2-redirect-success       - OAuth2 成功跳转
/auth/oauth2-redirect-failure       - OAuth2 失败跳转
```

### ui-v2 路由 (当前)

```
/login                    - 登录 ✅
/collections              - 集合管理 ✅
/collections/:collectionId - 记录管理 ✅
/logs                     - 日志 ✅
/monitoring               - 系统监控 ✅
/traces                   - Trace 监控 ✅
/analytics                - 流量分析 ✅
/settings/application     - 应用设置 ✅
/settings/mail            - 邮件设置 ✅
/settings/storage         - 存储设置 ✅
/settings/backups         - 备份管理 ✅
/settings/crons           - 定时任务 ✅
/settings/secrets         - 密钥管理 ✅
/settings/analytics       - 分析设置 ✅
/settings/admins          - 管理员设置 ✅
/settings/tokens          - Token 设置 ✅
/settings/export          - 导出集合 ✅
/settings/import          - 导入集合 ✅
```

### 缺失路由

```
❌ /pbinstal/:token                    - 安装页面
❌ /request-password-reset             - 请求密码重置
❌ /confirm-password-reset/:token      - 确认密码重置
❌ /settings/jobs                      - 任务队列
❌ /auth/confirm-password-reset/:token - 用户密码重置确认
❌ /auth/confirm-verification/:token   - 用户邮箱验证确认
❌ /auth/confirm-email-change/:token   - 用户邮箱变更确认
❌ /auth/oauth2-redirect-success       - OAuth2 成功跳转
❌ /auth/oauth2-redirect-failure       - OAuth2 失败跳转
```

---

## 十二、优先级分类汇总

### P0 - 核心功能 (必须实现)

1. **日志模块完善**
   - LogsList - 日志列表
   - LogViewPanel - 日志详情面板

2. **Trace 监控完善**
   - TraceList - Trace 列表
   - TraceDetail - Trace 详情

3. **基础组件**
   - Accordion - 手风琴组件
   - Select - 高级选择器
   - Draggable/Dragline - 拖拽组件

### P1 - 重要功能 (应该实现)

1. **API 文档面板** (25 个组件)
2. **OAuth2 Provider 配置** (6 个组件)
3. **Jobs 任务队列页面**
4. **认证相关页面**
   - 请求/确认密码重置
   - 邮箱验证/变更确认
5. **设置组件增强**
   - EmailTestPopup
   - BackupRestorePanel
   - RateLimitAccordion
6. **记录组件增强**
   - RecordInfo/RecordFieldValue
   - ExternalAuthsList
   - ImpersonatePopup

### P2 - 次要功能 (可选实现)

1. OAuth2 重定向页面
2. 安装引导页面
3. ServerlessMetrics
4. 其他辅助组件

---

## 十三、下一步行动建议

### Phase 1: 核心功能完善 (预计 40h)

1. 日志模块完善 - 8h
2. Trace 监控完善 - 12h
3. 基础组件补充 - 12h
4. Jobs 页面实现 - 8h

### Phase 2: API 文档面板 (预计 32h)

1. CollectionDocsPanel 容器 - 4h
2. CRUD API 文档 (5个) - 10h
3. Auth API 文档 (10个) - 12h
4. 其他 API 文档 (10个) - 6h

### Phase 3: OAuth2 增强 (预计 16h)

1. OAuth2ProvidersListPanel - 4h
2. Provider 配置组件 (6个) - 12h

### Phase 4: 认证页面 (预计 16h)

1. 超级用户密码重置 - 4h
2. 用户邮箱确认页面 (3个) - 8h
3. OAuth2 重定向页面 - 4h

### Phase 5: 其他增强 (预计 24h)

1. 设置组件增强 - 8h
2. 记录组件增强 - 8h
3. 工具函数迁移 - 8h

---

**总预计工作量**: ~128h (~3-4 周)
