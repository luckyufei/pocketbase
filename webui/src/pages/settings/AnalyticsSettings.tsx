/**
 * Analytics Settings 页面
 * 流量分析设置
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Save } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'

interface AnalyticsConfig {
  enabled: boolean
  trackingId?: string
  excludePaths?: string
  sampleRate?: number
}

export function AnalyticsSettings() {
  const [config, setConfig] = useState<AnalyticsConfig>({ enabled: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const pb = getApiClient()

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const settings = await pb.send('/api/settings', { method: 'GET' })
      setConfig(settings?.analytics || { enabled: false })
    } catch (err) {
      console.error('Failed to load analytics config:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const saveConfig = async () => {
    setIsSaving(true)
    try {
      await pb.send('/api/settings', {
        method: 'PATCH',
        body: { analytics: config },
      })
    } catch (err) {
      console.error('Failed to save analytics config:', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Analytics</span>
        </nav>
      </header>

      <div className="space-y-6">
        {/* 启用开关 */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: !!checked }))}
          />
          <Label htmlFor="enabled">Enable Analytics</Label>
        </div>

        {config.enabled && (
          <>
            {/* Tracking ID */}
            <div className="space-y-2">
              <Label htmlFor="trackingId">Tracking ID (optional)</Label>
              <Input
                id="trackingId"
                value={config.trackingId || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, trackingId: e.target.value }))}
                placeholder="UA-XXXXX-X or G-XXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Optional third-party analytics tracking ID
              </p>
            </div>

            {/* Exclude Paths */}
            <div className="space-y-2">
              <Label htmlFor="excludePaths">Exclude Paths</Label>
              <Input
                id="excludePaths"
                value={config.excludePaths || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, excludePaths: e.target.value }))}
                placeholder="/admin/*, /api/*"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of paths to exclude from tracking
              </p>
            </div>

            {/* Sample Rate */}
            <div className="space-y-2">
              <Label htmlFor="sampleRate">Sample Rate (%)</Label>
              <Input
                id="sampleRate"
                type="number"
                min={1}
                max={100}
                value={config.sampleRate || 100}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    sampleRate: parseInt(e.target.value) || 100,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Percentage of requests to track (1-100)
              </p>
            </div>
          </>
        )}

        {/* 保存按钮 */}
        <div className="pt-4">
          <Button onClick={saveConfig} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsSettings
