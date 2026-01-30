// T047: Collection 创建/编辑面板
import { useState, useEffect, useCallback } from 'react'
import type { CollectionModel } from 'pocketbase'
import { useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Copy, Files, Eraser, Trash2, ChevronDown, Database, Users, Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CollectionFieldsTab, type CollectionData } from './CollectionFieldsTab'
import { CollectionRulesTab } from './CollectionRulesTab'
import { CollectionAuthOptionsTab } from './CollectionAuthOptionsTab'
import { addToast } from '@/store/toasts'
import { showConfirmation } from '@/store/confirmation'
import { useCollections } from '../hooks/useCollections'
import { cn } from '@/lib/utils'

interface UpsertPanelProps {
  open: boolean
  onClose: () => void
  collection?: CollectionModel | null
  onSave: (data: Partial<CollectionModel>) => Promise<void>
  onDelete?: () => void
  onTruncate?: () => void
  onDuplicate?: (collection: CollectionModel) => void
}

const defaultCollection: Partial<CollectionModel> & {
  fields: any[]
  indexes: string[]
  listRule?: string | null
  viewRule?: string | null
  createRule?: string | null
  updateRule?: string | null
  deleteRule?: string | null
  authRule?: string
  manageRule?: string | null
  // Auth 选项
  passwordAuth?: {
    enabled: boolean
    identityFields: string[]
  }
  oauth2?: {
    enabled: boolean
    providers: any[]
  }
  otp?: {
    enabled: boolean
    duration: number
    length: number
    emailTemplate?: Record<string, any>
  }
  mfa?: {
    enabled: boolean
    rule: string
  }
  authAlert?: {
    enabled: boolean
    emailTemplate?: Record<string, any>
  }
  authToken?: {
    duration: number
  }
  verificationToken?: {
    duration: number
  }
  passwordResetToken?: {
    duration: number
  }
  emailChangeToken?: {
    duration: number
  }
} = {
  name: '',
  type: 'base',
  schema: [],
  fields: [],
  indexes: [],
  listRule: '',
  viewRule: '',
  createRule: '',
  updateRule: '',
  deleteRule: '',
  // Auth 默认值
  passwordAuth: {
    enabled: true,
    identityFields: ['email'],
  },
  oauth2: {
    enabled: false,
    providers: [],
  },
  otp: {
    enabled: false,
    duration: 300,
    length: 6,
    emailTemplate: {},
  },
  mfa: {
    enabled: false,
    rule: '',
  },
  authAlert: {
    enabled: false,
    emailTemplate: {},
  },
  authToken: {
    duration: 1209600,
  },
  verificationToken: {
    duration: 604800,
  },
  passwordResetToken: {
    duration: 1800,
  },
  emailChangeToken: {
    duration: 1800,
  },
}

/**
 * Collection 创建/编辑面板
 */
