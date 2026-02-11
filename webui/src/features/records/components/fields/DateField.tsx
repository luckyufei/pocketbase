/**
 * DateField - 日期字段组件
 * 用于编辑 date 类型的记录字段
 * 使用自定义的 DateTimePicker 组件，与 UI 版本的 Flatpickr 风格保持一致
 *
 * 特性：
 * 1. 不显示日历图标（由 DateTimePicker 内部处理）
 * 2. 点击输入框打开日期选择面板
 * 3. 支持秒级精度
 * 4. 24 小时制
 */
import { useCallback } from 'react'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import type { CollectionField } from 'pocketbase'

interface DateFieldProps {
  field: CollectionField
  value: string
  onChange: (value: string) => void
}

export function DateField({ field, value, onChange }: DateFieldProps) {
  const uniqueId = `field_${field.name}`

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue)
    },
    [onChange]
  )

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <FieldLabel field={field} htmlFor={uniqueId} />
      <DateTimePicker
        id={uniqueId}
        value={value}
        onChange={handleChange}
        required={field.required}
        placeholder="年 /月/日 -:-:-"
      />
    </FormField>
  )
}
