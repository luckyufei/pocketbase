/**
 * Secrets Settings 页面
 * 环境变量/密钥管理
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Plus, Trash2, Edit2, Lock, AlertCircle } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import { formatDate } from '@/lib/dateUtils'

interface Secret {
  key: string
  masked_value?: string
  env: string
  description?: string
  created?: string
  updated?: string
}

interface SecretFormData {
  key: string
  value: string
  env: string
  description: string
}

const EMPTY_FORM: SecretFormData = {
  key: '',
  value: '',
  env: 'global',
  description: '',
}

// Key 格式校验正则：只允许大写字母、数字和下划线
const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/

export function Secrets() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog 状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null)
  const [formData, setFormData] = useState<SecretFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSecret, setDeletingSecret] = useState<Secret | null>(null)

  const pb = getApiClient()

  const loadSecrets = async () => {
    setIsLoading(true)
    try {
      const result = await pb.send('/api/secrets', { method: 'GET' })
      const items = result?.items || []
      setSecrets(items)
      setIsEnabled(true)
    } catch (err: unknown) {
      const error = err as { status?: number }
      if (error?.status === 503) {
        setIsEnabled(false)
        setSecrets([])
      } else {
        console.error('Failed to load secrets:', err)
        setSecrets([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSecrets()
  }, [])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.key) {
      errors.key = 'Key is required'
    } else if (!KEY_PATTERN.test(formData.key)) {
      errors.key = 'Key must start with uppercase letter and contain only uppercase letters, numbers and underscores'
    }

    if (!formData.value && !editingSecret) {
      errors.value = 'Value is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const openCreateDialog = () => {
    setEditingSecret(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (secret: Secret) => {
    setEditingSecret(secret)
    setFormData({
      key: secret.key,
      value: '', // 不显示当前值，让用户输入新值
      env: secret.env || 'global',
      description: secret.description || '',
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
      if (editingSecret) {
        // 更新 Secret
        await pb.send(`/api/secrets/${encodeURIComponent(editingSecret.key)}`, {
          method: 'PUT',
          body: {
            value: formData.value,
            description: formData.description,
          },
        })
      } else {
        // 创建 Secret
        await pb.send('/api/secrets', {
          method: 'POST',
          body: {
            key: formData.key,
            value: formData.value,
            env: formData.env,
            description: formData.description,
          },
        })
      }
      setDialogOpen(false)
      await loadSecrets()
    } catch (err) {
      console.error('Failed to save secret:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteDialog = (secret: Secret) => {
    setDeletingSecret(secret)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingSecret) return

    try {
      await pb.send(`/api/secrets/${encodeURIComponent(deletingSecret.key)}`, {
        method: 'DELETE',
      })
      setDeleteDialogOpen(false)
      setDeletingSecret(null)
      await loadSecrets()
    } catch (err) {
      console.error('Failed to delete secret:', err)
    }
  }

  const getEnvBadgeVariant = (env: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (env) {
      case 'production':
      case 'prod':
        return 'destructive'
      case 'development':
      case 'dev':
        return 'secondary'
      default:
        return 'default'
    }
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
      </header>

      {/* 功能未启用提示 */}
      {!isEnabled && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Secrets feature is disabled</AlertTitle>
          <AlertDescription>
            <p className="mt-1">
              To enable encrypted secret storage, set the <code className="bg-muted px-1 rounded">PB_MASTER_KEY</code> environment variable
              with a 64-character hex string (32 bytes).
            </p>
            <p className="mt-2 text-xs opacity-75">
              Example: <code className="bg-muted px-1 rounded">export PB_MASTER_KEY=$(openssl rand -hex 32)</code>
            </p>
          </AlertDescription>
        </Alert>
      )}

      {isEnabled && (
        <>
          {/* 操作按钮 */}
          <div className="flex gap-2 mb-4">
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              New Secret
            </Button>
            <Button variant="outline" onClick={loadSecrets} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* 提示信息 */}
          <p className="text-sm text-muted-foreground mb-4">
            <Lock className="w-3.5 h-3.5 inline mr-1" />
            Secrets are encrypted with AES-256-GCM. Values are never exposed in the UI.
          </p>

          {/* Secrets 列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
                {secrets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No secrets found. Click "New Secret" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  secrets.map((secret) => (
                    <TableRow key={`${secret.key}-${secret.env}`}>
                      <TableCell>
                        <span className="font-mono font-bold">{secret.key}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-muted-foreground">
                          <Lock className="w-3 h-3 inline mr-1" />
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(secret)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Overwrite value</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDeleteDialog(secret)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {/* 创建/编辑 Secret Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSecret ? `Edit Secret: ${editingSecret.key}` : 'New Secret'}
            </DialogTitle>
            <DialogDescription>
              {editingSecret
                ? 'Enter a new value to overwrite the existing secret.'
                : 'Create a new encrypted secret. Keys must be uppercase with underscores.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingSecret && (
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, key: e.target.value.toUpperCase() }))
                  }
                  placeholder="MY_SECRET_KEY"
                  className={`font-mono ${formErrors.key ? 'border-destructive' : ''}`}
                />
                {formErrors.key && (
                  <p className="text-sm text-destructive">{formErrors.key}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type="password"
                value={formData.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                placeholder={editingSecret ? 'Enter new value...' : 'Secret value'}
                className={`font-mono ${formErrors.value ? 'border-destructive' : ''}`}
              />
              {formErrors.value && (
                <p className="text-sm text-destructive">{formErrors.value}</p>
              )}
            </div>

            {!editingSecret && (
              <div className="space-y-2">
                <Label htmlFor="env">Environment</Label>
                <Select
                  value={formData.env}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, env: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (all environments)</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What is this secret used for?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSecret ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete secret "{deletingSecret?.key}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Secrets
