/**
 * Jobs Store
 * 任务队列状态管理
 */
import { atom } from 'jotai'

// ============ 类型定义 ============

/**
 * 任务状态
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * 任务
 */
export interface Job {
  id: string
  topic: string
  status: JobStatus
  retries: number
  max_retries: number
  created: string
  run_at: string
  last_error?: string
  payload?: Record<string, unknown>
}

/**
 * 任务统计
 */
export interface JobsStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
  success_rate: number
}

/**
 * 任务筛选条件
 */
export interface JobsFilter {
  topic: string
  status: string
  limit: number
  offset: number
}

// ============ Atoms ============

/**
 * 任务列表
 */
export const jobsAtom = atom<Job[]>([])

/**
 * 统计数据
 */
export const statsAtom = atom<JobsStats | null>(null)

/**
 * 加载状态
 */
export const isLoadingAtom = atom<boolean>(false)

/**
 * 统计加载状态
 */
export const isLoadingStatsAtom = atom<boolean>(false)

/**
 * 筛选条件
 */
export const filterAtom = atom<JobsFilter>({
  topic: '',
  status: '',
  limit: 20,
  offset: 0,
})

/**
 * 总数
 */
export const totalAtom = atom<number>(0)

/**
 * 操作加载状态
 */
export const actionLoadingAtom = atom<Record<string, string | null>>({})

// ============ 写入 Atoms ============

/**
 * 添加/更新任务
 */
export const addJobsAtom = atom(null, (get, set, newJobs: Job[]) => {
  const current = get(jobsAtom)
  const jobMap = new Map(current.map((j) => [j.id, j]))

  for (const job of newJobs) {
    jobMap.set(job.id, job)
  }

  set(jobsAtom, Array.from(jobMap.values()))
})

/**
 * 清空任务
 */
export const clearJobsAtom = atom(null, (_get, set) => {
  set(jobsAtom, [])
  set(totalAtom, 0)
})

/**
 * 设置筛选条件
 */
export const setFilterAtom = atom(null, (_get, set, filter: JobsFilter) => {
  set(filterAtom, filter)
})

/**
 * 设置统计数据
 */
export const setStatsAtom = atom(null, (_get, set, stats: JobsStats | null) => {
  set(statsAtom, stats)
})

/**
 * 设置总数
 */
export const setTotalAtom = atom(null, (_get, set, total: number) => {
  set(totalAtom, total)
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
 * 删除任务
 */
export const removeJobAtom = atom(null, (get, set, jobId: string) => {
  const current = get(jobsAtom)
  set(
    jobsAtom,
    current.filter((j) => j.id !== jobId)
  )
})
