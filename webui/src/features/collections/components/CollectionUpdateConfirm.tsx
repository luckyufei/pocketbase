// Task 1: 保存前确认面板
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { CollectionModel } from 'pocketbase'
import { pb } from '@/lib/pocketbase'

// 字段变更类型
interface FieldChange {
  type: 'renamed' | 'deleted' | 'multipleToSingle'
  fieldId?: string
  originalName?: string
  newName?: string
  fieldName?: string
}

// 规则变更类型
interface RuleChange {
  prop: string
  oldRule: string | null
  newRule: string | null
}

// OIDC 冲突类型
interface OidcConflict {
  name: string
  oldHost: string
  newHost: string
}

interface CollectionUpdateConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oldCollection: CollectionModel | null
  newCollection: Partial<CollectionModel> | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Collection 更新确认对话框
 * 显示字段重命名、删除、规则变更等信息
 */
export function CollectionUpdateConfirm({
  open,
  onOpenChange,
  oldCollection,
  newCollection,
  onConfirm,
  onCancel,
}: CollectionUpdateConfirmProps) {
  const { t } = useTranslation()
  const [fieldChanges, setFieldChanges] = useState<FieldChange[]>([])
  const [ruleChanges, setRuleChanges] = useState<RuleChange[]>([])
  const [oidcConflicts, setOidcConflicts] = useState<OidcConflict[]>([])
  const [loading, setLoading] = useState(false)

  // 检测变更
  useEffect(() => {
    if (!open || !oldCollection || !newCollection) return

    const detectChanges = async () => {
      setLoading(true)

      // 检测字段变更
      const changes: FieldChange[] = []
      const oldFields = oldCollection.fields || []
      const newFields = (newCollection.fields || []) as any[]

      // 检测重命名和删除
      for (const newField of newFields) {
        if (!newField.id) continue

        // 检测标记为删除的字段
        if (newField._toDelete) {
          changes.push({
            type: 'deleted',
            fieldId: newField.id,
            fieldName: newField.name,
          })
          continue
        }

        // 检测重命名
        if (newField._originalName && newField._originalName !== newField.name) {
          changes.push({
            type: 'renamed',
            fieldId: newField.id,
            originalName: newField._originalName,
            newName: newField.name,
          })
        }

        // 检测多选到单选的转换
        const oldField = oldFields.find((f: any) => f.id === newField.id)
        if (oldField && oldField.maxSelect !== 1 && newField.maxSelect === 1) {
          changes.push({
            type: 'multipleToSingle',
            fieldId: newField.id,
            fieldName: newField.name,
          })
        }
      }

      setFieldChanges(changes)

      // 检测规则变更（仅在 HTTPS 环境下）
      const rules: RuleChange[] = []
      if (window.location.protocol === 'https:') {
        const ruleProps = ['listRule', 'viewRule']
        if (newCollection.type !== 'view') {
          ruleProps.push('createRule', 'updateRule', 'deleteRule')
        }
        if (newCollection.type === 'auth') {
          ruleProps.push('manageRule', 'authRule')
        }

        for (const prop of ruleProps) {
          const oldRule = (oldCollection as any)[prop]
          const newRule = (newCollection as any)[prop]
          if (oldRule !== newRule) {
            rules.push({ prop, oldRule, newRule })
          }
        }
      }
      setRuleChanges(rules)

      // 检测 OIDC 冲突
      const conflicts: OidcConflict[] = []
      const oidcProviders = ['oidc', 'oidc2', 'oidc3']

      for (const name of oidcProviders) {
        const oldProvider = (oldCollection as any).oauth2?.providers?.find((p: any) => p.name === name)
        const newProvider = (newCollection as any).oauth2?.providers?.find((p: any) => p.name === name)

        if (!oldProvider || !newProvider) continue

        try {
          const oldHost = new URL(oldProvider.authURL).host
          const newHost = new URL(newProvider.authURL).host

          if (oldHost !== newHost) {
            // 检查是否存在 externalAuths
            try {
              await pb.collection('_externalAuths').getFirstListItem(
                pb.filter('collectionRef={:collectionId} && provider={:provider}', {
                  collectionId: newCollection.id,
                  provider: name,
                })
              )
              conflicts.push({ name, oldHost, newHost })
            } catch {
              // 没有找到记录，不是冲突
            }
          }
        } catch {
          // URL 解析失败
        }
      }
      setOidcConflicts(conflicts)

      setLoading(false)
    }

    detectChanges()
  }, [open, oldCollection, newCollection])

  // 是否为 Collection 重命名
  const isCollectionRenamed = oldCollection?.name !== newCollection?.name

  // 是否为 View 类型
  const isViewCollection = newCollection?.type === 'view'

  // 是否有需要显示的变更
  const hasChanges =
    isCollectionRenamed ||
    fieldChanges.length > 0 ||
    ruleChanges.length > 0 ||
    oidcConflicts.length > 0

  // 是否有删除或重命名操作
  const hasDeleteOrRename =
    isCollectionRenamed ||
    fieldChanges.some((c) => c.type === 'renamed' || c.type === 'deleted')

  const handleConfirm = useCallback(() => {
    onConfirm()
    onOpenChange(false)
  }, [onConfirm, onOpenChange])

  const handleCancel = useCallback(() => {
    onCancel()
    onOpenChange(false)
  }, [onCancel, onOpenChange])

  // 格式化规则显示
  const formatRule = (rule: string | null) => {
    if (rule === null) return t('collections.confirm.superusersOnly', 'null (superusers only)')
    if (rule === '') return '""'
    return rule
  }

  // 获取 externalAuths 过滤链接
  const getExternalAuthsFilterLink = (provider: string) => {
    return `#/collections?collection=_externalAuths&filter=collectionRef%3D%22${newCollection?.id}%22+%26%26+provider%3D%22${provider}%22`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('collections.confirm.title', 'Confirm collection changes')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('collections.confirm.description', 'Review and confirm the changes to this collection')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-slate-500">
            {t('common.loading', 'Loading...')}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 警告提示 */}
            {hasDeleteOrRename && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold">
                    {t(
                      'collections.confirm.warningMessage',
                      "If any of the collection changes is part of another collection rule, filter or view query, you'll have to update it manually!"
                    )}
                  </p>
                  {fieldChanges.some((c) => c.type === 'deleted') && (
                    <p className="mt-1">
                      {t(
                        'collections.confirm.deleteWarning',
                        'All data associated with the removed fields will be permanently deleted!'
                      )}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* 变更列表 */}
            {hasChanges && (
              <>
                <h4 className="text-sm font-semibold text-slate-700">
                  {t('collections.confirm.changes', 'Changes:')}
                </h4>
                <ul className="space-y-2 text-sm">
                  {/* Collection 重命名 */}
                  {isCollectionRenamed && (
                    <li className="flex items-center gap-2">
                      <span>{t('collections.confirm.renamedCollection', 'Renamed collection')}</span>
                      <span className="line-through text-slate-400">{oldCollection?.name}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="font-semibold">{newCollection?.name}</span>
                    </li>
                  )}

                  {/* 字段变更 */}
                  {!isViewCollection && (
                    <>
                      {/* 多选到单选转换 */}
                      {fieldChanges
                        .filter((c) => c.type === 'multipleToSingle')
                        .map((change, index) => (
                          <li key={`multi-${index}`}>
                            {t('collections.confirm.multipleToSingle', 'Multiple to single value conversion of field')}{' '}
                            <strong>{change.fieldName}</strong>
                            <em className="text-xs text-slate-500 ml-1">
                              ({t('collections.confirm.keepLastItem', 'will keep only the last array item')})
                            </em>
                          </li>
                        ))}

                      {/* 字段重命名 */}
                      {fieldChanges
                        .filter((c) => c.type === 'renamed')
                        .map((change, index) => (
                          <li key={`rename-${index}`} className="flex items-center gap-2">
                            <span>{t('collections.confirm.renamedField', 'Renamed field')}</span>
                            <span className="line-through text-slate-400">{change.originalName}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400" />
                            <span className="font-semibold">{change.newName}</span>
                          </li>
                        ))}

                      {/* 字段删除 */}
                      {fieldChanges
                        .filter((c) => c.type === 'deleted')
                        .map((change, index) => (
                          <li key={`delete-${index}`} className="text-destructive">
                            {t('collections.confirm.removedField', 'Removed field')}{' '}
                            <strong>{change.fieldName}</strong>
                          </li>
                        ))}
                    </>
                  )}

                  {/* 规则变更 */}
                  {ruleChanges.map((change, index) => (
                    <li key={`rule-${index}`} className="space-y-1">
                      <div>
                        {t('collections.confirm.changedRule', 'Changed API rule')}{' '}
                        <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{change.prop}</code>:
                      </div>
                      <div className="pl-4 text-xs font-mono">
                        <div className="text-slate-500">
                          <strong>Old</strong>: <span className="whitespace-pre-wrap">{formatRule(change.oldRule)}</span>
                        </div>
                        <div className="text-green-600">
                          <strong>New</strong>: <span className="whitespace-pre-wrap">{formatRule(change.newRule)}</span>
                        </div>
                      </div>
                    </li>
                  ))}

                  {/* OIDC 冲突 */}
                  {oidcConflicts.map((conflict, index) => (
                    <li key={`oidc-${index}`} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span>
                          {t('collections.confirm.changedOidcHost', 'Changed')} <code>{conflict.name}</code> host
                        </span>
                        <span className="line-through text-slate-400">{conflict.oldHost}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold">{conflict.newHost}</span>
                      </div>
                      <div className="text-xs text-slate-500 pl-4">
                        {t(
                          'collections.confirm.oidcWarning',
                          'If the old and new OIDC configuration is not for the same provider consider deleting all old _externalAuths records associated to the current collection and provider, otherwise it may result in account linking errors.'
                        )}{' '}
                        <a
                          href={getExternalAuthsFilterLink(conflict.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {t('collections.confirm.reviewRecords', 'Review existing _externalAuths records')}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {t('common.confirm', 'Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 检测是否需要显示确认对话框
 */
export function shouldShowConfirmDialog(
  oldCollection: CollectionModel | null,
  newCollection: Partial<CollectionModel> | null
): boolean {
  if (!oldCollection || !newCollection) return false
  if (!newCollection.id) return false // 新建不需要确认

  // 检测 Collection 重命名
  if (oldCollection.name !== newCollection.name) return true

  // 检测字段变更
  const newFields = (newCollection.fields || []) as any[]
  for (const field of newFields) {
    if (!field.id) continue
    // 标记为删除
    if (field._toDelete) return true
    // 重命名
    if (field._originalName && field._originalName !== field.name) return true
  }

  // 检测多选到单选
  const oldFields = oldCollection.fields || []
  for (const newField of newFields) {
    if (!newField.id) continue
    const oldField = oldFields.find((f: any) => f.id === newField.id)
    if (oldField && (oldField as any).maxSelect !== 1 && newField.maxSelect === 1) return true
  }

  // 检测规则变更（仅 HTTPS）
  if (window.location.protocol === 'https:') {
    const ruleProps = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']
    if (newCollection.type === 'auth') {
      ruleProps.push('manageRule', 'authRule')
    }
    for (const prop of ruleProps) {
      if ((oldCollection as any)[prop] !== (newCollection as any)[prop]) return true
    }
  }

  return false
}

export default CollectionUpdateConfirm
