/**
 * T015: CopyIcon - 复制按钮组件
 * 点击后将指定内容复制到剪贴板
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CopyIconProps {
  value: string
  tooltip?: string
  successDuration?: number
  className?: string
  idleClassName?: string
  successClassName?: string
}

export function CopyIcon({
  value,
  tooltip = 'Copy',
  successDuration = 500,
  className,
  idleClassName = 'text-muted-foreground hover:text-foreground',
  successClassName = 'text-green-500',
}: CopyIconProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const copy = useCallback(async () => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, successDuration)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [value, successDuration])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    copy()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              'inline-flex items-center justify-center cursor-pointer transition-colors',
              copied ? successClassName : idleClassName,
              className
            )}
            aria-label="Copy to clipboard"
            onClick={handleClick}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        {!copied && (
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

export default CopyIcon
