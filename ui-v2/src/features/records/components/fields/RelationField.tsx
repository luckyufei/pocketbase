/**
 * RelationField - 关联字段组件
 * 用于编辑 relation 类型的记录字段
 */
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Link } from 'lucide-react'
import { RecordsPicker } from '../RecordsPicker'

interface RelationFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: {
      collectionId?: string
      maxSelect?: number
    }
  }
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
  // 用于显示记录名称的映射
  recordLabels?: Record<string, string>
}

export function RelationField({
  field,
  value,
  onChange,
  collection,
  recordLabels = {},
}: RelationFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const isMultiple = (field.options?.maxSelect || 1) > 1
  const values = Array.isArray(value) ? value : value ? [value] : []

  const removeRelation = useCallback(
    (id: string) => {
      const updated = values.filter((v) => v !== id)
      onChange(isMultiple ? updated : updated[0] || '')
    },
    [values, isMultiple, onChange]
  )

  const handleSelect = useCallback(() => {
    setPickerOpen(true)
  }, [])

  const handleSave = useCallback(
    (newValue: string | string[]) => {
      onChange(newValue)
      setPickerOpen(false)
    },
    [onChange]
  )

  // 获取记录显示标签
  const getRecordLabel = (id: string) => {
    return recordLabels[id] || id
  }

  // 默认的 collection 配置（当没有传入时）
  const defaultCollection = {
    id: field.options?.collectionId || '',
    name: 'Related',
    type: 'base' as const,
    fields: [
      { name: 'id', type: 'text', required: true },
      { name: 'name', type: 'text', required: false },
    ],
  }

  const targetCollection = collection || defaultCollection

  return (
    <div className="space-y-2">
      <Label>
        {field.name}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <div className="space-y-2">
        {/* 已选择的关联 */}
        {values.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {values.map((id) => (
              <Badge key={id} variant="secondary" className="pr-1">
                <span className="mr-1 max-w-[200px] truncate">{getRecordLabel(id)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeRelation(id)}
                  aria-label="Remove relation"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* 选择按钮 */}
        <Button type="button" variant="outline" onClick={handleSelect}>
          <Link className="h-4 w-4 mr-2" />
          Select
        </Button>
      </div>

      {/* 记录选择器对话框 */}
      <RecordsPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSave={handleSave}
        collection={targetCollection}
        field={field}
        value={value}
      />
    </div>
  )
}
