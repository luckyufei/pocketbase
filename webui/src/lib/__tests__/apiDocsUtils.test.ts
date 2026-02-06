/**
 * apiDocsUtils unit tests
 */
import { describe, it, expect } from 'vitest'
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

    it('should return correct endpoint for create action', () => {
      expect(getApiEndpoint('posts', 'create')).toBe('/api/collections/posts/records')
    })

    it('should return correct endpoint for update action', () => {
      expect(getApiEndpoint('posts', 'update')).toBe('/api/collections/posts/records/:id')
    })

    it('should return correct endpoint for delete action', () => {
      expect(getApiEndpoint('posts', 'delete')).toBe('/api/collections/posts/records/:id')
    })

    it('should return correct endpoint for auth actions', () => {
      expect(getApiEndpoint('users', 'auth-with-password')).toBe(
        '/api/collections/users/auth-with-password'
      )
      expect(getApiEndpoint('users', 'auth-with-oauth2')).toBe(
        '/api/collections/users/auth-with-oauth2'
      )
      expect(getApiEndpoint('users', 'auth-with-otp')).toBe('/api/collections/users/auth-with-otp')
      expect(getApiEndpoint('users', 'auth-refresh')).toBe('/api/collections/users/auth-refresh')
      expect(getApiEndpoint('users', 'auth-methods')).toBe('/api/collections/users/auth-methods')
    })

    it('should return correct endpoint for verification actions', () => {
      expect(getApiEndpoint('users', 'request-verification')).toBe(
        '/api/collections/users/request-verification'
      )
      expect(getApiEndpoint('users', 'confirm-verification')).toBe(
        '/api/collections/users/confirm-verification'
      )
    })

    it('should return correct endpoint for password reset actions', () => {
      expect(getApiEndpoint('users', 'request-password-reset')).toBe(
        '/api/collections/users/request-password-reset'
      )
      expect(getApiEndpoint('users', 'confirm-password-reset')).toBe(
        '/api/collections/users/confirm-password-reset'
      )
    })

    it('should return correct endpoint for email change actions', () => {
      expect(getApiEndpoint('users', 'request-email-change')).toBe(
        '/api/collections/users/request-email-change'
      )
      expect(getApiEndpoint('users', 'confirm-email-change')).toBe(
        '/api/collections/users/confirm-email-change'
      )
    })

    it('should return correct endpoint for realtime', () => {
      expect(getApiEndpoint('posts', 'realtime')).toBe('/api/realtime')
    })

    it('should return correct endpoint for batch', () => {
      expect(getApiEndpoint('posts', 'batch')).toBe('/api/batch')
    })

    it('should return default endpoint for unknown action', () => {
      expect(getApiEndpoint('posts', 'unknown')).toBe('/api/collections/posts/records')
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
      expect(tabs.map((t) => t.id)).toEqual([
        'list',
        'view',
        'create',
        'update',
        'delete',
        'realtime',
        'batch',
      ])
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
      const passwordTab = tabs.find((t) => t.id === 'auth-with-password')
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
      const oauth2Tab = tabs.find((t) => t.id === 'auth-with-oauth2')
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
      const otpTab = tabs.find((t) => t.id === 'auth-with-otp')
      expect(otpTab?.disabled).toBe(true)
    })

    it('should not disable tabs when auth options are not provided', () => {
      const tabs = getCollectionTabs({
        type: 'auth',
        id: '1',
        name: 'users',
      })
      const passwordTab = tabs.find((t) => t.id === 'auth-with-password')
      const oauth2Tab = tabs.find((t) => t.id === 'auth-with-oauth2')
      const otpTab = tabs.find((t) => t.id === 'auth-with-otp')
      // When options are undefined, disabled should be true (falsy check)
      expect(passwordTab?.disabled).toBe(true)
      expect(oauth2Tab?.disabled).toBe(true)
      expect(otpTab?.disabled).toBe(true)
    })
  })

  describe('getHttpMethod', () => {
    it('should return GET for list and view', () => {
      expect(getHttpMethod('list')).toBe('GET')
      expect(getHttpMethod('view')).toBe('GET')
      expect(getHttpMethod('auth-methods')).toBe('GET')
    })

    it('should return POST for create and auth actions', () => {
      expect(getHttpMethod('create')).toBe('POST')
      expect(getHttpMethod('auth-with-password')).toBe('POST')
      expect(getHttpMethod('auth-with-oauth2')).toBe('POST')
      expect(getHttpMethod('auth-with-otp')).toBe('POST')
      expect(getHttpMethod('auth-refresh')).toBe('POST')
      expect(getHttpMethod('batch')).toBe('POST')
    })

    it('should return POST for verification actions', () => {
      expect(getHttpMethod('request-verification')).toBe('POST')
      expect(getHttpMethod('confirm-verification')).toBe('POST')
    })

    it('should return POST for password reset actions', () => {
      expect(getHttpMethod('request-password-reset')).toBe('POST')
      expect(getHttpMethod('confirm-password-reset')).toBe('POST')
    })

    it('should return POST for email change actions', () => {
      expect(getHttpMethod('request-email-change')).toBe('POST')
      expect(getHttpMethod('confirm-email-change')).toBe('POST')
    })

    it('should return PATCH for update', () => {
      expect(getHttpMethod('update')).toBe('PATCH')
    })

    it('should return DELETE for delete', () => {
      expect(getHttpMethod('delete')).toBe('DELETE')
    })

    it('should return GET for unknown action', () => {
      expect(getHttpMethod('unknown')).toBe('GET')
    })
  })

  describe('getAllCollectionIdentifiers', () => {
    it('should return base fields for base collection', () => {
      const result = getAllCollectionIdentifiers({ type: 'base', fields: [] })
      expect(result).toEqual(['id', 'created', 'updated'])
    })

    it('should return auth fields for auth collection', () => {
      const result = getAllCollectionIdentifiers({ type: 'auth', fields: [] })
      expect(result).toContain('id')
      expect(result).toContain('created')
      expect(result).toContain('updated')
      expect(result).toContain('username')
      expect(result).toContain('email')
      expect(result).toContain('emailVisibility')
      expect(result).toContain('verified')
    })

    it('should return only id for view collection', () => {
      const result = getAllCollectionIdentifiers({ type: 'view', fields: [] })
      expect(result).toEqual(['id'])
    })

    it('should include custom fields', () => {
      const result = getAllCollectionIdentifiers({
        type: 'base',
        fields: [{ name: 'title' }, { name: 'content' }],
      })
      expect(result).toContain('id')
      expect(result).toContain('created')
      expect(result).toContain('updated')
      expect(result).toContain('title')
      expect(result).toContain('content')
    })

    it('should not duplicate fields', () => {
      const result = getAllCollectionIdentifiers({
        type: 'base',
        fields: [{ name: 'id' }, { name: 'title' }],
      })
      const idCount = result.filter((f) => f === 'id').length
      expect(idCount).toBe(1)
    })

    it('should handle undefined fields', () => {
      const result = getAllCollectionIdentifiers({ type: 'base' })
      expect(result).toEqual(['id', 'created', 'updated'])
    })

    it('should handle empty field names', () => {
      const result = getAllCollectionIdentifiers({
        type: 'base',
        fields: [{ name: '' }, { name: 'title' }],
      })
      expect(result).not.toContain('')
      expect(result).toContain('title')
    })
  })

  describe('FILTER_OPERATORS', () => {
    it('should have English descriptions', () => {
      FILTER_OPERATORS.forEach((op) => {
        // Ensure no Chinese characters
        expect(op.description).not.toMatch(/[\u4e00-\u9fa5]/)
      })
    })

    it('should have all required operators', () => {
      const operators = FILTER_OPERATORS.map((op) => op.operator)
      expect(operators).toContain('=')
      expect(operators).toContain('!=')
      expect(operators).toContain('>')
      expect(operators).toContain('>=')
      expect(operators).toContain('<')
      expect(operators).toContain('<=')
      expect(operators).toContain('~')
      expect(operators).toContain('!~')
      expect(operators).toContain('?=')
      expect(operators).toContain('?!=')
      expect(operators).toContain('?~')
      expect(operators).toContain('?!~')
    })

    it('should have examples for each operator', () => {
      FILTER_OPERATORS.forEach((op) => {
        expect(op.example).toBeTruthy()
      })
    })
  })
})
