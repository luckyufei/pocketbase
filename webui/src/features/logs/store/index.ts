/**
 * Logs Store
 * 日志状态管理
 */
import { atom } from 'jotai'

// ============ 类型定义 ============

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error'

/**
 * 日志条目
 */
export interface LogEntry {
  id: string
  created: string
  level: number
  message: string
  data: Record<string, any>
}

/**
 * 日志筛选条件
 */
export interface LogsFilter {
  level?: LogLevel
  search?: string
  startDate?: string
  endDate?: string
}

/**
 * 日志统计
 */
export interface LogsStats {
  total: number
  byLevel: Record<number, number>
}

// ============ Atoms ============

/**
 * 日志列表
 */
export const logsAtom = atom<LogEntry[]>([])

/**
 * 当前选中的日志
 */
export const activeLogAtom = atom<LogEntry | null>(null)

/**
 * 加载状态
 */
export const isLoadingAtom = atom<boolean>(false)

/**
 * 筛选条件
 */
export const filterAtom = atom<string>('')

/**
 * 排序字段
 */
export const sortAtom = atom<string>('-@rowid')

/**
 * 当前页码
 */
export const currentPageAtom = atom<number>(1)

/**
 * 是否有更多数据
 */
export const hasMoreAtom = atom<boolean>(false)

/**
 * 日志统计数据
 */
export const statsAtom = atom<LogsStats>({
  total: 0,
  byLevel: {},
})

/**
 * 时间范围缩放
 */
export const zoomAtom = atom<{ min?: string; max?: string }>({})

/**
 * 是否包含超级用户日志
 * 默认从 localStorage 读取，如果没有则默认为 false
 */
const SUPERUSER_LOGS_STORAGE_KEY = 'superuserLogRequests'

function getInitialSuperuserLogsValue(): boolean {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage?.getItem(SUPERUSER_LOGS_STORAGE_KEY)
    return stored === '1'
  }
  return false
}

export const withSuperuserLogsAtom = atom<boolean>(getInitialSuperuserLogsValue())

/**
 * 图表统计数据
 */
export interface ChartDataPoint {
  date: string
  total: number
}

export const chartDataAtom = atom<ChartDataPoint[]>([])

/**
 * 日志总数（来自图表统计）
 */
export const totalLogsAtom = atom<number>(0)

/**
 * 图表加载状态
 */
export const chartLoadingAtom = atom<boolean>(false)

// ============ 写入 Atoms ============

/**
 * 添加日志
 */
export const addLogsAtom = atom(null, (get, set, newLogs: LogEntry[]) => {
  const current = get(logsAtom)
  const merged = [...current]
  for (const log of newLogs) {
    const existingIndex = merged.findIndex((l) => l.id === log.id)
    if (existingIndex >= 0) {
      merged[existingIndex] = log
    } else {
      merged.push(log)
    }
  }
  set(logsAtom, merged)
})

/**
 * 清空日志
 */
export const clearLogsAtom = atom(null, (_get, set) => {
  set(logsAtom, [])
  set(currentPageAtom, 1)
  set(hasMoreAtom, false)
})

/**
 * 设置活动日志
 */
export const setActiveLogAtom = atom(null, (_get, set, log: LogEntry | null) => {
  set(activeLogAtom, log)
})

/**
 * 更新筛选条件
 */
export const setFilterAtom = atom(null, (_get, set, filter: string) => {
  set(filterAtom, filter)
})

/**
 * 更新排序
 */
export const setSortAtom = atom(null, (_get, set, sort: string) => {
  set(sortAtom, sort)
})

/**
 * 更新时间缩放
 */
export const setZoomAtom = atom(null, (_get, set, zoom: { min?: string; max?: string }) => {
  set(zoomAtom, zoom)
})

/**
 * 设置是否包含超级用户日志
 */
export const setWithSuperuserLogsAtom = atom(null, (_get, set, value: boolean) => {
  set(withSuperuserLogsAtom, value)
  // 持久化到 localStorage
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem(SUPERUSER_LOGS_STORAGE_KEY, value ? '1' : '0')
  }
})

/**
 * 设置图表数据
 */
export const setChartDataAtom = atom(null, (_get, set, data: ChartDataPoint[]) => {
  set(chartDataAtom, data)
})

/**
 * 设置日志总数
 */
export const setTotalLogsAtom = atom(null, (_get, set, total: number) => {
  set(totalLogsAtom, total)
})

/**
 * 设置图表加载状态
 */
export const setChartLoadingAtom = atom(null, (_get, set, loading: boolean) => {
  set(chartLoadingAtom, loading)
})
