/**
 * Secrets Settings 页面
 * 环境变量/密钥管理
 *
 * 使用 /api/secrets 端点管理加密存储的敏感数据
 * 需要 Superuser 权限和 PB_MASTER_KEY 环境变量
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import { useTranslation } from 'react-i18next'

/**
 * Secret 信息（列表返回，值被掩码）
 */
interface SecretInfo {
  key: string
  masked_value: string
  env: string
  description?: string
  created: string
  updated: string
}

/**
 * API 列表响应
 */
interface SecretsListResponse {
  items: SecretInfo[]
  total: number
}

/**
 * 表单数据
 */
interface SecretFormData {
  key: string
  value: string
  env: string
  description: string
}

const defaultFormData: SecretFormData = {
  key: '',
  value: '',
  env: 'global',
  description: '',
}

export function Secrets() {
  const { t } = useTranslation()
  const [secrets, setSecrets] = useState<SecretInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDisabled, setIsDisabled] = useState(false)

  // 显示解密值的 keys
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [revealedValues, setRevealedValues] = useState<Map<string, string>>(new Map())
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())

  // 对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [formData, setFormData] = useState<SecretFormData>(defaultFormData)

  const pb = getApiClient()

  /**
   * 加载 Secrets 列表
   */
  const loadSecrets = async () => {
    setIsLoading(true)
    setError(null)
    setIsDisabled(false)

    try {
      const response = (await pb.send('/api/secrets', { method: 'GET' })) as SecretsListResponse
      setSecrets(response.items || [])
    } catch (err: any) {
      console.error('Failed to load secrets:', err)
      if (err.status === 503) {
        setIsDisabled(true)
        setError(t('secrets.disabled', 'Secrets 功能未启用。请设置 PB_MASTER_KEY 环境变量。'))
      } else if (err.status === 401 || err.status === 403) {
        setError(t('secrets.unauthorized', '需要 Superuser 权限才能管理 Secrets。'))
      } else {
        setError(err.message || t('secrets.loadError', '加载 Secrets 失败'))
      }
      setSecrets([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSecrets()
  }, [])

  /**
   * 显示/隐藏 Secret 解密值
   */
  const toggleRevealValue = async (key: string) => {
    if (revealedKeys.has(key)) {
      // 隐藏
      setRevealedKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      setRevealedValues((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      return
    }

    // 显示 - 需要从 API 获取解密值
    setLoadingKeys((prev) => new Set(prev).add(key))
    try {
      const response = await pb.send(`/api/secrets/${encodeURIComponent(key)}`, { method: 'GET' })
      setRevealedKeys((prev) => new Set(prev).add(key))
      setRevealedValues((prev) => new Map(prev).set(key, response.value))
    } catch (err: any) {
      console.error('Failed to reveal secret:', err)
      setError(err.message || t('secrets.revealError', '获取 Secret 值失败'))
    } finally {
      setLoadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  /**
   * 打开创建对话框
   */
  const openCreateDialog = () => {
    setFormData(defaultFormData)
    setIsCreateDialogOpen(true)
  }

  /**
   * 打开编辑对话框
   */
  const openEditDialog = async (key: string) => {
    setSelectedKey(key)
    const secret = secrets.find((s) => s.key === key)
    if (secret) {
      // 获取解密值
      try {
        const response = await pb.send(`/api/secrets/${encodeURIComponent(key)}`, { method: 'GET' })
        setFormData({
          key: secret.key,
          value: response.value,
          env: secret.env || 'global',
          description: secret.description || '',
        })
        setIsEditDialogOpen(true)
      } catch (err: any) {
        console.error('Failed to get secret for edit:', err)
        setError(err.message || t('secrets.getError', '获取 Secret 失败'))
      }
    }
  }

  /**
   * 打开删除确认对话框
   */
  const openDeleteDialog = (key: string) => {
    setSelectedKey(key)
    setIsDeleteDialogOpen(true)
  }

  /**
   * 创建 Secret
   */
  const handleCreate = async () => {
    if (!formData.key || !formData.value) {
      setError(t('secrets.keyValueRequired', 'Key 和 Value 是必填项'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await pb.send('/api/secrets', {
        method: 'POST',
        body: {
          key: formData.key,
          value: formData.value,
          env: formData.env || 'global',
          description: formData.description,
        },
      })
      setIsCreateDialogOpen(false)
      setFormData(defaultFormData)
      await loadSecrets()
    } catch (err: any) {
      console.error('Failed to create secret:', err)
      setError(err.message || t('secrets.createError', '创建 Secret 失败'))
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 更新 Secret
   */
  const handleUpdate = async () => {
    if (!selectedKey || !formData.value) {
      setError(t('secrets.valueRequired', 'Value 是必填项'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await pb.send(`/api/secrets/${encodeURIComponent(selectedKey)}`, {
        method: 'PUT',
        body: {
          value: formData.value,
          description: formData.description,
        },
      })
      setIsEditDialogOpen(false)
      setSelectedKey(null)
      setFormData(defaultFormData)
      // 清除缓存的解密值
      setRevealedKeys((prev) => {
        const next = new Set(prev)
        next.delete(selectedKey)
        return next
      })
      setRevealedValues((prev) => {
        const next = new Map(prev)
        next.delete(selectedKey)
        return next
      })
      await loadSecrets()
    } catch (err: any) {
      console.error('Failed to update secret:', err)
      setError(err.message || t('secrets.updateError', '更新 Secret 失败'))
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 删除 Secret
   */
  const handleDelete = async () => {
    if (!selectedKey) return

    setIsSaving(true)
    setError(null)

    try {
      await pb.send(`/api/secrets/${encodeURIComponent(selectedKey)}`, {
        method: 'DELETE',
      })
      setIsDeleteDialogOpen(false)
      setSelectedKey(null)
      // 清除缓存的解密值
      setRevealedKeys((prev) => {
        const next = new Set(prev)
        next.delete(selectedKey)
        return next
      })
      setRevealedValues((prev) => {
        const next = new Map(prev)
        next.delete(selectedKey)
        return next
      })
      await loadSecrets()
    } catch (err: any) {
      console.error('Failed to delete secret:', err)
      setError(err.message || t('secrets.deleteError', '删除 Secret 失败'))
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 获取显示的值（掩码或解密）
   */
  const getDisplayValue = (secret: SecretInfo) => {
    if (revealedKeys.has(secret.key)) {
      return revealedValues.get(secret.key) || ''
    }
    return secret.masked_value
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Secrets</span>
        </nav>
        <p className="text-sm text-muted-foreground mt-1">
          {t('secrets.description', '管理加密存储的敏感数据（API 密钥、令牌等）')}
        </p>
      </header>

      {/* 功能未启用提示 */}
      {isDisabled && (
        <Alert variant="destructive" className="mb-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t('secrets.disabledTitle', 'Secrets 功能未启用')}</AlertTitle>
          <AlertDescription>
            {t(
              'secrets.disabledDescription',
              '请在服务器上设置 PB_MASTER_KEY 环境变量（64 字符十六进制字符串）来启用 Secrets 功能。'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 错误提示 */}
      {error && !isDisabled && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('common.error', '错误')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <Button onClick={openCreateDialog} disabled={isDisabled}>
          <Plus className="w-4 h-4 mr-2" />
          {t('secrets.addSecret', 'Add Secret')}
        </Button>
        <Button variant="outline" onClick={loadSecrets} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Secrets 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('secrets.key', 'Key')}</TableHead>
              <TableHead>{t('secrets.value', 'Value')}</TableHead>
              <TableHead>{t('secrets.env', 'Env')}</TableHead>
              <TableHead className="w-32">{t('common.actions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {isDisabled
                    ? t('secrets.disabledEmpty', 'Secrets 功能未启用')
                    : t('secrets.empty', '暂无 Secrets。点击 "Add Secret" 创建一个。')}
                </TableCell>
              </TableRow>
            ) : (
              secrets.map((secret) => (
                <TableRow key={secret.key}>
                  <TableCell className="font-mono font-medium">{secret.key}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded max-w-xs truncate">
                        {getDisplayValue(secret)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleRevealValue(secret.key)}
                        disabled={loadingKeys.has(secret.key)}
                      >
                        {loadingKeys.has(secret.key) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : revealedKeys.has(secret.key) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{secret.env || 'global'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(secret.key)}
                        title={t('common.edit', 'Edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(secret.key)}
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* 创建对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('secrets.createTitle', '创建 Secret')}</DialogTitle>
            <DialogDescription>
              {t('secrets.createDescription', '创建一个新的加密存储密钥')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key">{t('secrets.key', 'Key')}</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="OPENAI_API_KEY"
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value">{t('secrets.value', 'Value')}</Label>
              <Input
                id="value"
                type="password"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="sk-..."
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env">{t('secrets.env', 'Environment')}</Label>
              <Input
                id="env"
                value={formData.env}
                onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                placeholder="global"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t('secrets.description', 'Description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('secrets.descriptionPlaceholder', 'Optional description')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('secrets.editTitle', '编辑 Secret')}</DialogTitle>
            <DialogDescription>
              {t('secrets.editDescription', '更新密钥 "{key}" 的值', { key: selectedKey })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-key">{t('secrets.key', 'Key')}</Label>
              <Input id="edit-key" value={formData.key} disabled className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-value">{t('secrets.value', 'Value')}</Label>
              <Input
                id="edit-value"
                type="password"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="sk-..."
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">{t('secrets.description', 'Description')}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('secrets.descriptionPlaceholder', 'Optional description')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('secrets.deleteTitle', '确认删除')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('secrets.deleteDescription', '确定要删除密钥 "{key}" 吗？此操作无法撤销。', {
                key: selectedKey,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Secrets
