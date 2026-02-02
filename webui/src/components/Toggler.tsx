/**
 * T012: Toggler - 下拉切换器组件
 * 用于创建可切换显示/隐藏的下拉内容
 */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'

interface TogglerProps {
  children: React.ReactNode
  trigger?: React.RefObject<HTMLElement>
  className?: string
  escClose?: boolean
  autoScroll?: boolean
  closableClass?: string
  defaultOpen?: boolean
  onShow?: () => void
  onHide?: () => void
}

export interface TogglerRef {
  show: () => void
  hide: () => void
  toggle: () => void
  isActive: () => boolean
}

export const Toggler = forwardRef<TogglerRef, TogglerProps>(function Toggler(
  {
    children,
    trigger,
    className,
    escClose = true,
    autoScroll = true,
    closableClass = 'closable',
    defaultOpen = false,
    onShow,
    onHide,
  },
  ref
) {
  const [active, setActive] = useState(defaultOpen)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout>()
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  const hide = useCallback(() => {
    if (!active) return
    setActive(false)
    clearTimeout(scrollTimeoutRef.current)
    clearTimeout(hideTimeoutRef.current)
    onHide?.()
  }, [active, onHide])

  const show = useCallback(() => {
    clearTimeout(hideTimeoutRef.current)
    clearTimeout(scrollTimeoutRef.current)

    if (active) return
    setActive(true)
    onShow?.()

    scrollTimeoutRef.current = setTimeout(() => {
      if (!autoScroll || !contentRef.current) return
      contentRef.current.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, 180)
  }, [active, autoScroll, onShow])

  const toggle = useCallback(() => {
    if (active) {
      hide()
    } else {
      show()
    }
  }, [active, hide, show])

  const hideWithDelay = useCallback(
    (delay = 0) => {
      if (!active) return
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(hide, delay)
    },
    [active, hide]
  )

  useImperativeHandle(ref, () => ({
    show,
    hide,
    toggle,
    isActive: () => active,
  }))

  // 处理 trigger 点击
  useEffect(() => {
    const triggerEl = trigger?.current
    if (!triggerEl) return

    const handleClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      toggle()
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }
    }

    triggerEl.addEventListener('click', handleClick)
    triggerEl.addEventListener('keydown', handleKeydown)

    return () => {
      triggerEl.removeEventListener('click', handleClick)
      triggerEl.removeEventListener('keydown', handleKeydown)
    }
  }, [trigger, toggle])

  // 处理外部点击
  useEffect(() => {
    if (!active) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        trigger?.current &&
        !trigger.current.contains(target)
      ) {
        hide()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [active, trigger, hide])

  // 处理 Escape 键
  useEffect(() => {
    if (!active || !escClose) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        hide()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [active, escClose, hide])

  // 处理容器内 closable 元素点击
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const target = e.target as HTMLElement
    if (target.classList.contains(closableClass) || target.closest(`.${closableClass}`)) {
      hideWithDelay(150)
    }
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      clearTimeout(scrollTimeoutRef.current)
      clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="toggler-container"
      tabIndex={-1}
      role="menu"
      onClick={handleContainerClick}
    >
      {active && (
        <div
          ref={contentRef}
          className={cn('animate-in fade-in-0 zoom-in-95 duration-150', className)}
        >
          {children}
        </div>
      )}
    </div>
  )
})

export default Toggler
