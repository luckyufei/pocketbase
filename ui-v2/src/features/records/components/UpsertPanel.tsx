// T061: Record 创建/编辑面板
import { useState, useEffect } from 'react'
import type { RecordModel, CollectionField } from 'pocketbase'
import { OverlayPanel } from '@/components/OverlayPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SecretInput } from '@/components/SecretInput'

interface UpsertPanelProps {
  open: boolean
  onClose: () => void
  record?: RecordModel | null
  fields: CollectionField[]
  onSave: (data: Record<string, unknown>) => Promise<void>
}

/**
 * Record 创建/编辑面板
 */
export function UpsertPanel({ open, onClose, record, fields, onSave }: UpsertPanelProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const isEdit = !!record?.id

  // 过滤掉系统字段和 autodate 字段
  const skipFieldNames = ['id', 'created', 'updated', 'collectionId', 'collectionName']
  const editableFields = fields.filter(
    (f) => !skipFieldNames.includes(f.name) && f.type !== 'autodate' && !f.system
  )

  useEffect(() => {
    if (record) {
      setFormData(record)
    } else {
      // 初始化默认值
      const defaults: Record<string, unknown> = {}
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
          case 'file':
            defaults[field.name] = field.maxSelect === 1 ? '' : []
            break
          default:
            defaults[field.name] = ''
        }
      })
      setFormData(defaults)
    }
  }, [record, fields, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Save record failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

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

      case 'secret':
        return (
          <SecretInput
            id={field.name}
            value={(value as string) || ''}
            onChange={(val) => handleFieldChange(field.name, val)}
            required={field.required}
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
        {editableFields.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">没有可编辑的字段</div>
        ) : (
          editableFields.map((field) => (
            <div key={field.name} className="space-y-2">
              {field.type !== 'bool' && (
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

export default UpsertPanel
