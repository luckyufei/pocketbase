// T034: 认证 Store 测试
import { describe, it, expect, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  superuserAtom,
  isAuthenticatedAtom,
  authTokenAtom,
  tokenExpirationAtom,
  needsTokenRefreshAtom,
  setAuthAtom,
  clearAuthAtom,
} from './index'

describe('Auth Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('初始状态', () => {
    it('superuserAtom 应该为 null', () => {
      expect(store.get(superuserAtom)).toBeNull()
    })

    it('isAuthenticatedAtom 应该为 false', () => {
      expect(store.get(isAuthenticatedAtom)).toBe(false)
    })

    it('authTokenAtom 应该为 null', () => {
      expect(store.get(authTokenAtom)).toBeNull()
    })
  })

  describe('setAuthAtom', () => {
    it('应该设置用户和 token', () => {
      const mockUser = { id: '1', email: 'admin@test.com' } as any
      store.set(setAuthAtom, { user: mockUser, token: 'test-token' })

      expect(store.get(superuserAtom)).toEqual(mockUser)
      expect(store.get(authTokenAtom)).toBe('test-token')
      expect(store.get(isAuthenticatedAtom)).toBe(true)
    })

    it('应该设置 token 过期时间', () => {
      const expiration = Date.now() + 3600000
      store.set(setAuthAtom, {
        user: { id: '1' } as any,
        token: 'token',
        expiration,
      })

      expect(store.get(tokenExpirationAtom)).toBe(expiration)
    })
  })

  describe('clearAuthAtom', () => {
    it('应该清除所有认证状态', () => {
      store.set(setAuthAtom, {
        user: { id: '1' } as any,
        token: 'token',
        expiration: Date.now() + 3600000,
      })

      store.set(clearAuthAtom)

      expect(store.get(superuserAtom)).toBeNull()
      expect(store.get(authTokenAtom)).toBeNull()
      expect(store.get(tokenExpirationAtom)).toBeNull()
      expect(store.get(isAuthenticatedAtom)).toBe(false)
    })
  })

  describe('needsTokenRefreshAtom', () => {
    it('没有过期时间时应该返回 false', () => {
      expect(store.get(needsTokenRefreshAtom)).toBe(false)
    })

    it('token 即将过期时应该返回 true', () => {
      // 设置为 3 分钟后过期（小于 5 分钟阈值）
      const expiration = Date.now() + 3 * 60 * 1000
      store.set(setAuthAtom, {
        user: { id: '1' } as any,
        token: 'token',
        expiration,
      })

      expect(store.get(needsTokenRefreshAtom)).toBe(true)
    })

    it('token 未过期时应该返回 false', () => {
      // 设置为 10 分钟后过期
      const expiration = Date.now() + 10 * 60 * 1000
      store.set(setAuthAtom, {
        user: { id: '1' } as any,
        token: 'token',
        expiration,
      })

      expect(store.get(needsTokenRefreshAtom)).toBe(false)
    })
  })
})
