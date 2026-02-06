# Feature Specification: WebUI API Preview 功能 1:1 对齐

**Feature Branch**: `023-webui-api-preview-alignment`  
**Created**: 2026-02-05  
**Status**: Ready for Dev  
**Parent Spec**: `specs/014-ui-svelte-to-react/spec.md`

## 1. Problem Essence (核心问题)

WebUI (React) 版本的 API Preview 功能与 UI (Svelte) 版本存在差异，需要进行 1:1 对齐。

**目标**：确保 API Preview 面板的**所有交互、UI呈现、文案展示**与 UI 版本保持一致。

---

## 1.0 功能完整对比

### 1.0.1 入口面板 (CollectionDocsPanel)

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **面板类型** | `OverlayPanel` (右侧滑入) | `Sheet` (右侧滑入) | ✅ 已对齐 |
| **面板宽度** | 固定宽度 | `w-[700px] sm:w-[900px]` | ✅ 已对齐 |
| **导航布局** | 左侧垂直导航 + 右侧内容 | 左侧垂直导航 + 右侧内容 | ✅ 已对齐 |
| **Tab 动态加载** | 使用 `import()` 懒加载 | 直接渲染组件 | ⚠️ 可优化但功能对齐 |

### 1.0.2 Tab 结构对比

#### Base Collection Tabs (7个)

| Tab ID | Tab Label | UI (Svelte) | WebUI (React) | 状态 |
|--------|-----------|-------------|---------------|------|
| list | List/Search | `ListApiDocs.svelte` | `ListApiDocs.tsx` | ✅ 已实现 |
| view | View | `ViewApiDocs.svelte` | `ViewApiDocs.tsx` | ✅ 已实现 |
| create | Create | `CreateApiDocs.svelte` | `CreateApiDocs.tsx` | ✅ 已实现 |
| update | Update | `UpdateApiDocs.svelte` | `UpdateApiDocs.tsx` | ✅ 已实现 |
| delete | Delete | `DeleteApiDocs.svelte` | `DeleteApiDocs.tsx` | ✅ 已实现 |
| realtime | Realtime | `RealtimeApiDocs.svelte` | `RealtimeApiDocs.tsx` | ✅ 已实现 |
| batch | Batch | `BatchApiDocs.svelte` | `BatchApiDocs.tsx` | ✅ 已实现 |

#### Auth Collection 额外 Tabs (8个)

| Tab ID | Tab Label | UI (Svelte) | WebUI (React) | 启用条件 | 状态 |
|--------|-----------|-------------|---------------|----------|------|
| list-auth-methods | List auth methods | `AuthMethodsDocs.svelte` | `AuthMethodsDocs.tsx` | 始终启用 | ✅ 已实现 |
| auth-with-password | Auth with password | `AuthWithPasswordDocs.svelte` | `AuthWithPasswordDocs.tsx` | `passwordAuth.enabled` | ⚠️ **缺少禁用逻辑** |
| auth-with-oauth2 | Auth with OAuth2 | `AuthWithOAuth2Docs.svelte` | `AuthWithOAuth2Docs.tsx` | `oauth2.enabled` | ⚠️ **缺少禁用逻辑** |
| auth-with-otp | Auth with OTP | `AuthWithOtpDocs.svelte` | `AuthWithOtpDocs.tsx` | `otp.enabled` | ⚠️ **缺少禁用逻辑** |
| refresh | Auth refresh | `AuthRefreshDocs.svelte` | `AuthRefreshDocs.tsx` | 始终启用 | ✅ 已实现 |
| verification | Verification | `VerificationDocs.svelte` | `VerificationDocs.tsx` | 始终启用 | ✅ 已实现 |
| password-reset | Password reset | `PasswordResetDocs.svelte` | `PasswordResetDocs.tsx` | 始终启用 | ✅ 已实现 |
| email-change | Email change | `EmailChangeDocs.svelte` | `EmailChangeDocs.tsx` | 始终启用 | ✅ 已实现 |

