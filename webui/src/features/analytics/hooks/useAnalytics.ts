/**
 * useAnalytics Hook
 * 调用后端 /api/analytics/* API
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useRef } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import { ClientResponseError } from 'pocketbase'
import {
  summaryAtom,
  dailyDataAtom,
  topPagesAtom,
  topSourcesAtom,
  browsersAtom,
  osStatsAtom,
  isLoadingAtom,
  errorAtom,
  selectedRangeAtom,
  setSummaryAtom,
  setDailyDataAtom,
  setTopPagesAtom,
  setTopSourcesAtom,
  setBrowsersAtom,
  setOsStatsAtom,
  setSelectedRangeAtom,
  setErrorAtom,
  setIsLoadingAtom,
  type AnalyticsSummary,
  type DailyStats,
  type TopPage,
  type TopSource,
  type DeviceStats,
  type AnalyticsTimeRange,
} from '../store'

/**
 * 分类来源类型
 */
function classifySource(source: string): TopSource['type'] {
  if (!source) return 'direct'
  const s = source.toLowerCase()
  if (s.includes('google') || s.includes('bing') || s.includes('baidu') || s.includes('yahoo')) {
    return 'search'
  }
  if (s.includes('facebook') || s.includes('twitter') || s.includes('linkedin') || s.includes('weibo')) {
    return 'social'
  }
  return 'referral'
}

/**
 * 分析数据 Hook
 */
export function useAnalytics() {
  const summary = useAtomValue(summaryAtom)
  const dailyData = useAtomValue(dailyDataAtom)
  const topPages = useAtomValue(topPagesAtom)
  const topSources = useAtomValue(topSourcesAtom)
  const browsers = useAtomValue(browsersAtom)
  const osStats = useAtomValue(osStatsAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const error = useAtomValue(errorAtom)
  const selectedRange = useAtomValue(selectedRangeAtom)
  
  const setSummary = useSetAtom(setSummaryAtom)
  const setDailyData = useSetAtom(setDailyDataAtom)
  const setTopPages = useSetAtom(setTopPagesAtom)
  const setTopSources = useSetAtom(setTopSourcesAtom)
  const setBrowsers = useSetAtom(setBrowsersAtom)
  const setOsStats = useSetAtom(setOsStatsAtom)
  const setSelectedRange = useSetAtom(setSelectedRangeAtom)
  const setError = useSetAtom(setErrorAtom)

  const pb = getApiClient()
  // 请求计数器，用于生成唯一 requestKey 避免自动取消
  const requestIdRef = useRef(0)

  /**
   * 判断是否为请求取消错误（不应显示给用户）
   */
  const isAbortError = (err: unknown): boolean => {
    if (err instanceof ClientResponseError) {
      return err.isAbort
    }
    return false
  }

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async (reqId: number) => {
    try {
      const response = await pb.send('/api/analytics/stats', {
        method: 'GET',
        query: { range: selectedRange },
        requestKey: `analytics-stats-${reqId}`,
      })
      
      setSummary({
        totalPV: response.summary?.totalPV || 0,
        totalUV: response.summary?.totalUV || 0,
        bounceRate: response.summary?.bounceRate || 0,
        avgDur: response.summary?.avgDur || 0,
      } as AnalyticsSummary)
      
      setDailyData((response.daily || []) as DailyStats[])
    } catch (err: any) {
      if (isAbortError(err)) return // 忽略取消的请求
      if (err.status !== 404) throw err
      setSummary(null)
      setDailyData([])
    }
  }, [pb, selectedRange, setSummary, setDailyData])

  /**
   * 加载 Top 页面
   */
  const loadTopPages = useCallback(async (reqId: number) => {
    try {
      const response = await pb.send('/api/analytics/top-pages', {
        method: 'GET',
        query: { range: selectedRange, limit: '10' },
        requestKey: `analytics-top-pages-${reqId}`,
      })
      
      setTopPages((response.pages || []).map((p: any) => ({
        path: p.path,
        pv: p.pv,
        visitors: p.visitors,
      })) as TopPage[])
    } catch (err) {
      if (isAbortError(err)) return
      setTopPages([])
    }
  }, [pb, selectedRange, setTopPages])

  /**
   * 加载 Top 来源
   */
  const loadTopSources = useCallback(async (reqId: number) => {
    try {
      const response = await pb.send('/api/analytics/top-sources', {
        method: 'GET',
        query: { range: selectedRange, limit: '10' },
        requestKey: `analytics-top-sources-${reqId}`,
      })
      
      setTopSources((response.sources || []).map((s: any) => ({
        source: s.source,
        visitors: s.visitors,
        type: classifySource(s.source),
      })) as TopSource[])
    } catch (err) {
      if (isAbortError(err)) return
      setTopSources([])
    }
  }, [pb, selectedRange, setTopSources])

  /**
   * 加载设备统计
   */
  const loadDevices = useCallback(async (reqId: number) => {
    try {
      const response = await pb.send('/api/analytics/devices', {
        method: 'GET',
        query: { range: selectedRange },
        requestKey: `analytics-devices-${reqId}`,
      })
      
      setBrowsers((response.browsers || []).map((b: any) => ({
        name: b.name,
        visitors: b.visitors,
      })) as DeviceStats[])
      
      setOsStats((response.os || []).map((o: any) => ({
        name: o.name,
        visitors: o.visitors,
      })) as DeviceStats[])
    } catch (err) {
      if (isAbortError(err)) return
      setBrowsers([])
      setOsStats([])
    }
  }, [pb, selectedRange, setBrowsers, setOsStats])

  /**
   * 加载所有数据
   */
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    // 每次调用生成新的请求 ID，避免自动取消冲突
    const reqId = ++requestIdRef.current

    try {
      await Promise.all([
        loadStats(reqId),
        loadTopPages(reqId),
        loadTopSources(reqId),
        loadDevices(reqId),
      ])
    } catch (err: any) {
      // 忽略请求取消错误
      if (isAbortError(err)) return
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [loadStats, loadTopPages, loadTopSources, loadDevices, setIsLoading, setError])

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
    dailyData,
    topPages,
    topSources,
    browsers,
    osStats,
    isLoading,
    error,
    selectedRange,
    loadData,
    refresh,
    changeRange,
  }
}
