/**
 * 记录字段值展示组件
 * 根据字段类型渲染不同的值展示方式
 */
import { ExternalLink, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { truncate, toArray, isEmpty, plainText, maskSecret } from '@/lib/utils'
import { formatDate } from '@/lib/dateUtils'
import { RecordInfo } from './RecordInfo'
import { RecordFileThumb } from './RecordFileThumb'
import type { RecordModel, SchemaField } from 'pocketbase'

interface RecordFieldValueProps {
  record: RecordModel
  field: SchemaField & { primaryKey?: boolean }
  short?: boolean
}

export function RecordFieldValue({ record, field, short = false }: RecordFieldValueProps) {
  const [copied, setCopied] = useState(false)
  const rawValue = record?.[field.name]

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // 主键字段
  if (field.primaryKey) {
    return (
      <div className="inline-flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => handleCopy(rawValue as string)}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
        <span className="truncate font-mono text-xs">{rawValue as string}</span>
      </div>
    )
  }

  // JSON 字段
  if (field.type === 'json') {
    const stringifiedJson = JSON.stringify(rawValue) || '""'
    if (short) {
      return <span className="truncate text-sm">{truncate(stringifiedJson)}</span>
    }
    return (
      <div className="inline-flex items-center gap-1">
        <span className="text-sm">{truncate(stringifiedJson, 500, true)}</span>
        {stringifiedJson.length > 500 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleCopy(JSON.stringify(rawValue, null, 2))}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        )}
      </div>
    )
  }

  // 空值
  if (isEmpty(rawValue)) {
    return <span className="text-muted-foreground text-sm">N/A</span>
  }

  // 布尔字段
  if (field.type === 'bool') {
    return <Badge variant={rawValue ? 'default' : 'secondary'}>{rawValue ? 'True' : 'False'}</Badge>
  }

  // 数字字段
  if (field.type === 'number') {
    return <span className="text-sm">{rawValue as number}</span>
  }

  // URL 字段
  if (field.type === 'url') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              className="truncate text-sm text-primary hover:underline inline-flex items-center gap-1"
              href={rawValue as string}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {truncate(rawValue as string)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </TooltipTrigger>
          <TooltipContent>在新标签页中打开</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 富文本编辑器字段
  if (field.type === 'editor') {
    if (short) {
      return <span className="text-sm">{truncate(plainText(rawValue as string), 195)}</span>
    }
    return (
      <div
        className="prose prose-sm max-w-none max-h-[100px] overflow-auto"
        dangerouslySetInnerHTML={{ __html: rawValue as string }}
      />
    )
  }

  // 日期字段
  if (field.type === 'date' || field.type === 'autodate') {
    return <span className="text-sm">{formatDate(rawValue as string)}</span>
  }

  // 选择字段
  if (field.type === 'select') {
    const items = toArray(rawValue)
    return (
      <div className="inline-flex flex-wrap gap-1">
        {items.map((item, i) => (
          <Badge key={`${i}-${item}`} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    )
  }

  // 关联字段
  if (field.type === 'relation') {
    const relations = toArray(rawValue)
    const expanded = toArray(record?.expand?.[field.name])
    const relLimit = short ? 20 : 500

    return (
      <div className="inline-flex flex-wrap gap-1">
        {expanded.length > 0
          ? expanded.slice(0, relLimit).map((item, i) => (
              <Badge key={`${i}-${item.id}`} variant="outline">
                <RecordInfo record={item} />
              </Badge>
            ))
          : relations.slice(0, relLimit).map((id) => (
              <Badge key={id} variant="outline">
                {id}
              </Badge>
            ))}
        {relations.length > relLimit && <span>...</span>}
      </div>
    )
  }

  // 文件字段
  if (field.type === 'file') {
    const files = toArray(rawValue)
    const filesLimit = short ? 10 : 500

    return (
      <div className="inline-flex flex-wrap gap-1">
        {files.slice(0, filesLimit).map((filename, i) => (
          <RecordFileThumb key={`${i}-${filename}`} record={record} filename={filename} size="sm" />
        ))}
        {files.length > filesLimit && <span>...</span>}
      </div>
    )
  }

  // 地理坐标字段
  if (field.type === 'geoPoint') {
    const value = rawValue as { lon?: number; lat?: number }
    return (
      <Badge variant="outline">
        {value?.lon?.toFixed(6)}, {value?.lat?.toFixed(6)}
      </Badge>
    )
  }

  // Secret 字段
  if (field.type === 'secret') {
    const maskedValue = rawValue ? maskSecret(String(rawValue)) : ''
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground font-mono text-xs">
              {maskedValue || 'N/A'}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Secret field - hidden</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 默认文本展示
  if (short) {
    return (
      <span className="truncate text-sm" title={truncate(rawValue as string)}>
        {truncate(rawValue as string)}
      </span>
    )
  }

  return <div className="max-h-[100px] overflow-auto text-sm break-all">{rawValue as string}</div>
}
