import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface MicrosoftOptionsProps {
  providerKey: string
  config: {
    authURL?: string
    tokenURL?: string
    [key: string]: unknown
  }
  onChange: (config: Record<string, unknown>) => void
}

export function MicrosoftOptions({ providerKey, config, onChange }: MicrosoftOptionsProps) {
  const { t } = useTranslation()

  const updateField = (field: string, value: string) => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="space-y-4">
      <h6 className="font-medium text-sm">Azure AD endpoints</h6>

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
        <p className="text-xs text-muted-foreground">
          Ex. https://login.microsoftonline.com/YOUR_DIRECTORY_TENANT_ID/oauth2/v2.0/authorize
        </p>
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
        <p className="text-xs text-muted-foreground">
          Ex. https://login.microsoftonline.com/YOUR_DIRECTORY_TENANT_ID/oauth2/v2.0/token
        </p>
      </div>
    </div>
  )
}
