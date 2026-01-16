/**
 * API Docs Utils
 * API 文档相关工具函数
 */

/**
 * 文档标签类型
 */
export interface DocTab {
  id: string
  label: string
  disabled?: boolean
}

/**
 * 查询参数
 */
export interface QueryParam {
  name: string
  type: string
  description: string
  required?: boolean
  default?: string
}

/**
 * 获取 API 端点
 */
export function getApiEndpoint(collectionName: string, action: string): string {
  const base = `/api/collections/${collectionName}`

  switch (action) {
    case 'list':
      return `${base}/records`
    case 'view':
    case 'update':
    case 'delete':
      return `${base}/records/:id`
    case 'create':
      return `${base}/records`
    case 'auth-with-password':
      return `${base}/auth-with-password`
    case 'auth-with-oauth2':
      return `${base}/auth-with-oauth2`
    case 'auth-with-otp':
      return `${base}/auth-with-otp`
    case 'auth-refresh':
      return `${base}/auth-refresh`
    case 'auth-methods':
      return `${base}/auth-methods`
    case 'request-verification':
      return `${base}/request-verification`
    case 'confirm-verification':
      return `${base}/confirm-verification`
    case 'request-password-reset':
      return `${base}/request-password-reset`
    case 'confirm-password-reset':
      return `${base}/confirm-password-reset`
    case 'request-email-change':
      return `${base}/request-email-change`
    case 'confirm-email-change':
      return `${base}/confirm-email-change`
    case 'realtime':
      return '/api/realtime'
    case 'batch':
      return '/api/batch'
    default:
      return `${base}/records`
  }
}

/**
 * 基础标签
 */
const BASE_TABS: DocTab[] = [
  { id: 'list', label: 'List/Search' },
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'update', label: 'Update' },
  { id: 'delete', label: 'Delete' },
  { id: 'realtime', label: 'Realtime' },
  { id: 'batch', label: 'Batch' },
]

/**
 * 认证标签
 */
const AUTH_TABS: DocTab[] = [
  { id: 'auth-methods', label: 'List auth methods' },
  { id: 'auth-with-password', label: 'Auth with password' },
  { id: 'auth-with-oauth2', label: 'Auth with OAuth2' },
  { id: 'auth-with-otp', label: 'Auth with OTP' },
  { id: 'auth-refresh', label: 'Auth refresh' },
  { id: 'verification', label: 'Verification' },
  { id: 'password-reset', label: 'Password reset' },
  { id: 'email-change', label: 'Email change' },
]

/**
 * 获取集合的文档标签
 */
export function getCollectionTabs(collectionType: string): DocTab[] {
  if (collectionType === 'view') {
    return [
      { id: 'list', label: 'List/Search' },
      { id: 'view', label: 'View' },
    ]
  }

  if (collectionType === 'auth') {
    return [...BASE_TABS, ...AUTH_TABS]
  }

  return [...BASE_TABS]
}

/**
 * 获取 HTTP 方法
 */
export function getHttpMethod(action: string): string {
  switch (action) {
    case 'list':
    case 'view':
    case 'auth-methods':
      return 'GET'
    case 'create':
    case 'auth-with-password':
    case 'auth-with-oauth2':
    case 'auth-with-otp':
    case 'auth-refresh':
    case 'request-verification':
    case 'confirm-verification':
    case 'request-password-reset':
    case 'confirm-password-reset':
    case 'request-email-change':
    case 'confirm-email-change':
    case 'batch':
      return 'POST'
    case 'update':
      return 'PATCH'
    case 'delete':
      return 'DELETE'
    default:
      return 'GET'
  }
}

/**
 * 生成 cURL 示例
 */
export function generateCurlExample(
  collectionName: string,
  action: string,
  method?: string,
  body?: Record<string, unknown>
): string {
  const endpoint = getApiEndpoint(collectionName, action)
  const httpMethod = method || getHttpMethod(action)
  const baseUrl = 'http://127.0.0.1:8090'

  let curl = `curl -X ${httpMethod} "${baseUrl}${endpoint}"`

  if (body && Object.keys(body).length > 0) {
    curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body, null, 2)}'`
  }

  return curl
}

/**
 * 生成 JavaScript SDK 示例
 */
