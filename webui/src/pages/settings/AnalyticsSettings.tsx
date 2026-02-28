/**
 * Analytics Settings 页面
 * 分析数据收集和保留设置
 */
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

interface AnalyticsConfig {
  enabled: boolean
  retention: number
  s3Bucket: string
}

export function AnalyticsSettings() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AnalyticsConfig>({
    enabled: true,
    retention: 90,
    s3Bucket: '',
  })
  const [originalConfig, setOriginalConfig] = useState<AnalyticsConfig>({
    enabled: true,
    retention: 90,
    s3Bucket: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Use ref to track if component is mounted
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const pb = getApiClient()

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)

  useEffect(() => {
    isMountedRef.current = true
    
    const loadConfig = async () => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Create new abort controller
      abortControllerRef.current = new AbortController()
      
      setIsLoading(true)
      try {
        const settings = await pb.send('/api/settings', { 
          method: 'GET',
          signal: abortControllerRef.current.signal
        })
        
        // Only update state if component is still mounted
        if (!isMountedRef.current) return
        
        const analyticsConfig = settings?.analytics || {
          enabled: true,
          retention: 90,
          s3Bucket: '',
        }
        setConfig(analyticsConfig)
        setOriginalConfig(analyticsConfig)
      } catch (err: unknown) {
        // Don't show error for aborted requests or if unmounted
        if (!isMountedRef.current) return
        
        // Check if signal was aborted (most reliable check)
        if (abortControllerRef.current?.signal?.aborted) return
        
        // Check for abort error (various forms)
        if (err instanceof Error) {
          // Standard AbortError
          if (err.name === 'AbortError') return
          // DOMException with AbortError
          if (err instanceof DOMException && (err.name === 'AbortError' || err.code === 20)) return
          // PocketBase ClientResponseError may wrap the original error
          const anyErr = err as { originalError?: Error; cause?: Error }
          if (anyErr.originalError?.name === 'AbortError' || anyErr.cause?.name === 'AbortError') return
        }
        
        console.error('Failed to load analytics config:', err)
        toast.error(t('settingsPage.analyticsSettings.loadError'))
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }
    
    loadConfig()
    
    // Cleanup function
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const saveConfig = async () => {
    if (isSaving || !hasChanges) return

    setIsSaving(true)
    try {
      const settings = await pb.send('/api/settings', {
        method: 'PATCH',
        body: { analytics: config },
      })
      const analyticsConfig = settings?.analytics || config
      setConfig(analyticsConfig)
      setOriginalConfig(analyticsConfig)
      toast.success(t('settingsPage.analyticsSettings.saveSuccess'))
    } catch (err) {
      console.error('Failed to save analytics config:', err)
      toast.error(t('settingsPage.analyticsSettings.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const resetConfig = () => {
    setConfig({ ...originalConfig })
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
      {/* Page header */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>{t('settingsPage.breadcrumbSettings')}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{t('settingsPage.analyticsSettings.breadcrumb')}</span>
        </nav>
        <p className="text-sm text-muted-foreground">
          {t('settingsPage.analyticsSettings.description')}
        </p>
      </header>

      <div className="space-y-6">
        {/* Enable switch */}
        <div className="flex items-center space-x-2">
          <Switch
            id="enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
          />
          <Label htmlFor="enabled" className="flex items-center gap-1">
            {t('settingsPage.analyticsSettings.enableAnalytics')}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  {t('settingsPage.analyticsSettings.enableTooltip')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>

        {config.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data retention (days) */}
            <div className="space-y-2">
              <Label htmlFor="retention" className="flex items-center gap-1">
                {t('settingsPage.analyticsSettings.dataRetention')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      {t('settingsPage.analyticsSettings.dataRetentionTooltip')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="retention"
                type="number"
                min={1}
                required
                value={config.retention}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    retention: parseInt(e.target.value) || 90,
                  }))
                }
              />
            </div>

            {/* S3 Bucket */}
            <div className="space-y-2">
              <Label htmlFor="s3Bucket" className="flex items-center gap-1">
                {t('settingsPage.analyticsSettings.s3Bucket')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      {t('settingsPage.analyticsSettings.s3BucketTooltip')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="s3Bucket"
                value={config.s3Bucket}
                onChange={(e) => setConfig((prev) => ({ ...prev, s3Bucket: e.target.value }))}
                placeholder={t('settingsPage.analyticsSettings.s3BucketPlaceholder')}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-4">
          {hasChanges && (
            <Button variant="ghost" onClick={resetConfig} disabled={isSaving}>
              {t('settingsPage.analyticsSettings.cancel')}
            </Button>
          )}
          <Button onClick={saveConfig} disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('settingsPage.analyticsSettings.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsSettings
