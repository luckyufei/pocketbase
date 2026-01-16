// T020: 索引编辑面板
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { CodeEditor } from '@/components/CodeEditor'
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
 * 构建索引字符串
 */
function buildIndex(parts: IndexParts): string {
  if (!parts.columns.length) return ''

  const uniqueStr = parts.unique ? 'UNIQUE ' : ''
  const indexName =
    parts.indexName || `idx_${parts.tableName}_${parts.columns.map((c) => c.name).join('_')}`
  const columnsStr = parts.columns
    .map((col) => {
      let s = col.name
      if (col.collate) s += ` COLLATE ${col.collate}`
      if (col.sort) s += ` ${col.sort}`
      return s
    })
    .join(', ')

  let sql = `CREATE ${uniqueStr}INDEX ${indexName} ON ${parts.tableName} (${columnsStr})`
  if (parts.where) {
    sql += ` WHERE ${parts.where}`
  }

  return sql
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Update' : 'Create'} Index</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Unique 选项 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="index-unique"
              checked={indexParts.unique}
              onCheckedChange={toggleUnique}
            />
            <Label htmlFor="index-unique" className="cursor-pointer">
              Unique
            </Label>
          </div>

          {/* SQL 编辑器 */}
          <div className="space-y-2">
            <Label>Index Definition</Label>
            <CodeEditor
              value={indexValue}
              onChange={setIndexValue}
              language="sql"
              minHeight="85px"
              placeholder={`eg. CREATE INDEX idx_test on ${collection.name || 'collection'} (created)`}
            />
          </div>

          {/* 预设列 */}
          {presetColumns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Presets</Label>
              <div className="flex flex-wrap gap-2">
                {presetColumns.map((column) => (
                  <Badge
                    key={column}
                    variant={selectedColumns.includes(column.toLowerCase()) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleColumn(column)}
                  >
                    {column}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isEdit && onRemove && (
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
              Set Index
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default IndexUpsertPanel
