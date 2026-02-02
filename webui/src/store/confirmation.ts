/**
 * 确认对话框状态管理
 */
import { atom } from 'jotai'

// ============ 类型定义 ============

/**
 * 确认对话框状态
 */
export interface ConfirmationState {
  title: string
  message: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel?: () => void
  isDanger?: boolean
}

/**
 * 显示确认框的参数
 */
export interface ShowConfirmationParams {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  isDanger?: boolean
}

// ============ 基础 Atoms ============

/**
 * 确认对话框状态
 */
export const confirmationAtom = atom<ConfirmationState | null>(null)

// ============ 派生 Atoms ============

/**
 * 确认对话框是否打开
 */
export const isConfirmationOpenAtom = atom((get) => {
  return get(confirmationAtom) !== null
})

// ============ Action Atoms ============

/**
 * 显示确认对话框
 */
export const showConfirmation = atom(null, (_get, set, params: ShowConfirmationParams) => {
  set(confirmationAtom, {
    title: params.title,
    message: params.message,
    confirmText: params.confirmText ?? '确定',
    cancelText: params.cancelText ?? '取消',
    onConfirm: params.onConfirm,
    onCancel: params.onCancel,
    isDanger: params.isDanger,
  })
})

/**
 * 隐藏确认对话框
 */
export const hideConfirmation = atom(null, (_get, set) => {
  set(confirmationAtom, null)
})