#### View Collection Tabs (2个)

| Tab | UI (Svelte) | WebUI (React) | 状态 |
|-----|-------------|---------------|------|
| List/Search | ✅ | ✅ | ✅ 已对齐 |
| View | ✅ | ✅ | ✅ 已对齐 |

### 1.0.3 Tab 禁用逻辑差异 (Critical)

| Tab | UI (Svelte) 禁用条件 | WebUI (React) 当前实现 | 状态 |
|-----|---------------------|------------------------|------|
| Auth with password | `!collection.passwordAuth.enabled` | ❌ 未实现 | 🔴 **未对齐** |
| Auth with OAuth2 | `!collection.oauth2.enabled` | ❌ 未实现 | 🔴 **未对齐** |
| Auth with OTP | `!collection.otp.enabled` | ❌ 未实现 | 🔴 **未对齐** |

**UI 版本实现** (`CollectionDocsPanel.svelte` 第 72-74 行):
```javascript
tabs["auth-with-password"].disabled = !collection.passwordAuth.enabled;
tabs["auth-with-oauth2"].disabled = !collection.oauth2.enabled;
tabs["auth-with-otp"].disabled = !collection.otp.enabled;
```

**修复方案**: 在 `getCollectionTabs()` 或 `CollectionDocsPanel.tsx` 中添加禁用逻辑。

---

## 1.1 SDK 选项卡差异 (Critical)

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **SDK 选项** | JavaScript + Dart | JavaScript + Dart + cURL (可选) | 🟡 **需调整** |
| **偏好存储** | `localStorage.pb_sdk_preference` | 无持久化 | 🔴 **未对齐** |
| **SDK 链接** | 显示 SDK 文档链接 | 无链接 | 🔴 **未对齐** |

### 1.1.1 SdkTabs 组件对比

**UI 版本** (`SdkTabs.svelte`):
```svelte
<script>
    const SDK_PREFERENCE_KEY = "pb_sdk_preference";
    let activeTab = localStorage.getItem(SDK_PREFERENCE_KEY) || "javascript";
    
    $: sdkExamples = [
        {
            title: "JavaScript",
            language: "javascript",
            content: js,
            url: import.meta.env.PB_JS_SDK_URL,  // SDK 文档链接
        },
        {
            title: "Dart",
            language: "dart",
            content: dart,
            url: import.meta.env.PB_DART_SDK_URL,  // SDK 文档链接
        },
    ];
</script>

<!-- 每个 Tab 底部显示 SDK 链接 -->
<div class="txt-right">
    <em class="txt-sm txt-hint">
        <a href={example.url} target="_blank" rel="noopener noreferrer">
            {example.title} SDK
        </a>
    </em>
</div>
```

**WebUI 版本** (`SdkTabs.tsx`) 当前实现:
- ✅ 支持 js + dart + curl
- ❌ 无 SDK 偏好持久化
- ❌ 无 SDK 文档链接

**需要修改为**：只支持 js + dart（与 UI 版本一致），并添加偏好存储和 SDK 链接。

---

## 1.2 文案语言差异 (Critical)

WebUI 版本混用了中英文，需要统一为英文（与 UI 版本一致）。

### 1.2.1 需要修改的中文文案

