// T057: Records CRUD Hook
import { useCallback } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type { RecordModel, RecordListOptions, RecordOptions } from 'pocketbase'
import { getApiClient } from '@/lib/ApiClient'

const pb = getApiClient()
import {
  recordsAtom,
  recordsLoadingAtom,
  recordsErrorAtom,
  activeRecordAtom,
  selectedRecordIdsAtom,
  sortStateAtom,
  filterAtom,
  setRecordsAtom,
  addRecordAtom,
  updateRecordAtom,
  deleteRecordAtom,
  deleteRecordsAtom,
  toggleRecordSelectionAtom,
  toggleAllSelectionAtom,
  resetRecordsAtom,
} from '../store'

/**
 * Records CRUD Hook
 */
export function useRecords(collectionIdOrName: string) {
  const records = useAtomValue(recordsAtom)
  const [loading, setLoading] = useAtom(recordsLoadingAtom)
  const [error, setError] = useAtom(recordsErrorAtom)
  const [activeRecord, setActiveRecord] = useAtom(activeRecordAtom)
  const selectedIds = useAtomValue(selectedRecordIdsAtom)
  const [sortState, setSortState] = useAtom(sortStateAtom)
  const [filter, setFilter] = useAtom(filterAtom)

  const setRecords = useSetAtom(setRecordsAtom)
  const addRecord = useSetAtom(addRecordAtom)
  const updateRecord = useSetAtom(updateRecordAtom)
  const removeRecord = useSetAtom(deleteRecordAtom)
  const removeRecords = useSetAtom(deleteRecordsAtom)
  const toggleSelection = useSetAtom(toggleRecordSelectionAtom)
  const toggleAll = useSetAtom(toggleAllSelectionAtom)
  const reset = useSetAtom(resetRecordsAtom)

  /**
   * 加载 Records
   * 注意：设置 requestKey: null 禁用自动取消，避免 React useEffect 触发时取消正在进行的请求
   * @see https://github.com/pocketbase/js-sdk#auto-cancellation
   */
  const fetchRecords = useCallback(
    async (page = 1, perPage = 20, options?: RecordListOptions) => {
      setLoading(true)
      setError(null)
      try {
        const sort = sortState
          ? `${sortState.direction === 'desc' ? '-' : ''}${sortState.field}`
          : '-created'

        // 设置 requestKey: null 禁用该请求的自动取消
        // 这样可以避免 React Strict Mode 或快速切换时的取消错误
        const result = await pb.collection(collectionIdOrName).getList(page, perPage, {
          sort,
          filter: filter || undefined,
          requestKey: null,
          ...options,
        })
        setRecords(result)
        return result
      } catch (err) {
        // 忽略自动取消的错误（以防 options 中覆盖了 requestKey）
        if (err instanceof Error && err.message.includes('autocancelled')) {
          console.debug('Request was autocancelled, ignoring...')
          return null
        }
        const message = err instanceof Error ? err.message : '加载记录失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [collectionIdOrName, sortState, filter, setRecords, setLoading, setError]
  )

  /**
   * 获取单条记录
   */
  const getRecord = useCallback(
    async (id: string, options?: RecordOptions) => {
      try {
        return await pb.collection(collectionIdOrName).getOne(id, options)
      } catch (err) {
        const message = err instanceof Error ? err.message : '获取记录失败'
        setError(message)
        throw err
      }
    },
    [collectionIdOrName, setError]
  )

  /**
   * 创建记录
   */
  const createRecord = useCallback(
    async (data: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const result = await pb.collection(collectionIdOrName).create(data)
        addRecord(result)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : '创建记录失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [collectionIdOrName, addRecord, setLoading, setError]
  )

  /**
   * 更新记录
   */
  const saveRecord = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const result = await pb.collection(collectionIdOrName).update(id, data)
        updateRecord(result)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : '更新记录失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [collectionIdOrName, updateRecord, setLoading, setError]
  )

  /**
   * 删除记录
   */
  const destroyRecord = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        await pb.collection(collectionIdOrName).delete(id)
        removeRecord(id)
      } catch (err) {
        const message = err instanceof Error ? err.message : '删除记录失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [collectionIdOrName, removeRecord, setLoading, setError]
  )

  /**
   * 批量删除记录
   */
  const destroyRecords = useCallback(
    async (ids: string[]) => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all(ids.map((id) => pb.collection(collectionIdOrName).delete(id)))
        removeRecords(ids)
      } catch (err) {
        const message = err instanceof Error ? err.message : '批量删除失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [collectionIdOrName, removeRecords, setLoading, setError]
  )

  return {
    records,
    loading,
    error,
    activeRecord,
    setActiveRecord,
    selectedIds,
    sortState,
    setSortState,
    filter,
    setFilter,
    fetchRecords,
    getRecord,
    createRecord,
    saveRecord,
    destroyRecord,
    destroyRecords,
    toggleSelection,
    toggleAll,
    reset,
  }
}

export default useRecords
