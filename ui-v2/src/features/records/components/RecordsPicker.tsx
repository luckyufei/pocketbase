/**
 * RecordsPicker - 关联记录选择器对话框
 * 用于选择关联字段的目标记录
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, CheckCircle2, Circle, X, ExternalLink, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pb } from '@/lib/ApiClient'

interface RecordItem {
  id: string
  collectionId: string
  [key: string]: any
}

interface CollectionField {
  name: string
  type: string
  required?: boolean
  presentable?: boolean
  hidden?: boolean
  options?: Record<string, any>
}

interface Collection {
  id: string
  name: string
  type: 'base' | 'auth' | 'view'
  fields: CollectionField[]
}

interface RelationField {
  name: string
  type: string
  required?: boolean
  options?: {
    collectionId?: string
    maxSelect?: number
  }
}

interface RecordsPickerProps {
  open: boolean
  onClose: () => void
  onSave: (value: string | string[], records: RecordItem[]) => void
  collection: Collection
  field: RelationField
  value: string | string[]
}

const BATCH_SIZE = 50

export function RecordsPicker({
  open,
  onClose,
  onSave,
  collection,
  field,
  value,
}: RecordsPickerProps) {
  const [filter, setFilter] = useState('')
  const [list, setList] = useState<RecordItem[]>([])
  const [selected, setSelected] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const maxSelect = field.options?.maxSelect || 1
  const isMultiple = maxSelect > 1
  const isView = collection.type === 'view'
  const canSelectMore = maxSelect <= 0 || maxSelect > selected.length

  // 获取记录的显示文本
  const getRecordDisplay = useCallback(
    (record: RecordItem): string => {
      // 优先使用 presentable 字段
      const presentableField = collection.fields.find((f) => f.presentable && !f.hidden)
      if (presentableField && record[presentableField.name]) {
        return String(record[presentableField.name])
      }
      // 其次使用 name/title 字段
      if (record.name) return record.name
      if (record.title) return record.title
      // 最后使用 id
      return record.id
    },
    [collection.fields]
  )

  // 加载已选择的记录
  const loadSelected = useCallback(async () => {
    const selectedIds = Array.isArray(value) ? value : value ? [value] : []
    if (!selectedIds.length || !collection.id) return

    try {
      const records = await pb.collection(collection.id).getFullList({
        filter: selectedIds.map((id) => `id="${id}"`).join('||'),
        batch: BATCH_SIZE,
      })

      // 保持原有顺序
      const orderedRecords = selectedIds
        .map((id) => records.find((r) => r.id === id))
        .filter((r): r is RecordItem => !!r)

      setSelected(orderedRecords)
    } catch (err) {
      console.error('Failed to load selected records:', err)
    }
  }, [value, collection.id])

  // 加载记录列表
  const loadList = useCallback(
    async (reset = false) => {
      if (!collection.id) return

      setIsLoading(true)

      try {
        const page = reset ? 1 : currentPage + 1

        // 构建搜索过滤器
        let filterStr = ''
        if (filter.trim()) {
          const searchFields = collection.fields
            .filter((f) => f.type === 'text' || f.type === 'email' || f.type === 'url')
            .map((f) => f.name)

          if (searchFields.length > 0) {
            filterStr = searchFields.map((f) => `${f}~"${filter}"`).join('||')
          }
        }

        const result = await pb.collection(collection.id).getList(page, BATCH_SIZE, {
          filter: filterStr,
          sort: isView ? '' : '-created',
        })

        if (reset) {
          setList(result.items as RecordItem[])
        } else {
          setList((prev) => {
            const existingIds = new Set(prev.map((r) => r.id))
            const newItems = (result.items as RecordItem[]).filter((r) => !existingIds.has(r.id))
            return [...prev, ...newItems]
          })
        }

        setCurrentPage(result.page)
        setHasMore(result.items.length === BATCH_SIZE)
      } catch (err) {
        console.error('Failed to load records:', err)
        if (reset) {
          setList([])
        }
      } finally {
        setIsLoading(false)
      }
    },
    [collection.id, collection.fields, filter, currentPage, isView]
  )

  // 初始化
  useEffect(() => {
    if (open) {
      setFilter('')
      setList([])
      setSelected([])
      setCurrentPage(1)
      loadSelected()
      loadList(true)
    }
  }, [open])

  // 过滤变化时重新加载
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        loadList(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [filter])

  // 检查记录是否已选择
  const isSelected = useCallback(
    (record: RecordItem) => {
      return selected.some((r) => r.id === record.id)
    },
    [selected]
  )

  // 选择记录
  const selectRecord = useCallback(
    (record: RecordItem) => {
      if (maxSelect === 1) {
        setSelected([record])
      } else if (canSelectMore) {
        setSelected((prev) => {
          if (prev.some((r) => r.id === record.id)) return prev
          return [...prev, record]
        })
      }
    },
    [maxSelect, canSelectMore]
  )

  // 取消选择
  const deselectRecord = useCallback((record: RecordItem) => {
    setSelected((prev) => prev.filter((r) => r.id !== record.id))
  }, [])

  // 切换选择
  const toggleRecord = useCallback(
    (record: RecordItem) => {
      if (isSelected(record)) {
        deselectRecord(record)
      } else {
        selectRecord(record)
      }
    },
    [isSelected, selectRecord, deselectRecord]
  )

  // 保存选择
  const handleSave = useCallback(() => {
    if (maxSelect === 1) {
      onSave(selected[0]?.id || '', selected)
    } else {
      onSave(
        selected.map((r) => r.id),
        selected
      )
    }
    onClose()
  }, [selected, maxSelect, onSave, onClose])

  // 滚动加载更多
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100

      if (isNearBottom && hasMore && !isLoading) {
        loadList(false)
      }
    },
    [hasMore, isLoading, loadList]
  )

  // 合并列表（已选择的放在前面）
  const displayList = useMemo(() => {
    if (!filter.trim()) {
      const selectedIds = new Set(selected.map((r) => r.id))
      const unselectedItems = list.filter((r) => !selectedIds.has(r.id))
      return [...selected, ...unselectedItems]
    }
    return list
  }, [list, selected, filter])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Select <strong>{collection.name}</strong> records
          </DialogTitle>
        </DialogHeader>

        {/* 搜索栏 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          {!isView && (
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New record
            </Button>
          )}
        </div>

        {/* 记录列表 */}
        <ScrollArea
          className="flex-1 border rounded-md max-h-[300px]"
          onScrollCapture={handleScroll}
        >
          <div className="p-1">
            {displayList.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p>No records found.</p>
                {filter && (
                  <Button variant="ghost" size="sm" onClick={() => setFilter('')} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              displayList.map((record) => {
                const recordSelected = isSelected(record)
                const disabled = !recordSelected && isMultiple && !canSelectMore

                return (
                  <div
                    key={record.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                      recordSelected && 'bg-primary/10',
                      disabled && 'opacity-50 cursor-not-allowed',
                      !disabled && !recordSelected && 'hover:bg-muted'
                    )}
                    onClick={() => !disabled && toggleRecord(record)}
                  >
                    {recordSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="truncate">{getRecordDisplay(record)}</span>
                    </div>
                    {!isView && (
                      <a
                        href={`#/collections?collection=${record.collectionId}&recordId=${record.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )
              })
            )}
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 已选择区域 */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium">
            Selected
            {isMultiple && (
              <span className="text-muted-foreground ml-1">
                ({selected.length} of MAX {maxSelect})
              </span>
            )}
          </h5>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-auto">
              {selected.map((record) => (
                <Badge key={record.id} variant="secondary" className="pr-1">
                  <span className="mr-1">{getRecordDisplay(record)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => deselectRecord(record)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No selected records.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Set selection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