| 组件 | 当前中文文案 | 应改为英文 |
|------|-------------|-----------|
| **CollectionDocsPanel.tsx** | `API 文档` | `API Docs` / 无标题 |
| **ListApiDocs.tsx** | `获取分页的 {name} 记录列表，支持排序和过滤。` | `Fetch a paginated {name} records list, supporting sorting and filtering.` |
| **ListApiDocs.tsx** | `API 端点` | `API details` |
| **ListApiDocs.tsx** | `查询参数` | `Query parameters` |
| **ListApiDocs.tsx** | `参数`/`类型`/`说明` | `Param`/`Type`/`Description` |
| **ListApiDocs.tsx** | `分页页码（默认为 1）` | `The page (aka. offset) of the paginated list (default to 1).` |
| **ListApiDocs.tsx** | `每页返回的记录数（默认为 30）` | `Specify the max returned records per page (default to 30).` |
| **ListApiDocs.tsx** | `排序字段。使用 -/+ 前缀表示 降序/升序。` | `Specify the records order attribute(s). Add - / + (default) in front of the attribute for DESC / ASC order.` |
| **ListApiDocs.tsx** | `过滤表达式。` | `Filter the returned records. Ex:` |
| **ListApiDocs.tsx** | `自动展开关联记录。支持最多 6 层嵌套。` | `Auto expand record relations. Supports up to 6-levels depth nested relations expansion.` |
| **ListApiDocs.tsx** | `响应示例` | `Responses` |
| **ListApiDocs.tsx** | `需要超级用户...` | `Requires superuser Authorization:TOKEN header` |
| **FilterSyntax.tsx** | 所有中文描述 | 英文描述 |
| **FieldsQueryParam.tsx** | 所有中文描述 | 英文描述 |
| **其他 *ApiDocs.tsx** | 所有中文文案 | 对应英文文案 |

### 1.2.2 FilterSyntax 组件文案

**UI 版本** (`FilterSyntax.svelte`) 文案样式:
```
Supported filter fields: @collection.*, @request.*, @rowid, id, created, updated, ...
Supported filter operators: = (Equal), != (NOT equal), > (Greater than), ...
```

**WebUI 版本需要对齐的内容**:
- 标题: `Supported filter operators` / `Supported filter fields`
- 字段列表: `@collection.*`, `@request.*`, `@rowid`, 加上 Collection 的所有字段
- 操作符列表及说明

---

## 1.3 API 端点显示样式差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **样式类** | `alert alert-info` (GET 蓝色) / `alert-success` (POST 绿色) | 统一蓝色背景 | 🟡 **样式差异** |
| **Method 徽章** | `label label-primary` | 自定义颜色 | 🟡 **样式差异** |
| **布局** | Method + 路径 + 权限提示 | 类似 | ✅ 功能对齐 |

**UI 版本样式**:
```svelte
<!-- GET 请求 -->
<div class="alert alert-info">
    <strong class="label label-primary">GET</strong>
    <div class="content"><p>/api/collections/{name}/records</p></div>
</div>

<!-- POST 请求 -->
<div class="alert alert-success">
    <strong class="label label-primary">POST</strong>
    <div class="content"><p>/api/collections/{name}/auth-with-password</p></div>
</div>
```

---

## 1.4 响应示例展示差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **Tab 切换** | 状态码 Tab 切换 (200/400/403) | 垂直列表展示 | 🟡 **交互差异** |
| **代码高亮** | Prism.js 语法高亮 | 无高亮 | 🔴 **未对齐** |

**UI 版本** 响应示例使用 Tab 切换:
```svelte
<div class="tabs">
    <div class="tabs-header compact combined left">
        {#each responses as response}
            <button class="tab-item" class:active={responseTab === response.code}>
                {response.code}
            </button>
        {/each}
    </div>
    <div class="tabs-content">
        {#each responses as response}
            <div class="tab-item" class:active={responseTab === response.code}>
                <CodeBlock content={response.body} />
            </div>
        {/each}
    </div>
</div>
```

**WebUI 版本** 响应示例使用垂直列表:
```tsx
{responses.map((resp) => (
    <div key={resp.code}>
        <span>{resp.code}</span>
        <CodeBlock content={resp.body} />
    </div>
))}
```

**需要修改**: 改为 Tab 切换方式展示响应示例。

---

## 1.5 代码高亮差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **高亮库** | Prism.js | 无 | 🔴 **未对齐** |
| **支持语言** | javascript, html, dart, go, sql | 无高亮 | 🔴 **未对齐** |
| **Normalize 插件** | 自动去除首尾空白、缩进 | 手动 trim | ⚠️ 部分对齐 |

