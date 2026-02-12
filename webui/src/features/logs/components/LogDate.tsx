/**
 * LogDate 组件
 * 显示日志日期，带本地时间 tooltip - 与 UI 版本对齐
 */
import { useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

interface LogDateProps {
  date: string
  className?: string
}

export function LogDate({ date, className }: LogDateProps) {
  // 与 UI 版本一致：直接替换 Z 为 UTC，T 为空格
  const displayDate = useMemo(() => {
    if (!date) return ''
    return date.replace('T', ' ').replace('Z', ' UTC')
  }, [date])

  // 本地时间用于 tooltip
  const localDate = useMemo(() => {
    if (!date) return ''
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss.SSS') + ' Local'
  }, [date])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('whitespace-nowrap', className)}>{displayDate}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{localDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
