/**
 * RecordsPicker - 关联记录选择器对话框
 * 用于选择关联字段的目标记录
 * 
 * 功能：
 * 1. 搜索过滤记录
 * 2. 选中/取消选中记录
 * 3. 外部链接带 tooltip 显示记录 JSON
 * 4. 编辑记录功能
 * 5. 新建记录功能
 * 6. 已选记录展示
 * 
 * 注意：不使用 Radix Dialog，而是使用 createPortal 实现
 * 以避免 Radix Dialog 的焦点陷阱机制阻止与嵌套的 UpsertPanel 交互
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSetAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, Circle, X, ExternalLink, Loader2, Plus, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pb } from '@/lib/ApiClient'
import { UpsertPanel } from './UpsertPanel'
import { RecordFileThumb } from './RecordFileThumb'
import { FilterAutocompleteInput } from '@/components/FilterAutocompleteInput'
import { normalizeSearchFilter, getSearchableFields } from '@/lib/filterAutocomplete'
import { useCollections } from '@/features/collections/hooks/useCollections'
import { allocateZIndex, releaseZIndex, generatePanelId } from '@/lib/zIndexManager'
import { exportFormData } from '../utils/exportFormData'
import { addToast } from '@/store/toasts'
import type { CollectionModel, RecordModel } from 'pocketbase'

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
  maxSelect?: number
  mimeTypes?: string[]
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
  // PocketBase relation field 的 collectionId 和 maxSelect 是顶级属性，不在 options 内
  collectionId?: string
  maxSelect?: number
  options?: {
    // 兼容旧版本（如果有的话）
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
  /** z-index for the dialog, defaults to 50 */
  zIndex?: number
}

const BATCH_SIZE = 50

