/**
 * SecretGeneratorButton - Generate random secrets
 * Used for generating API keys, tokens, and other secrets
 */
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SecretGeneratorButtonProps {
  /** Callback when secret is generated */
  onGenerate: (secret: string) => void
  /** Length of the generated secret */
  length?: number
  /** Include symbols in the secret */
  includeSymbols?: boolean
  /** Show copy button */
  showCopy?: boolean
  /** Additional class names */
  className?: string
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline'
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Disabled state */
  disabled?: boolean
}

// Generate a cryptographically strong random secret
function generateSecret(length: number = 32, includeSymbols: boolean = false): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let chars = lowercase + uppercase + numbers
  if (includeSymbols) {
    chars += symbols
  }

  // Use crypto API for better randomness if available
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  let secret = ''
  for (let i = 0; i < length; i++) {
    secret += chars[array[i] % chars.length]
  }

  return secret
}

export function SecretGeneratorButton({
  onGenerate,
  length = 32,
  includeSymbols = false,
  showCopy = false,
  className,
  variant = 'ghost',
  size = 'icon',
  disabled = false,
}: SecretGeneratorButtonProps) {
  const [copied, setCopied] = useState(false)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)

  const handleGenerate = useCallback(() => {
    const secret = generateSecret(length, includeSymbols)
    setLastGenerated(secret)
    onGenerate(secret)
  }, [length, includeSymbols, onGenerate])

  const handleCopy = useCallback(async () => {
    if (lastGenerated) {
      await navigator.clipboard.writeText(lastGenerated)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [lastGenerated])

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={handleGenerate}
            disabled={disabled}
            className="h-7 w-7"
            aria-label="Generate secret"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Generate random secret</TooltipContent>
      </Tooltip>

      {showCopy && lastGenerated && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              disabled={disabled}
              className="h-7 w-7"
              aria-label="Copy secret"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

export default SecretGeneratorButton
