import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface SelfHostedOptionsProps {
  providerKey: string
  config: {
    enabled?: boolean
    authURL?: string
    tokenURL?: string
    userInfoURL?: string
    [key: string]: unknown
  }
  onChange: (config: Record<string, unknown>) => void
  required?: boolean
  title?: string
}

export function SelfHostedOptions({
  providerKey,
  config,
  onChange,
  required = false,
  title = 'Provider endpoints',
}: SelfHostedOptionsProps) {
  const { t } = useTranslation()
  const isRequired = required && config?.enabled

  const updateField = (field: string, value: string) => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="space-y-4">
      <h6 className="font-medium text-sm">{title}</h6>

      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-authURL`}>
          Auth URL {isRequired && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id={`${providerKey}-authURL`}
          type="url"
          value={config.authURL || ''}
          onChange={(e) => updateField('authURL', e.target.value)}
          required={isRequired}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-tokenURL`}>
          Token URL {isRequired && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id={`${providerKey}-tokenURL`}
          type="url"
          value={config.tokenURL || ''}
          onChange={(e) => updateField('tokenURL', e.target.value)}
          required={isRequired}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-userInfoURL`}>
          User info URL {isRequired && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id={`${providerKey}-userInfoURL`}
          type="url"
          value={config.userInfoURL || ''}
          onChange={(e) => updateField('userInfoURL', e.target.value)}
          required={isRequired}
        />
      </div>
    </div>
  )
}
