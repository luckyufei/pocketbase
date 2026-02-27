/**
 * SelectValuesPopover - Select 字段选项值编辑弹窗
 * 与 UI 版本的 DynamicOptionsSelect 保持一致
 * 支持：显示选项、添加选项、删除选项、拖拽排序
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Plus, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SelectValuesPopoverProps {
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean  // 是否有错误（用于显示红色边框）
}

/**
 * 可排序的选项项
 */
function SortableOptionItem({
  value,
  onRemove,
}: {
  value: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 group',
        isDragging && 'opacity-50 bg-muted'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-move touch-none opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm truncate">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function SelectValuesPopover({
  values,
  onChange,
  disabled = false,
  placeholder = 'Add choices *',
  hasError = false,
}: SelectValuesPopoverProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [newValue, setNewValue] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 格式化显示值
  const formattedValue = values.length > 0 ? values.join(' • ') : ''

  // 添加新选项
  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setNewValue('')
    // 保持焦点在输入框
    newInputRef.current?.focus()
  }

  // 删除选项
  const handleRemove = (value: string) => {
    onChange(values.filter((v) => v !== value))
  }

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = values.indexOf(active.id as string)
      const newIndex = values.indexOf(over.id as string)
      onChange(arrayMove(values, oldIndex, newIndex))
    }
  }

  // 打开弹窗时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        newInputRef.current?.focus()
      }, 100)
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex-1 h-8 px-3 text-left text-sm border rounded-md bg-background truncate',
            'hover:bg-muted/50 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed',
            !formattedValue && 'text-muted-foreground',
            hasError && 'border-destructive text-destructive'
          )}
          title={formattedValue || placeholder}
        >
          {formattedValue || placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2">
          {/* 选项列表 */}
          {values.length > 0 && (
            <ScrollArea className="max-h-48">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={values} strategy={verticalListSortingStrategy}>
                  <div className="space-y-0.5">
                    {values.map((value) => (
                      <SortableOptionItem
                        key={value}
                        value={value}
                        onRemove={() => handleRemove(value)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          )}

          {/* 添加新选项 */}
          <div className={cn('flex gap-1', values.length > 0 && 'mt-2 pt-2 border-t')}>
            <Input
              ref={newInputRef}
              placeholder={t('collections.enterChoice', 'e.g. optionA')}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleAdd}
              disabled={!newValue.trim()}
              className="h-8 w-8 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default SelectValuesPopover
