// T014: File 字段选项组件
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, X, ChevronDown } from 'lucide-react'

export interface FileField {
  name: string
  type: 'file'
  maxSelect?: number
  maxSize?: number
  mimeTypes?: string[]
  thumbs?: string[]
  protected?: boolean
  [key: string]: unknown
}

interface FileFieldOptionsProps {
  field: FileField
  onChange: (field: FileField) => void
}

const MIME_PRESETS = {
  images: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  videos: ['video/mp4', 'video/x-ms-wmv', 'video/quicktime', 'video/3gpp'],
  archives: ['application/zip', 'application/x-7z-compressed', 'application/x-rar-compressed'],
}

export function FileFieldOptions({ field, onChange }: FileFieldOptionsProps) {
  const { t } = useTranslation()
  const isSingle = (field.maxSelect || 1) <= 1

  const handleSingleMultipleChange = (value: string) => {
    if (value === 'single') {
      onChange({ ...field, maxSelect: 1 })
    } else {
      onChange({ ...field, maxSelect: 99 })
    }
  }

  const handleRemoveMimeType = (mime: string) => {
    const current = field.mimeTypes || []
    onChange({ ...field, mimeTypes: current.filter((m) => m !== mime) })
  }

  const handlePresetClick = (preset: keyof typeof MIME_PRESETS) => {
    onChange({ ...field, mimeTypes: MIME_PRESETS[preset] })
  }

  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>{t('collections.allowedMimeTypes')}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('collections.allowedMimeTypesTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-background">
          {(field.mimeTypes || []).map((mime) => (
            <Badge key={mime} variant="secondary" className="gap-1 text-xs">
              {mime}
              <button
                type="button"
                onClick={() => handleRemoveMimeType(mime)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {(field.mimeTypes || []).length === 0 && (
            <span className="text-muted-foreground text-sm">{t('collections.noRestriction')}</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="link" size="sm" className="h-auto p-0">
              {t('collections.choosePresets')} <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handlePresetClick('images')}>
              {t('collections.imagesPreset')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePresetClick('documents')}>
              {t('collections.documentsPreset')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePresetClick('videos')}>
              {t('collections.videosPreset')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePresetClick('archives')}>
              {t('collections.archivesPreset')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="file-thumbs">{t('collections.thumbSizes')}</Label>
          <Input
            id="file-thumbs"
            placeholder="e.g. 50x50, 480x720"
            value={(field.thumbs || []).join(', ')}
            onChange={(e) =>
              onChange({
                ...field,
                thumbs: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <p className="text-xs text-muted-foreground">{t('collections.commaSeparator')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-maxsize">{t('collections.maxFileSize')}</Label>
          <Input
            id="file-maxsize"
            type="number"
            min={0}
            placeholder={t('collections.defaultMaxSize5MB')}
            value={field.maxSize || ''}
            onChange={(e) => onChange({ ...field, maxSize: parseInt(e.target.value, 10) || 0 })}
          />
          <p className="text-xs text-muted-foreground">{t('collections.mustBeInBytes')}</p>
        </div>
      </div>

      {!isSingle && (
        <div className="space-y-2">
          <Label htmlFor="file-maxselect">{t('collections.maxSelect')}</Label>
          <Input
            id="file-maxselect"
            type="number"
            min={2}
            required
            placeholder={t('collections.defaultToSingle')}
            value={field.maxSelect || ''}
            onChange={(e) => onChange({ ...field, maxSelect: parseInt(e.target.value, 10) || 2 })}
          />
        </div>
      )}

      <div className="flex items-start space-x-2">
        <Checkbox
          id="file-protected"
          checked={field.protected || false}
          onCheckedChange={(checked) => onChange({ ...field, protected: !!checked })}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor="file-protected" className="cursor-pointer">
            {t('collections.protected')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('collections.protectedTooltip')}
          </p>
        </div>
      </div>
    </div>
  )
}
