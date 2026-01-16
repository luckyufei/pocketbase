/**
 * Traces 页面
 * OpenTelemetry 风格的请求追踪（与 ui 版本一致）
 */
import { useEffect, useRef } from 'react'
import { useTraces } from '../hooks/useTraces'
import { TraceStats } from './TracesStats'
import { TraceFilters } from './TracesFilter'
import { TraceList } from './TraceList'
import { TraceDetail } from './TraceDetail'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function TracesPage() {
  const {
    traces,
    activeTraceId,
    traceSpans,
    isLoading,
    isLoadingDetail,
    filters,
    timeRange,
    currentPage,
    totalItems,
    perPage,
    totalPages,
    stats,
    loadTraces,
    loadTraceDetail,
    closeDetail,
    refresh,
    loadStats,
    changePage,
    updateFilters,
    updateTimeRange,
  } = useTraces()

  // 初始加载
  const isFirstRender = useRef(true)
  useEffect(() => {
    loadTraces(1)
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 时间范围或过滤器变更时重新加载
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    loadTraces(1)
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, filters])

  return (
    <div className="h-full flex">
      {/* 左侧：主内容 */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${activeTraceId ? 'mr-[500px]' : ''}`}>
        {/* 头部 */}
        <header className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Traces</h1>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </header>

        {/* 统计卡片 */}
        <div className="px-4 py-3 border-b border-slate-100">
          <TraceStats stats={stats} />
        </div>

        {/* 过滤器 */}
        <div className="px-4 py-3 border-b border-slate-100">
          <TraceFilters
            filters={filters}
            timeRange={timeRange}
            onFiltersChange={updateFilters}
            onTimeRangeChange={updateTimeRange}
          />
        </div>

        {/* Trace 列表 */}
        <div className="flex-1 overflow-auto">
          <TraceList
            traces={traces}
            isLoading={isLoading}
            currentPage={currentPage}
            totalItems={totalItems}
            perPage={perPage}
            totalPages={totalPages}
            activeTraceId={activeTraceId}
            onTraceSelect={loadTraceDetail}
            onPageChange={changePage}
          />
        </div>
      </div>

      {/* 右侧：详情面板 */}
      <TraceDetail
        traceId={activeTraceId}
        spans={traceSpans}
        isLoading={isLoadingDetail}
        onClose={closeDetail}
      />
    </div>
  )
}

export default TracesPage
