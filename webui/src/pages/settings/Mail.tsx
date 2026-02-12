/**
 * Mail Settings 页面
 * 邮件服务设置
 */
import { useEffect, useState, useRef } from 'react'
import { useSettings } from '@/features/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, ChevronDown, ChevronUp, Info, Send } from 'lucide-react'
import { EmailTestPopup, type EmailTestPopupRef } from '@/components/settings/EmailTestPopup'

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

  const [showMoreOptions, setShowMoreOptions] = useState(true)
  const testPopupRef = useRef<EmailTestPopupRef>(null)

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings()
  }

  // 安全获取 smtp 和 meta 设置
  const smtp = settings.smtp || {
    enabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    tls: false,
    authMethod: 'PLAIN',
    localName: '',
  }
  const meta = settings.meta || {
    appName: '',
    appURL: '',
    hideControls: false,
    senderName: 'Support',
    senderAddress: 'support@example.com',
  }

  const updateSmtp = (field: string, value: any) => {
    const currentValue = smtp[field as keyof typeof smtp]
    // Strict equality check - also handle type coercion for numbers
    if (currentValue === value) {
      return
    }
    // For number fields, compare as numbers
    if (typeof currentValue === 'number' && typeof value === 'number' && currentValue === value) {
      return
    }
    // For string fields, compare trimmed values for empty strings
    if (typeof currentValue === 'string' && typeof value === 'string' && currentValue === value) {
      return
    }
    updateSettings({
      smtp: { ...smtp, [field]: value }
    })
  }

  const updateMeta = (field: string, value: any) => {
    const currentValue = meta[field as keyof typeof meta]
    // Strict equality check
    if (currentValue === value) {
      return
    }
    updateSettings({
      meta: { ...meta, [field]: value }
    })
  }

  const handleSendTestEmail = () => {
    testPopupRef.current?.show()
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
          <span className="text-foreground">Mail settings</span>
        </nav>
        <p className="text-muted-foreground">
          Configure common settings for sending emails.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 发件人信息 - 始终显示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="senderName">
              Sender name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="senderName"
              type="text"
              value={meta.senderName || ''}
              onChange={(e) => updateMeta('senderName', e.target.value)}
              placeholder="Support"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senderAddress">
              Sender address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="senderAddress"
              type="email"
              value={meta.senderAddress || ''}
              onChange={(e) => updateMeta('senderAddress', e.target.value)}
              placeholder="support@example.com"
            />
          </div>
        </div>

        {/* 启用 SMTP */}
        <div className="flex items-center gap-2">
          <Switch
            id="smtpEnabled"
            checked={smtp.enabled}
            onCheckedChange={(checked) => updateSmtp('enabled', checked)}
          />
          <Label htmlFor="smtpEnabled" className="cursor-pointer flex items-center gap-1">
            Use SMTP mail server <span className="font-semibold">(recommended)</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    By default PocketBase uses the unix "sendmail" command for sending emails. For better emails deliverability it is recommended to use a SMTP mail server.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>

        {smtp.enabled && (
          <div className="space-y-4">
            {/* SMTP 服务器配置 - 4列布局 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">
                  SMTP server host <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="smtpHost"
                  type="text"
                  value={smtp.host}
                  onChange={(e) => updateSmtp('host', e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">
                  Port <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtp.port}
                  onChange={(e) => updateSmtp('port', parseInt(e.target.value) || 587)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUsername">Username</Label>
                <Input
                  id="smtpUsername"
                  type="text"
                  value={smtp.username}
                  onChange={(e) => updateSmtp('username', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPassword">Password</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  value={smtp.password}
                  onChange={(e) => updateSmtp('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* 更多选项 */}
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
            >
              {showMoreOptions ? 'Hide more options' : 'Show more options'}
              {showMoreOptions ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showMoreOptions && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tlsEncryption">TLS encryption</Label>
                    <Select
                      value={String(smtp.tls)}
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
                      value={smtp.authMethod}
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
                  <div className="space-y-2">
                    <Label htmlFor="localName" className="flex items-center gap-1">
                      EHLO/HELO domain
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>The domain name used in EHLO/HELO SMTP command.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="localName"
                      type="text"
                      value={smtp.localName}
                      onChange={(e) => updateSmtp('localName', e.target.value)}
                      placeholder="Default to localhost"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4">
          {hasChanges ? (
            <>
              <Button type="button" variant="ghost" onClick={resetSettings} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={!hasChanges || isSaving} className="min-w-[140px]">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <span className="w-4 h-4 mr-2" />
                )}
                Save changes
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTestEmail}
            >
              <Send className="w-4 h-4 mr-2" />
              Send test email
            </Button>
          )}
        </div>
      </form>

      {/* Email Test Popup */}
      <EmailTestPopup ref={testPopupRef} />
    </div>
  )
}

export default Mail
