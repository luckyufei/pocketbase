/**
 * useAuth Hook 单元测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { createElement } from 'react'
import { useAuth } from './useAuth'
import { superuserAtom, authTokenAtom } from '@/store/auth'
import { resetApiClient, getApiClient } from '@/lib/ApiClient'

// 创建测试 wrapper
function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(Provider, { store }, children)
  }
}

describe('useAuth', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    resetApiClient()
  })

  afterEach(() => {
    resetApiClient()
  })

  describe('初始状态', () => {
    it('应该返回 isAuthenticated 为 false', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('应该返回 user 为 null', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(result.current.user).toBeNull()
    })

    it('应该返回 isLoading 为 false', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(result.current.isLoading).toBe(false)
    })

    it('应该返回 error 为 null', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe('login 方法', () => {
    it('应该返回 login 函数', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(typeof result.current.login).toBe('function')
    })

    it('login 应该设置 isLoading 为 true', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })

      // 开始登录（会失败，因为没有真实后端，但会设置 loading）
      const loginPromise = act(async () => {
        try {
          await result.current.login('test@example.com', 'password')
        } catch {
          // 预期会失败
        }
      })

      // 等待完成
      await loginPromise

      // 完成后 loading 应该是 false
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('logout 方法', () => {
    it('应该返回 logout 函数', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(typeof result.current.logout).toBe('function')
    })

    it('logout 应该清除认证状态', () => {
      // 先设置用户
      store.set(superuserAtom, {
        id: '123',
        email: 'test@example.com',
        created: '2024-01-01',
        updated: '2024-01-01',
      })
      store.set(authTokenAtom, 'test-token')

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })

      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })

  describe('clearError 方法', () => {
    it('应该返回 clearError 函数', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })
      expect(typeof result.current.clearError).toBe('function')
    })

    it('clearError 应该清除错误状态', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })

      // 先触发一个登录失败来设置错误
      await act(async () => {
        await result.current.login('test@example.com', 'wrong')
      })

      // 错误应该被设置
      expect(result.current.error).not.toBeNull()

      // 清除错误
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('login 失败场景', () => {
    it('登录失败应该设置 error', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })

      await act(async () => {
        const success = await result.current.login('test@example.com', 'wrong')
        expect(success).toBe(false)
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('登录失败后 isAuthenticated 应该保持 false', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store),
      })

      await act(async () => {
        await result.current.login('test@example.com', 'wrong')
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })
})
