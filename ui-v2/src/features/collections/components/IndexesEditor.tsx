/**
 * IndexesEditor - Collection 索引编辑器
 * 用于管理 Collection 的数据库索引
 */
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

interface IndexesEditorProps {
  indexes: string[]
  onChange: (indexes: string[]) => void
  collectionName?: string
}

export function IndexesEditor({
  indexes,
  onChange,
  collectionName = 'collection',
}: IndexesEditorProps) {
  const addIndex = () => {
    const newIndex = `CREATE INDEX idx_new ON ${collectionName} (field_name)`
    onChange([...indexes, newIndex])
  }

  const updateIndex = (index: number, value: string) => {
    const updated = [...indexes]
    updated[index] = value
    onChange(updated)
  }

  const removeIndex = (index: number) => {
    const updated = indexes.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Define custom database indexes to optimize query performance.
      </div>

      {/* 索引列表 */}
      <div className="space-y-3">
        {indexes.map((indexSql, index) => (
          <div key={index} className="flex gap-2">
            <Textarea
              value={indexSql}
              onChange={(e) => updateIndex(index, e.target.value)}
              placeholder="CREATE INDEX idx_name ON collection (field)"
              className="font-mono text-sm flex-1"
              rows={2}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeIndex(index)}
              aria-label="Remove index"
              className="text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* 添加索引按钮 */}
      <Button type="button" variant="outline" onClick={addIndex}>
        <Plus className="h-4 w-4 mr-2" />
        Add Index
      </Button>

      {/* 索引统计 */}
      {indexes.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {indexes.length} index{indexes.length !== 1 ? 'es' : ''}
        </div>
      )}
    </div>
  )
}
