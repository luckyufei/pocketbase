# Tasks: WebUI API Preview 功能 1:1 对齐

**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Created**: 2026-02-05  
**Branch**: `023-webui-api-preview-alignment`

---

## Progress Summary

| Phase | Description | Progress | Status |
|-------|-------------|----------|--------|
| Phase 1 | 基础设施 (Infrastructure) | 3/3 | ✅ Completed |
| Phase 2 | SDK 选项卡对齐 (SDK Tabs) | 4/4 | ✅ Completed |
| Phase 3 | Auth Tab 禁用逻辑 | 4/4 | ✅ Completed |
| Phase 4 | 文案英文化 (Text Localization) | 12/12 | ✅ Completed |
| Phase 5 | 响应示例优化 (Response Examples) | 3/3 | ✅ Completed |
| Phase 6 | 字段列表显示 (Field List) | 3/3 | ✅ Completed |
| Phase 7 | 测试 (Testing) | 3/3 | ✅ Completed |

**Total Progress**: 32/32 tasks completed

---

## Phase 1: 基础设施 (Infrastructure)

### Task P1-T1: 添加 Prism.js 依赖

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
安装 Prism.js 及其 TypeScript 类型定义，用于代码语法高亮。

#### Acceptance Criteria
- [x] `prismjs` 包已添加到 `package.json`
- [x] `@types/prismjs` 类型包已添加到 `devDependencies`
- [x] `npm install` 成功执行

#### Implementation Steps

1. 在 `webui` 目录执行命令:
```bash
cd webui
npm install prismjs
npm install -D @types/prismjs
```

2. 验证 `package.json` 已更新

#### Files to Modify
- `webui/package.json`

---

### Task P1-T2: 重构 CodeBlock 组件支持语法高亮

**Priority**: P0  
**Estimated**: 45 min  
**Status**: ✅ Completed

#### Description
重构 `CodeBlock.tsx` 组件，集成 Prism.js 实现代码语法高亮。

#### Reference (UI Version)
`ui/src/components/base/CodeBlock.svelte`:
```javascript
function highlight(code) {
    code = Prism.plugins.NormalizeWhitespace.normalize(code, {
        "remove-trailing": true,
        "remove-indent": true,
        "left-trim": true,
        "right-trim": true,
    });
    return Prism.highlight(code, Prism.languages[language], language);
}
```

#### Current Implementation (WebUI)
`webui/src/features/collections/components/docs/CodeBlock.tsx`:
```tsx
<pre className="...">
    <code>{content.trim()}</code>  // 无语法高亮
</pre>
```

#### Target Implementation
```tsx
import { useMemo } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-dart'
import 'prismjs/components/prism-json'
import 'prismjs/plugins/normalize-whitespace/prism-normalize-whitespace'

interface CodeBlockProps {
  content: string
  language?: 'javascript' | 'dart' | 'json' | 'html' | 'text'
  showCopy?: boolean
  className?: string
}

export function CodeBlock({ content, language = 'javascript', showCopy = true, className }: CodeBlockProps) {
  const highlighted = useMemo(() => {
    if (language === 'text' || !Prism.languages[language]) {
      return content.trim()
    }
    
    const normalized = Prism.plugins.NormalizeWhitespace?.normalize(content, {
      'remove-trailing': true,
      'remove-indent': true,
      'left-trim': true,
      'right-trim': true,
    }) || content.trim()
    
    return Prism.highlight(normalized, Prism.languages[language], language)
  }, [content, language])

  return (
    <div className={cn('relative', className)}>
      <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm font-mono">
        <code 
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted }} 
        />
      </pre>
      {showCopy && <CopyButton value={content.trim()} className="absolute top-2 right-2" />}
    </div>
  )
}
```

#### Acceptance Criteria
- [x] CodeBlock 支持 `language` 属性
- [x] JavaScript 代码正确高亮
- [x] Dart 代码正确高亮
- [x] JSON 代码正确高亮
- [x] 代码自动去除首尾空白和缩进

#### Files to Modify
- `webui/src/features/collections/components/docs/CodeBlock.tsx`

#### Test Cases
```typescript
// CodeBlock.test.tsx (单测可选，因为是UI组件)
// 如果需要测试，可以测试 normalize 逻辑
```

---

### Task P1-T3: 创建 ResponseTabs 组件

**Priority**: P1  
**Estimated**: 30 min  
**Status**: ✅ Completed

#### Description
创建响应示例 Tab 切换组件，用于展示不同 HTTP 状态码的响应示例。

#### Reference (UI Version)
`ui/src/components/collections/docs/ListApiDocs.svelte`:
```svelte
<div class="tabs">
    <div class="tabs-header compact combined left">
        {#each responses as response (response.code)}
            <button class="tab-item" class:active={responseTab === response.code}>
                {response.code}
            </button>
        {/each}
    </div>
    <div class="tabs-content">
        {#each responses as response (response.code)}
            <div class="tab-item" class:active={responseTab === response.code}>
                <CodeBlock content={response.body} />
            </div>
        {/each}
    </div>
</div>
```

#### Target Implementation
```tsx
// webui/src/features/collections/components/docs/ResponseTabs.tsx
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CodeBlock } from './CodeBlock'

interface Response {
  code: number
  body: string
}

interface ResponseTabsProps {
  responses: Response[]
  className?: string
}

export function ResponseTabs({ responses, className }: ResponseTabsProps) {
  const [activeCode, setActiveCode] = useState(responses[0]?.code || 200)

  return (
    <div className={className}>
      <div className="section-title">Responses</div>
      <div className="tabs">
        <div className="flex gap-1 mb-2">
          {responses.map((response) => (
            <button
              key={response.code}
              type="button"
              onClick={() => setActiveCode(response.code)}
              className={cn(
                'px-3 py-1 text-sm rounded transition-colors',
                activeCode === response.code
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {response.code}
            </button>
          ))}
        </div>
        {responses.map((response) => (
          <div
            key={response.code}
            className={cn(activeCode === response.code ? 'block' : 'hidden')}
          >
            <CodeBlock content={response.body} language="json" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] 组件显示状态码 Tab 按钮
- [x] 点击 Tab 切换显示对应响应
- [x] 默认显示第一个响应（通常是 200）
- [x] 响应内容使用 CodeBlock 显示（带语法高亮）

#### Files to Create
- `webui/src/features/collections/components/docs/ResponseTabs.tsx`

---

## Phase 2: SDK 选项卡对齐 (SDK Tabs Alignment)

### Task P2-T1: 移除 cURL 选项，只保留 JavaScript + Dart

**Priority**: P0  
**Estimated**: 20 min  
**Status**: ✅ Completed

#### Description
修改 `SdkTabs` 组件，移除 cURL 选项，只保留 JavaScript 和 Dart（与 UI 版本一致）。

#### Current Implementation
```tsx
// webui/src/features/collections/components/docs/SdkTabs.tsx
interface SdkTabsProps {
  js: string
  dart?: string
  curl?: string  // 需要移除
  className?: string
}

