/**
 * LogsChart - 日志图表组件
 * 显示日志数量的时间趋势
 */
import { useMemo } from 'react'

interface LogsChartData {
  time: string
  count: number
}

interface LogsChartProps {
  data: LogsChartData[]
  height?: number
}

export function LogsChart({ data, height = 200 }: LogsChartProps) {
  const maxCount = useMemo(() => {
    if (data.length === 0) return 0
    return Math.max(...data.map((d) => d.count))
  }, [data])

  if (data.length === 0) {
    return (
      <div
        data-testid="logs-chart"
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No data available
      </div>
    )
  }

  return (
    <div data-testid="logs-chart" className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-1">
        {data.map((item, index) => {
          const heightPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0
          return (
            <div
              key={index}
              className="flex-1 bg-primary/80 hover:bg-primary transition-colors rounded-t"
              style={{ height: `${heightPercent}%` }}
              title={`${item.time}: ${item.count}`}
            />
          )
        })}
      </div>
    </div>
  )
}
