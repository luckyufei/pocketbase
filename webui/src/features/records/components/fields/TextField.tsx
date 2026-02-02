/**
 * TextField - 文本字段组件
 * 用于编辑 text 类型的记录字段
 */
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface TextFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: {
      autogeneratePattern?: string
    }
  }
  value: string
  onChange: (value: string) => void
  isNew?: boolean
}

export function TextField({ field, value, onChange, isNew = false }: TextFieldProps) {
  const hasAutogenerate = !!field.options?.autogeneratePattern && isNew
  const isRequired = field.required && !hasAutogenerate

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{field.name}</Label>
      <Textarea
        id={field.name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={isRequired}
        placeholder={hasAutogenerate ? 'Leave empty to autogenerate...' : ''}
        className="min-h-[80px]"
      />
    </div>
  )
}
