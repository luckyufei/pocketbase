/**
 * SchemaFieldEditor - 单个字段编辑器
 * 支持展开/折叠、拖拽排序
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GripVertical, Settings, RotateCcw, MoreHorizontal, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SchemaField } from './CollectionFieldsTab'

// 导入字段选项组件
import { TextFieldOptions } from './schema/TextFieldOptions'
import { NumberFieldOptions } from './schema/NumberFieldOptions'
import { BoolFieldOptions } from './schema/BoolFieldOptions'
import { EmailFieldOptions } from './schema/EmailFieldOptions'
import { UrlFieldOptions } from './schema/UrlFieldOptions'
import { EditorFieldOptions } from './schema/EditorFieldOptions'
import { DateFieldOptions } from './schema/DateFieldOptions'
import { SelectFieldOptions } from './schema/SelectFieldOptions'
import { JsonFieldOptions } from './schema/JsonFieldOptions'
import { FileFieldOptions } from './schema/FileFieldOptions'
import { RelationFieldOptions } from './schema/RelationFieldOptions'
import { PasswordFieldOptions } from './schema/PasswordFieldOptions'
import { AutodateFieldOptions } from './schema/AutodateFieldOptions'
import { GeoPointFieldOptions } from './schema/GeoPointFieldOptions'

// 字段类型图标映射
const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'ri-text',
  editor: 'ri-file-text-line',
  number: 'ri-hashtag',
  bool: 'ri-toggle-line',
  email: 'ri-mail-line',
  url: 'ri-link',
  date: 'ri-calendar-line',
  autodate: 'ri-calendar-check-line',
  select: 'ri-list-check',
  file: 'ri-file-line',
  relation: 'ri-link-m',
  json: 'ri-code-s-slash-line',
  geoPoint: 'ri-map-pin-line',
  password: 'ri-lock-line',
}

// Required 标签的自定义文本
const REQUIRED_LABELS: Record<string, string> = {
  bool: 'Nonfalsey',
  number: 'Nonzero',
}

interface SchemaFieldEditorProps {
  field: SchemaField
  index: number
  collectionType: 'base' | 'auth' | 'view'
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<SchemaField>) => void
  onRemove: () => void
  onRestore: () => void
  onDuplicate: () => void
  onRename: (oldName: string, newName: string) => void
}

/**
 * 单个字段编辑器组件
 */
export function SchemaFieldEditor({
  field,
  index,
  collectionType,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  onRestore,
  onDuplicate,
  onRename,
}: SchemaFieldEditorProps) {
  // 拖拽排序
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id || field.name,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isDeleted = field._toDelete
  const isSystem = field.system
  const isInteractive = !isDeleted

  const requiredLabel = REQUIRED_LABELS[field.type] || 'Nonempty'
  const fieldIcon = FIELD_TYPE_ICONS[field.type] || 'ri-question-line'

  // 规范化字段名
  const normalizeFieldName = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }

  // 处理名称变更
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldName = field.name
    const newName = normalizeFieldName(e.target.value)
    e.target.value = newName
    onUpdate({ name: newName })
    onRename(oldName, newName)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-lg transition-all',
        isDeleted && 'opacity-50 bg-muted',
        isDragging && 'opacity-50 shadow-lg',
        isExpanded && 'ring-2 ring-primary'
      )}
    >
      <Collapsible open={isExpanded && isInteractive} onOpenChange={onToggle}>
        {/* 字段头部 */}
        <div className="flex items-center gap-2 p-3">
          {/* 拖拽手柄 */}
          {isInteractive && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-move touch-none"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {/* 字段类型图标 */}
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded',
              isSystem ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
            )}
            title={`${field.type}${isSystem ? ' (system)' : ''}`}
          >
            <i className={fieldIcon} aria-hidden="true" />
          </div>

          {/* 字段名输入 */}
          <Input
            value={field.name}
            onChange={handleNameChange}
            disabled={!isInteractive || isSystem}
            className="flex-1 h-8"
            placeholder="Field name"
            aria-label="Field name"
          />

          {/* 标签 */}
          <div className="flex items-center gap-1">
            {field.required && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                {requiredLabel}
              </Badge>
            )}
            {field.hidden && (
              <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                Hidden
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {field.type}
            </Badge>
          </div>

          {/* 操作按钮 */}
          {isDeleted ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRestore}
              aria-label="Restore"
              className="text-green-600"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* 字段选项 */}
        <CollapsibleContent>
          <div className="p-3 pt-0 border-t space-y-4">
            {/* 字段特定选项 - 根据类型渲染 */}
            <FieldTypeOptions field={field} onUpdate={onUpdate} />

            {/* 通用选项 */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Required 选项 */}
              {field.type !== 'autodate' && !field.primaryKey && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required || false}
                    onChange={(e) => onUpdate({ required: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">{requiredLabel}</span>
                </label>
              )}

              {/* Hidden 选项 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.hidden || false}
                  onChange={(e) => {
                    onUpdate({
                      hidden: e.target.checked,
                      presentable: e.target.checked ? false : field.presentable,
                    })
                  }}
                  className="rounded"
                />
                <span className="text-sm">Hidden</span>
              </label>

              {/* Presentable 选项 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.presentable || false}
                  onChange={(e) => onUpdate({ presentable: e.target.checked })}
                  disabled={field.hidden}
                  className="rounded"
                />
                <span className={cn('text-sm', field.hidden && 'text-muted-foreground')}>
                  Presentable
                </span>
              </label>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  {!isSystem && (
                    <DropdownMenuItem onClick={onRemove} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * 字段类型特定选项
 */
function FieldTypeOptions({
  field,
  onUpdate,
}: {
  field: SchemaField
  onUpdate: (updates: Partial<SchemaField>) => void
}) {
  const handleChange = (updatedField: any) => {
    onUpdate(updatedField)
  }

  switch (field.type) {
    case 'text':
      return <TextFieldOptions field={field as any} onChange={handleChange} />
    case 'number':
      return <NumberFieldOptions field={field as any} onChange={handleChange} />
    case 'bool':
      return <BoolFieldOptions field={field as any} onChange={handleChange} />
    case 'email':
      return <EmailFieldOptions field={field as any} onChange={handleChange} />
    case 'url':
      return <UrlFieldOptions field={field as any} onChange={handleChange} />
    case 'editor':
      return <EditorFieldOptions field={field as any} onChange={handleChange} />
    case 'date':
      return <DateFieldOptions field={field as any} onChange={handleChange} />
    case 'select':
      return <SelectFieldOptions field={field as any} onChange={handleChange} />
    case 'json':
      return <JsonFieldOptions field={field as any} onChange={handleChange} />
    case 'file':
      return <FileFieldOptions field={field as any} onChange={handleChange} />
    case 'relation':
      return <RelationFieldOptions field={field as any} onChange={handleChange} collections={[]} />
    case 'password':
      return <PasswordFieldOptions field={field as any} onChange={handleChange} />
    case 'autodate':
      return <AutodateFieldOptions field={field as any} onChange={handleChange} />
    case 'geoPoint':
      return <GeoPointFieldOptions field={field as any} onChange={handleChange} />
    default:
      return null
  }
}

export default SchemaFieldEditor
