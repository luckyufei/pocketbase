/**
 * Application Settings 页面
 * 应用基本设置 - 与 UI 版本 1:1 对齐
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  TrustedProxyAccordion,
  RateLimitAccordion,
  BatchAccordion,
} from '@/features/settings/components'
import { Database, FileText, Loader2 } from 'lucide-react'

export function Application() {
  const { t } = useTranslation()
  const {
    settings,
    isLoading,
    isSaving,
    hasChanges,
    healthData,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings,
  } = useSettings()

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings()
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
      {/* Page header */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>{t('settingsPage.breadcrumbSettings')}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{t('settingsPage.application.breadcrumb')}</span>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="appName"
              className="after:content-['*'] after:text-destructive after:ml-0.5"
            >
              {t('settingsPage.application.appName')}
            </Label>
            <Input
              id="appName"
              type="text"
              value={settings.meta.appName}
              onChange={(e) => updateSettings({ meta: { appName: e.target.value } })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="appURL"
              className="after:content-['*'] after:text-destructive after:ml-0.5"
            >
              {t('settingsPage.application.appURL')}
            </Label>
            <Input
              id="appURL"
              type="text"
              value={settings.meta.appURL}
              onChange={(e) => updateSettings({ meta: { appURL: e.target.value } })}
              required
            />
          </div>
        </div>

        {/* Database info */}
        <div className="bg-muted/50 border rounded-lg p-4">
          <h3 className="font-medium mb-3 text-sm">{t('settingsPage.application.dbInfo')}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('settingsPage.application.dbType')}</span>
            {healthData.databaseType ? (
              <span className="flex items-center gap-1.5 font-medium">
                {healthData.databaseType === 'PostgreSQL' ? (
                  <Database className="w-4 h-4 text-green-500" />
                ) : (
                  <FileText className="w-4 h-4 text-green-500" />
                )}
                {healthData.databaseType}
              </span>
            ) : (
              <span className="text-muted-foreground">{t('settingsPage.application.dbUnknown')}</span>
            )}
          </div>
        </div>

        {/* 高级设置 - 使用独立的 Accordion 组件，与 UI 版本一致 */}
        <div className="space-y-3">
          {/* Trusted Proxy */}
          <TrustedProxyAccordion
            settings={settings.trustedProxy}
            healthData={healthData}
            onChange={(trustedProxy) => updateSettings({ trustedProxy })}
          />

          {/* Rate Limits */}
          <RateLimitAccordion
            value={settings.rateLimits}
            onChange={(rateLimits) => updateSettings({ rateLimits })}
          />

          {/* Batch Requests */}
          <BatchAccordion
            settings={settings.batch}
            onChange={(batch) => updateSettings({ batch })}
            hideControls={settings.meta.hideControls}
            onHideControlsChange={(hideControls) => updateSettings({ meta: { hideControls } })}
          />
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {hasChanges && (
            <Button type="button" variant="ghost" onClick={resetSettings} disabled={isSaving}>
              {t('settingsPage.application.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={!hasChanges || isSaving} className="min-w-[120px]">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('settingsPage.application.saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default Application
