/**
 * Trace 统计卡片
 * 显示请求总数、成功/错误数、延迟百分位
 */
import type { TraceStats as TraceStatsType } from '../store'
import { Activity, Check, AlertTriangle, Clock } from 'lucide-react'

interface Props {
  stats: TraceStatsType | null
}

/**
 * 格式化数字
 */
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

/**
 * 格式化延迟（微秒 -> 可读格式）
 */
function formatDuration(microseconds: number | null | undefined): string {
  if (microseconds === null || microseconds === undefined) return '-'
  
  const ms = microseconds / 1000
  if (ms < 1) {
    return `${microseconds}μs`
  } else if (ms < 1000) {
    return `${ms.toFixed(1)}ms`
  } else {
    return `${(ms / 1000).toFixed(2)}s`
  }
}

/**
 * 格式化百分比
 */
function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(1)}%`
}

export function TraceStats({ stats }: Props) {
  const successRate = stats && stats.total_requests > 0
    ? stats.success_count / stats.total_requests
    : 0
  
  const errorRate = stats && stats.total_requests > 0
    ? stats.error_count / stats.total_requests
    : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 总请求 */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
        <Activity className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {formatNumber(stats?.total_requests)}
          </div>
          <div className="text-xs text-slate-500">总请求</div>
        </div>
      </div>

      {/* 成功 */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-blue-100">
        <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {formatNumber(stats?.success_count)}
            <span className="text-xs font-normal text-blue-500 ml-1">
              {formatPercentage(successRate)}
            </span>
          </div>
          <div className="text-xs text-slate-500">成功</div>
        </div>
      </div>

      {/* 错误 */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-red-100">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {formatNumber(stats?.error_count)}
            <span className="text-xs font-normal text-red-500 ml-1">
              {formatPercentage(errorRate)}
            </span>
          </div>
          <div className="text-xs text-slate-500">错误</div>
        </div>
      </div>

      {/* P50 */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
        <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {formatDuration(stats?.p50_latency)}
          </div>
          <div className="text-xs text-slate-500">P50</div>
        </div>
      </div>

      {/* P95 */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
        <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {formatDuration(stats?.p95_latency)}
          </div>
          <div className="text-xs text-slate-500">P95</div>
        </div>
      </div>

      {/* P99 */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
        <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {formatDuration(stats?.p99_latency)}
          </div>
          <div className="text-xs text-slate-500">P99</div>
        </div>
      </div>
    </div>
  )
}
