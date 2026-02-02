// T015: Relation 字段选项组件
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
        <Label>Select collection *</Label>
        <Select
          value={field.collectionId || ''}
          onValueChange={(value) => onChange({ ...field, collectionId: value })}
          disabled={!!field.id} // 已保存的字段不能修改关联集合
        >
          <SelectTrigger>
            <SelectValue placeholder="Select collection *" />
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
        <Label>Selection type</Label>
        <Select value={isSingle ? 'single' : 'multiple'} onValueChange={handleSingleMultipleChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single</SelectItem>
            <SelectItem value="multiple">Multiple</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isSingle && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="relation-minselect">Min select</Label>
            <Input
              id="relation-minselect"
              type="number"
              min={0}
              placeholder="No min limit"
              value={field.minSelect || ''}
              onChange={(e) => onChange({ ...field, minSelect: parseInt(e.target.value, 10) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="relation-maxselect">Max select</Label>
            <Input
              id="relation-maxselect"
              type="number"
              min={field.minSelect || 1}
              placeholder="Default to single"
              value={field.maxSelect || ''}
              onChange={(e) => onChange({ ...field, maxSelect: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>Cascade delete</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Whether on {selectedCollection?.name || 'relation'} record deletion to delete also
                  the current corresponding collection record(s).
                </p>
                {!isSingle && (
                  <p className="mt-2">
                    For "Multiple" relation fields the cascade delete is triggered only when all{' '}
                    {selectedCollection?.name || 'relation'} ids are removed from the corresponding
                    record.
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
            <SelectItem value="false">False</SelectItem>
            <SelectItem value="true">True</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
