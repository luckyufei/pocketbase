/**
 * Collections Store 单元测试
 * TDD: 红灯阶段
 */
import { describe, it, expect } from 'bun:test'
import { createStore } from 'jotai'
import {
  collectionsAtom,
  activeCollectionAtom,
  isCollectionsLoadingAtom,
  collectionsFilterAtom,
  filteredCollectionsAtom,
  setCollections,
  setActiveCollection,
  setCollectionsLoading,
  setCollectionsFilter,
  addCollection,
  updateCollection,
  removeCollection,
  type Collection,
} from './collections'

// 测试数据
const mockCollections: Collection[] = [
  {
    id: 'col1',
    name: 'users',
    type: 'auth',
    schema: [],
    created: '2024-01-01',
    updated: '2024-01-01',
  },
  {
    id: 'col2',
    name: 'posts',
    type: 'base',
    schema: [],
    created: '2024-01-01',
    updated: '2024-01-01',
  },
  {
    id: 'col3',
    name: '_logs',
    type: 'base',
    system: true,
    schema: [],
    created: '2024-01-01',
    updated: '2024-01-01',
  },
]

describe('Collections Store', () => {
  describe('collectionsAtom', () => {
    it('应该默认为空数组', () => {
      const store = createStore()
      expect(store.get(collectionsAtom)).toEqual([])
    })

    it('应该能设置 collections', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections)
      expect(store.get(collectionsAtom)).toEqual(mockCollections)
    })
  })

  describe('activeCollectionAtom', () => {
    it('应该默认为 null', () => {
      const store = createStore()
      expect(store.get(activeCollectionAtom)).toBeNull()
    })

    it('应该能设置当前 collection', () => {
      const store = createStore()
      store.set(activeCollectionAtom, mockCollections[0])
      expect(store.get(activeCollectionAtom)).toEqual(mockCollections[0])
    })
  })

  describe('isCollectionsLoadingAtom', () => {
    it('应该默认为 false', () => {
      const store = createStore()
      expect(store.get(isCollectionsLoadingAtom)).toBe(false)
    })
  })

  describe('collectionsFilterAtom', () => {
    it('应该默认为空字符串', () => {
      const store = createStore()
      expect(store.get(collectionsFilterAtom)).toBe('')
    })
  })

  describe('filteredCollectionsAtom', () => {
    it('无筛选时应该返回所有非系统 collections', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections)

      const filtered = store.get(filteredCollectionsAtom)
      expect(filtered).toHaveLength(2) // 排除系统 collection
      expect(filtered.map((c) => c.name)).toEqual(['users', 'posts'])
    })

    it('应该根据名称筛选', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections)
      store.set(collectionsFilterAtom, 'user')

      const filtered = store.get(filteredCollectionsAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('users')
    })

    it('筛选应该不区分大小写', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections)
      store.set(collectionsFilterAtom, 'POSTS')

      const filtered = store.get(filteredCollectionsAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('posts')
    })
  })

  describe('Action Atoms', () => {
    it('setCollections 应该设置 collections', () => {
      const store = createStore()
      store.set(setCollections, mockCollections)
      expect(store.get(collectionsAtom)).toEqual(mockCollections)
    })

    it('setActiveCollection 应该设置当前 collection', () => {
      const store = createStore()
      store.set(setActiveCollection, mockCollections[1])
      expect(store.get(activeCollectionAtom)).toEqual(mockCollections[1])
    })

    it('setCollectionsLoading 应该设置加载状态', () => {
      const store = createStore()
      store.set(setCollectionsLoading, true)
      expect(store.get(isCollectionsLoadingAtom)).toBe(true)
    })

    it('setCollectionsFilter 应该设置筛选条件', () => {
      const store = createStore()
      store.set(setCollectionsFilter, 'test')
      expect(store.get(collectionsFilterAtom)).toBe('test')
    })

    it('addCollection 应该添加新 collection', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections.slice(0, 2))

      const newCollection: Collection = {
        id: 'col4',
        name: 'comments',
        type: 'base',
        schema: [],
        created: '2024-01-02',
        updated: '2024-01-02',
      }
      store.set(addCollection, newCollection)

      const collections = store.get(collectionsAtom)
      expect(collections).toHaveLength(3)
      expect(collections[2].name).toBe('comments')
    })

    it('updateCollection 应该更新 collection', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections)

      const updated: Collection = {
        ...mockCollections[0],
        name: 'users_updated',
      }
      store.set(updateCollection, updated)

      const collections = store.get(collectionsAtom)
      expect(collections[0].name).toBe('users_updated')
    })

    it('removeCollection 应该移除 collection', () => {
      const store = createStore()
      store.set(collectionsAtom, mockCollections)

      store.set(removeCollection, 'col1')

      const collections = store.get(collectionsAtom)
      expect(collections).toHaveLength(2)
      expect(collections.find((c) => c.id === 'col1')).toBeUndefined()
    })
  })
})
