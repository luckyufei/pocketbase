// T061: Record 创建/编辑面板
import { useState, useEffect, useCallback, useMemo, useRef, useId } from 'react'
import type { RecordModel, CollectionField, CollectionModel } from 'pocketbase'
import { useSetAtom, useAtomValue } from 'jotai'
import { OverlayPanel } from '@/components/OverlayPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  X,
  RefreshCw,
  MoreHorizontal,
  Mail,
  Lock,
  UserCheck,
  Braces,
  Copy,
  Trash,
  ChevronDown,
  Key,
} from 'lucide-react'
// 字段组件
import { TextField } from './fields/TextField'
import { NumberField } from './fields/NumberField'
import { BoolField } from './fields/BoolField'
import { EmailField } from './fields/EmailField'
import { UrlField } from './fields/UrlField'
import { EditorField } from './fields/EditorField'
import { DateField } from './fields/DateField'
import { SelectField } from './fields/SelectField'
import { JsonField } from './fields/JsonField'
import { FileField } from './fields/FileField'
import { RelationField } from './fields/RelationField'
import { PasswordField } from './fields/PasswordField'
import { SecretField } from './fields/SecretField'
import { GeoPointField } from './fields/GeoPointField'
import { AuthFields } from './fields/AuthFields'
import { ExternalAuthsList } from './ExternalAuthsList'
import { AutodateIcon } from './AutodateIcon'
import { ImpersonatePopup } from './ImpersonatePopup'
import { useDraft } from '../hooks/useDraft'
import { useChangeDetection } from '../hooks/useChangeDetection'
import { showConfirmation } from '@/store/confirmation'
import { usePocketbase } from '@/hooks/usePocketbase'
import { addToast } from '@/store/toasts'
import { setFormErrorsAtom, clearFormErrorsAtom, formErrorsAtom } from '@/store/formErrors'
import { canSave as computeCanSave } from '../utils/canSave'

interface UpsertPanelProps {
  open: boolean
  onClose: () => void
  record?: RecordModel | null
  fields: CollectionField[]
  collection?: CollectionModel | null
  onSave: (data: Record<string, unknown>, files?: Record<string, File[]>) => Promise<void>
  onDelete?: () => Promise<void>
  onDuplicate?: (data: Record<string, unknown>) => void
  /** Custom z-index for nested panels (default: 50) */
  zIndex?: number
}

// 基础跳过的字段
const BASE_SKIP_FIELD_NAMES = ['id', 'created', 'updated', 'collectionId', 'collectionName']

// Auth collection 额外跳过的字段（由 AuthFields 组件单独处理）
const AUTH_SKIP_FIELD_NAMES = [
  ...BASE_SKIP_FIELD_NAMES,
  'email',
  'emailVisibility',
  'verified',
  'tokenKey',
  'password',
]

/**
 * Record 创建/编辑面板
 */
