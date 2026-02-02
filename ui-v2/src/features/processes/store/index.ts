/**
 * Processes Store
 * 进程管理状态管理
 */
import { atom } from 'jotai'
import type { ProcessState, ProcessStats, ProcessFilter, ProcessStatus, ProcessLog } from '../types'

// 重新导出类型
export type { ProcessState, ProcessStats, ProcessFilter, ProcessStatus, ProcessLog }

// ============ 基础 Atoms ============

/**
 * 进程列表
 */
export const processesAtom = atom<ProcessState[]>([])

/**
 * 加载状态
 */
export const isLoadingAtom = atom<boolean>(false)

/**
 * 筛选条件
 */
export const filterAtom = atom<ProcessFilter>({
  status: 'all',
  search: '',
})

/**
 * 操作加载状态
 * key: processId, value: action ('restart' | 'stop' | 'start' | null)
 */
export const actionLoadingAtom = atom<Record<string, string | null>>({})

/**
 * 最后刷新时间
 */
export const lastRefreshAtom = atom<Date | null>(null)

// ============ 派生 Atoms ============

/**
 * 统计数据（派生）
 */
export const statsAtom = atom<ProcessStats>((get) => {
  const processes = get(processesAtom)
  return {
    total: processes.length,
    running: processes.filter((p) => p.status === 'running').length,
    stopped: processes.filter((p) => p.status === 'stopped').length,
    crashed: processes.filter((p) => p.status === 'crashed').length,
  }
})

/**
 * 筛选后的进程列表（派生）
 */
export const filteredProcessesAtom = atom<ProcessState[]>((get) => {
  const processes = get(processesAtom)
  const filter = get(filterAtom)

  return processes.filter((process) => {
    // 状态筛选
    if (filter.status !== 'all' && process.status !== filter.status) {
      return false
    }

    // 搜索筛选（按 ID）
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      if (!process.id.toLowerCase().includes(searchLower)) {
        return false
      }
    }

    return true
  })
})

// ============ 写入 Atoms ============

/**
 * 设置进程列表
 */
export const setProcessesAtom = atom(null, (_get, set, processes: ProcessState[]) => {
  set(processesAtom, processes)
})

/**
 * 更新单个进程
 */
export const updateProcessAtom = atom(
  null,
  (get, set, update: { id: string } & Partial<ProcessState>) => {
    const current = get(processesAtom)
    const index = current.findIndex((p) => p.id === update.id)

    if (index === -1) {
      return // 进程不存在，忽略
    }

    const updated = [...current]
    updated[index] = { ...updated[index], ...update }
    set(processesAtom, updated)
  }
)

/**
 * 设置筛选条件
 */
export const setFilterAtom = atom(null, (_get, set, filter: ProcessFilter) => {
  set(filterAtom, filter)
})

/**
 * 设置操作加载状态
 */
export const setActionLoadingAtom = atom(
  null,
  (get, set, payload: { id: string; action: string | null }) => {
    const current = get(actionLoadingAtom)
    set(actionLoadingAtom, { ...current, [payload.id]: payload.action })
  }
)

/**
 * 清除操作加载状态
 */
export const clearActionLoadingAtom = atom(null, (get, set, id: string) => {
  const current = get(actionLoadingAtom)
  const { [id]: _, ...rest } = current
  set(actionLoadingAtom, rest)
})

/**
 * 设置最后刷新时间
 */
export const setLastRefreshAtom = atom(null, (_get, set, time: Date) => {
  set(lastRefreshAtom, time)
})

// ============ 日志相关 Atoms ============

/**
 * 进程日志列表
 */
export const processLogsAtom = atom<ProcessLog[]>([])

/**
 * 日志加载状态
 */
export const logsLoadingAtom = atom<boolean>(false)

/**
 * 自动滚动状态
 */
export const logsAutoScrollAtom = atom<boolean>(true)

/**
 * 当前查看日志的进程 ID
 */
export const selectedLogProcessAtom = atom<string | null>(null)

/**
 * 日志轮询状态
 */
export const logsPollingAtom = atom<boolean>(false)

// ============ 日志写入 Atoms ============

/**
 * 设置日志列表
 */
export const setProcessLogsAtom = atom(null, (_get, set, logs: ProcessLog[]) => {
  set(processLogsAtom, logs)
})

/**
 * 设置日志加载状态
 */
export const setLogsLoadingAtom = atom(null, (_get, set, loading: boolean) => {
  set(logsLoadingAtom, loading)
})

/**
 * 设置自动滚动状态
 */
export const setLogsAutoScrollAtom = atom(null, (_get, set, autoScroll: boolean) => {
  set(logsAutoScrollAtom, autoScroll)
})

/**
 * 切换自动滚动状态
 */
export const toggleLogsAutoScrollAtom = atom(null, (get, set) => {
  set(logsAutoScrollAtom, !get(logsAutoScrollAtom))
})

/**
 * 设置选中的日志进程
 */
export const setSelectedLogProcessAtom = atom(null, (_get, set, processId: string | null) => {
  set(selectedLogProcessAtom, processId)
})

/**
 * 设置轮询状态
 */
export const setLogsPollingAtom = atom(null, (_get, set, polling: boolean) => {
  set(logsPollingAtom, polling)
})

/**
 * 清空日志状态
 */
export const clearLogsAtom = atom(null, (_get, set) => {
  set(processLogsAtom, [])
  set(selectedLogProcessAtom, null)
  set(logsPollingAtom, false)
})
