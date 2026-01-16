/**
 * Analytics 卡片组件
 * Apple Design 风格
 */
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string
  icon: LucideIcon
  color?: 'blue' | 'green' | 'orange' | 'purple'
  trend?: number
  invertTrend?: boolean
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-500',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
  },
  green: {
    bg: 'bg-emerald-500',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
  },
  orange: {
    bg: 'bg-orange-500',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
  },
  purple: {
    bg: 'bg-violet-500',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
  },
}

export function AnalyticsCard({ title, value, icon: Icon, color = 'blue', trend, invertTrend }: Props) {
  const styles = colorStyles[color]

  // 计算趋势样式
  const getTrendStyle = () => {
    if (trend === null || trend === undefined || trend === 0) return null
    const isPositive = trend > 0
    const isGood = invertTrend ? !isPositive : isPositive
    return {
      text: isGood ? 'text-emerald-600' : 'text-red-500',
      icon: isPositive ? '↑' : '↓',
      value: Math.abs(trend * 100).toFixed(1) + '%',
    }
  }

  const trendStyle = getTrendStyle()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-start gap-3 hover:shadow-md hover:border-blue-200 transition-all">
      {/* 图标 */}
      <div className={`w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${styles.iconText}`} />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{title}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        {trendStyle && (
          <p className={`text-xs ${trendStyle.text} flex items-center gap-0.5 mt-0.5`}>
            <span>{trendStyle.icon}</span>
            <span>{trendStyle.value}</span>
          </p>
        )}
      </div>
    </div>
  )
}
