/**
 * useAuth Hook
 * 提供认证相关的操作和状态
 */
import { useState, useCallback } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { superuserAtom, authTokenAtom, clearAuth, type Superuser } from '@/store/auth'
import { getApiClient } from '@/lib/ApiClient'

interface UseAuthReturn {
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 当前用户 */
  user: Superuser | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 登录 */
  login: (email: string, password: string) => Promise<boolean>
  /** 登出 */
  logout: () => void
  /** 清除错误 */
  clearError: () => void
}

/**
 * 认证 Hook
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useAtom(superuserAtom)
  const [token, setToken] = useAtom(authTokenAtom)
  const clearAuthState = useSetAtom(clearAuth)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = user !== null

  /**
   * 登录
   */
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const pb = getApiClient()
        const authData = await pb.collection('_superusers').authWithPassword(email, password)

        // 设置用户信息
        const superuser: Superuser = {
          id: authData.record.id,
          email: authData.record.email,
          created: authData.record.created,
          updated: authData.record.updated,
          avatar: authData.record.avatar,
        }

        setUser(superuser)
        setToken(authData.token)
        setIsLoading(false)
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : '登录失败'
        setError(message)
        setIsLoading(false)
        return false
      }
    },
    [setUser, setToken]
  )

  /**
   * 登出
   */
  const logout = useCallback(() => {
    const pb = getApiClient()
    pb.authStore.clear()
    clearAuthState()
  }, [clearAuthState])

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout,
    clearError,
  }
}

export default useAuth
