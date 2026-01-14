import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

interface OIDCOptionsProps {
  providerKey: string
  config: {
    displayName?: string
    authURL?: string
    tokenURL?: string
    userInfoURL?: string
    pkce?: boolean
    extra?: {
      jwksURL?: string
      issuers?: string[]
    }
    [key: string]: unknown
  }
  onChange: (config: Record<string, unknown>) => void
}

export function OIDCOptions({ providerKey, config, onChange }: OIDCOptionsProps) {
  const { t } = useTranslation()
  const [hasUserInfoURL, setHasUserInfoURL] = useState(!!config.userInfoURL)

  // 初始化默认值
  useEffect(() => {
    const updates: Record<string, unknown> = {}
    if (config.pkce === undefined) {
      updates.pkce = true
    }
    if (!config.displayName) {
      updates.displayName = 'OIDC'
    }
    if (!config.extra) {
      updates.extra = {}
    }
    if (Object.keys(updates).length > 0) {
      onChange({ ...config, ...updates })
    }
  }, [])

  const updateField = (field: string, value: unknown) => {
    onChange({ ...config, [field]: value })
  }

  const updateExtra = (field: string, value: unknown) => {
    onChange({
      ...config,
      extra: { ...(config.extra || {}), [field]: value },
    })
  }

  const handleUserInfoModeChange = (useUserInfoURL: string) => {
    const hasUrl = useUserInfoURL === 'true'
    setHasUserInfoURL(hasUrl)
    if (!hasUrl) {
      onChange({
        ...config,
        userInfoURL: '',
        extra: config.extra || {},
      })
    } else {
      onChange({
        ...config,
        extra: {},
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-displayName`}>
          Display name <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`${providerKey}-displayName`}
          value={config.displayName || ''}
          onChange={(e) => updateField('displayName', e.target.value)}
          required
        />
      </div>

      <h6 className="font-medium text-sm pt-2">Endpoints</h6>

      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-authURL`}>
          Auth URL <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`${providerKey}-authURL`}
          type="url"
          value={config.authURL || ''}
          onChange={(e) => updateField('authURL', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-tokenURL`}>
          Token URL <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`${providerKey}-tokenURL`}
          type="url"
          value={config.tokenURL || ''}
          onChange={(e) => updateField('tokenURL', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-userInfoMode`}>Fetch user info from</Label>
        <Select value={String(hasUserInfoURL)} onValueChange={handleUserInfoModeChange}>
          <SelectTrigger id={`${providerKey}-userInfoMode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">User info URL</SelectItem>
            <SelectItem value="false">ID Token</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md p-4 space-y-4">
        {hasUserInfoURL ? (
          <div className="space-y-2">
            <Label htmlFor={`${providerKey}-userInfoURL`}>
              User info URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`${providerKey}-userInfoURL`}
              type="url"
              value={config.userInfoURL || ''}
              onChange={(e) => updateField('userInfoURL', e.target.value)}
              required
            />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground italic">
              Both fields are considered optional because the parsed <code>id_token</code>
              is a direct result of the trusted server code-&gt;token exchange response.
            </p>
            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-jwksURL`} className="flex items-center gap-1">
                JWKS verification URL
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>URL to the public token verification keys.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id={`${providerKey}-jwksURL`}
                type="url"
                value={config.extra?.jwksURL || ''}
                onChange={(e) => updateExtra('jwksURL', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-issuers`} className="flex items-center gap-1">
                Issuers
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Comma separated list of accepted values for the iss token claim validation.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id={`${providerKey}-issuers`}
                placeholder="issuer1, issuer2"
                value={(config.extra?.issuers || []).join(', ')}
                onChange={(e) =>
                  updateExtra(
                    'issuers',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id={`${providerKey}-pkce`}
          checked={config.pkce !== false}
          onCheckedChange={(checked) => updateField('pkce', checked)}
        />
        <Label htmlFor={`${providerKey}-pkce`} className="flex items-center gap-1">
          Support PKCE
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Usually it should be safe to be always enabled as most providers will just ignore
                the extra query parameters if they don't support PKCE.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
      </div>
    </div>
  )
}
