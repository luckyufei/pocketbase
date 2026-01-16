// T047: Collection 创建/编辑面板
import { useState, useEffect, useCallback } from 'react'
import type { CollectionModel } from 'pocketbase'
import { OverlayPanel } from '@/components/OverlayPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CollectionFieldsTab, type CollectionData } from './CollectionFieldsTab'
import { CollectionRulesTab } from './CollectionRulesTab'
import { CollectionAuthOptionsTab } from './CollectionAuthOptionsTab'

interface UpsertPanelProps {
  open: boolean
  onClose: () => void
  collection?: CollectionModel | null
  onSave: (data: Partial<CollectionModel>) => Promise<void>
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
export function UpsertPanel({ open, onClose, collection, onSave }: UpsertPanelProps) {
  const [formData, setFormData] = useState<typeof defaultCollection>(defaultCollection)
  const [saving, setSaving] = useState(false)

  const isEdit = !!collection?.id

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

  // 类型描述映射
  const typeDescriptions: Record<string, string> = {
    auth: '用于存储用户账户数据，包含内置的认证字段',
    base: '标准数据表，用于存储应用数据',
    view: '只读视图，基于 SQL 查询',
  }

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      title={isEdit ? `编辑 ${collection?.name}` : '新建 Collection'}
      width="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本信息 - 放在 tabs 上方 */}
        <div className="space-y-4 pb-4 border-b">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="collection_name"
              pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
              required
              disabled={collection?.system}
            />
            <p className="text-xs text-muted-foreground">
              只能包含字母、数字和下划线，且不能以数字开头
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">类型</Label>
            <Select
              value={formData.type || 'base'}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as any }))}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="view">View</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {typeDescriptions[formData.type || 'base']}
            </p>
          </div>
        </div>

        {/* Tabs - 字段、API 规则、选项 */}
        <Tabs defaultValue="schema">
          <TabsList className="w-full">
            <TabsTrigger value="schema" className="flex-1">
              字段
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex-1">
              API 规则
            </TabsTrigger>
            {formData.type === 'auth' && (
              <TabsTrigger value="options" className="flex-1">
                选项
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="schema" className="pt-4">
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
          </TabsContent>

          <TabsContent value="rules" className="pt-4">
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
          </TabsContent>

          {formData.type === 'auth' && (
            <TabsContent value="options" className="pt-4">
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
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中...' : isEdit ? '保存' : '创建'}
          </Button>
        </div>
      </form>
    </OverlayPanel>
  )
}

export default UpsertPanel
