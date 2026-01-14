/**
 * PasswordAuthAccordion - 密码认证配置组件
 */
import { useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { KeyRound, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PasswordAuthConfig {
  enabled: boolean
  identityFields: string[]
}

interface PasswordAuthAccordionProps {
  passwordAuth: PasswordAuthConfig
  onChange: (config: PasswordAuthConfig) => void
  isSuperusers?: boolean
  availableIdentityFields?: string[]
}

export function PasswordAuthAccordion({
  passwordAuth,
  onChange,
  isSuperusers = false,
  availableIdentityFields = ['email'],
}: PasswordAuthAccordionProps) {
  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...passwordAuth,
      enabled: checked,
    })
  }

  const handleIdentityFieldToggle = (field: string, checked: boolean) => {
    const newFields = checked
      ? [...passwordAuth.identityFields, field]
      : passwordAuth.identityFields.filter((f) => f !== field)

    onChange({
      ...passwordAuth,
      identityFields: newFields,
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="password-auth" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <KeyRound className="h-4 w-4" />
            <span>Identity/Password</span>
            <div className="flex-1" />
            <Badge variant={passwordAuth.enabled ? 'default' : 'secondary'}>
              {passwordAuth.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="password-auth-enabled"
              checked={passwordAuth.enabled}
              onCheckedChange={handleEnabledChange}
              disabled={isSuperusers}
            />
            <Label htmlFor="password-auth-enabled">Enable</Label>
            {isSuperusers && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Superusers are required to have password auth enabled.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="space-y-2">
            <Label>Unique identity fields</Label>
            <div className="flex flex-wrap gap-2">
              {availableIdentityFields.map((field) => (
                <div key={field} className="flex items-center gap-1">
                  <Checkbox
                    id={`identity-${field}`}
                    checked={passwordAuth.identityFields.includes(field)}
                    onCheckedChange={(checked) =>
                      handleIdentityFieldToggle(field, checked as boolean)
                    }
                  />
                  <Label htmlFor={`identity-${field}`} className="text-sm">
                    {field}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
