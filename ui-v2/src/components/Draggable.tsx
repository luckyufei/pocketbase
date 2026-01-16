/**
 * T013: Draggable - 可拖拽排序组件
 * 用于实现列表项的拖拽排序功能
 */
import { useState, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface DraggableProps<T> {
  children: (props: { dragging: boolean; dragover: boolean }) => React.ReactNode
  index: number
  list: T[]
  group?: string
  disabled?: boolean
  dragHandleClass?: string
  onSort?: (data: { oldIndex: number; newIndex: number; list: T[] }) => void
  onDrag?: (e: DragEvent) => void
  className?: string
}

interface DragData {
  index: number
  group: string
}

export function Draggable<T>({
  children,
  index,
  list,
  group = 'default',
  disabled = false,
  dragHandleClass = '',
  onSort,
  onDrag,
  className,
}: DraggableProps<T>) {
  const [dragging, setDragging] = useState(false)
  const [dragover, setDragover] = useState(false)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return

      // 如果指定了拖拽手柄，检查是否点击在手柄上
      if (dragHandleClass && !(e.target as HTMLElement).classList.contains(dragHandleClass)) {
        setDragover(false)
        setDragging(false)
        e.preventDefault()
        return
      }

      setDragging(true)

      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.dropEffect = 'move'
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          index,
          group,
        } as DragData)
      )

      onDrag?.(e.nativeEvent)
    },
    [disabled, dragHandleClass, index, group, onDrag]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setDragover(false)
      setDragging(false)

      if (disabled) return

      e.dataTransfer.dropEffect = 'move'

      let dragData: DragData = { index: 0, group: '' }
      try {
        dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
      } catch {
        // ignore parse error
      }

      if (dragData.group !== group) {
        return // 不同拖拽组
      }

      const start = dragData.index
      const target = index

      if (start === target) return

      const newList = [...list]
      if (start < target) {
        newList.splice(target + 1, 0, newList[start])
        newList.splice(start, 1)
      } else {
        newList.splice(target, 0, newList[start])
        newList.splice(start + 1, 1)
      }

      onSort?.({
        oldIndex: start,
        newIndex: target,
        list: newList,
      })
    },
    [disabled, group, index, list, onSort]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragover(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragover(false)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragover(false)
    setDragging(false)
  }, [])

  return (
    <div
      draggable={!disabled}
      className={cn(
        'draggable select-text outline-none min-w-0',
        dragging && 'opacity-50',
        dragover && 'border-primary border-t-2',
        className
      )}
      onDragStart={handleDragStart}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnd={handleDragEnd}
    >
      {children({ dragging, dragover })}
    </div>
  )
}

export default Draggable
