/**
 * CollectionFieldsTab - Collection 字段编辑 Tab
 * 用于管理 Collection 的字段定义，支持拖拽排序
 */
import { useState, useCallback } from 'react'
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
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  // 字段类型图标
  Type, FileText, Hash, ToggleLeft, Mail, Link, Calendar, CalendarCheck, ListChecks, 
  File, Link2, Code, MapPin, Key,
  type LucideIcon
} from 'lucide-react'
import { SchemaFieldEditor } from './SchemaFieldEditor'
import { IndexesList } from './IndexesList'
import { updateIndexFieldName } from '../utils/indexRename'  // Phase 5: 索引重命名工具

// 字段类型定义（与 UI 版本保持一致，不包含 Password）
export const FIELD_TYPES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'text', label: 'Plain text', icon: Type },
  { value: 'editor', label: 'Rich editor', icon: FileText },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'bool', label: 'Bool', icon: ToggleLeft },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'url', label: 'URL', icon: Link },
  { value: 'date', label: 'Datetime', icon: Calendar },
  { value: 'autodate', label: 'Autodate', icon: CalendarCheck },
  { value: 'select', label: 'Select', icon: ListChecks },
  { value: 'file', label: 'File', icon: File },
  { value: 'relation', label: 'Relation', icon: Link2 },
  { value: 'json', label: 'JSON', icon: Code },
  { value: 'geoPoint', label: 'Geo Point', icon: MapPin },
  { value: 'secret', label: 'Secret', icon: Key },
]

export interface SchemaField {
  id?: string
  name: string
  type: string
  required?: boolean
  hidden?: boolean
  presentable?: boolean
  system?: boolean
  options?: Record<string, unknown>
  _toDelete?: boolean
  _originalName?: string
  _focusNameOnMount?: boolean  // 新增：挂载时聚焦名称输入框
  // 类型特定选项
  min?: number
  max?: number
  pattern?: string
  autogeneratePattern?: string
}

export interface CollectionData {
  id?: string
  name: string
  type: 'base' | 'auth' | 'view'
  fields: SchemaField[]
  indexes: string[]
}

interface CollectionFieldsTabProps {
  collection: CollectionData
  onChange: (collection: CollectionData) => void
}

/**
 * Collection 字段编辑 Tab
 */
export function CollectionFieldsTab({ collection, onChange }: CollectionFieldsTabProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null)

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 获取唯一字段名
  const getUniqueName = useCallback(
    (baseName: string = 'field'): string => {
      const existingNames = collection.fields.map((f) => f.name.toLowerCase())
      let name = baseName
      let counter = 2

      // 提取数字后缀
      const suffix = baseName.match(/\d+$/)?.[0] || ''
      const base = suffix ? baseName.substring(0, baseName.length - suffix.length) : baseName

      while (existingNames.includes(name.toLowerCase())) {
        name = `${base}${(parseInt(suffix) || 0) + counter}`
        counter++
      }

      return name
    },
    [collection.fields]
  )

  // 添加新字段
  const addField = useCallback(
    (type: string = 'text') => {
      const newField: SchemaField = {
        name: getUniqueName('field'),
        type,
        required: false,
        options: {},
        _focusNameOnMount: true, // 标记需要聚焦名称输入框
      }

      // 如果有 autodate 字段，在其前面插入
      const autodateIndex = collection.fields.findLastIndex((f) => f.type !== 'autodate')
      const newFields = [...collection.fields]

      if (type !== 'autodate' && autodateIndex >= 0) {
        newFields.splice(autodateIndex + 1, 0, newField)
      } else {
        newFields.push(newField)
      }

      onChange({ ...collection, fields: newFields })
      // 不自动展开选项面板，让用户先输入名称
      // setExpandedField(newField.name) // 移除自动展开
    },
    [collection, onChange, getUniqueName]
  )

  // 更新字段
  const updateField = useCallback(
    (index: number, updates: Partial<SchemaField>) => {
      const newFields = [...collection.fields]
      newFields[index] = { ...newFields[index], ...updates }
      onChange({ ...collection, fields: newFields })
    },
    [collection, onChange]
  )

  // 删除字段
  const removeField = useCallback(
    (index: number) => {
      const field = collection.fields[index]
      if (field.id) {
        // 已保存的字段标记为删除
        updateField(index, { _toDelete: true })
      } else {
        // 新字段直接移除
        const newFields = collection.fields.filter((_, i) => i !== index)
        onChange({ ...collection, fields: newFields })
      }
    },
    [collection, onChange, updateField]
  )

  // 恢复字段
  const restoreField = useCallback(
    (index: number) => {
      updateField(index, { _toDelete: false })
    },
    [updateField]
  )

  // 复制字段
  const duplicateField = useCallback(
    (index: number) => {
      const field = collection.fields[index]
      const clone: SchemaField = {
        ...structuredClone(field),
        id: undefined,
        name: getUniqueName(field.name + '_copy'),
        system: false,
      }

      const newFields = [...collection.fields]
      newFields.splice(index + 1, 0, clone)
      onChange({ ...collection, fields: newFields })
    },
    [collection, onChange, getUniqueName]
  )

  // 处理拖拽结束
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = collection.fields.findIndex((f) => (f.id || f.name) === active.id)
        const newIndex = collection.fields.findIndex((f) => (f.id || f.name) === over.id)

        const newFields = arrayMove(collection.fields, oldIndex, newIndex)
        onChange({ ...collection, fields: newFields })
      }
    },
    [collection, onChange]
  )

  // 处理字段名重命名
  const handleFieldRename = useCallback(
    (index: number, oldName: string, newName: string) => {
      // 更新索引中的字段名（使用 Phase 5 工具函数）
      if (oldName !== newName && newName) {
        const newIndexes = updateIndexFieldName(collection.indexes, oldName, newName)
        onChange({
          ...collection,
          fields: collection.fields.map((f, i) => (i === index ? { ...f, name: newName } : f)),
          indexes: newIndexes,
        })
      }
    },
    [collection, onChange]
  )

  // 更新索引
  const handleIndexesChange = useCallback(
    (indexes: string[]) => {
      onChange({ ...collection, indexes })
    },
    [collection, onChange]
  )

  // 可见字段（未删除的）
  const visibleFields = collection.fields.filter((f) => !f._toDelete)

  // 获取字段 ID（用于排序）
  const getFieldId = (field: SchemaField) => field.id || field.name

  return (
    <div className="space-y-6">
      {/* 字段列表 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={collection.fields.map(getFieldId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {collection.fields.map((field, index) => (
              <SchemaFieldEditor
                key={getFieldId(field)}
                field={field}
                index={index}
                collectionType={collection.type}
                isExpanded={expandedField === getFieldId(field)}
                onToggle={() =>
                  setExpandedField(expandedField === getFieldId(field) ? null : getFieldId(field))
                }
                onUpdate={(updates) => updateField(index, updates)}
                onRemove={() => removeField(index)}
                onRestore={() => restoreField(index)}
                onDuplicate={() => duplicateField(index)}
                onRename={(oldName, newName) => handleFieldRename(index, oldName, newName)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 新增字段按钮 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="w-full" aria-label="New field">
            <Plus className="h-4 w-4 mr-2" />
            New field
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full grid grid-cols-4 gap-1 p-2">
          {FIELD_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <DropdownMenuItem
                key={type.value}
                onClick={() => addField(type.value)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{type.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 分隔线 */}
      <hr className="border-border" />

      {/* 索引管理 */}
      <IndexesList
        collection={collection}
        indexes={collection.indexes}
        onChange={handleIndexesChange}
      />
    </div>
  )
}

export default CollectionFieldsTab