**UI 版本** CodeBlock 组件:
```svelte
<script>
    function highlight(code) {
        code = Prism.plugins.NormalizeWhitespace.normalize(code, {
            "remove-trailing": true,
            "remove-indent": true,
            "left-trim": true,
            "right-trim": true,
        });
        return Prism.highlight(code, Prism.languages[language], language);
    }
</script>
```

**WebUI 版本** CodeBlock 组件:
```tsx
<pre className="...">
    <code>{content.trim()}</code>  // 无语法高亮
</pre>
```

**需要修改**: 集成 Prism.js 或 shiki 等语法高亮库。

---

## 1.6 查询参数表格差异

| 特性 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **skipTotal 参数说明** | 完整说明 + SDK 方法提及 | 简化说明 | 🟡 **内容差异** |
| **sort 参数** | 列出支持的字段列表 | 无字段列表 | 🔴 **未对齐** |
| **Supported fields 展示** | 动态生成 Collection 字段列表 | 无 | 🔴 **未对齐** |

**UI 版本 sort 参数说明**:
```svelte
<p>
    <strong>Supported record sort fields:</strong> <br />
    <code>@random</code>,
    <code>@rowid</code>,
    {#each fieldNames as name, i}
        <code>{name}</code>{i < fieldNames.length - 1 ? ", " : ""}
    {/each}
</p>
```

---

## 1.7 Auth 文档组件特有内容

### 1.7.1 AuthWithPasswordDocs

| 内容 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **identityFields 动态显示** | `{identityFields.join("/")}` | 需验证 | ⚠️ 待验证 |
| **示例占位符** | `YOUR_EMAIL_OR_USERNAME` 格式 | 需验证 | ⚠️ 待验证 |
| **Body Parameters 表格** | Required 标签 + 字段说明 | 需验证 | ⚠️ 待验证 |

### 1.7.2 AuthWithOAuth2Docs

| 内容 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **多种授权方式说明** | Manual code exchange / Direct URL / Redirect URL | 需验证 | ⚠️ 待验证 |

### 1.7.3 BatchApiDocs

| 内容 | UI (Svelte) | WebUI (React) | 状态 |
|------|-------------|---------------|------|
| **批量操作示例** | 完整的 batch 请求示例 | 需验证 | ⚠️ 待验证 |

---

## 2. User Scenarios & Testing

### User Story 1 - SDK 选项卡对齐 (Priority: P0)

作为开发者，我希望 API Preview 的 SDK 示例只显示 JavaScript 和 Dart 两种语言，与官方文档保持一致。

**Acceptance Scenarios**:
1. **Given** 打开 API Preview 面板, **When** 查看 SDK 示例, **Then** 只显示 JavaScript 和 Dart 两个选项卡
2. **Given** 切换 SDK 选项卡到 Dart, **When** 关闭并重新打开面板, **Then** 默认选中 Dart（偏好已保存）
3. **Given** SDK 代码示例区域, **When** 查看底部, **Then** 显示 "JavaScript SDK" 或 "Dart SDK" 链接

### User Story 2 - 文案英文化 (Priority: P0)

作为用户，我希望 API Preview 的所有文案都是英文，与 UI 版本保持一致。

**Acceptance Scenarios**:
1. **Given** 打开 ListApiDocs, **When** 查看描述文案, **Then** 显示英文 "Fetch a paginated..."
2. **Given** 查询参数表格, **When** 查看表头, **Then** 显示 "Param" / "Type" / "Description"
3. **Given** 过滤语法说明, **When** 查看内容, **Then** 所有操作符说明都是英文

### User Story 3 - Auth Tab 禁用逻辑 (Priority: P0)

作为管理员，我希望当 Auth 方法未启用时，对应的文档 Tab 显示为禁用状态。

