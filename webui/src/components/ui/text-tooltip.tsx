/**
 * TextTooltip - 长文本截断 + Tooltip 组件
 * 当文本被截断时自动显示完整内容的 Tooltip
 */
import * as React from 'react'
import { useRef, useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './tooltip'
import { cn } from '@/lib/utils'

interface TextTooltipProps {
  /** 要显示的文本 */
  text: string
  /** 额外的 className */
  className?: string
  /** tooltip 位置 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 是否总是显示 tooltip（即使文本没有被截断） */
  alwaysShowTooltip?: boolean
  /** 子元素渲染函数（可选，用于自定义渲染） */
  children?: React.ReactNode
}

/**
 * TextTooltip 组件
 * 自动检测文本是否被截断，如果截断则显示 tooltip
 */
export function TextTooltip({
  text,
  className,
  side = 'top',
  alwaysShowTooltip = false,
  children,
}: TextTooltipProps) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  // 检测文本是否被截断
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollWidth, clientWidth } = textRef.current
        setIsTruncated(scrollWidth > clientWidth)
      }
    }

    checkTruncation()

    // 监听窗口大小变化
    window.addEventListener('resize', checkTruncation)
    return () => window.removeEventListener('resize', checkTruncation)
  }, [text])

  const showTooltip = alwaysShowTooltip || isTruncated

  const content = children || (
    <span ref={textRef} className={cn('truncate block', className)}>
      {text}
    </span>
  )

  if (!showTooltip) {
    return content
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <span ref={textRef} className={cn('truncate block cursor-default', className)}>
              {text}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs break-words">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * IconTooltip - 图标带 Tooltip
 */
interface IconTooltipProps {
  /** Tooltip 内容 */
  content: string
  /** tooltip 位置 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 子元素（图标） */
  children: React.ReactNode
}

export function IconTooltip({ content, side = 'top', children }: IconTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { TextTooltip as default }
