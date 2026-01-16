import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricsCardProps {
  title: string
  value: string | number
  unit?: string
  description?: string
  trend?: number // 百分比变化
  trendLabel?: string
  icon?: React.ReactNode
  className?: string
}

export function MetricsCard({
  title,
  value,
  unit,
  description,
  trend,
  trendLabel,
  icon,
  className,
}: MetricsCardProps) {
  const { t } = useTranslation()

  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) {
      return <Minus className="w-4 h-4 text-muted-foreground" />
    }
    if (trend > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />
    }
    return <TrendingDown className="w-4 h-4 text-red-500" />
  }

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return 'text-muted-foreground'
    if (trend > 0) return 'text-green-500'
    return 'text-red-500'
  }

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M'
      }
      if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K'
      }
      return val.toLocaleString()
    }
    return val
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{formatValue(value)}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {(trend !== undefined || description) && (
          <div className="flex items-center gap-2 mt-2">
            {trend !== undefined && (
              <div className={cn('flex items-center gap-1 text-sm', getTrendColor())}>
                {getTrendIcon()}
                <span>{Math.abs(trend).toFixed(1)}%</span>
                {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
              </div>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
