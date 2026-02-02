/**
 * MFAAccordion - 多因素认证配置组件
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
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
      <AccordionItem value="mfa" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Multi-factor authentication (MFA)</span>
            <div className="flex-1" />
            <Badge variant={mfa.enabled ? 'default' : 'secondary'}>
              {mfa.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium">
              This feature is experimental and may change in the future.
            </p>
            <p className="text-muted-foreground mt-1">
              Multi-factor authentication (MFA) requires the user to authenticate with any 2
              different auth methods (otp, identity/password, oauth2) before issuing an auth token.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="mfa-enabled"
              checked={mfa.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="mfa-enabled">Enable</Label>
          </div>

          {mfa.enabled && (
            <div className="space-y-2">
              <Label htmlFor="mfa-rule">MFA rule</Label>
              <Input
                id="mfa-rule"
                value={mfa.rule}
                onChange={(e) => handleRuleChange(e.target.value)}
                placeholder="Leave empty to require MFA for everyone"
              />
              <p className="text-xs text-muted-foreground">
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
