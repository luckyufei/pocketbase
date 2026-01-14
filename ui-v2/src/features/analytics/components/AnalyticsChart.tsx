/**
 * AnalyticsChart - 流量分析图表组件
 * 显示页面访问量和访客数的趋势
 */
import { useMemo } from 'react'

interface AnalyticsData {
  date: string
  pageViews: number
  visitors: number
}

interface AnalyticsChartProps {
  data: AnalyticsData[]
  height?: number
}

export function AnalyticsChart({ data, height = 200 }: AnalyticsChartProps) {
  const maxValue = useMemo(() => {
    if (data.length === 0) return 0
    return Math.max(...data.flatMap((d) => [d.pageViews, d.visitors]))
  }, [data])

  if (data.length === 0) {
    return (
      <div
        data-testid="analytics-chart"
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No data available
      </div>
    )
  }

  return (
    <div data-testid="analytics-chart" className="space-y-4">
      {/* 图例 */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span>Page Views</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/50" />
          <span>Visitors</span>
        </div>
      </div>

      {/* 图表 */}
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-1">
          {data.map((item, index) => (
            <div key={index} className="flex-1 flex items-end gap-0.5">
              {/* Page Views */}
              <div
                className="flex-1 bg-primary rounded-t"
                style={{
                  height: `${maxValue > 0 ? (item.pageViews / maxValue) * 100 : 0}%`,
                }}
                title={`${item.date}: ${item.pageViews} page views`}
              />
              {/* Visitors */}
              <div
                className="flex-1 bg-primary/50 rounded-t"
                style={{
                  height: `${maxValue > 0 ? (item.visitors / maxValue) * 100 : 0}%`,
                }}
                title={`${item.date}: ${item.visitors} visitors`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
