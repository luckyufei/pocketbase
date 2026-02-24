/**
 * ServerlessMetrics - Serverless 函数监控组件
 * 与 ui 版本 ServerlessMetrics.svelte 一致
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        setError(err.message || t('serverless.loadError'))
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
    if (seconds < 60) return `${seconds.toFixed(0)}${t('serverless.seconds')}`
    if (seconds < 3600) return `${(seconds / 60).toFixed(0)}${t('serverless.minutes')}`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}${t('serverless.hours')}`
    return `${(seconds / 86400).toFixed(1)}${t('serverless.days')}`
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
        <span>{t('serverless.loading')}</span>
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
        <span>{t('serverless.notEnabled')}</span>
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
        Serverless {t('serverless.title')}
      </h3>

      {/* 概览卡片 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <MetricsCard title={t('serverless.totalRequests')} value={metrics.totalRequests?.toString() || '0'} icon="stack" />
        <MetricsCard title={t('serverless.successRate')} value={successRate} unit="%" icon="cpu" />
        <MetricsCard title={t('serverless.requestRate')} value={formatNumber(metrics.window?.requestRate)} unit={t('serverless.perSecond')} icon="timer" />
        <MetricsCard title={t('serverless.p95Latency')} value={formatNumber(metrics.window?.p95Latency)} unit="ms" icon="timer" />
        <MetricsCard title={t('serverless.coldStarts')} value={metrics.coldStarts?.toString() || '0'} icon="warning" />
        <MetricsCard title={t('serverless.uptime')} value={formatDuration(metrics.uptime)} icon="timer" />
      </div>

      {/* 实例池状态 */}
      <div className="border-t border-slate-200 pt-4 mb-4">
        <h4 className="text-sm font-medium text-slate-500 mb-3">{t('serverless.poolStatus')}</h4>
        <div className="flex gap-6 mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.poolSize')}</span>
            <span className="text-lg font-semibold text-slate-900">{metrics.pool?.size || 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.available')}</span>
            <span className="text-lg font-semibold text-green-600">{metrics.pool?.available || 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.inUse')}</span>
            <span className="text-lg font-semibold text-blue-600">{metrics.pool?.inUse || 0}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.waiting')}</span>
            <span className="text-lg font-semibold text-yellow-600">{metrics.pool?.waitingRequests || 0}</span>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
          {metrics.pool?.size > 0 && (
            <>
              <div
                className="bg-blue-500 h-full"
                style={{ width: `${(metrics.pool.inUse / metrics.pool.size) * 100}%` }}
                title={`${t('serverless.inUse')}: ${metrics.pool.inUse}`}
              />
              <div
                className="bg-green-500 h-full"
                style={{ width: `${(metrics.pool.available / metrics.pool.size) * 100}%` }}
                title={`${t('serverless.available')}: ${metrics.pool.available}`}
              />
            </>
          )}
        </div>
      </div>

      {/* 错误统计 */}
      {(metrics.errorCount > 0 || metrics.timeoutCount > 0 || metrics.rejectedCount > 0) && (
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">{t('serverless.errorStats')}</h4>
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">{t('serverless.errors')}</span>
              <span className="text-lg font-semibold text-red-600">{metrics.errorCount || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">{t('serverless.timeouts')}</span>
              <span className="text-lg font-semibold text-yellow-600">{metrics.timeoutCount || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">{t('serverless.rejected')}</span>
              <span className="text-lg font-semibold text-red-600">{metrics.rejectedCount || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">{t('serverless.errorRate')}</span>
              <span className={`text-lg font-semibold ${getErrorRateClass(errorRate)}`}>
                {(errorRate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 延迟统计 */}
      <div className="border-t border-slate-200 pt-4 mb-4">
        <h4 className="text-sm font-medium text-slate-500 mb-3">{t('serverless.latencyStats')}</h4>
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.min')}</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(metrics.latency?.min)} ms</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.avg')}</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(metrics.latency?.avg)} ms</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.max')}</span>
            <span className="text-lg font-semibold text-slate-900">{formatNumber(metrics.latency?.max)} ms</span>
          </div>
        </div>
      </div>

      {/* 按函数统计 */}
      {metrics.byFunction && Object.keys(metrics.byFunction).length > 0 && (
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">{t('serverless.byFunction')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-500">{t('serverless.functionName')}</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">{t('serverless.requests')}</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">{t('serverless.success')}</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">{t('serverless.errors')}</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500">{t('serverless.p95Latency')}</th>
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
        <h4 className="text-sm font-medium text-slate-500 mb-3">{t('serverless.memoryUsage')}</h4>
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.currentUsage')}</span>
            <span className="text-lg font-semibold text-slate-900">{formatBytes(metrics.memory?.currentUsage)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{t('serverless.peakUsage')}</span>
            <span className="text-lg font-semibold text-slate-900">{formatBytes(metrics.memory?.peakUsage)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServerlessMetrics
