// T012: Select 字段选项组件
// 选项值和 Single/Multiple 已移到字段行内显示
// 此组件只保留 Max Select 配置（仅多选时显示）
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface SelectField {
  name: string
  type: 'select'
  values?: string[]
  maxSelect?: number
  [key: string]: unknown
}

interface SelectFieldOptionsProps {
  field: SelectField
  onChange: (field: SelectField) => void
}

export function SelectFieldOptions({ field, onChange }: SelectFieldOptionsProps) {
  const { t } = useTranslation()
  const isSingle = (field.maxSelect || 1) <= 1

  // 只有多选时才显示 Max Select 配置
  if (isSingle) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="select-maxselect">{t('collections.maxSelect', 'Max select')}</Label>
        <Input
          id="select-maxselect"
          type="number"
          min={2}
          max={field.values?.length || 999}
          placeholder={t('collections.defaultToSingle', 'Default to single')}
          value={field.maxSelect || ''}
          onChange={(e) => onChange({ ...field, maxSelect: parseInt(e.target.value, 10) || 2 })}
        />
      </div>
    </div>
  )
}
