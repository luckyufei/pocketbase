/**
 * AuthFields - Auth Collection 专用字段组件
 * 包含 email、emailVisibility、password、passwordConfirm、verified
 */
import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/ui/FormField'
import { Lock, RefreshCw, Copy, Check, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useConfirmation } from '@/hooks/useConfirmation'
import type { CollectionModel } from 'pocketbase'

interface AuthFieldsProps {
  record: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  collection: CollectionModel
  isNew: boolean
}

// Generate a random password with mixed characters
function generatePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  const allChars = lowercase + uppercase + numbers + symbols

  // Ensure at least one character of each type
  let password = ''
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  // Fill remaining characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

export function AuthFields({ record, onChange, collection, isNew }: AuthFieldsProps) {
  const { t } = useTranslation()
  const { confirm } = useConfirmation()
  const [changePasswordToggle, setChangePasswordToggle] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const generatedPasswordRef = useRef<HTMLSpanElement>(null)

  // 当 Popover 打开时生成密码
  const handleOpenChange = useCallback((open: boolean) => {
    setGeneratorOpen(open)
    if (open) {
      // 每次打开时都生成新密码
      const newPassword = generatePassword(16)
      setGeneratedPassword(newPassword)
      onChange('password', newPassword)
      onChange('passwordConfirm', newPassword)
      setCopied(false)
      // 选中生成的密码文本
      setTimeout(() => {
        if (generatedPasswordRef.current) {
          const range = document.createRange()
          range.selectNode(generatedPasswordRef.current)
          window.getSelection()?.removeAllRanges()
          window.getSelection()?.addRange(range)
        }
      }, 50)
    }
  }, [onChange])

  const isSuperusers = collection?.name === '_superusers'

  // Find email field configuration
  const emailField = collection?.fields?.find((f) => f.name === 'email')
  const emailRequired = emailField?.required ?? true

  // Handle verified toggle with confirmation
  const handleVerifiedChange = useCallback((checked: boolean) => {
    if (!isNew && record.verified && !checked) {
      // Unverifying - show confirmation
      confirm({
        title: t('records.confirmUnverify', 'Confirm Unverify'),
        message: t('records.confirmUnverifyMessage', 'Are you sure you want to mark this user as unverified?'),
        onConfirm: () => onChange('verified', false),
        isDanger: true
      })
    } else {
      onChange('verified', checked)
    }
  }, [isNew, record.verified, confirm, onChange, t])

  // Generate password - 刷新密码
  const handleGeneratePassword = useCallback(() => {
    const newPassword = generatePassword(16)
    setGeneratedPassword(newPassword)
    onChange('password', newPassword)
    onChange('passwordConfirm', newPassword)
    setCopied(false)
    // 选中生成的密码文本
    setTimeout(() => {
      if (generatedPasswordRef.current) {
        const range = document.createRange()
        range.selectNode(generatedPasswordRef.current)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }, 50)
  }, [onChange])

  // Copy generated password to clipboard
  const handleCopyPassword = useCallback(async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [generatedPassword])

  return (
    <div className="space-y-4">
      {/* Email Field */}
      <FormField name="email">
        <div data-field-label="" className="flex items-center justify-between w-full">
          <Label htmlFor="email">
            email
            {emailRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
          {!isSuperusers && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 text-xs',
                record.emailVisibility ? 'text-green-600' : 'text-muted-foreground'
              )}
              onClick={() => onChange('emailVisibility', !record.emailVisibility)}
            >
              Public: {record.emailVisibility ? 'On' : 'Off'}
            </Button>
          )}
        </div>
        <Input
          id="email"
          type="email"
          autoFocus={isNew}
          autoComplete="off"
          required={emailRequired}
          value={(record.email as string) || ''}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="email@example.com"
        />
      </FormField>

      {/* Change Password Toggle (Edit mode) */}
      {!isNew && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="change-password"
            checked={changePasswordToggle}
            onCheckedChange={(checked) => {
              setChangePasswordToggle(!!checked)
              if (!checked) {
                // Clear password fields
                onChange('password', undefined)
                onChange('passwordConfirm', undefined)
              }
            }}
          />
          <Label htmlFor="change-password" className="text-sm font-normal cursor-pointer">
            {t('records.changePassword', 'Change password')}
          </Label>
        </div>
      )}

      {/* Password Fields (New mode or toggle enabled) */}
      {(isNew || changePasswordToggle) && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Password */}
            <FormField name="password">
              <Label data-field-label="" htmlFor="password">
                <Lock className="inline h-3 w-3 mr-1" />
                Password
                <span className="text-destructive ml-1">*</span>
              </Label>
              {/* 与 UI 版本一致，闪光图标在输入框右侧内部 */}
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={(record.password as string) || ''}
                  onChange={(e) => onChange('password', e.target.value)}
                  className="pr-10"
                />
                {/* 密码生成器按钮 - 与 UI 版本一致，在输入框右侧 */}
                <Popover open={generatorOpen} onOpenChange={handleOpenChange}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Generate"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto px-2.5 py-1.5" 
                    side="top"
                    align="center"
                    sideOffset={4}
                  >
                    <div className="flex items-center gap-1.5">
                      <span 
                        ref={generatedPasswordRef}
                        className="font-mono text-sm select-all"
                      >
                        {generatedPassword}
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                        onClick={handleCopyPassword}
                        title={copied ? 'Copied!' : 'Copy'}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                        onClick={handleGeneratePassword}
                        title="Refresh"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </FormField>

            {/* Password Confirm */}
            <FormField name="passwordConfirm">
              <Label data-field-label="" htmlFor="passwordConfirm">
                <Lock className="inline h-3 w-3 mr-1" />
                Password confirm
                <span className="text-destructive ml-1">*</span>
              </Label>
              {/* 与 UI 版本一致，密码确认输入框不显示眼睛图标 */}
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                value={(record.passwordConfirm as string) || ''}
                onChange={(e) => onChange('passwordConfirm', e.target.value)}
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Verified Field (non-superusers) - 与 UI 版本一致，使用 Switch */}
      {!isSuperusers && (
        <div className="flex items-center space-x-2">
          <Switch
            id="verified"
            checked={!!record.verified}
            onCheckedChange={(checked) => handleVerifiedChange(!!checked)}
          />
          <Label htmlFor="verified" className="text-sm font-normal cursor-pointer">
            Verified
          </Label>
        </div>
      )}
    </div>
  )
}

export default AuthFields
