/**
 * 字段标签组件
 * 展示字段名称、类型图标和相关元信息（必填、类型等）
 */
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  HelpCircle,
  Type,
  Hash,
  ToggleLeft,
  Mail,
  Link,
  Calendar,
  CalendarCheck,
  Pencil,
  ListChecks,
  Braces,
  Image,
  GitFork,
  Lock,
  MapPin,
  Key,
  Star,
} from 'lucide-react'
import type { CollectionField } from 'pocketbase'
import type { LucideIcon } from 'lucide-react'

interface FieldLabelProps {
  field: CollectionField & { hidden?: boolean; primaryKey?: boolean; options?: Record<string, unknown> }
  htmlFor?: string
  showType?: boolean
  showRequired?: boolean
  className?: string
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '文本',
  editor: '富文本',
  number: '数字',
  bool: '布尔',
  email: '邮箱',
  url: '链接',
  date: '日期',
  autodate: '自动日期',
  select: '选择',
  json: 'JSON',
  file: '文件',
  relation: '关联',
  password: '密码',
  geoPoint: '地理坐标',
}

const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
  primary: Key,
  text: Type,
  number: Hash,
  bool: ToggleLeft,
  email: Mail,
  url: Link,
  date: Calendar,
  autodate: CalendarCheck,
  editor: Pencil,
  select: ListChecks,
  json: Braces,
  file: Image,
  relation: GitFork,
  password: Lock,
  geoPoint: MapPin,
}

function getFieldTypeIcon(field: FieldLabelProps['field']): LucideIcon {
  if ((field as any).primaryKey) {
    return FIELD_TYPE_ICONS.primary
  }
  return FIELD_TYPE_ICONS[field.type] || Star
}

export function FieldLabel({
  field,
  htmlFor,
  showType = false,
  showRequired = true,
  className = '',
}: FieldLabelProps) {
  const typeLabel = FIELD_TYPE_LABELS[field.type] || field.type
  const IconComponent = getFieldTypeIcon(field)

  return (
    <div data-field-label="" className={`flex items-center gap-1.5 min-w-0 ${className}`}>
      <IconComponent className="h-3.5 w-3.5 shrink-0" />
      <Label htmlFor={htmlFor} className="font-medium truncate max-w-[200px]" title={field.name}>
        {field.name}
      </Label>

      {showRequired && field.required && <span className="text-destructive">*</span>}

      {/* Hidden field indicator */}
      {(field as any).hidden && (
        <Badge variant="destructive" className="text-xs font-normal">
          Hidden
        </Badge>
      )}

      {showType && (
        <Badge variant="outline" className="text-xs font-normal">
          {typeLabel}
        </Badge>
      )}

      {/* 字段帮助信息 */}
      {field.options && Object.keys(field.options).length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="text-xs space-y-1">
                {field.options.min !== undefined && <div>最小值: {field.options.min}</div>}
                {field.options.max !== undefined && <div>最大值: {field.options.max}</div>}
                {field.options.minSelect !== undefined && (
                  <div>最少选择: {field.options.minSelect}</div>
                )}
                {field.options.maxSelect !== undefined && (
                  <div>最多选择: {field.options.maxSelect}</div>
                )}
                {field.options.pattern && (
                  <div>
                    正则: <code>{field.options.pattern}</code>
                  </div>
                )}
                {Array.isArray(field.options.values) && (
                  <div>
                    可选值: {field.options.values.slice(0, 5).join(', ')}
                    {field.options.values.length > 5 && '...'}
                  </div>
                )}
                {field.options.collectionId && <div>关联集合: {field.options.collectionId}</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
