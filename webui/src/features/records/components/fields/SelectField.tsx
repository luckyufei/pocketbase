/**
 * SelectField - 选择字段组件
 * 用于编辑 select 类型的记录字段
 * 支持单选和多选模式，支持 toggle 取消选择
 */
import { useMemo, useEffect, useCallback } from 'react'
import { FieldLabel } from './FieldLabel'
import { FormField } from '@/components/ui/FormField'
import { MultiSelect } from '@/components/ui/multi-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CollectionField } from 'pocketbase'

interface SelectFieldProps {
  field: CollectionField
  value: string | string[]
  onChange: (value: string | string[]) => void
}

export function SelectField({ field, value, onChange }: SelectFieldProps) {
  const uniqueId = `field_${field.name}`
  const isMultiple = (field.maxSelect || 1) > 1
  const maxSelect = field.maxSelect || field.values?.length || 1

  // Filter out non-existent values and enforce maxSelect
  useEffect(() => {
    if (isMultiple && Array.isArray(value)) {
      const filtered = value.filter((v) => field.values?.includes(v))
      if (filtered.length !== value.length) {
        // Truncate if exceeds maxSelect
        const truncated =
          filtered.length > maxSelect ? filtered.slice(filtered.length - maxSelect) : filtered
        onChange(truncated)
      }
    }
  }, [value, field.values, isMultiple, maxSelect, onChange])

  const options = useMemo(() => {
    return (field.values || []).map((v) => ({ value: v, label: v }))
  }, [field.values])

  // Toggle handler for single select - allows clicking to unselect
  const handleSingleValueChange = useCallback((newValue: string) => {
    // If clicking the same value, toggle off (clear)
    if (newValue === value && !field.required) {
      onChange('')
    } else {
      onChange(newValue)
    }
  }, [value, field.required, onChange])

  // Clear single selection
  const handleClearSingle = useCallback(() => {
    onChange('')
  }, [onChange])

  if (isMultiple) {
    return (
      <FormField name={field.name} className={field.required ? 'required' : ''}>
        <FieldLabel field={field} htmlFor={uniqueId} />
        <div className="space-y-2">
          <MultiSelect
            options={options}
            selected={Array.isArray(value) ? value : []}
            onChange={(selected) => onChange(selected)}
            placeholder="- Select -"
          />
          <div className="text-xs text-muted-foreground">Select up to {maxSelect} items.</div>
        </div>
      </FormField>
    )
  }

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <FieldLabel field={field} htmlFor={uniqueId} />
      <div className="flex items-center gap-2">
        <Select value={value as string} onValueChange={handleSingleValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="- Select -" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Clear button for non-required fields */}
        {!field.required && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClearSingle}
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </FormField>
  )
}
