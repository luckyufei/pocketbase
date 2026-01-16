/**
 * useTraces Hook
 * Trace 操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
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
} from '../store'

const PER_PAGE = 50

/**
 * Trace 操作 Hook
 */
export function useTraces() {
  const traces = useAtomValue(tracesAtom)
  const activeTrace = useAtomValue(activeTraceAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const filter = useAtomValue(filterAtom)
  const sort = useAtomValue(sortAtom)
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom)
  const hasMore = useAtomValue(hasMoreAtom)
  const setHasMore = useSetAtom(hasMoreAtom)
  const stats = useAtomValue(statsAtom)
  const addTraces = useSetAtom(addTracesAtom)
  const clearTraces = useSetAtom(clearTracesAtom)
  const setActiveTrace = useSetAtom(setActiveTraceAtom)
  const setFilter = useSetAtom(setFilterAtom)
  const setSort = useSetAtom(setSortAtom)
  const setStats = useSetAtom(setStatsAtom)

  const pb = getApiClient()

  /**
   * 加载 Traces
   */
  const loadTraces = useCallback(
    async (page = 1, append = false) => {
      setIsLoading(true)

      try {
        const result = await pb.send('/api/traces', {
          method: 'GET',
          query: {
            page: page.toString(),
            perPage: PER_PAGE.toString(),
            sort,
            filter: filter || undefined,
          },
        })

        if (!append) {
          clearTraces()
        }

        const items = (result.items || []) as TraceEntry[]
        addTraces(items)
        setCurrentPage(page)
        setHasMore(items.length >= PER_PAGE)
      } catch (err) {
        console.error('Failed to load traces:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [pb, sort, filter, clearTraces, addTraces, setCurrentPage, setHasMore, setIsLoading]
  )

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    await loadTraces(currentPage + 1, true)
  }, [isLoading, hasMore, currentPage, loadTraces])

  /**
   * 刷新
   */
  const refresh = useCallback(async () => {
    await loadTraces(1, false)
  }, [loadTraces])

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async () => {
    try {
      const result = await pb.send('/api/traces/stats', {
        method: 'GET',
      })
      setStats(result)
    } catch (err) {
      console.error('Failed to load trace stats:', err)
    }
  }, [pb, setStats])

  return {
    traces,
    activeTrace,
    isLoading,
    filter,
    sort,
    currentPage,
    hasMore,
    stats,
    loadTraces,
    loadMore,
    refresh,
    loadStats,
    setActiveTrace,
    setFilter,
    setSort,
    clearTraces,
  }
}
