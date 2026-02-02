// T013: JSON 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface JsonField {
  name: string
  type: 'json'
  maxSize?: number
  [key: string]: unknown
}

interface JsonFieldOptionsProps {
  field: JsonField
  onChange: (field: JsonField) => void
}

export function JsonFieldOptions({ field, onChange }: JsonFieldOptionsProps) {
  const handleChange = (key: keyof JsonField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="json-maxsize">Max size</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Maximum JSON content size in bytes. Leave empty for default limit.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="json-maxsize"
          type="number"
          min={0}
          placeholder="Default limit (~2MB)"
          value={field.maxSize || ''}
          onChange={(e) => handleChange('maxSize', parseInt(e.target.value, 10) || 0)}
        />
        <p className="text-xs text-muted-foreground">Must be in bytes.</p>
      </div>
    </div>
  )
}
