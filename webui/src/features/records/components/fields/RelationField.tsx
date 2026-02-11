/**
 * RelationField - 关联字段组件
 * 用于编辑 relation 类型的记录字段
 * 支持显示无效关联 ID 警告和拖拽排序
 * 使用列表形式显示已选记录（与旧版 UI 保持一致）
 * 自动加载关联记录数据
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { X, Wand2, AlertTriangle, GripVertical } from 'lucide-react'
import { RecordsPicker } from '../RecordsPicker'
import { RecordInfo } from '../RecordInfo'
import { cn } from '@/lib/utils'
import { usePocketbase } from '@/hooks/usePocketbase'
import type { CollectionField, RecordModel } from 'pocketbase'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const BATCH_SIZE = 100

interface RelationFieldProps {
  field: CollectionField
  value: string | string[]
  onChange: (value: string | string[]) => void
  collection?: {
    id: string
    name: string
    type: 'base' | 'auth' | 'view'
    fields: Array<{
      name: string
      type: string
      required?: boolean
      presentable?: boolean
      hidden?: boolean
    }>
  }
  // z-index for the picker dialog
  zIndex?: number
}

// Sortable Relation List Item Component (与旧版样式一致)
function SortableRelationItem({
  id,
  record,
  isMultiple,
  onRemove,
  isFirst,
}: {
  id: string
  record?: RecordModel
  isMultiple: boolean
  onRemove: () => void
  isFirst?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // 创建一个临时记录用于显示（当没有加载完整记录时）
  const displayRecord: RecordModel = record || ({
    id,
    collectionId: '',
    collectionName: '',
    created: '',
    updated: '',
  } as RecordModel)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 min-h-[50px] transition-colors',
        !isFirst && 'border-t border-slate-200',
        isDragging && 'bg-slate-50',
        'hover:bg-slate-50'
      )}
    >
      {/* 拖拽手柄：只在多选时显示 */}
      {isMultiple && (
        <span {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 flex-shrink-0">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      {/* 内容区域 */}
      <div className="flex-1 min-w-0 py-2">
        <RecordInfo record={displayRecord} />
      </div>
      {/* 删除按钮 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full flex-shrink-0"
            onClick={onRemove}
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove</TooltipContent>
      </Tooltip>
    </div>
  )
}

// 骨架屏加载组件 (与旧版样式一致)
function SkeletonItem({ isFirst }: { isFirst?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 min-h-[50px] animate-pulse',
      !isFirst && 'border-t border-slate-200'
    )}>
      <div className="h-5 flex-1 bg-slate-200 rounded" />
    </div>
  )
}

// 工具函数：将值转换为数组
function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value) return [value]
  return []
}

export function RelationField({
  field,
  value,
  onChange,
  collection,
  zIndex,
}: RelationFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [invalidIds, setInvalidIds] = useState<string[]>([])
  const [list, setList] = useState<RecordModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const { pb } = usePocketbase()
  const uniqueId = `field_${field.name}`
  const isMultiple = (field.maxSelect || 1) > 1
  const values = toArray(value)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 检查是否需要加载数据
  const needLoad = useCallback(() => {
    if (isLoading) return false

    const ids = values
    const currentIds = list.map((item) => item.id)

    // 过滤掉不在 values 中的记录
    const filteredList = list.filter((item) => ids.includes(item.id))
    if (filteredList.length !== list.length) {
      setList(filteredList)
    }

    return ids.length !== filteredList.length
  }, [isLoading, values, list])

  // 加载关联记录数据
  const loadRecords = useCallback(async () => {
    const ids = values

    // 重置状态
    setList([])
    setInvalidIds([])

    if (!field.collectionId || ids.length === 0) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // 批量加载所有选中的记录，避免解析器栈溢出
      const loadPromises: Promise<RecordModel[]>[] = []
      const filterIds = [...ids]

      while (filterIds.length > 0) {
        const batchIds = filterIds.splice(0, BATCH_SIZE)
        const filters = batchIds.map((id) => `id="${id}"`).join('||')

        loadPromises.push(
          pb.collection(field.collectionId).getFullList({
            filter: filters,
            requestKey: null,
          })
        )
      }

      const results = await Promise.all(loadPromises)
      const loadedItems = results.flat()

      // 保持选中顺序
      const orderedList: RecordModel[] = []
      const newInvalidIds: string[] = []

      for (const id of ids) {
        const rel = loadedItems.find((item) => item.id === id)
        if (rel) {
          orderedList.push(rel)
        } else {
          newInvalidIds.push(id)
        }
      }

      setList(orderedList)

      if (newInvalidIds.length > 0) {
        setInvalidIds(newInvalidIds)
        // 自动移除无效的 ID
        listToValue(orderedList)
      }
    } catch (err) {
      console.error('Failed to load relation records:', err)
    }

    setIsLoading(false)
  }, [field.collectionId, values, pb])

  // 监听 value 变化，触发加载
  useEffect(() => {
    if (needLoad()) {
      setIsLoading(true)
      // 将加载函数放到执行队列末尾，减少布局抖动
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = setTimeout(loadRecords, 0)
    }

    return () => {
      clearTimeout(loadTimeoutRef.current)
    }
  }, [value])

  // 将列表转换为值
  const listToValue = useCallback(
    (currentList: RecordModel[]) => {
      if (isMultiple) {
        onChange(currentList.map((r) => r.id))
      } else {
        onChange(currentList[0]?.id || '')
      }
    },
    [isMultiple, onChange]
  )

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = list.findIndex((item) => item.id === active.id)
      const newIndex = list.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newList = arrayMove(list, oldIndex, newIndex)
        setList(newList)
        listToValue(newList)
      }
    },
    [list, listToValue]
  )

  const removeRelation = useCallback(
    (recordId: string) => {
      const newList = list.filter((r) => r.id !== recordId)
      setList(newList)
      listToValue(newList)
    },
    [list, listToValue]
  )

  const handleSelect = useCallback(() => {
    setPickerOpen(true)
  }, [])

  const handleSave = useCallback(
    (newValue: string | string[], records: RecordModel[]) => {
      setList(records)
      if (isMultiple) {
        onChange(Array.isArray(newValue) ? newValue : newValue ? [newValue] : [])
      } else {
        onChange(Array.isArray(newValue) ? newValue[0] || '' : newValue || '')
      }
      setPickerOpen(false)
    },
    [isMultiple, onChange]
  )

  // Default collection config
  const defaultCollection = {
    id: field.collectionId || '',
    name: 'Related',
    type: 'base' as const,
    fields: [
      { name: 'id', type: 'text', required: true },
      { name: 'name', type: 'text', required: false },
    ],
  }

  const targetCollection = collection || defaultCollection

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <div data-field-label="" className="flex items-center gap-2">
        <FieldLabel field={field} htmlFor={uniqueId} />
        {invalidIds.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-4 w-4 text-yellow-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[300px]">
              The following relation ids were removed because they are missing or invalid:{' '}
              {invalidIds.join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Selected relations list - with drag sorting support */}
        <div className="max-h-[300px] overflow-auto">
          {isLoading ? (
            // 显示骨架屏
            <div>
              {values.slice(0, 10).map((id, index) => (
                <SkeletonItem key={id} isFirst={index === 0} />
              ))}
            </div>
          ) : list.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={list.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {list.map((record, index) => (
                    <SortableRelationItem
                      key={record.id}
                      id={record.id}
                      record={record}
                      isMultiple={isMultiple}
                      isFirst={index === 0}
                      onRemove={() => removeRelation(record.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : null}
        </div>

        {/* Open picker button - full width like old UI */}
        <div className={cn((list.length > 0 || isLoading) && 'border-t border-slate-200')}>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-none h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            onClick={handleSelect}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Open picker
          </Button>
        </div>
      </div>

      {/* Records picker dialog */}
      <RecordsPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSave={handleSave}
        collection={targetCollection}
        field={field}
        value={value}
        zIndex={zIndex}
      />
    </FormField>
  )
}
