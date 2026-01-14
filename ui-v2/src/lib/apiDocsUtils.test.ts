/**
 * API Docs Utils 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it } from 'bun:test'
import {
  getApiEndpoint,
  getCollectionTabs,
  generateCurlExample,
  generateJsExample,
  formatFieldType,
  getFieldQueryParams,
} from './apiDocsUtils'

describe('apiDocsUtils', () => {
  describe('getApiEndpoint', () => {
    it('应该生成正确的 API 端点', () => {
      expect(getApiEndpoint('users', 'list')).toBe('/api/collections/users/records')
      expect(getApiEndpoint('users', 'view')).toBe('/api/collections/users/records/:id')
      expect(getApiEndpoint('users', 'create')).toBe('/api/collections/users/records')
      expect(getApiEndpoint('users', 'update')).toBe('/api/collections/users/records/:id')
      expect(getApiEndpoint('users', 'delete')).toBe('/api/collections/users/records/:id')
    })

    it('应该生成认证相关端点', () => {
      expect(getApiEndpoint('users', 'auth-with-password')).toBe(
        '/api/collections/users/auth-with-password'
      )
      expect(getApiEndpoint('users', 'auth-refresh')).toBe('/api/collections/users/auth-refresh')
    })
  })

  describe('getCollectionTabs', () => {
    it('base 类型应该返回基础标签', () => {
      const tabs = getCollectionTabs('base')
      expect(tabs).toContainEqual(expect.objectContaining({ id: 'list' }))
      expect(tabs).toContainEqual(expect.objectContaining({ id: 'create' }))
      expect(tabs).not.toContainEqual(expect.objectContaining({ id: 'auth-with-password' }))
    })

    it('auth 类型应该返回认证标签', () => {
      const tabs = getCollectionTabs('auth')
      expect(tabs).toContainEqual(expect.objectContaining({ id: 'list' }))
      expect(tabs).toContainEqual(expect.objectContaining({ id: 'auth-with-password' }))
    })

    it('view 类型应该只返回只读标签', () => {
      const tabs = getCollectionTabs('view')
      expect(tabs).toContainEqual(expect.objectContaining({ id: 'list' }))
      expect(tabs).toContainEqual(expect.objectContaining({ id: 'view' }))
      expect(tabs).not.toContainEqual(expect.objectContaining({ id: 'create' }))
      expect(tabs).not.toContainEqual(expect.objectContaining({ id: 'delete' }))
    })
  })

  describe('generateCurlExample', () => {
    it('应该生成 GET 请求示例', () => {
      const curl = generateCurlExample('users', 'list', 'GET')
      expect(curl).toContain('curl')
      expect(curl).toContain('/api/collections/users/records')
      expect(curl).toContain('-X GET')
    })

    it('应该生成 POST 请求示例', () => {
      const curl = generateCurlExample('users', 'create', 'POST', { name: 'test' })
      expect(curl).toContain('-X POST')
      expect(curl).toContain('-d')
    })
  })

  describe('generateJsExample', () => {
    it('应该生成列表请求示例', () => {
      const js = generateJsExample('users', 'list')
      expect(js).toContain('pb.collection')
      expect(js).toContain('getList')
    })

    it('应该生成创建请求示例', () => {
      const js = generateJsExample('users', 'create')
      expect(js).toContain('create')
    })
  })

  describe('formatFieldType', () => {
    it('应该格式化字段类型', () => {
      expect(formatFieldType('text')).toBe('String')
      expect(formatFieldType('number')).toBe('Number')
      expect(formatFieldType('bool')).toBe('Boolean')
      expect(formatFieldType('relation')).toBe('Relation')
      expect(formatFieldType('file')).toBe('File')
    })
  })

  describe('getFieldQueryParams', () => {
    it('应该返回查询参数说明', () => {
      const params = getFieldQueryParams()
      expect(params).toContainEqual(expect.objectContaining({ name: 'page' }))
      expect(params).toContainEqual(expect.objectContaining({ name: 'perPage' }))
      expect(params).toContainEqual(expect.objectContaining({ name: 'filter' }))
      expect(params).toContainEqual(expect.objectContaining({ name: 'sort' }))
    })
  })
})
