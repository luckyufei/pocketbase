/**
 * MFAAccordion - 多因素认证配置组件
 * Task 3: 使用 RuleField 替代普通 Input，支持自动补全
 */
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react'
import { RuleField } from '../RuleField'

interface MFAConfig {
  enabled: boolean
  rule: string
}

interface MFAAccordionProps {
  mfa: MFAConfig
  onChange: (config: MFAConfig) => void
  collection: {
    name: string
    type: string
    system?: boolean
    fields?: Array<{ name: string; type: string; hidden?: boolean }>
  }
  hasErrors?: boolean
}

export function MFAAccordion({ mfa, onChange, collection, hasErrors = false }: MFAAccordionProps) {
  const { t } = useTranslation()
  
  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...mfa,
      enabled: checked,
    })
  }

  const handleRuleChange = (value: string | null) => {
    onChange({
      ...mfa,
      rule: value || '',
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="mfa" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">{t('collections.authOptions.mfa', 'Multi-factor authentication (MFA)')}</span>
            {/* Task 4: 错误图标 */}
            {hasErrors && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            )}
            <div className="flex-1" />
            <Badge 
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${
                mfa.enabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {mfa.enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 space-y-3">
          <div className="p-2 bg-muted/50 rounded text-[11px]">
            <p className="font-medium text-muted-foreground">
              {t('collections.authOptions.mfaExperimental', 'This feature is experimental and may change in the future.')}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {t('collections.authOptions.mfaDescription', 'Multi-factor authentication (MFA) requires the user to authenticate with any 2 different auth methods (otp, identity/password, oauth2) before issuing an auth token.')}
            </p>
            {/* Task 16: Learn more 链接 */}
            <a 
              href="https://pocketbase.io/docs/authentication/#mfa" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-1"
            >
              {t('common.learnMore', 'Learn more')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="mfa-enabled"
              checked={mfa.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="mfa-enabled" className="text-[12px]">{t('common.enable', 'Enable')}</Label>
          </div>

          {mfa.enabled && (
            <div className="space-y-1">
              {/* Task 3: 使用 RuleField 替代 Input，支持自动补全 */}
              <RuleField
                label={t('collections.authOptions.mfaRule', 'MFA rule')}
                formKey="mfa.rule"
                rule={mfa.rule}
                onChange={handleRuleChange}
                collection={collection}
                placeholder={t('collections.authOptions.mfaRulePlaceholder', 'Leave empty to require MFA for everyone')}
                superuserToggle={false}
                helpText={
                  <span>
                    {t('collections.authOptions.mfaRuleDescription', "This optional rule could be used to enable/disable MFA per account basis. For example, to require MFA only for accounts with non-empty email you can set it to")}
                    {' '}<code className="bg-muted px-1 rounded">email != ''</code>.
                  </span>
                }
              />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
