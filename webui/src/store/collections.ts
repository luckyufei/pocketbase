/**
 * Collections 状态管理
 */
import { atom } from 'jotai'

// ============ 类型定义 ============

/**
 * 字段类型
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'bool'
  | 'email'
  | 'url'
  | 'date'
  | 'select'
  | 'file'
  | 'relation'
  | 'json'
  | 'editor'
  | 'password'
  | 'autodate'
  | 'geoPoint'

/**
 * 字段定义
 */
export interface SchemaField {
  id?: string
  name: string
  type: FieldType
  required?: boolean
  options?: Record<string, unknown>
}

/**
 * Collection 类型
 */
export type CollectionType = 'base' | 'auth' | 'view'

/**
 * Collection 定义
 */
export interface Collection {
  id: string
  name: string
  type: CollectionType
  schema: SchemaField[]
  system?: boolean
  listRule?: string | null
  viewRule?: string | null
  createRule?: string | null
  updateRule?: string | null
  deleteRule?: string | null
  indexes?: string[]
  created: string
  updated: string
}

// ============ 基础 Atoms ============

/**
 * Collections 列表
 */
export const collectionsAtom = atom<Collection[]>([])

/**
 * 当前选中的 Collection
 */
export const activeCollectionAtom = atom<Collection | null>(null)

/**
 * 是否正在加载
 */
export const isCollectionsLoadingAtom = atom<boolean>(false)

/**
 * 筛选条件
 */
export const collectionsFilterAtom = atom<string>('')

// ============ 派生 Atoms ============

/**
 * 筛选后的 Collections（排除系统 collection）
 */
export const filteredCollectionsAtom = atom((get) => {
  const collections = get(collectionsAtom)
  const filter = get(collectionsFilterAtom).toLowerCase()

  return collections.filter((c) => {
    // 排除系统 collection
    if (c.system) return false
    // 按名称筛选
    if (filter && !c.name.toLowerCase().includes(filter)) return false
    return true
  })
})

/**
 * 系统 Collections
 */
export const systemCollectionsAtom = atom((get) => {
  return get(collectionsAtom).filter((c) => c.system)
})

// ============ Action Atoms ============

/**
 * 设置 Collections
 */
export const setCollections = atom(null, (_get, set, collections: Collection[]) => {
  set(collectionsAtom, collections)
})

/**
 * 设置当前 Collection
 */
export const setActiveCollection = atom(null, (_get, set, collection: Collection | null) => {
  set(activeCollectionAtom, collection)
})

/**
 * 设置加载状态
 */
export const setCollectionsLoading = atom(null, (_get, set, loading: boolean) => {
  set(isCollectionsLoadingAtom, loading)
})

/**
 * 设置筛选条件
 */
export const setCollectionsFilter = atom(null, (_get, set, filter: string) => {
  set(collectionsFilterAtom, filter)
})

/**
 * 添加 Collection
 */
export const addCollection = atom(null, (get, set, collection: Collection) => {
  set(collectionsAtom, [...get(collectionsAtom), collection])
})

/**
 * 更新 Collection
 */
export const updateCollection = atom(null, (get, set, collection: Collection) => {
  set(
    collectionsAtom,
    get(collectionsAtom).map((c) => (c.id === collection.id ? collection : c))
  )
})

/**
 * 移除 Collection
 */
export const removeCollection = atom(null, (get, set, id: string) => {
  set(
    collectionsAtom,
    get(collectionsAtom).filter((c) => c.id !== id)
  )
})
