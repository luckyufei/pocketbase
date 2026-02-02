/**
 * Records 页面
 */
import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAtomValue, useSetAtom } from 'jotai'
import { Plus, RefreshCw, Trash2, Settings, Code } from 'lucide-react'
import { activeCollectionAtom, collectionsAtom } from '@/features/collections/store'
import { setPageTitle } from '@/store/app'
import { addToast } from '@/store/toasts'
import { showConfirmation } from '@/store/confirmation'
import { useRecords } from '@/features/records/hooks/useRecords'
import { useCollections } from '@/features/collections/hooks/useCollections'
import { isAllSelectedAtom } from '@/features/records/store'
import { RecordsTable } from '@/features/records/components/RecordsTable'
import { UpsertPanel as RecordUpsertPanel } from '@/features/records/components/UpsertPanel'
import { UpsertPanel as CollectionUpsertPanel } from '@/features/collections/components/UpsertPanel'
import { CollectionDocsPanel } from '@/features/collections/components/docs/CollectionDocsPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RecordModel, CollectionModel } from 'pocketbase'

// 懒加载 FilterAutocompleteInput（因为 CodeMirror 比较重）
const FilterAutocompleteInput = lazy(() => import('@/components/FilterAutocompleteInput'))

export function RecordsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { collectionId } = useParams()
  const collection = useAtomValue(activeCollectionAtom)
  const collections = useAtomValue(collectionsAtom)
  const isAllSelected = useAtomValue(isAllSelectedAtom)
  const setTitle = useSetAtom(setPageTitle)
  const toast = useSetAtom(addToast)
  const confirm = useSetAtom(showConfirmation)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RecordModel | null>(null)
  const [collectionPanelOpen, setCollectionPanelOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<CollectionModel | null>(null)
  const [docsPanelOpen, setDocsPanelOpen] = useState(false)

  const { saveCollection, fetchCollections } = useCollections()

  const {
    records,
    loading,
    selectedIds,
    sortState,
    filter,
    setFilter,
    setSortState,
    fetchRecords,
    createRecord,
    saveRecord,
    destroyRecord,
    destroyRecords,
    toggleSelection,
    toggleAll,
    reset,
  } = useRecords(collectionId || '')

  // 设置页面标题
  useEffect(() => {
    if (collection) {
      setTitle(collection.name)
    }
  }, [collection, setTitle])

  // 加载 Records
  useEffect(() => {
    if (collectionId) {
      reset()
      fetchRecords()
    }
  }, [collectionId, fetchRecords, reset])

  // 处理排序
  const handleSort = useCallback(
    (field: string) => {
      setSortState((prev) => {
        if (prev?.field === field) {
          return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        }
        return { field, direction: 'asc' }
      })
    },
    [setSortState]
  )

  // 排序变化时重新加载
  useEffect(() => {
    if (collectionId && sortState) {
      fetchRecords()
    }
  }, [sortState, collectionId, fetchRecords])

  // 筛选变化时重新加载
  useEffect(() => {
    if (collectionId) {
      const timer = setTimeout(() => {
        fetchRecords()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [filter, collectionId, fetchRecords])

  // 处理行点击
  const handleRowClick = useCallback((record: RecordModel) => {
    setEditingRecord(record)
    setPanelOpen(true)
  }, [])

  // 处理新建
  const handleNew = useCallback(() => {
    setEditingRecord(null)
    setPanelOpen(true)
  }, [])

  // 处理保存
  const handleSave = useCallback(
    async (data: Record<string, unknown>, files?: Record<string, File[]>) => {
      try {
        // 如果有文件上传，需要使用 FormData
        let saveData: Record<string, unknown> | FormData = data

        if (files && Object.keys(files).some((key) => files[key]?.length > 0)) {
          const formData = new FormData()

          // 添加普通字段
          for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) continue
            if (Array.isArray(value)) {
              // 数组字段（如 relation、select 等）
              for (const item of value) {
                formData.append(key, String(item))
              }
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value))
            } else {
              formData.append(key, String(value))
            }
          }

          // 添加新文件
          for (const [fieldName, fieldFiles] of Object.entries(files)) {
            for (const file of fieldFiles) {
              formData.append(`${fieldName}+`, file)
            }
          }

          saveData = formData
        }

        if (editingRecord) {
          await saveRecord(editingRecord.id, saveData)
          toast({ type: 'success', message: t('records.updateSuccess', '更新成功') })
        } else {
          await createRecord(saveData)
          toast({ type: 'success', message: t('records.createSuccess', '创建成功') })
        }
      } catch (err) {
        toast({
          type: 'error',
          message: err instanceof Error ? err.message : t('records.saveError', '保存失败'),
        })
        throw err
      }
    },
    [editingRecord, saveRecord, createRecord, toast, t]
  )

  // 处理删除选中
  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    confirm({
      title: t('records.deleteConfirmTitle', '确认删除'),
      message: t('records.deleteConfirmMessage', `确定要删除选中的 ${ids.length} 条记录吗？`),
      yesText: t('common.delete', '删除'),
      noText: t('common.cancel', '取消'),
      onConfirm: async () => {
        try {
          await destroyRecords(ids)
          toast({ type: 'success', message: t('records.deleteSuccess', '删除成功') })
        } catch (err) {
          toast({
            type: 'error',
            message: err instanceof Error ? err.message : t('records.deleteError', '删除失败'),
          })
        }
      },
    })
  }, [selectedIds, confirm, destroyRecords, toast, t])

  // 处理 Collection 保存
  const handleCollectionSave = useCallback(
    async (data: Partial<CollectionModel>) => {
      try {
        if (collection?.id) {
          await saveCollection(collection.id, data)
          toast({ type: 'success', message: t('collections.updateSuccess', '更新成功') })
        }
      } catch (err) {
        toast({
          type: 'error',
          message: err instanceof Error ? err.message : t('collections.saveError', '保存失败'),
        })
        throw err
      }
    },
    [collection, saveCollection, toast, t]
  )

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('records.selectCollection', '请选择一个 Collection')}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{collection.name}</h2>
          {/* 编辑 Collection 按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditingCollection(collection)
              setCollectionPanelOpen(true)
            }}
            title={t('collections.edit', '编辑 Collection')}
          >
            <Settings className="h-4 w-4" />
          </Button>
          {/* 刷新 Records 按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => fetchRecords()}
            disabled={loading}
            title={t('records.refresh', '刷新')}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <span className="text-sm text-muted-foreground">
            {records.totalItems} {t('records.total', '条记录')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={<div className="w-80 h-9 border rounded-md bg-muted/30 animate-pulse" />}>
            <FilterAutocompleteInput
              value={filter}
              onChange={setFilter}
              onSubmit={() => fetchRecords()}
              collections={collections}
              baseCollection={collection}
              placeholder={t('records.filterPlaceholder', 'Filter records, e.g. created > @now')}
              className="w-80"
            />
          </Suspense>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
              <Trash2 className="w-4 h-4 mr-1" />
              {t('records.deleteSelected', `删除 (${selectedIds.size})`)}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDocsPanelOpen(true)}>
            <Code className="w-4 h-4 mr-1" />
            {t('records.apiPreview', 'API Preview')}
          </Button>
          <Button size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1" />
            {t('records.new', 'New Record')}
          </Button>
        </div>
      </div>

      {/* Records 表格 */}
      <div className="flex-1 overflow-auto">
        <RecordsTable
          records={records.items}
          fields={collection.fields || []}
          collection={collection}
          selectedIds={selectedIds}
          isAllSelected={isAllSelected}
          sortState={sortState}
          onSort={handleSort}
          onSelect={toggleSelection}
          onSelectAll={toggleAll}
          onRowClick={handleRowClick}
        />
      </div>

      {/* 分页 */}
      {records.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={records.page <= 1}
            onClick={() => fetchRecords(records.page - 1)}
          >
            {t('common.prev', '上一页')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {records.page} / {records.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={records.page >= records.totalPages}
            onClick={() => fetchRecords(records.page + 1)}
          >
            {t('common.next', '下一页')}
          </Button>
        </div>
      )}

      {/* Record 编辑面板 */}
      <RecordUpsertPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        record={editingRecord}
        fields={collection.fields || []}
        collection={collection}
        onSave={handleSave}
      />

      {/* Collection 编辑面板 */}
      <CollectionUpsertPanel
        open={collectionPanelOpen}
        onClose={() => setCollectionPanelOpen(false)}
        collection={editingCollection}
        onSave={handleCollectionSave}
        onDelete={() => {
          navigate('/collections')
          fetchCollections()
        }}
        onTruncate={() => {
          fetchRecords()
        }}
        onDuplicate={(clonedCollection) => {
          setEditingCollection(clonedCollection)
          setCollectionPanelOpen(true)
        }}
      />

      {/* API 文档面板 */}
      <CollectionDocsPanel
        collection={collection}
        open={docsPanelOpen}
        onOpenChange={setDocsPanelOpen}
      />
    </div>
  )
}

export default RecordsPage
