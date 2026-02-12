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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Lock,
  Key,
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

/**
 * Environment options for select
 */
const envOptions = [
  { label: 'Global', value: 'global' },
  { label: 'Development', value: 'dev' },
  { label: 'Production', value: 'prod' },
]

/**
 * Get badge variant based on environment
 */
function getEnvBadgeVariant(env: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (env) {
    case 'production':
    case 'prod':
      return 'destructive'
    case 'development':
    case 'dev':
      return 'secondary'
    default:
      return 'outline'
  }
}

/**
 * Format date string to locale string
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

export function Secrets() {
  const { t } = useTranslation()
  const [secrets, setSecrets] = useState<SecretInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDisabled, setIsDisabled] = useState(false)

  // 对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedSecret, setSelectedSecret] = useState<SecretInfo | null>(null)
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
      const result = await pb.send('/api/secrets', { method: 'GET' })
      // Ensure result is array
      const items = Array.isArray(result) ? result : (result?.secrets || result?.items || [])
      setSecrets(items)
    } catch (err: any) {
      console.error('Failed to load secrets:', err)
      if (err.status === 503) {
        setIsDisabled(true)
        setSecrets([])
      } else if (err.status === 401 || err.status === 403) {
        setError(t('secrets.unauthorized', 'Superuser permission required to manage Secrets.'))
      } else {
        setError(err.message || t('secrets.loadError', 'Failed to load Secrets'))
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
   * 打开创建对话框
   */
  const openCreateDialog = () => {
    setFormData(defaultFormData)
    setError(null)
    setIsCreateDialogOpen(true)
  }

  /**
   * 打开编辑对话框
   */
  const openEditDialog = (secret: SecretInfo) => {
    setSelectedSecret(secret)
    setFormData({
      key: secret.key,
      value: '', // Value not echoed back, need to re-enter
      env: secret.env || 'global',
      description: secret.description || '',
    })
    setError(null)
    setIsEditDialogOpen(true)
  }

  /**
   * 打开删除确认对话框
   */
  const openDeleteDialog = (secret: SecretInfo) => {
    setSelectedSecret(secret)
    setIsDeleteDialogOpen(true)
  }

  /**
   * 创建 Secret
   */
  const handleCreate = async () => {
    if (!formData.key || !formData.value) {
      setError(t('secrets.keyValueRequired', 'Key and Value are required'))
      return
    }

    // Validate key format
    if (!/^[A-Z0-9_]+$/.test(formData.key)) {
      setError(t('secrets.keyFormatError', 'Key must be uppercase letters, numbers, and underscores only'))
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
      setError(err.data?.message || err.message || t('secrets.createError', 'Failed to create Secret'))
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 更新 Secret
   */
  const handleUpdate = async () => {
    if (!selectedSecret || !formData.value) {
      setError(t('secrets.valueRequired', 'Value is required'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await pb.send(`/api/secrets/${encodeURIComponent(selectedSecret.key)}`, {
        method: 'PUT',
        body: {
          value: formData.value,
          description: formData.description,
        },
      })
      setIsEditDialogOpen(false)
      setSelectedSecret(null)
      setFormData(defaultFormData)
      await loadSecrets()
    } catch (err: any) {
      console.error('Failed to update secret:', err)
      setError(err.data?.message || err.message || t('secrets.updateError', 'Failed to update Secret'))
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 删除 Secret
   */
  const handleDelete = async () => {
    if (!selectedSecret) return

    setIsSaving(true)
    setError(null)

    try {
      await pb.send(`/api/secrets/${encodeURIComponent(selectedSecret.key)}`, {
        method: 'DELETE',
      })
      setIsDeleteDialogOpen(false)
      setSelectedSecret(null)
      await loadSecrets()
    } catch (err: any) {
      console.error('Failed to delete secret:', err)
      setError(err.data?.message || err.message || t('secrets.deleteError', 'Failed to delete Secret'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Page header */}
      <header className="page-header mb-6">
        <nav className="breadcrumbs flex items-center text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Secrets</span>
        </nav>
        <div className="flex items-center justify-between">
          <div />
          {!isDisabled && (
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              <span>New secret</span>
            </Button>
          )}
        </div>
      </header>

      {/* Disabled alert */}
      {isDisabled && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <Lock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            Secrets feature is disabled
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            <p className="mt-1">
              To enable encrypted secret storage, set the <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 py-0.5 rounded text-sm">PB_MASTER_KEY</code> environment variable
              with a 64-character hex string (32 bytes).
            </p>
            <p className="mt-2 text-sm opacity-80">
              Example: <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 py-0.5 rounded text-xs">export PB_MASTER_KEY=$(openssl rand -hex 32)</code>
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Error alert */}
      {error && !isDisabled && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{t('common.error', 'Error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Secrets list panel */}
      {!isDisabled && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl flex items-center gap-2">
              <Key className="w-5 h-5" />
              Encrypted Secrets
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSecrets}
              disabled={isLoading}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Secrets are encrypted with AES-256-GCM. Values are never exposed in the UI.
          </p>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : secrets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No secrets found. Click "New secret" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  secrets.map((secret) => (
                    <TableRow key={`${secret.key}-${secret.env}`}>
                      <TableCell>
                        <span className="font-mono font-bold">{secret.key}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          {secret.masked_value || '***'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getEnvBadgeVariant(secret.env)}>
                          {secret.env || 'global'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {secret.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(secret.updated)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(secret)}
                            title="Overwrite value"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(secret)}
                            title="Delete"
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
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Secret</DialogTitle>
            <DialogDescription>
              Create a new encrypted secret.
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive" className="my-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key">
                Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                placeholder="e.g., OPENAI_API_KEY"
                className="font-mono"
                pattern="[A-Z0-9_]+"
              />
              <p className="text-xs text-muted-foreground">
                Recommended format: <code className="bg-muted px-1 py-0.5 rounded">VENDOR_TYPE</code> (e.g., OPENAI_API_KEY)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value">
                Value <span className="text-destructive">*</span>
              </Label>
              <Input
                id="value"
                type="password"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter secret value"
                className="font-mono"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Value will be encrypted with AES-256-GCM
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env">Environment</Label>
              <Select
                value={formData.env}
                onValueChange={(value) => setFormData({ ...formData, env: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {envOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use different environments to isolate dev/prod secrets
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit (Overwrite) dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overwrite "{selectedSecret?.key}"</DialogTitle>
            <DialogDescription>
              Enter a new value to overwrite the existing secret.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="my-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-key">Key</Label>
              <Input
                id="edit-key"
                value={formData.key}
                disabled
                className="font-mono bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-value">
                Value <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-2">(enter new value to overwrite)</span>
              </Label>
              <Input
                id="edit-value"
                type="password"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter secret value"
                className="font-mono"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Value will be encrypted with AES-256-GCM
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Overwrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete secret "{selectedSecret?.key}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Secrets
