/**
 * FieldEditor - 单字段编辑器
 * 用于编辑单个 Collection 字段的详细配置
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  { value: 'autodate', label: 'Autodate' },
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
}

interface FieldEditorProps {
  field: SchemaField
  onChange: (field: SchemaField) => void
}

export function FieldEditor({ field, onChange }: FieldEditorProps) {
  const updateField = (updates: Partial<SchemaField>) => {
    onChange({ ...field, ...updates })
  }

  const normalizeFieldName = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      {/* 字段名称和类型 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fieldName">Name</Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0">
              {field.type}
            </Badge>
            <Input
              id="fieldName"
              value={field.name}
              onChange={(e) => updateField({ name: normalizeFieldName(e.target.value) })}
              disabled={field.system}
              placeholder="Field name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={field.type}
            onValueChange={(value) => updateField({ type: value })}
            disabled={field.system}
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

      {/* 字段选项 */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="required"
            checked={field.required}
            onCheckedChange={(checked) => updateField({ required: checked === true })}
          />
          <Label htmlFor="required" className="text-sm font-normal">
            Required
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="hidden"
            checked={field.hidden || false}
            onCheckedChange={(checked) => updateField({ hidden: checked === true })}
          />
          <Label htmlFor="hidden" className="text-sm font-normal">
            Hidden
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="presentable"
            checked={field.presentable || false}
            onCheckedChange={(checked) => updateField({ presentable: checked === true })}
            disabled={field.hidden}
          />
          <Label htmlFor="presentable" className="text-sm font-normal">
            Presentable
          </Label>
        </div>
      </div>

      {/* 系统字段标识 */}
      {field.system && (
        <div className="text-sm text-muted-foreground">
          This is a system field and cannot be modified.
        </div>
      )}
    </div>
  )
}
