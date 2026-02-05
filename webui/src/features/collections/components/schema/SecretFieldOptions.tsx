/**
 * Secret 字段选项组件
 * Phase 2: Secret 字段类型支持
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface SecretField {
  name: string
  type: 'secret'
  maxSize?: number
  [key: string]: unknown
}

interface SecretFieldOptionsProps {
  field: SecretField
  onChange: (field: SecretField) => void
}

export function SecretFieldOptions({ field, onChange }: SecretFieldOptionsProps) {
  const handleChange = (key: keyof SecretField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="secret-max-size">Max size</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Maximum size of the secret value in bytes.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="secret-max-size"
          type="number"
          min={1}
          placeholder="Default to ~4KB"
          value={field.maxSize || ''}
          onChange={(e) => handleChange('maxSize', parseInt(e.target.value, 10) || 4096)}
        />
        <p className="text-xs text-muted-foreground">
          Default to ~4KB (4096 bytes). The value is encrypted and stored securely.
        </p>
      </div>

      <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Secret field values are encrypted at rest and cannot be retrieved 
          after being set. They can only be overwritten.
        </p>
      </div>
    </div>
  )
}
