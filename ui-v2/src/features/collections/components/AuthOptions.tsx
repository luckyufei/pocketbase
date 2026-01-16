/**
 * AuthOptions - Auth Collection 选项编辑器
 * 用于编辑 Auth 类型 Collection 的认证选项
 */
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface AuthOptionsType {
  manageRule: string | null
  authRule: string | null
  authAlert: Record<string, unknown>
  oauth2: {
    enabled: boolean
    providers: unknown[]
  }
  passwordAuth: {
    enabled: boolean
    identityFields: string[]
  }
  mfa: {
    enabled: boolean
  }
  otp: {
    enabled: boolean
  }
  authToken: {
    duration: number
  }
  passwordResetToken: {
    duration: number
  }
  emailChangeToken: {
    duration: number
  }
  verificationToken: {
    duration: number
  }
  fileToken: {
    duration: number
  }
}

interface AuthOptionsProps {
  options: AuthOptionsType
  onChange: (options: AuthOptionsType) => void
}

export function AuthOptions({ options, onChange }: AuthOptionsProps) {
  const updateOption = <K extends keyof AuthOptionsType>(key: K, value: AuthOptionsType[K]) => {
    onChange({ ...options, [key]: value })
  }

  const updateNestedOption = <K extends keyof AuthOptionsType>(
    key: K,
    nestedKey: string,
    value: unknown
  ) => {
    const current = options[key] as Record<string, unknown>
    onChange({
      ...options,
      [key]: { ...current, [nestedKey]: value },
    })
  }

  return (
    <div className="space-y-4">
      <Accordion type="multiple" className="w-full">
        {/* 认证方式 */}
        <AccordionItem value="auth-methods">
          <AccordionTrigger>Authentication Methods</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {/* Password Auth */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="passwordAuth"
                  checked={options.passwordAuth.enabled}
                  onCheckedChange={(checked) =>
                    updateNestedOption('passwordAuth', 'enabled', checked === true)
                  }
                  aria-label="Password Auth"
                />
                <Label htmlFor="passwordAuth">Password Auth</Label>
              </div>

              {/* OAuth2 */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="oauth2"
                  checked={options.oauth2.enabled}
                  onCheckedChange={(checked) =>
                    updateNestedOption('oauth2', 'enabled', checked === true)
                  }
                  aria-label="OAuth2"
                />
                <Label htmlFor="oauth2">OAuth2</Label>
              </div>

              {/* MFA */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mfa"
                  checked={options.mfa.enabled}
                  onCheckedChange={(checked) =>
                    updateNestedOption('mfa', 'enabled', checked === true)
                  }
                  aria-label="MFA"
                />
                <Label htmlFor="mfa">MFA (Multi-Factor Authentication)</Label>
              </div>

              {/* OTP */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="otp"
                  checked={options.otp.enabled}
                  onCheckedChange={(checked) =>
                    updateNestedOption('otp', 'enabled', checked === true)
                  }
                  aria-label="OTP"
                />
                <Label htmlFor="otp">OTP (One-Time Password)</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Token 设置 */}
        <AccordionItem value="tokens">
          <AccordionTrigger>Token Settings</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authToken">Auth Token Duration (seconds)</Label>
                  <Input
                    id="authToken"
                    type="number"
                    value={options.authToken.duration}
                    onChange={(e) =>
                      updateNestedOption('authToken', 'duration', Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passwordResetToken">Password Reset Token Duration</Label>
                  <Input
                    id="passwordResetToken"
                    type="number"
                    value={options.passwordResetToken.duration}
                    onChange={(e) =>
                      updateNestedOption('passwordResetToken', 'duration', Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailChangeToken">Email Change Token Duration</Label>
                  <Input
                    id="emailChangeToken"
                    type="number"
                    value={options.emailChangeToken.duration}
                    onChange={(e) =>
                      updateNestedOption('emailChangeToken', 'duration', Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verificationToken">Verification Token Duration</Label>
                  <Input
                    id="verificationToken"
                    type="number"
                    value={options.verificationToken.duration}
                    onChange={(e) =>
                      updateNestedOption('verificationToken', 'duration', Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 访问规则 */}
        <AccordionItem value="rules">
          <AccordionTrigger>Access Rules</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="manageRule">Manage Rule</Label>
                <Textarea
                  id="manageRule"
                  value={options.manageRule ?? ''}
                  onChange={(e) => updateOption('manageRule', e.target.value || null)}
                  placeholder="e.g., @request.auth.id != ''"
                  className="font-mono text-sm"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authRule">Auth Rule</Label>
                <Textarea
                  id="authRule"
                  value={options.authRule ?? ''}
                  onChange={(e) => updateOption('authRule', e.target.value || null)}
                  placeholder="e.g., verified = true"
                  className="font-mono text-sm"
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
