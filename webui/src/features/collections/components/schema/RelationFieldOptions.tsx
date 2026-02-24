// T015: Relation 字段选项组件
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export interface RelationField {
  name: string
  type: 'relation'
  collectionId?: string
  maxSelect?: number
  minSelect?: number
  cascadeDelete?: boolean
  [key: string]: unknown
}

interface Collection {
  id: string
  name: string
  type: string
}

interface RelationFieldOptionsProps {
  field: RelationField
  onChange: (field: RelationField) => void
  collections?: Collection[]
}

export function RelationFieldOptions({
  field,
  onChange,
  collections = [],
}: RelationFieldOptionsProps) {
  const { t } = useTranslation()
  const isSingle = (field.maxSelect || 1) <= 1
  const selectableCollections = collections.filter((c) => c.type !== 'view')
  const selectedCollection = collections.find((c) => c.id === field.collectionId)

  const handleSingleMultipleChange = (value: string) => {
    if (value === 'single') {
      onChange({ ...field, maxSelect: 1, minSelect: 0 })
    } else {
      onChange({ ...field, maxSelect: 999 })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('collections.selectCollection')}</Label>
        <Select
          value={field.collectionId || ''}
          onValueChange={(value) => onChange({ ...field, collectionId: value })}
          disabled={!!field.id}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('collections.selectCollectionPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {selectableCollections.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('collections.selectionType')}</Label>
        <Select value={isSingle ? 'single' : 'multiple'} onValueChange={handleSingleMultipleChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">{t('collections.single')}</SelectItem>
            <SelectItem value="multiple">{t('collections.multiple')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isSingle && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="relation-minselect">{t('collections.minSelect')}</Label>
            <Input
              id="relation-minselect"
              type="number"
              min={0}
              placeholder={t('collections.noMinLimit')}
              value={field.minSelect || ''}
              onChange={(e) => onChange({ ...field, minSelect: parseInt(e.target.value, 10) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="relation-maxselect">{t('collections.maxSelect')}</Label>
            <Input
              id="relation-maxselect"
              type="number"
              min={field.minSelect || 1}
              placeholder={t('collections.defaultToSingle')}
              value={field.maxSelect || ''}
              onChange={(e) => onChange({ ...field, maxSelect: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>{t('collections.cascadeDelete')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  {t('collections.cascadeDeleteTooltip', { collection: selectedCollection?.name || 'relation' })}
                </p>
                {!isSingle && (
                  <p className="mt-2">
                    {t('collections.cascadeDeleteMultiTooltip', { collection: selectedCollection?.name || 'relation' })}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={field.cascadeDelete ? 'true' : 'false'}
          onValueChange={(value) => onChange({ ...field, cascadeDelete: value === 'true' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">{t('collections.false')}</SelectItem>
            <SelectItem value="true">{t('collections.true')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