const tabs = [
  { id: 'js', label: 'JavaScript', code: js },
  ...(dart ? [{ id: 'dart', label: 'Dart', code: dart }] : []),
  ...(curl ? [{ id: 'curl', label: 'cURL', code: curl }] : []),  // 需要移除
]
```

#### Target Implementation
```tsx
interface SdkTabsProps {
  js: string
  dart: string  // 必需参数
  className?: string
}

const tabs = [
  { id: 'javascript', label: 'JavaScript', code: js },
  { id: 'dart', label: 'Dart', code: dart },
]
```

#### Acceptance Criteria
- [x] `SdkTabs` 接口中移除 `curl` 参数
- [x] `dart` 参数从可选改为必需
- [x] Tab ID 改为 `'javascript'` 和 `'dart'`（与 localStorage key 对应）
- [x] 只显示 JavaScript 和 Dart 两个选项卡

#### Files to Modify
- `webui/src/features/collections/components/docs/SdkTabs.tsx`

---

### Task P2-T2: 添加 SDK 偏好存储到 localStorage

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
添加 SDK 选项卡偏好持久化功能，用户切换 Tab 后刷新页面仍保持选择。

#### Reference (UI Version)
```svelte
// ui/src/components/base/SdkTabs.svelte
const SDK_PREFERENCE_KEY = "pb_sdk_preference";
let activeTab = localStorage.getItem(SDK_PREFERENCE_KEY) || "javascript";

$: if (activeTab) {
    localStorage.setItem(SDK_PREFERENCE_KEY, activeTab);
}
```

#### Target Implementation
```tsx
const SDK_PREFERENCE_KEY = 'pb_sdk_preference'

export function SdkTabs({ js, dart, className }: SdkTabsProps) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SDK_PREFERENCE_KEY) || 'javascript'
    }
    return 'javascript'
  })

  // 保存偏好
  useEffect(() => {
    localStorage.setItem(SDK_PREFERENCE_KEY, activeTab)
  }, [activeTab])

  // ...
}
```

#### Acceptance Criteria
- [x] 使用 `pb_sdk_preference` 作为 localStorage key
- [x] 组件初始化时读取存储的偏好
- [x] Tab 切换时保存偏好
- [x] 刷新页面后保持之前选择的 Tab

#### Files to Modify
- `webui/src/features/collections/components/docs/SdkTabs.tsx`

---

### Task P2-T3: 添加 SDK 文档链接

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
在 SDK 代码示例底部添加官方 SDK 文档链接。

#### Reference (UI Version)
```svelte
// ui/src/components/base/SdkTabs.svelte
$: sdkExamples = [
    {
        title: "JavaScript",
        language: "javascript",
        content: js,
        url: import.meta.env.PB_JS_SDK_URL,
    },
    {
        title: "Dart",
        language: "dart",
        content: dart,
        url: import.meta.env.PB_DART_SDK_URL,
    },
];

<!-- 底部链接 -->
<div class="txt-right">
    <em class="txt-sm txt-hint">
        <a href={example.url} target="_blank" rel="noopener noreferrer">
            {example.title} SDK
        </a>
    </em>
</div>
```

#### Target Implementation
```tsx
const PB_JS_SDK_URL = 'https://github.com/pocketbase/js-sdk'
const PB_DART_SDK_URL = 'https://github.com/pocketbase/dart-sdk'

const sdkExamples = [
  { id: 'javascript', title: 'JavaScript', code: js, url: PB_JS_SDK_URL },
  { id: 'dart', title: 'Dart', code: dart, url: PB_DART_SDK_URL },
]

