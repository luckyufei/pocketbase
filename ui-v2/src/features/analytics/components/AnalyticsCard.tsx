import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AnalyticsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function AnalyticsCard({
  title,
  value,
  subtitle,
  icon,
  children,
  className,
}: AnalyticsCardProps) {
  const { t } = useTranslation()

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
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {children}
      </CardContent>
    </Card>
  )
}
