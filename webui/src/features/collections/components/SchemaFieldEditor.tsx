/**
 * SchemaFieldEditor - 单个字段编辑器
 * 支持展开/折叠、拖拽排序
 */
import { useRef, useEffect, useState, useCallback } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  GripVertical, Settings, RotateCcw, MoreHorizontal, Copy, Trash2,
  // 字段类型图标
  Type, FileText, Hash, ToggleLeft, Mail, Link, Calendar, CalendarCheck, ListChecks, 
  File, Link2, Code, MapPin, Lock, Key, HelpCircle
} from 'lucide-react'
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
import { SecretFieldOptions } from './schema/SecretFieldOptions'  // Phase 2: Secret 字段类型
import type { LucideIcon } from 'lucide-react'

// 字段类型图标映射
const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
  text: Type,
  editor: FileText,
  number: Hash,
  bool: ToggleLeft,
  email: Mail,
  url: Link,
  date: Calendar,
  autodate: CalendarCheck,
  select: ListChecks,
  file: File,
  relation: Link2,
  json: Code,
  geoPoint: MapPin,
  password: Lock,
  secret: Key,  // Phase 2: Secret 字段类型
}

// Required 标签的自定义文本
const REQUIRED_LABELS: Record<string, string> = {
  bool: 'Nonfalsey',
  number: 'Nonzero',
}

// Auth 集合中隐藏特定选项的字段列表（与 UI 版本保持一致）
const AUTH_HIDE_NONEMPTY_TOGGLE = ['password', 'tokenKey', 'id', 'autodate']
const AUTH_HIDE_HIDDEN_TOGGLE = ['password', 'tokenKey', 'id', 'email']
const AUTH_HIDE_PRESENTABLE_TOGGLE = ['password', 'tokenKey']

// Autodate 字段选项（与 UI 版本保持一致）
const AUTODATE_OPTIONS = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'create_update', label: 'Create/Update' },
]

// 获取 autodate 字段当前的选择值
function getAutodateValue(field: SchemaField): string {
  const onCreate = (field as any).onCreate ?? true
  const onUpdate = (field as any).onUpdate ?? false
  
  if (onCreate && onUpdate) {
    return 'create_update'
  }
  if (onUpdate) {
    return 'update'
  }
  return 'create'
}

// 处理 autodate 选择变更
function handleAutodateChange(
  value: string, 
  onUpdate: (updates: Partial<SchemaField>) => void,
  field: SchemaField
) {
  switch (value) {
    case 'create':
      onUpdate({ ...field, onCreate: true, onUpdate: false } as any)
      break
    case 'update':
      onUpdate({ ...field, onCreate: false, onUpdate: true } as any)
      break
    case 'create_update':
      onUpdate({ ...field, onCreate: true, onUpdate: true } as any)
      break
  }
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
  // 名称输入框引用
  const nameInputRef = useRef<HTMLInputElement>(null)
  
  // 本地名称状态 - 防止每次输入都触发父组件更新导致失焦
  const [localName, setLocalName] = useState(field.name)
  const originalNameRef = useRef(field.name)
  
  // 同步外部 field.name 变化到本地状态
  useEffect(() => {
    setLocalName(field.name)
    originalNameRef.current = field.name
  }, [field.name])
  
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
  const isAuthCollection = collectionType === 'auth'

  const requiredLabel = REQUIRED_LABELS[field.type] || 'Nonempty'
  const FieldIcon = FIELD_TYPE_ICONS[field.type] || HelpCircle

  // Auth 集合中的选项显示控制
  const showNonemptyToggle = !field.primaryKey && 
    field.type !== 'autodate' && 
    (!isAuthCollection || !AUTH_HIDE_NONEMPTY_TOGGLE.includes(field.name))
  const showHiddenToggle = !field.primaryKey && 
    (!isAuthCollection || !AUTH_HIDE_HIDDEN_TOGGLE.includes(field.name))
  const showPresentableToggle = !isAuthCollection || 
    !AUTH_HIDE_PRESENTABLE_TOGGLE.includes(field.name)

  // 规范化字段名
  const normalizeFieldName = useCallback((name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }, [])

  // 处理名称输入变更 - 只更新本地状态，不触发父组件更新
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = normalizeFieldName(e.target.value)
    setLocalName(newName)
  }, [normalizeFieldName])
  
  // 处理名称输入框失焦 - 此时才提交更新到父组件
  const handleNameBlur = useCallback(() => {
    if (localName !== field.name) {
      const oldName = originalNameRef.current
      onUpdate({ name: localName })
      // 只有名称确实变化了才触发重命名
      if (oldName !== localName && localName) {
        onRename(oldName, localName)
      }
      originalNameRef.current = localName
    }
  }, [localName, field.name, onUpdate, onRename])
  
  // 处理键盘事件 - 按 Enter 时提交
  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }, [])
  
  // 挂载时聚焦名称输入框
  useEffect(() => {
    if (field._focusNameOnMount && nameInputRef.current) {
      // 延迟执行以确保 DOM 已渲染
      requestAnimationFrame(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus()
          nameInputRef.current.select()
        }
      })
      // 清除标记
      onUpdate({ _focusNameOnMount: false })
    }
  }, [field._focusNameOnMount, onUpdate])

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
            <FieldIcon className="h-4 w-4" aria-hidden="true" />
          </div>

          {/* 字段名输入 - 带浮动标签 */}
          <div className="relative flex-1 group">
            {/* 浮动标签 - 绝对定位在输入框右上角，tag 样式 */}
            {/* 类型信息已通过左侧图标显示，这里只显示状态标签 */}
            <div className="absolute right-1 -top-2 z-10 flex items-center gap-0.5 transition-opacity group-focus-within:opacity-30">
              {field.required && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                  {requiredLabel}
                </span>
              )}
              {field.hidden && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-500">
                  Hidden
                </span>
              )}
            </div>
            <Input
              ref={nameInputRef}
              value={localName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              disabled={!isInteractive || isSystem}
              className="h-8"
              placeholder="Field name"
              aria-label="Field name"
            />
          </div>

          {/* Autodate 字段的选择器 - 显示在字段行中 */}
          {field.type === 'autodate' && isInteractive && (
            <Select
              value={getAutodateValue(field)}
              onValueChange={(value) => handleAutodateChange(value, onUpdate, field)}
              disabled={isSystem}
            >
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTODATE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
          <div className="p-3 border-t space-y-4 mt-1">
            {/* 字段特定选项 - 根据类型渲染 */}
            <FieldTypeOptions field={field} onUpdate={onUpdate} />

            {/* 通用选项 - 根据 Auth 集合规则显示 */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Required/Nonempty 选项 */}
              {showNonemptyToggle && (
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
              {showHiddenToggle && (
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
              )}

              {/* Presentable 选项 */}
              {showPresentableToggle && (
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
              )}
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
    case 'secret':
      return <SecretFieldOptions field={field as any} onChange={handleChange} />  // Phase 2
    default:
      return null
  }
}

export default SchemaFieldEditor
