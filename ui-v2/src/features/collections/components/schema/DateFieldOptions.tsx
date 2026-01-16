// T011: Date 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface DateField {
  name: string
  type: 'date'
  min?: string
  max?: string
  [key: string]: unknown
}

interface DateFieldOptionsProps {
  field: DateField
  onChange: (field: DateField) => void
}

export function DateFieldOptions({ field, onChange }: DateFieldOptionsProps) {
  const handleChange = (key: keyof DateField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="date-min">Min date</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Minimum allowed date value. Leave empty for no restriction.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="date-min"
          type="datetime-local"
          value={field.min || ''}
          onChange={(e) => handleChange('min', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="date-max">Max date</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Maximum allowed date value. Leave empty for no restriction.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="date-max"
          type="datetime-local"
          value={field.max || ''}
          onChange={(e) => handleChange('max', e.target.value)}
        />
      </div>
    </div>
  )
}
