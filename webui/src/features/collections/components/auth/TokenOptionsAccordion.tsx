/**
 * TokenOptionsAccordion - Token 选项配置组件
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Clock } from 'lucide-react'

interface TokenConfig {
  duration: number
}

interface TokenOptionsAccordionProps {
  authToken: TokenConfig
  verificationToken: TokenConfig
  passwordResetToken: TokenConfig
  emailChangeToken: TokenConfig
  onChange: (updates: {
    authToken?: TokenConfig
    verificationToken?: TokenConfig
    passwordResetToken?: TokenConfig
    emailChangeToken?: TokenConfig
  }) => void
}

// 将秒转换为可读格式
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`
  return `${Math.floor(seconds / 86400)} days`
}

export function TokenOptionsAccordion({
  authToken,
  verificationToken,
  passwordResetToken,
  emailChangeToken,
  onChange,
}: TokenOptionsAccordionProps) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="token-options" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Clock className="h-4 w-4" />
            <span>Token options</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="auth-token-duration">Auth token duration (seconds)</Label>
              <Input
                id="auth-token-duration"
                type="number"
                min={60}
                value={authToken.duration}
                onChange={(e) =>
                  onChange({
                    authToken: { duration: parseInt(e.target.value) || 1209600 },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">{formatDuration(authToken.duration)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-token-duration">
                Verification token duration (seconds)
              </Label>
              <Input
                id="verification-token-duration"
                type="number"
                min={60}
                value={verificationToken.duration}
                onChange={(e) =>
                  onChange({
                    verificationToken: { duration: parseInt(e.target.value) || 604800 },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {formatDuration(verificationToken.duration)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-reset-token-duration">
                Password reset token duration (seconds)
              </Label>
              <Input
                id="password-reset-token-duration"
                type="number"
                min={60}
                value={passwordResetToken.duration}
                onChange={(e) =>
                  onChange({
                    passwordResetToken: { duration: parseInt(e.target.value) || 1800 },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {formatDuration(passwordResetToken.duration)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-change-token-duration">
                Email change token duration (seconds)
              </Label>
              <Input
                id="email-change-token-duration"
                type="number"
                min={60}
                value={emailChangeToken.duration}
                onChange={(e) =>
                  onChange({
                    emailChangeToken: { duration: parseInt(e.target.value) || 1800 },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {formatDuration(emailChangeToken.duration)}
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
