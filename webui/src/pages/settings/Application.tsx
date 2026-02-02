/**
 * Application Settings 页面
 * 应用基本设置
 */
import { useEffect } from 'react'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Database, FileText, Loader2 } from 'lucide-react'

export function Application() {
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
  }, [loadSettings])

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
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Application</span>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本设置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="appName">Application name</Label>
            <Input
              id="appName"
              type="text"
              value={settings.meta.appName}
              onChange={(e) => updateSettings({ meta: { appName: e.target.value } })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appURL">Application URL</Label>
            <Input
              id="appURL"
              type="text"
              value={settings.meta.appURL}
              onChange={(e) => updateSettings({ meta: { appURL: e.target.value } })}
              required
            />
          </div>
        </div>

        {/* 数据库信息 */}
        <div className="bg-muted/50 border rounded-lg p-4">
          <h3 className="font-medium mb-3">数据库信息</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">数据库类型:</span>
            {healthData.databaseType ? (
              <span className="flex items-center gap-1">
                {healthData.databaseType === 'PostgreSQL' ? (
                  <Database className="w-4 h-4 text-green-500" />
                ) : (
                  <FileText className="w-4 h-4 text-green-500" />
                )}
                {healthData.databaseType}
              </span>
            ) : (
              <span className="text-muted-foreground">未知</span>
            )}
          </div>
        </div>

        {/* 高级设置 */}
        <Accordion type="multiple" className="w-full">
          {/* Trusted Proxy */}
          <AccordionItem value="trustedProxy">
            <AccordionTrigger>Trusted Proxy</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useLeftmostIP"
                    checked={settings.trustedProxy.useLeftmostIP}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        trustedProxy: { useLeftmostIP: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor="useLeftmostIP">Use leftmost IP</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proxyHeaders">Trusted headers (one per line)</Label>
                  <textarea
                    id="proxyHeaders"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md bg-background"
                    value={settings.trustedProxy.headers.join('\n')}
                    onChange={(e) =>
                      updateSettings({
                        trustedProxy: {
                          headers: e.target.value
                            .split('\n')
                            .map((h) => h.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Rate Limits */}
          <AccordionItem value="rateLimits">
            <AccordionTrigger>Rate Limits</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rateLimitsEnabled"
                    checked={settings.rateLimits.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        rateLimits: { enabled: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor="rateLimitsEnabled">Enable rate limiting</Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Batch */}
          <AccordionItem value="batch">
            <AccordionTrigger>Batch Requests</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="batchEnabled"
                    checked={settings.batch.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        batch: { enabled: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor="batchEnabled">Enable batch requests</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxRequests">Max requests</Label>
                    <Input
                      id="maxRequests"
                      type="number"
                      value={settings.batch.maxRequests}
                      onChange={(e) =>
                        updateSettings({
                          batch: { maxRequests: parseInt(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeout">Timeout (seconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={settings.batch.timeout}
                      onChange={(e) =>
                        updateSettings({
                          batch: { timeout: parseInt(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxBodySize">Max body size</Label>
                    <Input
                      id="maxBodySize"
                      type="number"
                      value={settings.batch.maxBodySize}
                      onChange={(e) =>
                        updateSettings({
                          batch: { maxBodySize: parseInt(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Hide Controls */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hideControls"
            checked={settings.meta.hideControls}
            onCheckedChange={(checked) =>
              updateSettings({ meta: { hideControls: checked as boolean } })
            }
          />
          <Label htmlFor="hideControls" className="flex items-center gap-2">
            Hide collection create and edit controls
            <span className="text-xs text-muted-foreground">
              (Prevents accidental schema changes in production)
            </span>
          </Label>
        </div>

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

export default Application
