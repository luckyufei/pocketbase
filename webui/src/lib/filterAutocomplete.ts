/**
 * Filter Autocomplete Utils
 * 为 PocketBase filter 表达式提供自动补全支持
 */
import type { CollectionModel, SchemaField } from 'pocketbase'

// 可以使用数组修饰符的字段类型
const ARRAYABLE_FIELDS = ['select', 'file', 'relation']

// 可以使用字符串修饰符的字段类型
const STRING_FIELDS = ['text', 'email', 'url', 'editor']

/**
 * 获取 Collection 的所有标识符（基础字段）
 */
function getAllCollectionIdentifiers(
  collection: CollectionModel,
  prefix: string = ''
): string[] {
  const result: string[] = []

  // 基础字段
  result.push(prefix + 'id')
  result.push(prefix + 'created')
  result.push(prefix + 'updated')

  // auth 类型额外字段
  if (collection.type === 'auth') {
    result.push(prefix + 'email')
    result.push(prefix + 'emailVisibility')
    result.push(prefix + 'verified')
    result.push(prefix + 'username')
  }

  // 用户定义的字段
  const fields = collection.fields || (collection as any).schema || []
  for (const field of fields) {
    result.push(prefix + field.name)
  }

  return result
}

/**
 * 递归获取 Collection 的自动补全键
 */
export function getCollectionAutocompleteKeys(
  collections: CollectionModel[],
  collectionNameOrId: string,
  prefix: string = '',
  level: number = 0
): string[] {
  // 防御性检查：如果 collections 为空或 undefined，直接返回空数组
  if (!collections || !Array.isArray(collections) || collections.length === 0) {
    return []
  }

  const collection = collections.find(
    (item) => item.name === collectionNameOrId || item.id === collectionNameOrId
  )

  if (!collection || level >= 4) {
    return []
  }

  const fields: SchemaField[] = collection.fields || (collection as any).schema || []
  let result = getAllCollectionIdentifiers(collection, prefix)

  for (const field of fields) {
    const key = prefix + field.name

    // 关联字段 - 递归获取
    if (field.type === 'relation' && (field as any).collectionId) {
      const subKeys = getCollectionAutocompleteKeys(
        collections,
        (field as any).collectionId,
        key + '.',
        level + 1
      )
      result = result.concat(subKeys)
    }

    // 数组字段修饰符
    if ((field as any).maxSelect !== 1 && ARRAYABLE_FIELDS.includes(field.type)) {
      result.push(key + ':each')
      result.push(key + ':length')
    } else if (STRING_FIELDS.includes(field.type)) {
      result.push(key + ':lower')
    }
  }

  // 反向关联 (_via_)
  for (const ref of collections) {
    const refFields: SchemaField[] = ref.fields || (ref as any).schema || []
    for (const field of refFields) {
      if (field.type === 'relation' && (field as any).collectionId === collection.id) {
        const key = prefix + ref.name + '_via_' + field.name
        const subKeys = getCollectionAutocompleteKeys(
          collections,
          ref.id,
          key + '.',
          level + 2 // +2 减少递归深度
        )
        result = result.concat(subKeys)
      }
    }
  }

  return result
}

/**
 * 获取 @collection.* 自动补全键
 */
export function getCollectionJoinAutocompleteKeys(collections: CollectionModel[]): string[] {
  // 防御性检查
  if (!collections || !Array.isArray(collections)) {
    return []
  }

  const result: string[] = []

  for (const collection of collections) {
    if (collection.system) continue // 跳过系统集合

    const prefix = '@collection.' + collection.name + '.'
    const keys = getCollectionAutocompleteKeys(collections, collection.name, prefix)
    result.push(...keys)
  }

  return result
}

/**
 * 获取 @request.* 自动补全键
 */
