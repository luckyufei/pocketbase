/**
 * NumberField - 数字字段组件
 * 用于编辑 number 类型的记录字段
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NumberFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: {
      min?: number
      max?: number
    }
  }
  value: number
  onChange: (value: number) => void
}

export function NumberField({ field, value, onChange }: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{field.name}</Label>
      <Input
        id={field.name}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        required={field.required}
        min={field.options?.min}
        max={field.options?.max}
        step="any"
      />
    </div>
  )
}
