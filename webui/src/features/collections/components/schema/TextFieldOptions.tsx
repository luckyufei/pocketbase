// T005: Text 字段选项组件
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const handleChange = (key: keyof TextField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
<Label htmlFor="text-min">{t('collections.minLength')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.minLengthTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="text-min"
          type="number"
          min={0}
          placeholder={t('collections.noMinLimit')}
          value={field.min || ''}
          onChange={(e) => handleChange('min', parseInt(e.target.value, 10) || 0)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
<Label htmlFor="text-max">{t('collections.maxLength')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.maxLengthTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="text-max"
          type="number"
          min={field.min || 0}
          placeholder={t('collections.defaultMax5000Chars')}
          value={field.max || ''}
          onChange={(e) => handleChange('max', parseInt(e.target.value, 10) || 0)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
<Label htmlFor="text-pattern">{t('collections.validationPattern')}</Label>
          {field.primaryKey && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('collections.validationPatternTooltip')}</p>
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
<Label htmlFor="text-autogenerate">{t('collections.autogeneratePattern')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.autogeneratePatternTooltip')}</p>
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