// 在组件底部添加
<div className="text-right mt-2">
  <em className="text-sm text-muted-foreground">
    <a 
      href={currentSdk.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="hover:underline"
    >
      {currentSdk.title} SDK
    </a>
  </em>
</div>
```

#### Acceptance Criteria
- [x] JavaScript Tab 底部显示 "JavaScript SDK" 链接
- [x] Dart Tab 底部显示 "Dart SDK" 链接
- [x] 链接在新标签页打开
- [x] 链接样式为斜体灰色文字

#### Files to Modify
- `webui/src/features/collections/components/docs/SdkTabs.tsx`

---

### Task P2-T4: 更新所有 Docs 组件移除 curl 参数

**Priority**: P0  
**Estimated**: 30 min  
**Status**: ✅ Completed

#### Description
更新所有使用 `SdkTabs` 的文档组件，移除 `curl` 参数的传递。

#### Files to Modify
以下文件需要移除 `curl={...}` 参数（如果有的话）：

1. `ListApiDocs.tsx` - 检查并确保只传 `js` 和 `dart`
2. `ViewApiDocs.tsx`
3. `CreateApiDocs.tsx`
4. `UpdateApiDocs.tsx`
5. `DeleteApiDocs.tsx`
6. `RealtimeApiDocs.tsx`
7. `BatchApiDocs.tsx`
8. `AuthMethodsDocs.tsx`
9. `AuthWithPasswordDocs.tsx`
10. `AuthWithOAuth2Docs.tsx`
11. `AuthWithOtpDocs.tsx`
12. `AuthRefreshDocs.tsx`
13. `VerificationDocs.tsx`
14. `PasswordResetDocs.tsx`
15. `EmailChangeDocs.tsx`

#### Acceptance Criteria
- [x] 所有 Docs 组件只传递 `js` 和 `dart` 参数给 SdkTabs
- [x] 所有组件正常渲染无报错

---

## Phase 3: Auth Tab 禁用逻辑 (Auth Tab Disable Logic)

### Task P3-T1: 修改 Collection 类型定义支持 Auth 配置

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
确保 Collection 类型定义包含 Auth 相关配置字段，用于判断 Tab 禁用状态。

#### Reference (UI Version)
```javascript
// ui/src/components/collections/CollectionDocsPanel.svelte
tabs["auth-with-password"].disabled = !collection.passwordAuth.enabled;
tabs["auth-with-oauth2"].disabled = !collection.oauth2.enabled;
tabs["auth-with-otp"].disabled = !collection.otp.enabled;
```

#### Target Implementation
确认或添加以下类型定义：
```typescript
interface AuthCollection extends Collection {
  type: 'auth'
  passwordAuth?: {
    enabled: boolean
    identityFields?: string[]
  }
  oauth2?: {
    enabled: boolean
    // ...
  }
  otp?: {
    enabled: boolean
    // ...
  }
}
```

#### Acceptance Criteria
- [x] Collection 类型支持 `passwordAuth.enabled`
- [x] Collection 类型支持 `oauth2.enabled`
- [x] Collection 类型支持 `otp.enabled`

#### Files to Modify
- 检查 `webui/src/lib/apiDocsUtils.ts` 或相关类型文件

---

### Task P3-T2: 修改 getCollectionTabs 支持禁用逻辑

**Priority**: P0  
**Estimated**: 30 min  
**Status**: ✅ Completed

#### Description
修改 `getCollectionTabs` 函数，接收完整的 collection 对象，并根据 Auth 配置动态设置 Tab 禁用状态。

#### Current Implementation
```typescript
// webui/src/lib/apiDocsUtils.ts
export function getCollectionTabs(collectionType: string): DocTab[] {
  if (collectionType === 'auth') {
    return [...BASE_TABS, ...AUTH_TABS]
  }
  // ...
}
```

#### Target Implementation
```typescript
interface Collection {
  id: string
  name: string
  type: string
  passwordAuth?: { enabled: boolean }
  oauth2?: { enabled: boolean }
  otp?: { enabled: boolean }
}

export function getCollectionTabs(collection: Collection): DocTab[] {
  if (collection.type === 'view') {
    return [
      { id: 'list', label: 'List/Search' },
      { id: 'view', label: 'View' },
    ]
  }

  if (collection.type === 'auth') {
    const authTabs: DocTab[] = [
      { id: 'auth-methods', label: 'List auth methods' },
      { 
        id: 'auth-with-password', 
        label: 'Auth with password',
        disabled: !collection.passwordAuth?.enabled 
      },
      { 
        id: 'auth-with-oauth2', 
        label: 'Auth with OAuth2',
        disabled: !collection.oauth2?.enabled 
      },
      { 
        id: 'auth-with-otp', 
        label: 'Auth with OTP',
        disabled: !collection.otp?.enabled 
      },
      { id: 'auth-refresh', label: 'Auth refresh' },
      { id: 'verification', label: 'Verification' },
      { id: 'password-reset', label: 'Password reset' },
      { id: 'email-change', label: 'Email change' },
    ]
    return [...BASE_TABS, ...authTabs]
  }

  return [...BASE_TABS]
}
```

#### Acceptance Criteria
- [x] `getCollectionTabs` 接收完整 collection 对象
- [x] `auth-with-password` Tab 根据 `passwordAuth.enabled` 禁用
- [x] `auth-with-oauth2` Tab 根据 `oauth2.enabled` 禁用
- [x] `auth-with-otp` Tab 根据 `otp.enabled` 禁用

#### Files to Modify
- `webui/src/lib/apiDocsUtils.ts`

#### Test Cases
```typescript
// apiDocsUtils.test.ts
describe('getCollectionTabs', () => {
  it('should disable auth-with-password when passwordAuth is disabled', () => {
    const collection = {
      id: '1',
      name: 'users',
      type: 'auth',
      passwordAuth: { enabled: false },
      oauth2: { enabled: true },
      otp: { enabled: true },
    }
    const tabs = getCollectionTabs(collection)
    const passwordTab = tabs.find(t => t.id === 'auth-with-password')
    expect(passwordTab?.disabled).toBe(true)
  })

  it('should enable auth-with-password when passwordAuth is enabled', () => {
    const collection = {
      id: '1',
      name: 'users',
      type: 'auth',
      passwordAuth: { enabled: true },
      oauth2: { enabled: false },
      otp: { enabled: false },
    }
    const tabs = getCollectionTabs(collection)
    const passwordTab = tabs.find(t => t.id === 'auth-with-password')
    expect(passwordTab?.disabled).toBe(false)
  })
})
```

---

### Task P3-T3: CollectionDocsPanel 传递完整 collection 对象

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
修改 `CollectionDocsPanel` 组件，将完整的 collection 对象传递给 `getCollectionTabs` 函数。

#### Current Implementation
```typescript
// webui/src/features/collections/components/docs/CollectionDocsPanel.tsx
const tabs = useMemo(() => {
  if (!collection) return []
  return getCollectionTabs(collection.type)  // 只传递 type
}, [collection])
```

#### Target Implementation
```typescript
const tabs = useMemo(() => {
  if (!collection) return []
  return getCollectionTabs(collection)  // 传递完整 collection
}, [collection])
```

#### Acceptance Criteria
- [x] `getCollectionTabs` 接收完整 collection 对象
- [x] Tab 禁用状态正确显示

#### Files to Modify
- `webui/src/features/collections/components/docs/CollectionDocsPanel.tsx`

---

### Task P3-T4: 禁用 Tab 添加 tooltip 提示

**Priority**: P0  
**Estimated**: 20 min  
**Status**: ✅ Completed

#### Description
为禁用的 Tab 添加 tooltip 提示，说明该功能未启用。

#### Reference (UI Version)
禁用的 Tab 悬停时显示提示 "Not enabled for the collection"

#### Target Implementation
```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// 在 nav 按钮外层包裹 Tooltip
{tabs.map((tab, index) => (
  <div key={tab.id}>
    {/* 分隔线逻辑 */}
    {tab.disabled ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            className={cn(
              'w-full text-left px-3 py-2 text-sm rounded-md',
              'opacity-50 cursor-not-allowed text-slate-400'
            )}
          >
            {tab.label}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Not enabled for the collection</p>
        </TooltipContent>
      </Tooltip>
    ) : (
      <button
        type="button"
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
          activeTab === tab.id
            ? 'bg-blue-50 text-blue-600 font-medium'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
      >
        {tab.label}
      </button>
    )}
  </div>
))}
```

#### Acceptance Criteria
- [x] 禁用 Tab 显示为灰色
- [x] 禁用 Tab 不可点击
- [x] 悬停禁用 Tab 显示 "Not enabled for the collection" 提示

#### Files to Modify
- `webui/src/features/collections/components/docs/CollectionDocsPanel.tsx`

---

## Phase 4: 文案英文化 (Text Localization)

### Task P4-T1: ListApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 30 min  
**Status**: ✅ Completed

#### Description
将 `ListApiDocs.tsx` 中的所有中文文案改为英文。

#### Changes Required

| 行号 | 当前中文 | 目标英文 |
|------|---------|----------|
| ~101 | `获取分页的 {name} 记录列表，支持排序和过滤。` | `Fetch a paginated {name} records list, supporting sorting and filtering.` |
| ~108 | `API 端点` | `API details` |
| ~114 | `需要超级用户 Authorization:TOKEN 头` | `Requires superuser Authorization:TOKEN header` |
| ~121 | `查询参数` | `Query parameters` |
| ~126 | `参数` | `Param` |
| ~127 | `类型` | `Type` |
| ~128 | `说明` | `Description` |
| ~135 | `分页页码（默认为 1）` | `The page (aka. offset) of the paginated list (default to 1).` |
| ~142 | `每页返回的记录数（默认为 30）` | `Specify the max returned records per page (default to 30).` |
| ~150 | `排序字段。使用 -/+ 前缀表示 降序/升序。` | `Specify the records order attribute(s). Add - / + (default) in front of the attribute for DESC / ASC order.` |
| ~160 | `过滤表达式。` | `Filter the returned records. Ex:` |
| ~172 | `自动展开关联记录。支持最多 6 层嵌套。` | `Auto expand record relations. Supports up to 6-levels depth nested relations expansion.` |
| ~185 | `跳过总数查询...可显著提升查询性能。` | `If it is set the total counts query will be skipped and the response fields totalItems and totalPages will have -1 value. This could drastically speed up the search queries when the total counters are not needed or cursor based pagination is used.` |
| ~196 | `响应示例` | `Responses` |

#### Files to Modify
- `webui/src/features/collections/components/docs/ListApiDocs.tsx`

#### Acceptance Criteria
- [x] 所有中文文案已替换为英文
- [x] 文案与 UI 版本 `ListApiDocs.svelte` 一致

---

### Task P4-T2: ViewApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
将 `ViewApiDocs.tsx` 中的所有中文文案改为英文。

#### Reference
参考 `ui/src/components/collections/docs/ViewApiDocs.svelte` 的英文文案。

#### Files to Modify
- `webui/src/features/collections/components/docs/ViewApiDocs.tsx`

---

### Task P4-T3: CreateApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Files to Modify
- `webui/src/features/collections/components/docs/CreateApiDocs.tsx`

---

### Task P4-T4: UpdateApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Files to Modify
- `webui/src/features/collections/components/docs/UpdateApiDocs.tsx`

---

### Task P4-T5: DeleteApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Files to Modify
- `webui/src/features/collections/components/docs/DeleteApiDocs.tsx`

---

### Task P4-T6: RealtimeApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Files to Modify
- `webui/src/features/collections/components/docs/RealtimeApiDocs.tsx`

---

### Task P4-T7: BatchApiDocs 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Files to Modify
- `webui/src/features/collections/components/docs/BatchApiDocs.tsx`

---

### Task P4-T8: Auth 相关 Docs 文案英文化 (8个文件)

**Priority**: P0  
**Estimated**: 60 min  
**Status**: ✅ Completed

#### Description
将所有 Auth 相关文档组件中的中文文案改为英文。

#### Files to Modify
1. `AuthMethodsDocs.tsx`
2. `AuthWithPasswordDocs.tsx`
3. `AuthWithOAuth2Docs.tsx`
4. `AuthWithOtpDocs.tsx`
5. `AuthRefreshDocs.tsx`
6. `VerificationDocs.tsx`
7. `PasswordResetDocs.tsx`
8. `EmailChangeDocs.tsx`

#### Reference
参考对应的 `ui/src/components/collections/docs/` 目录下的 Svelte 组件文案。

#### Acceptance Criteria
- [x] 所有 Auth 文档组件无中文
- [x] 文案与 UI 版本一致

---

### Task P4-T9: FilterSyntax 文案英文化

**Priority**: P0  
**Estimated**: 20 min  
**Status**: ✅ Completed

#### Description
将 `FilterSyntax.tsx` 中的所有中文文案改为英文。

#### Current Implementation
```tsx
// webui/src/features/collections/components/docs/FilterSyntax.tsx
<p className="text-sm text-muted-foreground mb-3">支持的过滤操作符和语法：</p>
<th className="text-left p-2 font-medium w-24">操作符</th>
<th className="text-left p-2 font-medium">说明</th>
<th className="text-left p-2 font-medium w-40">示例</th>
<p className="text-sm font-medium mb-2">过滤示例：</p>
<p className="text-sm font-medium mb-2">特殊值：</p>
<li><code>@now</code> - 当前时间</li>
<li><code>@request.auth.id</code> - 当前认证用户的 ID</li>
// ...
```

#### Target Implementation
参考 UI 版本 `FilterSyntax.svelte` 的结构，使用可展开/收起的详情：

```tsx
export function FilterSyntax({ className }: FilterSyntaxProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="btn btn-sm btn-secondary"
      >
        {expanded ? 'Hide details' : 'Show details'}
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {expanded && (
        <div className="mt-4">
          <p>
            The syntax basically follows the format
            <code>
              <span className="text-green-600">OPERAND</span>
              <span className="text-red-600">OPERATOR</span>
              <span className="text-green-600">OPERAND</span>
            </code>, where:
          </p>
          <ul>
            <li>
              <code className="text-green-600">OPERAND</code> - could be any of the above field literal, 
              string (single or double quoted), number, null, true, false
            </li>
            <li>
              <code className="text-red-600">OPERATOR</code> - is one of:
              <ul>
                <li><code>=</code> Equal</li>
                <li><code>!=</code> NOT equal</li>
                <li><code>&gt;</code> Greater than</li>
                <li><code>&gt;=</code> Greater than or equal</li>
                <li><code>&lt;</code> Less than</li>
                <li><code>&lt;=</code> Less than or equal</li>
                <li><code>~</code> Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)</li>
                <li><code>!~</code> NOT Like/Contains</li>
                <li><code>?=</code> <em>Any/At least one of</em> Equal</li>
                <li><code>?!=</code> <em>Any/At least one of</em> NOT equal</li>
                <li><code>?&gt;</code> <em>Any/At least one of</em> Greater than</li>
                <li><code>?&gt;=</code> <em>Any/At least one of</em> Greater than or equal</li>
                <li><code>?&lt;</code> <em>Any/At least one of</em> Less than</li>
                <li><code>?&lt;=</code> <em>Any/At least one of</em> Less than or equal</li>
                <li><code>?~</code> <em>Any/At least one of</em> Like/Contains</li>
                <li><code>?!~</code> <em>Any/At least one of</em> NOT Like/Contains</li>
              </ul>
            </li>
          </ul>
          <p>
            To group and combine several expressions you could use brackets
            <code>(...)</code>, <code>&amp;&amp;</code> (AND) and <code>||</code> (OR) tokens.
          </p>
        </div>
      )}
    </div>
  )
}
```

#### Acceptance Criteria
- [x] 所有中文改为英文
- [x] 使用可展开/收起的详情按钮
- [x] 操作符列表完整

#### Files to Modify
- `webui/src/features/collections/components/docs/FilterSyntax.tsx`

---

### Task P4-T10: FieldsQueryParam 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
将 `FieldsQueryParam.tsx` 中的所有中文文案改为英文。

#### Reference
参考 `ui/src/components/collections/docs/FieldsQueryParam.svelte`

#### Files to Modify
- `webui/src/features/collections/components/docs/FieldsQueryParam.tsx`

---

### Task P4-T11: apiDocsUtils FILTER_OPERATORS 英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
将 `apiDocsUtils.ts` 中 `FILTER_OPERATORS` 的中文描述改为英文。

#### Current Implementation
```typescript
// webui/src/lib/apiDocsUtils.ts
export const FILTER_OPERATORS = [
  { operator: '=', description: '等于', example: "status='active'" },
  { operator: '!=', description: '不等于', example: "status!='deleted'" },
  { operator: '>', description: '大于', example: 'count>10' },
  { operator: '>=', description: '大于等于', example: 'count>=10' },
  { operator: '<', description: '小于', example: 'count<100' },
  { operator: '<=', description: '小于等于', example: 'count<=100' },
  { operator: '~', description: '包含 (LIKE)', example: "name~'test'" },
  { operator: '!~', description: '不包含', example: "name!~'test'" },
  { operator: '?=', description: '数组包含任意一个', example: "tags?='important'" },
  { operator: '?!=', description: '数组不包含', example: "tags?!='spam'" },
  { operator: '?~', description: '数组任意一个包含', example: "tags?~'test'" },
  { operator: '?!~', description: '数组任意一个不包含', example: "tags?!~'test'" },
]
```

#### Target Implementation
```typescript
export const FILTER_OPERATORS = [
  { operator: '=', description: 'Equal', example: "status='active'" },
  { operator: '!=', description: 'NOT equal', example: "status!='deleted'" },
  { operator: '>', description: 'Greater than', example: 'count>10' },
  { operator: '>=', description: 'Greater than or equal', example: 'count>=10' },
  { operator: '<', description: 'Less than', example: 'count<100' },
  { operator: '<=', description: 'Less than or equal', example: 'count<=100' },
  { operator: '~', description: 'Like/Contains', example: "name~'test'" },
  { operator: '!~', description: 'NOT Like/Contains', example: "name!~'test'" },
  { operator: '?=', description: 'Any/At least one of Equal', example: "tags?='important'" },
  { operator: '?!=', description: 'Any/At least one of NOT equal', example: "tags?!='spam'" },
  { operator: '?~', description: 'Any/At least one of Like/Contains', example: "tags?~'test'" },
  { operator: '?!~', description: 'Any/At least one of NOT Like/Contains', example: "tags?!~'test'" },
]
```

#### Files to Modify
- `webui/src/lib/apiDocsUtils.ts`

---

### Task P4-T12: CollectionDocsPanel 文案英文化

**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
将 `CollectionDocsPanel.tsx` 中的中文文案改为英文。

#### Current Implementation
```tsx
// webui/src/features/collections/components/docs/CollectionDocsPanel.tsx
<h2 className="font-semibold text-sm">API 文档</h2>
// ...
<h3 className="text-sm font-medium mb-2">API 端点</h3>
<h3 className="text-sm font-medium mb-2">查询参数</h3>
<th className="text-left p-2 font-medium">参数</th>
<th className="text-left p-2 font-medium">类型</th>
<th className="text-left p-2 font-medium">说明</th>
<h3 className="text-sm font-medium mb-2">过滤语法</h3>
<h3 className="text-sm font-medium">代码示例</h3>
<h3 className="text-sm font-medium mb-2">字段</h3>
<th className="text-left p-2 font-medium">字段名</th>
<th className="text-left p-2 font-medium">类型</th>
<th className="text-left p-2 font-medium">必填</th>
<span className="text-red-500">是</span>
<span className="text-muted-foreground">否</span>
```

#### Target Implementation
```tsx
// 侧边栏标题移除或保持英文
// <h2 className="font-semibold text-sm">API 文档</h2>  -> 移除或改为空

