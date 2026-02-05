/**
 * MFAAccordion - 多因素认证配置组件
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ShieldCheck, ExternalLink } from 'lucide-react'

interface MFAConfig {
  enabled: boolean
  rule: string
}

interface MFAAccordionProps {
  mfa: MFAConfig
  onChange: (config: MFAConfig) => void
}

export function MFAAccordion({ mfa, onChange }: MFAAccordionProps) {
  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...mfa,
      enabled: checked,
    })
  }

  const handleRuleChange = (value: string) => {
    onChange({
      ...mfa,
      rule: value,
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="mfa" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">Multi-factor authentication (MFA)</span>
            <div className="flex-1" />
            <Badge 
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${
                mfa.enabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {mfa.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 space-y-3">
          <div className="p-2 bg-muted/50 rounded text-[11px]">
            <p className="font-medium text-muted-foreground">
              This feature is experimental and may change in the future.
            </p>
            <p className="text-muted-foreground mt-0.5">
              Multi-factor authentication (MFA) requires the user to authenticate with any 2
              different auth methods (otp, identity/password, oauth2) before issuing an auth token.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="mfa-enabled"
              checked={mfa.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="mfa-enabled" className="text-[12px]">Enable</Label>
          </div>

          {mfa.enabled && (
            <div className="space-y-1">
              <Label htmlFor="mfa-rule" className="text-[11px] text-muted-foreground">MFA rule</Label>
              <Input
                id="mfa-rule"
                value={mfa.rule}
                onChange={(e) => handleRuleChange(e.target.value)}
                placeholder="Leave empty to require MFA for everyone"
                className="h-7 text-[11px]"
              />
              <p className="text-[10px] text-muted-foreground">
                This optional rule could be used to enable/disable MFA per account basis. For
                example, to require MFA only for accounts with non-empty email you can set it to{' '}
                <code className="bg-muted px-1 rounded">email != ''</code>.
              </p>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
