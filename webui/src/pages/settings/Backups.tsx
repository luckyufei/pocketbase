/**
 * Backups Settings 页面
 * 数据库备份管理 - 与 UI 版本保持一致
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  Loader2,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileArchive,
  Upload,
  RotateCcw,
  Info,
  AlertTriangle,
  CheckCircle2,
  Play,
  Copy,
  Check,
} from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'

interface Backup {
  key: string
  size: number
  modified: string
}

interface BackupsSettings {
  cron: string
  cronMaxKeep: number
  s3: {
    enabled: boolean
    endpoint: string
    bucket: string
    region: string
    accessKey: string
    secret: string
    forcePathStyle: boolean
  }
}

export function Backups() {
  const pb = getApiClient()
  
  // Backup list state
  const [backups, setBackups] = useState<Backup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [canBackup, setCanBackup] = useState(true)
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({})
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})
  
  // Settings state
  const [showBackupsOptions, setShowBackupsOptions] = useState(false)
  const [settings, setSettings] = useState<BackupsSettings>({
    cron: '',
    cronMaxKeep: 3,
    s3: {
      enabled: false,
      endpoint: '',
      bucket: '',
      region: '',
      accessKey: '',
      secret: '',
      forcePathStyle: false,
    },
  })
  const [originalSettings, setOriginalSettings] = useState<BackupsSettings | null>(null)
  const [enableAutoBackups, setEnableAutoBackups] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)
  
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<string>('')
  const [newBackupName, setNewBackupName] = useState('')
  const [restoreConfirmName, setRestoreConfirmName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [copiedName, setCopiedName] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canBackupIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if settings have changes
  const hasChanges = originalSettings ? JSON.stringify(settings) !== JSON.stringify(originalSettings) : false

  // Load backups list
  const loadBackups = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await pb.backups.getFullList()
      // Sort by modified date DESC
      const sorted = (list || []).sort((a: Backup, b: Backup) => {
        if (a.modified < b.modified) return 1
        if (a.modified > b.modified) return -1
        return 0
      })
      setBackups(sorted)
    } catch (err) {
      console.error('Failed to load backups:', err)
    } finally {
      setIsLoading(false)
    }
  }, [pb.backups])

  // Check if can backup
  const loadCanBackup = useCallback(async () => {
    try {
      const health = await pb.health.check()
      const newCanBackup = health?.data?.canBackup !== false
      setCanBackup(newCanBackup)
    } catch (err) {
      // Ignore errors
    }
  }, [pb.health])

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const allSettings = await pb.settings.getAll()
      const backupsConfig = allSettings?.backups || {}
      const newSettings: BackupsSettings = {
        cron: backupsConfig.cron || '',
        cronMaxKeep: backupsConfig.cronMaxKeep || 3,
        s3: {
          enabled: backupsConfig.s3?.enabled || false,
          endpoint: backupsConfig.s3?.endpoint || '',
          bucket: backupsConfig.s3?.bucket || '',
          region: backupsConfig.s3?.region || '',
          accessKey: backupsConfig.s3?.accessKey || '',
          secret: backupsConfig.s3?.secret || '',
          forcePathStyle: backupsConfig.s3?.forcePathStyle || false,
        },
      }
      setSettings(newSettings)
      setOriginalSettings(JSON.parse(JSON.stringify(newSettings)))
      setEnableAutoBackups(!!newSettings.cron)
      
      // Test S3 connection if enabled
      if (newSettings.s3.enabled) {
        testS3Connection()
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [pb.settings])

  // Test S3 connection
  const testS3Connection = async () => {
    setIsTesting(true)
    setTestError(null)
    setTestSuccess(false)
    
    try {
      await pb.settings.testS3('backups')
      setTestSuccess(true)
    } catch (err: any) {
      setTestError(err?.response?.message || err?.message || 'Connection failed')
    } finally {
      setIsTesting(false)
    }
  }

  useEffect(() => {
    loadBackups()
    loadSettings()
    loadCanBackup()
    
    // Poll canBackup status every 3 seconds
    canBackupIntervalRef.current = setInterval(loadCanBackup, 3000)
    
    return () => {
      if (canBackupIntervalRef.current) {
        clearInterval(canBackupIntervalRef.current)
      }
    }
  }, [loadBackups, loadSettings, loadCanBackup])

  // Handle auto backup toggle
  useEffect(() => {
    if (!enableAutoBackups && settings.cron) {
      setSettings(prev => ({ ...prev, cron: '' }))
    }
  }, [enableAutoBackups])

  // Save settings
  const saveSettings = async () => {
    if (isSaving || !hasChanges) return
    
    setIsSaving(true)
    try {
      // Filter out redacted fields
      const toSave: any = {
        backups: {
          ...settings,
          s3: { ...settings.s3 }
        }
      }
      // Don't send secret if it's redacted
      if (settings.s3.secret && settings.s3.secret.includes('*')) {
        delete toSave.backups.s3.secret
      }
      
      const result = await pb.settings.update(toSave)
      const backupsConfig = result?.backups || {}
      const newSettings: BackupsSettings = {
        cron: backupsConfig.cron || '',
        cronMaxKeep: backupsConfig.cronMaxKeep || 3,
        s3: {
          enabled: backupsConfig.s3?.enabled || false,
          endpoint: backupsConfig.s3?.endpoint || '',
          bucket: backupsConfig.s3?.bucket || '',
          region: backupsConfig.s3?.region || '',
          accessKey: backupsConfig.s3?.accessKey || '',
          secret: backupsConfig.s3?.secret || '',
          forcePathStyle: backupsConfig.s3?.forcePathStyle || false,
        },
      }
      setSettings(newSettings)
      setOriginalSettings(JSON.parse(JSON.stringify(newSettings)))
      
      await loadBackups()
      toast.success('Successfully saved backups settings.')
      
      if (newSettings.s3.enabled) {
        testS3Connection()
      }
    } catch (err: any) {
      toast.error(err?.response?.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  // Reset settings
  const resetSettings = () => {
    if (originalSettings) {
      setSettings(JSON.parse(JSON.stringify(originalSettings)))
      setEnableAutoBackups(!!originalSettings.cron)
    }
  }

  // Download backup
  const downloadBackup = async (key: string) => {
    if (isDownloading[key]) return
    
    setIsDownloading(prev => ({ ...prev, [key]: true }))
    try {
      const token = await pb.files.getToken()
      const url = pb.backups.getDownloadURL(token, key)
      window.open(url, '_blank')
    } catch (err) {
      console.error('Failed to download backup:', err)
      toast.error('Failed to download backup')
    } finally {
      setIsDownloading(prev => ({ ...prev, [key]: false }))
    }
  }

  // Delete backup
  const confirmDeleteBackup = (key: string) => {
    setSelectedBackup(key)
    setDeleteDialogOpen(true)
  }

  const deleteBackup = async () => {
    const key = selectedBackup
    if (isDeleting[key]) return
    
    setIsDeleting(prev => ({ ...prev, [key]: true }))
    try {
      await pb.backups.delete(key)
      await loadBackups()
      toast.success(`Successfully deleted ${key}.`)
    } catch (err) {
      console.error('Failed to delete backup:', err)
      toast.error('Failed to delete backup')
    } finally {
      setIsDeleting(prev => ({ ...prev, [key]: false }))
      setDeleteDialogOpen(false)
    }
  }

  // Create backup
  const createBackup = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    try {
      await pb.backups.create(newBackupName || '')
      await loadBackups()
      toast.success('Successfully generated new backup.')
      setCreateDialogOpen(false)
      setNewBackupName('')
    } catch (err: any) {
      toast.error(err?.response?.message || 'Failed to create backup')
    } finally {
      setIsCreating(false)
    }
  }

  // Restore backup
  const openRestoreDialog = (key: string) => {
    setSelectedBackup(key)
    setRestoreConfirmName('')
    setRestoreDialogOpen(true)
  }

  const restoreBackup = async () => {
    if (isRestoring || restoreConfirmName !== selectedBackup) return
    
    setIsRestoring(true)
    try {
      await pb.backups.restore(selectedBackup)
      // Reload page after restore
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err: any) {
      setIsRestoring(false)
      toast.error(err?.response?.message || 'Failed to restore backup')
    }
  }

  // Upload backup
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedBackup(file.name)
      setUploadDialogOpen(true)
    }
  }

  const uploadBackup = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file || isUploading) return
    
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      await pb.backups.upload({ file })
      await loadBackups()
      toast.success('Successfully uploaded a new backup.')
      setUploadDialogOpen(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.file?.message || err?.response?.message || 'Failed to upload backup')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Format helpers
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Copy backup name
  const copyBackupName = () => {
    navigator.clipboard.writeText(selectedBackup)
    setCopiedName(true)
    setTimeout(() => setCopiedName(false), 2000)
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Backups</span>
        </nav>
      </header>

      <div className="space-y-4">
        {/* 标题行 */}
        <div className="flex items-center gap-2">
          <span className="text-base">Backup and restore your PocketBase data</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadBackups} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUploadClick} disabled={isUploading}>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload backup</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* 备份列表 */}
        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[342px] overflow-auto">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No backups yet.
              </div>
            ) : (
              backups.map((backup) => (
                <div key={backup.key} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50">
                  <FileArchive className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-mono text-sm truncate max-w-[300px]" title={backup.key}>
                      {backup.key}
                    </span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      ({formatSize(backup.size)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => downloadBackup(backup.key)}
                            disabled={isDownloading[backup.key] || isDeleting[backup.key]}
                          >
                            {isDownloading[backup.key] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openRestoreDialog(backup.key)}
                            disabled={isDeleting[backup.key]}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Restore</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => confirmDeleteBackup(backup.key)}
                            disabled={isDeleting[backup.key]}
                          >
                            {isDeleting[backup.key] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Initialize new backup 按钮 */}
          <div className="border-t">
            <button
              type="button"
              className="w-full py-3 flex items-center justify-center gap-2 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !canBackup}
              onClick={() => {
                setNewBackupName('')
                setCreateDialogOpen(true)
              }}
            >
              {canBackup ? (
                <>
                  <Play className="h-4 w-4" />
                  <span>Initialize new backup</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Backup/restore operation is in process</span>
                </>
              )}
            </button>
          </div>
        </div>

        <hr className="my-4" />

        {/* Backups options 按钮 */}
        <Button
          variant="secondary"
          onClick={() => setShowBackupsOptions(!showBackupsOptions)}
          disabled={isLoading}
        >
          <span>Backups options</span>
          {showBackupsOptions ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </Button>

        {/* Backups options 面板 */}
        {showBackupsOptions && !isLoading && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-150">
            {/* Enable auto backups */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableAutoBackups"
                checked={enableAutoBackups}
                onCheckedChange={(checked) => setEnableAutoBackups(checked as boolean)}
              />
              <Label htmlFor="enableAutoBackups">Enable auto backups</Label>
            </div>

            {/* Auto backup settings */}
            {enableAutoBackups && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-150">
                <div className="space-y-2">
                  <Label htmlFor="cron">Cron expression <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      id="cron"
                      value={settings.cron}
                      onChange={(e) => setSettings(prev => ({ ...prev, cron: e.target.value }))}
                      placeholder="* * * * *"
                      className="font-mono"
                      required
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Presets
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setSettings(prev => ({ ...prev, cron: '0 0 * * *' }))}>
                          Every day at 00:00h
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSettings(prev => ({ ...prev, cron: '0 0 * * 0' }))}>
                          Every sunday at 00:00h
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSettings(prev => ({ ...prev, cron: '0 0 * * 1,3' }))}>
                          Every Mon and Wed at 00:00h
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSettings(prev => ({ ...prev, cron: '0 0 1 * *' }))}>
                          Every first day of the month at 00:00h
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports numeric list, steps, ranges or{' '}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-primary cursor-help">macros</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="whitespace-pre">@yearly{'\n'}@annually{'\n'}@monthly{'\n'}@weekly{'\n'}@daily{'\n'}@midnight{'\n'}@hourly</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>.
                    <br />
                    The timezone is in UTC.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cronMaxKeep">Max @auto backups to keep <span className="text-destructive">*</span></Label>
                  <Input
                    id="cronMaxKeep"
                    type="number"
                    min={1}
                    value={settings.cronMaxKeep}
                    onChange={(e) => setSettings(prev => ({ ...prev, cronMaxKeep: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
            )}

            <div className="h-4" />

            {/* S3 Storage settings */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="s3Enabled"
                checked={settings.s3.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  s3: { ...prev.s3, enabled: checked as boolean }
                }))}
              />
              <Label htmlFor="s3Enabled">Store backups in S3 storage</Label>
            </div>

            {settings.s3.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 animate-in slide-in-from-top-2 duration-150">
                <div className="md:col-span-3 space-y-2">
                  <Label htmlFor="s3Endpoint">Endpoint <span className="text-destructive">*</span></Label>
                  <Input
                    id="s3Endpoint"
                    value={settings.s3.endpoint}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      s3: { ...prev.s3, endpoint: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="s3Bucket">Bucket <span className="text-destructive">*</span></Label>
                  <Input
                    id="s3Bucket"
                    value={settings.s3.bucket}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      s3: { ...prev.s3, bucket: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <Label htmlFor="s3Region">Region <span className="text-destructive">*</span></Label>
                  <Input
                    id="s3Region"
                    value={settings.s3.region}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      s3: { ...prev.s3, region: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label htmlFor="s3AccessKey">Access key <span className="text-destructive">*</span></Label>
                  <Input
                    id="s3AccessKey"
                    value={settings.s3.accessKey}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      s3: { ...prev.s3, accessKey: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label htmlFor="s3Secret">Secret <span className="text-destructive">*</span></Label>
                  <Input
                    id="s3Secret"
                    type="password"
                    value={settings.s3.secret}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      s3: { ...prev.s3, secret: e.target.value }
                    }))}
                    required
                  />
                </div>
                <div className="md:col-span-6 flex items-center space-x-2">
                  <Checkbox
                    id="s3ForcePathStyle"
                    checked={settings.s3.forcePathStyle}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      s3: { ...prev.s3, forcePathStyle: checked as boolean }
                    }))}
                  />
                  <Label htmlFor="s3ForcePathStyle" className="flex items-center gap-1">
                    <span>Force path-style addressing</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Forces the request to use path-style addressing, eg. "https://s3.amazonaws.com/BUCKET/KEY" instead of the default "https://BUCKET.s3.amazonaws.com/KEY".
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                </div>
              </div>
            )}

            {/* 操作按钮区域 */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              {hasChanges && (
                <Button type="button" variant="ghost" onClick={resetSettings} disabled={isSaving}>
                  Reset
                </Button>
              )}

              {/* S3 连接状态 */}
              {settings.s3.enabled && !hasChanges && !isSaving && (
                <>
                  {isTesting ? (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing connection...
                    </span>
                  ) : testError ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-2 text-sm text-yellow-600 cursor-help">
                            <AlertTriangle className="h-4 w-4" />
                            Failed to establish S3 connection
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <p className="text-sm">{testError}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : testSuccess ? (
                    <span className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      S3 connected successfully
                    </span>
                  ) : null}
                </>
              )}

              <Button onClick={saveSettings} disabled={!hasChanges || isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Backup Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">Initialize new backup</DialogTitle>
          </DialogHeader>
          
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p>
                  Please note that during the backup other concurrent write requests may fail since the
                  database will be temporary "locked" (this usually happens only during the ZIP generation).
                </p>
                <p className="font-semibold">
                  If you are using S3 storage for the collections file upload, you'll have to backup them
                  separately since they are not locally stored and will not be included in the final backup!
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="backupName">Backup name</Label>
            <Input
              id="backupName"
              value={newBackupName}
              onChange={(e) => setNewBackupName(e.target.value)}
              placeholder="Leave empty to autogenerate"
              pattern="^[a-z0-9_-]+\.zip$"
            />
            <p className="text-xs text-muted-foreground">Must be in the format [a-z0-9_-].zip</p>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={createBackup} disabled={isCreating}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={(open) => !isRestoring && setRestoreDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Restore <strong>{selectedBackup}</strong>
            </DialogTitle>
          </DialogHeader>
          
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold">Please proceed with caution and use it only with trusted backups!</p>
                <p>Backup restore is experimental and works only on UNIX based systems.</p>
                <p>
                  The restore operation will attempt to replace your existing <code className="bg-muted px-1 rounded">pb_data</code> with the one from
                  the backup and will restart the application process.
                </p>
                <p>
                  This means that on success all of your data (including app settings, users, superusers, etc.)
                  will be replaced with the ones from the backup.
                </p>
                <p>
                  Nothing will happen if the backup is invalid (ex. missing <code className="bg-muted px-1 rounded">data.db</code> file).
                </p>
                <p>Below is an oversimplified version of the restore flow:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Replaces the current <code className="bg-muted px-1 rounded">pb_data</code> with the content from the backup</li>
                  <li>Triggers app restart</li>
                  <li>Applies all migrations that are missing in the restored <code className="bg-muted px-1 rounded">pb_data</code></li>
                  <li>Initializes the app server as usual</li>
                </ol>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm">
              Type the backup name{' '}
              <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-sm font-mono">
                {selectedBackup}
                <button onClick={copyBackupName} className="hover:text-primary">
                  {copiedName ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </span>
              {' '}to confirm:
            </p>
            <div className="space-y-1">
              <Label htmlFor="restoreConfirm">Backup name <span className="text-destructive">*</span></Label>
              <Input
                id="restoreConfirm"
                value={restoreConfirmName}
                onChange={(e) => setRestoreConfirmName(e.target.value)}
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRestoreDialogOpen(false)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button
              onClick={restoreBackup}
              disabled={isRestoring || restoreConfirmName !== selectedBackup}
            >
              {isRestoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Restore backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Backup Dialog */}
      <AlertDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload backup</AlertDialogTitle>
            <AlertDialogDescription>
              Note that we don't perform validations for the uploaded backup files. Proceed with caution and only if you trust the source.
              <br /><br />
              Do you really want to upload "{selectedBackup}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploading} onClick={() => {
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={uploadBackup} disabled={isUploading}>
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Backup Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete backup</AlertDialogTitle>
            <AlertDialogDescription>
              Do you really want to delete {selectedBackup}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBackup}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Backups
