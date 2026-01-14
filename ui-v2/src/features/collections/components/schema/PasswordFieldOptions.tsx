// T016: Password 字段选项组件
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface PasswordField {
  name: string
  type: 'password'
  min?: number
  max?: number
  pattern?: string
  [key: string]: unknown
}

interface PasswordFieldOptionsProps {
  field: PasswordField
  onChange: (field: PasswordField) => void
}

export function PasswordFieldOptions({ field, onChange }: PasswordFieldOptionsProps) {
  const handleChange = (key: keyof PasswordField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="password-min">Min length</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimum password length. Default is 8.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="password-min"
            type="number"
            min={1}
            placeholder="Default: 8"
            value={field.min || ''}
            onChange={(e) => handleChange('min', parseInt(e.target.value, 10) || 8)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="password-max">Max length</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum password length. Default is 72 (bcrypt limit).</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="password-max"
            type="number"
            min={field.min || 8}
            placeholder="Default: 72"
            value={field.max || ''}
            onChange={(e) => handleChange('max', parseInt(e.target.value, 10) || 72)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-pattern">Validation pattern</Label>
        <Input
          id="password-pattern"
          type="text"
          placeholder="e.g. ^(?=.*[A-Z])(?=.*[0-9]).+$"
          value={field.pattern || ''}
          onChange={(e) => handleChange('pattern', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Optional regex pattern for password validation.
        </p>
      </div>
    </div>
  )
}
