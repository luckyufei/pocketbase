// T016: Password 字段选项组件
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const handleChange = (key: keyof PasswordField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="password-min">{t('collections.minLength')}</Label>
        <Input
          id="password-min"
          type="number"
          min={0}
          placeholder={t('collections.noMinLimit')}
          value={field.min || ''}
          onChange={(e) => handleChange('min', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-max">{t('collections.maxLength')}</Label>
        <Input
          id="password-max"
          type="number"
          min={field.min || 0}
          max={72}
          placeholder={t('collections.upTo72Chars')}
          value={field.max || ''}
          onChange={(e) => handleChange('max', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-cost">{t('collections.bcryptCost')}</Label>
        <Input
          id="password-cost"
          type="number"
          min={6}
          max={31}
          placeholder={t('collections.defaultTo10')}
          value={field.cost || ''}
          onChange={(e) => handleChange('cost', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-pattern">{t('collections.validationPattern')}</Label>
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
