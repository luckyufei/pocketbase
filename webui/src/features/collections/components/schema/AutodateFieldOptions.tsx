// T017: Autodate 字段选项组件
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface AutodateField {
  name: string
  type: 'autodate'
  onCreate?: boolean
  onUpdate?: boolean
  [key: string]: unknown
}

interface AutodateFieldOptionsProps {
  field: AutodateField
  onChange: (field: AutodateField) => void
}

export function AutodateFieldOptions({ field, onChange }: AutodateFieldOptionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="autodate-oncreate"
          checked={field.onCreate ?? true}
          onCheckedChange={(checked) => onChange({ ...field, onCreate: !!checked })}
        />
        <div className="flex items-center gap-1">
          <Label htmlFor="autodate-oncreate" className="cursor-pointer">
            On create
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Automatically set the current datetime when a record is created.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="autodate-onupdate"
          checked={field.onUpdate ?? false}
          onCheckedChange={(checked) => onChange({ ...field, onUpdate: !!checked })}
        />
        <div className="flex items-center gap-1">
          <Label htmlFor="autodate-onupdate" className="cursor-pointer">
            On update
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Automatically set the current datetime when a record is updated.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
