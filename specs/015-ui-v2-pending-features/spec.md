# Feature Specification: UI-V2 待实现功能清单

**Feature Branch**: `015-ui-v2-pending-features`  
**Created**: 2026-01-12  
**Status**: Draft  
**Parent Spec**: `specs/014-ui-svelte-to-react/spec.md`

## 1. Problem Essence (核心问题)

UI-V2 迁移项目已完成基础框架和部分功能，但仍有多个核心功能模块标记为"后续实现"或"待实现"。本文档梳理所有待实现功能，与 `ui/` 中的 Svelte 组件对齐，确保功能完整性。

## 2. 待实现功能总览

### 2.1 Collection 编辑面板 (UpsertPanel)

**位置**: `ui-v2/src/features/collections/components/UpsertPanel.tsx`

| Tab | 当前状态 | 对应 Svelte 组件 | 优先级 |
|:---|:---|:---|:---|
| 字段编辑器 | ❌ 待实现 | `CollectionFieldsTab.svelte` | P0 |
| API 规则编辑器 | ❌ 待实现 | `CollectionRulesTab.svelte` | P0 |
| Auth 选项配置 | ❌ 待实现 | `CollectionAuthOptionsTab.svelte` | P1 |

### 2.2 Settings 页面

**位置**: `ui-v2/src/router/index.tsx`

| 页面 | 当前状态 | 对应 Svelte 组件 | 优先级 |
|:---|:---|:---|:---|
| Cron Jobs | ❌ 待实现 | `PageCrons.svelte` | P1 |
| Secrets | ❌ 待实现 | `PageSecrets.svelte` + `SecretUpsertPanel.svelte` | P1 |
| Analytics Settings | ❌ 待实现 | `PageAnalyticsSettings.svelte` | P2 |
| Tokens | ❌ 待实现 | 无对应（新功能） | P2 |

### 2.3 Record 字段组件

**位置**: `ui-v2/src/features/records/components/fields/`

| 字段类型 | 当前状态 | 对应 Svelte 组件 | 优先级 |
|:---|:---|:---|:---|
| RelationField | ⚠️ TODO: 关联选择器对话框 | `RelationField.svelte` + `RecordsPicker.svelte` | P0 |
| EditorField | ⚠️ TODO: TinyMCE 集成 | `EditorField.svelte` + `TinyMCE.svelte` | P1 |
| FileField | ⚠️ 基础实现 | `FileField.svelte` + `RecordFilePicker.svelte` | P0 |
| GeoPointField | ❌ 缺失 | `GeoPointField.svelte` + `Leaflet.svelte` | P2 |
| PasswordField | ❌ 缺失 | `PasswordField.svelte` | P1 |

---

## 3. 详细功能规范

### 3.1 Collection 字段编辑器 (CollectionFieldsTab)

**参考**: `ui/src/components/collections/CollectionFieldsTab.svelte`

#### 功能要求

1. **字段列表展示**
   - 显示所有字段，支持拖拽排序
   - 区分系统字段和用户字段
   - 支持字段的展开/折叠

2. **字段类型支持**
   - text, number, bool, email, url
   - editor, date, select, json
   - file, relation, password, autodate, geoPoint

3. **字段操作**
   - 新增字段（选择类型）
   - 编辑字段属性
   - 删除字段
   - 复制字段

4. **索引管理**
   - 显示索引列表
   - 新增/编辑/删除索引

#### 子组件映射

