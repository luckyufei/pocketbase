// T006: Number 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface NumberField {
  name: string
  type: 'number'
  min?: number
  max?: number
  onlyInt?: boolean
  [key: string]: unknown
}

interface NumberFieldOptionsProps {
  field: NumberField
  onChange: (field: NumberField) => void
}

export function NumberFieldOptions({ field, onChange }: NumberFieldOptionsProps) {
  const handleChange = (key: keyof NumberField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number-min">Min</Label>
          <Input
            id="number-min"
            type="number"
            placeholder="No min limit"
            value={field.min ?? ''}
            onChange={(e) =>
              handleChange('min', e.target.value ? parseFloat(e.target.value) : undefined)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="number-max">Max</Label>
          <Input
            id="number-max"
            type="number"
            min={field.min}
            placeholder="No max limit"
            value={field.max ?? ''}
            onChange={(e) =>
              handleChange('max', e.target.value ? parseFloat(e.target.value) : undefined)
            }
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="number-onlyint"
          checked={field.onlyInt || false}
          onCheckedChange={(checked) => handleChange('onlyInt', checked)}
        />
        <div className="flex items-center gap-1">
          <Label htmlFor="number-onlyint" className="cursor-pointer">
            No decimals
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Existing decimal numbers will not be affected.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
