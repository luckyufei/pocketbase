/**
 * LogLevel 组件
 * 显示日志级别标签 - 与 UI 版本对齐
 */
import { cn } from '@/lib/utils'
import { getLogLevelLabel, getLogLevelColor } from '@/lib/logUtils'

interface LogLevelProps {
  level: number
  className?: string
}

/**
 * 获取级别对应的背景色点
 * 与 UI 版本的样式对齐
 */
function getLevelDotColor(level: number): string {
  switch (level) {
    case -4:
      return 'bg-slate-400' // DEBUG
    case 0:
      return 'bg-blue-500' // INFO
    case 4:
      return 'bg-amber-500' // WARN
    case 8:
      return 'bg-red-500' // ERROR
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
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 whitespace-nowrap',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
      <span className={textColor}>
        {label} ({level})
      </span>
    </div>
  )
}
