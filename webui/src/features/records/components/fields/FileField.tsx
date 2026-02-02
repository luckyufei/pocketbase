/**
 * FileField - 文件字段组件
 * 用于编辑 file 类型的记录字段
 * 支持拖拽上传和缩略图预览
 */
import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecordFileThumb, getFileType } from '../RecordFileThumb'

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

export function FileField({ field, value, onChange, newFiles = [], record }: FileFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const isMultiple = (field.options?.maxSelect || 1) > 1
  const maxSelect = field.options?.maxSelect || 1
  const maxSize = field.options?.maxSize || 5242880 // 5MB default
  const acceptTypes = field.options?.mimeTypes?.join(',') || '*'

  const totalFiles = value.length + newFiles.length
  const canAddMore = maxSelect <= 0 || totalFiles < maxSelect

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
    <div className="space-y-2">
      <Label>
        {field.name}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <div className="space-y-3">
        {/* 已有文件列表 */}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((fileName) => (
              <div key={fileName} className="group relative flex flex-col items-center">
                {record ? (
                  <RecordFileThumb record={record} filename={fileName} size="lg" />
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center rounded-md border bg-muted">
                    <span className="text-xs text-center px-1 truncate max-w-full">{fileName}</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeExistingFile(fileName)}
                  aria-label="Remove file"
                >
                  <X className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground mt-1 max-w-24 truncate">
                  {fileName}
                </span>
              </div>
            ))}
          </div>
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

        {/* 上传按钮（备用） */}
        {canAddMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Choose files
          </Button>
        )}
      </div>
    </div>
  )
}
