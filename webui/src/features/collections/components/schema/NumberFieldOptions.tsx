// T006: Number 字段选项组件
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const handleChange = (key: keyof NumberField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number-min">{t('collections.min')}</Label>
          <Input
            id="number-min"
            type="number"
            placeholder={t('collections.noMinLimit')}
            value={field.min ?? ''}
            onChange={(e) =>
              handleChange('min', e.target.value ? parseFloat(e.target.value) : undefined)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="number-max">{t('collections.max')}</Label>
          <Input
            id="number-max"
            type="number"
            min={field.min}
            placeholder={t('collections.noMaxLimit')}
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
            {t('collections.noDecimals')}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.noDecimalsTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
