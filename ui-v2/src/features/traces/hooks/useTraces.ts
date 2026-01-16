/**
 * useTraces Hook
 * Trace 操作 Hook（OpenTelemetry 风格）
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import {
  tracesAtom,
  activeTraceIdAtom,
  traceSpansAtom,
  isLoadingAtom,
  isLoadingDetailAtom,
  filtersAtom,
  timeRangeAtom,
  currentPageAtom,
  totalItemsAtom,
  perPageAtom,
  totalPagesAtom,
  statsAtom,
  setTracesAtom,
  setTraceSpansAtom,
  clearTracesAtom,
  setActiveTraceIdAtom,
  setFiltersAtom,
  setTimeRangeAtom,
  setStatsAtom,
  type Span,
  type TraceFilters,
  type TraceStats,
} from '../store'

/**
 * 获取时间范围的开始时间（毫秒）
 */
function getStartTimeFromRange(range: '1h' | '6h' | '24h' | '7d'): number {
  const now = Date.now()
  const hoursMap = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 }
  return now - hoursMap[range] * 60 * 60 * 1000
}

/**
 * Trace 操作 Hook
 */
export function useTraces() {
  const traces = useAtomValue(tracesAtom)
  const activeTraceId = useAtomValue(activeTraceIdAtom)
  const traceSpans = useAtomValue(traceSpansAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const [isLoadingDetail, setIsLoadingDetail] = useAtom(isLoadingDetailAtom)
  const filters = useAtomValue(filtersAtom)
  const timeRange = useAtomValue(timeRangeAtom)
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom)
  const totalItems = useAtomValue(totalItemsAtom)
  const setTotalItems = useSetAtom(totalItemsAtom)
  const perPage = useAtomValue(perPageAtom)
  const totalPages = useAtomValue(totalPagesAtom)
  const stats = useAtomValue(statsAtom)
  const setTraces = useSetAtom(setTracesAtom)
  const setTraceSpans = useSetAtom(setTraceSpansAtom)
  const clearTraces = useSetAtom(clearTracesAtom)
  const setActiveTraceId = useSetAtom(setActiveTraceIdAtom)
  const setFilters = useSetAtom(setFiltersAtom)
  const setTimeRange = useSetAtom(setTimeRangeAtom)
  const setStats = useSetAtom(setStatsAtom)

  const pb = getApiClient()

  /**
   * 加载 Traces 列表（只获取根 Span）
   */
  const loadTraces = useCallback(
    async (page = 1) => {
      setIsLoading(true)

      try {
        const startTime = getStartTimeFromRange(timeRange)
        const query: Record<string, string> = {
          root_only: 'true',
          limit: perPage.toString(),
          offset: ((page - 1) * perPage).toString(),
          start_time: (startTime * 1000).toString(), // 转换为微秒
        }

        if (filters.operation) {
          query.operation = filters.operation
        }
        if (filters.status) {
          query.status = filters.status
        }
        if (filters.trace_id) {
          query.trace_id = filters.trace_id
        }

        const result = await pb.send('/api/traces', {
          method: 'GET',
          query,
          requestKey: `traces-list-${Date.now()}`,
        })

        setTraces((result.items || []) as Span[])
        setTotalItems(result.totalItems || 0)
        setCurrentPage(page)
      } catch (err: any) {
        if (err.isAbort) return
        console.error('Failed to load traces:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [pb, timeRange, perPage, filters, setTraces, setTotalItems, setCurrentPage, setIsLoading]
  )

  /**
   * 加载单个 Trace 的完整调用链
   */
  const loadTraceDetail = useCallback(
    async (traceId: string) => {
      setIsLoadingDetail(true)
      setActiveTraceId(traceId)

      try {
        const result = await pb.send(`/api/traces/${traceId}`, {
          method: 'GET',
          requestKey: `trace-detail-${traceId}-${Date.now()}`,
        })

        setTraceSpans((result.spans || []) as Span[])
      } catch (err: any) {
        if (err.isAbort) return
        console.error('Failed to load trace detail:', err)
        setTraceSpans([])
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [pb, setActiveTraceId, setTraceSpans, setIsLoadingDetail]
  )

  /**
   * 关闭详情
   */
  const closeDetail = useCallback(() => {
    setActiveTraceId(null)
  }, [setActiveTraceId])

  /**
   * 刷新
   */
  const refresh = useCallback(async () => {
    await Promise.all([loadTraces(1), loadStats()])
  }, [loadTraces])

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async () => {
    try {
      const startTime = getStartTimeFromRange(timeRange)
      const result = await pb.send('/api/traces/stats', {
        method: 'GET',
        query: {
          start_time: (startTime * 1000).toString(),
        },
        requestKey: `traces-stats-${Date.now()}`,
      })
      setStats(result as TraceStats)
    } catch (err: any) {
      if (err.isAbort) return
      console.error('Failed to load trace stats:', err)
    }
  }, [pb, timeRange, setStats])

  /**
   * 页面变更
   */
  const changePage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        loadTraces(page)
      }
    },
    [loadTraces, totalPages]
  )

  /**
   * 更新过滤器
   */
  const updateFilters = useCallback(
    (newFilters: TraceFilters) => {
      setFilters(newFilters)
    },
    [setFilters]
  )

  /**
   * 更新时间范围
   */
  const updateTimeRange = useCallback(
    (range: '1h' | '6h' | '24h' | '7d') => {
      setTimeRange(range)
    },
    [setTimeRange]
  )

  return {
    traces,
    activeTraceId,
    traceSpans,
    isLoading,
    isLoadingDetail,
    filters,
    timeRange,
    currentPage,
    totalItems,
    perPage,
    totalPages,
    stats,
    loadTraces,
    loadTraceDetail,
    closeDetail,
    refresh,
    loadStats,
    changePage,
    updateFilters,
    updateTimeRange,
    clearTraces,
  }
}
