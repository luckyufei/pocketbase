/**
 * Analytics 页面
 * Apple Design 风格的流量分析仪表盘
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnalytics } from '../hooks/useAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { AnalyticsChart } from './AnalyticsChart'
import { TopList } from './TopList'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Eye, Users, Clock, TrendingDown } from 'lucide-react'

// Auto refresh interval (60 seconds)
const REFRESH_INTERVAL = 60000

/**
 * 格式化数字（K/M）
 */
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
  return value.toString()
}

/**
 * 格式化百分比
 */
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return (value * 100).toFixed(1) + '%'
}

/**
 * 格式化时长（秒）
 */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds === 0) return '-'
  if (seconds < 60) return Math.round(seconds) + 's'
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${minutes}m ${secs}s`
}

export function AnalyticsPage() {
  const { t } = useTranslation()

  // Time range options
  const timeRanges = [
    { value: '1d' as const, label: t('analyticsPage.timeRanges.1d') },
    { value: '7d' as const, label: t('analyticsPage.timeRanges.7d') },
    { value: '30d' as const, label: t('analyticsPage.timeRanges.30d') },
    { value: '90d' as const, label: t('analyticsPage.timeRanges.90d') },
  ]

  const {
    summary,
    dailyData,
    topPages,
    topSources,
    browsers,
    isLoading,
    error,
    selectedRange,
    loadData,
    refresh,
    changeRange,
  } = useAnalytics()

  const isFirstRender = useRef(true)

  // 初始加载
  useEffect(() => {
    loadData()
  }, [])

  // 时间范围变更时重新加载
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    loadData()
  }, [selectedRange])

  // Auto refresh every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      refresh()
    }, REFRESH_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [refresh])

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Header */}
      <header className="h-14 px-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t('analyticsPage.title')}</h1>
        <div className="flex items-center gap-3">
          {/* 时间范围选择器 */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-white">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                type="button"
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedRange === range.value
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => changeRange(range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        {isLoading && !summary ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4 max-w-[1400px] mx-auto">
            {/* Core metric cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <AnalyticsCard
                title={t('analyticsPage.pageViews')}
                value={formatNumber(summary?.totalPV)}
                icon={Eye}
                color="blue"
              />
              <AnalyticsCard
                title={t('analyticsPage.uniqueVisitors')}
                value={formatNumber(summary?.totalUV)}
                icon={Users}
                color="green"
              />
              <AnalyticsCard
                title={t('analyticsPage.bounceRate')}
                value={formatPercent(summary?.bounceRate)}
                icon={TrendingDown}
                color="orange"
              />
              <AnalyticsCard
                title={t('analyticsPage.avgDuration')}
                value={formatDuration(summary?.avgDur)}
                icon={Clock}
                color="purple"
              />
            </div>

            {/* PV/UV Trend chart */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">{t('analyticsPage.trafficTrend')}</h2>
              </div>
              <div className="p-4">
                <AnalyticsChart 
                  data={dailyData} 
                  days={selectedRange === '1d' ? 1 : selectedRange === '7d' ? 7 : selectedRange === '30d' ? 30 : 90}
                />
              </div>
            </div>

            {/* Top lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Top pages */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">{t('analyticsPage.topPages')}</h2>
                </div>
                <div className="p-3">
                  <TopList
                    items={topPages.map(p => ({
                      label: p.path,
                      value: p.pv,
                      secondary: p.visitors,
                      secondaryLabel: 'UV',
                    }))}
                    emptyText={t('analyticsPage.noData')}
                  />
                </div>
              </div>

              {/* Traffic sources */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">{t('analyticsPage.trafficSources')}</h2>
                </div>
                <div className="p-3">
                  <TopList
                    items={topSources.map(s => ({
                      label: s.source || t('analyticsPage.directVisit'),
                      value: s.visitors,
                      type: s.type,
                    }))}
                    showTypeIcon
                    emptyText={t('analyticsPage.noData')}
                  />
                </div>
              </div>

              {/* Browser distribution */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">{t('analyticsPage.browserDistribution')}</h2>
                </div>
                <div className="p-3">
                  <TopList
                    items={browsers.map(b => ({
                      label: b.name || t('analyticsPage.unknown'),
                      value: b.visitors,
                    }))}
                    showPercent
                    total={summary?.totalPV || 0}
                    emptyText={t('analyticsPage.noData')}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyticsPage
