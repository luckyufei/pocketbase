/**
 * BoolField - 布尔字段组件
 * 用于编辑 bool 类型的记录字段
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={field.name}
        checked={value}
        onCheckedChange={(checked) => onChange(checked === true)}
        aria-label={field.name}
      />
      <Label htmlFor={field.name}>{field.name}</Label>
    </div>
  )
}
