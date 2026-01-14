/**
 * Records 页面
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Plus, RefreshCw, Trash2, Filter } from 'lucide-react'
import { activeCollectionAtom } from '@/features/collections/store'
import { setPageTitle } from '@/store/app'
import { addToast } from '@/store/toasts'
import { showConfirmation } from '@/store/confirmation'
import { useRecords } from '@/features/records/hooks/useRecords'
import { isAllSelectedAtom } from '@/features/records/store'
import { RecordsTable } from '@/features/records/components/RecordsTable'
import { UpsertPanel } from '@/features/records/components/UpsertPanel'
import { Button } from '@/components/ui/button'
import { Searchbar } from '@/components/Searchbar'
import { cn } from '@/lib/utils'
import type { RecordModel } from 'pocketbase'

export function RecordsPage() {
  const { t } = useTranslation()
  const { collectionId } = useParams()
  const collection = useAtomValue(activeCollectionAtom)
  const isAllSelected = useAtomValue(isAllSelectedAtom)
  const setTitle = useSetAtom(setPageTitle)
  const toast = useSetAtom(addToast)
  const confirm = useSetAtom(showConfirmation)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RecordModel | null>(null)

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
    async (data: Record<string, unknown>) => {
      try {
        if (editingRecord) {
          await saveRecord(editingRecord.id, data)
          toast({ type: 'success', message: t('records.updateSuccess', '更新成功') })
        } else {
          await createRecord(data)
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
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{collection.name}</h2>
          <span className="text-sm text-muted-foreground">
            {records.totalItems} {t('records.total', '条记录')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Searchbar
            value={filter}
            onChange={setFilter}
            placeholder={t('records.filter', '筛选...')}
            className="w-64"
          />
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
              <Trash2 className="w-4 h-4 mr-1" />
              {t('records.deleteSelected', `删除 (${selectedIds.size})`)}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchRecords()} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
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

      {/* 编辑面板 */}
      <UpsertPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        record={editingRecord}
        fields={collection.fields || []}
        onSave={handleSave}
      />
    </div>
  )
}

export default RecordsPage
