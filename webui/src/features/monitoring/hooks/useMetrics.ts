/**
 * useMetrics Hook
 * 监控指标操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import { getApiClient } from '@/lib/ApiClient'
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
  type TimeRange,
} from '../store'

const REFRESH_INTERVAL = 30000 // 30 秒自动刷新

/**
 * 监控指标 Hook
 */
export function useMetrics() {
  const currentMetrics = useAtomValue(currentMetricsAtom)
  const historyData = useAtomValue(historyDataAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const error = useAtomValue(errorAtom)
  const selectedRange = useAtomValue(selectedRangeAtom)
  const selectedHours = useAtomValue(selectedHoursAtom)
  const setCurrentMetrics = useSetAtom(setCurrentMetricsAtom)
  const setHistoryData = useSetAtom(setHistoryDataAtom)
  const setSelectedRange = useSetAtom(setSelectedRangeAtom)
  const setError = useSetAtom(setErrorAtom)

  const pb = getApiClient()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * 加载当前指标
   */
  const loadCurrentMetrics = useCallback(async () => {
    try {
      const response = await pb.send('/api/system/metrics/current', {
        method: 'GET',
        // 使用唯一的 requestKey 避免自动取消
        requestKey: `metrics-current-${Date.now()}`,
      })
      setCurrentMetrics(response as SystemMetrics)
    } catch (err: any) {
      // 忽略自动取消错误
      if (err.isAbort) return
      if (err.status !== 404) {
        throw err
      }
      setCurrentMetrics(null)
    }
  }, [pb, setCurrentMetrics])

  /**
   * 加载历史数据
   */
  const loadHistoryData = useCallback(async () => {
    try {
      const response = await pb.send('/api/system/metrics', {
        method: 'GET',
        query: {
          hours: selectedHours.toString(),
          limit: '10000',
        },
        // 使用唯一的 requestKey 避免自动取消
        requestKey: `metrics-history-${Date.now()}`,
      })
      setHistoryData((response.items || []) as SystemMetrics[])
    } catch (err: any) {
      // 忽略自动取消错误
      if (err.isAbort) return
      setHistoryData([])
      throw err
    }
  }, [pb, selectedHours, setHistoryData])

  /**
   * 加载所有数据
   */
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await Promise.all([loadCurrentMetrics(), loadHistoryData()])
    } catch (err: any) {
      // 忽略自动取消错误
      if (err.isAbort) return
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [loadCurrentMetrics, loadHistoryData, setIsLoading, setError])

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
    (range: TimeRange) => {
      setSelectedRange(range)
    },
    [setSelectedRange]
  )

  /**
   * 启动自动刷新
   */
  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    intervalRef.current = setInterval(loadData, REFRESH_INTERVAL)
  }, [loadData])

  /**
   * 停止自动刷新
   */
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      stopAutoRefresh()
    }
  }, [stopAutoRefresh])

  return {
    currentMetrics,
    historyData,
    isLoading,
    error,
    selectedRange,
    selectedHours,
    loadData,
    refresh,
    changeRange,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
