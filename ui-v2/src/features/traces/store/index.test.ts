/**
 * Traces Store 测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai/vanilla'
import {
  tracesAtom,
  activeTraceAtom,
  isLoadingAtom,
  filterAtom,
  sortAtom,
  currentPageAtom,
  hasMoreAtom,
  statsAtom,
  addTracesAtom,
  clearTracesAtom,
  setActiveTraceAtom,
  setFilterAtom,
  setSortAtom,
  setStatsAtom,
  type TraceEntry,
} from './index'

describe('Traces Store', () => {
  let store: ReturnType<typeof createStore>

  const mockTrace: TraceEntry = {
    id: '1',
    url: '/api/test',
    method: 'GET',
    status: 200,
    auth: 'admin',
    ip: '127.0.0.1',
    referer: '',
    userAgent: 'Mozilla/5.0',
    execTime: 25.5,
    created: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    store = createStore()
  })

  describe('tracesAtom', () => {
    it('should default to empty array', () => {
      expect(store.get(tracesAtom)).toEqual([])
    })
  })

  describe('activeTraceAtom', () => {
    it('should default to null', () => {
      expect(store.get(activeTraceAtom)).toBeNull()
    })

    it('should update active trace', () => {
      store.set(setActiveTraceAtom, mockTrace)
      expect(store.get(activeTraceAtom)).toEqual(mockTrace)
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

    it('should update filter', () => {
      store.set(setFilterAtom, 'status>=400')
      expect(store.get(filterAtom)).toBe('status>=400')
    })
  })

  describe('sortAtom', () => {
    it('should default to -created', () => {
      expect(store.get(sortAtom)).toBe('-created')
    })

    it('should update sort', () => {
      store.set(setSortAtom, 'execTime')
      expect(store.get(sortAtom)).toBe('execTime')
    })
  })

  describe('addTracesAtom', () => {
    it('should add new traces', () => {
      store.set(addTracesAtom, [mockTrace])
      expect(store.get(tracesAtom)).toHaveLength(1)
    })

    it('should not add duplicate traces', () => {
      store.set(addTracesAtom, [mockTrace])
      store.set(addTracesAtom, [mockTrace])
      expect(store.get(tracesAtom)).toHaveLength(1)
    })

    it('should add unique traces', () => {
      store.set(addTracesAtom, [mockTrace])
      store.set(addTracesAtom, [{ ...mockTrace, id: '2' }])
      expect(store.get(tracesAtom)).toHaveLength(2)
    })
  })

  describe('clearTracesAtom', () => {
    it('should clear all traces', () => {
      store.set(addTracesAtom, [mockTrace])
      store.set(clearTracesAtom)
      expect(store.get(tracesAtom)).toEqual([])
    })

    it('should reset pagination', () => {
      store.set(currentPageAtom, 5)
      store.set(hasMoreAtom, true)
      store.set(clearTracesAtom)
      expect(store.get(currentPageAtom)).toBe(1)
      expect(store.get(hasMoreAtom)).toBe(false)
    })
  })

  describe('statsAtom', () => {
    it('should default to null', () => {
      expect(store.get(statsAtom)).toBeNull()
    })

    it('should update stats', () => {
      const stats = {
        totalRequests: 1000,
        avgResponseTime: 50,
        errorRate: 0.05,
        topEndpoints: [],
      }
      store.set(setStatsAtom, stats)
      expect(store.get(statsAtom)).toEqual(stats)
    })
  })
})
