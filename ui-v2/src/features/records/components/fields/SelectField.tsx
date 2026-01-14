/**
 * SelectField - 选择字段组件
 * 用于编辑 select 类型的记录字段
 */
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SelectFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: {
      values?: string[]
    }
  }
  value: string
  onChange: (value: string) => void
}

export function SelectField({ field, value, onChange }: SelectFieldProps) {
  const options = field.options?.values || []

  return (
    <div className="space-y-2">
      <Label>{field.name}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${field.name}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
