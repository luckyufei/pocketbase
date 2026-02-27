// T011: Date 字段选项组件
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Info, X } from 'lucide-react'

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
  const { t } = useTranslation()
  const handleChange = (key: keyof DateField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  const handleClear = (key: 'min' | 'max') => {
    onChange({ ...field, [key]: '' })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="date-min">{t('collections.minDate')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.minDateTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Input
            id="date-min"
            type="datetime-local"
            value={field.min || ''}
            onChange={(e) => handleChange('min', e.target.value)}
            className="pr-8"
          />
          {field.min && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleClear('min')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('common.clear')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="date-max">{t('collections.maxDate')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.maxDateTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Input
            id="date-max"
            type="datetime-local"
            value={field.max || ''}
            onChange={(e) => handleChange('max', e.target.value)}
            className="pr-8"
          />
          {field.max && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleClear('max')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('common.clear')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  )
}
