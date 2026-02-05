/**
 * Collections 侧边栏组件
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAtom, useSetAtom } from 'jotai'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { useCollections } from '../hooks/useCollections'
import { searchQueryAtom, filteredCollectionsAtom } from '../store'
import { CollectionItem } from './CollectionItem'
import { UpsertPanel } from './UpsertPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addToast } from '@/store/toasts'
import { showConfirmation } from '@/store/confirmation'
import type { CollectionModel } from 'pocketbase'
import { cn } from '@/lib/utils'

const PINNED_STORAGE_KEY = '@pinnedCollections'

// 加载 pinned IDs
function loadPinnedIds(): string[] {
  try {
    const encoded = localStorage.getItem(PINNED_STORAGE_KEY)
    if (encoded) {
      return JSON.parse(encoded) || []
    }
  } catch {
    // 忽略解析错误
  }
  return []
}

// 保存 pinned IDs
function savePinnedIds(ids: string[]) {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids))
}

export function CollectionsSidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { collectionId } = useParams()
  const toast = useSetAtom(addToast)
  const confirm = useSetAtom(showConfirmation)

  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)
  const [filteredCollections] = useAtom(filteredCollectionsAtom)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<CollectionModel | null>(null)
  // System 分组默认收起
  const [systemExpanded, setSystemExpanded] = useState(false)
  // Pinned collections
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinnedIds)

  const {
    collections,
    loading,
    activeCollection,
    setActiveCollection,
    fetchCollections,
    createCollection,
    saveCollection,
    destroyCollection,
  } = useCollections()

  // 加载 Collections
  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  // 根据 URL 设置 activeCollection
  useEffect(() => {
    if (collectionId && collections.length > 0) {
      const found = collections.find((c) => c.id === collectionId || c.name === collectionId)
      if (found) {
        setActiveCollection(found)
      }
    }
  }, [collectionId, collections, setActiveCollection])

  // 处理点击
  const handleClick = useCallback(
    (collection: CollectionModel) => {
      setActiveCollection(collection)
      navigate(`/collections/${collection.name}`)
    },
    [setActiveCollection, navigate]
  )

  // 处理编辑
  const handleEdit = useCallback((collection: CollectionModel) => {
    setEditingCollection(collection)
    setPanelOpen(true)
  }, [])

  // 处理删除
  const handleDelete = useCallback(
    (collection: CollectionModel) => {
      confirm({
        title: t('collections.deleteConfirmTitle', 'Confirm Delete'),
        message: t(
          'collections.deleteConfirmMessage',
          `Are you sure you want to delete Collection "${collection.name}"? This action cannot be undone.`
        ),
        yesText: t('common.delete', 'Delete'),
        noText: t('common.cancel', 'Cancel'),
        onConfirm: async () => {
          try {
            await destroyCollection(collection.id)
            toast({ type: 'success', message: t('collections.deleteSuccess', 'Deleted successfully') })
            if (activeCollection?.id === collection.id) {
              navigate('/collections')
            }
          } catch (err) {
            toast({
              type: 'error',
              message:
                err instanceof Error ? err.message : t('collections.deleteError', 'Delete failed'),
            })
          }
        },
      })
    },
    [confirm, destroyCollection, toast, t, activeCollection, navigate]
  )

  // 处理 Pin/Unpin
  const handleTogglePin = useCallback((collection: CollectionModel) => {
    setPinnedIds((prev) => {
      const newIds = prev.includes(collection.id)
        ? prev.filter((id) => id !== collection.id)
        : [...prev, collection.id]
      savePinnedIds(newIds)
      return newIds
    })
  }, [])

  // 同步 pinned IDs（移除不存在的 collection）
  useEffect(() => {
    if (collections.length > 0) {
      const validIds = pinnedIds.filter((id) => collections.some((c) => c.id === id))
      if (validIds.length !== pinnedIds.length) {
        setPinnedIds(validIds)
        savePinnedIds(validIds)
      }
    }
  }, [collections, pinnedIds])

  // 处理新建
  const handleNew = useCallback(() => {
    setEditingCollection(null)
    setPanelOpen(true)
  }, [])

  // 处理保存
  const handleSave = useCallback(
    async (data: Partial<CollectionModel>) => {
      try {
        if (editingCollection) {
          await saveCollection(editingCollection.id, data)
          toast({ type: 'success', message: t('collections.updateSuccess', 'Updated successfully') })
        } else {
          const created = await createCollection(data)
          toast({ type: 'success', message: t('collections.createSuccess', 'Created successfully') })
          navigate(`/collections/${created.name}`)
        }
      } catch (err) {
        toast({
          type: 'error',
          message: err instanceof Error ? err.message : t('collections.saveError', 'Save failed'),
        })
        throw err
      }
    },
    [editingCollection, saveCollection, createCollection, toast, t, navigate]
  )

  // 按 Pinned/Others/System 分组
  const groupedCollections = useMemo(() => ({
    pinned: filteredCollections.filter((c) => pinnedIds.includes(c.id)),
    others: filteredCollections.filter((c) => !c.name.startsWith('_') && !pinnedIds.includes(c.id)),
    system: filteredCollections.filter((c) => c.name.startsWith('_') && !pinnedIds.includes(c.id)),
  }), [filteredCollections, pinnedIds])

  return (
    <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col h-full">
      {/* 头部：搜索框 + 新建按钮 */}
      <div className="h-14 px-3 border-b border-slate-200 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search collections..."
            className="h-8 pl-8 text-sm rounded-lg border-slate-200"
          />
        </div>
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleNew}
          title="New collection"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto p-2 space-y-4">
        {loading ? (
          <div className="text-center text-slate-500 text-sm py-4">
            {t('common.loading', 'Loading...')}
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-4">
            {searchQuery
              ? 'No collections found.'
              : 'No collections yet.'}
          </div>
        ) : (
          <>
            {/* Pinned Collections */}
            {groupedCollections.pinned.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-400 px-3 py-1">Pinned</div>
                {groupedCollections.pinned.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    isActive={activeCollection?.id === collection.id}
                    isPinned={true}
                    onClick={() => handleClick(collection)}
                    onEdit={() => handleEdit(collection)}
                    onDelete={() => handleDelete(collection)}
                    onTogglePin={() => handleTogglePin(collection)}
                  />
                ))}
              </div>
            )}

            {/* Others Collections（非系统、非 Pinned） */}
            {groupedCollections.others.length > 0 && (
              <div>
                {groupedCollections.pinned.length > 0 && (
                  <div className="text-xs font-medium text-slate-400 px-3 py-1">Others</div>
                )}
                {groupedCollections.others.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    isActive={activeCollection?.id === collection.id}
                    isPinned={false}
                    onClick={() => handleClick(collection)}
                    onEdit={() => handleEdit(collection)}
                    onDelete={() => handleDelete(collection)}
                    onTogglePin={() => handleTogglePin(collection)}
                  />
                ))}
              </div>
            )}

            {/* 系统 Collections（可折叠，默认收起） */}
            {groupedCollections.system.length > 0 && (
              <div>
                <button
                  onClick={() => setSystemExpanded(!systemExpanded)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-400 px-3 py-1 hover:text-slate-600 w-full text-left"
                >
                  <ChevronRight 
                    className={cn(
                      "h-3 w-3 transition-transform",
                      systemExpanded && "rotate-90"
                    )} 
                  />
                  System ({groupedCollections.system.length})
                </button>
                {systemExpanded && groupedCollections.system.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    isActive={activeCollection?.id === collection.id}
                    isPinned={false}
                    onClick={() => handleClick(collection)}
                    onEdit={() => handleEdit(collection)}
                    onDelete={() => handleDelete(collection)}
                    onTogglePin={() => handleTogglePin(collection)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 编辑面板 */}
      <UpsertPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        collection={editingCollection}
        onSave={handleSave}
        onDelete={() => {
          // 如果删除的是当前选中的 collection，跳转到首页
          if (activeCollection?.id === editingCollection?.id) {
            navigate('/collections')
          }
          fetchCollections()
        }}
        onTruncate={() => {
          // 清空记录后刷新
          fetchCollections()
        }}
        onDuplicate={(clonedCollection) => {
          // 打开新面板显示克隆的 collection
          setEditingCollection(clonedCollection)
          setPanelOpen(true)
        }}
      />
    </div>
  )
}

export default CollectionsSidebar
