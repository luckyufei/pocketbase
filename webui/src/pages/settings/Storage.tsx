/**
 * Storage Settings 页面
 * 文件存储设置（S3 兼容）
 */
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getApiClient } from '@/lib/ApiClient'

export function Storage() {
  const { t } = useTranslation()
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
    bucket: 'mybucket-1250000000',  // 格式：bucket名称-APPID，如 mybucket-1250000000
    region: 'ap-beijing',  // 地域，如 ap-beijing, ap-shanghai, ap-guangzhou
    endpoint: 'https://cos.ap-beijing.myqcloud.com',  // 腾讯云COS格式：https://cos.{region}.myqcloud.com
    accessKey: '',  // SecretId，从腾讯云控制台获取
    secret: '',  // SecretKey，从腾讯云控制台获取
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

  // 处理加密占位符值 - 在保存前将占位符设为空，让后端保留原值
  const prepareS3SettingsForSave = () => {
    const prepared = { ...s3Settings }
    // 如果字段是占位符，设为空让后端保留原值
    const isPlaceholder = (value: string) => value === '••••••••' || value === '******' || value === ''
    
    if (isPlaceholder(prepared.secret)) {
      prepared.secret = ''
    }
    if (isPlaceholder(prepared.accessKey)) {
      prepared.accessKey = ''
    }
    if (isPlaceholder(prepared.bucket)) {
      prepared.bucket = ''
    }
    if (isPlaceholder(prepared.endpoint)) {
      prepared.endpoint = ''
    }
    if (isPlaceholder(prepared.region)) {
      prepared.region = ''
    }
    return prepared
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // 保存前处理加密占位符
      const preparedS3 = prepareS3SettingsForSave()
      updateSettings({ s3: preparedS3 })
      // 等待状态更新后再保存
      await new Promise(resolve => setTimeout(resolve, 0))
      await saveSettings()
      toast.success(t('storageSettings.saveSuccess', 'Settings saved successfully'))
    } catch (err: any) {
      const message = err?.message || t('storageSettings.saveError', 'Failed to save settings')
      toast.error(message)
    }
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
          <span>{t('settingsLayout.title', 'Settings')}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{t('storageSettings.breadcrumb', 'Files storage')}</span>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 说明文字 */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>{t('storageSettings.description1', 'By default PocketBase uses the local file system to store uploaded files.')}</p>
          <p>{t('storageSettings.description2', 'If you have limited disk space, you could optionally connect to an S3 compatible storage.')}</p>
        </div>

        {/* 启用 S3 开关 */}
        <div className="flex items-center space-x-2">
          <Switch
            id="s3Enabled"
            checked={s3Settings.enabled}
            onCheckedChange={(checked) => updateS3('enabled', checked)}
          />
          <Label htmlFor="s3Enabled">{t('storageSettings.useS3Storage', 'Use S3 storage')}</Label>
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
                <Label htmlFor="endpoint">{t('storageSettings.endpoint', 'Endpoint')} {!originalS3Enabled && <span className="text-destructive">*</span>}</Label>
                <Input
                  id="endpoint"
                  type="text"
                  value={s3Settings.endpoint}
                  onChange={(e) => updateS3('endpoint', e.target.value)}
                  placeholder="https://cos.ap-beijing.myqcloud.com"
                  required={!originalS3Enabled}
                />
              </div>

            {/* Bucket 和 Region */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bucket">{t('storageSettings.bucket', 'Bucket')} {!originalS3Enabled && <span className="text-destructive">*</span>}</Label>
                <Input
                  id="bucket"
                  type="text"
                  value={s3Settings.bucket}
                  onChange={(e) => updateS3('bucket', e.target.value)}
                  placeholder="mybucket-1250000000"
                  required={!originalS3Enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">{t('storageSettings.region', 'Region')} {!originalS3Enabled && <span className="text-destructive">*</span>}</Label>
                <Input
                  id="region"
                  type="text"
                  value={s3Settings.region}
                  onChange={(e) => updateS3('region', e.target.value)}
                  placeholder="ap-beijing"
                  required={!originalS3Enabled}
                />
              </div>
            </div>

            {/* Access Key 和 Secret */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessKey">{t('storageSettings.accessKey', 'Access key')} {!originalS3Enabled && <span className="text-destructive">*</span>}</Label>
                <Input
                  id="accessKey"
                  type="text"
                  value={s3Settings.accessKey}
                  onChange={(e) => updateS3('accessKey', e.target.value)}
                  autoComplete="off"
                  placeholder="Your access key"
                  required={!originalS3Enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">{t('storageSettings.secret', 'Secret')} {!originalS3Enabled && <span className="text-destructive">*</span>}</Label>
                <Input
                  id="secret"
                  type="password"
                  value={s3Settings.secret}
                  onChange={(e) => updateS3('secret', e.target.value)}
                  autoComplete="new-password"
                  placeholder={originalS3Enabled ? '••••••••' : ''}
                  required={!originalS3Enabled}
                />
                {originalS3Enabled && (
                  <p className="text-xs text-muted-foreground">{t('storageSettings.secretHint', 'Leave empty to keep the existing secret')}</p>
                )}
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
                {t('storageSettings.forcePathStyle', 'Force path-style addressing')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{t('storageSettings.forcePathStyleTooltip', 'Forces the request to use path-style addressing, eg. "https://s3.amazonaws.com/BUCKET/KEY" instead of the default "https://BUCKET.s3.amazonaws.com/KEY".')}</p>
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
              {t('common.reset', 'Reset')}
            </Button>
          )}
          {/* S3 连接状态 */}
          {s3Settings.enabled && !hasChanges && !isSaving && (
            <>
              {isTesting ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('storageSettings.testingConnection', 'Testing connection...')}
                </span>
              ) : testError ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-2 text-sm text-yellow-600 cursor-help">
                        <AlertTriangle className="h-4 w-4" />
                        {t('storageSettings.s3ConnectionFailed', 'Failed to establish S3 connection')}
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
                  {t('storageSettings.s3ConnectedSuccess', 'S3 connected successfully')}
                </span>
              ) : null}
            </>
          )}

          <Button type="submit" disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('common.saveChanges', 'Save changes')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default Storage