**Acceptance Scenarios**:
1. **Given** Auth Collection 未启用 passwordAuth, **When** 查看 API Preview, **Then** "Auth with password" Tab 显示为禁用
2. **Given** 禁用的 Tab, **When** 悬停, **Then** 显示 tooltip "Not enabled for the collection"
3. **Given** 禁用的 Tab, **When** 点击, **Then** 无响应

### User Story 4 - 响应示例 Tab 切换 (Priority: P1)

作为开发者，我希望响应示例使用 Tab 切换方式展示不同状态码的响应。

**Acceptance Scenarios**:
1. **Given** 响应示例区域, **When** 查看, **Then** 显示 200/400/403 Tab 按钮
2. **Given** 点击 400 Tab, **When** 切换完成, **Then** 显示 400 错误响应示例
3. **Given** 默认状态, **When** 打开面板, **Then** 默认选中 200 Tab

### User Story 5 - 代码语法高亮 (Priority: P1)

作为开发者，我希望代码示例有语法高亮，便于阅读。

**Acceptance Scenarios**:
1. **Given** JavaScript 代码示例, **When** 查看, **Then** 关键字有不同颜色高亮
2. **Given** JSON 响应示例, **When** 查看, **Then** 属性名和值有不同颜色
3. **Given** Dart 代码示例, **When** 查看, **Then** Dart 语法正确高亮

### User Story 6 - 支持字段列表显示 (Priority: P1)

作为开发者，我希望在 sort/filter 参数说明中看到当前 Collection 支持的所有字段。

**Acceptance Scenarios**:
1. **Given** ListApiDocs sort 参数, **When** 查看说明, **Then** 显示 "Supported record sort fields:"
2. **Given** 字段列表, **When** 查看, **Then** 显示 `@random`, `@rowid`, 以及 Collection 的所有字段名
3. **Given** FilterSyntax 组件, **When** 查看, **Then** 显示 "Supported filter fields:" 及完整字段列表

---

## 3. Functional Requirements

### 3.1 需要新增/修复的功能

| ID | Requirement | Priority | User Story | 状态 |
|----|-------------|----------|------------|------|
| FR-001 | SdkTabs 只显示 JavaScript + Dart 选项 | P0 | US1 | 🔴 **待修复** |
| FR-002 | SdkTabs 添加 SDK 偏好持久化到 localStorage | P0 | US1 | 🔴 **待新增** |
| FR-003 | SdkTabs 底部显示 SDK 文档链接 | P0 | US1 | 🔴 **待新增** |
| FR-004 | Auth Tab 根据配置动态禁用 | P0 | US3 | 🔴 **待新增** |
| FR-005 | 禁用 Tab 显示 tooltip 提示 | P0 | US3 | 🔴 **待新增** |
| FR-006 | 所有文档组件文案改为英文 | P0 | US2 | 🔴 **待修复** |
| FR-007 | 响应示例改为 Tab 切换方式 | P1 | US4 | 🔴 **待修复** |
| FR-008 | CodeBlock 集成语法高亮 | P1 | US5 | 🔴 **待新增** |
| FR-009 | sort 参数显示支持字段列表 | P1 | US6 | 🔴 **待新增** |
| FR-010 | FilterSyntax 显示支持字段列表 | P1 | US6 | 🔴 **待新增** |
| FR-011 | API 端点样式区分 GET/POST | P2 | - | 🟡 **可选优化** |

### 3.2 已对齐的功能

| ID | Requirement | 状态 |
|----|-------------|------|
| FR-V01 | CollectionDocsPanel 面板结构 | ✅ 已对齐 |
| FR-V02 | Base Collection 7 个 Tab | ✅ 已对齐 |
| FR-V03 | Auth Collection 额外 8 个 Tab | ✅ 已对齐 |
| FR-V04 | View Collection 只显示 2 个 Tab | ✅ 已对齐 |
| FR-V05 | 各 Tab 内容结构 | ✅ 已对齐 |
| FR-V06 | Auth 分隔线显示 | ✅ 已对齐 |

