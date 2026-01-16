// T056: Records Store 测试
import { describe, it, expect, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import type { RecordModel, ListResult } from 'pocketbase'
import {
  recordsAtom,
  activeRecordAtom,
  selectedRecordIdsAtom,
  isAllSelectedAtom,
  setRecordsAtom,
  addRecordAtom,
  updateRecordAtom,
  deleteRecordAtom,
  deleteRecordsAtom,
  toggleRecordSelectionAtom,
  toggleAllSelectionAtom,
  resetRecordsAtom,
} from './index'

const mockRecords: RecordModel[] = [
  { id: '1', collectionId: 'c1', collectionName: 'posts', title: 'Post 1' } as RecordModel,
  { id: '2', collectionId: 'c1', collectionName: 'posts', title: 'Post 2' } as RecordModel,
  { id: '3', collectionId: 'c1', collectionName: 'posts', title: 'Post 3' } as RecordModel,
]

const mockListResult: ListResult<RecordModel> = {
  items: mockRecords,
  page: 1,
  perPage: 20,
  totalItems: 3,
  totalPages: 1,
}

describe('Records Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('初始状态', () => {
    it('recordsAtom 应该有初始值', () => {
      const state = store.get(recordsAtom)
      expect(state.items).toEqual([])
      expect(state.page).toBe(1)
      expect(state.perPage).toBe(20)
    })

    it('activeRecordAtom 应该为 null', () => {
      expect(store.get(activeRecordAtom)).toBeNull()
    })

    it('selectedRecordIdsAtom 应该为空 Set', () => {
      expect(store.get(selectedRecordIdsAtom).size).toBe(0)
    })
  })

  describe('setRecordsAtom', () => {
    it('应该设置 records', () => {
      store.set(setRecordsAtom, mockListResult)
      const state = store.get(recordsAtom)

      expect(state.items).toEqual(mockRecords)
      expect(state.totalItems).toBe(3)
    })

    it('应该清空选中状态', () => {
      store.set(selectedRecordIdsAtom, new Set(['1', '2']))
      store.set(setRecordsAtom, mockListResult)

      expect(store.get(selectedRecordIdsAtom).size).toBe(0)
    })
  })

  describe('addRecordAtom', () => {
    it('应该添加 record 到列表开头', () => {
      store.set(setRecordsAtom, mockListResult)
      const newRecord = { id: '4', title: 'Post 4' } as RecordModel

      store.set(addRecordAtom, newRecord)
      const state = store.get(recordsAtom)

      expect(state.items[0].id).toBe('4')
      expect(state.totalItems).toBe(4)
    })
  })

  describe('updateRecordAtom', () => {
    it('应该更新 record', () => {
      store.set(setRecordsAtom, mockListResult)
      const updated = { ...mockRecords[1], title: 'Updated Post' } as RecordModel

      store.set(updateRecordAtom, updated)
      const state = store.get(recordsAtom)

      expect(state.items.find((r) => r.id === '2')?.title).toBe('Updated Post')
    })

    it('应该更新 activeRecord 如果是当前选中的', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(activeRecordAtom, mockRecords[1])

      const updated = { ...mockRecords[1], title: 'Updated Post' } as RecordModel
      store.set(updateRecordAtom, updated)

      expect((store.get(activeRecordAtom) as any)?.title).toBe('Updated Post')
    })
  })

  describe('deleteRecordAtom', () => {
    it('应该删除 record', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(deleteRecordAtom, '2')

      const state = store.get(recordsAtom)
      expect(state.items).toHaveLength(2)
      expect(state.totalItems).toBe(2)
    })

    it('应该清空 activeRecord 如果删除的是当前选中的', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(activeRecordAtom, mockRecords[1])
      store.set(deleteRecordAtom, '2')

      expect(store.get(activeRecordAtom)).toBeNull()
    })
  })

  describe('deleteRecordsAtom', () => {
    it('应该批量删除 records', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(deleteRecordsAtom, ['1', '3'])

      const state = store.get(recordsAtom)
      expect(state.items).toHaveLength(1)
      expect(state.items[0].id).toBe('2')
    })
  })

  describe('toggleRecordSelectionAtom', () => {
    it('应该切换选中状态', () => {
      store.set(setRecordsAtom, mockListResult)

      store.set(toggleRecordSelectionAtom, '1')
      expect(store.get(selectedRecordIdsAtom).has('1')).toBe(true)

      store.set(toggleRecordSelectionAtom, '1')
      expect(store.get(selectedRecordIdsAtom).has('1')).toBe(false)
    })
  })

  describe('toggleAllSelectionAtom', () => {
    it('应该全选', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(toggleAllSelectionAtom)

      expect(store.get(selectedRecordIdsAtom).size).toBe(3)
      expect(store.get(isAllSelectedAtom)).toBe(true)
    })

    it('应该取消全选', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(toggleAllSelectionAtom)
      store.set(toggleAllSelectionAtom)

      expect(store.get(selectedRecordIdsAtom).size).toBe(0)
      expect(store.get(isAllSelectedAtom)).toBe(false)
    })
  })

  describe('resetRecordsAtom', () => {
    it('应该重置所有状态', () => {
      store.set(setRecordsAtom, mockListResult)
      store.set(activeRecordAtom, mockRecords[0])
      store.set(selectedRecordIdsAtom, new Set(['1', '2']))

      store.set(resetRecordsAtom)

      expect(store.get(recordsAtom).items).toEqual([])
      expect(store.get(activeRecordAtom)).toBeNull()
      expect(store.get(selectedRecordIdsAtom).size).toBe(0)
    })
  })
})
