/**
 * 集合更新确认对话框
 * 用于确认集合更新操作，展示变更内容
 * 
 * Phase 0.6: 增强变更检测功能
 * - 检测集合重命名
 * - 检测字段重命名
 * - 检测字段删除
 * - 检测多值→单值变更
 * - 检测 API 规则变更
 * - 检测 OIDC Host 变更
 */
import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { CollectionsDiffTable } from './CollectionsDiffTable'
import type { CollectionModel, SchemaField } from 'pocketbase'
import { cn } from '@/lib/utils'

interface CollectionUpdateConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalCollection: CollectionModel
  updatedCollection: CollectionModel
  onConfirm: () => void
  isSubmitting?: boolean
}

/**
 * 变更检测结果
 */
interface ChangeDetection {
  renamedCollection: { old: string; new: string } | null
  renamedFields: Array<{ old: string; new: string }>
  deletedFields: Array<{ name: string; type: string; id: string }>
  multiToSingleFields: Array<{ name: string }>
  changedRules: Array<{ name: string; old: string; new: string }>
  oidcHostChanged: boolean
  hasManualUpdateWarning: boolean
}

/**
 * 检测两个 Collection 之间的变更
 */
function detectChanges(
  original: CollectionModel,
  updated: CollectionModel
): ChangeDetection {
  const detection: ChangeDetection = {
    renamedCollection: null,
    renamedFields: [],
    deletedFields: [],
    multiToSingleFields: [],
    changedRules: [],
    oidcHostChanged: false,
    hasManualUpdateWarning: false,
  }
  
  const originalFields = (original as any).fields || []
  const updatedFields = (updated as any).fields || []
  
  // 1. 集合重命名检测
  if (original.name !== updated.name) {
    detection.renamedCollection = { old: original.name, new: updated.name }
    detection.hasManualUpdateWarning = true
  }
  
  // 2. 字段重命名检测 (通过 id 匹配)
  for (const newField of updatedFields) {
    const oldField = originalFields.find((f: SchemaField) => f.id === newField.id)
    if (oldField && oldField.name !== newField.name) {
      detection.renamedFields.push({ old: oldField.name, new: newField.name })
      detection.hasManualUpdateWarning = true
    }
  }
  
  // 3. 字段删除检测
  for (const oldField of originalFields) {
    const existsInNew = updatedFields.find((f: SchemaField) => f.id === oldField.id)
    if (!existsInNew) {
      detection.deletedFields.push({ 
        name: oldField.name, 
        type: oldField.type,
        id: oldField.id 
      })
    }
  }
  
  // 同时检测标记为删除的字段
  for (const field of updatedFields) {
    if ((field as any)._toDelete) {
      // 避免重复添加
      if (!detection.deletedFields.find(f => f.id === field.id)) {
        detection.deletedFields.push({ 
          name: field.name, 
          type: field.type,
          id: field.id 
        })
      }
    }
  }
  
  // 4. 多值→单值转换检测
  for (const newField of updatedFields) {
    const oldField = originalFields.find((f: SchemaField) => f.id === newField.id)
    if (oldField) {
      const oldMaxSelect = (oldField as any).maxSelect || 0
      const newMaxSelect = (newField as any).maxSelect || 0
      if (oldMaxSelect > 1 && newMaxSelect === 1) {
        detection.multiToSingleFields.push({ name: newField.name })
      }
    }
  }
  
  // 5. API 规则变更检测
  const ruleNames = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule', 'authRule', 'manageRule']
  for (const ruleName of ruleNames) {
    const oldRule = (original as any)[ruleName]
    const newRule = (updated as any)[ruleName]
    if (oldRule !== newRule) {
      detection.changedRules.push({
        name: ruleName.replace('Rule', ''),
        old: oldRule ?? 'Superusers only',
        new: newRule ?? 'Superusers only',
      })
    }
  }
  
  // 6. OIDC Host 变更检测
  if ((updated as any).type === 'auth' && (updated as any).oauth2?.providers) {
    for (const provider of (updated as any).oauth2.providers) {
      if (provider.name === 'oidc' || provider.name === 'oidc2' || provider.name === 'oidc3') {
        const oldProvider = (original as any).oauth2?.providers?.find(
          (p: any) => p.name === provider.name
        )
        if (oldProvider && oldProvider.authURL !== provider.authURL) {
          detection.oidcHostChanged = true
        }
      }
    }
  }
  
  return detection
}