export function RecordsPicker({
  open,
  onClose,
  onSave,
  collection,
  field,
  value,
  zIndex = 50,
}: RecordsPickerProps) {
  const [filter, setFilter] = useState('')
  const [list, setList] = useState<RecordItem[]>([])
  const [selected, setSelected] = useState<RecordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [upsertOpen, setUpsertOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null)
  const [fullCollection, setFullCollection] = useState<CollectionModel | null>(null)
  const [isReloadingRecord, setIsReloadingRecord] = useState<Record<string, boolean>>({})
  
  // Toast 通知
  const toast = useSetAtom(addToast)
  
  // 获取所有 collections 用于自动补全
  const { collections } = useCollections()
  
  // 动态 z-index 管理
  const [dialogId] = useState(() => generatePanelId())
  const [dynamicZIndex, setDynamicZIndex] = useState(zIndex)
  
  // Dialog 容器引用，用于 ESC 键处理
  const dialogRef = useRef<HTMLDivElement>(null)

  // maxSelect: 优先使用顶级属性，fallback 到 options 内（兼容旧版本）
  const maxSelect = field.maxSelect ?? field.options?.maxSelect ?? 1
  const isMultiple = maxSelect > 1
  const isView = collection.type === 'view'
  const canSelectMore = maxSelect <= 0 || maxSelect > selected.length

  // 当对话框打开/关闭时，分配/释放 z-index
  // 始终使用动态分配，确保后打开的对话框总是在最上层
  useEffect(() => {
    if (open) {
      const allocated = allocateZIndex(dialogId)
      setDynamicZIndex(allocated)
    } else {
      releaseZIndex(dialogId)
    }
    
    return () => {
      if (open) {
        releaseZIndex(dialogId)
      }
    }
  }, [open, dialogId])
  
  // ESC 键关闭对话框（当 UpsertPanel 未打开时）
  useEffect(() => {
    if (!open) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !upsertOpen) {
        // 检查焦点是否在需要保护的元素中
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT'
        const isTextarea = target.tagName === 'TEXTAREA'
        const isContentEditable = target.isContentEditable
        const isCombobox = target.closest('[role="combobox"]')
        const isListbox = target.closest('[role="listbox"]')
        const isMenu = target.closest('[role="menu"]')
        
        // 如果在这些元素中，不关闭对话框
        if (isInput || isTextarea || isContentEditable || isCombobox || isListbox || isMenu) {
          return
        }
        
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, upsertOpen, onClose])


  // 获取完整的 collection 信息（用于 UpsertPanel）
  // 优先使用 collection.id，如果为空则使用 field.collectionId
  const targetCollectionId = collection.id || field.collectionId || field.options?.collectionId || ''
  
  useEffect(() => {
    if (open && targetCollectionId) {
      pb.collections.getOne(targetCollectionId)
        .then((col) => {
          setFullCollection(col)
        })
        .catch(console.error)
    }
  }, [open, targetCollectionId])

  // 获取记录的头像/缩略图字段
  // 优先使用 presentable 的 file 字段，如果没有则 fallback 到单选图片字段（如 avatar）
  // 注意：使用 fullCollection（完整的 collection 信息）或 collection.fields
  const avatarField = useMemo(() => {
    // 优先使用 fullCollection（包含完整的字段定义），否则使用传入的 collection
    const fields = (fullCollection?.fields || collection.fields || []) as CollectionField[]
    
    // 1. 优先查找 presentable 且类型为 file 的字段
    const presentableFileField = fields.find(
      (f) => !f.hidden && f.presentable && f.type === 'file'
    )
    if (presentableFileField) {
      return presentableFileField
    }
    
    // 2. Fallback: 查找名为 avatar 的 file 字段（不管 maxSelect）
    const avatarNameField = fields.find(
      (f) => !f.hidden && f.type === 'file' && f.name === 'avatar'
    )
    if (avatarNameField) {
      return avatarNameField
    }
    
    // 3. Fallback: 查找第一个 file 类型字段
    const fallbackFileField = fields.find((f) => !f.hidden && f.type === 'file')
    if (fallbackFileField) {
      return fallbackFileField
    }
    
    return null
  }, [fullCollection, collection.fields])

  // 获取记录的头像文件名
  const getRecordAvatar = useCallback(
    (record: RecordItem): string | null => {
      if (!avatarField) {
        return null
      }
      const value = record[avatarField.name]
      if (!value) return null
      // 如果是数组，取第一个
      if (Array.isArray(value)) {
        return value[0] || null
      }
      return String(value)
    },
    [avatarField]
  )

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

  // 格式化记录为 JSON 字符串（用于 tooltip）
  const formatRecordJson = useCallback((record: RecordItem): string => {
    // 排除 expand 字段，并截断过长的内容
    const { expand, ...rest } = record
    const truncated: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rest)) {
      if (typeof value === 'string' && value.length > 100) {
        truncated[key] = value.substring(0, 100) + '...'
      } else {
        truncated[key] = value
      }
    }
    return JSON.stringify(truncated, null, 2)
  }, [])

  // 重新加载单个记录（编辑后更新）
  const reloadRecord = useCallback(async (recordId: string) => {
    if (!targetCollectionId) return
    
    setIsReloadingRecord(prev => ({ ...prev, [recordId]: true }))
    
    try {
      const reloaded = await pb.collection(targetCollectionId).getOne(recordId)
      
      // 更新 list 中的记录
      setList(prev => prev.map(r => r.id === recordId ? reloaded as RecordItem : r))
      
      // 更新 selected 中的记录
      setSelected(prev => prev.map(r => r.id === recordId ? reloaded as RecordItem : r))
    } catch (err) {
      console.error('Failed to reload record:', err)
    } finally {
      setIsReloadingRecord(prev => ({ ...prev, [recordId]: false }))
    }
  }, [targetCollectionId])

  // 加载已选择的记录
  const loadSelected = useCallback(async () => {
    const selectedIds = Array.isArray(value) ? value : value ? [value] : []
    if (!selectedIds.length || !targetCollectionId) return

    try {
      const records = await pb.collection(targetCollectionId).getFullList({
        filter: selectedIds.map((id) => `id="${id}"`).join('||'),
        batch: BATCH_SIZE,
        // 使用独立的 requestKey 避免被 loadList 取消
        requestKey: `picker-selected-${collection.id}`,
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
      if (!targetCollectionId) return

      setIsLoading(true)

      try {
        const page = reset ? 1 : currentPage + 1

        // 使用 fullCollection 或 collection 获取可搜索字段
        const targetCollection = fullCollection || collection
        const searchableFields = getSearchableFields(targetCollection as CollectionModel)
        
        // 使用 normalizeSearchFilter 处理搜索词/过滤表达式
        const filterStr = normalizeSearchFilter(filter, searchableFields)

        const result = await pb.collection(targetCollectionId).getList(page, BATCH_SIZE, {
          filter: filterStr,
          sort: isView ? '' : '-@rowid',
          skipTotal: 1,
          // 使用独立的 requestKey 避免被 loadSelected 取消
          requestKey: `picker-list-${targetCollectionId}`,
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
    [targetCollectionId, collection.fields, filter, currentPage, isView, fullCollection]
  )

  // 初始化 - 当对话框打开时加载数据
  useEffect(() => {
    if (open) {
      setFilter('')
      setList([])
      setCurrentPage(1)
      // 清空 fullCollection，等待重新获取（避免使用缓存的旧数据）
      setFullCollection(null)
      // 注意：不要清空 selected，由 loadSelected 根据 value 来设置
      loadSelected()
      loadList(true)
    } else {
      // 对话框关闭时清空 selected，以便下次打开时重新加载
      setSelected([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 用于渲染时检查选中状态
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
      } else {
        // 在 setSelected 内部检查 canSelectMore，避免闭包问题
        setSelected((prev) => {
          // 已经选中则不重复添加
          if (prev.some((r) => r.id === record.id)) return prev
          // 检查是否还能选择更多（maxSelect <= 0 表示无限制）
          const canSelect = maxSelect <= 0 || maxSelect > prev.length
          if (!canSelect) return prev
          return [...prev, record]
        })
      }
    },
    [maxSelect]
  )

  // 取消选择
  const deselectRecord = useCallback((record: RecordItem) => {
    setSelected((prev) => prev.filter((r) => r.id !== record.id))
  }, [])

  // 切换选择（使用 setSelected 的函数形式避免闭包问题）
  const toggleRecord = useCallback(
    (record: RecordItem) => {
      setSelected((prev) => {
        const isCurrentlySelected = prev.some((r) => r.id === record.id)
        if (isCurrentlySelected) {
          // 取消选择
          return prev.filter((r) => r.id !== record.id)
        } else {
          // 选择
          if (maxSelect === 1) {
            return [record]
          } else {
            // 检查是否还能选择更多
            const canSelect = maxSelect <= 0 || maxSelect > prev.length
            if (!canSelect) return prev
            return [...prev, record]
          }
        }
      })
    },
    [maxSelect]
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

  return createPortal(
    <>
      {/* 背景遮罩 - 点击关闭（当 UpsertPanel 未打开时） */}
      <div
        className="fixed inset-0 bg-black/50 animate-in fade-in-0"
        style={{ 
          zIndex: dynamicZIndex,
          // 当 UpsertPanel 打开时，禁用遮罩的点击事件
          pointerEvents: upsertOpen ? 'none' : 'auto'
        }}
        onClick={() => {
          if (!upsertOpen) {
            onClose()
          }
        }}
        aria-hidden="true"
      />
      
      {/* 对话框内容 */}
      <div
        ref={dialogRef}
        className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-2xl gap-4 border border-slate-200 bg-white p-6 shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 sm:rounded-2xl"
        style={{ 
          zIndex: dynamicZIndex + 1, 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column',
          // 当 UpsertPanel 打开时，禁用鼠标事件
          pointerEvents: upsertOpen ? 'none' : 'auto'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="records-picker-title"
      >
        {/* Header */}
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 id="records-picker-title" className="text-lg font-semibold leading-none tracking-tight text-slate-900">
            Select <strong>{collection.name}</strong> records
          </h2>
        </div>

            {/* 搜索栏 - 使用带自动补全的 FilterAutocompleteInput */}
            <div className="flex gap-2 items-center">
              <FilterAutocompleteInput
                value={filter}
                onChange={setFilter}
                onSubmit={setFilter}
                collections={collections}
                baseCollection={fullCollection || collection}
                placeholder='Search term or filter like created > "2022-01-01"...'
                className="flex-1"
              />
              {!isView && (
                <Button variant="outline" size="sm" onClick={() => setUpsertOpen(true)} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  New record
                </Button>
              )}
            </div>

            {/* 记录列表 */}
            <TooltipProvider delayDuration={300}>
              <ScrollArea
                className="flex-1 border rounded-md max-h-[300px] min-h-[50px]"
                onScrollCapture={handleScroll}
              >
                <div className="p-1">
                  {displayList.length === 0 && !isLoading ? (
                    <div className="flex items-center justify-center h-[42px] text-muted-foreground text-sm">
                      <span>No records found.</span>
                      {filter && (
                        <Button variant="ghost" size="sm" onClick={() => setFilter('')} className="ml-2">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    displayList.map((record) => {
                      const recordSelected = isSelected(record)
                      const disabled = !recordSelected && isMultiple && !canSelectMore
                      const isReloading = isReloadingRecord[record.id]

                      return (
                        <div
                          key={record.id}
                          className={cn(
                            'group flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                            recordSelected && 'bg-green-50',
                            disabled && 'opacity-50 cursor-not-allowed',
                            !disabled && !recordSelected && 'hover:bg-slate-50'
                          )}
                          onClick={() => !disabled && !isReloading && toggleRecord(record)}
                        >
                          {/* 选中状态图标 */}
                          {recordSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                          )}
                          
                          {/* 头像/缩略图 */}
                          {(() => {
                            const avatarFilename = getRecordAvatar(record)
                            if (avatarFilename) {
                              return (
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <RecordFileThumb
                                    record={record}
                                    filename={avatarFilename}
                                    size="sm"
                                    className="w-7 h-7 rounded-full"
                                  />
                                </div>
                              )
                            }
                            return null
                          })()}
                          
                          {/* 记录内容 */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {isReloading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <span className="truncate">{getRecordDisplay(record)}</span>
                            )}
                          </div>
                          
                          {/* 操作按钮 */}
                          {!isView && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* 编辑按钮 */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingRecord(record)
                                      setUpsertOpen(true)
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Edit</TooltipContent>
                              </Tooltip>
                              
                              {/* 外部链接按钮（带 JSON tooltip） */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={`/_/#/collections?collection=${record.collectionId}&recordId=${record.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-slate-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="left" 
                                  className="max-w-sm font-mono text-xs whitespace-pre-wrap bg-slate-900 text-slate-100 border-slate-800"
                                >
                                  <div className="text-slate-400 mb-1">Open relation record in new tab:</div>
                                  {formatRecordJson(record)}
                                </TooltipContent>
                              </Tooltip>
                            </div>
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
            </TooltipProvider>

            {/* 已选择区域 */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-slate-700">
                Selected
                {isMultiple && (
                  <span className="text-muted-foreground ml-1">
                    ({selected.length} of MAX {maxSelect})
                  </span>
                )}
              </h5>
              {selected.length > 0 ? (
                <TooltipProvider delayDuration={300}>
                  <div className="flex flex-wrap gap-2 max-h-[100px] overflow-auto">
                    {selected.map((record) => {
                      const avatarFilename = getRecordAvatar(record)
                      return (
                        <Badge 
                          key={record.id} 
                          variant="secondary" 
                          className="bg-slate-100 text-slate-700 hover:bg-slate-200 pl-1.5 pr-1 py-1 gap-1.5"
                        >
                          {/* 头像 */}
                          {avatarFilename && (
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <RecordFileThumb
                                record={record}
                                filename={avatarFilename}
                                size="sm"
                                className="w-5 h-5 rounded-full"
                              />
                            </div>
                          )}
                          {isReloadingRecord[record.id] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="truncate max-w-[150px]">{getRecordDisplay(record)}</span>
                          )}
                          {/* 外部链接（带 tooltip） */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`/_/#/collections?collection=${record.collectionId}&recordId=${record.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-slate-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 text-slate-500" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="top" 
                              className="max-w-sm font-mono text-xs whitespace-pre-wrap bg-slate-900 text-slate-100 border-slate-800"
                            >
                              <div className="text-slate-400 mb-1">Open relation record in new tab:</div>
                              {formatRecordJson(record)}
                            </TooltipContent>
                          </Tooltip>
                          {/* 删除按钮 */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-slate-300 rounded"
                            onClick={() => deselectRecord(record)}
                          >
                            <X className="h-3 w-3 text-slate-500" />
                          </Button>
                        </Badge>
                      )
                    })}
                  </div>
                </TooltipProvider>
              ) : (
                <p className="text-sm text-muted-foreground">No selected records.</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Set selection</Button>
            </div>

            {/* Close button */}
            <button 
              type="button"
              className="absolute right-4 top-4 rounded-lg opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

      {/* 新建/编辑记录面板 - 使用比对话框更高的 z-index */}
      {fullCollection && (
        <UpsertPanel
          open={upsertOpen}
          onClose={() => {
            setUpsertOpen(false)
            setEditingRecord(null)
          }}
          collection={fullCollection}
          fields={fullCollection.fields || []}
          record={editingRecord || undefined}
          zIndex={dynamicZIndex + 10}
          onSave={async (data: Record<string, unknown>, files?: Record<string, File[]>) => {
            const isNew = !editingRecord
            
            // 使用 exportFormData 构建正确的 FormData（与 UI 版本一致）
            const formData = exportFormData({
              record: data,
              collection: fullCollection,
              uploadedFiles: files,
              deletedFiles: {},
            })
            
            let savedRecord: RecordItem
            
            try {
              if (editingRecord) {
                // 更新记录
                savedRecord = await pb.collection(fullCollection.name).update(editingRecord.id, formData) as RecordItem
              } else {
                // 创建记录
                savedRecord = await pb.collection(fullCollection.name).create(formData) as RecordItem
                // 添加到列表开头（与 UI 版本保持一致）
                setList((prev) => {
                  const filtered = prev.filter((r) => r.id !== savedRecord.id)
                  return [savedRecord, ...filtered]
                })
                // 自动选中新记录
                selectRecord(savedRecord)
              }
              
              // 重新加载记录以获取展开的关联数据（与 UI 版本保持一致）
              await reloadRecord(savedRecord.id)
              
              // 显示成功 Toast（与 UI 版本保持一致）
              toast({
                type: 'success',
                message: isNew ? 'Successfully created record.' : 'Successfully updated record.',
              })
              
              // 注意：不要在这里关闭面板
              // UpsertPanel 的 handleSave 会调用 onClose() 来关闭
              // 这样保持 RecordsPicker 打开，只关闭 UpsertPanel
            } catch (err) {
              console.error('RecordsPicker save error:', err)
              throw err // 重新抛出，让 UpsertPanel 处理
            }
          }}
          onDelete={editingRecord ? async () => {
            try {
              await pb.collection(fullCollection.name).delete(editingRecord.id)
              // 从列表和已选中移除
              setList(prev => prev.filter(r => r.id !== editingRecord.id))
              setSelected(prev => prev.filter(r => r.id !== editingRecord.id))
              // 注意：不要在这里关闭面板
              // UpsertPanel 的 handleDelete 会调用 onClose() 来关闭
            } catch (err) {
              throw err
            }
          } : undefined}
        />
      )}
    </>,
    document.body
  )
}