---

## 4. Technical Analysis

### 4.1 SdkTabs 组件修改

**当前实现** (`SdkTabs.tsx`):
```typescript
interface SdkTabsProps {
  js: string
  dart?: string
  curl?: string  // 需要移除
  className?: string
}
```

**目标实现**:
```typescript
const SDK_PREFERENCE_KEY = "pb_sdk_preference";
// SDK 链接确定使用硬编码方式
const PB_JS_SDK_URL = "https://github.com/pocketbase/js-sdk";
const PB_DART_SDK_URL = "https://github.com/pocketbase/dart-sdk";

interface SdkTabsProps {
  js: string
  dart: string  // 必需参数
  className?: string
}

export function SdkTabs({ js, dart, className }: SdkTabsProps) {
  // 从 localStorage 读取偏好
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(SDK_PREFERENCE_KEY) || 'javascript'
  });
  
  // 保存偏好
  useEffect(() => {
    localStorage.setItem(SDK_PREFERENCE_KEY, activeTab);
  }, [activeTab]);

  const sdkExamples = [
    { title: 'JavaScript', language: 'javascript', content: js, url: PB_JS_SDK_URL },
    { title: 'Dart', language: 'dart', content: dart, url: PB_DART_SDK_URL },
  ];

  return (
    // ...Tab 切换
    // 底部添加 SDK 链接
    <div className="text-right text-sm text-muted-foreground">
      <a href={currentSdk.url} target="_blank" rel="noopener noreferrer">
        {currentSdk.title} SDK
      </a>
    </div>
  );
}
```

### 4.2 Tab 禁用逻辑

**需要修改的文件**: `CollectionDocsPanel.tsx` 或 `apiDocsUtils.ts`

**确定方案**: 在 `getCollectionTabs()` 函数中添加 collection 参数
```typescript
export function getCollectionTabs(collection: Collection): DocTab[] {
  if (collection.type === 'auth') {
    const authTabs = [
      { id: 'auth-methods', label: 'List auth methods', disabled: false },
      { id: 'auth-with-password', label: 'Auth with password', 
        disabled: !collection.passwordAuth?.enabled },
      { id: 'auth-with-oauth2', label: 'Auth with OAuth2', 
        disabled: !collection.oauth2?.enabled },
      { id: 'auth-with-otp', label: 'Auth with OTP', 
        disabled: !collection.otp?.enabled },
      // ...
    ];
    return [...BASE_TABS, ...authTabs];
  }
  // ...
}
```

**备选方案**: 在 `CollectionDocsPanel.tsx` 中计算禁用状态（如果方案 A 不适用）
```typescript
const tabs = useMemo(() => {
  const baseTabs = getCollectionTabs(collection.type);
  if (collection.type === 'auth') {
    return baseTabs.map(tab => {
      if (tab.id === 'auth-with-password') {
        return { ...tab, disabled: !collection.passwordAuth?.enabled };
      }
      // ...
    });
  }
  return baseTabs;
}, [collection]);
```

### 4.3 响应示例 Tab 组件

> **注意**: ResponseTabs 为简单 UI 组件，不需要单元测试

**新建组件**: `ResponseTabs.tsx`
```typescript
interface ResponseTabsProps {
  responses: Array<{ code: number; body: string }>;
}

export function ResponseTabs({ responses }: ResponseTabsProps) {
  const [activeCode, setActiveCode] = useState(responses[0]?.code || 200);
  
  return (
    <div>
      <div className="section-title">Responses</div>
      <Tabs value={String(activeCode)} onValueChange={(v) => setActiveCode(Number(v))}>
        <TabsList className="compact combined left">
          {responses.map((resp) => (
            <TabsTrigger key={resp.code} value={String(resp.code)}>
              {resp.code}
            </TabsTrigger>
          ))}
        </TabsList>
        {responses.map((resp) => (
          <TabsContent key={resp.code} value={String(resp.code)}>
            <CodeBlock content={resp.body} language="json" />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

### 4.4 代码高亮集成

**确定方案**: 使用 Prism.js (与 UI 版本一致)

> **主题选择**: 与 UI 版本一致的主题

```bash
npm install prismjs @types/prismjs
```

```typescript
// CodeBlock.tsx
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-json';
import 'prismjs/plugins/normalize-whitespace/prism-normalize-whitespace';
// 导入与 UI 版本一致的主题样式

