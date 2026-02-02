/**
 * CollectionAuthOptionsTab - Auth Collection 认证选项配置
 * 用于配置 Auth 类型 Collection 的认证方式
 */
import { useMemo, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PasswordAuthAccordion } from './auth/PasswordAuthAccordion'
import { OAuth2Accordion } from './auth/OAuth2Accordion'
import { OTPAccordion } from './auth/OTPAccordion'
import { MFAAccordion } from './auth/MFAAccordion'
import { TokenOptionsAccordion } from './auth/TokenOptionsAccordion'

interface AuthCollection {
  id?: string
  name: string
  type: 'auth'
  system?: boolean
  fields: Array<{
    name: string
    type: string
    required?: boolean
  }>
  indexes: string[]
  passwordAuth: {
    enabled: boolean
    identityFields: string[]
  }
  oauth2: {
    enabled: boolean
    providers: Array<{
      name: string
      clientId: string
      clientSecret: string
    }>
  }
  otp: {
    enabled: boolean
    duration: number
    length: number
    emailTemplate?: Record<string, any>
  }
  mfa: {
    enabled: boolean
    rule: string
  }
  authAlert: {
    enabled: boolean
    emailTemplate?: Record<string, any>
  }
  authToken: {
    duration: number
  }
  verificationToken: {
    duration: number
  }
  passwordResetToken: {
    duration: number
  }
  emailChangeToken: {
    duration: number
  }
  verificationTemplate?: Record<string, any>
  resetPasswordTemplate?: Record<string, any>
  confirmEmailChangeTemplate?: Record<string, any>
}

interface CollectionAuthOptionsTabProps {
  collection: AuthCollection
  onChange: (updates: Partial<AuthCollection>) => void
}

export function CollectionAuthOptionsTab({ collection, onChange }: CollectionAuthOptionsTabProps) {
  const isSuperusers = collection.system && collection.name === '_superusers'

  // 获取可用的身份字段
  const availableIdentityFields = useMemo(() => {
    const fields = ['email'] // email 始终可用

    // 从索引中提取唯一字段
    for (const idx of collection.indexes || []) {
      // 简单解析索引，查找唯一索引
      if (idx.toLowerCase().includes('unique')) {
        const match = idx.match(/\(([^)]+)\)/)
        if (match) {
          const columns = match[1].split(',').map((c) => c.trim().replace(/["`]/g, ''))
          for (const col of columns) {
            if (col !== 'email' && !fields.includes(col)) {
              const field = collection.fields.find(
                (f) => f.name.toLowerCase() === col.toLowerCase()
              )
              if (field) {
                fields.push(field.name)
              }
            }
          }
        }
      }
    }

    return fields
  }, [collection.fields, collection.indexes])

  // 处理密码认证变更
  const handlePasswordAuthChange = useCallback(
    (config: typeof collection.passwordAuth) => {
      onChange({ passwordAuth: config })
    },
    [onChange]
  )

  // 处理 OAuth2 变更
  const handleOAuth2Change = useCallback(
    (config: typeof collection.oauth2) => {
      onChange({ oauth2: config })
    },
    [onChange]
  )

  // 处理 OTP 变更
  const handleOTPChange = useCallback(
    (config: typeof collection.otp) => {
      onChange({ otp: config })
    },
    [onChange]
  )

  // 处理 MFA 变更
  const handleMFAChange = useCallback(
    (config: typeof collection.mfa) => {
      onChange({ mfa: config })
    },
    [onChange]
  )

  // 处理 Token 选项变更
  const handleTokenChange = useCallback(
    (updates: {
      authToken?: { duration: number }
      verificationToken?: { duration: number }
      passwordResetToken?: { duration: number }
      emailChangeToken?: { duration: number }
    }) => {
      onChange(updates)
    },
    [onChange]
  )

  // 处理登录提醒变更
  const handleAuthAlertChange = useCallback(
    (enabled: boolean) => {
      onChange({
        authAlert: {
          ...collection.authAlert,
          enabled,
        },
      })
    },
    [collection.authAlert, onChange]
  )

  return (
    <div className="space-y-6">
      {/* Auth Methods Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Auth methods
          </h4>
          <div className="flex items-center gap-2">
            <Checkbox
              id="auth-alert-enabled"
              checked={collection.authAlert?.enabled || false}
              onCheckedChange={handleAuthAlertChange}
            />
            <Label htmlFor="auth-alert-enabled" className="text-sm">
              Send email alert for new logins
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <PasswordAuthAccordion
            passwordAuth={collection.passwordAuth}
            onChange={handlePasswordAuthChange}
            isSuperusers={isSuperusers}
            availableIdentityFields={availableIdentityFields}
          />

          {!isSuperusers && (
            <OAuth2Accordion oauth2={collection.oauth2} onChange={handleOAuth2Change} />
          )}

          <OTPAccordion otp={collection.otp} onChange={handleOTPChange} />

          <MFAAccordion mfa={collection.mfa} onChange={handleMFAChange} />
        </div>
      </div>

      {/* Mail Templates Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mail templates
          </h4>
          <Button variant="secondary" size="sm">
            Send test email
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Email template configuration is available in the full settings.
          </p>
        </div>
      </div>

      {/* Other Section */}
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Other
        </h4>

        <TokenOptionsAccordion
          authToken={collection.authToken}
          verificationToken={collection.verificationToken}
          passwordResetToken={collection.passwordResetToken}
          emailChangeToken={collection.emailChangeToken}
          onChange={handleTokenChange}
        />
      </div>
    </div>
  )
}
