/**
 * Storage Settings 页面
 * 文件存储设置（S3 兼容）
 */
import { useEffect, useState, useRef } from 'react'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getApiClient } from '@/lib/ApiClient'

export function Storage() {
  const {
    settings,
    originalSettings,
    isLoading,
    isSaving,
    hasChanges,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings,
  } = useSettings()

  const [s3Settings, setS3Settings] = useState({
    enabled: false,
    bucket: '',
    region: '',
    endpoint: '',
    accessKey: '',
    secret: '',
    forcePathStyle: false,
  })

  const [originalS3Enabled, setOriginalS3Enabled] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const testDebounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadSettings()
    return () => {
      if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current)
      if (testDebounceRef.current) clearTimeout(testDebounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从 settings 同步 S3 设置
  useEffect(() => {
    if (settings.s3) {
      setS3Settings(settings.s3)
    }
  }, [settings])

  // 记录原始 S3 启用状态
  useEffect(() => {
    if (originalSettings?.s3) {
      setOriginalS3Enabled(originalSettings.s3.enabled || false)
    }
  }, [originalSettings])

  // 当 S3 已启用且没有变更时，自动测试连接
  useEffect(() => {
    if (originalS3Enabled && !hasChanges && !isSaving) {
      testConnectionWithDebounce(100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalS3Enabled, hasChanges, isSaving])

  const testConnectionWithDebounce = (timeout: number) => {
    setIsTesting(true)
    if (testDebounceRef.current) clearTimeout(testDebounceRef.current)
    testDebounceRef.current = setTimeout(() => {
      testConnection()
    }, timeout)
  }

  const testConnection = async () => {
    setTestError(null)
    setTestSuccess(false)

    if (!s3Settings.enabled) {
      setIsTesting(false)
      return
    }

    // 设置30秒超时
    if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current)
    testTimeoutRef.current = setTimeout(() => {
      setTestError('S3 test connection timeout.')
      setIsTesting(false)
    }, 30000)

    setIsTesting(true)

    try {
      const pb = getApiClient()
      await pb.settings.testS3('storage')
      setTestSuccess(true)
      setTestError(null)
    } catch (e: any) {
      // 获取完整的错误信息
      const rawData = e?.response?.data || e?.data || {}
      const rawError = rawData?.data?.rawError || ''
      const message = rawData?.message || e?.message || 'Failed to establish S3 connection'
      const fullError = rawError 
        ? `${message} Raw error: ${typeof rawError === 'object' ? JSON.stringify(rawError) : rawError}`
        : message
      setTestError(fullError)
      setTestSuccess(false)
    } finally {
      setIsTesting(false)
      if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings()
  }

  const updateS3 = (field: string, value: any) => {
    // Only update if value actually changed
    const currentValue = s3Settings[field as keyof typeof s3Settings]
    if (currentValue === value) {
      return
    }
    const newS3 = { ...s3Settings, [field]: value }
    setS3Settings(newS3)
    updateSettings({ s3: newS3 } as any)
  }

  // 检查 S3 启用状态是否改变
  const s3EnabledChanged = originalS3Enabled !== s3Settings.enabled

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Files storage</span>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 说明文字 */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>By default PocketBase uses the local file system to store uploaded files.</p>
          <p>If you have limited disk space, you could optionally connect to an S3 compatible storage.</p>
        </div>

        {/* 启用 S3 开关 */}
        <div className="flex items-center space-x-2">
          <Switch
            id="s3Enabled"
            checked={s3Settings.enabled}
            onCheckedChange={(checked) => updateS3('enabled', checked)}
          />
          <Label htmlFor="s3Enabled">Use S3 storage</Label>
        </div>

        {/* 迁移警告 */}
        {s3EnabledChanged && (
          <Alert variant="warning" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              If you have existing uploaded files, you'll have to migrate them manually from the{' '}
              <strong>{originalS3Enabled ? 'S3 storage' : 'local file system'}</strong> to the{' '}
              <strong>{s3Settings.enabled ? 'S3 storage' : 'local file system'}</strong>.
              <br />
              There are numerous command line tools that can help you, such as:{' '}
              <a
                href="https://github.com/rclone/rclone"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:no-underline"
              >
                rclone
              </a>
              ,{' '}
              <a
                href="https://github.com/peak/s5cmd"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:no-underline"
              >
                s5cmd
              </a>
              , etc.
            </AlertDescription>
          </Alert>
        )}

        {s3Settings.enabled && (
          <div className="space-y-4 pl-6 border-l-2 border-muted">
            {/* Endpoint */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint <span className="text-destructive">*</span></Label>
              <Input
                id="endpoint"
                type="text"
                value={s3Settings.endpoint}
                onChange={(e) => updateS3('endpoint', e.target.value)}
                placeholder="https://s3.amazonaws.com"
                required
              />
            </div>

            {/* Bucket 和 Region */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket <span className="text-destructive">*</span></Label>
                <Input
                  id="bucket"
                  type="text"
                  value={s3Settings.bucket}
                  onChange={(e) => updateS3('bucket', e.target.value)}
                  placeholder="my-bucket"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region <span className="text-destructive">*</span></Label>
                <Input
                  id="region"
                  type="text"
                  value={s3Settings.region}
                  onChange={(e) => updateS3('region', e.target.value)}
                  placeholder="us-east-1"
                  required
                />
              </div>
            </div>

            {/* Access Key 和 Secret */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessKey">Access key <span className="text-destructive">*</span></Label>
                <Input
                  id="accessKey"
                  type="text"
                  value={s3Settings.accessKey}
                  onChange={(e) => updateS3('accessKey', e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">Secret <span className="text-destructive">*</span></Label>
                <Input
                  id="secret"
                  type="password"
                  value={s3Settings.secret}
                  onChange={(e) => updateS3('secret', e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {/* Force Path Style */}
            <div className="flex items-center space-x-2">
              <Switch
                id="forcePathStyle"
                checked={s3Settings.forcePathStyle}
                onCheckedChange={(checked) => updateS3('forcePathStyle', checked)}
              />
              <Label htmlFor="forcePathStyle" className="flex items-center gap-1">
                Force path-style addressing
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>Forces the request to use path-style addressing, eg. "https://s3.amazonaws.com/BUCKET/KEY" instead of the default "https://BUCKET.s3.amazonaws.com/KEY".</p>
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

          {/* S3 连接状态 - 紧挨着按钮 */}
          {s3Settings.enabled && !hasChanges && !isSaving && (
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
                    <TooltipContent side="top" className="max-w-sm break-words whitespace-pre-wrap">
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

          <Button type="submit" disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}

export default Storage
