// T020: 索引编辑面板
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { CodeEditor } from '@/components/CodeEditor'
import { cn } from '@/lib/utils'
import type { CollectionData, SchemaField } from './CollectionFieldsTab'

interface IndexParts {
  unique: boolean
  indexName: string
  tableName: string
  columns: { name: string; collate?: string; sort?: string }[]
  where?: string
}

interface IndexUpsertPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: CollectionData
  index?: string
  onSubmit: (oldIndex: string | undefined, newIndex: string) => void
  onRemove?: (index: string) => void
}

/**
 * 解析索引字符串
 */
function parseIndex(indexStr: string): IndexParts {
  const result: IndexParts = {
    unique: false,
    indexName: '',
    tableName: '',
    columns: [],
  }

  if (!indexStr) return result

  // 检查 UNIQUE
  result.unique = /\bUNIQUE\b/i.test(indexStr)

  // 提取索引名
  const nameMatch = indexStr.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/i)
  if (nameMatch) {
    result.indexName = nameMatch[1]
  }

  // 提取表名
  const tableMatch = indexStr.match(/ON\s+[`"']?(\w+)[`"']?/i)
  if (tableMatch) {
    result.tableName = tableMatch[1]
  }

  // 提取列
  const columnsMatch = indexStr.match(/\(([^)]+)\)/)
  if (columnsMatch) {
    const columnsStr = columnsMatch[1]
    result.columns = columnsStr.split(',').map((col) => {
      const trimmed = col.trim()
      const parts = trimmed.split(/\s+/)
      return {
        name: parts[0].replace(/[`"']/g, ''),
        sort: parts.find((p) => /^(ASC|DESC)$/i.test(p))?.toUpperCase(),
        collate: parts.find((p) => /^COLLATE$/i.test(p))
          ? parts[parts.indexOf('COLLATE') + 1]
          : undefined,
      }
    })
  }

  // 提取 WHERE 子句
  const whereMatch = indexStr.match(/WHERE\s+(.+)$/i)
  if (whereMatch) {
    result.where = whereMatch[1]
  }

  return result
}

/**
 * 构建索引字符串（与 UI 版本保持一致）
 * - 索引名和表名用反引号包裹
 * - 每个列名用反引号包裹
 * - 多个列时，每个列单独占一行
 */
function buildIndex(parts: IndexParts): string {
  if (!parts.columns.length) return ''

  const uniqueStr = parts.unique ? 'UNIQUE ' : ''
  // 索引名使用反引号包裹，如果没有指定则生成随机名称
  const indexName = parts.indexName || `idx_${randomString(10)}`

  let result = `CREATE ${uniqueStr}INDEX \`${indexName}\` ON \`${parts.tableName}\` (`

  const nonEmptyCols = parts.columns.filter((col) => !!col?.name)

  // 多个列时，每个列单独占一行
  if (nonEmptyCols.length > 1) {
    result += '\n  '
  }

  result += nonEmptyCols
    .map((col) => {
      let item = ''

      // 检查是否是表达式（包含括号或空格）
      if (col.name.includes('(') || col.name.includes(' ')) {
        item += col.name
      } else {
        // 普通标识符用反引号包裹
        item += '`' + col.name + '`'
      }

      if (col.collate) {
        item += ' COLLATE ' + col.collate
      }

      if (col.sort) {
        item += ' ' + col.sort.toUpperCase()
      }

      return item
    })
    .join(',\n  ')

  if (nonEmptyCols.length > 1) {
    result += '\n'
  }

  result += ')'

  if (parts.where) {
    result += ` WHERE ${parts.where}`
  }

  return result
}

/**
 * 生成随机字符串
 */
function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 索引编辑面板
 */
export function IndexUpsertPanel({
  open,
  onOpenChange,
  collection,
  index: originalIndex,
  onSubmit,
  onRemove,
}: IndexUpsertPanelProps) {
  const [indexValue, setIndexValue] = useState('')
  const isEdit = !!originalIndex

  // 可选列（排除已删除的字段）
  const presetColumns = useMemo(() => {
    return (
      collection.fields
        ?.filter((f: SchemaField) => !f._toDelete && f.name !== 'id')
        ?.map((f: SchemaField) => f.name) || []
    )
  }, [collection.fields])

  // 解析当前索引
  const indexParts = useMemo(() => parseIndex(indexValue), [indexValue])

  // 已选列（小写）
  const selectedColumns = useMemo(
    () => indexParts.columns.map((c) => c.name.toLowerCase()),
    [indexParts.columns]
  )

  // 初始化
  useEffect(() => {
    if (open) {
      if (originalIndex) {
        setIndexValue(originalIndex)
      } else {
        // 创建空白索引
        const blank = buildIndex({
          unique: false,
          indexName: '',
          tableName: collection.name || '',
          columns: [],
        })
        setIndexValue(blank)
      }
    }
  }, [open, originalIndex, collection.name])

  // 切换列
  const toggleColumn = (column: string) => {
    const parts = { ...indexParts }
    const normalizedColumn = column.toLowerCase()
    const idx = parts.columns.findIndex((c) => c.name.toLowerCase() === normalizedColumn)

    if (idx >= 0) {
      parts.columns = parts.columns.filter((_, i) => i !== idx)
    } else {
      parts.columns = [...parts.columns, { name: column }]
    }

    if (!parts.tableName) {
      parts.tableName = collection.name || ''
    }

    setIndexValue(buildIndex(parts))
  }

  // 切换 unique
  const toggleUnique = (checked: boolean) => {
    const parts = { ...indexParts, unique: checked }
    if (!parts.tableName) {
      parts.tableName = collection.name || ''
    }
    setIndexValue(buildIndex(parts))
  }

  // 提交
  const handleSubmit = () => {
    if (selectedColumns.length === 0) return
    onSubmit(originalIndex, indexValue)
    onOpenChange(false)
  }

  // 删除
  const handleRemove = () => {
    if (originalIndex && onRemove) {
      onRemove(originalIndex)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Update' : 'Create'} index</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {/* Unique 选项 - 使用 Switch 替代 Checkbox */}
          <div className="flex items-center space-x-2">
            <Switch
              id="index-unique"
              checked={indexParts.unique}
              onCheckedChange={toggleUnique}
            />
            <Label htmlFor="index-unique" className="cursor-pointer">
              Unique
            </Label>
          </div>

          {/* SQL 编辑器 - 移除 "Index Definition" 标签 */}
          <div className="space-y-2">
            <CodeEditor
              value={indexValue}
              onChange={setIndexValue}
              language="sql"
              minHeight="85px"
              placeholder={`eg. CREATE INDEX idx_test on ${collection.name || 'collection'} (created)`}
            />
          </div>

          {/* 预设列 - 与 UI 版本一致的标签样式 */}
          {presetColumns.length > 0 && (
            <div className="flex items-start gap-x-2.5 gap-y-2 flex-wrap w-full">
              <span className="text-muted-foreground text-sm py-1 shrink-0">Presets</span>
              {presetColumns.map((column) => {
                const isSelected = selectedColumns.includes(column.toLowerCase())
                return (
                  <button
                    key={column}
                    type="button"
                    className={cn(
                      "text-sm px-3 py-1 rounded-full transition-all shrink-0",
                      isSelected
                        ? "bg-blue-100 text-slate-700"
                        : "bg-slate-100 text-blue-600 hover:bg-slate-200"
                    )}
                    onClick={() => toggleColumn(column)}
                  >
                    {column}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {/* 始终显示删除按钮 */}
            {onRemove && (
              <Button type="button" variant="ghost" size="icon" onClick={handleRemove}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={selectedColumns.length === 0}>
              Set index
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default IndexUpsertPanel
