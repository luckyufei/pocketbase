/**
 * OAuth2ProviderPanel 组件
 * OAuth2 provider configuration panel
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
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {provider?.logo && (
              <img
                src={`/images/oauth2/${provider.logo}`}
                alt={provider.displayName}
                className="w-6 h-6 object-contain"
              />
            )}
            <SheetTitle>{getProviderDisplayName(providerName)}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-150px)] mt-4">
          <div className="space-y-6 pr-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-base">Enable</Label>
                <p className="text-sm text-muted-foreground">Enable this OAuth2 provider</p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => handleChange('enabled', checked)}
              />
            </div>

            {/* Redirect URI */}
            <div className="space-y-2">
              <Label>Redirect URI</Label>
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
                Add this URI to your OAuth2 provider's app settings
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
                placeholder="Enter Client ID"
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
                    placeholder="Enter Client Secret"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* OIDC specific fields */}
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

            {/* Display name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={formData.displayName || ''}
                onChange={(e) => handleChange('displayName', e.target.value)}
                placeholder={getProviderDisplayName(providerName)}
              />
              <p className="text-xs text-muted-foreground">Custom name to display on the login button</p>
            </div>

            {/* Error messages */}
            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save
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
                      <AlertDialogTitle>Confirm delete</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the {getProviderDisplayName(providerName)} configuration? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
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
