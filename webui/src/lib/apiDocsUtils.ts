/**
 * API Docs Utils
 * API documentation utility functions
 */

/**
 * Document tab type
 */
export interface DocTab {
  id: string
  label: string
  disabled?: boolean
}

/**
 * Query parameter
 */
export interface QueryParam {
  name: string
  type: string
  description: string
  required?: boolean
  default?: string
}

/**
 * Collection type for API docs
 */
export interface ApiDocsCollection {
  id: string
  name: string
  type: string
  schema?: Array<{
    name: string
    type: string
    required?: boolean
  }>
  fields?: Array<{
    name: string
    type: string
    required?: boolean
  }>
  passwordAuth?: {
    enabled: boolean
    identityFields?: string[]
  }
  oauth2?: {
    enabled: boolean
  }
  otp?: {
    enabled: boolean
  }
}

/**
 * Get API endpoint
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
 * Base tabs
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
 * Get collection document tabs
 */
export function getCollectionTabs(collection: ApiDocsCollection): DocTab[] {
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
        disabled: !collection.passwordAuth?.enabled,
      },
      {
        id: 'auth-with-oauth2',
        label: 'Auth with OAuth2',
        disabled: !collection.oauth2?.enabled,
      },
      {
        id: 'auth-with-otp',
        label: 'Auth with OTP',
        disabled: !collection.otp?.enabled,
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

/**
 * Get HTTP method
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
 * Generate cURL example
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
 * Generate JavaScript SDK example
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
 * Format field type
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
 * Get field query parameters
 */
export function getFieldQueryParams(): QueryParam[] {
  return [
    {
      name: 'page',
      type: 'Number',
      description: 'Page number (default is 1)',
      default: '1',
    },
    {
      name: 'perPage',
      type: 'Number',
      description: 'Number of records per page (default is 30, max is 500)',
      default: '30',
    },
    {
      name: 'sort',
      type: 'String',
      description: 'Sort field, use - prefix for descending order. Supports multi-field sorting, separated by commas.',
    },
    {
      name: 'filter',
      type: 'String',
      description: 'Filter expression, supports =, !=, >, >=, <, <=, ~, !~ operators',
    },
    {
      name: 'expand',
      type: 'String',
      description: 'Expand related records, separated by commas',
    },
    {
      name: 'fields',
      type: 'String',
      description: 'Specify fields to return, separated by commas',
    },
    {
      name: 'skipTotal',
      type: 'Boolean',
      description: 'Skip total count calculation for performance',
      default: 'false',
    },
  ]
}

/**
 * Filter operators description
 */
export const FILTER_OPERATORS = [
  { operator: '=', description: 'Equals', example: "status='active'" },
  { operator: '!=', description: 'Not equals', example: "status!='deleted'" },
  { operator: '>', description: 'Greater than', example: 'count>10' },
  { operator: '>=', description: 'Greater than or equals', example: 'count>=10' },
  { operator: '<', description: 'Less than', example: 'count<100' },
  { operator: '<=', description: 'Less than or equals', example: 'count<=100' },
  { operator: '~', description: 'Contains (LIKE)', example: "name~'test'" },
  { operator: '!~', description: 'Not contains', example: "name!~'test'" },
  { operator: '?=', description: 'Array contains any', example: "tags?='important'" },
  { operator: '?!=', description: 'Array does not contain', example: "tags?!='spam'" },
  { operator: '?~', description: 'Array any contains', example: "tags?~'test'" },
  { operator: '?!~', description: 'Array any does not contain', example: "tags?!~'test'" },
]

/**
 * Generate dummy record
 */
export function generateDummyRecord(collection: {
  id: string
  name: string
  type: string
  schema?: Array<{ name: string; type: string; required?: boolean; maxSelect?: number; values?: string[] }>
  fields?: Array<{ name: string; type: string; required?: boolean; hidden?: boolean; primaryKey?: boolean; autogeneratePattern?: string; maxSelect?: number; values?: string[] }>
}): Record<string, unknown> {
  // Fixed timestamp format like official UI version
  const fixedTimestamp = '2022-01-01 10:00:00.123Z'
  
  // Start with collectionId and collectionName first (like official UI)
  const record: Record<string, unknown> = {
    collectionId: collection.id,
    collectionName: collection.name,
  }

  // Add schema fields
  const fields = collection.fields || collection.schema || []
  fields.forEach((field) => {
    // Skip hidden fields
    if ('hidden' in field && field.hidden) {
      return
    }
    
    switch (field.type) {
      case 'text':
      case 'editor':
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
        record[field.name] = fixedTimestamp
        break
      case 'json':
        record[field.name] = 'JSON'
        break
      case 'file': {
        const val = 'filename.jpg'
        record[field.name] = field.maxSelect !== 1 ? [val] : val
        break
      }
      case 'relation': {
        const val = 'RELATION_RECORD_ID'
        record[field.name] = field.maxSelect !== 1 ? [val] : val
        break
      }
      case 'select': {
        const val = field.values?.[0] || 'optionA'
        record[field.name] = field.maxSelect !== 1 ? [val] : val
        break
      }
      case 'geoPoint':
        record[field.name] = { lon: 0, lat: 0 }
        break
      default:
        record[field.name] = 'test'
    }
  })

  return record
}

/**
 * Get all collection field identifiers for sort/filter parameters
 */
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
