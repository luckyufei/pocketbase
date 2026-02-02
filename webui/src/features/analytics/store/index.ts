/**
 * Analytics 状态管理
 * 匹配后端 /api/analytics/* API
 */
import { atom } from 'jotai'

/**
 * 每日统计数据
 */
export interface DailyStats {
  date: string
  pv: number
  uv: number
}

/**
 * 汇总统计
 */
export interface AnalyticsSummary {
  totalPV: number
  totalUV: number
  bounceRate: number
  avgDur: number
}

/**
 * Top 页面
 */
export interface TopPage {
  path: string
  pv: number
  visitors: number
}

/**
 * Top 来源
 */
export interface TopSource {
  source: string
  visitors: number
  type?: 'search' | 'social' | 'direct' | 'referral'
}

/**
 * 设备/浏览器统计
 */
export interface DeviceStats {
  name: string
  visitors: number
}

// 时间范围
export type AnalyticsTimeRange = '1d' | '7d' | '30d' | '90d'

// 汇总数据
export const summaryAtom = atom<AnalyticsSummary | null>(null)

// 每日数据
export const dailyDataAtom = atom<DailyStats[]>([])

// Top 页面
export const topPagesAtom = atom<TopPage[]>([])

// Top 来源
export const topSourcesAtom = atom<TopSource[]>([])

// 浏览器统计
export const browsersAtom = atom<DeviceStats[]>([])

// 操作系统统计
export const osStatsAtom = atom<DeviceStats[]>([])

// 加载状态
export const isLoadingAtom = atom(false)

// 错误信息
export const errorAtom = atom<string | null>(null)

// 选中的时间范围
export const selectedRangeAtom = atom<AnalyticsTimeRange>('7d')

// Actions
export const setSummaryAtom = atom(null, (_, set, summary: AnalyticsSummary | null) => {
  set(summaryAtom, summary)
})

export const setDailyDataAtom = atom(null, (_, set, data: DailyStats[]) => {
  set(dailyDataAtom, data)
})

export const setTopPagesAtom = atom(null, (_, set, pages: TopPage[]) => {
  set(topPagesAtom, pages)
})

export const setTopSourcesAtom = atom(null, (_, set, sources: TopSource[]) => {
  set(topSourcesAtom, sources)
})

export const setBrowsersAtom = atom(null, (_, set, browsers: DeviceStats[]) => {
  set(browsersAtom, browsers)
})

export const setOsStatsAtom = atom(null, (_, set, stats: DeviceStats[]) => {
  set(osStatsAtom, stats)
})

export const setSelectedRangeAtom = atom(null, (_, set, range: AnalyticsTimeRange) => {
  set(selectedRangeAtom, range)
})

export const setErrorAtom = atom(null, (_, set, error: string | null) => {
  set(errorAtom, error)
})

export const setIsLoadingAtom = atom(null, (_, set, loading: boolean) => {
  set(isLoadingAtom, loading)
})
