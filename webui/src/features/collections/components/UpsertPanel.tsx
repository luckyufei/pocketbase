// T047: Collection 创建/编辑面板
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CollectionModel } from 'pocketbase'
import { useNavigate } from 'react-router-dom'
import { useSetAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Copy, Files, Eraser, Trash2, ChevronDown, Database, Users, Eye, X, Loader2 } from 'lucide-react'
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
import { CollectionQueryTab } from './CollectionQueryTab'
import { CollectionRulesTab } from './CollectionRulesTab'
import { CollectionAuthOptionsTab } from './CollectionAuthOptionsTab'
import { addToast } from '@/store/toasts'
import { showConfirmation } from '@/store/confirmation'
import { formErrorsAtom, setFormErrorsAtom, clearFormErrorsAtom, getNestedError, hasErrorsInPaths } from '@/store/formErrors'
import { useCollections } from '../hooks/useCollections'
import { useScaffolds, parseIndexName } from '../hooks/useScaffolds'
import { useHasChanges } from '../hooks/useHasChanges'
import { useCtrlS } from '@/hooks/useCtrlS'
import { updateIndexTableName } from '../utils/indexRename'  // Phase 5: 索引重命名工具
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
  viewQuery?: string
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
  fileToken?: {
    duration: number
  }
} = {
  name: '',
  type: 'base',
  schema: [],
  fields: [],
  indexes: [],
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
  viewQuery: '',
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
  fileToken: {
    duration: 180,
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
  
  // Scaffolds API 集成
  const { data: scaffolds } = useScaffolds()
  
  // 表单错误管理
  const formErrors = useAtomValue(formErrorsAtom)
  const setFormErrors = useSetAtom(setFormErrorsAtom)
  const clearFormErrors = useSetAtom(clearFormErrorsAtom)

  const [formData, setFormData] = useState<typeof defaultCollection>(defaultCollection)
  const [saving, setSaving] = useState(false)
  const [originalData, setOriginalData] = useState<typeof defaultCollection | null>(null)
  
  // 名称输入框引用
  const nameInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!collection?.id
  const isViewCollection = formData.type === 'view'
  const isSystemCollection = collection?.system || false
  
  // 检测是否有未保存的更改
  const hasUnsavedChanges = useHasChanges(originalData, formData)

  // 初始化表单数据
  useEffect(() => {
    if (!open) return
    
    // 清除旧错误
    clearFormErrors()
    
    if (collection) {
      // 编辑模式：使用现有 collection 数据
      const data = {
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
        viewQuery: (collection as any).viewQuery ?? '',
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
        fileToken:
          (collection as any).fileToken ?? defaultCollection.fileToken,
      }
      setFormData(data)
      setOriginalData(data)
    } else {
      // 新建模式：使用 scaffold 初始化
      initFromScaffold('base')
    }
  }, [collection, open])
  
  // 从 scaffold 初始化表单数据
  const initFromScaffold = useCallback((type: string) => {
    if (!scaffolds) {
      // scaffold 还没加载，使用默认值
      const data = { ...defaultCollection, type: type as any }
      setFormData(data)
      setOriginalData(data)
      return
    }
    
    const scaffold = scaffolds[type] || scaffolds['base']
    if (!scaffold) {
      const data = { ...defaultCollection, type: type as any }
      setFormData(data)
      setOriginalData(data)
      return
    }
    
    // 使用 scaffold 的字段和索引
    let fields = [...scaffold.fields]
    
    // Phase 3: 添加默认的 created/updated autodate 字段（如果不存在）
    if (type !== 'view') {
      const hasCreated = fields.some(f => f.name === 'created')
      const hasUpdated = fields.some(f => f.name === 'updated')
      
      if (!hasCreated) {
        fields.push({
          type: 'autodate',
          name: 'created',
          system: false,
          hidden: false,
          onCreate: true,
          onUpdate: false,
        } as any)
      }
      if (!hasUpdated) {
        fields.push({
          type: 'autodate',
          name: 'updated',
          system: false,
          hidden: false,
          onCreate: true,
          onUpdate: true,
        } as any)
      }
    }
    
    const data = {
      ...defaultCollection,
      type: type as any,
      fields,
      indexes: [...scaffold.indexes],
      // Auth 特有选项
      ...(scaffold.type === 'auth' && {
        authRule: '',  // Authentication rule 默认解锁（空字符串）
        manageRule: null,  // Manage rule 默认锁定（Superusers only）
        passwordAuth: scaffold.passwordAuth || defaultCollection.passwordAuth,
        oauth2: scaffold.oauth2 || defaultCollection.oauth2,
        otp: scaffold.otp || defaultCollection.otp,
        mfa: scaffold.mfa || defaultCollection.mfa,
        authAlert: scaffold.authAlert || defaultCollection.authAlert,
        authToken: scaffold.authToken || defaultCollection.authToken,
        verificationToken: scaffold.verificationToken || defaultCollection.verificationToken,
        passwordResetToken: scaffold.passwordResetToken || defaultCollection.passwordResetToken,
        emailChangeToken: scaffold.emailChangeToken || defaultCollection.emailChangeToken,
        fileToken: scaffold.fileToken || defaultCollection.fileToken,
      }),
    }
    setFormData(data)
    setOriginalData(data)
  }, [scaffolds])
  
  // 当 scaffolds 加载完成且是新建模式时，重新初始化
  useEffect(() => {
    if (!isEdit && scaffolds && open) {
      initFromScaffold(formData.type || 'base')
    }
  }, [scaffolds, isEdit, open])
  
  // 处理类型切换（合并字段逻辑）
  const handleTypeChange = useCallback((newType: string) => {
    if (!scaffolds) {
      setFormData(prev => ({ ...prev, type: newType as any }))
      return
    }
    
    const newScaffold = scaffolds[newType]
    const oldScaffold = scaffolds[formData.type || 'base']
    
    if (!newScaffold) {
      setFormData(prev => ({ ...prev, type: newType as any }))
      return
    }
    
    // 获取当前非系统字段
    const oldFields = formData.fields || []
    const nonSystemFields = oldFields.filter(f => !f.system)
    
    // 使用新 scaffold 的字段
    let newFields = [...newScaffold.fields]
    
    // 合并已有系统字段的自定义配置
    for (const oldField of oldFields) {
      if (!oldField.system) continue
      const idx = newFields.findIndex(f => f.name === oldField.name)
      if (idx >= 0) {
        newFields[idx] = { ...newFields[idx], ...oldField }
      }
    }
    
    // 追加非系统字段
    newFields = [...newFields, ...nonSystemFields]
    
    // 合并索引
    let newIndexes = [...(formData.indexes || [])]
    
    // 移除旧类型的默认索引
    if (oldScaffold) {
      newIndexes = newIndexes.filter(idx => 
        !oldScaffold.indexes.some(si => 
          parseIndexName(idx) === parseIndexName(si)
        )
      )
    }
    
    // 添加新类型的默认索引
    for (const idx of newScaffold.indexes) {
      if (!newIndexes.some(i => parseIndexName(i) === parseIndexName(idx))) {
        newIndexes.push(idx)
      }
    }
    
    // View 类型需要清空规则
    const viewClear = newType === 'view' ? {
      createRule: null,
      updateRule: null,
      deleteRule: null,
    } : {}
    
    setFormData(prev => ({
      ...prev,
      type: newType as any,
      fields: newFields,
      indexes: newType === 'view' ? [] : newIndexes,
      ...viewClear,
      // Auth 特有选项
      ...(newScaffold.type === 'auth' && {
        authRule: '',  // Authentication rule 默认解锁（空字符串）
        manageRule: null,  // Manage rule 默认锁定（Superusers only）
        passwordAuth: newScaffold.passwordAuth || defaultCollection.passwordAuth,
        oauth2: newScaffold.oauth2 || defaultCollection.oauth2,
        otp: newScaffold.otp || defaultCollection.otp,
        mfa: newScaffold.mfa || defaultCollection.mfa,
        authAlert: newScaffold.authAlert || defaultCollection.authAlert,
        authToken: newScaffold.authToken || defaultCollection.authToken,
        verificationToken: newScaffold.verificationToken || defaultCollection.verificationToken,
        passwordResetToken: newScaffold.passwordResetToken || defaultCollection.passwordResetToken,
        emailChangeToken: newScaffold.emailChangeToken || defaultCollection.emailChangeToken,
        fileToken: newScaffold.fileToken || defaultCollection.fileToken,
      }),
    }))
  }, [scaffolds, formData.type, formData.fields, formData.indexes])
  
  // 带未保存警告的关闭函数
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      confirm({
        title: t('collections.unsavedChangesTitle', 'Unsaved changes'),
        message: t('collections.unsavedChangesMessage', 'You have unsaved changes. Do you really want to close the panel?'),
        confirmText: t('common.close', 'Close'),
        cancelText: t('common.cancel', 'Cancel'),
        isDanger: true,
        onConfirm: () => {
          clearFormErrors()
          onClose()
        },
      })
    } else {
      clearFormErrors()
      onClose()
    }
  }, [hasUnsavedChanges, confirm, t, onClose, clearFormErrors])
  
  // 背景点击关闭
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }, [handleClose])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (saving) return
    
    // 前端必填校验
    if (!formData.name || formData.name.trim() === '') {
      setFormErrors({ name: { code: 'validation_required', message: 'Name is required.' } })
      return
    }
    
    setSaving(true)
    clearFormErrors()
    
    try {
      await onSave(formData)
      onClose()
    } catch (error: any) {
      console.error('Save collection failed:', error)
      // 映射字段级错误
      if (error?.data?.data) {
        setFormErrors(error.data.data)
      }
    } finally {
      setSaving(false)
    }
  }, [saving, formData, onSave, onClose, clearFormErrors, setFormErrors])
  
  // Ctrl+S 快捷键
  useCtrlS(handleSubmit, { enabled: !saving && open })
  
  // T0017: Escape 键保护机制
  useEffect(() => {
    if (!open) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 检查是否在需要保护的元素中
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT'
        const isTextarea = target.tagName === 'TEXTAREA'
        const isContentEditable = target.isContentEditable
        const isCombobox = target.closest('[role="combobox"]')
        const isListbox = target.closest('[role="listbox"]')
        const isMenu = target.closest('[role="menu"]')
        
        // 如果在这些元素中，不关闭面板
        if (isInput || isTextarea || isContentEditable || isCombobox || isListbox || isMenu) {
          return
        }
        
        // 使用带未保存警告的关闭
        handleClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleClose])

  // 处理字段变更
  const handleCollectionChange = useCallback((updated: CollectionData) => {
    setFormData((prev) => ({
      ...prev,
      fields: updated.fields,
      indexes: updated.indexes,
    }))
  }, [])
  
  // 处理 View Query 变更
  const handleViewQueryChange = useCallback((viewQuery: string) => {
    setFormData((prev) => ({
      ...prev,
      viewQuery,
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
      toast({ type: 'success', message: t('collections.jsonCopied', 'Collection JSON copied to clipboard') })
    } catch (err) {
      toast({ type: 'error', message: t('collections.jsonCopyError', 'Copy failed') })
    }
  }, [collection, toast, t])

  // Duplicate Collection
  const handleDuplicate = useCallback(() => {
    if (!collection) return
    
    // 检查是否有未保存的更改
    if (hasUnsavedChanges) {
      confirm({
        title: t('collections.unsavedChangesTitle', 'Unsaved changes'),
        message: t('collections.duplicateUnsavedMessage', 'You have unsaved changes. Do you want to discard them and duplicate?'),
        confirmText: t('collections.discardAndDuplicate', 'Discard and duplicate'),
        cancelText: t('common.cancel', 'Cancel'),
        isDanger: true,
        onConfirm: () => doDuplicate(),
      })
    } else {
      doDuplicate()
    }
    
    function doDuplicate() {
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
      clearFormErrors()
      onClose()
      if (onDuplicate) {
        onDuplicate(clone as CollectionModel)
      }
    }
  }, [collection, hasUnsavedChanges, confirm, t, onClose, onDuplicate, clearFormErrors])

  // Truncate Collection (清空所有记录)
  const handleTruncate = useCallback(() => {
    if (!collection?.id) return

    confirm({
      title: t('collections.truncateConfirmTitle', 'Confirm Truncate'),
      message: t('collections.truncateConfirmMessage', `Are you sure you want to truncate all records in "${collection.name}"? This includes cascade deletion of related records and files, and cannot be undone.`),
      yesText: t('common.confirm', 'Confirm'),
      noText: t('common.cancel', 'Cancel'),
      onConfirm: async () => {
        try {
          await truncateCollection(collection.id)
          toast({ type: 'success', message: t('collections.truncateSuccess', `All records in "${collection.name}" have been truncated`) })
          onClose()
          if (onTruncate) onTruncate()
        } catch (err) {
          toast({
            type: 'error',
            message: err instanceof Error ? err.message : t('collections.truncateError', 'Truncate failed'),
          })
        }
      },
    })
  }, [collection, confirm, truncateCollection, toast, t, onClose, onTruncate])

  // Delete Collection
  const handleDelete = useCallback(() => {
    if (!collection?.id) return

    confirm({
      title: t('collections.deleteConfirmTitle', 'Confirm Delete'),
      message: t('collections.deleteConfirmMessage', `Are you sure you want to delete "${collection.name}" and all its records? This action cannot be undone.`),
      yesText: t('common.delete', 'Delete'),
      noText: t('common.cancel', 'Cancel'),
      onConfirm: async () => {
        try {
          await destroyCollection(collection.id)
          toast({ type: 'success', message: t('collections.deleteSuccess', 'Deleted successfully') })
          onClose()
          if (onDelete) onDelete()
          navigate('/collections')
        } catch (err) {
          toast({
            type: 'error',
            message: err instanceof Error ? err.message : t('collections.deleteError', 'Delete failed'),
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
  
  // Tab 错误检测
  const schemaTabHasErrors = hasErrorsInPaths(formErrors, ['fields', 'indexes', 'viewQuery'])
  const rulesTabHasErrors = hasErrorsInPaths(formErrors, ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule', 'authRule', 'manageRule'])
  const optionsTabHasErrors = hasErrorsInPaths(formErrors, ['passwordAuth', 'oauth2', 'otp', 'mfa', 'authAlert'])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 transition-opacity"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed top-0 right-0 h-full w-[700px] bg-background shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 名称输入 + 类型选择器 */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Name <span className="text-destructive">*</span></label>
                <div className="flex group">
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => {
                      // slugify: 只允许字母、数字、下划线
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                      const oldName = formData.name
                      
                      // Phase 5: Collection 重命名时自动更新索引中的表名
                      if (oldName && oldName !== value && formData.indexes && formData.indexes.length > 0) {
                        const updatedIndexes = updateIndexTableName(formData.indexes, oldName, value)
                        setFormData((prev) => ({ ...prev, name: value, indexes: updatedIndexes }))
                      } else {
                        setFormData((prev) => ({ ...prev, name: value }))
                      }
                    }}
                    placeholder={formData.type === 'auth' ? 'eg. "users"' : 'eg. "posts"'}
                    className={cn(
                      'rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-blue-500',
                      'placeholder:text-slate-400',
                      isSystemCollection && 'font-bold',
                      getNestedError(formErrors, 'name') && 'border-destructive'
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
                          'rounded-l-none rounded-r-xl border-l-0 px-3 gap-2 h-10',
                          '!border-slate-200 !ring-0 !ring-offset-0',
                          'group-focus-within:!border-blue-500',
                          isEdit && 'pointer-events-none opacity-70',
                          getNestedError(formErrors, 'name') && '!border-destructive'
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
                            onClick={() => handleTypeChange(type)}
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
                {/* 错误提示 */}
                {getNestedError(formErrors, 'name')?.message && (
                  <p className="text-xs text-destructive mt-1">{getNestedError(formErrors, 'name').message}</p>
                )}
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
                'relative flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === TAB_SCHEMA
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
              onClick={() => setActiveTab(TAB_SCHEMA)}
            >
              {isViewCollection ? 'Query' : 'Fields'}
              {schemaTabHasErrors && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
            {!isSuperusers && (
              <button
                type="button"
                className={cn(
                  'relative flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === TAB_RULES
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                )}
                onClick={() => setActiveTab(TAB_RULES)}
              >
                API Rules
                {rulesTabHasErrors && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            )}
            {formData.type === 'auth' && (
              <button
                type="button"
                className={cn(
                  'relative flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === TAB_OPTIONS
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                )}
                onClick={() => setActiveTab(TAB_OPTIONS)}
              >
                Options
                {optionsTabHasErrors && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content 区域 */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Fields/Query Tab */}
            {activeTab === TAB_SCHEMA && (
              isViewCollection ? (
                <CollectionQueryTab
                  collection={{
                    ...formData as any,
                    viewQuery: (formData as any).viewQuery || '',
                  }}
                  onChange={handleViewQueryChange}
                  errors={formErrors}
                />
              ) : (
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
              )
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
                  fileToken: formData.fileToken!,
                }}
                onChange={handleAuthOptionsChange}
              />
            )}
          </div>
        </ScrollArea>

        {/* Footer 区域 */}
        <div className="h-14 px-4 border-t flex items-center justify-between bg-background">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UpsertPanel
