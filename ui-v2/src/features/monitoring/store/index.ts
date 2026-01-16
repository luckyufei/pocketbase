/**
 * 监控状态管理
 */
import { atom } from 'jotai'

/**
 * 系统指标类型
 */
export interface SystemMetrics {
  timestamp: string
  cpu: number
  memory: number
  memoryTotal: number
  memoryUsed: number
  goroutines: number
  dbConnections: number
  dbOpenConnections: number
  dbIdleConnections: number
  requestsTotal: number
  requestsPerSecond: number
  avgResponseTime: number
}

/**
 * 时间范围选项
 */
export type TimeRange = '1h' | '6h' | '12h' | '24h' | '7d'

/**
 * 时间范围映射
 */
export const timeRangeHours: Record<TimeRange, number> = {
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '24h': 24,
  '7d': 168,
}

// 当前指标
export const currentMetricsAtom = atom<SystemMetrics | null>(null)

// 历史数据
export const historyDataAtom = atom<SystemMetrics[]>([])

// 加载状态
export const isLoadingAtom = atom(false)

// 错误信息
export const errorAtom = atom<string | null>(null)

// 选中的时间范围
export const selectedRangeAtom = atom<TimeRange>('24h')

// 派生 atom: 获取选中时间范围对应的小时数
export const selectedHoursAtom = atom((get) => {
  const range = get(selectedRangeAtom)
  return timeRangeHours[range]
})

// 设置当前指标
export const setCurrentMetricsAtom = atom(null, (get, set, metrics: SystemMetrics | null) => {
  set(currentMetricsAtom, metrics)
})

// 设置历史数据
export const setHistoryDataAtom = atom(null, (get, set, data: SystemMetrics[]) => {
  set(historyDataAtom, data)
})

// 设置时间范围
export const setSelectedRangeAtom = atom(null, (get, set, range: TimeRange) => {
  set(selectedRangeAtom, range)
})

// 设置错误
export const setErrorAtom = atom(null, (get, set, error: string | null) => {
  set(errorAtom, error)
})
