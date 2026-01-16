/**
 * Analytics 页面
 * Apple Design 风格的流量分析仪表盘
 */
import { useEffect, useRef } from 'react'
import { useAnalytics } from '../hooks/useAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { AnalyticsChart } from './AnalyticsChart'
import { TopList } from './TopList'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Eye, Users, Clock, TrendingDown } from 'lucide-react'

// 时间范围选项
const timeRanges = [
  { value: '1d', label: '今天' },
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
] as const

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

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* 头部 */}
      <header className="h-14 px-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">流量分析</h1>
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

      {/* 内容 */}
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
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* 核心指标卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <AnalyticsCard
                title="页面浏览量"
                value={formatNumber(summary?.totalPV)}
                icon={Eye}
                color="blue"
              />
              <AnalyticsCard
                title="独立访客"
                value={formatNumber(summary?.totalUV)}
                icon={Users}
                color="green"
              />
              <AnalyticsCard
                title="跳出率"
                value={formatPercent(summary?.bounceRate)}
                icon={TrendingDown}
                color="orange"
              />
              <AnalyticsCard
                title="平均停留"
                value={formatDuration(summary?.avgDur)}
                icon={Clock}
                color="purple"
              />
            </div>

            {/* PV/UV 趋势图 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">流量趋势</h2>
              </div>
              <div className="p-4">
                <AnalyticsChart data={dailyData} />
              </div>
            </div>

            {/* Top 列表 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 热门页面 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">热门页面</h2>
                </div>
                <div className="p-3">
                  <TopList
                    items={topPages.map(p => ({
                      label: p.path,
                      value: p.pv,
                      secondary: p.visitors,
                      secondaryLabel: 'UV',
                    }))}
                    emptyText="暂无数据"
                  />
                </div>
              </div>

              {/* 流量来源 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">流量来源</h2>
                </div>
                <div className="p-3">
                  <TopList
                    items={topSources.map(s => ({
                      label: s.source || '(直接访问)',
                      value: s.visitors,
                      type: s.type,
                    }))}
                    showTypeIcon
                    emptyText="暂无数据"
                  />
                </div>
              </div>

              {/* 浏览器分布 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">浏览器分布</h2>
                </div>
                <div className="p-3">
                  <TopList
                    items={browsers.map(b => ({
                      label: b.name || '(未知)',
                      value: b.visitors,
                    }))}
                    showPercent
                    total={summary?.totalPV || 0}
                    emptyText="暂无数据"
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
