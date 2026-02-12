/**
 * useLogs Hook
 * 日志操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
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
  zoomAtom,
  setZoomAtom,
  withSuperuserLogsAtom,
  setWithSuperuserLogsAtom,
  chartDataAtom,
  totalLogsAtom,
  chartLoadingAtom,
  setChartDataAtom,
  setTotalLogsAtom,
  setChartLoadingAtom,
  type LogEntry,
  type ChartDataPoint,
} from '../store'

const PER_PAGE = 50

/**
 * 规范化日志过滤条件
 * 将简单搜索词转换为通配符表达式
 */
function normalizeLogsFilter(searchTerm: string): string {
  if (!searchTerm || searchTerm.trim() === '') {
    return ''
  }

  const term = searchTerm.trim()

  // 如果包含操作符，直接使用原表达式
  const operators = ['=', '!=', '~', '!~', '>', '<', '>=', '<=', '&&', '||']
  const hasOperator = operators.some((op) => term.includes(op))

  if (hasOperator) {
    return term
  }

  // 简单搜索词转换为通配符表达式
  const escapedTerm = term.replace(/"/g, '\\"')
  const fields = ['level', 'message', 'data']
  return fields.map((field) => `${field}~"${escapedTerm}"`).join('||')
}

/**
 * 日志操作 Hook
 */
export function useLogs() {
  const logs = useAtomValue(logsAtom)
  const activeLog = useAtomValue(activeLogAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const filter = useAtomValue(filterAtom)
  const sort = useAtomValue(sortAtom)
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom)
  const hasMore = useAtomValue(hasMoreAtom)
  const setHasMore = useSetAtom(hasMoreAtom)
  const zoom = useAtomValue(zoomAtom)
  const withSuperuserLogs = useAtomValue(withSuperuserLogsAtom)
  const chartData = useAtomValue(chartDataAtom)
  const totalLogs = useAtomValue(totalLogsAtom)
  const chartLoading = useAtomValue(chartLoadingAtom)

  const addLogs = useSetAtom(addLogsAtom)
  const clearLogs = useSetAtom(clearLogsAtom)
  const setActiveLog = useSetAtom(setActiveLogAtom)
  const setFilter = useSetAtom(setFilterAtom)
  const setSort = useSetAtom(setSortAtom)
  const setZoom = useSetAtom(setZoomAtom)
  const setWithSuperuserLogs = useSetAtom(setWithSuperuserLogsAtom)
  const setChartData = useSetAtom(setChartDataAtom)
  const setTotalLogs = useSetAtom(setTotalLogsAtom)
  const setChartLoading = useSetAtom(setChartLoadingAtom)

  const pb = getApiClient()

  /**
   * 构建预设过滤条件（超级用户过滤）
   */
  const buildPresets = useCallback(() => {
    return withSuperuserLogs ? '' : 'data.auth!="_superusers"'
  }, [withSuperuserLogs])

  /**
   * 构建筛选条件
   */
  const buildFilter = useCallback(() => {
    const filters: string[] = []

    // 添加预设过滤条件
    const presets = buildPresets()
    if (presets) {
      filters.push(`(${presets})`)
    }

    // 添加用户输入的过滤条件
    const normalizedFilter = normalizeLogsFilter(filter)
    if (normalizedFilter) {
      filters.push(`(${normalizedFilter})`)
    }

    // 添加时间范围过滤
    if (zoom.min && zoom.max) {
      filters.push(`(created >= "${zoom.min}" && created <= "${zoom.max}")`)
    }

    return filters.join(' && ')
  }, [filter, zoom, buildPresets])

  /**
   * 构建图表过滤条件（不包含时间范围）
   */
  const buildChartFilter = useCallback(() => {
    const filters: string[] = []

    const presets = buildPresets()
    if (presets) {
      filters.push(`(${presets})`)
    }

    const normalizedFilter = normalizeLogsFilter(filter)
    if (normalizedFilter) {
      filters.push(`(${normalizedFilter})`)
    }

    return filters.join(' && ')
  }, [filter, buildPresets])

  /**
   * 加载日志统计（图表数据）
   */
  const loadStats = useCallback(async () => {
    setChartLoading(true)

    try {
      const result = await pb.logs.getStats({
        filter: buildChartFilter(),
      })

      const data: ChartDataPoint[] = []
      let total = 0

      if (Array.isArray(result)) {
        for (const item of result) {
          data.push({
            date: item.date,
            total: item.total,
          })
          total += item.total
        }
      }

      setChartData(data)
      setTotalLogs(total)
    } catch (err: any) {
      if (err.isAbort) return
      console.error('Failed to load stats:', err)
      setChartData([])
      setTotalLogs(0)
    } finally {
      setChartLoading(false)
    }
  }, [pb, buildChartFilter, setChartData, setTotalLogs, setChartLoading])

  /**
   * 加载日志
   */
  const loadLogs = useCallback(
    async (page = 1, append = false) => {
      setIsLoading(true)

      try {
        const result = await pb.logs.getList(page, PER_PAGE, {
          sort,
          skipTotal: 1,
          filter: buildFilter(),
          // 使用唯一的 requestKey 避免自动取消
          requestKey: `logs-${page}-${Date.now()}`,
        })

        if (!append) {
          clearLogs()
        }

        const items = (result.items || []) as unknown as LogEntry[]
        addLogs(items)
        setCurrentPage(page)
        setHasMore(items.length >= PER_PAGE)
      } catch (err: any) {
        // 忽略自动取消错误
        if (err.isAbort) return
        console.error('Failed to load logs:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [pb, sort, buildFilter, clearLogs, addLogs, setCurrentPage, setHasMore, setIsLoading]
  )

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    await loadLogs(currentPage + 1, true)
  }, [isLoading, hasMore, currentPage, loadLogs])

  /**
   * 刷新
   */
  const refresh = useCallback(async () => {
    await Promise.all([loadLogs(1, false), loadStats()])
  }, [loadLogs, loadStats])

  /**
   * 删除日志
   */
  const deleteLog = useCallback(
    async (id: string) => {
      try {
        await pb.logs.delete(id)
        await refresh()
      } catch (err) {
        console.error('Failed to delete log:', err)
        throw err
      }
    },
    [pb, refresh]
  )

  return {
    logs,
    activeLog,
    isLoading,
    filter,
    sort,
    currentPage,
    hasMore,
    zoom,
    withSuperuserLogs,
    chartData,
    totalLogs,
    chartLoading,
    loadLogs,
    loadMore,
    loadStats,
    refresh,
    deleteLog,
    setActiveLog,
    setFilter,
    setSort,
    setZoom,
    setWithSuperuserLogs,
    clearLogs,
  }
}
