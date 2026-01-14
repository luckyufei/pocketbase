// T036: Token 自动刷新 Hook
import { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { needsTokenRefreshAtom, isAuthenticatedAtom } from '../store'
import { getApiClient } from '@/lib/ApiClient'

const pb = getApiClient()

interface UseAutoRefreshOptions {
  /** 刷新间隔（毫秒），默认 1 分钟 */
  interval?: number
  /** 是否启用自动刷新 */
  enabled?: boolean
}

/**
 * Token 自动刷新 Hook
 * 定期检查 token 是否需要刷新，并在需要时自动刷新
 */
export function useAutoRefresh(options: UseAutoRefreshOptions = {}) {
  const { interval = 60000, enabled = true } = options
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const needsRefresh = useAtomValue(needsTokenRefreshAtom)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !isAuthenticated) return

    const checkAndRefresh = async () => {
      if (refreshingRef.current || !needsRefresh) return

      refreshingRef.current = true
      try {
        // 使用 PocketBase SDK 的 authRefresh 方法
        await pb.collection('_superusers').authRefresh()
        console.log('Token refreshed successfully')
      } catch (error) {
        console.error('Failed to refresh token:', error)
      } finally {
        refreshingRef.current = false
      }
    }

    // 立即检查一次
    checkAndRefresh()

    // 设置定期检查
    const timer = setInterval(checkAndRefresh, interval)

    return () => clearInterval(timer)
  }, [enabled, isAuthenticated, needsRefresh, interval])
}

export default useAutoRefresh
