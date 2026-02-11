/**
 * FileField - 文件字段组件
 * 用于编辑 file 类型的记录字段
 * 支持拖拽上传和缩略图预览
 */
import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import { Upload, X, ExternalLink, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecordFileThumb, getFileType } from '../RecordFileThumb'
import { usePocketbase } from '@/hooks/usePocketbase'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface FileFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: {
      maxSelect?: number
      maxSize?: number
      mimeTypes?: string[]
      thumbs?: string[]
      protected?: boolean
    }
  }
  value: string[]
  onChange: (value: string[], newFiles?: File[]) => void
  newFiles?: File[]
  record?: {
    id: string
    collectionId: string
    [key: string]: any
  }
}

// Sortable File Item Component
function SortableFileItem({
  id,
  fileName,
  record,
  onRemove,
  onOpenInNewTab,
  isMultiple,
}: {
  id: string
  fileName: string
  record?: FileFieldProps['record']
  onRemove: () => void
  onOpenInNewTab?: () => void
  isMultiple: boolean
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col items-center"
    >
      {/* Drag handle for multiple files */}
      {isMultiple && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-background/80 rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      
      {record ? (
        <RecordFileThumb record={record} filename={fileName} size="lg" />
      ) : (
        <div className="w-24 h-24 flex items-center justify-center rounded-md border bg-muted">
          <span className="text-xs text-center px-1 truncate max-w-full">{fileName}</span>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {record && onOpenInNewTab && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-5 w-5 p-0 rounded-full"
            onClick={onOpenInNewTab}
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-5 w-5 p-0 rounded-full"
          onClick={onRemove}
          aria-label="Remove file"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      <span className="text-xs text-muted-foreground mt-1 max-w-24 truncate">
        {fileName}
      </span>
    </div>
  )
}

export function FileField({ field, value, onChange, newFiles = [], record }: FileFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const { pb } = usePocketbase()

  const isMultiple = (field.options?.maxSelect || 1) > 1
  const maxSelect = field.options?.maxSelect || 1

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

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = value.indexOf(active.id as string)
      const newIndex = value.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(value, oldIndex, newIndex)
        onChange(newOrder, newFiles)
      }
    },
    [value, newFiles, onChange]
  )
  const maxSize = field.options?.maxSize || 5242880 // 5MB default
  const acceptTypes = field.options?.mimeTypes?.join(',') || '*'

  const totalFiles = value.length + newFiles.length
  const canAddMore = maxSelect <= 0 || totalFiles < maxSelect

  // Open file in new tab
  const openInNewTab = useCallback(
    async (filename: string) => {
      if (!record?.id) return
      try {
        // Get superuser file token for protected files
        const token = await pb.files.getToken()
        const url = pb.files.getURL(record as any, filename, { token })
        window.open(url, '_blank')
      } catch (error) {
        // Fallback without token
        const url = pb.files.getURL(record as any, filename)
        window.open(url, '_blank')
      }
    },
    [pb, record]
  )

  // 处理文件选择
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const fileArray = Array.from(files)

      // 过滤超过大小限制的文件
      const validFiles = fileArray.filter((file) => {
        if (file.size > maxSize) {
          console.warn(`File ${file.name} exceeds max size of ${maxSize} bytes`)
          return false
        }
        return true
      })

      // 限制文件数量
      const remainingSlots = maxSelect > 0 ? maxSelect - totalFiles : validFiles.length
      const filesToAdd = validFiles.slice(0, remainingSlots)

      if (filesToAdd.length > 0) {
        onChange(value, [...newFiles, ...filesToAdd])
      }
    },
    [value, newFiles, onChange, maxSize, maxSelect, totalFiles]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files)
      // 重置 input 以便可以再次选择相同文件
      e.target.value = ''
    },
    [handleFileSelect]
  )

  // 拖拽处理
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (canAddMore) {
        setIsDragOver(true)
      }
    },
    [canAddMore]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (canAddMore) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [canAddMore, handleFileSelect]
  )

  // 移除已有文件
  const removeExistingFile = useCallback(
    (fileName: string) => {
      onChange(
        value.filter((f) => f !== fileName),
        newFiles
      )
    },
    [value, newFiles, onChange]
  )

  // 移除新文件
  const removeNewFile = useCallback(
    (index: number) => {
      const updated = [...newFiles]
      updated.splice(index, 1)
      onChange(value, updated)
    },
    [value, newFiles, onChange]
  )

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <FormField name={field.name}>
      <FieldLabel field={field as any} />

      <div className="space-y-3">
        {/* 已有文件列表 - 支持拖拽排序 */}
        {value.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={value} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {value.map((fileName) => (
                  <SortableFileItem
                    key={fileName}
                    id={fileName}
                    fileName={fileName}
                    record={record}
                    isMultiple={isMultiple}
                    onRemove={() => removeExistingFile(fileName)}
                    onOpenInNewTab={() => openInNewTab(fileName)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* 新上传的文件 */}
        {newFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {newFiles.map((file, index) => {
              const fileType = getFileType(file.name)
              const isImage = fileType === 'image'
              const previewUrl = isImage ? URL.createObjectURL(file) : null

              return (
                <div key={`new-${index}`} className="group relative flex flex-col items-center">
                  <div className="w-24 h-24 flex items-center justify-center rounded-md border bg-muted overflow-hidden">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                    ) : (
                      <span className="text-xs text-center px-1 text-muted-foreground">
                        {file.name.split('.').pop()?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeNewFile(index)}
                    aria-label="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground mt-1 max-w-24 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 拖拽上传区域 */}
        {canAddMore && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragOver ? (
                'Drop files here'
              ) : (
                <>
                  Drag and drop files here, or{' '}
                  <span className="text-primary underline">browse</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max size: {formatFileSize(maxSize)}
              {maxSelect > 0 && ` • Max files: ${maxSelect}`}
            </p>
          </div>
        )}

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          multiple={isMultiple}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    </FormField>
  )
}
