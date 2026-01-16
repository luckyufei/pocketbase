// T014: File 字段选项组件
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

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>Allowed mime types</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Allow files ONLY with the listed mime types. Leave empty for no restriction.</p>
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
            <span className="text-muted-foreground text-sm">No restriction</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="link" size="sm" className="h-auto p-0">
              Choose presets <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handlePresetClick('images')}>
              Images (jpg, png, svg, gif, webp)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePresetClick('documents')}>
              Documents (pdf, doc/docx, xls/xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePresetClick('videos')}>
              Videos (mp4, avi, mov, 3gp)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePresetClick('archives')}>
              Archives (zip, 7zip, rar)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="file-thumbs">Thumb sizes</Label>
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
          <p className="text-xs text-muted-foreground">Use comma as separator.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-maxsize">Max file size</Label>
          <Input
            id="file-maxsize"
            type="number"
            min={0}
            placeholder="Default to max ~5MB"
            value={field.maxSize || ''}
            onChange={(e) => onChange({ ...field, maxSize: parseInt(e.target.value, 10) || 0 })}
          />
          <p className="text-xs text-muted-foreground">Must be in bytes.</p>
        </div>
      </div>

      {!isSingle && (
        <div className="space-y-2">
          <Label htmlFor="file-maxselect">Max select</Label>
          <Input
            id="file-maxselect"
            type="number"
            min={2}
            required
            placeholder="Default to single"
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
            Protected
          </Label>
          <p className="text-xs text-muted-foreground">
            It will require View API rule permissions and file token to be accessible.
          </p>
        </div>
      </div>
    </div>
  )
}