export function getRequestAutocompleteKeys(
  collections: CollectionModel[],
  baseCollectionName?: string
): string[] {
  const resultSet = new Set<string>([
    '@request.method',
    '@request.query.',
    '@request.headers.',
    '@request.auth.id',
    '@request.auth.collectionId',
    '@request.auth.collectionName',
  ])

  // 防御性检查
  if (!collections || !Array.isArray(collections)) {
    return [...resultSet]
  }

  // 加载 auth 集合字段
  const authCollections = collections.filter((c) => c.type === 'auth' && !c.system)
  for (const collection of authCollections) {
    const authKeys = getCollectionAutocompleteKeys(collections, collection.id, '@request.auth.')
    for (const k of authKeys) {
      resultSet.add(k)
    }
  }

  // 加载基础集合字段到 @request.body.*
  if (baseCollectionName) {
    const keys = getCollectionAutocompleteKeys(collections, baseCollectionName, '@request.body.')
    for (const key of keys) {
      resultSet.add(key)

      // 添加 :isset/:changed 修饰符
      const parts = key.split('.')
      if (parts.length === 3 && !parts[2].includes(':')) {
        resultSet.add(key + ':isset')
        resultSet.add(key + ':changed')
      }
    }
  }

  return [...resultSet]
}

/**
 * 获取所有自动补全选项
 */
export interface AutocompleteKeys {
  baseKeys: string[]
  requestKeys: string[]
  collectionJoinKeys: string[]
}

export function getAllAutocompleteKeys(
  collections: CollectionModel[],
  baseCollection?: CollectionModel | null,
  options: {
    disableRequestKeys?: boolean
    disableCollectionJoinKeys?: boolean
  } = {}
): AutocompleteKeys {
  const result: AutocompleteKeys = {
    baseKeys: [],
    requestKeys: [],
    collectionJoinKeys: [],
  }

  if (baseCollection) {
    result.baseKeys = getCollectionAutocompleteKeys(collections, baseCollection.name)
  }

  if (!options.disableRequestKeys) {
    result.requestKeys = getRequestAutocompleteKeys(collections, baseCollection?.name)
  }

  if (!options.disableCollectionJoinKeys) {
    result.collectionJoinKeys = getCollectionJoinAutocompleteKeys(collections)
  }

  // 去重并排序（短的在前）
  const dedupeAndSort = (arr: string[]) => [...new Set(arr)].sort((a, b) => a.length - b.length)
  result.baseKeys = dedupeAndSort(result.baseKeys)
  result.requestKeys = dedupeAndSort(result.requestKeys)
  result.collectionJoinKeys = dedupeAndSort(result.collectionJoinKeys)

  return result
}

/**
 * 预定义的宏和关键字
 */
export const FILTER_MACROS = [
  { label: 'false', type: 'keyword' },
  { label: 'true', type: 'keyword' },
  { label: 'null', type: 'keyword' },
  { label: '@now', type: 'macro', info: '当前时间' },
  { label: '@second', type: 'macro', info: '当前秒数' },
  { label: '@minute', type: 'macro', info: '当前分钟数' },
  { label: '@hour', type: 'macro', info: '当前小时数' },
  { label: '@day', type: 'macro', info: '当前日' },
  { label: '@month', type: 'macro', info: '当前月' },
  { label: '@year', type: 'macro', info: '当前年' },
  { label: '@weekday', type: 'macro', info: '当前星期' },
  { label: '@yesterday', type: 'macro', info: '昨天开始时间' },
  { label: '@tomorrow', type: 'macro', info: '明天开始时间' },
  { label: '@todayStart', type: 'macro', info: '今天开始时间' },
  { label: '@todayEnd', type: 'macro', info: '今天结束时间' },
  { label: '@monthStart', type: 'macro', info: '本月开始时间' },
  { label: '@monthEnd', type: 'macro', info: '本月结束时间' },
  { label: '@yearStart', type: 'macro', info: '本年开始时间' },
  { label: '@yearEnd', type: 'macro', info: '本年结束时间' },
]

/**
 * 操作符
 */
