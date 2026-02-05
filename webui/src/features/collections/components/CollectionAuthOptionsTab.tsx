/**
 * CollectionAuthOptionsTab - Auth Collection 认证选项配置
 * 用于配置 Auth 类型 Collection 的认证方式
 */
import { useMemo, useCallback, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { PasswordAuthAccordion } from './auth/PasswordAuthAccordion'
import { OAuth2Accordion } from './auth/OAuth2Accordion'
import { OTPAccordion } from './auth/OTPAccordion'
import { MFAAccordion } from './auth/MFAAccordion'
import { TokenOptionsAccordion } from './auth/TokenOptionsAccordion'
import { MailTemplatesSection } from './auth/MailTemplatesSection'
import { OAuth2ProvidersListPanel } from './auth/OAuth2ProvidersListPanel'
import { OAuth2ProviderPanel } from './auth/OAuth2ProviderPanel'
import type { ProviderConfig } from '@/lib/providers'

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
    secret?: string
  }
  verificationToken: {
    duration: number
    secret?: string
  }
  passwordResetToken: {
    duration: number
    secret?: string
  }
  emailChangeToken: {
    duration: number
    secret?: string
  }
  fileToken: {
    duration: number
    secret?: string
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

  // OAuth2 面板状态
  const [showProvidersListPanel, setShowProvidersListPanel] = useState(false)
  const [showProviderPanel, setShowProviderPanel] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')

  // 获取可用的身份字段
  // 参考 UI 版本 PasswordAuthAccordion.svelte 的 refreshIdentityFieldsOptions 函数
  const availableIdentityFields = useMemo(() => {
    const fields = ['email'] // email 始终可用

    // 从索引中提取唯一字段
    // 关键：只有【单列唯一索引】才能作为 identity field
    for (const idx of collection.indexes || []) {
      // 简单解析索引，查找唯一索引
      if (idx.toLowerCase().includes('unique')) {
        const match = idx.match(/\(([^)]+)\)/)
        if (match) {
          const columns = match[1].split(',').map((c) => c.trim().replace(/["`]/g, ''))
          
          // 关键检查：只有单列唯一索引才能作为 identity field（与 UI 版本一致）
          if (columns.length !== 1) {
            continue
          }
          
          const col = columns[0]
          if (col !== 'email' && !fields.includes(col)) {
            const field = collection.fields.find(
              (f) => f.name.toLowerCase() === col.toLowerCase()
            )
            // 检查字段存在且不是隐藏字段（与 UI 版本一致）
            if (field && !('hidden' in field && field.hidden)) {
              fields.push(field.name)
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
      authToken?: { duration: number; secret?: string }
      verificationToken?: { duration: number; secret?: string }
      passwordResetToken?: { duration: number; secret?: string }
      emailChangeToken?: { duration: number; secret?: string }
      fileToken?: { duration: number; secret?: string }
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

  // OAuth2 提供商相关处理
  const handleAddProvider = useCallback(() => {
    setShowProvidersListPanel(true)
  }, [])

  const handleSelectProvider = useCallback((providerName: string) => {
    setSelectedProvider(providerName)
    setShowProvidersListPanel(false)
    setShowProviderPanel(true)
  }, [])

  const handleEditProvider = useCallback((providerName: string) => {
    setSelectedProvider(providerName)
    setShowProviderPanel(true)
  }, [])

  const handleBackFromProvider = useCallback(() => {
    setShowProviderPanel(false)
    setShowProvidersListPanel(true)
  }, [])

  const handleSaveProvider = useCallback(
    (config: ProviderConfig) => {
      const providers = [...(collection.oauth2?.providers || [])]
      const existingIndex = providers.findIndex((p) => p.name === selectedProvider)

      const newProvider = {
        name: selectedProvider,
        clientId: config.clientId || '',
        clientSecret: config.clientSecret || '',
        authURL: config.authUrl,
        tokenURL: config.tokenUrl,
      }

      if (existingIndex >= 0) {
        providers[existingIndex] = newProvider
      } else {
        providers.push(newProvider)
      }

      onChange({
        oauth2: {
          ...collection.oauth2,
          providers,
        },
      })
      setShowProviderPanel(false)
    },
    [collection.oauth2, selectedProvider, onChange]
  )

  const handleDeleteProvider = useCallback(() => {
    const providers = (collection.oauth2?.providers || []).filter(
      (p) => p.name !== selectedProvider
    )
    onChange({
      oauth2: {
        ...collection.oauth2,
        providers,
      },
    })
    setShowProviderPanel(false)
  }, [collection.oauth2, selectedProvider, onChange])

  // 获取 OAuth2 提供商配置的映射
  const oauth2ProvidersConfig = useMemo(() => {
    const config: Record<string, ProviderConfig> = {}
    for (const provider of collection.oauth2?.providers || []) {
      config[provider.name] = {
        clientId: provider.clientId,
        clientSecret: provider.clientSecret,
        authUrl: provider.authURL,
        tokenUrl: provider.tokenURL,
        enabled: true,
      }
    }
    return config
  }, [collection.oauth2?.providers])

  // 获取当前选中提供商的配置
  const selectedProviderConfig = useMemo(() => {
    const provider = collection.oauth2?.providers?.find((p) => p.name === selectedProvider)
    return provider
      ? {
          clientId: provider.clientId,
          clientSecret: provider.clientSecret,
          authUrl: provider.authURL,
          tokenUrl: provider.tokenURL,
          enabled: true,
        }
      : {}
  }, [collection.oauth2?.providers, selectedProvider])

  // 获取 redirect URI
  const redirectUri = useMemo(() => {
    // 这里应该根据实际的 API 端点生成
    return `${window.location.origin}/api/oauth2-redirect`
  }, [])

  return (
    <div className="space-y-5">
      {/* Auth Methods Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Auth methods
          </h4>
          <div className="flex items-center gap-1.5">
            <Switch
              id="auth-alert-enabled"
              checked={collection.authAlert?.enabled || false}
              onCheckedChange={handleAuthAlertChange}
            />
            <Label htmlFor="auth-alert-enabled" className="text-[11px] text-muted-foreground cursor-pointer">
              Send email alert for new logins
            </Label>
          </div>
        </div>

        <div className="space-y-1">
          <PasswordAuthAccordion
            passwordAuth={collection.passwordAuth}
            onChange={handlePasswordAuthChange}
            isSuperusers={isSuperusers}
            availableIdentityFields={availableIdentityFields}
          />

          {!isSuperusers && (
            <OAuth2Accordion
              oauth2={collection.oauth2}
              onChange={handleOAuth2Change}
              collectionName={collection.name}
              fields={collection.fields}
              onAddProvider={handleAddProvider}
              onEditProvider={handleEditProvider}
            />
          )}

          <OTPAccordion otp={collection.otp} onChange={handleOTPChange} />

          <MFAAccordion mfa={collection.mfa} onChange={handleMFAChange} />
        </div>
      </div>

      {/* Mail Templates Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mail templates
          </h4>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground hover:text-foreground">
            Send test email
          </Button>
        </div>

        <MailTemplatesSection collection={collection} onChange={onChange} isSuperusers={isSuperusers} />
      </div>

      {/* Other Section */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Other
        </h4>

        <TokenOptionsAccordion
          authToken={collection.authToken}
          verificationToken={collection.verificationToken}
          passwordResetToken={collection.passwordResetToken}
          emailChangeToken={collection.emailChangeToken}
          fileToken={collection.fileToken}
          onChange={handleTokenChange}
          isSuperusers={isSuperusers}
        />
      </div>

      {/* OAuth2 Providers List Panel */}
      <OAuth2ProvidersListPanel
        open={showProvidersListPanel}
        onOpenChange={setShowProvidersListPanel}
        providers={oauth2ProvidersConfig}
        onProviderSelect={handleSelectProvider}
      />

      {/* OAuth2 Provider Config Panel */}
      <OAuth2ProviderPanel
        open={showProviderPanel}
        onOpenChange={setShowProviderPanel}
        providerName={selectedProvider}
        config={selectedProviderConfig}
        redirectUri={redirectUri}
        onSave={handleSaveProvider}
        onDelete={handleDeleteProvider}
        onBack={handleBackFromProvider}
      />
    </div>
  )
}
