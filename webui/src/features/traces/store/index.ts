/**
 * Traces 状态管理
 * 匹配后端 OpenTelemetry 风格的 Span 结构
 */
import { atom } from 'jotai'

/**
 * Span 状态
 */
export type SpanStatus = 'OK' | 'ERROR' | 'CANCELLED' | 'UNSET'

/**
 * Span 类型
 */
export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER'

/**
 * Span 条目类型（匹配后端 core.Span）
 */
export interface Span {
  trace_id: string      // 32-char Hex
  span_id: string       // 16-char Hex
  parent_id: string     // 16-char Hex, 可为空
  name: string          // 操作名称
  kind: SpanKind        // Span 类型
  start_time: number    // 开始时间（微秒）
  duration: number      // 持续时间（微秒）
  status: SpanStatus    // 状态
  attributes: Record<string, any>  // 属性
  created: string       // 创建时间
}

/**
 * Trace 概要（用于列表显示）
 */
export interface TraceSummary {
  trace_id: string
  name: string
  status: SpanStatus
  start_time: number
  duration: number
  span_count: number
}

/**
 * Trace 统计（匹配后端 core.TraceStats）
 */
export interface TraceStats {
  total_requests: number
  success_count: number
  error_count: number
  p50_latency: number   // 微秒
  p95_latency: number   // 微秒
  p99_latency: number   // 微秒
}

/**
 * 过滤器参数
 */
export interface TraceFilters {
  start_time?: string
  end_time?: string
  operation?: string
  status?: SpanStatus | ''
  trace_id?: string
}

// Traces 列表（根 Span）
export const tracesAtom = atom<Span[]>([])

// 当前选中的 Trace ID
export const activeTraceIdAtom = atom<string | null>(null)

// 当前 Trace 的所有 Spans
export const traceSpansAtom = atom<Span[]>([])

// 加载状态
export const isLoadingAtom = atom(false)
export const isLoadingDetailAtom = atom(false)

// 过滤器
export const filtersAtom = atom<TraceFilters>({})

// 时间范围（小时）
export const timeRangeAtom = atom<'1h' | '6h' | '24h' | '7d'>('24h')

// 分页
export const currentPageAtom = atom(1)
export const totalItemsAtom = atom(0)
export const perPageAtom = atom(50)

// 统计数据
export const statsAtom = atom<TraceStats | null>(null)

// 计算属性：总页数
export const totalPagesAtom = atom((get) => {
  const total = get(totalItemsAtom)
  const perPage = get(perPageAtom)
  return Math.ceil(total / perPage)
})

// 设置 Traces
export const setTracesAtom = atom(null, (get, set, traces: Span[]) => {
  set(tracesAtom, traces)
})

// 设置 Trace Spans
export const setTraceSpansAtom = atom(null, (get, set, spans: Span[]) => {
  set(traceSpansAtom, spans)
})

// 清空 Traces
export const clearTracesAtom = atom(null, (get, set) => {
  set(tracesAtom, [])
  set(currentPageAtom, 1)
  set(totalItemsAtom, 0)
})

// 设置当前 Trace ID
export const setActiveTraceIdAtom = atom(null, (get, set, traceId: string | null) => {
  set(activeTraceIdAtom, traceId)
  if (!traceId) {
    set(traceSpansAtom, [])
  }
})

// 设置过滤器
export const setFiltersAtom = atom(null, (get, set, filters: TraceFilters) => {
  set(filtersAtom, filters)
})

// 设置时间范围
export const setTimeRangeAtom = atom(null, (get, set, range: '1h' | '6h' | '24h' | '7d') => {
  set(timeRangeAtom, range)
})

// 设置统计数据
export const setStatsAtom = atom(null, (get, set, stats: TraceStats | null) => {
  set(statsAtom, stats)
})
