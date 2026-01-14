import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

interface LarkOptionsProps {
  config: {
    authURL?: string
    tokenURL?: string
    userInfoURL?: string
    [key: string]: unknown
  }
  onChange: (config: Record<string, unknown>) => void
}

const DOMAIN_FEISHU = 'feishu.cn'
const DOMAIN_LARKSUITE = 'larksuite.com'

const domainOptions = [
  { label: 'Feishu (China)', value: DOMAIN_FEISHU },
  { label: 'Lark (International)', value: DOMAIN_LARKSUITE },
]

export function LarkOptions({ config, onChange }: LarkOptionsProps) {
  const { t } = useTranslation()

  // 根据现有 authURL 判断当前域名
  const getInitialDomain = () => {
    if (config.authURL?.includes(DOMAIN_LARKSUITE)) {
      return DOMAIN_LARKSUITE
    }
    return DOMAIN_FEISHU
  }

  const [domain, setDomain] = useState(getInitialDomain)

  useEffect(() => {
    // 当域名变化时更新 URL
    onChange({
      ...config,
      authURL: `https://accounts.${domain}/open-apis/authen/v1/authorize`,
      tokenURL: `https://open.${domain}/open-apis/authen/v2/oauth/token`,
      userInfoURL: `https://open.${domain}/open-apis/authen/v1/user_info`,
    })
  }, [domain])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lark-site">Site</Label>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger id="lark-site">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {domainOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Note that the Lark user's <strong>Union ID</strong> will be used for the association with
          the PocketBase user (see{' '}
          <a
            href="https://open.feishu.cn/document/platform-overveiw/basic-concepts/user-identity-introduction/introduction#3f2d4b63"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Different Types of Lark IDs
          </a>
          ).
        </AlertDescription>
      </Alert>
    </div>
  )
}
