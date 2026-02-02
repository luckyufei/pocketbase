/**
 * ServerlessMetrics - Serverless 函数监控组件
 * 与 ui 版本 ServerlessMetrics.svelte 一致
 */
import { useEffect, useState, useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import { MetricsCard } from './MetricsCard'
import { Loader2 } from 'lucide-react'

interface ServerlessMetricsProps {
  refreshInterval?: number
}

interface PoolStats {
  size: number
  available: number
  inUse: number
  waitingRequests: number
}

interface LatencyStats {
  min: number
  avg: number
  max: number
}

interface MemoryStats {
  currentUsage: number
  peakUsage: number
}

interface WindowStats {
  requestRate: number
  errorRate: number
  p95Latency: number
}

interface FunctionStats {
  totalRequests: number
  successRequests: number
  errorRequests: number
  p95Latency: number
}

interface ServerlessMetricsData {
  totalRequests: number
  successCount: number
  errorCount: number
  timeoutCount: number
  rejectedCount: number
  coldStarts: number
  uptime: number
  pool: PoolStats
  latency: LatencyStats
  memory: MemoryStats
  window: WindowStats
  byFunction: Record<string, FunctionStats>
}

export function ServerlessMetrics({ refreshInterval = 30000 }: ServerlessMetricsProps) {
  const [metrics, setMetrics] = useState<ServerlessMetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pb = getApiClient()

  const loadMetrics = useCallback(async () => {
    try {
      setError(null)
      const response = await pb.send('/api/serverless/metrics', {
        method: 'GET',
        query: { window: '5m' },
        requestKey: `serverless-metrics-${Date.now()}`,
      })
      setMetrics(response)
    } catch (err: any) {
      if (err.isAbort) return
      if (err.status === 404) {
        // Serverless 未启用
        setMetrics(null)
      } else {
        setError(err.message || '加载 Serverless 指标失败')
      }
    } finally {
      setIsLoading(false)
    }
  }, [pb])

  useEffect(() => {
    loadMetrics()
    const timer = setInterval(loadMetrics, refreshInterval)
    return () => clearInterval(timer)
  }, [loadMetrics, refreshInterval])

  function formatNumber(value: number | undefined, decimals = 2) {
    if (value === null || value === undefined) return '-'
    return Number(value).toFixed(decimals)
  }

  function formatBytes(bytes: number | undefined) {
    if (!bytes) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    let unitIndex = 0
    let value = bytes
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`
  }

  function formatDuration(seconds: number | undefined) {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds.toFixed(0)}秒`
    if (seconds < 3600) return `${(seconds / 60).toFixed(0)}分钟`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}小时`
    return `${(seconds / 86400).toFixed(1)}天`
  }

  function getErrorRateClass(rate: number) {
    if (rate >= 0.1) return 'text-red-600'
    if (rate >= 0.05) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 text-slate-500 bg-white rounded-lg border border-slate-200">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>加载 Serverless 指标...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 text-red-600 bg-white rounded-lg border border-slate-200">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 text-slate-500 bg-white rounded-lg border border-slate-200">
        <span>💻</span>
        <span>Serverless 功能未启用</span>
      </div>
    )
  }

  const successRate =
    metrics.totalRequests > 0 ? ((metrics.successCount / metrics.totalRequests) * 100).toFixed(1) : '100'
  const errorRate = metrics.window?.errorRate ?? 0

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-5">
        <span className="text-blue-500">💻</span>
        Serverless 函数
      </h3>

      {/* 概览卡片 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <MetricsCard title="总请求数" value={metrics.totalRequests?.toString() || '0'} icon="stack" />
        <MetricsCard title="成功率" value={successRate} unit="%" icon="cpu" />
        <MetricsCard title="请求速率" value={formatNumber(metrics.window?.requestRate)} unit="/秒" icon="timer" />
        <MetricsCard title="P95 延迟" value={formatNumber(metrics.window?.p95Latency)} unit="ms" icon="timer" />
        <MetricsCard title="冷启动" value={metrics.coldStarts?.toString() || '0'} icon="warning" />
        <MetricsCard title="运行时长" value={formatDuration(metrics.uptime)} icon="timer" />
      </div>

      {/* 实例池状态 */}
      <div className="border-t border-slate-200 pt-4 mb-4">
        <h4 className="text-sm font-medium text-slate-500 mb-3">实例池状态</h4>
        <div className="flex gap-6 mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">池大小</span>
            <span className="text-lg font-semibold text-slate-900">{metrics.pool?.size || 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">可用</span>
            <span className="text-lg font-semibold text-green-600">{metrics.pool?.available || 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">使用中</span>
            <span className="text-lg font-semibold text-blue-600">{metrics.pool?.inUse || 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">等待中</span>
            <span className="text-lg font-semibold text-yellow-600">{metrics.pool?.waitingRequests || 0}</span>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
          {metrics.pool?.size > 0 && (
            <>
              <div
                className="bg-blue-500 h-full"
                style={{ width: `${(metrics.pool.inUse / metrics.pool.size) * 100}%` }}
                title={`使用中: ${metrics.pool.inUse}`}
              />
              <div
                className="bg-green-500 h-full"
                style={{ width: `${(metrics.pool.available / metrics.pool.size) * 100}%` }}
                title={`可用: ${metrics.pool.available}`}
              />
            </>
          )}
        </div>
      </div>

      {/* 错误统计 */}
      {(metrics.errorCount > 0 || metrics.timeoutCount > 0 || metrics.rejectedCount > 0) && (
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">错误统计</h4>
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">错误</span>
              <span className="text-lg font-semibold text-red-600">{metrics.errorCount || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">超时</span>
              <span className="text-lg font-semibold text-yellow-600">{metrics.timeoutCount || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">被拒绝</span>
              <span className="text-lg font-semibold text-red-600">{metrics.rejectedCount || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">错误率</span>
              <span className={`text-lg font-semibold ${getErrorRateClass(errorRate)}`}>
                {(errorRate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 延迟统计 */}
      <div className="border-t border-slate-200 pt-4 mb-4">
        <h4 className="text-sm font-medium text-slate-500 mb-3">延迟统计</h4>
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">最小</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(metrics.latency?.min)} ms</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">平均</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(metrics.latency?.avg)} ms</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">最大</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(metrics.latency?.max)} ms</span>
          </div>
        </div>
      </div>

      {/* 按函数统计 */}
      {metrics.byFunction && Object.keys(metrics.byFunction).length > 0 && (
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">按函数统计</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-500">函数名</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">请求数</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">成功</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">错误</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">P95延迟</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.byFunction).map(([name, stats]) => (
                  <tr key={name} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-mono text-blue-600">{name}</td>
                    <td className="py-2 px-3">{stats.totalRequests}</td>
                    <td className="py-2 px-3 text-green-600">{stats.successRequests}</td>
                    <td className="py-2 px-3 text-red-600">{stats.errorRequests}</td>
                    <td className="py-2 px-3">{formatNumber(stats.p95Latency)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 内存使用 */}
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-medium text-slate-500 mb-3">内存使用</h4>
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">当前使用</span>
            <span className="text-lg font-semibold text-slate-900">{formatBytes(metrics.memory?.currentUsage)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">峰值使用</span>
            <span className="text-lg font-semibold text-slate-900">{formatBytes(metrics.memory?.peakUsage)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServerlessMetrics
