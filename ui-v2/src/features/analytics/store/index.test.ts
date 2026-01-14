/**
 * Analytics Store 测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai/vanilla'
import {
  summaryAtom,
  historyDataAtom,
  isLoadingAtom,
  errorAtom,
  selectedRangeAtom,
  setSummaryAtom,
  setHistoryDataAtom,
  setSelectedRangeAtom,
  setErrorAtom,
  type AnalyticsSummary,
} from './index'

describe('Analytics Store', () => {
  let store: ReturnType<typeof createStore>

  const mockSummary: AnalyticsSummary = {
    totalPageViews: 10000,
    totalUniqueVisitors: 5000,
    totalSessions: 6000,
    avgSessionDuration: 120,
    bounceRate: 35.5,
    topPages: [
      { url: '/', views: 1000, uniqueViews: 800 },
      { url: '/about', views: 500, uniqueViews: 400 },
    ],
    topSources: [
      { source: 'google', visits: 3000, percentage: 50 },
      { source: 'direct', visits: 2000, percentage: 33.3 },
    ],
  }

  beforeEach(() => {
    store = createStore()
  })

  describe('summaryAtom', () => {
    it('should default to null', () => {
      expect(store.get(summaryAtom)).toBeNull()
    })

    it('should update summary', () => {
      store.set(setSummaryAtom, mockSummary)
      expect(store.get(summaryAtom)).toEqual(mockSummary)
    })
  })

  describe('historyDataAtom', () => {
    it('should default to empty array', () => {
      expect(store.get(historyDataAtom)).toEqual([])
    })

    it('should update history data', () => {
      const history = [
        {
          timestamp: '2024-01-01',
          pageViews: 100,
          uniqueVisitors: 50,
          sessions: 60,
          avgSessionDuration: 120,
          bounceRate: 30,
        },
      ]
      store.set(setHistoryDataAtom, history)
      expect(store.get(historyDataAtom)).toEqual(history)
    })
  })

  describe('selectedRangeAtom', () => {
    it('should default to 7d', () => {
      expect(store.get(selectedRangeAtom)).toBe('7d')
    })

    it('should update selected range', () => {
      store.set(setSelectedRangeAtom, '30d')
      expect(store.get(selectedRangeAtom)).toBe('30d')
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
      store.set(setErrorAtom, 'Failed to load analytics')
      expect(store.get(errorAtom)).toBe('Failed to load analytics')
    })

    it('should clear error', () => {
      store.set(setErrorAtom, 'Error')
      store.set(setErrorAtom, null)
      expect(store.get(errorAtom)).toBeNull()
    })
  })
})