export function CodeBlock({ content, language = 'javascript' }: CodeBlockProps) {
  const highlighted = useMemo(() => {
    const normalized = Prism.plugins.NormalizeWhitespace.normalize(content, {
      'remove-trailing': true,
      'remove-indent': true,
      'left-trim': true,
      'right-trim': true,
    });
    return Prism.highlight(normalized, Prism.languages[language] || Prism.languages.javascript, language);
  }, [content, language]);

  return (
    <div className="code-wrapper">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </div>
  );
}
```

### 4.5 文案修改清单

需要修改的文件及对应文案：

| 文件 | 需要修改的内容 |
|------|---------------|
| `CollectionDocsPanel.tsx` | 侧边栏标题 "API 文档" → 无标题或 "API Docs" |
| `ListApiDocs.tsx` | 全部中文 → 英文 (约 15 处) |
| `ViewApiDocs.tsx` | 全部中文 → 英文 |
| `CreateApiDocs.tsx` | 全部中文 → 英文 |
| `UpdateApiDocs.tsx` | 全部中文 → 英文 |
| `DeleteApiDocs.tsx` | 全部中文 → 英文 |
| `RealtimeApiDocs.tsx` | 全部中文 → 英文 |
| `BatchApiDocs.tsx` | 全部中文 → 英文 |
| `AuthMethodsDocs.tsx` | 全部中文 → 英文 |
| `AuthWithPasswordDocs.tsx` | 全部中文 → 英文 |
| `AuthWithOAuth2Docs.tsx` | 全部中文 → 英文 |
| `AuthWithOtpDocs.tsx` | 全部中文 → 英文 |
| `AuthRefreshDocs.tsx` | 全部中文 → 英文 |
| `VerificationDocs.tsx` | 全部中文 → 英文 |
| `PasswordResetDocs.tsx` | 全部中文 → 英文 |
| `EmailChangeDocs.tsx` | 全部中文 → 英文 |
| `FilterSyntax.tsx` | 全部中文 → 英文 |
| `FieldsQueryParam.tsx` | 全部中文 → 英文 |
| `apiDocsUtils.ts` | FILTER_OPERATORS 描述 → 英文 |

---

## 5. UI Reference

### 5.1 SDK 选项卡布局

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌────────────┬────────────┐                              [📋] │
│  │ JavaScript │    Dart    │                                   │
│  └────────────┴────────────┘                                   │
│  ┌─────────────────────────────────────────────────────────────┐
│  │ import PocketBase from 'pocketbase';                        │
│  │                                                             │
│  │ const pb = new PocketBase('http://127.0.0.1:8090');         │
│  │ ...                                                         │
│  └─────────────────────────────────────────────────────────────┘
│                                                 JavaScript SDK ← 链接
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 响应示例 Tab 布局

```
┌─────────────────────────────────────────────────────────────────┐
│  Responses                                                      │
│  ┌─────┬─────┬─────┐                                           │
│  │ 200 │ 400 │ 403 │  ← Tab 按钮                               │
│  └─────┴─────┴─────┘                                           │
│  ┌─────────────────────────────────────────────────────────────┐
│  │ {                                                           │
│  │   "page": 1,                                                │
│  │   "perPage": 30,                                            │
│  │   ...                                                       │
│  │ }                                                           │
│  └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 禁用 Tab 样式

