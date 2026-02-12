/**
 * useJobs Hook
 * 任务队列操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'
import {
  jobsAtom,
  statsAtom,
  isLoadingAtom,
  isLoadingStatsAtom,
  filterAtom,
  totalAtom,
  actionLoadingAtom,
  addJobsAtom,
  clearJobsAtom,
  setFilterAtom,
  setStatsAtom,
  setTotalAtom,
  setActionLoadingAtom,
  removeJobAtom,
  type Job,
  type JobsFilter,
} from '../store'

/**
 * 任务队列操作 Hook
 */
export function useJobs() {
  const jobs = useAtomValue(jobsAtom)
  const stats = useAtomValue(statsAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const [isLoadingStats, setIsLoadingStats] = useAtom(isLoadingStatsAtom)
  const filter = useAtomValue(filterAtom)
  const total = useAtomValue(totalAtom)
  const actionLoading = useAtomValue(actionLoadingAtom)

  const addJobs = useSetAtom(addJobsAtom)
  const clearJobs = useSetAtom(clearJobsAtom)
  const setFilter = useSetAtom(setFilterAtom)
  const setStats = useSetAtom(setStatsAtom)
  const setTotal = useSetAtom(setTotalAtom)
  const setActionLoading = useSetAtom(setActionLoadingAtom)
  const removeJob = useSetAtom(removeJobAtom)

  const pb = getApiClient()

  /**
   * 加载任务列表
   */
  const loadJobs = useCallback(
    async (customFilter?: Partial<JobsFilter>) => {
      setIsLoading(true)

      try {
        const currentFilter = customFilter ? { ...filter, ...customFilter } : filter

        const query: Record<string, string> = {}
        if (currentFilter.topic) query.topic = currentFilter.topic
        if (currentFilter.status) query.status = currentFilter.status
        query.limit = String(currentFilter.limit)
        query.offset = String(currentFilter.offset)

        const result = await pb.send('/api/jobs', {
          method: 'GET',
          query,
        })

        clearJobs()
        addJobs((result.items || []) as Job[])
        setTotal(result.total || 0)
      } catch (err) {
      console.error('Failed to load jobs:', err)
        toast.error('Failed to load jobs')
      } finally {
        setIsLoading(false)
      }
    },
    [pb, filter, clearJobs, addJobs, setTotal, setIsLoading]
  )

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async () => {
    setIsLoadingStats(true)

    try {
      const result = await pb.send('/api/jobs/stats', {
        method: 'GET',
      })
      setStats(result)
    } catch (err) {
      console.error('Failed to load job stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }, [pb, setStats, setIsLoadingStats])

  /**
   * 刷新
   */
  const refresh = useCallback(async () => {
    await Promise.all([loadJobs(), loadStats()])
  }, [loadJobs, loadStats])

  /**
   * 重新入队
   */
  const requeueJob = useCallback(
    async (jobId: string) => {
      setActionLoading({ id: jobId, action: 'requeue' })

      try {
        await pb.send(`/api/jobs/${jobId}/requeue`, {
          method: 'POST',
        })
        toast.success(`Job ${jobId} requeued successfully.`)
        await refresh()
      } catch (err) {
        console.error('Failed to requeue job:', err)
        toast.error('Failed to requeue job')
      } finally {
        setActionLoading({ id: jobId, action: null })
      }
    },
    [pb, refresh, setActionLoading]
  )

  /**
   * 删除任务
   */
  const deleteJob = useCallback(
    async (jobId: string) => {
      setActionLoading({ id: jobId, action: 'delete' })

      try {
        await pb.send(`/api/jobs/${jobId}`, {
          method: 'DELETE',
        })
        toast.success(`Job ${jobId} deleted successfully.`)
        removeJob(jobId)
        await loadStats()
      } catch (err) {
        console.error('Failed to delete job:', err)
        toast.error('Failed to delete job')
      } finally {
        setActionLoading({ id: jobId, action: null })
      }
    },
    [pb, removeJob, loadStats, setActionLoading]
  )

  /**
   * 更新筛选条件
   */
  const updateFilter = useCallback(
    async (newFilter: Partial<JobsFilter>) => {
      const updated = { ...filter, ...newFilter, offset: 0 }
      setFilter(updated)
      await loadJobs(updated)
    },
    [filter, setFilter, loadJobs]
  )

  /**
   * 上一页
   */
  const prevPage = useCallback(async () => {
    if (filter.offset > 0) {
      const newOffset = Math.max(0, filter.offset - filter.limit)
      const updated = { ...filter, offset: newOffset }
      setFilter(updated)
      await loadJobs(updated)
    }
  }, [filter, setFilter, loadJobs])

  /**
   * 下一页
   */
  const nextPage = useCallback(async () => {
    if (filter.offset + filter.limit < total) {
      const updated = { ...filter, offset: filter.offset + filter.limit }
      setFilter(updated)
      await loadJobs(updated)
    }
  }, [filter, total, setFilter, loadJobs])

  /**
   * 清除筛选条件
   */
  const clearFilter = useCallback(async () => {
    const defaultFilter: JobsFilter = {
      topic: '',
      status: '',
      limit: 20,
      offset: 0,
    }
    setFilter(defaultFilter)
    await loadJobs(defaultFilter)
  }, [setFilter, loadJobs])

  return {
    jobs,
    stats,
    isLoading,
    isLoadingStats,
    filter,
    total,
    actionLoading,
    loadJobs,
    loadStats,
    refresh,
    requeueJob,
    deleteJob,
    updateFilter,
    prevPage,
    nextPage,
    clearFilter,
  }
}