// 其他中文改为英文
<h3>API details</h3>
<h3>Query parameters</h3>
<th>Param</th>
<th>Type</th>
<th>Description</th>
<h3>Filter syntax</h3>
<h3>Code examples</h3>
<h3>Fields</h3>
<th>Field</th>
<th>Type</th>
<th>Required</th>
<span>Yes</span>
<span>No</span>
```

#### Files to Modify
- `webui/src/features/collections/components/docs/CollectionDocsPanel.tsx`

---

### Task P4-T13: getFieldQueryParams 函数英文化

**Priority**: P0  
**Estimated**: 10 min  
**Status**: ✅ Completed

#### Description
将 `apiDocsUtils.ts` 中 `getFieldQueryParams` 函数返回的中文描述改为英文。

#### Current Implementation
```typescript
export function getFieldQueryParams(): QueryParam[] {
  return [
    { name: 'page', type: 'Number', description: '页码 (默认为 1)', default: '1' },
    { name: 'perPage', type: 'Number', description: '每页记录数 (默认为 30, 最大 500)', default: '30' },
    { name: 'sort', type: 'String', description: '排序字段，使用 - 前缀表示降序。支持多字段排序，用逗号分隔。' },
    { name: 'filter', type: 'String', description: '过滤表达式，支持 =, !=, >, >=, <, <=, ~, !~ 等操作符' },
    { name: 'expand', type: 'String', description: '展开关联记录，用逗号分隔多个关联字段' },
    { name: 'fields', type: 'String', description: '指定返回的字段，用逗号分隔' },
    { name: 'skipTotal', type: 'Boolean', description: '跳过总数统计以提高性能', default: 'false' },
  ]
}
```

#### Target Implementation
```typescript
export function getFieldQueryParams(): QueryParam[] {
  return [
    { name: 'page', type: 'Number', description: 'The page (aka. offset) of the paginated list (default to 1).', default: '1' },
    { name: 'perPage', type: 'Number', description: 'Specify the max returned records per page (default to 30).', default: '30' },
    { name: 'sort', type: 'String', description: 'Specify the records order attribute(s). Add - / + (default) in front of the attribute for DESC / ASC order.' },
    { name: 'filter', type: 'String', description: 'Filter the returned records.' },
    { name: 'expand', type: 'String', description: 'Auto expand record relations. Supports up to 6-levels depth nested relations expansion.' },
    { name: 'fields', type: 'String', description: 'Comma separated string of the fields to return in the JSON response.' },
    { name: 'skipTotal', type: 'Boolean', description: 'If it is set the total counts query will be skipped and the response fields totalItems and totalPages will have -1 value.', default: 'false' },
  ]
}
```

#### Files to Modify
- `webui/src/lib/apiDocsUtils.ts`

---

## Phase 5: 响应示例优化 (Response Examples)

### Task P5-T1: 确认 ResponseTabs 组件已创建

**Priority**: P1  
**Estimated**: 5 min  
**Status**: ✅ Completed

#### Description
确认 Phase 1 的 ResponseTabs 组件已创建，如果未创建则现在创建。

#### Dependency
- Task P1-T3

---

### Task P5-T2: ListApiDocs 使用 ResponseTabs

**Priority**: P1  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
修改 `ListApiDocs.tsx`，使用 `ResponseTabs` 组件替换当前的响应示例垂直列表。

#### Current Implementation
```tsx
<div>
  <h4 className="text-sm font-medium mb-2">响应示例</h4>
  <div className="space-y-3">
    {responses.map((resp) => (
      <div key={resp.code}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ...`}>
            {resp.code}
          </span>
        </div>
        <CodeBlock content={resp.body} language="json" />
      </div>
    ))}
  </div>
</div>
```

#### Target Implementation
```tsx
import { ResponseTabs } from './ResponseTabs'

// ...

<ResponseTabs responses={responses} />
```

#### Files to Modify
- `webui/src/features/collections/components/docs/ListApiDocs.tsx`

---

### Task P5-T3: 其他 Docs 组件使用 ResponseTabs

**Priority**: P1  
**Estimated**: 45 min  
**Status**: ✅ Completed

#### Description
更新所有其他文档组件使用 `ResponseTabs` 组件。

#### Files to Modify
1. `ViewApiDocs.tsx`
2. `CreateApiDocs.tsx`
3. `UpdateApiDocs.tsx`
4. `DeleteApiDocs.tsx`
5. `RealtimeApiDocs.tsx`
6. `BatchApiDocs.tsx`
7. `AuthMethodsDocs.tsx`
8. `AuthWithPasswordDocs.tsx`
9. `AuthWithOAuth2Docs.tsx`
10. `AuthWithOtpDocs.tsx`
11. `AuthRefreshDocs.tsx`
12. `VerificationDocs.tsx`
13. `PasswordResetDocs.tsx`
14. `EmailChangeDocs.tsx`

---

## Phase 6: 字段列表显示 (Field List Display)

### Task P6-T1: 创建 getAllCollectionIdentifiers 工具函数

**Priority**: P1  
**Estimated**: 20 min  
**Status**: ✅ Completed

#### Description
创建工具函数获取 Collection 的所有字段名称，用于在 sort/filter 参数说明中显示。

#### Reference (UI Version)
```javascript
// ui/src/utils/CommonHelper.js
getAllCollectionIdentifiers(collection) {
    let result = [];

    if (collection?.type === "auth") {
        result = result.concat([
            "id",
            "created",
            "updated",
            "username",
            "email",
            "emailVisibility",
            "verified",
        ]);
    } else if (collection?.type === "view") {
        result = result.concat(["id"]);
    } else {
        result = result.concat(["id", "created", "updated"]);
    }

    const fields = collection?.fields || [];
    for (let field of fields) {
        const name = field?.name;
        if (name && !result.includes(name)) {
            result.push(name);
        }
    }

    return result;
}
```

#### Target Implementation
```typescript
// webui/src/lib/apiDocsUtils.ts
export function getAllCollectionIdentifiers(collection: {
  type: string
  fields?: Array<{ name: string }>
}): string[] {
  let result: string[] = []

  if (collection.type === 'auth') {
    result = ['id', 'created', 'updated', 'username', 'email', 'emailVisibility', 'verified']
  } else if (collection.type === 'view') {
    result = ['id']
  } else {
    result = ['id', 'created', 'updated']
  }

  const fields = collection.fields || []
  for (const field of fields) {
    const name = field.name
    if (name && !result.includes(name)) {
      result.push(name)
    }
  }

  return result
}
```

#### Files to Modify
- `webui/src/lib/apiDocsUtils.ts`

#### Test Cases
```typescript
describe('getAllCollectionIdentifiers', () => {
  it('should return base fields for base collection', () => {
    const result = getAllCollectionIdentifiers({ type: 'base', fields: [] })
    expect(result).toContain('id')
    expect(result).toContain('created')
    expect(result).toContain('updated')
  })

  it('should return auth fields for auth collection', () => {
    const result = getAllCollectionIdentifiers({ type: 'auth', fields: [] })
    expect(result).toContain('email')
    expect(result).toContain('username')
    expect(result).toContain('verified')
  })

  it('should include custom fields', () => {
    const result = getAllCollectionIdentifiers({
      type: 'base',
      fields: [{ name: 'title' }, { name: 'content' }]
    })
    expect(result).toContain('title')
    expect(result).toContain('content')
  })
})
```

---

### Task P6-T2: ListApiDocs sort 参数添加字段列表

**Priority**: P1  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
在 ListApiDocs 的 sort 参数说明中显示支持的字段列表。

#### Reference (UI Version)
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

#### Target Implementation
```tsx
import { getAllCollectionIdentifiers } from '@/lib/apiDocsUtils'

const fieldNames = useMemo(() => getAllCollectionIdentifiers(collection), [collection])

// 在 sort 参数说明中
<td className="p-2 text-muted-foreground">
  Specify the records order attribute(s). Add <code>-</code> / <code>+</code> (default) 
  in front of the attribute for DESC / ASC order.
  <CodeBlock content="?sort=-created,id" showCopy={false} className="mt-1" />
  <p className="mt-2">
    <strong>Supported record sort fields:</strong><br />
    <code>@random</code>, <code>@rowid</code>, 
    {fieldNames.map((name, i) => (
      <span key={name}>
        <code>{name}</code>{i < fieldNames.length - 1 ? ', ' : ''}
      </span>
    ))}
  </p>
</td>
```

#### Files to Modify
- `webui/src/features/collections/components/docs/ListApiDocs.tsx`

---

### Task P6-T3: FilterSyntax 添加字段列表

**Priority**: P1  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
在 FilterSyntax 组件中显示支持的过滤字段列表。

#### Reference (UI Version)
UI 版本的 filter 参数说明包含：
```
Supported filter fields: @collection.*, @request.*, @rowid, id, created, updated, ...
```

#### Target Implementation
修改 FilterSyntax 组件接收 collection 参数，显示支持的字段列表：

```tsx
interface FilterSyntaxProps {
  collection?: {
    type: string
    fields?: Array<{ name: string }>
  }
  className?: string
}

export function FilterSyntax({ collection, className }: FilterSyntaxProps) {
  const fieldNames = useMemo(() => {
    if (!collection) return []
    return getAllCollectionIdentifiers(collection)
  }, [collection])

  return (
    <div className={className}>
      {/* 显示支持的字段 */}
      {fieldNames.length > 0 && (
        <p className="text-sm mb-2">
          <strong>Supported filter fields:</strong><br />
          <code>@collection.*</code>, <code>@request.*</code>, <code>@rowid</code>, 
          {fieldNames.map((name, i) => (
            <span key={name}>
              <code>{name}</code>{i < fieldNames.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      )}
      
      {/* 展开/收起的操作符详情 */}
      {/* ... */}
    </div>
  )
}
```

#### Files to Modify
- `webui/src/features/collections/components/docs/FilterSyntax.tsx`
- `webui/src/features/collections/components/docs/ListApiDocs.tsx` (传递 collection 参数)

---

## Phase 7: 测试 (Testing)

### Task P7-T1: apiDocsUtils 单元测试

**Priority**: P0  
**Estimated**: 45 min  
**Status**: ✅ Completed

#### Description
为 `apiDocsUtils.ts` 中的工具函数编写单元测试。

#### Test Cases

```typescript
// webui/src/lib/__tests__/apiDocsUtils.test.ts

import {
  getApiEndpoint,
  getCollectionTabs,
  getHttpMethod,
  getAllCollectionIdentifiers,
  FILTER_OPERATORS,
} from '../apiDocsUtils'

describe('apiDocsUtils', () => {
  describe('getApiEndpoint', () => {
    it('should return correct endpoint for list action', () => {
      expect(getApiEndpoint('posts', 'list')).toBe('/api/collections/posts/records')
    })

    it('should return correct endpoint for view action', () => {
      expect(getApiEndpoint('posts', 'view')).toBe('/api/collections/posts/records/:id')
    })

    it('should return correct endpoint for auth actions', () => {
      expect(getApiEndpoint('users', 'auth-with-password')).toBe('/api/collections/users/auth-with-password')
    })
  })

  describe('getCollectionTabs', () => {
    it('should return 2 tabs for view collection', () => {
      const tabs = getCollectionTabs({ type: 'view', id: '1', name: 'test' })
      expect(tabs).toHaveLength(2)
      expect(tabs[0].id).toBe('list')
      expect(tabs[1].id).toBe('view')
    })

    it('should return 7 tabs for base collection', () => {
      const tabs = getCollectionTabs({ type: 'base', id: '1', name: 'test' })
      expect(tabs).toHaveLength(7)
    })

    it('should return 15 tabs for auth collection', () => {
      const tabs = getCollectionTabs({
        type: 'auth',
        id: '1',
        name: 'users',
        passwordAuth: { enabled: true },
        oauth2: { enabled: true },
        otp: { enabled: true },
      })
      expect(tabs).toHaveLength(15) // 7 base + 8 auth
    })

    it('should disable auth-with-password when passwordAuth is disabled', () => {
      const tabs = getCollectionTabs({
        type: 'auth',
        id: '1',
        name: 'users',
        passwordAuth: { enabled: false },
        oauth2: { enabled: true },
        otp: { enabled: true },
      })
      const passwordTab = tabs.find(t => t.id === 'auth-with-password')
      expect(passwordTab?.disabled).toBe(true)
    })

    it('should disable auth-with-oauth2 when oauth2 is disabled', () => {
      const tabs = getCollectionTabs({
        type: 'auth',
        id: '1',
        name: 'users',
        passwordAuth: { enabled: true },
        oauth2: { enabled: false },
        otp: { enabled: true },
      })
      const oauth2Tab = tabs.find(t => t.id === 'auth-with-oauth2')
      expect(oauth2Tab?.disabled).toBe(true)
    })

    it('should disable auth-with-otp when otp is disabled', () => {
      const tabs = getCollectionTabs({
        type: 'auth',
        id: '1',
        name: 'users',
        passwordAuth: { enabled: true },
        oauth2: { enabled: true },
        otp: { enabled: false },
      })
      const otpTab = tabs.find(t => t.id === 'auth-with-otp')
      expect(otpTab?.disabled).toBe(true)
    })
  })

  describe('getHttpMethod', () => {
    it('should return GET for list and view', () => {
      expect(getHttpMethod('list')).toBe('GET')
      expect(getHttpMethod('view')).toBe('GET')
    })

    it('should return POST for create and auth actions', () => {
      expect(getHttpMethod('create')).toBe('POST')
      expect(getHttpMethod('auth-with-password')).toBe('POST')
    })

    it('should return PATCH for update', () => {
      expect(getHttpMethod('update')).toBe('PATCH')
    })

    it('should return DELETE for delete', () => {
      expect(getHttpMethod('delete')).toBe('DELETE')
    })
  })

  describe('getAllCollectionIdentifiers', () => {
    it('should return base fields for base collection', () => {
      const result = getAllCollectionIdentifiers({ type: 'base', fields: [] })
      expect(result).toEqual(['id', 'created', 'updated'])
    })

    it('should return auth fields for auth collection', () => {
      const result = getAllCollectionIdentifiers({ type: 'auth', fields: [] })
      expect(result).toContain('email')
      expect(result).toContain('username')
      expect(result).toContain('verified')
      expect(result).toContain('emailVisibility')
    })

    it('should return only id for view collection', () => {
      const result = getAllCollectionIdentifiers({ type: 'view', fields: [] })
      expect(result).toEqual(['id'])
    })

    it('should include custom fields', () => {
      const result = getAllCollectionIdentifiers({
        type: 'base',
        fields: [{ name: 'title' }, { name: 'content' }]
      })
      expect(result).toContain('title')
      expect(result).toContain('content')
    })

    it('should not duplicate fields', () => {
      const result = getAllCollectionIdentifiers({
        type: 'base',
        fields: [{ name: 'id' }, { name: 'title' }]
      })
      const idCount = result.filter(f => f === 'id').length
      expect(idCount).toBe(1)
    })
  })

  describe('FILTER_OPERATORS', () => {
    it('should have English descriptions', () => {
      FILTER_OPERATORS.forEach(op => {
        // 确保没有中文字符
        expect(op.description).not.toMatch(/[\u4e00-\u9fa5]/)
      })
    })

    it('should have all required operators', () => {
      const operators = FILTER_OPERATORS.map(op => op.operator)
      expect(operators).toContain('=')
      expect(operators).toContain('!=')
      expect(operators).toContain('>')
      expect(operators).toContain('>=')
      expect(operators).toContain('<')
      expect(operators).toContain('<=')
      expect(operators).toContain('~')
      expect(operators).toContain('!~')
    })
  })
})
```

#### Files to Create
- `webui/src/lib/__tests__/apiDocsUtils.test.ts`

#### Acceptance Criteria
- [x] 所有测试通过
- [x] 覆盖率 ≥ 80%

---

### Task P7-T2: SdkTabs 组件测试

**Priority**: P0  
**Estimated**: 30 min  
**Status**: ✅ Completed

#### Description
为 `SdkTabs` 组件编写单元测试，确保 SDK 偏好存储和链接显示正确。

#### Test Cases

```typescript
// webui/src/features/collections/components/docs/__tests__/SdkTabs.test.tsx

import { render, screen, fireEvent } from '@testing-library/react'
import { SdkTabs } from '../SdkTabs'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('SdkTabs', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  const defaultProps = {
    js: 'const js = "test"',
    dart: 'final dart = "test"',
  }

  it('should render JavaScript and Dart tabs', () => {
    render(<SdkTabs {...defaultProps} />)
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.getByText('Dart')).toBeInTheDocument()
  })

  it('should not render cURL tab', () => {
    render(<SdkTabs {...defaultProps} />)
    expect(screen.queryByText('cURL')).not.toBeInTheDocument()
  })

  it('should display JavaScript code by default', () => {
    render(<SdkTabs {...defaultProps} />)
    expect(screen.getByText(/const js/)).toBeInTheDocument()
  })

  it('should switch to Dart code when clicking Dart tab', () => {
    render(<SdkTabs {...defaultProps} />)
    fireEvent.click(screen.getByText('Dart'))
    expect(screen.getByText(/final dart/)).toBeInTheDocument()
  })

  it('should save preference to localStorage', () => {
    render(<SdkTabs {...defaultProps} />)
    fireEvent.click(screen.getByText('Dart'))
    expect(localStorageMock.getItem('pb_sdk_preference')).toBe('dart')
  })

  it('should restore preference from localStorage', () => {
    localStorageMock.setItem('pb_sdk_preference', 'dart')
    render(<SdkTabs {...defaultProps} />)
    expect(screen.getByText(/final dart/)).toBeInTheDocument()
  })

  it('should display SDK link', () => {
    render(<SdkTabs {...defaultProps} />)
    expect(screen.getByText('JavaScript SDK')).toHaveAttribute(
      'href',
      'https://github.com/pocketbase/js-sdk'
    )
  })

  it('should update SDK link when switching tabs', () => {
    render(<SdkTabs {...defaultProps} />)
    fireEvent.click(screen.getByText('Dart'))
    expect(screen.getByText('Dart SDK')).toHaveAttribute(
      'href',
      'https://github.com/pocketbase/dart-sdk'
    )
  })
})
```

#### Files to Create
- `webui/src/features/collections/components/docs/__tests__/SdkTabs.test.tsx`

---

### Task P7-T3:
**Priority**: P0  
**Estimated**: 15 min  
**Status**: ✅ Completed

#### Description
使用 grep 命令验证所有文档组件中不存在中文字符。

#### Verification Command

```bash
cd webui/src/features/collections/components/docs
grep -r "[\u4e00-\u9fa5]" *.tsx

cd webui/src/lib
grep -r "[\u4e00-\u9fa5]" apiDocsUtils.ts
```

#### Expected Result
- 命令应该没有任何输出（表示没有中文字符）

#### Alternative: 添加测试

```typescript
// webui/src/features/collections/components/docs/__tests__/no-chinese.test.ts

import fs from 'fs'
import path from 'path'

const CHINESE_REGEX = /[\u4e00-\u9fa5]/

describe('No Chinese characters in docs components', () => {
  const docsDir = path.join(__dirname, '..')
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.tsx'))

  files.forEach(file => {
    it(`${file} should not contain Chinese characters`, () => {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf-8')
      const matches = content.match(CHINESE_REGEX)
      expect(matches).toBeNull()
    })
  })
})
```

---

## Verification Checklist

执行完所有任务后，使用以下清单进行验证：

### SDK 选项卡
- [x] 只显示 JavaScript 和 Dart 两个选项
- [x] 切换后刷新页面保持选择
- [x] 底部显示 SDK 文档链接

### Auth Tab 禁用
- [x] passwordAuth 禁用时 Tab 显示为禁用
- [x] oauth2 禁用时 Tab 显示为禁用  
- [x] otp 禁用时 Tab 显示为禁用
- [x] 禁用 Tab 悬停显示 tooltip

### 文案
- [x] 所有组件无中文
- [x] 文案与 UI 版本一致

### 响应示例
- [x] 使用 Tab 切换方式
- [x] 默认显示 200

### 代码高亮
- [x] JavaScript 代码正确高亮
- [x] Dart 代码正确高亮
- [x] JSON 代码正确高亮

### 字段列表
- [x] sort 参数显示支持字段
- [x] filter 参数显示支持字段

### 测试
- [x] 所有单元测试通过
- [x] 覆盖率 ≥ 80%

---

## Notes

1. **TDD 流程**: 
   - 先编写测试（红灯）
   - 实现功能使测试通过（绿灯）
   - 重构代码（保持绿灯）

2. **测试范围说明**:
   - 纯展示组件（如各 *Docs.tsx）不需要单测
   - `apiDocsUtils.ts` 工具函数需要单测
   - `SdkTabs.tsx` 需要单测（含 localStorage 逻辑）
   - `ResponseTabs.tsx` 不需要单测（简单 UI 组件）

3. **参考文件位置**:
   - UI 版本: `ui/src/components/collections/docs/`
   - WebUI 版本: `webui/src/features/collections/components/docs/`

4. **运行测试命令**:
   ```bash
   cd webui
   npm test -- --coverage
   ```