export function generateJsExample(collectionName: string, action: string): string {
  const collection = `pb.collection('${collectionName}')`

  switch (action) {
    case 'list':
      return `const records = await ${collection}.getList(1, 50, {
  filter: 'created >= "2022-01-01 00:00:00"',
  sort: '-created',
});`
    case 'view':
      return `const record = await ${collection}.getOne('RECORD_ID');`
    case 'create':
      return `const record = await ${collection}.create({
  // ... your data
});`
    case 'update':
      return `const record = await ${collection}.update('RECORD_ID', {
  // ... your data
});`
    case 'delete':
      return `await ${collection}.delete('RECORD_ID');`
    case 'auth-with-password':
      return `const authData = await ${collection}.authWithPassword(
  'test@example.com',
  '123456'
);`
    case 'auth-with-oauth2':
      return `const authData = await ${collection}.authWithOAuth2({
  provider: 'google'
});`
    case 'auth-refresh':
      return `const authData = await ${collection}.authRefresh();`
    case 'realtime':
      return `${collection}.subscribe('*', function (e) {
  console.log(e.action);
  console.log(e.record);
});

// Unsubscribe
${collection}.unsubscribe();`
    default:
      return `// ${action} example`
  }
}

/**
 * 格式化字段类型
 */
export function formatFieldType(type: string): string {
  const typeMap: Record<string, string> = {
    text: 'String',
    editor: 'String',
    number: 'Number',
    bool: 'Boolean',
    email: 'String',
    url: 'String',
    date: 'String',
    autodate: 'String',
    select: 'String',
    relation: 'Relation',
    file: 'File',
    json: 'JSON',
    password: 'String',
  }

  return typeMap[type] || type
}

/**
 * 获取查询参数说明
 */
export function getFieldQueryParams(): QueryParam[] {
  return [
    {
      name: 'page',
      type: 'Number',
      description: '页码 (默认为 1)',
      default: '1',
    },
    {
      name: 'perPage',
      type: 'Number',
      description: '每页记录数 (默认为 30, 最大 500)',
      default: '30',
    },
    {
      name: 'sort',
      type: 'String',
      description: '排序字段，使用 - 前缀表示降序。支持多字段排序，用逗号分隔。',
    },
    {
      name: 'filter',
      type: 'String',
      description: '过滤表达式，支持 =, !=, >, >=, <, <=, ~, !~ 等操作符',
    },
    {
      name: 'expand',
      type: 'String',
      description: '展开关联记录，用逗号分隔多个关联字段',
    },
    {
      name: 'fields',
      type: 'String',
      description: '指定返回的字段，用逗号分隔',
    },
    {
      name: 'skipTotal',
      type: 'Boolean',
      description: '跳过总数统计以提高性能',
      default: 'false',
    },
  ]
}

/**
 * 过滤语法说明
 */
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

/**
 * 生成示例记录
 */
export function generateDummyRecord(collection: {
  id: string
  name: string
  type: string
  schema?: Array<{ name: string; type: string; required?: boolean }>
  fields?: Array<{ name: string; type: string; required?: boolean }>
}): Record<string, unknown> {
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
  const record: Record<string, unknown> = {
    id: 'RECORD_ID',
    collectionId: collection.id,
    collectionName: collection.name,
    created: now,
    updated: now,
  }

  // Auth 集合特殊字段
  if (collection.type === 'auth') {
    record.email = 'test@example.com'
    record.emailVisibility = true
    record.verified = true
  }

  // 添加 schema 字段
  const fields = collection.fields || collection.schema || []
  fields.forEach((field) => {
    switch (field.type) {
      case 'text':
        record[field.name] = 'test'
        break
      case 'number':
        record[field.name] = 123
        break
      case 'bool':
        record[field.name] = true
        break
      case 'email':
        record[field.name] = 'test@example.com'
        break
      case 'url':
        record[field.name] = 'https://example.com'
        break
      case 'date':
      case 'autodate':
        record[field.name] = now
        break
      case 'json':
        record[field.name] = {}
        break
      case 'file':
        record[field.name] = 'filename.jpg'
        break
      case 'relation':
        record[field.name] = 'RELATION_RECORD_ID'
        break
      case 'select':
        record[field.name] = 'optionA'
        break
      case 'editor':
        record[field.name] = '<p>test content</p>'
        break
      case 'geoPoint':
        record[field.name] = { lon: 0, lat: 0 }
        break
      default:
        record[field.name] = ''
    }
  })

  return record
}
