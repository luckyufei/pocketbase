/**
 * Mail Settings 页面
 * 邮件服务设置
 */
import { useEffect, useState } from 'react'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const tlsOptions = [
  { label: 'Auto (StartTLS)', value: 'false' },
  { label: 'Always', value: 'true' },
]

const authMethods = [
  { label: 'PLAIN (default)', value: 'PLAIN' },
  { label: 'LOGIN', value: 'LOGIN' },
]

export function Mail() {
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

  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [smtpSettings, setSmtpSettings] = useState({
    enabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    tls: false,
    authMethod: 'PLAIN',
    localName: '',
  })

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // 从 settings 同步 SMTP 设置
  useEffect(() => {
    if ((settings as any).smtp) {
      setSmtpSettings((settings as any).smtp)
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings()
  }

  const updateSmtp = (field: string, value: any) => {
    const newSmtp = { ...smtpSettings, [field]: value }
    setSmtpSettings(newSmtp)
    updateSettings({ smtp: newSmtp } as any)
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
          <span className="text-foreground">Mail</span>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 启用 SMTP */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="smtpEnabled"
            checked={smtpSettings.enabled}
            onCheckedChange={(checked) => updateSmtp('enabled', checked)}
          />
          <Label htmlFor="smtpEnabled">Use SMTP mail server</Label>
        </div>

        {smtpSettings.enabled && (
          <div className="space-y-4 pl-6 border-l-2 border-muted">
            {/* 发件人信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="senderName">Sender name</Label>
                <Input
                  id="senderName"
                  type="text"
                  value={settings.meta.appName || ''}
                  onChange={(e) => updateSettings({ meta: { appName: e.target.value } })}
                  placeholder="Support"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderAddress">Sender address</Label>
                <Input
                  id="senderAddress"
                  type="email"
                  value={(settings as any).smtp?.senderAddress || ''}
                  onChange={(e) => updateSmtp('senderAddress', e.target.value)}
                  placeholder="noreply@example.com"
                />
              </div>
            </div>

            {/* SMTP 服务器 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="smtpHost">SMTP server host</Label>
                <Input
                  id="smtpHost"
                  type="text"
                  value={smtpSettings.host}
                  onChange={(e) => updateSmtp('host', e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpSettings.port}
                  onChange={(e) => updateSmtp('port', parseInt(e.target.value) || 587)}
                />
              </div>
            </div>

            {/* 认证 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpUsername">Username</Label>
                <Input
                  id="smtpUsername"
                  type="text"
                  value={smtpSettings.username}
                  onChange={(e) => updateSmtp('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPassword">Password</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  value={smtpSettings.password}
                  onChange={(e) => updateSmtp('password', e.target.value)}
                />
              </div>
            </div>

            {/* 更多选项 */}
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
            >
              {showMoreOptions ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              More options
            </button>

            {showMoreOptions && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tlsEncryption">TLS encryption</Label>
                    <Select
                      value={String(smtpSettings.tls)}
                      onValueChange={(value) => updateSmtp('tls', value === 'true')}
                    >
                      <SelectTrigger id="tlsEncryption">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tlsOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authMethod">AUTH method</Label>
                    <Select
                      value={smtpSettings.authMethod}
                      onValueChange={(value) => updateSmtp('authMethod', value)}
                    >
                      <SelectTrigger id="authMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {authMethods.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="localName">Local name (HELO/EHLO)</Label>
                  <Input
                    id="localName"
                    type="text"
                    value={smtpSettings.localName}
                    onChange={(e) => updateSmtp('localName', e.target.value)}
                    placeholder="localhost"
                  />
                </div>
              </div>
            )}
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

export default Mail
