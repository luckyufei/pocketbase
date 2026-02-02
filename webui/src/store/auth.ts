/**
 * 认证状态管理
 * 管理超级用户信息和认证状态
 */
import { atom } from 'jotai'
import { getApiClient } from '@/lib/ApiClient'

// ============ 类型定义 ============

/**
 * 超级用户类型
 */
export interface Superuser {
  id: string
  email: string
  created: string
  updated: string
  avatar?: string
}

// ============ 初始化函数 ============

/**
 * 从 PocketBase authStore 恢复认证状态
 */
function getInitialAuthState(): { user: Superuser | null; token: string } {
  try {
    const pb = getApiClient()
    if (pb.authStore.isValid && pb.authStore.record) {
      const record = pb.authStore.record
      return {
        user: {
          id: record.id,
          email: record.email,
          created: record.created,
          updated: record.updated,
          avatar: record.avatar,
        },
        token: pb.authStore.token,
      }
    }
  } catch {
    // 忽略错误，返回默认值
  }
  return { user: null, token: '' }
}

// 获取初始状态
const initialState = getInitialAuthState()

// ============ 基础 Atoms ============

/**
 * 当前超级用户
 */
export const superuserAtom = atom<Superuser | null>(initialState.user)

/**
 * 认证 Token
 */
export const authTokenAtom = atom<string>(initialState.token)

// ============ 派生 Atoms ============

/**
 * 是否已认证
 */
export const isAuthenticatedAtom = atom((get) => {
  const user = get(superuserAtom)
  return user !== null
})

// ============ Action Atoms ============

/**
 * 设置超级用户
 */
export const setSuperuser = atom(null, (_get, set, user: Superuser) => {
  set(superuserAtom, user)
})

/**
 * 清除认证状态
 */
export const clearAuth = atom(null, (_get, set) => {
  set(superuserAtom, null)
  set(authTokenAtom, '')
})
