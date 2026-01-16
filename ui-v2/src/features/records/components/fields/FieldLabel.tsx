/**
 * 字段标签组件
 * 展示字段名称和相关元信息（必填、类型等）
 */
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import type { SchemaField } from 'pocketbase'

interface FieldLabelProps {
  field: SchemaField
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

export function FieldLabel({
  field,
  htmlFor,
  showType = false,
  showRequired = true,
  className = '',
}: FieldLabelProps) {
  const typeLabel = FIELD_TYPE_LABELS[field.type] || field.type

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Label htmlFor={htmlFor} className="font-medium">
        {field.name}
      </Label>

      {showRequired && field.required && <span className="text-destructive">*</span>}

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
