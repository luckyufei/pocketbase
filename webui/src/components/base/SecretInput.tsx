import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SecretInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  readOnly?: boolean
  revealDuration?: number // Auto-hide duration in ms, 0 = no auto-hide
}

/**
 * Get masked value showing only first and last 3 characters
 */
function getMaskedValue(val: string): string {
  if (!val || val.length <= 8) {
    return '•'.repeat(val?.length || 0)
  }
  const prefix = val.slice(0, 3)
  const suffix = val.slice(-3)
  const middle = '•'.repeat(Math.min(val.length - 6, 10))
  return prefix + middle + suffix
}

export function SecretInput({
  id,
  value,
  onChange,
  required = false,
  placeholder = '',
  readOnly = false,
  revealDuration = 5000,
}: SecretInputProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const maskedValue = getMaskedValue(value)

  const toggleReveal = useCallback(() => {
    setIsRevealed((prev) => {
      const newValue = !prev

      // Clear previous timer
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current)
        revealTimerRef.current = null
      }

      // If revealing and auto-hide is enabled
      if (newValue && revealDuration > 0) {
        revealTimerRef.current = setTimeout(() => {
          setIsRevealed(false)
          revealTimerRef.current = null
        }, revealDuration)
      }

      return newValue
    })
  }, [revealDuration])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="relative flex items-center">
      {isRevealed ? (
        <Input
          type="text"
          id={id}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="pr-10"
        />
      ) : (
        <Input
          type="password"
          id={id}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder || maskedValue}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="pr-10"
        />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-7 w-7 opacity-60 hover:opacity-100"
            onClick={toggleReveal}
            aria-label={isRevealed ? 'Hide secret' : 'Reveal secret'}
          >
            {isRevealed ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {isRevealed ? 'Hide' : 'Reveal'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
