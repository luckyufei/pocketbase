/**
 * PasswordField 组件
 *
 * 密码输入字段，支持：
 * - 显示/隐藏密码切换
 * - 密码强度提示
 * - 密码确认
 * - 密码生成器
 * - 遮罩模式（编辑现有密码）
 */
import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import { Eye, EyeOff, Key, RefreshCw, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordFieldProps {
  field: {
    id?: string
    name: string
    type: string
    required?: boolean
    min?: number
    max?: number
  }
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  showStrength?: boolean
  showConfirm?: boolean
  showGenerator?: boolean
  masked?: boolean
  className?: string
}

// 密码强度计算
function calculateStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) {
    return { score: 0, label: 'Empty', color: 'bg-gray-300' }
  }

  let score = 0

  // 长度检查
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1

  // 字符类型检查
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  // 根据分数返回强度
  if (score <= 2) {
    return { score, label: 'Weak', color: 'bg-red-500' }
  } else if (score <= 4) {
    return { score, label: 'Medium', color: 'bg-yellow-500' }
  } else if (score <= 6) {
    return { score, label: 'Strong', color: 'bg-green-500' }
  } else {
    return { score, label: 'Very Strong', color: 'bg-green-600' }
  }
}

// 生成随机密码
function generatePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  const allChars = lowercase + uppercase + numbers + symbols

  // 确保至少包含每种类型的一个字符
  let password = ''
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  // 填充剩余字符
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // 打乱顺序
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

export function PasswordField({
  field,
  value,
  onChange,
  disabled = false,
  showStrength = false,
  showConfirm = false,
  showGenerator = false,
  masked = false,
  className,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [confirmValue, setConfirmValue] = useState('')
  const [isMasked, setIsMasked] = useState(masked)

  const strength = useMemo(() => calculateStrength(value), [value])

  const passwordsMatch = !showConfirm || value === confirmValue
  const showMismatchError = showConfirm && confirmValue && !passwordsMatch

  const handleToggleVisibility = useCallback(() => {
    setShowPassword((prev) => !prev)
  }, [])

  const handleGeneratePassword = useCallback(() => {
    const minLength = Math.max(field.min || 8, 15)
    const newPassword = generatePassword(minLength)
    onChange(newPassword)
    if (showConfirm) {
      setConfirmValue(newPassword)
    }
  }, [field.min, onChange, showConfirm])

  const handleUnlock = useCallback(() => {
    setIsMasked(false)
    onChange('')
  }, [onChange])

  // 遮罩模式：显示占位符和解锁按钮
  if (isMasked) {
    return (
      <FormField name={field.name} className={cn('', className)}>
        <FieldLabel field={field as any} />
        <div className="relative">
          <Input type="text" placeholder="******" disabled className="pr-10" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
            onClick={handleUnlock}
            aria-label="Set new value"
          >
            <Key className="h-4 w-4" />
          </Button>
        </div>
      </FormField>
    )
  }

  return (
    <FormField name={field.name} className={cn('', className)}>
      <FieldLabel field={field as any} />

      {/* 主密码输入 */}
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="new-password"
          className={cn('pr-20', showGenerator && 'pr-28')}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {showGenerator && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleGeneratePassword}
              disabled={disabled}
              aria-label="Generate password"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleToggleVisibility}
            disabled={disabled}
            aria-label="Toggle password visibility"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* 密码强度指示器 */}
      {showStrength && value && (
        <div className="space-y-1" data-testid="password-strength">
          <div className="flex gap-1 h-1">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={cn(
                  'flex-1 rounded-full transition-colors',
                  strength.score >= level * 2 ? strength.color : 'bg-gray-200'
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{strength.label}</p>
        </div>
      )}

      {/* 密码确认输入 */}
      {showConfirm && (
        <div className="space-y-1">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            disabled={disabled}
            autoComplete="new-password"
            className={cn(showMismatchError && 'border-destructive')}
          />
          {showMismatchError && <p className="text-xs text-destructive">Passwords do not match</p>}
        </div>
      )}
    </FormField>
  )
}

export default PasswordField
