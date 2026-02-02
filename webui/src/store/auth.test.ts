/**
 * Auth Store 单元测试
 * TDD: 红灯阶段
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  superuserAtom,
  isAuthenticatedAtom,
  authTokenAtom,
  setSuperuser,
  clearAuth,
  type Superuser,
} from './auth'

describe('Auth Store', () => {
  describe('superuserAtom', () => {
    it('应该默认为 null', () => {
      const store = createStore()
      expect(store.get(superuserAtom)).toBeNull()
    })

    it('应该能设置超级用户', () => {
      const store = createStore()
      const user: Superuser = {
        id: '123',
        email: 'admin@example.com',
        created: '2024-01-01',
        updated: '2024-01-01',
      }
      store.set(superuserAtom, user)
      expect(store.get(superuserAtom)).toEqual(user)
    })
  })

  describe('isAuthenticatedAtom', () => {
    it('未登录时应该为 false', () => {
      const store = createStore()
      expect(store.get(isAuthenticatedAtom)).toBe(false)
    })

    it('登录后应该为 true', () => {
      const store = createStore()
      const user: Superuser = {
        id: '123',
        email: 'admin@example.com',
        created: '2024-01-01',
        updated: '2024-01-01',
      }
      store.set(superuserAtom, user)
      expect(store.get(isAuthenticatedAtom)).toBe(true)
    })
  })

  describe('authTokenAtom', () => {
    it('应该默认为空字符串', () => {
      const store = createStore()
      expect(store.get(authTokenAtom)).toBe('')
    })

    it('应该能设置 token', () => {
      const store = createStore()
      store.set(authTokenAtom, 'test-token-123')
      expect(store.get(authTokenAtom)).toBe('test-token-123')
    })
  })

  describe('setSuperuser', () => {
    it('应该设置超级用户', () => {
      const store = createStore()
      const user: Superuser = {
        id: '456',
        email: 'test@example.com',
        created: '2024-01-01',
        updated: '2024-01-01',
      }
      store.set(setSuperuser, user)
      expect(store.get(superuserAtom)).toEqual(user)
    })
  })

  describe('clearAuth', () => {
    it('应该清除认证状态', () => {
      const store = createStore()
      // 先设置用户和 token
      store.set(superuserAtom, {
        id: '123',
        email: 'admin@example.com',
        created: '2024-01-01',
        updated: '2024-01-01',
      })
      store.set(authTokenAtom, 'some-token')

      // 清除认证
      store.set(clearAuth)

      expect(store.get(superuserAtom)).toBeNull()
      expect(store.get(authTokenAtom)).toBe('')
      expect(store.get(isAuthenticatedAtom)).toBe(false)
    })
  })
})
