/**
 * OTPAccordion - OTP 认证配置组件
 * Task 4: 添加错误图标支持
 * Task 12: 添加 Superusers MFA 联动提示
 * Task 15: 禁用时清除 emailTemplate 错误
 * Task 18: 默认 length 改为 8（与 UI 版本一致）
 */
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, KeySquare, Info } from 'lucide-react'
import { removeFormErrorAtom } from '@/store/formErrors'

interface OTPConfig {
  enabled: boolean
  duration: number
  length: number
  emailTemplate?: Record<string, any>
}

interface OTPAccordionProps {
  otp: OTPConfig
  onChange: (config: OTPConfig) => void
  hasErrors?: boolean
  /** Task 12: 是否是 _superusers 集合 */
  isSuperusers?: boolean
  /** Task 12: MFA 启用状态回调（用于 Superusers 联动）*/
  onMfaEnabledChange?: (enabled: boolean) => void
}

export function OTPAccordion({ 
  otp, 
  onChange, 
  hasErrors = false,
  isSuperusers = false,
  onMfaEnabledChange,
}: OTPAccordionProps) {
  const { t } = useTranslation()
  const removeFormError = useSetAtom(removeFormErrorAtom)
  
  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...otp,
      enabled: checked,
    })
    
    // Task 15: 禁用时清除 emailTemplate 错误
    if (!checked) {
      removeFormError('otp.emailTemplate')
    }
    
    // Task 12: Superusers 启用 OTP 时自动启用 MFA
    if (isSuperusers && onMfaEnabledChange) {
      onMfaEnabledChange(checked)
    }
  }

  const handleDurationChange = (value: string) => {
    onChange({
      ...otp,
      duration: parseInt(value) || 300,
    })
  }

  const handleLengthChange = (value: string) => {
    onChange({
      ...otp,
      // Task 18: 默认值改为 8（与 UI 版本一致）
      length: parseInt(value) || 8,
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="otp" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <KeySquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">{t('collections.authOptions.otp', 'One-time password (OTP)')}</span>
            {/* Task 4: 错误图标 */}
            {hasErrors && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            )}
            <div className="flex-1" />
            <Badge 
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${
                otp.enabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {otp.enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="otp-enabled"
              checked={otp.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="otp-enabled" className="text-[12px]">{t('common.enable', 'Enable')}</Label>
            {/* Task 12: Superusers MFA 联动提示 */}
            {isSuperusers && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('collections.authOptions.superusersOtpMfaHint', 'Superusers can have OTP only as part of Two-factor authentication.')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {otp.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="otp-duration" className="text-[11px] text-muted-foreground">{t('collections.authOptions.durationSeconds', 'Duration (seconds)')}</Label>
                <Input
                  id="otp-duration"
                  type="number"
                  min={60}
                  value={otp.duration}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className="h-7 text-[11px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="otp-length" className="text-[11px] text-muted-foreground">{t('collections.authOptions.codeLength', 'Code length')}</Label>
                <Input
                  id="otp-length"
                  type="number"
                  min={4}
                  max={10}
                  value={otp.length}
                  onChange={(e) => handleLengthChange(e.target.value)}
                  className="h-7 text-[11px]"
                />
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
