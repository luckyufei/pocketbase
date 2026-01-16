/**
 * Traces 状态管理
 */
import { atom } from 'jotai'

/**
 * Trace 条目类型
 */
export interface TraceEntry {
  id: string
  url: string
  method: string
  status: number
  auth: string
  ip: string
  referer: string
  userAgent: string
  execTime: number
  created: string
  data?: Record<string, any>
}

/**
 * Trace 统计
 */
export interface TraceStats {
  totalRequests: number
  avgResponseTime: number
  errorRate: number
  topEndpoints: Array<{ url: string; count: number }>
}

// Traces 列表
export const tracesAtom = atom<TraceEntry[]>([])

// 当前选中的 Trace
export const activeTraceAtom = atom<TraceEntry | null>(null)

// 加载状态
export const isLoadingAtom = atom(false)

// 筛选条件
export const filterAtom = atom('')

// 排序字段
export const sortAtom = atom('-created')

// 当前页码
export const currentPageAtom = atom(1)

// 是否还有更多
export const hasMoreAtom = atom(false)

// 统计数据
export const statsAtom = atom<TraceStats | null>(null)

// 添加 Traces
export const addTracesAtom = atom(null, (get, set, newTraces: TraceEntry[]) => {
  const existing = get(tracesAtom)
  const existingIds = new Set(existing.map((t) => t.id))
  const uniqueNew = newTraces.filter((t) => !existingIds.has(t.id))
  set(tracesAtom, [...existing, ...uniqueNew])
})

// 清空 Traces
export const clearTracesAtom = atom(null, (get, set) => {
  set(tracesAtom, [])
  set(currentPageAtom, 1)
  set(hasMoreAtom, false)
})

// 设置当前 Trace
export const setActiveTraceAtom = atom(null, (get, set, trace: TraceEntry | null) => {
  set(activeTraceAtom, trace)
})

// 设置筛选条件
export const setFilterAtom = atom(null, (get, set, filter: string) => {
  set(filterAtom, filter)
})

// 设置排序
export const setSortAtom = atom(null, (get, set, sort: string) => {
  set(sortAtom, sort)
})

// 设置统计数据
export const setStatsAtom = atom(null, (get, set, stats: TraceStats | null) => {
  set(statsAtom, stats)
})
