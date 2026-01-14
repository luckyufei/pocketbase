/**
 * T016: FormattedDate - 日期格式化组件
 * 显示日期和时间，支持本地时区转换提示
 */
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface FormattedDateProps {
  date: string | Date | null | undefined
  className?: string
  showTime?: boolean
}

/**
 * 格式化为本地日期时间字符串
 */
function formatToLocalDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString()
  } catch {
    return ''
  }
}

export function FormattedDate({ date, className, showTime = true }: FormattedDateProps) {
  const dateStr = useMemo(() => {
    if (!date) return ''
    if (typeof date === 'string') return date
    return date.toISOString()
  }, [date])

  const dateOnly = useMemo(() => {
    return dateStr ? dateStr.substring(0, 10) : null
  }, [dateStr])

  const timeOnly = useMemo(() => {
    return dateStr ? dateStr.substring(11, 19) : null
  }, [dateStr])

  const localDate = useMemo(() => {
    if (!dateStr) return ''
    return formatToLocalDate(dateStr) + ' Local'
  }, [dateStr])

  if (!dateStr) {
    return <span className="text-muted-foreground">N/A</span>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-block align-top whitespace-nowrap leading-tight', className)}>
            <div className="date">{dateOnly}</div>
            {showTime && timeOnly && (
              <div className="time text-sm text-muted-foreground">{timeOnly} UTC</div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{localDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default FormattedDate
