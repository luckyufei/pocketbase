// T043: Collections Store 测试
import { describe, it, expect, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  collectionsAtom,
  activeCollectionAtom,
  activeCollectionIdAtom,
  collectionsByTypeAtom,
  searchQueryAtom,
  filteredCollectionsAtom,
  setCollectionsAtom,
  addCollectionAtom,
  updateCollectionAtom,
  deleteCollectionAtom,
} from './index'
import type { CollectionModel } from 'pocketbase'

const mockCollections: CollectionModel[] = [
  { id: '1', name: 'users', type: 'auth' } as CollectionModel,
  { id: '2', name: 'posts', type: 'base' } as CollectionModel,
  { id: '3', name: 'comments', type: 'base' } as CollectionModel,
  { id: '4', name: 'stats', type: 'view' } as CollectionModel,
]

describe('Collections Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('初始状态', () => {
    it('collectionsAtom 应该为空数组', () => {
      expect(store.get(collectionsAtom)).toEqual([])
    })

    it('activeCollectionAtom 应该为 null', () => {
      expect(store.get(activeCollectionAtom)).toBeNull()
    })

    it('activeCollectionIdAtom 应该为 null', () => {
      expect(store.get(activeCollectionIdAtom)).toBeNull()
    })
  })

  describe('setCollectionsAtom', () => {
    it('应该设置 collections', () => {
      store.set(setCollectionsAtom, mockCollections)
      expect(store.get(collectionsAtom)).toEqual(mockCollections)
    })
  })

  describe('collectionsByTypeAtom', () => {
    it('应该按类型分组', () => {
      store.set(setCollectionsAtom, mockCollections)
      const byType = store.get(collectionsByTypeAtom)

      expect(byType.auth).toHaveLength(1)
      expect(byType.base).toHaveLength(2)
      expect(byType.view).toHaveLength(1)
    })
  })

  describe('filteredCollectionsAtom', () => {
    it('空查询应该返回所有', () => {
      store.set(setCollectionsAtom, mockCollections)
      expect(store.get(filteredCollectionsAtom)).toEqual(mockCollections)
    })

    it('应该按名称过滤', () => {
      store.set(setCollectionsAtom, mockCollections)
      store.set(searchQueryAtom, 'post')

      const filtered = store.get(filteredCollectionsAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('posts')
    })
  })

  describe('addCollectionAtom', () => {
    it('应该添加 collection', () => {
      store.set(setCollectionsAtom, mockCollections)
      const newCollection = { id: '5', name: 'tags', type: 'base' } as CollectionModel

      store.set(addCollectionAtom, newCollection)
      expect(store.get(collectionsAtom)).toHaveLength(5)
    })
  })

  describe('updateCollectionAtom', () => {
    it('应该更新 collection', () => {
      store.set(setCollectionsAtom, mockCollections)
      const updated = { ...mockCollections[1], name: 'articles' } as CollectionModel

      store.set(updateCollectionAtom, updated)
      const collections = store.get(collectionsAtom)

      expect(collections.find((c) => c.id === '2')?.name).toBe('articles')
    })

    it('应该更新 activeCollection 如果是当前选中的', () => {
      store.set(setCollectionsAtom, mockCollections)
      store.set(activeCollectionAtom, mockCollections[1])

      const updated = { ...mockCollections[1], name: 'articles' } as CollectionModel
      store.set(updateCollectionAtom, updated)

      expect(store.get(activeCollectionAtom)?.name).toBe('articles')
    })
  })

  describe('deleteCollectionAtom', () => {
    it('应该删除 collection', () => {
      store.set(setCollectionsAtom, mockCollections)
      store.set(deleteCollectionAtom, '2')

      expect(store.get(collectionsAtom)).toHaveLength(3)
      expect(store.get(collectionsAtom).find((c) => c.id === '2')).toBeUndefined()
    })

    it('应该清空 activeCollection 如果删除的是当前选中的', () => {
      store.set(setCollectionsAtom, mockCollections)
      store.set(activeCollectionAtom, mockCollections[1])
      store.set(deleteCollectionAtom, '2')

      expect(store.get(activeCollectionAtom)).toBeNull()
    })
  })
})
