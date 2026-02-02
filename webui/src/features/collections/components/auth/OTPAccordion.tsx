/**
 * OTPAccordion - OTP 认证配置组件
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
      <AccordionItem value="otp" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <KeySquare className="h-4 w-4" />
            <span>OTP (One-Time Password)</span>
            <div className="flex-1" />
            <Badge variant={otp.enabled ? 'default' : 'secondary'}>
              {otp.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="otp-enabled"
              checked={otp.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="otp-enabled">Enable</Label>
          </div>

          {otp.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="otp-duration">Duration (seconds)</Label>
                <Input
                  id="otp-duration"
                  type="number"
                  min={60}
                  value={otp.duration}
                  onChange={(e) => handleDurationChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp-length">Code length</Label>
                <Input
                  id="otp-length"
                  type="number"
                  min={4}
                  max={10}
                  value={otp.length}
                  onChange={(e) => handleLengthChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
