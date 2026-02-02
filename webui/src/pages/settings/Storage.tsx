/**
 * Storage Settings 页面
 * 文件存储设置（S3 兼容）
 */
import { useEffect, useState } from 'react'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

export function Storage() {
  const {
    settings,
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

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // 从 settings 同步 S3 设置
  useEffect(() => {
    if ((settings as any).s3) {
      setS3Settings((settings as any).s3)
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings()
  }

  const updateS3 = (field: string, value: any) => {
    const newS3 = { ...s3Settings, [field]: value }
    setS3Settings(newS3)
    updateSettings({ s3: newS3 } as any)
  }

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
          <span className="text-foreground">Storage</span>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 启用 S3 */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="s3Enabled"
            checked={s3Settings.enabled}
            onCheckedChange={(checked) => updateS3('enabled', checked)}
          />
          <Label htmlFor="s3Enabled">Use S3 storage</Label>
        </div>

        {s3Settings.enabled && (
          <div className="space-y-4 pl-6 border-l-2 border-muted">
            {/* Bucket 和 Region */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket</Label>
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
                <Label htmlFor="region">Region</Label>
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

            {/* Endpoint */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                type="text"
                value={s3Settings.endpoint}
                onChange={(e) => updateS3('endpoint', e.target.value)}
                placeholder="https://s3.amazonaws.com"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default AWS S3 endpoint
              </p>
            </div>

            {/* Access Key 和 Secret */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessKey">Access key</Label>
                <Input
                  id="accessKey"
                  type="text"
                  value={s3Settings.accessKey}
                  onChange={(e) => updateS3('accessKey', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">Secret</Label>
                <Input
                  id="secret"
                  type="password"
                  value={s3Settings.secret}
                  onChange={(e) => updateS3('secret', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Force Path Style */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="forcePathStyle"
                checked={s3Settings.forcePathStyle}
                onCheckedChange={(checked) => updateS3('forcePathStyle', checked)}
              />
              <Label htmlFor="forcePathStyle">Force path-style addressing</Label>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {hasChanges && (
            <Button type="button" variant="ghost" onClick={resetSettings} disabled={isSaving}>
              Cancel
            </Button>
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
