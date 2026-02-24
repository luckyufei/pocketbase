/**
 * Secret 字段选项组件
 * Phase 2: Secret 字段类型支持
 */
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const handleChange = (key: keyof SecretField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="secret-max-size">{t('collections.maxSize')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.secretMaxSizeTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="secret-max-size"
          type="number"
          min={1}
          placeholder={t('collections.defaultTo4KB')}
          value={field.maxSize || ''}
          onChange={(e) => handleChange('maxSize', parseInt(e.target.value, 10) || 4096)}
        />
        <p className="text-xs text-muted-foreground">
          {t('collections.secretEncryptionNote')}
        </p>
      </div>

      <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
        <p className="text-sm text-amber-800" dangerouslySetInnerHTML={{ __html: t('collections.secretWarning') }} />
      </div>
    </div>
  )
}
