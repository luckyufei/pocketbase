/**
 * T000y: useHasChanges Hook
 * 检测 Collection 表单是否有未保存的更改
 */
import { useMemo } from 'react'
import type { CollectionModel } from 'pocketbase'

/**
 * 清理临时属性用于比较
 * 移除 _focusNameOnMount 等临时标记
 */
function cleanForCompare(collection: Partial<CollectionModel>): Partial<CollectionModel> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _focusNameOnMount, ...rest } = collection as any
  return {
    ...rest,
    fields: rest.fields?.map(({ _focusNameOnMount: _, ...field }: any) => field),
  }
}

/**
 * 检测两个 Collection 对象是否有差异
 * 用于判断是否有未保存的更改
 */
export function hasChanges(
  original: Partial<CollectionModel> | null,
  current: Partial<CollectionModel>
): boolean {
  if (!original) return false
  const cleanOriginal = cleanForCompare(original)
  const cleanCurrent = cleanForCompare(current)
  return JSON.stringify(cleanOriginal) !== JSON.stringify(cleanCurrent)
}

/**
 * Hook: 检测 Collection 表单是否有未保存的更改
 * @param original 原始 Collection 数据
 * @param current 当前表单数据
 * @returns 是否有更改
 */
export function useHasChanges(
  original: Partial<CollectionModel> | null,
  current: Partial<CollectionModel>
): boolean {
  return useMemo(() => {
    return hasChanges(original, current)
  }, [original, current])
}

export default useHasChanges
