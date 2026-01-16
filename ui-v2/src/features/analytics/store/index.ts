/**
 * Analytics 状态管理
 */
import { atom } from 'jotai'

/**
 * 分析数据类型
 */
export interface AnalyticsData {
  timestamp: string
  pageViews: number
  uniqueVisitors: number
  sessions: number
  avgSessionDuration: number
  bounceRate: number
}

/**
 * Top 页面
 */
export interface TopPage {
  url: string
  views: number
  uniqueViews: number
}

/**
 * Top 来源
 */
export interface TopSource {
  source: string
  visits: number
  percentage: number
}

/**
 * 汇总统计
 */
export interface AnalyticsSummary {
  totalPageViews: number
  totalUniqueVisitors: number
  totalSessions: number
  avgSessionDuration: number
  bounceRate: number
  topPages: TopPage[]
  topSources: TopSource[]
}

// 时间范围
export type AnalyticsTimeRange = '7d' | '30d' | '90d'

// 汇总数据
export const summaryAtom = atom<AnalyticsSummary | null>(null)

// 历史数据
export const historyDataAtom = atom<AnalyticsData[]>([])

// 加载状态
export const isLoadingAtom = atom(false)

// 错误信息
export const errorAtom = atom<string | null>(null)

// 选中的时间范围
export const selectedRangeAtom = atom<AnalyticsTimeRange>('7d')

// 设置汇总数据
export const setSummaryAtom = atom(null, (get, set, summary: AnalyticsSummary | null) => {
  set(summaryAtom, summary)
})

// 设置历史数据
export const setHistoryDataAtom = atom(null, (get, set, data: AnalyticsData[]) => {
  set(historyDataAtom, data)
})

// 设置时间范围
export const setSelectedRangeAtom = atom(null, (get, set, range: AnalyticsTimeRange) => {
  set(selectedRangeAtom, range)
})

// 设置错误
export const setErrorAtom = atom(null, (get, set, error: string | null) => {
  set(errorAtom, error)
})