export function UpsertPanel({
  open,
  onClose,
  record,
  fields,
  collection,
  onSave,
  onDelete,
  onDuplicate,
  zIndex,
}: UpsertPanelProps) {
  // 为每个 UpsertPanel 实例生成唯一的表单 ID，避免嵌套时 ID 冲突
  const uniqueId = useId()
  const formId = `upsert-record-form-${uniqueId}`
  
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [originalData, setOriginalData] = useState<Record<string, unknown>>({})
  const [newFiles, setNewFiles] = useState<Record<string, File[]>>({})
  const [deletedFiles, setDeletedFiles] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'providers'>('form')

  const showConfirm = useSetAtom(showConfirmation)
const { pb } = usePocketbase()
  const toast = useSetAtom(addToast)
  const setFormErrors = useSetAtom(setFormErrorsAtom)
  const clearFormErrors = useSetAtom(clearFormErrorsAtom)
  const formErrors = useAtomValue(formErrorsAtom)

  const isEdit = !!record?.id
  const isNew = !isEdit
  const isAuthCollection = collection?.type === 'auth'
  const isSuperusers = collection?.name === '_superusers'
  const showTabs = isAuthCollection && !isSuperusers && isEdit

  // Get ID field configuration
  const idField = useMemo(() => {
    return collection?.fields?.find((f) => f.name === 'id')
  }, [collection?.fields])

  // Draft management
  const { hasDraft, saveDraft, deleteDraft, restoreDraft } = useDraft({
    collectionId: collection?.id || '',
    recordId: record?.id,
  })

  // Change detection
  const { hasChanges } = useChangeDetection({
    original: originalData,
    current: formData,
    uploadedFiles: newFiles,
    deletedFiles,
  })

  // 根据 collection 类型选择要跳过的字段
  const skipFieldNames = isAuthCollection ? AUTH_SKIP_FIELD_NAMES : BASE_SKIP_FIELD_NAMES

  // 过滤掉不可编辑的字段
  const editableFields = fields.filter(
    (f) => !skipFieldNames.includes(f.name) && f.type !== 'autodate'
  )

  // canSave logic (uses utility function for testability)
  const canSave = useMemo(
    () => computeCanSave({ saving, isNew, hasChanges }),
    [saving, isNew, hasChanges]
  )

  // Dynamic panel width based on editor field presence
  const hasEditorField = useMemo(() => {
    return fields.some((f) => f.type === 'editor')
  }, [fields])

  // 初始化表单数据
  useEffect(() => {
    if (!open) return

    // Clear form errors when panel opens
    clearFormErrors()

    let initialData: Record<string, unknown> = {}

    if (record) {
      initialData = { ...record }
    } else {
      // 初始化默认值
      const defaults: Record<string, unknown> = {}

      // Auth collection 默认值
      if (isAuthCollection) {
        defaults.email = ''
        defaults.emailVisibility = false
        defaults.verified = false
        defaults.password = ''
        defaults.passwordConfirm = ''
      }

      editableFields.forEach((field) => {
        switch (field.type) {
          case 'bool':
            defaults[field.name] = false
            break
          case 'number':
            defaults[field.name] = 0
            break
          case 'json':
            defaults[field.name] = '{}'  // 字符串形式，与 JsonField 保持一致
            break
          case 'select':
            defaults[field.name] = field.maxSelect === 1 ? '' : []
            break
          case 'relation':
            defaults[field.name] = field.maxSelect === 1 ? '' : []
            break
          case 'file':
            defaults[field.name] = []
            break
          case 'geoPoint':
            defaults[field.name] = { lat: 0, lon: 0 }
            break
          default:
            defaults[field.name] = ''
        }
      })
      initialData = defaults
    }

    setFormData(initialData)
    setOriginalData(initialData)
    // 重置文件状态
    setNewFiles({})
    setDeletedFiles({})
    setDraftRestored(false)
    setActiveTab('form')
  }, [record, fields, open, isAuthCollection])

  // Auto-save draft when data changes (debounced)
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!open || !hasChanges || saving) return

    // Clear previous timeout
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current)
    }

    // Debounce draft save
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveDraft(formData)
    }, 1000)

    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current)
      }
    }
  }, [formData, open, hasChanges, saving, saveDraft])

  // Ctrl+S shortcut
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        if (canSave && !saving) {
          handleSave(false) // false = don't close panel
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, canSave, saving])

  const handleSave = async (closeAfterSave: boolean = true) => {
    setSaving(true)
    try {
      await onSave(formData, newFiles)
      deleteDraft() // Clear draft on successful save
      clearFormErrors() // Clear form errors on successful save
      if (closeAfterSave) {
        onClose()
      } else {
        // Update original data to reflect saved state
        setOriginalData({ ...formData })
        setNewFiles({})
        setDeletedFiles({})
      }
    } catch (error) {
      console.error('Save record failed:', error)

      // Check if it's a PocketBase validation error with field-specific errors
      const pbError = error as { response?: { data?: Record<string, { code: string; message: string }> } }
      if (pbError?.response?.data && typeof pbError.response.data === 'object') {
        // Set field-specific errors to formErrors store
        setFormErrors(pbError.response.data)
      }

      // Show error toast with helpful message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isNetworkError = errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('failed to fetch') ||
        errorMessage.toLowerCase().includes('connection')
      toast({
        type: 'error',
        message: isNetworkError
          ? 'Network error. Please check your connection and try again.'
          : `Failed to save record: ${errorMessage}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // 阻止事件冒泡，避免触发外层表单
    await handleSave(true)
  }

  // Handle close with unsaved changes confirmation
  const handleClose = useCallback(() => {
    if (hasChanges) {
      showConfirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Do you really want to close the panel?',
        confirmText: 'Discard',
        cancelText: 'Cancel',
        isDanger: true,
        onConfirm: () => {
          deleteDraft()
          onClose()
        },
      })
    } else {
      deleteDraft()
      onClose()
    }
  }, [hasChanges, deleteDraft, onClose, showConfirm])

  // Handle draft restoration
  const handleRestoreDraft = useCallback(() => {
    const draft = restoreDraft()
    if (draft) {
      setFormData((prev) => ({ ...prev, ...draft }))
      // 恢复草稿后删除草稿，与旧版 UI 保持一致
      // 这样用户不会再次看到 "The record has previous unsaved changes." 提示
      deleteDraft()
      setDraftRestored(true)
    }
  }, [restoreDraft, deleteDraft])

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  // 处理文件字段变更
  const handleFileChange = useCallback(
    (fieldName: string, existingFiles: string[], uploadedFiles: File[]) => {
      setFormData((prev) => ({ ...prev, [fieldName]: existingFiles }))
      setNewFiles((prev) => ({ ...prev, [fieldName]: uploadedFiles }))
    },
    []
  )

  // === Phase 3: More Actions ===

  // Send verification email
  const handleSendVerificationEmail = useCallback(() => {
    if (!collection?.id || !record?.email) return

    showConfirm({
      title: 'Send Verification Email',
      message: `Do you really want to send a verification email to ${record.email}?`,
      confirmText: 'Send',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await pb.collection(collection.id).requestVerification(record.email as string)
          toast({
            type: 'success',
            message: `Successfully sent verification email to ${record.email}.`,
          })
        } catch (err) {
          toast({
            type: 'error',
            message: `Failed to send verification email: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      },
    })
  }, [collection?.id, record?.email, pb, showConfirm, toast])

  // Send password reset email
  const handleSendPasswordResetEmail = useCallback(() => {
    if (!collection?.id || !record?.email) return

    showConfirm({
      title: 'Send Password Reset Email',
      message: `Do you really want to send a password reset email to ${record.email}?`,
      confirmText: 'Send',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await pb.collection(collection.id).requestPasswordReset(record.email as string)
          toast({
            type: 'success',
            message: `Successfully sent password reset email to ${record.email}.`,
          })
        } catch (err) {
          toast({
            type: 'error',
            message: `Failed to send password reset email: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      },
    })
  }, [collection?.id, record?.email, pb, showConfirm, toast])

  // Copy raw JSON
  const handleCopyJSON = useCallback(() => {
    if (!record) return

    try {
      navigator.clipboard.writeText(JSON.stringify(record, null, 2))
      toast({
        type: 'success',
        message: 'Raw JSON copied to clipboard.',
      })
    } catch (err) {
      toast({
        type: 'error',
        message: 'Failed to copy to clipboard.',
      })
    }
  }, [record, toast])

  // Duplicate record
  const handleDuplicate = useCallback(() => {
    if (!record || !onDuplicate) return

    // Create a copy without id, created, updated
    const duplicateData = { ...record }
    delete duplicateData.id
    delete duplicateData.created
    delete duplicateData.updated

    onDuplicate(duplicateData)
    onClose()
  }, [record, onDuplicate, onClose])

  // Delete record
  const handleDelete = useCallback(() => {
    if (!record || !onDelete) return

    showConfirm({
      title: 'Delete Record',
      message: `Do you really want to delete record "${record.id}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          await onDelete()
          onClose()
        } catch (err) {
          toast({
            type: 'error',
            message: `Failed to delete record: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      },
    })
  }, [record, onDelete, showConfirm, onClose, toast])

  // Impersonate popup state
  const [showImpersonatePopup, setShowImpersonatePopup] = useState(false)

  // Impersonate - open popup
  const handleImpersonate = useCallback(() => {
    setShowImpersonatePopup(true)
  }, [])

  const renderField = (field: CollectionField) => {
    const value = formData[field.name]

    switch (field.type) {
      case 'text':
        return (
          <TextField
            field={field}
            original={record || undefined}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'number':
        return (
          <NumberField
            field={field}
            value={value as number | undefined}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'bool':
        return (
          <BoolField
            field={field}
            value={!!value}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'email':
        return (
          <EmailField
            field={field}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'url':
        return (
          <UrlField
            field={field}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'editor':
        return (
          <EditorField
            field={field}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'date':
        return (
          <DateField
            field={field}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'select':
        return (
          <SelectField
            field={field}
            value={value as string | string[]}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'json':
        return (
          <JsonField
            field={field}
            value={value}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'file':
        return (
          <FileField
            field={{
              name: field.name,
              type: field.type,
              required: field.required,
              options: {
                maxSelect: field.maxSelect,
                maxSize: field.maxSize,
                mimeTypes: field.mimeTypes,
                thumbs: field.thumbs,
                protected: field.protected,
              },
            }}
            value={Array.isArray(value) ? value : value ? [value as string] : []}
            newFiles={newFiles[field.name] || []}
            onChange={(files, uploaded) => handleFileChange(field.name, files, uploaded || [])}
            record={record || undefined}
          />
        )

      case 'relation':
        return (
          <RelationField
            field={field}
            value={value as string | string[]}
            onChange={(v) => handleFieldChange(field.name, v)}
            zIndex={zIndex ? zIndex + 10 : undefined}
          />
        )

      case 'password':
        return (
          <PasswordField
            field={field}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'secret':
        return (
          <SecretField
            field={field}
            value={(value as string) || ''}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      case 'geoPoint':
        return (
          <GeoPointField
            field={field}
            value={value as { lat: number; lon: number } | undefined}
            onChange={(v) => handleFieldChange(field.name, v)}
          />
        )

      default:
        return (
          <Input
            id={field.name}
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        )
    }
  }

  // More actions menu for edit mode
  const renderMoreActions = () => {
    if (isNew) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isAuthCollection && !record?.verified && record?.email && (
            <DropdownMenuItem onClick={handleSendVerificationEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send verification email
            </DropdownMenuItem>
          )}
          {isAuthCollection && record?.email && (
            <DropdownMenuItem onClick={handleSendPasswordResetEmail}>
              <Lock className="mr-2 h-4 w-4" />
              Send password reset email
            </DropdownMenuItem>
          )}
          {isAuthCollection && (
            <DropdownMenuItem onClick={handleImpersonate}>
              <UserCheck className="mr-2 h-4 w-4" />
              Impersonate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleCopyJSON}>
            <Braces className="mr-2 h-4 w-4" />
            Copy raw JSON
          </DropdownMenuItem>
          {onDuplicate && (
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Footer actions
  const footerContent = (
    <>
      <Button type="button" variant="outline" onClick={handleClose}>
        Cancel
      </Button>
      <div className="flex">
        <Button
          type="submit"
          form={formId}
          disabled={!canSave}
          className={isEdit ? 'rounded-r-none' : ''}
        >
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create'}
        </Button>
        {isEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                disabled={!canSave}
                className="rounded-l-none border-l-0 px-2"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSave(false)}>
                Save and continue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  )

  return (
    <TooltipProvider>
    <>
    <OverlayPanel
      open={open}
      onClose={handleClose}
      title={`${isEdit ? 'Edit' : 'New'} ${collection?.name || ''} record`}
      width={hasEditorField ? 'xl' : 'lg'}
      headerExtra={renderMoreActions()}
      escClose={!saving}
      loading={saving}
      overlayClose={!saving}
      footer={footerContent}
      zIndex={zIndex}
    >
      <form 
        id={formId} 
        onSubmit={handleSubmit} 
        className="space-y-4"
      >
        {/* Draft restoration alert - 与旧版 UI 保持一致 */}
        {!draftRestored && hasDraft && !hasChanges && (
          <Alert variant="info" className="mb-0">
            <AlertDescription className="flex items-center gap-2">
              <span>The record has previous unsaved changes.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleRestoreDraft}
              >
                Restore draft
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ID 字段 */}
        <div className={`form-field ${isEdit ? 'readonly' : ''}`}>
          <div data-field-label="" className="flex items-center justify-between w-full">
            <Label htmlFor="id" className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              id
            </Label>
            {isEdit && record && <AutodateIcon record={record} />}
          </div>
          <Input
            id="id"
            value={isEdit ? (record?.id || '') : ((formData.id as string) || '')}
            readOnly={isEdit}
            disabled={isEdit}
            placeholder={
              isNew && idField?.autogeneratePattern
                ? 'Leave empty to auto generate...'
                : ''
            }
            minLength={idField?.min}
            maxLength={idField?.max}
            onChange={isNew ? (e) => handleFieldChange('id', e.target.value) : undefined}
            className="font-mono text-sm"
          />
        </div>

        {/* Auth Collection with Tabs (Edit mode, non-superusers) */}
        {showTabs ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'form' | 'providers')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="form">Account</TabsTrigger>
              <TabsTrigger value="providers">Authorized providers</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="space-y-4">
              {/* Auth Fields */}
              {collection && (
                <AuthFields
                  record={formData}
                  onChange={handleFieldChange}
                  collection={collection}
                  isNew={false}
                />
              )}
              {editableFields.length > 0 && <hr className="my-4" />}
              {/* Regular Fields */}
              {editableFields.map((field) => (
                <div key={field.name}>
                  {renderField(field)}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="providers">
              {record && <ExternalAuthsList record={record} />}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* Auth Collection 专用字段 (New mode or superusers) */}
            {isAuthCollection && collection && (
              <>
                <AuthFields
                  record={formData}
                  onChange={handleFieldChange}
                  collection={collection}
                  isNew={!isEdit}
                />
                {editableFields.length > 0 && <hr className="my-4" />}
              </>
            )}

            {/* 普通字段 */}
            {editableFields.length === 0 && !isAuthCollection ? (
              <div className="text-muted-foreground text-center py-4">No editable fields</div>
            ) : (
              editableFields.map((field) => (
                <div key={field.name}>
                  {renderField(field)}
                </div>
              ))
            )}
          </>
        )}
      </form>
    </OverlayPanel>

    {/* Impersonate Popup */}
    {isAuthCollection && collection && record && (
      <ImpersonatePopup
        open={showImpersonatePopup}
        onOpenChange={setShowImpersonatePopup}
        collection={collection}
        record={record}
      />
    )}
    </>
    </TooltipProvider>
  )
}

export default UpsertPanel