| Svelte 组件 | React 组件 | 说明 |
|:---|:---|:---|
| `NewField.svelte` | `NewFieldButton.tsx` | 新增字段按钮 |
| `SchemaField.svelte` | `SchemaFieldEditor.tsx` | 字段编辑器容器 |
| `SchemaFieldText.svelte` | `fields/TextFieldOptions.tsx` | Text 字段选项 |
| `SchemaFieldNumber.svelte` | `fields/NumberFieldOptions.tsx` | Number 字段选项 |
| `SchemaFieldBool.svelte` | `fields/BoolFieldOptions.tsx` | Bool 字段选项 |
| `SchemaFieldEmail.svelte` | `fields/EmailFieldOptions.tsx` | Email 字段选项 |
| `SchemaFieldUrl.svelte` | `fields/UrlFieldOptions.tsx` | URL 字段选项 |
| `SchemaFieldEditor.svelte` | `fields/EditorFieldOptions.tsx` | Editor 字段选项 |
| `SchemaFieldDate.svelte` | `fields/DateFieldOptions.tsx` | Date 字段选项 |
| `SchemaFieldSelect.svelte` | `fields/SelectFieldOptions.tsx` | Select 字段选项 |
| `SchemaFieldJson.svelte` | `fields/JsonFieldOptions.tsx` | JSON 字段选项 |
| `SchemaFieldFile.svelte` | `fields/FileFieldOptions.tsx` | File 字段选项 |
| `SchemaFieldRelation.svelte` | `fields/RelationFieldOptions.tsx` | Relation 字段选项 |
| `SchemaFieldPassword.svelte` | `fields/PasswordFieldOptions.tsx` | Password 字段选项 |
| `SchemaFieldAutodate.svelte` | `fields/AutodateFieldOptions.tsx` | Autodate 字段选项 |
| `SchemaFieldGeoPoint.svelte` | `fields/GeoPointFieldOptions.tsx` | GeoPoint 字段选项 |
| `IndexesList.svelte` | `IndexesList.tsx` | 索引列表 |
| `IndexUpsertPanel.svelte` | `IndexUpsertPanel.tsx` | 索引编辑面板 |
| `Draggable.svelte` | 使用 `@dnd-kit/core` | 拖拽排序 |

---

### 3.2 Collection API 规则编辑器 (CollectionRulesTab)

**参考**: `ui/src/components/collections/CollectionRulesTab.svelte`

#### 功能要求

1. **规则类型**
   - List Rule (listRule)
   - View Rule (viewRule)
   - Create Rule (createRule)
   - Update Rule (updateRule)
   - Delete Rule (deleteRule)
   - Auth Rule (authRule) - 仅 Auth Collection
   - Manage Rule (manageRule) - 仅 Auth Collection

2. **规则编辑器**
   - 支持 PocketBase filter 语法
   - 自动补全字段名
   - 语法高亮
   - 显示可用字段列表

3. **规则状态**
   - 锁定（null）- 禁止访问
   - 解锁（空字符串）- 允许所有
   - 自定义规则

#### 子组件映射

| Svelte 组件 | React 组件 | 说明 |
|:---|:---|:---|
| `RuleField.svelte` | `RuleField.tsx` | 单个规则编辑器 |
| `FilterAutocompleteInput.svelte` | `FilterAutocompleteInput.tsx` | 已实现，需集成 |

---

### 3.3 Collection Auth 选项配置 (CollectionAuthOptionsTab)

**参考**: `ui/src/components/collections/CollectionAuthOptionsTab.svelte`

#### 功能要求

1. **认证方式配置**
   - Password Auth（密码认证）
   - OAuth2 Providers（第三方登录）
   - OTP（一次性密码）
   - MFA（多因素认证）
   - TOF Auth（腾讯内部认证）

2. **Token 配置**
   - Auth Token 有效期
   - Refresh Token 有效期
   - Verification Token 有效期

3. **邮件模板配置**
   - 密码重置邮件
   - 验证邮件
   - 邮箱变更确认邮件
   - OTP 邮件
   - 登录提醒邮件

#### 子组件映射

| Svelte 组件 | React 组件 | 说明 |
|:---|:---|:---|
| `PasswordAuthAccordion.svelte` | `PasswordAuthAccordion.tsx` | 密码认证配置 |
| `OAuth2Accordion.svelte` | `OAuth2Accordion.tsx` | OAuth2 配置 |
| `OAuth2ProviderPanel.svelte` | `OAuth2ProviderPanel.tsx` | OAuth2 Provider 编辑 |
| `OAuth2ProvidersListPanel.svelte` | `OAuth2ProvidersListPanel.tsx` | OAuth2 Provider 列表 |
| `OTPAccordion.svelte` | `OTPAccordion.tsx` | OTP 配置 |
| `MFAAccordion.svelte` | `MFAAccordion.tsx` | MFA 配置 |
| `TofAuthAccordion.svelte` | `TofAuthAccordion.tsx` | TOF 认证配置 |
| `TokenOptionsAccordion.svelte` | `TokenOptionsAccordion.tsx` | Token 配置 |
| `EmailTemplateAccordion.svelte` | `EmailTemplateAccordion.tsx` | 邮件模板配置 |

---

### 3.4 Record 关联选择器 (RelationField + RecordsPicker)

