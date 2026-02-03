/**
 * Filter Autocomplete Utils 测试
 * 验证宏列表、字段获取、搜索词标准化等功能
 */
import { describe, it, expect } from 'bun:test'
import {
  FILTER_MACROS,
  FILTER_OPERATORS,
  getSearchableFields,
  normalizeSearchFilter,
  getAllAutocompleteKeys,
  getCollectionAutocompleteKeys,
} from './filterAutocomplete'
import type { CollectionModel } from 'pocketbase'

describe('FILTER_MACROS - 宏列表', () => {
  // Task 5.1: 验证所有时间宏存在
  it('包含所有时间宏', () => {
    const labels = FILTER_MACROS.map(m => m.label)
    
    // 基础时间宏
    expect(labels).toContain('@now')
    expect(labels).toContain('@second')
    expect(labels).toContain('@minute')
    expect(labels).toContain('@hour')
    expect(labels).toContain('@day')
    expect(labels).toContain('@month')
    expect(labels).toContain('@year')
    expect(labels).toContain('@weekday')
    
    // 相对时间宏
    expect(labels).toContain('@yesterday')
    expect(labels).toContain('@tomorrow')
    
    // 时间范围宏
    expect(labels).toContain('@todayStart')
    expect(labels).toContain('@todayEnd')
    expect(labels).toContain('@monthStart')
    expect(labels).toContain('@monthEnd')
    expect(labels).toContain('@yearStart')
    expect(labels).toContain('@yearEnd')
  })

  // Task 5.2: 验证布尔值存在
  it('包含布尔值', () => {
    const labels = FILTER_MACROS.map(m => m.label)
    
    expect(labels).toContain('true')
    expect(labels).toContain('false')
    expect(labels).toContain('null')
  })

  // Task 5.3: 验证宏有正确的类型标记
  it('宏有正确的类型标记', () => {
    const timeMacros = FILTER_MACROS.filter(m => m.label.startsWith('@'))
    const boolMacros = FILTER_MACROS.filter(m => ['true', 'false', 'null'].includes(m.label))
    
    // 时间宏应该是 'macro' 类型
    timeMacros.forEach(m => {
      expect(m.type).toBe('macro')
    })
    
    // 布尔值应该是 'keyword' 类型
    boolMacros.forEach(m => {
      expect(m.type).toBe('keyword')
    })
  })
})

describe('FILTER_OPERATORS - 操作符列表', () => {
  it('包含所有比较操作符', () => {
    const labels = FILTER_OPERATORS.map(o => o.label)
    
    expect(labels).toContain('=')
    expect(labels).toContain('!=')
    expect(labels).toContain('>')
    expect(labels).toContain('>=')
    expect(labels).toContain('<')
    expect(labels).toContain('<=')
    expect(labels).toContain('~')
    expect(labels).toContain('!~')
  })

  it('包含逻辑操作符', () => {
    const labels = FILTER_OPERATORS.map(o => o.label)
    
    expect(labels).toContain('&&')
    expect(labels).toContain('||')
  })

  it('包含数组操作符', () => {
    const labels = FILTER_OPERATORS.map(o => o.label)
    
    expect(labels).toContain('?=')
    expect(labels).toContain('?!=')
    expect(labels).toContain('?>')
    expect(labels).toContain('?>=')
    expect(labels).toContain('?<')
    expect(labels).toContain('?<=')
    expect(labels).toContain('?~')
    expect(labels).toContain('?!~')
  })
})

describe('getSearchableFields - 可搜索字段', () => {
  it('返回空数组当 collection 为 null', () => {
    expect(getSearchableFields(null)).toEqual([])
  })

  it('总是包含 id 字段', () => {
    const collection = {
      id: 'test',
      name: 'test',
      type: 'base',
      fields: [],
    } as unknown as CollectionModel
    
    const fields = getSearchableFields(collection)
    expect(fields).toContain('id')
  })

  it('auth 类型包含 username 和 email', () => {
    const collection = {
      id: 'users',
      name: 'users',
      type: 'auth',
      fields: [],
    } as unknown as CollectionModel
    
    const fields = getSearchableFields(collection)
    expect(fields).toContain('username')
    expect(fields).toContain('email')
  })

  it('包含 text 类型字段', () => {
    const collection = {
      id: 'posts',
      name: 'posts',
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'content', type: 'editor' },
        { name: 'link', type: 'url' },
        { name: 'author_email', type: 'email' },
        { name: 'count', type: 'number' },  // 不应包含
        { name: 'published', type: 'bool' }, // 不应包含
      ],
    } as unknown as CollectionModel
    
    const fields = getSearchableFields(collection)
    expect(fields).toContain('title')
    expect(fields).toContain('content')
    expect(fields).toContain('link')
    expect(fields).toContain('author_email')
    expect(fields).not.toContain('count')
    expect(fields).not.toContain('published')
  })
})

