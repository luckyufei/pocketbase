/**
 * useAnalytics Hook
 * 分析数据操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
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
  type AnalyticsData,
  type AnalyticsTimeRange,
} from '../store'

/**
 * 分析数据 Hook
 */
export function useAnalytics() {
  const summary = useAtomValue(summaryAtom)
  const historyData = useAtomValue(historyDataAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const error = useAtomValue(errorAtom)
  const selectedRange = useAtomValue(selectedRangeAtom)
  const setSummary = useSetAtom(setSummaryAtom)
  const setHistoryData = useSetAtom(setHistoryDataAtom)
  const setSelectedRange = useSetAtom(setSelectedRangeAtom)
  const setError = useSetAtom(setErrorAtom)

  const pb = getApiClient()

  /**
   * 获取时间范围对应的天数
   */
  const getRangeDays = useCallback((range: AnalyticsTimeRange): number => {
    switch (range) {
      case '7d':
        return 7
      case '30d':
        return 30
      case '90d':
        return 90
      default:
        return 7
    }
  }, [])

  /**
   * 加载汇总数据
   */
  const loadSummary = useCallback(async () => {
    try {
      const days = getRangeDays(selectedRange)
      const response = await pb.send('/api/analytics/summary', {
        method: 'GET',
        query: {
          days: days.toString(),
        },
      })
      setSummary(response as AnalyticsSummary)
    } catch (err: any) {
      if (err.status !== 404) {
        throw err
      }
      setSummary(null)
    }
  }, [pb, selectedRange, getRangeDays, setSummary])

  /**
   * 加载历史数据
   */
  const loadHistoryData = useCallback(async () => {
    try {
      const days = getRangeDays(selectedRange)
      const response = await pb.send('/api/analytics/history', {
        method: 'GET',
        query: {
          days: days.toString(),
        },
      })
      setHistoryData((response.items || []) as AnalyticsData[])
    } catch (err) {
      setHistoryData([])
      throw err
    }
  }, [pb, selectedRange, getRangeDays, setHistoryData])

  /**
   * 加载所有数据
   */
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await Promise.all([loadSummary(), loadHistoryData()])
    } catch (err: any) {
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [loadSummary, loadHistoryData, setIsLoading, setError])

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  /**
   * 设置时间范围
   */
  const changeRange = useCallback(
    (range: AnalyticsTimeRange) => {
      setSelectedRange(range)
    },
    [setSelectedRange]
  )

  return {
    summary,
    historyData,
    isLoading,
    error,
    selectedRange,
    loadData,
    refresh,
    changeRange,
  }
}
