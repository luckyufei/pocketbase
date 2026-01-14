/**
 * MetricsChart - 指标图表组件
 * 显示系统指标的时间趋势
 */
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MetricsData {
  time: string
  value: number
}

interface MetricsChartProps {
  data: MetricsData[]
  title: string
  unit?: string
  height?: number
}

export function MetricsChart({ data, title, unit, height = 150 }: MetricsChartProps) {
  const { maxValue, currentValue } = useMemo(() => {
    if (data.length === 0) return { maxValue: 0, currentValue: 0 }
    return {
      maxValue: Math.max(...data.map((d) => d.value)),
      currentValue: data[data.length - 1]?.value || 0,
    }
  }, [data])

  return (
    <Card data-testid="metrics-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{title}</span>
          {unit && <span className="text-muted-foreground">{unit}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height }}
          >
            No data available
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold mb-2">
              {currentValue.toFixed(1)}
              {unit}
            </div>
            <div className="relative" style={{ height }}>
              <div className="absolute inset-0 flex items-end gap-0.5">
                {data.map((item, index) => {
                  const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-primary/60 hover:bg-primary transition-colors rounded-t"
                      style={{ height: `${heightPercent}%` }}
                      title={`${item.time}: ${item.value}${unit || ''}`}
                    />
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
