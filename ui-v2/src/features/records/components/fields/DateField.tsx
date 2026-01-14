/**
 * DateField - 日期字段组件
 * 用于编辑 date 类型的记录字段
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DateFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: Record<string, unknown>
  }
  value: string
  onChange: (value: string) => void
}

export function DateField({ field, value, onChange }: DateFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{field.name}</Label>
      <Input
        id={field.name}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    </div>
  )
}
