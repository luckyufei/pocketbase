/**
 * Monitoring 页面
 * 系统监控仪表盘 - 与 ui 版本 PageMonitoring.svelte 一致
 */
import { useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMetrics } from '@/features/monitoring'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw } from 'lucide-react'
import { MetricsCard } from './MetricsCard'
import { MetricsChart } from './MetricsChart'
import { DatabaseStats } from './DatabaseStats'
import { ServerlessMetrics } from './ServerlessMetrics'

const REFRESH_INTERVAL = 30000 // 30 秒自动刷新

// 格式化数值
function formatValue(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(decimals)
}

export function MonitoringPage() {
  const { t } = useTranslation()
  const {
    currentMetrics,
    historyData,
    isLoading,
    error,
    selectedRange,
    loadData,
    refresh,
    changeRange,
  } = useMetrics()

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isFirstRender = useRef(true)

  // 初始加载
  useEffect(() => {
    loadData()
    refreshIntervalRef.current = setInterval(loadData, REFRESH_INTERVAL)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 时间范围改变时重新加载（排除初始渲染）
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRange])

  const handleRangeChange = useCallback(
    (value: string) => {
      changeRange(value as any)
    },
    [changeRange]
  )

  return (
    <div className="p-5 max-w-[1400px] mx-auto">
      {/* 头部 */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{t('monitoring.title')}</h1>
        <div className="flex items-center gap-3">
          <Select value={selectedRange} onValueChange={handleRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">{t('monitoring.timeRangeSelect.1h')}</SelectItem>
              <SelectItem value="6h">{t('monitoring.timeRangeSelect.6h')}</SelectItem>
              <SelectItem value="12h">{t('monitoring.timeRangeSelect.12h')}</SelectItem>
              <SelectItem value="24h">{t('monitoring.timeRangeSelect.24h')}</SelectItem>
              <SelectItem value="7d">{t('monitoring.timeRangeSelect.7d')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('monitoring.refresh')}
          </Button>
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200">
          <span className="text-lg">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && !currentMetrics ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span>{t('monitoring.loading')}</span>
        </div>
      ) : !currentMetrics && historyData.length === 0 ? (
        /* 空状态 */
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-4 opacity-50">📊</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">{t('monitoring.noDataTitle')}</h3>
          <p>{t('monitoring.noDataDesc')}</p>
          <p className="text-sm mt-2">{t('monitoring.noDataInterval')}</p>
        </div>
      ) : (
        <>
          {/* 系统指标卡片 */}
          <section className="flex flex-wrap gap-4 mb-6">
            <MetricsCard
              title={t('monitoring.cpuUsage')}
              value={formatValue(currentMetrics?.cpu_usage_percent)}
              unit="%"
              icon="cpu"
            />
            <MetricsCard
              title={t('monitoring.memoryAlloc')}
              value={formatValue(currentMetrics?.memory_alloc_mb)}
              unit="MB"
              icon="memory"
            />
            <MetricsCard
              title={t('monitoring.goroutines')}
              value={currentMetrics?.goroutines_count?.toString() || '-'}
              icon="stack"
            />
            <MetricsCard
              title={t('monitoring.p95Latency')}
              value={formatValue(currentMetrics?.p95_latency_ms)}
              unit="ms"
              icon="timer"
            />
            <MetricsCard
              title={t('monitoring.http5xx')}
              value={currentMetrics?.http_5xx_count?.toString() || '0'}
              unit="/min"
              icon="warning"
            />
          </section>

          {/* 数据库状态 */}
          <section className="mb-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
              <span>🗄️</span>
              {t('monitoring.dbStatus')}
            </h2>
            <DatabaseStats refreshInterval={REFRESH_INTERVAL} />
          </section>

          {/* 趋势图表 */}
          {historyData.length > 0 ? (
            <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricsChart
                  data={historyData}
                  metric="cpu_usage_percent"
                  title={t('monitoring.cpuTrend')}
                  unit="%"
                  color="#3b82f6"
                />
                <MetricsChart
                  data={historyData}
                  metric="memory_alloc_mb"
                  title={t('monitoring.memoryTrend')}
                  unit="MB"
                  color="#10b981"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricsChart
                  data={historyData}
                  metric="goroutines_count"
                  title={t('monitoring.goroutinesTrend')}
                  unit=""
                  color="#8b5cf6"
                />
                <MetricsChart
                  data={historyData}
                  metric="p95_latency_ms"
                  title={t('monitoring.p95LatencyTrend')}
                  unit="ms"
                  color="#f59e0b"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <MetricsChart
                  data={historyData}
                  metric="http_5xx_count"
                  title={t('monitoring.http5xxTrend')}
                  unit=""
                  color="#ef4444"
                />
              </div>
            </section>
          ) : (
            <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-2xl mb-3 opacity-50">📈</div>
              <p>{t('monitoring.noHistoryData')}</p>
            </div>
          )}

          {/* Serverless 指标 */}
          <section className="mt-6">
            <ServerlessMetrics refreshInterval={REFRESH_INTERVAL} />
          </section>
        </>
      )}
    </div>
  )
}

export default MonitoringPage
