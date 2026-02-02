import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Key } from 'lucide-react'
import { AppleSecretPopup } from './AppleSecretPopup'

interface AppleOptionsProps {
  providerKey: string
  config: {
    clientId?: string
    clientSecret?: string
    [key: string]: unknown
  }
  onChange: (config: Record<string, unknown>) => void
}

export function AppleOptions({ providerKey, config, onChange }: AppleOptionsProps) {
  const { t } = useTranslation()
  const [showPopup, setShowPopup] = useState(false)

  const handleSecretGenerated = (secret: string) => {
    onChange({ ...config, clientSecret: secret })
    setShowPopup(false)
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setShowPopup(true)}>
        <Key className="w-4 h-4 mr-2" />
        Generate secret
      </Button>

      <AppleSecretPopup
        open={showPopup}
        onOpenChange={setShowPopup}
        clientId={config.clientId || ''}
        onSubmit={handleSecretGenerated}
      />
    </>
  )
}
