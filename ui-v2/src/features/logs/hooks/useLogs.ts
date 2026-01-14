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
  type LogEntry,
} from '../store'

const PER_PAGE = 50

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
  const addLogs = useSetAtom(addLogsAtom)
  const clearLogs = useSetAtom(clearLogsAtom)
  const setActiveLog = useSetAtom(setActiveLogAtom)
  const setFilter = useSetAtom(setFilterAtom)
  const setSort = useSetAtom(setSortAtom)
  const setZoom = useSetAtom(setZoomAtom)

  const pb = getApiClient()

  /**
   * 构建筛选条件
   */
  const buildFilter = useCallback(() => {
    const filters: string[] = []

    if (filter) {
      filters.push(`(${filter})`)
    }

    if (zoom.min && zoom.max) {
      filters.push(`(created >= "${zoom.min}" && created <= "${zoom.max}")`)
    }

    return filters.join(' && ')
  }, [filter, zoom])

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
        })

        if (!append) {
          clearLogs()
        }

        const items = (result.items || []) as unknown as LogEntry[]
        addLogs(items)
        setCurrentPage(page)
        setHasMore(items.length >= PER_PAGE)
      } catch (err) {
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
    await loadLogs(1, false)
  }, [loadLogs])

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
    loadLogs,
    loadMore,
    refresh,
    deleteLog,
    setActiveLog,
    setFilter,
    setSort,
    setZoom,
    clearLogs,
  }
}