export function CollectionUpdateConfirm({
  open,
  onOpenChange,
  originalCollection,
  updatedCollection,
  onConfirm,
  isSubmitting = false,
}: CollectionUpdateConfirmProps) {
  // 变更检测
  const changes = useMemo(
    () => detectChanges(originalCollection, updatedCollection),
    [originalCollection, updatedCollection]
  )

  const hasDeletedFields = changes.deletedFields.length > 0
  const hasDangerousChanges = 
    hasDeletedFields || 
    changes.multiToSingleFields.length > 0 || 
    changes.oidcHostChanged

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm collection update</DialogTitle>
          <DialogDescription>
            Please review the following changes before confirming the update
          </DialogDescription>
        </DialogHeader>

        {/* 手动更新警告 */}
        {changes.hasManualUpdateWarning && (
          <Alert variant="default" className="border-amber-300 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Manual update may be required</AlertTitle>
            <AlertDescription className="text-amber-700">
              If collection changes involve rules, filters, or view queries of other collections, 
              you need to update them manually!
            </AlertDescription>
          </Alert>
        )}

        {/* 集合重命名 */}
        {changes.renamedCollection && (
          <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
            <div className="text-sm font-medium text-slate-600 mb-1">Collection renamed</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="line-through text-red-600 font-mono">
                {changes.renamedCollection.old}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <span className="font-mono font-medium text-green-600">
                {changes.renamedCollection.new}
              </span>
            </div>
          </div>
        )}
        
        {/* 字段重命名 */}
        {changes.renamedFields.length > 0 && (
          <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
            <div className="text-sm font-medium text-slate-600 mb-2">Fields renamed</div>
            <div className="space-y-1">
              {changes.renamedFields.map(({ old, new: newName }) => (
                <div key={old} className="flex items-center gap-2 text-sm">
                  <span className="line-through text-red-600 font-mono">{old}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="font-mono font-medium text-green-600">{newName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 多值→单值警告 */}
        {changes.multiToSingleFields.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Data may be truncated</AlertTitle>
            <AlertDescription>
              The following fields are changing from multi-select to single-select. 
              Only the first value will be kept, extra data will be discarded:
              <ul className="list-disc list-inside mt-2 font-mono">
                {changes.multiToSingleFields.map(f => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* OIDC Host 变更警告 */}
        {changes.oidcHostChanged && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>OIDC provider URL changed</AlertTitle>
            <AlertDescription>
              Warning: The OIDC provider's Auth URL has been changed. 
              This may prevent existing users from logging in!
            </AlertDescription>
          </Alert>
        )}

        {/* 字段删除警告 */}
        {hasDeletedFields && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Fields will be deleted!</AlertTitle>
            <AlertDescription>
              <p>Deleting fields will permanently delete all related data. This action cannot be undone.</p>
              <ul className="list-disc list-inside mt-2">
                {changes.deletedFields.map((field) => (
                  <li key={field.id}>
                    <strong className="font-mono">{field.name}</strong>{' '}
                    <span className="text-muted-foreground">({field.type})</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* API 规则变更 */}
        {changes.changedRules.length > 0 && (
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-sm font-medium text-slate-600 mb-2">API Rules changed</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    <th className="pb-2 pr-4 font-medium text-slate-500">Rule</th>
                    <th className="pb-2 pr-4 font-medium text-slate-500">Old value</th>
                    <th className="pb-2 font-medium text-slate-500">New value</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.changedRules.map(rule => (
                    <tr key={rule.name} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-mono text-slate-700">{rule.name}</td>
                      <td className={cn(
                        "py-2 pr-4 font-mono text-xs",
                        rule.old === 'Superusers only' ? 'text-slate-400 italic' : 'text-red-600'
                      )}>
                        {rule.old === '' ? '(empty - everyone)' : rule.old}
                      </td>
                      <td className={cn(
                        "py-2 font-mono text-xs",
                        rule.new === 'Superusers only' ? 'text-slate-400 italic' : 'text-green-600'
                      )}>
                        {rule.new === '' ? '(empty - everyone)' : rule.new}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <CollectionsDiffTable
          collectionA={originalCollection}
          collectionB={updatedCollection}
          deleteMissing={true}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={hasDangerousChanges ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Confirm update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 导出变更检测函数供测试使用
export { detectChanges }
export type { ChangeDetection }
