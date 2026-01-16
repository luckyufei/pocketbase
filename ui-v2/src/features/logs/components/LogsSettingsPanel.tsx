/**
 * 日志设置面板组件
 * 用于配置日志保留天数、最小日志级别、IP 和 Auth Id 日志开关
 */
import { useState, useEffect, useCallback, useId } from 'react'
import { useSetAtom } from 'jotai'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { pb } from '@/lib/ApiClient'
import { addToast } from '@/store/toasts'

/** 日志级别定义 */
const LOG_LEVELS = [
  { level: -4, label: 'DEBUG' },
  { level: 0, label: 'INFO' },
  { level: 4, label: 'WARN' },
  { level: 8, label: 'ERROR' },
]

/** 日志设置类型 */
interface LogsSettings {
  maxDays: number
  minLevel: number
  logIP: boolean
  logAuthId: boolean
}

interface LogsSettingsPanelProps {
  /** 面板是否打开 */
  open: boolean
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void
  /** 保存成功回调 */
  onSave?: (settings: LogsSettings) => void
}

export function LogsSettingsPanel({ open, onOpenChange, onSave }: LogsSettingsPanelProps) {
  const showToast = useSetAtom(addToast)
  const formId = useId()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 原始设置（用于检测变更）
  const [originalSettings, setOriginalSettings] = useState<LogsSettings | null>(null)
  // 表单设置
  const [formSettings, setFormSettings] = useState<LogsSettings>({
    maxDays: 7,
    minLevel: 0,
    logIP: true,
    logAuthId: false,
  })

  // 检测是否有变更
  const hasChanges =
    originalSettings !== null && JSON.stringify(originalSettings) !== JSON.stringify(formSettings)

  // 加载设置
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const settings = await pb.settings.getAll()
      const logsSettings: LogsSettings = {
        maxDays: settings?.logs?.maxDays ?? 7,
        minLevel: settings?.logs?.minLevel ?? 0,
        logIP: settings?.logs?.logIP ?? true,
        logAuthId: settings?.logs?.logAuthId ?? false,
      }
      setFormSettings(logsSettings)
      setOriginalSettings(logsSettings)
    } catch (err) {
      setError('Failed to load settings')
      console.error('Failed to load logs settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 面板打开时加载设置
  useEffect(() => {
    if (open) {
      loadSettings()
      setSaveError(null)
    }
  }, [open, loadSettings])

  // 保存设置
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasChanges) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const result = await pb.settings.update({
        logs: formSettings,
      })

      const newSettings: LogsSettings = {
        maxDays: result?.logs?.maxDays ?? formSettings.maxDays,
        minLevel: result?.logs?.minLevel ?? formSettings.minLevel,
        logIP: result?.logs?.logIP ?? formSettings.logIP,
        logAuthId: result?.logs?.logAuthId ?? formSettings.logAuthId,
      }

      setOriginalSettings(newSettings)
      setFormSettings(newSettings)

      showToast({
        type: 'success',
        message: 'Successfully saved logs settings.',
      })

      onSave?.(newSettings)
      onOpenChange(false)
    } catch (err) {
      setSaveError('Failed to save settings')
      console.error('Failed to save logs settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // 取消
  const handleCancel = () => {
    onOpenChange(false)
  }

  // 更新表单字段
  const updateField = <K extends keyof LogsSettings>(field: K, value: LogsSettings[K]) => {
    setFormSettings((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Logs settings</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="loading-spinner">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{error}</div>
        ) : (
          <form id={formId} className="space-y-6 py-4" onSubmit={handleSave}>
            {/* Max days retention */}
            <div className="space-y-2">
              <Label htmlFor={`${formId}-maxDays`}>Max days retention</Label>
              <Input
                id={`${formId}-maxDays`}
                type="number"
                required
                min={0}
                value={formSettings.maxDays}
                onChange={(e) => updateField('maxDays', parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Set to <code className="bg-muted px-1 rounded">0</code> to disable logs persistence.
              </p>
            </div>

            {/* Min log level */}
            <div className="space-y-2">
              <Label htmlFor={`${formId}-minLevel`}>Min log level</Label>
              <Input
                id={`${formId}-minLevel`}
                type="number"
                required
                min={-100}
                max={100}
                value={formSettings.minLevel}
                onChange={(e) => updateField('minLevel', parseInt(e.target.value, 10) || 0)}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Logs with level below the minimum will be ignored.</p>
                <div>
                  <span>Default log levels: </span>
                  <span className="inline-flex flex-wrap gap-1">
                    {LOG_LEVELS.map((l) => (
                      <code key={l.level} className="bg-muted px-1 rounded text-xs">
                        {l.level}:{l.label}
                      </code>
                    ))}
                  </span>
                </div>
              </div>
            </div>

            {/* Enable IP logging */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${formId}-logIP`}
                checked={formSettings.logIP}
                onCheckedChange={(checked) => updateField('logIP', checked === true)}
              />
              <Label htmlFor={`${formId}-logIP`} className="cursor-pointer">
                Enable IP logging
              </Label>
            </div>

            {/* Enable Auth Id logging */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${formId}-logAuthId`}
                checked={formSettings.logAuthId}
                onCheckedChange={(checked) => updateField('logAuthId', checked === true)}
              />
              <Label htmlFor={`${formId}-logAuthId`} className="cursor-pointer">
                Enable Auth Id logging
              </Label>
            </div>

            {/* 保存错误提示 */}
            {saveError && <div className="text-sm text-destructive">{saveError}</div>}
          </form>
        )}

        <SheetFooter className="mt-4">
          <Button type="button" variant="outline" disabled={isSaving} onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
