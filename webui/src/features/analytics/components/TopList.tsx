/**
 * Top 列表组件
 * Apple Design 风格的排名列表
 */
import { Search, Share2, MousePointer, Link } from 'lucide-react'

interface TopListItem {
  label: string
  value: number
  secondary?: number
  secondaryLabel?: string
  type?: 'search' | 'social' | 'direct' | 'referral'
}

interface Props {
  items: TopListItem[]
  showTypeIcon?: boolean
  showPercent?: boolean
  total?: number
  emptyText?: string
}

/**
 * 格式化数字
 */
function formatNumber(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
  return value.toString()
}

/**
 * 获取类型图标
 */
function TypeIcon({ type }: { type: TopListItem['type'] }) {
  const iconClass = 'w-3.5 h-3.5 text-slate-400'
  
  switch (type) {
    case 'search':
      return <Search className={iconClass} />
    case 'social':
      return <Share2 className={iconClass} />
    case 'direct':
      return <MousePointer className={iconClass} />
    default:
      return <Link className={iconClass} />
  }
}

export function TopList({ items, showTypeIcon, showPercent, total, emptyText = '暂无数据' }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((item, index) => {
        const percent = showPercent && total ? ((item.value / total) * 100).toFixed(1) : null

        return (
          <div
            key={index}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {/* 排名 */}
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                index < 3
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {index + 1}
            </span>

            {/* 类型图标 */}
            {showTypeIcon && (
              <TypeIcon type={item.type} />
            )}

            {/* 标签 */}
            <span
              className="flex-1 text-sm text-slate-700 truncate"
              title={item.label}
            >
              {item.label}
            </span>

            {/* 数值 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-900">
                {formatNumber(item.value)}
              </span>
              {item.secondary !== undefined && item.secondaryLabel && (
                <span className="text-xs text-slate-400">
                  {item.secondaryLabel}: {formatNumber(item.secondary)}
                </span>
              )}
              {percent && (
                <span className="text-xs text-slate-400 w-12 text-right">
                  {percent}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