export const FILTER_OPERATORS = [
  { label: '=', info: '等于' },
  { label: '!=', info: '不等于' },
  { label: '>', info: '大于' },
  { label: '>=', info: '大于等于' },
  { label: '<', info: '小于' },
  { label: '<=', info: '小于等于' },
  { label: '~', info: '包含（LIKE）' },
  { label: '!~', info: '不包含（NOT LIKE）' },
  { label: '?=', info: '任意匹配等于' },
  { label: '?!=', info: '任意匹配不等于' },
  { label: '?>', info: '任意匹配大于' },
  { label: '?>=', info: '任意匹配大于等于' },
  { label: '?<', info: '任意匹配小于' },
  { label: '?<=', info: '任意匹配小于等于' },
  { label: '?~', info: '任意匹配包含' },
  { label: '?!~', info: '任意匹配不包含' },
  { label: '&&', info: '逻辑与' },
  { label: '||', info: '逻辑或' },
]

/**
 * 检测搜索词是否已经是 filter 表达式或 PocketBase 语法
 *
 * 以下情况被认为是 filter 表达式，不需要转换：
 * 1. 包含操作符（=, !=, ~, !~, >, >=, <, <=）
 * 2. 以 @ 开头（宏或字段引用，如 @now, @request.auth.id）
 * 3. 包含括号（表达式分组）
 * 4. 包含逻辑运算符（&&, ||）
 */
const FILTER_OPERATOR_CHARS = ['=', '!=', '~', '!~', '>', '>=', '<', '<=', '&&', '||']

function isFilterExpression(searchTerm: string): boolean {
  // 以 @ 开头：宏或字段引用
  if (searchTerm.startsWith('@')) {
    return true
  }

  // 包含括号：表达式分组
  if (searchTerm.includes('(') || searchTerm.includes(')')) {
    return true
  }

  // 包含操作符
  return FILTER_OPERATOR_CHARS.some(op => searchTerm.includes(op))
}

/**
 * 获取 Collection 中可搜索的文本字段
 * 用于将简单搜索词转换为 filter 表达式
 */
export function getSearchableFields(collection: CollectionModel | null): string[] {
  if (!collection) return []

  const searchableTypes = ['text', 'editor', 'url', 'email']
  const fields: SchemaField[] = collection.fields || (collection as any).schema || []

  const result: string[] = []

  // 添加 id 字段（总是可搜索）
  result.push('id')

  // auth 类型的 username 和 email 字段
  if (collection.type === 'auth') {
    result.push('username')
    result.push('email')
  }

  // 用户定义的文本字段
  for (const field of fields) {
    if (searchableTypes.includes(field.type)) {
      result.push(field.name)
    }
  }

  return result
}

/**
 * 将搜索词标准化为 PocketBase filter 表达式
 *
 * - 如果搜索词已包含操作符（如 `=`, `~`, `>` 等），则认为是 filter 表达式，直接返回
 * - 否则，将搜索词转换为对可搜索字段的模糊搜索（field~"searchTerm"）
 *
 * @param searchTerm 用户输入的搜索词
 * @param fallbackFields 用于模糊搜索的字段列表
 * @returns 标准化后的 filter 表达式
 */
export function normalizeSearchFilter(searchTerm: string, fallbackFields: string[]): string {
  searchTerm = (searchTerm || '').trim()

  if (!searchTerm || fallbackFields.length === 0) {
    return searchTerm
  }

  // 如果已经是 filter 表达式，直接返回
  if (isFilterExpression(searchTerm)) {
    return searchTerm
  }

  // 处理搜索词：
  // - 如果是数字或布尔值，不加引号
  // - 否则用双引号包裹，并移除用户可能输入的引号
  const isNumberOrBool = !isNaN(Number(searchTerm)) || searchTerm === 'true' || searchTerm === 'false'
  const normalizedTerm = isNumberOrBool
    ? searchTerm
    : `"${searchTerm.replace(/^["'`]|["'`]$/g, '')}"`

  // 构建 OR 连接的模糊搜索表达式
  return fallbackFields.map(field => `${field}~${normalizedTerm}`).join('||')
}
