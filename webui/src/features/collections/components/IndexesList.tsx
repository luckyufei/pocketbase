/**
 * IndexesList - 索引列表管理组件
 * 与 UI 版本保持一致的标签样式
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { CollectionData } from './CollectionFieldsTab'
import { IndexUpsertPanel } from './IndexUpsertPanel'

interface IndexesListProps {
  collection: CollectionData
  indexes: string[]
  onChange: (indexes: string[]) => void
}

/**
 * 解析索引字符串
 * 支持反引号包裹的标识符，如: CREATE INDEX `idx_xxx` ON `table` (`col1`, `col2`)
 */
function parseIndex(indexStr: string): {
  indexName: string
  unique: boolean
  columns: string[]
} {
  // 检查是否是 UNIQUE 索引
  const unique = indexStr.toLowerCase().includes('unique')
  
  // 解析索引名 - 支持带反引号和不带反引号的格式
  // 格式1: INDEX `idx_xxx` 或 INDEX idx_xxx
  const nameMatch = indexStr.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i)
  
  // 解析列名 - 提取括号内的内容
  const columnsMatch = indexStr.match(/\(([^)]+)\)/)
  
  let columns: string[] = []
  if (columnsMatch?.[1]) {
    // 按换行或逗号分割，然后去除反引号和空白
    columns = columnsMatch[1]
      .split(/,|\n/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .map((c) => c.replace(/`/g, '').trim()) // 移除反引号
      .filter((c) => c.length > 0)
  }

  return {
    indexName: nameMatch?.[1] || 'unknown',
    unique,
    columns,
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
    <div className="space-y-3">
      {/* 标题 - 与 UI 版本一致 */}
      <h3 className="text-sm text-muted-foreground">
        Unique constraints and indexes ({indexes.length})
      </h3>

      {/* 索引标签列表 - 与 UI 版本一致的标签样式 */}
      <div className="flex items-center gap-2 flex-wrap">
        {indexes.map((indexStr, index) => {
          const parsed = parseIndex(indexStr)
          // 显示列名，多个用逗号分隔
          const displayText = parsed.columns.join(', ')

          return (
            <button
              key={index}
              type="button"
              className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-blue-600"
              onClick={() => handleEdit(indexStr)}
            >
              {/* 与 UI 版本保持一致：UNIQUE 索引显示加粗的 "Unique:" 前缀 */}
              {parsed.unique && <strong className="mr-1">Unique:</strong>}
              <span>{displayText}</span>
            </button>
          )
        })}

        {/* 新增按钮 - 与 UI 版本一致 */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4 mr-1" />
          New index
        </Button>
      </div>

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
