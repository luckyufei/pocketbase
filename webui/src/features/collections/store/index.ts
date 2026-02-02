// T043: Collections Store
import { atom } from 'jotai'
import type { CollectionModel } from 'pocketbase'

/**
 * Collections 列表
 */
export const collectionsAtom = atom<CollectionModel[]>([])

/**
 * 当前选中的 Collection
 */
export const activeCollectionAtom = atom<CollectionModel | null>(null)

/**
 * 当前选中的 Collection ID
 */
export const activeCollectionIdAtom = atom((get) => get(activeCollectionAtom)?.id ?? null)

/**
 * Collections 加载状态
 */
export const collectionsLoadingAtom = atom(false)

/**
 * Collections 错误
 */
export const collectionsErrorAtom = atom<string | null>(null)

/**
 * 按类型分组的 Collections
 */
export const collectionsByTypeAtom = atom((get) => {
  const collections = get(collectionsAtom)
  return {
    auth: collections.filter((c) => c.type === 'auth'),
    base: collections.filter((c) => c.type === 'base'),
    view: collections.filter((c) => c.type === 'view'),
  }
})

/**
 * 搜索过滤后的 Collections
 */
export const searchQueryAtom = atom('')

export const filteredCollectionsAtom = atom((get) => {
  const collections = get(collectionsAtom)
  const query = get(searchQueryAtom).toLowerCase()
  if (!query) return collections
  return collections.filter((c) => c.name.toLowerCase().includes(query))
})

/**
 * 设置 Collections
 */
export const setCollectionsAtom = atom(null, (_get, set, collections: CollectionModel[]) => {
  set(collectionsAtom, collections)
  set(collectionsErrorAtom, null)
})

/**
 * 添加 Collection
 */
export const addCollectionAtom = atom(null, (get, set, collection: CollectionModel) => {
  set(collectionsAtom, [...get(collectionsAtom), collection])
})

/**
 * 更新 Collection
 */
export const updateCollectionAtom = atom(null, (get, set, collection: CollectionModel) => {
  set(
    collectionsAtom,
    get(collectionsAtom).map((c) => (c.id === collection.id ? collection : c))
  )
  // 如果是当前选中的，也更新
  const active = get(activeCollectionAtom)
  if (active?.id === collection.id) {
    set(activeCollectionAtom, collection)
  }
})

/**
 * 删除 Collection
 */
export const deleteCollectionAtom = atom(null, (get, set, id: string) => {
  set(
    collectionsAtom,
    get(collectionsAtom).filter((c) => c.id !== id)
  )
  // 如果删除的是当前选中的，清空选中
  const active = get(activeCollectionAtom)
  if (active?.id === id) {
    set(activeCollectionAtom, null)
  }
})
