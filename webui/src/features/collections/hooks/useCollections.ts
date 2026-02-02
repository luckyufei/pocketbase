// T044: Collections CRUD Hook
import { useCallback, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import type { CollectionModel } from 'pocketbase'
import { getApiClient } from '@/lib/ApiClient'

const pb = getApiClient()
import {
  collectionsAtom,
  collectionsLoadingAtom,
  collectionsErrorAtom,
  activeCollectionAtom,
  addCollectionAtom,
  updateCollectionAtom,
  deleteCollectionAtom,
} from '../store'

/**
 * 排序 Collections：按类型分组（auth → base → view），系统集合放最后，组内按名称字母排序
 */
function sortCollections(collections: CollectionModel[]): CollectionModel[] {
  const system: CollectionModel[] = []
  const auth: CollectionModel[] = []
  const base: CollectionModel[] = []
  const view: CollectionModel[] = []

  for (const collection of collections) {
    // 系统集合（_开头）单独分组
    if (collection.name.startsWith('_')) {
      system.push(collection)
    } else if (collection.type === 'auth') {
      auth.push(collection)
    } else if (collection.type === 'view') {
      view.push(collection)
    } else {
      base.push(collection)
    }
  }

  const sortByName = (a: CollectionModel, b: CollectionModel) => 
    a.name.localeCompare(b.name)

  return [
    ...auth.sort(sortByName),
    ...base.sort(sortByName),
    ...view.sort(sortByName),
    ...system.sort(sortByName),
  ]
}

/**
 * Collections CRUD Hook
 */
export function useCollections() {
  const [collections, setCollections] = useAtom(collectionsAtom)
  const [loading, setLoading] = useAtom(collectionsLoadingAtom)
  const [error, setError] = useAtom(collectionsErrorAtom)
  const [activeCollection, setActiveCollection] = useAtom(activeCollectionAtom)
  const addCollection = useSetAtom(addCollectionAtom)
  const updateCollection = useSetAtom(updateCollectionAtom)
  const removeCollection = useSetAtom(deleteCollectionAtom)

  /**
   * 加载所有 Collections
   */
  const fetchCollections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await pb.collections.getFullList({
        // 使用唯一的 requestKey 避免自动取消
        requestKey: `collections-${Date.now()}`,
      })
      // 排序：auth → base → view → system（_开头），组内按字母排序
      setCollections(sortCollections(result))
      return result
    } catch (err: any) {
      // 忽略自动取消错误
      if (err.isAbort) return []
      const message = err instanceof Error ? err.message : '加载 Collections 失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [setCollections, setLoading, setError])

  /**
   * 获取单个 Collection
   */
  const getCollection = useCallback(
    async (idOrName: string) => {
      try {
        return await pb.collections.getOne(idOrName)
      } catch (err) {
        const message = err instanceof Error ? err.message : '获取 Collection 失败'
        setError(message)
        throw err
      }
    },
    [setError]
  )

  /**
   * 创建 Collection
   */
  const createCollection = useCallback(
    async (data: Partial<CollectionModel>) => {
      setLoading(true)
      setError(null)
      try {
        const result = await pb.collections.create(data)
        addCollection(result)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : '创建 Collection 失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [addCollection, setLoading, setError]
  )

  /**
   * 更新 Collection
   */
  const saveCollection = useCallback(
    async (id: string, data: Partial<CollectionModel>) => {
      setLoading(true)
      setError(null)
      try {
        const result = await pb.collections.update(id, data)
        updateCollection(result)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : '更新 Collection 失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [updateCollection, setLoading, setError]
  )

  /**
   * 删除 Collection
   */
  const destroyCollection = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        await pb.collections.delete(id)
        removeCollection(id)
      } catch (err) {
        const message = err instanceof Error ? err.message : '删除 Collection 失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [removeCollection, setLoading, setError]
  )

  /**
   * 导入 Collections
   */
  const importCollections = useCallback(
    async (collectionsData: CollectionModel[], deleteMissing = false) => {
      setLoading(true)
      setError(null)
      try {
        await pb.collections.import(collectionsData, deleteMissing)
        await fetchCollections()
      } catch (err) {
        const message = err instanceof Error ? err.message : '导入 Collections 失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [fetchCollections, setLoading, setError]
  )

  /**
   * 清空 Collection 的所有记录（Truncate）
   */
  const truncateCollection = useCallback(
    async (idOrName: string) => {
      setLoading(true)
      setError(null)
      try {
        await pb.collections.truncate(idOrName)
      } catch (err) {
        const message = err instanceof Error ? err.message : '清空 Collection 失败'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setError]
  )

  return {
    collections,
    loading,
    error,
    activeCollection,
    setActiveCollection,
    fetchCollections,
    getCollection,
    createCollection,
    saveCollection,
    destroyCollection,
    importCollections,
    truncateCollection,
  }
}

export default useCollections
