/**
 * JobsStats 组件
 * 任务统计卡片
 */
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import type { JobsStats as JobsStatsType } from '../store'

interface JobsStatsProps {
  stats: JobsStatsType | null
  isLoading?: boolean
  className?: string
}

function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '-'
  return (rate * 100).toFixed(1) + '%'
}

export function JobsStats({ stats, isLoading = false, className }: JobsStatsProps) {
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-4 text-center">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded mt-2 w-16 mx-auto" />
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={cn('grid grid-cols-1', className)}>
        <Card className="p-4 text-center text-muted-foreground">暂无数据</Card>
      </div>
    )
  }

  const items = [
    { label: 'Pending', value: stats.pending, color: 'text-yellow-500' },
    { label: 'Processing', value: stats.processing, color: 'text-blue-500' },
    { label: 'Completed', value: stats.completed, color: 'text-green-500' },
    { label: 'Failed', value: stats.failed, color: 'text-red-500' },
    { label: 'Total', value: stats.total, color: '' },
    { label: 'Success Rate', value: formatPercent(stats.success_rate), color: 'text-green-500' },
  ]

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
      {items.map((item) => (
        <Card key={item.label} className="p-4 text-center">
          <div className={cn('text-2xl font-semibold', item.color)}>{item.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
        </Card>
      ))}
    </div>
  )
}
