// T034: 认证相关 Atoms
import { atom } from 'jotai'
import type { AdminModel } from 'pocketbase'

/**
 * 当前超级用户
 */
export const superuserAtom = atom<AdminModel | null>(null)

/**
 * 是否已认证
 */
export const isAuthenticatedAtom = atom((get) => get(superuserAtom) !== null)

/**
 * 认证 Token
 */
export const authTokenAtom = atom<string | null>(null)

/**
 * Token 过期时间
 */
export const tokenExpirationAtom = atom<number | null>(null)

/**
 * 是否需要刷新 Token
 */
export const needsTokenRefreshAtom = atom((get) => {
  const expiration = get(tokenExpirationAtom)
  if (!expiration) return false
  // 提前 5 分钟刷新
  return Date.now() > expiration - 5 * 60 * 1000
})

/**
 * 设置认证状态
 */
export const setAuthAtom = atom(
  null,
  (_get, set, payload: { user: AdminModel | null; token: string | null; expiration?: number }) => {
    set(superuserAtom, payload.user)
    set(authTokenAtom, payload.token)
    set(tokenExpirationAtom, payload.expiration ?? null)
  }
)

/**
 * 清除认证状态
 */
export const clearAuthAtom = atom(null, (_get, set) => {
  set(superuserAtom, null)
  set(authTokenAtom, null)
  set(tokenExpirationAtom, null)
})
