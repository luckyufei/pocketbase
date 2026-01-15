/**
 * SecretField - 记录编辑中的 Secret 字段组件
 *
 * 封装 SecretInput 组件用于记录编辑表单
 */
import { Label } from '@/components/ui/label'
import { SecretInput } from '@/components/SecretInput'

interface SecretFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    hidden?: boolean
    options?: {
      maxSize?: number
    }
  }
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function SecretField({
  field,
  value,
  onChange,
  disabled = false,
}: SecretFieldProps) {
  return (
    <div className="space-y-2" data-testid="secret-field">
      <Label htmlFor={field.name}>
        {field.name}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <SecretInput
        id={field.name}
        value={value}
        onChange={onChange}
        required={field.required}
        disabled={disabled}
      />
    </div>
  )
}
