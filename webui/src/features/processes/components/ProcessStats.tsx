/**
 * ProcessStats 组件
 * 进程统计卡片
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import type { ProcessStats as ProcessStatsType } from '../types'

interface ProcessStatsProps {
  stats: ProcessStatsType
  isLoading?: boolean
  className?: string
}

export function ProcessStats({ stats, isLoading = false, className }: ProcessStatsProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 text-center">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded mt-2 w-16 mx-auto" />
          </Card>
        ))}
      </div>
    )
  }

  const items = [
    { label: t('processes.stats.running'), value: stats.running, color: 'text-green-500' },
    { label: t('processes.stats.stopped'), value: stats.stopped, color: 'text-slate-500' },
    { label: t('processes.stats.crashed'), value: stats.crashed, color: 'text-red-500' },
    { label: t('processes.stats.total'), value: stats.total, color: '' },
  ]

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {items.map((item) => (
        <Card key={item.label} className="p-4 text-center">
          <div className={cn('text-2xl font-semibold', item.color)}>{item.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
        </Card>
      ))}
    </div>
  )
}
