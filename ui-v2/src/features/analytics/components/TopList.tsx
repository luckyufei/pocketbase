import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Search, Share2, MousePointer, Link } from 'lucide-react'

interface TopListItem {
  [key: string]: unknown
}

interface TopListProps {
  items: TopListItem[]
  labelKey?: string
  valueKey?: string
  secondaryKey?: string | null
  secondaryLabel?: string
  showType?: boolean
  typeKey?: string
  showPercent?: boolean
  total?: number
  className?: string
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '-'
  const num = Number(value)
  if (isNaN(num)) return String(value)
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

function getPercent(value: unknown, total: number): string {
  if (!total || !value) return '0%'
  const num = Number(value)
  if (isNaN(num)) return '0%'
  return ((num / total) * 100).toFixed(1) + '%'
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'search':
      return <Search className="w-4 h-4" />
    case 'social':
      return <Share2 className="w-4 h-4" />
    case 'direct':
      return <MousePointer className="w-4 h-4" />
    default:
      return <Link className="w-4 h-4" />
  }
}

export function TopList({
  items,
  labelKey = 'label',
  valueKey = 'value',
  secondaryKey = null,
  secondaryLabel = '',
  showType = false,
  typeKey = 'type',
  showPercent = false,
  total = 0,
  className,
}: TopListProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return <div className={cn('text-center py-8 text-muted-foreground', className)}>暂无数据</div>
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {showType && (
              <span className="text-muted-foreground flex-shrink-0">
                {getTypeIcon(String(item[typeKey] || ''))}
              </span>
            )}
            <span className="text-sm truncate" title={String(item[labelKey] || '')}>
              {String(item[labelKey]) || '(unknown)'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-semibold text-sm">{formatNumber(item[valueKey])}</span>
            {secondaryKey && item[secondaryKey] !== undefined && (
              <span className="text-xs text-muted-foreground">
                {secondaryLabel}: {formatNumber(item[secondaryKey])}
              </span>
            )}
            {showPercent && (
              <span className="text-xs text-muted-foreground min-w-[45px] text-right">
                {getPercent(item[valueKey], total)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
