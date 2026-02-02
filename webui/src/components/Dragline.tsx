/**
 * T014: Dragline - 拖拽线组件
 * 用于调整面板宽度的可拖拽分隔线
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DraglineProps {
  tolerance?: number
  onDragStart?: (data: { event: MouseEvent | TouchEvent; elem: HTMLElement }) => void
  onDragStop?: (data: { event: MouseEvent | TouchEvent; elem: HTMLElement }) => void
  onDragging?: (data: {
    event: MouseEvent | TouchEvent
    elem: HTMLElement
    diffX: number
    diffY: number
  }) => void
  className?: string
}

export function Dragline({
  tolerance = 0,
  onDragStart,
  onDragStop,
  onDragging,
  className,
}: DraglineProps) {
  const [isDragging, setIsDragging] = useState(false)
  const elemRef = useRef<HTMLSpanElement>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const shiftXRef = useRef(0)
  const shiftYRef = useRef(0)
  const dragStartedRef = useRef(false)

  const onMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const elem = elemRef.current
      if (!elem) return

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      const diffX = clientX - startXRef.current
      const diffY = clientY - startYRef.current
      const left = clientX - shiftXRef.current
      const top = clientY - shiftYRef.current

      if (
        !dragStartedRef.current &&
        Math.abs(left - elem.offsetLeft) < tolerance &&
        Math.abs(top - elem.offsetTop) < tolerance
      ) {
        return
      }

      e.preventDefault()

      if (!dragStartedRef.current) {
        dragStartedRef.current = true
        setIsDragging(true)
        elem.classList.add('no-pointer-events')
        onDragStart?.({ event: e, elem })
      }

      onDragging?.({ event: e, elem, diffX, diffY })
    },
    [tolerance, onDragStart, onDragging]
  )

  const onStop = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const elem = elemRef.current
      if (!elem) return

      if (dragStartedRef.current) {
        e.preventDefault()
        dragStartedRef.current = false
        setIsDragging(false)
        elem.classList.remove('no-pointer-events')
        onDragStop?.({ event: e, elem })
      }

      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('touchend', onStop)
      document.removeEventListener('mouseup', onStop)
    },
    [onMove, onDragStop]
  )

  const dragInit = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation()

      const elem = elemRef.current
      if (!elem) return

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      startXRef.current = clientX
      startYRef.current = clientY
      shiftXRef.current = clientX - elem.offsetLeft
      shiftYRef.current = clientY - elem.offsetTop

      document.addEventListener('touchmove', onMove)
      document.addEventListener('mousemove', onMove)
      document.addEventListener('touchend', onStop)
      document.addEventListener('mouseup', onStop)
    },
    [onMove, onStop]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        dragInit(e)
      }
    },
    [dragInit]
  )

  // 清理事件监听
  useEffect(() => {
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('touchend', onStop)
      document.removeEventListener('mouseup', onStop)
    }
  }, [onMove, onStop])

  return (
    <span
      ref={elemRef}
      className={cn(
        'relative z-[101] left-0 top-0 h-full w-[5px] p-0 m-0 -mx-[3px] -ml-px',
        'bg-transparent cursor-ew-resize box-content select-none',
        'transition-shadow duration-150',
        'shadow-[inset_1px_0_0_0_hsl(var(--border))]',
        'hover:shadow-[inset_3px_0_0_0_hsl(var(--border))]',
        isDragging && 'shadow-[inset_3px_0_0_0_hsl(var(--border))]',
        className
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={dragInit}
    />
  )
}

export default Dragline