**参考**: `ui/src/components/records/fields/RelationField.svelte` + `ui/src/components/records/RecordsPicker.svelte`

#### 功能要求

1. **关联选择器对话框**
   - 显示目标 Collection 的记录列表
   - 支持搜索和筛选
   - 支持分页
   - 支持单选/多选

2. **已选关联展示**
   - 显示关联记录的摘要信息
   - 支持快速预览
   - 支持移除关联

3. **级联选择**
   - 支持嵌套关联

#### 子组件映射

| Svelte 组件 | React 组件 | 说明 |
|:---|:---|:---|
| `RelationField.svelte` | `RelationField.tsx` | 已有基础，需完善 |
| `RecordsPicker.svelte` | `RecordsPicker.tsx` | 新增 |
| `RecordPreviewPanel.svelte` | `RecordPreviewPanel.tsx` | 记录预览面板 |

---

### 3.5 富文本编辑器 (EditorField + TinyMCE)

**参考**: `ui/src/components/records/fields/EditorField.svelte` + `ui/src/components/base/TinyMCE.svelte`

#### 功能要求

1. **TinyMCE 集成**
   - 富文本编辑
   - 图片上传
   - 代码块
   - 表格

2. **配置选项**
   - 工具栏配置
   - 插件配置
   - 主题适配（暗色模式）

#### 依赖

```json
{
  "@tinymce/tinymce-react": "^4.x",
  "tinymce": "^6.x"
}
```

---

### 3.6 文件上传组件 (FileField + RecordFilePicker)

**参考**: `ui/src/components/records/fields/FileField.svelte` + `ui/src/components/records/RecordFilePicker.svelte`

#### 功能要求

1. **文件选择**
   - 拖拽上传
   - 点击选择
   - 多文件上传

2. **文件预览**
   - 图片预览
   - 视频预览
   - 文件信息展示

3. **文件管理**
   - 删除文件
   - 重新排序
   - 下载文件

#### 子组件映射

| Svelte 组件 | React 组件 | 说明 |
|:---|:---|:---|
| `FileField.svelte` | `FileField.tsx` | 已有基础，需完善 |
| `RecordFilePicker.svelte` | `RecordFilePicker.tsx` | 新增 |
| `RecordFileThumb.svelte` | `RecordFileThumb.tsx` | 文件缩略图 |
| `UploadedFilePreview.svelte` | `UploadedFilePreview.tsx` | 上传预览 |

---

### 3.7 Settings - Cron Jobs

**参考**: `ui/src/components/settings/PageCrons.svelte`

#### 功能要求

1. **Cron 任务列表**
   - 显示所有定时任务
   - 任务状态（启用/禁用）
   - 下次执行时间

2. **任务管理**
   - 创建任务
   - 编辑任务
   - 删除任务
   - 手动触发

---

### 3.8 Settings - Secrets

**参考**: `ui/src/components/secrets/PageSecrets.svelte` + `ui/src/components/secrets/SecretUpsertPanel.svelte`

#### 功能要求

1. **Secret 列表**
   - 显示所有 Secrets
   - 搜索和筛选
   - 复制 Secret 值

2. **Secret 管理**
   - 创建 Secret
   - 编辑 Secret
   - 删除 Secret

---

### 3.9 GeoPoint 字段

**参考**: `ui/src/components/records/fields/GeoPointField.svelte` + `ui/src/components/base/Leaflet.svelte`

#### 功能要求

1. **地图选点**
   - Leaflet 地图集成
   - 点击选点
   - 坐标输入

2. **坐标展示**
   - 经纬度显示
   - 地图预览

#### 依赖

```json
{
  "react-leaflet": "^4.x",
  "leaflet": "^1.9.x"
}
```

---

### 3.10 Password 字段

**参考**: `ui/src/components/records/fields/PasswordField.svelte`

#### 功能要求

1. **密码输入**
   - 密码强度提示
   - 显示/隐藏切换
   - 确认密码

---

## 4. User Scenarios & Testing

### User Story 1 - Collection 字段管理 (Priority: P0)

作为系统管理员，我希望能够在 Collection 编辑面板中管理字段。

**Acceptance Scenarios**:

1. **Given** 管理员打开 Collection 编辑面板, **When** 切换到"字段"Tab, **Then** 显示当前所有字段列表
2. **Given** 管理员在字段列表, **When** 点击"新增字段"按钮, **Then** 显示字段类型选择菜单
3. **Given** 管理员选择字段类型, **When** 填写字段名称和选项, **Then** 新字段添加到列表
4. **Given** 管理员拖拽字段, **When** 释放到新位置, **Then** 字段顺序更新
5. **Given** 管理员点击字段删除按钮, **When** 确认删除, **Then** 字段从列表移除

---

### User Story 2 - API 规则配置 (Priority: P0)

作为系统管理员，我希望能够配置 Collection 的 API 访问规则。

**Acceptance Scenarios**:

1. **Given** 管理员打开 Collection 编辑面板, **When** 切换到"API 规则"Tab, **Then** 显示所有规则编辑器
2. **Given** 管理员在规则编辑器, **When** 输入规则表达式, **Then** 自动补全可用字段
3. **Given** 管理员设置规则为空, **When** 保存, **Then** 该规则允许所有访问
4. **Given** 管理员锁定规则, **When** 保存, **Then** 该规则禁止所有访问

---

### User Story 3 - 关联记录选择 (Priority: P0)

作为系统管理员，我希望能够在编辑记录时选择关联记录。

**Acceptance Scenarios**:

1. **Given** 管理员在记录编辑面板, **When** 点击关联字段的"Select"按钮, **Then** 打开关联选择器对话框
2. **Given** 管理员在选择器对话框, **When** 搜索记录, **Then** 显示匹配的记录列表
3. **Given** 管理员选择记录, **When** 点击确认, **Then** 关联记录显示在字段中
4. **Given** 管理员点击已选记录的删除按钮, **When** 确认, **Then** 关联被移除

---

## 5. Implementation Plan (实施计划)

### Phase 1: Collection 编辑器核心功能 (Week 1-2)

| 任务 | 优先级 | 预估工时 |
|:---|:---|:---|
| CollectionFieldsTab 基础框架 | P0 | 4h |
| SchemaFieldEditor 容器组件 | P0 | 4h |
| 各字段类型选项组件 (14个) | P0 | 8h |
| 字段拖拽排序 | P0 | 4h |
| IndexesList 索引管理 | P0 | 4h |
| CollectionRulesTab | P0 | 4h |
| RuleField 规则编辑器 | P0 | 4h |

### Phase 2: Record 字段增强 (Week 2-3)

| 任务 | 优先级 | 预估工时 |
|:---|:---|:---|
| RecordsPicker 关联选择器 | P0 | 8h |
| RelationField 完善 | P0 | 4h |
| FileField + RecordFilePicker | P0 | 8h |
| PasswordField | P1 | 2h |
| EditorField + TinyMCE | P1 | 4h |
| GeoPointField + Leaflet | P2 | 4h |

### Phase 3: Auth 选项与 Settings (Week 3-4)

| 任务 | 优先级 | 预估工时 |
|:---|:---|:---|
| CollectionAuthOptionsTab 框架 | P1 | 4h |
| PasswordAuthAccordion | P1 | 2h |
| OAuth2Accordion + Provider 管理 | P1 | 8h |
| OTP/MFA/TOF Accordion | P1 | 4h |
| EmailTemplateAccordion | P1 | 4h |
| TokenOptionsAccordion | P1 | 2h |
| PageCrons | P1 | 4h |
| PageSecrets | P1 | 4h |
| PageAnalyticsSettings | P2 | 4h |
| PageTokens | P2 | 4h |

---

## 6. Dependencies (依赖)

### 需要新增的依赖

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^8.x",
    "@tinymce/tinymce-react": "^4.x",
    "react-leaflet": "^4.x",
    "leaflet": "^1.9.x"
  }
}
```

---

## 7. File Structure (新增文件结构)

```
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

---

## 8. Success Criteria

- [ ] Collection 字段编辑器功能完整，支持所有 14 种字段类型
- [ ] API 规则编辑器支持自动补全和语法高亮
- [ ] Auth 选项配置完整，支持所有认证方式
- [ ] 关联选择器支持搜索、筛选、分页
- [ ] 文件上传支持拖拽、预览、多文件
- [ ] 富文本编辑器集成 TinyMCE
- [ ] GeoPoint 字段集成 Leaflet 地图
- [ ] Settings 页面功能完整
- [ ] 所有功能与 `ui/` 中的 Svelte 实现对齐
