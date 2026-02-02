/**
 * useProcesses Hook
 * 进程管理操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'
import {
  processesAtom,
  isLoadingAtom,
  filterAtom,
  actionLoadingAtom,
  lastRefreshAtom,
  statsAtom,
  filteredProcessesAtom,
  setProcessesAtom,
  setFilterAtom,
  setActionLoadingAtom,
  clearActionLoadingAtom,
  setLastRefreshAtom,
  type ProcessState,
  type ProcessFilter,
} from '../store'

/**
 * 进程管理操作 Hook
 */
export function useProcesses() {
  const processes = useAtomValue(processesAtom)
  const filteredProcesses = useAtomValue(filteredProcessesAtom)
  const stats = useAtomValue(statsAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const filter = useAtomValue(filterAtom)
  const actionLoading = useAtomValue(actionLoadingAtom)
  const lastRefresh = useAtomValue(lastRefreshAtom)

  const setProcesses = useSetAtom(setProcessesAtom)
  const setFilter = useSetAtom(setFilterAtom)
  const setActionLoading = useSetAtom(setActionLoadingAtom)
  const clearActionLoading = useSetAtom(clearActionLoadingAtom)
  const setLastRefresh = useSetAtom(setLastRefreshAtom)

  const pb = getApiClient()

  /**
   * 加载进程列表
   */
  const loadProcesses = useCallback(async () => {
    setIsLoading(true)

    try {
      const result = await pb.send('/api/pm/list', {
        method: 'GET',
      })

      setProcesses((result || []) as ProcessState[])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to load processes:', err)
      toast.error('加载进程列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [pb, setProcesses, setIsLoading, setLastRefresh])

  /**
   * 刷新进程列表
   */
  const refresh = useCallback(async () => {
    await loadProcesses()
  }, [loadProcesses])

  /**
   * 重启进程
   */
  const restartProcess = useCallback(
    async (processId: string) => {
      setActionLoading({ id: processId, action: 'restart' })

      try {
        await pb.send(`/api/pm/${processId}/restart`, {
          method: 'POST',
        })
        toast.success(`进程 ${processId} 重启中`)
        await loadProcesses()
      } catch (err) {
        console.error('Failed to restart process:', err)
        toast.error(`重启进程 ${processId} 失败`)
      } finally {
        clearActionLoading(processId)
      }
    },
    [pb, loadProcesses, setActionLoading, clearActionLoading]
  )

  /**
   * 停止进程
   */
  const stopProcess = useCallback(
    async (processId: string) => {
      setActionLoading({ id: processId, action: 'stop' })

      try {
        await pb.send(`/api/pm/${processId}/stop`, {
          method: 'POST',
        })
        toast.success(`进程 ${processId} 已停止`)
        await loadProcesses()
      } catch (err) {
        console.error('Failed to stop process:', err)
        toast.error(`停止进程 ${processId} 失败`)
      } finally {
        clearActionLoading(processId)
      }
    },
    [pb, loadProcesses, setActionLoading, clearActionLoading]
  )

  /**
   * 启动进程
   */
  const startProcess = useCallback(
    async (processId: string) => {
      setActionLoading({ id: processId, action: 'start' })

      try {
        await pb.send(`/api/pm/${processId}/start`, {
          method: 'POST',
        })
        toast.success(`进程 ${processId} 启动中`)
        await loadProcesses()
      } catch (err) {
        console.error('Failed to start process:', err)
        toast.error(`启动进程 ${processId} 失败`)
      } finally {
        clearActionLoading(processId)
      }
    },
    [pb, loadProcesses, setActionLoading, clearActionLoading]
  )

  /**
   * 更新筛选条件
   */
  const updateFilter = useCallback(
    (newFilter: ProcessFilter) => {
      setFilter(newFilter)
    },
    [setFilter]
  )

  /**
   * 清除筛选条件
   */
  const clearFilter = useCallback(() => {
    setFilter({ status: 'all', search: '' })
  }, [setFilter])

  /**
   * 检查进程是否正在执行操作
   */
  const isActionLoading = useCallback(
    (processId: string, action?: string) => {
      const currentAction = actionLoading[processId]
      if (!currentAction) return false
      if (action) return currentAction === action
      return true
    },
    [actionLoading]
  )

  return {
    // 状态
    processes,
    filteredProcesses,
    stats,
    isLoading,
    filter,
    actionLoading,
    lastRefresh,

    // 操作
    loadProcesses,
    refresh,
    restartProcess,
    stopProcess,
    startProcess,
    updateFilter,
    clearFilter,
    isActionLoading,
  }
}
