import type { CollectionField } from 'pocketbase'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'

interface EmailFieldProps {
  field: CollectionField
  value: string
  onChange: (value: string) => void
}

export function EmailField({ field, value, onChange }: EmailFieldProps) {
  const uniqueId = `field_${field.name}`

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <FieldLabel field={field} htmlFor={uniqueId} />
      <Input
        id={uniqueId}
        type="email"
        required={field.required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="email@example.com"
      />
    </FormField>
  )
}
