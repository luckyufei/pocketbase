/**
 * OTPAccordion - OTP 认证配置组件
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
import { KeySquare } from 'lucide-react'

interface OTPConfig {
  enabled: boolean
  duration: number
  length: number
  emailTemplate?: Record<string, any>
}

interface OTPAccordionProps {
  otp: OTPConfig
  onChange: (config: OTPConfig) => void
}

export function OTPAccordion({ otp, onChange }: OTPAccordionProps) {
  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...otp,
      enabled: checked,
    })
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
      length: parseInt(value) || 6,
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="otp" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <KeySquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">One-time password (OTP)</span>
            <div className="flex-1" />
            <Badge 
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${
                otp.enabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {otp.enabled ? 'Enabled' : 'Disabled'}
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
            <Label htmlFor="otp-enabled" className="text-[12px]">Enable</Label>
          </div>

          {otp.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="otp-duration" className="text-[11px] text-muted-foreground">Duration (seconds)</Label>
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
                <Label htmlFor="otp-length" className="text-[11px] text-muted-foreground">Code length</Label>
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
