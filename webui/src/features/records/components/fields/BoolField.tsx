/**
 * BoolField - 布尔字段组件
 * 用于编辑 bool 类型的记录字段
 * 使用 Switch（toggle 开关）样式，与旧版 UI 保持一致
 */
import { useId } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/ui/FormField'
import { ToggleLeft } from 'lucide-react'

interface BoolFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: Record<string, unknown>
  }
  value: boolean
  onChange: (value: boolean) => void
}

export function BoolField({ field, value, onChange }: BoolFieldProps) {
  const uniqueId = useId()
  const inputId = `bool-${field.name}-${uniqueId}`

  return (
    <FormField name={field.name} className="form-field-toggle flex items-center space-x-2 py-2">
      <Switch
        id={inputId}
        checked={value}
        onCheckedChange={(checked) => onChange(checked === true)}
        aria-label={field.name}
      />
      <Label htmlFor={inputId} className="cursor-pointer font-normal flex items-center gap-1.5">
        <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
        {field.name}
      </Label>
    </FormField>
  )
}