export function UpsertPanel({ open, onClose, collection, onSave, onDelete, onTruncate, onDuplicate }: UpsertPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useSetAtom(addToast)
  const confirm = useSetAtom(showConfirmation)
  const { destroyCollection, truncateCollection, createCollection } = useCollections()

  const [formData, setFormData] = useState<typeof defaultCollection>(defaultCollection)
  const [saving, setSaving] = useState(false)

  const isEdit = !!collection?.id
  const isViewCollection = formData.type === 'view'
  const isSystemCollection = collection?.system || false

  useEffect(() => {
    if (collection) {
      setFormData({
        ...collection,
        fields: (collection as any).fields || [],
        indexes: (collection as any).indexes || [],
        listRule: (collection as any).listRule ?? '',
        viewRule: (collection as any).viewRule ?? '',
        createRule: (collection as any).createRule ?? '',
        updateRule: (collection as any).updateRule ?? '',
        deleteRule: (collection as any).deleteRule ?? '',
        authRule: (collection as any).authRule ?? '',
        manageRule: (collection as any).manageRule ?? null,
        // Auth 选项
        passwordAuth: (collection as any).passwordAuth ?? defaultCollection.passwordAuth,
        oauth2: (collection as any).oauth2 ?? defaultCollection.oauth2,
        otp: (collection as any).otp ?? defaultCollection.otp,
        mfa: (collection as any).mfa ?? defaultCollection.mfa,
        authAlert: (collection as any).authAlert ?? defaultCollection.authAlert,
        authToken: (collection as any).authToken ?? defaultCollection.authToken,
        verificationToken:
          (collection as any).verificationToken ?? defaultCollection.verificationToken,
        passwordResetToken:
          (collection as any).passwordResetToken ?? defaultCollection.passwordResetToken,
        emailChangeToken:
          (collection as any).emailChangeToken ?? defaultCollection.emailChangeToken,
      })
    } else {
      setFormData(defaultCollection)
    }
  }, [collection, open])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (saving) return
    
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Save collection failed:', error)
    } finally {
      setSaving(false)
    }
  }

  // 处理字段变更
  const handleCollectionChange = useCallback((updated: CollectionData) => {
    setFormData((prev) => ({
      ...prev,
      fields: updated.fields,
      indexes: updated.indexes,
    }))
  }, [])

  // 处理规则变更
  const handleRulesChange = useCallback((updates: Partial<typeof defaultCollection>) => {
    setFormData((prev) => ({
      ...prev,
      ...updates,
    }))
  }, [])

  // 处理 Auth 选项变更
  const handleAuthOptionsChange = useCallback((updates: Partial<typeof defaultCollection>) => {
    setFormData((prev) => ({
      ...prev,
      ...updates,
    }))
  }, [])

  // Copy raw JSON
  const handleCopyJSON = useCallback(() => {
    if (!collection) return
    try {
      navigator.clipboard.writeText(JSON.stringify(collection, null, 2))
      toast({ type: 'success', message: t('collections.jsonCopied', 'Collection JSON 已复制到剪贴板') })
    } catch (err) {
      toast({ type: 'error', message: t('collections.jsonCopyError', '复制失败') })
    }
  }, [collection, toast, t])

  // Duplicate Collection
  const handleDuplicate = useCallback(() => {
    if (!collection) return

    // 深拷贝 collection
    const clone: Partial<CollectionModel> = structuredClone(collection)
    
    // 清空 id, created, updated
    delete clone.id
    delete clone.created
    delete clone.updated
    clone.name = (clone.name || '') + '_duplicate'

    // 重置字段 ID
    if (clone.fields && Array.isArray(clone.fields)) {
      for (const field of clone.fields as any[]) {
        field.id = ''
      }
    }

    // 更新索引名称
    if ((clone as any).indexes && Array.isArray((clone as any).indexes)) {
      for (let i = 0; i < (clone as any).indexes.length; i++) {
        const idx = (clone as any).indexes[i]
        // 简单替换索引名
        if (typeof idx === 'string') {
          (clone as any).indexes[i] = idx.replace(/idx_\w+/, `idx_${Math.random().toString(36).substring(2, 12)}`)
        }
      }
    }

    // 关闭当前面板，通知外部打开新面板
    onClose()
    if (onDuplicate) {
      onDuplicate(clone as CollectionModel)
    }
  }, [collection, onClose, onDuplicate])

  // Truncate Collection (清空所有记录)
  const handleTruncate = useCallback(() => {
    if (!collection?.id) return

    confirm({
      title: t('collections.truncateConfirmTitle', '确认清空'),
      message: t('collections.truncateConfirmMessage', `确定要清空 "${collection.name}" 的所有记录吗？此操作包括级联删除关联的记录和文件，且不可恢复。`),
      yesText: t('common.confirm', '确认'),
      noText: t('common.cancel', '取消'),
      onConfirm: async () => {
        try {
          await truncateCollection(collection.id)
          toast({ type: 'success', message: t('collections.truncateSuccess', `已清空 "${collection.name}" 的所有记录`) })
          onClose()
          if (onTruncate) onTruncate()
        } catch (err) {
          toast({
            type: 'error',
            message: err instanceof Error ? err.message : t('collections.truncateError', '清空失败'),
          })
        }
      },
    })
  }, [collection, confirm, truncateCollection, toast, t, onClose, onTruncate])

  // Delete Collection
  const handleDelete = useCallback(() => {
    if (!collection?.id) return

    confirm({
      title: t('collections.deleteConfirmTitle', '确认删除'),
      message: t('collections.deleteConfirmMessage', `确定要删除 "${collection.name}" 及其所有记录吗？此操作不可恢复。`),
      yesText: t('common.delete', '删除'),
      noText: t('common.cancel', '取消'),
      onConfirm: async () => {
        try {
          await destroyCollection(collection.id)
          toast({ type: 'success', message: t('collections.deleteSuccess', '删除成功') })
          onClose()
          if (onDelete) onDelete()
          navigate('/collections')
        } catch (err) {
          toast({
            type: 'error',
            message: err instanceof Error ? err.message : t('collections.deleteError', '删除失败'),
          })
        }
      },
    })
  }, [collection, confirm, destroyCollection, toast, t, onClose, onDelete, navigate])

  // 类型描述映射
  const typeDescriptions: Record<string, string> = {
    auth: '用于存储用户账户数据，包含内置的认证字段',
    base: '标准数据表，用于存储应用数据',
    view: '只读视图，基于 SQL 查询',
  }

  // Tab 定义
  const TAB_SCHEMA = 'schema'
  const TAB_RULES = 'rules'
  const TAB_OPTIONS = 'options'

  const [activeTab, setActiveTab] = useState(TAB_SCHEMA)

  // 当类型不是 auth 时，重置 tab 到 schema
  useEffect(() => {
    if (formData.type !== 'auth' && activeTab === TAB_OPTIONS) {
      setActiveTab(TAB_SCHEMA)
    }
  }, [formData.type, activeTab])

  // _superusers 不显示 API Rules tab
  const isSuperusers = collection?.system && collection?.name === '_superusers'

  // 类型图标
  const typeIcons: Record<string, React.ReactNode> = {
    base: <Database className="h-4 w-4" />,
    auth: <Users className="h-4 w-4" />,
    view: <Eye className="h-4 w-4" />,
  }

  // 类型标签
  const typeLabels: Record<string, string> = {
    base: 'Base',
    auth: 'Auth',
    view: 'View',
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed top-0 right-0 h-full w-[700px] bg-background shadow-xl flex flex-col">
        {/* Header 区域 - 带背景色 */}
        <div className="bg-slate-50 border-b">
          {/* 标题行 */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
            <h2 className="text-base font-semibold">
              {isEdit ? 'Edit collection' : 'New collection'}
            </h2>
            <div className="flex items-center gap-1">
              {/* 更多操作下拉菜单 - 仅编辑模式且非系统集合显示 */}
              {isEdit && !isViewCollection && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleCopyJSON}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy raw JSON
                    </DropdownMenuItem>
                    {!isSystemCollection && (
                      <>
                        <DropdownMenuItem onClick={handleDuplicate}>
                          <Files className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {!isViewCollection && (
                      <DropdownMenuItem
                        onClick={handleTruncate}
                        className="text-destructive focus:text-destructive"
                      >
                        <Eraser className="h-4 w-4 mr-2" />
                        Truncate
                      </DropdownMenuItem>
                    )}
                    {!isSystemCollection && (
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 名称输入 + 类型选择器 */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Name</label>
                <div className="flex">
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => {
                      // slugify: 只允许字母、数字、下划线
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                      setFormData((prev) => ({ ...prev, name: value }))
                    }}
                    placeholder={formData.type === 'auth' ? 'eg. "users"' : 'eg. "posts"'}
                    className={cn(
                      'rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-blue-500',
                      isSystemCollection && 'font-bold'
                    )}
                    disabled={isSystemCollection}
                    required
                    autoFocus={!isEdit}
                  />
                  {/* 类型选择器作为 addon */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'rounded-l-none border-l-0 px-3 gap-2',
                          isEdit && 'pointer-events-none opacity-70'
                        )}
                        disabled={isEdit}
                      >
                        <span className="text-sm">Type: {typeLabels[formData.type || 'base']}</span>
                        {!isEdit && <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </DropdownMenuTrigger>
                    {!isEdit && (
                      <DropdownMenuContent align="end" className="w-48">
                        {Object.entries(typeLabels).map(([type, label]) => (
                          <DropdownMenuItem
                            key={type}
                            onClick={() => setFormData((prev) => ({ ...prev, type: type as any }))}
                            className={cn(formData.type === type && 'bg-blue-50 text-blue-600')}
                          >
                            {typeIcons[type]}
                            <span className="ml-2">{label} collection</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                </div>
                {isSystemCollection && (
                  <p className="text-xs text-muted-foreground mt-1">System collection</p>
                )}
              </div>
            </div>
          </div>

          {/* Tabs Header */}
          <div className="flex border-t border-slate-200">
            <button
              type="button"
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === TAB_SCHEMA
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
              onClick={() => setActiveTab(TAB_SCHEMA)}
            >
              {isViewCollection ? 'Query' : 'Fields'}
            </button>
            {!isSuperusers && (
              <button
                type="button"
                className={cn(
                  'flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === TAB_RULES
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                )}
                onClick={() => setActiveTab(TAB_RULES)}
              >
                API Rules
              </button>
            )}
            {formData.type === 'auth' && (
              <button
                type="button"
                className={cn(
                  'flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === TAB_OPTIONS
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                )}
                onClick={() => setActiveTab(TAB_OPTIONS)}
              >
                Options
              </button>
            )}
          </div>
        </div>

        {/* Content 区域 */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Fields/Query Tab */}
            {activeTab === TAB_SCHEMA && (
              <CollectionFieldsTab
                collection={{
                  id: formData.id,
                  name: formData.name || '',
                  type: (formData.type as 'base' | 'auth' | 'view') || 'base',
                  fields: formData.fields || [],
                  indexes: formData.indexes || [],
                }}
                onChange={handleCollectionChange}
              />
            )}

            {/* API Rules Tab */}
            {activeTab === TAB_RULES && !isSuperusers && (
              <CollectionRulesTab
                collection={{
                  id: formData.id,
                  name: formData.name || '',
                  type: (formData.type as 'base' | 'auth' | 'view') || 'base',
                  system: (formData as any).system,
                  fields: formData.fields || [],
                  listRule: formData.listRule,
                  viewRule: formData.viewRule,
                  createRule: formData.createRule,
                  updateRule: formData.updateRule,
                  deleteRule: formData.deleteRule,
                  authRule: formData.authRule,
                  manageRule: formData.manageRule,
                }}
                onChange={handleRulesChange}
              />
            )}

            {/* Options Tab (Auth only) */}
            {activeTab === TAB_OPTIONS && formData.type === 'auth' && (
              <CollectionAuthOptionsTab
                collection={{
                  id: formData.id,
                  name: formData.name || '',
                  type: 'auth',
                  system: (formData as any).system,
                  fields: formData.fields || [],
                  indexes: formData.indexes || [],
                  passwordAuth: formData.passwordAuth!,
                  oauth2: formData.oauth2!,
                  otp: formData.otp!,
                  mfa: formData.mfa!,
                  authAlert: formData.authAlert!,
                  authToken: formData.authToken!,
                  verificationToken: formData.verificationToken!,
                  passwordResetToken: formData.passwordResetToken!,
                  emailChangeToken: formData.emailChangeToken!,
                }}
                onChange={handleAuthOptionsChange}
              />
            )}
          </div>
        </ScrollArea>

        {/* Footer 区域 */}
        <div className="h-14 px-4 border-t flex items-center justify-between bg-background">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UpsertPanel
