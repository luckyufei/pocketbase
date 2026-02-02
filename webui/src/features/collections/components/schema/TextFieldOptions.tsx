// T005: Text 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface TextField {
  name: string
  type: 'text'
  min?: number
  max?: number
  pattern?: string
  autogeneratePattern?: string
  primaryKey?: boolean
  [key: string]: unknown
}

interface TextFieldOptionsProps {
  field: TextField
  onChange: (field: TextField) => void
}

export function TextFieldOptions({ field, onChange }: TextFieldOptionsProps) {
  const handleChange = (key: keyof TextField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="text-min">Min length</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear the field or set it to 0 for no limit.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="text-min"
          type="number"
          min={0}
          placeholder="No min limit"
          value={field.min || ''}
          onChange={(e) => handleChange('min', parseInt(e.target.value, 10) || 0)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="text-max">Max length</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear the field or set it to 0 to fallback to the default limit.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="text-max"
          type="number"
          min={field.min || 0}
          placeholder="Default to max 5000 characters"
          value={field.max || ''}
          onChange={(e) => handleChange('max', parseInt(e.target.value, 10) || 0)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="text-pattern">Validation pattern</Label>
          {field.primaryKey && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    All record ids have forbidden characters and unique case-insensitive (ASCII)
                    validations.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Input
          id="text-pattern"
          type="text"
          placeholder="^[a-z0-9]+$"
          value={field.pattern || ''}
          onChange={(e) => handleChange('pattern', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Ex. <code className="bg-muted px-1 rounded">{'^[a-z0-9]+$'}</code>
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="text-autogenerate">Autogenerate pattern</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Set and autogenerate text matching the pattern on missing record create value.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="text-autogenerate"
          type="text"
          placeholder="[a-z0-9]{30}"
          value={field.autogeneratePattern || ''}
          onChange={(e) => handleChange('autogeneratePattern', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Ex. <code className="bg-muted px-1 rounded">{'[a-z0-9]{30}'}</code>
        </p>
      </div>
    </div>
  )
}
