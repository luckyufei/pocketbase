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

// Vercel 极简风格：统一使用黑白灰
const colorStyles = {
  blue: {
    bg: 'bg-foreground',
    iconBg: 'bg-secondary',
    iconText: 'text-foreground',
  },
  green: {
    bg: 'bg-foreground',
    iconBg: 'bg-secondary',
    iconText: 'text-foreground',
  },
  orange: {
    bg: 'bg-foreground',
    iconBg: 'bg-secondary',
    iconText: 'text-foreground',
  },
  purple: {
    bg: 'bg-foreground',
    iconBg: 'bg-secondary',
    iconText: 'text-foreground',
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
    <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3 hover:border-foreground/20 transition-all">
      {/* 图标 */}
      <div className={`w-10 h-10 rounded-md ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${styles.iconText}`} />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
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
