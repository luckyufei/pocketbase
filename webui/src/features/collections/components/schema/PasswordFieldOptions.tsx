// T016: Password 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface PasswordField {
  name: string
  type: 'password'
  min?: number
  max?: number
  cost?: number
  pattern?: string
  [key: string]: unknown
}

interface PasswordFieldOptionsProps {
  field: PasswordField
  onChange: (field: PasswordField) => void
}

export function PasswordFieldOptions({ field, onChange }: PasswordFieldOptionsProps) {
  const handleChange = (key: keyof PasswordField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="password-min">Min length</Label>
        <Input
          id="password-min"
          type="number"
          min={0}
          placeholder="No min limit"
          value={field.min || ''}
          onChange={(e) => handleChange('min', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-max">Max length</Label>
        <Input
          id="password-max"
          type="number"
          min={field.min || 0}
          max={72}
          placeholder="Up to 72 chars"
          value={field.max || ''}
          onChange={(e) => handleChange('max', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-cost">Bcrypt cost</Label>
        <Input
          id="password-cost"
          type="number"
          min={6}
          max={31}
          placeholder="Default to 10"
          value={field.cost || ''}
          onChange={(e) => handleChange('cost', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-pattern">Validation pattern</Label>
        <Input
          id="password-pattern"
          type="text"
          placeholder="ex. ^\w+$"
          value={field.pattern || ''}
          onChange={(e) => handleChange('pattern', e.target.value)}
        />
      </div>
    </div>
  )
}
