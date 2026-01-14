/**
 * Collections 侧边栏组件
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAtom, useSetAtom } from 'jotai'
import { Plus, Search } from 'lucide-react'
import { useCollections } from '../hooks/useCollections'
import { searchQueryAtom, filteredCollectionsAtom } from '../store'
import { CollectionItem } from './CollectionItem'
import { UpsertPanel } from './UpsertPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addToast } from '@/store/toasts'
import { showConfirmation } from '@/store/confirmation'
import type { CollectionModel } from 'pocketbase'

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
        title: t('collections.deleteConfirmTitle', '确认删除'),
        message: t(
          'collections.deleteConfirmMessage',
          `确定要删除 Collection "${collection.name}" 吗？此操作不可恢复。`
        ),
        yesText: t('common.delete', '删除'),
        noText: t('common.cancel', '取消'),
        onConfirm: async () => {
          try {
            await destroyCollection(collection.id)
            toast({ type: 'success', message: t('collections.deleteSuccess', '删除成功') })
            if (activeCollection?.id === collection.id) {
              navigate('/collections')
            }
          } catch (err) {
            toast({
              type: 'error',
              message:
                err instanceof Error ? err.message : t('collections.deleteError', '删除失败'),
            })
          }
        },
      })
    },
    [confirm, destroyCollection, toast, t, activeCollection, navigate]
  )

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
          toast({ type: 'success', message: t('collections.updateSuccess', '更新成功') })
        } else {
          const created = await createCollection(data)
          toast({ type: 'success', message: t('collections.createSuccess', '创建成功') })
          navigate(`/collections/${created.name}`)
        }
      } catch (err) {
        toast({
          type: 'error',
          message: err instanceof Error ? err.message : t('collections.saveError', '保存失败'),
        })
        throw err
      }
    },
    [editingCollection, saveCollection, createCollection, toast, t, navigate]
  )

  // 按系统/用户分组：系统 collection（以 _ 开头）放在 System 组
  const groupedCollections = {
    system: filteredCollections.filter((c) => c.name.startsWith('_')),
    user: filteredCollections.filter((c) => !c.name.startsWith('_')),
  }

  return (
    <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col h-full">
      {/* 头部：搜索框 + 新建按钮 */}
      <div className="h-14 px-3 border-b border-slate-200 flex items-center">
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('collections.search', '搜索...')}
              className="h-8 pl-8 text-sm rounded-lg border-slate-200"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            onClick={handleNew}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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
              ? t('collections.noResults', '没有找到匹配的 Collection')
              : t('collections.empty', '暂无 Collection')}
          </div>
        ) : (
          <>
            {/* 用户 Collections（不分组，直接列出） */}
            {groupedCollections.user.length > 0 && (
              <div>
                {groupedCollections.user.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    isActive={activeCollection?.id === collection.id}
                    onClick={() => handleClick(collection)}
                    onEdit={() => handleEdit(collection)}
                    onDelete={() => handleDelete(collection)}
                  />
                ))}
              </div>
            )}

            {/* 系统 Collections */}
            {groupedCollections.system.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-400 px-3 py-1">System</div>
                {groupedCollections.system.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    isActive={activeCollection?.id === collection.id}
                    onClick={() => handleClick(collection)}
                    onEdit={() => handleEdit(collection)}
                    onDelete={() => handleDelete(collection)}
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
      />
    </div>
  )
}

export default CollectionsSidebar
