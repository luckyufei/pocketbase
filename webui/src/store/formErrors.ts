/**
 * T000o: 表单错误状态管理
 * 管理表单字段级别的验证错误
 */
import { atom } from 'jotai'

/**
 * 错误对象类型
 * 支持嵌套路径如 "fields.0.name", "indexes.0.message"
 */
export type FormErrors = Record<string, any>

/**
 * 全局表单错误状态
 */
export const formErrorsAtom = atom<FormErrors>({})

/**
 * 设置所有错误
 */
export const setFormErrorsAtom = atom(
  null,
  (_get, set, errors: FormErrors) => {
    set(formErrorsAtom, errors || {})
  }
)

/**
 * 清除所有错误
 */
export const clearFormErrorsAtom = atom(
  null,
  (_get, set) => {
    set(formErrorsAtom, {})
  }
)

/**
 * 移除单个错误
 * 支持嵌套路径如 "fields.0.name"
 */
export const removeFormErrorAtom = atom(
  null,
  (get, set, path: string) => {
    const errors = { ...get(formErrorsAtom) }
    const keys = path.split('.')
    
    if (keys.length === 1) {
      // 单层路径
      delete errors[keys[0]]
    } else {
      // 嵌套路径 - 递归删除
      let current: any = errors
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) return
        if (i === keys.length - 2) {
          // 倒数第二层，准备删除最后一个 key
          if (typeof current[keys[i]] === 'object') {
            current[keys[i]] = { ...current[keys[i]] }
            delete current[keys[i]][keys[keys.length - 1]]
          }
        } else {
          current[keys[i]] = { ...current[keys[i]] }
          current = current[keys[i]]
        }
      }
    }
    
    set(formErrorsAtom, errors)
  }
)

/**
 * 获取嵌套错误值
 * @param errors 错误对象
 * @param path 点分隔路径，如 "fields.0.name"
 * @returns 错误值或 undefined
 */
export function getNestedError(errors: FormErrors, path: string): any {
  return path.split('.').reduce((obj, key) => obj?.[key], errors)
}

/**
 * 检查指定路径是否有错误
 * @param errors 错误对象
 * @param paths 路径数组
 * @returns 是否有错误
 */
export function hasErrorsInPaths(errors: FormErrors, paths: string[]): boolean {
  return paths.some(path => {
    const err = getNestedError(errors, path)
    if (!err) return false
    if (Array.isArray(err)) return err.length > 0
    if (typeof err === 'object') return Object.keys(err).length > 0
    return true
  })
}
