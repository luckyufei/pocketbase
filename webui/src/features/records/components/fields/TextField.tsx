/**
 * TextField - 文本字段组件
 * 用于编辑 text 类型的记录字段
 */
import { useMemo } from 'react'
import { AutoExpandTextarea } from '@/components/base/AutoExpandTextarea'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import type { CollectionField, RecordModel } from 'pocketbase'

interface TextFieldProps {
  field: CollectionField
  original?: RecordModel
  value: string
  onChange: (value: string) => void
}

export function TextField({ field, original, value, onChange }: TextFieldProps) {
  const uniqueId = `field_${field.name}`

  const hasAutogenerate = useMemo(() => {
    return !!field.autogeneratePattern && !original?.id
  }, [field.autogeneratePattern, original?.id])

  const isRequired = field.required && !hasAutogenerate

  return (
    <FormField name={field.name} className={isRequired ? 'required' : ''}>
      <FieldLabel field={field} htmlFor={uniqueId} />
      <AutoExpandTextarea
        id={uniqueId}
        required={isRequired}
        placeholder={hasAutogenerate ? 'Leave empty to autogenerate...' : ''}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  )
}
