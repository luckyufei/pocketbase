/**
 * 监控 Store 测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai/vanilla'
import {
  currentMetricsAtom,
  historyDataAtom,
  isLoadingAtom,
  errorAtom,
  selectedRangeAtom,
  selectedHoursAtom,
  setCurrentMetricsAtom,
  setHistoryDataAtom,
  setSelectedRangeAtom,
  setErrorAtom,
  type SystemMetrics,
} from './index'

describe('Monitoring Store', () => {
  let store: ReturnType<typeof createStore>

  const mockMetrics: SystemMetrics = {
    timestamp: '2024-01-01T00:00:00Z',
    cpu: 25.5,
    memory: 60.2,
    memoryTotal: 16000,
    memoryUsed: 9600,
    goroutines: 150,
    dbConnections: 10,
    dbOpenConnections: 5,
    dbIdleConnections: 5,
    requestsTotal: 10000,
    requestsPerSecond: 50,
    avgResponseTime: 25.5,
  }

  beforeEach(() => {
    store = createStore()
  })

  describe('currentMetricsAtom', () => {
    it('should default to null', () => {
      expect(store.get(currentMetricsAtom)).toBeNull()
    })

    it('should update current metrics', () => {
      store.set(setCurrentMetricsAtom, mockMetrics)
      expect(store.get(currentMetricsAtom)).toEqual(mockMetrics)
    })
  })

  describe('historyDataAtom', () => {
    it('should default to empty array', () => {
      expect(store.get(historyDataAtom)).toEqual([])
    })

    it('should update history data', () => {
      const history = [mockMetrics, { ...mockMetrics, timestamp: '2024-01-01T01:00:00Z' }]
      store.set(setHistoryDataAtom, history)
      expect(store.get(historyDataAtom)).toEqual(history)
    })
  })

  describe('selectedRangeAtom', () => {
    it('should default to 24h', () => {
      expect(store.get(selectedRangeAtom)).toBe('24h')
    })

    it('should update selected range', () => {
      store.set(setSelectedRangeAtom, '7d')
      expect(store.get(selectedRangeAtom)).toBe('7d')
    })
  })

  describe('selectedHoursAtom', () => {
    it('should return 24 for 24h range', () => {
      expect(store.get(selectedHoursAtom)).toBe(24)
    })

    it('should return 168 for 7d range', () => {
      store.set(setSelectedRangeAtom, '7d')
      expect(store.get(selectedHoursAtom)).toBe(168)
    })

    it('should return 1 for 1h range', () => {
      store.set(setSelectedRangeAtom, '1h')
      expect(store.get(selectedHoursAtom)).toBe(1)
    })
  })

  describe('isLoadingAtom', () => {
    it('should default to false', () => {
      expect(store.get(isLoadingAtom)).toBe(false)
    })
  })

  describe('errorAtom', () => {
    it('should default to null', () => {
      expect(store.get(errorAtom)).toBeNull()
    })

    it('should update error', () => {
      store.set(setErrorAtom, 'Failed to load metrics')
      expect(store.get(errorAtom)).toBe('Failed to load metrics')
    })

    it('should clear error', () => {
      store.set(setErrorAtom, 'Error')
      store.set(setErrorAtom, null)
      expect(store.get(errorAtom)).toBeNull()
    })
  })
})
