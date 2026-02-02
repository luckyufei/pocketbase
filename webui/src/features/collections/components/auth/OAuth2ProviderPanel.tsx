/**
 * OAuth2ProviderPanel 组件
 * OAuth2 提供商配置面板
 */
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  getProviderByName,
  getProviderDisplayName,
  validateProviderConfig,
  type ProviderConfig,
} from '@/lib/providers'

interface OAuth2ProviderPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerName: string
  config: ProviderConfig
  redirectUri: string
  onSave: (config: ProviderConfig) => void
  onDelete: () => void
  onBack: () => void
}

export function OAuth2ProviderPanel({
  open,
  onOpenChange,
  providerName,
  config,
  redirectUri,
  onSave,
  onDelete,
  onBack,
}: OAuth2ProviderPanelProps) {
  const [formData, setFormData] = useState<ProviderConfig>({})
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const provider = getProviderByName(providerName)
  const isOIDC = providerName.startsWith('oidc')

  useEffect(() => {
    setFormData({
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      authUrl: config.authUrl || provider?.authUrl || '',
      tokenUrl: config.tokenUrl || provider?.tokenUrl || '',
      userApiUrl: config.userApiUrl || provider?.userApiUrl || '',
      displayName: config.displayName || provider?.displayName || '',
      enabled: config.enabled !== false,
    })
    setErrors([])
  }, [config, provider, providerName])

  const handleChange = useCallback((field: keyof ProviderConfig, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors([])
  }, [])

  const handleCopyRedirectUri = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [redirectUri])

  const handleSave = useCallback(() => {
    const validationErrors = validateProviderConfig(providerName, formData)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    onSave(formData)
  }, [formData, providerName, onSave])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle>{getProviderDisplayName(providerName)}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-150px)] mt-4">
          <div className="space-y-6 pr-4">
            {/* 启用开关 */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-base">启用</Label>
                <p className="text-sm text-muted-foreground">启用此 OAuth2 提供商</p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => handleChange('enabled', checked)}
              />
            </div>

            {/* 重定向 URI */}
            <div className="space-y-2">
              <Label>重定向 URI</Label>
              <div className="flex gap-2">
                <Input value={redirectUri} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyRedirectUri}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                在 OAuth2 提供商的应用设置中添加此 URI
              </p>
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="clientId">
                Client ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientId"
                value={formData.clientId || ''}
                onChange={(e) => handleChange('clientId', e.target.value)}
                placeholder="输入 Client ID"
              />
            </div>

            {/* Client Secret */}
            {providerName !== 'apple' && (
              <div className="space-y-2">
                <Label htmlFor="clientSecret">
                  Client Secret <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="clientSecret"
                    type={showSecret ? 'text' : 'password'}
                    value={formData.clientSecret || ''}
                    onChange={(e) => handleChange('clientSecret', e.target.value)}
                    placeholder="输入 Client Secret"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* OIDC 特有字段 */}
            {isOIDC && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="authUrl">
                    Auth URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="authUrl"
                    value={formData.authUrl || ''}
                    onChange={(e) => handleChange('authUrl', e.target.value)}
                    placeholder="https://example.com/oauth2/authorize"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tokenUrl">
                    Token URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tokenUrl"
                    value={formData.tokenUrl || ''}
                    onChange={(e) => handleChange('tokenUrl', e.target.value)}
                    placeholder="https://example.com/oauth2/token"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userApiUrl">User API URL</Label>
                  <Input
                    id="userApiUrl"
                    value={formData.userApiUrl || ''}
                    onChange={(e) => handleChange('userApiUrl', e.target.value)}
                    placeholder="https://example.com/oauth2/userinfo"
                  />
                </div>
              </>
            )}

            {/* 显示名称 */}
            <div className="space-y-2">
              <Label htmlFor="displayName">显示名称</Label>
              <Input
                id="displayName"
                value={formData.displayName || ''}
                onChange={(e) => handleChange('displayName', e.target.value)}
                placeholder={getProviderDisplayName(providerName)}
              />
              <p className="text-xs text-muted-foreground">自定义显示在登录按钮上的名称</p>
            </div>

            {/* 错误信息 */}
            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>

              {config.clientId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除 {getProviderDisplayName(providerName)} 的配置吗？此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>删除</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
