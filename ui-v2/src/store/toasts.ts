/**
 * Toast 通知状态管理
 */
import { atom } from 'jotai'

// ============ 类型定义 ============

/**
 * Toast 类型
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

/**
 * Toast 项
 */
export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

/**
 * 添加 Toast 的参数
 */
export interface AddToastParams {
  type: ToastType
  message: string
  duration?: number
}

// ============ 工具函数 ============

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ============ 基础 Atoms ============

/**
 * Toast 列表
 */
export const toastsAtom = atom<Toast[]>([])

// ============ Action Atoms ============

/**
 * 添加 Toast
 */
export const addToast = atom(null, (get, set, params: AddToastParams) => {
  const toast: Toast = {
    id: generateId(),
    type: params.type,
    message: params.message,
    duration: params.duration ?? 3000,
  }
  set(toastsAtom, [...get(toastsAtom), toast])
})

/**
 * 移除 Toast
 */
export const removeToast = atom(null, (get, set, id: string) => {
  set(
    toastsAtom,
    get(toastsAtom).filter((t) => t.id !== id)
  )
})

/**
 * 清除所有 Toast
 */
export const clearToasts = atom(null, (_get, set) => {
  set(toastsAtom, [])
})
