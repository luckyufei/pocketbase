// T061: Record 创建/编辑面板
import { useState, useEffect, useCallback } from 'react'
import type { RecordModel, CollectionField, CollectionModel } from 'pocketbase'
import { OverlayPanel } from '@/components/OverlayPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff } from 'lucide-react'
import { FileField } from './fields/FileField'
import { AuthFields } from './fields/AuthFields'

interface UpsertPanelProps {
  open: boolean
  onClose: () => void
  record?: RecordModel | null
  fields: CollectionField[]
  collection?: CollectionModel | null
  onSave: (data: Record<string, unknown>, files?: Record<string, File[]>) => Promise<void>
}

// 基础跳过的字段
const BASE_SKIP_FIELD_NAMES = ['id', 'created', 'updated', 'collectionId', 'collectionName']

// Auth collection 额外跳过的字段（由 AuthFields 组件单独处理）
const AUTH_SKIP_FIELD_NAMES = [
  ...BASE_SKIP_FIELD_NAMES,
  'email',
  'emailVisibility',
  'verified',
  'tokenKey',
  'password',
]

/**
 * Record 创建/编辑面板
 */
export function UpsertPanel({
  open,
  onClose,
  record,
  fields,
  collection,
  onSave,
}: UpsertPanelProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [newFiles, setNewFiles] = useState<Record<string, File[]>>({})
  const [saving, setSaving] = useState(false)

  const isEdit = !!record?.id
  const isAuthCollection = collection?.type === 'auth'

  // 根据 collection 类型选择要跳过的字段
  const skipFieldNames = isAuthCollection ? AUTH_SKIP_FIELD_NAMES : BASE_SKIP_FIELD_NAMES

  // 过滤掉不可编辑的字段
  const editableFields = fields.filter(
    (f) => !skipFieldNames.includes(f.name) && f.type !== 'autodate'
  )

  // 初始化表单数据
  useEffect(() => {
    if (!open) return

    if (record) {
      setFormData({ ...record })
    } else {
      // 初始化默认值
      const defaults: Record<string, unknown> = {}

      // Auth collection 默认值
      if (isAuthCollection) {
        defaults.email = ''
        defaults.emailVisibility = false
        defaults.verified = false
        defaults.password = ''
        defaults.passwordConfirm = ''
      }

      editableFields.forEach((field) => {
        switch (field.type) {
          case 'bool':
            defaults[field.name] = false
            break
          case 'number':
            defaults[field.name] = 0
            break
          case 'json':
            defaults[field.name] = {}
            break
          case 'select':
            defaults[field.name] = field.maxSelect === 1 ? '' : []
            break
          case 'relation':
            defaults[field.name] = field.maxSelect === 1 ? '' : []
            break
          case 'file':
            defaults[field.name] = []
            break
          default:
            defaults[field.name] = ''
        }
      })
      setFormData(defaults)
    }
    // 重置新文件
    setNewFiles({})
  }, [record, fields, open, isAuthCollection])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData, newFiles)
      onClose()
    } catch (error) {
      console.error('Save record failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  // 处理文件字段变更
  const handleFileChange = useCallback(
    (fieldName: string, existingFiles: string[], uploadedFiles: File[]) => {
      setFormData((prev) => ({ ...prev, [fieldName]: existingFiles }))
      setNewFiles((prev) => ({ ...prev, [fieldName]: uploadedFiles }))
    },
    []
  )

  const renderField = (field: CollectionField) => {
    const value = formData[field.name]

    switch (field.type) {
      case 'bool':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.name}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
            />
            <Label htmlFor={field.name}>{field.name}</Label>
          </div>
        )

      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={(value as number) || 0}
            onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value) || 0)}
          />
        )

      case 'date':
        return (
          <Input
            id={field.name}
            type="datetime-local"
            value={value ? new Date(value as string).toISOString().slice(0, 16) : ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )

      case 'json':
        return (
          <textarea
            id={field.name}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                handleFieldChange(field.name, JSON.parse(e.target.value))
              } catch {
                handleFieldChange(field.name, e.target.value)
              }
            }}
          />
        )

      case 'editor':
        return (
          <textarea
            id={field.name}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )

      case 'url':
        return (
          <Input
            id={field.name}
            type="url"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder="https://..."
          />
        )

      case 'email':
        return (
          <Input
            id={field.name}
            type="email"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder="email@example.com"
          />
        )

      case 'file':
        return (
          <FileField
            field={{
              name: field.name,
              type: field.type,
              required: field.required,
              options: {
                maxSelect: field.maxSelect,
                maxSize: field.maxSize,
                mimeTypes: field.mimeTypes,
                thumbs: field.thumbs,
                protected: field.protected,
              },
            }}
            value={Array.isArray(value) ? value : value ? [value as string] : []}
            newFiles={newFiles[field.name] || []}
            onChange={(files, uploaded) => handleFileChange(field.name, files, uploaded || [])}
            record={record || undefined}
          />
        )

      case 'password':
        // 普通 password 字段（非 auth collection 的 password）
        return (
          <PasswordInput
            id={field.name}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      default:
        return (
          <Input
            id={field.name}
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
    }
  }

  return (
    <OverlayPanel open={open} onClose={onClose} title={isEdit ? '编辑记录' : '新建记录'} width="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 编辑模式显示只读的 ID 字段 */}
        {isEdit && record?.id && (
          <div className="space-y-2">
            <Label htmlFor="id" className="text-muted-foreground">
              id
            </Label>
            <Input id="id" value={record.id} disabled className="font-mono text-sm bg-muted" />
          </div>
        )}

        {/* Auth Collection 专用字段 */}
        {isAuthCollection && collection && (
          <>
            <AuthFields
              record={formData}
              onChange={handleFieldChange}
              collection={collection}
              isNew={!isEdit}
            />
            {editableFields.length > 0 && <hr className="my-4" />}
          </>
        )}

        {/* 普通字段 */}
        {editableFields.length === 0 && !isAuthCollection ? (
          <div className="text-muted-foreground text-center py-4">没有可编辑的字段</div>
        ) : (
          editableFields.map((field) => (
            <div key={field.name} className="space-y-2">
              {field.type !== 'bool' && field.type !== 'file' && (
                <Label htmlFor={field.name}>
                  {field.name}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              )}
              {renderField(field)}
            </div>
          ))
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中...' : isEdit ? '保存' : '创建'}
          </Button>
        </div>
      </form>
    </OverlayPanel>
  )
}

/**
 * 密码输入组件（带显示/隐藏切换）
 */
function PasswordInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
        onClick={() => setShow(!show)}
      >
        {show ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  )
}

export default UpsertPanel