```
┌─────────────────────────────────────────────────────────────────┐
│  Nav                                                            │
│  ├── List/Search        ← 可点击                               │
│  ├── View               ← 可点击                               │
│  ├── ...                                                       │
│  ├─────────────────                                            │
│  ├── List auth methods  ← 可点击                               │
│  ├── Auth with password ← 灰色，不可点击，显示 tooltip         │
│  ├── Auth with OAuth2   ← 灰色，不可点击                       │
│  └── ...                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | SDK 选项与 UI 版本一致 | 100% | JavaScript + Dart only |
| SC-002 | 所有文案为英文 | 100% | 无中文 |
| SC-003 | Auth Tab 禁用逻辑正确 | 100% | 功能测试 |
| SC-004 | 响应示例 Tab 切换 | 100% | 功能测试 |
| SC-005 | 代码语法高亮 | 100% | 视觉验证 |
| SC-006 | 测试覆盖率 | ≥ 80% | Jest coverage |

---

## 7. File Structure

### 新增文件

```
webui/src/features/collections/components/docs/
├── ResponseTabs.tsx           # 响应示例 Tab 组件 (FR-007)
```

### 修改文件

```
webui/src/features/collections/components/docs/
├── SdkTabs.tsx               # 移除 cURL，添加偏好存储和链接 (FR-001~003)
├── CodeBlock.tsx             # 集成语法高亮 (FR-008)
├── CollectionDocsPanel.tsx   # Tab 禁用逻辑 (FR-004~005)
├── ListApiDocs.tsx           # 文案英文化 + 字段列表 (FR-006, FR-009)
├── ViewApiDocs.tsx           # 文案英文化
├── CreateApiDocs.tsx         # 文案英文化
├── UpdateApiDocs.tsx         # 文案英文化
├── DeleteApiDocs.tsx         # 文案英文化
├── RealtimeApiDocs.tsx       # 文案英文化
├── BatchApiDocs.tsx          # 文案英文化
├── AuthMethodsDocs.tsx       # 文案英文化
├── AuthWithPasswordDocs.tsx  # 文案英文化
├── AuthWithOAuth2Docs.tsx    # 文案英文化
├── AuthWithOtpDocs.tsx       # 文案英文化
├── AuthRefreshDocs.tsx       # 文案英文化
├── VerificationDocs.tsx      # 文案英文化
├── PasswordResetDocs.tsx     # 文案英文化
├── EmailChangeDocs.tsx       # 文案英文化
├── FilterSyntax.tsx          # 文案英文化 + 字段列表 (FR-010)
├── FieldsQueryParam.tsx      # 文案英文化

webui/src/lib/
└── apiDocsUtils.ts           # FILTER_OPERATORS 描述英文化
```

---

## 8. Dependencies

### 内部依赖

| 组件 | 用途 | 状态 |
|------|------|------|
| `ui/src/components/base/SdkTabs.svelte` | SDK 选项卡参考实现 | ✅ 参考 |
| `ui/src/components/base/CodeBlock.svelte` | 代码块参考实现 | ✅ 参考 |
| `ui/src/components/collections/docs/*.svelte` | 文档组件参考实现 | ✅ 参考 |

### 外部依赖

| 依赖 | 用途 | 版本 | 状态 |
|------|------|------|------|
| `prismjs` | 代码语法高亮 | ^1.29.0 | 🔴 **待添加** |
| `@types/prismjs` | TypeScript 类型 | ^1.26.0 | 🔴 **待添加** |

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Prism.js 包体积较大 | Medium | Low | 按需加载语言包 |
| 文案修改遗漏 | Low | Medium | 使用 grep 搜索中文字符 |
| Tab 禁用逻辑复杂 | Low | Low | 参考 UI 版本实现 |

---

## 10. Assumptions

1. WebUI 项目支持添加新的 npm 依赖
2. Prism.js 可以在 React 项目中正常使用
3. UI 版本的英文文案是正确的参考标准
4. SDK 文档链接 URL 不会频繁变更
