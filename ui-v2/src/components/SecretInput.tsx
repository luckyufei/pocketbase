/**
 * SecretInput - 密文输入组件
 *
 * 特性:
 * - 掩码显示（前后各3字符）
 * - Reveal 切换显示/隐藏
 * - 5秒自动隐藏
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Eye, EyeOff } from 'lucide-react'
import { cn, maskSecret } from '@/lib/utils'

export interface SecretInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  revealDuration?: number // 自动隐藏时间(ms)，默认 5000，0 表示不自动隐藏
  className?: string
}

export function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  revealDuration = 5000,
  className,
}: SecretInputProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 清除定时器
  const clearRevealTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 切换显示/隐藏
  const toggleReveal = useCallback(() => {
    setIsRevealed((prev) => {
      const newValue = !prev
      clearRevealTimer()

      // 如果显示明文且设置了自动隐藏时间
      if (newValue && revealDuration > 0) {
        timerRef.current = setTimeout(() => {
          setIsRevealed(false)
          timerRef.current = null
        }, revealDuration)
      }

      return newValue
    })
  }, [revealDuration, clearRevealTimer])

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      clearRevealTimer()
    }
  }, [clearRevealTimer])

  const maskedValue = maskSecret(value)

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        id={id}
        type={isRevealed ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || (value ? maskedValue : '')}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={isRevealed ? 'off' : 'new-password'}
        spellCheck={false}
        className="pr-10"
        data-testid="secret-input"
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 h-7 w-7 opacity-60 hover:opacity-100"
              onClick={toggleReveal}
              disabled={disabled}
              aria-label={isRevealed ? 'Hide secret' : 'Reveal secret'}
              data-testid="reveal-button"
            >
              {isRevealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isRevealed ? 'Hide' : 'Reveal'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
