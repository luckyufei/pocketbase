/**
 * JobsStats 组件
 * 任务统计卡片 - 与 UI 版本对齐的简洁风格
 */
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
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
  const items = [
    { label: 'Pending', value: stats?.pending ?? 0, color: 'text-yellow-500' },
    { label: 'Processing', value: stats?.processing ?? 0, color: 'text-blue-500' },
    { label: 'Completed', value: stats?.completed ?? 0, color: 'text-green-500' },
    { label: 'Failed', value: stats?.failed ?? 0, color: 'text-red-500' },
    { label: 'Total', value: stats?.total ?? 0, color: '' },
    { label: 'Success Rate', value: formatPercent(stats?.success_rate), color: 'text-green-500' },
  ]

  // Loading state: show 4 skeleton cards (same as UI version)
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-muted/30 rounded-lg px-6 py-4 text-center">
            <Skeleton className="h-7 w-10 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto mt-2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-muted/30 rounded-lg px-6 py-4 text-center"
        >
          <div className={cn('text-2xl font-semibold leading-tight', item.color)}>
            {item.value}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
