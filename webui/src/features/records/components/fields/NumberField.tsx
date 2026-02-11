/**
 * NumberField - 数字字段组件
 * 用于编辑 number 类型的记录字段
 */
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import type { CollectionField } from 'pocketbase'

interface NumberFieldProps {
  field: CollectionField
  value: number | undefined
  onChange: (value: number | undefined) => void
}

export function NumberField({ field, value, onChange }: NumberFieldProps) {
  const uniqueId = `field_${field.name}`

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <FieldLabel field={field} htmlFor={uniqueId} />
      <Input
        id={uniqueId}
        type="number"
        required={field.required}
        min={field.min}
        max={field.max}
        step="any"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val === '' ? undefined : parseFloat(val))
        }}
      />
    </FormField>
  )
}
