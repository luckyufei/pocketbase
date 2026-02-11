import type { CollectionField } from 'pocketbase'
import { SecretInput } from '@/components/base/SecretInput'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'

interface SecretFieldProps {
  field: CollectionField
  value: string
  onChange: (value: string) => void
}

export function SecretField({ field, value, onChange }: SecretFieldProps) {
  const uniqueId = `field_${field.name}`

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <FieldLabel field={field} htmlFor={uniqueId} />
      <SecretInput
        id={uniqueId}
        required={field.required}
        value={value || ''}
        onChange={onChange}
      />
    </FormField>
  )
}
