/**
 * IndexesList - 索引列表管理组件
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import type { CollectionData } from './CollectionFieldsTab'
import { IndexUpsertPanel } from './IndexUpsertPanel'

interface IndexesListProps {
  collection: CollectionData
  indexes: string[]
  onChange: (indexes: string[]) => void
}

/**
 * 解析索引字符串
 */
function parseIndex(indexStr: string): {
  indexName: string
  unique: boolean
  columns: string[]
} {
  // 简单解析，格式: CREATE [UNIQUE] INDEX name ON table (columns)
  const unique = indexStr.toLowerCase().includes('unique')
  const nameMatch = indexStr.match(/INDEX\s+(\w+)/i)
  const columnsMatch = indexStr.match(/\(([^)]+)\)/)

  return {
    indexName: nameMatch?.[1] || 'unknown',
    unique,
    columns: columnsMatch?.[1]?.split(',').map((c) => c.trim()) || [],
  }
}

/**
 * 索引列表组件
 */
export function IndexesList({ collection, indexes, onChange }: IndexesListProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<string | undefined>(undefined)

  // 打开新增面板
  const handleAdd = () => {
    setEditingIndex(undefined)
    setIsPanelOpen(true)
  }

  // 打开编辑面板
  const handleEdit = (indexStr: string) => {
    setEditingIndex(indexStr)
    setIsPanelOpen(true)
  }

  // 删除索引
  const handleRemove = (indexStr: string) => {
    const newIndexes = indexes.filter((idx) => idx !== indexStr)
    onChange(newIndexes)
  }

  // 提交索引（新增或更新）
  const handleSubmit = (oldIndex: string | undefined, newIndex: string) => {
    if (oldIndex) {
      // 更新
      const newIndexes = indexes.map((idx) => (idx === oldIndex ? newIndex : idx))
      onChange(newIndexes)
    } else {
      // 新增
      onChange([...indexes, newIndex])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Indexes</h3>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Index
        </Button>
      </div>

      {/* 索引列表 */}
      {indexes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No indexes defined</p>
      ) : (
        <div className="space-y-2">
          {indexes.map((indexStr, index) => {
            const parsed = parseIndex(indexStr)

            return (
              <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{parsed.indexName}</span>
                    {parsed.unique && (
                      <Badge variant="secondary" className="text-xs">
                        UNIQUE
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{parsed.columns.join(', ')}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(indexStr)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleRemove(indexStr)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* 索引统计 */}
      <p className="text-xs text-muted-foreground">
        {indexes.length} index{indexes.length !== 1 ? 'es' : ''}
      </p>

      {/* 索引编辑面板 */}
      <IndexUpsertPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        collection={collection}
        index={editingIndex}
        onSubmit={handleSubmit}
        onRemove={handleRemove}
      />
    </div>
  )
}

export default IndexesList