describe('normalizeSearchFilter - 搜索词标准化', () => {
  const fallbackFields = ['id', 'title', 'content']

  it('空搜索词返回空字符串', () => {
    expect(normalizeSearchFilter('', fallbackFields)).toBe('')
    expect(normalizeSearchFilter('  ', fallbackFields)).toBe('')
  })

  it('已是 filter 表达式则直接返回', () => {
    // 包含 = 操作符
    expect(normalizeSearchFilter('title="hello"', fallbackFields)).toBe('title="hello"')
    // 包含 ~ 操作符
    expect(normalizeSearchFilter('content~"world"', fallbackFields)).toBe('content~"world"')
    // 包含 > 操作符
    expect(normalizeSearchFilter('created > @now', fallbackFields)).toBe('created > @now')
    // 包含 != 操作符
    expect(normalizeSearchFilter('status != "draft"', fallbackFields)).toBe('status != "draft"')
  })

  it('以 @ 开头的表达式直接返回（宏或字段引用）', () => {
    // 宏
    expect(normalizeSearchFilter('@now', fallbackFields)).toBe('@now')
    expect(normalizeSearchFilter('@yesterday', fallbackFields)).toBe('@yesterday')
    // 字段引用
    expect(normalizeSearchFilter('@request.auth.id', fallbackFields)).toBe('@request.auth.id')
    expect(normalizeSearchFilter('@request.auth.avatar', fallbackFields)).toBe('@request.auth.avatar')
    expect(normalizeSearchFilter('@collection.users.id', fallbackFields)).toBe('@collection.users.id')
  })

  it('包含括号的表达式直接返回', () => {
    expect(normalizeSearchFilter('(title="a" || title="b")', fallbackFields)).toBe('(title="a" || title="b")')
    expect(normalizeSearchFilter('status="active" && (type="A" || type="B")', fallbackFields)).toBe('status="active" && (type="A" || type="B")')
  })

  it('包含逻辑运算符的表达式直接返回', () => {
    expect(normalizeSearchFilter('a && b', fallbackFields)).toBe('a && b')
    expect(normalizeSearchFilter('a || b', fallbackFields)).toBe('a || b')
  })

  it('简单搜索词转换为模糊搜索', () => {
    const result = normalizeSearchFilter('hello', fallbackFields)
    expect(result).toBe('id~"hello"||title~"hello"||content~"hello"')
  })

  it('数字搜索词不加引号', () => {
    const result = normalizeSearchFilter('123', fallbackFields)
    expect(result).toBe('id~123||title~123||content~123')
  })

  it('布尔值搜索词不加引号', () => {
    const resultTrue = normalizeSearchFilter('true', fallbackFields)
    expect(resultTrue).toBe('id~true||title~true||content~true')
    
    const resultFalse = normalizeSearchFilter('false', fallbackFields)
    expect(resultFalse).toBe('id~false||title~false||content~false')
  })

  it('去除搜索词两端的引号', () => {
    const result = normalizeSearchFilter('"hello"', fallbackFields)
    expect(result).toBe('id~"hello"||title~"hello"||content~"hello"')
  })

  it('fallbackFields 为空时返回原搜索词', () => {
    expect(normalizeSearchFilter('hello', [])).toBe('hello')
  })
})

describe('getCollectionAutocompleteKeys - 集合自动补全', () => {
  const mockCollections: CollectionModel[] = [
    {
      id: 'posts_id',
      name: 'posts',
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'author', type: 'relation', collectionId: 'users_id' },
      ],
    } as unknown as CollectionModel,
    {
      id: 'users_id',
      name: 'users',
      type: 'auth',
      fields: [
        { name: 'name', type: 'text' },
      ],
    } as unknown as CollectionModel,
  ]

  it('返回基础字段', () => {
    const keys = getCollectionAutocompleteKeys(mockCollections, 'posts')
    
    expect(keys).toContain('id')
    expect(keys).toContain('created')
    expect(keys).toContain('updated')
    expect(keys).toContain('title')
  })

  it('auth 类型包含额外字段', () => {
    const keys = getCollectionAutocompleteKeys(mockCollections, 'users')
    
    expect(keys).toContain('email')
    expect(keys).toContain('emailVisibility')
    expect(keys).toContain('verified')
    expect(keys).toContain('username')
  })

  it('递归获取关联字段', () => {
    const keys = getCollectionAutocompleteKeys(mockCollections, 'posts')
    
    // 应该包含 author.* 字段
    expect(keys).toContain('author.id')
    expect(keys).toContain('author.name')
  })
})

describe('getAllAutocompleteKeys - 完整自动补全', () => {
  const mockCollections: CollectionModel[] = [
    {
      id: 'posts_id',
      name: 'posts',
      type: 'base',
      fields: [
        { name: 'title', type: 'text' },
      ],
    } as unknown as CollectionModel,
  ]

  const mockBaseCollection = mockCollections[0]

  it('返回 baseKeys', () => {
    const result = getAllAutocompleteKeys(mockCollections, mockBaseCollection)
    
    expect(result.baseKeys).toContain('id')
    expect(result.baseKeys).toContain('title')
  })

  it('返回 requestKeys', () => {
    const result = getAllAutocompleteKeys(mockCollections, mockBaseCollection)
    
    expect(result.requestKeys).toContain('@request.method')
    expect(result.requestKeys.some(k => k.startsWith('@request.auth'))).toBe(true)
  })

  it('返回 collectionJoinKeys', () => {
    const result = getAllAutocompleteKeys(mockCollections, mockBaseCollection)
    
    expect(result.collectionJoinKeys.some(k => k.startsWith('@collection.'))).toBe(true)
  })

  it('可禁用 requestKeys', () => {
    const result = getAllAutocompleteKeys(mockCollections, mockBaseCollection, {
      disableRequestKeys: true,
    })
    
    expect(result.requestKeys).toEqual([])
  })

  it('可禁用 collectionJoinKeys', () => {
    const result = getAllAutocompleteKeys(mockCollections, mockBaseCollection, {
      disableCollectionJoinKeys: true,
    })
    
    expect(result.collectionJoinKeys).toEqual([])
  })
})
