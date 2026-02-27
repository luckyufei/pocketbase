// T013: JSON 字段选项组件
// Task 5: 添加字符串规范化说明面板
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export interface JsonField {
  name: string
  type: 'json'
  maxSize?: number
  [key: string]: unknown
}

interface JsonFieldOptionsProps {
  field: JsonField
  onChange: (field: JsonField) => void
}

export function JsonFieldOptions({ field, onChange }: JsonFieldOptionsProps) {
  const { t } = useTranslation()
  const [showInfo, setShowInfo] = useState(false)
  
  const handleChange = (key: keyof JsonField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="json-maxsize">{t('collections.maxSize')}</Label>
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
          id="json-maxsize"
          type="number"
          min={0}
          placeholder={t('collections.defaultLimit2MB')}
          value={field.maxSize || ''}
          onChange={(e) => handleChange('maxSize', parseInt(e.target.value, 10) || 0)}
        />
        <p className="text-xs text-muted-foreground">{t('collections.mustBeInBytes')}</p>
      </div>

      {/* Task 5: 字符串规范化说明面板 */}
      <Collapsible open={showInfo} onOpenChange={setShowInfo}>
        <CollapsibleTrigger asChild>
          <Button 
            type="button" 
            variant={showInfo ? 'secondary' : 'ghost'} 
            size="sm"
            className="text-[11px] h-7"
          >
            <span className="font-semibold">{t('collections.stringNormalizations', 'String value normalizations')}</span>
            {showInfo ? (
              <ChevronUp className="h-3.5 w-3.5 ml-1" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Alert className="mt-2 bg-amber-50 border-amber-200 text-amber-800">
            <AlertDescription className="text-[11px]">
              <p>
                {t(
                  'collections.jsonNormalizationDescription',
                  'In order to support seamlessly both application/json and multipart/form-data requests, the following normalization rules are applied if the json field is a plain string:'
                )}
              </p>
              <ul className="list-disc list-inside mt-2 space-y-0.5">
                <li>
                  "true" {t('collections.isConvertedTo', 'is converted to the json')} <code className="bg-amber-100 px-1 rounded">true</code>
                </li>
                <li>
                  "false" {t('collections.isConvertedTo', 'is converted to the json')} <code className="bg-amber-100 px-1 rounded">false</code>
                </li>
                <li>
                  "null" {t('collections.isConvertedTo', 'is converted to the json')} <code className="bg-amber-100 px-1 rounded">null</code>
                </li>
                <li>
                  "[1,2,3]" {t('collections.isConvertedTo', 'is converted to the json')} <code className="bg-amber-100 px-1 rounded">[1,2,3]</code>
                </li>
                <li>
                  {`"{"a":1,"b":2}"`} {t('collections.isConvertedTo', 'is converted to the json')} <code className="bg-amber-100 px-1 rounded">{`{"a":1,"b":2}`}</code>
                </li>
                <li>{t('collections.numericStringsConverted', 'numeric strings are converted to json number')}</li>
                <li>{t('collections.doubleQuotedStrings', 'double quoted strings are left as they are (aka. without normalizations)')}</li>
                <li>{t('collections.anyOtherString', 'any other string (empty string too) is double quoted')}</li>
              </ul>
              <p className="mt-2">
                {t(
                  'collections.avoidNormalization',
                  'Alternatively, if you want to avoid the string value normalizations, you can wrap your data inside an object, eg.'
                )}{' '}
                <code className="bg-amber-100 px-1 rounded">{`{"data": anything}`}</code>
              </p>
            </AlertDescription>
          </Alert>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
