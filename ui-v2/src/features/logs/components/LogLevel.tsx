/**
 * LogLevel 组件
 * 显示日志级别标签
 */
import { cn } from '@/lib/utils'
import { getLogLevelLabel, getLogLevelColor } from '@/lib/logUtils'

interface LogLevelProps {
  level: number
  className?: string
}

/**
 * 获取级别对应的背景色点
 * 使用统一的 slate 灰色系，仅保留 error 使用红色
 */
function getLevelDotColor(level: number): string {
  switch (level) {
    case -8:
      return 'bg-slate-400'
    case -4:
      return 'bg-slate-500'
    case 0:
      return 'bg-blue-500'
    case 4:
      return 'bg-slate-600'
    case 8:
      return 'bg-red-500'
    default:
      return 'bg-slate-400'
  }
}

export function LogLevel({ level, className }: LogLevelProps) {
  const label = getLogLevelLabel(level)
  const textColor = getLogLevelColor(level)
  const dotColor = getLevelDotColor(level)

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      <span className={textColor}>
        {label} ({level})
      </span>
    </div>
  )
}
