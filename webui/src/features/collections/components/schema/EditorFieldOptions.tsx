// T010: Editor 字段选项组件
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface EditorField {
  name: string
  type: 'editor'
  maxSize?: number
  convertUrls?: boolean
  [key: string]: unknown
}

interface EditorFieldOptionsProps {
  field: EditorField
  onChange: (field: EditorField) => void
}

export function EditorFieldOptions({ field, onChange }: EditorFieldOptionsProps) {
  const { t } = useTranslation()
  const handleChange = (key: keyof EditorField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="editor-maxsize">{t('collections.maxSize')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.maxSizeTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id="editor-maxsize"
          type="number"
          min={0}
          placeholder={t('common.optional')}
          value={field.maxSize || ''}
          onChange={(e) => handleChange('maxSize', parseInt(e.target.value, 10) || 0)}
        />
        <p className="text-xs text-muted-foreground">{t('collections.mustBeInBytes')}</p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="editor-converturls"
          checked={field.convertUrls ?? true}
          onCheckedChange={(checked) => handleChange('convertUrls', checked)}
        />
        <div className="flex items-center gap-1">
          <Label htmlFor="editor-converturls" className="cursor-pointer">
            {t('collections.convertUrls')}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.convertUrlsTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
