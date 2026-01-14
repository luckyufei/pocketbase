/**
 * LogDate 组件
 * 显示日志日期，带本地时间 tooltip
 */
import { formatLogDate, formatLogDateLocal } from '@/lib/logUtils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface LogDateProps {
  date: string
  className?: string
}

export function LogDate({ date, className }: LogDateProps) {
  const utcDate = formatLogDate(date)
  const localDate = formatLogDateLocal(date)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{utcDate}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{localDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
