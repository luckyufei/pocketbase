/**
 * PasswordAuthAccordion - 密码认证配置组件
 * 参考 UI 版本 PasswordAuthAccordion.svelte 实现
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
import { MultiSelect } from '@/components/ui/multi-select'
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
  // 确保 identityFields 始终是数组
  const currentIdentityFields = passwordAuth?.identityFields || ['email']
  
  // 确保 availableIdentityFields 至少包含 email
  const safeAvailableFields = availableIdentityFields.length > 0 ? availableIdentityFields : ['email']

  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...passwordAuth,
      enabled: checked,
    })
  }

  const handleIdentityFieldsChange = (fields: string[]) => {
    onChange({
      ...passwordAuth,
      identityFields: fields,
    })
  }

  // 构建选项列表
  const identityFieldOptions = safeAvailableFields.map((field) => ({
    value: field,
    label: field,
  }))

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="password-auth" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">Identity/Password</span>
            <div className="flex-1" />
            <Badge 
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${
                passwordAuth.enabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {passwordAuth.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 space-y-3">
          {/* Enable 开关 - 使用 Switch 代替 Checkbox，与 UI 版本一致 */}
          <div className="flex items-center gap-2">
            <Switch
              id="password-auth-enabled"
              checked={passwordAuth.enabled}
              onCheckedChange={handleEnabledChange}
              disabled={isSuperusers}
            />
            <Label htmlFor="password-auth-enabled" className="text-[12px]">Enable</Label>
            {isSuperusers && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Superusers are required to have password auth enabled.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Unique identity fields - 使用 MultiSelect 代替 Checkbox 列表，与 UI 版本一致 */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Unique identity fields</Label>
            <MultiSelect
              options={identityFieldOptions}
              selected={currentIdentityFields}
              onChange={handleIdentityFieldsChange}
              placeholder="- Select -"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
