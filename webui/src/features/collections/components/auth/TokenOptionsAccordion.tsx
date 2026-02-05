/**
 * TokenOptionsAccordion - Token 选项配置组件
 * 与 UI 版本对齐，参考 TokenOptionsAccordion.svelte 和 TokenField.svelte
 */
import { useCallback, useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Key } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TokenConfig {
  duration: number
  secret?: string
}

interface TokenOptionsAccordionProps {
  authToken: TokenConfig
  verificationToken?: TokenConfig
  passwordResetToken: TokenConfig
  emailChangeToken?: TokenConfig
  fileToken: TokenConfig
  onChange: (updates: {
    authToken?: TokenConfig
    verificationToken?: TokenConfig
    passwordResetToken?: TokenConfig
    emailChangeToken?: TokenConfig
    fileToken?: TokenConfig
  }) => void
  isSuperusers?: boolean
}

// 生成随机 secret（与 UI 版本 CommonHelper.randomSecret 对齐）
function generateRandomSecret(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 单个 Token 配置字段（与 UI 版本 TokenField.svelte 对齐）
function TokenField({
  tokenKey,
  label,
  config,
  onChange,
}: {
  tokenKey: string
  label: string
  config: TokenConfig
  onChange: (config: TokenConfig) => void
}) {
  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...config,
        duration: parseInt(e.target.value) || 0,
      })
    },
    [config, onChange]
  )

  const handleInvalidateClick = useCallback(() => {
    // 切换：如果有 secret 则清除，否则生成新的
    if (config.secret) {
      onChange({
        ...config,
        secret: undefined,
      })
    } else {
      onChange({
        ...config,
        secret: generateRandomSecret(50),
      })
    }
  }, [config, onChange])

  const hasSecret = !!config.secret

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${tokenKey}-duration`} className="text-[12px] font-medium">
        {label} duration (in seconds) <span className="text-red-500">*</span>
      </Label>
      <Input
        id={`${tokenKey}-duration`}
        type="number"
        min={0}
        value={config.duration}
        onChange={handleDurationChange}
        placeholder="No change"
        className="h-9 text-[13px]"
      />
      <button
        type="button"
        onClick={handleInvalidateClick}
        className={cn(
          'text-[11px] cursor-pointer transition-colors select-none',
          hasSecret
            ? 'text-green-600 hover:text-green-700 font-medium'
            : 'text-blue-600 hover:text-blue-700 hover:underline'
        )}
      >
        Invalidate all previously issued tokens
      </button>
    </div>
  )
}

export function TokenOptionsAccordion({
  authToken,
  verificationToken,
  passwordResetToken,
  emailChangeToken,
  fileToken,
  onChange,
  isSuperusers = false,
}: TokenOptionsAccordionProps) {
  // 确保所有 token 都有默认值
  const safeAuthToken = authToken || { duration: 604800 }
  const safeVerificationToken = verificationToken || { duration: 259200 }
  const safePasswordResetToken = passwordResetToken || { duration: 1800 }
  const safeEmailChangeToken = emailChangeToken || { duration: 1800 }
  const safeFileToken = fileToken || { duration: 180 }

  // 根据是否是 superusers 确定显示的 token 列表
  const tokensList = useMemo(() => {
    if (isSuperusers) {
      return [
        { key: 'authToken', label: 'Auth', config: safeAuthToken },
        { key: 'passwordResetToken', label: 'Password reset', config: safePasswordResetToken },
        { key: 'fileToken', label: 'Protected file access', config: safeFileToken },
      ]
    }
    return [
      { key: 'authToken', label: 'Auth', config: safeAuthToken },
      { key: 'verificationToken', label: 'Email verification', config: safeVerificationToken },
      { key: 'passwordResetToken', label: 'Password reset', config: safePasswordResetToken },
      { key: 'emailChangeToken', label: 'Email change', config: safeEmailChangeToken },
      { key: 'fileToken', label: 'Protected file access', config: safeFileToken },
    ]
  }, [isSuperusers, safeAuthToken, safeVerificationToken, safePasswordResetToken, safeEmailChangeToken, safeFileToken])

  const handleTokenChange = useCallback(
    (key: string, config: TokenConfig) => {
      onChange({ [key]: config })
    },
    [onChange]
  )

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="token-options" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px]">Tokens options (invalidate, duration)</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-4">
          <div className="grid grid-cols-2 gap-4">
            {tokensList.map((token) => (
              <TokenField
                key={token.key}
                tokenKey={token.key}
                label={token.label}
                config={token.config}
                onChange={(config) => handleTokenChange(token.key, config)}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
