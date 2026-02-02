// T012: 错误状态管理
import { atom } from 'jotai'

/**
 * 应用错误类型
 */
export interface AppError {
  id: string
  message: string
  code?: string
  details?: unknown
  timestamp: number
}

/**
 * 错误列表 Atom
 */
export const errorsAtom = atom<AppError[]>([])

/**
 * 是否有错误
 */
export const hasErrorsAtom = atom((get) => get(errorsAtom).length > 0)

/**
 * 添加错误
 */
export const addErrorAtom = atom(null, (get, set, error: Omit<AppError, 'id' | 'timestamp'>) => {
  const newError: AppError = {
    ...error,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }
  set(errorsAtom, [...get(errorsAtom), newError])
  return newError
})

/**
 * 移除错误
 */
export const removeErrorAtom = atom(null, (get, set, id: string) => {
  set(
    errorsAtom,
    get(errorsAtom).filter((e) => e.id !== id)
  )
})

/**
 * 清空所有错误
 */
export const clearErrorsAtom = atom(null, (_get, set) => {
  set(errorsAtom, [])
})
