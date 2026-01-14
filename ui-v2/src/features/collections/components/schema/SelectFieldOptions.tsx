// T012: Select 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus } from 'lucide-react'
import { useState } from 'react'

export interface SelectField {
  name: string
  type: 'select'
  values?: string[]
  maxSelect?: number
  [key: string]: unknown
}

interface SelectFieldOptionsProps {
  field: SelectField
  onChange: (field: SelectField) => void
}

export function SelectFieldOptions({ field, onChange }: SelectFieldOptionsProps) {
  const [newValue, setNewValue] = useState('')
  const isSingle = (field.maxSelect || 1) <= 1

  const handleAddValue = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return

    const current = field.values || []
    if (!current.includes(trimmed)) {
      onChange({ ...field, values: [...current, trimmed] })
    }
    setNewValue('')
  }

  const handleRemoveValue = (value: string) => {
    const current = field.values || []
    onChange({ ...field, values: current.filter((v) => v !== value) })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddValue()
    }
  }

  const handleSingleMultipleChange = (value: string) => {
    if (value === 'single') {
      onChange({ ...field, maxSelect: 1 })
    } else {
      onChange({ ...field, maxSelect: field.values?.length || 2 })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Add choices *</Label>
        <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
          {(field.values || []).map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {value}
              <button
                type="button"
                onClick={() => handleRemoveValue(value)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {(field.values || []).length === 0 && (
            <span className="text-muted-foreground text-sm">Add choices *</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter a choice"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button type="button" size="icon" variant="outline" onClick={handleAddValue}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Selection type</Label>
        <Select value={isSingle ? 'single' : 'multiple'} onValueChange={handleSingleMultipleChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single</SelectItem>
            <SelectItem value="multiple">Multiple</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isSingle && (
        <div className="space-y-2">
          <Label htmlFor="select-maxselect">Max select</Label>
          <Input
            id="select-maxselect"
            type="number"
            min={2}
            max={field.values?.length || 999}
            placeholder="Default to single"
            value={field.maxSelect || ''}
            onChange={(e) => onChange({ ...field, maxSelect: parseInt(e.target.value, 10) || 2 })}
          />
        </div>
      )}
    </div>
  )
}
