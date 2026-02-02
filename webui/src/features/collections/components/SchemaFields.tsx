/**
 * SchemaFields - Collection 字段列表编辑器
 * 用于管理 Collection 的字段定义
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Plus, Settings, Trash2, GripVertical, Copy } from 'lucide-react'

// 字段类型定义
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'bool', label: 'Bool' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'file', label: 'File' },
  { value: 'relation', label: 'Relation' },
  { value: 'json', label: 'JSON' },
  { value: 'editor', label: 'Editor' },
]

interface SchemaField {
  id?: string
  name: string
  type: string
  required: boolean
  options?: Record<string, unknown>
  system?: boolean
  hidden?: boolean
  presentable?: boolean
  _toDelete?: boolean
}

interface SchemaFieldsProps {
  fields: SchemaField[]
  onChange: (fields: SchemaField[]) => void
  collectionType?: 'base' | 'auth' | 'view'
}

export function SchemaFields({ fields, onChange, collectionType = 'base' }: SchemaFieldsProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null)

  const addField = (type: string = 'text') => {
    const newField: SchemaField = {
      name: getUniqueName('field'),
      type,
      required: false,
      options: {},
    }
    onChange([...fields, newField])
  }

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeField = (index: number) => {
    const field = fields[index]
    if (field.id) {
      // 已保存的字段标记为删除
      updateField(index, { _toDelete: true })
    } else {
      // 新字段直接移除
      const updated = fields.filter((_, i) => i !== index)
      onChange(updated)
    }
  }

  const duplicateField = (index: number) => {
    const field = fields[index]
    const clone: SchemaField = {
      ...structuredClone(field),
      id: undefined,
      name: getUniqueName(field.name + '_copy'),
      system: false,
    }
    const updated = [...fields]
    updated.splice(index + 1, 0, clone)
    onChange(updated)
  }

  const getUniqueName = (baseName: string): string => {
    const existingNames = fields.map((f) => f.name)
    let name = baseName
    let counter = 1
    while (existingNames.includes(name)) {
      name = `${baseName}${counter}`
      counter++
    }
    return name
  }

  const normalizeFieldName = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }

  const visibleFields = fields.filter((f) => !f._toDelete)

  return (
    <div className="space-y-4">
      {/* 字段列表 */}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id || `new-${index}`}
            className={`border rounded-lg ${field._toDelete ? 'opacity-50 bg-muted' : ''}`}
          >
            <Collapsible
              open={expandedField === (field.id || `new-${index}`)}
              onOpenChange={(open) => setExpandedField(open ? field.id || `new-${index}` : null)}
            >
              {/* 字段头部 */}
              <div className="flex items-center gap-2 p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />

                <Badge variant="outline" className="text-xs">
                  {field.type}
                </Badge>

                <Input
                  value={field.name}
                  onChange={(e) => updateField(index, { name: normalizeFieldName(e.target.value) })}
                  disabled={field.system || field._toDelete}
                  className="flex-1 h-8"
                  placeholder="Field name"
                />

                {field.required && (
                  <Badge variant="secondary" className="text-xs">
                    Required
                  </Badge>
                )}

                {field._toDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateField(index, { _toDelete: false })}
                  >
                    Restore
                  </Button>
                ) : (
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>

              {/* 字段选项 */}
              <CollapsibleContent>
                <div className="p-3 pt-0 border-t space-y-4">
                  {/* 字段类型选择 */}
                  {!field.system && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Type</label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(index, { type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* 字段选项 */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                      />
                      <span className="text-sm">Required</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.hidden || false}
                        onChange={(e) => updateField(index, { hidden: e.target.checked })}
                      />
                      <span className="text-sm">Hidden</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.presentable || false}
                        onChange={(e) => updateField(index, { presentable: e.target.checked })}
                        disabled={field.hidden}
                      />
                      <span className="text-sm">Presentable</span>
                    </label>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateField(index)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate
                    </Button>
                    {!field.system && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeField(index)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))}
      </div>

      {/* 添加字段按钮 */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => addField('text')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {/* 字段统计 */}
      <div className="text-sm text-muted-foreground">
        {visibleFields.length} field{visibleFields.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
