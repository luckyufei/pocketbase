/**
 * Logs Store 测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import {
  logsAtom,
  activeLogAtom,
  isLoadingAtom,
  filterAtom,
  sortAtom,
  currentPageAtom,
  hasMoreAtom,
  addLogsAtom,
  clearLogsAtom,
  setActiveLogAtom,
  setFilterAtom,
  setSortAtom,
  type LogEntry,
} from './index'

describe('Logs Store', () => {
  let store: ReturnType<typeof createStore>

  const mockLog: LogEntry = {
    id: 'log1',
    created: '2024-01-01T00:00:00Z',
    level: 4,
    message: 'Test log message',
    data: { key: 'value' },
  }

  beforeEach(() => {
    store = createStore()
  })

  describe('logsAtom', () => {
    it('should have default empty array', () => {
      expect(store.get(logsAtom)).toEqual([])
    })

    it('should update logs', () => {
      store.set(logsAtom, [mockLog])
      expect(store.get(logsAtom)).toEqual([mockLog])
    })
  })

  describe('activeLogAtom', () => {
    it('should default to null', () => {
      expect(store.get(activeLogAtom)).toBeNull()
    })

    it('should update active log', () => {
      store.set(activeLogAtom, mockLog)
      expect(store.get(activeLogAtom)).toEqual(mockLog)
    })
  })

  describe('isLoadingAtom', () => {
    it('should default to false', () => {
      expect(store.get(isLoadingAtom)).toBe(false)
    })
  })

  describe('filterAtom', () => {
    it('should default to empty string', () => {
      expect(store.get(filterAtom)).toBe('')
    })
  })

  describe('sortAtom', () => {
    it('should default to -@rowid', () => {
      expect(store.get(sortAtom)).toBe('-@rowid')
    })
  })

  describe('addLogsAtom', () => {
    it('should add new logs', () => {
      store.set(addLogsAtom, [mockLog])
      expect(store.get(logsAtom)).toEqual([mockLog])
    })

    it('should merge with existing logs', () => {
      const log2: LogEntry = { ...mockLog, id: 'log2', message: 'Second log' }
      store.set(logsAtom, [mockLog])
      store.set(addLogsAtom, [log2])
      expect(store.get(logsAtom)).toHaveLength(2)
    })

    it('should update existing log by id', () => {
      const updatedLog = { ...mockLog, message: 'Updated message' }
      store.set(logsAtom, [mockLog])
      store.set(addLogsAtom, [updatedLog])
      expect(store.get(logsAtom)).toHaveLength(1)
      expect(store.get(logsAtom)[0].message).toBe('Updated message')
    })
  })

  describe('clearLogsAtom', () => {
    it('should clear all logs', () => {
      store.set(logsAtom, [mockLog])
      store.set(clearLogsAtom)
      expect(store.get(logsAtom)).toEqual([])
    })

    it('should reset pagination', () => {
      store.set(currentPageAtom, 5)
      store.set(hasMoreAtom, true)
      store.set(clearLogsAtom)
      expect(store.get(currentPageAtom)).toBe(1)
      expect(store.get(hasMoreAtom)).toBe(false)
    })
  })

  describe('setActiveLogAtom', () => {
    it('should set active log', () => {
      store.set(setActiveLogAtom, mockLog)
      expect(store.get(activeLogAtom)).toEqual(mockLog)
    })

    it('should clear active log', () => {
      store.set(activeLogAtom, mockLog)
      store.set(setActiveLogAtom, null)
      expect(store.get(activeLogAtom)).toBeNull()
    })
  })

  describe('setFilterAtom', () => {
    it('should update filter', () => {
      store.set(setFilterAtom, 'level:error')
      expect(store.get(filterAtom)).toBe('level:error')
    })
  })

  describe('setSortAtom', () => {
    it('should update sort', () => {
      store.set(setSortAtom, 'created')
      expect(store.get(sortAtom)).toBe('created')
    })
  })
})
