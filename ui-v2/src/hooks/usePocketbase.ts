/**
 * usePocketbase Hook
 * 提供 PocketBase 实例和认证状态
 */
import { useCallback, useState, useEffect } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import type PocketBase from 'pocketbase'

interface AuthState {
  isValid: boolean
  token: string
  record: ReturnType<typeof getApiClient>['authStore']['record']
}

interface UsePocketbaseReturn {
  /** PocketBase 实例 */
  pb: PocketBase
  /** 是否已认证 */
  isAuthenticated: boolean
  /** 当前用户 */
  user: AuthState['record']
  /** 当前 Token */
  token: string
  /** 登出 */
  logout: () => void
}

/**
 * 获取 PocketBase 实例和认证状态的 Hook
 */
export function usePocketbase(): UsePocketbaseReturn {
  const pb = getApiClient()

  // 使用 useState 管理认证状态
  const [authState, setAuthState] = useState<AuthState>(() => ({
    isValid: pb.authStore.isValid,
    token: pb.authStore.token,
    record: pb.authStore.record,
  }))

  // 订阅 authStore 变化
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setAuthState({
        isValid: pb.authStore.isValid,
        token: pb.authStore.token,
        record: pb.authStore.record,
      })
    })

    return () => {
      unsubscribe()
    }
  }, [pb])

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [pb])

  return {
    pb,
    isAuthenticated: authState.isValid,
    user: authState.record,
    token: authState.token,
    logout,
  }
}

export default usePocketbase
